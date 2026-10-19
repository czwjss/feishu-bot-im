/**
 * Feishu @ mentions in model output.
 *
 * The model writes the card syntax `<at id=ou_xxx></at>`. This module validates
 * the id against the people seen in the current chat/topic and then:
 *
 *   - card: keeps/normalizes `<at id=ou_xxx></at>`;
 *   - text: converts to `<at user_id="ou_xxx">name</at>`;
 *   - mentions off / unknown id / malformed tag / @all forbidden: erases it.
 *
 * The prompt only asks the model to use mentions on demand; the enforcement
 * (and the @all ban) lives here.
 */

const AT_TAG_PATTERN = /<at\b[^>]*>[\s\S]*?<\/at>|<at\b[^>]*\/>/gi;
const AT_ID_PATTERN = /(?:id|user_id)\s*=\s*["']?([A-Za-z0-9_-]+)["']?/i;

/** `{ enabled: true, allowAll: false }` by default: @ on, @all off. */
export function normalizeMentionsConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    enabled: source.enabled !== false,
    allowAll: source.allowAll === true,
  });
}

function cleanName(value, fallback) {
  const name = String(value ?? '').replace(/[<>&\r\n]/g, '').trim();
  return name || fallback;
}

/**
 * Rewrite every `<at>` tag for one output mode. `directory` maps a known
 * open_id to its display name; ids not in it are treated as invalid.
 */
export function renderMentions(text, {
  mode = 'card', enabled = true, allowAll = false, directory = new Map(),
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
    if (!directory.has(id)) return '';
    if (mode === 'text') {
      return `<at user_id="${id}">${cleanName(directory.get(id), id)}</at>`;
    }
    return `<at id=${id}></at>`;
  });
}
