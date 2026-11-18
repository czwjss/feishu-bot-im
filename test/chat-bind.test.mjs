import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StateStore, normalizeBot } from '../src/config.js';
import { BotRuntime } from '../src/runtime.js';
import { FeishuBridge } from '../src/bridge.js';
import { createRpcHandler } from '../src/rpc.js';
import { applyChatBound } from '../client/workspace-model.js';

const logger = { info() {}, warn() {}, error() {} };
const key = 'chat:oc_chat';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'feishu-bind-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const states = await Promise.all(['a', 'b'].map((id) => new StateStore(join(root, `${id}.json`)).load()));
  const sessions = [
    { sessionId: 'available', cwd: '/project', running: false, updatedAt: 100, projections: { values: { title: 'Existing work', modelSelection: { next: { provider: 'test', model: 'model' } } } } },
    { sessionId: 'empty', blank: true, running: false },
    { sessionId: 'running', running: true },
    { sessionId: 'child', origin: 'subagent' },
    { sessionId: 'archived' }, { sessionId: 'incompatible', formatStatus: 'migration-required' },
    { sessionId: 'owned' }, { sessionId: 'worker' }, { sessionId: 'worker-retired' },
  ];
  const archivedSessionIds = ['archived'];
  const calls = [];
  const harness = {
    async listSessions() { calls.push('list'); return sessions; },
    async workspaceBaseline() { calls.push('workspaces'); return { archivedSessionIds }; },
  };
  const runtimes = states.map((stateStore, i) => {
    const runtime = new BotRuntime({ botId: `bot-${i}`, configStore: { bot: () => ({}) }, stateStore, harness, logger });
    runtime.listChats = async () => [{ chatId: 'oc_chat' }, { chatId: 'oc_other' }];
    return runtime;
  });
  const manager = { runtimes, runtimeForBot(id) {
    const runtime = runtimes.find((item) => item.botId === id);
    if (!runtime) throw Object.assign(new Error('机器人不存在'), { code: 'not-found' });
    return runtime;
  } };
  const workerSessions = { worker: { chatId: 'oc_worker' }, 'worker-retired': { chatId: 'oc_retired' } };
  const handle = createRpcHandler({ manager, harness, userMonitor: { store: { state: { workerSessions } } } });
  const input = { botId: 'bot-0', chatId: 'oc_chat', sessionId: 'available', expectedSessionId: null };
  return { root, states, runtimes, sessions, archivedSessionIds, harness, handle, input, calls, workerSessions };
}

test('binding picker reads all workspaces, excludes unavailable session formats and marks live claims', async (t) => {
  const f = await fixture(t);
  await f.states[1].bindSession(key, 'owned');
  const before = JSON.stringify(f.states.map((state) => state.value));
  const { value } = await f.handle('chat.sessions.list', f.input);
  assert.equal(value.currentSessionId, null);
  assert.deepEqual(value.sessions.filter((item) => !item.unavailableReason).map((item) => item.sessionId), ['available', 'empty']);
  assert.match(value.sessions.find((item) => item.sessionId === 'owned').unavailableReason, /其他飞书/);
  assert.match(value.sessions.find((item) => item.sessionId === 'running').unavailableReason, /正在运行/);
  for (const id of ['worker', 'worker-retired']) assert.match(value.sessions.find((item) => item.sessionId === id).unavailableReason, /Worker/);
  for (const id of ['child', 'archived', 'incompatible']) assert.ok(!value.sessions.some((item) => item.sessionId === id));
  assert.equal(value.sessions[0].title, 'Existing work');
  assert.equal(value.sessions[0].cwd, '/project');
  assert.equal(JSON.stringify(f.states.map((state) => state.value)), before);
  assert.deepEqual(f.calls, ['list', 'workspaces']);
});

test('bind and replace persist only the association and keep existing Session settings', async (t) => {
  const f = await fixture(t);
  await f.states[0].setOverride(key, { workspace: '/next', preset: 'preset' });
  await f.states[0].setSessionMeta('available', { titleName: 'Original title' });
  const before = structuredClone(f.states[0].value);
  const result = await f.handle('chat.bind', f.input);
  assert.equal(result.value.previousSessionId, null);
  assert.equal(result.value.session.title, 'Existing work');
  assert.equal(result.value.session.model.model, 'model');
  assert.equal((await new StateStore(join(f.root, 'a.json')).load()).sessionFor(key), 'available');
  for (const field of ['overrides', 'chatTypes', 'seen']) assert.deepEqual(f.states[0].value[field], before[field]);
  assert.deepEqual(f.states[0].meta, { ...before.meta, available: { ...before.meta.available, preserveTitle: true } });
  assert.equal(f.states[1].sessionFor(key), null);
  const next = await f.handle('chat.bind', { ...f.input, sessionId: 'empty', expectedSessionId: 'available' });
  assert.equal(next.value.previousSessionId, 'available');
  assert.equal(f.states[0].sessionFor(key), 'empty');
  assert.ok(f.calls.every((call) => ['list', 'workspaces'].includes(call)), 'no prompts, messages or Session mutations');
});

test('bind validates exact identifiers, current associations, target status and ownership again at submission', async (t) => {
  const f = await fixture(t);
  for (const field of ['botId', 'chatId', 'sessionId', 'expectedSessionId']) {
    for (const value of [undefined, '', ' ', 1, ' padded ']) {
      await assert.rejects(() => f.handle('chat.bind', { ...f.input, [field]: value }), { code: 'bad-request' });
    }
  }
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, chatId: 'oc_missing' }), { code: 'not-found' });
  for (const sessionId of ['child', 'archived', 'incompatible', 'missing']) {
    await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId }), { code: 'not-found' });
  }
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId: 'running' }), { code: 'busy' });
  for (const sessionId of ['worker', 'worker-retired']) {
    await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId }), { code: 'conflict' });
  }
  await f.states[1].bindSession(key, 'owned');
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId: 'owned' }), { code: 'conflict' });
  await f.states[0].bindSession('chat:oc_other', 'empty');
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId: 'empty' }), { code: 'conflict' });
  await f.states[0].bindSession(key, 'available');
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId: 'empty' }), { code: 'conflict' });
  assert.equal(f.states[0].sessionFor(key), 'available');
  f.sessions.find((item) => item.sessionId === 'available').running = true;
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, sessionId: 'empty', expectedSessionId: 'available' }), { code: 'busy' });
});

test('two concurrent robot bindings cannot claim the same target Session', async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled([
    f.handle('chat.bind', f.input), f.handle('chat.bind', { ...f.input, botId: 'bot-1' }),
  ]);
  assert.deepEqual(results.map((item) => item.status), ['fulfilled', 'rejected']);
  assert.equal(results[1].reason.code, 'conflict');
  assert.equal(f.states[0].sessionFor(key), 'available');
  assert.equal(f.states[1].sessionFor(key), null);
});

test('a bind that raced with a fresh inbound association or failed reads never overwrites it', async (t) => {
  const f = await fixture(t);
  f.harness.listSessions = async () => { await f.states[0].bindSession(key, 'inbound-new'); return f.sessions; };
  await assert.rejects(() => f.handle('chat.bind', f.input), { code: 'conflict' });
  assert.equal(f.states[0].sessionFor(key), 'inbound-new');
  f.harness.workspaceBaseline = async () => { throw new Error('Host unavailable'); };
  await assert.rejects(() => f.handle('chat.bind', { ...f.input, expectedSessionId: 'inbound-new' }), /Host unavailable/);
  assert.equal(f.states[0].sessionFor(key), 'inbound-new');
});

test('live binding serializes with inbound messages and the next prompt uses the selected Session quietly', async (t) => {
  const f = await fixture(t);
  await f.handle('chat.bind', f.input);
  const state = await new StateStore(join(f.root, 'a.json')).load(), calls = [];
  const bridge = new FeishuBridge({ state, logger, config: normalizeBot({ appId: 'cli_test' }),
    bot: { async sendCard() { calls.push('send'); }, async sendText() { calls.push('send'); }, async getChatName() { return 'Feishu chat name'; } },
    harness: { async prompt(id) { calls.push(id); }, async createSession() { assert.fail('must reuse the existing Session'); },
      async renameSession() { calls.push('rename'); } },
  });
  t.after(() => bridge.dispose());
  await bridge.changeChatBinding('oc_chat', 'available', (validate) => state.bindSession(key, 'available', { expectedSessionId: 'available', validate }));
  assert.deepEqual(calls, []);
  await bridge.handleMessage({ sender: { sender_type: 'user' }, message: {
    message_id: 'om_trigger', chat_id: 'oc_chat', chat_type: 'p2p', message_type: 'text', content: '{"text":"hello"}',
  } });
  assert.deepEqual(calls, ['available'], 'the next prompt reuses the binding without renaming it or sending a notice');
  await assert.rejects(bridge.changeChatBinding('oc_chat', 'available', () => state.bindSession(key, 'empty')), { code: 'busy' });
  assert.equal(state.sessionFor(key), 'available');
});

test('acknowledged binding updates are scoped, idempotent and cannot overwrite newer polled bindings', () => {
  const row = { botId: 'bot-a', chatId: 'oc_chat', sessionId: null };
  const original = { bots: [{ id: 'bot-a', boundChats: 0 }, { id: 'bot-b', boundChats: 1 }],
    chats: [row, { ...row, botId: 'bot-b', sessionId: 'other' }] };
  const result = { botId: 'bot-a', chatId: 'oc_chat', sessionId: 'selected', previousSessionId: null, session: { title: 'Target' } };
  const bound = applyChatBound(original, result);
  assert.equal(bound.chats[0].sessionId, 'selected');
  assert.equal(bound.chats[1], original.chats[1]);
  assert.equal(bound.bots[0].boundChats, 1);
  assert.equal(applyChatBound(bound, result).bots[0].boundChats, 1);
  const newer = { ...bound, chats: [{ ...bound.chats[0], sessionId: 'newer' }, bound.chats[1]] };
  assert.equal(applyChatBound(newer, result), newer);
});
