import assert from 'node:assert/strict';

import { HANDOFF_KEYWORDS, handoffRequestedIn } from '../src/handoff.js';

assert.ok(HANDOFF_KEYWORDS.includes('转人工'));
assert.equal(handoffRequestedIn('你好，麻烦转人工处理一下'), '转人工');
assert.equal(handoffRequestedIn('我要找真人'), '找真人');
assert.equal(handoffRequestedIn('我要投诉你们'), '我要投诉');
assert.equal(handoffRequestedIn('请转人工'), '转人工');
assert.equal(handoffRequestedIn('这个方案我看一下'), null);
assert.equal(handoffRequestedIn(''), null);
assert.equal(handoffRequestedIn(null), null);
console.log('feishu handoff keywords: 8 assertions passed');

// 自定义关键词覆盖默认值；空数组等于关闭。
assert.equal(handoffRequestedIn('走人工通道', ['走人工']), '走人工');
assert.equal(handoffRequestedIn('转人工', ['走人工']), null);
assert.equal(handoffRequestedIn('转人工', []), null);
console.log('feishu handoff custom: 3 assertions passed');
