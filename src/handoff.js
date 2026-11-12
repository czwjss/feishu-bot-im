/**
 * 转人工判定。
 *
 * 命中的消息不再交给模型：机器人直接不回复，分身直接丢弃当前批次，
 * 等人来处理。规则优先，宁可误停也不让 AI 硬答。
 */

/** 命中即视为「要求真人处理」。英文按小写匹配。 */
export const DEFAULT_HANDOFF_KEYWORDS = Object.freeze([
  '转人工',
  '人工客服',
  '找真人',
  '我要投诉',
]);

/** 兼容旧名：默认关键词。 */
export const HANDOFF_KEYWORDS = DEFAULT_HANDOFF_KEYWORDS;

/**
 * 文本里是否要求人工。
 * @param {unknown} text
 * @param {readonly string[]} [keywords] 自定义关键词，省略时用默认值
 * @returns {string|null} 命中的关键词，未命中返回 null
 */
export function handoffRequestedIn(text, keywords = DEFAULT_HANDOFF_KEYWORDS) {
  const value = typeof text === 'string' ? text.trim().toLowerCase() : '';
  if (!value) return null;
  const list = Array.isArray(keywords) ? keywords : DEFAULT_HANDOFF_KEYWORDS;
  for (const keyword of list) {
    if (typeof keyword !== 'string' || !keyword.trim()) continue;
    if (value.includes(keyword.trim().toLowerCase())) return keyword;
  }
  return null;
}
