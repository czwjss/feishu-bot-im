import { MAX_IMAGE_BYTES, MAX_MESSAGE_IMAGES, imagePromptPart, sniffImageType } from '../inbound.js';
import { DEFAULT_TIMEOUT_MS, downloadMessageImage } from './api.js';
import { createUserFeishuRequest, withAccessToken } from './auth.js';

export async function loadBatchImages({ auth, chat, messages, cachedMessages, limits, signal, getMessage, fetchImpl, validateImage }) {
  const parts = [];
  const notes = new Map();
  if (!messages.some((message) => message.imageKeys?.length || !message.imageKeys || message.parentId)) {
    return { parts, notes };
  }

  const itemSignal = () => {
    const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    return { timeout, signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
  };
  const ownerOpenId = chat.ownerOpenId;
  const scopedAuth = ownerOpenId ? {
    async requireAccessToken(options) {
      const identity = await auth.requireAccessIdentity(options);
      if (identity.openId !== ownerOpenId) throw new Error('飞书分身账号已切换');
      return identity.accessToken;
    },
  } : auth;
  const stored = new Map([...cachedMessages, ...messages].map((message) => [message.messageId, message]));
  const loaded = new Map();
  const maxImages = Math.min(MAX_MESSAGE_IMAGES, limits?.maxImagesPerMessage ?? MAX_MESSAGE_IMAGES);
  const maxImageBytes = Math.min(MAX_IMAGE_BYTES, limits?.maxImageBytes ?? MAX_IMAGE_BYTES);
  let remainingBytes = limits?.maxMessageImageBytes ?? maxImages * maxImageBytes;

  function failure(error, timeout) {
    signal?.throwIfAborted();
    return timeout?.aborted ? '图片读取超时' : (error?.message || '飞书图片读取失败');
  }

  async function loadMessage(messageId) {
    let keys = stored.get(messageId)?.imageKeys;
    if (!keys) {
      const attempt = itemSignal();
      try {
        const message = await withAccessToken(scopedAuth, (accessToken) => getMessage({
          accessToken, messageId, fetchImpl, signal: attempt.signal,
        }), attempt.signal);
        if (!message || message.deleted) throw new Error('原消息不可读取');
        if (message.chatId !== chat.chatId || message.messageId !== messageId) throw new Error('原消息不属于当前会话');
        keys = message.imageKeys ?? [];
      } catch (error) {
        return [{ lookupFailed: true, error: failure(error, attempt.timeout) }];
      }
    }

    const result = [];
    for (const [offset, imageKey] of keys.entries()) {
      const imageIndex = offset + 1;
      if (parts.length >= maxImages || remainingBytes <= 0) {
        result.push({ imageIndex, error: '本批图片已达到加载上限' });
        continue;
      }
      const attempt = itemSignal();
      try {
        const request = createUserFeishuRequest({ auth: scopedAuth, fetchImpl, signal: attempt.signal });
        const data = await downloadMessageImage({
          request, messageId, imageKey, maxBytes: Math.min(maxImageBytes, remainingBytes), signal: attempt.signal,
        });
        const mediaType = sniffImageType(data);
        if (!mediaType || (limits?.mediaTypes && !limits.mediaTypes.includes(mediaType))) {
          throw new Error('图片格式不受当前 DSH 支持');
        }
        const name = `feishu-${messageId}-${imageIndex}`;
        await validateImage?.({ data, mediaType, name }, attempt.signal);
        remainingBytes -= data.length;
        const partIndex = parts.push(imagePromptPart(data, mediaType, name));
        result.push({ imageIndex, partIndex });
      } catch (error) {
        result.push({ imageIndex, error: failure(error, attempt.timeout) });
      }
    }
    return result;
  }

  async function annotations(messageId, source) {
    if (!loaded.has(messageId)) loaded.set(messageId, await loadMessage(messageId));
    return loaded.get(messageId).map(({ imageIndex, lookupFailed, ...entry }) => ({
      label: imageIndex ? `${source}的第 ${imageIndex} 张图片`
        : (lookupFailed ? `${source}无法读取原消息，未确认是否含图片` : `${source}的图片附件`),
      ...(lookupFailed ? { error: entry.error } : entry),
    }));
  }

  for (const { messageId, parentId } of messages) {
    const entries = await annotations(messageId, '本消息');
    if (parentId && parentId !== messageId) entries.push(...await annotations(parentId, `引用消息（${parentId}）`));
    if (entries.length) notes.set(messageId, entries);
  }
  return { parts, notes };
}
