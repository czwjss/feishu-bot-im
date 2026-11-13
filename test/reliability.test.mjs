import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as Lark from '@larksuiteoapi/node-sdk';

import { ConfigStore, StateStore, normalizeBot } from '../src/config.js';
import { RuntimeManager } from '../src/runtime.js';
import { FeishuBridge } from '../src/bridge.js';
import { AutoReplyEngine } from '../src/user-identity/auto-reply.js';
import { MonitorStore, MAX_PENDING_MESSAGES } from '../src/user-identity/monitor-store.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';

const logger = { info() {}, warn() {}, error() {} };
const chatId = 'oc_reliability';
const now = Date.UTC(2026, 10, 13, 10);
const taskMessages = (text) => text.split('新消息（按时间顺序）：\n')[1];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'feishu-reliability-'));
  const cleanups = [];
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await rm(root, { recursive: true, force: true });
  });
  return { root, cleanups };
}

function message(number) {
  return {
    messageId: `om_${number}`, senderType: 'user', senderName: '同事', senderOpenId: 'ou_user',
    text: `payload-${String(number).padStart(3, '0')}`, createTime: new Date(now + number).toISOString(),
  };
}

async function monitorFixture(t, overrides = {}) {
  const { root, cleanups } = await workspace(t);
  const configPath = join(root, 'monitor.json');
  const statePath = join(root, 'state.json');
  const store = await new MonitorStore({ configPath, statePath }).load();
  await store.saveConfig({ enabled: true, chats: [{ chatId, chatMode: 'p2p', name: '私聊' }] });
  const prompts = [];
  const harness = {
    createSession: async () => 'session-worker',
    prompt: async (...args) => { prompts.push(args); },
    ...overrides,
  };
  const timers = new Map();
  let timerId = 0;
  const options = {
    store, harness, logger, now: () => now,
    setTimeout(callback, delay) {
      const handle = { id: ++timerId, unref() {} };
      timers.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) { timers.delete(handle); },
  };
  const engine = new AutoReplyEngine(options);
  cleanups.push(() => engine.dispose());
  const monitor = new UserMonitorManager({
    store, autoReply: engine, auth: { status: async () => ({}) },
    defaultWorkspaceId: async () => 'ws-default',
  });
  return { store, engine, monitor, prompts, timers, chat: store.config.chats[0], options, configPath, statePath, cleanups };
}

async function bridgeFixture(t) {
  const { root, cleanups } = await workspace(t);
  const path = join(root, 'state.json');
  const state = await new StateStore(path).load();
  const prompts = [];
  const compacted = [];
  let created = 0;
  const harness = {
    createSession: async () => `session-${++created}`,
    prompt: async (...args) => { prompts.push(args); },
    compact: async (id) => { compacted.push(id); return { kind: 'success' }; },
  };
  const bot = { sendCard: async () => 'om_card', sendText: async () => 'om_text' };
  const config = normalizeBot({ appId: 'cli_test', botOpenId: 'ou_bot', access: { managers: ['ou_admin'] } });
  const make = (store = state) => {
    const bridge = new FeishuBridge({ bot, harness, state: store, config, logger });
    cleanups.push(() => bridge.dispose());
    return bridge;
  };
  const event = (id, patch = {}) => ({
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: { message_id: id, chat_id: chatId, chat_type: 'p2p', message_type: 'text', content: '{"text":"hello"}', ...patch },
  });
  const action = (operator, name = 'compact') => ({
    operator: { open_id: operator }, action: { value: { action: name } },
    context: { open_chat_id: chatId, open_message_id: 'om_old_menu' },
  });
  return { path, state, harness, bot, prompts, compacted, make, event, action, created: () => created };
}

test('default runtime wiring verifies credentials without an injected verify function', async (t) => {
  const { root, cleanups } = await workspace(t);
  const requests = [];
  t.mock.method(Lark.defaultHttpInstance, 'request', async (request) => {
    requests.push(request.url);
    return request.url.includes('tenant_access_token')
      ? { code: 0, tenant_access_token: 'mock-token' }
      : { code: 0, bot: { app_name: 'test bot', open_id: 'ou_bot' } };
  });
  const secrets = new Map();
  const manager = new RuntimeManager({
    ctx: { credentials: {
      set: async (key, value) => secrets.set(key, value),
      resolve: async (key) => ({ value: secrets.get(key) }),
      describe: async (key) => ({ configured: secrets.has(key) }),
    } },
    configStore: await new ConfigStore(join(root, 'config.json')).load(),
    dataDir: root, harness: {}, logger,
    openState: async (id) => new StateStore(join(root, id + '.json')).load(),
    createBot: () => ({
      startLongConnection: async () => 'connected', stop: async () => {},
      sendText: async () => assert.fail('credential checks cannot send text'),
      sendCard: async () => assert.fail('credential checks cannot send cards'),
      listSlashCommands: async () => ['menu', 'new', 'stop'].map((command) => ({ command })),
    }),
  });
  cleanups.push(() => manager.dispose());
  assert.equal((await manager.addBot({ appId: 'cli_local', appSecret: 'dummy' })).state, 'connected');
  assert.equal(requests.length, 4, 'manager and bot both use the real verifier with mocked HTTP');
  const checked = await manager.runtimes[0].checkConnection();
  assert.equal(checked.credentialsValid, true);
  assert.equal(checked.connected, true);
  assert.equal(requests.length, 6);
  assert.deepEqual(requests.slice(-2), [
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    'https://open.feishu.cn/open-apis/bot/v3/info/',
  ], 'connection checks only use authentication and identity APIs');
  manager.setPresetSource(() => [{ id: 'standard', name: 'Standard' }]);
  assert.equal((await manager.runtimes[0].listPresets())[0].id, 'standard', 'synchronous preset sources are supported');
});

test('concurrent configuration changes merge and a rejected write does not block later writes', async (t) => {
  const { root } = await workspace(t);
  const path = join(root, 'config.json');
  const store = await new ConfigStore(path).load();
  const [first, second] = await Promise.all([store.add({ appId: 'cli_first' }), store.add({ appId: 'cli_second' })]);
  assert.equal(store.bots.length, 2);
  await Promise.all([store.update(first.id, { alias: 'Changed' }), store.update(first.id, { workspace: '/tmp/work' })]);
  assert.equal(store.bot(first.id).alias, 'Changed');
  assert.equal(store.bot(first.id).workspace, '/tmp/work');
  const [duplicate, update] = await Promise.allSettled([
    store.add({ appId: second.appId }), store.update(second.id, { alias: 'Second' }),
  ]);
  assert.equal(duplicate.status, 'rejected');
  assert.equal(update.status, 'fulfilled');
  assert.deepEqual((await new ConfigStore(path).load()).bots, store.bots);
});

test('state reset is ordered after earlier writes', async (t) => {
  const { root } = await workspace(t);
  const path = join(root, 'state.json');
  const store = await new StateStore(path).load();
  await Promise.all([store.bindSession('chat:oc_test', 'session-old'), store.reset()]);
  assert.equal((await new StateStore(path).load()).sessionFor('chat:oc_test'), null);
});

test('a group menu remains restricted after restart; unknown chats fail closed', async (t) => {
  const f = await bridgeFixture(t);
  await f.state.bindSession(`chat:${chatId}`, 'session-existing');
  const bridge = f.make();
  assert.equal((await bridge.onCardAction(f.action('ou_admin'))).toast.type, 'warning');
  await f.state.setChatType(`chat:${chatId}`, 'group');
  const restarted = f.make(await new StateStore(f.path).load());
  assert.equal((await restarted.onCardAction(f.action('ou_user'))).toast.type, 'warning');
  assert.equal((await restarted.onCardAction(f.action('ou_user', 'model_pick'))).toast.type, 'warning');
  assert.equal(f.compacted.length, 0);
  assert.equal((await restarted.onCardAction(f.action('ou_admin'))).toast.type, 'success');
  assert.deepEqual(f.compacted, ['session-existing']);
  await f.state.setChatType(`chat:${chatId}`, 'p2p');
  assert.equal((await f.make(await new StateStore(f.path).load()).onCardAction(f.action('ou_user'))).toast.type, 'success');
});

test('simultaneous first messages share one session and keep their order', async (t) => {
  const f = await bridgeFixture(t);
  const entered = deferred();
  const release = deferred();
  const original = f.harness.createSession;
  f.harness.createSession = async () => { entered.resolve(); await release.promise; return original(); };
  const bridge = f.make();
  const first = bridge.handleMessage(f.event('om_first', { content: '{"text":"first"}' }));
  await entered.promise;
  const second = bridge.handleMessage(f.event('om_second', { content: '{"text":"second"}' }));
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(f.created(), 1);
  assert.deepEqual(f.prompts.map(([id]) => id), ['session-1', 'session-1']);
  assert.deepEqual(f.prompts.map(([, parts]) => parts[0].text), ['first', 'second']);
});

test('a slow chat does not block messages in another chat', async (t) => {
  const f = await bridgeFixture(t);
  const entered = deferred();
  const release = deferred();
  const original = f.harness.prompt;
  f.harness.prompt = async (...args) => {
    if (args[2].chatId === chatId) { entered.resolve(); await release.promise; }
    return original(...args);
  };
  const bridge = f.make();
  const first = bridge.handleMessage(f.event('om_slow'));
  await entered.promise;
  await bridge.handleMessage(f.event('om_fast', { chat_id: 'oc_other' }));
  assert.equal(f.prompts.length, 1);
  release.resolve();
  await first;
  assert.equal(f.prompts.length, 2);
});

test('only replies to this application or bot count as addressed', async (t) => {
  const f = await bridgeFixture(t);
  let senderId = 'cli_other';
  f.bot.getMessage = async (id) => ({ messageId: id, senderType: 'app', senderId, msgType: 'text', bodyContent: '{"text":"previous"}' });
  const bridge = f.make();
  const group = { chat_type: 'group', parent_id: 'om_other', mentions: [] };
  await bridge.handleMessage(f.event('om_reply_other', group));
  assert.equal(f.prompts.length, 0);
  senderId = 'cli_test';
  await bridge.handleMessage(f.event('om_reply_app', { ...group, parent_id: 'om_app' }));
  senderId = 'ou_bot';
  await bridge.handleMessage(f.event('om_reply_bot', { ...group, parent_id: 'om_bot' }));
  assert.equal(f.prompts.length, 2);
});

test('more than ten pending messages are dispatched in FIFO batches without dropping bodies', async (t) => {
  const f = await monitorFixture(t);
  const messages = Array.from({ length: 61 }, (_, i) => message(i + 1));
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages });
  assert.equal(f.store.state.chats[chatId].messages.length, 61, 'pending bodies outlive the 50-message history window');
  assert.equal(f.store.state.chats[chatId].batch.messageIds.length, 61);
  assert.equal([...f.timers.values()][0].delay, 0, 'a full batch is ready immediately');
  for (let i = 0; i < 7; i++) await f.engine.flush(f.chat);
  assert.equal(f.prompts.length, 7);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, []);
  const delivered = f.prompts.flatMap(([, text]) => taskMessages(text).match(/payload-\d+/g));
  assert.deepEqual(delivered, messages.map((item) => item.text));
  assert.equal(f.store.state.chats[chatId].messages.length, 50, 'handled history returns to its bounded size');
});

test('enabled bots and people share FIFO batches, including consecutive dispatches at the same time', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { replyToBots: true });
  const messages = Array.from({ length: 23 }, (_, i) => ({
    ...message(i + 1), senderType: i % 2 ? 'user' : 'app',
  }));
  // enqueue receives an older chat object; the persisted setting is authoritative.
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages });
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, messages.map((item) => item.messageId));
  for (let i = 0; i < 3; i++) assert.equal(await f.engine.flush(f.chat), chatId);
  assert.deepEqual(f.prompts.map(([, text]) => taskMessages(text).match(/payload-\d+/g).length), [10, 10, 3]);
  assert.deepEqual(f.prompts.flatMap(([, text]) => taskMessages(text).match(/payload-\d+/g)), messages.map((item) => item.text));
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, []);
});

test('disabled bots stay out of batches and do not reset a human batch timer or trigger handoff', async (t) => {
  const f = await monitorFixture(t);
  const bots = Array.from({ length: 12 }, (_, i) => ({
    ...message(i + 1), senderType: 'app', text: '转人工',
  }));
  await f.engine.enqueue(f.chat, bots.map((item) => item.messageId), { messages: bots });
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, []);
  assert.equal(f.timers.size, 0, 'excluded bots do not schedule a worker task');
  assert.equal(await f.engine.flush(f.chat), null);
  assert.equal(f.store.state.chats[chatId].sessionId, null, 'excluded bots do not create a worker');
  const human = message(13);
  await f.engine.enqueue(f.chat, [human.messageId], { messages: [...bots, human] });
  const [[timer, task]] = [...f.timers];
  assert.equal(task.delay, 30_000, 'excluded bots do not fill the ten-message batch');
  const nextBot = { ...message(14), senderType: 'app', text: '转人工' };
  await f.engine.enqueue(f.chat, [nextBot.messageId], { messages: [...bots, human, nextBot] });
  assert.deepEqual([...f.timers.keys()], [timer], 'excluded bot arrivals do not restart the wait');
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, [human.messageId]);
  assert.equal(f.store.state.chats[chatId].messages.length, 14, 'listening records remain available');
  assert.equal(await f.engine.flush(f.chat), chatId);
  assert.match(f.prompts[0][1], /payload-013/);
  assert.doesNotMatch(f.prompts[0][1], /转人工/);
});

test('disabling bot handling filters an existing backlog before handoff and the ten-message limit', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { replyToBots: true });
  const bots = Array.from({ length: 11 }, (_, i) => ({
    ...message(i + 1), senderType: 'app', text: '转人工',
  }));
  const people = Array.from({ length: 12 }, (_, i) => message(i + 12));
  const messages = [...bots, ...people];
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages });
  await f.monitor.setChat(chatId, { replyToBots: false });
  assert.equal(await f.engine.flush(f.chat), chatId);
  assert.deepEqual(taskMessages(f.prompts[0][1]).match(/payload-\d+/g), people.slice(0, 10).map((item) => item.text));
  assert.doesNotMatch(f.prompts[0][1], /转人工/);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, people.slice(10).map((item) => item.messageId));
  assert.equal(await f.engine.flush(f.chat), chatId);
  assert.deepEqual(f.prompts.flatMap(([, text]) => taskMessages(text).match(/payload-\d+/g)), people.map((item) => item.text));
});

test('enabled bots obey the same handoff rule as people', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { replyToBots: true });
  const messages = [message(1), { ...message(2), senderType: 'app', text: '转人工' }];
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages });
  assert.equal(await f.engine.flush(f.chat), null);
  assert.equal(f.prompts.length, 0);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, []);
});

test('full text, untriggered context and a later self reply reach the worker without triggering extra tasks', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { mode: 'mention' });
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  const longText = '详细说明'.repeat(1500) + '尾部条件：不要重复回答';
  const items = [
    { ...message(1), text: '背景：会议改到下午', msgType: 'text' },
    { ...message(2), text: longText, mentions: [{ openId: 'ou_self' }], msgType: 'text' },
    { ...message(3), text: '我已在手机上答复', senderOpenId: 'ou_self', msgType: 'text' },
  ];
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({ authorization: { user: { openId: 'ou_self' } } }) },
    listMessages: async () => ({ items, hasMore: false }), chatMemberNames: async () => new Map(),
  });
  await monitor.pollOnce();
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_2']);
  const reloaded = await new MonitorStore({ configPath: f.configPath, statePath: f.statePath }).load();
  assert.equal(reloaded.state.chats[chatId].messages[1].text, longText, 'disk storage preserves the entire body');
  assert.equal(reloaded.state.chats[chatId].messages[2].isSelf, true);
  assert.equal(await f.engine.flush(f.chat), chatId);
  const prompt = f.prompts[0][1];
  assert.ok(taskMessages(prompt).includes(longText), 'worker receives the tail beyond 500 and 2000 characters');
  const context = prompt.split('新消息（按时间顺序）：')[0];
  assert.match(context, /背景：会议改到下午/);
  assert.match(context, /本人.*om_3[\s\S]*我已在手机上答复/);
  assert.doesNotMatch(taskMessages(prompt), /我已在手机上答复|背景：会议/);
  await monitor.pollOnce();
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, [], 'context and repeated reads do not start another reply');
});

test('message wording never deletes an earlier record or pending body', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { replyToBots: true });
  await f.store.updateChat(chatId, { cursorTimeMs: now - 600_000 });
  let items = [
    { ...message(1), senderType: 'app', senderOpenId: 'cli_app', text: '已收到订单，正在处理', createTime: new Date(now - 300_000).toISOString() },
    { ...message(2), senderType: 'app', senderOpenId: 'cli_app', text: '订单已完成', createTime: new Date(now - 290_000).toISOString() },
  ];
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({}) },
    listMessages: async () => ({ items, hasMore: false }), chatMemberNames: async () => new Map(),
  });
  await monitor.pollOnce();
  items = [];
  await monitor.pollOnce();
  assert.deepEqual(f.store.state.chats[chatId].messages.map((item) => item.text), ['已收到订单，正在处理', '订单已完成']);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1', 'om_2']);
  await f.engine.flush(f.chat);
  assert.match(taskMessages(f.prompts[0][1]), /已收到订单，正在处理/);
  assert.match(taskMessages(f.prompts[0][1]), /订单已完成/);
});

test('own streaming cards settle as context without creating a reply batch', async (t) => {
  const f = await monitorFixture(t);
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  const card = { ...message(1), senderOpenId: 'ou_self', msgType: 'interactive', streaming: true, text: '我的回复' };
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({ authorization: { user: { openId: 'ou_self' } } }) },
    listMessages: async () => ({ items: [card], hasMore: false }), chatMemberNames: async () => new Map(),
    getMessage: async () => ({ ...card, streaming: false, text: '本人最终答复' }),
  });
  await monitor.pollOnce();
  assert.equal(f.store.state.pendingCards[0].isSelf, true);
  await monitor.pollOnce();
  assert.equal(f.store.state.pendingCards.length, 0);
  assert.equal(f.store.state.chats[chatId].messages[0].contextOnly, true);
  assert.equal(f.store.state.chats[chatId].messages[0].text, '本人最终答复');
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, []);
  assert.equal(f.timers.size, 0);
  assert.equal(await f.engine.flush(f.chat), null);
});

test('monitor polling uses the thirty-second default', async (t) => {
  const f = await monitorFixture(t);
  await f.store.saveConfig({ enabled: false });
  let interval;
  const monitor = new UserMonitorManager({
    store: f.store, auth: {},
    setInterval: (_callback, delay) => { interval = delay; return { unref() {} }; },
    clearInterval() {},
  });
  monitor.start();
  assert.equal(interval, 30_000);
  monitor.dispose();
});

test('replacement workers receive the chat title even when the previous worker was already named', async (t) => {
  let sequence = 0;
  const renames = [];
  const f = await monitorFixture(t, {
    createSession: async () => `worker-${++sequence}`,
    renameSession: async (id, name) => { renames.push([id, name]); return name; },
  });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  await f.engine.flush(f.chat);
  await f.monitor.setWorker({ preset: 'new-preset' });
  await f.engine.enqueue(f.chat, ['om_2'], { messages: [message(2)] });
  await f.engine.flush(f.chat);
  assert.deepEqual(renames, [['worker-1', '私聊'], ['worker-2', '私聊']]);
});

test('streaming cards apply keyword triggers to their completed body', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { mode: 'keyword', keywords: ['评审'], replyToBots: true });
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  const card = { ...message(1), senderType: 'app', msgType: 'interactive', streaming: true, text: '生成中' };
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({}) },
    listMessages: async () => ({ items: [card], hasMore: false }), chatMemberNames: async () => new Map(),
    getMessage: async () => ({ ...card, streaming: false, text: '评审改到下午' }),
  });
  await monitor.pollOnce();
  assert.equal(f.store.state.pendingCards.length, 1);
  assert.equal(f.store.state.chats[chatId].batch.messageIds.length, 0);
  await monitor.pollOnce();
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
  await f.engine.flush(f.chat);
  assert.match(taskMessages(f.prompts[0][1]), /评审改到下午/);
});

test('a transient parent lookup failure preserves the cursor and retries reply-to-me detection', async (t) => {
  const f = await monitorFixture(t);
  await f.monitor.setChat(chatId, { mode: 'mention' });
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  let calls = 0;
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({ authorization: { user: { openId: 'ou_self' } } }) },
    listMessages: async () => ({ items: [{ ...message(1), parentId: 'om_parent' }], hasMore: false }),
    chatMemberNames: async () => new Map(),
    getMessage: async () => {
      if (++calls === 1) throw new Error('temporary network failure');
      return { senderOpenId: 'ou_self' };
    },
  });
  await monitor.pollOnce();
  assert.equal(f.store.state.chats[chatId].cursorTimeMs, now - 1000);
  assert.match(f.store.state.chats[chatId].lastError, /temporary network failure/);
  await monitor.pollOnce();
  assert.equal(calls, 2);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
});

test('a concurrent arrival survives acknowledgement and concurrent flushes dispatch only once', async (t) => {
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const f = await monitorFixture(t, { prompt: async (...args) => { calls.push(args); entered.resolve(); await release.promise; } });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const first = f.engine.flush(f.chat);
  await entered.promise;
  const duplicate = f.engine.flush(f.chat);
  await f.engine.enqueue(f.chat, ['om_2'], { messages: [message(1), message(2)] });
  release.resolve();
  await Promise.all([first, duplicate]);
  assert.equal(calls.length, 1);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_2']);
  await f.engine.flush(f.chat);
  assert.equal(calls.length, 2);
  assert.match(calls[1][1], /payload-002/);
});

test('failed dispatch retains its messages and retry uses the same request identity', async (t) => {
  const requests = [];
  let failing = true;
  const f = await monitorFixture(t, { prompt: async (_id, _text, options) => {
    requests.push(options.requestId);
    if (failing) throw new Error('temporary failure');
  } });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  assert.equal(await f.engine.flush(f.chat), null);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
  assert.equal([...f.timers.values()][0].delay, 30_000, 'failure uses a bounded retry delay');
  failing = false;
  assert.equal(await f.engine.flush(f.chat), chatId);
  assert.equal(requests[0], requests[1]);
});

test('disabling monitoring cancels pending timers and blocks stale callbacks', async (t) => {
  const f = await monitorFixture(t);
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const stale = [...f.timers.values()][0].callback;
  await f.monitor.setEnabled(false);
  assert.equal(f.timers.size, 0);
  stale();
  assert.equal(await f.engine.flush(f.chat), null);
  assert.equal(f.prompts.length, 0);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
});

test('disabling monitoring while a worker is being created prevents its prompt', async (t) => {
  const entered = deferred();
  const release = deferred();
  const f = await monitorFixture(t, { createSession: async () => { entered.resolve(); await release.promise; return 'session-worker'; } });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const task = f.engine.flush(f.chat);
  await entered.promise;
  await f.monitor.setEnabled(false);
  release.resolve();
  await task;
  assert.equal(f.prompts.length, 0);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
});

test('removing a chat cancels its queued work without recreating its state', async (t) => {
  const entered = deferred();
  const release = deferred();
  const f = await monitorFixture(t, { createSession: async () => { entered.resolve(); await release.promise; return 'session-worker'; } });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const task = f.engine.flush(f.chat);
  await entered.promise;
  await f.monitor.removeChat(chatId);
  release.resolve();
  await task;
  assert.equal(f.prompts.length, 0);
  assert.equal(f.store.state.chats[chatId], undefined);
  assert.equal(f.timers.size, 0);
});

test('pending work survives reload and resumes without needing another incoming message', async (t) => {
  const f = await monitorFixture(t);
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  f.engine.dispose();
  const store = await new MonitorStore({ configPath: f.configPath, statePath: f.statePath }).load();
  const restarted = new AutoReplyEngine({ ...f.options, store });
  f.cleanups.push(() => restarted.dispose());
  restarted.resume();
  assert.equal(f.timers.size, 1);
  await restarted.flush(f.chat);
  assert.equal(f.prompts.length, 1);
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, []);
});

test('monitor state writes preserve independent updates and worker settings preserve omitted fields', async (t) => {
  const f = await monitorFixture(t);
  await Promise.all([
    f.monitor.setWorker({ preset: 'custom' }),
    f.monitor.setWorker({ workspaceId: 'ws-custom' }),
    f.store.updateChat(chatId, { lastPollAt: now }),
    f.store.updateChat(chatId, { lastDispatchAt: now + 1 }),
  ]);
  assert.equal(f.store.config.worker.preset, 'custom');
  assert.equal(f.store.config.worker.workspaceId, 'ws-custom');
  assert.equal(await f.monitor.resolveDefaultWorkspaceId(), 'ws-default');
  const reloaded = await new MonitorStore({ configPath: f.configPath, statePath: f.statePath }).load();
  assert.equal(reloaded.state.chats[chatId].lastPollAt, now);
  assert.equal(reloaded.state.chats[chatId].lastDispatchAt, now + 1);
});

test('queue capacity rejects new work without losing the persisted backlog', async (t) => {
  const f = await monitorFixture(t);
  const messages = Array.from({ length: MAX_PENDING_MESSAGES }, (_, i) => message(i));
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages });
  const before = await readFile(f.statePath, 'utf8');
  await assert.rejects(f.engine.enqueue(f.chat, ['om_overflow']), /待处理消息已满/);
  assert.equal(f.store.state.chats[chatId].batch.messageIds.length, MAX_PENDING_MESSAGES);
  assert.equal(await readFile(f.statePath, 'utf8'), before);
});

test('polling commits message bodies and queue IDs before exposing them to dispatch', async (t) => {
  const f = await monitorFixture(t);
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  const items = Array.from({ length: 11 }, (_, i) => ({ ...message(i + 1), msgType: 'text' }));
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({}) },
    listMessages: async () => ({ items, hasMore: false }), chatMemberNames: async () => new Map(),
  });
  await monitor.pollOnce();
  const entry = f.store.state.chats[chatId];
  assert.deepEqual(entry.batch.messageIds, items.map((item) => item.messageId));
  assert.deepEqual(entry.messages.map((item) => item.messageId), entry.batch.messageIds);
  await f.engine.flush(f.chat);
  await f.engine.flush(f.chat);
  assert.equal(f.prompts.length, 2);
});

test('busy chats resume pagination across polls, including messages sharing a timestamp', async (t) => {
  const f = await monitorFixture(t);
  await f.store.updateChat(chatId, { cursorTimeMs: now - 1000 });
  const items = Array.from({ length: 110 }, (_, i) => ({ ...message(i), createTime: new Date(now).toISOString() }));
  const calls = [];
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now + 100,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({}) },
    chatMemberNames: async () => new Map(),
    listMessages: async (options) => {
      calls.push(options);
      const offset = Number(options.pageToken || 0);
      const next = offset + options.pageSize;
      return { items: items.slice(offset, next), hasMore: next < items.length, pageToken: String(next) };
    },
  });
  await monitor.pollOnce();
  assert.equal(calls.length, 2, 'one poll makes a bounded number of requests');
  assert.equal(f.store.state.chats[chatId].batch.messageIds.length, 100);
  assert.equal(f.store.state.chats[chatId].scan.pageToken, '100');
  await monitor.pollOnce();
  assert.equal(calls[2].pageToken, '100');
  assert.equal(calls[2].startTime, calls[0].startTime);
  assert.equal(calls[2].endTime, calls[0].endTime);
  assert.equal(f.store.state.chats[chatId].scan, null);
  assert.equal(f.store.state.chats[chatId].batch.messageIds.length, 110);
  assert.equal(f.store.state.chats[chatId].messages.length, 110);
});

test('full queues leave the polling cursor unchanged for a later retry', async (t) => {
  const f = await monitorFixture(t);
  const messages = Array.from({ length: MAX_PENDING_MESSAGES }, (_, i) => message(i));
  await f.engine.enqueue(f.chat, messages.map((item) => item.messageId), { messages, cursorTimeMs: now - 1000 });
  const monitor = new UserMonitorManager({
    store: f.store, autoReply: f.engine, now: () => now,
    auth: { requireAccessToken: async () => 'mock', status: async () => ({}) },
    chatMemberNames: async () => new Map(),
    listMessages: async () => ({ items: [message(501)], hasMore: false }),
  });
  await monitor.pollOnce();
  assert.equal(f.store.state.chats[chatId].cursorTimeMs, now - 1000);
  assert.match(f.store.state.chats[chatId].lastError, /待处理消息已满/);
  await f.engine.flush(f.chat);
  await monitor.pollOnce();
  assert.ok(f.store.state.chats[chatId].batch.messageIds.includes('om_501'));
  assert.equal(f.store.state.chats[chatId].lastError, null);
});

test('empty polls do not postpone a pending debounce timer', async (t) => {
  const f = await monitorFixture(t);
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const timer = [...f.timers.keys()][0];
  await f.engine.enqueue(f.chat, [], { lastPollAt: now });
  assert.equal([...f.timers.keys()][0], timer);
});

test('disabling monitoring aborts an in-flight dispatch and preserves its retryable batch', async (t) => {
  const entered = deferred();
  let signal;
  const f = await monitorFixture(t, { prompt: async (_id, _text, options) => {
    signal = options.signal;
    entered.resolve();
    await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  await f.engine.enqueue(f.chat, ['om_1'], { messages: [message(1)] });
  const task = f.engine.flush(f.chat);
  await entered.promise;
  await f.monitor.setEnabled(false);
  await task;
  assert.equal(signal.aborted, true);
  assert.deepEqual(f.store.state.chats[chatId].batch.messageIds, ['om_1']);
  assert.equal(f.timers.size, 0);
});
