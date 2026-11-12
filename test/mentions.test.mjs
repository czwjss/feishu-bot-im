import assert from 'node:assert/strict';

import { normalizeMentionsConfig, renderMentions } from '../src/mentions.js';
import { normalizeBot } from '../src/config.js';

// 1) 默认：允许 @ 人、禁止 @所有人
assert.deepEqual(normalizeMentionsConfig(undefined), { enabled: true, allowAll: false });
assert.deepEqual(normalizeMentionsConfig({ enabled: false }), { enabled: false, allowAll: false });
assert.deepEqual(normalizeMentionsConfig({ allowAll: true }), { enabled: true, allowAll: true });
assert.deepEqual(normalizeBot({ appId: 'cli_x' }).mentions, { enabled: true, allowAll: false });


// 2) 卡片保留/规范化；文本转成 user_id 形式
assert.equal(renderMentions('请 <at id=ou_zhang></at> 确认', { mode: 'card' }), '请 <at id=ou_zhang></at> 确认');
assert.equal(renderMentions('请 <at id="ou_zhang"></at> 确认', { mode: 'card' }), '请 <at id=ou_zhang></at> 确认');
assert.equal(renderMentions('请 <at id=ou_zhang></at> 确认', { mode: 'text' }), '请 <at user_id="ou_zhang">ou_zhang</at> 确认');

// 3) 形状合法的 id 保留；畸形标签擦除
assert.equal(renderMentions('请 <at id=ou_nobody></at> 确认', { mode: 'card' }), '请 <at id=ou_nobody></at> 确认');
assert.equal(renderMentions('请 <at id=bad id></at> 确认', { mode: 'card' }), '请  确认');
assert.equal(renderMentions('请 <at id=someone></at> 确认', { mode: 'card' }), '请  确认');
assert.equal(renderMentions('请 <at></at> 确认', { mode: 'card' }), '请  确认');

// 4) 关闭 @ 能力时全部擦除
assert.equal(renderMentions('hi <at id=ou_zhang></at>', { mode: 'card', enabled: false }), 'hi ');
assert.equal(renderMentions('hi <at id=ou_zhang></at>', { mode: 'text', enabled: false }), 'hi ');

// 5) @所有人默认禁止；允许时才保留
assert.equal(renderMentions('hi <at id=all></at>', { mode: 'card' }), 'hi ');
assert.equal(renderMentions('hi <at id=all></at>', { mode: 'card', allowAll: true }), 'hi <at id=all></at>');
assert.equal(
  renderMentions('hi <at user_id="all">所有人</at>', { mode: 'text', allowAll: true }),
  'hi <at user_id="all">所有人</at>',
);

// 6) 自闭合 / 带名字的标签也能处理
assert.equal(renderMentions('hi <at id=ou_zhang/>', { mode: 'card' }), 'hi <at id=ou_zhang></at>');
assert.equal(
  renderMentions('hi <at id=ou_zhang>张三</at>', { mode: 'text' }),
  'hi <at user_id="ou_zhang">ou_zhang</at>',
);

console.log('mentions: 8 scenarios passed');
