/**
 * Multi-bot configuration (v2).
 *
 * Every Feishu bot owns its own non-secret settings; the App Secret lives in the
 * DSH credential service under a per-bot ref. Layout:
 *
 *   { version: 2, bots: [ { id, appId, secretRef, alias, ...settings } ] }
 */
import { JsonStore } from './json-store.js';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

import { normalizeContextEnhancementConfig } from './context-enhancement.js';
import { normalizeEavesdropConfig } from './eavesdrop.js';
import { normalizeMentionsConfig } from './mentions.js';
import { randomUUID } from 'node:crypto';

import { ACCESS_MODES, BUSY_MODES, BOT_COLORS } from './contracts.js';
export { ACCESS_MODES, BUSY_MODES, BOT_COLORS };


function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOpenIds(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(cleanString).filter(Boolean))].slice(0, 200);
}

export function normalizeAccess(value) {
  const source = value && typeof value === 'object' ? value : {};
  const pick = (candidate) => (candidate === ACCESS_MODES.ALLOWLIST ? ACCESS_MODES.ALLOWLIST : ACCESS_MODES.ALL);
  // Private chats are always open; only groups carry an access mode.
  return Object.freeze({
    group: pick(source.group),
    allowOpenIds: Object.freeze(normalizeOpenIds(source.allowOpenIds)),
    managers: Object.freeze(normalizeOpenIds(source.managers)),
  });
}

export function normalizeModel(value) {
  if (!value || typeof value !== 'object') return null;
  const provider = cleanString(value.provider);
  const model = cleanString(value.model);
  if (!provider || !model) return null;
  const reasoningEffort = cleanString(value.reasoningEffort);
  return Object.freeze({ provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) });
}

function normalizeBusyMode(value) {
  return value === BUSY_MODES.STEER ? BUSY_MODES.STEER : BUSY_MODES.QUEUE;
}

/** Accept either a legacy scalar or a per-scope `{ direct, group }` object. */
function normalizeScoped(value, normalizeFn) {
  if (value && typeof value === 'object') {
    return Object.freeze({ direct: normalizeFn(value.direct), group: normalizeFn(value.group) });
  }
  const shared = normalizeFn(value);
  return Object.freeze({ direct: shared, group: shared });
}

export function normalizeColor(value) {
  return BOT_COLORS.includes(value) ? value : 'blue';
}

function nextColor(bots) {
  const used = new Set(bots.map((bot) => bot.color));
  return BOT_COLORS.find((color) => !used.has(color)) ?? BOT_COLORS[0];
}

export function secretRefFor(botId) {
  return `IM_FEISHU_SECRET_${String(botId).toUpperCase()}`;
}

/** One bot's settings, with defaults for everything a fresh bot lacks. */
export function normalizeBot(value, { legacyId } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const appId = cleanString(source.appId);
  if (!appId) return null;
  const id = cleanString(source.id) ?? legacyId ?? `bot_${randomUUID().slice(0, 8)}`;
  return Object.freeze({
    id,
    appId,
    // v1 kept the secret under the shared ref; keep pointing at it after migration.
    secretRef: cleanString(source.secretRef) ?? (legacyId ? 'IM_FEISHU_APP_SECRET' : secretRefFor(id)),
    alias: cleanString(source.alias)?.slice(0, 40) ?? null,
    color: normalizeColor(source.color),
    botName: cleanString(source.botName),
    botOpenId: cleanString(source.botOpenId),
    workspace: cleanString(source.workspace),
    model: normalizeModel(source.model),
    agentPreset: cleanString(source.agentPreset),
    respondToBotMessages: source.respondToBotMessages !== false,
    processDetail: source.processDetail === 'brief' ? 'brief' : 'detailed',
    permissionPreset: cleanString(source.permissionPreset),
    busyMode: normalizeScoped(source.busyMode, normalizeBusyMode),
    contextEnhancement: normalizeContextEnhancementConfig(source.contextEnhancement),
    eavesdrop: normalizeEavesdropConfig(source.eavesdrop),
    mentions: normalizeMentionsConfig(source.mentions),
    access: normalizeAccess(source.access),
    connectedAt: cleanString(source.connectedAt),
  });
}


export function normalizeDocument(value) {
  const source = value && typeof value === 'object' ? value : {};
  const bots = [];
  const seenAppIds = new Set();
  const seenIds = new Set();
  const list = Array.isArray(source.bots) ? source.bots : [];
  for (const item of list) {
    const bot = normalizeBot(item);
    if (!bot || seenAppIds.has(bot.appId) || seenIds.has(bot.id)) continue;
    seenAppIds.add(bot.appId);
    seenIds.add(bot.id);
    bots.push(bot);
  }
  // v1 was a single flat bot object.
  if (bots.length === 0 && source.appId) {
    const legacy = normalizeBot(source, { legacyId: 'bot_default' });
    if (legacy) bots.push(legacy);
  }
  return Object.freeze({ version: 2, bots: Object.freeze(bots) });
}

export function integrationDir(config = {}) {
  const home = resolve(config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'));
  return resolve(config.dataDir ?? join(home, 'integrations', 'im-feishu'));
}

export function configPaths(config = {}) {
  const root = integrationDir(config);
  return {
    root,
    home: resolve(config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')),
    config: resolve(config.configPath ?? join(root, 'config.json')),
    state: (botId) => resolve(join(root, `state-${botId}.json`)),
  };
}

export class ConfigStore {
  #store;

  constructor(path) { this.#store = new JsonStore(path, normalizeDocument); }
  get bots() { return this.#store.value.bots; }
  bot(id) { return this.bots.find((item) => item.id === id) ?? null; }
  async load() { await this.#store.load(); return this; }

  add(botInput) {
    let bot;
    return this.#store.update((doc) => {
      bot = normalizeBot({
        id: `bot_${randomUUID().slice(0, 8)}`,
        ...botInput,
        color: botInput?.color ?? nextColor(doc.bots),
      });
      if (!bot) throw new Error('App ID 不能为空');
      if (doc.bots.some((item) => item.appId === bot.appId || item.id === bot.id)) {
        throw new Error('这个飞书应用已经绑定过了');
      }
      return { version: 2, bots: [...doc.bots, bot] };
    }).then(() => bot);
  }

  update(id, patch) {
    let next;
    return this.#store.update((doc) => {
      const current = doc.bots.find((item) => item.id === id);
      if (!current) throw new Error(`机器人不存在：${id}`);
      next = normalizeBot({ ...current, ...patch, id, appId: current.appId }, { legacyId: id });
      return { version: 2, bots: doc.bots.map((item) => (item.id === id ? next : item)) };
    }).then(() => next);
  }

  remove(id) {
    return this.#store.update((doc) => ({ version: 2, bots: doc.bots.filter((item) => item.id !== id) }));
  }

  clear() {
    return this.#store.update(() => ({ version: 2, bots: [] }));
  }
}

function normalizeState(parsed) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const record = (key) => Object.freeze({ ...(source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) ? source[key] : {}) });
  return Object.freeze({
    sessions: record('sessions'), meta: record('meta'), overrides: record('overrides'),
    usage: record('usage'), stats: record('stats'), tools: record('tools'),
    seen: Object.freeze([...new Set(Array.isArray(source.seen) ? source.seen.filter((id) => typeof id === 'string') : [])].slice(-800)),
    chatTypes: Object.freeze(Object.fromEntries(Object.entries(record('chatTypes')).filter(([, type]) => type === 'p2p' || type === 'group'))),
  });
}

/** Chat → Session bindings and inbound dedupe, one store per bot. */
export class StateStore {
  #store;

  constructor(path) { this.#store = new JsonStore(path, normalizeState); }
  get value() { return this.#store.value; }
  async load() { await this.#store.load(); return this; }

  statsFor(key) { return this.value.stats[key] === true; }
  toolsFor(key) { return this.value.tools[key] === true; }

  async #setFlag(field, key, enabled) {
    if (typeof key !== 'string') return false;
    await this.#store.update((state) => {
      const flags = { ...state[field] };
      if (enabled === true) flags[key] = true;
      else delete flags[key];
      return { ...state, [field]: flags };
    });
    return enabled === true;
  }

  setStats(key, enabled) { return this.#setFlag('stats', key, enabled); }
  setTools(key, enabled) { return this.#setFlag('tools', key, enabled); }
  usageFor(key) { return this.value.usage[key] ?? null; }

  async addUsage(key, delta) {
    const state = await this.#store.update((state) => {
      const current = state.usage[key] ?? {};
      const next = Object.fromEntries(['input', 'output', 'cache', 'calls'].map((field) => [field, (current[field] ?? 0) + (delta[field] ?? 0)]));
      return { ...state, usage: { ...state.usage, [key]: next } };
    });
    return state.usage[key];
  }

  sessionFor(key) { return this.value.sessions[key] ?? null; }
  chatTypeFor(key) { return this.value.chatTypes[key] ?? null; }

  async setChatType(key, type) {
    if (!['p2p', 'group'].includes(type)) return;
    await this.#store.update((state) => state.chatTypes[key] === type ? state : {
      ...state, chatTypes: { ...state.chatTypes, [key]: type },
    });
  }

  keyForSession(sessionId) {
    return Object.entries(this.value.sessions).find(([, value]) => value === sessionId)?.[0] ?? null;
  }

  async bindSession(key, sessionId) {
    await this.#store.update((state) => ({ ...state, sessions: { ...state.sessions, [key]: sessionId } }));
    return sessionId;
  }

  async unbindSession(key) {
    await this.#store.update((state) => {
      const sessions = { ...state.sessions };
      delete sessions[key];
      return { ...state, sessions };
    });
  }

  hasSeen(messageId) { return this.value.seen.includes(messageId); }
  async markSeen(messageId) {
    await this.#store.update((state) => state.seen.includes(messageId) ? state : { ...state, seen: [...state.seen, messageId] });
  }

  overrideFor(chatKey) { return { ...this.value.overrides[chatKey] }; }
  async setOverride(chatKey, patch) {
    if (typeof chatKey !== 'string') return this.overrideFor(chatKey);
    const state = await this.#store.update((state) => {
      const overrides = { ...state.overrides };
      const next = { ...overrides[chatKey], ...patch };
      for (const key of Object.keys(next)) if (next[key] === null) delete next[key];
      if (Object.keys(next).length === 0) delete overrides[chatKey];
      else overrides[chatKey] = next;
      return { ...state, overrides };
    });
    return { ...state.overrides[chatKey] };
  }

  get overrides() { return { ...this.value.overrides }; }
  async setSessionMeta(sessionId, patch) {
    if (typeof sessionId !== 'string') return;
    await this.#store.update((state) => ({
      ...state, meta: { ...state.meta, [sessionId]: { ...state.meta[sessionId], ...patch, at: Date.now() } },
    }));
  }
  get meta() { return { ...this.value.meta }; }
  reset() { return this.#store.update(() => ({})); }
}
