import { MAX_IMAGE_BYTES, imageKeysOf, sniffImageType } from './inbound.js';

export const MESSAGE_IMAGE_PARAMETERS = {
  action: { type: 'string', enum: ['list', 'read_image'], description: '默认 list 查询历史，read_image 查看指定消息的图片。' },
  messageId: { type: 'string', description: 'read_image 必填，使用历史结果中的消息 ID（om_…）。' },
  imageIndex: { type: 'integer', description: 'read_image 可选，图片序号从 1 开始，默认第一张。' },
};

const dimensionSchema = { type: 'integer' };
export const MESSAGE_IMAGE_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
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
  },
  required: ['chatId', 'messageId', 'imageIndex', 'image'],
};

export function messageImageTarget(args) {
  if (args.action !== 'read_image') {
    if (args.messageId !== undefined || args.imageIndex !== undefined) {
      throw new Error('messageId 和 imageIndex 用于 read_image 操作');
    }
    return null;
  }
  const chatId = args.chatId?.trim();
  const messageId = args.messageId?.trim();
  const imageIndex = args.imageIndex ?? 1;
  if (!/^oc_[\w-]+$/.test(chatId ?? '')) throw new Error('read_image 需要显式提供有效的 chatId');
  if (!/^om_[\w-]+$/.test(messageId ?? '')) throw new Error('read_image 需要有效的 messageId');
  if (!Number.isSafeInteger(imageIndex) || imageIndex < 1) throw new Error('imageIndex 需要是从 1 开始的整数');
  return { chatId, messageId, imageIndex };
}

export function messageImageKey(message, { chatId, messageId, imageIndex }) {
  if (!message || message.deleted) throw new Error('找不到可读取的飞书消息');
  if (message.messageId !== messageId || message.chatId !== chatId) throw new Error('飞书消息不属于指定会话');
  const keys = message.imageKeys ?? imageKeysOf(message);
  if (!keys.length) throw new Error('该飞书消息没有可读取的图片');
  const key = keys[imageIndex - 1];
  if (!key) throw new Error(`该飞书消息有 ${keys.length} 张图片，imageIndex 超出范围`);
  return key;
}

export async function readMessageImage(target, context, harness, download) {
  const { signal } = context ?? {};
  const limits = harness?.imageLimits;
  if (!limits) throw new Error('DSH 图片附件服务不可用');
  const maxBytes = Math.min(MAX_IMAGE_BYTES, limits.maxImageBytes, limits.maxMessageImageBytes);
  const data = await download({ ...target, maxBytes, signal });
  signal?.throwIfAborted();
  const mediaType = sniffImageType(data);
  if (!mediaType || !limits.mediaTypes.includes(mediaType)) throw new Error('图片格式不受当前 DSH 支持');
  const name = `feishu-${target.messageId}-${target.imageIndex}`;
  const image = await harness.saveImage({ data, mediaType, name }, context);
  return { ...target, image };
}

export function renderMessageImage({ chatId, messageId, imageIndex, image }) {
  return [
    { type: 'text', text: `飞书会话 ${chatId} 中消息 ${messageId} 的第 ${imageIndex} 张图片。` },
    { type: 'image', attachment: image },
  ];
}
