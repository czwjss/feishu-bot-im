/**
 * 假飞书端到端测试：用记录型 fake SDK client 跑完整链路，
 * 断言发出去的卡片/文件结构合法（schema 2.0 白名单字段）。
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigStore, StateStore } from '../src/config.js';
import { FeishuBot } from '../src/feishu.js';
import { FeishuBridge } from '../src/bridge.js';

let seq = 0;
function recordingClient({ resourceBytes = null } = {}) {
  const calls = [];
  const ok = (data) => ({ code: 0, msg: 'ok', data });
  const client = {
    calls,
    im: {
      v1: {
        message: {
          create: async ({ params, data }) => {
            calls.push({ api: 'message.create', params, data });
            return ok({ message_id: `om_out_${++seq}` });
          },
          patch: async ({ path, data }) => {
            calls.push({ api: 'message.patch', path, data });
            return ok({ message_id: path.message_id });
          },
          reply: async ({ path, data }) => {
            calls.push({ api: 'message.reply', path, data });
            return ok({ message_id: `om_reply_${++seq}` });
          },
        },
        messageResource: {
          get: async ({ path, params }) => {
            calls.push({ api: 'messageResource.get', path, params });
            return {
              writeFile: async (target) => {
                const { writeFile } = await import('node:fs/promises');
                await writeFile(target, resourceBytes ?? Buffer.from('binary'));
              },
            };
          },
        },
        image: { create: async ({ data }) => { calls.push({ api: 'image.create', bytes: data.image?.length }); return ok({ image_key: 'img_key' }); } },
        file: { create: async ({ data }) => { calls.push({ api: 'file.create', name: data.file_name, bytes: data.file?.length }); return ok({ file_key: 'file_key' }); } },
      },
    },
  };
  return client;
}

function assertCard(card, label) {
  assert.ok(card && typeof card === 'object', `${label}: card must be an object`);
  assert.equal(card.schema, '2.0', `${label}: schema must be 2.0`);
  assert.ok(Array.isArray(card.body?.elements), `${label}: body.elements required`);
  // 白名单：schema 2.0 不接受 1.0 的 config.update_multi 之类字段
  const allowedTop = new Set(['schema', 'header', 'body']);
  for (const key of Object.keys(card)) {
    assert.ok(allowedTop.has(key), `${label}: unexpected top-level card field "${key}"`);
  }
  for (const element of card.body.elements) {
    assert.ok(typeof element.tag === 'string', `${label}: element.tag required`);
  }
}

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-e2e-'));
const configStore = await new ConfigStore(join(dir, 'config.json')).load();
const state = new StateStore(join(dir, 'state.json'));
await state.load();

const harness = {
  created: 0,
  prompts: [],
  async createSession(opts) { this.created += 1; this.lastCreate = opts; return `sess-${this.created}`; },
  async resolveWorkspaceId() { return 'ws-1'; },
  async ensureWorkspace() { return null; },
  async prompt(id, content) { this.prompts.push({ id, content }); },
  async cancel() {},
  async listSessions() { return [{ sessionId: 'sess-1', updatedAt: Date.now(), running: false }]; },
  async modelCatalog() { return { groups: [{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M' }] }] }; },
  async selectModel() {},
  async workspaceBaseline() { return { items: [{ path: '/tmp/ws', title: 'WS' }] }; },
};

const config = {
  appId: 'cli_test', botOpenId: 'ou_bot', workspace: '/tmp/ws', model: null,
  busyMode: 'queue',
  contextEnhancement: { group: { enabled: false, fields: [], guidance: '' }, direct: { enabled: false, fields: [], guidance: '' } },
  access: { direct: 'all', group: 'all', allowOpenIds: [] },
};

function inbound(text, extra = {}) {
  return {
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: {
      message_id: `om_in_${++seq}`, chat_id: 'oc_e2e', chat_type: 'p2p', message_type: 'text',
      content: JSON.stringify({ text }), mentions: [], create_time: '1760700000000',
      ...extra,
    },
  };
}

// 1) 文本消息 → 建会话（带 workspaceId）→ 卡片流 → 终稿 patch
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox'), eventsPath: join(dir, 'events.log') });
  await bridge.handleMessage(inbound('你好'));
  assert.deepEqual(harness.prompts.at(-1).content, [{ type: 'text', text: '你好' }], 'user content stays clean');
  assert.equal(harness.lastCreate.workspaceId, 'ws-1', 'session must carry workspaceId');

  // request/context 可能先于 turn/start 到达：窗口按 session 缓存
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'request/context', data: { provider: 'p', model: 'm', contextWindow: 100000 } });
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'turn/start', data: { turn: 1 } });
  const create = client.calls.find((c) => c.api === 'message.create');
  assert.ok(create, 'turn start creates the answer card message');
  assert.equal(create.data.msg_type, 'interactive');
  assertCard(JSON.parse(create.data.content), 'first card');
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: JSON.stringify({ command: 'ls -la' }) } });
  // 卡片更新有 1.5s 节流，等一下才能观察到过程行
  await new Promise((resolve) => setTimeout(resolve, 1600));
  await bridge.onSessionEvent({ id: 'sess-1' }, {
    type: 'tool/result',
    data: { turn: 1, step: 1, message: { toolCallId: 'c1', isError: false, content: [{ type: 'text', text: 'ok' }] } },
  });
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'subagent/catalog', data: { turn: 1, childId: 'child-1', label: '调查' } });
  await bridge.onForeignSessionEvent({ id: 'child-1' }, { type: 'assistant/message', data: { usage: { inputTokens: 2048, outputTokens: 64, cacheReadTokens: 1024 } } });
  await bridge.onSessionEvent({ id: 'sess-1' }, {
    type: 'assistant/message',
    data: {
      turn: 1, step: 1, usage: { inputTokens: 9700, outputTokens: 128, cacheReadTokens: 896, totalTokens: 10724 },
      message: { content: [{ type: 'text', text: '**加粗**答案' }] },
    },
  });
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });

  const patches = client.calls.filter((c) => c.api === 'message.patch');
  assert.ok(patches.length >= 1, 'progress/final must patch the same card');
  for (const patch of patches) assertCard(JSON.parse(patch.data.content), 'patched card');
  assert.match(patches.at(-1).data.content, /加粗/);
  assert.match(patches.at(-1).data.content, /collapsible_panel/, 'final card keeps the tool panel');
  assert.match(patches.at(-1).data.content, /工具调用 1/, 'collapsed panel shows the stats');
  assert.match(patches.at(-1).data.content, /🪙 累计/, 'usage panel shows cumulative totals');
  assert.match(patches.at(-1).data.content, /子智能体 · 调查/, 'subagent usage is included');
  assert.match(patches.at(-1).data.content, /上下文 \d+%/, 'context pressure is shown');
  const progressPatch = patches.find((patch) => /001\. ✅ bash · `ls -la`/.test(patch.data.content));
  assert.ok(progressPatch, 'panel lists tool name and backticked arguments');
  assert.ok(!/· \d+\.\d+s/.test(progressPatch.data.content), 'step durations are gone');
  bridge.dispose();
}

// 2) /menu → 菜单卡；卡片按钮 → 会话绑定
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox') });
  await bridge.handleMessage(inbound('/menu'));
  const menu = client.calls.find((c) => c.api === 'message.create');
  const card = JSON.parse(menu.data.content);
  assertCard(card, 'menu card');
  assert.ok(card.header?.title?.content?.length > 0, 'menu card has a title');
  const pick = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'session_pick' }, option: 'sess-1' },
    context: { open_message_id: 'om_menu', open_chat_id: 'oc_e2e' },
  });
  assert.equal(pick, undefined, 'dropdown pick is silent');
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'menu_apply' } },
    context: { open_message_id: 'om_menu', open_chat_id: 'oc_e2e' },
  });
  assert.equal(state.sessionFor('chat:oc_e2e'), 'sess-1');
  bridge.dispose();
}

// 3) 图片入站 → 下载 → 原生 image part
{
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const client = recordingClient({ resourceBytes: png });
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox') });
  await bridge.handleMessage({
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: { message_id: `om_img_${++seq}`, chat_id: 'oc_e2e', chat_type: 'p2p', message_type: 'image', content: JSON.stringify({ image_key: 'k1' }), mentions: [] },
  });
  const get = client.calls.find((c) => c.api === 'messageResource.get');
  assert.equal(get.params.type, 'image');
  const parts = harness.prompts.at(-1).content;
  const image = parts.find((p) => p.type === 'image');
  assert.equal(image.mediaType, 'image/png');
  bridge.dispose();
}

// 4) 文件回传工具 → 上传并按类型发消息
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const { BotRuntime } = await import('../src/runtime.js');
  const botConfig = await configStore.add({ appId: 'cli_cccccccccccccccc', botName: 'b' });
  const botRuntime = new BotRuntime({
    ctx: {
      credentials: {
        resolve: async () => ({ value: 's' }),
        describe: async () => ({ configured: true }),
        set: async () => {},
        unset: async () => {},
      },
    },
    botId: botConfig.id,
    configStore,
    stateStore: state,
    harness,
    logger: { info() {}, warn() {}, error() {} },
    version: 't',
    dataDir: dir,
    verify: async () => ({ name: 'b', openId: 'ou_b' }),
    createBot: () => bot,
  });
  bot.startLongConnection = async ({ onState }) => { onState?.('connected'); return 'connected'; };
  await botRuntime.connect();
  await state.bindSession('chat:oc_e2e', 'sess-1');
  const { writeFile } = await import('node:fs/promises');
  const file = join(dir, '报告.txt');
  await writeFile(file, 'hello');
  const result = await botRuntime.sendFileForSession({ sessionId: 'sess-1', path: file });
  assert.equal(result.fileName, '报告.txt');
  const upload = client.calls.find((c) => c.api === 'file.create');
  assert.equal(upload.name, '报告.txt');
  const send = client.calls.find((c) => c.api === 'message.create' && c.data.msg_type === 'file');
  assert.ok(send, 'file message must be sent');
  assert.match(send.data.content, /file_key/);
  botRuntime.dispose();
}

// 5) 话题：回答以线程回复发送，不在聊天流另发卡片
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const topic = await state.createTopic({ chatId: 'oc_e2e', title: '测试话题', brief: '正文', sessionId: 'sess-topic', rootMessageId: 'om_root' });
  await state.bindSession(`topic:oc_e2e:${topic.topicId}`, 'sess-topic');
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox') });
  await bridge.handleMessage({
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: {
      message_id: 'om_topic_reply', chat_id: 'oc_e2e', chat_type: 'group', message_type: 'text',
      parent_id: 'om_root', mentions: [{ id: { open_id: 'ou_bot' } }],
      content: JSON.stringify({ text: '继续' }),
    },
  });
  await bridge.onSessionEvent({ id: 'sess-topic' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-topic' }, { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '第一轮回答' }] } } });
  await bridge.onSessionEvent({ id: 'sess-topic' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const replies = client.calls.filter((call) => call.api === 'message.reply');
  assert.equal(replies.length, 1, 'topic answer goes into the card thread');
  assert.equal(replies[0].path.message_id, 'om_root');
  assert.equal(replies[0].data.reply_in_thread, true, 'reply must stay in the topic thread');
  assert.equal(client.calls.filter((call) => call.api === 'message.create').length, 0, 'no extra card in the chat feed');
  const patches = client.calls.filter((call) => call.api === 'message.patch');
  assert.ok(patches.length > 0, 'the threaded answer card is patched');
  assert.match(patches.at(-1).data.content, /第一轮回答/, 'threaded card carries the answer');
  bridge.dispose();
}

// 6) /topic-sync：话题摘要同步回主会话
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const topic = await state.createTopic({ chatId: 'oc_e2e', title: '同步话题', brief: '正文', sessionId: 'sess-sync', rootMessageId: 'om_sync_root' });
  await state.bindSession(`topic:oc_e2e:${topic.topicId}`, 'sess-sync');
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox') });
  await bridge.handleMessage({
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: {
      message_id: 'om_sync_cmd', chat_id: 'oc_e2e', chat_type: 'group', message_type: 'text',
      parent_id: 'om_sync_root', mentions: [{ id: { open_id: 'ou_bot' } }],
      content: JSON.stringify({ text: '/topic-sync' }),
    },
  });
  assert.equal(state.topicFor('oc_e2e', topic.topicId)?.syncRequested, true, 'sync command marked');
  await bridge.onSessionEvent({ id: 'sess-sync' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-sync' }, { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '结论要点一' }] } } });
  await bridge.onSessionEvent({ id: 'sess-sync' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const synced = state.syncedFor('oc_e2e');
  assert.ok(synced.some((item) => item.topicId === topic.topicId && item.summary.includes('结论要点一')), 'summary synced to the chat');
  assert.equal(state.topicFor('oc_e2e', topic.topicId)?.syncRequested, false, 'sync flag cleared');
  bridge.dispose();
}

// 7) 绑定会话里 Web 侧触发的 turn 不向飞书发卡片
{
  const client = recordingClient();
  const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
  const bridge = new FeishuBridge({ bot, harness, config, state, version: 't', inboxDir: join(dir, 'inbox') });
  await state.bindSession('chat:oc_web', 'sess-web');
  await bridge.onSessionEvent({ id: 'sess-web' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-web' }, {
    type: 'assistant/message',
    data: { turn: 1, usage: { inputTokens: 300, outputTokens: 50, cacheReadTokens: 700, totalTokens: 1050 }, message: { content: [{ type: 'text', text: 'Web 的回答' }] } },
  });
  await bridge.onSessionEvent({ id: 'sess-web' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.equal(client.calls.filter((call) => call.api === 'message.create' || call.api === 'message.reply').length, 0, 'web-origin turn stays out of Feishu');
  assert.equal(state.usageFor?.('usage:sess-web')?.input, 1000, 'web turn usage still counts toward the session');
  bridge.dispose();
}

await rm(dir, { recursive: true, force: true });
console.log('feishu e2e (mock): 7 scenarios passed');
