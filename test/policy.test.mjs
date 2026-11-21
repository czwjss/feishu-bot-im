import assert from 'node:assert/strict';

import { FEISHU_POLICY } from '../src/policy.js';

assert.match(FEISHU_POLICY, /发送内容规则（强制，适用于 feishu_bot_send、feishu_avatar_send 及飞书自动回复）/);
assert.match(FEISHU_POLICY, /飞书来源的轮次由桥接自动流式回复/);
assert.match(FEISHU_POLICY, /不要再调用 feishu_bot_send 重复发送/);
assert.match(FEISHU_POLICY, /旁听只提供最近实时上下文/);
assert.match(FEISHU_POLICY, /用 feishu_bot_messages 回查/);
assert.match(FEISHU_POLICY, /feishu_message_attachment/);
assert.match(FEISHU_POLICY, /at 规则/);
assert.match(FEISHU_POLICY, /feishu_bot_people \/ feishu_avatar_people/);
assert.match(FEISHU_POLICY, /不要猜测或留占位符/);
assert.ok(!FEISHU_POLICY.includes('@'), 'the policy never uses the @ symbol');

console.log('feishu policy: 10 assertions passed');

// 只有一套 policy：机器人与分身的规则都在 FEISHU_POLICY 里，标题规则只出现一次。
assert.match(FEISHU_POLICY, /feishu_bot_send/);
assert.match(FEISHU_POLICY, /feishu_avatar_send/);
assert.match(FEISHU_POLICY, /<feishu_avatar_identity>/);
assert.match(FEISHU_POLICY, /飞书分身（用户身份）规则/);
assert.equal(FEISHU_POLICY.split('\n').filter((line) => line.includes('标题按需')).length, 1);
// 工具能力与参数规则只写一次：policy 不复述工具清单，也不重复参数机制。
for (const toolName of ['feishu_avatar_doc_read', 'feishu_avatar_doc_write', 'feishu_avatar_doc_file', 'feishu_bot_chats', 'feishu_avatar_chats']) {
  assert.ok(!FEISHU_POLICY.includes(toolName), `policy does not restate the ${toolName} tool definition`);
}
assert.ok(!FEISHU_POLICY.includes('confirm: true'), 'confirm 是参数机制，只在参数描述里说明');
console.log('feishu single policy: 10 assertions passed');

// 关键行为约束全部保留，且通用规则位于分身规则段之前。
for (const rule of [
  /标题按需/,
  /不要猜测或留占位符/,
  /不要与机器人身份 feishu_bot_\* 混用/,
  /不可信数据/,
  /写入或删除只按用户明确要求执行/,
]) {
  assert.match(FEISHU_POLICY, rule);
}
const avatarSectionAt = FEISHU_POLICY.indexOf('飞书分身（用户身份）规则');
assert.match(FEISHU_POLICY, /私聊不引用/);
assert.match(FEISHU_POLICY, /引用最后一条待回消息/);
assert.match(FEISHU_POLICY, /多人发言时不引用/);
assert.ok(FEISHU_POLICY.indexOf('回复引用规则') < avatarSectionAt, 'quoting rule is generic');
assert.ok(FEISHU_POLICY.indexOf('不可信数据') < avatarSectionAt, 'untrusted-content rule is generic');
console.log('feishu policy guardrails: 10 assertions passed');
