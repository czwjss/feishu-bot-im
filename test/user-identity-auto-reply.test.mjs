import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AutoReplyEngine, renderBatchPrompt } from '../src/user-identity/auto-reply.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';

// 引擎里的落盘是真实文件 IO，给它一点时间
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

const chatId = 'oc_auto_chat';
const now = Date.UTC(2026, 10, 11, 10, 0, 0);

function createClock(start = now) {
  let current = start;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { id, at: current + Math.max(0, Number(delay) || 0), callback });
      return { id, unref() {} };
    },
    clearTimeout(handle) {
      timers.delete(handle?.id ?? handle);
    },
    advance(ms) {
      current += ms;
      for (;;) {
        const due = [...timers.values()].filter((timer) => timer.at <= current).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) return;
        timers.delete(due.id);
        due.callback();
      }
    },
    pending: () => timers.size,
  };
}

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-auto-'));
try {
  const clock = createClock();
  const store = new MonitorStore({
    configPath: join(dir, 'monitor.json'),
    statePath: join(dir, 'monitor-state.json'),
  });
  await store.load();
  await store.saveConfig({
    enabled: true,
    chats: [{ chatId, name: '测试私聊', chatMode: 'p2p', mode: 'all', replyMode: 'auto' }],
  });

  const prompts = [];
  const sessions = [];
  const sent = [];
  const harness = {
    async createSession(input) {
      sessions.push(input);
      return 'sess-auto-1';
    },
    async prompt(sessionId, text) {
      prompts.push({ sessionId, text });
    },
  };
  const auth = { async requireAccessToken() { return 'user-token'; } };

  const engine = new AutoReplyEngine({
    store,
    harness,
    auth,
    now: clock.now,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    sendCard: async (input) => { sent.push(['card', input]); return { messageId: 'om_auto_1' }; },
    replyCard: async (input) => { sent.push(['reply', input]); return { messageId: 'om_auto_2' }; },
  });
  engine.setSelfOpenId('ou_self');

  // 1) 只在 auto 模式且批次攒齐后派发
  const chat = store.config.chats[0];
  let listCalls = 0;
  const monitor = new UserMonitorManager({
    auth: { async status() { return { authorization: { authorized: true, user: { openId: 'ou_self' } } }; }, async requireAccessToken() { return 'user-token'; } },
    store,
    autoReply: engine,
    now: clock.now,
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    chatMemberNames: async () => new Map(),
    listMessages: async () => {
      listCalls += 1;
      return {
        items: [{
          messageId: `om_${listCalls}`,
          createTime: new Date(clock.now()).toISOString(),
          senderType: 'user',
          senderOpenId: 'ou_friend',
          senderName: '朋友',
          text: listCalls === 1 ? '明天下午的评审你还去吗？' : '另外把文档链接发我一下',
        }],
        hasMore: false,
        pageToken: null,
      };
    },
  });
  await store.saveState({ chats: { [chatId]: { cursorTimeMs: clock.now() - 60_000, seen: [], messages: [] } } });

  await monitor.pollOnce();
  assert.equal(prompts.length, 0, 'debounce waits before dispatching');
  clock.advance(44_000);
  await tick();
  assert.equal(prompts.length, 0, 'still inside the debounce window');

  // 批次窗口内又来一条 → 合并成一批
  await monitor.pollOnce();
  clock.advance(45_000);
  await tick();
  assert.equal(prompts.length, 1, 'one batch prompt after the quiet window');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].agentPreset, 'standard');
  assert.match(prompts[0].text, /评审/);
  assert.match(prompts[0].text, /文档链接/);
  assert.match(prompts[0].text, /feishu_avatar_reply/);
  const token = /批次令牌：(batch-[a-z0-9-]+)/.exec(prompts[0].text)?.[1];
  assert.ok(token, 'prompt carries a batch token');

  // 2) Worker 决定回复 → 以本人身份发出，批次消息标记已读
  const result = await engine.reply({ token, text: '去，文档我一会儿发你' });
  assert.equal(result.messageIds.length, 2);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 'reply', 'reply keeps quoting the original message');
  assert.equal(sent[0][1].messageId, 'om_2');
  assert.ok(store.state.chats[chatId].messages.every((message) => message.read), 'batch marked as handled');
  assert.equal(store.state.chats[chatId].outbox.at(-1).messageId, 'om_auto_2');
  assert.equal(store.state.chats[chatId].batch.messageIds.length, 0);

  // 3) 令牌只能用一次
  await assert.rejects(() => engine.reply({ token, text: '再来一条' }), /批次已失效/);

  // 4) skip 不发送
  await store.saveState({
    chats: {
      [chatId]: {
        cursorTimeMs: clock.now() - 60_000,
        seen: [],
        messages: [{ messageId: 'om_skip_1', senderName: '朋友', senderOpenId: 'ou_friend', text: '明天十点开会', createTime: new Date(clock.now()).toISOString(), read: false }],
        batch: { messageIds: ['om_skip_1'], firstAt: clock.now(), lastAt: clock.now() },
        sessionId: 'sess-auto-1',
      },
    },
  });
  const token2 = await engine.flush({ ...chat });
  assert.ok(token2, 'flush returns a token');
  await engine.skip({ token: token2, reason: '只是通知' });
  assert.equal(sent.length, 1, 'skip does not send');

  // 4b) 只有机器人消息的批次不自动回复，避免刷屏
  await store.saveState({
    chats: {
      [chatId]: {
        cursorTimeMs: clock.now() - 60_000,
        seen: [],
        messages: [{ messageId: 'om_bot_only', senderName: '机器人', senderOpenId: 'cli_app', senderType: 'app', text: '通知', createTime: new Date(clock.now()).toISOString(), read: false }],
        batch: { messageIds: ['om_bot_only'], firstAt: clock.now(), lastAt: clock.now() },
        sessionId: 'sess-auto-1',
      },
    },
  });
  const promptsBeforeBotOnly = prompts.length;
  assert.equal(await engine.flush({ ...chat }), null, 'bot-only batch is not dispatched');
  assert.equal(prompts.length, promptsBeforeBotOnly, 'no new worker prompt for bot-only batch');

  // 5) 非 auto 会话不派发
  const otherChat = { chatId: 'oc_watch', name: '只记录', chatMode: 'p2p', mode: 'all', replyMode: 'watch' };
  assert.equal(await engine.flush(otherChat), null);

  // 6) 提示词里带上身份与批次令牌
  const prompt = renderBatchPrompt({
    chat: { chatId, name: '测试私聊', chatMode: 'p2p' },
    messages: [{ messageId: 'om_x', createTime: new Date(now).toISOString(), senderName: '朋友', text: '你好' }],
    token: 'batch-abc',
  });
  assert.match(prompt, /批次令牌：batch-abc/);
  assert.match(prompt, /不可信/);
  // 7) 显式允许时，机器人批次可以触发一次自动回复，但十分钟内只放行一次。
  await store.saveConfig({
    enabled: true,
    chats: [{ chatId, name: '测试私聊', chatMode: 'p2p', mode: 'all', replyMode: 'auto', replyToBots: true }],
  });
  const botChat = store.config.chats[0];
  await store.saveState({
    chats: {
      [chatId]: {
        cursorTimeMs: clock.now() - 60_000,
        seen: [],
        messages: [{ messageId: 'om_bot_2', senderName: '机器人', senderOpenId: 'cli_app', senderType: 'app', text: '机器人通知', createTime: new Date(clock.now()).toISOString(), read: false }],
        batch: { messageIds: ['om_bot_2'], firstAt: clock.now(), lastAt: clock.now() },
        sessionId: 'sess-auto-1',
        outbox: [],
      },
    },
  });
  const botToken = await engine.flush({ ...botChat });
  assert.ok(botToken, 'bot batch dispatches when explicitly allowed');
  await engine.reply({ token: botToken, text: '收到' });
  assert.equal(sent.length, 2, 'reply sent once for the bot batch');

  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [{ messageId: 'om_bot_3', senderName: '机器人', senderOpenId: 'cli_app', senderType: 'app', text: '机器人又说', createTime: new Date(clock.now()).toISOString(), read: false }],
        batch: { messageIds: ['om_bot_3'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  assert.equal(await engine.flush({ ...botChat }), null, 'second bot batch within 10 minutes is throttled');

} finally {
  await tick();
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

console.log('user identity auto reply: 27 assertions passed');
