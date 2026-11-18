import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeishuBot } from '../src/feishu.js';
import { BotRuntime } from '../src/runtime.js';
import { StateStore, normalizeBot } from '../src/config.js';

function apiFixture() {
  const requests = [];
  const directory = [
    { chat_id: 'oc_group', name: '群聊旧绑定' },
    { chat_id: 'oc_topic', name: '话题群', chat_mode: 'topic' },
    { chat_id: 'oc_fresh', name: '未绑定群', chat_mode: 'group' },
  ];
  const details = new Map([
    ['oc_direct', { code: 0, data: { name: '陈志文', chat_mode: 'p2p', chat_type: 'private' } }],
    ['oc_private_group', { code: 0, data: { name: '私有群', chat_mode: 'group', chat_type: 'private' } }],
    ['oc_private_visibility', { code: 0, data: { name: '仅有可见性', chat_type: 'private' } }],
  ]);
  const client = { im: { v1: { chat: {
    async list() { requests.push('list'); return { code: 0, data: { items: directory, has_more: false } }; },
    async get({ path }) {
      requests.push(path.chat_id);
      return details.get(path.chat_id) ?? { code: 232002, msg: 'chat unavailable' };
    },
  } } } };
  return { bot: new FeishuBot({ appId: 'cli_test', appSecret: 'mock', client }), directory, details, requests, client };
}

test('chat directory preserves explicit modes and infers groups only from the default group listing', async () => {
  const f = apiFixture();
  f.directory.push({ chat_id: 'oc_explicit_dm', name: '私聊', chat_mode: 'p2p' },
    { chat_id: 'oc_future', name: '新模式', chat_mode: 'future' });
  const chats = await f.bot.getChats();
  assert.deepEqual(chats.map(({ chatId, chatType }) => [chatId, chatType]), [
    ['oc_group', 'group'], ['oc_topic', 'group'], ['oc_fresh', 'group'], ['oc_explicit_dm', 'p2p'], ['oc_future', null],
  ]);
  assert.deepEqual(f.requests, ['list'], 'no per-group lookup is needed when the directory identifies the type');
});

test('chat info uses chat_mode, keeps visibility separate, and refreshes cached names and types', async () => {
  const f = apiFixture();
  assert.deepEqual(await f.bot.getChatInfo('oc_direct'), { name: '陈志文', chatType: 'p2p' });
  assert.equal(await f.bot.getChatName('oc_direct'), '陈志文');
  assert.equal(f.requests.length, 1, 'name and type share the same request/cache');
  assert.deepEqual(await f.bot.getChatInfo('oc_private_group'), { name: '私有群', chatType: 'group' });
  assert.equal((await f.bot.getChatInfo('oc_private_visibility')).chatType, null);
  f.details.set('oc_direct', { code: 0, data: { chat: { name: ' 新名字 ', chat_mode: 'p2p' } } });
  assert.equal(await f.bot.getChatName('oc_direct'), '陈志文');
  assert.deepEqual(await f.bot.getChatInfo('oc_direct', { refresh: true }), { name: '新名字', chatType: 'p2p' });
  assert.equal(await f.bot.getChatName('oc_direct'), '新名字');
});

test('failed chat metadata expires quickly and API errors cannot manufacture a type', async (t) => {
  const f = apiFixture();
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  f.details.set('oc_error', { code: 232002, data: { name: 'not valid', chat_mode: 'group' } });
  assert.equal(await f.bot.getChatInfo('oc_error'), null);
  assert.equal(await f.bot.getChatInfo('oc_error'), null);
  assert.equal(f.requests.length, 1);
  f.details.set('oc_error', { code: 0, data: { name: '恢复', chat_mode: 'p2p' } });
  now += 30_001;
  assert.equal((await f.bot.getChatInfo('oc_error')).chatType, 'p2p');
  assert.equal(f.requests.length, 2);
});

test('concurrent metadata reads share work and a late old response cannot undo explicit refresh', async () => {
  const f = apiFixture();
  const pending = [];
  f.client.im.v1.chat.get = () => {
    const job = Promise.withResolvers(); pending.push(job); return job.promise;
  };
  const old = f.bot.getChatInfo('oc_direct');
  const shared = f.bot.getChatName('oc_direct');
  await Promise.resolve();
  assert.equal(pending.length, 1);
  const refreshed = f.bot.getChatInfo('oc_direct', { refresh: true });
  await Promise.resolve();
  pending[1].resolve({ code: 0, data: { name: 'new', chat_mode: 'p2p' } });
  await refreshed;
  pending[0].resolve({ code: 0, data: { name: 'old', chat_mode: 'p2p' } });
  await old; assert.equal(await shared, 'old');
  assert.equal(await f.bot.getChatName('oc_direct'), 'new');
});

test('management resolves historical groups and direct chats without changing bindings or fetching messages', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-chat-types-'));
  const state = await new StateStore(join(dir, 'state.json')).load();
  const f = apiFixture();
  const config = normalizeBot({ appId: 'cli_test', botName: 'Test', botOpenId: 'ou_bot' });
  const adapter = {
    getChats: (options) => f.bot.getChats(options), getChatInfo: (id, options) => f.bot.getChatInfo(id, options),
    async startLongConnection() { return 'connected'; }, async stop() {},
  };
  const runtime = new BotRuntime({ botId: 'test', ctx: { credentials: { async resolve() { return { value: 'mock' }; } } },
    configStore: { bot: () => config }, stateStore: state, harness: {}, dataDir: dir,
    logger: { info() {}, warn() {}, error() {} },
    verify: async () => ({ name: 'Test', openId: 'ou_bot' }), createBot: () => adapter,
  });
  t.after(async () => { runtime.dispose(); await rm(dir, { recursive: true, force: true }); });
  for (const id of ['oc_group', 'oc_topic', 'oc_direct', 'oc_private_group', 'oc_observed', 'oc_unknown']) {
    await state.bindSession(`chat:${id}`, `session-${id}`);
  }
  // Directory evidence beats an inconsistent old cache; observed messages are the fallback.
  await state.setChatType('chat:oc_group', 'p2p');
  await state.setChatType('chat:oc_observed', 'p2p');
  await state.setSessionMeta('session-oc_unknown', { titleName: '名字含有群也不能猜类型' });
  const before = JSON.stringify(state.value);
  await runtime.start();
  const snapshot = await runtime.managementSnapshot();
  const type = (id) => snapshot.chats.find((chat) => chat.chatId === id)?.chatType;
  for (const id of ['oc_group', 'oc_topic', 'oc_fresh', 'oc_private_group']) assert.equal(type(id), 'group', id);
  for (const id of ['oc_direct', 'oc_observed']) assert.equal(type(id), 'p2p', id);
  assert.equal(type('oc_unknown'), 'unknown');
  assert.ok(!f.requests.includes('oc_group') && !f.requests.includes('oc_topic'), 'known directory groups do not need extra requests');
  const firstCount = f.requests.length;
  await runtime.managementSnapshot();
  assert.equal(f.requests.length, firstCount, 'the regular status poll uses metadata caches');
  f.details.set('oc_direct', { code: 0, data: { name: '名字已更新', chat_mode: 'p2p' } });
  const refreshed = await runtime.managementSnapshot({ refresh: true });
  assert.equal(refreshed.chats.find((chat) => chat.chatId === 'oc_direct').title, '名字已更新');
  assert.ok(f.requests.length > firstCount);
  assert.equal(JSON.stringify(state.value), before, 'viewing the directory never writes a binding or chat configuration');
  await runtime.disconnect();
  const offline = await runtime.managementSnapshot();
  assert.equal(offline.chats.find((chat) => chat.chatId === 'oc_observed').chatType, 'p2p');
  assert.equal(offline.chats.find((chat) => chat.chatId === 'oc_unknown').chatType, 'unknown');
});
