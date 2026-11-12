/** Text helpers shared by the bridge and the turn runner. */

/** `chat:<id>` / `topic:<id>:<n>` → the Feishu chat id (`oc_…`). */
export function chatIdOfKey(key) {
  if (typeof key !== 'string' || !key) return null;
  if (key.startsWith('topic:')) return key.split(':')[1] || null;
  return key.replace(/^chat:/, '') || null;
}

export function scopedValue(value, scope, fallback) {
  if (value && typeof value === 'object') return value[scope] ?? fallback;
  return value ?? fallback;
}

/** 流式卡片超过这个时间没有任何更新，视为异常中断。 */
export const CARD_IDLE_MS = 5 * 60_000;
/** 兜底上限：即使一直在更新，超过这个时间也不再等待。 */
export const CARD_STUCK_MS = 15 * 60_000;

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
export function interactiveTextOfContent(content) {
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
  return values.join('\n').slice(0, 2_000);
}

export function textOfContentOrPost(message) {
  let parsed;
  try {
    parsed = JSON.parse(message?.content ?? '{}');
  } catch {
    return null;
  }
  if (message.message_type === 'text') return typeof parsed.text === 'string' ? parsed.text : null;
  // 卡片消息：把标题和正文按顺序拼成可读文本，机器人才能当普通消息处理。
  if (message.message_type === 'interactive') {
    const flat = interactiveTextOfContent(parsed);
    return flat || null;
  }
  if (message.message_type === 'post') {
    const rows = Array.isArray(parsed?.content) ? parsed.content : [];
    const text = rows
      .flat()
      .map((node) => (node && node.tag === 'text' ? node.text ?? '' : node?.tag === 'a' ? node.text ?? '' : ''))
      .join('')
      .trim();
    return text || parsed?.title || null;
  }
  return null;
}
