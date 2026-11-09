/**
 * 用户身份（飞书分身）的 Host 半。
 *
 * 复用机器人应用与 credentials；不注册任何模型工具，工具在 ./user-identity 子路径。
 */
import { DEFAULT_USER_SCOPE } from './config.js';

export class UserIdentityManager {
  #configStore;
  #botConfigStore;
  #auth;
  #connect;
  #logger;
  #qrCodeDataUrl = null;
  #keepaliveTimer = null;

  constructor({ configStore, botConfigStore, auth, connect, logger = null }) {
    this.#configStore = configStore;
    this.#botConfigStore = botConfigStore;
    this.#auth = auth;
    this.#connect = connect;
    this.#logger = logger;
  }

  async status() {
    const auth = await this.#auth.status();
    const connectStatus = this.#connect.status;
    return Object.freeze({
      config: auth.config,
      authorization: auth.authorization,
      connect: Object.freeze({
        ...connectStatus,
        qrCodeDataUrl: connectStatus.phase === 'pending' ? this.#qrCodeDataUrl : null,
      }),
    });
  }

  async connectBegin(input = {}) {
    const botId = typeof input?.botId === 'string' ? input.botId.trim() : '';
    if (botId) {
      if (!this.#botConfigStore?.bot(botId)) throw new Error(`机器人不存在：${botId}`);
      await this.#configStore.save({ botId });
    }
    // scope 是一组固定集合，不保留旧配置里的额外权限。
    if (this.#configStore.config.scope !== DEFAULT_USER_SCOPE) {
      await this.#configStore.save({ scope: DEFAULT_USER_SCOPE });
    }
    this.#qrCodeDataUrl = null;
    const started = await this.#connect.begin();
    let qrCodeDataUrl = null;
    if (started?.url) {
      try {
        const { default: QRCode } = await import('qrcode');
        qrCodeDataUrl = await QRCode.toDataURL(started.url, { margin: 1, width: 220 });
      } catch {
        qrCodeDataUrl = null;
      }
    }
    this.#qrCodeDataUrl = qrCodeDataUrl;
    if (!qrCodeDataUrl) {
      this.#connect.cancel();
      throw new Error('二维码生成失败，请重试');
    }
    return Object.freeze({ ...started, qrCodeDataUrl });
  }

  connectCancel() {
    this.#connect.cancel();
    this.#qrCodeDataUrl = null;
    return this.status();
  }

  async disconnect() {
    this.#connect.cancel();
    this.#qrCodeDataUrl = null;
    await this.#auth.disconnect();
    return this.status();
  }

  async refresh() {
    await this.#auth.refresh({ force: true });
    return this.status();
  }

  /**
   * Keep the user token usable while DSH is running.
   * - access_token is short-lived (about 2 hours);
   * - refresh_token can be short too (7 days in the current device flow).
   * Refresh when either is close to expiry, not only when refresh_token is low.
   */
  startKeepalive({
    intervalMs = 15 * 60 * 1000,
    accessBeforeMs = 10 * 60 * 1000,
    refreshBeforeMs = 2 * 24 * 60 * 60 * 1000,
  } = {}) {
    if (this.#keepaliveTimer) return;
    const tick = async () => {
      try {
        const status = await this.status();
        if (!status.authorization?.authorized) return;
        const now = Date.now();
        const accessExpiresAt = status.authorization.accessTokenExpiresAt;
        const refreshExpiresAt = status.authorization.refreshTokenExpiresAt;
        const accessDue = !Number.isFinite(accessExpiresAt) || accessExpiresAt - now <= accessBeforeMs;
        const refreshDue = Number.isFinite(refreshExpiresAt) && refreshExpiresAt - now <= refreshBeforeMs;
        if (!accessDue && !refreshDue) return;
        await this.refresh();
        this.#logger?.info?.(`[im-feishu] 用户身份 token 已自动续期（${accessDue ? 'access' : 'refresh'}）`);
      } catch (error) {
        this.#logger?.warn?.('[im-feishu] 用户身份自动续期失败', error);
      }
    };
    this.#keepaliveTimer = setInterval(tick, intervalMs);
    this.#keepaliveTimer.unref?.();
    void tick();
  }

  dispose() {
    if (this.#keepaliveTimer) {
      clearInterval(this.#keepaliveTimer);
      this.#keepaliveTimer = null;
    }
    this.#connect.dispose();
    this.#logger?.info?.('[im-feishu] 用户身份已卸载');
  }
}
