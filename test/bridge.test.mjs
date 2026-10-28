import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigStore, StateStore } from '../src/config.js';
import { FeishuBridge } from '../src/bridge.js';

let seq = 0;
class FakeBot {
  text = [];
  replies = [];
  updates = [];
  cards = [];
  patches = [];
  async sendText(chatId, text) { const id = `m${++seq}`; this.text.push({ chatId, text, id }); return id; }
  async replyText(messageId, text) { this.replies.push({ messageId, text }); return `m${++seq}`; }
  async updateText(id, text) { this.updates.push({ id, text }); return id; }
  async sendCard(chatId, card) { const id = `m${++seq}`; this.cards.push({ chatId, card, id }); return id; }
  cardKit = false;
  cardEntities = [];
  cardRefs = [];
  cardTextUpdates = [];
  cardUpdates = [];
  async createCard(card) {
    if (!this.cardKit) throw new Error('cardkit unavailable');
    const id = `card_${++seq}`;
    this.cardEntities.push({ id, card });
    return id;
  }
  async sendCardRef(chatId, cardId, uuid) {
    const id = `m${++seq}`;
    this.cardRefs.push({ chatId, cardId, id, uuid });
    return id;
  }
  async replyCardRefInThread(messageId, cardId, uuid) {
    const id = `m${++seq}`;
    this.cardRefs.push({ messageId, cardId, id, uuid });
    return { messageId: id, threadId: 'thread_1' };
  }
  async updateCardText(cardId, elementId, content, sequence, uuid) {
    this.cardTextUpdates.push({ cardId, elementId, content, sequence, uuid });
    return cardId;
  }
  async updateCard(cardId, card, sequence, uuid) {
    this.cardUpdates.push({ cardId, card, sequence, uuid });
    return cardId;
  }
  async getChatName(chatId) { return chatId === 'oc_group' ? '研发群' : null; }
  async getUserName(openId) { return openId === 'ou_user' ? '测试用户' : null; }
  async getMessage(id) { return id === 'om_bot_msg' ? { senderId: 'ou_bot', senderType: 'app' } : { senderId: 'ou_other', senderType: 'user' }; }
  async patchCard(id, card) { this.patches.push({ id, card }); return id; }
  async addReaction(messageId, emoji) { this.reactions = this.reactions ?? []; const id = `r${this.reactions.length + 1}`; this.reactions.push({ messageId, emoji, id }); return id; }
  async removeReaction(messageId, reactionId) { this.removed = this.removed ?? []; this.removed.push({ messageId, reactionId }); return true; }
  async deleteMessage(id) { this.deleted = this.deleted ?? []; this.deleted.push(id); return true; }
  async downloadResource() { throw new Error('no download in tests'); }
  get raw() {
    return { cardkit: { v1: { card: { create: async () => { throw new Error('cardkit unavailable'); } } } } };
  }
}

class FakeHarness {
  created = 0;
  prompts = [];
  cancelled = [];
  models = [{ sessionId: 'sess-test', updatedAt: Date.now(), running: false }];
  async createSession(args) { this.lastCreate = args; this.created += 1; this.models.push({ sessionId: `sess-${this.created}`, updatedAt: Date.now(), running: false }); return `sess-${this.created}`; }
  async resolveWorkspaceId() { return 'ws-1'; }
  async ensureWorkspace() { return 'ws-2'; }
  async prompt(sessionId, content, options) { this.prompts.push({ sessionId, content, options }); }
  async cancel(sessionId) { this.cancelled.push(sessionId); }
  permissions = [];
  async setPermission(sessionId, preset) {
    this.permissions.push({ sessionId, preset });
    return { result: { kind: 'success', text: 'Permission updated.' } };
  }
  compacted = [];
  async compact(sessionId) {
    this.compacted.push(sessionId);
    return { commandId: 'cmd-1', result: { kind: 'success', text: 'Compacted 3 history items' } };
  }
  async listSessions() { return this.models; }
  async sessionProjections() {
    return {
      tokenUsage: { uncachedInputTokens: 7035658, outputTokens: 1329752, cacheReadTokens: 927102592, cacheWriteTokens: 0 },
      contextPressure: { pressureTokens: 548000, contextWindow: 1048576 },
      contextBreakdown: { systemTokens: 1400, toolsTokens: 9000, messageTokens: 431000 },
    };
  }
  async modelCatalog() { return { groups: [{ id: 'prov', name: 'Prov', models: [{ id: 'model-a', name: 'A' }] }] }; }
  async selectModel(id, selection) { this.lastModel = { id, selection }; return {}; }
  async workspaceBaseline() { return { workspaces: [{ path: '/tmp/one' }] }; }
  async executeCommand() { return {}; }
  async history() { return []; }
}

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-test-'));
const configStore = new ConfigStore(join(dir, 'config.json'));
await configStore.load();
const state = new StateStore(join(dir, 'state.json'));
await state.load();

const cardText = (bot) => JSON.stringify(bot.cards.at(-1)?.card ?? '');

function makeBridge(overrides = {}) {
  const bot = new FakeBot();
  const harness = new FakeHarness();
  const contextBySession = new Map();
  const config = {
    appId: 'cli_test',
    botOpenId: 'ou_bot',
    workspace: null,
    model: null,
    busyMode: 'queue',
    access: { group: 'all', allowOpenIds: [], managers: ['ou_user'] },
    // Tests opt in explicitly; production normalization turns this on by default.
    eavesdrop: { enabled: false, limit: 0 },
    ...overrides,
  };
  const bridge = new FeishuBridge({
    bot, harness, config, state, version: '0.1.0', inboxDir: join(dir, 'inbox'),
    logger: { info() {}, warn() {}, error() {} },
    onContext: (sessionId, text) => { if (text) contextBySession.set(sessionId, text); else contextBySession.delete(sessionId); },
    listPresets: async () => [{ id: 'cordis', name: 'Cordis' }, { id: 'standard', name: 'Standard' }],
    savePreset: async (value) => {
      config.agentPreset = value;
      return config;
    },
  });
  return { bot, harness, bridge, config, contextBySession };
}

function message(overrides = {}) {
  return {
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_user' } },
    message: {
      message_id: `om_${++seq}`,
      chat_id: 'oc_chat',
      chat_type: 'p2p',
      message_type: 'text',
      content: JSON.stringify({ text: '你好' }),
      mentions: [],
      ...overrides,
    },
  };
}

// 1) 私聊文本 → 建会话并提交 prompt
{
  const { bot, harness, bridge } = makeBridge();
  await bridge.handleMessage(message());
  assert.equal(harness.created, 1, 'should create one session');
  assert.equal(harness.prompts.length, 1);
  assert.deepEqual(harness.prompts[0].content, [{ type: 'text', text: '你好' }]);
  assert.equal(state.sessionFor('chat:oc_chat'), 'sess-1');
  bridge.dispose();
}

// 1b) 新会话应用默认权限档位
{
  const { harness, bridge } = makeBridge({ permissionPreset: 'workspace-write' });
  await bridge.handleMessage(message({ chat_id: 'oc_perm', content: JSON.stringify({ text: '你好' }) }));
  assert.equal(harness.permissions.length, 1, 'new session gets the preset');
  assert.equal(harness.permissions[0].preset, 'workspace-write');
  bridge.dispose();
}

// 2) 同一条消息重复投递只处理一次
{
  const { harness, bridge } = makeBridge();
  const event = { sender: { sender_type: 'user' }, message: { message_id: 'om_dup', chat_id: 'oc_dup', chat_type: 'p2p', message_type: 'text', content: JSON.stringify({ text: 'hi' }), mentions: [] } };
  await bridge.handleMessage(event);
  await bridge.handleMessage(event);
  assert.equal(harness.prompts.length, 1, 'duplicate message must not prompt twice');
  bridge.dispose();
}

// 3) 群聊未 @ 时忽略，@ 后响应
{
  const { harness, bridge } = makeBridge();
  await bridge.handleMessage(message({ chat_id: 'oc_group', chat_type: 'group' }));
  assert.equal(harness.prompts.length, 0, 'group message without mention is ignored');
  await bridge.handleMessage(message({ chat_id: 'oc_group', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }] }));
  assert.equal(harness.prompts.length, 1, 'mention should be answered');
  bridge.dispose();
}

// 4) 白名单模式拦截陌生人
{
  const { bot, harness, bridge } = makeBridge({ access: { group: 'allowlist', allowOpenIds: ['ou_owner'] } });
  // 私聊不受白名单限制
  await bridge.handleMessage(message({ chat_id: 'oc_dm' }));
  assert.equal(harness.prompts.length, 1, 'private chat ignores the allowlist');
  // 群聊白名单仍然生效
  await bridge.handleMessage(message({ chat_id: 'oc_deny', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }] }));
  assert.equal(harness.prompts.length, 1, 'group chat still respects the allowlist');
  assert.match(cardText(bot), /没有使用权限/);
  bridge.dispose();
}

// 5) 菜单：四个可调下拉 + 只读预设 + 调整/新会话/关闭
{
  const { bot, harness, bridge } = makeBridge();
  state.bindSession('chat:oc_panel', 'sess-1').catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await bridge.handleMessage(message({ chat_id: 'oc_panel', content: JSON.stringify({ text: '/menu' }) }));
  const card = bot.cards.at(-1).card;
  const flat = JSON.stringify(card);
  assert.match(flat, /new_session/, 'menu keeps the new-session button');
  assert.match(flat, /\*\*会话\*\*/, 'dropdowns carry titles');
  assert.match(flat, /\*\*模型\*\*/);
  assert.ok(!/slash_run/.test(flat), 'command buttons are gone (native panel handles them)');
  assert.match(flat, /model_pick/, 'menu offers a model picker');
  assert.match(flat, /menu_apply/, 'menu offers an apply button');
  assert.match(flat, /"压缩"/, "menu offers manual compaction");
  // 选择只登记待切换项，不立即生效
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'model_pick' }, option: 'prov/model-a' },
    context: { open_chat_id: 'oc_panel', open_message_id: 'om_menu' },
  });
  assert.equal(harness.lastModel, undefined, 'pick alone must not switch');
  // 点「切换」才生效
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'menu_apply' } },
    context: { open_chat_id: 'oc_panel', open_message_id: 'om_menu' },
  });
  assert.deepEqual(harness.lastModel?.selection, { provider: 'prov', model: 'model-a' });
  bridge.dispose();
}

// 5d) 菜单统计常驻；Token 统计与工具调用是两个独立开关
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_stats_menu', 'sess-1');
  await bridge.handleMessage(message({ chat_id: 'oc_stats_menu', content: JSON.stringify({ text: '/menu' }) }));
  const menu = bot.cards.at(-1);
  const before = JSON.stringify(menu.card);
  assert.match(before, /stats_toggle/, 'menu offers the token toggle');
  assert.match(before, /tools_toggle/, 'menu offers the tools toggle');
  assert.match(before, /🪙 Token 用量/, 'menu statistics stay visible');
  assert.match(before, /已关闭/, 'both reply-card panels are off by default');
  const stats = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'stats_toggle' } },
    context: { open_chat_id: 'oc_stats_menu', open_message_id: menu.id },
  });
  assert.equal(state.statsFor('chat:oc_stats_menu'), true, 'token toggle is persisted');
  assert.equal(state.toolsFor('chat:oc_stats_menu'), false, 'token toggle does not enable tools');
  const afterStats = JSON.stringify(stats.card.data);
  assert.match(afterStats, /🪙 Token 用量/, 'menu statistics are unaffected');
  const tools = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'tools_toggle' } },
    context: { open_chat_id: 'oc_stats_menu', open_message_id: menu.id },
  });
  assert.equal(state.toolsFor('chat:oc_stats_menu'), true, 'tools toggle is persisted');
  assert.match(JSON.stringify(tools.card.data), /已开启/, 'tools toggle reflects enabled state');
  bridge.dispose();
}

// 5c) 菜单：手动压缩上下文
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_compact', 'sess-compact');
  const result = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'compact' } },
    context: { open_chat_id: 'oc_compact', open_message_id: 'om_menu' },
  });
  assert.deepEqual(harness.compacted, ['sess-compact']);
  assert.equal(result.toast.type, 'success');
  assert.match(cardText(bot), /上下文压缩：Compacted 3 history items/);
  bridge.dispose();
}

// 6) 命令仍然可用：/new /stop
{
  const { bot, bridge } = makeBridge();
  await bridge.handleMessage(message({ chat_id: 'oc_cmd', content: JSON.stringify({ text: '/new' }) }));
  assert.match(cardText(bot), /全新会话/);
  await bridge.handleMessage(message({ chat_id: 'oc_cmd', content: JSON.stringify({ text: '/stop' }) }));
  assert.match(cardText(bot), /没有可停止|已请求停止/);
  bridge.dispose();
}

// 7) 审批：发卡 → 点“批准” → 返回 allowed-once 并就地更新卡片
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_approve', 'sess-approve');
  const request = {
    callId: 'call-1',
    toolName: 'bash',
    reason: 'run tests',
    signal: new AbortController().signal,
    agent: { session: { id: 'sess-approve', snapshotEvents: () => [{ type: 'approval/asked', data: { id: 'ap-1', callId: 'call-1' } }] } },
  };
  const pending = bridge.handleApproval(request, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(bot.cards.length, 1, 'approval card should be sent');
  const action = {
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'approve:ap-1' } },
    context: { open_message_id: bot.cards[0].id, open_chat_id: 'oc_approve' },
  };
  const toast = await bridge.onCardAction(action);
  assert.equal(toast.toast.type, 'success');
  assert.equal(await pending, 'allowed-once');
  assert.match(JSON.stringify(bot.patches.at(-1).card), /已批准/);
  bridge.dispose();
}

// 8) 审批文字回退：直接回“拒绝”
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_text', 'sess-text');
  const request = {
    callId: 'call-2', toolName: 'bash', signal: new AbortController().signal,
    agent: { session: { id: 'sess-text', snapshotEvents: () => [{ type: 'approval/asked', data: { id: 'ap-2', callId: 'call-2' } }] } },
  };
  const pending = bridge.handleApproval(request, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await bridge.handleMessage(message({ chat_id: 'oc_text', content: JSON.stringify({ text: '拒绝' }) }));
  assert.equal(await pending, 'rejected');
  assert.match(cardText(bot), /🚫 已拒绝。/);
  bridge.dispose();
}

// 9) 提问：选项按钮 → 返回 answers
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_q', 'sess-q');
  const request = {
    signal: new AbortController().signal,
    agent: { session: { id: 'sess-q', snapshotEvents: () => [] } },
    questions: [{ id: 'q1', question: '选哪个方案？', options: [{ label: '方案 A' }, { label: '方案 B' }] }],
  };
  const pending = bridge.handleQuestion(request, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(bot.cards.length, 1, 'question card should be sent');
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'answer:q1:1' } },
    context: { open_message_id: bot.cards[0].id },
  });
  const answer = await pending;
  assert.deepEqual(answer, { answers: [{ id: 'q1', selected: ['方案 B'] }] });
  bridge.dispose();
}

// 9z) 菜单不提供已归档、空白、子会话或待迁移会话
{
  const { bot, harness, bridge } = makeBridge();
  harness.models = [
    { sessionId: 'sess-live', updatedAt: Date.now(), running: false, blank: false },
    { sessionId: 'sess-archived', updatedAt: Date.now(), running: false, blank: false },
    { sessionId: 'sess-blank', updatedAt: Date.now(), running: false, blank: true },
    { sessionId: 'sess-child', updatedAt: Date.now(), running: false, blank: false, origin: 'subagent' },
    { sessionId: 'sess-migrating', updatedAt: Date.now(), running: false, blank: false, formatStatus: 'migration-required' },
  ];
  harness.workspaceBaseline = async () => ({
    items: [{
      workspaceId: 'ws-1',
      path: '/tmp/one',
      title: 'one',
      sessionIds: harness.models.map((item) => item.sessionId),
    }],
    archivedSessionIds: ['sess-archived'],
  });
  await bridge.handleMessage(message({ chat_id: 'oc_menu_filter', content: JSON.stringify({ text: '/menu' }) }));
  const flat = JSON.stringify(bot.cards.at(-1)?.card ?? {});
  assert.match(flat, /sess-live/, 'menu keeps a normal session');
  for (const hidden of ['sess-archived', 'sess-blank', 'sess-child', 'sess-migrating']) {
    assert.ok(!flat.includes(hidden), `menu hides ${hidden}`);
  }
  bridge.dispose();
}

// 10) 菜单卡：选会话 → 调整生效；新会话卡 → 取消撤回、创建解绑
{
  const { bot, bridge } = makeBridge();
  await bridge.handleMessage(message({ chat_id: 'oc_menu', content: JSON.stringify({ text: '/menu' }) }));
  assert.equal(bot.cards.length, 1, 'menu should render as a card');
  const menu = bot.cards[0];
  assert.equal(menu.card.schema, '2.0');
  const pick = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'session_pick' }, option: 'sess-test' },
    context: { open_message_id: menu.id, open_chat_id: 'oc_menu' },
  });
  assert.equal(pick, undefined, 'dropdown pick is silent');
  assert.notEqual(state.sessionFor('chat:oc_menu'), 'sess-test');
  const apply = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'menu_apply' } },
    context: { open_message_id: menu.id, open_chat_id: 'oc_menu' },
  });
  assert.equal(apply.toast.type, 'success');
  assert.equal(state.sessionFor('chat:oc_menu'), 'sess-test');
  const open = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'new_session' } },
    context: { open_message_id: menu.id, open_chat_id: 'oc_menu' },
  });
  assert.equal(open.toast.type, 'info', 'new_session opens a settings card');
  const newSessionCard = bot.cards.at(-1);
  const shown = JSON.stringify(newSessionCard?.card ?? {});
  assert.match(shown, /ns_model/, 'new-session card carries its own pickers');
  assert.ok(!shown.includes('创建后发送任意消息'), 'no create-footer copy');
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'new_session_cancel' } },
    context: { open_message_id: newSessionCard.id, open_chat_id: 'oc_menu' },
  });
  assert.deepEqual(bot.deleted, [newSessionCard.id], 'cancel recalls the card instead of posting text');
  const created = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'new_session_create' } },
    context: { open_message_id: newSessionCard.id, open_chat_id: 'oc_menu' },
  });
  assert.equal(state.sessionFor('chat:oc_menu'), null, 'creating a session unbinds the chat');
  assert.equal(created.card?.type, 'raw', 'callback response carries the ready card');
  assert.match(JSON.stringify(created.card?.data), /新会话已就绪/);
  assert.ok(!JSON.stringify(bot.cards).includes('新会话已就绪'), 'no extra ready card is sent');
  bridge.dispose();
}

// 10b) 新建会话创建：回调响应直接带新卡片，不依赖 open_message_id
{
  const { bot, bridge } = makeBridge();
  await bridge.handleMessage(message({ chat_id: 'oc_ns_id', content: JSON.stringify({ text: '/menu' }) }));
  const menu = bot.cards[0];
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'new_session' } },
    context: { open_message_id: menu.id, open_chat_id: 'oc_ns_id' },
  });
  const created = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'new_session_create' } },
    context: { open_chat_id: 'oc_ns_id' },
  });
  assert.equal(created.card?.type, 'raw', 'card response does not need a callback message id');
  assert.match(JSON.stringify(created.card?.data), /新会话已就绪/);
  bridge.dispose();
}

// 11) 图片入站：下载 → 原生 image part
{
  const { bot, harness, bridge } = makeBridge();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  bot.downloadResource = async () => png;
  await bridge.handleMessage(message({
    chat_id: 'oc_img',
    message_type: 'image',
    content: JSON.stringify({ image_key: 'img-1' }),
  }));
  const content = harness.prompts.at(-1).content;
  const imagePart = content.find((part) => part.type === 'image');
  assert.equal(imagePart.mediaType, 'image/png');
  assert.equal(Buffer.from(imagePart.data, 'base64').length, png.length);
  bridge.dispose();
}

// 12) 文件入站：落盘 + 路径进 prompt 文本
{
  const { bot, harness, bridge } = makeBridge();
  bot.downloadResource = async () => Buffer.from('hello file');
  await bridge.handleMessage(message({
    chat_id: 'oc_file',
    message_type: 'file',
    content: JSON.stringify({ file_key: 'file-1', file_name: '报告.txt' }),
  }));
  const text = harness.prompts.at(-1).content.map((part) => part.text ?? '').join('');
  assert.match(text, /报告\.txt/);
  assert.match(text, /已保存到 .*inbox/);
  bridge.dispose();
}

// 13b) 群内管理动作只允许白名单
{
  const config = { access: { group: 'all', allowOpenIds: [], managers: ['ou_admin'] } };
  const { bot, bridge } = makeBridge(config);
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '/new' }),
  }));
  assert.match(cardText(bot), /只有管理员/);
  await bridge.handleMessage({
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_admin' } },
    message: {
      message_id: 'om_admin_new', chat_id: 'oc_group', chat_type: 'group', message_type: 'text',
      content: JSON.stringify({ text: '/new' }), mentions: [{ id: { open_id: 'ou_bot' } }],
    },
  });
  assert.match(cardText(bot), /全新会话/);
  bridge.dispose();
}

// 13c) 群内卡片上的管理动作同样受限
{
  const config = { access: { group: 'all', allowOpenIds: [], managers: [] } };
  const { bridge } = makeBridge(config);
  // 先让 bridge 认识这个群（群类型来自入站消息）
  await bridge.handleMessage(message({ chat_id: 'oc_group', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }] }));
  const denied = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'menu_apply' } },
    context: { open_chat_id: 'oc_group', open_message_id: 'om' },
  });
  assert.equal(denied.toast.type, 'warning', 'empty manager list denies everyone in groups');
  bridge.dispose();
}

// 13d) 其它机器人的消息：默认响应，显式关闭时忽略
{
  const off = makeBridge({ respondToBotMessages: false });
  await off.bridge.handleMessage({
    sender: { sender_type: 'app', sender_id: { open_id: 'ou_other_bot' } },
    message: { message_id: 'om_bot1', chat_id: 'oc_group', chat_type: 'group', message_type: 'text', content: JSON.stringify({ text: '我来汇总' }), mentions: [{ id: { open_id: 'ou_bot' } }] },
  });
  assert.equal(off.harness.prompts.length, 0, 'bot messages ignored by default');

  const on = makeBridge();
  await on.bridge.handleMessage({
    sender: { sender_type: 'app', sender_id: { open_id: 'ou_other_bot' } },
    message: { message_id: 'om_bot2', chat_id: 'oc_group2', chat_type: 'group', message_type: 'text', content: JSON.stringify({ text: '我来汇总' }), mentions: [{ id: { open_id: 'ou_bot' } }] },
  });
  assert.equal(on.harness.prompts.length, 1, 'bot messages accepted when enabled');
  off.bridge.dispose();
  on.bridge.dispose();
}

// 13e) 话题：用户消息为根 → 独立会话 → 话题内仅 @ 响应 → /topic-sync 生成摘要
{
  const { bot, harness, bridge } = makeBridge();
  const rootId = 'om_topic_root';
  await bridge.handleMessage(message({
    message_id: rootId,
    chat_id: 'oc_group', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '/topic 重构投递模块\n先梳理现状' }),
  }));
  assert.equal(harness.created, 1, 'topic opens a fresh Session');
  assert.equal(harness.prompts.at(-1)?.sessionId, 'sess-1', 'topic Session gets the brief');
  const topic = state.topicFor('oc_group', 1);
  assert.equal(topic?.rootMessageId, rootId, 'topic is rooted at the user message');

  // 话题内不 @ 不响应
  const before = harness.prompts.length;
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', parent_id: rootId,
    content: JSON.stringify({ text: '悄悄说一句' }), mentions: [],
  }));
  assert.equal(harness.prompts.length, before, 'topic requires a mention');

  // 话题内 @ 才处理
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', parent_id: rootId,
    content: JSON.stringify({ text: '继续做第二步' }), mentions: [{ id: { open_id: 'ou_bot' } }],
  }));
  assert.equal(harness.prompts.at(-1)?.sessionId, 'sess-1', 'mention inside topic routes to the topic');

  // /topic-sync 让话题会话生成摘要，并在结束时同步回主会话
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', parent_id: rootId,
    content: JSON.stringify({ text: '/topic-sync' }), mentions: [{ id: { open_id: 'ou_bot' } }],
  }));
  assert.equal(state.topicFor('oc_group', 1)?.syncRequested, true, 'sync marked as pending');
  assert.match(String(harness.prompts.at(-1)?.content?.[0]?.text ?? ''), /总结/, 'topic asked for a summary');
  bridge.dispose();
}

// 13e2) 话题不受管理白名单限制；开关关闭后拒绝
{
  const restricted = makeBridge({ access: { group: 'all', allowOpenIds: [], managers: [] } });
  await restricted.bridge.handleMessage(message({
    chat_id: 'oc_topic_open', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '/topic 任意成员可开话题\n正文' }),
  }));
  assert.equal(restricted.harness.created, 1, 'anyone may open a topic without being a manager');

  const off = makeBridge({ topicsEnabled: false });
  await off.bridge.handleMessage(message({
    chat_id: 'oc_topic_off', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '/topic 关闭时的尝试\n正文' }),
  }));
  assert.equal(off.harness.created, 0, 'disabled topics refuse creation');
  assert.match(cardText(off.bot), /话题功能已关闭/);
  restricted.bridge.dispose();
  off.bridge.dispose();
}

// 13f) 话题继承源群会话的工作区（不继承会话本身）
{
  const { harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_inherit', 'sess-main');
  await state.setSessionMeta('sess-main', { workspace: '/tmp/one', origin: 'feishu' });
  await bridge.handleMessage(message({
    chat_id: 'oc_inherit', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '/topic 继承测试\n正文内容' }),
  }));
  assert.deepEqual(harness.lastCreate, { workspaceId: 'ws-1', agentPreset: undefined }, 'topic reuses the chat workspace');
  const topic = state.topicFor('oc_inherit', 1);
  assert.equal(state.value.meta?.[topic.sessionId]?.workspace, '/tmp/one', 'topic session records the same workspace');
  assert.notEqual(topic.sessionId, 'sess-main', 'topic gets its own Session');
  bridge.dispose();
}

// 13g) 主会话下一条消息会带上话题同步摘要（作为消息前置块，不进 guidance）
{
  const { harness, contextBySession, bridge } = makeBridge();
  await state.bindSession('chat:oc_sync', 'sess-main2');
  await state.setSessionMeta('sess-main2', { origin: 'feishu' });
  await state.addSynced('oc_sync', { topicId: 7, title: '同步话题', summary: '结论要点', at: new Date().toISOString() });
  await bridge.handleMessage(message({ chat_id: 'oc_sync', content: JSON.stringify({ text: '总结一下' }) }));
  const content = harness.prompts.at(-1).content;
  const syncPart = content.find((part) => String(part.text).includes('<feishu_bot_topic_sync>'));
  assert.ok(syncPart, 'sync block rides the prompt');
  assert.match(syncPart.text, /话题 #7「同步话题」：结论要点/);
  assert.equal(String(contextBySession.get('sess-main2') ?? '').includes('topic_sync'), false, 'guidance stays clean');
  bridge.dispose();
}

// 13h) 消息状态表情：处理中 → 完成 / 停止
{
  const { bot, bridge } = makeBridge();
  await bridge.handleMessage(message({ message_id: 'om_react', content: JSON.stringify({ text: '你好' }) }));
  assert.deepEqual(bot.reactions.at(-1), { messageId: 'om_react', emoji: 'OnIt', id: 'r1' }, 'processing reaction added');
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-1' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.equal(bot.reactions.at(-1).emoji, 'DONE', 'completed reaction');
  assert.deepEqual(bot.removed.at(-1), { messageId: 'om_react', reactionId: 'r1' }, 'old reaction removed');

  const stopped = makeBridge();
  await state.bindSession('chat:oc_chat', 'sess-stop');
  await stopped.bridge.handleMessage(message({ message_id: 'om_react2', content: JSON.stringify({ text: '你好' }) }));
  await stopped.bridge.onSessionEvent({ id: 'sess-stop' }, { type: 'turn/start', data: { turn: 1 } });
  await stopped.bridge.onSessionEvent({ id: 'sess-stop' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'aborted' } } });
  assert.ok(stopped.bot.reactions.some((item) => item.emoji === 'DIZZY'), 'stopped reaction');
  bridge.dispose();
  stopped.bridge.dispose();
}

// 13h2) 同一 Session 绑定多个 chat 时，按来源消息结算表情
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_shared_group', 'sess-shared');
  await state.bindSession('chat:oc_shared_p2p', 'sess-shared');
  await bridge.handleMessage(message({
    message_id: 'om_shared',
    chat_id: 'oc_shared_p2p',
    content: JSON.stringify({ text: '同一个会话的私聊消息' }),
  }));
  await bridge.onSessionEvent({ id: 'sess-shared' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-shared' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.ok(
    bot.reactions.some((item) => item.messageId === 'om_shared' && item.emoji === 'DONE'),
    'shared-session message settles to DONE',
  );
  assert.equal(
    bot.reactions.filter((item) => item.messageId === 'om_shared').at(-1)?.emoji,
    'DONE',
    'processing reaction is replaced, not left as the latest state',
  );
  assert.ok(
    bot.removed.some((item) => item.messageId === 'om_shared' && item.reactionId === 'r1'),
    'the processing reaction is removed',
  );
  bridge.dispose();
}

// 13i) 排队模式下多条消息各自结算表情
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_queue', 'sess-queue');
  await bridge.handleMessage(message({ message_id: 'om_q1', chat_id: 'oc_queue', content: JSON.stringify({ text: '第一条' }) }));
  await bridge.onSessionEvent({ id: 'sess-queue' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.handleMessage(message({ message_id: 'om_q2', chat_id: 'oc_queue', content: JSON.stringify({ text: '第二条' }) }));
  await bridge.onSessionEvent({ id: 'sess-queue' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const done1 = bot.reactions.find((item) => item.messageId === 'om_q1' && item.emoji === 'DONE');
  const stillOnIt = bot.reactions.filter((item) => item.messageId === 'om_q2' && item.emoji === 'OnIt');
  assert.ok(done1, 'first message settled');
  assert.equal(stillOnIt.length, 1, 'second message waits for its own turn');
  await bridge.onSessionEvent({ id: 'sess-queue' }, { type: 'turn/start', data: { turn: 2 } });
  await bridge.onSessionEvent({ id: 'sess-queue' }, { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } });
  assert.ok(bot.reactions.some((item) => item.messageId === 'om_q2' && item.emoji === 'DONE'), 'second message settled later');
  bridge.dispose();
}

// 13j) 跨来源 steer 强制排队：Web 轮次运行时飞书消息不能插入
{
  const { harness, bridge } = makeBridge({ busyMode: 'steer' });
  await state.bindSession('chat:oc_steer', 'sess-ext');
  await bridge.onSessionEvent({ id: 'sess-ext' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.handleMessage(message({ chat_id: 'oc_steer', content: JSON.stringify({ text: '插入试试' }) }));
  assert.equal(harness.prompts.at(-1)?.options?.mode, 'queue', 'external turn forces queue');

  const own = makeBridge({ busyMode: 'steer' });
  await state.bindSession('chat:oc_steer2', 'sess-own');
  await own.bridge.handleMessage(message({ chat_id: 'oc_steer2', content: JSON.stringify({ text: '第一步' }) }));
  await own.bridge.onSessionEvent({ id: 'sess-own' }, { type: 'turn/start', data: { turn: 1 } });
  await own.bridge.onSessionEvent({ id: 'sess-own' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: own.harness.prompts.at(-1).options.requestId } },
  });
  await own.bridge.handleMessage(message({ chat_id: 'oc_steer2', content: JSON.stringify({ text: '补充指令' }) }));
  assert.equal(own.harness.prompts.at(-1)?.options?.mode, 'steer', 'feishu turn may be steered');
  bridge.dispose();
  own.bridge.dispose();
}

// 13k) 提交失败时消息表情结算为「晕」，不留「在做了」
{
  const { bot, harness, bridge } = makeBridge();
  harness.prompt = async () => { throw new Error('boom'); };
  await bridge.handleMessage(message({ message_id: 'om_fail', content: JSON.stringify({ text: '你好' }) }));
  const last = bot.reactions.at(-1);
  assert.equal(last.messageId, 'om_fail');
  assert.equal(last.emoji, 'DIZZY', 'failed prompt settles as stopped');
  bridge.dispose();
}

// 13l) 排队两条飞书消息：两个 turn 各渲染一张卡片
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_fifo', 'sess-fifo');
  await bridge.handleMessage(message({ message_id: 'om_f1', chat_id: 'oc_fifo', content: JSON.stringify({ text: '第一条' }) }));
  await bridge.handleMessage(message({ message_id: 'om_f2', chat_id: 'oc_fifo', content: JSON.stringify({ text: '第二条' }) }));
  const [firstPrompt, secondPrompt] = harness.prompts;
  await bridge.onSessionEvent({ id: 'sess-fifo' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-fifo' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: firstPrompt.options.requestId } },
  });
  await bridge.onSessionEvent({ id: 'sess-fifo' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  await bridge.onSessionEvent({ id: 'sess-fifo' }, { type: 'turn/start', data: { turn: 2 } });
  await bridge.onSessionEvent({ id: 'sess-fifo' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: secondPrompt.options.requestId } },
  });
  await bridge.onSessionEvent({ id: 'sess-fifo' }, { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } });
  assert.equal(bot.cards.length, 2, 'each queued prompt renders its own card');
  bridge.dispose();
}

// 13m) 提交失败回滚标记：后续 turn 不会被误当成飞书轮次
{
  const { bot, harness, bridge } = makeBridge();
  harness.prompt = async () => { throw new Error('boom'); };
  await bridge.handleMessage(message({ message_id: 'om_rb', chat_id: 'oc_rb', content: JSON.stringify({ text: '你好' }) }));
  const sessionId = state.sessionFor('chat:oc_rb');
  await bridge.onSessionEvent({ id: sessionId }, { type: 'turn/start', data: { turn: 1 } });
  assert.ok(bot.cards.every((item) => !JSON.stringify(item.card).includes('已收到')), 'rolled-back prompt must not render a later turn');
  bridge.dispose();
}

// 13n) Web 轮次里的审批/提问留在 Web，不推送到绑定的飞书聊天
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_webturn', 'sess-web-turn');
  await bridge.onSessionEvent({ id: 'sess-web-turn' }, { type: 'turn/start', data: { turn: 1 } });
  bridge.onAssistantStream({ session: { id: 'sess-web-turn' } }, { chunk: { type: 'text-delta', text: 'Web 流式内容' } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bot.cards.length, 0, 'silent Web turn never streams to Feishu');
  let approvalsNext = 0;
  await bridge.handleApproval({
    callId: 'call-w', toolName: 'bash', signal: new AbortController().signal,
    agent: { session: { id: 'sess-web-turn', snapshotEvents: () => [{ type: 'approval/asked', data: { id: 'ap-w', callId: 'call-w' } }] } },
  }, () => { approvalsNext += 1; return Promise.resolve('next'); });
  let questionsNext = 0;
  await bridge.handleQuestion({
    agent: { session: { id: 'sess-web-turn' } },
    questions: [{ id: 'q-w', title: '测试问题', options: [{ label: 'A' }] }],
  }, () => { questionsNext += 1; return Promise.resolve('next'); });
  assert.equal(approvalsNext, 1, 'web approval falls through');
  assert.equal(questionsNext, 1, 'web question falls through');
  assert.equal(bot.cards.length, 0, 'nothing is pushed to Feishu');
  bridge.dispose();
}

// 13o) Web 轮次等待提问时，飞书 /stop 会说明刚才在等什么
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_ask', 'sess-ask');
  await bridge.onSessionEvent({ id: 'sess-ask' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.handleQuestion({
    agent: { session: { id: 'sess-ask' } },
    questions: [{ id: 'q-ask', question: '要部署到生产吗？', options: [{ label: '是' }, { label: '否' }] }],
  }, () => Promise.resolve('next'));
  await bridge.handleMessage(message({ chat_id: 'oc_ask', message_id: 'om_stop', content: JSON.stringify({ text: '/stop' }) }));
  assert.match(cardText(bot), /已请求停止当前任务/);
  assert.match(cardText(bot), /刚才在等你回答：要部署到生产吗/);
  bridge.dispose();
}

// 13p) 定时任务轮次：从 silent 切到飞书正常渲染
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_schedule', 'sess-schedule');
  await bridge.onSessionEvent({ id: 'sess-schedule' }, { type: 'turn/start', data: { turn: 1 } });
  assert.equal(bot.cards.length, 0, 'silent turn starts without a card');
  await bridge.onSessionEvent({ id: 'sess-schedule' }, {
    type: 'user/message',
    data: { role: 'user', content: [{ type: 'text', text: '普通 Web 消息' }] },
  });
  assert.equal(bot.cards.length, 0, 'ordinary web message stays silent');
  await bridge.onSessionEvent({ id: 'sess-schedule' }, {
    type: 'user/message',
    data: { source: { kind: 'schedule' }, role: 'user', content: [{ type: 'text', text: '[SCHEDULE REMINDER] 夸我' }] },
  });
  assert.equal(bot.cards.length, 1, 'schedule reminder un-silences the turn');
  assert.match(cardText(bot), /已收到/);
  await bridge.onSessionEvent({ id: 'sess-schedule' }, {
    type: 'assistant/message',
    data: { turn: 1, message: { content: [{ type: 'text', text: '你很棒' }] } },
  });
  await bridge.onSessionEvent({ id: 'sess-schedule' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.match(JSON.stringify(bot.patches.at(-1)?.card), /你很棒/);
  assert.equal(bot.patches.at(-1)?.id, bot.cards[0].id, 'same card lifecycle');
  bridge.dispose();
}

// 13q) 同一 Session 绑定两个 chat：按 prompt rpcId 发到来源 chat
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_shared_a', 'sess-shared');
  await state.bindSession('chat:oc_shared_b', 'sess-shared');
  await bridge.handleMessage(message({
    chat_id: 'oc_shared_b', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '发给 b' }),
  }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-shared' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-shared' }, {
    type: 'user/message',
    data: { source: { kind: 'plugin:im-feishu', form: 'source' } },
  });
  assert.equal(bot.cards.length, 0, 'plugin row does not classify the turn');
  await bridge.onSessionEvent({ id: 'sess-shared' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  assert.equal(bot.cards.at(-1)?.chatId, 'oc_shared_b', 'routes to the prompt chat');
  bridge.dispose();
}

// 13r) 定时任务 prompt 里明确写出的 @ 会加入校验名单
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('chat:oc_sched_at', 'sess-sched-at');
  await bridge.onSessionEvent({ id: 'sess-sched-at' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-sched-at' }, {
    type: 'user/message',
    data: {
      source: { kind: 'schedule' },
      content: [{
        type: 'text',
        text: '[SCHEDULE REMINDER] reminders_json: [{"reminder_prompt":"先输出 <at id=ou_user></at>，再夸一句"}]',
      }],
    },
  });
  await bridge.onSessionEvent({ id: 'sess-sched-at' }, {
    type: 'assistant/message',
    data: { turn: 1, message: { content: [{ type: 'text', text: '<at id=ou_user></at> 你很帅 <at id=ou_nobody></at>' }] } },
  });
  await bridge.onSessionEvent({ id: 'sess-sched-at' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const flat = JSON.stringify([...bot.cards.map((item) => item.card), ...bot.patches.map((item) => item.card)]);
  assert.match(flat, /<at id=ou_user><\/at>/, 'schedule prompt mention is kept');
  assert.ok(!flat.includes('ou_nobody'), 'unknown ids are still erased');
  bridge.dispose();
}

// 13s) Token 统计与工具调用面板可独立开关
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_stats_turn', 'sess-stats-turn');
  const runTurn = async (turn, text) => {
    await bridge.handleMessage(message({ chat_id: 'oc_stats_turn', content: JSON.stringify({ text }) }));
    const requestId = harness.prompts.at(-1).options.requestId;
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, { type: 'turn/start', data: { turn } });
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, {
      type: 'user/message',
      data: { source: { kind: 'user', rpcId: requestId } },
    });
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, {
      type: 'tool/call',
      data: { turn, step: 1, callId: 'c1', name: 'bash', arguments: JSON.stringify({ command: 'ls' }) },
    });
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, {
      type: 'tool/result',
      data: { turn, step: 1, message: { toolCallId: 'c1', isError: false, content: [{ type: 'text', text: 'ok' }] } },
    });
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, {
      type: 'assistant/message',
      data: {
        turn,
        usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, totalTokens: 110 },
        message: { content: [{ type: 'text', text: `第${turn}轮回答` }] },
      },
    });
    await bridge.onSessionEvent({ id: 'sess-stats-turn' }, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
    return JSON.stringify(bot.patches.at(-1)?.card ?? {});
  };
  const first = await runTurn(1, '第一次');
  assert.ok(!first.includes('🪙'), 'token panel is off by default');
  assert.ok(!first.includes('工具调用'), 'tool panel is off by default');
  await state.setStats('chat:oc_stats_turn', true);
  const second = await runTurn(2, '第二次');
  assert.match(second, /🪙 累计/, 'enabling token stats shows the usage panel');
  assert.ok(!second.includes('工具调用'), 'token stats do not enable the tool panel');
  await state.setTools('chat:oc_stats_turn', true);
  const third = await runTurn(3, '第三次');
  assert.match(third, /工具调用/, 'enabling tools shows the tool panel');
  assert.match(third, /🪙 累计/, 'token stats stay independently controlled');
  await state.setStats('chat:oc_stats_turn', false);
  const fourth = await runTurn(4, '第四次');
  assert.ok(!fourth.includes('🪙'), 'disabling token stats leaves the tool panel');
  assert.match(fourth, /工具调用/, 'tool panel remains on');
  bridge.dispose();
}

// 13t) 流式 chunk 不会并发 patch 同一张卡
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_flush', 'sess-flush');
  await bridge.handleMessage(message({ chat_id: 'oc_flush', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-flush' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-flush' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  assert.equal(bot.cards.length, 1, 'CardKit unavailable falls back to a raw card');
  const realPatch = bot.patchCard.bind(bot);
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  bot.patchCard = async (id, card) => {
    active += 1;
    calls += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 25));
    active -= 1;
    return realPatch(id, card);
  };
  const realNow = Date.now;
  const base = Date.now();
  Date.now = () => base + 11_000;
  try {
    for (let i = 0; i < 8; i += 1) {
      bridge.onAssistantStream({ session: { id: 'sess-flush' } }, { chunk: { type: 'text-delta', text: `片段${i}` } });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  } finally {
    Date.now = realNow;
  }
  assert.equal(maxActive, 1, 'card patches never overlap');
  assert.equal(calls, 1, 'concurrent flushes coalesce into one patch');
  bridge.dispose();
}

// 13u) 230020 限频会重试，而不是直接把卡片判死
{
  const { bot, harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_429', 'sess-429');
  await bridge.handleMessage(message({ chat_id: 'oc_429', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-429' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-429' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  const realPatch = bot.patchCard.bind(bot);
  let limited = false;
  bot.patchCard = async (id, card) => {
    if (!limited) {
      limited = true;
      const error = new Error('Request failed with status code 400');
      error.response = { data: [{ message: 'bad request' }, { code: 230020, msg: 'too frequently' }] };
      throw error;
    }
    return realPatch(id, card);
  };
  const realNow = Date.now;
  const base = Date.now();
  Date.now = () => base + 11_000;
  try {
    bridge.onAssistantStream({ session: { id: 'sess-429' } }, { chunk: { type: 'text-delta', text: '限频后重试' } });
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  } finally {
    Date.now = realNow;
  }
  assert.equal(limited, true, 'the fake rate limit was hit');
  assert.ok(bot.patches.length >= 1, 'the card was patched after retry');
  bridge.dispose();
}

// 13v) CardKit 回答卡：流式文本 + 终稿全量更新
{
  const { bot, harness, bridge } = makeBridge();
  bot.cardKit = true;
  await state.bindSession('chat:oc_cardkit', 'sess-cardkit');
  await bridge.handleMessage(message({ chat_id: 'oc_cardkit', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-cardkit' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-cardkit' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  assert.equal(bot.cardEntities.length, 1, 'answer card entity is created');
  assert.equal(bot.cardEntities[0].card.config.streaming_mode, true, 'card starts in streaming mode');
  assert.equal(bot.cardRefs.length, 1, 'card entity is sent once');
  const realNow = Date.now;
  const base = Date.now();
  Date.now = () => base + 1_000;
  try {
    bridge.onAssistantStream({ session: { id: 'sess-cardkit' } }, { type: 'start', turn: 1, attemptId: 'a1' });
    bridge.onAssistantStream({ session: { id: 'sess-cardkit' } }, { type: 'chunk', attemptId: 'a1', chunk: { type: 'text-delta', text: '流式回答' } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(bot.cardTextUpdates.length, 1, 'stream text updates the answer element');
    assert.equal(bot.cardTextUpdates[0].elementId, 'answer');
    assert.match(bot.cardTextUpdates[0].content, /流式回答/);
    assert.equal(bot.cardTextUpdates[0].sequence, 1, 'stream update uses the first sequence');
    await bridge.onSessionEvent({ id: 'sess-cardkit' }, {
      type: 'assistant/message',
      data: { turn: 1, message: { content: [{ type: 'text', text: '流式回答' }] } },
    });
    await bridge.onSessionEvent({ id: 'sess-cardkit' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  } finally {
    Date.now = realNow;
  }
  assert.equal(bot.cardUpdates.length, 1, 'final card is updated once');
  assert.equal(bot.cardUpdates[0].card.config.streaming_mode, false, 'streaming is closed');
  assert.match(JSON.stringify(bot.cardUpdates[0].card), /流式回答/);
  assert.equal(bot.cardUpdates[0].sequence, 2, 'final update follows the stream sequence');
  bridge.dispose();
}

// 13w) CardKit 流式期间独立更新工具 / Token 面板
{
  const { bot, harness, bridge } = makeBridge();
  bot.cardKit = true;
  await state.bindSession('chat:oc_cardkit_panels', 'sess-cardkit-panels');
  await state.setTools('chat:oc_cardkit_panels', true);
  await state.setStats('chat:oc_cardkit_panels', true);
  await bridge.handleMessage(message({ chat_id: 'oc_cardkit_panels', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  const initial = JSON.stringify(bot.cardEntities[0].card);
  assert.match(initial, /"element_id":"tools"/, 'streaming card has a tool panel element');
  assert.match(initial, /"element_id":"usage"/, 'streaming card has a usage panel element');
  assert.match(initial, /"expanded":true/, 'streaming panels start expanded');
  await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, {
    type: 'tool/call',
    data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: JSON.stringify({ command: 'ls' }) },
  });
  await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, {
    type: 'tool/result',
    data: { turn: 1, step: 1, message: { toolCallId: 'c1', isError: false, content: [{ type: 'text', text: 'ok' }] } },
  });
  assert.ok(
    bot.cardTextUpdates.some((item) => item.elementId === 'tools' && /bash/.test(item.content)),
    'tool panel is updated during the stream',
  );
  const realNow = Date.now;
  const base = Date.now();
  Date.now = () => base + 2_000;
  try {
    await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, {
      type: 'assistant/message',
      data: {
        turn: 1,
        usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, totalTokens: 110 },
        message: { content: [{ type: 'text', text: '面板测试' }] },
      },
    });
  } finally {
    Date.now = realNow;
  }
  assert.ok(
    bot.cardTextUpdates.some((item) => item.elementId === 'usage' && /主 Agent|累计|输入/.test(item.content)),
    'usage panel is updated during the stream',
  );
  await bridge.onSessionEvent({ id: 'sess-cardkit-panels' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const final = JSON.stringify(bot.cardUpdates.at(-1)?.card ?? {});
  assert.match(final, /工具调用|bash/, 'final card still carries the tool panel');
  assert.match(final, /Token|累计|主 Agent/, 'final card still carries the usage panel');
  assert.match(final, /"expanded":true/, 'final CardKit card keeps the panels expanded');
  bridge.dispose();
}

// 13x) CardKit 创建瞬时失败会先重试，而不是直接退化
{
  const { bot, harness, bridge } = makeBridge();
  bot.cardKit = true;
  const realCreate = bot.createCard.bind(bot);
  let attempts = 0;
  bot.createCard = async (card) => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('socket hang up');
      error.code = 'ECONNRESET';
      throw error;
    }
    return realCreate(card);
  };
  await state.bindSession('chat:oc_cardkit_retry', 'sess-cardkit-retry');
  await bridge.handleMessage(message({ chat_id: 'oc_cardkit_retry', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-cardkit-retry' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-cardkit-retry' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  assert.equal(attempts, 2, 'transient create failure is retried');
  assert.equal(bot.cardEntities.length, 1, 'second create succeeds');
  assert.equal(bot.cardRefs.length, 1, 'card is sent after retry');
  assert.equal(bot.cards.length, 0, 'no raw fallback after a successful retry');
  bridge.dispose();
}

// 13z) CardKit 发送瞬时失败会复用同一个 uuid 重试
{
  const { bot, harness, bridge } = makeBridge();
  bot.cardKit = true;
  const realSend = bot.sendCardRef.bind(bot);
  let attempts = 0;
  const uuids = [];
  bot.sendCardRef = async (chatId, cardId, uuid) => {
    attempts += 1;
    uuids.push(uuid);
    if (attempts === 1) {
      const error = new Error('socket hang up');
      error.code = 'ECONNRESET';
      throw error;
    }
    return realSend(chatId, cardId, uuid);
  };
  await state.bindSession('chat:oc_cardkit_send_retry', 'sess-cardkit-send');
  await bridge.handleMessage(message({ chat_id: 'oc_cardkit_send_retry', content: JSON.stringify({ text: '开始' }) }));
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: 'sess-cardkit-send' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess-cardkit-send' }, {
    type: 'user/message',
    data: { source: { kind: 'user', rpcId: requestId } },
  });
  assert.equal(attempts, 2, 'transient send failure is retried');
  assert.equal(bot.cardRefs.length, 1, 'card is sent once');
  assert.equal(uuids[0], uuids[1], 'retries reuse the same idempotency uuid');
  assert.equal(bot.cards.length, 0, 'no raw fallback after a successful retry');
  bridge.dispose();
}

// 14) 群聊：回复机器人消息即视为被叫到
{
  const { harness, bridge } = makeBridge();
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', parent_id: 'om_bot_msg',
    mentions: [], content: JSON.stringify({ text: '这个再展开说说' }),
  }));
  assert.equal(harness.prompts.length, 1, 'reply to the bot counts as addressed');
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group', parent_id: 'om_user_msg',
    mentions: [], content: JSON.stringify({ text: '无关消息' }),
  }));
  assert.equal(harness.prompts.length, 1, 'reply to someone else stays ignored');
  bridge.dispose();
}

// 14c) 群聊注入群名称（conversationTitle）
{
  const { harness, bridge } = makeBridge({
    contextEnhancement: {
      group: { enabled: true, fields: ['senderId', 'conversationTitle'], guidance: '' },
      direct: { enabled: true, fields: [], guidance: '' },
    },
  });
  await bridge.handleMessage(message({
    chat_id: 'oc_group', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }], content: JSON.stringify({ text: '在吗' }),
  }));
  const source = harness.prompts.at(-1).content[0].text;
  assert.match(source, /研发群/, 'group name is injected');
  bridge.dispose();
}

// 14b) 只给自己创建的会话注入常驻指令，接管别人会话时不污染
{
  const settings = {
    contextEnhancement: {
      group: { enabled: true, fields: [], guidance: '' },
      direct: { enabled: true, fields: ['senderId'], guidance: '你是我的秘书' },
    },
  };
  const own = makeBridge(settings);
  await own.bridge.handleMessage(message({ chat_id: 'oc_own' }));
  assert.match(own.contextBySession.get('sess-1') ?? '', /你是我的秘书/, 'own session gets guidance');

  const adopted = makeBridge(settings);
  await state.bindSession('chat:oc_adopt', 'sess-existing');
  await adopted.bridge.handleMessage(message({ chat_id: 'oc_adopt' }));
  assert.equal(adopted.contextBySession.get('sess-existing') ?? '', '', 'adopted session must stay clean');
  own.bridge.dispose();
  adopted.bridge.dispose();
}

// 15) 上下文增强（私聊维度）：source 作为前置 part，guidance 走 session 上下文
{
  const { harness, bridge, contextBySession } = makeBridge({
    contextEnhancement: {
      group: { enabled: false, fields: ['senderId'], guidance: '' },
      direct: { enabled: true, fields: ['senderId', 'senderName', 'botId', 'sentAt'], guidance: '回答简短' },
    },
  });
  await bridge.handleMessage(message({ chat_id: 'oc_ctx', create_time: '1760700000000', content: JSON.stringify({ text: '在吗' }) }));
  const content = harness.prompts.at(-1).content;
  assert.equal(content.length, 2, 'source block + user text');
  assert.match(content[0].text, /^<feishu_bot_source>/);
  const source = JSON.parse(content[0].text.match(/<feishu_bot_source>(.*?)<\/feishu_bot_source>/s)[1]);

  assert.equal(source.senderId, 'ou_user');
  assert.match(source.sentAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(content[1].text, '在吗', 'user text stays its own part');
  const guidance = contextBySession.get('sess-1') ?? '';
  assert.match(guidance, /<feishu_bot_source_guidance>/);
  assert.match(guidance, /回答简短/);
  bridge.dispose();
}

// 16) 上下文增强按维度隔离：群聊维度没有选字段时不注入
{
  const { harness, bridge, contextBySession } = makeBridge({
    contextEnhancement: {
      group: { enabled: true, fields: [], guidance: '' },
      direct: { enabled: true, fields: ['senderId'], guidance: '' },
    },
  });
  await bridge.handleMessage(message({ chat_id: 'oc_g', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }] }));
  const content = harness.prompts.at(-1).content;
  assert.equal(content.length, 1);
  assert.equal(content[0].text, '你好');
  const context = contextBySession.get('sess-1') ?? '';
  assert.ok(!context.includes('<feishu_bot_source_guidance>'), 'group scope is off, so no guidance is injected');
  assert.match(context, /一律 @ 到该当事人/, 'mention guidance is still present');
  assert.match(context, /纯信息同步/, 'guidance excludes pure sync/chat mentions');
  assert.match(context, /不确定具体当事人时不要 @/, 'guidance skips uncertain targets');
  bridge.dispose();
}

// 17) 话题会话的审批卡发往群 chat id，而不是 topic 绑定键
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('topic:oc_topic:1', 'sess-topic-approve');
  const request = {
    callId: 'call-t', toolName: 'bash', signal: new AbortController().signal,
    agent: { session: { id: 'sess-topic-approve', snapshotEvents: () => [{ type: 'approval/asked', data: { id: 'ap-t', callId: 'call-t' } }] } },
  };
  const pending = bridge.handleApproval(request, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(bot.cards.length, 1, 'topic approval card is sent');
  assert.equal(bot.cards[0].chatId, 'oc_topic', 'card goes to the chat, not "topic:oc_topic:1"');
  const toast = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'approve:ap-t' } },
    context: { open_message_id: bot.cards[0].id, open_chat_id: 'oc_topic' },
  });
  assert.equal(toast.toast.type, 'success');
  assert.equal(await pending, 'allowed-once');
  bridge.dispose();
}

// 18) 群聊空 @：无会话回提示；已有会话交给模型
{
  const { bot, harness, bridge } = makeBridge();
  await bridge.handleMessage(message({
    chat_id: 'oc_empty', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '' }),
  }));
  assert.equal(harness.created, 0, 'no session is created for an empty mention');
  assert.equal(harness.prompts.length, 0, 'no prompt is submitted without a session');
  assert.match(cardText(bot), /在的/);
  assert.match(cardText(bot), /\/menu/);
  const cardsAfterHint = bot.cards.length;

  await state.bindSession('chat:oc_empty', 'sess-empty');
  await bridge.handleMessage(message({
    chat_id: 'oc_empty', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '' }),
  }));
  assert.equal(harness.created, 0, 'the existing session is reused');
  assert.equal(harness.prompts.length, 1, 'the bare mention is handed to the model');
  assert.ok(harness.prompts.at(-1).content.some((part) => part.type === 'text' && part.text === '有事找你'));
  assert.equal(bot.cards.length, cardsAfterHint, 'no extra hint card when a session exists');
  bridge.dispose();
}

// 19) 群聊审批只允许管理白名单成员操作
{
  const { bot, bridge } = makeBridge();
  // Bind an explicit Session id: every FakeHarness numbers its Sessions from 1,
  // so a created session would collide with bindings left by earlier scenarios.
  await state.bindSession('chat:oc_group_approve', 'sess-group-approve');
  await bridge.handleMessage(message({
    chat_id: 'oc_group_approve', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }], content: JSON.stringify({ text: '跑个命令' }),
  }));
  const sessionId = 'sess-group-approve';
  const request = {
    callId: 'call-g', toolName: 'bash', signal: new AbortController().signal,
    agent: { session: { id: sessionId, snapshotEvents: () => [{ type: 'approval/asked', data: { id: 'ap-g', callId: 'call-g' } }] } },
  };
  const pending = bridge.handleApproval(request, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const denied = await bridge.onCardAction({
    operator: { open_id: 'ou_other' },
    action: { value: { action: 'approve:ap-g' } },
    context: { open_message_id: bot.cards.at(-1).id, open_chat_id: 'oc_group_approve' },
  });
  assert.equal(denied.toast.type, 'warning', 'non-manager cannot approve in a group');
  const allowed = await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'approve:ap-g' } },
    context: { open_message_id: bot.cards.at(-1).id, open_chat_id: 'oc_group_approve' },
  });
  assert.equal(allowed.toast.type, 'success');
  assert.equal(await pending, 'allowed-once', 'the manager can still approve');
  bridge.dispose();
}

// 20) 话题同步摘要全部随消息注入（全部保留，不按话题去重）
{
  const { harness, bridge } = makeBridge();
  await state.bindSession('chat:oc_sync_latest', 'sess-sync-latest');
  await state.addSynced('oc_sync_latest', { topicId: 1, title: '旧标题', summary: '旧结论', at: new Date().toISOString() });
  await state.addSynced('oc_sync_latest', { topicId: 1, title: '新标题', summary: '新结论', at: new Date().toISOString() });
  await state.addSynced('oc_sync_latest', { topicId: 2, title: '第二个', summary: '二结论', at: new Date().toISOString() });
  await bridge.handleMessage(message({ chat_id: 'oc_sync_latest', content: JSON.stringify({ text: '继续' }) }));
  const syncPart = harness.prompts.at(-1).content.find((part) => String(part.text).includes('<feishu_bot_topic_sync>'));
  assert.ok(syncPart, 'sync block still rides the prompt');
  assert.match(syncPart.text, /旧结论/, 'every synced summary is kept');
  assert.match(syncPart.text, /新结论/);
  assert.match(syncPart.text, /二结论/);
  bridge.dispose();
}

// 21) 话题会话的提问卡同样发到群 chat id
{
  const { bot, bridge } = makeBridge();
  await state.bindSession('topic:oc_topic_q:1', 'sess-topic-question');
  const pending = bridge.handleQuestion({
    agent: { session: { id: 'sess-topic-question' } },
    questions: [{ id: 'q-t', question: '选哪个？', options: [{ label: 'A' }] }],
  }, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(bot.cards[0].chatId, 'oc_topic_q', 'question card goes to the chat');
  await bridge.onCardAction({
    operator: { open_id: 'ou_user' },
    action: { value: { action: 'answer:q-t:0' } },
    context: { open_message_id: bot.cards[0].id, open_chat_id: 'oc_topic_q' },
  });
  assert.deepEqual(await pending, { answers: [{ id: 'q-t', selected: ['A'] }] });
  bridge.dispose();
}

// 22) 私聊不支持话题（没有线程语义，无法继续）
{
  const { bot, harness, bridge } = makeBridge();
  await bridge.handleMessage(message({ chat_id: 'oc_dm_topic', content: JSON.stringify({ text: '/topic 私聊话题' }) }));
  assert.equal(harness.created, 0, 'no topic session in a private chat');
  assert.match(cardText(bot), /私聊不支持话题/);
  bridge.dispose();
}

// 23) 旁听：未 @ 消息进入缓冲，下次 @ 时注入一次
{
  const { bot, harness, bridge } = makeBridge({ eavesdrop: { enabled: true, limit: 0 } });
  await bridge.handleMessage(message({
    chat_id: 'oc_listen', chat_type: 'group', mentions: [],
    content: JSON.stringify({ text: '今晚发版吗' }),
  }));
  assert.equal(harness.prompts.length, 0, 'eavesdropped messages do not start a turn');
  assert.equal(bot.cards.length, 0, 'no card for eavesdropped messages');
  await bridge.handleMessage(message({
    chat_id: 'oc_listen', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '你们在聊什么' }),
  }));
  const block = harness.prompts.at(-1).content.find((part) => String(part.text).includes('<feishu_bot_eavesdrop>'));
  assert.ok(block, 'the buffer rides the next mention');
  assert.match(block.text, /今晚发版吗/);
  assert.match(block.text, /测试用户\(ou_user\)：今晚发版吗/, 'the record carries both name and open_id');
  await bridge.handleMessage(message({
    chat_id: 'oc_listen', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '继续' }),
  }));
  assert.ok(
    !harness.prompts.at(-1).content.some((part) => String(part.text).includes('今晚发版吗')),
    'already injected context is not repeated',
  );
  bridge.dispose();
}

// 24) 旁听条数：limit=N 只保留最新 N 条
{
  const { harness, bridge } = makeBridge({ eavesdrop: { enabled: true, limit: 2 } });
  for (const text of ['m1', 'm2', 'm3']) {
    await bridge.handleMessage(message({
      chat_id: 'oc_listen_limit', chat_type: 'group', mentions: [],
      content: JSON.stringify({ text }),
    }));
  }
  await bridge.handleMessage(message({
    chat_id: 'oc_listen_limit', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '总结' }),
  }));
  const block = harness.prompts.at(-1).content.find((part) => String(part.text).includes('<feishu_bot_eavesdrop>'));
  assert.ok(block);
  assert.ok(!block.text.includes('m1'), 'the oldest message was rolled off');
  assert.match(block.text, /m2/);
  assert.match(block.text, /m3/);
  bridge.dispose();
}

// 25) 旁听按话题隔离：话题缓冲不会进主会话，主会话缓冲也不会进话题
{
  const { harness, bridge } = makeBridge({ eavesdrop: { enabled: true, limit: 0 } });
  const topic = await state.createTopic({
    chatId: 'oc_topic_listen', title: '旁听话题', brief: '', sessionId: 'sess-topic-listen', rootMessageId: 'om_topic_listen_root',
  });
  await state.bindSession(`topic:oc_topic_listen:${topic.topicId}`, 'sess-topic-listen');
  await bridge.handleMessage(message({
    chat_id: 'oc_topic_listen', chat_type: 'group', parent_id: 'om_topic_listen_root', mentions: [],
    content: JSON.stringify({ text: '话题里的闲聊' }),
  }));
  assert.equal(harness.prompts.length, 0);
  await bridge.handleMessage(message({
    chat_id: 'oc_topic_listen', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '主会话' }),
  }));
  assert.ok(!JSON.stringify(harness.prompts.at(-1).content).includes('话题里的闲聊'), 'main chat has its own buffer');
  await bridge.handleMessage(message({
    chat_id: 'oc_topic_listen', chat_type: 'group', parent_id: 'om_topic_listen_root', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '话题里问' }),
  }));
  const block = harness.prompts.at(-1).content.find((part) => String(part.text).includes('话题里的闲聊'));
  assert.ok(block, 'topic buffer is scoped to the topic');
  bridge.dispose();
}

// 26) 旁听图片：默认只记占位符，不下载
{
  const { harness, bridge } = makeBridge({ eavesdrop: { enabled: true, limit: 0 } });
  await bridge.handleMessage(message({
    chat_id: 'oc_listen_image', chat_type: 'group', mentions: [], message_type: 'image',
    content: JSON.stringify({ image_key: 'ik_listen' }),
  }));
  await bridge.handleMessage(message({
    chat_id: 'oc_listen_image', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '图里是什么' }),
  }));
  const content = harness.prompts.at(-1).content;
  const block = content.find((part) => String(part.text).includes('<feishu_bot_eavesdrop>'));
  assert.match(block.text, /\[图片\]/);
  assert.ok(!content.some((part) => part.type === 'image'), 'media is not downloaded in placeholder mode');
  bridge.dispose();
}

// 27) 白名单拒绝的旁听消息不记录，也不在群里刷无权限提示
{
  const { bot, harness, bridge } = makeBridge({
    eavesdrop: { enabled: true, limit: 0 },
    access: { group: 'allowlist', allowOpenIds: ['ou_allowed'], managers: ['ou_user'] },
  });
  const denied = message({
    chat_id: 'oc_listen_deny', chat_type: 'group', mentions: [],
    content: JSON.stringify({ text: '被拒绝的闲聊' }),
  });
  denied.sender = { sender_type: 'user', sender_id: { open_id: 'ou_other' } };
  await bridge.handleMessage(denied);
  assert.equal(bot.cards.length, 0, 'no notice for an un-addressed message');
  const allowed = message({
    chat_id: 'oc_listen_deny', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '在吗' }),
  });
  allowed.sender = { sender_type: 'user', sender_id: { open_id: 'ou_allowed' } };
  await bridge.handleMessage(allowed);
  assert.ok(!JSON.stringify(harness.prompts.at(-1).content).includes('被拒绝的闲聊'), 'denied messages are not buffered');
  bridge.dispose();
}

// 28) @ 人：名单内保留，未知 id 与 @all 擦除；当前消息提到的人也会注入 open_id
{
  const { bot, harness, bridge } = makeBridge({ mentions: { enabled: true, allowAll: false } });
  // Bind an explicit id: FakeHarness numbers Sessions from 1 in every test.
  await state.bindSession('chat:oc_mention', 'sess-mention');
  await bridge.handleMessage(message({
    chat_id: 'oc_mention', chat_type: 'group',
    mentions: [{ id: { open_id: 'ou_bot' } }, { id: { open_id: 'ou_zhang' }, name: '张三' }],
    content: JSON.stringify({ text: '请通知一下' }),
  }));
  const prompt = JSON.stringify(harness.prompts.at(-1).content);
  assert.match(prompt, /<feishu_bot_people>/, 'mentioned people are injected');
  assert.match(prompt, /张三\(ou_zhang\)/, 'the mentioned person carries name and open_id');
  const sessionId = 'sess-mention';
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: sessionId }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: sessionId }, { type: 'user/message', data: { source: { kind: 'user', rpcId: requestId } } });
  await bridge.onSessionEvent({ id: sessionId }, {
    type: 'assistant/message',
    data: {
      turn: 1,
      message: { content: [{ type: 'text', text: '请 <at id=ou_user></at> 确认，<at id=ou_zhang></at> 也看下，<at id=ou_nobody></at> 不用，<at id=all></at> 不算。' }] },
    },
  });
  await bridge.onSessionEvent({ id: sessionId }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const flat = JSON.stringify([...bot.cards.map((item) => item.card), ...bot.patches.map((item) => item.card)]);
  assert.match(flat, /<at id=ou_user><\/at>/, 'current sender is mentionable');
  assert.match(flat, /<at id=ou_zhang><\/at>/, 'mentioned person is mentionable');
  assert.ok(!flat.includes('ou_nobody'), 'unknown ids are erased');
  assert.ok(!flat.includes('id=all'), '@all is erased by default');
  bridge.dispose();
}

// 29) 关闭 @ 能力：所有 at 标签擦除
{
  const { bot, harness, bridge } = makeBridge({ mentions: { enabled: false } });
  await state.bindSession('chat:oc_mention_off', 'sess-mention-off');
  await bridge.handleMessage(message({
    chat_id: 'oc_mention_off', chat_type: 'group', mentions: [{ id: { open_id: 'ou_bot' } }],
    content: JSON.stringify({ text: '请通知一下' }),
  }));
  const sessionId = 'sess-mention-off';
  const requestId = harness.prompts.at(-1).options.requestId;
  await bridge.onSessionEvent({ id: sessionId }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: sessionId }, { type: 'user/message', data: { source: { kind: 'user', rpcId: requestId } } });
  await bridge.onSessionEvent({ id: sessionId }, {
    type: 'assistant/message',
    data: { turn: 1, message: { content: [{ type: 'text', text: '请 <at id=ou_user></at> 确认。' }] } },
  });
  await bridge.onSessionEvent({ id: sessionId }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  const flat = JSON.stringify([...bot.cards.map((item) => item.card), ...bot.patches.map((item) => item.card)]);
  assert.ok(!flat.includes('<at'), 'mentions are erased when the feature is off');
  assert.ok(!flat.includes('ou_user'), 'the erased tag leaves no id behind');
  bridge.dispose();
}

await rm(dir, { recursive: true, force: true });
console.log('bridge: 63 scenarios passed');
