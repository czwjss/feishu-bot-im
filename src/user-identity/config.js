/**
 * 用户身份（飞书分身）的配置。
 *
 * 不单独建应用：默认复用某个飞书机器人已有的应用（appId + credential ref）。
 * 配置文件与机器人配置同目录：`<dataDir>/user-identity.json`。
 */
import { JsonStore, definedFields } from '../json-store.js';

export const USER_IDENTITY_VERSION = 1;
export const USER_IDENTITY_SCOPE_VERSION = 4;

export const CORE_USER_SCOPES = Object.freeze([
  'offline_access',
  'contact:user.basic_profile:readonly',
  'im:message',
  'im:message.send_as_user',
  'im:message:readonly',
  'im:message.group_msg:get_as_user',
  'im:message.p2p_msg:get_as_user',
]);

/** 群列表、群成员、全文搜索和图片/文件上传。 */
export const CHAT_MEDIA_SEARCH_USER_SCOPES = Object.freeze([
  'im:chat:read',
  'im:chat.members:read',
  'im:resource',
  'search:message',
]);

/** 只保留文档相关，不包含 Wiki、表格、多维表格。 */
export const DOCS_READ_USER_SCOPES = Object.freeze([
  'docx:document:readonly',
  'docs:doc:readonly',
  'drive:drive.metadata:readonly',
  'drive:file:download',
  'search:docs:read',
]);

export const DOCS_WRITE_USER_SCOPES = Object.freeze([
  'docx:document:create',
  'docx:document:write_only',
  'docs:doc',
  'drive:file:upload',
  'docs:permission.member:create',
  'docs:permission.member:retrieve',
  'docs:permission.member:update',
]);

export const DEFAULT_USER_SCOPE = [
  ...CORE_USER_SCOPES,
  ...CHAT_MEDIA_SEARCH_USER_SCOPES,
  ...DOCS_READ_USER_SCOPES,
  ...DOCS_WRITE_USER_SCOPES,
].join(' ');

export const USER_IDENTITY_FILE = 'user-identity.json';
export const USER_TOKEN_FILE = 'user-token.json';

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function normalizeUserScope(value) {
  if (value === undefined || value === null) return DEFAULT_USER_SCOPE;
  const raw = String(value).trim();
  if (!raw) return '';
  return [...new Set(raw.split(/\s+/).filter(Boolean))].slice(0, 200).join(' ');
}

export function normalizeIdentityConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    version: USER_IDENTITY_VERSION,
    scopeVersion: USER_IDENTITY_SCOPE_VERSION,
    botId: cleanString(source.botId),
    scope: normalizeUserScope(source.scope),
  });
}

export class UserIdentityConfigStore {
  #store;
  constructor({ path }) { this.#store = new JsonStore(path, normalizeIdentityConfig); }
  get config() { return this.#store.value; }

  async load() {
    await this.#store.load((raw) => {
      if (raw && (!Number.isFinite(Number(raw.scopeVersion)) || Number(raw.scopeVersion) < USER_IDENTITY_SCOPE_VERSION)) {
        return { ...raw, scope: DEFAULT_USER_SCOPE };
      }
      return raw;
    });
    return this;
  }

  async save(patch = {}) {
    await this.#store.update((previous) => ({ ...previous, ...definedFields(patch) }));
    return this;
  }
}
