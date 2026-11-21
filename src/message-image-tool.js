import { MAX_FILE_BYTES, MAX_IMAGE_BYTES, imageKeysOf, sniffImageType } from './inbound.js';
import { defineFeishuTool, renderToolOutput, resolveSandboxMode, resolveSessionCwd } from './tool-contract.js';
import { writeNewWorkspaceFile } from './user-identity/cloud-download.js';

export const MESSAGE_ATTACHMENT_TOOL_NAME = 'feishu_message_attachment';

const dimensionSchema = { type: 'integer' };
export const MESSAGE_ATTACHMENT_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['image', 'file'] },
    chatId: { type: 'string' },
    messageId: { type: 'string' },
    imageIndex: { type: 'integer' },
    image: {
      type: 'object',
      additionalProperties: false,
      properties: {
        attachmentId: { type: 'string' },
        mediaType: { type: 'string' },
        bytes: { type: 'integer' },
        width: dimensionSchema,
        height: dimensionSchema,
        name: { type: 'string' },
        originalDimensions: {
          type: 'object', additionalProperties: false,
          properties: { width: dimensionSchema, height: dimensionSchema },
          required: ['width', 'height'],
        },
      },
      required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'],
    },
    fileName: { type: 'string' },
    path: { type: 'string' },
    bytes: { type: 'integer' },
  },
  required: ['kind', 'chatId', 'messageId'],
};

export function messageImageKey(message, { chatId, messageId, imageIndex }) {
  if (!message || message.deleted) throw new Error('找不到可读取的飞书消息');
  if (message.messageId !== messageId || message.chatId !== chatId) throw new Error('飞书消息不属于指定会话');
  const keys = message.imageKeys ?? imageKeysOf(message);
  if (!keys.length) throw new Error('该飞书消息没有可读取的图片');
  const key = keys[imageIndex - 1];
  if (!key) throw new Error(`该飞书消息有 ${keys.length} 张图片，imageIndex 超出范围`);
  return key;
}

/** 校验消息归属并提取文件消息的 file_key 与 file_name。 */
export function messageFileResource(message, { chatId, messageId }) {
  if (!message || message.deleted) throw new Error('找不到可下载的飞书消息');
  if (message.messageId !== messageId || message.chatId !== chatId) throw new Error('飞书消息不属于指定会话');
  const msgType = message.msgType ?? message.msg_type ?? '';
  if (!['file', 'audio', 'media'].includes(msgType)) {
    throw new Error(`该飞书消息类型为 ${msgType || 'unknown'}，不包含可下载的文件附件`);
  }
  let parsed = {};
  try {
    const raw = message.bodyContent ?? message.body?.content ?? '';
    parsed = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : {});
  } catch {
    parsed = {};
  }
  const fileKey = typeof parsed?.file_key === 'string' ? parsed.file_key.trim() : '';
  if (!fileKey) throw new Error('该飞书消息缺少有效的文件 key');
  const fileName = typeof parsed?.file_name === 'string' && parsed.file_name.trim()
    ? parsed.file_name.trim()
    : `${messageId}.bin`;
  return { fileKey, fileName };
}

function projectAttachment(attachment) {
  const projected = {
    attachmentId: attachment.attachmentId,
    mediaType: attachment.mediaType,
    bytes: attachment.bytes,
    width: attachment.width,
    height: attachment.height,
  };
  if (typeof attachment.name === 'string') projected.name = attachment.name;
  if (attachment.originalDimensions && typeof attachment.originalDimensions === 'object') {
    projected.originalDimensions = {
      width: attachment.originalDimensions.width,
      height: attachment.originalDimensions.height,
    };
  }
  return projected;
}

export async function readMessageImage(target, context, harness, download) {
  const { signal } = context ?? {};
  const limits = harness?.imageLimits;
  if (!limits) throw new Error('DSH 图片附件服务不可用');
  const candidates = [MAX_IMAGE_BYTES, limits.maxImageBytes, limits.maxMessageImageBytes]
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxBytes = Math.min(...candidates);
  const downloaded = await download({ ...target, maxBytes, signal });
  const data = Buffer.isBuffer(downloaded) ? downloaded : downloaded?.bytes;
  const chatId = (Buffer.isBuffer(downloaded) ? null : downloaded?.chatId) || target.chatId || '';
  signal?.throwIfAborted();
  const mediaType = sniffImageType(data);
  if (!mediaType || !limits.mediaTypes.includes(mediaType)) throw new Error('图片格式不受当前 DSH 支持');
  const name = `feishu-${target.messageId}-${target.imageIndex}`;
  const image = await harness.saveImage({ data, mediaType, name }, context);
  return { kind: 'image', chatId, messageId: target.messageId, imageIndex: target.imageIndex, image: projectAttachment(image) };
}

export function renderMessageAttachment(value) {
  if (value.kind === 'image' && value.image) {
    return [
      { type: 'text', text: `飞书会话 ${value.chatId} 中消息 ${value.messageId} 的第 ${value.imageIndex} 张图片。` },
      { type: 'image', attachment: value.image },
    ];
  }
  return renderToolOutput(value, `已下载消息 ${value.messageId} 中的文件「${value.fileName}」（${value.bytes} 字节）到 ${value.path}。`);
}

/** 统一读取飞书历史消息中的图片，或下载历史消息中的文件附件到本地工作区。 */
export function createMessageAttachmentTool({
  downloadBotImage,
  downloadAvatarImage,
  downloadBotFile,
  downloadAvatarFile,
  harness,
} = {}) {
  return defineFeishuTool({
    name: MESSAGE_ATTACHMENT_TOOL_NAME,
    description: '读取飞书历史消息的原图，或把消息中的文件附件下载到当前工作区。',
    timeoutMs: 60_000,
    isConcurrencySafe: (args) => args?.action === 'read_image',
    presentCall: (args) => {
      const who = args?.identity === 'avatar' ? '分身' : '机器人';
      if (args?.action === 'download_file') {
        return { card: 'generic', kind: 'edit', title: `下载飞书消息文件（${who} ${args?.messageId ?? ''} → ${args?.path ?? ''}）` };
      }
      return { card: 'generic', kind: 'read', title: `读取飞书消息图片（${who} ${args?.messageId ?? ''}）` };
    },
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['read_image', 'download_file'], description: 'read_image 查看消息原图 / download_file 下载文件附件到工作区。' },
        identity: { type: 'string', enum: ['bot', 'avatar'], description: '身份：bot 机器人 / avatar 本人分身。' },
        chatId: { type: 'string', description: '会话 chat_id（oc_…）；avatar 必填，bot 省略时使用当前绑定会话。' },
        messageId: { type: 'string', description: '历史消息 ID（om_…）。' },
        imageIndex: { type: 'integer', default: 1, description: '仅 read_image 可选，图片序号从 1 开始，默认 1。' },
        path: { type: 'string', description: '仅 download_file 必填，相对当前会话工作区的新文件路径。' },
        bot: { type: 'string', description: '仅 identity 为 bot 时可用：机器人别名、名称或 id。' },
      },
      required: ['action', 'identity', 'messageId'],
    },
    output: {
      schema: MESSAGE_ATTACHMENT_OUTPUT,
      render: (_args, value) => renderMessageAttachment(value),
    },
    async execute(args, context) {
      const { action, identity } = args;
      const chatId = args.chatId?.trim();
      const messageId = args.messageId?.trim();
      if (identity === 'avatar' && args.bot !== undefined) {
        throw new Error('identity 为 avatar 时不支持 bot 参数');
      }
      if (identity === 'avatar' || chatId) {
        if (!/^oc_[\w-]+$/.test(chatId ?? '')) throw new Error('需要有效的 chatId（oc_…）');
      }
      if (!/^om_[\w-]+$/.test(messageId ?? '')) throw new Error('需要有效的 messageId（om_…）');

      if (action === 'read_image') {
        if (args.path !== undefined) throw new Error('read_image 不接受 path 参数');
        const imageIndex = args.imageIndex ?? 1;
        if (!Number.isSafeInteger(imageIndex) || imageIndex < 1) throw new Error('imageIndex 需要是从 1 开始的整数');
        const target = { ...(chatId ? { chatId } : {}), messageId, imageIndex };
        if (identity === 'avatar') {
          if (typeof downloadAvatarImage !== 'function') throw new Error('飞书分身图片读取不可用');
          return readMessageImage(target, context, harness, (input) => downloadAvatarImage(input, context));
        }
        if (typeof downloadBotImage !== 'function') throw new Error('机器人图片读取不可用');
        return readMessageImage(target, context, harness, (input) => downloadBotImage({
          ...input, sessionId: context?.agent?.session?.id, bot: args.bot,
        }));
      }

      // action === 'download_file'
      if (args.imageIndex !== undefined) throw new Error('download_file 不接受 imageIndex 参数');
      const savePath = typeof args.path === 'string' ? args.path.trim() : '';
      if (!savePath) throw new Error('download_file 必须提供本地 path');
      const sandboxMode = resolveSandboxMode(context, harness);
      if (sandboxMode === 'read-only') {
        throw new Error('当前会话处于只读沙箱模式，不允许向本地下载写入文件');
      }
      const cwd = await resolveSessionCwd(context, harness);
      const signal = context?.signal;
      const target = { ...(chatId ? { chatId } : {}), messageId, maxBytes: MAX_FILE_BYTES, signal };
      const downloaded = identity === 'avatar'
        ? await (() => {
          if (typeof downloadAvatarFile !== 'function') throw new Error('飞书分身文件下载不可用');
          return downloadAvatarFile(target, context);
        })()
        : await (() => {
          if (typeof downloadBotFile !== 'function') throw new Error('机器人文件下载不可用');
          return downloadBotFile({ ...target, sessionId: context?.agent?.session?.id, bot: args.bot });
        })();
      const data = Buffer.isBuffer(downloaded) ? downloaded : downloaded?.bytes;
      const resolvedChatId = (Buffer.isBuffer(downloaded) ? null : downloaded?.chatId) || chatId || '';
      const fileName = (Buffer.isBuffer(downloaded) ? null : downloaded?.fileName) || `${messageId}.bin`;
      const written = await writeNewWorkspaceFile({ path: savePath, cwd, data, signal, sandboxMode });
      return {
        kind: 'file',
        chatId: resolvedChatId,
        messageId,
        fileName,
        path: written.path,
        bytes: written.bytes,
      };
    },
  });
}
