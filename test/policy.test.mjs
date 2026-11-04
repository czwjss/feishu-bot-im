import assert from 'node:assert/strict';

import { FEISHU_POLICY } from '../src/policy.js';

assert.match(FEISHU_POLICY, /飞书消息发起的轮次会自动用流式卡片回复/);
assert.match(FEISHU_POLICY, /不要为了重复回复本轮再调用 im_feishu_deliver 或 im_feishu_reply/);
assert.match(FEISHU_POLICY, /需要发送文件\/图片时调用 im_feishu_return_file/);
assert.match(FEISHU_POLICY, /Web 发起的轮次默认只回复 Web/);
assert.match(FEISHU_POLICY, /只有用户明确要求把本轮回答发到飞书时/);
assert.match(FEISHU_POLICY, /im_feishu_deliver 只用于另发一条独立文本/);
assert.match(FEISHU_POLICY, /im_feishu_chats \/ im_feishu_people/);
assert.match(FEISHU_POLICY, /at 规则/);
assert.match(FEISHU_POLICY, /先调用 im_feishu_people/);
assert.match(FEISHU_POLICY, /禁止截断/);
assert.ok(!FEISHU_POLICY.includes('@'), 'the policy never uses the @ symbol');

console.log('feishu policy: 11 assertions passed');
