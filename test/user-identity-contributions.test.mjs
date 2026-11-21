import assert from 'node:assert/strict';

import {
  activationForAvatarTool,
  formatAvatarIdentityContext,
  installUserIdentityContributions,
} from '../src/user-identity/contributions.js';

const sections = [];
const contexts = [];
const registered = [];
const ctx = {
  inject(services, callback) {
    if (services.includes('systemPrompt')) {
      callback({
        systemPrompt: {
          section: (section) => sections.push(section),
          context: (entry) => contexts.push(entry),
        },
      });
    }
    if (services.includes('tools')) {
      callback({
        tools: {
          register: (tool, options) => registered.push({ tool, options }),
        },
      });
    }
  },
};

// 1) Host 注册 6 个分身工具（全带 when 条件）和 1 个按需身份上下文（不注册额外 policy section）。
installUserIdentityContributions(ctx, {});
assert.equal(sections.length, 0, 'no extra policy section is registered');
assert.equal(contexts.length, 1, 'avatar identity context is registered');
assert.equal(contexts[0].name, 'im-feishu:avatar-identity');
assert.equal(contexts[0].text(), '', 'unconfigured mock auth yields empty identity context');

assert.deepEqual(registered.map(({ tool }) => tool.name), [
  'feishu_avatar_chats',
  'feishu_avatar_people',
  'feishu_avatar_messages',
  'feishu_avatar_send',
  'feishu_avatar_recall',
  'feishu_avatar_doc_read',
  'feishu_avatar_doc_write',
  'feishu_avatar_doc_file',
]);
for (const { options } of registered) {
  assert.equal(typeof options?.when, 'function', 'each avatar tool registers a step-time activation predicate');
  assert.equal(options.when(), true, 'minimal mock auth without availability() remains enabled');
}

// 2) 真实 auth.availability() 按授权状态与 scope 精确门控工具激活与身份上下文。
let state = { authorized: false, user: null, scopes: new Set(), hasRecordedScope: false };
const auth = { availability: () => state };
for (const name of [
  'feishu_avatar_chats',
  'feishu_avatar_messages',
  'feishu_avatar_send',
  'feishu_avatar_doc_read',
  'feishu_avatar_doc_write',
  'feishu_avatar_doc_file',
]) {
  assert.equal(activationForAvatarTool(name, auth)(), false, `unauthorized hides ${name}`);
}
assert.equal(formatAvatarIdentityContext(auth), '');

// 仅授予消息权限时：聊天工具激活，文档读写与文件工具隐藏。
state = {
  authorized: true,
  user: { name: '陈志文', openId: 'ou_self', email: 'a@example.com' },
  scopes: new Set(['im:message', 'im:chat:read']),
  hasRecordedScope: true,
};
assert.equal(activationForAvatarTool('feishu_avatar_chats', auth)(), true);
assert.equal(activationForAvatarTool('feishu_avatar_messages', auth)(), true);
assert.equal(activationForAvatarTool('feishu_avatar_send', auth)(), true);
assert.equal(activationForAvatarTool('feishu_avatar_doc_read', auth)(), false);
assert.equal(activationForAvatarTool('feishu_avatar_doc_write', auth)(), false);
assert.equal(activationForAvatarTool('feishu_avatar_doc_file', auth)(), false);
assert.equal(
  formatAvatarIdentityContext(auth),
  '<feishu_avatar_identity>姓名：陈志文 | openId：ou_self | 邮箱：a@example.com</feishu_avatar_identity>',
);

// 授予文档只读与上传权限后：doc_read 与 doc_file 激活，doc_write 仍隐藏。
state = {
  authorized: true,
  user: { name: '陈志文', openId: 'ou_self', email: '' },
  scopes: new Set(['im:message', 'docx:document:readonly', 'drive:file:upload']),
  hasRecordedScope: true,
};
assert.equal(activationForAvatarTool('feishu_avatar_doc_read', auth)(), true);
assert.equal(activationForAvatarTool('feishu_avatar_doc_write', auth)(), false);
assert.equal(activationForAvatarTool('feishu_avatar_doc_file', auth)(), true);

console.log('user identity contributions: all assertions passed');
