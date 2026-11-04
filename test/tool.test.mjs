import assert from 'node:assert/strict';
import { createReturnFileTool, TOOL_NAME, createDeliverTool, DELIVER_TOOL_NAME, createChatsTool, CHATS_TOOL_NAME, createPeopleTool, PEOPLE_TOOL_NAME } from '../src/tool.js';

const calls = [];
const tool = createReturnFileTool({
  send: async (input) => { calls.push(input); return { fileName: 'a.txt', bytes: 3, chatId: 'oc_1' }; },
});
assert.equal(tool.name, TOOL_NAME);
assert.deepEqual(Object.keys(tool.parameters.properties), ['path', 'name']);
const value = await tool.execute({ path: '/tmp/a.txt' }, { agent: { session: { id: 'sess-1' } }, signal: new AbortController().signal });
assert.equal(value.fileName, 'a.txt');
assert.equal(calls[0].sessionId, 'sess-1');
assert.equal(calls[0].path, '/tmp/a.txt');
const rendered = tool.output.render({ path: '/tmp/a.txt' }, value);
assert.match(rendered[0].text, /已把「a.txt」/);
await assert.rejects(() => tool.execute({ path: '  ' }, {}), /path/);
// 投递工具
{
  const sent = [];
  const deliver = createDeliverTool({
    send: async (input) => { sent.push(input); return { targetId: 't1', sentAt: '2026-10-18T00:00:00.000Z' }; },
  });
  assert.equal(deliver.name, DELIVER_TOOL_NAME);
  assert.deepEqual(deliver.parameters.required, ['text']);
  const out = await deliver.execute({ target: 'oc_daily', text: '早上好' }, { agent: { session: { id: 'sess-9' } } });
  assert.equal(out.targetId, 't1');
  assert.equal(sent[0].sessionId, 'sess-9');
  assert.equal(sent[0].target, 'oc_daily');
  const bound = await deliver.execute({ text: '用当前绑定' }, { agent: { session: { id: 'sess-9' } } });
  assert.equal(bound.targetId, 't1');
  assert.equal(sent[1].target, undefined, 'an omitted target is resolved by the runtime');
  const rendered = deliver.output.render({}, out);
  assert.match(rendered[0].text, /已投递到 t1/);
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
  const result = await chats.execute({ bot: 'bot_default' });
  assert.equal(list[0].bot, 'bot_default');
  assert.equal(result.chats.length, 2);
  assert.equal(result.chats[0].chatId, 'oc_daily');
  assert.equal(result.chats[1].title, '');
  assert.match(chats.output.render({}, result)[0].text, /日报群（oc_daily，bot_default）/);
  assert.match(chats.output.render({}, { chats: [] })[0].text, /没有绑定/);
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

console.log('tool: 20 assertions passed');
