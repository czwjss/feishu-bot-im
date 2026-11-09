/**
 * 用户身份的 OAuth：飞书设备授权（Device Flow）+ v3 token 端点。
 *
 * 端点与流程对齐飞书官方 CLI（github.com/larksuite/cli）：
 *   POST https://accounts.feishu.cn/oauth/v1/device_authorization   （Basic 认证 + form）
 *   POST https://accounts.feishu.cn/oauth/v3/token                  （设备码轮询 / 刷新）
 *
 * 设备授权不需要 redirect_uri，也就不需要在飞书后台配置重定向 URL。
 */
import { FeishuOAuthError, describeOAuthCode } from './errors.js';

export const FEISHU_ACCOUNTS_ORIGIN = 'https://accounts.feishu.cn';
export const DEVICE_AUTHORIZATION_URL = `${FEISHU_ACCOUNTS_ORIGIN}/oauth/v1/device_authorization`;
export const TOKEN_V3_URL = `${FEISHU_ACCOUNTS_ORIGIN}/oauth/v3/token`;
export const USER_INFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_DEVICE_EXPIRES_IN = 240;
export const DEFAULT_DEVICE_INTERVAL = 5;

function requestSignal({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const timeout = AbortSignal.timeout(Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function basicAuth(appId, appSecret) {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`, 'utf8').toString('base64')}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** scope 里没有 offline_access 时补上，否则拿不到 refresh_token。 */
export function withOfflineAccess(scope) {
  const value = typeof scope === 'string' ? scope.trim() : '';
  if (!value) return 'offline_access';
  return value.split(/\s+/).includes('offline_access') ? value : `${value} offline_access`;
}

/**
 * 发起设备授权。
 * @returns {{ deviceCode: string, userCode: string, verificationUri: string, verificationUriComplete: string, expiresIn: number, interval: number }}
 */
export async function beginDeviceAuthorization({
  appId,
  appSecret,
  scope,
  fetchImpl = fetch,
  timeoutMs,
  signal,
} = {}) {
  const clientId = typeof appId === 'string' ? appId.trim() : '';
  const clientSecret = typeof appSecret === 'string' ? appSecret.trim() : '';
  if (!clientId || !clientSecret) throw new FeishuOAuthError('App ID 或 App Secret 为空');

  const form = new URLSearchParams();
  form.set('client_id', clientId);
  form.set('scope', withOfflineAccess(scope));

  const response = await fetchImpl(DEVICE_AUTHORIZATION_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth(clientId, clientSecret),
    },
    body: form.toString(),
    signal: requestSignal({ timeoutMs, signal }),
  });
  const payload = await readJson(response);

  if (!payload || typeof payload !== 'object') {
    throw new FeishuOAuthError(`飞书设备授权接口返回了无法解析的响应（HTTP ${response.status}）`, {
      status: response.status,
    });
  }
  if (payload.error || response.status >= 400 || !payload.device_code) {
    const message = describeOAuthCode(payload.code)
      ?? (typeof payload.error_description === 'string' && payload.error_description)
      ?? (typeof payload.error === 'string' && payload.error)
      ?? `飞书设备授权失败（HTTP ${response.status}）`;
    throw new FeishuOAuthError(message, {
      feishuCode: typeof payload.code === 'number' ? payload.code : null,
      error: typeof payload.error === 'string' ? payload.error : null,
      errorDescription: typeof payload.error_description === 'string' ? payload.error_description : null,
      status: response.status,
    });
  }

  const expiresIn = Number(payload.expires_in);
  const interval = Number(payload.interval);
  return Object.freeze({
    deviceCode: String(payload.device_code),
    userCode: typeof payload.user_code === 'string' ? payload.user_code : '',
    verificationUri: typeof payload.verification_uri === 'string' ? payload.verification_uri : '',
    verificationUriComplete: typeof payload.verification_uri_complete === 'string'
      ? payload.verification_uri_complete
      : (typeof payload.verification_uri === 'string' ? payload.verification_uri : ''),
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEFAULT_DEVICE_EXPIRES_IN,
    interval: Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_DEVICE_INTERVAL,
  });
}

function tokenFromPayload(payload) {
  return Object.freeze({
    accessToken: payload.access_token,
    expiresIn: Number.isFinite(Number(payload.expires_in)) ? Number(payload.expires_in) : 0,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : '',
    refreshTokenExpiresIn: Number.isFinite(Number(payload.refresh_token_expires_in))
      ? Number(payload.refresh_token_expires_in)
      : 0,
    scope: typeof payload.scope === 'string' ? payload.scope : '',
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer',
  });
}

/**
 * 轮询一次设备码。
 * @returns {{ status: 'pending'|'slow_down'|'authorized'|'denied'|'expired', token?: object, error?: string, description?: string }}
 */
export async function pollDeviceToken({
  appId,
  appSecret,
  deviceCode,
  fetchImpl = fetch,
  timeoutMs,
  signal,
} = {}) {
  if (!deviceCode) throw new FeishuOAuthError('缺少 device_code');
  const form = new URLSearchParams();
  form.set('grant_type', DEVICE_GRANT_TYPE);
  form.set('device_code', deviceCode);
  form.set('client_id', appId);
  form.set('client_secret', appSecret);

  const response = await fetchImpl(TOKEN_V3_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: requestSignal({ timeoutMs, signal }),
  });
  const payload = await readJson(response);
  if (!payload || typeof payload !== 'object') {
    throw new FeishuOAuthError(`飞书 token 接口返回了无法解析的响应（HTTP ${response.status}）`, {
      status: response.status,
    });
  }

  const error = typeof payload.error === 'string' ? payload.error : '';
  if (error === 'authorization_pending') return { status: 'pending' };
  if (error === 'slow_down') return { status: 'slow_down' };
  if (error === 'access_denied') return { status: 'denied', error };
  if (error === 'expired_token') return { status: 'expired', error };

  if (payload.access_token) {
    return { status: 'authorized', token: tokenFromPayload(payload) };
  }

  const message = describeOAuthCode(payload.code)
    ?? (typeof payload.error_description === 'string' && payload.error_description)
    ?? error
    ?? `飞书 token 接口失败（HTTP ${response.status}）`;
  throw new FeishuOAuthError(message, {
    feishuCode: typeof payload.code === 'number' ? payload.code : null,
    error: error || null,
    errorDescription: typeof payload.error_description === 'string' ? payload.error_description : null,
    status: response.status,
  });
}

/** 用 refresh_token 刷新（v3 端点，JSON 请求体，与官方 CLI 一致）。 */
export async function refreshUserAccessToken({
  appId,
  appSecret,
  refreshToken,
  fetchImpl = fetch,
  timeoutMs,
  signal,
} = {}) {
  if (!refreshToken) throw new FeishuOAuthError('缺少 refresh_token');
  const response = await fetchImpl(TOKEN_V3_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appId,
      client_secret: appSecret,
    }),
    signal: requestSignal({ timeoutMs, signal }),
  });
  const payload = await readJson(response);
  if (!payload || typeof payload !== 'object') {
    throw new FeishuOAuthError(`飞书 token 接口返回了无法解析的响应（HTTP ${response.status}）`, {
      status: response.status,
    });
  }
  if (payload.error || (!payload.access_token && payload.code && payload.code !== 0)) {
    const message = describeOAuthCode(payload.code)
      ?? (typeof payload.error_description === 'string' && payload.error_description)
      ?? (typeof payload.error === 'string' && payload.error)
      ?? `飞书刷新 token 失败（HTTP ${response.status}）`;
    throw new FeishuOAuthError(message, {
      feishuCode: typeof payload.code === 'number' ? payload.code : null,
      error: typeof payload.error === 'string' ? payload.error : null,
      errorDescription: typeof payload.error_description === 'string' ? payload.error_description : null,
      status: response.status,
    });
  }
  if (!payload.access_token) throw new FeishuOAuthError('飞书没有返回 access_token', { status: response.status });
  return tokenFromPayload(payload);
}

/** token 响应 → user-token.json 文档。 */
export function tokenDocument({ token, appId, user, previous = null, now = Date.now() }) {
  const issuedAt = Number.isFinite(now) ? now : Date.now();
  return {
    version: 1,
    appId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken || previous?.refreshToken || '',
    accessTokenExpiresAt: token.expiresIn ? issuedAt + token.expiresIn * 1000 : previous?.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: token.refreshTokenExpiresIn
      ? issuedAt + token.refreshTokenExpiresIn * 1000
      : previous?.refreshTokenExpiresAt ?? null,
    scope: token.scope || previous?.scope || '',
    user: user ?? previous?.user ?? null,
    authorizedAt: previous?.authorizedAt ?? new Date(issuedAt).toISOString(),
  };
}
