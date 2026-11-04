import assert from 'node:assert/strict';

import { FEISHU_POLICY } from '../src/policy.js';

assert.match(FEISHU_POLICY, /飞书消息发起的轮次会自动用流式卡片回复/);
assert.match(FEISHU_POLICY, /不要为了重复回复本轮调用 im_feishu_send/);
assert.match(FEISHU_POLICY, /Web 发起的轮次默认只回复 Web/);
assert.match(FEISHU_POLICY, /im_feishu_send 只用于独立卡片或文件/);
assert.match(FEISHU_POLICY, /im_feishu_chats \/ im_feishu_people/);
assert.match(FEISHU_POLICY, /at 规则/);
assert.match(FEISHU_POLICY, /先调用 im_feishu_people/);
assert.match(FEISHU_POLICY, /禁止截断/);
assert.ok(!FEISHU_POLICY.includes('@'), 'the policy never uses the @ symbol');

console.log('feishu policy: 10 assertions passed');
