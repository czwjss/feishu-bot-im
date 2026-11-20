/**
 * 飞书应用「扫码接入」设备注册状态机（基于 RFC 8628 / @larksuiteoapi/node-sdk registerApp 协议）。
 *
 * Pull 模式推进：begin() 发起设备授权并返回二维码快照，调用方按 nextPollInMs 轮询 poll()
 * 直到终态。网络/协议异常均转为 error 快照而不 reject；明文 appSecret 仅保存在 success 快照
 * 内存中，落库后由调用方调用 clearCredentials() 立即擦除。
 */
import { gzipSync } from 'node:zlib';

export const REGISTRATION_ENDPOINT = '/oauth/v1/app/registration';
export const FEISHU_ACCOUNTS_ORIGIN = 'https://accounts.feishu.cn';
export const LARK_ACCOUNTS_ORIGIN = 'https://accounts.larksuite.com';

export const REGISTRATION_STATES = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  QR_READY: 'qr_ready',
  PENDING: 'pending',
  SLOW_DOWN: 'slow_down',
  SUCCESS: 'success',
  DENIED: 'denied',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  ERROR: 'error',
});

const ACTIVE_STATES = new Set(['starting', 'qr_ready', 'pending', 'slow_down']);
const POLLABLE_STATES = new Set(['qr_ready', 'pending', 'slow_down']);
const OFFICIAL_REGISTRATION_HOSTS = new Set([
  'accounts.feishu.cn',
  'accounts.larksuite.com',
  'open.feishu.cn',
  'open.larksuite.com',
]);

const DEFAULT_INTERVAL_MS = 5_000;
const SLOW_DOWN_INCREMENT_MS = 5_000;
const DEFAULT_EXPIRES_IN_SECONDS = 600;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const MAX_ERROR_DETAIL = 200;

const ERROR_MESSAGES = Object.freeze({
  access_denied: '用户已拒绝授权，未创建飞书应用。',
  expired_token: '二维码已过期，请重新发起扫码接入。',
  abort: '扫码接入已取消。',
  network_error: '无法连接飞书开放平台，请检查网络后重试。',
  request_timeout: '连接飞书开放平台超时，请重试。',
  invalid_response: '飞书开放平台返回了无法识别的扫码响应。',
  invalid_credentials: '飞书开放平台没有返回有效的应用凭证。',
  disposed: '扫码接入已关闭，请重新创建 RegistrationManager。',
  registration_failed: '飞书应用扫码接入失败，请重试。',
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function internalError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause !== undefined) err.cause = cause;
  return err;
}

function safeDetail(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_ERROR_DETAIL);
  return text || null;
}

function toPublicError(error) {
  const code = typeof error?.code === 'string' && error.code ? error.code : 'registration_failed';
  const fallback = typeof error?.message === 'string' ? error.message.trim().slice(0, MAX_ERROR_DETAIL) : '';
  return { code, message: ERROR_MESSAGES[code] || fallback || ERROR_MESSAGES.registration_failed };
}

function encodeAddons(addons) {
  if (!isPlainObject(addons)) throw new TypeError('addons must be an object');
  const { preset, scopes, events, callbacks } = addons;
  const payload = {
    ...(preset !== undefined ? { preset } : {}),
    ...(scopes ? { scopes } : {}),
    ...(events ? { events } : {}),
    ...(callbacks ? { callbacks } : {}),
  };
  return gzipSync(Buffer.from(JSON.stringify(payload), 'utf8')).toString('base64url');
}

function resolveOrigin(value, label) {
  if (!value || value === 'feishu') return FEISHU_ACCOUNTS_ORIGIN;
  if (value === 'lark') return LARK_ACCOUNTS_ORIGIN;
  let url;
  try {
    const text = String(value).trim();
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new TypeError(`${label} must be an official Feishu/Lark accounts origin`);
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash
    || url.username || url.password || url.port || !OFFICIAL_REGISTRATION_HOSTS.has(url.hostname)) {
    throw new TypeError(`${label} must be an official Feishu/Lark accounts origin`);
  }
  return url.origin;
}

function mergeConfig(base, opts = {}) {
  if (opts == null) opts = {};
  if (!isPlainObject(opts)) throw new TypeError('Registration options must be an object');
  const has = (k) => Object.hasOwn(opts, k);
  return {
    origin: has('domain') ? resolveOrigin(opts.domain, 'domain') : base.origin,
    larkOrigin: has('larkDomain') ? resolveOrigin(opts.larkDomain, 'larkDomain') : base.larkOrigin,
    source: has('source') ? (typeof opts.source === 'string' ? opts.source.trim() || null : null) : base.source,
    appPreset: has('appPreset') ? (isPlainObject(opts.appPreset) ? opts.appPreset : null) : base.appPreset,
    addonsParam: has('addons') ? (opts.addons == null ? null : encodeAddons(opts.addons)) : base.addonsParam,
    createOnly: has('createOnly') ? Boolean(opts.createOnly) : base.createOnly,
    appId: has('appId') ? (typeof opts.appId === 'string' ? opts.appId.trim() || null : null) : base.appId,
    intervalMs: has('interval') && Number(opts.interval) > 0 ? Number(opts.interval) : base.intervalMs,
  };
}

/** 构造落地页二维码 URL，并强制校验目标主机属于官方白名单。 */
function buildQrCodeUrl(verificationUri, cfg) {
  let url;
  try {
    url = new URL(verificationUri);
  } catch {
    throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
  }
  if (url.protocol !== 'https:' || !OFFICIAL_REGISTRATION_HOSTS.has(url.hostname)
    || url.port || url.username || url.password) {
    throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
  }
  url.searchParams.set('from', 'sdk');
  url.searchParams.set('source', cfg.source ? `node-sdk/${cfg.source}` : 'node-sdk');
  url.searchParams.set('tp', 'sdk');
  if (cfg.appPreset) {
    const avatars = cfg.appPreset.avatar == null ? [] : [].concat(cfg.appPreset.avatar);
    for (const avatar of avatars) if (avatar) url.searchParams.append('avatar', String(avatar));
    if (cfg.appPreset.name) url.searchParams.set('name', String(cfg.appPreset.name));
    if (cfg.appPreset.desc) url.searchParams.set('desc', String(cfg.appPreset.desc));
  }
  if (cfg.addonsParam) url.searchParams.set('addons', cfg.addonsParam);
  if (cfg.createOnly) url.searchParams.set('createOnly', 'true');
  if (cfg.appId) url.searchParams.set('clientID', cfg.appId);
  return url.toString();
}

function copySnapshot(snap) {
  return {
    ...snap,
    ...(snap.error ? { error: { ...snap.error } } : {}),
    ...(snap.userInfo ? { userInfo: { ...snap.userInfo } } : {}),
  };
}

export class RegistrationManager {
  #fetch;
  #now;
  #setTimeout;
  #clearTimeout;
  #logger;
  #requestTimeoutMs;
  #defaults;
  #attempt = 0;
  #run = null;
  #snapshot;
  #disposed = false;

  constructor(options = {}) {
    if (!isPlainObject(options)) throw new TypeError('RegistrationManager options must be an object');
    const {
      fetch: fetchImpl = globalThis.fetch,
      now = Date.now,
      setTimeout: setTimeoutFn = globalThis.setTimeout,
      clearTimeout: clearTimeoutFn = globalThis.clearTimeout,
      logger = console,
      requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    } = options;
    if (typeof fetchImpl !== 'function') throw new TypeError('RegistrationManager requires a fetch implementation');

    this.#fetch = fetchImpl;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
    this.#logger = logger ?? null;
    this.#requestTimeoutMs = Number(requestTimeoutMs) >= 0 ? Number(requestTimeoutMs) : DEFAULT_REQUEST_TIMEOUT_MS;
    this.#defaults = mergeConfig({
      origin: FEISHU_ACCOUNTS_ORIGIN,
      larkOrigin: LARK_ACCOUNTS_ORIGIN,
      source: null,
      appPreset: null,
      addonsParam: null,
      createOnly: true,
      appId: null,
      intervalMs: null,
    }, options);
    this.#snapshot = this.#makeSnapshot(null, REGISTRATION_STATES.IDLE);
  }

  async begin(options = {}) {
    if (this.#disposed) {
      return {
        ...copySnapshot(this.#snapshot),
        state: REGISTRATION_STATES.ERROR,
        updatedAt: this.#now(),
        error: { code: 'disposed', message: ERROR_MESSAGES.disposed },
      };
    }

    const cfg = mergeConfig(this.#defaults, options);
    if (this.#run) this.#detachRun(this.#run, true);

    const run = {
      id: ++this.#attempt,
      state: REGISTRATION_STATES.STARTING,
      startedAt: this.#now(),
      origin: cfg.origin,
      larkOrigin: cfg.larkOrigin,
      domainHost: new URL(cfg.origin).host,
      domainSwitched: false,
      qrCodeUrl: null,
      userCode: null,
      deviceCode: null,
      expiresAt: null,
      intervalMs: cfg.intervalMs ?? DEFAULT_INTERVAL_MS,
      expiryTimer: null,
      requestController: null,
      pollPromise: null,
      result: null,
    };
    this.#run = run;
    this.#snapshot = this.#makeSnapshot(run, REGISTRATION_STATES.STARTING);

    try {
      const body = await this.#post(run, {
        action: 'begin',
        archetype: 'PersonalAgent',
        auth_method: 'client_secret',
        request_user_info: 'open_id',
      });
      if (this.#run !== run) return this.snapshot();

      const deviceCode = typeof body.device_code === 'string' ? body.device_code.trim() : '';
      const expiresIn = body.expires_in == null ? DEFAULT_EXPIRES_IN_SECONDS : Number(body.expires_in);
      if (typeof body.verification_uri_complete !== 'string' || !body.verification_uri_complete
        || !deviceCode || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }

      run.qrCodeUrl = buildQrCodeUrl(body.verification_uri_complete, cfg);
      run.userCode = typeof body.user_code === 'string' && body.user_code ? body.user_code : null;
      run.deviceCode = deviceCode;
      run.expiresAt = this.#now() + expiresIn * 1000;
      if (cfg.intervalMs === null) {
        const sec = Number(body.interval);
        run.intervalMs = Number.isFinite(sec) && sec > 0 ? sec * 1000 : DEFAULT_INTERVAL_MS;
      }
      this.#scheduleExpiry(run, expiresIn * 1000);
      this.#transition(run, REGISTRATION_STATES.QR_READY);
      this.#log('info', `registration ${run.id} QR ready`);
    } catch (error) {
      if (this.#run === run) this.#failRun(run, error);
    }
    return this.snapshot();
  }

  async poll() {
    this.#expireIfNeeded();
    const run = this.#run;
    if (!run || !POLLABLE_STATES.has(run.state)) return this.snapshot();
    if (run.pollPromise) return run.pollPromise;

    const promise = this.#runPoll(run).finally(() => {
      if (run.pollPromise === promise) run.pollPromise = null;
    });
    run.pollPromise = promise;
    return promise;
  }

  cancel() {
    const run = this.#run;
    if (!run) return this.snapshot();
    const controller = run.requestController;
    this.#finishRun(run, REGISTRATION_STATES.CANCELLED, { code: 'abort', message: ERROR_MESSAGES.abort });
    controller?.abort();
    this.#log('info', `registration ${run.id} cancelled`);
    return this.snapshot();
  }

  snapshot() {
    this.#expireIfNeeded();
    const snap = copySnapshot(this.#snapshot);
    if (ACTIVE_STATES.has(snap.state) && snap.expiresAt != null) {
      snap.remainingSeconds = Math.max(0, Math.ceil((snap.expiresAt - this.#now()) / 1000));
    }
    return snap;
  }

  /** 凭据落库后立即擦除内存中缓存的明文 appSecret，防止重复读取。 */
  clearCredentials() {
    if (this.#run?.result) this.#run.result.appSecret = null;
    if (this.#snapshot && Object.hasOwn(this.#snapshot, 'appSecret')) {
      const { appSecret: _discarded, ...rest } = this.#snapshot;
      this.#snapshot = rest;
    }
  }

  dispose() {
    if (this.#disposed) return this.snapshot();
    this.#disposed = true;
    if (this.#run) this.#detachRun(this.#run, true);
    this.#snapshot = this.#makeSnapshot(null, REGISTRATION_STATES.IDLE);
    this.#log('info', 'registration manager disposed');
    return this.snapshot();
  }

  async #runPoll(run) {
    try {
      let body = await this.#post(run, { action: 'poll', device_code: run.deviceCode });
      if (this.#run !== run) return this.snapshot();

      // 首次识别为海外 Lark 租户时切换 accounts 域名并立即复查一次。
      if (body?.user_info?.tenant_brand === 'lark' && !run.domainSwitched) {
        run.domainSwitched = true;
        run.origin = run.larkOrigin;
        run.domainHost = new URL(run.larkOrigin).host;
        body = await this.#post(run, { action: 'poll', device_code: run.deviceCode });
        if (this.#run !== run) return this.snapshot();
      }
      if (!this.#expireIfNeeded()) this.#applyPollPayload(run, body);
    } catch (error) {
      if (this.#run === run) this.#failRun(run, error);
    }
    return this.snapshot();
  }

  #applyPollPayload(run, body) {
    if (typeof body.client_id === 'string' && body.client_id
      && typeof body.client_secret === 'string' && body.client_secret) {
      if (body.user_info !== undefined && !isPlainObject(body.user_info)) {
        return this.#failRun(run, internalError('invalid_credentials', ERROR_MESSAGES.invalid_credentials));
      }
      run.qrCodeUrl = run.userCode = run.expiresAt = null;
      run.result = {
        appId: body.client_id,
        appSecret: body.client_secret,
        userInfo: body.user_info === undefined ? undefined : { ...body.user_info },
      };
      this.#finishRun(run, REGISTRATION_STATES.SUCCESS);
      this.#log('info', `registration ${run.id} succeeded`);
      return;
    }

    const code = typeof body.error === 'string' && body.error ? body.error : null;
    if (code === 'authorization_pending') return this.#transition(run, REGISTRATION_STATES.PENDING);
    if (code === 'slow_down') {
      run.intervalMs += SLOW_DOWN_INCREMENT_MS;
      return this.#transition(run, REGISTRATION_STATES.SLOW_DOWN);
    }
    if (code !== null) {
      const msg = safeDetail(body.error_description) ?? ERROR_MESSAGES[code] ?? `飞书开放平台返回错误：${code}`;
      return this.#failRun(run, internalError(code, msg));
    }
    const num = Number(body.code);
    if (Number.isFinite(num) && num !== 0) {
      return this.#failRun(run, internalError(String(num), safeDetail(body.msg) ?? `飞书开放平台返回错误：${num}`));
    }
    this.#transition(run, REGISTRATION_STATES.PENDING);
  }

  #makeSnapshot(run, state, error = null) {
    const snap = {
      state,
      attempt: run?.id ?? this.#attempt,
      startedAt: run?.startedAt ?? null,
      updatedAt: this.#now(),
      disposed: this.#disposed,
      error: error ? { ...error } : null,
    };
    if (run && ACTIVE_STATES.has(state)) {
      snap.qrCodeUrl = run.qrCodeUrl;
      snap.userCode = run.userCode;
      snap.expiresAt = run.expiresAt;
      snap.remainingSeconds = run.expiresAt == null ? null : Math.max(0, Math.ceil((run.expiresAt - this.#now()) / 1000));
      snap.intervalMs = run.intervalMs;
      snap.nextPollInMs = run.intervalMs;
      snap.pollIntervalSeconds = run.intervalMs / 1000;
      snap.domain = run.domainHost;
      snap.domainSwitched = run.domainSwitched;
    }
    if (state === REGISTRATION_STATES.SUCCESS && run?.result) {
      snap.appId = run.result.appId;
      snap.appSecret = run.result.appSecret;
      if (run.result.userInfo !== undefined) snap.userInfo = { ...run.result.userInfo };
    }
    return snap;
  }

  #transition(run, state) {
    if (this.#run !== run) return;
    run.state = state;
    this.#snapshot = this.#makeSnapshot(run, state);
  }

  #finishRun(run, state, error = null) {
    if (this.#run !== run) return;
    run.state = state;
    this.#snapshot = this.#makeSnapshot(run, state, error);
    this.#detachRun(run, false);
  }

  #failRun(run, error) {
    if (this.#run !== run) return;
    const pub = toPublicError(error);
    const state = pub.code === 'access_denied'
      ? REGISTRATION_STATES.DENIED
      : pub.code === 'expired_token'
        ? REGISTRATION_STATES.EXPIRED
        : REGISTRATION_STATES.ERROR;
    this.#log('warn', `registration ${run.id} ${state} (${pub.code})`);
    this.#finishRun(run, state, pub);
  }

  #detachRun(run, abortRequest) {
    if (run.expiryTimer != null) {
      this.#clearTimeout(run.expiryTimer);
      run.expiryTimer = null;
    }
    if (this.#run === run) this.#run = null;
    if (abortRequest) run.requestController?.abort();
  }

  #scheduleExpiry(run, delayMs) {
    if (run.expiryTimer != null) this.#clearTimeout(run.expiryTimer);
    const handle = this.#setTimeout(() => this.#expireRun(run), delayMs);
    handle?.unref?.();
    run.expiryTimer = handle;
  }

  #expireIfNeeded() {
    const run = this.#run;
    if (!run || run.expiresAt == null || this.#now() < run.expiresAt) return false;
    this.#expireRun(run);
    return true;
  }

  #expireRun(run) {
    if (this.#run !== run) return;
    const remaining = run.expiresAt == null ? 0 : run.expiresAt - this.#now();
    if (remaining > 0) return this.#scheduleExpiry(run, remaining);
    const controller = run.requestController;
    this.#failRun(run, internalError('expired_token', ERROR_MESSAGES.expired_token));
    controller?.abort();
  }

  #log(level, message) {
    const logger = this.#logger;
    if (!logger) return;
    try {
      const fn = typeof logger === 'function' ? logger : (logger[level] ?? logger.info);
      fn?.call(logger, `[im-feishu:registration] ${message}`);
    } catch { /* 日志不可影响状态机 */ }
  }

  async #post(run, params) {
    const controller = new AbortController();
    run.requestController = controller;
    let timedOut = false;
    const timer = this.#requestTimeoutMs > 0
      ? this.#setTimeout(() => { timedOut = true; controller.abort(); }, this.#requestTimeoutMs)
      : null;
    timer?.unref?.();
    const abortErr = (cause) => timedOut
      ? internalError('request_timeout', ERROR_MESSAGES.request_timeout, cause)
      : controller.signal.aborted
        ? internalError('abort', ERROR_MESSAGES.abort, cause)
        : null;

    try {
      let response;
      try {
        response = await this.#fetch(`${run.origin}${REGISTRATION_ENDPOINT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params).toString(),
          signal: controller.signal,
        });
      } catch (error) {
        throw abortErr(error) ?? internalError('network_error', ERROR_MESSAGES.network_error, error);
      }

      if (!response || typeof response.json !== 'function') {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }
      const status = Number.isFinite(Number(response.status)) ? Number(response.status) : 0;
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw abortErr(error) ?? (status >= 400
          ? internalError('network_error', `飞书开放平台返回 HTTP ${status}。`, error)
          : internalError('invalid_response', ERROR_MESSAGES.invalid_response, error));
      }

      const aborted = abortErr();
      if (aborted) throw aborted;
      if (!isPlainObject(payload)) throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      if (status >= 500) throw internalError('network_error', `飞书开放平台暂时不可用（HTTP ${status}）。`);
      if (status >= 400 && status < 500
        && typeof payload.error !== 'string'
        && !(Number.isFinite(Number(payload.code)) && Number(payload.code) !== 0)
        && !payload.client_id) {
        throw internalError('registration_failed', safeDetail(payload.msg ?? payload.message) ?? `飞书开放平台返回 HTTP ${status}。`);
      }
      return payload;
    } finally {
      if (timer != null) this.#clearTimeout(timer);
      if (run.requestController === controller) run.requestController = null;
    }
  }
}

export default RegistrationManager;
