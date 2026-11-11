import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listChats } from '../src/user-identity/api.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import {
  MAX_SEEN_IDS,
  MonitorStore,
  normalizeMonitorConfig,
  normalizeMonitorState,
} from '../src/user-identity/monitor-store.js';

const chatId = 'oc_test_chat';
const now = Date.UTC(2026, 10, 11, 8, 0, 0);

// 1) 配置规范化：去重、限制数量、轮询间隔。
const config = normalizeMonitorConfig({
  enabled: true,
  pollIntervalMs: 1,
  chats: [
    { chatId, name: '测试私聊', chatMode: 'p2p' },
    { chatId, name: '重复' },
    { chatId: 'bad', name: '无效' },
  ],
});
assert.equal(config.chats.length, 1);
assert.equal(config.pollIntervalMs, 5_000);
assert.equal(config.chats[0].chatMode, 'p2p');

// 2) 状态规范化：会话和 sessionId 保留，seen 截断。
const state = normalizeMonitorState({
  chats: {
    [chatId]: { cursorTimeMs: now, sessionId: 'sess-1', seen: Array.from({ length: MAX_SEEN_IDS + 10 }, (_, i) => `m${i}`) },
  },
});
assert.equal(state.chats[chatId].sessionId, 'sess-1');
assert.equal(state.chats[chatId].seen.length, MAX_SEEN_IDS);

// 3) listChats 查询与规范化。
const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url: String(url), init });
  return {
    ok: true,
    async json() {
      return {
        code: 0,
        data: {
          items: [
            { chat_id: chatId, name: '测试私聊', chat_mode: 'p2p', chat_type: 'p2p', external: false },
            { chat_id: 'oc_group_1', name: '测试群', chat_mode: 'group', external: true },
            { chat_id: 'not-a-chat', name: '无效' },
          ],
          has_more: false,
        },
      };
    },
  };
};
const discovered = await listChats({ accessToken: 'user-token', fetchImpl });
assert.equal(discovered.items.length, 2);
assert.equal(discovered.items[0].chatMode, 'p2p');
assert.equal(discovered.items[1].external, true);
assert.match(calls[0].url, /\/open-apis\/im\/v1\/chats/);
assert.match(calls[0].url, /user_id_type=open_id/);
assert.match(calls[0].url, /types=p2p%2Cgroup/);

// 5) 轮询：过滤自己/已删除/旧消息，投递并推进游标；重复轮询不重复投递。

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-monitor-'));
try {
  const store = new MonitorStore({
    configPath: join(dir, 'monitor.json'),
    statePath: join(dir, 'monitor-state.json'),
  });
  await store.load();
  await store.saveConfig({ enabled: true, chats: [{ chatId, name: '测试私聊', chatMode: 'p2p' }] });
  await store.saveState({
    chats: { [chatId]: { cursorTimeMs: now - 60_000, seen: [], sessionId: null } },
  });

  const prompts = [];
  const sessions = [];
  const messages = [
    { messageId: 'm-old', createTime: new Date(now - 120_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', text: 'too old' },
    { messageId: 'm-self', createTime: new Date(now - 10_000).toISOString(), senderType: 'user', senderOpenId: 'ou_self', text: 'self' },
    { messageId: 'm-deleted', createTime: new Date(now - 9_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', deleted: true, text: 'deleted' },
    { messageId: 'm-bot', createTime: new Date(now - 8_000).toISOString(), senderType: 'app', senderOpenId: 'ou_bot', text: 'bot' },
    { messageId: 'm-new', createTime: new Date(now - 5_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', senderName: '同事', text: '你好' },
  ];
  const auth = {
    async status() {
      return { authorization: { authorized: true, user: { openId: 'ou_self' } } };
    },
    async requireAccessToken() {
      return 'user-token';
    },
  };
  const harness = {
    async createSession(input) {
      sessions.push(input);
      return `sess-${sessions.length}`;
    },
    async prompt(sessionId, text) {
      prompts.push({ sessionId, text });
    },
  };
  const monitor = new UserMonitorManager({
    auth,
    harness,
    store,
    now: () => now,
    listMessages: async () => ({ items: messages, hasMore: false, pageToken: null }),
  });

  await monitor.pollOnce();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].agentPreset, 'minimal');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].sessionId, 'sess-1');
  assert.match(prompts[0].text, /你好/);
  assert.equal(store.state.chats[chatId].cursorTimeMs, now - 5_000);
  assert.deepEqual(store.state.chats[chatId].seen, ['m-new']);

  await monitor.pollOnce();
  assert.equal(prompts.length, 1, 'duplicate poll must not deliver again');
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log('user identity monitor: 19 assertions passed');
