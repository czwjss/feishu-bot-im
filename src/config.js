/**
 * Multi-bot configuration (v2).
 *
 * Every Feishu bot owns its own non-secret settings; the App Secret lives in the
 * DSH credential service under a per-bot ref. Layout:
 *
 *   { version: 2, bots: [ { id, appId, secretRef, alias, ...settings } ] }
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { normalizeContextEnhancementConfig } from './context-enhancement.js';
import { randomUUID } from 'node:crypto';

export const ACCESS_MODES = Object.freeze({ ALL: 'all', ALLOWLIST: 'allowlist' });
export const BUSY_MODES = Object.freeze({ QUEUE: 'queue', STEER: 'steer' });
export const BOT_COLORS = Object.freeze(['blue', 'green', 'purple', 'orange', 'pink']);


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
  return Object.freeze({
    direct: pick(source.direct),
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
    topicsEnabled: source.topicsEnabled !== false,
    processDetail: source.processDetail === 'brief' ? 'brief' : 'detailed',
    permissionPreset: cleanString(source.permissionPreset),
    busyMode: normalizeScoped(source.busyMode, normalizeBusyMode),
    contextEnhancement: normalizeContextEnhancementConfig(source.contextEnhancement),
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

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export class ConfigStore {
  #path;
  #doc = Object.freeze({ version: 2, bots: Object.freeze([]) });
  #queue = Promise.resolve();

  constructor(path) {
    this.#path = path;
  }

  get bots() {
    return this.#doc.bots;
  }

  bot(id) {
    return this.#doc.bots.find((item) => item.id === id) ?? null;
  }

  async load() {
    const parsed = await readJson(this.#path).catch(() => null);
    this.#doc = normalizeDocument(parsed);
    return this;
  }

  #write(next) {
    const run = this.#queue.then(async () => {
      await writeJsonAtomic(this.#path, next);
      this.#doc = next;
      return next;
    });
    this.#queue = run.catch(() => undefined);
    return run;
  }

  add(botInput) {
    const bot = normalizeBot({
      id: `bot_${randomUUID().slice(0, 8)}`,
      color: botInput?.color ?? nextColor(this.#doc.bots),
      ...botInput,
    });
    if (!bot) throw new Error('App ID 不能为空');
    if (this.#doc.bots.some((item) => item.appId === bot.appId)) {
      throw new Error('这个飞书应用已经绑定过了');
    }
    return this.#write(Object.freeze({
      version: 2,
      bots: Object.freeze([...this.#doc.bots, bot]),
    })).then(() => bot);
  }

  update(id, patch) {
    const current = this.bot(id);
    if (!current) throw new Error(`机器人不存在：${id}`);
    const next = normalizeBot({ ...current, ...patch, id, appId: current.appId }, { legacyId: id });
    const bots = this.#doc.bots.map((item) => (item.id === id ? next : item));
    return this.#write(Object.freeze({ version: 2, bots: Object.freeze(bots) })).then(() => next);
  }

  remove(id) {
    const bots = this.#doc.bots.filter((item) => item.id !== id);
    return this.#write(Object.freeze({ version: 2, bots: Object.freeze(bots) }));
  }

  clear() {
    return this.#write(Object.freeze({ version: 2, bots: Object.freeze([]) }));
  }
}

/** Chat → Session bindings and inbound dedupe, one store per bot. */
export class StateStore {
  #path;
  #value = { sessions: {}, seen: [] };
  #cache = Promise.resolve();

  constructor(path) {
    this.#path = path;
  }

  get value() {
    return this.#value;
  }

  async load() {
    const parsed = await readJson(this.#path).catch(() => null);
    const sessions = parsed && typeof parsed.sessions === 'object' && parsed.sessions ? parsed.sessions : {};
    const seen = Array.isArray(parsed?.seen) ? parsed.seen.filter((id) => typeof id === 'string') : [];
    const meta = parsed && typeof parsed.meta === 'object' && parsed.meta ? parsed.meta : {};
    const overrides = parsed && typeof parsed.overrides === 'object' && parsed.overrides ? parsed.overrides : {};
    const topics = parsed && typeof parsed.topics === 'object' && parsed.topics ? parsed.topics : {};
    const counters = parsed && typeof parsed.counters === 'object' && parsed.counters ? parsed.counters : {};
    const synced = parsed && typeof parsed.synced === 'object' && parsed.synced ? parsed.synced : {};
    const usage = parsed && typeof parsed.usage === 'object' && parsed.usage ? parsed.usage : {};
    const cleanSessions = {};
    for (const [key, value] of Object.entries(sessions)) {
      const topicMatch = /^topic:([^:]+):(\d+)$/.exec(key);
      if (topicMatch && !topics[`${topicMatch[1]}:${topicMatch[2]}`]) continue;
      cleanSessions[key] = value;
    }
    this.#value = { sessions: cleanSessions, seen, meta: { ...meta }, overrides: { ...overrides }, topics: { ...topics }, counters: { ...counters }, synced: { ...synced }, usage: { ...usage } };
    return this;
  }

  #persist() {
    const snapshot = {
      sessions: { ...this.#value.sessions },
      seen: this.#value.seen.slice(-800),
      meta: { ...(this.#value.meta ?? {}) },
      overrides: { ...(this.#value.overrides ?? {}) },
      topics: { ...(this.#value.topics ?? {}) },
      counters: { ...(this.#value.counters ?? {}) },
      synced: { ...(this.#value.synced ?? {}) },
      usage: { ...(this.#value.usage ?? {}) },
    };
    this.#value = snapshot;
    const run = this.#cache.then(() => writeJsonAtomic(this.#path, snapshot));
    this.#cache = run.catch(() => undefined);
    return run;
  }

  /** Persisted token totals for one chat (cumulative across turns). */
  usageFor(key) {
    return this.#value.usage?.[key] ?? null;
  }

  async addUsage(key, delta) {
    const current = this.#value.usage?.[key] ?? { input: 0, output: 0, cache: 0, calls: 0 };
    const next = {
      input: current.input + (delta.input ?? 0),
      output: current.output + (delta.output ?? 0),
      cache: current.cache + (delta.cache ?? 0),
      calls: current.calls + (delta.calls ?? 0),
    };
    this.#value = { ...this.#value, usage: { ...(this.#value.usage ?? {}), [key]: next } };
    await this.#persist();
    return next;
  }

  sessionFor(key) {
    return this.#value.sessions[key] ?? null;
  }

  keyForSession(sessionId) {
    const found = Object.entries(this.#value.sessions).find(([, value]) => value === sessionId);
    return found ? found[0] : null;
  }

  async bindSession(key, sessionId) {
    this.#value = { ...this.#value, sessions: { ...this.#value.sessions, [key]: sessionId } };
    await this.#persist();
    return sessionId;
  }

  async unbindSession(key) {
    const sessions = { ...this.#value.sessions };
    delete sessions[key];
    this.#value = { ...this.#value, sessions };
    await this.#persist();
  }

  hasSeen(messageId) {
    return this.#value.seen.includes(messageId);
  }

  async markSeen(messageId) {
    if (this.hasSeen(messageId)) return;
    this.#value = { ...this.#value, seen: [...this.#value.seen, messageId].slice(-800) };
    await this.#persist();
  }

  /** Topics (independent Sessions forked out of a chat). */
  get topics() {
    return { ...(this.#value.topics ?? {}) };
  }

  topicFor(chatId, topicId) {
    return (this.#value.topics ?? {})[`${chatId}:${topicId}`] ?? null;
  }

  topicBySession(sessionId) {
    if (typeof sessionId !== 'string') return null;
    for (const topic of Object.values(this.#value.topics ?? {})) {
      if (topic.sessionId === sessionId) return topic;
    }
    return null;
  }

  topicsOf(chatId) {
    return Object.values(this.#value.topics ?? {})
      .filter((topic) => topic.chatId === chatId)
      .sort((a, b) => a.topicId - b.topicId);
  }

  async createTopic({ chatId, title, brief, sessionId, rootMessageId = null, threadId = null }) {
    const key = chatId;
    const counters = { ...(this.#value.counters ?? {}) };
    const topicId = (counters[key] ?? 0) + 1;
    counters[key] = topicId;
    const topic = {
      chatId,
      topicId,
      title,
      brief: brief ?? '',
      sessionId,
      rootMessageId,
      threadId,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.#value = {
      ...this.#value,
      counters,
      topics: { ...(this.#value.topics ?? {}), [`${chatId}:${topicId}`]: topic },
    };
    await this.#persist();
    return topic;
  }

  async updateTopic(chatId, topicId, patch) {
    const key = `${chatId}:${topicId}`;
    const current = (this.#value.topics ?? {})[key];
    if (!current) return null;
    const next = { ...current, ...patch };
    this.#value = { ...this.#value, topics: { ...(this.#value.topics ?? {}), [key]: next } };
    await this.#persist();
    return next;
  }

  /** Topic summaries synced back into the chat's main Session. */
  syncedFor(chatId) {
    return [...((this.#value.synced ?? {})[chatId] ?? [])];
  }

  async addSynced(chatId, entry) {
    const list = [...((this.#value.synced ?? {})[chatId] ?? []), entry];
    this.#value = { ...this.#value, synced: { ...(this.#value.synced ?? {}), [chatId]: list } };
    await this.#persist();
    return list;
  }

  /** Per-chat overrides used when the next Session is created (never defaults). */
  overrideFor(chatKey) {
    return { ...((this.#value.overrides ?? {})[chatKey] ?? {}) };
  }

  async setOverride(chatKey, patch) {
    if (typeof chatKey !== 'string') return this.overrideFor(chatKey);
    const overrides = { ...(this.#value.overrides ?? {}) };
    const next = { ...(overrides[chatKey] ?? {}), ...patch };
    for (const key of Object.keys(next)) if (next[key] === null) delete next[key];
    if (Object.keys(next).length === 0) delete overrides[chatKey];
    else overrides[chatKey] = next;
    this.#value = { ...this.#value, overrides };
    await this.#persist();
    return this.overrideFor(chatKey);
  }

  get overrides() {
    return { ...(this.#value.overrides ?? {}) };
  }

  /** Per-session facts the chat side needs (currently the workspace). */
  async setSessionMeta(sessionId, patch) {
    if (typeof sessionId !== 'string') return;
    const meta = { ...(this.#value.meta ?? {}) };
    meta[sessionId] = { ...(meta[sessionId] ?? {}), ...patch, at: Date.now() };
    this.#value = { ...this.#value, meta };
    await this.#persist();
  }

  /** Who created the Session: 'feishu' for ours, null when adopted. */
  originOf(sessionId) {
    if (typeof sessionId !== 'string') return null;
    return (this.#value.meta ?? {})[sessionId]?.origin ?? null;
  }

  get meta() {
    return { ...(this.#value.meta ?? {}) };
  }

  async reset() {
    this.#value = { sessions: {}, seen: [], meta: {}, overrides: {}, topics: {}, counters: {}, synced: {} };
    await writeJsonAtomic(this.#path, this.#value);
    return this.#value;
  }
}
