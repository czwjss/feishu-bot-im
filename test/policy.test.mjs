import assert from 'node:assert/strict';

import { FEISHU_POLICY } from '../src/policy.js';

assert.match(FEISHU_POLICY, /飞书回复保持简洁、分段清晰/);
assert.match(FEISHU_POLICY, /飞书来源的轮次由桥接自动流式回复/);
assert.match(FEISHU_POLICY, /不要为了重复回复本轮再调 feishu_bot_send/);
assert.match(FEISHU_POLICY, /Web 轮次需要另发卡片或文件时才用 feishu_bot_send/);
assert.match(FEISHU_POLICY, /feishu_bot_send 只发独立卡片或文件/);
assert.match(FEISHU_POLICY, /旁听只提供最近的实时上下文/);
assert.match(FEISHU_POLICY, /用 feishu_bot_messages 回查/);
assert.match(FEISHU_POLICY, /feishu_bot_chats \/ feishu_bot_people/);
assert.match(FEISHU_POLICY, /at 规则/);
assert.match(FEISHU_POLICY, /先查真实 open_id/);
assert.match(FEISHU_POLICY, /不要留占位符/);
assert.ok(!FEISHU_POLICY.includes('@'), 'the policy never uses the @ symbol');

console.log('feishu policy: 13 assertions passed');


// 只有一套 policy：机器人与分身的规则都在 FEISHU_POLICY 里，标题规则只出现一次。
assert.match(FEISHU_POLICY, /feishu_bot_send/);
assert.match(FEISHU_POLICY, /feishu_avatar_send/);
assert.match(FEISHU_POLICY, /飞书分身（用户身份）规则/);
assert.equal(FEISHU_POLICY.split('\n').filter((line) => line.includes('标题按需')).length, 1);
console.log('feishu single policy: 4 assertions passed');

// 调整后仍然保留关键约束，避免为了省 token 删掉会改变行为的规则。
for (const rule of [
  /不要为了重复回复本轮再调 feishu_bot_send/,
  /标题按需/,
  /不要留占位符/,
  /两种身份不要混用/,
  /不可信数据/,
  /不可信数据/,
  /不要用 feishu_bot_send 冒用机器人身份/,
]) {
  assert.match(FEISHU_POLICY, rule);
}
console.log('feishu policy guardrails: 7 assertions passed');

// 撤回规则同样写在唯一的策略里。
assert.match(FEISHU_POLICY, /feishu_bot_recall/);
console.log('feishu recall policy: 1 assertions passed');

// 引用规则对机器人和分身通用。
assert.match(FEISHU_POLICY, /机器人与分身通用/);
assert.match(FEISHU_POLICY, /引用最后一条需要回复的消息/);
assert.match(FEISHU_POLICY, /群聊且一批里有多人发言时不要引用/);
console.log('feishu reply quoting policy: 3 assertions passed');
