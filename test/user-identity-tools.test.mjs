import assert from 'node:assert/strict';

import { NotAuthorizedError } from '../src/user-identity/errors.js';
import {
  MESSAGES_TOOL_NAME,
  ME_TOOL_NAME,
  SEND_TOOL_NAME,
  createMeTool,
  createMessagesTool,
  createSendTool,
  createUserIdentityTools,
} from '../src/user-identity/tools.js';

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
  assert.deepEqual(tools.map((tool) => tool.name), [ME_TOOL_NAME, MESSAGES_TOOL_NAME, SEND_TOOL_NAME]);
  assert.deepEqual([ME_TOOL_NAME, MESSAGES_TOOL_NAME, SEND_TOOL_NAME], ['feishu_avatar_me', 'feishu_avatar_messages', 'feishu_avatar_send']);
  for (const tool of tools) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.execute, 'function');
    assert.equal(typeof tool.output.render, 'function');
  }
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: { name: '陈志文', open_id: 'ou_1', union_id: 'on_1', enterprise_email: 'a@b.c' },
  }));
  const tool = createMeTool({ auth, fetchImpl });
  const value = await tool.execute({}, {});
  assert.equal(value.name, '陈志文');
  assert.equal(value.openId, 'ou_1');
  assert.match(tool.output.render({}, value)[0].text, /陈志文/);
}

{
  const auth = fakeAuth();
  const fetchImpl = fakeFetch(() => ({
    code: 0,
    data: {
      items: [
        { message_id: 'om_1', msg_type: 'text', create_time: '1793849554000', sender: { id: 'ou_2', name: '李四' }, body: { content: JSON.stringify({ text: '发布 0.4.1' }) } },
      ],
      has_more: false,
    },
  }));
  const tool = createMessagesTool({ auth, fetchImpl });
  const value = await tool.execute({ chatId: 'oc_chat', keyword: '0.4.1' }, {});
  assert.equal(value.total, 1);
  assert.equal(value.items[0].senderName, '李四');
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.searchParams.get('container_id'), 'oc_chat');
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
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.searchParams.get('receive_id_type'), 'chat_id');
  assert.equal(body.receive_id, 'oc_chat');
  assert.equal(body.msg_type, 'interactive');
  assert.equal(JSON.parse(body.content).body.elements[0].content, '你好');
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
  // token 过期：刷新后重试一次
  const auth = fakeAuth({ failFirst: true });
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls += 1;
    if (init.headers.authorization === 'Bearer token-stale') {
      return { ok: true, status: 200, json: async () => ({ code: 99991668, msg: 'expired' }) };
    }
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { name: '陈志文', open_id: 'ou_1', union_id: 'on_1' } }) };
  };
  const tool = createMeTool({ auth, fetchImpl });
  assert.equal((await tool.execute({}, {})).name, '陈志文');
  assert.equal(calls, 2);
  assert.equal(auth.calls, 2);
}

{
  const auth = { async requireAccessToken() { throw new NotAuthorizedError(); } };
  const tool = createMeTool({ auth, fetchImpl: async () => ({}) });
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
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', text: '' }, {}), /text 不能为空/);
  await assert.rejects(() => send.execute({ chatId: 'oc_chat', text: 'x'.repeat(8_001) }, {}), /过长/);
}

console.log('im-feishu user identity tools: 41 assertions passed');

// 卡片消息读取原始卡片 JSON 后应展平为可读文本。
import { extractMessageText } from '../src/user-identity/api.js';
const cardText = extractMessageText({
  msg_type: 'interactive',
  body: { content: JSON.stringify({ title: { content: '报告' }, elements: [{ tag: 'markdown', content: '**发布完成**' }] }) },
});
assert.match(cardText, /报告/);
assert.match(cardText, /发布完成/);
assert.ok(!cardText.includes('[卡片]'), 'card text must not fall back to the placeholder');
console.log('im-feishu user identity card text: 3 assertions passed');

// 分身工具必须在描述里写明“本人身份”，并说明不是机器人。
const identityTools = createUserIdentityTools({ auth: {} });
for (const tool of identityTools) {
  assert.ok(tool.name.startsWith('feishu_avatar_'), `${tool.name} keeps the avatar prefix`);
}
const sendTool = identityTools.find((tool) => tool.name === 'feishu_avatar_send');
const messagesTool = identityTools.find((tool) => tool.name === 'feishu_avatar_messages');
assert.match(sendTool.description, /本人身份/);
assert.match(sendTool.description, /不是机器人/);
assert.match(messagesTool.description, /本人身份/);
assert.match(messagesTool.description, /群聊或私聊/);
console.log('im-feishu user identity tool identity: 7 assertions passed');

// 每个分身工具都必须声明 output { schema, render }，否则工具注册会被 Host 拒绝。
for (const tool of createUserIdentityTools({ auth: {}, monitor: { autoReply: {}, inbox: async () => ({ total: 0, items: [] }), createDraft: async () => ({}) } })) {
  assert.ok(tool.output?.schema, `${tool.name} declares an output schema`);
  assert.equal(typeof tool.output?.render, 'function', `${tool.name} declares a renderer`);
}
console.log('im-feishu user identity tool output: 14 assertions passed');
