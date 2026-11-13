/** 自动批次的默认约定；可在设置页整体替换。普通会话不注入这些规则。 */
export const DEFAULT_REPLY_RULES = [
  '你以用户本人身份处理当前飞书会话中的新消息。',
  '1. 结合本批新消息和背景记录判断是否需要回复；背景可能包含本人稍后的答复，无需回复时不发送。',
  '2. 需要回复时调用 feishu_avatar_send，chatId 使用会话信息中的 chatId，不发往其他会话。',
  '3. 回复简短自然，像本人说话；同一批次最多回复一次。',
  '4. 私聊不引用；群聊里本批只有一位发送者时，传 replyToMessageId 引用最后一条需要回复的消息；多位发送者时不引用，正文点名。',
].join('\n');

export function normalizeReplyRules(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_REPLY_RULES;
}

function workerChat(store, sessionId) {
  if (!sessionId) return null;
  const binding = store.state.workerSessions?.[sessionId];
  if (!binding) return null;
  return store.config.chats.find((chat) => chat.chatId === binding.chatId) ?? binding;
}

/** 两块动态上下文只依赖持久化会话绑定，不读取会在派发后清空的批次队列。 */
export function installWorkerContexts(ctx, store) {
  ctx.inject(['systemPrompt'], (promptCtx) => {
    const chatFor = (assembly) => workerChat(store, assembly?.agent?.session?.id);
    promptCtx.systemPrompt.context({
      name: 'im-feishu:avatar-chat',
      order: 140,
      required: true,
      interpolate: false,
      text: (assembly) => {
        const chat = chatFor(assembly);
        return chat ? [
          '<feishu_avatar_reply_task_chat>',
          `会话名称：${JSON.stringify(chat.name || chat.chatId)}`,
          `chatId：${chat.chatId}`,
          `会话类型：${chat.chatMode === 'p2p' ? '私聊' : '群聊'}`,
          '</feishu_avatar_reply_task_chat>',
        ].join('\n') : '';
      },
    });
    promptCtx.systemPrompt.context({
      name: 'im-feishu:avatar-reply-rules',
      order: 150,
      required: true,
      interpolate: false,
      text: (assembly) => chatFor(assembly)
        ? `<feishu_avatar_reply_task_rules>\n${normalizeReplyRules(store.config.replyRules)}\n</feishu_avatar_reply_task_rules>` : '',
    });
  });
}
