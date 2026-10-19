import assert from 'node:assert/strict';

import { chatIdOfKey, scopedValue, textOfContentOrPost } from '../src/message-text.js';

// 1) 绑定键 → 飞书 chat id：普通会话与话题都必须落到 oc_…
assert.equal(chatIdOfKey('chat:oc_123'), 'oc_123');
assert.equal(chatIdOfKey('topic:oc_123:2'), 'oc_123');
assert.equal(chatIdOfKey('topic:oc_123:12'), 'oc_123');
assert.equal(chatIdOfKey(''), null);
assert.equal(chatIdOfKey(undefined), null);

// 2) 旧的标量/分维度配置都能读
assert.equal(scopedValue('queue', 'group', 'queue'), 'queue');
assert.equal(scopedValue({ direct: 'steer', group: 'queue' }, 'direct', 'queue'), 'steer');
assert.equal(scopedValue(undefined, 'direct', 'queue'), 'queue');

// 3) 文本/富文本提取
assert.equal(textOfContentOrPost({ message_type: 'text', content: JSON.stringify({ text: '你好' }) }), '你好');
assert.equal(textOfContentOrPost({
  message_type: 'post',
  content: JSON.stringify({ title: '标题', content: [[{ tag: 'text', text: '正文' }, { tag: 'a', text: '链接' }]] }),
}), '正文链接');
assert.equal(textOfContentOrPost({ message_type: 'image', content: '{}' }), null);

console.log('message text: 11 assertions passed');
