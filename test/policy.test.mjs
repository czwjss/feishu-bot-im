import assert from 'node:assert/strict';

import { FEISHU_POLICY } from '../src/policy.js';

assert.match(FEISHU_POLICY, /飞书回复保持简洁、分段清晰/);
assert.match(FEISHU_POLICY, /飞书消息发起的轮次会自动用流式卡片回复/);
assert.match(FEISHU_POLICY, /不要为了重复回复本轮调用 feishu_bot_send/);
assert.match(FEISHU_POLICY, /Web 发起的轮次默认只回复 Web/);
assert.match(FEISHU_POLICY, /feishu_bot_send 只用于独立卡片或文件/);
assert.match(FEISHU_POLICY, /旁听只提供最近的实时上下文/);
assert.match(FEISHU_POLICY, /需要历史消息时用 feishu_bot_messages/);
assert.match(FEISHU_POLICY, /feishu_bot_chats \/ feishu_bot_people/);
assert.match(FEISHU_POLICY, /at 规则/);
assert.match(FEISHU_POLICY, /先调用 feishu_bot_people/);
assert.match(FEISHU_POLICY, /禁止截断/);
assert.ok(!FEISHU_POLICY.includes('@'), 'the policy never uses the @ symbol');

console.log('feishu policy: 13 assertions passed');


// 标题风格规则对机器人和分身同时生效，但只维护一份。
import { TITLE_RULE } from '../src/policy.js';
import { USER_IDENTITY_POLICY } from '../src/user-identity/policy.js';
assert.ok(FEISHU_POLICY.includes(TITLE_RULE), 'bot policy carries the shared title rule');
assert.ok(USER_IDENTITY_POLICY.includes(TITLE_RULE), 'avatar policy carries the same rule');
assert.equal(FEISHU_POLICY.split('\n').filter((line) => line === TITLE_RULE).length, 1);
assert.equal(USER_IDENTITY_POLICY.split('\n').filter((line) => line === TITLE_RULE).length, 1);
console.log('feishu shared title policy: 4 assertions passed');
