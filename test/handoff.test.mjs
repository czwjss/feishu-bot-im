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
