import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utimes, writeFile, readdir } from 'node:fs/promises';

import { beginDeviceAuthorization, pollDeviceToken, refreshUserAccessToken } from '../src/user-identity/oauth.js';
import { UserIdentityConnect } from '../src/user-identity/connect.js';
import { UserIdentityAuth, withAccessToken } from '../src/user-identity/auth.js';
import { UserIdentityConfigStore } from '../src/user-identity/config.js';
import { UserTokenStore } from '../src/user-identity/token-store.js';
import { UserIdentityManager } from '../src/user-identity/manager.js';
import { InboundContent } from '../src/inbound.js';
import { MenuController } from '../src/menu.js';
import { extractMessageText } from '../src/user-identity/api.js';
import { AutoReplyEngine } from '../src/user-identity/auto-reply.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { editCloudDocument } from '../src/user-identity/cloud-document-write.js';
import { uploadCloudFile } from '../src/user-identity/cloud-upload.js';
import { TurnRunner } from '../src/turn.js';
import { FeishuBridge } from '../src/bridge.js';
import { StateStore } from '../src/config.js';
import { currentMenuValue } from '../src/commands.js';
import { renderPostText, decodePost } from '../src/message-content.js';
import { interactiveTextOfContent } from '../src/message-text.js';
import { readMessageImage } from '../src/message-image-tool.js';
import { defineFeishuTool } from '../src/tool-contract.js';
import { feishuErrorCode } from '../src/feishu-errors.js';
import { createAutoSave } from '../client/autosave.js';
import { MESSAGES, dictionaries } from '../client/locale.js';

test('Batch A: OAuth 错误消息不会短路成 false，且永久性错误立即终止轮询', async () => {
  await assert.rejects(
    beginDeviceAuthorization({
      appId: 'cli_a',
      appSecret: 'sec_a',
      fetchImpl: async () => Response.json({ error: 'invalid_client' }, { status: 400 }),
    }),
    (err) => err.message === 'invalid_client',
  );
  await assert.rejects(
    pollDeviceToken({
      appId: 'cli_a',
      appSecret: 'sec_a',
      deviceCode: 'dc_1',
      fetchImpl: async () => Response.json({ error: 'invalid_grant', error_description: '' }, { status: 400 }),
    }),
    (err) => err.message === 'invalid_grant',
  );
  await assert.rejects(
    refreshUserAccessToken({
      appId: 'cli_a',
      appSecret: 'sec_a',
      refreshToken: 'rt_1',
      fetchImpl: async () => Response.json({ error: 'invalid_request' }, { status: 400 }),
    }),
    (err) => err.message === 'invalid_request',
  );

  let polls = 0;
  const connect = new UserIdentityConnect({
    auth: {
      config: { scope: 'im:message:readonly' },
      async resolveApp() { return { appId: 'cli_a', appSecret: 'sec_a' }; },
      async acceptDeviceToken() { throw new Error('should not accept'); },
    },
    fetchImpl: async (url) => {
      if (String(url).includes('device_authorization')) {
        return Response.json({ device_code: 'dc_perm', user_code: 'U1', verification_uri_complete: 'https://accounts.feishu.cn/v', expires_in: 240, interval: 1 });
      }
      polls += 1;
      return Response.json({ error: 'invalid_client' }, { status: 400 });
    },
  });
  await connect.begin();
  await new Promise((resolve) => setTimeout(resolve, 1150));
  assert.equal(polls, 1);
  assert.equal(connect.status.phase, 'failed');
  assert.match(connect.status.error, /invalid_client/);
  connect.dispose();
});

test('Batch A: 并发 withAccessToken 过期时不重复消耗 refresh_token', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-auth-race-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configStore = await new UserIdentityConfigStore({ path: join(dir, 'id.json') }).load();
  const tokenStore = await new UserTokenStore({ path: join(dir, 'tok.json') }).load();
  await tokenStore.save({
    version: 1, appId: 'cli_a', accessToken: 'tok_old', refreshToken: 'rt_1',
    accessTokenExpiresAt: Date.now() + 3600_000, refreshTokenExpiresAt: Date.now() + 7 * 86400_000,
    scope: 'offline_access', user: { openId: 'ou_1', name: 'A' }, authorizedAt: new Date().toISOString(),
  });
  let refreshCalls = 0;
  const auth = new UserIdentityAuth({
    configStore, tokenStore,
    botConfigStore: { bots: [{ id: 'b1', appId: 'cli_a', secretRef: 'S1' }], bot: () => ({ id: 'b1', appId: 'cli_a', secretRef: 'S1' }) },
    credentials: { resolve: async () => ({ value: 'sec_a' }) },
    fetchImpl: async () => {
      refreshCalls += 1;
      return Response.json({ access_token: `tok_new_${refreshCalls}`, refresh_token: `rt_${refreshCalls + 1}`, expires_in: 7200, refresh_token_expires_in: 604800 });
    },
  });
  const expired = Object.assign(new Error('expired'), { feishuCode: 99991668 });
  const r1 = await withAccessToken(auth, async (tok) => {
    if (tok === 'tok_old') throw expired;
    return tok;
  });
  assert.equal(r1, 'tok_new_1');
  assert.equal(refreshCalls, 1);
  // 模拟另一并发请求仍拿着旧 tok_old 刚进入 catch，不应触发第二次 refresh
  const secondToken = await auth.requireAccessToken({ force: true, failedAccessToken: 'tok_old' });
  assert.equal(secondToken, 'tok_new_1');
  assert.equal(refreshCalls, 1);
});

test('Batch A: 分身文本 @ 替换、Worker session/not-found 自动重建与亚秒/失效游标恢复', async (t) => {
  assert.equal(extractMessageText({
    msg_type: 'text',
    body: { content: JSON.stringify({ text: '@_user_1 请看下需求' }) },
    mentions: [{ key: '@_user_1', name: '张三', id: { open_id: 'ou_zhang' } }],
  }), '@张三 请看下需求');

  const dir = await mkdtemp(join(tmpdir(), 'feishu-monitor-fix-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await new MonitorStore({
    configPath: join(dir, 'monitor.json'), statePath: join(dir, 'state.json'),
  }).load();
  const chatId = 'oc_group_fix';
  let now = 1_700_000_000_100;
  await store.saveConfig({ enabled: true, chats: [{ chatId, name: '测试群', mode: 'all' }] });
  await store.updateChat(chatId, {
    cursorTimeMs: now - 10_000,
    sessionId: 'sess_deleted',
    workerConfigKey: JSON.stringify(['', 'standard']),
    messages: [{ messageId: 'om_1', senderName: '友', senderOpenId: 'ou_x', createTime: new Date(now).toISOString(), text: '你好', imageKeys: [] }],
    batch: { messageIds: ['om_1'], firstAt: now, lastAt: now },
  });
  let created = 0;
  let prompted = [];
  const engine = new AutoReplyEngine({
    store,
    harness: {
      async createSession() { created += 1; return `sess_rebuilt_${created}`; },
      async prompt(sessionId) {
        prompted.push(sessionId);
        if (sessionId === 'sess_deleted') throw Object.assign(new Error('not found'), { code: 'session/not-found' });
      },
    },
    now: () => now,
  });
  const flushed = await engine.flush({ chatId, name: '测试群', chatMode: 'group' });
  assert.equal(flushed, chatId);
  assert.deepEqual(prompted, ['sess_deleted', 'sess_rebuilt_1']);
  assert.equal(store.state.chats[chatId].sessionId, 'sess_rebuilt_1');

  // 失效游标 400 自动清 scan，避免永久卡死
  await store.updateChat(chatId, {
    cursorTimeMs: now - 5_000,
    scan: { startTimeMs: now - 10_000, endTimeMs: now, pageToken: 'expired_cursor' },
  });
  let listCalls = 0;
  const monitor = new UserMonitorManager({
    auth: {
      async status() { return { authorization: { authorized: true, user: { openId: 'ou_self' } } }; },
      async requireAccessIdentity() { return { accessToken: 't1', openId: 'ou_self' }; },
    },
    store,
    listMessages: async ({ pageToken }) => {
      listCalls += 1;
      if (pageToken === 'expired_cursor') throw Object.assign(new Error('invalid page_token'), { status: 400 });
      return { items: [], hasMore: false, pageToken: null };
    },
    now: () => now,
  });
  await monitor.pollOnce();
  assert.equal(listCalls, 1);
  assert.equal(store.state.chats[chatId].scan, null);
  now += 5_000;
  await monitor.pollOnce();
  assert.equal(listCalls, 2);
  assert.equal(store.state.chats[chatId].lastError, null);
  monitor.dispose();
});

test('Batch B: TurnRunner 纯文本降级不输出 null、reply 失败先回退无引用、子智能体含 output', async () => {
  const updatedTexts = [];
  const sentTexts = [];
  const cardRefCalls = [];
  const bot = {
    async createCard() { return 'ck_1'; },
    async replyCardRef() { cardRefCalls.push('reply'); throw new Error('message withdrawn'); },
    async sendCardRef() { cardRefCalls.push('direct'); return 'om_card_1'; },
    async updateCard() {},
    async sendCard() { throw new Error('card disabled'); },
    async sendText(_chatId, text) { sentTexts.push(text); return 'om_txt_1'; },
    async updateText(_id, text) { updatedTexts.push(text); return 'om_txt_1'; },
  };
  const state = { value: { sessions: { 'chat:oc_1': 's1' } }, usageFor: () => null, addUsage: async () => {} };
  const runner = new TurnRunner({
    bot, state, log: () => {}, logEvent: () => {},
    classifyUserMessage: () => ({ kind: 'feishu', chatKey: 'chat:oc_1', chatId: 'oc_1' }),
    replyToOf: () => 'om_withdrawn',
  });
  await runner.onSessionEvent({ id: 's1' }, { type: 'turn/start', data: { turn: 1 } });
  await runner.onSessionEvent({ id: 's1' }, { type: 'user/message', data: { source: { rpcId: 'r1' } } });
  assert.deepEqual(cardRefCalls, ['reply', 'direct']);
  runner.dispose();

  // 纯文本降级完成时不应出现 "null"
  const brokenBot = {
    async createCard() { throw new Error('unavailable'); },
    async sendCard() { throw new Error('card fail'); },
    async sendText(_chatId, text) { sentTexts.push(text); return 'om_p1'; },
    async updateText(_id, text) { updatedTexts.push(text); return 'om_p1'; },
  };
  const runner2 = new TurnRunner({
    bot: brokenBot, state, log: () => {}, logEvent: () => {},
    classifyUserMessage: () => ({ kind: 'feishu', chatKey: 'chat:oc_1', chatId: 'oc_1' }),
  });
  await runner2.onSessionEvent({ id: 's1' }, { type: 'turn/start', data: { turn: 1 } });
  await runner2.onSessionEvent({ id: 's1' }, { type: 'user/message', data: { source: { rpcId: 'r1' } } });
  await runner2.onSessionEvent({ id: 's1' }, { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '最终答案' }] } } });
  await runner2.onSessionEvent({ id: 's1' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.equal(updatedTexts.at(-1), '最终答案');
  assert.doesNotMatch(updatedTexts.at(-1), /null/);
  runner2.dispose();
});

test('Batch B: 富文本 at 节点、卡片换行保留与 menu workspace 口径', () => {
  const post = decodePost({ content: [[{ tag: 'at', user_id: 'ou_1', user_name: '李四' }, { tag: 'text', text: ' 看看' }]] });
  assert.equal(renderPostText(post), '@李四 看看');
  assert.equal(interactiveTextOfContent(JSON.stringify({ elements: [{ tag: 'markdown', content: '第一行\n第二行' }] })), '第一行\n第二行');
  assert.equal(currentMenuValue({ sessionWorkspace: '/tmp/a', currentWorkspace: '/tmp/b' }, 'workspace_pick'), '/tmp/a');
});

test('Batch B: Web 外部回合不偷走飞书排队 Reaction 队头', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-react-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const state = await new StateStore(join(dir, 'state.json')).load();
  await state.bindSession('chat:oc_g', 'sess_1');
  const reactions = [];
  const bot = {
    async addReaction(id, emoji) { reactions.push([id, emoji]); return `r_${reactions.length}`; },
    async removeReaction() {},
    async sendCard() { return 'c1'; },
    async sendText() { return 't1'; },
  };
  let lastRpcId = null;
  const bridge = new FeishuBridge({
    bot,
    harness: { async prompt(_sid, _parts, opts) { lastRpcId = opts.requestId; } },
    config: { botOpenId: 'ou_bot', access: { group: 'all', managers: [] }, mentions: { enabled: true } },
    state,
  });
  await bridge.handleMessage({
    sender: { sender_id: { open_id: 'ou_u1' } },
    message: { message_id: 'om_feishu_1', chat_id: 'oc_g', chat_type: 'group', message_type: 'text', content: JSON.stringify({ text: '@_user_1 你好' }), mentions: [{ key: '@_user_1', id: { open_id: 'ou_bot' } }] },
  });
  // 模拟一个 Web 端外部回合先执行并结束
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'user/message', data: { source: { kind: 'user' } } });
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.deepEqual(reactions.filter(([id]) => id === 'om_feishu_1'), [['om_feishu_1', 'OnIt']]);
  // 随后飞书自己的回合执行并结束
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'turn/start', data: { turn: 2 } });
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'user/message', data: { source: { kind: 'user', rpcId: lastRpcId } } });
  await bridge.onSessionEvent({ id: 'sess_1' }, { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } });
  assert.equal(reactions.filter(([id]) => id === 'om_feishu_1').at(-1)[1], 'DONE');
  bridge.dispose();
});

test('Batch C: readMessageImage 防 NaN 与白名单投影、tool-contract、feishuErrorCode 与 Docx/Wiki 边界', async (t) => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  let receivedMaxBytes = null;
  const result = await readMessageImage(
    { chatId: 'oc_1', messageId: 'om_1', imageIndex: 1 },
    {},
    {
      imageLimits: { maxImageBytes: 2048, mediaTypes: ['image/png'] }, // 故意缺失 maxMessageImageBytes
      async saveImage() {
        return { attachmentId: 'a1', mediaType: 'image/png', bytes: 12, width: 1, height: 1, extraInternalField: 'strip-me' };
      },
    },
    async ({ maxBytes }) => { receivedMaxBytes = maxBytes; return png; },
  );
  assert.equal(receivedMaxBytes, 2048);
  assert.equal('extraInternalField' in result.image, false);

  const tool = defineFeishuTool({
    name: 'test_tool',
    description: 't',
    parameters: { type: 'object', properties: { opt: { type: 'string' }, req: { type: 'string' } }, required: ['req'] },
    output: { schema: { type: 'object', properties: {} }, render: () => [] },
    execute: async (args) => args,
  });
  assert.deepEqual(await tool.execute({ opt: undefined, req: 'ok' }), { opt: undefined, req: 'ok' });
  assert.equal(feishuErrorCode({ code: '' }), null);
  assert.equal(feishuErrorCode({ code: null }), null);
  assert.equal(feishuErrorCode({ code: '230020' }), 230020);

  // Docx 清空唯一 text_run 时保持 elements 非空
  let patchedBody = null;
  await editCloudDocument({
    id: 'docx_1',
    find: '整段删除',
    text: '',
    request: async (params) => {
      if (params.path.endsWith('/docx_1')) return { document: { revision_id: 2 } };
      if (params.path.endsWith('/blocks')) {
        return { items: [{ block_id: 'b1', block_type: 2, text: { elements: [{ text_run: { content: '整段删除' } }] } }], has_more: false };
      }
      patchedBody = params.body;
      return { block: { block_id: 'b1' }, document_revision_id: 3 };
    },
  });
  assert.deepEqual(patchedBody, { update_text_elements: { elements: [{ text_run: { content: '' } }] } });

  // Wiki 顶层 replace 显式传 parentType: 'wiki'
  const dir = await mkdtemp(join(tmpdir(), 'feishu-wiki-top-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { writeFile } = await import('node:fs/promises');
  const filePath = join(dir, 'a.txt');
  await writeFile(filePath, 'hello');
  let sentParentType = null;
  await uploadCloudFile({
    cwd: dir,
    path: filePath,
    fileId: 'file_1',
    parentType: 'wiki',
    wikiParentId: undefined,
    name: 'a.txt',
    request: async ({ body }) => {
      sentParentType = body.get('parent_type');
      return { file_token: 'file_1' };
    },
  });
  assert.equal(sentParentType, 'wiki');
});

test('Batch D: autosave discard 解锁失败任务并复位组合态；英文文案按上下文准确返回', async () => {
  const auto = createAutoSave();
  auto.pauseText();
  auto.schedule('k1', async () => { throw new Error('boom'); }, 0);
  assert.equal(await auto.flush(), false);
  auto.discard();
  assert.equal(await auto.flush(), true);

  // 复位组合态后防抖写盘恢复正常
  auto.pauseText();
  assert.equal(await auto.flush(), true);
  let ran = 0;
  auto.schedule('k2', async () => { ran += 1; }, 5);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(ran, 1);

  assert.deepEqual(Object.keys(MESSAGES), ['飞书机器人IM']);
  assert.equal(dictionaries().en['飞书机器人IM'], 'Feishu Bot IM');
});

test('Part 2: 删机器人联动解绑分身、StateStore 延迟批量落盘、inbox 过期清理与共享 Session 路由', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-part2-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  // 1) detachBot 仅在删除宿主机器人时清理 botId 与凭据
  const idStore = await new UserIdentityConfigStore({ path: join(dir, 'id.json') }).load();
  await idStore.save({ botId: 'bot_host' });
  let disconnected = 0;
  const identityMgr = new UserIdentityManager({
    configStore: idStore,
    botConfigStore: { bot: () => null },
    auth: { async status() { return { config: {}, authorization: {} }; }, async disconnect() { disconnected += 1; } },
    connect: { status: { phase: 'idle' }, cancel() {}, dispose() {} },
  });
  assert.equal(await identityMgr.detachBot('bot_other'), false);
  assert.equal(idStore.config.botId, 'bot_host');
  assert.equal(await identityMgr.detachBot('bot_host'), true);
  assert.equal(idStore.config.botId, '');
  assert.equal(disconnected, 1);
  identityMgr.dispose();

  // 2) StateStore.markSeenDeferred 内存即时去重 + flushSeen 合并落盘
  const state = await new StateStore(join(dir, 'state.json')).load();
  state.markSeenDeferred('om_d1', 10_000);
  state.markSeenDeferred('om_d2', 10_000);
  assert.equal(state.hasSeen('om_d1'), true);
  assert.equal(state.value.seen.includes('om_d1'), false);
  await state.flushSeen();
  assert.deepEqual(state.value.seen, ['om_d1', 'om_d2']);

  // 3) InboundContent.cleanupExpired 删除超过 7 天文件、保留新文件
  const inboxDir = join(dir, 'inbox');
  const inbound = new InboundContent({ bot: {}, inboxDir });
  const { mkdir } = await import('node:fs/promises');
  await mkdir(inboxDir, { recursive: true });
  const oldFile = join(inboxDir, 'old.bin');
  const newFile = join(inboxDir, 'new.bin');
  await writeFile(oldFile, 'old');
  await writeFile(newFile, 'new');
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await utimes(oldFile, tenDaysAgo, tenDaysAgo);
  assert.equal(await inbound.cleanupExpired(), 1);
  assert.deepEqual(await readdir(inboxDir), ['new.bin']);

  // 4) 共享 Session 下群 B 触发回合的审批发往群 B；menu.needsQueue 只锁变更绑定的动作
  await state.bindSession('chat:oc_group_a', 'sess_shared');
  await state.bindSession('chat:oc_group_b', 'sess_shared');
  const sentCards = [];
  const bot = {
    async addReaction() { return 'r1'; },
    async removeReaction() {},
    async sendCard(chatId, card) { sentCards.push({ chatId, card }); return `c_${sentCards.length}`; },
    async patchCard() {},
    async sendText() { return 't1'; },
  };
  let rpcIdB = null;
  const bridge = new FeishuBridge({
    bot,
    harness: { async prompt(_sid, _parts, opts) { rpcIdB = opts.requestId; } },
    config: { botOpenId: 'ou_bot', access: { group: 'all', managers: ['ou_admin'] }, mentions: { enabled: true } },
    state,
  });
  await bridge.handleMessage({
    sender: { sender_id: { open_id: 'ou_u1' } },
    message: { message_id: 'om_b1', chat_id: 'oc_group_b', chat_type: 'group', message_type: 'text', content: JSON.stringify({ text: '@_user_1 帮我查下' }), mentions: [{ key: '@_user_1', id: { open_id: 'ou_bot' } }] },
  });
  await bridge.onSessionEvent({ id: 'sess_shared' }, { type: 'turn/start', data: { turn: 1 } });
  await bridge.onSessionEvent({ id: 'sess_shared' }, { type: 'user/message', data: { source: { kind: 'user', rpcId: rpcIdB } } });
  const controller = new AbortController();
  const approvalPromise = bridge.handleApproval({
    toolName: 'bash', reason: 'test', callId: 'c1', signal: controller.signal,
    agent: { session: { id: 'sess_shared', events: [{ type: 'approval/asked', data: { id: 'ap1', callId: 'c1' } }] } },
  }, () => new Promise(() => {}));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sentCards.at(-1)?.chatId, 'oc_group_b');
  controller.abort();
  await approvalPromise;
  bridge.dispose();

  // 5) MenuController: needsQueue 区分轻重动作
  const menu = new MenuController({ bot, harness: {}, state, services: () => ({}), canManage: () => true, forgetSession: () => {} });
  assert.equal(menu.needsQueue('menu_apply'), true);
  assert.equal(menu.needsQueue('new_session_create'), true);
  assert.equal(menu.needsQueue('menu_close'), false);
  assert.equal(menu.needsQueue('stats_toggle'), false);
  assert.equal(menu.needsQueue('session_pick'), false);
  menu.dispose();
});
