import assert from 'node:assert/strict';

import { installWorkerTools } from '../src/user-identity/worker-tools.js';

const listeners = [];
const cleanups = [];
const registered = [];
const ctx = {
  on(event, handler) {
    listeners.push({ event, handler });
    return () => listeners.splice(0, listeners.length);
  },
  effect(factory) {
    const cleanup = factory();
    cleanups.push(cleanup);
    return () => cleanups.forEach((fn) => fn?.());
  },
  agents: { get: (id) => (id === 'session-worker' ? agentFor(id) : undefined) },
};

function agentFor(sessionId) {
  return {
    session: { id: sessionId },
    ctx: { tools: { register: (tool) => { registered.push({ sessionId, tool: tool.name }); return () => {}; } } },
  };
}

const workerSessions = new Set();
const monitor = {
  isAutoReplySession: (id) => workerSessions.has(id),
  workerSessionIds: () => [...workerSessions],
};

const handle = installWorkerTools(ctx, monitor, { warn() {} });

// 1) 监听 agent/created，只给 Worker 挂
const created = listeners.find((item) => item.event === 'agent/created');
assert.ok(created, 'listens for agent creation');
created.handler({ agent: agentFor('session-other') });
assert.equal(registered.length, 0, 'other sessions get nothing');
workerSessions.add('session-worker');
created.handler({ agent: agentFor('session-worker') });
assert.deepEqual(registered.map((row) => row.tool), ['feishu_avatar_reply', 'feishu_avatar_skip']);

// 2) 重复创建不重复注册
created.handler({ agent: agentFor('session-worker') });
assert.equal(registered.length, 2, 'idempotent per session');

// 3) ensure 能找到已就绪的 Agent
const added = await handle.ensure('session-worker');
assert.equal(added, true);
assert.equal(registered.length, 2);

// 4) 未知会话 / 缺失 Agent 安全返回
assert.equal(await handle.ensure('session-unknown', { timeoutMs: 0 }), false);
assert.equal(await handle.ensure('', {}), false);

// 5) 需要 monitor
assert.throws(() => installWorkerTools(ctx, null), /monitor/);

// 6) 新 Worker 会话也能挂上
workerSessions.add('session-worker-2');
assert.equal(handle.attach(agentFor('session-worker-2')), true);
assert.equal(registered.filter((row) => row.sessionId === 'session-worker-2').length, 2);

console.log('user identity worker tools: 12 assertions passed');
