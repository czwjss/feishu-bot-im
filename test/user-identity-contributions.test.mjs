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
console.log('user identity contributions: 6 assertions passed');

const preset = await import('../src/user-identity/index.js');
assert.deepEqual(preset.inject, []);
const warnings = [];
await preset.apply({ logger: () => ({ warn: (message) => warnings.push(message) }) });
assert.match(warnings[0], /Host/);
console.log('user identity legacy preset: 3 assertions passed');
