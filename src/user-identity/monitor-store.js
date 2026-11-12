/**
 * 用户身份消息监听的配置与游标。
 *
 * 配置：`<dataDir>/monitor.json`
 * 状态：`<dataDir>/monitor-state.json`
 *
 * 监听按会话保存游标、去重集合、最近消息和批次状态（有上限、0600）。
 * `watch` 只记录，`auto` 把一批消息派给 Worker 会话后即视为已处理。
 */
import { readFile } from 'node:fs/promises';

import { writePrivateJson } from './config.js';

export const MONITOR_VERSION = 1;
export const MONITOR_FILE = 'monitor.json';
export const MONITOR_STATE_FILE = 'monitor-state.json';
export const MAX_MONITOR_CHATS = 20;
export const MAX_SEEN_IDS = 500;
export const MAX_MESSAGES_PER_CHAT = 50;
export const MAX_MESSAGE_TEXT = 2_000;
export const MAX_KEYWORDS = 10;
export const TRIGGER_MODES = Object.freeze(['all', 'mention', 'keyword']);
export const REPLY_MODES = Object.freeze(['watch', 'auto']);
/** 一批消息的防抖窗口：首条到达后再等这么久就把批次交给 Worker。 */
export const BATCH_DEBOUNCE_MS = 45_000;
/** 批次最多等这么久，避免持续刷屏时一直不处理。 */
export const BATCH_MAX_WAIT_MS = 3 * 60_000;
export const BATCH_MAX_MESSAGES = 10;
export const DEFAULT_WORKER_PRESET = 'standard';
export const MAX_WORKER_PRESET = 40;
export const MAX_PENDING_CARDS = 20;
/** 消息处理结果：批次已派发给 Worker，后续不再由插件跟踪。 */
export const MESSAGE_OUTCOMES = Object.freeze(['dispatched', 'dropped']);
export const DEFAULT_POLL_INTERVAL_MS = 60_000;
export const MIN_POLL_INTERVAL_MS = 5_000;
export const MAX_POLL_INTERVAL_MS = 60_000;

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cleanTime(value) {
  const time = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(time) && time > 0 ? Math.trunc(time) : null;
}

function chatKey(chatId) {
  return /^oc_[A-Za-z0-9_-]{4,}$/.test(chatId) ? chatId : '';
}

export function normalizeKeywords(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，\n]/) : [];
  const keywords = [];
  for (const item of list) {
    const keyword = cleanString(item).slice(0, 30);
    if (!keyword || keywords.includes(keyword)) continue;
    keywords.push(keyword);
    if (keywords.length >= MAX_KEYWORDS) break;
  }
  return Object.freeze(keywords);
}

/** 默认触发规则：私聊全收，群聊只在 @我 / 回复我 时记录。 */
function defaultMode(chatMode) {
  return chatMode === 'p2p' ? 'all' : 'mention';
}

export function normalizeMonitorChat(value) {
  const source = value && typeof value === 'object' ? value : {};
  const chatId = chatKey(cleanString(source.chatId));
  if (!chatId) return null;
  const chatMode = source.chatMode === 'p2p' ? 'p2p' : 'group';
  const mode = TRIGGER_MODES.includes(source.mode) ? source.mode : defaultMode(chatMode);
  return Object.freeze({
    chatId,
    name: cleanString(source.name),
    chatMode,
    external: source.external === true,
    mode,
    keywords: normalizeKeywords(source.keywords),
    replyMode: REPLY_MODES.includes(source.replyMode) ? source.replyMode : 'watch',
    preset: cleanString(source.preset),
    /** 是否允许“只有机器人消息”的批次触发自动回复（默认关，仅用于测试）。 */
    replyToBots: source.replyToBots === true,
  });
}

/** Worker 会话的归属：工作区（id 优先，其次路径）与预设。 */
export function normalizeWorkerConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    workspaceId: cleanString(source.workspaceId).slice(0, 121),
    workspacePath: cleanString(source.workspacePath),
    preset: cleanString(source.preset).slice(0, MAX_WORKER_PRESET),
  });
}

export function normalizeMonitorConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  const seen = new Set();
  const chats = [];
  for (const item of Array.isArray(source.chats) ? source.chats : []) {
    const chat = normalizeMonitorChat(item);
    if (!chat || seen.has(chat.chatId) || chats.length >= MAX_MONITOR_CHATS) continue;
    seen.add(chat.chatId);
    chats.push(chat);
  }
  const interval = Number(source.pollIntervalMs);
  return Object.freeze({
    version: MONITOR_VERSION,
    enabled: source.enabled === true,
    pollIntervalMs: Number.isFinite(interval)
      ? Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(interval)))
      : DEFAULT_POLL_INTERVAL_MS,
    chats: Object.freeze(chats),
    worker: normalizeWorkerConfig(source.worker),
  });
}

export function normalizeMonitorMessage(value) {
  const source = value && typeof value === 'object' ? value : {};
  const messageId = cleanString(source.messageId);
  if (!messageId) return null;
  const text = stringOf(source.text).slice(0, MAX_MESSAGE_TEXT);
  const outcome = MESSAGE_OUTCOMES.includes(source.outcome) ? source.outcome : '';
  return Object.freeze({
    messageId,
    senderName: cleanString(source.senderName),
    senderOpenId: cleanString(source.senderOpenId),
    senderType: cleanString(source.senderType),
    createTime: cleanString(source.createTime),
    text,
    // outcome 非空表示已被自动回复或自动跳过。
    outcome,
    handledAt: cleanTime(source.handledAt),
  });
}

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

/** 还在流式输出、尚未收尾的卡片：不进入消息列表，收尾后才补进来。 */
export function normalizePendingCard(value) {
  const source = value && typeof value === 'object' ? value : {};
  const messageId = cleanString(source.messageId);
  const chatId = chatKey(cleanString(source.chatId));
  if (!messageId || !chatId) return null;
  return Object.freeze({
    messageId,
    chatId,
    createTime: cleanString(source.createTime),
    lastText: stringOf(source.lastText).slice(0, MAX_MESSAGE_TEXT),
  });
}

export function normalizeMonitorState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceChats = source.chats && typeof source.chats === 'object' ? source.chats : {};
  const chats = {};
  for (const [rawChatId, rawState] of Object.entries(sourceChats)) {
    const chatId = chatKey(rawChatId);
    if (!chatId) continue;
    const entry = rawState && typeof rawState === 'object' ? rawState : {};
    const seen = [];
    const seenSet = new Set();
    for (const id of Array.isArray(entry.seen) ? entry.seen : []) {
      const valueId = cleanString(id);
      if (!valueId || seenSet.has(valueId)) continue;
      seenSet.add(valueId);
      seen.push(valueId);
      if (seen.length >= MAX_SEEN_IDS) break;
    }
    const messages = [];
    const messageIds = new Set();
    for (const raw of Array.isArray(entry.messages) ? entry.messages : []) {
      const message = normalizeMonitorMessage(raw);
      if (!message || messageIds.has(message.messageId)) continue;
      messageIds.add(message.messageId);
      messages.push(message);
      if (messages.length >= MAX_MESSAGES_PER_CHAT) break;
    }
    const batch = entry.batch && typeof entry.batch === 'object' ? entry.batch : {};
    const pendingIds = Array.isArray(batch.messageIds)
      ? batch.messageIds.map(cleanString).filter(Boolean).slice(0, BATCH_MAX_MESSAGES)
      : [];
    chats[chatId] = Object.freeze({
      cursorTimeMs: cleanTime(entry.cursorTimeMs),
      cursorMessageId: cleanString(entry.cursorMessageId) || null,
      messages: Object.freeze(messages),
      sessionId: cleanString(entry.sessionId) || null,
      workerConfigKey: cleanString(entry.workerConfigKey) || null,
      batch: Object.freeze({
        messageIds: Object.freeze(pendingIds),
        firstAt: cleanTime(batch.firstAt),
        lastAt: cleanTime(batch.lastAt),
      }),
      lastDispatchAt: cleanTime(entry.lastDispatchAt),
      seen: Object.freeze(seen),
      lastPollAt: cleanTime(entry.lastPollAt),
      lastError: cleanString(entry.lastError) || null,
    });
  }
  const pendingCards = [];
  const pendingIds = new Set();
  for (const raw of Array.isArray(source.pendingCards) ? source.pendingCards : []) {
    const card = normalizePendingCard(raw);
    if (!card || pendingIds.has(card.messageId)) continue;
    pendingIds.add(card.messageId);
    pendingCards.push(card);
    if (pendingCards.length >= MAX_PENDING_CARDS) break;
  }
  return Object.freeze({
    version: MONITOR_VERSION,
    chats: Object.freeze(chats),
    pendingCards: Object.freeze(pendingCards),
  });
}

export class MonitorStore {
  #configPath;
  #statePath;
  #config = normalizeMonitorConfig({});
  #state = normalizeMonitorState({});

  constructor({ configPath, statePath }) {
    if (!configPath || !statePath) throw new TypeError('MonitorStore 需要 configPath 和 statePath');
    this.#configPath = configPath;
    this.#statePath = statePath;
  }

  get config() {
    return this.#config;
  }

  get state() {
    return this.#state;
  }

  async load() {
    try {
      this.#config = normalizeMonitorConfig(JSON.parse(await readFile(this.#configPath, 'utf8')));
    } catch {
      this.#config = normalizeMonitorConfig({});
    }
    try {
      this.#state = normalizeMonitorState(JSON.parse(await readFile(this.#statePath, 'utf8')));
    } catch {
      this.#state = normalizeMonitorState({});
    }
    return this;
  }

  async saveConfig(patch = {}) {
    const source = patch && typeof patch === 'object' ? patch : {};
    const next = normalizeMonitorConfig({
      enabled: source.enabled === undefined ? this.#config.enabled : source.enabled,
      pollIntervalMs: source.pollIntervalMs === undefined ? this.#config.pollIntervalMs : source.pollIntervalMs,
      chats: source.chats === undefined ? this.#config.chats : source.chats,
      worker: source.worker === undefined ? this.#config.worker : source.worker,
    });
    await writePrivateJson(this.#configPath, next);
    this.#config = next;
    return next;
  }

  async saveState(nextState) {
    const next = normalizeMonitorState(nextState);
    await writePrivateJson(this.#statePath, next);
    this.#state = next;
    return next;
  }
}
