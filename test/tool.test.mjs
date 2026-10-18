import assert from 'node:assert/strict';
import { createReturnFileTool, TOOL_NAME, createDeliverTool, DELIVER_TOOL_NAME } from '../src/tool.js';

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
  assert.deepEqual(deliver.parameters.required, ['target', 'text']);
  const out = await deliver.execute({ target: '日报群', text: '早上好' }, { agent: { session: { id: 'sess-9' } } });
  assert.equal(out.targetId, 't1');
  assert.equal(sent[0].sessionId, 'sess-9');
  assert.equal(sent[0].target, '日报群');
  const rendered = deliver.output.render({}, out);
  assert.match(rendered[0].text, /已投递到 t1/);
}

console.log('tool: 9 assertions passed');
