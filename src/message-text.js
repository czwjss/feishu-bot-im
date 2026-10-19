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

export function textOfContentOrPost(message) {
  let parsed;
  try {
    parsed = JSON.parse(message?.content ?? '{}');
  } catch {
    return null;
  }
  if (message.message_type === 'text') return typeof parsed.text === 'string' ? parsed.text : null;
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
