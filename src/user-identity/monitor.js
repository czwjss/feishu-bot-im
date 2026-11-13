/**
 * 飞书分身消息监听。
 *
 * 用户身份没有个人收件箱事件推送，因此监听器按会话轮询。
 * 新消息落到本地状态（`monitor-state.json`，0600、有上限），
 * 收到的消息会自动攒批交给 Worker 会话处理。
 * 回复由 Worker 调用 `feishu_avatar_send`（用户本人身份）发出，监听本身不写飞书。
 */
import { CARD_STUCK_MS } from '../message-text.js';
import { chatMemberNames, getMessage, listChats, listMessages } from './api.js';
import { AutoReplyEngine } from './auto-reply.js';
import { DEFAULT_REPLY_RULES, normalizeReplyRules } from './worker-context.js';
import {
  MAX_MONITOR_CHATS,
  MAX_PENDING_CARDS,
  MAX_SEEN_IDS,
  normalizeMonitorChat,
} from './monitor-store.js';

const MAX_PAGES_PER_POLL = 2;
/** 往回多看一段，才能抓到卡片原地刷新的新文本。 */
const REFRESH_LOOKBACK_MS = 120_000;
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
  #defaultWorkspaceId;
  #autoReply;
  #nameCache = new Map();
  #parentSender = new Map();

  constructor({
    auth,
    store,
    harness = null,
    sessionGuard = null,
    defaultWorkspaceId = null,
    autoReply = null,
    logger = null,
    listMessages: listMessagesImpl = listMessages,
    listChats: listChatsImpl = listChats,
    chatMemberNames: chatMemberNamesImpl = chatMemberNames,
    getMessage: getMessageImpl = getMessage,
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
    this.#defaultWorkspaceId = defaultWorkspaceId;
    this.#autoReply = autoReply
      ?? (harness
        ? new AutoReplyEngine({
          store,
          harness,
          sessionGuard,
          defaultWorkspaceId,
          logger,
          now,
          setTimeout: setTimeoutImpl,
          clearTimeout: clearTimeoutImpl,
        })
        : null);
    this.#now = now;
    this.#setInterval = setIntervalImpl;
    this.#clearInterval = clearIntervalImpl;
    this.#listMessages = listMessagesImpl;
    this.#listChats = listChatsImpl;
    this.#chatMemberNames = chatMemberNamesImpl;
    this.#getMessage = getMessageImpl;
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
    if (this.#store.config.enabled) {
      this.#autoReply?.resume?.();
      void this.pollOnce();
    }
  }

  stop() {
    this.#autoReply?.pause?.();
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

  /** 监听状态 + 每会话最近消息（受上限约束）。 */
  async status() {
    const auth = await this.#auth.status().catch(() => null);
    const config = this.#store.config;
    const state = this.#store.state;
    const chats = config.chats.map((chat) => {
      const entry = state.chats[chat.chatId] ?? {};
      return {
        ...chat,
        pendingBatch: entry.batch?.messageIds?.length ?? 0,
        lastPollAt: entry.lastPollAt ?? null,
        lastError: entry.lastError ?? null,
      };
    });
    return {
      enabled: config.enabled,
      pollIntervalMs: config.pollIntervalMs,
      worker: config.worker,
      replyRules: config.replyRules,
      defaultReplyRules: DEFAULT_REPLY_RULES,
      handoffKeywords: config.handoffKeywords,
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
    const chat = {
      chatId,
      name: stringOf(input.name).trim() || chatId,
      chatMode: input.chatMode === 'p2p' ? 'p2p' : 'group',
      external: input.external === true,
    };
    await this.#store.saveConfig((config) => {
      if (config.chats.some((item) => item.chatId === chatId)) throw new Error('这个会话已经在监听列表里');
      if (config.chats.length >= MAX_MONITOR_CHATS) throw new Error(`最多监听 ${MAX_MONITOR_CHATS} 个会话`);
      return { chats: [...config.chats, chat] };
    });
    // 新增监听从当前时间开始，不回补历史。
    await this.#store.updateChat(chatId, {
      cursorTimeMs: this.#now(),
      cursorMessageId: null,
      scan: null,
      messages: [],
      seen: [],
      lastError: null,
      lastPollAt: null,
    });
    return this.status();
  }

  async removeChat(chatId) {
    const id = stringOf(chatId).trim();
    this.#autoReply?.cancel?.(id);
    await this.#store.saveConfig((config) => ({ chats: config.chats.filter((chat) => chat.chatId !== id) }));
    await this.#store.saveState((state) => {
      const chats = { ...state.chats };
      delete chats[id];
      return { ...state, chats, pendingCards: state.pendingCards.filter((card) => card.chatId !== id) };
    });
    return this.status();
  }

  /** 设置 Worker 会话的工作区与预设；下次派发会按新配置重建会话。 */
  async setWorker(patch = {}) {
    await this.#store.saveConfig((config) => ({
      worker: {
        workspaceId: patch.workspaceId === undefined ? config.worker.workspaceId : patch.workspaceId,
        workspacePath: patch.workspacePath === undefined ? config.worker.workspacePath : patch.workspacePath,
        preset: patch.preset === undefined ? config.worker.preset : patch.preset,
      },
    }));
    return this.status();
  }

  /** 设置转人工关键词；空数组关闭关键词匹配。 */
  async setHandoffKeywords(keywords) {
    await this.#store.saveConfig({ handoffKeywords: keywords });
    return this.status();
  }

  async setReplyRules(rules) {
    if (typeof rules !== 'string') throw new TypeError('回复规则必须是文本');
    await this.#store.saveConfig({ replyRules: normalizeReplyRules(rules) });
    return this.status();
  }

  /** DSH 当前默认工作区 id；解析不到时返回 null。 */
  async resolveDefaultWorkspaceId() {
    try {
      return await (typeof this.#defaultWorkspaceId === 'function'
        ? this.#defaultWorkspaceId() : this.#defaultWorkspaceId) ?? null;
    } catch {
      return null;
    }
  }

  /** 手动触发：把各会话积压的待处理批次立刻交给 Worker。 */
  async flushPending() {
    let dispatched = 0;
    for (const chat of this.#store.config.chats) {
      if (!this.#autoReply) continue;
      const entry = this.#store.state.chats[chat.chatId] ?? {};
      if ((entry.batch?.messageIds ?? []).length === 0) continue;
      const token = await this.#autoReply.flush(chat).catch(() => null);
      if (token) dispatched += 1;
    }
    return { dispatched, ...(await this.status()) };
  }

  async setEnabled(enabled) {
    if (enabled !== true) this.#autoReply?.pause?.();
    try {
      await this.#store.saveConfig({ enabled: enabled === true });
    } finally {
      if (this.#store.config.enabled) this.#autoReply?.resume?.();
    }
    if (this.#store.config.enabled) void this.pollOnce();
    return this.status();
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
        if (this.#disposed || !this.#store.config.enabled) break;
        if (!this.#store.config.chats.some((item) => item.chatId === chat.chatId)) continue;
        await this.#pollChat(chat, accessToken, selfOpenId);
      }
    } finally {
      this.#polling = false;
    }
  }

  /** 更新单个会话的触发规则。 */
  async setChat(chatId, patch = {}) {
    const id = stringOf(chatId).trim();
    await this.#store.saveConfig((config) => {
      if (!config.chats.some((chat) => chat.chatId === id)) throw new Error('这个会话不在监听列表里');
      const chats = config.chats.map((chat) => {
        if (chat.chatId !== id) return chat;
        return normalizeMonitorChat({
          ...chat,
          mode: patch.mode === undefined ? chat.mode : patch.mode,
          keywords: patch.keywords === undefined ? chat.keywords : patch.keywords,
          replyToBots: patch.replyToBots === undefined ? chat.replyToBots : patch.replyToBots,
        });
      });
      return { chats };
    });
    return this.status();
  }

  /** 把流式卡片挂到待收尾列表（不进入消息列表）。 */
  async #trackPendingCard(chatId, item, time, context) {
    await this.#store.saveState((state) => {
      if (!this.#store.config.chats.some((chat) => chat.chatId === chatId)) return state;
      const pending = state.pendingCards.filter((card) => card.messageId !== item.messageId);
      if (pending.length >= MAX_PENDING_CARDS) throw new Error('等待收尾的卡片已满，将在下轮继续读取');
      return { ...state, pendingCards: [
        ...pending,
        { messageId: item.messageId, chatId, createTime: item.createTime ?? new Date(time).toISOString(), lastText: item.text ?? '', ...context },
      ] };
    });
  }

  /** 检查待收尾卡片：收尾了就补进消息列表，超时就彻底丢掉。 */
  async #settlePendingCards(chat, accessToken, selfOpenId) {
    const pending = this.#store.state.pendingCards ?? [];
    if (pending.length === 0) return 0;
    let changed = false;
    const kept = [];
    const revived = [];
    for (const card of pending) {
      if (card.chatId !== chat.chatId) {
        kept.push(card);
        continue;
      }
      // 平台会在 10 分钟后自动关闭流式模式；超过仍没收尾就当作异常中断。
      const age = this.#now() - (Date.parse(card.createTime) || this.#now());
      if (age > CARD_STUCK_MS) {
        this.#logger?.warn?.(`[im-feishu] 卡片超过 10 分钟未收尾，丢弃 ${card.messageId}`);
        changed = true;
        continue;
      }
      const message = await this.#getMessage({ accessToken, messageId: card.messageId }).catch(() => null);
      if (message && message.streaming !== true) {
        revived.push({ card, message });
        changed = true;
        continue;
      }
      const text = message?.text ?? card.lastText;
      const next = text !== card.lastText ? { ...card, lastText: text } : card;
      if (next !== card) changed = true;
      kept.push(next);
    }
    // Keep pending cards retryable if persisting their settled bodies fails.
    if (revived.length > 0 && await this.#reviveCards(chat, revived, accessToken, selfOpenId) === false) return 0;
    if (changed) await this.#store.saveState((state) => ({
      ...state,
      pendingCards: kept.filter((card) => this.#store.config.chats.some((item) => item.chatId === card.chatId)),
    }));
    return revived.length;
  }

  /** 收尾的卡片补进消息列表，并按需交给自动回复。 */
  async #reviveCards(chat, revived, accessToken, selfOpenId) {
    chat = this.#store.config.chats.find((item) => item.chatId === chat.chatId);
    if (!chat) return false;
    const entry = this.#store.state.chats[chat.chatId] ?? {};
    const messages = [...(entry.messages ?? [])];
    const fresh = [];
    const names = await this.#namesFor(chat.chatId, accessToken);
    for (const { card, message } of revived) {
      if (message.deleted || message.msgType === 'system') continue;
      if (messages.some((item) => item.messageId === card.messageId)) continue;
      const isSelf = card.isSelf || Boolean(selfOpenId && message.senderOpenId === selfOpenId);
      const contextOnly = isSelf || !(await this.#accepts(chat, message, accessToken, selfOpenId));
      messages.push({
        messageId: card.messageId,
        senderName: message.senderName || names.get(message.senderOpenId) || (message.senderType === 'app' ? '机器人' : ''),
        senderOpenId: message.senderOpenId ?? '',
        senderType: message.senderType ?? '',
        isSelf,
        contextOnly,
        createTime: message.createTime || card.createTime,
        text: this.#renderAt(message.text ?? card.lastText, names),
      });
      if (!contextOnly) fresh.push(card.messageId);
    }
    if (fresh.length > 0 && this.#autoReply) {
      return this.#autoReply.enqueue(chat, fresh, { messages });
    } else {
      await this.#patchChat(chat.chatId, { messages });
      return true;
    }
  }

  /** 只更新某个会话的状态字段。 */
  async #patchChat(chatId, patch) {
    await this.#store.updateChat(chatId, patch);
  }

  /** 父消息发送者（用于判断“回复我”），带缓存。 */
  async #parentSenderOf(messageId, accessToken) {
    if (!messageId) return null;
    const cached = this.#parentSender.get(messageId);
    if (cached !== undefined) return cached;
    const parent = await this.#getMessage({ accessToken, messageId }).catch((error) => {
      if (error?.status === 404) return null;
      throw error; // 查询失败不能当成“不是回复我”，保留游标供下轮重试。
    });
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
    if (mode === 'keyword') {
      const text = stringOf(item.text).toLowerCase();
      if ((chat.keywords ?? []).some((keyword) => text.includes(keyword.toLowerCase()))) return true;
    }
    if (item.parentId && selfOpenId) {
      const parentSender = await this.#parentSenderOf(item.parentId, accessToken);
      if (parentSender && parentSender === selfOpenId) return true;
    }
    return false;
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
    try {
      await this.#settlePendingCards(chat, accessToken, selfOpenId);
      const current = this.#store.state.chats[chat.chatId] ?? {};
      const messages = current.messages ?? [];
      if (!Number.isFinite(current.cursorTimeMs)) {
        await this.#patchChat(chat.chatId, {
          cursorTimeMs: this.#now(),
          cursorMessageId: null,
          messages,
          seen: current.seen ?? [],
          lastError: null,
        });
        return;
      }

      const scan = current.scan ?? {
        startTimeMs: Math.min(current.cursorTimeMs - 1_000, this.#now() - REFRESH_LOOKBACK_MS),
        endTimeMs: this.#now(),
        pageToken: null,
      };
      let pageToken = scan.pageToken;
      const items = [];
      for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
        const result = await this.#listMessages({
          accessToken, chatId: chat.chatId, startTime: scan.startTimeMs, endTime: scan.endTimeMs,
          pageSize: 50, sort: 'asc', pageToken,
        });
        items.push(...result.items);
        if (!result.hasMore) { pageToken = null; break; }
        if (!result.pageToken || result.pageToken === pageToken) throw new Error('飞书消息分页游标未推进');
        pageToken = result.pageToken;
      }
      const seen = new Set(current.seen ?? []);
      const eligible = [];
      let cursorTimeMs = current.cursorTimeMs;
      let cursorMessageId = current.cursorMessageId ?? null;
      const storedById = new Map(messages.map((message) => [message.messageId, message]));
      // 成员姓名表每轮只取一次，供刷新比对和渲染共用。
      let names = null;
      const namesOf = async () => {
        names ??= await this.#namesFor(chat.chatId, accessToken);
        return names;
      };
      for (const item of items) {
        if (!item.messageId) continue;
        const time = messageTime(item);
        if (time === null) continue;
        if (time >= cursorTimeMs) {
          cursorTimeMs = time;
          cursorMessageId = item.messageId;
        }
        // 卡片在原地刷新：同一个 message_id 出现新文本时更新旧记录，不新增记录。
        const existing = storedById.get(item.messageId);
        if (existing) {
          if (item.streaming === true) continue; // A stale list projection must not overwrite a settled card.
          const nextText = this.#renderAt(item.text ?? `[${item.msgType || '消息'}]`, await namesOf());
          if (nextText && nextText !== existing.text) {
            eligible.push({ item, time, updateOf: item.messageId, nextText });
          }
          continue;
        }
        if (seen.has(item.messageId)) continue;
        // 机器人/应用消息同样记录：群里常是通知，私聊里是对方机器人回复。
        if (item.deleted || item.msgType === 'system') continue;
        if (time < current.cursorTimeMs) continue;
        const isSelf = Boolean(selfOpenId) && item.senderOpenId === selfOpenId;
        const contextOnly = isSelf || !(await this.#accepts(chat, item, accessToken, selfOpenId));
        // 流式卡片：先不进入消息列表，等收尾后再补进来。
        if (item.msgType === 'interactive' && item.streaming === true) {
          await this.#trackPendingCard(chat.chatId, item, time, { isSelf, contextOnly });
          seen.add(item.messageId);
          continue;
        }
        eligible.push({ item, time, isSelf, contextOnly });
      }

      const roster = names ?? (eligible.some(({ item }) => !item.senderName) ? await namesOf() : new Map());

      let nextMessages = messages;
      for (const { item, time, updateOf, nextText, isSelf, contextOnly } of eligible) {
        seen.add(item.messageId);
        if (updateOf) {
          nextMessages = nextMessages.map((message) => (
            message.messageId === updateOf ? { ...message, text: nextText } : message
          ));
        } else {
          const entry = {
            messageId: item.messageId,
            senderName: item.senderName || roster.get(item.senderOpenId)
              || (item.senderType === 'app' ? '机器人' : ''),
            senderOpenId: item.senderOpenId ?? '',
            senderType: item.senderType ?? '',
            isSelf,
            contextOnly,
            createTime: item.createTime ?? new Date(time).toISOString(),
            text: this.#renderAt(item.text ?? `[${item.msgType || '消息'}]`, roster),
          };
          nextMessages = [...nextMessages, entry];
        }
      }

      const patch = {
        cursorTimeMs,
        cursorMessageId,
        scan: pageToken ? { ...scan, pageToken } : null,
        messages: nextMessages,
        seen: [...seen].slice(-MAX_SEEN_IDS),
        lastPollAt: this.#now(),
        lastError: null,
      };
      if (this.#autoReply) {
        const freshIds = eligible.filter(({ updateOf, contextOnly }) => !updateOf && !contextOnly)
          .map(({ item }) => item.messageId);
        await this.#autoReply.enqueue(chat, freshIds, patch);
      } else {
        await this.#patchChat(chat.chatId, patch);
      }
    } catch (error) {
      this.#logger?.warn?.('[im-feishu] 消息监听轮询失败', chat.chatId, error?.message ?? error);
      await this.#patchChat(chat.chatId, {
        lastPollAt: this.#now(),
        lastError: error?.message ?? String(error),
      }).catch(() => undefined);
    }
  }
}
