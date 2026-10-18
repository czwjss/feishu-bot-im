import assert from 'node:assert/strict';
import { splitLeadingInjectedContext, rewriteInjectedContextMessages } from '../src/injected-context.js';

const SOURCE = '<feishu_bot_source>{"channel":"feishu","senderId":"ou_1"}</feishu_bot_source>';
const GUIDANCE = '<feishu_bot_source_guidance>\n你是秘书\n</feishu_bot_source_guidance>';

// 1) 拆分：两个块 + 正文
const split = splitLeadingInjectedContext(`${SOURCE}\n\n${GUIDANCE}\n\n你好`);
assert.equal(split.blocks.length, 2);
assert.equal(split.blocks[0].form, 'source');
assert.equal(split.blocks[1].form, 'guidance');
assert.equal(split.rest, '你好');

// 2) 没有块时返回 null
assert.equal(splitLeadingInjectedContext('你好'), null);

// 3) 重写：用户消息保留正文，块变成 plugin 来源消息
let n = 0;
const messages = [
  {
    id: 'm1',
    role: 'user',
    content: [{ type: 'text', text: `${SOURCE}\n\n${GUIDANCE}` }, { type: 'text', text: '你好' }],
    source: { kind: 'user', rpcId: 'rpc-1' },
  },
];
const rewritten = rewriteInjectedContextMessages(messages, { newId: () => `ctx-${++n}` });
assert.equal(rewritten.length, 3);
assert.deepEqual(rewritten[0], {
  id: 'ctx-1', role: 'user',
  content: [{ type: 'text', text: SOURCE }],
  source: { kind: 'plugin:im-feishu', form: 'source' },
});
assert.equal(rewritten[1].source.form, 'guidance');
assert.equal(rewritten[2].id, 'm1');
assert.deepEqual(rewritten[2].content, [{ type: 'text', text: '你好' }]);
assert.equal(rewritten[2].source.rpcId, 'rpc-1');

// 4) 不认识的来源 / 无块的消息原样保留
assert.equal(rewriteInjectedContextMessages([
  { id: 'a', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user', rpcId: 'r' } },
  { id: 'b', role: 'assistant', content: [{ type: 'text', text: 'yo' }], source: { kind: 'model' } },
]), null);

// 5) 拆完没有正文时不动消息（返回 null），绝不丢用户的话
const onlyBlock = [{
  id: 'm2', role: 'user',
  content: [{ type: 'text', text: SOURCE }],
  source: { kind: 'user', rpcId: 'rpc-2' },
}];
assert.equal(rewriteInjectedContextMessages(onlyBlock), null, 'empty body must keep the original message');

console.log('injected context: 6 scenarios passed');

// 6) 话题同步摘要：也拆成独立的 plugin 行
{
  const SYNC = '<feishu_bot_topic_sync>\n- 话题 #1「测试」：结论\n</feishu_bot_topic_sync>';
  const splitSync = splitLeadingInjectedContext(`${SOURCE}\n\n${SYNC}\n\n继续`);
  assert.equal(splitSync.blocks.length, 2);
  assert.equal(splitSync.blocks[1].text, SYNC);
  assert.equal(splitSync.rest, '继续');
}
