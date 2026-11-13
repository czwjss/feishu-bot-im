/**
 * 分身自动回复：批次聚合 + 派发给 Worker 会话。
 *
 * 链路：
 *   监听轮询记录到新消息 → 按会话攒批（防抖 30s / 最多 10 条 / 最长 3 分钟）
 *   → 派给该会话专属的 DSH Worker 会话
 *   → 派发成功后只移除本次派发的消息，余下消息继续排队
 *   → Worker 自己判断要不要回，需要回就用 feishu_avatar_send 以本人身份发
 *
 * 这里不再校验 Worker 的回复：没有批次令牌，也没有决策工具。
 * 派发失败时保留批次，下一轮或手动「处理待办」会重试。
 */
import {
  BATCH_DEBOUNCE_MS,
  BATCH_MAX_MESSAGES,
  BATCH_MAX_WAIT_MS,
  DEFAULT_WORKER_PRESET,
  MAX_MESSAGES_PER_CHAT,
} from './monitor-store.js';
import { handoffRequestedIn } from '../handoff.js';
import { createHash } from 'node:crypto';

function acceptsSender(chat, message) {
  return chat.replyToBots === true || message?.senderType !== 'app';
}

function triggersReply(chat, message) {
  return !message?.isSelf && !message?.contextOnly && acceptsSender(chat, message);
}

/** 每个任务只携带本批消息与背景快照；会话信息和回复规则由动态上下文提供。 */
export function renderBatchPrompt({ messages, contextMessages = [] }) {
  const renderMessage = (message, index) => {
    const who = message.isSelf ? '本人' : message.senderName || message.senderOpenId || '未知';
    const stamp = formatPromptTime(message.createTime);
    const body = String(message.text ?? '').trim().split('\n')
      .map((line) => `   ${line}`)
      .join('\n');
    // 每条消息都保留 ID，便于区分上下文、待处理消息和按需回查。
    const id = message.messageId ? `（${message.messageId}）` : '';
    return `${index + 1}. ${who}${stamp ? ` · ${stamp}` : ''}${id}\n${body}`;
  };
  return [
    '[飞书分身消息批次]',
    ...(contextMessages.length ? [
      '',
      '最近会话上下文（仅供理解，不作为本批待回复消息）：',
      ...contextMessages.map(renderMessage),
    ] : []),
    '',
    '新消息（按时间顺序）：',
    ...messages.map(renderMessage),
  ].join('\n');
}

function formatPromptTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return sameDay ? clock : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`;
}

export class AutoReplyEngine {
  #store;
  #harness;
  #logger;
  #now;
  #setTimeout;
  #clearTimeout;
  #sessionGuard;
  #defaultWorkspaceId;
  #debounceMs;
  #maxWaitMs;
  #timers = new Map();
  #flights = new Map();
  #controllers = new Map();
  #paused = false;
  #disposed = false;

  constructor({
    store,
    harness,
    logger = null,
    now = Date.now,
    setTimeout: setTimeoutImpl = setTimeout,
    clearTimeout: clearTimeoutImpl = clearTimeout,
    sessionGuard = null,
    defaultWorkspaceId = null,
    debounceMs = BATCH_DEBOUNCE_MS,
    maxWaitMs = BATCH_MAX_WAIT_MS,
  } = {}) {
    if (!store) throw new TypeError('AutoReplyEngine 需要 store');
    if (!harness) throw new TypeError('AutoReplyEngine 需要 harness');
    this.#store = store;
    this.#harness = harness;
    this.#logger = logger;
    this.#now = now;
    this.#setTimeout = setTimeoutImpl;
    this.#clearTimeout = clearTimeoutImpl;
    this.#sessionGuard = sessionGuard;
    this.#defaultWorkspaceId = defaultWorkspaceId;
    this.#debounceMs = debounceMs;
    this.#maxWaitMs = maxWaitMs;
  }

  dispose() {
    this.#disposed = true;
    this.pause();
  }

  cancel(chatId) {
    const timer = this.#timers.get(chatId);
    if (timer !== undefined) this.#clearTimeout?.(timer);
    this.#timers.delete(chatId);
    this.#controllers.get(chatId)?.abort();
  }

  pause() {
    this.#paused = true;
    for (const chatId of new Set([...this.#timers.keys(), ...this.#controllers.keys()])) this.cancel(chatId);
  }

  resume() {
    this.#paused = false;
    for (const chat of this.#store.config.chats) this.#schedule(chat.chatId);
  }

  #activeChat(chatId, signal) {
    if (this.#disposed || this.#paused || signal?.aborted || !this.#store.config.enabled) return null;
    return this.#store.config.chats.find((chat) => chat.chatId === chatId) ?? null;
  }

  /** Persist message bodies, cursor and pending IDs together before scheduling. */
  async enqueue(chat, messageIds, patch = {}) {
    const activeChat = this.#activeChat(chat.chatId);
    if (!activeChat) return false;
    let hasNewMessages = false;
    await this.#store.updateChat(chat.chatId, (entry) => {
      const previous = entry.batch ?? {};
      const messages = new Map((patch.messages ?? entry.messages ?? [])
        .map((message) => [message.messageId, message]));
      const accepts = (id) => triggersReply(activeChat, messages.get(id));
      const ids = (messageIds ?? []).filter(Boolean).filter(accepts);
      const pending = [...new Set([...(previous.messageIds ?? []), ...ids])].filter(accepts);
      hasNewMessages = ids.length > 0;
      return {
        ...patch,
        batch: {
          messageIds: pending,
          firstAt: pending.length ? previous.firstAt ?? this.#now() : null,
          lastAt: pending.length ? (hasNewMessages ? this.#now() : previous.lastAt) : null,
        },
      };
    });
    if (hasNewMessages || !this.#timers.has(chat.chatId)) this.#schedule(chat.chatId);
    return true;
  }

  #schedule(chatId, retry = false) {
    if (!this.#activeChat(chatId) || this.#flights.has(chatId)) return;
    const existing = this.#timers.get(chatId);
    if (existing !== undefined) this.#clearTimeout?.(existing);
    this.#timers.delete(chatId);
    const batch = this.#store.state.chats[chatId]?.batch ?? {};
    if (!batch.messageIds?.length) return;
    const now = this.#now();
    const firstAt = batch.firstAt ?? now;
    const remaining = Math.max(0, firstAt + this.#maxWaitMs - now);
    const wait = retry ? this.#debounceMs
      : batch.messageIds.length >= BATCH_MAX_MESSAGES ? 0 : Math.min(this.#debounceMs, remaining);
    const timer = this.#setTimeout(() => {
      this.#timers.delete(chatId);
      void this.flush({ chatId });
    }, wait);
    timer?.unref?.();
    this.#timers.set(chatId, timer);
  }

  /** Concurrent manual/timer flushes share one dispatch for each chat. */
  flush({ chatId }) {
    if (this.#flights.has(chatId)) return this.#flights.get(chatId);
    if (!this.#activeChat(chatId)) return Promise.resolve(null);
    this.cancel(chatId);
    const controller = new AbortController();
    this.#controllers.set(chatId, controller);
    let retry = false;
    const task = this.#flush(chatId, controller.signal).catch((error) => {
      retry = true;
      if (!controller.signal.aborted) this.#logger?.warn?.('[im-feishu] 自动回复派发失败', chatId, error?.message ?? error);
      return null;
    }).finally(() => {
      this.#flights.delete(chatId);
      this.#controllers.delete(chatId);
      this.#schedule(chatId, retry);
    });
    this.#flights.set(chatId, task);
    return task;
  }

  async #flush(chatId, signal) {
    const chat = this.#activeChat(chatId, signal);
    if (!chat) return null;
    const entry = this.#store.state.chats[chat.chatId] ?? {};
    const allIds = entry.batch?.messageIds ?? [];
    if (allIds.length === 0) return null;

    // 派发时再次应用当前配置，兼容开关变化及重启前已保存的批次。
    // 先排除不处理的发送者，再计算批次大小和检查转人工。
    const pending = this.#storedMessages(chat.chatId, allIds)
      .filter((message) => triggersReply(chat, message));
    const acceptedIds = new Set(pending.map((message) => message.messageId));
    const excludedIds = allIds.filter((id) => !acceptedIds.has(id));
    if (excludedIds.length) await this.#acknowledge(chat.chatId, excludedIds);
    if (pending.length === 0) return null;

    // 有人明确要求真人：整批不处理，等人来。
    const keywordList = this.#store.config.handoffKeywords;
    const handoff = pending
      .map((message) => handoffRequestedIn(message.text, keywordList)).find(Boolean);
    if (handoff) {
      this.#logger?.info?.(`[im-feishu] ${chat.chatId} 命中「${handoff}」，本批转人工，不派发`);
      await this.#acknowledge(chat.chatId, allIds);
      return null;
    }
    const messages = pending.slice(0, BATCH_MAX_MESSAGES);
    const ids = messages.map((message) => message.messageId);
    const sessionId = await this.#ensureSession(chat, entry);
    if (!this.#activeChat(chat.chatId, signal)) return null;
    await this.#store.bindWorkerSession(chat, sessionId);
    if (!this.#activeChat(chat.chatId, signal)) return null;
    // 包含本人回复和未触发的消息，但不把后续积压消息提前作为背景派发。
    const latest = this.#store.state.chats[chat.chatId] ?? entry;
    const pendingIds = new Set(latest.batch?.messageIds ?? []);
    const contextMessages = (latest.messages ?? [])
      .filter((message) => !pendingIds.has(message.messageId) && acceptsSender(chat, message))
      .slice(-MAX_MESSAGES_PER_CHAT)
      .sort((a, b) => Date.parse(a.createTime) - Date.parse(b.createTime));
    const requestId = `feishu-avatar-${createHash('sha256').update(JSON.stringify([chat.chatId, ids])).digest('hex')}`;
    await this.#harness.prompt(sessionId, renderBatchPrompt({
      messages,
      contextMessages,
    }), { signal, requestId });
    await this.#acknowledge(chat.chatId, ids, { lastDispatchAt: this.#now() });
    return chat.chatId;
  }

  /** 复用或创建 Worker 会话（工作区/预设变了就重建）。 */
  async #ensureSession(chat, entry) {
    const workerKey = this.#workerKey();
    let sessionId = entry.sessionId ?? null;
    const configStale = sessionId && entry.workerConfigKey !== workerKey;
    const unusable = sessionId ? this.#sessionUsable(sessionId) === false : false;
    if (!sessionId || configStale || unusable) {
      if (unusable) this.#logger?.warn?.(`[im-feishu] ${chat.chatId} 的 Worker 会话已不可用，重建`);
      if (configStale) this.#logger?.info?.(`[im-feishu] ${chat.chatId} 的 Worker 工作区/预设变了，重建会话`);
      sessionId = await this.#harness.createSession(await this.#workerTarget());
      await this.#patch(chat.chatId, { sessionId, workerConfigKey: workerKey, titleName: null });
    }
    await this.#syncTitle(chat, sessionId, this.#store.state.chats[chat.chatId] ?? entry);
    return sessionId;
  }

  /** 会话标题跟聊天名保持一致：私聊用对方名字，群聊用群名。 */
  async #syncTitle(chat, sessionId, entry) {
    const title = String(chat.name || chat.chatId).trim();
    if (!title || entry.titleName === title) return;
    if (typeof this.#harness.renameSession !== 'function') return;
    const accepted = await this.#harness.renameSession(sessionId, title).catch(() => null);
    if (accepted) await this.#patch(chat.chatId, { titleName: accepted });
  }

  /** Worker 的工作区/预设指纹：变了就换新会话。 */
  #workerKey() {
    const worker = this.#store.config.worker ?? {};
    return JSON.stringify([
      worker.workspaceId || worker.workspacePath || '',
      worker.preset || DEFAULT_WORKER_PRESET,
    ]);
  }

  /** session.create 的目标：显式配置优先，否则落在默认工作区。 */
  async #workerTarget() {
    const worker = this.#store.config.worker ?? {};
    const request = { agentPreset: worker.preset || DEFAULT_WORKER_PRESET };
    if (worker.workspaceId) {
      request.workspaceId = worker.workspaceId;
      return request;
    }
    if (worker.workspacePath) {
      const workspaceId = await this.#harness.ensureWorkspace?.(worker.workspacePath).catch(() => null);
      if (workspaceId) {
        request.workspaceId = workspaceId;
        return request;
      }
      request.cwd = worker.workspacePath;
      return request;
    }
    // 没配置时跟随 DSH 的默认工作区，避免会话落在「未分组」。
    const fallback = await Promise.resolve(
      typeof this.#defaultWorkspaceId === 'function' ? this.#defaultWorkspaceId() : this.#defaultWorkspaceId,
    ).catch(() => null);
    if (fallback) request.workspaceId = fallback;
    return request;
  }

  /** 归档或删除的 Worker 会话不能再跑模型步骤。 */
  #sessionUsable(sessionId) {
    const guard = this.#sessionGuard;
    if (!guard) return null;
    if (guard.isArchived?.(sessionId)) return false;
    if (guard.exists?.(sessionId) === false) return false;
    return null;
  }

  /** 从状态里取出这批消息的最新副本。 */
  #storedMessages(chatId, ids) {
    const messages = new Map((this.#store.state.chats[chatId]?.messages ?? [])
      .map((message) => [message.messageId, message]));
    return ids.map((id) => messages.get(id)).filter(Boolean);
  }

  /** Acknowledge only the snapshot that was handled, preserving concurrent arrivals. */
  async #acknowledge(chatId, ids, patch = {}) {
    const handled = new Set(ids);
    await this.#store.updateChat(chatId, (entry) => {
      const remaining = (entry.batch?.messageIds ?? []).filter((id) => !handled.has(id));
      return {
        ...patch,
        batch: {
          messageIds: remaining,
          firstAt: remaining.length ? entry.batch.firstAt : null,
          lastAt: remaining.length ? entry.batch.lastAt : null,
        },
      };
    });
  }

  async #patch(chatId, patch) {
    await this.#store.updateChat(chatId, patch);
  }
}
