/**
 * 用户身份（飞书分身）的配置。
 *
 * 不单独建应用：默认复用某个飞书机器人已有的应用（appId + credential ref）。
 * 配置文件与机器人配置同目录：`<dataDir>/user-identity.json`。
 */
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

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

/** 0600 原子写；与机器人配置使用同一套权限约定。 */
export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600).catch(() => undefined);
}

export class UserIdentityConfigStore {
  #path;
  #config = normalizeIdentityConfig({});

  constructor({ path }) {
    if (typeof path !== 'string' || !path) throw new TypeError('UserIdentityConfigStore 需要 path');
    this.#path = path;
  }

  get path() {
    return this.#path;
  }

  get config() {
    return this.#config;
  }

  async load() {
    let migrated = false;
    try {
      const raw = JSON.parse(await readFile(this.#path, 'utf8'));
      // 旧配置是按“全量未来权限”生成的；升级到当前固定集合，避免继续请求未实现能力。
      const scopeVersion = Number(raw?.scopeVersion);
      if (!Number.isFinite(scopeVersion) || scopeVersion < USER_IDENTITY_SCOPE_VERSION) {
        raw.scope = DEFAULT_USER_SCOPE;
        migrated = true;
      }
      this.#config = normalizeIdentityConfig(raw);
    } catch {
      this.#config = normalizeIdentityConfig({});
    }
    // 迁移结果写回磁盘；否则外部读取和下一次启动仍会看到旧 scope。
    if (migrated) await writePrivateJson(this.#path, this.#config).catch(() => undefined);
    return this;
  }

  /** 只覆盖显式传入的字段。 */
  async save(patch = {}) {
    const source = patch && typeof patch === 'object' ? patch : {};
    const previous = this.#config;
    const next = normalizeIdentityConfig({
      botId: source.botId === undefined ? previous.botId : source.botId,
      scope: source.scope === undefined ? previous.scope : source.scope,
    });
    await writePrivateJson(this.#path, next);
    this.#config = next;
    return this;
  }
}
