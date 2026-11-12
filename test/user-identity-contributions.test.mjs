import assert from 'node:assert/strict';

import { installUserIdentityContributions } from '../src/user-identity/contributions.js';

const sections = [];
const tools = [];
const ctx = {
  inject(services, callback) {
    if (services.includes('systemPrompt')) {
      callback({
        systemPrompt: {
          section: (section) => sections.push(section),
          context: (section) => sections.push(section),
        },
      });
    }
    if (services.includes('tools')) {
      callback({ tools: { register: (tool) => tools.push(tool) } });
    }
  },
};

// 没有监听时只挂三个工具。
installUserIdentityContributions(ctx, {});
// 分身只贡献工具，不再单独注册 policy section（规则统一在 Host 的 FEISHU_POLICY）。
assert.equal(sections.length, 0, 'no extra policy section is registered');
assert.deepEqual(tools.map((tool) => tool.name), [
  'feishu_avatar_me',
  'feishu_avatar_messages',
  'feishu_avatar_send',
]);

// 有监听时追加草稿与决策工具；收件箱工具不再注册。
tools.length = 0;
sections.length = 0;
installUserIdentityContributions(ctx, {}, {
  async createDraft(input) {
    return { draftId: 'draft-1', chatId: input.chatId, status: 'pending', text: input.text };
  },
  autoReply: {
    async reply({ text }) {
      return { sentMessageId: 'om_sent', messageIds: ['om_1', 'om_2'] };
    },
    async skip() {
      return { skipped: true, messageIds: ['om_1'] };
    },
  },
});
assert.deepEqual(tools.map((tool) => tool.name), [
  'feishu_avatar_me',
  'feishu_avatar_messages',
  'feishu_avatar_send',
  'feishu_avatar_draft',
]);
assert.equal(sections.length, 0, 'no extra prompt section is registered');
const draftTool = tools.find((tool) => tool.name === 'feishu_avatar_draft');
const created = await draftTool.execute({ chatId: 'oc_test', text: '好的' });
assert.equal(created.draftId, 'draft-1');
assert.equal(created.status, 'pending');

// 只有四个通用工具，没有 Worker 专属工具。
assert.deepEqual(tools.map((tool) => tool.name).sort(), [
  'feishu_avatar_draft',
  'feishu_avatar_me',
  'feishu_avatar_messages',
  'feishu_avatar_send',
]);
console.log('user identity contributions: 20 assertions passed');

const preset = await import('../src/user-identity/index.js');
assert.deepEqual(preset.inject, []);
const warnings = [];
await preset.apply({ logger: () => ({ warn: (message) => warnings.push(message) }) });
assert.match(warnings[0], /Host/);
console.log('user identity legacy preset: 3 assertions passed');
