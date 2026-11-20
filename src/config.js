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

import { ACCESS_MODES, BUSY_MODES } from './contracts.js';
export { ACCESS_MODES, BUSY_MODES };


function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOpenIds(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(cleanString).filter(Boolean))].slice(0, 200);
}

function normalizeAccess(value) {
  const source = value && typeof value === 'object' ? value : {};
  const pick = (candidate) => (candidate === ACCESS_MODES.ALLOWLIST ? ACCESS_MODES.ALLOWLIST : ACCESS_MODES.ALL);
  // Private chats are always open; only groups carry an access mode.
  return Object.freeze({
    group: pick(source.group),
    allowOpenIds: Object.freeze(normalizeOpenIds(source.allowOpenIds)),
    managers: Object.freeze(normalizeOpenIds(source.managers)),
  });
}

function normalizeModel(value) {
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

export function secretRefFor(botId) {
  return `IM_FEISHU_SECRET_${String(botId).toUpperCase()}`;
}

/** One bot's settings, with defaults for everything a fresh bot lacks. */
export function normalizeBot(value) {
  const source = value && typeof value === 'object' ? value : {};
  const appId = cleanString(source.appId);
  if (!appId) return null;
  const id = cleanString(source.id) ?? `bot_${randomUUID().slice(0, 8)}`;
  return Object.freeze({
    id,
    appId,
    secretRef: cleanString(source.secretRef) ?? secretRefFor(id),
    alias: cleanString(source.alias)?.slice(0, 40) ?? null,
    botName: cleanString(source.botName),
    botOpenId: cleanString(source.botOpenId),
    workspace: cleanString(source.workspace),
    model: normalizeModel(source.model),
    agentPreset: cleanString(source.agentPreset),
    respondToBotMessages: source.respondToBotMessages !== false,
    processDetail: source.processDetail === 'brief' ? 'brief' : 'detailed',
    permissionPreset: cleanString(source.permissionPreset),
    busyMode: Object.freeze({
      direct: normalizeBusyMode(source.busyMode?.direct),
      group: normalizeBusyMode(source.busyMode?.group),
    }),
    contextEnhancement: normalizeContextEnhancementConfig(source.contextEnhancement),
    eavesdrop: normalizeEavesdropConfig(source.eavesdrop),
    mentions: normalizeMentionsConfig(source.mentions),
    access: normalizeAccess(source.access),
    connectedAt: cleanString(source.connectedAt),
  });
}


function normalizeDocument(value) {
  if (value != null && (typeof value !== 'object' || !Array.isArray(value.bots))) {
    throw Object.assign(new Error('机器人配置必须包含 bots 数组，请使用当前多机器人配置格式'), { code: 'INVALID_CONFIG' });
  }
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
  return Object.freeze({ version: 2, bots: Object.freeze(bots) });
}

function integrationDir(config = {}) {
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
      const resolved = typeof patch === 'function' ? patch(current) : patch;
      const busyMode = resolved?.busyMode && typeof resolved.busyMode === 'object'
        ? { ...current.busyMode, ...resolved.busyMode }
        : current.busyMode;
      next = normalizeBot({ ...current, ...resolved, busyMode, id, appId: current.appId });
      return { version: 2, bots: doc.bots.map((item) => (item.id === id ? next : item)) };
    }).then(() => next);
  }

  remove(id) {
    return this.#store.update((doc) => ({ version: 2, bots: doc.bots.filter((item) => item.id !== id) }));
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
  #pendingSeen = new Set();
  #seenTimer = null;

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

  #updateWithPendingSeen(updater) {
    return this.#store.update((state) => {
      const missing = this.#pendingSeen.size > 0
        ? [...this.#pendingSeen].filter((id) => !state.seen.includes(id))
        : [];
      const merged = missing.length > 0 ? { ...state, seen: [...state.seen, ...missing] } : state;
      const next = updater(merged);
      if (next !== state && missing.length > 0) this.#pendingSeen.clear();
      return next;
    });
  }

  async setChatType(key, type) {
    if (!['p2p', 'group'].includes(type)) return;
    await this.#updateWithPendingSeen((state) => state.chatTypes[key] === type ? state : {
      ...state, chatTypes: { ...state.chatTypes, [key]: type },
    });
  }

  keyForSession(sessionId) {
    return Object.entries(this.value.sessions).find(([, value]) => value === sessionId)?.[0] ?? null;
  }

  async bindSession(key, sessionId, { expectedSessionId, validate, preserveTitle = false } = {}) {
    await this.#updateWithPendingSeen((state) => {
      if (expectedSessionId !== undefined && (state.sessions[key] ?? null) !== expectedSessionId) {
        throw Object.assign(new Error('会话绑定已变化，请刷新后重新选择'), { code: 'conflict' });
      }
      validate?.();
      if (state.sessions[key] === sessionId && (!preserveTitle || state.meta[sessionId]?.preserveTitle)) return state;
      return {
        ...state, sessions: { ...state.sessions, [key]: sessionId },
        meta: preserveTitle ? { ...state.meta, [sessionId]: { ...state.meta[sessionId], preserveTitle: true } } : state.meta,
      };
    });
    return sessionId;
  }

  async unbindSession(key, expectedSessionId) {
    let previous = null;
    await this.#store.update((state) => {
      previous = state.sessions[key] ?? null;
      if (previous && expectedSessionId !== undefined && previous !== expectedSessionId) {
        throw Object.assign(new Error('会话绑定已变化，请刷新后再解绑'), { code: 'conflict' });
      }
      if (!previous) return state;
      const sessions = { ...state.sessions };
      delete sessions[key];
      return { ...state, sessions };
    });
    return previous;
  }

  hasSeen(messageId) { return this.#pendingSeen.has(messageId) || this.value.seen.includes(messageId); }
  async markSeen(messageId) {
    this.#pendingSeen.delete(messageId);
    await this.#store.update((state) => state.seen.includes(messageId) ? state : { ...state, seen: [...state.seen, messageId] });
  }

  /** 内存立即可见去重，按 2 秒窗口合并写盘，避免高活跃群每条旁听都全量落盘。 */
  markSeenDeferred(messageId, delayMs = 2_000) {
    if (!messageId || this.hasSeen(messageId)) return;
    this.#pendingSeen.add(messageId);
    if (this.#pendingSeen.size >= 50) {
      void this.flushSeen().catch(() => undefined);
      return;
    }
    if (this.#seenTimer) return;
    this.#seenTimer = setTimeout(() => {
      this.#seenTimer = null;
      void this.flushSeen().catch(() => undefined);
    }, delayMs);
    this.#seenTimer.unref?.();
  }

  stopSeenTimer() {
    if (this.#seenTimer) {
      clearTimeout(this.#seenTimer);
      this.#seenTimer = null;
    }
  }

  async flushSeen() {
    this.stopSeenTimer();
    if (this.#pendingSeen.size === 0) return;
    const batch = [...this.#pendingSeen];
    this.#pendingSeen.clear();
    await this.#store.update((state) => {
      const missing = batch.filter((id) => !state.seen.includes(id));
      return missing.length === 0 ? state : { ...state, seen: [...state.seen, ...missing] };
    });
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
  reset() {
    if (this.#seenTimer) {
      clearTimeout(this.#seenTimer);
      this.#seenTimer = null;
    }
    this.#pendingSeen.clear();
    return this.#store.update(() => ({}));
  }
}
