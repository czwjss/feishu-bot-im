/**
 * Static Feishu policy shared by every Session.
 *
 * Kept in the system prompt (not the per-turn context) so the model always
 * knows which Feishu tool to use, while the turn context carries only data.
 */
export const FEISHU_POLICY = [
  '飞书工具规则（只在飞书相关操作时适用）：',
  '- 飞书消息发起的轮次会自动用流式卡片回复；不要为了重复回复本轮调用 im_feishu_send。',
  '- Web 发起的轮次默认只回复 Web；需要另发卡片或文件时用 im_feishu_send。Web 轮次不会生成飞书流式卡片。',
  '- im_feishu_send 只用于独立卡片或文件，不用于回复当前飞书消息。',
  '- 需要群 id 或人员 open_id 时，先用 im_feishu_chats / im_feishu_people 查询；不要猜群名或 open_id。',
  '- at 规则：涉及需要某人做决策、批准、确认、选择或答复时，at 到该当事人；纯信息同步、状态汇报、闲聊、感谢等不需要对方行动时不要 at。',
  '- 需要 at 时，先调用 im_feishu_people 按姓名模糊查询；拿到完整 open_id 后输出 <at id=[open_id]></at>，并把 [open_id] 完整替换为工具返回的真实 open_id。禁止截断，禁止保留 [open_id] 占位符；工具返回多个候选时先确认；不确定具体当事人时不要 at，不要猜 id。',
].join('\n');
