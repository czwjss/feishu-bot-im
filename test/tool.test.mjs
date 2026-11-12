import assert from 'node:assert/strict';

import {
  CHATS_TOOL_NAME,
  createChatsTool,
  createMessagesTool,
  MESSAGES_TOOL_NAME,
  createPeopleTool,
  createRecallTool,
  createSendTool,
  PEOPLE_TOOL_NAME,
  SEND_TOOL_NAME,
} from '../src/tool.js';

// 发送工具：文本和文件二选一
{
  const calls = [];
  const tool = createSendTool({
    send: async (input) => {
      calls.push(input);
      return input.path
        ? { kind: 'file', chatId: 'oc_daily', fileName: 'a.txt', bytes: 3 }
        : { kind: 'card', chatId: 'oc_daily', sentAt: '2026-11-04T00:00:00.000Z' };
    },
  });
  assert.equal(tool.name, SEND_TOOL_NAME);
  assert.deepEqual(Object.keys(tool.parameters.properties), ['bot', 'chatId', 'title', 'color', 'text', 'path', 'name']);
  const text = await tool.execute({ title: '问候', color: 'blue', text: '早上好' }, { agent: { session: { id: 'sess-1' } } });
  assert.equal(text.kind, 'card');
  assert.equal(calls[0].sessionId, 'sess-1');
  assert.equal(calls[0].text, '早上好');
  assert.equal(calls[0].title, '问候');
  assert.equal(calls[0].color, 'blue');
  assert.equal(calls[0].path, undefined);
  assert.match(tool.output.render({}, text)[0].text, /已发送卡片到 oc_daily/);

  const file = await tool.execute({ path: '/tmp/a.txt', name: '报告.txt' }, { agent: { session: { id: 'sess-1' } } });
  assert.equal(file.kind, 'file');
  assert.equal(calls[1].path, '/tmp/a.txt');
  assert.equal(calls[1].name, '报告.txt');
  assert.match(tool.output.render({}, file)[0].text, /已把「a.txt」/);

  await assert.rejects(() => tool.execute({}, {}), /text 和 path/);
  await assert.rejects(() => tool.execute({ text: 'x', path: '/tmp/a' }, {}), /text 和 path/);
  await assert.rejects(() => tool.execute({ path: '/tmp/a', title: 'x' }, {}), /title\/color 仅用于文本卡片/);
  const noTitle = await tool.execute({ text: '无标题', color: 'blue' }, { agent: { session: { id: 'sess-1' } } });
  assert.equal(noTitle.kind, 'card');
  assert.equal(calls.at(-1).color, 'blue');
  const supported = await tool.execute({ title: '紫色标题', color: 'purple', text: 'x' }, { agent: { session: { id: 'sess-1' } } });
  assert.equal(supported.kind, 'card');
  assert.equal(calls.at(-1).color, 'purple');
  const fallback = await tool.execute({ title: '回退', color: 'pink', text: 'x' }, { agent: { session: { id: 'sess-1' } } });
  assert.equal(fallback.kind, 'card');
  assert.equal(calls.at(-1).color, 'grey');
}

// 历史消息工具
{
  const calls = [];
  const tool = createMessagesTool({
    list: async (input) => {
      calls.push(input);
      return {
        chatId: 'oc_daily', threadId: '', query: '上线', scanned: 80, matched: 1,
        hasMore: true, pageToken: 'pt_2',
        messages: [{
          messageId: 'om_1', time: '2026-11-04T10:00:00.000Z', senderId: 'ou_chen',
          senderName: '陈志文', type: 'text', text: '今晚上线', threadId: '',
        }],
      };
    },
  });
  assert.equal(tool.name, MESSAGES_TOOL_NAME);
  const result = await tool.execute(
    { chatId: 'oc_daily', query: '上线', limit: 10, scanLimit: 80, order: 'newest' },
    { agent: { session: { id: 'sess-1' } } },
  );
  assert.equal(calls[0].sessionId, 'sess-1');
  assert.equal(calls[0].query, '上线');
  assert.equal(calls[0].scanLimit, 80);
  assert.equal(result.matched, 1);
  assert.match(tool.output.render({}, result)[0].text, /匹配 1 条，扫描 80 条/);
  assert.match(tool.output.render({}, result)[0].text, /陈志文：今晚上线/);
  assert.match(tool.output.render({}, result)[0].text, /还有更多/);
}

// 群发现工具
{
  const list = [];
  const chats = createChatsTool({
    list: async (input) => {
      list.push(input);
      return [
        { bot: 'bot_default', chatId: 'oc_daily', title: '日报群', sessionId: 'sess-9', kind: 'chat', topics: 2 },
        { bot: 'bot_default', chatId: 'oc_ops', title: '', sessionId: 'sess-10', kind: 'topic', topics: 1 },
      ];
    },
  });
  assert.equal(chats.name, CHATS_TOOL_NAME);
  const result = await chats.execute({ bot: 'bot_default', refresh: true });
  assert.equal(list[0].bot, 'bot_default');
  assert.equal(list[0].refresh, true);
  assert.equal(result.chats.length, 2);
  assert.equal(result.chats[0].chatId, 'oc_daily');
  assert.equal(result.chats[1].title, '');
  assert.match(chats.output.render({}, result)[0].text, /日报群（oc_daily，bot_default）/);
  assert.match(chats.output.render({}, { chats: [] })[0].text, /没有可用/);
}

// 人物模糊查询工具
{
  const calls = [];
  const people = createPeopleTool({
    find: async (input) => {
      calls.push(input);
      return { chatId: 'oc_daily', people: [{ name: '陈志文', openId: 'ou_chen' }] };
    },
  });
  assert.equal(people.name, PEOPLE_TOOL_NAME);
  assert.deepEqual(people.parameters.required, ['query']);
  const result = await people.execute(
    { query: '志文', refresh: true },
    { agent: { session: { id: 'sess-9' } } },
  );
  assert.equal(calls[0].sessionId, 'sess-9');
  assert.equal(calls[0].query, '志文');
  assert.equal(calls[0].refresh, true);
  assert.equal(result.people[0].openId, 'ou_chen');
  assert.match(people.output.render({}, result)[0].text, /陈志文（ou_chen）/);
  assert.match(people.output.render({}, { chatId: 'oc_daily', people: [] })[0].text, /没有找到/);
}

console.log('tool: 38 assertions passed');

// 机器人侧工具统一 feishu_bot_ 前缀，并在描述里写明身份，避免和 feishu_avatar_* 混淆。
{
  const stub = { send: async () => ({}), list: async () => [], find: async () => ({}) };
  const tools = [
    createSendTool(stub),
    createMessagesTool(stub),
    createChatsTool(stub),
    createPeopleTool(stub),
  ];
  assert.ok(tools.every((tool) => tool.name.startsWith('feishu_bot_')), 'bot tools share the feishu_bot_ prefix');
  assert.deepEqual(tools.map((tool) => tool.name), [
    SEND_TOOL_NAME, MESSAGES_TOOL_NAME, CHATS_TOOL_NAME, PEOPLE_TOOL_NAME,
  ]);
  assert.ok(tools[0].description.includes('机器人身份'), 'bot send states its identity');
  assert.ok(tools[1].description.includes('机器人身份'), 'bot messages states its identity');
  assert.ok(!tools[0].description.includes('授权用户本人的身份'), 'bot tools never claim the user identity');
}
console.log('feishu tool naming: 4 assertions passed');

// 输出必须与运行时返回的字段一致，否则 Host 会拒绝工具结果。
{
  const tool = createMessagesTool({
    list: async () => ({
      chatId: 'oc_x', threadId: '', query: '', scanned: 1, matched: 1, hasMore: false, pageToken: '',
      messages: [{
        messageId: 'om_1', at: Date.now(), time: new Date().toISOString(),
        senderId: 'ou_x', senderName: '同事', type: 'text', text: '你好', threadId: '',
      }],
    }),
  });
  const value = await tool.execute({});
  const declared = Object.keys(tool.output.schema.properties.messages.items.properties);
  for (const row of value.messages) {
    for (const key of Object.keys(row)) {
      assert.ok(declared.includes(key), `${key} must be declared in the output schema`);
    }
  }
}
console.log('feishu tool output schema: 8 assertions passed');

// 撤回工具：只声明一个 messageId，结果二值。
{
  const calls = [];
  const tool = createRecallTool({ recall: async (input) => { calls.push(input); return { recalled: true, messageId: input.messageId }; } });
  assert.equal(tool.name, 'feishu_bot_recall');
  const value = await tool.execute({ messageId: 'om_1' });
  assert.equal(value.recalled, true);
  assert.deepEqual(calls, [{ bot: undefined, messageId: 'om_1' }]);
  await assert.rejects(() => tool.execute({}), /messageId/);
  const text = tool.output.render({}, { recalled: false, messageId: 'om_2' })[0].text;
  assert.match(text, /撤回失败/);
}
console.log('feishu recall tool: 5 assertions passed');
