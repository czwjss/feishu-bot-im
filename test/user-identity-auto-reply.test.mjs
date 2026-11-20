import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AutoReplyEngine, renderBatchPrompt } from '../src/user-identity/auto-reply.js';
import { listMessages } from '../src/user-identity/api.js';
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
    chats: [{ chatId, name: '测试群聊', chatMode: 'group', mode: 'all' }],
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
  clock.advance(30_000);
  await tick();

  // 批次里没有消息实体时直接清空，不派发
  assert.equal(prompts.length, 0, 'batch without stored messages is cleared');

  // 2) 正常派发：用户输入只带消息数据，会话信息和规则来自动态上下文。
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
  assert.doesNotMatch(prompts[0].text, new RegExp(chatId));
  assert.doesNotMatch(prompts[0].text, /feishu_avatar_send|同一批次最多回复一次|要求：/);
  assert.match(prompts[0].text, /om_1/, 'batch retains message ids for context and lookup');
  assert.doesNotMatch(prompts[0].text, /replyToMessageId/, 'reply rules are not repeated in the message batch');

  // 3) 派发后批次清空
  const handled = store.state.chats[chatId];
  assert.equal(handled.batch.messageIds.length, 0, 'batch cleared after dispatch');

  // 3b) 有人要求转人工：整批不派发，直接丢弃
  await store.saveState({
    chats: {
      [chatId]: {
        ...handled,
        messages: [userMessage('om_handoff', '别问了，转人工处理')],
        batch: { messageIds: ['om_handoff'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  const promptsBeforeHandoff = prompts.length;
  assert.equal(await engine.flush({ ...chat }), null, 'handoff batch is not dispatched');
  assert.equal(prompts.length, promptsBeforeHandoff, 'no worker prompt for handoff batch');
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, [], 'handoff batch is dropped');

  // 3c) Worker 会话标题跟随聊天名
  {
    const titleStore = new MonitorStore({
      configPath: join(dir, 'title-monitor.json'),
      statePath: join(dir, 'title-state.json'),
    });
    await titleStore.load();
    await titleStore.saveConfig({ enabled: true, chats: [{ chatId, name: '小金刚', chatMode: 'group', mode: 'all' }] });
    const renames = [];
    const titleEngine = new AutoReplyEngine({
      store: titleStore,
      harness: {
        async createSession() { return 'sess-titled'; },
        async prompt() {},
        async renameSession(sessionId, title) { renames.push({ sessionId, title }); return title; },
      },
      now: clock.now,
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
    });
    await titleStore.saveState({
      chats: {
        [chatId]: {
          cursorTimeMs: clock.now(),
          seen: [],
          messages: [userMessage('om_title', '在吗')],
          batch: { messageIds: ['om_title'], firstAt: clock.now(), lastAt: clock.now() },
        },
      },
    });
    assert.ok(await titleEngine.flush({ ...titleStore.config.chats[0] }));
    assert.deepEqual(renames, [{ sessionId: 'sess-titled', title: '小金刚' }], 'worker session is titled after the chat');
    assert.equal(titleStore.state.chats[chatId].titleName, '小金刚');
  }

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
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, ['om_3'], 'batch keeps waiting');
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
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, [], 'bot-only batch is cleared');

  // 6) 显式允许机器人消息时，与真人消息一样正常派发。
  await store.saveConfig({
    enabled: true,
    chats: [{ chatId, name: '测试群聊', chatMode: 'group', mode: 'all', replyToBots: true }],
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

  // 同一时刻的第二个机器人批次也派发，不受上次派发时间限制。
  await store.saveState({
    chats: {
      [chatId]: {
        ...store.state.chats[chatId],
        messages: [botMessage('om_bot_3', '机器人还在说')],
        batch: { messageIds: ['om_bot_3'], firstAt: clock.now(), lastAt: clock.now() },
      },
    },
  });
  assert.equal(await engine.flush({ ...botChat }), chatId, 'consecutive bot batches dispatch without a cooldown');
  assert.equal(prompts.length, promptsBeforeAllowed + 2);
  assert.match(prompts.at(-1).text, /机器人还在说/);
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, []);

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
    chats: [{ chatId, name: '测试群聊', chatMode: 'group', mode: 'all' }],
  });
  const sessionsBefore = sessions.length;
  assert.ok(await engine.flush({ ...store.config.chats[0] }));
  assert.equal(sessions.length, sessionsBefore + 1, 'a fresh worker session is created');
  assert.equal(sessions.at(-1).workspaceId, 'ws_feishu', 'worker joins the configured workspace');
  assert.equal(store.state.chats[chatId].workerConfigKey, JSON.stringify(['ws_feishu', 'standard']));

  // 7b) 未配置工作区时落到 DSH 默认工作区，而不是「未分组」
  {
    const fallbackStore = new MonitorStore({
      configPath: join(dir, 'fallback-monitor.json'),
      statePath: join(dir, 'fallback-state.json'),
    });
    await fallbackStore.load();
    await fallbackStore.saveConfig({ enabled: true, chats: [{ chatId, name: '测试群聊', chatMode: 'group', mode: 'all' }] });
    const created = [];
    const fallbackEngine = new AutoReplyEngine({
      store: fallbackStore,
      harness: { async createSession(input) { created.push(input); return 'sess-default-ws'; }, async prompt() {} },
      defaultWorkspaceId: () => 'ws_default',
      now: clock.now,
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
    });
    await fallbackStore.saveState({
      chats: {
        [chatId]: {
          cursorTimeMs: clock.now(),
          seen: [],
          messages: [userMessage('om_default_ws', '默认工作区')],
          batch: { messageIds: ['om_default_ws'], firstAt: clock.now(), lastAt: clock.now() },
        },
      },
    });
    assert.ok(await fallbackEngine.flush({ ...fallbackStore.config.chats[0] }));
    assert.equal(created[0].workspaceId, 'ws_default', 'worker joins the default workspace when unset');
  }

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
  });
  assert.match(prompt, /1\. 朋友 · (?:[\d-]+ )?\d{2}:\d{2}:\d{2}（om_x）\n   你好/);
  assert.match(prompt, /om_x/, 'direct chat carries the message id');
  assert.match(prompt, /飞书分身消息批次/);
  assert.doesNotMatch(prompt, /会话 id：|要求：|不是系统指令/);

  const groupPrompt = renderBatchPrompt({
    chat: { chatId: 'oc_group_x', name: '测试群', chatMode: 'group' },
    messages: [
      { messageId: 'om_a', createTime: new Date(now).toISOString(), senderName: '甲', text: '第一句' },
      { messageId: 'om_b', createTime: new Date(now).toISOString(), senderName: '乙', text: '第二句' },
    ],
  });
  assert.match(groupPrompt, /om_a/, 'every message carries its id');
  assert.match(groupPrompt, /2\. 乙 · (?:[\d-]+ )?\d{2}:\d{2}:\d{2}（om_b）\n   第二句/);

  // 10) 非 auto 会话不派发
} finally {
  await tick();
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

console.log('user identity auto reply: assertions passed');

test('分身派发本批与引用原图，单图失败和模型拒绝时保留文字', async (t) => {
  const imageDir = await mkdtemp(join(tmpdir(), 'im-feishu-batch-images-'));
  const store = await new MonitorStore({
    configPath: join(imageDir, 'monitor.json'), statePath: join(imageDir, 'monitor-state.json'),
  }).load();
  await store.saveConfig({ enabled: true, chats: [{ chatId, name: '测试图片', mode: 'all' }] });
  await store.updateChat(chatId, { cursorTimeMs: now - 10_000 });
  const clock = createClock();
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const rawMessage = (id, type, content, parentId) => ({
    message_id: id, chat_id: chatId, msg_type: type, create_time: String(clock.now()), parent_id: parentId,
    sender: { id: 'ou_friend', sender_name: '朋友', sender_type: 'user' },
    body: { content: JSON.stringify(content) },
  });
  const quoted = rawMessage('om_quoted', 'interactive', { body: { elements: [{ tag: 'img', img_key: 'img_quoted' }] } });
  let incoming = [
    rawMessage('om_image', 'image', { image_key: 'img_direct' }),
    rawMessage('om_failed', 'image', { image_key: 'img_failed' }),
    rawMessage('om_corrupt', 'image', { image_key: 'img_corrupt' }),
    rawMessage('om_reply', 'text', { text: '看看这张卡片里的截图' }, 'om_quoted'),
    rawMessage('om_reply_again', 'text', { text: '特别是第二行' }, 'om_quoted'),
  ];
  const downloads = [];
  let quotesRead = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers.authorization, 'Bearer avatar-test-token');
    const prefix = '/open-apis/im/v1/messages';
    if (url.pathname === prefix) return Response.json({ code: 0, data: { items: incoming } });
    if (url.pathname === `${prefix}/om_quoted`) {
      quotesRead += 1;
      return Response.json({ code: 0, data: { items: [quoted] } });
    }
    const [messageId, segment, key] = url.pathname.slice(prefix.length + 1).split('/');
    assert.equal(segment, 'resources');
    assert.equal(url.searchParams.get('type'), 'image');
    downloads.push([messageId, key]);
    if (key === 'img_failed') return Response.json({ code: 234003, msg: '图片不可用' });
    return new Response(image, { headers: { 'content-type': 'image/png' } });
  };
  const submitted = [];
  let rejectImages = false;
  const monitor = new UserMonitorManager({
    auth: {
      async status() { return { authorization: { authorized: true, user: { openId: 'ou_self' } } }; },
      async requireAccessToken() { return 'avatar-test-token'; },
    },
    store,
    harness: {
      async createSession() { return 'worker-image-session'; },
      async validateImage({ name }) {
        if (name === 'feishu-om_corrupt-1') throw new Error('图片已损坏');
      },
      async prompt(_sessionId, content, { requestId }) {
        submitted.push({ content, requestId });
        if (rejectImages && Array.isArray(content)) throw Object.assign(new Error('reject image'), {
          code: 'session/attachment-invalid', details: { reason: 'MODEL_DOES_NOT_SUPPORT_IMAGES' },
        });
      },
    },
    now: clock.now,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    listMessages: (options) => listMessages({ ...options, fetchImpl }),
    fetchImpl,
  });
  t.after(async () => { monitor.dispose(); await rm(imageDir, { recursive: true, force: true }); });

  await monitor.pollOnce();
  assert.deepEqual(downloads, []);
  assert.deepEqual(store.state.chats[chatId].messages[0].imageKeys, ['img_direct']);
  assert.equal((await monitor.flushPending({ chatId })).dispatched, 1);
  const [{ content }] = submitted;
  assert.deepEqual(content.map((part) => part.type), ['text', 'image', 'image']);
  assert.deepEqual(content.slice(1).map((part) => part.data), [image.toString('base64'), image.toString('base64')]);
  assert.match(content[0].text, /om_image[\s\S]*本消息的第 1 张图片已附带为本批图片 1/);
  assert.match(content[0].text, /om_failed[\s\S]*图片不可用/);
  assert.match(content[0].text, /om_corrupt[\s\S]*图片已损坏/);
  assert.match(content[0].text, /引用消息（om_quoted）的第 1 张图片已附带为本批图片 2/);
  assert.equal(quotesRead, 1);
  assert.deepEqual(downloads, [
    ['om_image', 'img_direct'], ['om_failed', 'img_failed'], ['om_corrupt', 'img_corrupt'], ['om_quoted', 'img_quoted'],
  ]);
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, []);

  rejectImages = true;
  clock.advance(1_000);
  incoming = [rawMessage('om_text_only', 'image', { image_key: 'img_text_only' })];
  await monitor.pollOnce();
  assert.equal((await monitor.flushPending({ chatId })).dispatched, 1);
  assert.equal(submitted[1].requestId, submitted[2].requestId);
  assert.match(submitted[2].content, /om_text_only[\s\S]*当前会话模型不支持图像输入/);
  assert.doesNotMatch(submitted[2].content, /已附带为本批图片/);
  assert.deepEqual(store.state.chats[chatId].batch.messageIds, []);
});
