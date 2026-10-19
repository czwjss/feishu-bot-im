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

// 6) 话题同步摘要：也拆成独立的 plugin 行
{
  const SYNC = '<feishu_bot_topic_sync>\n- 话题 #1「测试」：结论\n</feishu_bot_topic_sync>';
  const splitSync = splitLeadingInjectedContext(`${SOURCE}\n\n${SYNC}\n\n继续`);
  assert.equal(splitSync.blocks.length, 2);
  assert.equal(splitSync.blocks[1].text, SYNC);
  assert.equal(splitSync.rest, '继续');
}

// 7) 多个前置 text part（来源 + 话题同步）逐个拆成独立行
{
  const SYNC = '<feishu_bot_topic_sync>\n- 话题 #1「测试」：结论\n</feishu_bot_topic_sync>';
  const multi = rewriteInjectedContextMessages([{
    id: 'm3', role: 'user',
    content: [
      { type: 'text', text: SOURCE },
      { type: 'text', text: SYNC },
      { type: 'text', text: '继续' },
    ],
    source: { kind: 'user', rpcId: 'rpc-3' },
  }], { newId: () => `ctx-${++n}` });
  assert.equal(multi.length, 3, 'both blocks and the user text stay separate');
  assert.deepEqual(multi[0].content, [{ type: 'text', text: SOURCE }]);
  assert.deepEqual(multi[1].content, [{ type: 'text', text: SYNC }]);
  assert.deepEqual(multi[2].content, [{ type: 'text', text: '继续' }]);
}

// 8) 前置块后接图片：块被拆走，图片留在用户消息里
{
  const withImage = rewriteInjectedContextMessages([{
    id: 'm4', role: 'user',
    content: [{ type: 'text', text: SOURCE }, { type: 'image', mediaType: 'image/png', data: 'x' }],
    source: { kind: 'user', rpcId: 'rpc-4' },
  }]);
  assert.equal(withImage.length, 2);
  assert.equal(withImage[1].content[0].type, 'image');
}

// 9) 旁听块：单独拆成 plugin 行
{
  const EAVES = '<feishu_bot_eavesdrop>\n14:00 张三：你好\n</feishu_bot_eavesdrop>';
  const splitEaves = splitLeadingInjectedContext(`${EAVES}\n\n${SOURCE}\n\n正文`);
  assert.equal(splitEaves.blocks.length, 2);
  assert.equal(splitEaves.blocks[0].form, 'eavesdrop');
  assert.equal(splitEaves.rest, '正文');
  const rewritten = rewriteInjectedContextMessages([{
    id: 'm5', role: 'user',
    content: [{ type: 'text', text: EAVES }, { type: 'text', text: '正文' }],
    source: { kind: 'user', rpcId: 'rpc-5' },
  }]);
  assert.equal(rewritten.length, 2);
  assert.equal(rewritten[0].source.form, 'eavesdrop');
  assert.equal(rewritten[1].content[0].text, '正文');
}

// 10) 本条消息提到的人：也拆成独立行
{
  const PEOPLE = '<feishu_bot_people>\n本条消息提到的人：张三(ou_zhang)\n</feishu_bot_people>';
  const splitPeople = splitLeadingInjectedContext(`${PEOPLE}\n\n正文`);
  assert.equal(splitPeople.blocks.length, 1);
  assert.equal(splitPeople.blocks[0].form, 'people');
  assert.equal(splitPeople.rest, '正文');
}

console.log('injected context: 10 scenarios passed');
