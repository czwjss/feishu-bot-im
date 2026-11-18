import assert from 'node:assert/strict';
import test from 'node:test';
import * as bot from '../src/tool.js';
import { createUserIdentityTools } from '../src/user-identity/tools.js';
import { renderToolOutput } from '../src/tool-contract.js';

function tools() {
  const unexpected = () => { throw new Error('invalid input reached the API'); };
  return [
    bot.createSendTool({ send: unexpected }), bot.createMessagesTool({ list: unexpected }),
    bot.createChatsTool({ list: unexpected }), bot.createPeopleTool({ find: unexpected }),
    bot.createRecallTool({ recall: unexpected }),
    ...createUserIdentityTools({ auth: { requireAccessToken: unexpected }, fetchImpl: unexpected }),
  ];
}

test('all tool inputs use closed, typed fields supported by the DSH PTC schema subset', () => {
  // PTC renders an entire input as unknown if any field has an unsupported
  // keyword. Bounds belong in execution validation, not minimum/maximum here.
  const keywords = new Set(['type', 'description', 'default', 'enum', 'const', 'examples', 'title']);
  for (const tool of tools()) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
    for (const [name, schema] of Object.entries(tool.parameters.properties)) {
      assert.ok(['string', 'integer', 'boolean'].includes(schema.type), `${tool.name}.${name}: keep the input guard in sync`);
      for (const key of Object.keys(schema)) assert.ok(keywords.has(key), `${tool.name}.${name}.${key} is not supported by PTC`);
    }
    for (const name of tool.parameters.required ?? []) assert.ok(Object.hasOwn(tool.parameters.properties, name));
  }
  for (const tool of tools().filter((tool) => tool.name.endsWith('_messages'))) {
    for (const field of ['pageSize', 'sort', 'keyword']) assert.equal(Object.hasOwn(tool.parameters.properties, field), false);
    for (const field of ['limit', 'order', 'query']) assert.ok(Object.hasOwn(tool.parameters.properties, field));
  }
});

test('unknown fields, incorrect scalar types and missing required fields fail before any API call', async () => {
  for (const tool of tools()) {
    await assert.rejects(tool.execute({ chat_id: 'oc_chat' }), (error) => error.code === 'INVALID_ARGS' && /chat_id/.test(error.message));
    await assert.rejects(tool.execute([]), (error) => error.code === 'INVALID_ARGS');
    await assert.rejects(tool.execute(null), (error) => error.code === 'INVALID_ARGS');
    for (const name of tool.parameters.required ?? []) {
      await assert.rejects(tool.execute({}), (error) => error.code === 'INVALID_ARGS' && error.message.includes(name));
    }
    for (const [name, schema] of Object.entries(tool.parameters.properties)) {
      const invalid = schema.type === 'string' ? 123 : schema.type === 'boolean' ? 'true' : '20';
      await assert.rejects(tool.execute({ [name]: invalid }), (error) => error.code === 'INVALID_ARGS' && error.message.includes(name));
      if (schema.enum) await assert.rejects(tool.execute({ [name]: 'invalid-enum' }), (error) => error.code === 'INVALID_ARGS');
    }
  }
});

test('both history tools reject removed aliases and enforce limits without relying on PTC type checking', async () => {
  for (const tool of tools().filter((tool) => tool.name.endsWith('_messages'))) {
    for (const [key, value] of [['pageSize', 20], ['sort', 'desc'], ['keyword', '消息']]) {
      await assert.rejects(tool.execute({ chatId: 'oc_chat', [key]: value }), (error) => error.code === 'INVALID_ARGS' && error.message.includes(key));
    }
    for (const limit of [0, 51]) await assert.rejects(tool.execute({ chatId: 'oc_chat', limit }), /1–50/);
  }
});

test('compact native content retains the complete canonical value without pretty-print overhead', () => {
  const value = { hasMore: true, pageToken: 'next_page', messages: Array.from({ length: 20 }, (_, i) => ({
    messageId: `om_${i}`, time: '2026-11-16T12:00:00.000Z', text: '完整正文\n换行保留',
  })) };
  const rendered = renderToolOutput(value)[0].text;
  assert.deepEqual(JSON.parse(rendered), value);
  assert.ok(rendered.length < JSON.stringify(value, null, 2).length);
});
