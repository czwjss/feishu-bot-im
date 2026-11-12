import assert from 'node:assert/strict';

import { chatIdOfKey, interactiveTextOfContent, scopedValue, textOfContentOrPost } from '../src/message-text.js';

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

// 4) 卡片正文也能被引用/旁听读取
assert.equal(interactiveTextOfContent(JSON.stringify({
  header: { title: { content: '报告' } },
  body: { elements: [{ tag: 'markdown', content: '收到，报告已发到当前会话。' }] },
})), '报告\n收到，报告已发到当前会话。');

// 5) 降级卡片里的 text 字符串也要能读出来
assert.equal(interactiveTextOfContent(JSON.stringify({
  title: null,
  elements: [[{ tag: 'text', text: '请升级至最新版本客户端，以查看内容' }]],
})), '请升级至最新版本客户端，以查看内容');

console.log('message text: 13 assertions passed');

// 卡片消息入站：抽成文本，机器人按普通消息处理。
const cardContent = JSON.stringify({
  schema: '2.0',
  header: { title: { content: '回复夸夸' } },
  body: { elements: [{ tag: 'markdown', content: '哈哈，谢谢夸。' }] },
});
assert.equal(textOfContentOrPost({ message_type: 'interactive', content: cardContent }), '回复夸夸\n哈哈，谢谢夸。');
assert.equal(textOfContentOrPost({ message_type: 'interactive', content: JSON.stringify({ schema: '2.0', body: { elements: [{ tag: 'markdown', content: '只有正文' }] } }) }), '只有正文');
assert.equal(textOfContentOrPost({ message_type: 'interactive', content: '{}' }), null);
console.log('feishu card inbound: 5 assertions passed');

// 流式卡片收尾判定：正文里带「正在处理」就是还没写完。
const streaming = (text) => /正在处理|处理中|已收到|正在思考|思考中/.test(text);
assert.equal(streaming('⏳ 已收到，正在处理…'), true);
assert.equal(streaming('评审改到下午三点'), false);
console.log('feishu streaming card settle: 2 assertions passed');

// 卡片流式状态来自 JSON 2.0 的 config.streaming_mode。
import { cardStreamingOf } from '../src/message-text.js';
assert.equal(cardStreamingOf(JSON.stringify({ schema: '2.0', config: { streaming_mode: true } })), true);
assert.equal(cardStreamingOf(JSON.stringify({ schema: '2.0', config: { streaming_mode: false } })), false);
assert.equal(cardStreamingOf(JSON.stringify({ schema: '1.0', title: '旧卡片' })), null);
assert.equal(cardStreamingOf('not json'), null);
console.log('feishu card streaming flag: 4 assertions passed');
