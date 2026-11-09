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

const handle = createRpcHandler({ manager, harness, version: '0.4.1', userIdentity });

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
  const noUser = createRpcHandler({ manager, harness, version: '0.4.1' });
  await assert.rejects(() => noUser('user.status', {}), /用户身份模块没有加载/);
}

console.log('im-feishu user identity rpc: 8 assertions passed');
