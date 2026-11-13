/**
 * 用户身份消息监听的配置与游标。
 *
 * 配置：`<dataDir>/monitor.json`
 * 状态：`<dataDir>/monitor-state.json`
 *
 * 监听按会话保存游标、去重集合、最近消息和批次状态（有上限、0600）。
 * 消息按批次派给 Worker 会话，派发成功即视为已处理。
 */
import { JsonStore, definedFields } from '../json-store.js';
import { DEFAULT_HANDOFF_KEYWORDS } from '../handoff.js';
import { normalizeReplyRules } from './worker-context.js';

export const MONITOR_VERSION = 2;
export const MONITOR_FILE = 'monitor.json';
export const MONITOR_STATE_FILE = 'monitor-state.json';
export const MAX_MONITOR_CHATS = 20;
export const MAX_SEEN_IDS = 500;
export const MAX_MESSAGES_PER_CHAT = 50;
export const MAX_KEYWORDS = 10;
export const TRIGGER_MODES = Object.freeze(['all', 'mention', 'keyword']);
/** 一批消息的防抖窗口：首条到达后再等这么久就把批次交给 Worker。 */
export const BATCH_DEBOUNCE_MS = 30_000;
/** 批次最多等这么久，避免持续刷屏时一直不处理。 */
export const BATCH_MAX_WAIT_MS = 3 * 60_000;
export const BATCH_MAX_MESSAGES = 10;
/** Backpressure stops polling before unprocessed messages would be discarded. */
export const MAX_PENDING_MESSAGES = 500;
export const DEFAULT_WORKER_PRESET = 'standard';
export const MAX_WORKER_PRESET = 40;
export const MAX_PENDING_CARDS = 20;
export const MAX_HANDOFF_KEYWORDS = 20;
export const MAX_HANDOFF_KEYWORD_LENGTH = 40;
/** 消息处理结果：批次已派发给 Worker，后续不再由插件跟踪。 */
export const DEFAULT_POLL_INTERVAL_MS = 30_000;
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
    /** 开启时机器人与真人统一处理；关闭时从批次中排除机器人。 */
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
  const handoffProvided = Array.isArray(source.handoffKeywords);
  const handoffKeywords = [];
  for (const raw of handoffProvided ? source.handoffKeywords : []) {
    const keyword = cleanString(raw).slice(0, MAX_HANDOFF_KEYWORD_LENGTH);
    if (!keyword || handoffKeywords.includes(keyword)) continue;
    handoffKeywords.push(keyword);
    if (handoffKeywords.length >= MAX_HANDOFF_KEYWORDS) break;
  }
  // 旧版本持久化的默认 60 秒随本次调整迁移；保留其它自定义间隔。
  const oldDefault = Number(source.version ?? 1) < 2 && Number(source.pollIntervalMs) === 60_000;
  const interval = oldDefault ? DEFAULT_POLL_INTERVAL_MS : Number(source.pollIntervalMs);
  return Object.freeze({
    version: MONITOR_VERSION,
    enabled: source.enabled === true,
    pollIntervalMs: Number.isFinite(interval)
      ? Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(interval)))
      : DEFAULT_POLL_INTERVAL_MS,
    chats: Object.freeze(chats),
    worker: normalizeWorkerConfig(source.worker),
    replyRules: normalizeReplyRules(source.replyRules),
    handoffKeywords: Object.freeze(handoffProvided ? handoffKeywords : [...DEFAULT_HANDOFF_KEYWORDS]),
  });
}

export function normalizeMonitorMessage(value) {
  const source = value && typeof value === 'object' ? value : {};
  const messageId = cleanString(source.messageId);
  if (!messageId) return null;
  const text = stringOf(source.text);
  return Object.freeze({
    messageId,
    senderName: cleanString(source.senderName),
    senderOpenId: cleanString(source.senderOpenId),
    senderType: cleanString(source.senderType),
    isSelf: source.isSelf === true,
    contextOnly: source.contextOnly === true || source.isSelf === true,
    createTime: cleanString(source.createTime),
    text,
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
    lastText: stringOf(source.lastText),
    isSelf: source.isSelf === true,
    contextOnly: source.contextOnly === true || source.isSelf === true,
  });
}

export function normalizeMonitorState(value, configuredChats = []) {
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
    const batch = entry.batch && typeof entry.batch === 'object' ? entry.batch : {};
    const pendingIds = [...new Set((Array.isArray(batch.messageIds) ? batch.messageIds : [])
      .map(cleanString).filter(Boolean))];
    if (pendingIds.length > MAX_PENDING_MESSAGES) throw new Error('待处理消息已满，请先处理积压消息');
    const pendingSet = new Set(pendingIds);
    const messages = [];
    const messageIds = new Set();
    for (const raw of Array.isArray(entry.messages) ? entry.messages : []) {
      const message = normalizeMonitorMessage(raw);
      if (!message || messageIds.has(message.messageId)) continue;
      messageIds.add(message.messageId);
      messages.push(message);
    }
    const recentIds = new Set(messages.slice(-MAX_MESSAGES_PER_CHAT).map((message) => message.messageId));
    const scan = entry.scan;
    chats[chatId] = Object.freeze({
      cursorTimeMs: cleanTime(entry.cursorTimeMs),
      cursorMessageId: cleanString(entry.cursorMessageId) || null,
      scan: cleanTime(scan?.startTimeMs) && cleanTime(scan?.endTimeMs) && cleanString(scan?.pageToken)
        ? Object.freeze({ startTimeMs: cleanTime(scan.startTimeMs), endTimeMs: cleanTime(scan.endTimeMs), pageToken: cleanString(scan.pageToken) })
        : null,
      messages: Object.freeze(messages.filter((message) => pendingSet.has(message.messageId) || recentIds.has(message.messageId))),
      sessionId: cleanString(entry.sessionId) || null,
      workerConfigKey: cleanString(entry.workerConfigKey) || null,
      titleName: cleanString(entry.titleName) || null,
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
  // Worker 绑定独立于监听列表和批次，已被 Host 接收的任务在取消监听后仍可读取上下文。
  const workerSessions = Object.create(null);
  for (const [sessionId, binding] of Object.entries(source.workerSessions ?? {})) {
    const chatId = chatKey(binding?.chatId);
    if (!sessionId || !chatId) continue;
    workerSessions[sessionId] = Object.freeze({
      chatId,
      name: cleanString(binding.name) || chatId,
      chatMode: binding.chatMode === 'p2p' ? 'p2p' : 'group',
    });
  }
  // 兼容升级前已经创建的 Worker，当前聊天配置会补充最新名称和会话类型。
  for (const [chatId, entry] of Object.entries(chats)) {
    if (!entry.sessionId || workerSessions[entry.sessionId]) continue;
    const chat = configuredChats.find((item) => item.chatId === chatId);
    workerSessions[entry.sessionId] = Object.freeze({
      chatId, name: chat?.name || entry.titleName || chatId, chatMode: chat?.chatMode ?? 'group',
    });
  }
  return Object.freeze({
    version: MONITOR_VERSION,
    chats: Object.freeze(chats),
    pendingCards: Object.freeze(pendingCards),
    workerSessions: Object.freeze(workerSessions),
  });
}

export class MonitorStore {
  #configStore;
  #stateStore;
  constructor({ configPath, statePath }) {
    this.#configStore = new JsonStore(configPath, normalizeMonitorConfig);
    this.#stateStore = new JsonStore(statePath, (value) => normalizeMonitorState(value, this.config.chats));
  }
  get config() { return this.#configStore.value; }
  get state() { return this.#stateStore.value; }
  async load() {
    await this.#configStore.load();
    await this.#stateStore.load();
    return this;
  }
  saveConfig(patch = {}) {
    return this.#configStore.update((previous) => ({
      ...previous, ...definedFields(typeof patch === 'function' ? patch(previous) : patch),
    }));
  }
  saveState(nextState) {
    return this.#stateStore.update((previous) => typeof nextState === 'function' ? nextState(previous) : nextState);
  }

  bindWorkerSession(chat, sessionId) {
    return this.saveState((state) => {
      const binding = { chatId: chat.chatId, name: chat.name || chat.chatId, chatMode: chat.chatMode };
      const previous = state.workerSessions?.[sessionId];
      if (previous && Object.keys(binding).every((key) => previous[key] === binding[key])) return state;
      return { ...state, workerSessions: { ...state.workerSessions, [sessionId]: binding } };
    });
  }

  /** Merge against the latest state inside the write queue; removed chats stay removed. */
  updateChat(chatId, update) {
    return this.saveState((state) => {
      if (!this.config.chats.some((chat) => chat.chatId === chatId)) return state;
      const entry = state.chats[chatId] ?? {};
      const patch = typeof update === 'function' ? update(entry) : update;
      return { ...state, chats: { ...state.chats, [chatId]: { ...entry, ...patch } } };
    });
  }
}
