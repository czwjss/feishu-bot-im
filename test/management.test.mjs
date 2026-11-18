import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { managementSnapshot } from '../src/management.js';
import { createRpcHandler } from '../src/rpc.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { AutoReplyEngine } from '../src/user-identity/auto-reply.js';
import { chatKey, chatState, filterChats, mergeBotSnapshot } from '../client/workspace-model.js';

const row = (chatId, sessionId = null) => ({ botId: 'bot-a', chatId, sessionId, title: chatId });
function fixture() {
  const rows = [row('oc_live', 's-live'), row('oc_missing', 's-missing'), row('oc_unbound'), row('oc_other', 's-live'), row('oc_worker', 's-worker')];
  const sessions = [{ sessionId: 's-live', running: true, projections: { values: { title: 'DSH title',
    modelSelection: { next: { provider: 'test', model: 'selected' }, lastUsed: { provider: 'test', model: 'previous' } }, privateData: 'never return' } } }];
  const manager = {
    async status() { return { bots: [{ id: 'bot-a' }, { id: 'bot-b' }] }; },
    runtimes: [
      { botId: 'bot-a', async managementSnapshot() { return { botId: 'bot-a', chats: rows, inbound: { messagesReceived: 8 }, directoryError: 'group directory unavailable' }; } },
      { botId: 'bot-b', async managementSnapshot() { throw new Error('bot unavailable'); } },
    ],
  };
  return { manager, harness: { async listSessions() { return sessions; } }, userMonitor: { store: { state: { workerSessions: { 's-worker': { chatId: 'oc_worker' } } } } } };
}

test('management preserves partial rows, distinguishes missing bindings, and exposes only session summary facts', async () => {
  const data = await managementSnapshot(fixture());
  assert.equal(data.chats.length, 5);
  assert.equal(data.chats[0].bindingState, 'available');
  assert.equal(data.chats[0].session.title, 'DSH title');
  assert.equal(data.chats[0].session.running, true);
  assert.equal(data.chats[0].session.model.model, 'selected', 'Host pending selection wins over its last request');
  assert.equal(data.chats[1].bindingState, 'unavailable');
  assert.equal(data.chats[2].bindingState, 'unbound');
  assert.equal(data.chats[0].conflict, true);
  assert.equal(data.chats[4].conflict, true, 'retired Worker ownership also conflicts with bot routing');
  assert.equal(data.warnings.length, 2);
  assert.equal(data.bots[0].inbound.messagesReceived, 8);
  assert.ok(!JSON.stringify(data).includes('never return'));
});

test('a failed Host listing means unknown, not missing or healthy', async () => {
  const source = fixture();
  source.harness.listSessions = async () => { throw new Error('Host unavailable'); };
  const data = await managementSnapshot(source);
  assert.equal(data.chats[1].bindingState, 'unknown');
  assert.equal(data.chats[2].bindingState, 'unbound');
  assert.equal(data.warnings[0].source, 'sessions');
});

test('management RPC is read-only and forwards explicit directory refresh', async () => {
  const source = fixture();
  let refresh;
  source.manager.runtimes[0].managementSnapshot = async (options) => { refresh = options.refresh; return { botId: 'bot-a', chats: [] }; };
  const handle = createRpcHandler(source);
  assert.equal((await handle('management.snapshot', { refresh: true })).ok, true);
  assert.equal(refresh, true);
});

test('chat filtering isolates bots sharing the same chatId and preserves binding/execution semantics', () => {
  const a = { ...row('oc_same', 's-a'), title: 'Team', bindingState: 'available', session: { title: 'Release', running: false } };
  const b = { ...row('oc_same'), botId: 'bot-b', title: 'Other', bindingState: 'unbound' };
  assert.notEqual(chatKey(a), chatKey(b));
  assert.deepEqual(filterChats([a, b], { query: 'release', botId: 'bot-a', state: 'bound' }), [a]);
  assert.deepEqual(filterChats([a, b], { state: 'unbound' }), [b]);
  assert.equal(chatState(a), 'bound', 'bound does not mean replied');
  assert.equal(chatState({ ...a, bindingState: 'unknown' }), 'unknown');
  assert.equal(chatState({ ...a, activity: { queuedMessages: 2 } }), 'queued');
});

async function monitorFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-management-'));
  const store = new MonitorStore({ configPath: join(dir, 'config.json'), statePath: join(dir, 'state.json') });
  await store.load();
  await store.saveConfig({ enabled: true, chats: [{ chatId: 'oc_alpha', name: 'A', chatMode: 'group' }, { chatId: 'oc_beta', name: 'B', chatMode: 'group' }] });
  await store.saveState({ chats: {
    oc_alpha: { sessionId: 'worker-a', messages: [
      { messageId: 'pending', text: '<script>not executable</script>', senderType: 'user' },
      { messageId: 'bot', text: 'robot', senderType: 'app' },
      { messageId: 'self', text: 'previous reply', isSelf: true },
    ], batch: { messageIds: ['pending'], firstAt: 100, lastAt: 100 }, lastDispatchAt: 50 },
    oc_beta: { messages: [{ messageId: 'other', text: 'other' }], batch: { messageIds: ['other'] } },
  }, workerSessions: {
    'worker-a': { chatId: 'oc_alpha', name: 'A', chatMode: 'group' },
    'worker-old': { chatId: 'oc_alpha', name: 'A', chatMode: 'group' },
  } });
  const flushes = [];
  const engine = { status: () => ({ dispatching: false, scheduledAt: 30100 }), flush: async ({ chatId }) => { flushes.push(chatId); return chatId; }, dispose() {} };
  const monitor = new UserMonitorManager({ store, auth: { status: async () => ({ authorization: { authorized: true } }) }, autoReply: engine });
  t.after(async () => { monitor.dispose(); await rm(dir, { recursive: true, force: true }); });
  return { store, monitor, flushes };
}

test('monitor details are local snapshots with pending, background and excluded messages, without acknowledging anything', async (t) => {
  const { store, monitor, flushes } = await monitorFixture(t);
  const before = JSON.stringify(store.state);
  const detail = monitor.chatDetail('oc_alpha');
  assert.deepEqual(detail.messages.map((message) => message.category), ['pending', 'excluded', 'background']);
  assert.equal(detail.messages[0].text, '<script>not executable</script>');
  assert.equal(detail.workers.length, 2);
  assert.equal(detail.workers.find((worker) => worker.current).sessionId, 'worker-a');
  assert.equal(detail.lastDispatchAt, 50);
  assert.equal(JSON.stringify(store.state), before);
  assert.deepEqual(flushes, []);
  const status = await monitor.status();
  assert.equal(status.chats[0].scheduledAt, 30100);
  assert.equal(status.chats[0].sessionId, 'worker-a');
  assert.equal(status.chats[0].pendingBatch, 1);
  assert.throws(() => monitor.chatDetail('oc_missing'), /不存在/);
});

test('per-chat dispatch cannot flush another chat or fall back to all chats on invalid input', async (t) => {
  const { monitor, flushes } = await monitorFixture(t);
  const handle = createRpcHandler({ manager: {}, userMonitor: monitor,
    userIdentity: { status: async () => ({ config: { app: { botId: 'bot-a' } } }) },
  });
  await handle('user.monitor.flush', { botId: 'bot-a', chatId: 'oc_beta' });
  assert.deepEqual(flushes, ['oc_beta']);
  assert.equal((await handle('user.monitor.flush', { botId: 'bot-a', chatId: '' })).ok, false);
  await assert.rejects(() => handle('user.monitor.flush', { botId: 'bot-a', chatId: 'oc_missing' }), /不存在/);
  assert.deepEqual(flushes, ['oc_beta']);
});

test('scheduled-at observations follow real timers and disappear on pause without clearing the batch', async (t) => {
  const { store } = await monitorFixture(t);
  const timers = new Map();
  const engine = new AutoReplyEngine({ store, harness: {}, now: () => 100,
    setTimeout: (fn, delay) => { const timer = {}; timers.set(timer, { fn, delay }); return timer; },
    clearTimeout: (timer) => timers.delete(timer),
  });
  engine.resume();
  assert.equal(engine.status('oc_alpha').scheduledAt, 30100);
  assert.equal(engine.status('oc_alpha').dispatching, false);
  engine.pause();
  assert.equal(engine.status('oc_alpha').scheduledAt, null);
  assert.equal(timers.size, 0);
  assert.equal(store.state.chats.oc_alpha.batch.messageIds.length, 1);
});

test('scoped avatar RPC rejects stale robot views before reading or changing the single grant', async () => {
  let owner = 'bot-a';
  const calls = [];
  const handle = createRpcHandler({
    manager: {}, harness: {},
    userIdentity: {
      async status() { return { config: { app: { botId: owner } } }; },
      async refresh() { calls.push('refresh'); return {}; },
      async disconnect() { calls.push('disconnect'); return {}; },
      async connectCancel() { calls.push('cancel'); return {}; },
      async connectBegin(input) { calls.push(input.botId); return {}; },
    },
    userMonitor: {
      async status() { calls.push('status'); return {}; },
      async setReplyRules(rules) { calls.push(rules); return {}; },
      chatDetail() { calls.push('detail'); return {}; },
      async flushPending() { calls.push('flush'); return {}; },
    },
  });
  for (const method of ['user.monitor.status', 'user.monitor.detail', 'user.monitor.flush', 'user.monitor.reply-rules.set', 'user.refresh', 'user.disconnect', 'user.connect.cancel']) {
    const result = await handle(method, { botId: 'bot-b', chatId: 'oc_alpha', rules: 'stale edit' });
    assert.equal(result.error.code, 'conflict');
  }
  assert.deepEqual(calls, [], 'mismatched views do not reach the monitor or auth operations');
  assert.equal((await handle('user.monitor.status', { botId: '' })).error.code, 'bad-request');
  assert.equal((await handle('user.monitor.reply-rules.set', { botId: 'bot-a', rules: 'owner edit' })).ok, true);
  assert.equal((await handle('user.refresh', { botId: 'bot-a' })).ok, true);
  owner = 'bot-b';
  assert.equal((await handle('user.monitor.reply-rules.set', { botId: 'bot-a', rules: 'late autosave' })).error.code, 'conflict');
  assert.equal((await handle('user.monitor.status', { botId: 'bot-b' })).ok, true);
  assert.equal((await handle('user.monitor.status', {})).error.code, 'bad-request', 'unscoped clients cannot bypass ownership');
  assert.equal((await handle('user.connect.begin', { botId: 'bot-a' })).ok, true, 'explicit authorization can select another app');
  assert.deepEqual(calls, ['owner edit', 'refresh', 'status', 'bot-a']);
});


test('scoped refresh only loads one runtime while preserving cross-robot binding checks', async () => {
  const visits = [];
  const source = fixture();
  source.manager.status = async () => { throw new Error('Scoped refresh must not list all robot statuses'); };
  source.manager.runtimes[0].status = async () => { visits.push('status:a'); return { id: 'bot-a' }; };
  source.manager.runtimes[0].managementSnapshot = async ({ refresh }) => {
    visits.push(`directory:a:${refresh}`);
    return { botId: 'bot-a', chats: [row('oc_live', 's-live')], inbound: {} };
  };
  source.manager.runtimes[1].status = async () => { throw new Error('Do not load B status'); };
  source.manager.runtimes[1].managementSnapshot = async () => { throw new Error('Do not load B directory'); };
  source.manager.runtimes[1].handlesSession = (id) => id === 's-live';
  const handle = createRpcHandler(source);
  const result = await handle('management.snapshot', { botId: 'bot-a', refresh: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.bots.map((bot) => bot.id), ['bot-a']);
  assert.deepEqual(result.value.warnings, []);
  assert.equal(result.value.chats[0].conflict, true, 'other robot ownership remains visible using its local index');
  assert.deepEqual(visits.sort(), ['directory:a:true', 'status:a']);
  for (const botId of ['', ' ', null, 42]) assert.equal((await handle('management.snapshot', { botId, refresh: true })).error.code, 'bad-request');
  await assert.rejects(handle('management.snapshot', { botId: 'missing', refresh: true }), { code: 'not-found' });
  assert.equal(visits.length, 2, 'invalid scopes cannot fall back to refreshing all robots');
});

test('scoped snapshot merges retain other robots and cannot resurrect removed ones', () => {
  const before = { updatedAt: 1, bots: [{ id: 'a', state: 'idle' }, { id: 'b', state: 'connected' }],
    chats: [{ botId: 'a', title: 'old' }, { botId: 'b', title: 'keep' }],
    warnings: [{ source: 'a', message: 'old failure' }, { source: 'b', message: 'keep failure' }, { source: 'sessions', message: 'old session failure' }] };
  const patch = { updatedAt: 2, bots: [{ id: 'a', state: 'connected' }], chats: [{ botId: 'a', title: 'new' }], warnings: [] };
  const merged = mergeBotSnapshot(before, patch, 'a');
  assert.equal(merged.bots[0].state, 'connected');
  assert.equal(merged.bots[1], before.bots[1]);
  assert.deepEqual(merged.chats.map((chat) => chat.title), ['keep', 'new']);
  assert.deepEqual(merged.warnings, [before.warnings[1]]);
  assert.equal(merged.updatedAt, 1, 'a partial refresh must not claim all data is fresh');
  assert.equal(mergeBotSnapshot({ ...before, bots: [before.bots[1]] }, patch, 'a').bots.length, 1);
});
