/**
 * 飞书分身消息监听（阶段 1：只记录，不调模型、不自动回复）。
 *
 * 用户身份没有个人收件箱事件推送，因此监听器按会话轮询。
 * 新消息只落到本地收件箱（`monitor-state.json`，0600、有上限），
 * 由 `feishu_avatar_inbox` 工具交给 Agent，或直接回复。
 * 回复仍走 `feishu_avatar_send`（用户本人身份），监听本身不写飞书。
 */
import { chatMemberNames, getMessage, listChats, listMessages, replyCardMessage, sendCardMessage } from './api.js';
import { AutoReplyEngine } from './auto-reply.js';
import {
  DRAFT_TTL_MS,
  MAX_DRAFTS,
  MAX_MONITOR_CHATS,
  MAX_MESSAGES_PER_CHAT,
  MAX_SEEN_IDS,
  normalizeKeywords,
  normalizeMonitorChat,
  normalizeMonitorConfig,
  normalizeMonitorState,
} from './monitor-store.js';

const MAX_MESSAGES_PER_POLL = 100;
/** 往回多看一段，才能抓到卡片原地刷新的新文本。 */
const REFRESH_LOOKBACK_MS = 120_000;
/** 临时状态超过这个时间还留着就是噪音。 */
const STALE_TRANSIENT_MS = 120_000;
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
  #chatMemberNames;
  #getMessage;
  #sendCard;
  #replyCard;
  #autoReply;
  #nameCache = new Map();
  #parentSender = new Map();

  constructor({
    auth,
    store,
    harness = null,
    autoReply = null,
    logger = null,
    listMessages: listMessagesImpl = listMessages,
    listChats: listChatsImpl = listChats,
    chatMemberNames: chatMemberNamesImpl = chatMemberNames,
    getMessage: getMessageImpl = getMessage,
    sendCard: sendCardImpl = sendCardMessage,
    replyCard: replyCardImpl = replyCardMessage,
    now = Date.now,
    setInterval: setIntervalImpl = setInterval,
    clearInterval: clearIntervalImpl = clearInterval,
    setTimeout: setTimeoutImpl = setTimeout,
    clearTimeout: clearTimeoutImpl = clearTimeout,
  }) {
    if (!auth) throw new TypeError('UserMonitorManager 需要 auth');
    if (!store) throw new TypeError('UserMonitorManager 需要 store');
    this.#auth = auth;
    this.#store = store;
    this.#logger = logger;
    this.#autoReply = autoReply
      ?? (harness
        ? new AutoReplyEngine({
          store,
          harness,
          auth,
          sendCard: sendCardImpl,
          replyCard: replyCardImpl,
          logger,
          now,
          setTimeout: setTimeoutImpl,
          clearTimeout: clearTimeoutImpl,
        })
        : null);
    this.#autoReply?.setSelfOpenId?.('');
    this.#now = now;
    this.#setInterval = setIntervalImpl;
    this.#clearInterval = clearIntervalImpl;
    this.#listMessages = listMessagesImpl;
    this.#listChats = listChatsImpl;
    this.#chatMemberNames = chatMemberNamesImpl;
    this.#getMessage = getMessageImpl;
    this.#sendCard = sendCardImpl;
    this.#replyCard = replyCardImpl;
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
    this.#autoReply?.dispose?.();
  }

  /** 自动回复引擎（未提供 harness 时为 null）。 */
  get autoReply() {
    return this.#autoReply;
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
        sessionId: entry.sessionId ?? null,
        pendingBatch: entry.batch?.messageIds?.length ?? 0,
        lastAutoReplyAt: (entry.outbox ?? []).filter((item) => item.source === 'auto').at(-1)?.at ?? null,
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
      drafts: this.#effectiveDrafts(),
    };
  }

  /** 按 TTL 计算草稿的有效状态（不落盘，供 status/summary 共用）。 */
  #effectiveDrafts() {
    const now = this.#now();
    return (this.#store.state.drafts ?? []).map((draft) => (
      draft.status === 'pending' && now - draft.createdAt > DRAFT_TTL_MS
        ? { ...draft, status: 'expired' }
        : draft
    ));
  }

  /** 待确认草稿（含最近已处理），过期标 expired 并落盘一次。 */
  async drafts() {
    const drafts = this.#effectiveDrafts();
    const changed = drafts.some((draft, index) => draft.status !== (this.#store.state.drafts?.[index]?.status));
    if (changed) await this.#store.saveState({ ...this.#store.state, drafts });
    return { drafts };
  }

  /**
   * 创建待确认草稿。不会发送任何消息；发送必须显式调用 sendDraft。
   */
  async createDraft({ chatId, messageId, text, title } = {}) {
    const id = stringOf(chatId).trim();
    const chat = this.#store.config.chats.find((item) => item.chatId === id);
    if (!chat) throw new Error('这个会话不在监听列表里，无法创建草稿');
    const body = stringOf(text).trim();
    if (!body) throw new Error('草稿正文不能为空');
    const draft = {
      draftId: `draft-${this.#now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      chatId: id,
      chatName: chat.name || id,
      replyToMessageId: stringOf(messageId).trim() || null,
      text: body,
      title: stringOf(title).trim(),
      status: 'pending',
      createdAt: this.#now(),
      sentMessageId: null,
      error: null,
    };
    const pending = (this.#store.state.drafts ?? []).filter((item) => item.status === 'pending');
    await this.#store.saveState({
      ...this.#store.state,
      drafts: [...pending, draft].slice(-MAX_DRAFTS),
    });
    return draft;
  }

  /** 用户确认后以本人身份发送草稿。 */
  async sendDraft(draftId) {
    const id = stringOf(draftId).trim();
    const drafts = [...(this.#store.state.drafts ?? [])];
    const index = drafts.findIndex((draft) => draft.draftId === id);
    if (index < 0) throw new Error('草稿不存在或已处理');
    const draft = drafts[index];
    if (draft.status !== 'pending') throw new Error(`草稿状态是 ${draft.status}，不能发送`);
    if (this.#now() - draft.createdAt > DRAFT_TTL_MS) throw new Error('草稿已过期，请重新生成');

    const accessToken = await this.#auth.requireAccessToken();
    let sent;
    try {
      if (draft.replyToMessageId) {
        sent = await this.#replyCard({
          accessToken,
          messageId: draft.replyToMessageId,
          text: draft.text,
          title: draft.title || undefined,
        });
      } else {
        sent = await this.#sendCard({
          accessToken,
          chatId: draft.chatId,
          text: draft.text,
          title: draft.title || undefined,
        });
      }
    } catch (error) {
      drafts[index] = { ...draft, error: error?.message ?? String(error) };
      await this.#store.saveState({ ...this.#store.state, drafts });
      throw error;
    }
    drafts[index] = { ...draft, status: 'sent', sentMessageId: sent.messageId ?? null, error: null };
    await this.#store.saveState({ ...this.#store.state, drafts });
    return drafts[index];
  }

  /** 忽略草稿，不发送。 */
  async ignoreDraft(draftId) {
    const id = stringOf(draftId).trim();
    const drafts = [...(this.#store.state.drafts ?? [])];
    const index = drafts.findIndex((draft) => draft.draftId === id);
    if (index < 0) throw new Error('草稿不存在或已处理');
    drafts[index] = { ...drafts[index], status: 'ignored' };
    await this.#store.saveState({ ...this.#store.state, drafts });
    return drafts[index];
  }

  /**
   * 注入用的未读摘要；没有未读时返回空串。
   * 只给计数和会话名，不把正文塞进 system prompt。
   */
  summary() {
    const unread = [];
    for (const chat of this.#store.config.chats) {
      const entry = this.#store.state.chats[chat.chatId] ?? {};
      const count = (entry.messages ?? []).filter((message) => !message.read).length;
      if (count > 0) unread.push({ name: chat.name || chat.chatId, count });
    }
    if (unread.length === 0) return '';
    const total = unread.reduce((sum, item) => sum + item.count, 0);
    const detail = unread.slice(0, 5)
      .map((item) => `${item.name} ${item.count} 条`)
      .join('、');
    const pending = this.#effectiveDrafts().filter((draft) => draft.status === 'pending').length;
    const draftNote = pending > 0 ? `另有 ${pending} 条待确认草稿。` : '';
    return `飞书分身收件箱有 ${total} 条未读：${detail}。${draftNote}`
      + '用 feishu_avatar_inbox 查看；回复草稿用 feishu_avatar_draft 提交，等用户确认后再发。';
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
      this.#autoReply?.setSelfOpenId?.(selfOpenId);
      for (const chat of this.#store.config.chats) {
        if (this.#disposed) break;
        await this.#pollChat(chat, accessToken, selfOpenId);
      }
    } finally {
      this.#polling = false;
    }
  }

  /** 更新单个会话的触发规则。 */
  async setChat(chatId, patch = {}) {
    const id = stringOf(chatId).trim();
    if (!this.#store.config.chats.some((chat) => chat.chatId === id)) {
      throw new Error('这个会话不在监听列表里');
    }
    const chats = this.#store.config.chats.map((chat) => {
      if (chat.chatId !== id) return chat;
      return normalizeMonitorChat({
        ...chat,
        mode: patch.mode === undefined ? chat.mode : patch.mode,
        keywords: patch.keywords === undefined ? chat.keywords : patch.keywords,
        replyMode: patch.replyMode === undefined ? chat.replyMode : patch.replyMode,
        replyToBots: patch.replyToBots === undefined ? chat.replyToBots : patch.replyToBots,
        preset: patch.preset === undefined ? chat.preset : patch.preset,
      });
    });
    await this.#store.saveConfig({ chats });
    return this.status();
  }

  /** 父消息发送者（用于判断“回复我”），带缓存。 */
  async #parentSenderOf(messageId, accessToken) {
    if (!messageId) return null;
    const cached = this.#parentSender.get(messageId);
    if (cached !== undefined) return cached;
    const parent = await this.#getMessage({ accessToken, messageId }).catch(() => null);
    const sender = parent?.senderOpenId ?? null;
    if (this.#parentSender.size > 500) this.#parentSender.clear();
    this.#parentSender.set(messageId, sender);
    return sender;
  }

  /**
   * 触发判断。
   * all：全部；mention：@我 或 回复我；keyword：命中关键词、@我 或 回复我。
   */
  async #accepts(chat, item, accessToken, selfOpenId) {
    const mode = chat.mode ?? (chat.chatMode === 'p2p' ? 'all' : 'mention');
    if (mode === 'all') return true;
    const mentioned = Boolean(selfOpenId)
      && (item.mentions ?? []).some((mention) => mention.openId === selfOpenId);
    if (mentioned) return true;
    if (item.parentId && selfOpenId) {
      const parentSender = await this.#parentSenderOf(item.parentId, accessToken);
      if (parentSender && parentSender === selfOpenId) return true;
    }
    if (mode === 'keyword') {
      const keywords = chat.keywords ?? [];
      const text = stringOf(item.text).toLowerCase();
      return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    }
    return false;
  }

  /**
   * 机器人临时状态文案（“已收到 / 正在处理”）：同一轮回答里会被最终消息取代，
   * 记录后一旦出现同一发送者的新消息就丢掉，避免一次回答占两三条未读。
   */
  #isTransientStatus(text) {
    const value = stringOf(text);
    if (!value || value.length > 40) return false;
    return /^(⏳|🕐|⏱)?\s*(已收到|正在处理|处理中|正在思考|思考中)/.test(value)
      || /正在处理[.…]*$/.test(value);
  }

  /** 超过两分钟还留着的“已收到/正在处理”已经没有意义。 */
  #isStaleTransient(message) {
    if (!this.#isTransientStatus(message?.text)) return false;
    const created = Date.parse(stringOf(message.createTime));
    return Number.isFinite(created) && this.#now() - created > STALE_TRANSIENT_MS;
  }

  /** 把 <at id=ou_x></at> 换成可读的 @姓名，读不到名字时保留 open_id。 */
  #renderAt(text, names) {
    return stringOf(text).replace(/<at\s+id=([A-Za-z0-9_-]+)\s*><\/at>/g, (match, openId) => {
      if (openId === 'all') return '@所有人';
      const name = names.get(openId);
      return name ? `@${name}` : `@${openId}`;
    });
  }

  /** 会话成员姓名表，每会话只取一次。 */
  async #namesFor(chatId, accessToken) {
    if (this.#nameCache.has(chatId)) return this.#nameCache.get(chatId);
    const names = await this.#chatMemberNames({ accessToken, chatId }).catch(() => new Map());
    this.#nameCache.set(chatId, names);
    return names;
  }

  async #pollChat(chat, accessToken, selfOpenId) {
    const current = this.#store.state.chats[chat.chatId] ?? {};
    // 每轮顺手丢掉过期的临时状态，避免历史残留一直占未读。
    const messages = (current.messages ?? []).filter((message) => !this.#isStaleTransient(message));
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
        startTime: Math.min(current.cursorTimeMs - 1_000, this.#now() - REFRESH_LOOKBACK_MS),
        pageSize: 50,
        sort: 'asc',
      });
      const seen = new Set(current.seen ?? []);
      const eligible = [];
      const skipped = [];
      const storedById = new Map(messages.map((message) => [message.messageId, message]));
      // 成员姓名表每轮只取一次，供刷新比对和渲染共用。
      let names = null;
      const namesOf = async () => {
        names ??= await this.#namesFor(chat.chatId, accessToken);
        return names;
      };
      for (const item of result.items) {
        if (!item.messageId) continue;
        const time = messageTime(item);
        if (time === null) continue;
        // 卡片在原地刷新：同一个 message_id 出现新文本时更新旧记录，不新增未读。
        const existing = storedById.get(item.messageId);
        if (existing) {
          const nextText = this.#renderAt(item.text ?? `[${item.msgType || '消息'}]`, await namesOf());
          if (nextText && nextText !== existing.text) {
            eligible.push({ item, time, updateOf: item.messageId, nextText });
          }
          continue;
        }
        if (seen.has(item.messageId)) continue;
        // 机器人/应用消息同样记录：群里常是通知，私聊里是对方机器人回复。
        if (item.deleted || item.msgType === 'system') continue;
        if (selfOpenId && item.senderOpenId === selfOpenId) continue;
        if (time < current.cursorTimeMs) continue;
        if (!(await this.#accepts(chat, item, accessToken, selfOpenId))) {
          // 不记录，但游标照常推进，避免重复判断同一条消息。
          seen.add(item.messageId);
          skipped.push({ item, time });
          continue;
        }
        eligible.push({ item, time });
        if (eligible.length >= MAX_MESSAGES_PER_POLL) break;
      }

      const roster = names ?? (eligible.some(({ item }) => !item.senderName) ? await namesOf() : new Map());

      let cursorTimeMs = current.cursorTimeMs;
      let cursorMessageId = current.cursorMessageId ?? null;
      let lastDeliveredAt = current.lastDeliveredAt ?? null;
      let nextMessages = messages;
      for (const { item, time, updateOf, nextText } of eligible) {
        seen.add(item.messageId);
        cursorTimeMs = time;
        cursorMessageId = item.messageId;
        lastDeliveredAt = this.#now();
        if (updateOf) {
          nextMessages = nextMessages.map((message) => (
            message.messageId === updateOf ? { ...message, text: nextText, read: false } : message
          ));
        } else {
          const entry = {
            messageId: item.messageId,
            senderName: item.senderName || roster.get(item.senderOpenId)
              || (item.senderType === 'app' ? '机器人' : ''),
            senderOpenId: item.senderOpenId ?? '',
            senderType: item.senderType ?? '',
            createTime: item.createTime ?? new Date(time).toISOString(),
            text: this.#renderAt(item.text ?? `[${item.msgType || '消息'}]`, roster),
            read: false,
          };
          // 同一发送者的上一条临时状态被这条取代，直接丢掉，避免重复未读。
          if (item.senderType && item.senderType !== 'user') {
            const last = nextMessages[nextMessages.length - 1];
            if (last && last.senderOpenId === entry.senderOpenId && this.#isTransientStatus(last.text)) {
              nextMessages = nextMessages.slice(0, -1);
            }
          }
          nextMessages = [...nextMessages, entry].slice(-MAX_MESSAGES_PER_CHAT);
        }
      }

      // 被过滤的消息也要推进游标，否则每轮都会重新判断同一条。
      const lastSkipped = skipped.length > 0 ? skipped[skipped.length - 1] : null;
      if (lastSkipped && lastSkipped.time > cursorTimeMs) {
        cursorTimeMs = lastSkipped.time;
        cursorMessageId = lastSkipped.item.messageId;
      }

      if (eligible.length > 0 && chat.replyMode === 'auto' && this.#autoReply) {
        const freshIds = eligible.filter(({ updateOf }) => !updateOf).map(({ item }) => item.messageId);
        if (freshIds.length > 0) await this.#autoReply.enqueue(chat, freshIds).catch(() => undefined);
      }

      // 统一收尾：即使本轮只记录了部分消息，也要把游标推到最新的已处理消息。
      // 批次与出站记录可能已被自动回复引擎写过，收尾时以最新值为准。
      const latest = this.#store.state.chats[chat.chatId] ?? {};
      await this.#store.saveState({
        ...this.#store.state,
        chats: {
          ...this.#store.state.chats,
          [chat.chatId]: {
            ...current,
            ...latest,
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
