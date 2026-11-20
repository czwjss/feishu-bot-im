import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConfigStore, StateStore } from '../src/config.js';
import { RuntimeManager } from '../src/runtime.js';
import { FeishuBot } from '../src/feishu.js';
import { historyOptions, historyTimeRange } from '../src/tool-contract.js';
import * as botTools from '../src/tool.js';
import * as avatarTools from '../src/user-identity/tools.js';

const auth = { async requireAccessToken() { return 'test-token'; } };
const response = (data) => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
const message = (i, text = `正文 ${i}`, senderName = '同事') => ({
  message_id: `om_${i}`, chat_id: 'oc_chat', msg_type: 'text', create_time: String(1793849554000 + i),
  sender: { id: 'ou_colleague', id_type: 'open_id', sender_name: senderName, sender_type: 'user' },
  body: { content: JSON.stringify({ text }) },
});
const nativeValue = (tool, value) => {
  const text = tool.output.render({}, value)[0].text;
  return JSON.parse(text.slice(text.indexOf('{')));
};

async function setup(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-tool-reliability-'));
  const configStore = await new ConfigStore(join(dir, 'config.json')).load();
  const states = new Map();
  const bots = new Map();
  const secrets = new Map();
  const manager = new RuntimeManager({
    ctx: { credentials: {
      async resolve(ref) { return { value: secrets.get(ref) }; },
      async describe(ref) { return { configured: secrets.has(ref) }; },
      async set(ref, value) { secrets.set(ref, value); }, async unset(ref) { secrets.delete(ref); },
    } },
    configStore, harness: {}, logger: { info() {}, warn() {}, error() {} }, dataDir: dir,
    openState: async (id) => {
      const state = await new StateStore(join(dir, `${id}.json`)).load();
      states.set(id, state);
      return state;
    },
    verify: async ({ appId }) => ({ name: '同名机器人', openId: `ou_${appId}` }),
    createBot: ({ appId }) => {
      const bot = {
        async startLongConnection({ onState }) { onState('connected'); return 'connected'; }, async stop() {},
        async isInChat() { return true; },
        async sendCard() { return 'om_card'; },
        async uploadFile() { return 'file_key'; }, async uploadImage() { return 'image_key'; },
        async sendFile() { return 'om_file'; }, async sendImage() { return 'om_image'; },
        async getMessage(id) { return { messageId: id, senderId: `ou_${appId}`, senderType: 'app' }; },
        async deleteMessage() { return true; },
        async getChats() { return [{ chatId: 'oc_chat', name: '群聊', chatType: 'group' }]; },
        async getChatMembers() { return [{ name: '同事', openId: 'ou_colleague' }]; },
        async listMessages() { return { items: [message(1)], hasMore: false, pageToken: null }; },
        ...overrides,
      };
      bots.set(appId, bot);
      return bot;
    },
  });
  t.after(async () => { manager.dispose(); await rm(dir, { recursive: true, force: true }); });
  const first = await manager.addBot({ appId: 'cli_test_a', appSecret: 'mock' });
  await states.get(first.id).bindSession('chat:oc_chat', 'session-test');
  const context = { agent: { session: { id: 'session-test', cwd: dir } } };
  return { dir, manager, first, bots, states, context };
}

test('keyword pagination consumes all 60 messages without skipping and preserves long card text in native output', async (t) => {
  const longText = '命中'.repeat(3500) + '末尾不能丢';
  const source = Array.from({ length: 60 }, (_, i) => message(i, `命中 ${i}`));
  source[25] = { ...message(25), msg_type: 'interactive', body: { content: JSON.stringify({ elements: [{ tag: 'markdown', content: longText }] }) } };
  const { manager, context } = await setup(t, {
    async listMessages(_chatId, { pageSize, pageToken }) {
      const offset = Number(pageToken || 0);
      const end = Math.min(source.length, offset + pageSize);
      return { items: source.slice(offset, end), hasMore: end < source.length, pageToken: String(end) };
    },
  });
  const tool = botTools.createMessagesTool({ list: manager.listMessages.bind(manager) });
  const ids = [];
  let pageToken = '';
  for (let page = 0; page < 35; page += 1) {
    const result = await tool.execute({ query: '命中', limit: 2, pageToken }, context);
    assert.deepEqual(nativeValue(tool, result), result, 'native output includes every field, message ID, timestamp and actual cursor');
    ids.push(...result.messages.map((row) => row.messageId));
    if (result.messages.some((row) => row.messageId === 'om_25')) assert.equal(result.messages.find((row) => row.messageId === 'om_25').text, longText);
    assert.ok(result.messages.length <= 2);
    pageToken = result.pageToken;
    if (!result.hasMore) break;
  }
  assert.deepEqual(ids, source.map((row) => row.message_id));
  assert.equal(pageToken, '');
});

test('sparse matches respect scanLimit and retain a cursor even when the result is empty', async (t) => {
  const source = Array.from({ length: 12 }, (_, i) => message(i, '普通正文', i === 11 ? '张三' : '其他人'));
  const { manager, context } = await setup(t, {
    async listMessages(_chatId, { pageSize, pageToken }) {
      const start = Number(pageToken || 0), end = Math.min(12, start + pageSize);
      return { items: source.slice(start, end), hasMore: end < 12, pageToken: String(end) };
    },
  });
  const tool = botTools.createMessagesTool({ list: manager.listMessages.bind(manager) });
  let pageToken = '';
  for (let page = 0; page < 4; page += 1) {
    const result = await tool.execute({ query: '张三', limit: 10, scanLimit: 3, pageToken }, context);
    assert.equal(result.scanned, 3);
    assert.equal(result.matched, page === 3 ? 1 : 0);
    assert.equal(result.hasMore, page < 3);
    pageToken = result.pageToken;
  }
});

test('history rejects contradictory bounds, unsupported fields and stalled cursors', async (t) => {
  const { manager, context, bots } = await setup(t);
  const tool = botTools.createMessagesTool({ list: manager.listMessages.bind(manager) });
  await assert.rejects(tool.execute({ threadId: 'omt_test', startTime: '0' }, context), /threadId 不支持/);
  await assert.rejects(tool.execute({ startTime: '20', endTime: '10' }, context), /早于/);
  await assert.rejects(tool.execute({ limit: 0 }, context), /1–50/);
  await assert.rejects(tool.execute({ limit: 2, pageSize: 3 }, context), /不支持参数 pageSize/);
  assert.deepEqual(historyOptions({ limit: 3, order: 'oldest', query: 'Ａbc' }), { limit: 3, order: 'oldest', query: 'abc' });
  assert.deepEqual(historyTimeRange('1970-01-01T08:00:00+08:00', '10'), { start: 0, end: 10 });
  assert.throws(() => historyTimeRange('-1'), /ISO 8601/);
  assert.throws(() => historyTimeRange('not-a-date'), /ISO 8601/);
  bots.get('cli_test_a').listMessages = async () => ({ items: [], hasMore: true, pageToken: 'stuck' });
  await assert.rejects(tool.execute({ pageToken: 'stuck' }, context), /游标/);
});

test('bot send returns receipts, resolves relative files from the active Session and rejects oversized text', async (t) => {
  const uploaded = [];
  const { dir, manager, first, context } = await setup(t, {
    async uploadFile(bytes) { uploaded.push(bytes.toString()); return 'file_key'; },
  });
  const fallback = join(dir, 'bot-default');
  await mkdir(fallback);
  await writeFile(join(fallback, 'report.txt'), 'wrong directory');
  await writeFile(join(dir, 'report.txt'), 'active workspace');
  await writeFile(join(dir, 'picture.png'), 'fake image bytes');
  await manager.runtimeForBot(first.id).save({ workspace: fallback });
  const tool = botTools.createSendTool({ send: manager.send.bind(manager) });
  const card = await tool.execute({ text: '收到' }, context);
  assert.equal(card.messageId, 'om_card');
  assert.deepEqual(nativeValue(tool, card), card);
  const file = await tool.execute({ path: 'report.txt' }, context);
  assert.equal(file.messageId, 'om_file');
  assert.deepEqual(uploaded, ['active workspace']);
  const image = await tool.execute({ path: 'picture.png' }, context);
  assert.equal(image.kind, 'image');
  assert.equal(image.messageId, 'om_image');
  await assert.rejects(tool.execute({ text: '字'.repeat(4001) }, context), /过长/);
  await assert.rejects(tool.execute({ text: '正常', title: '字'.repeat(101) }, context), /最多 100/);
});

test('cancellation during target verification or upload prevents the later send', async (t) => {
  const checked = Promise.withResolvers(), upload = Promise.withResolvers();
  const enteredCheck = Promise.withResolvers(), enteredUpload = Promise.withResolvers();
  let sent = 0;
  const { manager, dir, bots, context } = await setup(t, {
    async isInChat() { enteredCheck.resolve(); return checked.promise; },
    async sendCard() { sent += 1; return 'om_card'; },
    async uploadFile() { enteredUpload.resolve(); return upload.promise; },
    async sendFile() { sent += 1; return 'om_file'; },
  });
  const tool = botTools.createSendTool({ send: manager.send.bind(manager) });
  const first = new AbortController();
  const card = tool.execute({ text: 'cancel me' }, { ...context, signal: first.signal });
  await enteredCheck.promise;
  first.abort(new Error('cancel target check'));
  checked.resolve(true);
  await assert.rejects(card, /cancel target check/);
  bots.get('cli_test_a').isInChat = async () => true;
  await writeFile(join(dir, 'report.txt'), 'test');
  const second = new AbortController();
  const file = tool.execute({ path: 'report.txt' }, { ...context, signal: second.signal });
  await enteredUpload.promise;
  second.abort(new Error('cancel upload'));
  upload.resolve('file_key');
  await assert.rejects(file, /cancel upload/);
  assert.equal(sent, 0);
});

test('recall uses Session bot ownership and rejects another sender; duplicate names require a stable ID', async (t) => {
  const { manager, first, bots, context } = await setup(t);
  await manager.addBot({ appId: 'cli_test_b', appSecret: 'mock' });
  let recalled = '';
  bots.get('cli_test_a').deleteMessage = async (id, options) => { assert.equal(options.strict, true); recalled = id; return true; };
  const tool = botTools.createRecallTool({ recall: manager.recall.bind(manager) });
  assert.equal((await tool.execute({ messageId: 'om_own' }, context)).recalled, true);
  assert.equal(recalled, 'om_own');
  bots.get('cli_test_a').getMessage = async () => ({ senderId: 'ou_cli_test_b', senderType: 'app' });
  await assert.rejects(tool.execute({ messageId: 'om_other' }, context), /自己发送/);
  assert.equal(recalled, 'om_own');
  await assert.rejects(manager.send({ bot: '同名机器人', chatId: 'oc_chat', text: 'x' }), /多个同名/);
  assert.equal((await manager.send({ bot: first.id, chatId: 'oc_other', text: 'x' })).chatId, 'oc_other', 'explicit send targets remain supported');
});

test('SDK recall does not report business failure as success; missing delivery receipts fail explicitly', async () => {
  const bot = new FeishuBot({ appId: 'test', appSecret: 'test', client: { im: { v1: { message: {
    async delete() { return { code: 230011, msg: 'recall forbidden' }; },
    async create() { return { code: 0, data: {} }; },
  } } } } });
  assert.equal(await bot.deleteMessage('om_test'), false, 'background cleanup remains best effort');
  await assert.rejects(bot.deleteMessage('om_test', { strict: true }), /recall forbidden/);
  await assert.rejects(bot.sendFile('oc_chat', 'key', 'file.txt'), /message_id/);
  await assert.rejects(bot.sendImage('oc_chat', 'key'), /message_id/);
});

test('real SDK receives separate cancellation signals across concurrent requests, including token acquisition', async () => {
  const reached = Promise.withResolvers();
  const calls = [];
  const pending = [];
  const bot = new FeishuBot({ appId: `cli_test_${randomUUID()}`, appSecret: 'mock', httpInstance: {
    async request(options) {
      calls.push(options);
      if (options.url.includes('tenant_access_token')) return { code: 0, tenant_access_token: 'mock', expire: 7200 };
      const deferred = Promise.withResolvers();
      options.signal.addEventListener('abort', () => deferred.reject(options.signal.reason), { once: true });
      pending.push({ ...deferred, signal: options.signal });
      if (pending.length === 2) reached.resolve();
      return deferred.promise;
    },
  } });
  const first = new AbortController(), second = new AbortController();
  const a = bot.sendCard('oc_first', {}, { signal: first.signal });
  const b = bot.sendCard('oc_second', {}, { signal: second.signal });
  await reached.promise;
  const rejected = assert.rejects(a, /first cancelled/);
  first.abort(new Error('first cancelled'));
  pending.find((entry) => entry.signal === second.signal).resolve({ code: 0, data: { message_id: 'om_second' } });
  await rejected;
  assert.equal(await b, 'om_second');
  assert.ok(calls.filter((row) => row.url.includes('tenant_access_token')).every((row) => row.signal === first.signal || row.signal === second.signal));
  assert.equal(calls.filter((row) => row.url.includes('/im/v1/messages')).length, 2);
});

test('cancellation stops retry delay before a second card attempt', async () => {
  const entered = Promise.withResolvers();
  let attempts = 0;
  const bot = new FeishuBot({ appId: 'test', appSecret: 'test', client: { im: { v1: { message: {
    async create() { attempts += 1; entered.resolve(); throw Object.assign(new Error('transient'), { code: 'ECONNRESET' }); },
  } } } } });
  const controller = new AbortController();
  const request = bot.sendCard('oc_chat', {}, { signal: controller.signal });
  await entered.promise;
  // Let the failed request enter its retry timer, then cancel it.
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(attempts, 1);
});

test('avatar history accepts only current parameters and matches actual sender_name', async () => {
  const queries = [];
  const tool = avatarTools.createMessagesTool({ auth, fetchImpl: async (url) => {
    queries.push(new URL(url).searchParams);
    return response({ items: [message(1, '无关键词正文', '张三')], has_more: true, page_token: 'avatar_next' });
  } });
  const value = await tool.execute({ chatId: 'oc_chat', limit: 5, order: 'oldest', query: '张三' });
  assert.equal(value.total, 1);
  assert.equal(value.scanned, 1);
  assert.equal(value.items[0].senderName, '张三');
  assert.match(value.items[0].createTime, /Z$/);
  assert.deepEqual(nativeValue(tool, value), value);
  assert.equal(queries.at(-1).get('page_size'), '5');
  assert.equal(queries.at(-1).get('sort_type'), 'ByCreateTimeAsc');
  assert.equal(queries.at(-1).get('with_sender_name'), 'true');
  for (const [key, value] of [['pageSize', 5], ['sort', 'asc'], ['keyword', '张三']]) {
    await assert.rejects(tool.execute({ chatId: 'oc_chat', [key]: value }), new RegExp(`不支持参数 ${key}`));
  }
  assert.equal(queries.length, 1, 'rejected fields cannot issue an API request');
});

test('avatar reply verifies the original chat and aborts before POST on mismatch', async () => {
  let posts = 0;
  const tool = avatarTools.createSendTool({ auth, fetchImpl: async (_url, init) => {
    if (init.method === 'POST') { posts += 1; return response({ message_id: 'om_reply', chat_id: 'oc_other' }); }
    return response({ items: [{ ...message(1), chat_id: 'oc_other' }] });
  } });
  await assert.rejects(tool.execute({ chatId: 'oc_chat', text: 'x', replyToMessageId: 'om_1' }), /不属于指定/);
  assert.equal(posts, 0);
  assert.equal((await tool.execute({ chatId: 'oc_other', text: 'x', replyToMessageId: 'om_1' })).messageId, 'om_reply');
  assert.equal(posts, 1);
});

test('avatar cancellation during token lookup prevents any request; absent send receipts are errors', async () => {
  const entered = Promise.withResolvers(), token = Promise.withResolvers();
  let requests = 0;
  const tool = avatarTools.createSendTool({
    auth: { async requireAccessToken() { entered.resolve(); return token.promise; } },
    fetchImpl: async () => { requests += 1; return response({}); },
  });
  const controller = new AbortController();
  const sending = tool.execute({ chatId: 'oc_chat', text: 'hello' }, { signal: controller.signal });
  await entered.promise;
  controller.abort();
  token.resolve('test-token');
  await assert.rejects(sending, { name: 'AbortError' });
  assert.equal(requests, 0);
  const missingReceipt = avatarTools.createSendTool({ auth, fetchImpl: async () => response({}) });
  await assert.rejects(missingReceipt.execute({ chatId: 'oc_chat', text: 'hello' }), /message_id/);
});

function assertSchema(schema, value) {
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((variant) => variant.required.every((key) => Object.hasOwn(value, key)));
    assert.equal(matches.length, 1);
    assertSchema(matches[0], value);
  } else if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key), `required output: ${key}`);
    for (const [key, child] of Object.entries(value)) {
      assert.ok(schema.properties[key], `undeclared output: ${key}`);
      assertSchema(schema.properties[key], child);
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value));
    value.forEach((item) => assertSchema(schema.items, item));
  } else if (schema.type === 'integer') {
    assert.ok(Number.isInteger(value));
  } else {
    assert.equal(typeof value, schema.type);
    if (schema.enum) assert.ok(schema.enum.includes(value));
  }
}

test('all eight tools return schema-compliant values and complete native projections, including >20 chats', async (t) => {
  const { manager, first, context } = await setup(t, {
    async getChats() { return Array.from({ length: 25 }, (_, i) => ({ chatId: `oc_${i}`, name: `群 ${i}`, chatType: 'group' })); },
    async getChatInfo() { return { name: '当前私聊', chatType: 'p2p' }; },
    async getChatMembers() { return Array.from({ length: 12 }, (_, i) => ({ name: `同事 ${i}`, openId: `ou_${i}` })); },
  });
  const fetchImpl = async (url, init) => {
    if (String(url).includes('/user_info')) return response({ name: '本人', open_id: 'ou_self', union_id: 'on_self', email: 'a@example.com', avatar_url: 'https://example.com/avatar.png' });
    if (init.method === 'POST') return response({ message_id: 'om_sent', chat_id: 'oc_chat' });
    return response({ items: [message(1)], has_more: false });
  };
  const cases = [
    [botTools.createSendTool({ send: manager.send.bind(manager) }), { text: 'hello' }],
    [botTools.createMessagesTool({ list: manager.listMessages.bind(manager) }), {}],
    [botTools.createChatsTool({ list: manager.listChats.bind(manager) }), {}],
    [botTools.createPeopleTool({ find: manager.findPeople.bind(manager) }), { query: '同事' }],
    [botTools.createRecallTool({ recall: manager.recall.bind(manager) }), { messageId: 'om_own' }],
    [avatarTools.createMeTool({ auth, fetchImpl }), {}],
    [avatarTools.createMessagesTool({ auth, fetchImpl }), { chatId: 'oc_chat' }],
    [avatarTools.createSendTool({ auth, fetchImpl }), { chatId: 'oc_chat', text: 'hello' }],
  ];
  for (const [tool, args] of cases) {
    const value = await tool.execute(args, context);
    assertSchema(tool.output.schema, value);
    assert.deepEqual(nativeValue(tool, value), value, `${tool.name}: Native and PTC must see the same facts`);
    if (tool.name === 'feishu_bot_chats') {
      assert.equal(value.chats.length, 26);
      assert.ok(value.chats.every((chat) => chat.botId === first.id));
      assert.equal(value.chats.find((chat) => chat.chatId === 'oc_chat').chatType, 'p2p');
    }
    if (tool.name === 'feishu_bot_people') {
      assert.equal(value.matched, 12);
      assert.equal(value.people.length, 10);
      assert.equal(value.hasMore, true);
    }
  }
});

test('both history tools open only the selected image from the specified chat', async (t) => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const body = JSON.stringify({ content: [[{ tag: 'img', image_key: 'img_first' }, { tag: 'img', image_key: 'img_second' }]] });
  const item = { ...message(2), msg_type: 'post', body: { content: body } };
  const target = { action: 'read_image', chatId: 'oc_chat', messageId: 'om_2', imageIndex: 2 };
  const botDownloads = [];
  const { manager, context } = await setup(t, {
    async listMessages() { return { items: [item], hasMore: false }; },
    async getMessage() { return { messageId: 'om_2', chatId: 'oc_chat', msgType: 'post', bodyContent: body }; },
    async downloadResource(messageId, key, type, { maxBytes }) {
      botDownloads.push([messageId, key, type, maxBytes]);
      return png;
    },
  });
  const stored = [];
  const harness = {
    imageLimits: { maxImageBytes: 512, maxMessageImageBytes: 256, mediaTypes: ['image/png'] },
    async saveImage({ data, mediaType, name }) {
      assert.deepEqual(data, png);
      stored.push(name);
      return { attachmentId: 'image-ref', mediaType, name, width: 1, height: 1, bytes: data.length };
    },
  };
  const avatarDownloads = [];
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers.authorization, 'Bearer test-token');
    if (url.pathname.includes('/resources/')) {
      avatarDownloads.push([url.pathname, url.searchParams.get('type')]);
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }
    return response({ items: [item], has_more: false });
  };
  const bot = botTools.createMessagesTool({
    list: manager.listMessages.bind(manager), downloadImage: manager.downloadMessageImage.bind(manager), harness,
  });
  const avatar = avatarTools.createMessagesTool({ auth, fetchImpl, harness });
  assert.equal((await bot.execute({}, context)).messages[0].imageCount, 2);
  assert.equal((await avatar.execute({ chatId: 'oc_chat' }, context)).items[0].imageCount, 2);
  assert.deepEqual(botDownloads, []);
  assert.deepEqual(avatarDownloads, []);
  for (const tool of [bot, avatar]) {
    await assert.rejects(tool.execute({ ...target, chatId: 'oc_other' }, context), /不属于指定会话/);
    await assert.rejects(tool.execute({ ...target, imageIndex: 3 }, context), /imageIndex 超出范围/);
    const value = await tool.execute(target, context);
    assertSchema(tool.output.schema, value);
    assert.deepEqual(tool.output.render(target, value)[1], { type: 'image', attachment: value.image });
  }
  assert.deepEqual(botDownloads, [['om_2', 'img_second', 'image', 256]]);
  assert.deepEqual(avatarDownloads, [['/open-apis/im/v1/messages/om_2/resources/img_second', 'image']]);
  assert.deepEqual(stored, ['feishu-om_2-2', 'feishu-om_2-2']);
});
