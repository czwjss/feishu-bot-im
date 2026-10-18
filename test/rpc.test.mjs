import assert from 'node:assert/strict';
import { createRpcHandler, RPC_ENDPOINT, RPC_PATH } from '../src/rpc.js';

const calls = [];
const runtime = {
  status: async () => ({ id: 'bot_1', state: 'connected' }),
  sendTest: async () => { calls.push('test'); },
  save: async (patch) => { calls.push(['save', patch]); return {}; },
  saveWorkspace: async (w) => { calls.push(['ws', w]); return w; },
  saveContextEnhancement: async (c) => { calls.push(['ce', c]); return c; },
  listPresets: async () => [{ id: 'standard', name: 'Standard' }],
};
const manager = {
  status: async () => ({ bots: [{ id: 'bot_1', state: 'connected' }], presetsReady: true }),
  addBot: async (input) => { calls.push(['add', input]); return { id: 'bot_2', state: 'connected' }; },
  removeBot: async (id) => { calls.push(['remove', id]); },
  reconnectBot: async (id) => { if (id !== 'bot_1') throw new Error('机器人不存在：' + id); calls.push(['reconnect', id]); },
  runtimeForBot: (id) => { if (id !== 'bot_1') throw new Error('机器人不存在：' + id); return runtime; },
  runtimes: [runtime],
};
const harness = {
  modelCatalog: async () => ({ groups: [{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { efforts: [{ id: 'high' }] } }] }], default: null }),
  workspaceBaseline: async () => ({ items: [{ path: '/tmp/a', title: 'A' }, { path: '/tmp/b' }] }),
};
const handle = createRpcHandler({ manager, harness, version: '0.1.0' });

assert.equal(RPC_PATH, '/api/im-feishu');
assert.equal(RPC_ENDPOINT, 'im-feishu');

const list = await handle('bots.list', {});
assert.equal(list.value.bots[0].id, 'bot_1');
assert.equal(list.value.version, '0.1.0');

const added = await handle('bot.add', { appId: 'cli_x', appSecret: 's' });
assert.equal(added.value.state, 'connected');

await handle('bot.alias.set', { botId: 'bot_1', alias: '小名' });
assert.deepEqual(calls.at(-1), ['save', { alias: '小名' }]);

await handle('bot.busy-mode.set', { botId: 'bot_1', scope: 'direct', mode: 'steer' });
assert.deepEqual(calls.at(-1), ['save', { busyMode: { direct: 'steer' } }], 'direct scope only');

await handle('bot.bot-reply.set', { botId: 'bot_1', enabled: false });
assert.deepEqual(calls.at(-1), ['save', { respondToBotMessages: false }], 'bot reply switch saved');

await handle('bot.process-detail.set', { botId: 'bot_1', mode: 'brief' });
assert.deepEqual(calls.at(-1), ['save', { processDetail: 'brief' }], 'progress detail saved');

await handle('bot.topics.set', { botId: 'bot_1', enabled: false });
assert.deepEqual(calls.at(-1), ['save', { topicsEnabled: false }], 'topics switch saved');

const ce = await handle('bot.context-enhancement.set', {
  botId: 'bot_1',
  config: { group: { enabled: true, fields: ['senderId'], guidance: 'g' }, direct: { enabled: false, fields: [], guidance: '' } },
});
assert.equal(ce.ok, true);

const presets = await handle('presets.list', { botId: 'bot_1' });
assert.deepEqual(presets.value.presets, [{ id: 'standard', name: 'Standard' }]);

const models = await handle('models.list', {});
assert.equal(models.value.groups[0].models[0].reasoning.efforts[0].id, 'high');

const spaces = await handle('workspaces.list', {});
assert.deepEqual(spaces.value.workspaces, [{ path: '/tmp/a', title: 'A' }, { path: '/tmp/b', title: null }]);

const bad = await handle('nope', {});
assert.equal(bad.ok, false);
assert.equal(bad.error.code, 'bad-request');

// 未知机器人向上抛错，由 installRpc 转成 {ok:false} 交给前端
await assert.rejects(() => handle('bot.reconnect', { botId: 'bot_x' }), /机器人不存在/);

console.log('rpc handler (multi-bot): 13 assertions passed');
