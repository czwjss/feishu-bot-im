/**
 * Turn one inbound Feishu message into DSH prompt content.
 *
 * Images travel as native image parts (the Host admits the bytes); files are
 * saved under the plugin data directory and handed to the model as a path, which
 * keeps large binaries out of the prompt.
 */
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { messageContentOf, messageTypeOf, decodePost } from './message-content.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MESSAGE_IMAGES = 9;
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

export function imageKeysOf(message) {
  const type = messageTypeOf(message);
  if (type === 'interactive') return imageKeysOfCard(messageContentOf(message));
  if (type !== 'image' && type !== 'post') return [];
  const content = messageContentOf(message);
  if (type === 'post') return decodePost(content).imageKeys;
  return typeof content.image_key === 'string' && content.image_key ? [content.image_key] : [];
}

/** Card images use img_key/image_key at arbitrary nesting levels. */
export function imageKeysOfCard(content) {
  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return [];
  }
  const keys = new Set();
  const visit = (node, depth = 0) => {
    if (!node || depth > 8 || keys.size >= MAX_MESSAGE_IMAGES) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    for (const key of [node.img_key, node.image_key, node.imageKey, node.imgKey, node.image?.image_key]) {
      if (typeof key === 'string' && key.trim()) keys.add(key.trim());
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };
  visit(parsed);
  return [...keys].slice(0, MAX_MESSAGE_IMAGES);
}

export function imagePromptPart(data, mediaType, name) {
  return { type: 'image', mediaType, data: data.toString('base64'), name };
}

export function imageSizeError(maxBytes) {
  return new Error(`图片超过当前可用大小上限（${maxBytes} 字节）`);
}

/** Bound memory while reading a Feishu image download stream. */
export async function readImageBytes(stream, maxBytes, signal) {
  if (!stream) throw new Error('飞书未返回图片内容');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    signal?.throwIfAborted();
    bytes += chunk.length;
    if (bytes > maxBytes) throw imageSizeError(maxBytes);
    chunks.push(chunk);
  }
  signal?.throwIfAborted();
  return Buffer.concat(chunks, bytes);
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
    const root = resolve(this.#inboxDir);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const cleanName = safeName(baseName, 'feishu-file').replace(/\.\.+/g, '_');
    const target = resolve(root, cleanName);
    const rel = relative(root, target);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('非法的附件文件名');
    }
    await writeFile(target, bytes, { mode: 0o600 });
    return target;
  }

  /** 清理超过保留期的历史入站临时文件，避免 inbox 目录长期无限增长。 */
  async cleanupExpired(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    if (!this.#inboxDir) return 0;
    const entries = await readdir(this.#inboxDir, { withFileTypes: true }).catch(() => null);
    if (!entries) return 0;
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const target = join(this.#inboxDir, entry.name);
      const info = await stat(target).catch(() => null);
      if (info && info.mtimeMs < cutoff) {
        await rm(target, { force: true }).catch(() => undefined);
        removed += 1;
      }
    }
    return removed;
  }
  /**
   * Download images from a quoted message or its card. The returned parts are
   * native image parts; failed downloads are reported as notes, not guessed.
   */
  async buildQuotedImages(parent = {}) {
    const messageId = typeof parent.messageId === 'string' ? parent.messageId : '';
    if (!messageId) return { parts: [], notes: [], count: 0 };
    const messageType = parent.messageType ?? parent.message_type ?? '';
    const content = parent.bodyContent ?? parent.content ?? '';
    const unique = imageKeysOf({ message_type: messageType, content }).slice(0, MAX_MESSAGE_IMAGES);
    const parts = [];
    const notes = [];
    for (const [index, key] of unique.entries()) {
      try {
        const bytes = await this.#bot.downloadResource(messageId, key, 'image', { maxBytes: MAX_IMAGE_BYTES });
        if (bytes.length > MAX_IMAGE_BYTES) {
          notes.push(`引用消息的第 ${index + 1} 张图片超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB，未加载`);
          continue;
        }
        const mediaType = sniffImageType(bytes);
        if (!mediaType) {
          notes.push(`引用消息的第 ${index + 1} 张图片格式不受支持`);
          continue;
        }
        parts.push(imagePromptPart(bytes, mediaType, `feishu-quote-${messageId}-${index + 1}`));
      } catch (error) {
        if (/超过当前可用大小上限/.test(error?.message ?? '')) {
          notes.push(`引用消息的第 ${index + 1} 张图片超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB，未加载`);
          continue;
        }
        this.#logger?.warn?.('[im-feishu] quoted image download failed', error?.message ?? error);
        notes.push(`引用消息的第 ${index + 1} 张图片下载失败`);
      }
    }
    return { parts, notes, count: unique.length };
  }

  /**
   * Build the prompt content parts plus the text that was visible to the model,
   * so callers can still treat an image-only message as addressed input.
   */
  async build(message, text) {
    const parts = [];
    const notes = [];
    if (text) parts.push({ type: 'text', text });

    const imageKeys = imageKeysOf(message).slice(0, MAX_MESSAGE_IMAGES);
    for (const [index, key] of imageKeys.entries()) {
      try {
        const bytes = await this.#bot.downloadResource(message.message_id, key, 'image', { maxBytes: MAX_FILE_BYTES });
        if (bytes.length > MAX_IMAGE_BYTES) {
          const saved = await this.#save(bytes, `${safeName(message.message_id, 'msg')}-${index}.bin`);
          notes.push(`（第 ${index + 1} 张图片过大，已保存到 ${saved}）`);
          continue;
        }
        const mediaType = sniffImageType(bytes);
        if (!mediaType) {
          const saved = await this.#save(bytes, `${safeName(message.message_id, 'msg')}-${index}.bin`);
          notes.push(`（第 ${index + 1} 张图片格式不受支持，已保存到 ${saved}）`);
          continue;
        }
        parts.push(imagePromptPart(bytes, mediaType, `feishu-${message.message_id}-${index + 1}`));
      } catch (error) {
        if (/超过当前可用大小上限/.test(error?.message ?? '')) {
          notes.push(`（第 ${index + 1} 张图片超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB，未下载）`);
          continue;
        }
        this.#logger?.warn?.('[im-feishu] image download failed', error?.message ?? error);
        notes.push('（有一张图片下载失败）');
      }
    }

    if (messageTypeOf(message) === 'file') {
      const content = messageContentOf(message);
      if (content.file_key) {
        try {
          const bytes = await this.#bot.downloadResource(message.message_id, content.file_key, 'file', { maxBytes: MAX_FILE_BYTES });
          if (bytes.length > MAX_FILE_BYTES) {
            notes.push(`（文件超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB，未下载）`);
          } else {
            const name = safeName(content.file_name, 'feishu-file');
            const saved = await this.#save(bytes, `${safeName(message.message_id, 'msg')}-${name}`);
            notes.push(`用户发送了文件「${name}」（${bytes.length} 字节，已保存到 ${saved}），需要时可以直接读取该路径。`);
          }
        } catch (error) {
          if (/超过当前可用大小上限/.test(error?.message ?? '')) {
            notes.push(`（文件超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB，未下载）`);
          } else {
            this.#logger?.warn?.('[im-feishu] file download failed', error?.message ?? error);
            notes.push('（用户发送的文件下载失败）');
          }
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
