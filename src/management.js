/** A read-only view over existing owners. No second store or message dispatcher. */
export async function managementSnapshot({ manager, harness, userMonitor, refresh = false, botId = null }) {
  const allRuntimes = [...manager.runtimes];
  const runtimes = botId === null ? allRuntimes : allRuntimes.filter((runtime) => runtime.botId === botId);
  if (botId !== null && runtimes.length === 0) {
    throw Object.assign(new Error(`机器人不存在：${botId}`), { code: 'not-found' });
  }
  const [status, sessionResult, runtimeResults] = await Promise.all([
    botId === null ? manager.status() : Promise.all(runtimes.map((runtime) => runtime.status())).then((bots) => ({ bots })),
    harness.listSessions().then((items) => ({ items, error: null }), (error) => ({ items: [], error: error.message })),
    Promise.allSettled(runtimes.map((runtime) => runtime.managementSnapshot({ refresh }))),
  ]);
  const sessions = new Map(sessionResult.items.map((item) => [item.sessionId, item]));
  const warnings = sessionResult.error ? [{ source: 'sessions', message: sessionResult.error }] : [];
  const chats = [];
  const observations = new Map();
  runtimeResults.forEach((result, index) => {
    const runtimeId = runtimes[index]?.botId;
    if (result.status === 'rejected') {
      warnings.push({ source: runtimeId, message: result.reason?.message ?? String(result.reason) });
      return;
    }
    const value = result.value;
    observations.set(value.botId, value.inbound);
    if (value.directoryError) warnings.push({ source: value.botId, message: value.directoryError });
    chats.push(...value.chats);
  });
  const claims = new Map();
  const claim = (sessionId, owner) => {
    if (!sessionId) return;
    claims.set(sessionId, [...(claims.get(sessionId) ?? []), owner]);
  };
  for (const chat of chats) claim(chat.sessionId, `${chat.botId}:${chat.chatId}`);
  // A scoped refresh still checks other robots' local bindings, without loading
  // their directories or status. The existing reverse index owns this relation.
  if (botId !== null) {
    for (const sessionId of claims.keys()) {
      for (const runtime of allRuntimes) {
        if (runtime.botId !== botId && runtime.handlesSession(sessionId)) claim(sessionId, `bot:${runtime.botId}`);
      }
    }
  }
  // Retired Workers still carry task contexts, so include their durable ownership.
  for (const [sessionId, binding] of Object.entries(userMonitor?.store?.state?.workerSessions ?? {})) {
    claim(sessionId, `avatar:${binding.chatId}`);
  }
  return {
    updatedAt: Date.now(),
    warnings,
    bots: status.bots.map((bot) => ({ ...bot, inbound: observations.get(bot.id) ?? null })),
    chats: chats.map((chat) => {
      const session = sessions.get(chat.sessionId);
      return {
        ...chat,
        bindingState: !chat.sessionId ? 'unbound' : sessionResult.error ? 'unknown' : session ? 'available' : 'unavailable',
        conflict: (claims.get(chat.sessionId)?.length ?? 0) > 1,
        // 这里读的是 `session/list` RPC 摘要（其 cwd 来自 session.header.cwd），
        // 不是 Session 实例——后者没有 cwd 属性。工具侧解析目录见 resolveSessionCwd。
        session: session ? {
          title: session.projections?.values?.title || chat.sessionId,
          running: typeof session.running === 'boolean' ? session.running : null,
          updatedAt: session.updatedAt ?? null,
          cwd: session.cwd ?? null,
          model: session.projections?.values?.modelSelection?.next ?? session.projections?.values?.modelSelection?.lastUsed ?? null,
        } : null,
      };
    }),
  };
}
