import test from 'node:test';
import assert from 'node:assert/strict';
import { workerViewFixture } from './helpers/worker-view.mjs';
import { clientRenderer, findNodes, textOf } from './helpers/client-renderer.mjs';

const bot = { id: 'b1', botName: 'Bot', alias: '小金刚', state: 'connected', boundChats: 1, appId: 'cli_xxxxxxxxxxxxxxxx' };
const secondBot = { ...bot, id: 'b2', alias: '第二机器人', botName: 'Second', state: 'idle' };
const readMethods = new Set(['management.snapshot', 'chat.sessions.list', 'user.status', 'user.monitor.status', 'user.monitor.worker.options', 'models.list', 'presets.list', 'workspaces.list', 'permission.list']);
const chat = { botId: 'b1', chatId: 'oc_demo_chat', title: '产品讨论', chatType: 'group', sessionId: 'session-demo', bindingState: 'available',
  session: { title: '产品任务', running: false }, activity: { queuedMessages: 0 }, nextSession: { overrides: [] } };
function fixture({ monitorChats } = {}) {
  const calls = [], navigation = [];
  const worker = workerViewFixture();
  const bots = [structuredClone(bot), structuredClone(secondBot)];
  const chats = [structuredClone(chat), { ...structuredClone(chat), botId: 'b2', title: '第二机器人会话', sessionId: 'session-second' }];
  const sessions = [
    { sessionId: 'session-existing', title: '已有项目任务', cwd: '/work/project', running: false, model: { provider: 'test', model: 'current' } },
    { sessionId: 'session-elsewhere', title: '其他工作区任务', cwd: '/work/elsewhere', running: false },
    { sessionId: 'worker-demo', title: '分身任务', unavailableReason: '分身 Worker 会话不能绑定为机器人会话' },
  ];
  const identity = { config: { app: { botId: 'b1' } }, connect: { phase: 'idle' },
    authorization: { authorized: true, user: { name: '测试用户', openId: 'ou_test_user' }, accessTokenExpiresAt: 9999999990000, refreshTokenExpiresAt: 9999999999999 } };
  const monitor = { enabled: true, directEnabled: false, authorization: { authorized: true }, handoffKeywords: ['转人工'], replyRules: 'saved rule', defaultReplyRules: 'default rule', worker: {},
    chats: [{ chatId: 'oc_demo_chat', name: '产品讨论', chatMode: 'group', mode: 'mention', sessionId: 'worker-demo', pendingBatch: 1, lastDispatchAt: 100 }] };
  if (monitorChats) monitor.chats = monitorChats;
  let failSave = false;
  let failAuthorization = null;
  const connection = { rpc: { async call(_channel, _endpoint, { method, payload }) {
    calls.push({ method, payload });
    if (method === failAuthorization) return { ok: false, error: { message: 'authorization unavailable' } };
    let value;
    if (method === 'management.snapshot') {
      value = { bots, chats, warnings: [] };
      if (payload.botId) value = { ...value, bots: bots.filter((item) => item.id === payload.botId),
        chats: value.chats.filter((item) => item.botId === payload.botId).map((item) => ({ ...item, title: `${item.title}（已刷新）` })) };
    } else if (method === 'chat.sessions.list') {
      value = { sessions, currentSessionId: chats.find((item) => item.botId === payload.botId && item.chatId === payload.chatId)?.sessionId ?? null };
    } else if (method === 'chat.bind') {
      const bound = chats.find((item) => item.botId === payload.botId && item.chatId === payload.chatId);
      if ((bound.sessionId ?? null) !== payload.expectedSessionId) return { ok: false, error: { message: 'binding changed' } };
      const target = sessions.find((item) => item.sessionId === payload.sessionId);
      assert.ok(target && !target.unavailableReason);
      const previousSessionId = bound.sessionId ?? null;
      Object.assign(bound, { sessionId: target.sessionId, session: target, bindingState: 'available', conflict: false });
      if (!previousSessionId) bots.find((item) => item.id === payload.botId).boundChats += 1;
      value = { botId: payload.botId, chatId: payload.chatId, sessionId: payload.sessionId, previousSessionId, session: target };
    } else if (method === 'chat.unbind') {
      const bound = chats.find((item) => item.botId === payload.botId && item.chatId === payload.chatId);
      if (bound.sessionId && bound.sessionId !== payload.sessionId) return { ok: false, error: { message: 'binding changed' } };
      const previousSessionId = bound.sessionId;
      Object.assign(bound, { sessionId: null, session: null, bindingState: 'unbound', conflict: false, activity: null });
      if (previousSessionId) bots.find((item) => item.id === payload.botId).boundChats -= 1;
      value = { botId: payload.botId, chatId: payload.chatId, previousSessionId, unbound: Boolean(previousSessionId) };
    } else if (method === 'bot.reconnect') {
      bots.find((item) => item.id === payload.botId).state = 'connected';
      value = { bots };
    }
    else if (method === 'bot.remove') {
      bots.splice(bots.findIndex((item) => item.id === payload.botId), 1);
      value = { bots };
    }
    else if (method === 'bot.process-detail.set') value = { ...(payload.botId === 'b2' ? secondBot : bot), processDetail: payload.processDetail };
    else if (method === 'bot.context-enhancement.set') {
      if (failSave) return { ok: false, error: { message: 'save unavailable' } };
      value = bots.find((item) => item.id === payload.botId);
      value.contextEnhancement = payload.config;
    }
    else if (method === 'bot.busy-mode.set') {
      value = bots.find((item) => item.id === payload.botId);
      value.busyMode = { direct: 'queue', group: 'queue', ...value.busyMode, [payload.scope]: payload.mode };
    }
    else if (method === 'bot.check') value = { connected: true };
    else if (method === 'provision.begin') value = { state: 'pending', expiresAt: Date.now() + 600_000 };
    else if (method === 'provision.poll') value = { phase: 'idle' };
    else if (method === 'bots.list') value = { bots: [bot] };
    else if (method === 'user.monitor.status' || method === 'user.monitor.poll') value = monitor;
    else if (method === 'user.monitor.direct.enable') {
      monitor.directEnabled = payload.enabled;
      value = monitor;
    }
    else if (method === 'user.monitor.remove') {
      monitor.chats = monitor.chats.filter((item) => item.chatId !== payload.chatId);
      value = monitor;
    }
    else if (method === 'user.monitor.chat.set') {
      if (failSave && payload.keywords) return { ok: false, error: { message: 'save unavailable' } };
      Object.assign(monitor.chats.find((item) => item.chatId === payload.chatId), payload);
      value = monitor;
    }
    else if (method === 'user.monitor.chats') value = { chats: [
      { chatId: 'oc_new', name: '新增群聊', chatMode: 'group' },
      { chatId: 'oc_untracked', name: '未监听私聊', chatMode: 'p2p' },
    ] };
    else if (method === 'user.monitor.add') {
      monitor.chats.push({ chatId: payload.chatId, name: payload.name, chatMode: payload.chatMode });
      value = monitor;
    }
    else if (method === 'user.status') value = identity;
    else if (method === 'user.connect.begin') {
      if (identity.config.app.botId !== payload.botId) identity.authorization = { authorized: false };
      identity.config.app.botId = payload.botId;
      identity.connect = { phase: 'pending', qrCodeDataUrl: 'data:image/png;base64,mock', expiresAt: 9999999999999 };
      value = { url: 'https://example.invalid/authorize', qrCodeDataUrl: identity.connect.qrCodeDataUrl };
    }
    else if (method === 'user.connect.cancel') { identity.connect = { phase: 'idle' }; value = identity; }
    else if (method === 'user.refresh') { identity.authorization.accessTokenExpiresAt += 1000; value = identity; }
    else if (method === 'user.disconnect') { identity.authorization = { authorized: false }; identity.connect = { phase: 'idle' }; value = identity; }
    else if (method === 'user.monitor.worker.options') value = { workspaces: [{ id: 'workspace-default', title: '默认分组' }, { id: 'workspace-other', title: '另一个分组' }], presets: [{ id: 'custom', name: '自定义预设' }], defaultWorkspaceId: 'workspace-default' };
    else if (method === 'user.monitor.worker.set') { Object.assign(monitor.worker, payload); value = monitor; }
    else if (method === 'user.monitor.handoff.set') { monitor.handoffKeywords = payload.keywords; value = monitor; }
    else if (method === 'user.monitor.detail') value = { messages: [{ messageId: 'om_pending', category: 'pending', text: '<script>literal</script>' }], pendingCards: [], workers: [{ sessionId: 'worker-demo', current: true }, { sessionId: 'worker-old', current: false }] };
    else if (method === 'user.monitor.reply-rules.set') {
      if (failSave) return { ok: false, error: { message: 'save unavailable' } };
      monitor.replyRules = payload.rules; value = monitor;
    } else if (method === 'models.list') value = { groups: [] };
    else if (method === 'presets.list') value = { presets: [] };
    else if (method === 'workspaces.list') value = { workspaces: [] };
    else if (method === 'permission.list') value = { options: [] };
    else throw new Error(`Unexpected RPC: ${method}`);
    return { ok: true, value: structuredClone(value) };
  } } };
  return { connection, calls, navigation, monitor, bots, chats, sessions, identity, ...worker,
    setFailSave(value) { failSave = value; }, setFailAuthorization(method) { failAuthorization = method; } };
}
const button = (renderer, label) => {
  const node = findNodes(renderer.tree, (item) => item.type === 'button' && textOf(item) === label)[0];
  assert.ok(node, `button ${label}`); return node;
};
async function click(renderer, label) { await button(renderer, label).props.onClick(); await renderer.settle(); }

test('main panel mounts read-only, opens native Sessions, and queries batch bodies only on demand', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession: (id) => f.navigation.push(id) });
  await renderer.settle();
  const mainTabs = findNodes(renderer.tree, (node) => node.props.role === 'tablist' && node.props.className === 'bxf-work-tabs')[0];
  assert.deepEqual(findNodes(mainTabs, (node) => node.props.role === 'tab').map(textOf), ['状态', '会话', '分身']);
  assert.equal(findNodes(renderer.tree, (node) => node.props.role === 'tab' && node.props['aria-selected'])[0].props.id, 'bxf-tab-status');
  await click(renderer, '会话');
  assert.ok(!findNodes(renderer.tree, (node) => node.props['aria-label'] === '刷新会话与状态').length, 'status actions do not occupy the conversation header');
  assert.match(textOf(renderer.tree), /产品讨论/);
  assert.ok(f.calls.every((call) => readMethods.has(call.method)));
  await click(renderer, '打开 DSH 会话');
  assert.deepEqual(f.navigation, ['session-demo']);
  await click(renderer, '分身');
  assert.ok(!f.calls.some((call) => ['user.monitor.poll', 'user.monitor.flush', 'user.monitor.detail'].includes(call.method)));
  await click(renderer, '查看消息');
  assert.equal(f.calls.find((call) => call.method === 'user.monitor.detail').payload.chatId, 'oc_demo_chat');
  assert.match(textOf(renderer.tree), /<script>literal<\/script>/);
  assert.equal(findNodes(renderer.tree, (node) => node.type === 'script').length, 0);
  await clickIcon(renderer, '收起面板');
  assert.deepEqual(f.navigation, ['session-demo'], 'viewing the Worker stays in the plugin panel');
  assert.equal(f.retained.at(-1).sessionId, 'worker-demo');
  await click(renderer, '独立打开');
  assert.deepEqual(f.navigation, ['session-demo', 'worker-demo']);
});

test('status reply drafts survive tab changes; failed saves block navigation and remain retryable', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession: (id) => f.navigation.push(id) });
  await renderer.settle();
  const rules = () => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === '分身回复规则')[0];
  rules().props.onChange({ target: { value: 'new draft' } });
  await renderer.settle(); await click(renderer, '会话'); await click(renderer, '状态');
  assert.equal(rules().props.value, 'new draft');
  f.setFailSave(true);
  await click(renderer, '分身'); await click(renderer, '独立打开');
  assert.deepEqual(f.navigation, []);
  assert.match(textOf(renderer.tree), /save unavailable/);
  assert.equal(rules().props.value, 'new draft');
  f.setFailSave(false); await click(renderer, '重试');
  await click(renderer, '分身'); await click(renderer, '独立打开');
  assert.deepEqual(f.navigation, ['worker-demo']);
  assert.equal(f.monitor.replyRules, 'new draft');
});

async function selectBot(renderer, name) {
  const node = findNodes(renderer.tree, (item) => item.type === 'button' && item.props['aria-label'] === name)[0];
  assert.ok(node, `robot ${name}`);
  await node.props.onClick(); await renderer.settle();
}

test('robot navigation isolates chats, avatar ownership and scoped requests', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession: (id) => f.navigation.push(id) });
  await renderer.settle();
  assert.match(textOf(renderer.tree), /飞书机器人IM/);
  assert.doesNotMatch(textOf(renderer.tree), /第二机器人会话/);
  await selectBot(renderer, '第二机器人');
  assert.match(textOf(renderer.tree), /当前分身归属/);
  await click(renderer, '会话');
  assert.match(textOf(renderer.tree), /第二机器人会话/);
  assert.doesNotMatch(textOf(renderer.tree), /产品讨论/);
  await click(renderer, '打开 DSH 会话');
  assert.deepEqual(f.navigation, ['session-second']);
  await click(renderer, '分身');
  assert.match(textOf(renderer.tree), /此机器人尚未连接分身/);
  assert.doesNotMatch(textOf(renderer.tree), /测试用户|自动回复设置/);
  assert.ok(!f.calls.some((call) => call.method.startsWith('user.monitor.') && call.payload.botId !== 'b1'));
  await click(renderer, '前往状态页连接');
  assert.ok(button(renderer, '连接分身'));
  assert.match(textOf(renderer.tree), /当前仅支持一份分身授权/);
  assert.ok(!f.calls.some((call) => call.method === 'user.connect.begin'));
  await selectBot(renderer, '小金刚');
  assert.match(textOf(renderer.tree), /测试用户/);
  await click(renderer, '分身');
  assert.doesNotMatch(textOf(renderer.tree), /测试用户|管理授权/);
  await click(renderer, '查看消息');
  for (const call of f.calls.filter((item) => item.method.startsWith('user.monitor.'))) assert.equal(call.payload.botId, 'b1');
  await clickIcon(renderer, '收起面板');
  await click(renderer, '状态');
  assert.ok(button(renderer, '重新授权'));
  assert.ok(button(renderer, '刷新凭证'));
  assert.match(textOf(renderer.tree), /授权到期/);
});

test('failed autosave blocks changing robots without losing the draft', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const rules = () => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === '分身回复规则')[0];
  rules().props.onChange({ target: { value: 'keep this draft' } });
  await renderer.settle(); f.setFailSave(true);
  await selectBot(renderer, '第二机器人');
  assert.equal(rules().props.value, 'keep this draft');
  assert.match(textOf(renderer.tree), /save unavailable/);
  assert.equal(findNodes(renderer.tree, (node) => node.props['aria-current'] === 'page')[0].props['aria-label'], '小金刚');
  f.setFailSave(false);
  await click(renderer, '重试');
  await selectBot(renderer, '第二机器人');
  await click(renderer, '会话');
  assert.match(textOf(renderer.tree), /第二机器人会话/);
  assert.ok(f.calls.some((call) => call.method === 'user.monitor.reply-rules.set' && call.payload.botId === 'b1' && call.payload.rules === 'keep this draft'));
});

test('connected robots expose inline configuration; offline robots only expose status actions', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await selectBot(renderer, '第二机器人');
  assert.doesNotMatch(textOf(renderer.tree), /默认工作区|会话默认设置|机器人设置/);
  assert.ok(!f.calls.some((call) => call.method === 'presets.list' && call.payload.botId === 'b2'));
  await click(renderer, '连接诊断');
  assert.equal(f.calls.find((call) => call.method === 'bot.check').payload.botId, 'b2');
  await click(renderer, '重连');
  assert.match(textOf(renderer.tree), /默认工作区/);
  assert.ok(f.calls.some((call) => call.method === 'presets.list' && call.payload.botId === 'b2'));
  const detail = findNodes(renderer.tree, (node) => node.type === 'select' && node.props.value === 'detailed')[0];
  detail.props.onChange({ target: { value: 'brief' } }); await renderer.settle();
  await selectBot(renderer, '小金刚');
  assert.equal(f.calls.find((call) => call.method === 'bot.process-detail.set').payload.botId, 'b2');
  assert.ok(findNodes(renderer.tree, (node) => node.type === 'select' && node.props.value === 'detailed').length);
  await click(renderer, '添加机器人'); await click(renderer, '手动添加');
  assert.match(textOf(renderer.tree), /手动添加机器人/);
  assert.ok(!f.calls.some((call) => call.method.includes('send') || call.method === 'bot.test'));
});

test('robot settings sections preserve drafts and scoped saves across mouse and keyboard navigation', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const settingTabs = () => findNodes(renderer.tree, (node) => node.props.role === 'tablist' && node.props['aria-label'] === '机器人设置')[0];
  const guidance = (label) => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === label)[0];
  const handling = (label) => findNodes(renderer.tree, (node) => node.type === 'select' && node.props['aria-label'] === label)[0];
  assert.deepEqual(findNodes(settingTabs(), (node) => node.props.role === 'tab').map(textOf), ['通用', '私聊', '群聊']);
  await click(renderer, '私聊');
  await click(renderer, '群聊');
  await click(renderer, '通用');
  assert.ok(f.calls.every((call) => readMethods.has(call.method)), 'browsing settings never writes');

  await click(renderer, '私聊');
  guidance('私聊上下文注入').props.onChange({ target: { value: 'keep private guidance' } });
  await renderer.settle();
  f.setFailSave(true);
  await click(renderer, '群聊');
  assert.match(textOf(renderer.tree), /save unavailable/);
  assert.equal(guidance('群聊上下文注入').props.value, '');
  handling('群聊消息处理').props.onChange({ target: { value: 'steer' } });
  await renderer.settle();
  await click(renderer, '私聊');
  assert.equal(guidance('私聊上下文注入').props.value, 'keep private guidance');
  assert.equal(handling('私聊消息处理').props.value, 'queue');
  f.setFailSave(false);
  await click(renderer, '重试');
  assert.equal(f.bots[0].contextEnhancement.direct.guidance, 'keep private guidance');
  assert.equal(f.bots[0].contextEnhancement.group.guidance, '');
  assert.deepEqual({ ...f.calls.find((call) => call.method === 'bot.busy-mode.set').payload }, { botId: 'b1', scope: 'group', mode: 'steer' });

  let focused = null;
  const tabs = findNodes(settingTabs(), (node) => node.props.role === 'tab');
  tabs[1].props.onKeyDown({ key: 'Home', preventDefault() {}, currentTarget: { parentElement: {
    querySelectorAll: () => tabs.map((tab) => ({ focus() { focused = textOf(tab); } })),
  } } });
  await renderer.settle();
  assert.equal(focused, '通用');
  assert.match(textOf(renderer.tree), /会话默认|模型与输出/);
  assert.ok(!guidance('私聊上下文注入'), 'inactive settings leave the visible focus order');
  await click(renderer, '群聊');
  assert.equal(handling('群聊消息处理').props.value, 'steer');
});

test('chat unbinding confirms an unavailable binding, keeps history and affects only the selected bot', async (t) => {
  let confirmed = false;
  const prompts = [];
  const renderer = await clientRenderer({ confirm: (message) => { prompts.push(message); return confirmed; } });
  t.after(() => renderer.dispose());
  const f = fixture();
  Object.assign(f.chats[0], { bindingState: 'unavailable', session: null });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession: (id) => f.navigation.push(id) });
  await renderer.settle(); await click(renderer, '会话');
  assert.equal(button(renderer, '打开 DSH 会话').props.disabled, true);
  assert.equal(button(renderer, '解绑').props.disabled, false);
  await click(renderer, '解绑');
  assert.ok(!f.calls.some((call) => call.method === 'chat.unbind'));
  assert.match(prompts[0], /产品讨论/);
  assert.match(prompts[0], /历史记录会保留/);
  confirmed = true;
  await click(renderer, '解绑');
  assert.deepEqual({ ...f.calls.find((call) => call.method === 'chat.unbind').payload }, { botId: 'b1', chatId: 'oc_demo_chat', sessionId: 'session-demo' });
  assert.match(textOf(renderer.tree), /已解绑「产品讨论」/);
  assert.match(textOf(renderer.tree), /未绑定|收到触发消息后创建/);
  assert.ok(!findNodes(renderer.tree, (node) => node.type === 'button' && textOf(node) === '解绑').length);
  assert.equal(f.chats[1].sessionId, 'session-second');
  assert.deepEqual(f.navigation, []);
  assert.ok(f.calls.every((call) => readMethods.has(call.method) || call.method === 'chat.unbind'));
});

test('failed chat unbinding retains the binding and an acknowledged detach survives a refresh failure', async (t) => {
  const renderer = await clientRenderer({ confirm: () => true }); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '会话');
  f.setFailAuthorization('chat.unbind');
  await click(renderer, '解绑');
  assert.match(textOf(renderer.tree), /authorization unavailable/);
  assert.equal(f.chats[0].sessionId, 'session-demo');
  assert.equal(button(renderer, '解绑').props.disabled, false);
  f.setFailAuthorization('management.snapshot');
  await click(renderer, '解绑');
  assert.match(textOf(renderer.tree), /已解绑「产品讨论」/);
  assert.equal(f.chats[0].sessionId, null);
  const details = findNodes(renderer.tree, (node) => node.props['aria-label'] === '会话详情')[0];
  assert.doesNotMatch(textOf(details), /session-demo/);
  assert.match(textOf(details), /未绑定/);
  f.setFailAuthorization(null);
  await click(renderer, '重试');
  assert.equal(f.calls.filter((call) => call.method === 'chat.unbind').length, 2, 'refresh retry does not repeat the mutation');
});

const iconButton = (renderer, label) => {
  const node = findNodes(renderer.tree, (item) => item.type === 'button' && item.props['aria-label'] === label)[0];
  assert.ok(node, `icon button ${label}`); return node;
};
async function clickIcon(renderer, label) { await iconButton(renderer, label).props.onClick(); await renderer.settle(); }

test('manual refresh requests only the selected robot and preserves other robots and chats', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  assert.ok(button(renderer, '刷新'));
  assert.equal(findNodes(button(renderer, '刷新'), (node) => node.type === 'svg').length, 0);
  await clickIcon(renderer, '刷新会话与状态');
  await click(renderer, '会话');
  assert.match(textOf(renderer.tree), /产品讨论（已刷新）/);
  const refreshed = f.calls.filter((call) => call.method === 'management.snapshot' && call.payload.refresh);
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].payload.botId, 'b1');
  assert.ok(f.calls.every((call) => readMethods.has(call.method)), 'refresh never diagnoses, reconnects or polls avatar messages');
  assert.equal(f.calls.filter((call) => call.method === 'user.status').length, 2, 'refresh also updates avatar authorization');
  await selectBot(renderer, '第二机器人');
  await click(renderer, '会话');
  assert.match(textOf(renderer.tree), /第二机器人会话/);
  assert.doesNotMatch(textOf(renderer.tree), /产品讨论/);
  await click(renderer, '状态');
  await clickIcon(renderer, '刷新会话与状态');
  await click(renderer, '会话');
  assert.match(textOf(renderer.tree), /第二机器人会话（已刷新）/);
  await selectBot(renderer, '小金刚');
  assert.match(textOf(renderer.tree), /产品讨论（已刷新）/);
});

test('connection diagnosis runs only from Status, without reconnecting or sending', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '状态');
  assert.ok(!f.calls.some((call) => call.method === 'bot.check'));
  await click(renderer, '连接诊断');
  assert.match(textOf(renderer.tree), /凭证有效，长连接正常/);
  assert.deepEqual(f.calls.filter((call) => !readMethods.has(call.method)).map((call) => call.method), ['bot.check']);
  assert.equal(f.calls.at(-1).payload.botId, 'b1');
});

test('reconnect is directly available for healthy and offline robots and stays scoped', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  assert.equal(button(renderer, '重连').props.disabled, false);
  assert.ok(iconButton(renderer, '更多操作'));
  assert.doesNotMatch(textOf(renderer.tree), /删除机器人/);
  await click(renderer, '重连');
  assert.equal(f.calls.find((call) => call.method === 'bot.reconnect').payload.botId, 'b1');
  assert.equal(button(renderer, '重连').props.disabled, false);
  await selectBot(renderer, '第二机器人');
  assert.ok(iconButton(renderer, '更多操作'));
  await click(renderer, '重连');
  assert.equal(f.calls.filter((call) => call.method === 'bot.reconnect').at(-1).payload.botId, 'b2');
  assert.match(textOf(renderer.tree), /连接已恢复/);
  assert.equal(button(renderer, '重连').props.disabled, false);
  assert.ok(!f.calls.some((call) => call.method === 'bot.check' || call.method.includes('send')));
});


test('only the selected Worker mounts, drawers preserve its binding and history can return to current', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession: (id) => f.navigation.push(id) });
  await renderer.settle(); await click(renderer, '分身');
  assert.equal(f.retained.length, 1, 'only the initially selected Worker opens');
  assert.equal(f.retained[0].sessionId, 'worker-demo');
  await click(renderer, '查看消息');
  await click(renderer, 'worker-old');
  assert.equal(f.retained.at(-1).sessionId, 'worker-old');
  assert.match(textOf(renderer.tree), /历史 Worker/);
  await click(renderer, '返回当前 Worker');
  assert.deepEqual(f.released, ['worker-demo', 'worker-old']);
  assert.equal(f.retained.at(-1).sessionId, 'worker-demo');
  await click(renderer, '会话'); await click(renderer, '分身');
  assert.equal(f.retained.length, 3, 'tab changes keep the same native input binding');
  assert.deepEqual(f.released, ['worker-demo', 'worker-old']);
  await selectBot(renderer, '第二机器人');
  assert.deepEqual(f.released, ['worker-demo', 'worker-old', 'worker-demo']);
  assert.deepEqual(f.navigation, []);
  assert.ok(f.calls.every((call) => !/session\.(create|prompt|cancel)|send|flush/.test(call.method)));
});

test('selection, search and drawers retain a single Worker; changing chats releases only the old reference', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  f.monitor.directEnabled = true;
  f.monitor.chats.push({ chatId: 'oc_second', name: '另一个私聊', chatMode: 'p2p', sessionId: 'worker-second' });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '分身');
  assert.deepEqual(f.retained.map((item) => item.sessionId), ['worker-demo']);
  await click(renderer, '监听设置');
  const trigger = findNodes(renderer.tree, (node) => node.type === 'select' && node.props['aria-label'] === '触发规则')[0];
  await trigger.props.onChange({ target: { value: 'keyword' } }); await renderer.settle();
  assert.equal(f.calls.find((item) => item.method === 'user.monitor.chat.set').payload.chatId, 'oc_demo_chat');
  await clickIcon(renderer, '收起面板');
  await click(renderer, '状态'); await click(renderer, '分身');
  assert.equal(f.retained.length, 1, 'settings drawers do not recreate the native input binding');
  await clickIcon(renderer, '查看会话 另一个私聊');
  assert.deepEqual(f.retained.map((item) => item.sessionId), ['worker-demo', 'worker-second']);
  assert.deepEqual(f.released, ['worker-demo']);
  const search = findNodes(renderer.tree, (node) => node.props['aria-label'] === '搜索监听会话')[0];
  search.props.onChange({ target: { value: 'no-match' } }); await renderer.settle();
  assert.match(textOf(renderer.tree), /没有匹配的会话/);
  assert.equal(f.retained.length, 2, 'filtering does not interrupt the selected conversation');
  await click(renderer, '会话列表');
  assert.equal(findNodes(renderer.tree, (node) => node.props.className === 'bxf-avatar-split')[0].props['data-detail'], 'false');
  assert.deepEqual(f.released, ['worker-demo'], 'narrow-screen back navigation retains the current draft binding');
  assert.ok(!f.calls.some((item) => /session\.(create|prompt|cancel)|send|flush/.test(item.method)));
});

test('direct monitoring is opt-in and manual additions and settings are group-only', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  f.monitor.chats.push({ chatId: 'oc_direct_chat', name: '自动发现的私聊', chatMode: 'p2p', sessionId: 'worker-direct' });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '分身');
  assert.equal(button(renderer, '监听所有私聊').props['aria-checked'], false);
  assert.match(textOf(renderer.tree), /群聊 · 1/);
  assert.doesNotMatch(textOf(renderer.tree), /自动发现的私聊/);
  await click(renderer, '添加群聊');
  assert.match(textOf(renderer.tree), /新增群聊/);
  assert.doesNotMatch(textOf(renderer.tree), /未监听私聊/);
  await clickIcon(renderer, '收起面板');

  await click(renderer, '监听所有私聊');
  assert.equal(button(renderer, '监听所有私聊').props['aria-checked'], true);
  assert.match(textOf(renderer.tree), /私聊 · 1/);
  f.monitor.directError = '暂时无法读取私聊列表';
  await click(renderer, '立即检查');
  assert.match(textOf(renderer.tree), /暂时无法读取私聊列表/);
  await clickIcon(renderer, '查看会话 自动发现的私聊');
  assert.equal(f.retained.at(-1).sessionId, 'worker-direct');
  assert.ok(!findNodes(renderer.tree, (node) => node.type === 'button' && textOf(node) === '监听设置').length);
  await click(renderer, '查看消息');
  assert.equal(f.calls.findLast((item) => item.method === 'user.monitor.detail').payload.chatId, 'oc_direct_chat');
  await clickIcon(renderer, '收起面板');
  await click(renderer, '监听所有私聊');
  assert.doesNotMatch(textOf(renderer.tree), /自动发现的私聊/);
  assert.match(textOf(renderer.tree), /群聊 · 1/);
  assert.equal(f.released.at(-1), 'worker-direct');
  assert.deepEqual(f.calls.filter((item) => item.method === 'user.monitor.direct.enable').map((item) => ({ ...item.payload })), [
    { botId: 'b1', enabled: true }, { botId: 'b1', enabled: false },
  ]);
  assert.ok(!f.calls.some((item) => ['user.monitor.enable', 'user.monitor.add', 'user.monitor.remove', 'user.monitor.chat.set'].includes(item.method)));
});

test('an empty monitor and a chat without a Worker never create a conversation merely by viewing', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture({ monitorChats: [] });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '分身');
  assert.match(textOf(renderer.tree), /添加群聊或开启私聊监听/);
  assert.equal(f.retained.length, 0);
  await click(renderer, '添加群聊');
  const add = findNodes(renderer.tree, (node) => node.type === 'button' && textOf(node) === '添加').at(-1);
  await add.props.onClick(); await renderer.settle();
  await clickIcon(renderer, '收起面板');
  assert.match(textOf(renderer.tree), /等待首次派发/);
  assert.equal(button(renderer, '独立打开').props.disabled, true);
  assert.equal(f.retained.length, 0);
  // A later status refresh observes a Worker created by the existing backend scheduler.
  f.monitor.chats[0].sessionId = 'worker-later';
  await click(renderer, '立即检查');
  assert.equal(f.retained.at(-1).sessionId, 'worker-later');
  await click(renderer, '监听设置'); await click(renderer, '移除');
  assert.deepEqual(f.released, ['worker-later']);
  assert.match(textOf(renderer.tree), /添加群聊或开启私聊监听/);
  assert.ok(!findNodes(renderer.tree, (node) => node.type === 'dialog').length);
  assert.ok(!f.calls.some((item) => /session\.(create|prompt|cancel)|send|enable|flush/.test(item.method)));
});

test('Escape cannot discard failed per-chat keywords and chat switches remain blocked', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  f.monitor.directEnabled = true;
  f.monitor.chats[0].mode = 'keyword';
  f.monitor.chats.push({ chatId: 'oc_second', name: '另一个私聊', chatMode: 'p2p', sessionId: 'worker-second' });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '分身'); await click(renderer, '监听设置');
  const keywords = () => findNodes(renderer.tree, (node) => node.type === 'input' && node.props.placeholder === '关键词，逗号分隔')[0];
  keywords().props.onChange({ target: { value: '保留关键词' } }); await renderer.settle();
  f.setFailSave(true);
  let prevented = false;
  findNodes(renderer.tree, (node) => node.type === 'dialog')[0].props.onCancel({ preventDefault() { prevented = true; } });
  await renderer.settle();
  assert.equal(prevented, true);
  assert.ok(keywords());
  assert.match(textOf(renderer.tree), /save unavailable/);
  await clickIcon(renderer, '查看会话 另一个私聊');
  assert.equal(f.retained.length, 1);
  f.setFailSave(false); await click(renderer, '重试'); await clickIcon(renderer, '收起面板');
  await clickIcon(renderer, '查看会话 另一个私聊');
  assert.equal(f.retained.at(-1).sessionId, 'worker-second');
  assert.deepEqual([...f.monitor.chats[0].keywords], ['保留关键词']);
});

test('status exposes details inline and keeps permission actions on the selected bot', async (t) => {
  const renderer = await clientRenderer();
  t.after(() => renderer.dispose());
  const f = fixture();
  Object.assign(f.bots[1], {
    workspace: '/workspace/example', model: { provider: 'provider', model: 'test-model', reasoningEffort: 'high' },
    agentPreset: 'preset-example', botOpenId: 'ou_second',
    inbound: { messagesReceived: 12, lastEventType: 'message', lastEventAt: '2026-11-16T00:00:00Z' },
    lastError: { code: 'example-error', message: 'Example failure', at: '2026-11-16T00:00:00Z' },
  });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await selectBot(renderer, '第二机器人');
  for (const label of ['应用信息', '运行观测', 'ou_second', 'example-error', 'Example failure']) {
    assert.ok(textOf(renderer.tree).includes(label), `status includes ${label}`);
  }
  assert.ok(!findNodes(renderer.tree, (node) => node.type === 'button' && ['详情', '复制信息'].includes(textOf(node))).length);
  assert.ok(f.calls.every((item) => readMethods.has(item.method)), 'viewing full status is read-only');
  assert.doesNotMatch(textOf(renderer.tree), /会话默认设置|默认工作区/);
  await click(renderer, '补齐权限');
  assert.match(textOf(renderer.tree), /扫码补齐权限/);
  assert.equal(f.calls.find((item) => item.method === 'provision.begin').payload.botId, 'b2');
  assert.ok(!f.calls.some((item) => item.method.includes('send') || item.method === 'bot.reconnect' || item.method === 'bot.check'));
});

test('delete stays inside More and requires confirmation for the selected robot', async (t) => {
  const confirmations = [];
  let accepted = false;
  const renderer = await clientRenderer({ confirm(message) { confirmations.push(message); return accepted; } });
  t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await selectBot(renderer, '第二机器人');
  assert.doesNotMatch(textOf(renderer.tree), /删除机器人/);
  await clickIcon(renderer, '更多操作');
  assert.equal(iconButton(renderer, '更多操作').props['aria-expanded'], true);
  assert.equal(confirmations.length, 0);
  await click(renderer, '删除机器人');
  assert.match(confirmations[0], /第二机器人/);
  assert.equal(iconButton(renderer, '更多操作').props['aria-expanded'], false);
  assert.ok(!f.calls.some((item) => item.method === 'bot.remove'), 'cancelling leaves the robot intact');
  await clickIcon(renderer, '更多操作');
  await click(renderer, '会话'); await click(renderer, '状态');
  assert.doesNotMatch(textOf(renderer.tree), /删除机器人/, 'leaving Status closes the menu');
  accepted = true;
  await clickIcon(renderer, '更多操作'); await click(renderer, '删除机器人');
  assert.equal(confirmations.length, 2);
  assert.deepEqual(f.calls.filter((item) => item.method === 'bot.remove').map((item) => item.payload.botId), ['b2']);
  assert.equal(findNodes(renderer.tree, (node) => node.props['aria-current'] === 'page')[0].props['aria-label'], '小金刚');
  assert.doesNotMatch(textOf(renderer.tree), /第二机器人/);
});

test('failed draft saves prevent delete and confirmation, keeping the draft editable', async (t) => {
  let confirmations = 0;
  const renderer = await clientRenderer({ confirm() { confirmations++; return true; } });
  t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const rules = () => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === '分身回复规则')[0];
  rules().props.onChange({ target: { value: '尚未保存的规则' } }); await renderer.settle();
  f.setFailSave(true);
  await click(renderer, '状态'); await clickIcon(renderer, '更多操作'); await click(renderer, '删除机器人');
  assert.equal(confirmations, 0);
  assert.ok(!f.calls.some((item) => item.method === 'bot.remove'));
  assert.equal(rules().props.value, '尚未保存的规则');
  assert.match(textOf(renderer.tree), /save unavailable/);
});

test('inline avatar authorization can refresh, retry, scan and disconnect only after confirmation', async (t) => {
  const confirmations = [];
  let accepted = false;
  const renderer = await clientRenderer({ confirm(message) { confirmations.push(message); return accepted; } });
  t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  assert.deepEqual(findNodes(renderer.tree, (node) => node.type === 'section' && ['机器人状态', '分身状态'].includes(node.props['aria-label'])).map((node) => node.props['aria-label']), ['机器人状态', '分身状态']);
  assert.doesNotMatch(textOf(renderer.tree), /改名|修改显示名称|管理授权|断开授权/);
  assert.match(textOf(renderer.tree), /ou_test_user/);
  const expiry = f.identity.authorization.accessTokenExpiresAt;
  f.setFailAuthorization('user.refresh');
  await click(renderer, '刷新凭证');
  assert.match(textOf(renderer.tree), /authorization unavailable/);
  assert.equal(f.identity.authorization.accessTokenExpiresAt, expiry);
  f.setFailAuthorization(null);
  await click(renderer, '刷新凭证');
  assert.match(textOf(renderer.tree), /凭证已刷新/);
  assert.equal(f.identity.authorization.accessTokenExpiresAt, expiry + 1000);
  assert.ok(f.calls.filter((call) => call.method === 'user.refresh').every((call) => call.payload.botId === 'b1'));
  await click(renderer, '重新授权');
  assert.equal(findNodes(renderer.tree, (node) => node.type === 'img' && node.props.alt === '飞书授权二维码').length, 1);
  assert.equal(findNodes(renderer.tree, (node) => node.type === 'dialog' || node.props.role === 'dialog').length, 0, 'authorization stays inline');
  assert.equal(button(renderer, '刷新凭证').props.disabled, true);
  await click(renderer, '取消扫码');
  assert.equal(findNodes(renderer.tree, (node) => node.type === 'img' && node.props.alt === '飞书授权二维码').length, 0);
  assert.equal(f.identity.authorization.authorized, true, 'cancelling reauthorization preserves the grant');
  await clickIcon(renderer, '分身更多操作'); await click(renderer, '断开授权');
  assert.match(confirmations[0], /测试用户/);
  assert.ok(!f.calls.some((call) => call.method === 'user.disconnect'));
  accepted = true;
  await clickIcon(renderer, '分身更多操作'); await click(renderer, '断开授权');
  assert.equal(f.calls.find((call) => call.method === 'user.disconnect').payload.botId, 'b1');
  assert.ok(button(renderer, '连接分身'));
  assert.doesNotMatch(textOf(renderer.tree), /测试用户|ou_test_user/);
  assert.equal(f.monitor.chats.length, 1, 'disconnect leaves monitoring configuration intact');
});

test('missing cloud scopes use normal reauthorization and keep message settings accessible', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  Object.assign(f.identity.authorization, {
    scopeSatisfied: false,
    messageScopesSatisfied: true,
    missingScopes: ['space:document:retrieve', 'space:document:delete'],
  });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  assert.match(textOf(renderer.tree), /当前授权缺少权限，请重新授权：space:document:retrieve、space:document:delete/);
  assert.match(textOf(renderer.tree), /自动回复设置/);
  await clickIcon(renderer, '分身更多操作');
  assert.ok(button(renderer, '断开授权'));
  assert.doesNotMatch(textOf(renderer.tree), /授权云空间浏览|授权云空间管理/);
  await click(renderer, '重新授权');
  assert.deepEqual(f.calls.filter((call) => call.method === 'user.connect.begin').map((call) => ({ ...call.payload })), [{ botId: 'b1' }]);
  assert.match(textOf(renderer.tree), /等待扫码/);
});

test('inline scan stays scoped across robot navigation and exposes failures and missing scopes', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await selectBot(renderer, '第二机器人');
  assert.doesNotMatch(textOf(renderer.tree), /刷新凭证|重新授权/);
  assert.match(textOf(renderer.tree), /当前仅支持一份分身授权/);
  await click(renderer, '连接分身');
  assert.deepEqual({ ...f.calls.find((call) => call.method === 'user.connect.begin').payload }, { botId: 'b2' });
  assert.match(textOf(renderer.tree), /等待扫码/);
  await selectBot(renderer, '小金刚');
  assert.equal(findNodes(renderer.tree, (node) => node.type === 'img' && node.props.alt === '飞书授权二维码').length, 0);
  assert.ok(!f.calls.some((call) => call.method === 'user.connect.cancel'), 'navigation alone does not cancel an inline scan');
  await selectBot(renderer, '第二机器人');
  await click(renderer, '取消扫码');
  assert.equal(f.calls.find((call) => call.method === 'user.connect.cancel').payload.botId, 'b2');
  f.identity.connect = { phase: 'failed', error: '扫码已超时' };
  await click(renderer, '刷新');
  assert.match(textOf(renderer.tree), /扫码已超时/);
  await click(renderer, '连接分身');
  assert.doesNotMatch(textOf(renderer.tree), /扫码已超时/);
  f.identity.connect = { phase: 'success' };
  f.identity.authorization = { authorized: true, user: { name: '新授权用户' }, scopeSatisfied: false, missingScopes: ['im:message'], refreshTokenExpiresAt: 9999999999999, accessTokenExpiresAt: 9999999990000 };
  await click(renderer, '刷新');
  assert.match(textOf(renderer.tree), /新授权用户/);
  assert.match(textOf(renderer.tree), /授权不完整|im:message/);
  assert.ok(button(renderer, '重新授权'));
  await click(renderer, '刷新凭证');
  assert.equal(f.calls.find((call) => call.method === 'user.refresh').payload.botId, 'b2');
  assert.ok(!f.calls.some((call) => call.method.includes('send') || call.method === 'bot.alias.set'));
});

test('bot and avatar status actions show tips only after two seconds and cancel them on exit', async (t) => {
  let now = 0, serial = 0;
  const jobs = new Map();
  const clock = {
    setTimeout(fn, delay) { const id = ++serial; jobs.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, job] of [...jobs]) if (job.at <= now) { jobs.delete(id); job.fn(); }
    },
  };
  const renderer = await clientRenderer({ clock }); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const tipFor = (label) => findNodes(renderer.tree, (node) => node.props.className === 'bxf-action-tip' && textOf(node).startsWith(label))[0];
  const visibleTips = () => findNodes(renderer.tree, (node) => node.props.role === 'tooltip' && node.props.className === 'bxf-action-tip-body');
  for (const label of ['连接诊断', '刷新', '重连', '补齐权限', '重新授权', '刷新凭证', '断开授权']) {
    if (label === '断开授权') await clickIcon(renderer, '分身更多操作');
    const action = button(renderer, label);
    assert.equal(action.props.title, undefined, 'no competing native tooltip');
    assert.equal(visibleTips().length, 0);
    tipFor(label).props.onMouseEnter();
    clock.advance(1999); await renderer.settle();
    assert.equal(visibleTips().length, 0);
    clock.advance(1); await renderer.settle();
    assert.equal(visibleTips().length, 1);
    assert.equal(visibleTips()[0].props.id, action.props['aria-describedby']);
    tipFor(label).props.onMouseLeave(); await renderer.settle();
    assert.equal(visibleTips().length, 0);
  }
  tipFor('重连').props.onMouseEnter(); clock.advance(1000);
  tipFor('重连').props.onMouseLeave(); clock.advance(1000); await renderer.settle();
  assert.equal(visibleTips().length, 0, 'brief hover cancels the pending tip');
  tipFor('连接诊断').props.onFocus(); clock.advance(2000); await renderer.settle();
  assert.equal(visibleTips().length, 1, 'keyboard focus also reveals the tip');
  await click(renderer, '连接诊断');
  assert.equal(visibleTips().length, 0, 'click dismisses the tip');
  tipFor('刷新').props.onMouseEnter();
  await click(renderer, '会话'); clock.advance(2000); await renderer.settle();
  await click(renderer, '状态');
  assert.equal(visibleTips().length, 0, 'switching tabs cancels pending tips');
  tipFor('刷新').props.onMouseEnter(); renderer.dispose();
  assert.equal(jobs.size, 0, 'unmount cleans up timers');
});

test('invalid remembered tabs open Status and settings wait for connection and valid owned authorization', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {}, memory: { botId: 'b2', tabs: { b2: 'invalid-tab' } } });
  await renderer.settle();
  assert.equal(findNodes(renderer.tree, (node) => node.props.role === 'tab' && node.props['aria-selected'])[0].props.id, 'bxf-tab-status');
  assert.doesNotMatch(textOf(renderer.tree), /机器人设置|自动回复设置|默认工作区|会话默认设置/);
  assert.deepEqual(f.calls.map((call) => call.method), ['management.snapshot', 'user.status']);
  await click(renderer, '重连');
  assert.match(textOf(renderer.tree), /机器人设置|默认工作区/);
  assert.doesNotMatch(textOf(renderer.tree), /自动回复设置/);
  assert.ok(!f.calls.some((call) => call.method.startsWith('user.monitor.')));
  f.identity.config.app.botId = 'b2';
  f.identity.authorization.authorized = false;
  await click(renderer, '刷新');
  assert.doesNotMatch(textOf(renderer.tree), /自动回复设置/);
  f.identity.authorization.authorized = true;
  await click(renderer, '刷新');
  assert.match(textOf(renderer.tree), /自动回复设置/);
  assert.ok(f.calls.some((call) => call.method === 'user.monitor.worker.options' && call.payload.botId === 'b2'));
  for (const patch of [{ refreshTokenExpiresAt: 1 }, { refreshTokenExpiresAt: 9999999999999, scopeSatisfied: false }, { authorized: false }]) {
    Object.assign(f.identity.authorization, patch);
    await click(renderer, '刷新');
    assert.doesNotMatch(textOf(renderer.tree), /自动回复设置|转人工关键词/);
  }
  assert.equal(f.retained.length, 0, 'reading or editing status does not open a Worker');
});

test('inline reply settings save handoff, Worker selection and rules to the selected avatar', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const handoff = () => findNodes(renderer.tree, (node) => node.type === 'input' && node.props.placeholder === '转人工，人工客服')[0];
  handoff().props.onChange({ target: { value: '转人工，客服' } }); await renderer.settle();
  await handoff().props.onBlur(); await renderer.settle();
  for (const [label, value] of [['分组', 'workspace-other'], ['预设', 'custom']]) {
    const field = findNodes(renderer.tree, (node) => node.type === 'select' && node.props['aria-label'] === label)[0];
    field.props.onChange({ target: { value } }); await renderer.settle();
  }
  const rules = () => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === '分身回复规则')[0];
  rules().props.onChange({ target: { value: '新的回复规则' } }); await renderer.settle();
  await rules().props.onBlur(); await renderer.settle();
  assert.deepEqual([...f.monitor.handoffKeywords], ['转人工', '客服']);
  assert.equal(f.monitor.worker.workspaceId, 'workspace-other');
  assert.equal(f.monitor.worker.preset, 'custom');
  assert.equal(f.monitor.replyRules, '新的回复规则');
  await click(renderer, '恢复默认模板');
  assert.equal(f.monitor.replyRules, 'default rule');
  assert.ok(f.calls.filter((call) => call.method.startsWith('user.monitor.')).every((call) => call.payload.botId === 'b1'));
  await click(renderer, '分身');
  assert.doesNotMatch(textOf(renderer.tree), /自动回复设置|分身回复规则/);
  assert.ok(!f.calls.some((call) => /send|user.monitor.poll|user.monitor.flush/.test(call.method)));
});

test('losing a connection hides settings without losing failed drafts, restoring it makes retry possible', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle();
  const rules = () => findNodes(renderer.tree, (node) => node.type === 'textarea' && node.props['aria-label'] === '分身回复规则')[0];
  rules().props.onChange({ target: { value: '恢复后继续编辑的草稿' } }); await renderer.settle();
  f.setFailSave(true);
  f.bots[0].state = 'idle'; f.identity.authorization.authorized = false;
  await click(renderer, '刷新');
  assert.equal(rules(), undefined);
  assert.doesNotMatch(textOf(renderer.tree), /机器人设置|自动回复设置|默认工作区/);
  await selectBot(renderer, '第二机器人');
  assert.equal(findNodes(renderer.tree, (node) => node.props['aria-current'] === 'page')[0].props['aria-label'], '小金刚');
  assert.match(textOf(renderer.tree), /设置尚未保存/);
  f.bots[0].state = 'connected'; f.identity.authorization.authorized = true;
  await click(renderer, '刷新');
  assert.equal(rules().props.value, '恢复后继续编辑的草稿');
  f.setFailSave(false); await click(renderer, '重试');
  assert.equal(f.monitor.replyRules, '恢复后继续编辑的草稿');
  await selectBot(renderer, '第二机器人');
  assert.equal(findNodes(renderer.tree, (node) => node.props['aria-current'] === 'page')[0].props['aria-label'], '第二机器人');
});

const chooseSession = async (renderer, id) => {
  const option = findNodes(renderer.tree, (node) => node.type === 'input' && node.props.type === 'radio' && node.props.value === id)[0];
  assert.ok(option && !option.props.disabled, `selectable Session ${id}`);
  option.props.onChange(); await renderer.settle();
};

test('conversation binding loads only on demand, searches existing Sessions and updates the selected chat', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  Object.assign(f.chats[0], { sessionId: null, session: null, bindingState: 'unbound' });
  f.bots[0].boundChats = 0;
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '会话');
  assert.ok(!f.calls.some((call) => call.method === 'chat.sessions.list'));
  await click(renderer, '绑定会话');
  assert.deepEqual(structuredClone(f.calls.find((call) => call.method === 'chat.sessions.list').payload), { botId: 'b1', chatId: 'oc_demo_chat' });
  assert.equal(button(renderer, '确认绑定').props.disabled, true);
  const worker = findNodes(renderer.tree, (node) => node.props.value === 'worker-demo' && node.type === 'input')[0];
  assert.equal(worker.props.disabled, true);
  const search = findNodes(renderer.tree, (node) => node.props['aria-label'] === '搜索 DSH 会话')[0];
  search.props.onChange({ target: { value: '/work/project' } });
  await renderer.settle();
  assert.match(textOf(renderer.tree), /已有项目任务/);
  assert.doesNotMatch(textOf(renderer.tree), /其他工作区任务|分身任务/);
  await chooseSession(renderer, 'session-existing');
  await click(renderer, '确认绑定');
  assert.deepEqual(structuredClone(f.calls.find((call) => call.method === 'chat.bind').payload), {
    botId: 'b1', chatId: 'oc_demo_chat', sessionId: 'session-existing', expectedSessionId: null,
  });
  assert.match(textOf(renderer.tree), /会话已绑定|session-existing/);
  assert.ok(!findNodes(renderer.tree, (node) => node.props['aria-label'] === '绑定 DSH 会话').length);
  assert.equal(f.bots[0].boundChats, 1);
  assert.equal(f.chats[1].sessionId, 'session-second');
  assert.ok(f.calls.every((call) => readMethods.has(call.method) || call.method === 'chat.bind'));
});

test('changing a binding requires confirmation, and cancellation keeps the original association', async (t) => {
  let confirmed = false;
  const confirmations = [];
  const renderer = await clientRenderer({ confirm(message) { confirmations.push(message); return confirmed; } });
  t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '会话'); await click(renderer, '更换绑定');
  await chooseSession(renderer, 'session-existing');
  await click(renderer, '确认绑定');
  assert.equal(f.chats[0].sessionId, 'session-demo');
  assert.ok(!f.calls.some((call) => call.method === 'chat.bind'));
  confirmed = true;
  await click(renderer, '确认绑定');
  assert.match(confirmations[0], /产品讨论.*已有项目任务[\s\S]*保留/);
  assert.equal(f.calls.find((call) => call.method === 'chat.bind').payload.expectedSessionId, 'session-demo');
  assert.equal(f.chats[0].sessionId, 'session-existing');
  assert.equal(f.bots[0].boundChats, 1);
});

test('binding failures preserve selection and successful binding stays visible if the next refresh fails', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  Object.assign(f.chats[0], { sessionId: null, session: null, bindingState: 'unbound' });
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '会话'); await click(renderer, '绑定会话');
  await chooseSession(renderer, 'session-existing');
  f.setFailAuthorization('chat.bind');
  await click(renderer, '确认绑定');
  assert.match(textOf(renderer.tree), /authorization unavailable/);
  assert.equal(f.chats[0].sessionId, null);
  assert.equal(findNodes(renderer.tree, (node) => node.props.value === 'session-existing')[0].props.checked, true);
  f.setFailAuthorization('management.snapshot');
  await click(renderer, '确认绑定');
  assert.match(textOf(renderer.tree), /session-existing/);
  assert.ok(button(renderer, '更换绑定'));
  assert.ok(button(renderer, '解绑'));
});

test('switching robots closes the binding picker and does not apply its unsubmitted selection', async (t) => {
  const renderer = await clientRenderer(); t.after(() => renderer.dispose());
  const f = fixture();
  renderer.mount('WorkspacePage', { connection: f.connection, workerView: f.workerView, openSession() {} });
  await renderer.settle(); await click(renderer, '会话'); await click(renderer, '更换绑定');
  await chooseSession(renderer, 'session-existing');
  await selectBot(renderer, '第二机器人'); await click(renderer, '会话');
  assert.ok(!findNodes(renderer.tree, (node) => node.props['aria-label'] === '绑定 DSH 会话').length);
  assert.ok(!f.calls.some((call) => call.method === 'chat.bind'));
  await click(renderer, '更换绑定');
  assert.deepEqual(structuredClone(f.calls.filter((call) => call.method === 'chat.sessions.list').at(-1).payload), { botId: 'b2', chatId: 'oc_demo_chat' });
  assert.equal(button(renderer, '确认绑定').props.disabled, true);
});
