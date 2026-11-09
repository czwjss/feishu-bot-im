import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UserIdentityAuth } from '../src/user-identity/auth.js';
import { UserIdentityConfigStore } from '../src/user-identity/config.js';
import { NotAuthorizedError, NotConfiguredError } from '../src/user-identity/errors.js';
import { TOKEN_V3_URL, USER_INFO_URL } from '../src/user-identity/oauth.js';
import { UserTokenStore } from '../src/user-identity/token-store.js';

const NOW = 1_800_000_000_000;
const roots = [];

function botStore(bots) {
  return {
    bots,
    bot(id) {
      return bots.find((item) => item.id === id) ?? null;
    },
  };
}

const bots = botStore([{
  id: 'bot_1',
  appId: 'cli_app_1234567890',
  secretRef: 'IM_FEISHU_APP_SECRET',
  botName: '小金刚',
}]);

const credentials = {
  async resolve(ref) {
    return ref === 'IM_FEISHU_APP_SECRET' ? { value: 'secret-1' } : undefined;
  },
  async describe(ref) {
    return { configured: ref === 'IM_FEISHU_APP_SECRET' };
  },
};

function tokenDoc({ expiresInMs = 3_600_000, appId = 'cli_app_1234567890', accessToken = 'access-1', refreshToken = 'refresh-1' } = {}) {
  return {
    appId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: NOW + expiresInMs,
    refreshTokenExpiresAt: NOW + 30 * 24 * 3_600_000,
    scope: 'offline_access',
    authorizedAt: new Date(NOW).toISOString(),
    user: { name: '陈志文', openId: 'ou_1', unionId: 'on_1' },
  };
}

async function fixture({ token = null, fetchImpl = null, botConfig = bots } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'im-feishu-user-auth-'));
  roots.push(dir);
  const configStore = await new UserIdentityConfigStore({ path: join(dir, 'user-identity.json') }).load();
  const tokenStore = await new UserTokenStore({ path: join(dir, 'user-token.json') }).load();
  if (token) await tokenStore.save(token);
  const auth = new UserIdentityAuth({
    configStore,
    tokenStore,
    botConfigStore: botConfig,
    credentials,
    fetchImpl: fetchImpl ?? (async () => { throw new Error('unexpected fetch'); }),
    now: () => NOW,
  });
  return { auth, configStore, tokenStore };
}

function responseOf(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

try {
  {
    const { auth, tokenStore } = await fixture();
    const status = await auth.status();
    assert.equal(status.config.app.available, true);
    assert.equal(status.config.app.botId, 'bot_1');
    assert.equal(status.config.app.botName, '小金刚');
    assert.match(status.config.app.appIdMasked, /^cli_app_/);
    assert.equal(status.authorization.authorized, false);
    await assert.rejects(() => auth.requireAccessToken(), (error) => error instanceof NotAuthorizedError);

    // Host 设置页在预设创建之后写入 token，工具侧应重新读取磁盘。
    const hostStore = await new UserTokenStore({ path: tokenStore.path }).load();
    await hostStore.save(tokenDoc());
    assert.equal(await auth.requireAccessToken(), 'access-1');
    assert.equal((await auth.status()).authorization.authorized, true);
  }

  {
    const { auth } = await fixture({ token: tokenDoc() });
    assert.equal(await auth.requireAccessToken(), 'access-1');
    const status = await auth.status();
    assert.equal(status.authorization.authorized, true);
    assert.equal(status.authorization.user.name, '陈志文');
    assert.equal(JSON.stringify(status).includes('access-1'), false);
  }

  {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), init });
      return responseOf({
        access_token: 'access-2',
        expires_in: 7200,
        refresh_token: 'refresh-2',
        refresh_token_expires_in: 604800,
        scope: 'offline_access',
      });
    };
    const { auth, tokenStore } = await fixture({ token: tokenDoc({ expiresInMs: 1_000 }), fetchImpl });
    assert.equal(await auth.requireAccessToken(), 'access-2');
    assert.equal(calls[0].url, TOKEN_V3_URL);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.grant_type, 'refresh_token');
    assert.equal(body.refresh_token, 'refresh-1');
    assert.equal(body.client_id, 'cli_app_1234567890');
    assert.equal(body.client_secret, 'secret-1');
    assert.equal(tokenStore.document.refreshToken, 'refresh-2');
    assert.equal(tokenStore.document.user.name, '陈志文');
  }

  {
    const calls = [];
    const fetchImpl = async () => {
      calls.push(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return responseOf({
        access_token: 'access-shared',
        expires_in: 7200,
        refresh_token: 'refresh-shared',
        refresh_token_expires_in: 604800,
        scope: 'offline_access',
      });
    };
    const { auth, configStore, tokenStore } = await fixture({ token: tokenDoc({ expiresInMs: 1_000 }), fetchImpl });
    const second = new UserIdentityAuth({
      configStore,
      tokenStore,
      botConfigStore: bots,
      credentials,
      fetchImpl,
      now: () => NOW,
    });
    const [firstToken, secondToken] = await Promise.all([
      auth.requireAccessToken(),
      second.requireAccessToken(),
    ]);
    assert.equal(firstToken, 'access-shared');
    assert.equal(secondToken, 'access-shared');
    assert.equal(calls.length, 1, 'Host and preset share one refresh request');
    assert.equal(tokenStore.document.refreshToken, 'refresh-shared');
  }

  {
    const { auth } = await fixture({ token: tokenDoc({ appId: 'cli_old' }) });
    await assert.rejects(() => auth.requireAccessToken(), /应用已变化/);
    const status = await auth.status();
    assert.equal(status.authorization.appMismatch, true);
    assert.equal(status.authorization.authorized, false);
  }

  {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (String(url) === USER_INFO_URL) {
        return responseOf({
          code: 0,
          data: { name: '陈志文', open_id: 'ou_1', union_id: 'on_1', avatar_url: 'https://x/a.png' },
        });
      }
      throw new Error(`unexpected ${url}`);
    };
    const { auth, tokenStore } = await fixture({ fetchImpl });
    const doc = await auth.acceptDeviceToken({
      accessToken: 'access-new',
      expiresIn: 7200,
      refreshToken: 'refresh-new',
      refreshTokenExpiresIn: 604800,
      scope: 'offline_access',
    });
    assert.equal(doc.user.openId, 'ou_1');
    assert.equal(tokenStore.document.accessToken, 'access-new');
    assert.equal((await auth.status()).authorization.authorized, true);
    await auth.disconnect();
    assert.equal((await auth.status()).authorization.authorized, false);
  }

  {
    let release;
    let started;
    const begun = new Promise((resolve) => { started = resolve; });
    const fetchImpl = async () => {
      started();
      await new Promise((resolve) => { release = resolve; });
      return responseOf({
        access_token: 'access-stale',
        expires_in: 7200,
        refresh_token: 'refresh-stale',
        refresh_token_expires_in: 604800,
        scope: 'offline_access',
      });
    };
    const { auth, tokenStore } = await fixture({ token: tokenDoc({ expiresInMs: 1_000 }), fetchImpl });
    const pending = auth.requireAccessToken();
    await begun;
    const other = await new UserTokenStore({ path: tokenStore.path }).load();
    await other.save(tokenDoc({
      accessToken: 'access-new-auth',
      refreshToken: 'refresh-new-auth',
    }));
    release();
    assert.equal(await pending, 'access-new-auth');
    assert.equal(tokenStore.document.refreshToken, 'refresh-new-auth', 'stale refresh does not overwrite new auth');
  }

  {
    const fetchImpl = async (url) => {
      assert.equal(String(url), USER_INFO_URL);
      return responseOf({
        code: 0,
        data: { name: '新用户', open_id: 'ou_2', union_id: 'on_2' },
      });
    };
    const { auth, tokenStore } = await fixture({
      token: tokenDoc({ appId: 'cli_old' }),
      fetchImpl,
    });
    const doc = await auth.acceptDeviceToken({
      accessToken: 'access-new-app',
      expiresIn: 7200,
      refreshToken: '',
      refreshTokenExpiresIn: 0,
      scope: '',
    }, { app: { appId: 'cli_app_1234567890' } });
    assert.equal(doc.refreshToken, '', 'does not carry the old app refresh token');
    assert.equal(doc.scope, '', 'does not carry the old app scope');
    assert.equal(tokenStore.document.user.openId, 'ou_2');
  }

  {
    const { auth } = await fixture({ botConfig: botStore([]) });
    const status = await auth.status();
    assert.equal(status.config.app.available, false);
    assert.match(status.config.appError, /还没有飞书机器人/);
    await assert.rejects(() => auth.requireAccessToken(), (error) => error instanceof NotConfiguredError);
  }

  console.log('im-feishu user identity auth: 39 assertions passed');
} finally {
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })));
}
