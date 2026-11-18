import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StateStore, normalizeBot } from '../src/config.js';
import { BotRuntime } from '../src/runtime.js';
import { FeishuBridge } from '../src/bridge.js';
import { createRpcHandler } from '../src/rpc.js';
import { applyChatUnbound } from '../client/workspace-model.js';

const logger = { info() {}, warn() {}, error() {} };
const key = 'chat:oc_shared';
async function storeFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-unbind-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.json');
  return { path, state: await new StateStore(path).load() };
}
const event = (id) => ({ sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
  message: { message_id: id, chat_id: 'oc_shared', chat_type: 'p2p', message_type: 'text', content: '{"text":"hello"}' } });

test('offline runtime unbinds a missing session durably without deleting sessions, settings, or other robot bindings', async (t) => {
  const { state, path } = await storeFixture(t);
  const other = await storeFixture(t);
  await state.bindSession(key, 'session-missing');
  await state.bindSession('chat:oc_other', 'session-missing');
  await other.state.bindSession(key, 'session-other-bot');
  await state.setOverride(key, { workspace: '/work/project', preset: 'standard' });
  await state.setChatType(key, 'p2p');
  await state.setSessionMeta('session-missing', { titleName: 'Keep history' });
  await state.markSeen('om_seen');
  const before = state.value;
  const runtime = new BotRuntime({ botId: 'bot-a', configStore: { bot: () => ({}) }, stateStore: state,
    harness: new Proxy({}, { get() { assert.fail('unbinding must not call DSH'); } }), logger });
  const result = await runtime.unbindChat({ chatId: 'oc_shared', sessionId: 'session-missing' });
  assert.equal(result.previousSessionId, 'session-missing');
  assert.equal(result.unbound, true);
  assert.equal(state.sessionFor(key), null);
  assert.equal(state.sessionFor('chat:oc_other'), 'session-missing');
  assert.equal(runtime.handlesSession('session-missing'), true, 'other claims on the same session remain intact');
  assert.equal(other.state.sessionFor(key), 'session-other-bot');
  const persisted = await new StateStore(path).load();
  for (const field of ['overrides', 'chatTypes', 'meta', 'seen']) assert.deepEqual(persisted.value[field], before[field]);
  assert.equal(persisted.sessionFor(key), null);
  assert.equal((await runtime.unbindChat({ chatId: 'oc_shared', sessionId: 'session-missing' })).unbound, false);
});

test('atomic expected-session checks reject a queued stale detach and keep the newer binding', async (t) => {
  const { state, path } = await storeFixture(t);
  await state.bindSession(key, 'session-old');
  const replacement = state.bindSession(key, 'session-new');
  await assert.rejects(state.unbindSession(key, 'session-old'), { code: 'conflict' });
  await replacement;
  assert.equal((await new StateStore(path).load()).sessionFor(key), 'session-new');
  assert.equal(await state.unbindSession(key, 'session-new'), 'session-new');
  assert.equal(await state.unbindSession(key, 'session-new'), null);
});

test('unbind RPC requires all three explicit identifiers and never falls back to the first robot', async () => {
  const calls = [];
  const handle = createRpcHandler({ manager: { runtimes: [{ botId: 'first' }], runtimeForBot(botId) {
    assert.equal(botId, 'second');
    return { async unbindChat(binding) { calls.push(binding); return { unbound: true }; } };
  } } });
  const binding = { botId: 'second', chatId: 'oc_shared', sessionId: 'session-old' };
  for (const field of Object.keys(binding)) for (const invalid of [undefined, '', ' ', null, 42, ' extra ']) {
    assert.equal((await handle('chat.unbind', { ...binding, [field]: invalid })).error.code, 'bad-request');
  }
  assert.equal(calls.length, 0);
  assert.equal((await handle('chat.unbind', binding)).value.unbound, true);
  assert.deepEqual(calls, [{ chatId: 'oc_shared', sessionId: 'session-old' }]);
});

test('live bridge detaches quietly and the next triggering message creates a fresh session', async (t) => {
  const { state } = await storeFixture(t);
  await state.bindSession(key, 'session-old');
  const sends = [], prompts = [];
  let created = 0;
  const bridge = new FeishuBridge({ state, logger, config: normalizeBot({ appId: 'cli_test' }),
    bot: { async sendCard(...args) { sends.push(args); return 'om_card'; }, async sendText(...args) { sends.push(args); } },
    harness: { async createSession() { created++; return 'session-new'; }, async prompt(...args) { prompts.push(args); } },
  });
  t.after(() => bridge.dispose());
  assert.equal(await bridge.unbindChat('oc_shared', 'session-old'), 'session-old');
  assert.deepEqual(sends, []);
  assert.equal(created, 0);
  await bridge.handleMessage(event('om_next'));
  assert.equal(created, 1);
  assert.equal(state.sessionFor(key), 'session-new');
  assert.equal(prompts[0][0], 'session-new');
});

test('live detach waits for inbound delivery and refuses pending or queued work without discarding it', async (t) => {
  const { state } = await storeFixture(t);
  await state.bindSession(key, 'session-old');
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  const bridge = new FeishuBridge({ state, logger, config: normalizeBot({ appId: 'cli_test' }),
    bot: { async sendCard() { return 'om_card'; }, async sendText() {} },
    harness: { async prompt() { entered.resolve(); await release.promise; } },
  });
  t.after(() => { release.resolve(); bridge.dispose(); });
  const inbound = bridge.handleMessage(event('om_inflight'));
  await entered.promise;
  const detach = bridge.unbindChat('oc_shared', 'session-old');
  const rejected = assert.rejects(detach, { code: 'busy' });
  assert.equal(state.sessionFor(key), 'session-old');
  release.resolve();
  await inbound; await rejected;
  await bridge.onSessionEvent({ id: 'session-old' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.handleMessage(event('om_queued'));
  assert.equal(bridge.managementState(key).queuedMessages, 1);
  await assert.rejects(bridge.unbindChat('oc_shared', 'session-old'), { code: 'busy' });
  assert.equal(bridge.managementState(key).queuedMessages, 1);
  assert.equal(state.sessionFor(key), 'session-old');
});

test('acknowledged UI detach preserves other robots and never erases a newer polled binding', () => {
  const row = { botId: 'a', chatId: 'oc_shared', sessionId: 'old', session: {}, nextSession: { workspace: '/keep' } };
  const other = { ...row, botId: 'b' };
  const snapshot = { bots: [{ id: 'a', boundChats: 2 }, { id: 'b', boundChats: 1 }], chats: [row, other] };
  const next = applyChatUnbound(snapshot, row);
  assert.equal(next.chats[0].sessionId, null);
  assert.equal(next.chats[0].bindingState, 'unbound');
  assert.equal(next.chats[0].nextSession, row.nextSession);
  assert.equal(next.chats[1], other);
  assert.equal(next.bots[0].boundChats, 1);
  assert.equal(next.bots[1], snapshot.bots[1]);
  assert.equal(applyChatUnbound(next, row), next);
  const newer = { ...snapshot, chats: [{ ...row, sessionId: 'new' }, other] };
  assert.equal(applyChatUnbound(newer, row), newer);
});

test('a bridge replaced during reconnect cannot detach through its old queue', async (t) => {
  const { state } = await storeFixture(t);
  await state.bindSession(key, 'session-old');
  const bridge = new FeishuBridge({ state, logger, config: normalizeBot({ appId: 'cli_test' }), bot: {}, harness: {} });
  bridge.dispose();
  await assert.rejects(bridge.unbindChat('oc_shared', 'session-old'), { code: 'conflict' });
  assert.equal(state.sessionFor(key), 'session-old');
});
