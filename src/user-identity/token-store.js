/**
 * 用户身份的 token 存储（`user-token.json`，0600）。
 *
 * 只存飞书 OAuth 返回的凭证和授权用户信息；App Secret 继续放在 DSH credentials。
 */
import { JsonStore, definedFields } from '../json-store.js';

export const USER_TOKEN_VERSION = 1;
/** 提前 60 秒视为过期。 */
export const EXPIRY_MARGIN_MS = 60_000;
const USER_TOKEN_SECRET_REF = 'IM_FEISHU_USER_TOKENS';

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cleanTime(value) {
  const time = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(time) && time > 0 ? time : null;
}

function normalizeUser(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    name: cleanString(source.name),
    enName: cleanString(source.enName),
    openId: cleanString(source.openId),
    unionId: cleanString(source.unionId),
    userId: cleanString(source.userId),
    email: cleanString(source.email),
    avatarUrl: cleanString(source.avatarUrl),
  });
}

export function normalizeUserTokenDocument(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    version: USER_TOKEN_VERSION,
    appId: cleanString(source.appId),
    accessToken: cleanString(source.accessToken),
    refreshToken: cleanString(source.refreshToken),
    accessTokenExpiresAt: cleanTime(source.accessTokenExpiresAt),
    refreshTokenExpiresAt: cleanTime(source.refreshTokenExpiresAt),
    scope: typeof source.scope === 'string' ? source.scope.trim() : '',
    user: normalizeUser(source.user),
    authorizedAt: cleanString(source.authorizedAt),
  });
}

export class UserTokenStore {
  #path;
  #store;
  #credentials;
  #secretRef;
  #secrets = null;

  constructor({ path, credentials = null, secretRef = USER_TOKEN_SECRET_REF }) {
    this.#path = path;
    this.#credentials = credentials && typeof credentials.set === 'function' && typeof credentials.resolve === 'function'
      ? credentials : null;
    this.#secretRef = secretRef;
    this.#store = new JsonStore(path, (value) => value == null ? null : normalizeUserTokenDocument(value));
  }
  get path() { return this.#path; }
  get document() {
    const meta = this.#store.value;
    if (!meta) return null;
    if (!this.#credentials || !this.#secrets) return meta;
    return Object.freeze({
      ...meta,
      accessToken: this.#secrets.accessToken || meta.accessToken,
      refreshToken: this.#secrets.refreshToken || meta.refreshToken,
    });
  }

  async load() {
    await this.#store.load();
    if (!this.#credentials) return this;
    const meta = this.#store.value;
    if (!meta) {
      this.#secrets = null;
      return this;
    }
    let stored = null;
    try {
      const resolved = await this.#credentials.resolve(this.#secretRef);
      if (typeof resolved?.value === 'string' && resolved.value) {
        const parsed = JSON.parse(resolved.value);
        if (parsed && typeof parsed === 'object') {
          stored = {
            accessToken: cleanString(parsed.accessToken),
            refreshToken: cleanString(parsed.refreshToken),
          };
        }
      }
    } catch {
      stored = null;
    }
    // 平滑迁移旧版明文 user-token.json：搬入 DSH credentials 并清除磁盘明文 token。
    if ((!stored?.accessToken && !stored?.refreshToken) && (meta.accessToken || meta.refreshToken)) {
      const migrated = { accessToken: meta.accessToken, refreshToken: meta.refreshToken };
      await this.#credentials.set(this.#secretRef, JSON.stringify(migrated));
      this.#secrets = migrated;
      await this.#store.update((previous) => previous ? { ...previous, accessToken: '', refreshToken: '' } : previous);
      return this;
    }
    this.#secrets = stored;
    return this;
  }

  /** `undefined` 保留原值，`''`/`null` 清空。 */
  async save(patch = {}, { signal } = {}) {
    if (!this.#credentials) {
      return this.#store.update((previous) => {
        signal?.throwIfAborted();
        return { ...previous, ...definedFields(patch) };
      });
    }
    const fields = definedFields(patch);
    const current = this.document ?? {};
    const nextAccess = Object.hasOwn(fields, 'accessToken') ? cleanString(fields.accessToken) : cleanString(current.accessToken);
    const nextRefresh = Object.hasOwn(fields, 'refreshToken') ? cleanString(fields.refreshToken) : cleanString(current.refreshToken);
    signal?.throwIfAborted();
    await this.#credentials.set(this.#secretRef, JSON.stringify({ accessToken: nextAccess, refreshToken: nextRefresh }));
    this.#secrets = { accessToken: nextAccess, refreshToken: nextRefresh };
    await this.#store.update((previous) => {
      signal?.throwIfAborted();
      return { ...previous, ...fields, accessToken: '', refreshToken: '' };
    });
    return this.document;
  }

  async clear() {
    this.#secrets = null;
    if (this.#credentials) {
      await this.#credentials.unset?.(this.#secretRef).catch(() => undefined);
    }
    return this.#store.clear();
  }

  accessTokenUsable(now = Date.now()) {
    const doc = this.document;
    if (!doc?.accessToken || !doc.accessTokenExpiresAt) return false;
    return now + EXPIRY_MARGIN_MS < doc.accessTokenExpiresAt;
  }

  refreshTokenUsable(now = Date.now()) {
    const doc = this.document;
    if (!doc?.refreshToken) return false;
    if (!doc.refreshTokenExpiresAt) return true;
    return now < doc.refreshTokenExpiresAt;
  }

  /** 主面板状态：不含 token 明文。 */
  status(now = Date.now()) {
    const doc = this.document;
    return {
      present: Boolean(doc),
      appId: doc?.appId ?? '',
      user: doc?.user ?? null,
      scope: doc?.scope ?? '',
      authorizedAt: doc?.authorizedAt ?? null,
      accessTokenExpiresAt: doc?.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: doc?.refreshTokenExpiresAt ?? null,
      accessTokenValid: this.accessTokenUsable(now),
      refreshable: this.refreshTokenUsable(now),
    };
  }
}
