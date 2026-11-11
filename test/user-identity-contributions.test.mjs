import assert from 'node:assert/strict';

import { installUserIdentityContributions } from '../src/user-identity/contributions.js';

const sections = [];
const tools = [];
const ctx = {
  inject(services, callback) {
    if (services.includes('systemPrompt')) {
      callback({ systemPrompt: { section: (section) => sections.push(section) } });
    }
    if (services.includes('tools')) {
      callback({ tools: { register: (tool) => tools.push(tool) } });
    }
  },
};

// 没有监听时只挂三个工具。
installUserIdentityContributions(ctx, {});
assert.equal(sections.length, 1);
assert.equal(sections[0].name, 'im-feishu-user:policy');
assert.equal(sections[0].order, 141);
assert.match(sections[0].text, /feishu_avatar_send/);
assert.deepEqual(tools.map((tool) => tool.name), [
  'feishu_avatar_me',
  'feishu_avatar_messages',
  'feishu_avatar_send',
]);

// 有监听时追加收件箱工具，并默认只返回未读。
const inboxCalls = [];
tools.length = 0;
installUserIdentityContributions(ctx, {}, {
  async inbox(input) {
    inboxCalls.push(input);
    return {
      total: 1,
      items: [{
        chatId: 'oc_test', chatName: '测试私聊', chatMode: 'p2p', messageId: 'om_1',
        senderName: '同事', senderOpenId: 'ou_1', createTime: '2026-11-11T08:00:00.000Z', text: '你好',
      }],
    };
  },
});
assert.deepEqual(tools.map((tool) => tool.name), [
  'feishu_avatar_me',
  'feishu_avatar_messages',
  'feishu_avatar_send',
  'feishu_avatar_inbox',
]);
const inboxTool = tools.at(-1);
assert.equal(inboxTool.parameters.properties.limit.maximum, 50);
const value = await inboxTool.execute({});
assert.equal(value.total, 1);
assert.equal(value.items[0].text, '你好');
assert.deepEqual(inboxCalls, [{ chatId: '', limit: undefined, unreadOnly: true, markRead: true }]);
console.log('user identity contributions: 12 assertions passed');

const preset = await import('../src/user-identity/index.js');
assert.deepEqual(preset.inject, []);
const warnings = [];
await preset.apply({ logger: () => ({ warn: (message) => warnings.push(message) }) });
assert.match(warnings[0], /Host/);
console.log('user identity legacy preset: 3 assertions passed');
