import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';

const activatedAt = Date.UTC(2026, 10, 18, 10);
const group = { chatId: 'oc_testgroup', name: '群聊', chatMode: 'group' };
const direct = { chatId: 'oc_testdirect', name: '私聊', chatMode: 'p2p' };
const newDirect = { chatId: 'oc_newdirect', name: '新私聊', chatMode: 'p2p' };
const page = (items = [], pageToken = null) => ({ items, pageToken, hasMore: Boolean(pageToken) });

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'im-feishu-private-monitor-'));
  const paths = { configPath: join(dir, 'monitor.json'), statePath: join(dir, 'monitor-state.json') };
  const store = await new MonitorStore(paths).load();
  const clock = { time: activatedAt };
  const identity = { openId: 'ou_owner', tokenOpenId: 'ou_owner' };
  const manager = new UserMonitorManager({
    auth: {
      async status() { return { authorization: { authorized: true, user: { openId: identity.openId } } }; },
      async requireAccessToken() { return 'user-token'; },
      async requireAccessIdentity() { return { accessToken: 'user-token', openId: identity.tokenOpenId }; },
    },
    store,
    now: () => clock.time,
    listChats: async () => page([direct]),
    listMessages: async () => page(),
    chatMemberNames: async () => new Map(),
    setTimeout: () => ({ unref() {} }),
    clearTimeout() {},
    ...overrides,
  });
  t.after(async () => { manager.dispose(); await rm(dir, { recursive: true, force: true }); });
  return { manager, store, clock, identity, paths };
}

const message = (messageId, time) => ({
  messageId, createTime: new Date(time).toISOString(), senderType: 'user',
  senderOpenId: 'ou_friend', senderName: '朋友', text: messageId, msgType: 'text',
});

test('private opt-in discovers all directory pages without adding private rows to the group configuration', async (t) => {
  const directoryCalls = [];
  const historyCalls = [];
  let phase = 'first';
  const { manager, store, clock, paths } = await fixture(t, {
    listChats: async ({ types, pageToken }) => {
      directoryCalls.push([types, pageToken]);
      if (types === 'group') return page([group, direct]);
      if (phase === 'error') throw new Error('目录请求失败');
      if (phase === 'later') return page([direct, newDirect]);
      const index = Number(pageToken ?? 0);
      return page(index === 0 ? [group] : index === 6 ? [direct] : [], index < 6 ? String(index + 1) : null);
    },
    listMessages: async ({ chatId, startTime }) => {
      historyCalls.push([chatId, startTime]);
      return chatId === direct.chatId ? page([
        message('historical', activatedAt - 1_000), message('new', activatedAt + 1_000),
      ]) : page();
    },
  });
  await store.saveConfig({ enabled: true, chats: [group, direct] });
  await store.updateChat(group.chatId, { cursorTimeMs: activatedAt - 100_000 });
  await store.bindWorkerSession(direct, 'old-private-worker');
  assert.equal((await manager.status()).directEnabled, false);
  await manager.pollOnce();
  assert.deepEqual(directoryCalls, []);
  assert.deepEqual((await manager.discoverChats()).map(({ chatId }) => chatId), [group.chatId]);
  await assert.rejects(manager.addChat(direct), /监听所有私聊/);

  await store.saveConfig({ enabled: false });
  assert.equal((await manager.setDirectEnabled(true)).directEnabled, true);
  assert.equal(directoryCalls.length, 1, 'private discovery obeys the existing master switch');
  await store.saveConfig({ enabled: true });
  clock.time += 30_000;
  await manager.pollOnce();
  assert.equal(directoryCalls.filter(([type]) => type === 'p2p').length, 7);
  assert.deepEqual(store.config.chats.map(({ chatId }) => chatId), [group.chatId]);
  assert.deepEqual((await manager.status()).chats.map(({ chatMode }) => chatMode), ['group', 'p2p']);
  assert.ok(historyCalls.some(([id, start]) => id === direct.chatId && start === activatedAt));
  assert.deepEqual(store.state.chats[direct.chatId].messages.map(({ messageId }) => messageId), ['new']);
  assert.equal(store.state.workerSessions['old-private-worker'].chatMode, 'p2p');
  await assert.rejects(manager.setChat(direct.chatId, { mode: 'all' }), /统一监听规则/);
  await assert.rejects(manager.removeChat(direct.chatId), /监听所有私聊/);

  phase = 'later';
  clock.time += 30_000;
  await manager.pollOnce();
  assert.equal(store.monitoredChat(newDirect.chatId).chatMode, 'p2p');
  assert.equal(store.state.chats[newDirect.chatId].cursorTimeMs, activatedAt);
  phase = 'error';
  clock.time += 30_000;
  await manager.pollOnce();
  assert.match((await manager.status()).directError, /目录请求失败/);
  assert.deepEqual(historyCalls.slice(-3).map(([id]) => id), [group.chatId, direct.chatId, newDirect.chatId]);

  const reloaded = await new MonitorStore(paths).load();
  assert.equal(reloaded.monitoredChat(direct.chatId), null, 'private records require identity verification after restart');
  reloaded.setDirectOwner('ou_owner');
  assert.equal(reloaded.monitoredChat(direct.chatId).chatMode, 'p2p');
});

test('turning off private monitoring invalidates a late response and prevents replay when switched back on', async (t) => {
  let release;
  let begin;
  const started = new Promise((resolve) => { begin = resolve; });
  const { manager, store, clock } = await fixture(t, {
    listMessages: async () => {
      if (!release) {
        return new Promise((resolve) => {
          release = resolve;
          begin();
        });
      }
      return page([message('offline', activatedAt + 45_000), message('fresh', activatedAt + 70_000)]);
    },
  });
  await manager.setDirectEnabled(true);
  await store.saveConfig({ enabled: true });
  clock.time += 30_000;
  const oldPoll = manager.pollOnce();
  await started;
  await store.updateChat(direct.chatId, {
    messages: [message('queued', activatedAt + 2_000)],
    batch: { messageIds: ['queued'], firstAt: clock.time, lastAt: clock.time },
  }, store.config.directActivation.id);

  const off = await manager.setDirectEnabled(false);
  assert.equal(off.directEnabled, false);
  assert.equal(off.chats.length, 0);
  assert.deepEqual(store.state.chats[direct.chatId].batch.messageIds, []);
  clock.time += 30_000;
  await manager.setDirectEnabled(true);
  release(page([message('late', activatedAt + 20_000)]));
  await oldPoll;
  assert.deepEqual(store.state.chats[direct.chatId].messages.map(({ messageId }) => messageId), ['queued']);
  clock.time += 30_000;
  await manager.pollOnce();
  assert.deepEqual(store.state.chats[direct.chatId].messages.map(({ messageId }) => messageId), ['queued', 'fresh']);
});

test('private discovery and worker dispatch remain bound to the user who opted in', async (t) => {
  const prompts = [];
  const queried = [];
  const { manager, store, clock, identity } = await fixture(t, {
    harness: {
      async createSession() { return 'private-worker'; },
      async prompt(...args) { prompts.push(args); },
    },
    listChats: async ({ types }) => { queried.push(types); return page([direct]); },
    listMessages: async () => page([message('hello', activatedAt + 2_000)]),
  });
  await manager.setDirectEnabled(true);
  await store.saveConfig({ enabled: true });
  clock.time += 30_000;
  identity.tokenOpenId = 'ou_other';
  await manager.pollOnce();
  assert.deepEqual(queried, [], 'the authorized status and access token must belong to the same opted-in account');
  identity.tokenOpenId = 'ou_owner';
  await manager.pollOnce();
  assert.deepEqual(store.state.chats[direct.chatId].batch.messageIds, ['hello']);
  identity.openId = 'ou_other';
  identity.tokenOpenId = 'ou_other';
  await manager.autoReply.flush({ chatId: direct.chatId });
  assert.deepEqual(prompts, [], 'pending private work cannot dispatch as the new account');
  assert.equal((await manager.status()).directEnabled, false);
  await manager.pollOnce();
  assert.deepEqual(queried, ['p2p']);
});
