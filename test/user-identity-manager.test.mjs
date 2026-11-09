import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UserIdentityConfigStore } from '../src/user-identity/config.js';
import { UserIdentityManager } from '../src/user-identity/manager.js';

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-user-manager-'));
try {
  const configStore = await new UserIdentityConfigStore({ path: join(dir, 'user-identity.json') }).load();
  const bots = [{ id: 'bot_1', appId: 'cli_app', appSecret: 'secret', botName: '小金刚' }];
  const botConfigStore = { bots, bot: (id) => bots.find((bot) => bot.id === id) ?? null };
  const connect = {
    begin: async () => ({
      url: 'https://accounts.feishu.cn/oauth/v1/device/verify?flow_id=f&user_code=ABCD',
      userCode: 'ABCD',
      expiresAt: Date.now() + 60_000,
      interval: 5,
    }),
    status: {
      phase: 'pending',
      userCode: 'ABCD',
      verificationUrl: 'https://accounts.feishu.cn/oauth/v1/device/verify?flow_id=f&user_code=ABCD',
    },
    cancel() {},
    dispose() {},
  };
  const auth = {
    async status() {
      return { config: { app: { available: true, botId: 'bot_1' } }, authorization: { authorized: false } };
    },
  };
  const manager = new UserIdentityManager({
    configStore,
    botConfigStore,
    tokenStore: {},
    credentials: null,
    auth,
    connect,
    dataDir: dir,
  });

  await configStore.save({ scope: 'offline_access' });
  const started = await manager.connectBegin({ botId: 'bot_1' });
  assert.equal(started.userCode, 'ABCD');
  assert.match(started.qrCodeDataUrl, /^data:image\/png;base64,/);
  const status = await manager.status();
  assert.equal(status.connect.phase, 'pending');
  assert.equal(status.connect.qrCodeDataUrl, started.qrCodeDataUrl, 'status keeps the QR for the open modal');
  assert.equal(configStore.config.botId, 'bot_1');
  assert.match(configStore.config.scope, /im:message.send_as_user/, 'connect fills core IM scopes');
  assert.match(configStore.config.scope, /docx:document:readonly/, 'connect includes doc scopes');
  assert.doesNotMatch(configStore.config.scope, /wiki:node|sheets:spreadsheet|base:app|calendar:calendar|task:task|approval:/, 'connect does not request excluded scopes');

  console.log('im-feishu user identity manager: 7 assertions passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
