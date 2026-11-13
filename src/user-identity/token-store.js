/**
 * 用户身份的 token 存储（`user-token.json`，0600）。
 *
 * 只存飞书 OAuth 返回的凭证和授权用户信息；App Secret 继续放在 DSH credentials。
 */
import { JsonStore, definedFields } from '../json-store.js';

export const USER_TOKEN_VERSION = 1;
/** 提前 60 秒视为过期。 */
export const EXPIRY_MARGIN_MS = 60_000;

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
  constructor({ path }) {
    this.#path = path;
    this.#store = new JsonStore(path, (value) => value == null ? null : normalizeUserTokenDocument(value));
  }
  get path() { return this.#path; }
  get document() { return this.#store.value; }
  async load() { await this.#store.load(); return this; }

  /** `undefined` 保留原值，`''`/`null` 清空。 */
  save(patch = {}, { signal } = {}) {
    return this.#store.update((previous) => {
      signal?.throwIfAborted();
      return { ...previous, ...definedFields(patch) };
    });
  }
  clear() { return this.#store.clear(); }

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

  /** 设置页状态：不含 token 明文。 */
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
