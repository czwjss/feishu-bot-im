import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UserIdentityConnect } from '../src/user-identity/connect.js';
import { UserIdentityAuth } from '../src/user-identity/auth.js';
import { UserTokenStore } from '../src/user-identity/token-store.js';
import { UserIdentityManager } from '../src/user-identity/manager.js';
import { DEFAULT_USER_SCOPE } from '../src/user-identity/config.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const app = { appId: 'cli_test', appSecret: 'test-secret' };
const response = (body) => ({ ok: true, status: 200, json: async () => body });
const device = (code) => response({
  device_code: code, user_code: code, expires_in: 60, interval: 5,
  verification_uri_complete: `https://example.test/authorize?code=${code}`,
});
const makeConnect = (fetchImpl) => new UserIdentityConnect({
  auth: { resolveApp: async () => app, config: { scope: 'offline_access' } }, fetchImpl,
});

test('cancelling an outstanding device request cannot recreate a pending authorization', async (t) => {
  const started = deferred();
  const result = deferred();
  let signal;
  const connect = makeConnect(async (_url, init) => {
    signal = init.signal;
    started.resolve();
    return result.promise;
  });
  t.after(() => connect.dispose());
  const pending = connect.begin();
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  connect.cancel();
  result.resolve(device('old'));
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(connect.status.phase, 'idle');
});

test('a delayed device request cannot replace a newer authorization', async (t) => {
  const started = deferred();
  const firstResult = deferred();
  let calls = 0;
  const connect = makeConnect(async () => {
    if (++calls === 1) { started.resolve(); return firstResult.promise; }
    return device('new');
  });
  t.after(() => connect.dispose());
  const first = connect.begin();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await started.promise;
  await connect.begin();
  firstResult.resolve(device('old'));
  await rejected;
  assert.equal(connect.status.userCode, 'new');
});

async function authFixture(t, fetchImpl) {
  const root = await mkdtemp(join(tmpdir(), 'feishu-auth-lifecycle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tokenStore = await new UserTokenStore({ path: join(root, 'tokens.json') }).load();
  await tokenStore.save({
    appId: app.appId, accessToken: 'old-access', refreshToken: 'old-refresh',
    scope: 'old-scope', user: { openId: 'ou_old' },
  });
  const auth = new UserIdentityAuth({ configStore: { config: {} }, tokenStore, fetchImpl });
  return { auth, tokenStore };
}

test('cancelling during user lookup does not restore a disconnected identity', async (t) => {
  const started = deferred();
  const result = deferred();
  const f = await authFixture(t, async () => { started.resolve(); return result.promise; });
  const controller = new AbortController();
  const pending = f.auth.acceptDeviceToken({ accessToken: 'new-access' }, { app, signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  controller.abort();
  await f.auth.disconnect();
  result.resolve(response({ code: 0, data: { open_id: 'ou_new' } }));
  await rejected;
  await f.tokenStore.load();
  assert.equal(f.tokenStore.document, null);
});

test('a different user on the same app never inherits the previous refresh token or scopes', async (t) => {
  const f = await authFixture(t, async () => response({ code: 0, data: { open_id: 'ou_new' } }));
  const doc = await f.auth.acceptDeviceToken({ accessToken: 'new-access', expiresIn: 7200 }, { app });
  assert.equal(doc.user.openId, 'ou_new');
  assert.equal(doc.refreshToken, '');
  assert.equal(doc.scope, '');
});

test('cancelling from settings during config save prevents a late device-flow start', async (t) => {
  const started = deferred();
  const saved = deferred();
  let begins = 0;
  const manager = new UserIdentityManager({
    configStore: { config: { scope: DEFAULT_USER_SCOPE }, async save() { started.resolve(); await saved.promise; } },
    botConfigStore: { bot: () => ({}) },
    auth: { status: async () => ({ config: {}, authorization: {} }) },
    connect: {
      status: { phase: 'idle' }, cancel() {}, dispose() {},
      async begin() { begins++; return { url: 'https://example.test/authorize' }; },
    },
  });
  t.after(() => manager.dispose());
  const pending = manager.connectBegin({ botId: 'test-bot' });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  await manager.connectCancel();
  saved.resolve();
  await rejected;
  assert.equal(begins, 0);
});
