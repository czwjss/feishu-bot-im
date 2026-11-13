import assert from 'node:assert/strict';

import { createRpcHandler } from '../src/rpc.js';

const calls = [];
const userIdentity = {
  async status() {
    return { config: { app: { available: true } }, authorization: { authorized: false }, connect: { phase: 'idle' } };
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
  runtimeForBot() { throw new Error('no runtime'); },
};
const harness = {
  invoke: async () => ({ options: [] }),
  modelCatalog: async () => ({ groups: [], default: null }),
  workspaceBaseline: async () => ({ items: [] }),
};

const monitorCalls = [];
const userMonitor = {
  async status() { return { enabled: false, chats: [] }; },
  async discoverChats() { return [{ chatId: 'oc_test', name: '测试', chatMode: 'p2p' }]; },
  async addChat(input) { monitorCalls.push(['add', input]); return { enabled: false, chats: [input] }; },
  async removeChat(chatId) { monitorCalls.push(['remove', chatId]); return { enabled: false, chats: [] }; },
  async setEnabled(enabled) { monitorCalls.push(['enable', enabled]); return { enabled, chats: [] }; },
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
  assert.equal((await handle('user.connect.cancel', {})).value.connect.phase, 'idle');
  assert.equal((await handle('user.disconnect', {})).value.authorization.authorized, false);
  assert.equal((await handle('user.refresh', {})).value.authorization.authorized, true);
}

{
  const listed = await handle('user.monitor.chats', {});
  assert.equal(listed.value.chats[0].chatId, 'oc_test');
  await handle('user.monitor.add', { chatId: 'oc_test', name: '测试', chatMode: 'p2p' });
  assert.deepEqual(monitorCalls.at(-1), ['add', { chatId: 'oc_test', name: '测试', chatMode: 'p2p' }]);
  await handle('user.monitor.remove', { chatId: 'oc_test' });
  assert.deepEqual(monitorCalls.at(-1), ['remove', 'oc_test']);
  await handle('user.monitor.handoff.set', { keywords: ['走人工'] });
  assert.deepEqual(monitorCalls.at(-1), ['handoff', ['走人工']], 'handoff keywords saved');
  const rules = await handle('user.monitor.reply-rules.set', { rules: '先给结论，再解释。' });
  assert.deepEqual(monitorCalls.at(-1), ['reply-rules', '先给结论，再解释。']);
  assert.equal(rules.value.replyRules, '先给结论，再解释。');

  await handle('user.monitor.worker.set', { workspaceId: 'ws_1', preset: 'standard' });
  assert.deepEqual(monitorCalls.at(-1), ['worker', { workspaceId: 'ws_1', workspacePath: undefined, preset: 'standard' }]);
  const workerOptions = await handle('user.monitor.worker.options', {});
  assert.ok(Array.isArray(workerOptions.value.workspaces), 'worker options list workspaces');
  assert.ok(Array.isArray(workerOptions.value.presets), 'worker options list presets');
  await handle('user.monitor.enable', { enabled: true });
  assert.deepEqual(monitorCalls.at(-1), ['enable', true]);
  await handle('user.monitor.poll', {});
  assert.deepEqual(monitorCalls.at(-1), ['poll']);
  assert.equal((await handle('user.monitor.status', {})).value.enabled, false);
}

{
  const noUser = createRpcHandler({ manager, harness, version: '0.4.1' });
  await assert.rejects(() => noUser('user.status', {}), /用户身份模块没有加载/);
}

{
  const noMonitor = createRpcHandler({ manager, harness, version: '0.4.1', userIdentity });
  await assert.rejects(() => noMonitor('user.monitor.status', {}), /消息监听没有加载/);
}

console.log('im-feishu user identity rpc: 18 assertions passed');
