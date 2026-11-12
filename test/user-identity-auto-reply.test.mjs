import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AutoReplyEngine, renderBatchPrompt } from '../src/user-identity/auto-reply.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';

// 引擎落盘是真实文件 IO，给它一点时间
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
        const due = [...timers.values()]
          .filter((timer) => timer.at <= current)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) return;
        timers.delete(due.id);
        due.callback();
      }
    },
  };
}

function userMessage(id, text) {
  return {
    messageId: id,
    senderName: '朋友',
    senderOpenId: 'ou_friend',
    senderType: 'user',
    text,
    createTime: new Date(now).toISOString(),
    read: false,
  };
}

function botMessage(id, text) {
  return {
    messageId: id,
    senderName: '机器人',
    senderOpenId: 'cli_app',
    senderType: 'app',
    text,
    createTime: new Date(now).toISOString(),
    read: false,
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
  let failPrompt = false;
  const harness = {
    async createSession(input) {
      sessions.push(input);
      return `sess-auto-${sessions.length}`;
    },
    async prompt(sessionId, text) {
      if (failPrompt) throw new Error('prompt failed');
      prompts.push({ sessionId, text });
    },
  };

  const engine = new AutoReplyEngine({
    store,
    harness,
    now: clock.now,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  });

  const chat = store.config.chats[0];

  // 1) 只在 auto 模式且攒够防抖窗口后派发
  const monitor = new UserMonitorManager({
    auth: { async status() { return { authorization: { authorized: true, user: { openId: 'ou_self' } } }; } },
    store,
    autoReply: engine,
    now: clock.now,
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    chatMemberNames: async () => new Map(),
    listMessages: async () => ({ items: [], hasMore: false, pageToken: null }),
  });

  await engine.enqueue(chat, ['om_1', 'om_2']);
  assert.equal(prompts.length, 0, 'debounce waits before dispatching');
  clock.advance(45_000);
  await tick();

  // 批次里没有消息实体时直接清空，不派发
  assert.equal(prompts.length, 0, 'batch without stored messages is cleared');

  // 2) 正常派发：带 chatId、提示用 feishu_avatar_send
  await store.saveState({
    chats: {
      [chatId]: {
        cursorTimeMs: clock.now() - 60_000,
        seen: [],
        messages: [userMessage('om_1', '明天评审几点？'), userMessage('om_2', '另外文档发我')],
        batch: { messageIds: ['om_1', 'om_2'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  const token = await engine.flush({ ...chat });
  assert.equal(token, chatId, 'flush returns the dispatched chat');
  assert.equal(prompts.length, 1, 'one batch prompt');
  assert.match(prompts[0].text, /明天评审几点/);
  assert.match(prompts[0].text, /文档发我/);
  assert.match(prompts[0].text, new RegExp(chatId));
  assert.match(prompts[0].text, /feishu_avatar_send/);
  assert.match(prompts[0].text, /同一批次最多回复一次/);
  assert.match(prompts[0].text, /om_1/, 'prompt lists message ids');
  assert.match(prompts[0].text, /replyToMessageId/, 'prompt explains reply threading');

  // 3) 派发即视为已处理：消息已读、批次清空
  const handled = store.state.chats[chatId];
  assert.ok(handled.messages.every((message) => message.read), 'dispatch marks messages read');
  assert.ok(handled.messages.every((message) => message.outcome === 'dispatched'), 'outcome recorded');
  assert.equal(handled.batch.messageIds.length, 0, 'batch cleared after dispatch');

  // 4) 派发失败保留批次，等重试
  failPrompt = true;
  await store.saveState({
    chats: {
      [chatId]: {
        ...handled,
        messages: [userMessage('om_3', '还在吗')],
        batch: { messageIds: ['om_3'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  assert.equal(await engine.flush({ ...chat }), null, 'failed dispatch returns null');
  assert.equal(store.state.chats[chatId].batch.messageIds.length, 1, 'batch kept for retry');
  assert.equal(store.state.chats[chatId].messages[0].read, false, 'message stays unread');
  failPrompt = false;

  // 5) 只有机器人消息：默认跳过但标记已处理
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [botMessage('om_bot', '机器人通知')],
        batch: { messageIds: ['om_bot'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  const promptsBeforeBot = prompts.length;
  assert.equal(await engine.flush({ ...chat }), null, 'bot-only batch is not dispatched');
  assert.equal(prompts.length, promptsBeforeBot, 'no worker prompt for bot-only batch');
  assert.equal(store.state.chats[chatId].messages[0].read, true, 'bot-only batch is marked handled');

  // 6) 显式允许机器人消息时派发，但十分钟内只放行一次
  await store.saveConfig({
    enabled: true,
    chats: [{ chatId, name: '测试私聊', chatMode: 'p2p', mode: 'all', replyMode: 'auto', replyToBots: true }],
  });
  const botChat = store.config.chats[0];
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [botMessage('om_bot_2', '机器人又说')],
        batch: { messageIds: ['om_bot_2'], firstAt: clock.now(), lastAt: clock.now() },
        lastDispatchAt: 0,
      },
    },
  });
  const promptsBeforeAllowed = prompts.length;
  assert.ok(await engine.flush({ ...botChat }), 'bot batch dispatches when allowed');
  assert.equal(prompts.length, promptsBeforeAllowed + 1);
  assert.ok(store.state.chats[chatId].lastDispatchAt > 0, 'dispatch time recorded');

  // 十分钟内第二个机器人批次不再派发。
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [botMessage('om_bot_3', '机器人还在说')],
        batch: { messageIds: ['om_bot_3'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  assert.equal(await engine.flush({ ...botChat }), null, 'bot batches are throttled within 10 minutes');

  // 6b) 流式卡片：仍在「正在处理」时不派发，收尾后才用完整文本派发。
  let cardText = '⏳ 正在处理…';
  let cardStreaming = true;
  const cardEngine = new AutoReplyEngine({
    store,
    harness,
    now: clock.now,
    refreshMessage: async () => ({ text: cardText, msgType: 'interactive', streaming: cardStreaming }),
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  });
  const cardChat = { ...store.config.chats[0], replyMode: 'auto' };
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        lastDispatchAt: 0,
        messages: [{
          messageId: 'om_card', senderName: '朋友', senderOpenId: 'ou_friend', senderType: 'user',
          msgType: 'interactive', text: '⏳ 正在处理…', createTime: new Date(clock.now()).toISOString(), read: false,
        }],
        batch: { messageIds: ['om_card'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  const promptsBeforeCard = prompts.length;
  assert.equal(await cardEngine.flush({ ...cardChat }), null, 'streaming card is not dispatched early');
  assert.equal(prompts.length, promptsBeforeCard, 'no prompt while the card streams');
  assert.equal(store.state.chats[chatId].batch.messageIds.length, 1, 'batch kept for the next round');

  cardText = '评审改到下午三点';
  cardStreaming = false;
  assert.ok(await cardEngine.flush({ ...cardChat }), 'settled card dispatches');
  assert.match(prompts.at(-1).text, /评审改到下午三点/, 'prompt uses the settled text');

  // 7) 工作区/预设变化会重建 Worker 会话
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        lastDispatchAt: 0,
        messages: [userMessage('om_ws', '换分组后')],
        batch: { messageIds: ['om_ws'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  await store.saveConfig({
    enabled: true,
    worker: { workspaceId: 'ws_feishu', preset: 'standard' },
    chats: [{ chatId, name: '测试私聊', chatMode: 'p2p', mode: 'all', replyMode: 'auto' }],
  });
  const sessionsBefore = sessions.length;
  assert.ok(await engine.flush({ ...store.config.chats[0] }));
  assert.equal(sessions.length, sessionsBefore + 1, 'a fresh worker session is created');
  assert.equal(sessions.at(-1).workspaceId, 'ws_feishu', 'worker joins the configured workspace');
  assert.equal(store.state.chats[chatId].workerConfigKey, JSON.stringify(['ws_feishu', 'standard']));

  // 8) 归档的 Worker 会被换掉
  const archived = new Set([store.state.chats[chatId].sessionId]);
  const guarded = new AutoReplyEngine({
    store,
    harness,
    now: clock.now,
    sessionGuard: { isArchived: (id) => archived.has(id), exists: () => true },
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  });
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [userMessage('om_arch', '归档后还能回吗')],
        batch: { messageIds: ['om_arch'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  const sessionsBeforeArchive = sessions.length;
  assert.ok(await guarded.flush({ ...store.config.chats[0] }), 'archived worker does not block dispatch');
  assert.equal(sessions.length, sessionsBeforeArchive + 1, 'replacement worker session created');
  assert.ok(!archived.has(store.state.chats[chatId].sessionId), 'pointer moved to the new worker');

  // 9) 提示词内容
  const prompt = renderBatchPrompt({
    chat: { chatId, name: '测试私聊', chatMode: 'p2p' },
    messages: [{ messageId: 'om_x', createTime: new Date(now).toISOString(), senderName: '朋友', text: '你好' }],
    batchId: 'batch-abc',
  });
  assert.match(prompt, /批次：batch-abc/);
  assert.match(prompt, /不可信/);

  // 10) 非 auto 会话不派发
  assert.equal(await engine.flush({ ...chat, replyMode: 'watch' }), null);
} finally {
  await tick();
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

console.log('user identity auto reply: 37 assertions passed');
