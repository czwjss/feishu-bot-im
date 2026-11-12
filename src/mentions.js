/**
 * Feishu @ mentions in model output.
 *
 * The model writes the card syntax `<at id=ou_xxx></at>`. This module validates
 * the id shape and then:
 *
 *   - card: keeps/normalizes `<at id=ou_xxx></at>`;
 *   - text: converts to `<at user_id="ou_xxx">name</at>`;
 *   - mentions off / malformed tag / @all forbidden: erases it.
 *
 * The prompt asks the model to mention the decision/confirmation owner;
 * the enforcement
 * (and the @all ban) lives here.
 */

const AT_TAG_PATTERN = /<at\b[^>]*>[\s\S]*?<\/at>|<at\b[^>]*\/>/gi;
const AT_ID_PATTERN = /(?:id|user_id)\s*=\s*["']?([A-Za-z0-9_-]+)["']?/i;
/** open_id 形状：ou_ 开头，后面是字母数字下划线/连字符。 */
const OPEN_ID_PATTERN = /^ou_[A-Za-z0-9_-]+$/;

/** `{ enabled: true, allowAll: false }` by default: @ on, @all off. */
export function normalizeMentionsConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    enabled: source.enabled !== false,
    allowAll: source.allowAll === true,
  });
}

/** Rewrite every `<at>` tag for one output mode. */
export function renderMentions(text, {
  mode = 'card', enabled = true, allowAll = false,
} = {}) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(AT_TAG_PATTERN, (tag) => {
    if (!enabled) return '';
    const id = AT_ID_PATTERN.exec(tag)?.[1] ?? '';
    if (!id) return '';
    if (id === 'all') {
      if (!allowAll) return '';
      return mode === 'text' ? '<at user_id="all">所有人</at>' : '<at id=all></at>';
    }
    if (!OPEN_ID_PATTERN.test(id)) return '';
    if (mode === 'text') return `<at user_id="${id}">${id}</at>`;
    return `<at id=${id}></at>`;
  });
}
