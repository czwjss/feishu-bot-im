import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listChats } from '../src/user-identity/api.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import {
  MAX_MESSAGES_PER_CHAT,
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

// 2) 状态规范化：消息有条数上限，seen 截断。
const state = normalizeMonitorState({
  chats: {
    [chatId]: {
      cursorTimeMs: now,
      seen: Array.from({ length: MAX_SEEN_IDS + 10 }, (_, i) => `m${i}`),
      messages: Array.from({ length: MAX_MESSAGES_PER_CHAT + 10 }, (_, i) => ({ messageId: `msg-${i}`, text: `t${i}` })),
    },
  },
});
assert.equal(state.chats[chatId].seen.length, MAX_SEEN_IDS);
assert.equal(state.chats[chatId].messages.length, MAX_MESSAGES_PER_CHAT);
assert.equal(state.chats[chatId].messages[0].read, false);

// 3) listChats 同时请求私聊和群聊。
const calls = [];
const fetchImpl = async (url) => {
  calls.push(String(url));
  return {
    ok: true,
    async json() {
      return {
        code: 0,
        data: {
          items: [
            { chat_id: chatId, name: '测试私聊', chat_mode: 'p2p' },
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
assert.match(calls[0], /types=p2p%2Cgroup/);

// 4) 轮询只记录消息，不创建会话、不调用模型。
const dir = await mkdtemp(join(tmpdir(), 'im-feishu-monitor-'));
try {
  const store = new MonitorStore({
    configPath: join(dir, 'monitor.json'),
    statePath: join(dir, 'monitor-state.json'),
  });
  await store.load();
  await store.saveConfig({ enabled: true, chats: [{ chatId, name: '测试私聊', chatMode: 'p2p' }] });
  await store.saveState({ chats: { [chatId]: { cursorTimeMs: now - 60_000, seen: [], messages: [] } } });

  const messages = [
    { messageId: 'm-old', createTime: new Date(now - 120_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', text: 'too old' },
    { messageId: 'm-self', createTime: new Date(now - 10_000).toISOString(), senderType: 'user', senderOpenId: 'ou_self', text: 'self' },
    { messageId: 'm-deleted', createTime: new Date(now - 9_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', deleted: true, text: 'deleted' },
    { messageId: 'm-bot', createTime: new Date(now - 8_000).toISOString(), senderType: 'app', senderOpenId: 'ou_bot', text: 'bot' },
    { messageId: 'm-new', createTime: new Date(now - 5_000).toISOString(), senderType: 'user', senderOpenId: 'ou_other', text: '你好' },
  ];
  const auth = {
    async status() {
      return { authorization: { authorized: true, user: { openId: 'ou_self' } } };
    },
    async requireAccessToken() {
      return 'user-token';
    },
  };
  const nameCalls = [];
  const monitor = new UserMonitorManager({
    auth,
    store,
    now: () => now,
    listMessages: async () => ({ items: messages, hasMore: false, pageToken: null }),
    chatMemberNames: async ({ chatId: id }) => {
      nameCalls.push(id);
      return new Map([['ou_other', '同事']]);
    },
  });

  await monitor.pollOnce();
  const recorded = store.state.chats[chatId].messages;
  assert.equal(recorded.length, 2, 'user message + bot message are both recorded');
  assert.deepEqual(recorded.map((m) => m.messageId), ['m-bot', 'm-new']);
  const bot = recorded.find((m) => m.messageId === 'm-bot');
  const fromColleague = recorded.find((m) => m.messageId === 'm-new');
  assert.equal(bot.senderName, '机器人');
  assert.equal(fromColleague.senderName, '同事', 'sender name resolved from chat members');
  assert.equal(fromColleague.read, false);
  assert.deepEqual(nameCalls, [chatId]);
  assert.equal(store.state.chats[chatId].cursorTimeMs, now - 5_000);

  // 重复轮询不重复记录。
  await monitor.pollOnce();
  assert.equal(store.state.chats[chatId].messages.length, 2);

  // 5) 收件箱默认只取未读并标记已读。
  const first = await monitor.inbox({});
  assert.equal(first.total, 2);
  assert.deepEqual(first.items.map((item) => item.text), ['bot', '你好']);
  const second = await monitor.inbox({});
  assert.equal(second.total, 0);

  // 6) status 统计未读并带最近消息。
  await monitor.inbox({ unreadOnly: false, markRead: false });
  const status = await monitor.status();
  assert.equal(status.unreadTotal, 0);
  assert.equal(status.chats[0].messages.length, 2);

  // 7) 清空记录但保留游标。
  await monitor.clearMessages();
  assert.equal(store.state.chats[chatId].messages.length, 0);
  assert.equal(store.state.chats[chatId].cursorTimeMs, now - 5_000);

} finally {
  await rm(dir, { recursive: true, force: true });
}

// 9) 群聊默认只在 @我 / 回复我 时记录；关键词模式按关键词过滤。
{
  const dir2 = await mkdtemp(join(tmpdir(), 'im-feishu-trigger-'));
  try {
    const store2 = new MonitorStore({
      configPath: join(dir2, 'monitor.json'),
      statePath: join(dir2, 'monitor-state.json'),
    });
    await store2.load();
    await store2.saveConfig({ enabled: true, chats: [{ chatId: 'oc_group_x', name: '群', chatMode: 'group' }] });
    assert.equal(store2.config.chats[0].mode, 'mention', 'group defaults to mention');
    await store2.saveState({ chats: { oc_group_x: { cursorTimeMs: now - 60_000, seen: [], messages: [] } } });

    const groupMessages = [
      { messageId: 'g1', createTime: new Date(now - 40_000).toISOString(), senderType: 'user', senderOpenId: 'ou_a', text: '普通聊天' },
      { messageId: 'g2', createTime: new Date(now - 30_000).toISOString(), senderType: 'user', senderOpenId: 'ou_b', text: '@_user_1 看下', mentions: [{ openId: 'ou_self', name: '我' }] },
      { messageId: 'g3', createTime: new Date(now - 20_000).toISOString(), senderType: 'user', senderOpenId: 'ou_c', text: '回复你', parentId: 'om_self_msg' },
      { messageId: 'g4', createTime: new Date(now - 10_000).toISOString(), senderType: 'user', senderOpenId: 'ou_d', text: '发布上线了' },
    ];
    const auth2 = {
      async status() { return { authorization: { authorized: true, user: { openId: 'ou_self' } } }; },
      async requireAccessToken() { return 'user-token'; },
    };
    const monitor2 = new UserMonitorManager({
      auth: auth2,
      store: store2,
      now: () => now,
      listMessages: async () => ({ items: groupMessages, hasMore: false, pageToken: null }),
      chatMemberNames: async () => new Map(),
      getMessage: async ({ messageId }) => (messageId === 'om_self_msg' ? { senderOpenId: 'ou_self' } : { senderOpenId: 'ou_other' }),
    });
    await monitor2.pollOnce();
    const kept = store2.state.chats.oc_group_x.messages.map((message) => message.messageId);
    assert.deepEqual(kept, ['g2', 'g3'], 'only mentions and replies to me are recorded');
    assert.equal(store2.state.chats.oc_group_x.cursorTimeMs, now - 10_000, 'cursor advances past filtered messages');

    // 关键词模式。
    await monitor2.setChat('oc_group_x', { mode: 'keyword', keywords: ['上线'] });
    assert.deepEqual(store2.config.chats[0].keywords, ['上线']);
    await store2.saveState({ chats: { oc_group_x: { cursorTimeMs: now - 60_000, seen: [], messages: [] } } });
    await monitor2.pollOnce();
    const keywordKept = store2.state.chats.oc_group_x.messages.map((message) => message.messageId);
    assert.ok(keywordKept.includes('g4'), 'keyword match is recorded');
    assert.ok(!keywordKept.includes('g1'), 'unrelated message stays filtered');
    assert.ok(keywordKept.includes('g2'), 'mentions still pass in keyword mode');
  } finally {
    await rm(dir2, { recursive: true, force: true });
  }
}

console.log('user identity monitor: 29 assertions passed');
