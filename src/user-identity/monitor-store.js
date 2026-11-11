/**
 * 用户身份消息监听的配置与游标。
 *
 * 配置：`<dataDir>/monitor.json`
 * 状态：`<dataDir>/monitor-state.json`
 *
 * 监听按会话保存游标、去重集合和最近消息（有上限、0600），
 * 供 `feishu_avatar_inbox` 工具读取；不调用模型，也不自动回复。
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

export function normalizeMonitorChat(value) {
  const source = value && typeof value === 'object' ? value : {};
  const chatId = chatKey(cleanString(source.chatId));
  if (!chatId) return null;
  return Object.freeze({
    chatId,
    name: cleanString(source.name),
    chatMode: source.chatMode === 'p2p' ? 'p2p' : 'group',
    external: source.external === true,
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
      : 8_000,
    chats: Object.freeze(chats),
  });
}

export function normalizeMonitorMessage(value) {
  const source = value && typeof value === 'object' ? value : {};
  const messageId = cleanString(source.messageId);
  if (!messageId) return null;
  const text = stringOf(source.text).slice(0, MAX_MESSAGE_TEXT);
  return Object.freeze({
    messageId,
    senderName: cleanString(source.senderName),
    senderOpenId: cleanString(source.senderOpenId),
    createTime: cleanString(source.createTime),
    text,
    read: source.read === true,
  });
}

function stringOf(value) {
  return typeof value === 'string' ? value : '';
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
    chats[chatId] = Object.freeze({
      cursorTimeMs: cleanTime(entry.cursorTimeMs),
      cursorMessageId: cleanString(entry.cursorMessageId) || null,
      messages: Object.freeze(messages),
      seen: Object.freeze(seen),
      lastPollAt: cleanTime(entry.lastPollAt),
      lastError: cleanString(entry.lastError) || null,
      lastDeliveredAt: cleanTime(entry.lastDeliveredAt),
    });
  }
  return Object.freeze({
    version: MONITOR_VERSION,
    chats: Object.freeze(chats),
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
