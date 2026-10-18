/**
 * Turn one inbound Feishu message into DSH prompt content.
 *
 * Images travel as native image parts (the Host admits the bytes); files are
 * saved under the plugin data directory and handed to the model as a path, which
 * keeps large binaries out of the prompt.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

/** Detect the four image media types DSH accepts from the leading bytes. */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  return null;
}

function safeName(value, fallback) {
  const raw = typeof value === 'string' ? value : '';
  const cleaned = raw.replace(/[\\/\u0000-\u001f]/g, '_').trim();
  return (cleaned || fallback).slice(0, 120);
}

function parseContent(message) {
  try {
    const parsed = JSON.parse(message?.content ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function imageKeysOf(message) {
  const content = parseContent(message);
  if (message?.message_type === 'image' && content.image_key) return [content.image_key];
  if (message?.message_type === 'post') {
    const rows = Array.isArray(content?.content) ? content.content : [];
    return rows.flat().filter((node) => node?.tag === 'img' && node.image_key).map((node) => node.image_key);
  }
  return [];
}

export class InboundContent {
  #bot;
  #inboxDir;
  #logger;

  constructor({ bot, inboxDir, logger }) {
    this.#bot = bot;
    this.#inboxDir = inboxDir;
    this.#logger = logger ?? console;
  }

  async #save(bytes, baseName) {
    await mkdir(this.#inboxDir, { recursive: true });
    const target = join(this.#inboxDir, baseName);
    await writeFile(target, bytes, { mode: 0o600 });
    return target;
  }

  /**
   * Build the prompt content parts plus the text that was visible to the model,
   * so callers can still treat an image-only message as addressed input.
   */
  async build(message, text) {
    const parts = [];
    const notes = [];
    if (text) parts.push({ type: 'text', text });

    const imageKeys = imageKeysOf(message).slice(0, 9);
    for (const [index, key] of imageKeys.entries()) {
      try {
        const bytes = await this.#bot.downloadResource(message.message_id, key, 'image');
        if (bytes.length > MAX_IMAGE_BYTES) {
          const saved = await this.#save(bytes, `${message.message_id}-${index}.bin`);
          notes.push(`（第 ${index + 1} 张图片过大，已保存到 ${saved}）`);
          continue;
        }
        const mediaType = sniffImageType(bytes);
        if (!mediaType) {
          const saved = await this.#save(bytes, `${message.message_id}-${index}.bin`);
          notes.push(`（第 ${index + 1} 张图片格式不受支持，已保存到 ${saved}）`);
          continue;
        }
        parts.push({
          type: 'image',
          mediaType,
          data: bytes.toString('base64'),
          name: `feishu-${message.message_id}-${index + 1}`,
        });
      } catch (error) {
        this.#logger?.warn?.('[im-feishu] image download failed', error?.message ?? error);
        notes.push('（有一张图片下载失败）');
      }
    }

    if (message?.message_type === 'file') {
      const content = parseContent(message);
      if (content.file_key) {
        try {
          const bytes = await this.#bot.downloadResource(message.message_id, content.file_key, 'file');
          if (bytes.length > MAX_FILE_BYTES) {
            notes.push(`（文件超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB，未下载）`);
          } else {
            const name = safeName(content.file_name, 'feishu-file');
            const saved = await this.#save(bytes, `${message.message_id}-${name}`);
            notes.push(`用户发送了文件「${name}」（${bytes.length} 字节，已保存到 ${saved}），需要时可以直接读取该路径。`);
          }
        } catch (error) {
          this.#logger?.warn?.('[im-feishu] file download failed', error?.message ?? error);
          notes.push('（用户发送的文件下载失败）');
        }
      }
    }

    if (notes.length > 0) {
      const noteText = notes.join('\n');
      const existing = parts.find((part) => part.type === 'text');
      if (existing) existing.text = `${existing.text}\n\n${noteText}`;
      else parts.push({ type: 'text', text: noteText });
    }

    return {
      parts,
      hasInput: parts.some((part) => part.type === 'image' || part.type === 'text'),
    };
  }
}
