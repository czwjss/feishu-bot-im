/**
 * 用户身份的设备授权状态机。
 *
 * begin() 拿到验证链接和 user_code 后，Host 在后台按飞书给的 interval 轮询；
 * 设置页只读 status()，不需要自己维持轮询或回调服务。
 */
import { describeError } from './errors.js';
import { beginDeviceAuthorization, pollDeviceToken } from './oauth.js';

const IDLE = Object.freeze({
  phase: 'idle',
  error: null,
  startedAt: null,
  expiresAt: null,
  userCode: '',
  verificationUrl: '',
  user: null,
});

const MAX_INTERVAL_SECONDS = 60;

export class UserIdentityConnect {
  #auth;
  #now;
  #logger;
  #fetchImpl;
  #pending = null;
  #timer = null;
  #generation = 0;
  #controller = null;
  #state = IDLE;

  constructor({ auth, now = () => Date.now(), logger = null, fetchImpl = fetch }) {
    this.#auth = auth;
    this.#now = now;
    this.#logger = logger;
    this.#fetchImpl = fetchImpl;
  }

  get status() {
    return this.#state;
  }

  /** 发起设备授权：返回给设置页展示的链接和验证码。 */
  async begin() {
    this.#stop();
    const generation = this.#generation;
    const controller = new AbortController();
    this.#controller = controller;
    // 先清空旧状态：解析应用或网络请求失败时，设置页不应继续显示上一次的二维码。
    this.#state = IDLE;
    const app = await this.#auth.resolveApp();
    controller.signal.throwIfAborted();
    const config = this.#auth.config;
    const authorization = await beginDeviceAuthorization({
      appId: app.appId,
      appSecret: app.appSecret,
      scope: config.scope,
      fetchImpl: this.#fetchImpl,
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();

    const startedAt = this.#now();
    const expiresAt = startedAt + authorization.expiresIn * 1000;
    this.#pending = {
      app,
      deviceCode: authorization.deviceCode,
      interval: authorization.interval,
      expiresAt,
      signal: controller.signal,
    };
    this.#state = Object.freeze({
      phase: 'pending',
      error: null,
      startedAt,
      expiresAt,
      userCode: authorization.userCode,
      verificationUrl: authorization.verificationUriComplete,
      user: null,
    });
    this.#schedule(generation, authorization.interval);

    return Object.freeze({
      url: authorization.verificationUriComplete,
      userCode: authorization.userCode,
      expiresAt,
      interval: authorization.interval,
    });
  }

  cancel() {
    this.#stop();
    this.#state = IDLE;
    return this.#state;
  }

  dispose() {
    this.cancel();
  }

  #schedule(generation, seconds) {
    this.#clearTimer();
    const delay = Math.max(1, Number(seconds) || 5) * 1000;
    this.#timer = setTimeout(() => {
      void this.#poll(generation);
    }, delay);
    this.#timer.unref?.();
  }

  async #poll(generation) {
    if (generation !== this.#generation || !this.#pending) return;
    const pending = this.#pending;
    if (this.#now() >= pending.expiresAt) {
      this.#finish(generation, 'failed', '授权已超时，请重新发起');
      return;
    }

    let result;
    try {
      result = await pollDeviceToken({
        appId: pending.app.appId,
        appSecret: pending.app.appSecret,
        deviceCode: pending.deviceCode,
        fetchImpl: this.#fetchImpl,
        signal: pending.signal,
      });
    } catch (error) {
      if (generation !== this.#generation) return;
      // 网络抖动继续轮询，直到过期或成功。
      this.#logger?.warn?.('[im-feishu] 设备授权轮询失败，稍后重试', describeError(error));
      if (this.#now() >= pending.expiresAt) {
        this.#finish(generation, 'failed', '授权已超时，请重新发起');
      } else {
        this.#schedule(generation, pending.interval);
      }
      return;
    }
    if (generation !== this.#generation) return;

    if (result.status === 'authorized') {
      try {
        const doc = await this.#auth.acceptDeviceToken(result.token, { app: pending.app, signal: pending.signal });
        this.#finish(generation, 'succeeded', null, doc.user);
      } catch (error) {
        this.#finish(generation, 'failed', describeError(error));
      }
      return;
    }
    if (result.status === 'denied') {
      this.#finish(generation, 'failed', '用户拒绝了授权');
      return;
    }
    if (result.status === 'expired') {
      this.#finish(generation, 'failed', '授权已超时，请重新发起');
      return;
    }

    if (result.status === 'slow_down') {
      pending.interval = Math.min(pending.interval + 5, MAX_INTERVAL_SECONDS);
    }
    this.#schedule(generation, pending.interval);
  }

  #finish(generation, phase, error, user = null) {
    if (generation !== this.#generation) return;
    const previous = this.#state;
    this.#generation += 1;
    this.#pending = null;
    this.#controller = null;
    this.#clearTimer();
    this.#state = Object.freeze({
      phase,
      error,
      startedAt: previous.startedAt ?? null,
      expiresAt: null,
      userCode: previous.userCode ?? '',
      verificationUrl: previous.verificationUrl ?? '',
      user: user ?? null,
    });
  }

  #clearTimer() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #stop() {
    this.#generation += 1;
    this.#controller?.abort();
    this.#controller = null;
    this.#pending = null;
    this.#clearTimer();
  }
}
