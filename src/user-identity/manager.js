/**
 * 用户身份（飞书分身）的 Host 半。
 *
 * 复用机器人应用与 credentials；不注册任何模型工具，工具在 ./user-identity 子路径。
 */
import { maskAppId } from './app.js';
import { DEFAULT_USER_SCOPE } from './config.js';

export class UserIdentityManager {
  #configStore;
  #botConfigStore;
  #tokenStore;
  #credentials;
  #auth;
  #connect;
  #dataDir;
  #logger;
  #qrCodeDataUrl = null;
  #keepaliveTimer = null;

  constructor({ configStore, botConfigStore, tokenStore, credentials, auth, connect, dataDir, logger = null }) {
    this.#configStore = configStore;
    this.#botConfigStore = botConfigStore;
    this.#tokenStore = tokenStore;
    this.#credentials = credentials;
    this.#auth = auth;
    this.#connect = connect;
    this.#dataDir = dataDir;
    this.#logger = logger;
  }

  get auth() {
    return this.#auth;
  }

  async status() {
    const auth = await this.#auth.status();
    const bots = (this.#botConfigStore?.bots ?? []).map((bot) => ({
      id: bot.id,
      name: bot.botName ?? bot.alias ?? bot.id,
      appIdMasked: maskAppId(bot.appId),
    }));
    const connectStatus = this.#connect.status;
    return Object.freeze({
      dataDir: this.#dataDir,
      config: Object.freeze({ ...auth.config, bots }),
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
   * Keep a refresh token alive while DSH is running. Feishu can issue a
   * short-lived refresh token (7 days for the current device flow); rotating it
   * before expiry avoids forcing the user to scan again.
   */
  startKeepalive({ intervalMs = 6 * 60 * 60 * 1000, refreshBeforeMs = 2 * 24 * 60 * 60 * 1000 } = {}) {
    if (this.#keepaliveTimer) return;
    const tick = async () => {
      try {
        const status = await this.status();
        if (!status.authorization?.authorized) return;
        const expiresAt = status.authorization.refreshTokenExpiresAt;
        if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > refreshBeforeMs) return;
        await this.refresh();
        this.#logger?.info?.('[im-feishu] 用户身份 refresh_token 已自动续期');
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
