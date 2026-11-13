import { messageContentOf, messageTypeOf, decodePost, renderPostText } from './message-content.js';

/** Text helpers shared by the bridge and the turn runner. */

/** `chat:<id>` → the Feishu chat id (`oc_…`). */
export function chatIdOfKey(key) {
  if (typeof key !== 'string' || !key) return null;
  return key.replace(/^chat:/, '') || null;
}

export function scopedValue(value, scope, fallback) {
  if (value && typeof value === 'object') return value[scope] ?? fallback;
  return value ?? fallback;
}

/** 兜底上限：飞书流式模式会在 10 分钟后自动关闭，超过就不再等。 */
export const CARD_STUCK_MS = 10 * 60_000;

/**
 * 卡片是否仍在流式输出。
 * 飞书卡片 JSON 2.0 在 config.streaming_mode 里标明状态：true 表示还在增量刷新，
 * 收尾时发送方会把它置为 false。解析不到时返回 null（旧版卡片没有这个字段）。
 */
export function cardStreamingOf(content) {
  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return null;
  }
  const value = parsed?.config?.streaming_mode;
  return typeof value === 'boolean' ? value : null;
}

/** Flatten readable text from a Feishu interactive card body. */
export function interactiveTextOfContent(content, { maxLength = 2_000 } = {}) {
  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return typeof content === 'string' ? content.trim() : '';
  }
  if (!parsed || typeof parsed !== 'object') return '';
  const values = [];
  const seen = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      values.push(text);
    }
  };
  const visit = (node, depth = 0) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    add(node.content);
    add(node.text);
    add(node.text?.content);
    add(node.title);
    add(node.title?.content);
    for (const key of ['header', 'body', 'elements', 'fields', 'columns', 'column_set']) {
      if (node[key]) visit(node[key], depth + 1);
    }
  };
  visit(parsed);
  return values.join('\n').slice(0, maxLength);
}

export function textOfContentOrPost(message) {
  const content = messageContentOf(message);
  switch (messageTypeOf(message)) {
    case 'text': return typeof content.text === 'string' ? content.text : null;
    case 'interactive': return interactiveTextOfContent(content) || null;
    case 'post': {
      const post = decodePost(content);
      return renderPostText(post, { includeTitle: false }) || post.title || null;
    }
    default: return null;
  }
}
