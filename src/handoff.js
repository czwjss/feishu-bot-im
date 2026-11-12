/**
 * 转人工判定。
 *
 * 命中的消息不再交给模型：机器人直接不回复，分身直接丢弃当前批次，
 * 等人来处理。规则优先，宁可误停也不让 AI 硬答。
 */

/** 命中即视为「要求真人处理」。英文按小写匹配。 */
export const HANDOFF_KEYWORDS = Object.freeze([
  '转人工',
  '人工客服',
  '找真人',
  '我要投诉',
]);

/**
 * 文本里是否要求人工。
 * @param {unknown} text
 * @returns {string|null} 命中的关键词，未命中返回 null
 */
export function handoffRequestedIn(text) {
  const value = typeof text === 'string' ? text.trim().toLowerCase() : '';
  if (!value) return null;
  for (const keyword of HANDOFF_KEYWORDS) {
    if (value.includes(keyword.toLowerCase())) return keyword;
  }
  return null;
}
