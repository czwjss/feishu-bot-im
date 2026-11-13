/**
 * 用户身份的 token 生命周期。
 *
 * 设置页、全局工具和监听器共用：读 token、按需用 refresh_token
 * 换新 token、原子写回。
 */
import { getUserInfo } from './api.js';
import { maskAppId, resolveIdentityApp } from './app.js';
import { NotAuthorizedError, isRefreshTokenDeadError } from './errors.js';
import { refreshUserAccessToken, tokenDocument } from './oauth.js';

/** 同一进程内不同入口可能同时刷新同一份 token。 */
const refreshFlights = new Map();

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

  /** 重新读取磁盘上的配置和 token；设置页、工具和监听器共用文件。 */
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

  /** 设置页状态：不返回任何 token 明文。 */
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
        appIdMasked: maskAppId(resolved.appId),
      };
    } catch (error) {
      appError = error?.message ?? String(error);
      app = { available: false, botId: this.config.botId || null, appId: '', appIdMasked: '' };
    }
    const appMismatch = Boolean(tokens.present && tokens.appId && app.appId && tokens.appId !== app.appId);
    const requiredScopes = String(this.config.scope ?? '').split(/\s+/).filter(Boolean);
    const grantedScopes = new Set(String(tokens.scope ?? '').split(/\s+/).filter(Boolean));
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
    const scopeSatisfied = Boolean(tokens.present) && missingScopes.length === 0;
    return Object.freeze({
      config: Object.freeze({
        botId: this.config.botId,
        scope: this.config.scope,
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
        missingScopes,
      }),
    });
  }

  /** 工具入口：返回可用的 user_access_token。 */
  async requireAccessToken({ force = false } = {}) {
    await this.reload();
    const app = await this.resolveApp();
    const doc = this.#tokenStore.document;
    if (!doc?.accessToken || !doc.user?.openId) throw new NotAuthorizedError();
    if (!this.#appMatches(doc, app)) {
      throw new NotAuthorizedError('用户身份使用的飞书应用已变化，请重新授权');
    }
    if (!force && this.#tokenStore.accessTokenUsable(this.#now())) return doc.accessToken;
    const refreshed = await this.refresh();
    return refreshed.accessToken;
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

  async #refreshOnce({ force = false } = {}) {
    await this.reload();
    const app = await this.resolveApp();
    const doc = this.#tokenStore.document;
    if (!doc?.refreshToken) {
      throw new NotAuthorizedError('授权已失效（没有 refresh_token），请重新连接');
    }
    if (!this.#appMatches(doc, app)) {
      throw new NotAuthorizedError('用户身份使用的飞书应用已变化，请重新连接');
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
