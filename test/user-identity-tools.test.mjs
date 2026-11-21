import assert from 'node:assert/strict';

import { NotAuthorizedError } from '../src/user-identity/errors.js';
import {
  CHATS_TOOL_NAME,
  DOC_FILE_TOOL_NAME,
  DOC_READ_TOOL_NAME,
  DOC_WRITE_TOOL_NAME,
  MESSAGES_TOOL_NAME,
  PEOPLE_TOOL_NAME,
  RECALL_TOOL_NAME,
  SEND_TOOL_NAME,
  createChatsTool,
  createMessagesTool,
  createSendTool,
  createUserIdentityTools,
} from '../src/user-identity/tools.js';
import { extractMessageText } from '../src/user-identity/api.js';

function fakeAuth({ failFirst = false } = {}) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async requireAccessToken({ force = false } = {}) {
      calls += 1;
      if (failFirst) return force ? 'token-fresh' : 'token-stale';
      return 'token-1';
    },
  };
}

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => handler(String(url), init) };
  };
  return Object.assign(impl, { calls });
}

{
  const tools = createUserIdentityTools({ auth: fakeAuth(), fetchImpl: async () => ({}) });
  assert.deepEqual(tools.map((tool) => tool.name), [
    CHATS_TOOL_NAME,
    PEOPLE_TOOL_NAME,
    MESSAGES_TOOL_NAME,
    SEND_TOOL_NAME,
    RECALL_TOOL_NAME,
    DOC_READ_TOOL_NAME,
    DOC_WRITE_TOOL_NAME,
    DOC_FILE_TOOL_NAME,
  ]);
  for (const tool of tools) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.execute, 'function');
    assert.equal(typeof tool.output.render, 'function');
  }
}

// feishu_avatar_chats：传 query 按群名搜索，省略 query 列出最近活跃会话
{
  const query = '超鸟送实物 - [需求同步群]';
  const auth = fakeAuth();
  const fetchImpl = fakeFetch((url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/open-apis/im/v1/chats') {
      return {
        code: 0,
        data: {
          items: [
            { chat_id: 'oc_recent_1', name: '项目周会', chat_mode: 'group', description: '每周同步', external: false },
            { chat_id: 'oc_recent_p2p', name: '李四', chat_mode: 'p2p', description: '', external: false },
          ],
          has_more: false,
        },
      };
    }
    return {
      code: 0,
      data: parsed.searchParams.has('page_token') ? {
        items: [], has_more: false, notice: '没有更多结果',
      } : {
        items: [
          { meta_data: { chat_id: 'oc_first', name: query, description: '项目一', chat_status: 'normal' } },
          { meta_data: { chat_id: 'oc_second', name: query, external: true } },
          { meta_data: { chat_id: 'invalid-id', name: query } },
          { invalid: true },
        ],
        has_more: true,
        next_page_token: 'next_cursor',
      },
    };
  });
  const tool = createChatsTool({ auth, fetchImpl });
  assert.equal(tool.isConcurrencySafe({}), true);
  await assert.rejects(() => tool.execute({ query: ' ' }), /1–64/);
  await assert.rejects(() => tool.execute({ query: '群'.repeat(65) }), /1–64/);
  await assert.rejects(() => tool.execute({ query, limit: 101 }), /1–100/);
  assert.equal(auth.calls, 0, 'invalid search input should not request credentials');

  const recent = await tool.execute({});
  assert.deepEqual(recent, {
    items: [
      { chatId: 'oc_recent_1', name: '项目周会', chatType: 'group', description: '每周同步', external: false, chatStatus: '' },
      { chatId: 'oc_recent_p2p', name: '李四', chatType: 'p2p', description: '', external: false, chatStatus: '' },
    ],
    hasMore: false,
    pageToken: '',
  });

  const firstPage = await tool.execute({ query: ` ${query} ` });
  assert.deepEqual(firstPage, {
    items: [
      { chatId: 'oc_first', name: query, chatType: 'group', description: '项目一', external: false, chatStatus: 'normal' },
      { chatId: 'oc_second', name: query, chatType: 'group', description: '', external: true, chatStatus: '' },
    ],
    hasMore: true,
    pageToken: 'next_cursor',
  });
  const { url, init } = fetchImpl.calls[1];
  assert.equal(new URL(url).pathname, '/open-apis/im/v2/chats/search');
  assert.equal(new URL(url).searchParams.get('page_size'), '20');
  assert.equal(init.headers.authorization, 'Bearer token-1');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), {
    query: JSON.stringify(query),
    filter: { search_types: ['private', 'external', 'public_joined'], disable_search_by_user: true },
  });
  assert.deepEqual(JSON.parse(tool.output.render({}, firstPage)[0].text), firstPage);

  const secondPage = await tool.execute({ query: JSON.stringify(query), pageToken: firstPage.pageToken });
  assert.deepEqual(secondPage, { items: [], hasMore: false, pageToken: '', notice: '没有更多结果' });
  assert.equal(new URL(fetchImpl.calls[2].url).searchParams.get('page_token'), 'next_cursor');
  assert.equal(JSON.parse(fetchImpl.calls[2].init.body).query, JSON.stringify(query), 'query is not double-quoted');
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({ code: 0, data: { items: [], has_more: true, page_token: 'repeat' } }));
  const tool = createChatsTool({ auth, fetchImpl });
  await assert.rejects(() => tool.execute({ query: '项目', pageToken: 'repeat' }), /分页游标缺失或未前进/);
  assert.equal(JSON.parse(fetchImpl.calls[0].init.body).query, '项目');
}

// feishu_avatar_messages：支持多页 scanLimit 筛选与统一输出字段
{
  const auth = fakeAuth();
  const pages = [
    {
      items: [
        { message_id: 'om_0', msg_type: 'text', create_time: '1793849553000', sender: { id: 'ou_1', name: '张三' }, body: { content: JSON.stringify({ text: '无关消息' }) } },
      ],
      has_more: true,
      page_token: 'p2',
    },
    {
      items: [
        { message_id: 'om_1', msg_type: 'text', create_time: '1793849554000', sender: { id: 'ou_2', name: '李四' }, body: { content: JSON.stringify({ text: '发布 0.4.1' }) } },
      ],
      has_more: false,
    },
  ];
  let idx = 0;
  const fetchImpl = fakeFetch(() => ({ code: 0, data: pages[idx++] }));
  const tool = createMessagesTool({ auth, fetchImpl });
  assert.equal(tool.isConcurrencySafe({}), true);
  const value = await tool.execute({ chatId: 'oc_chat', query: '0.4.1', scanLimit: 10 }, {});
  assert.equal(value.matched, 1);
  assert.equal(value.scanned, 2);
  assert.equal(value.items[0].senderName, '李四');
  assert.equal(value.items[0].senderId, 'ou_2');
  assert.equal(value.items[0].msgType, 'text');
  assert.match(value.items[0].time, /Z$/);
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.searchParams.get('container_id'), 'oc_chat');
  assert.equal(fetchImpl.calls.length, 2, 'multi-page keyword scan advances automatically');
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: { message_id: 'om_sent', chat_id: 'oc_chat', create_time: '1793849554000' },
  }));
  const tool = createSendTool({ auth, fetchImpl });
  const value = await tool.execute({ chatId: 'oc_chat', text: '你好' }, {});
  assert.equal(value.messageId, 'om_sent');
  assert.equal(value.kind, 'card');
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.searchParams.get('receive_id_type'), 'chat_id');
  assert.equal(body.receive_id, 'oc_chat');
  assert.equal(body.msg_type, 'interactive');
  assert.equal(JSON.parse(body.content).body.elements[0].content, '你好');
  assert.equal(JSON.parse(body.content).header, undefined, '短消息不带标题');
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: { message_id: 'om_open', chat_id: 'oc_p2p', create_time: '1793849554000' },
  }));
  const tool = createSendTool({ auth, fetchImpl });
  const value = await tool.execute({ openId: 'ou_1234', text: '联系人你好' }, {});
  const url = new URL(fetchImpl.calls[0].url);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.equal(url.searchParams.get('receive_id_type'), 'open_id');
  assert.equal(body.receive_id, 'ou_1234');
  assert.equal(body.msg_type, 'interactive');
  assert.equal(JSON.parse(body.content).body.elements[0].content, '联系人你好');
  assert.equal(value.chatId, 'oc_p2p');
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: { message_id: 'om_email', chat_id: 'oc_email' },
  }));
  const tool = createSendTool({ auth, fetchImpl });
  const value = await tool.execute({ email: 'friend@example.com', text: '邮件联系人' }, {});
  const url = new URL(fetchImpl.calls[0].url);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.equal(url.searchParams.get('receive_id_type'), 'email');
  assert.equal(body.receive_id, 'friend@example.com');
  assert.equal(body.msg_type, 'interactive');
  assert.equal(value.messageId, 'om_email');
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: { message_id: 'om_titled', chat_id: 'oc_chat' },
  }));
  const tool = createSendTool({ auth, fetchImpl });
  await tool.execute({ chatId: 'oc_chat', title: '部署完成', color: 'green', text: '**服务已上线**' }, {});
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  const card = JSON.parse(body.content);
  assert.equal(card.header.title.content, '部署完成');
  assert.equal(card.header.template, 'green');
  assert.equal(card.body.elements[0].content, '**服务已上线**');
}

{
  // token 过期：刷新后重试一次（以 chats 工具验证 withAccessToken）
  const auth = fakeAuth({ failFirst: true });
  let calls = 0;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    if (init.headers.authorization === 'Bearer token-stale') {
      return { ok: true, status: 200, json: async () => ({ code: 99991668, msg: 'expired' }) };
    }
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { items: [], has_more: false } }) };
  };
  const tool = createChatsTool({ auth, fetchImpl });
  assert.deepEqual((await tool.execute({}, {})).items, []);
  assert.equal(calls, 2);
  assert.equal(auth.calls, 2);
}

{
  const auth = { async requireAccessToken() { throw new NotAuthorizedError(); } };
  const tool = createChatsTool({ auth, fetchImpl: async () => ({}) });
  await assert.rejects(() => tool.execute({}, {}), (error) => error instanceof NotAuthorizedError);
}

{
  const auth = fakeAuth();
  const messages = createMessagesTool({ auth, fetchImpl: async () => ({}) });
  await assert.rejects(() => messages.execute({ chatId: 'bad' }, {}), /oc_/);
  const send = createSendTool({ auth, fetchImpl: async () => ({}) });
  await assert.rejects(() => send.execute({ text: 'x' }, {}), /必须且只能提供一个/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', openId: 'ou_1234', text: 'x' }, {}), /必须且只能提供一个/);
  await assert.rejects(() => send.execute({ openId: 'bad', text: 'x' }, {}), /ou_/);
  await assert.rejects(() => send.execute({ email: 'not-an-email', text: 'x' }, {}), /邮箱/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', title: 'x'.repeat(101), text: 'x' }, {}), /title/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', color: 'green', text: 'x' }, {}), /color/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', text: '' }, {}), /text 和 path/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', text: 'x'.repeat(8_001) }, {}), /过长/);
}

console.log('im-feishu user identity tools: passed');

// 卡片消息读取原始卡片 JSON 后应展平为可读文本。
const cardText = extractMessageText({
  msg_type: 'interactive',
  body: { content: JSON.stringify({ title: { content: '报告' }, elements: [{ tag: 'markdown', content: '**发布完成**' }] }) },
});
assert.match(cardText, /报告/);
assert.match(cardText, /发布完成/);
assert.ok(!cardText.includes('[卡片]'), 'card text must not fall back to the placeholder');
const longCardText = '卡片正文'.repeat(1500) + '末尾约定';
assert.equal(extractMessageText({
  msg_type: 'interactive',
  body: { content: JSON.stringify({ elements: [{ tag: 'markdown', content: longCardText }] }) },
}), longCardText, 'avatar card extraction preserves text beyond the old 2000-character limit');
console.log('im-feishu user identity card text: 3 assertions passed');

// 分身工具统一 feishu_avatar_ 前缀并标明“本人身份”。
const identityTools = createUserIdentityTools({ auth: {} });
for (const tool of identityTools) {
  assert.ok(tool.name.startsWith('feishu_avatar_'), `${tool.name} keeps the avatar prefix`);
  assert.match(tool.description, /本人身份/);
  assert.ok(tool.output?.schema, `${tool.name} declares an output schema`);
  assert.equal(typeof tool.output?.render, 'function', `${tool.name} declares a renderer`);
}
console.log('im-feishu user identity tool identity & output: passed');

// 发送工具支持「回复某条消息」：走 reply 接口而不是新发一条。
{
  const calls = [];
  const tool = createSendTool({
    auth: { async requireAccessToken() { return 'user-token'; } },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: init?.body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 0, data: init.method === 'GET'
          ? { items: [{ message_id: 'om_origin', chat_id: 'oc_chat' }] }
          : { message_id: 'om_reply', chat_id: 'oc_chat', create_time: '1794393900323', msg_type: 'interactive' } }),
      };
    },
  });
  const value = await tool.execute({ chatId: 'oc_chat', text: '收到', replyToMessageId: 'om_origin' });
  assert.equal(value.messageId, 'om_reply');
  assert.match(calls[1].url, /\/messages\/om_origin\/reply$/, 'reply uses the reply endpoint after checking its chat');
  assert.equal(JSON.parse(calls[1].body).msg_type, 'interactive', 'reply stays a card');
  await assert.rejects(() => tool.execute({ chatId: 'oc_x', path: '/tmp/a.txt', replyToMessageId: 'om_1' }), /仅支持文本卡片/);
  await assert.rejects(() => tool.execute({ openId: 'ou_x', text: 'hi', replyToMessageId: 'om_1' }), /需要同时提供 chatId/);
}
console.log('im-feishu user identity reply mode: 5 assertions passed');

// 标题规则只写一次：机制留在参数上，风格留在 policy 里。
{
  const tool = createSendTool({ auth: {}, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: {} }) }) });
  const paramText = tool.parameters.properties.title.description;
  assert.match(paramText, /最多 100 字符/);
  assert.equal(/短消息|总结/.test(paramText), false, '参数只描述取值规则');
  assert.equal(/短消息不写|总结、长内容/.test(tool.description), false, '工具描述不重复风格规则');
}
console.log('im-feishu user identity title rule: 4 assertions passed');
