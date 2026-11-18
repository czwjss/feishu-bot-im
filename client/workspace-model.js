export const chatKey = (chat) => JSON.stringify([chat.botId, chat.chatId]);

export function filterChats(chats, { query = '', botId = '', state = '', chatType = '' } = {}) {
  const keyword = query.trim().toLowerCase();
  return chats.filter((chat) => (!botId || chat.botId === botId)
    && (!chatType || chat.chatType === chatType)
    && (!state || (state === 'bound' ? Boolean(chat.sessionId)
      : state === 'unbound' ? !chat.sessionId
        : chat.conflict || chat.bindingState === 'unavailable'))
    && (!keyword || [chat.title, chat.chatId, chat.sessionId, chat.session?.title].filter(Boolean).join(' ').toLowerCase().includes(keyword)));
}

/** Connectivity, binding and execution are separate facts. */
export function chatState(chat) {
  if (chat.conflict) return 'conflict';
  if (chat.bindingState === 'unbound') return 'unbound';
  if (chat.bindingState === 'unavailable') return 'unavailable';
  if (chat.session?.running === true || chat.activity?.running === true) return 'running';
  if (chat.activity?.queuedMessages > 0) return 'queued';
  if (chat.bindingState === 'unknown') return 'unknown';
  return 'bound';
}

/** Reflect an acknowledged detach without erasing a newer binding from a poll. */
export function applyChatUnbound(snapshot, { botId, chatId, sessionId }) {
  let changed = false;
  const chats = snapshot.chats.map((chat) => {
    if (chat.botId !== botId || chat.chatId !== chatId || chat.sessionId !== sessionId) return chat;
    changed = true;
    return { ...chat, sessionId: null, session: null, bindingState: 'unbound', conflict: false, activity: null };
  });
  if (!changed) return snapshot;
  return { ...snapshot, chats, bots: snapshot.bots.map((bot) => bot.id === botId && Number.isFinite(bot.boundChats)
    ? { ...bot, boundChats: Math.max(0, bot.boundChats - 1) } : bot) };
}

/** Apply the acknowledged binding without replacing a newer polled association. */
export function applyChatBound(snapshot, { botId, chatId, sessionId, previousSessionId, session }) {
  let changed = false;
  let added = false;
  const chats = snapshot.chats.map((chat) => {
    if (chat.botId !== botId || chat.chatId !== chatId
      || ((chat.sessionId ?? null) !== previousSessionId && chat.sessionId !== sessionId)) return chat;
    changed = true;
    added = !chat.sessionId;
    return { ...chat, sessionId, session, bindingState: 'available', conflict: false, activity: null };
  });
  if (!changed) return snapshot;
  return { ...snapshot, chats, bots: snapshot.bots.map((bot) => added && bot.id === botId && Number.isFinite(bot.boundChats)
    ? { ...bot, boundChats: bot.boundChats + 1 } : bot) };
}

/** Replace only the refreshed robot; retain other robots and their warnings. */
export function mergeBotSnapshot(snapshot, update, botId) {
  const bot = update.bots.find((item) => item.id === botId);
  if (!bot || !snapshot.bots.some((item) => item.id === botId)) return snapshot;
  return {
    ...snapshot,
    bots: snapshot.bots.map((item) => item.id === botId ? bot : item),
    chats: [...snapshot.chats.filter((item) => item.botId !== botId), ...update.chats.filter((item) => item.botId === botId)],
    warnings: [
      ...snapshot.warnings.filter((item) => item.source !== botId && item.source !== 'sessions'),
      ...update.warnings.filter((item) => item.source === botId || item.source === 'sessions'),
    ],
  };
}
