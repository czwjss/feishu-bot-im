import assert from 'node:assert/strict';

import { createRpcHandler } from '../src/rpc.js';

const calls = [];
const userIdentity = {
  async status() {
    return { config: { app: { available: true, botId: 'bot_1' } }, authorization: { authorized: false }, connect: { phase: 'idle' } };
  },
  async connectBegin(input) {
    calls.push(['connect', input]);
    return { url: 'https://accounts.feishu.cn/verify?code=X', userCode: 'X', expiresAt: Date.now() + 60_000 };
  },
  connectCancel() {
    return { connect: { phase: 'idle' } };
  },
  async disconnect() {
    return { authorization: { authorized: false } };
  },
  async refresh() {
    return { authorization: { authorized: true } };
  },
};

const manager = {
  status: async () => ({ bots: [], presetsReady: true }),
  runtimes: [],
  runtimeForBot(id) { assert.equal(id, 'bot_1'); return { listPresets: async () => [] }; },
};
const harness = {
  invoke: async () => ({ options: [] }),
  modelCatalog: async () => ({ groups: [], default: null }),
  workspaceBaseline: async () => ({ items: [] }),
};

const monitorCalls = [];
const userMonitor = {
  async status() { return { enabled: false, directEnabled: false, chats: [] }; },
  async discoverChats() { return [{ chatId: 'oc_test', name: '测试群', chatMode: 'group' }]; },
  async addChat(input) { monitorCalls.push(['add', input]); return { enabled: false, chats: [input] }; },
  async removeChat(chatId) { monitorCalls.push(['remove', chatId]); return { enabled: false, chats: [] }; },
  async setEnabled(enabled) { monitorCalls.push(['enable', enabled]); return { enabled, chats: [] }; },
  async setDirectEnabled(enabled) { monitorCalls.push(['direct', enabled]); return { directEnabled: enabled, chats: [] }; },
  async setWorker(patch) { monitorCalls.push(['worker', patch]); return { enabled: false, chats: [], worker: patch }; },
  async setHandoffKeywords(keywords) { monitorCalls.push(['handoff', keywords]); return { enabled: false, chats: [], handoffKeywords: keywords }; },
  async setReplyRules(rules) { monitorCalls.push(['reply-rules', rules]); return { replyRules: rules }; },
  async pollOnce() { monitorCalls.push(['poll']); },
};
const handle = createRpcHandler({ manager, harness, version: '0.4.1', userIdentity, userMonitor });

{
  const result = await handle('user.status', {});
  assert.equal(result.ok, true);
  assert.equal(result.value.authorization.authorized, false);
}

{
  const begin = await handle('user.connect.begin', { botId: 'bot_1' });
  assert.deepEqual(calls.at(-1), ['connect', { botId: 'bot_1' }]);
  assert.equal(begin.value.userCode, 'X');
  assert.match(begin.value.url, /^https:\/\/accounts\.feishu\.cn\//);
  assert.equal((await handle('user.connect.cancel', { botId: 'bot_1', })).value.connect.phase, 'idle');
  assert.equal((await handle('user.disconnect', { botId: 'bot_1', })).value.authorization.authorized, false);
  assert.equal((await handle('user.refresh', { botId: 'bot_1', })).value.authorization.authorized, true);
}

{
  const listed = await handle('user.monitor.chats', { botId: 'bot_1', });
  assert.equal(listed.value.chats[0].chatId, 'oc_test');
  await handle('user.monitor.add', { botId: 'bot_1', chatId: 'oc_test', name: '测试群', chatMode: 'group' });
  assert.deepEqual(monitorCalls.at(-1), ['add', { botId: 'bot_1', chatId: 'oc_test', name: '测试群', chatMode: 'group' }]);
  await handle('user.monitor.remove', { botId: 'bot_1',  chatId: 'oc_test' });
  assert.deepEqual(monitorCalls.at(-1), ['remove', 'oc_test']);
  await handle('user.monitor.handoff.set', { botId: 'bot_1',  keywords: ['走人工'] });
  assert.deepEqual(monitorCalls.at(-1), ['handoff', ['走人工']], 'handoff keywords saved');
  const rules = await handle('user.monitor.reply-rules.set', { botId: 'bot_1',  rules: '先给结论，再解释。' });
  assert.deepEqual(monitorCalls.at(-1), ['reply-rules', '先给结论，再解释。']);
  assert.equal(rules.value.replyRules, '先给结论，再解释。');

  await handle('user.monitor.worker.set', { botId: 'bot_1',  workspaceId: 'ws_1', preset: 'standard' });
  assert.deepEqual(monitorCalls.at(-1), ['worker', { workspaceId: 'ws_1', workspacePath: undefined, preset: 'standard' }]);
  const workerOptions = await handle('user.monitor.worker.options', { botId: 'bot_1', });
  assert.ok(Array.isArray(workerOptions.value.workspaces), 'worker options list workspaces');
  assert.ok(Array.isArray(workerOptions.value.presets), 'worker options list presets');
  await handle('user.monitor.enable', { botId: 'bot_1',  enabled: true });
  assert.deepEqual(monitorCalls.at(-1), ['enable', true]);
  const direct = await handle('user.monitor.direct.enable', { botId: 'bot_1', enabled: true });
  assert.equal(direct.value.directEnabled, true);
  assert.deepEqual(monitorCalls.at(-1), ['direct', true]);
  assert.equal((await handle('user.monitor.direct.enable', { botId: 'bot_1', enabled: 'false' })).ok, false);
  assert.deepEqual(monitorCalls.at(-1), ['direct', true]);
  await handle('user.monitor.poll', { botId: 'bot_1', });
  assert.deepEqual(monitorCalls.at(-1), ['poll']);
  assert.equal((await handle('user.monitor.status', { botId: 'bot_1', })).value.enabled, false);
}

{
  const noUser = createRpcHandler({ manager, harness, version: '0.4.1' });
  await assert.rejects(() => noUser('user.status', {}), /用户身份模块没有加载/);
}

{
  const noMonitor = createRpcHandler({ manager, harness, version: '0.4.1', userIdentity });
  await assert.rejects(() => noMonitor('user.monitor.status', { botId: 'bot_1', }), /消息监听没有加载/);
}

console.log('im-feishu user identity rpc: 18 assertions passed');
