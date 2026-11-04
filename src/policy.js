/**
 * Static Feishu policy shared by every Session.
 *
 * Kept in the system prompt (not the per-turn context) so the model always
 * knows which Feishu tool to use, while the turn context carries only data.
 */
export const FEISHU_POLICY = [
  '飞书工具规则（只在飞书相关操作时适用）：',
  '- 飞书消息发起的轮次会自动用流式卡片回复文本；不要为了重复回复本轮再调用 im_feishu_deliver 或 im_feishu_reply。需要发送文件/图片时调用 im_feishu_return_file。',
  '- Web 发起的轮次默认只回复 Web。只有用户明确要求把本轮回答发到飞书时，才在写最终答案前调用 im_feishu_reply；绑定后继续正常输出答案。',
  '- im_feishu_deliver 只用于另发一条独立文本；不要用它回答当前飞书消息。',
  '- 需要群 id 或人员 open_id 时，先用 im_feishu_chats / im_feishu_people 查询；不要猜群名或 open_id。',
  '- 用户只说“发飞书”但没说明是“本轮回答”还是“独立消息”时，先问清楚。',
  '- at 规则：涉及需要某人做决策、批准、确认、选择或答复时，at 到该当事人；纯信息同步、状态汇报、闲聊、感谢等不需要对方行动时不要 at。',
  '- 需要 at 时，先调用 im_feishu_people 按姓名模糊查询；拿到完整 open_id 后输出 <at id=[open_id]></at>，并把 [open_id] 完整替换为工具返回的真实 open_id。禁止截断，禁止保留 [open_id] 占位符；工具返回多个候选时先确认；不确定具体当事人时不要 at，不要猜 id。',
].join('\n');
