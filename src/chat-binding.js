import { KeyedQueue } from './queue.js';

const error = (code, message) => Object.assign(new Error(message), { code });
const validId = (id) => typeof id === 'string' && id.trim() && id === id.trim();
const summary = (item) => ({
  title: item.projections?.values?.title || item.title || item.sessionId,
  cwd: item.cwd ?? null,
  updatedAt: item.updatedAt ?? null,
  running: item.running === true,
  model: item.projections?.values?.modelSelection?.next ?? item.projections?.values?.modelSelection?.lastUsed ?? null,
});

/** Use the existing binding stores; selection never creates a Session or sends a message. */
export function createChatBindings({ manager, harness, userMonitor }) {
  const writes = new KeyedQueue();
  const runtimeFor = ({ botId, chatId }) => {
    if (!validId(botId) || !validId(chatId)) throw error('bad-request', '绑定需要明确的机器人 ID 和飞书会话 ID');
    return manager.runtimeForBot(botId);
  };
  const claimed = (sessionId, botId, chatId) => {
    if (userMonitor?.store?.state?.workerSessions?.[sessionId]) return '分身 Worker 会话不能绑定为机器人会话';
    for (const runtime of manager.runtimes) {
      if (Object.entries(runtime.sessionBindings).some(([key, id]) => id === sessionId
        && (runtime.botId !== botId || key !== `chat:${chatId}`))) return '已被其他飞书会话绑定';
    }
    return null;
  };
  const read = async (input) => {
    const runtime = runtimeFor(input);
    const [chats, sessions, baseline] = await Promise.all([
      runtime.listChats(), harness.listSessions(), harness.workspaceBaseline(),
    ]);
    if (!chats.some((chat) => chat.chatId === input.chatId)) throw error('not-found', '飞书会话已不在当前机器人目录中，请刷新后重试');
    const archived = new Set(baseline.archivedSessionIds ?? []);
    return { runtime, sessions, archived };
  };
  const eligible = (session, archived) => !archived.has(session.sessionId)
    && session.origin !== 'subagent' && session.formatStatus !== 'migration-required';
  return {
    async list(input) {
      const { runtime, sessions, archived } = await read(input);
      return {
        currentSessionId: runtime.sessionBindings[`chat:${input.chatId}`] ?? null,
        sessions: sessions.filter((session) => eligible(session, archived)).map((session) => ({
          sessionId: session.sessionId, ...summary(session),
          unavailableReason: claimed(session.sessionId, input.botId, input.chatId)
            || (session.running ? '会话正在运行，请结束后再绑定' : null),
        })).sort((a, b) => Number(Boolean(a.unavailableReason)) - Number(Boolean(b.unavailableReason))
          || (Number(new Date(b.updatedAt)) || 0) - (Number(new Date(a.updatedAt)) || 0)
          || a.sessionId.localeCompare(b.sessionId)),
      };
    },
    bind(input) {
      const runtime = runtimeFor(input);
      if (!validId(input.sessionId) || !(input.expectedSessionId === null || validId(input.expectedSessionId))) {
        throw error('bad-request', '绑定需要目标 Session ID 和当前绑定（未绑定时传 null）');
      }
      return writes.run('bindings', () => runtime.bindChat(input, {
        prepare: async () => {
          const { sessions, archived } = await read(input);
          const target = sessions.find((session) => session.sessionId === input.sessionId);
          if (!target || !eligible(target, archived)) throw error('not-found', '目标会话已不存在、归档或不可绑定，请重新选择');
          if (target.running) throw error('busy', '目标会话正在运行，请结束后再绑定');
          const previous = sessions.find((session) => session.sessionId === input.expectedSessionId);
          if (previous?.running) throw error('busy', '当前会话正在运行，请结束后再更换绑定');
          return summary(target);
        },
        validate: () => {
          if (manager.runtimeForBot(input.botId) !== runtime) throw error('conflict', '机器人连接已变化，请刷新后重试');
          const reason = claimed(input.sessionId, input.botId, input.chatId);
          if (reason) throw error('conflict', reason);
        },
      }));
    },
  };
}
