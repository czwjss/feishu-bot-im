import assert from 'node:assert/strict';

import { UserIdentityConnect } from '../src/user-identity/connect.js';

const app = Object.freeze({
  botId: 'bot_1',
  botName: '小金刚',
  appId: 'cli_app',
  appSecret: 'secret',
});

function makeAuth() {
  const accepted = [];
  return {
    accepted,
    config: { botId: '', scope: 'offline_access' },
    async resolveApp() {
      return app;
    },
    async acceptDeviceToken(token) {
      accepted.push(token);
      return { user: { name: '陈志文', openId: 'ou_1' } };
    },
  };
}

function deviceFetch({ pollResults }) {
  let polls = 0;
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/device_authorization')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'dc_1',
          user_code: 'ABCD',
          verification_uri: 'https://accounts.feishu.cn/verify',
          verification_uri_complete: 'https://accounts.feishu.cn/verify?code=ABCD',
          expires_in: 60,
          interval: 1,
        }),
      };
    }
    const next = pollResults[Math.min(polls, pollResults.length - 1)];
    polls += 1;
    return { ok: true, status: 200, json: async () => next };
  };
  return Object.assign(impl, { calls, get polls() { return polls; } });
}

async function waitFor(predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

{
  const auth = makeAuth();
  const connect = new UserIdentityConnect({
    auth,
    fetchImpl: deviceFetch({
      pollResults: [
        { error: 'authorization_pending' },
        { access_token: 'access-1', expires_in: 7200, refresh_token: 'refresh-1', refresh_token_expires_in: 604800, scope: 'offline_access' },
      ],
    }),
  });
  try {
    const begin = await connect.begin();
    assert.equal(begin.url, 'https://accounts.feishu.cn/verify?code=ABCD');
    assert.equal(begin.userCode, 'ABCD');
    assert.equal(connect.status.phase, 'pending');
    assert.equal(connect.status.userCode, 'ABCD');
    assert.ok(await waitFor(() => connect.status.phase === 'succeeded'));
    assert.equal(connect.status.user.name, '陈志文');
    assert.equal(auth.accepted.length, 1);
    assert.equal(auth.accepted[0].accessToken, 'access-1');
  } finally {
    connect.dispose();
  }
}

{
  const auth = makeAuth();
  auth.resolveApp = async () => { throw new Error('没有可用应用'); };
  const connect = new UserIdentityConnect({ auth, fetchImpl: deviceFetch({ pollResults: [] }) });
  try {
    await assert.rejects(() => connect.begin(), /没有可用应用/);
    assert.equal(connect.status.phase, 'idle', 'failed begin clears pending state');
    assert.equal(connect.status.verificationUrl, '');
  } finally {
    connect.dispose();
  }
}

{
  const auth = makeAuth();
  const connect = new UserIdentityConnect({
    auth,
    fetchImpl: deviceFetch({ pollResults: [{ error: 'access_denied' }] }),
  });
  try {
    await connect.begin();
    assert.ok(await waitFor(() => connect.status.phase === 'failed'));
    assert.match(connect.status.error, /拒绝/);
  } finally {
    connect.dispose();
  }
}

{
  const auth = makeAuth();
  const connect = new UserIdentityConnect({
    auth,
    fetchImpl: deviceFetch({ pollResults: [{ error: 'authorization_pending' }] }),
  });
  try {
    await connect.begin();
    connect.cancel();
    assert.equal(connect.status.phase, 'idle');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    assert.equal(connect.status.phase, 'idle', 'cancel stops polling');
  } finally {
    connect.dispose();
  }
}

{
  const auth = makeAuth();
  const connect = new UserIdentityConnect({
    auth,
    fetchImpl: deviceFetch({ pollResults: [{ error: 'authorization_pending' }] }),
  });
  try {
    const begin = await connect.begin();
    assert.ok(begin.expiresAt > Date.now());
    assert.equal(begin.interval, 1);
  } finally {
    connect.dispose();
  }
}

console.log('im-feishu user identity connect: 14 assertions passed');
