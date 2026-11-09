import assert from 'node:assert/strict';

import { FeishuOAuthError } from '../src/user-identity/errors.js';
import {
  DEVICE_AUTHORIZATION_URL,
  TOKEN_V3_URL,
  beginDeviceAuthorization,
  pollDeviceToken,
  refreshUserAccessToken,
  tokenDocument,
  withOfflineAccess,
} from '../src/user-identity/oauth.js';

function fakeFetch(payload, { status = 200, assert: check } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (check) check(String(url), init);
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
  return Object.assign(impl, { calls });
}

assert.equal(withOfflineAccess(''), 'offline_access');
assert.equal(withOfflineAccess('im:message'), 'im:message offline_access');
assert.equal(withOfflineAccess('offline_access im:message'), 'offline_access im:message');

{
  const fetchImpl = fakeFetch({
    device_code: 'dc_1',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://accounts.feishu.cn/verify?code=1',
    verification_uri_complete: 'https://accounts.feishu.cn/verify?code=1&user_code=ABCD-EFGH',
    expires_in: 300,
    interval: 7,
  });
  const result = await beginDeviceAuthorization({
    appId: 'cli_app',
    appSecret: 'secret',
    scope: 'im:message',
    fetchImpl,
  });
  const call = fetchImpl.calls[0];
  assert.equal(call.url, DEVICE_AUTHORIZATION_URL);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.match(call.init.headers.authorization, /^Basic /);
  const decoded = Buffer.from(call.init.headers.authorization.slice(6), 'base64').toString('utf8');
  assert.equal(decoded, 'cli_app:secret');
  const form = new URLSearchParams(call.init.body);
  assert.equal(form.get('client_id'), 'cli_app');
  assert.equal(form.get('scope'), 'im:message offline_access');
  assert.equal(result.deviceCode, 'dc_1');
  assert.equal(result.userCode, 'ABCD-EFGH');
  assert.equal(result.verificationUriComplete, 'https://accounts.feishu.cn/verify?code=1&user_code=ABCD-EFGH');
  assert.equal(result.expiresIn, 300);
  assert.equal(result.interval, 7);
}

{
  const fetchImpl = fakeFetch({ error: 'invalid_client', error_description: 'bad secret' }, { status: 400 });
  await assert.rejects(
    () => beginDeviceAuthorization({ appId: 'a', appSecret: 'b', scope: '', fetchImpl }),
    (error) => error instanceof FeishuOAuthError && /bad secret/.test(error.message),
  );
}

{
  const fetchImpl = fakeFetch({ error: 'authorization_pending' }, { status: 400 });
  const result = await pollDeviceToken({ appId: 'a', appSecret: 'b', deviceCode: 'dc', fetchImpl });
  assert.equal(result.status, 'pending');
  const call = fetchImpl.calls[0];
  assert.equal(call.url, TOKEN_V3_URL);
  const form = new URLSearchParams(call.init.body);
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code');
  assert.equal(form.get('device_code'), 'dc');
  assert.equal(form.get('client_id'), 'a');
  assert.equal(form.get('client_secret'), 'b');
}

{
  const fetchImpl = fakeFetch({ error: 'slow_down' });
  assert.equal((await pollDeviceToken({ appId: 'a', appSecret: 'b', deviceCode: 'dc', fetchImpl })).status, 'slow_down');
  const denied = fakeFetch({ error: 'access_denied' });
  assert.equal((await pollDeviceToken({ appId: 'a', appSecret: 'b', deviceCode: 'dc', fetchImpl: denied })).status, 'denied');
  const expired = fakeFetch({ error: 'expired_token' });
  assert.equal((await pollDeviceToken({ appId: 'a', appSecret: 'b', deviceCode: 'dc', fetchImpl: expired })).status, 'expired');
}

{
  const fetchImpl = fakeFetch({
    access_token: 'u-access',
    expires_in: 7200,
    refresh_token: 'u-refresh',
    refresh_token_expires_in: 604800,
    scope: 'offline_access im:message',
    token_type: 'Bearer',
  });
  const result = await pollDeviceToken({ appId: 'a', appSecret: 'b', deviceCode: 'dc', fetchImpl });
  assert.equal(result.status, 'authorized');
  assert.equal(result.token.accessToken, 'u-access');
  assert.equal(result.token.refreshToken, 'u-refresh');
  assert.equal(result.token.expiresIn, 7200);
}

{
  const fetchImpl = fakeFetch({
    access_token: 'u-access-2',
    expires_in: 7200,
    refresh_token: 'u-refresh-2',
    refresh_token_expires_in: 604800,
    scope: 'offline_access',
  });
  const token = await refreshUserAccessToken({
    appId: 'cli_app',
    appSecret: 'secret',
    refreshToken: 'u-refresh-1',
    fetchImpl,
  });
  const call = fetchImpl.calls[0];
  assert.equal(call.url, TOKEN_V3_URL);
  assert.equal(call.init.headers['content-type'], 'application/json; charset=utf-8');
  const body = JSON.parse(call.init.body);
  assert.deepEqual(body, {
    grant_type: 'refresh_token',
    refresh_token: 'u-refresh-1',
    client_id: 'cli_app',
    client_secret: 'secret',
  });
  assert.equal(token.accessToken, 'u-access-2');
  assert.equal(token.refreshToken, 'u-refresh-2');
}

{
  const fetchImpl = fakeFetch({ error: 'invalid_grant', error_description: 'refresh expired' }, { status: 400 });
  await assert.rejects(
    () => refreshUserAccessToken({ appId: 'a', appSecret: 'b', refreshToken: 'r', fetchImpl }),
    (error) => error instanceof FeishuOAuthError && /refresh expired/.test(error.message),
  );
}

{
  const now = 1_800_000_000_000;
  const doc = tokenDocument({
    token: { accessToken: 'a', expiresIn: 7200, refreshToken: '', refreshTokenExpiresIn: 0, scope: '' },
    appId: 'cli_app',
    user: { name: '陈志文', openId: 'ou_1' },
    previous: { refreshToken: 'old', refreshTokenExpiresAt: now + 1000, scope: 'offline_access', authorizedAt: '2026-01-01T00:00:00.000Z' },
    now,
  });
  assert.equal(doc.accessToken, 'a');
  assert.equal(doc.refreshToken, 'old');
  assert.equal(doc.accessTokenExpiresAt, now + 7_200_000);
  assert.equal(doc.scope, 'offline_access');
  assert.equal(doc.authorizedAt, '2026-01-01T00:00:00.000Z');
}

console.log('im-feishu user identity oauth: 36 assertions passed');
