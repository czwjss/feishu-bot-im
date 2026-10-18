/**
 * Scan-to-provision ("扫码接入") device registration for the Feishu bot.
 *
 * Protocol copied from the implementation the reference plugin wraps
 * (`@larksuiteoapi/node-sdk@1.73.0`, `registerApp`):
 *
 *   POST https://accounts.feishu.cn/oauth/v1/app/registration
 *        (Lark tenants: https://accounts.larksuite.com/oauth/v1/app/registration)
 *        content-type: application/x-www-form-urlencoded
 *
 *   begin: action=begin&archetype=PersonalAgent&auth_method=client_secret
 *          &request_user_info=open_id
 *   poll:  action=poll&device_code=<device_code>
 *
 *   begin response: verification_uri_complete, device_code, expires_in
 *                   (seconds, fallback 600), interval (seconds, fallback 5),
 *                   optional user_code
 *   poll response:  client_id + client_secret + user_info on success;
 *                   otherwise the RFC 8628 `error` field
 *                   (authorization_pending / slow_down / access_denied /
 *                   expired_token). HTTP 400 carries a protocol body, not a
 *                   transport failure; HTTP >= 500 is treated as an error.
 *
 * The QR link is `verification_uri_complete` plus the SDK tracking params
 * (`from=sdk`, `source=node-sdk[/<source>]`, `tp=sdk`), an optional app preset,
 * the gzip/base64url `addons` manifest, `createOnly=true` and `clientID`.
 *
 * The manager is pull-driven: begin() creates the device run and returns the
 * QR snapshot; the caller waits `snapshot().nextPollInMs` and calls poll() until
 * a terminal state is reached. One run is active at a time. A second begin()
 * RESETS the previous run: its expiry timer is cleared, its in-flight request
 * is aborted, its result is discarded and `attempt` increments.
 *
 * Network and protocol failures never reject. They become terminal snapshots
 * with a readable `snapshot().error = { code, message }`.
 *
 * The App Secret is returned in plain text only inside the `success` snapshot.
 * It is held in memory only (never logged, never persisted), and is dropped by
 * the next begin(), by dispose(), or by dropping the snapshot. Callers must
 * write it to the credential store and discard it immediately.
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

const ACTIVE_STATES = new Set([
  REGISTRATION_STATES.STARTING,
  REGISTRATION_STATES.QR_READY,
  REGISTRATION_STATES.PENDING,
  REGISTRATION_STATES.SLOW_DOWN,
]);

const POLLABLE_STATES = new Set([
  REGISTRATION_STATES.QR_READY,
  REGISTRATION_STATES.PENDING,
  REGISTRATION_STATES.SLOW_DOWN,
]);

const DEFAULT_INTERVAL_MS = 5_000;
const SLOW_DOWN_INCREMENT_MS = 5_000;
const DEFAULT_EXPIRES_IN_SECONDS = 600;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const SDK_SOURCE_PREFIX = 'node-sdk';
const AVATAR_MAX_COUNT = 6;
const MAX_ERROR_DETAIL = 200;

/** Hosts the official create/update landing page can use (same set as the reference RPC). */
const OFFICIAL_REGISTRATION_HOSTS = new Set([
  'accounts.feishu.cn',
  'accounts.larksuite.com',
  'open.feishu.cn',
  'open.larksuite.com',
]);

const ERROR_MESSAGES = Object.freeze({
  access_denied: '用户已拒绝授权，未创建飞书应用。',
  expired_token: '二维码已过期，请重新发起扫码接入。',
  abort: '扫码接入已取消。',
  network_error: '无法连接飞书开放平台，请检查网络后重试。',
  request_timeout: '连接飞书开放平台超时，请重试。',
  invalid_response: '飞书开放平台返回了无法识别的扫码响应。',
  invalid_credentials: '飞书开放平台没有返回有效的应用凭证。',
  invalid_options: '扫码接入参数无效。',
  disposed: '扫码接入已关闭，请重新创建 RegistrationManager。',
  registration_failed: '飞书应用扫码接入失败，请重试。',
});

function internalError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

/** Project an internal error into the public snapshot shape. Never leaks secrets. */
function toPublicError(error) {
  const code = typeof error?.code === 'string' && error.code !== ''
    ? error.code
    : 'registration_failed';
  const known = ERROR_MESSAGES[code];
  const fallback = typeof error?.message === 'string'
    ? error.message.trim().slice(0, MAX_ERROR_DETAIL)
    : '';
  return {
    code,
    message: known ?? fallback ?? ERROR_MESSAGES.registration_failed,
  };
}

function safeDescription(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_ERROR_DETAIL);
  return text || null;
}

function normalizeExpiresIn(value) {
  if (value === undefined || value === null) return DEFAULT_EXPIRES_IN_SECONDS;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
  }
  return seconds;
}

function copyUserInfo(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('user_info must be an object');
  }
  return { ...value };
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
}

function assertAllowedKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`${path}.${key} is not allowed; allowed keys: ${allowed.join(', ')}`);
    }
  }
}

function validateStringArray(value, path) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array of strings`);
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item === '') {
      throw new TypeError(`${path}[${index}] must be a non-empty string`);
    }
  });
  return value;
}

/**
 * Validate and rebuild the addons manifest from the known public fields only,
 * exactly like the SDK does, so a typo cannot silently produce a QR link whose
 * manifest the landing page will discard.
 */
function normalizeAddons(addons) {
  assertPlainObject(addons, 'addons');
  assertAllowedKeys(addons, ['preset', 'scopes', 'events', 'callbacks'], 'addons');

  let itemCount = 0;
  const pick = (value, path) => {
    const items = validateStringArray(value, path);
    itemCount += items?.length ?? 0;
    return items;
  };
  const normalized = {};

  if (addons.preset !== undefined) {
    if (typeof addons.preset !== 'boolean') {
      throw new TypeError('addons.preset must be a boolean');
    }
    normalized.preset = addons.preset;
  }
  if (addons.scopes !== undefined) {
    assertPlainObject(addons.scopes, 'addons.scopes');
    assertAllowedKeys(addons.scopes, ['tenant', 'user'], 'addons.scopes');
    normalized.scopes = {
      tenant: pick(addons.scopes.tenant, 'addons.scopes.tenant'),
      user: pick(addons.scopes.user, 'addons.scopes.user'),
    };
  }
  if (addons.events !== undefined) {
    assertPlainObject(addons.events, 'addons.events');
    assertAllowedKeys(addons.events, ['items'], 'addons.events');
    if (addons.events.items !== undefined) {
      assertPlainObject(addons.events.items, 'addons.events.items');
      assertAllowedKeys(addons.events.items, ['tenant', 'user'], 'addons.events.items');
      normalized.events = {
        items: {
          tenant: pick(addons.events.items.tenant, 'addons.events.items.tenant'),
          user: pick(addons.events.items.user, 'addons.events.items.user'),
        },
      };
    }
  }
  if (addons.callbacks !== undefined) {
    assertPlainObject(addons.callbacks, 'addons.callbacks');
    assertAllowedKeys(addons.callbacks, ['items'], 'addons.callbacks');
    normalized.callbacks = {
      items: pick(addons.callbacks.items, 'addons.callbacks.items'),
    };
  }

  // An all-empty addons payload is a caller bug. `preset: false` is meaningful
  // on its own (start from the minimal base template).
  if (itemCount === 0 && addons.preset !== false) {
    throw new TypeError('addons must contain at least one scope, event or callback');
  }
  return normalized;
}

/** JSON -> gzip -> base64 -> URL-safe, exactly the pipeline fixed by the platform. */
function encodeAddons(addons) {
  const json = JSON.stringify(normalizeAddons(addons));
  return gzipSync(Buffer.from(json, 'utf8'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function normalizeAppPreset(value) {
  if (value === undefined || value === null) return null;
  assertPlainObject(value, 'appPreset');
  assertAllowedKeys(value, ['avatar', 'name', 'desc'], 'appPreset');

  const preset = {};
  if (value.avatar !== undefined) {
    const avatars = Array.isArray(value.avatar) ? value.avatar : [value.avatar];
    if (avatars.length === 0 || avatars.length > AVATAR_MAX_COUNT) {
      throw new TypeError(`appPreset.avatar must contain between 1 and ${AVATAR_MAX_COUNT} URLs`);
    }
    avatars.forEach((url, index) => {
      if (typeof url !== 'string' || url === '') {
        throw new TypeError(`appPreset.avatar[${index}] must be a non-empty string`);
      }
    });
    preset.avatar = avatars;
  }
  for (const key of ['name', 'desc']) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || value[key] === '') {
      throw new TypeError(`appPreset.${key} must be a non-empty string`);
    }
    preset[key] = value[key];
  }
  return preset;
}

function optionalString(value, name) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeBoolean(value, name, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`);
  return value;
}

function normalizeIntervalOption(value) {
  if (value === undefined || value === null) return null;
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new TypeError('interval must be a positive number of milliseconds');
  }
  return milliseconds;
}

function normalizeRequestTimeout(value) {
  if (value === undefined || value === null) return DEFAULT_REQUEST_TIMEOUT_MS;
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new TypeError('requestTimeoutMs must be zero or a positive number of milliseconds');
  }
  return milliseconds;
}

/**
 * Accept the friendly brand ('feishu' / 'lark') or an https origin, mirroring
 * the SDK's `domain` option (the reference passes 'accounts.feishu.cn').
 */
function resolveOrigin(value, label) {
  if (value === undefined || value === null || value === '' || value === 'feishu') {
    return FEISHU_ACCOUNTS_ORIGIN;
  }
  if (value === 'lark') return LARK_ACCOUNTS_ORIGIN;
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be "feishu", "lark" or an https origin`);
  }
  const text = value.trim();
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new TypeError(`${label} must be "feishu", "lark" or an https origin`);
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== ''
    || url.hash !== '' || url.username !== '' || url.password !== '') {
    throw new TypeError(`${label} must be an https origin without a path`);
  }
  return url.origin;
}

/**
 * Build the URL rendered as the QR code.
 *
 * `verification_uri_complete` must be an official landing-page URL. A
 * compromised/IP-spoofed response must not be able to make the user scan an
 * attacker-controlled QR code, so the host is pinned to the same official set
 * the reference RPC validates.
 */
function buildQrCodeUrl(verificationUri, config) {
  let url;
  try {
    url = new URL(verificationUri);
  } catch {
    throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
  }
  if (url.protocol !== 'https:'
    || !OFFICIAL_REGISTRATION_HOSTS.has(url.hostname)
    || url.port !== ''
    || url.username !== ''
    || url.password !== '') {
    throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
  }

  url.searchParams.set('from', 'sdk');
  url.searchParams.set('source', config.source ? `${SDK_SOURCE_PREFIX}/${config.source}` : SDK_SOURCE_PREFIX);
  url.searchParams.set('tp', 'sdk');

  if (config.appPreset) {
    for (const avatar of (config.appPreset.avatar ?? [])) {
      url.searchParams.append('avatar', avatar);
    }
    if (config.appPreset.name !== undefined) url.searchParams.set('name', config.appPreset.name);
    if (config.appPreset.desc !== undefined) url.searchParams.set('desc', config.appPreset.desc);
  }
  if (config.addonsParam) url.searchParams.set('addons', config.addonsParam);
  // The landing page only honors the literal string 'true'.
  if (config.createOnly === true) url.searchParams.set('createOnly', 'true');
  // createOnly wins on the landing page; both are forwarded when both are set.
  if (config.appId) url.searchParams.set('clientID', config.appId);

  return url.toString();
}

/**
 * Owns one Feishu device-registration run at a time.
 *
 * Constructor options (all optional, all injectable for offline tests):
 *   fetch             global fetch by default
 *   now               Date.now by default
 *   setTimeout        global setTimeout by default
 *   clearTimeout      global clearTimeout by default
 *   logger            console by default; null disables logging
 *   interval          poll interval override in MILLISECONDS; null uses the
 *                     server's `interval` seconds (fallback 5000 ms)
 *   domain            'feishu' (default) | 'lark' | https origin
 *   larkDomain        domain to switch to when poll reports a Lark tenant
 *   requestTimeoutMs  per-request timeout, 0 disables (default 20000)
 *   source            QR `source` suffix; SDK prefixes it with `node-sdk/`
 *   appPreset         { avatar?, name?, desc? } applied to the QR link
 *   addons            { preset?, scopes?, events?, callbacks? } gzip manifest
 *   createOnly        default true (this module provisions a new app)
 *   appId             targeted app-update flow (set createOnly:false too)
 */
export class RegistrationManager {
  #fetch;
  #now;
  #setTimeout;
  #clearTimeout;
  #logger;
  #interval;
  #requestTimeoutMs;
  #domain;
  #larkDomain;
  #source;
  #appPreset;
  #addonsParam;
  #createOnly;
  #appId;
  #attempt = 0;
  #run = null;
  #snapshot;
  #disposed = false;

  constructor(options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('RegistrationManager options must be an object');
    }
    const {
      fetch: fetchImpl = globalThis.fetch,
      now = Date.now,
      setTimeout: setTimeoutFn = globalThis.setTimeout,
      clearTimeout: clearTimeoutFn = globalThis.clearTimeout,
      logger = console,
      interval = null,
      domain = 'feishu',
      larkDomain = 'lark',
      requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
      source = null,
      appPreset = null,
      addons = null,
      createOnly = true,
      appId = null,
    } = options;

    if (typeof fetchImpl !== 'function') {
      throw new TypeError('RegistrationManager requires a fetch implementation');
    }
    if (typeof now !== 'function'
      || typeof setTimeoutFn !== 'function'
      || typeof clearTimeoutFn !== 'function') {
      throw new TypeError('RegistrationManager clock dependencies must be functions');
    }

    this.#fetch = fetchImpl;
    this.#now = now;
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
    this.#logger = logger ?? null;
    this.#interval = normalizeIntervalOption(interval);
    this.#requestTimeoutMs = normalizeRequestTimeout(requestTimeoutMs);
    this.#domain = resolveOrigin(domain, 'domain');
    this.#larkDomain = resolveOrigin(larkDomain, 'larkDomain');
    this.#source = optionalString(source, 'source');
    this.#appPreset = normalizeAppPreset(appPreset);
    this.#addonsParam = addons === null || addons === undefined ? null : encodeAddons(addons);
    this.#createOnly = normalizeBoolean(createOnly, 'createOnly', true);
    this.#appId = optionalString(appId, 'appId');

    this.#snapshot = {
      state: REGISTRATION_STATES.IDLE,
      attempt: this.#attempt,
      startedAt: null,
      updatedAt: this.#clockNow(),
      disposed: false,
      error: null,
    };
  }

  /**
   * Start a new run and create the device authorization.
   *
   * Resolves to a `qr_ready` snapshot (or an `error` snapshot). Invalid
   * arguments throw a TypeError synchronously-ish (rejected promise); network
   * and protocol failures never reject.
   *
   * Repeating begin() while a run is active RESETS that run (see file header).
   *
   * Optional overrides: { source, appPreset, addons, createOnly, appId,
   * domain, larkDomain, interval }.
   */
  async begin(options = {}) {
    if (this.#disposed) return this.#disposedSnapshot();

    const config = this.#beginConfig(options);
    this.#supersedeActiveRun();

    const run = {
      id: ++this.#attempt,
      state: REGISTRATION_STATES.STARTING,
      startedAt: this.#clockNow(),
      origin: config.origin,
      larkOrigin: config.larkOrigin,
      domainHost: new URL(config.origin).host,
      domainSwitched: false,
      qrCodeUrl: null,
      userCode: null,
      deviceCode: null,
      expiresAt: null,
      intervalMs: config.intervalMs ?? DEFAULT_INTERVAL_MS,
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

      if (typeof body.verification_uri_complete !== 'string'
        || body.verification_uri_complete === '') {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }
      const deviceCode = typeof body.device_code === 'string' ? body.device_code.trim() : '';
      if (deviceCode === '') {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }

      const expiresIn = normalizeExpiresIn(body.expires_in);
      run.qrCodeUrl = buildQrCodeUrl(body.verification_uri_complete, config);
      run.userCode = typeof body.user_code === 'string' && body.user_code !== ''
        ? body.user_code
        : null;
      run.deviceCode = deviceCode;
      run.expiresAt = this.#clockNow() + (expiresIn * 1000);
      if (config.intervalMs !== null) {
        run.intervalMs = config.intervalMs;
      } else {
        const seconds = Number(body.interval);
        run.intervalMs = Number.isFinite(seconds) && seconds > 0
          ? seconds * 1000
          : DEFAULT_INTERVAL_MS;
      }

      this.#scheduleExpiry(run, expiresIn * 1000);
      this.#setState(run, REGISTRATION_STATES.QR_READY);
      this.#log('info', `registration ${run.id} QR ready`);
    } catch (error) {
      if (this.#run !== run) return this.snapshot();
      this.#failRun(run, error);
    }

    return this.snapshot();
  }

  /**
   * Perform exactly one RFC 8628 poll request and advance the state machine.
   *
   * The caller should wait `snapshot().nextPollInMs` between polls. Concurrent
   * calls share one in-flight request. Resolves to a snapshot; never rejects on
   * network/protocol failures. On success the snapshot contains
   * `appId`, `appSecret` and `userInfo`.
   */
  async poll() {
    this.#expireIfNeeded();

    const run = this.#run;
    if (!run || !POLLABLE_STATES.has(run.state)) return this.snapshot();
    if (run.pollPromise) return run.pollPromise;

    let wrapped;
    wrapped = this.#runPoll(run).finally(() => {
      if (run.pollPromise === wrapped) run.pollPromise = null;
    });
    run.pollPromise = wrapped;
    return wrapped;
  }

  /**
   * Cancel the active run (if any) and return the resulting snapshot.
   * An in-flight request is aborted. Cancelling without an active run is a
   * no-op that returns the current terminal/idle snapshot.
   */
  cancel() {
    const run = this.#run;
    if (!run) return this.snapshot();

    const controller = run.requestController;
    this.#clearExpiryTimer(run);
    this.#snapshot = this.#makeSnapshot(run, REGISTRATION_STATES.CANCELLED, {
      error: { code: 'abort', message: ERROR_MESSAGES.abort },
    });
    this.#run = null;
    controller?.abort();
    this.#log('info', `registration ${run.id} cancelled`);
    return this.snapshot();
  }

  /**
   * Return a defensive copy of the current snapshot.
   *
   * Fields: state, attempt, startedAt, updatedAt, disposed, error
   * (null | { code, message }).
   * While qr_ready/pending/slow_down: qrCodeUrl, userCode, expiresAt (epoch ms),
   * remainingSeconds, intervalMs, nextPollInMs, pollIntervalSeconds, domain,
   * domainSwitched.
   * On success: appId, appSecret, userInfo (appSecret is plain text in memory
   * only; consume it immediately and discard).
   */
  snapshot() {
    this.#expireIfNeeded();
    return this.#copySnapshot(this.#snapshot);
  }

  /**
   * Terminal, idempotent teardown: abort the active request, clear timers,
   * wipe any retained App Secret, and return an idle snapshot with
   * `disposed: true`. Subsequent begin() returns an `error` snapshot with
   * code `disposed`; poll() returns the stored idle snapshot.
   */
  dispose() {
    if (this.#disposed) return this.snapshot();
    this.#disposed = true;

    const run = this.#run;
    if (run) {
      this.#clearExpiryTimer(run);
      this.#run = null;
      run.requestController?.abort();
    }
    this.#snapshot = {
      state: REGISTRATION_STATES.IDLE,
      attempt: this.#attempt,
      startedAt: null,
      updatedAt: this.#clockNow(),
      disposed: true,
      error: null,
    };
    this.#log('info', 'registration manager disposed');
    return this.snapshot();
  }

  #beginConfig(options) {
    if (options === undefined || options === null) options = {};
    if (typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('Registration options must be an object');
    }
    const has = (key) => Object.hasOwn(options, key);

    let addonsParam = this.#addonsParam;
    if (has('addons')) {
      const addons = options.addons;
      addonsParam = addons === null || addons === undefined ? null : encodeAddons(addons);
    }

    return {
      origin: has('domain') ? resolveOrigin(options.domain, 'domain') : this.#domain,
      larkOrigin: has('larkDomain') ? resolveOrigin(options.larkDomain, 'larkDomain') : this.#larkDomain,
      source: has('source') ? optionalString(options.source, 'source') : this.#source,
      appPreset: has('appPreset') ? normalizeAppPreset(options.appPreset) : this.#appPreset,
      addonsParam,
      createOnly: has('createOnly')
        ? normalizeBoolean(options.createOnly, 'createOnly', this.#createOnly)
        : this.#createOnly,
      appId: has('appId') ? optionalString(options.appId, 'appId') : this.#appId,
      intervalMs: has('interval') ? normalizeIntervalOption(options.interval) : this.#interval,
    };
  }

  async #runPoll(run) {
    try {
      let body = await this.#post(run, { action: 'poll', device_code: run.deviceCode });
      if (this.#run !== run) return this.snapshot();

      // The SDK switches the account host once when the owner turns out to be
      // on Lark, then immediately repeats the poll on accounts.larksuite.com.
      if (body?.user_info?.tenant_brand === 'lark' && !run.domainSwitched) {
        run.domainSwitched = true;
        run.origin = run.larkOrigin;
        run.domainHost = new URL(run.larkOrigin).host;
        this.#log('info', `registration ${run.id} switched to the Lark accounts domain`);
        body = await this.#post(run, { action: 'poll', device_code: run.deviceCode });
        if (this.#run !== run) return this.snapshot();
      }

      if (this.#expireIfNeeded()) return this.snapshot();
      this.#applyPollPayload(run, body);
      return this.snapshot();
    } catch (error) {
      if (this.#run !== run) return this.snapshot();
      this.#failRun(run, error);
      return this.snapshot();
    }
  }

  #applyPollPayload(run, body) {
    const appId = body.client_id;
    const appSecret = body.client_secret;
    if (typeof appId === 'string' && appId !== ''
      && typeof appSecret === 'string' && appSecret !== '') {
      this.#completeRegistration(run, appId, appSecret, body.user_info);
      return;
    }

    const code = typeof body.error === 'string' && body.error !== '' ? body.error : null;

    if (code === 'authorization_pending') {
      this.#setState(run, REGISTRATION_STATES.PENDING);
      return;
    }
    if (code === 'slow_down') {
      run.intervalMs += SLOW_DOWN_INCREMENT_MS;
      this.#setState(run, REGISTRATION_STATES.SLOW_DOWN);
      return;
    }
    if (code === 'access_denied' || code === 'expired_token') {
      const message = safeDescription(body.error_description) ?? ERROR_MESSAGES[code];
      this.#failRun(run, internalError(code, message));
      return;
    }
    if (code !== null) {
      const message = safeDescription(body.error_description) ?? `飞书开放平台返回错误：${code}`;
      this.#failRun(run, internalError(code, message));
      return;
    }

    // Defensive fallback for a Lark OpenAPI `{ code, msg }` error body instead
    // of an RFC 8628 body, so a non-zero code cannot poll forever.
    const numericCode = Number(body.code);
    if (Number.isFinite(numericCode) && numericCode !== 0) {
      const message = safeDescription(body.msg) ?? `飞书开放平台返回错误：${numericCode}`;
      this.#failRun(run, internalError(String(numericCode), message));
      return;
    }

    // Same as the SDK: neither credentials nor an error means "keep waiting".
    this.#setState(run, REGISTRATION_STATES.PENDING);
  }

  #completeRegistration(run, appId, appSecret, userInfo) {
    if (this.#run !== run) return;

    let ownerInfo;
    try {
      ownerInfo = copyUserInfo(userInfo);
    } catch {
      this.#failRun(run, internalError('invalid_credentials', ERROR_MESSAGES.invalid_credentials));
      return;
    }

    // QR expiry and the device URL no longer apply once the platform has
    // committed the app and handed back credentials.
    run.qrCodeUrl = null;
    run.userCode = null;
    run.expiresAt = null;
    run.result = { appId, appSecret, userInfo: ownerInfo };
    if (!this.#finishRun(run, REGISTRATION_STATES.SUCCESS)) return;
    this.#log('info', `registration ${run.id} succeeded`);
  }

  #makeSnapshot(run, state, extra = {}) {
    const snapshot = {
      state,
      attempt: run?.id ?? this.#attempt,
      startedAt: run?.startedAt ?? null,
      updatedAt: this.#clockNow(),
      disposed: this.#disposed,
      error: extra.error ? { ...extra.error } : null,
    };

    if (run && ACTIVE_STATES.has(state)) {
      snapshot.qrCodeUrl = run.qrCodeUrl;
      snapshot.userCode = run.userCode;
      snapshot.expiresAt = run.expiresAt;
      snapshot.remainingSeconds = run.expiresAt === null
        ? null
        : Math.max(0, Math.ceil((run.expiresAt - this.#clockNow()) / 1000));
      snapshot.intervalMs = run.intervalMs;
      snapshot.nextPollInMs = run.intervalMs;
      snapshot.pollIntervalSeconds = run.intervalMs / 1000;
      snapshot.domain = run.domainHost;
      snapshot.domainSwitched = run.domainSwitched;
    }

    if (state === REGISTRATION_STATES.SUCCESS && run?.result) {
      snapshot.appId = run.result.appId;
      snapshot.appSecret = run.result.appSecret;
      if (run.result.userInfo !== undefined) {
        snapshot.userInfo = { ...run.result.userInfo };
      }
    }

    return snapshot;
  }

  #copySnapshot(snapshot) {
    const copy = { ...snapshot };
    if (copy.error) copy.error = { ...copy.error };
    if (copy.userInfo) copy.userInfo = { ...copy.userInfo };
    return copy;
  }

  #setState(run, state) {
    if (this.#run !== run) return;
    run.state = state;
    this.#snapshot = this.#makeSnapshot(run, state);
  }

  #finishRun(run, state, extra = {}) {
    if (this.#run !== run) return false;
    run.state = state;
    this.#clearExpiryTimer(run);
    this.#snapshot = this.#makeSnapshot(run, state, extra);
    this.#run = null;
    return true;
  }

  #failRun(run, error) {
    if (this.#run !== run) return false;
    const publicError = toPublicError(error);
    let state = REGISTRATION_STATES.ERROR;
    if (publicError.code === 'access_denied') state = REGISTRATION_STATES.DENIED;
    else if (publicError.code === 'expired_token') state = REGISTRATION_STATES.EXPIRED;

    this.#log('warn', `registration ${run.id} ${state} (${publicError.code})`);
    return this.#finishRun(run, state, { error: publicError });
  }

  #supersedeActiveRun() {
    const run = this.#run;
    if (!run) return;
    this.#clearExpiryTimer(run);
    this.#run = null;
    run.requestController?.abort();
    this.#log('info', `registration ${run.id} superseded by a new begin()`);
  }

  #scheduleExpiry(run, delayMs) {
    this.#clearExpiryTimer(run);
    run.expiryTimer = this.#schedule(() => this.#expireRun(run), delayMs);
  }

  #clearExpiryTimer(run) {
    if (run.expiryTimer !== null) {
      this.#cancelTimer(run.expiryTimer);
      run.expiryTimer = null;
    }
  }

  #expireIfNeeded() {
    const run = this.#run;
    if (!run || run.expiresAt === null || this.#clockNow() < run.expiresAt) return false;
    this.#expireRun(run);
    return true;
  }

  #expireRun(run) {
    if (this.#run !== run) return;
    const remaining = run.expiresAt === null ? 0 : run.expiresAt - this.#clockNow();
    if (remaining > 0) {
      // A real timer may fire a tick early relative to an injected clock.
      this.#scheduleExpiry(run, remaining);
      return;
    }
    const controller = run.requestController;
    this.#failRun(run, internalError('expired_token', ERROR_MESSAGES.expired_token));
    controller?.abort();
  }

  #disposedSnapshot() {
    return {
      ...this.#copySnapshot(this.#snapshot),
      state: REGISTRATION_STATES.ERROR,
      updatedAt: this.#clockNow(),
      error: { code: 'disposed', message: ERROR_MESSAGES.disposed },
    };
  }

  #clockNow() {
    const now = this.#now;
    return now();
  }

  #schedule(callback, delayMs) {
    const schedule = this.#setTimeout;
    const handle = schedule(callback, delayMs);
    handle?.unref?.();
    return handle;
  }

  #cancelTimer(handle) {
    const clear = this.#clearTimeout;
    clear(handle);
  }

  #log(level, message) {
    const logger = this.#logger;
    if (!logger) return;
    try {
      if (typeof logger === 'function') {
        logger(`[im-feishu:registration] ${message}`);
        return;
      }
      const fn = logger[level] ?? logger.info;
      if (typeof fn === 'function') {
        fn.call(logger, `[im-feishu:registration] ${message}`);
      }
    } catch {
      // Logging must never break the registration state machine.
    }
  }

  /**
   * One form-urlencoded POST to the device-registration endpoint.
   *
   * Mirrors the SDK: a 4xx body is a protocol response (RFC 8628 errors use
   * HTTP 400), while transport failures, non-JSON bodies and 5xx responses are
   * reported as registration errors instead of being thrown to the caller.
   */
  async #post(run, params) {
    const url = `${run.origin}${REGISTRATION_ENDPOINT}`;
    const body = new URLSearchParams(params).toString();
    const controller = new AbortController();
    run.requestController = controller;

    let timer = null;
    let timedOut = false;
    if (this.#requestTimeoutMs > 0) {
      timer = this.#schedule(() => {
        timedOut = true;
        controller.abort();
      }, this.#requestTimeoutMs);
    }

    try {
      const fetchFn = this.#fetch;
      let response;
      try {
        response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) throw internalError('request_timeout', ERROR_MESSAGES.request_timeout, error);
        if (controller.signal.aborted) throw internalError('abort', ERROR_MESSAGES.abort, error);
        throw internalError('network_error', ERROR_MESSAGES.network_error, error);
      }

      if (!response || typeof response.json !== 'function') {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }

      const status = Number.isFinite(Number(response.status)) ? Number(response.status) : 0;
      let payload;
      let parseError = null;
      try {
        payload = await response.json();
      } catch (error) {
        parseError = error;
      }

      if (parseError) {
        if (timedOut) throw internalError('request_timeout', ERROR_MESSAGES.request_timeout, parseError);
        if (controller.signal.aborted) throw internalError('abort', ERROR_MESSAGES.abort, parseError);
        if (status >= 400) {
          throw internalError(
            'network_error',
            `飞书开放平台返回 HTTP ${status}。`,
            parseError,
          );
        }
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response, parseError);
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw internalError('invalid_response', ERROR_MESSAGES.invalid_response);
      }
      if (timedOut) throw internalError('request_timeout', ERROR_MESSAGES.request_timeout);
      if (controller.signal.aborted) throw internalError('abort', ERROR_MESSAGES.abort);
      if (status >= 500) {
        throw internalError('network_error', `飞书开放平台暂时不可用（HTTP ${status}）。`);
      }
      return payload;
    } finally {
      if (timer !== null) this.#cancelTimer(timer);
      if (run.requestController === controller) run.requestController = null;
    }
  }
}

export default RegistrationManager;
