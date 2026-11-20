/**
 * 用户身份的 token 生命周期。
 *
 * 主面板、全局工具和监听器共用：读 token、按需用 refresh_token
 * 换新 token、原子写回。
 */
import { getUserInfo, requestFeishu } from './api.js';
import { resolveIdentityApp } from './app.js';
import { CLOUD_SPACE_USER_SCOPES, DEFAULT_USER_SCOPE } from './config.js';
import { NotAuthorizedError, isExpiredTokenError, isRefreshTokenDeadError } from './errors.js';
import { refreshUserAccessToken, tokenDocument } from './oauth.js';

/** 同一进程内不同入口可能同时刷新同一份 token。 */
const refreshFlights = new Map();

/** 用户身份工具共用：凭证被飞书判定为失效时，刷新并重试一次。 */
export async function withAccessToken(auth, operation, signal) {
  signal?.throwIfAborted();
  const accessToken = await auth.requireAccessToken();
  signal?.throwIfAborted();
  try {
    return await operation(accessToken);
  } catch (error) {
    signal?.throwIfAborted();
    if (!isExpiredTokenError(error)) throw error;
    const refreshedToken = await auth.requireAccessToken({ force: true, failedAccessToken: accessToken });
    signal?.throwIfAborted();
    return operation(refreshedToken);
  }
}

/** A token refresh retries the rejected request, never the whole operation. */
export function createUserFeishuRequest({ auth, fetchImpl, signal }) {
  return (options) => withAccessToken(auth, (accessToken) => requestFeishu({
    ...options, accessToken, fetchImpl, signal,
  }), signal);
}

/**
 * 跨多步请求复用同一份 accessToken；仅在某一步被飞书判过期时刷新一次并重试该步。
 */
export function createTokenSession(auth, { initialToken = null, signal } = {}) {
  let accessToken = initialToken;
  let openId;
  const acquire = async (options) => {
    if (typeof auth.requireAccessIdentity === 'function') {
      ({ accessToken, openId } = await auth.requireAccessIdentity(options));
    } else {
      accessToken = await auth.requireAccessToken(options);
    }
    return accessToken;
  };
  return {
    get openId() { return openId; },
    async init() {
      signal?.throwIfAborted?.();
      if (!accessToken) await acquire();
      signal?.throwIfAborted?.();
      return accessToken;
    },
    async run(operation) {
      signal?.throwIfAborted?.();
      if (!accessToken) await acquire();
      signal?.throwIfAborted?.();
      try {
        return await operation(accessToken);
      } catch (error) {
        signal?.throwIfAborted?.();
        if (!isExpiredTokenError(error)) throw error;
        await acquire({ force: true, failedAccessToken: accessToken });
        signal?.throwIfAborted?.();
        return operation(accessToken);
      }
    },
  };
}
export class UserIdentityAuth {
  #configStore;
  #tokenStore;
  #botConfigStore;
  #credentials;
  #fetchImpl;
  #now;
  #timeoutMs;
  #logger;

  constructor({
    configStore,
    tokenStore,
    botConfigStore,
    credentials = null,
    fetchImpl = fetch,
    now = () => Date.now(),
    timeoutMs = 15_000,
    logger = null,
  }) {
    this.#configStore = configStore;
    this.#tokenStore = tokenStore;
    this.#botConfigStore = botConfigStore;
    this.#credentials = credentials;
    this.#fetchImpl = fetchImpl;
    this.#now = now;
    this.#timeoutMs = timeoutMs;
    this.#logger = logger;
  }

  get config() {
    return this.#configStore.config;
  }

  /** 重新读取磁盘上的配置和 token；主面板、工具和监听器共用文件。 */
  async reload() {
    await this.#configStore.load();
    await this.#tokenStore.load();
    return this;
  }

  /** 解析当前配置对应的机器人应用；没有可用应用时抛 NotConfiguredError。 */
  resolveApp() {
    return resolveIdentityApp({
      botConfigStore: this.#botConfigStore,
      credentials: this.#credentials,
      identityConfig: this.config,
    });
  }

  #appMatches(doc, app) {
    return Boolean(doc?.appId) && doc.appId === app?.appId;
  }

  /** 主面板状态：不返回任何 token 明文。 */
  async status() {
    await this.reload();
    const tokens = this.#tokenStore.status(this.#now());
    let app = null;
    let appError = null;
    try {
      const resolved = await this.resolveApp();
      app = {
        available: true,
        botId: resolved.botId,
        botName: resolved.botName,
        appId: resolved.appId,
      };
    } catch (error) {
      appError = error?.message ?? String(error);
      app = { available: false, botId: this.config.botId || null, appId: '' };
    }
    const appMismatch = Boolean(tokens.present && tokens.appId && app.appId && tokens.appId !== app.appId);
    // Compare against the next authorization request, even if the stored
    // configuration still contains a scope list from an earlier version.
    const requiredScopes = DEFAULT_USER_SCOPE.split(' ');
    const grantedScopes = new Set(String(tokens.scope ?? '').split(/\s+/).filter(Boolean));
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
    const scopeSatisfied = Boolean(tokens.present) && missingScopes.length === 0;
    const messageScopesSatisfied = Boolean(tokens.present)
      && missingScopes.every((scope) => CLOUD_SPACE_USER_SCOPES.includes(scope));
    return Object.freeze({
      config: Object.freeze({
        botId: this.config.botId,
        scope: DEFAULT_USER_SCOPE,
        app,
        appError,
      }),
      authorization: Object.freeze({
        authorized: Boolean(tokens.present && tokens.user?.openId) && !appMismatch,
        appMismatch,
        user: appMismatch ? null : tokens.user,
        scope: tokens.scope,
        authorizedAt: tokens.authorizedAt,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        accessTokenValid: tokens.accessTokenValid,
        refreshable: tokens.refreshable,
        scopeSatisfied,
        messageScopesSatisfied,
        missingScopes,
      }),
    });
  }

  /** 工具入口：返回可用的 user_access_token。 */
  async requireAccessToken(options) {
    return (await this.requireAccessIdentity(options)).accessToken;
  }

  /** 同一个凭据快照中的 token 与用户身份，供私聊监听核对账号。 */
  async requireAccessIdentity({ force = false, failedAccessToken = null } = {}) {
    await this.reload();
    const app = await this.resolveApp();
    const doc = this.#tokenStore.document;
    if (!doc?.accessToken || !doc.user?.openId) throw new NotAuthorizedError();
    if (!this.#appMatches(doc, app)) {
      throw new NotAuthorizedError('用户身份使用的飞书应用已变化，请重新授权');
    }
    const alreadyRotated = Boolean(failedAccessToken && doc.accessToken !== failedAccessToken);
    const current = (!force || alreadyRotated) && this.#tokenStore.accessTokenUsable(this.#now())
      ? doc
      : await this.refresh({ failedAccessToken });
    return { accessToken: current.accessToken, openId: current.user.openId };
  }

  /** 用 refresh_token 刷新；同一路径共享一次进行中的请求。 */
  async refresh(options = {}) {
    const key = this.#tokenStore.path;
    const existing = refreshFlights.get(key);
    if (existing) return existing;
    const task = this.#refreshOnce(options).finally(() => {
      if (refreshFlights.get(key) === task) refreshFlights.delete(key);
    });
    refreshFlights.set(key, task);
    return task;
  }

  async #refreshOnce({ force = false, failedAccessToken = null } = {}) {
    await this.reload();
    const app = await this.resolveApp();
    const doc = this.#tokenStore.document;
    if (!doc?.refreshToken) {
      throw new NotAuthorizedError('授权已失效（没有 refresh_token），请重新连接');
    }
    if (!this.#appMatches(doc, app)) {
      throw new NotAuthorizedError('用户身份使用的飞书应用已变化，请重新连接');
    }
    if (failedAccessToken && doc.accessToken !== failedAccessToken && this.#tokenStore.accessTokenUsable(this.#now())) {
      return doc;
    }
    if (!force && !this.#tokenStore.refreshTokenUsable(this.#now())) {
      throw new NotAuthorizedError('refresh_token 已过期，请重新连接');
    }
    let token;
    try {
      token = await refreshUserAccessToken({
        appId: app.appId,
        appSecret: app.appSecret,
        refreshToken: doc.refreshToken,
        fetchImpl: this.#fetchImpl,
        timeoutMs: this.#timeoutMs,
      });
    } catch (error) {
      if (isRefreshTokenDeadError(error)) {
        throw new NotAuthorizedError('授权已失效，请重新连接');
      }
      throw error;
    }
    // 刷新期间可能刚完成重新授权、切换机器人或另一实例先刷新了。
    // 先读回磁盘；如果 token 已变化，丢弃这次旧结果，避免覆盖新授权。
    await this.#tokenStore.load();
    const latest = this.#tokenStore.document;
    if (!latest?.refreshToken) {
      throw new NotAuthorizedError('授权已失效，请重新连接');
    }
    if (latest.appId !== doc.appId
      || latest.refreshToken !== doc.refreshToken
      || latest.accessToken !== doc.accessToken) {
      this.#logger?.warn?.('[im-feishu] 刷新期间授权已变化，丢弃旧 token 结果');
      return latest;
    }
    const saved = await this.#tokenStore.save(tokenDocument({
      token,
      appId: app.appId,
      user: doc.user,
      previous: doc,
      now: this.#now(),
    }));
    this.#logger?.info?.('[im-feishu] user_access_token 已刷新');
    return saved;
  }

  /** 设备授权成功后落库：先拉一次用户信息，再保存 token。 */
  async acceptDeviceToken(token, { app, signal } = {}) {
    signal?.throwIfAborted();
    const resolved = app ?? await this.resolveApp();
    const user = await getUserInfo({
      accessToken: token.accessToken,
      fetchImpl: this.#fetchImpl,
      timeoutMs: this.#timeoutMs,
      signal,
    });
    signal?.throwIfAborted();
    if (!user.openId) throw new Error('飞书没有返回授权用户的 open_id');
    const previous = this.#tokenStore.document;
    const sameIdentity = previous?.appId === resolved.appId && previous?.user?.openId === user.openId;
    const saved = await this.#tokenStore.save(tokenDocument({
      token,
      appId: resolved.appId,
      user,
      // 切换应用或用户时，不能继承上一份授权的 refresh_token、scope 和有效期。
      previous: sameIdentity ? previous : null,
      now: this.#now(),
      preserveAuthorizedAt: false,
    }), { signal });
    this.#logger?.info?.(`[im-feishu] 用户身份已授权：${user.name || user.openId}`);
    return saved;
  }

  async disconnect() {
    await this.#tokenStore.clear();
    this.#logger?.info?.('[im-feishu] 已清除用户身份 token');
  }
}
