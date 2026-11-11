/**
 * 飞书分身消息监听（阶段 1：只记录，不调模型、不自动回复）。
 *
 * 用户身份没有个人收件箱事件推送，因此监听器按会话轮询。
 * 新消息只落到本地收件箱（`monitor-state.json`，0600、有上限），
 * 由 `feishu_avatar_inbox` 工具交给 Agent，或直接回复。
 * 回复仍走 `feishu_avatar_send`（用户本人身份），监听本身不写飞书。
 */
import { listChats, listMessages } from './api.js';
import {
  MAX_MONITOR_CHATS,
  MAX_MESSAGES_PER_CHAT,
  MAX_SEEN_IDS,
  normalizeMonitorConfig,
  normalizeMonitorState,
} from './monitor-store.js';

const MAX_MESSAGES_PER_POLL = 100;
const MAX_DISCOVER_PAGES = 5;

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

function messageTime(item) {
  const parsed = Date.parse(stringOf(item?.createTime));
  return Number.isFinite(parsed) ? parsed : null;
}

export class UserMonitorManager {
  #auth;
  #store;
  #logger;
  #now;
  #setInterval;
  #clearInterval;
  #timer = null;
  #polling = false;
  #disposed = false;
  #listMessages;
  #listChats;

  constructor({
    auth,
    store,
    logger = null,
    listMessages: listMessagesImpl = listMessages,
    listChats: listChatsImpl = listChats,
    now = Date.now,
    setInterval: setIntervalImpl = setInterval,
    clearInterval: clearIntervalImpl = clearInterval,
  }) {
    if (!auth) throw new TypeError('UserMonitorManager 需要 auth');
    if (!store) throw new TypeError('UserMonitorManager 需要 store');
    this.#auth = auth;
    this.#store = store;
    this.#logger = logger;
    this.#now = now;
    this.#setInterval = setIntervalImpl;
    this.#clearInterval = clearIntervalImpl;
    this.#listMessages = listMessagesImpl;
    this.#listChats = listChatsImpl;
  }

  get store() {
    return this.#store;
  }

  /** 启动轮询；未启用时也保留定时器，便于 UI 打开后立即生效。 */
  start() {
    if (this.#disposed || this.#timer) return;
    const interval = this.#store.config.pollIntervalMs;
    this.#timer = this.#setInterval(() => { void this.pollOnce(); }, interval);
    this.#timer?.unref?.();
    if (this.#store.config.enabled) void this.pollOnce();
  }

  stop() {
    if (this.#timer) {
      this.#clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  dispose() {
    this.#disposed = true;
    this.stop();
  }

  /** 监听状态 + 每会话未读数和最近消息（受上限约束）。 */
  async status() {
    const auth = await this.#auth.status().catch(() => null);
    const config = this.#store.config;
    const state = this.#store.state;
    let unreadTotal = 0;
    const chats = config.chats.map((chat) => {
      const entry = state.chats[chat.chatId] ?? {};
      const messages = entry.messages ?? [];
      const unread = messages.filter((message) => !message.read).length;
      unreadTotal += unread;
      return {
        ...chat,
        unread,
        cursorTimeMs: entry.cursorTimeMs ?? null,
        lastPollAt: entry.lastPollAt ?? null,
        lastError: entry.lastError ?? null,
        lastDeliveredAt: entry.lastDeliveredAt ?? null,
        messages: messages.slice(-10),
      };
    });
    return {
      enabled: config.enabled,
      pollIntervalMs: config.pollIntervalMs,
      unreadTotal,
      authorization: auth
        ? {
          authorized: Boolean(auth.authorization?.authorized),
          user: auth.authorization?.user ?? null,
        }
        : null,
      chats,
    };
  }

  /** 候选会话：群聊 + 最近私聊。 */
  async discoverChats() {
    const accessToken = await this.#auth.requireAccessToken();
    const merged = new Map();
    let pageToken = null;
    for (let page = 0; page < MAX_DISCOVER_PAGES; page += 1) {
      const result = await this.#listChats({
        accessToken,
        types: 'p2p,group',
        pageSize: 100,
        pageToken,
      });
      for (const chat of result.items) {
        if (merged.has(chat.chatId)) continue;
        merged.set(chat.chatId, {
          chatId: chat.chatId,
          name: chat.name || chat.chatId,
          chatMode: chat.chatMode,
          external: chat.external,
        });
      }
      if (!result.hasMore || !result.pageToken) break;
      pageToken = result.pageToken;
    }
    return [...merged.values()];
  }

  async addChat(input = {}) {
    const chatId = stringOf(input.chatId).trim();
    if (!/^oc_[A-Za-z0-9_-]{4,}$/.test(chatId)) throw new Error('chatId 需要是 oc_ 开头的会话 ID');
    if (this.#store.config.chats.some((chat) => chat.chatId === chatId)) {
      throw new Error('这个会话已经在监听列表里');
    }
    if (this.#store.config.chats.length >= MAX_MONITOR_CHATS) {
      throw new Error(`最多监听 ${MAX_MONITOR_CHATS} 个会话`);
    }
    const chat = {
      chatId,
      name: stringOf(input.name).trim() || chatId,
      chatMode: input.chatMode === 'p2p' ? 'p2p' : 'group',
      external: input.external === true,
    };
    await this.#store.saveConfig({ chats: [...this.#store.config.chats, chat] });
    // 新增监听从当前时间开始，不回补历史。
    const state = { ...this.#store.state, chats: { ...this.#store.state.chats } };
    state.chats[chatId] = {
      ...(state.chats[chatId] ?? {}),
      cursorTimeMs: this.#now(),
      cursorMessageId: null,
      messages: [],
      seen: [],
      lastError: null,
      lastPollAt: null,
    };
    await this.#store.saveState(state);
    return this.status();
  }

  async removeChat(chatId) {
    const id = stringOf(chatId).trim();
    const chats = this.#store.config.chats.filter((chat) => chat.chatId !== id);
    await this.#store.saveConfig({ chats });
    const state = { ...this.#store.state, chats: { ...this.#store.state.chats } };
    delete state.chats[id];
    await this.#store.saveState(state);
    return this.status();
  }

  async setEnabled(enabled) {
    await this.#store.saveConfig({ enabled: enabled === true });
    if (enabled === true) void this.pollOnce();
    return this.status();
  }

  /** 标记某会话（或全部）消息已读。 */
  async markRead(chatId = '') {
    const id = stringOf(chatId).trim();
    const state = { ...this.#store.state, chats: { ...this.#store.state.chats } };
    for (const [key, entry] of Object.entries(state.chats)) {
      if (id && key !== id) continue;
      state.chats[key] = {
        ...entry,
        messages: (entry.messages ?? []).map((message) => ({ ...message, read: true })),
      };
    }
    await this.#store.saveState(state);
    return this.status();
  }

  /** 清空某会话（或全部）记录，但保留游标和去重集合。 */
  async clearMessages(chatId = '') {
    const id = stringOf(chatId).trim();
    const state = { ...this.#store.state, chats: { ...this.#store.state.chats } };
    for (const [key, entry] of Object.entries(state.chats)) {
      if (id && key !== id) continue;
      state.chats[key] = { ...entry, messages: [] };
    }
    await this.#store.saveState(state);
    return this.status();
  }

  /**
   * 收件箱：读取已记录的监听消息。
   * 默认只返回未读并标记已读，避免同一批消息反复交给模型。
   */
  async inbox({ chatId = '', limit = 20, unreadOnly = true, markRead = true } = {}) {
    const id = stringOf(chatId).trim();
    const size = Math.min(50, Math.max(1, Number.parseInt(String(limit ?? 20), 10) || 20));
    const items = [];
    for (const chat of this.#store.config.chats) {
      if (id && chat.chatId !== id) continue;
      const entry = this.#store.state.chats[chat.chatId] ?? {};
      for (const message of entry.messages ?? []) {
        if (unreadOnly && message.read) continue;
        items.push({
          chatId: chat.chatId,
          chatName: chat.name || chat.chatId,
          chatMode: chat.chatMode,
          messageId: message.messageId,
          senderName: message.senderName || '',
          senderOpenId: message.senderOpenId || '',
          createTime: message.createTime,
          read: message.read === true,
          text: message.text,
        });
      }
    }
    items.sort((a, b) => String(a.createTime).localeCompare(String(b.createTime)));
    const selected = items.slice(0, size);
    if (markRead !== false && selected.length > 0) {
      const ids = new Set(selected.map((item) => item.messageId));
      const state = { ...this.#store.state, chats: { ...this.#store.state.chats } };
      for (const [key, entry] of Object.entries(state.chats)) {
        if (!(entry.messages ?? []).some((message) => ids.has(message.messageId))) continue;
        state.chats[key] = {
          ...entry,
          messages: entry.messages.map((message) => (ids.has(message.messageId) ? { ...message, read: true } : message)),
        };
      }
      await this.#store.saveState(state);
    }
    return { total: items.length, items: selected };
  }

  /** 单轮轮询：串行处理会话，避免同一 token 并发打多个请求。 */
  async pollOnce() {
    if (this.#disposed || this.#polling || !this.#store.config.enabled) return;
    if (this.#store.config.chats.length === 0) return;
    this.#polling = true;
    try {
      let accessToken;
      try {
        accessToken = await this.#auth.requireAccessToken();
      } catch (error) {
        this.#logger?.warn?.('[im-feishu] 消息监听暂停：用户身份未授权', error?.message ?? error);
        return;
      }
      const auth = await this.#auth.status().catch(() => null);
      const selfOpenId = auth?.authorization?.user?.openId ?? '';
      for (const chat of this.#store.config.chats) {
        if (this.#disposed) break;
        await this.#pollChat(chat, accessToken, selfOpenId);
      }
    } finally {
      this.#polling = false;
    }
  }

  async #pollChat(chat, accessToken, selfOpenId) {
    const current = this.#store.state.chats[chat.chatId] ?? {};
    const messages = current.messages ?? [];
    if (!Number.isFinite(current.cursorTimeMs)) {
      await this.#store.saveState({
        ...this.#store.state,
        chats: {
          ...this.#store.state.chats,
          [chat.chatId]: {
            ...current,
            cursorTimeMs: this.#now(),
            cursorMessageId: null,
            messages,
            seen: current.seen ?? [],
            lastError: null,
          },
        },
      });
      return;
    }

    try {
      const result = await this.#listMessages({
        accessToken,
        chatId: chat.chatId,
        startTime: current.cursorTimeMs - 1_000,
        pageSize: 50,
        sort: 'asc',
      });
      const seen = new Set(current.seen ?? []);
      const eligible = [];
      for (const item of result.items) {
        if (!item.messageId || seen.has(item.messageId)) continue;
        if (item.deleted || item.senderType !== 'user' || item.msgType === 'system') continue;
        if (selfOpenId && item.senderOpenId === selfOpenId) continue;
        const time = messageTime(item);
        if (time === null || time < current.cursorTimeMs) continue;
        eligible.push({ item, time });
        if (eligible.length >= MAX_MESSAGES_PER_POLL) break;
      }

      let cursorTimeMs = current.cursorTimeMs;
      let cursorMessageId = current.cursorMessageId ?? null;
      let lastDeliveredAt = current.lastDeliveredAt ?? null;
      let nextMessages = messages;
      for (const { item, time } of eligible) {
        seen.add(item.messageId);
        cursorTimeMs = time;
        cursorMessageId = item.messageId;
        lastDeliveredAt = this.#now();
        nextMessages = [
          ...nextMessages,
          {
            messageId: item.messageId,
            senderName: item.senderName ?? '',
            senderOpenId: item.senderOpenId ?? '',
            createTime: item.createTime ?? new Date(time).toISOString(),
            text: item.text ?? `[${item.msgType || '消息'}]`,
            read: false,
          },
        ].slice(-MAX_MESSAGES_PER_CHAT);
        // 每条消息落盘后立即保存；失败时不会重复记录同一批。
        await this.#store.saveState({
          ...this.#store.state,
          chats: {
            ...this.#store.state.chats,
            [chat.chatId]: {
              ...current,
              cursorTimeMs,
              cursorMessageId,
              messages: nextMessages,
              seen: [...seen].slice(-MAX_SEEN_IDS),
              lastPollAt: this.#now(),
              lastDeliveredAt,
              lastError: null,
            },
          },
        });
      }

      if (eligible.length === 0) {
        await this.#store.saveState({
          ...this.#store.state,
          chats: {
            ...this.#store.state.chats,
            [chat.chatId]: {
              ...current,
              messages,
              seen: [...seen].slice(-MAX_SEEN_IDS),
              lastPollAt: this.#now(),
              lastError: null,
            },
          },
        });
      }
    } catch (error) {
      this.#logger?.warn?.('[im-feishu] 消息监听轮询失败', chat.chatId, error?.message ?? error);
      const latest = this.#store.state.chats[chat.chatId] ?? current;
      await this.#store.saveState({
        ...this.#store.state,
        chats: {
          ...this.#store.state.chats,
          [chat.chatId]: {
            ...latest,
            lastPollAt: this.#now(),
            lastError: error?.message ?? String(error),
          },
        },
      }).catch(() => undefined);
    }
  }
}

export { normalizeMonitorConfig, normalizeMonitorState };
