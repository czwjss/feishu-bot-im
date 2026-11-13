/**
 * Feishu message bridge.
 *
 * Inbound event → access check → command or Harness prompt → live progress in a
 * single edited message → final answer. One chat maps to one DSH Session.
 */
import { TurnRunner } from './turn.js';
import { CARD_STUCK_MS, cardStreamingOf, chatIdOfKey, scopedValue, textOfContentOrPost } from './message-text.js';
import { handoffRequestedIn } from './handoff.js';

/** 挂起卡片的检查间隔：流式卡片通常很快收尾，30 秒查一次足够。 */
const CARD_POLL_MS = 30_000;
import { InteractionManager } from './interactions.js';
import { MenuController } from './menu.js';
import { isAddressed, isAllowed, senderOpenId } from './access.js';
import { runCommand } from './commands.js';
import { DEFAULT_EAVESDROP_LIMIT, EavesdropStore, describeMessageForEavesdrop, renderEavesdropBlock } from './eavesdrop.js';
import { renderMentions } from './mentions.js';
import { InboundContent } from './inbound.js';
import { renderGuidanceBlock, renderQuoteBlock, renderSourceBlock } from './context-enhancement.js';
import { appendFile, mkdir } from 'node:fs/promises';
import { sendNotice } from './notify.js';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { KeyedQueue } from './queue.js';


const COMMAND = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i;

/** A bare group mention carries no text; the model still needs a user turn. */
const BARE_MENTION_PROMPT = '有事找你';
const BARE_MENTION_HINT = '在的，请直接说需求；发送 /menu 可以查看和调整当前配置。';

/** Reaction emoji used as a coarse message status. */
const REACTION = Object.freeze({ processing: 'OnIt', done: 'DONE', stopped: 'DIZZY' });
/** 排队批次的可读正文：编号、发送者、时间、原文各占一行。 */
function renderBatchBody(items) {
  const lines = [`[排队合并] 上一条回复期间收到 ${items.length} 条消息，按时间顺序如下：`];
  items.forEach((item, index) => {
    const stamp = formatBatchTime(item.createTime);
    const who = item.senderName || '某人';
    const text = (item.parts ?? [])
      .filter((part) => part?.type === 'text')
      .map((part) => String(part.text ?? '').trim())
      .filter(Boolean)
      .join('\n');
    lines.push('', `${index + 1}. ${who}${stamp ? ` · ${stamp}` : ''}：`, text || '（附件见下）');
  });
  lines.push('', '请合并处理，必要时在回复里点名对应的人。');
  return lines.join('\n');
}

function formatBatchTime(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const PARENT_CACHE_TTL_MS = 5 * 60_000;
const PARENT_MISS_TTL_MS = 30_000;

export class FeishuBridge {
  #bot;
  #harness;
  #config;
  #state;
  #logger;
  #interactions;
  #menu;
  #inbound;
  #eventsPath;
  #chatTypes = new Map();
  #inboundQueue = new KeyedQueue();
  #chatNames = new Map();
  #handoffKeywords = null;
  #reactions = new Map();
  #reactionQueue = new Map();
  #batchQueue = new Map();
  #batchDraining = new Set();
  #feishuPromptOrigins = new Map();
  #turnOrigin = new Map();
  #triggerMessages = new Map();
  #externalAsk = new Map();
  #reactionActive = new Map();
  #userNames = new Map();
  #messageCache = new Map();
  #eavesdrop = new EavesdropStore();
  #onContext;
  #stats = { messagesReceived: 0, events: 0, lastEventAt: null, lastEventType: null };
  #disposed = false;
  #pendingCards = new Map();
  #cardTimer = null;
  #turns;
  #listPresets;

  constructor({ bot, harness, config, state, logger, inboxDir, eventsPath, onContext, listPresets, handoffKeywords = null }) {
    this.#bot = bot;
    this.#harness = harness;
    this.#config = config;
    this.#state = state;
    this.#logger = logger ?? console;
    this.#inbound = new InboundContent({ bot, inboxDir, logger: this.#logger });
    this.#handoffKeywords = handoffKeywords;
    this.#onContext = typeof onContext === 'function' ? onContext : () => undefined;
    this.#eventsPath = eventsPath ?? null;
    this.#listPresets = typeof listPresets === 'function' ? listPresets : async () => [];
    this.#interactions = new InteractionManager({
      bot,
      canManage: (key, operator) => this.#canManage(key, operator),
      canAnswer: (key, operator) => Boolean(operator) && isAllowed(this.#config, {
        chat_type: this.#chatTypes.get(key) ?? this.#state.chatTypeFor?.(key),
      }, operator),
      log: (level, message, error) => this.#log(level, message, error),
    });
    this.#menu = new MenuController({
      bot, harness, state,
      services: () => this.#services(),
      canManage: (key, operator) => this.#canManage(key, operator),
      forgetSession: (sessionId, key) => {
        this.#eavesdrop.reset(key);
        this.#forgetSessionOrigin(sessionId);
      },
    });
    this.#turns = new TurnRunner({
      bot,
      state,
      log: (level, message, error) => this.#log(level, message, error),
      logEvent: (kind, detail) => this.#logEvent(kind, detail),
      processDetail: () => this.#config.processDetail ?? 'detailed',
      classifyUserMessage: (sessionId, source) => this.#classifyUserMessage(sessionId, source),
      onTurnOrigin: (sessionId, kind) => this.#turnOrigin.set(sessionId, kind),
      showStats: (chatKey) => this.#state.statsFor?.(chatKey) === true,
      showTools: (chatKey) => this.#state.toolsFor?.(chatKey) === true,
      renderMentions: (text, { mode }) => this.#renderMentions(text, mode),
      replyToOf: (sessionId) => this.#triggerMessages.get(sessionId) ?? null,
    });
  }

  /** Inbound counters surfaced in status.json for operations. */
  stats() {
    return { ...this.#stats };
  }

  /** Append one line per inbound event so "did anything arrive" is answerable. */
  #logEvent(kind, detail) {
    this.#stats.events += 1;
    // Card sends/patches are also logged; only real inbound messages count here.
    if (kind === 'message') this.#stats.messagesReceived += 1;
    this.#stats.lastEventAt = new Date().toISOString();
    this.#stats.lastEventType = kind;
    if (!this.#eventsPath) return;
    const line = `${this.#stats.lastEventAt} ${kind} ${detail}\n`;
    void (async () => {
      await mkdir(dirname(this.#eventsPath), { recursive: true }).catch(() => undefined);
      await appendFile(this.#eventsPath, line, { mode: 0o600 }).catch(() => undefined);
    })();
  }

  /** Settings saved from the browser must reach the running bridge. */
  setConfig(config) {
    if (config && typeof config === 'object') this.#config = config;
  }

  dispose() {
    this.#disposed = true;
    if (this.#cardTimer) clearInterval(this.#cardTimer);
    this.#cardTimer = null;
    this.#pendingCards.clear();
    this.#turns?.dispose();
    this.#interactions.dispose();
    this.#menu.dispose();
  }

  #log(level, message, error) {
    const fn = this.#logger?.[level] ?? this.#logger?.info;
    if (typeof fn === 'function') fn.call(this.#logger, `[im-feishu] ${message}`, ...(error ? [error] : []));
  }

  // ── access ────────────────────────────────────────────────────────────────


  // ── inbound ───────────────────────────────────────────────────────────────

  handleMessage(data, options = {}) {
    return this.#inboundQueue.run(data?.message?.chat_id, () => this.#handleMessage(data, options));
  }

  async #handleMessage(data, { resubmitted = false } = {}) {
    if (this.#disposed) return;
    const message = data?.message;
    this.#logEvent('message', `${message?.message_id ?? '-'} chat=${message?.chat_id ?? '-'} type=${message?.message_type ?? '-'}`);
    if (!message?.message_id || !message?.chat_id) return;
    const senderType = data?.sender?.sender_type;
    const fromBot = senderType && senderType !== 'user';
    if (fromBot && this.#config.respondToBotMessages === false) return;
    const openId = senderOpenId(data);
    if (openId && this.#config.botOpenId && openId === this.#config.botOpenId) return;
    if (!resubmitted) {
      if (this.#state.hasSeen(message.message_id)) return;
      await this.#state.markSeen(message.message_id);
    }

    if (!isAllowed(this.#config, message, openId)) {
      // With the all-group-messages scope enabled every message arrives; only
      // answer the addressed ones instead of spamming the chat with notices.
      if (isAddressed(this.#config, message)) {
        await sendNotice(this.#bot, message.chat_id, '当前账号没有使用权限。请让管理员在插件设置里把你的 Open ID 加入白名单。', '无权限');
      }
      return;
    }
    const chatKey = `chat:${message.chat_id}`;
    this.#chatTypes.set(chatKey, message.chat_type);
    await this.#state.setChatType?.(chatKey, message.chat_type);
    // Remember who spoke / who was mentioned so the model can @ them later.
    const wantsMentions = this.#config.mentions?.enabled !== false;
    const wantsName = wantsMentions || this.#config.eavesdrop?.enabled === true;
    const senderName = wantsName && openId ? await this.#senderName(openId) : null;
    // 被 @ 或被引用机器人消息都算被叫到。
    const addressed = isAddressed(this.#config, message) || await this.#isReplyToBot(message);
    if (!addressed) {
      this.#recordEavesdrop(chatKey, message, openId, senderName);
      return;
    }

    // 卡片：只让收尾后的进入会话；仍在流式的先挂起，收尾后再回来处理。
    if (message.message_type === 'interactive') {
      const latest = await this.#bot.getMessage?.(message.message_id).catch(() => null);
      if (latest?.bodyContent) message.content = latest.bodyContent;
      if (cardStreamingOf(message.content) === true) {
        this.#trackPendingCard(data, message);
        return;
      }
    }
    const text = (textOfContentOrPost(message) ?? '').replace(/@_user_\d+/g, '').trim();

    if (text && this.#interactions.resolveText(chatKey, message.chat_id, openId, text)) return;

    if (text) {
      const match = COMMAND.exec(text);
      if (match) {
        const handled = await this.#runCommand(match[1].toLowerCase(), (match[2] ?? '').trim(), {
          chatId: message.chat_id,
          chatKey,
          chatType: message.chat_type,
          messageId: message.message_id,
          openId,
        });
        if (handled) {
          await this.#react(message.message_id, REACTION.done);
          return;
        }
      }
    }

    // 对方明确要求真人：不回复，等人来处理。
    const handoff = handoffRequestedIn(text, this.#handoffKeywords?.() ?? undefined);
    if (handoff) {
      this.#log('info', `命中「${handoff}」，转人工，不回复 ${message.message_id}`);
      return;
    }

    const supported = ['text', 'post', 'image', 'file', 'interactive'];
    if (!supported.includes(message.message_type)) {
      await sendNotice(this.#bot, message.chat_id, '目前支持文字、卡片、图片和文件消息；语音和视频暂不支持。', '暂不支持');
      return;
    }
    // Resolve the quote only after commands / unsupported messages are handled:
    // a /menu reply should not download quoted images.
    const quoted = await this.#quotedMessage(message);

    let parts = text ? [{ type: 'text', text }] : [];
    if (message.message_type === 'image' || message.message_type === 'file' || message.message_type === 'post') {
      const built = await this.#inbound.build(message, text);
      parts = built.parts;
      if (!built.hasInput) {
        await sendNotice(this.#bot, message.chat_id, '这条消息里没有可处理的内容。', '无法处理');
        return;
      }
    }

    const quotedParts = Array.isArray(quoted?.parts) ? quoted.parts : [];
    const promptParts = quotedParts.length > 0 ? [...quotedParts, ...parts] : parts;

    const submitPrompt = (incomingParts, promptText) => this.#deliver({
      chatKey,
      chatId: message.chat_id,
      chatType: message.chat_type,
      createTime: message.create_time,
      messageId: message.message_id,
      parts: incomingParts,
      text: promptText,
      openId,
      senderName,
      quoted,
    });

    // A bare mention (or an empty text body) carries no instruction. If the
    // chat already has a Session, send a minimal user turn so the model can
    // answer; a chat without one gets the hint and no Session is created.
    if (promptParts.length === 0) {
      if (message.chat_type !== 'group') return;
      if (this.#state.sessionFor(chatKey)) {
        await this.#react(message.message_id, REACTION.processing);
        await submitPrompt([{ type: 'text', text: BARE_MENTION_PROMPT }], BARE_MENTION_PROMPT);
        return;
      }
      await this.#sendBareMentionHint(message.chat_id);
      return;
    }

    await this.#react(message.message_id, REACTION.processing);
    await submitPrompt(promptParts, text);
  }

  /** Hint card for a bare group mention when the chat has no Session yet. */
  async #sendBareMentionHint(chatId) {
    await sendNotice(this.#bot, chatId, BARE_MENTION_HINT, '在的', 'blue');
  }

  /** Keep the last Web-side question/approval so /stop can tell the user what was pending. */
  #rememberExternalAsk(sessionId, kind, text) {
    this.#externalAsk.set(sessionId, { kind, text: String(text).slice(0, 200), at: Date.now() });
    if (this.#externalAsk.size > 100) this.#externalAsk.delete(this.#externalAsk.keys().next().value);
  }

  /** Apply the bot's default permission preset to a freshly created Session. */
  async #applyPermission(sessionId, chatId) {
    const preset = this.#config.permissionPreset;
    if (!preset) return;
    try {
      await this.#harness.setPermission?.(sessionId, preset);
    } catch (error) {
      this.#log('warn', 'permission preset failed', error);
      if (chatId) {
        await sendNotice(this.#bot, chatId, `权限档位应用失败：${error.message}`, '权限档位', 'orange');
      }
    }
  }

  /** Forget a Session's pending render marks when the chat stops using it. */
  #forgetSessionOrigin(sessionId) {
    if (!sessionId) return;
    this.#turnOrigin.delete(sessionId);
    this.#externalAsk.delete(sessionId);
    for (const [requestId, origin] of this.#feishuPromptOrigins) {
      if (origin.sessionId === sessionId) this.#feishuPromptOrigins.delete(requestId);
    }
  }

  /**
   * Classify the user message that actually started a turn. Feishu prompts are
   * matched by the `rpcId` the Host echoes from `session.prompt`; schedule
   * reminders carry `source.kind=schedule`. Plugin/system rows return null.
   */
  #classifyUserMessage(sessionId, source) {
    const rpcId = typeof source?.rpcId === 'string' ? source.rpcId : null;
    if (rpcId) {
      const origin = this.#feishuPromptOrigins.get(rpcId);
      if (origin && origin.sessionId === sessionId) {
        this.#feishuPromptOrigins.delete(rpcId);
        return { kind: 'feishu', chatKey: origin.chatKey, chatId: origin.chatId };
      }
    }
    if (source?.kind === 'schedule') {
      const chatKey = this.#state.keyForSession(sessionId);
      const chatId = chatIdOfKey(chatKey);
      if (!chatId) return null;
      return { kind: 'schedule', chatKey, chatId };
    }
    if (source?.kind === 'user') return { kind: 'external', chatKey: null, chatId: null };
    return null;
  }

  /** Prompt a Feishu-owned Session and remember the exact chat for its turn. */
  async #promptFeishu(sessionId, content, options = {}) {
    if (typeof sessionId !== 'string') throw new Error('session required');
    const chatKey = options.chatKey ?? this.#state.keyForSession(sessionId);
    const chatId = options.chatId ?? chatIdOfKey(chatKey);
    const requestId = `im-feishu-${randomUUID()}`;
    if (chatKey && chatId) this.#feishuPromptOrigins.set(requestId, { chatKey, chatId, sessionId });
    try {
      await this.#harness.prompt(sessionId, content, { ...options, requestId });
    } catch (error) {
      this.#feishuPromptOrigins.delete(requestId);
      throw error;
    }
  }

  // ── eavesdrop ─────────────────────────────────────────────────────────────

  /** Non-addressed group messages become context for the next mention. */
  #recordEavesdrop(chatKey, message, openId, senderName) {
    if (this.#config.eavesdrop?.enabled !== true) return;
    if (message?.chat_type !== 'group') return;
    const described = describeMessageForEavesdrop(message);
    if (!described.text) return;
    this.#eavesdrop.record(chatKey, {
      senderId: openId ?? null,
      senderName: senderName ?? null,
      at: Number(message.create_time) || Date.now(),
      text: described.text,
    }, this.#config.eavesdrop.limit || DEFAULT_EAVESDROP_LIMIT);
  }

  #renderMentions(text, mode) {
    const config = this.#config.mentions ?? {};
    return renderMentions(text, {
      mode,
      enabled: config.enabled !== false,
      allowAll: config.allowAll === true,
    });
  }

  /** Guidance stored in the plugin's systemPrompt.context. */
  #guidanceContext(chatType) {
    return renderGuidanceBlock(this.#contextScope(chatType)) ?? '';
  }

  /** Resolve a bounded number of display names once, at injection time. */
  async #eavesdropEntries(entries) {
    if (entries.length === 0) return entries;
    const names = new Map();
    let resolved = 0;
    const result = [];
    for (const entry of entries) {
      let senderName = entry.senderName;
      if (!senderName && entry.senderId && resolved < 10) {
        if (!names.has(entry.senderId)) {
          names.set(entry.senderId, await this.#senderName(entry.senderId));
          resolved += 1;
        }
        senderName = names.get(entry.senderId);
      }
      result.push(senderName === entry.senderName ? entry : { ...entry, senderName });
    }
    return result;
  }

  /** 上一个回合还在跑时先攒着，回合结束后合并成一次派发。 */
  async #deliver(args) {
    const sessionId = this.#state.sessionFor(args.chatKey);
    const busy = Boolean(sessionId) && (this.#turnOrigin.has(sessionId) || this.#batchDraining.has(args.chatKey));
    if (busy) {
      // 明确开了 steer 且当前是飞书轮次时，仍然按插话处理，不攒批。
      const scopeKey = args.chatType === 'p2p' ? 'direct' : 'group';
      const wanted = scopedValue(this.#config.busyMode, scopeKey, 'queue') === 'steer' ? 'steer' : 'queue';
      const effective = wanted === 'steer' && this.#turnOrigin.get(sessionId) === 'feishu' ? 'steer' : 'queue';
      if (effective === 'queue') {
        const queue = this.#batchQueue.get(args.chatKey) ?? [];
        queue.push(args);
        this.#batchQueue.set(args.chatKey, queue);
        return;
      }
    }
    await this.#submitPrompt(args);
  }

  /** 把排队期间攒下的消息合并成一条 prompt 派发。 */
  #drainBatch(sessionId) {
    const chatKey = this.#state.keyForSession(sessionId);
    if (!chatKey || !this.#batchQueue.get(chatKey)?.length) return;
    return this.#inboundQueue.run(chatIdOfKey(chatKey), () => this.#drainBatchOnce(sessionId));
  }

  async #drainBatchOnce(sessionId) {
    if (this.#disposed) return;
    const chatKey = this.#state.keyForSession(sessionId);
    if (!chatKey) return;
    const items = this.#batchQueue.get(chatKey);
    if (!items || items.length === 0) return;
    this.#batchQueue.delete(chatKey);
    this.#batchDraining.add(chatKey);
    try {
      const first = items[0];
      const parts = [{ type: 'text', text: renderBatchBody(items) }];
      // 图片/文件等附件按序号附在正文之后，避免打断文字排版。
      items.forEach((item, index) => {
        const extras = (item.parts ?? []).filter((part) => part?.type && part.type !== 'text');
        if (extras.length === 0) return;
        parts.push({ type: 'text', text: `第 ${index + 1} 条的附件：` });
        parts.push(...extras);
      });
      await this.#submitPrompt({
        chatKey,
        chatId: first.chatId,
        chatType: first.chatType,
        createTime: items.at(-1).createTime,
        messageId: null,
        parts,
        text: '',
        openId: items.at(-1).openId,
        quoted: null,
        batchIds: items.map((item) => item.messageId),
      });
    } catch (error) {
      this.#log('warn', 'queued batch failed', error);
    } finally {
      this.#batchDraining.delete(chatKey);
    }
  }

  async #submitPrompt({ chatKey, chatId, chatType, createTime, messageId, parts, text, openId, quoted = null, batchIds = null }) {
    let sessionId = this.#state.sessionFor(chatKey);
    const create = async () => {
      const override = this.#state.overrideFor?.(chatKey) ?? {};
      const workspace = override.workspace ?? this.#config.workspace ?? undefined;
      // `cwd` alone does not group the Session in the Host UI; the workspace
      // registry identity is what the sidebar groups by.
      let workspaceId = workspace
        ? await this.#harness.resolveWorkspaceId(workspace).catch(() => null)
        : null;
      // A directory the Host has not registered yet still has to group: create
      // its workspace instead of silently landing in "ungrouped".
      if (workspace && !workspaceId) {
        workspaceId = await this.#harness.ensureWorkspace(workspace).catch(() => null);
      }
      // The Host rejects a create that carries both identities.
      const preset = override.preset ?? this.#config.agentPreset ?? undefined;
      const created = await this.#harness.createSession(workspaceId
        ? { workspaceId, agentPreset: preset }
        : { cwd: workspace, agentPreset: preset });
      await this.#state.bindSession(chatKey, created);
      const title = await this.#sessionTitle(chatId, chatType, openId);
      await this.#renameSession(created, title);
      await this.#state.setSessionMeta?.(created, {
        workspace: workspace || null,
        preset: preset ?? null,
        model: override.model ?? this.#config.model ?? null,
        titleName: title,
      });
      const model = override.model ?? this.#config.model;
      if (model) {
        await this.#harness.selectModel(created, model).catch(() => undefined);
      }
      await this.#applyPermission(created, chatId);
      return created;
    };

    // A brand-new Session should see the current buffer; an existing one keeps
    // its watermark so earlier context is not injected twice.
    if (!sessionId) this.#eavesdrop.reset(chatKey);
    const reserved = this.#config.eavesdrop?.enabled === true ? this.#eavesdrop.take(chatKey) : null;
    const eavesdropEntries = reserved ? await this.#eavesdropEntries(reserved.entries) : [];
    const eavesdropBlock = renderEavesdropBlock(eavesdropEntries);

    const scopeKey = chatType === 'p2p' ? 'direct' : 'group';
    const wanted = scopedValue(this.#config.busyMode, scopeKey, 'queue') === 'steer' ? 'steer' : 'queue';
    // 当前轮不是飞书发起的（绑定会话里 Web 正在跑）时，飞书消息只能排队，不能插入。
    const activeOrigin = sessionId ? this.#turnOrigin.get(sessionId) : null;
    const mode = wanted === 'steer' && activeOrigin !== 'feishu' ? 'queue' : wanted;
    // The context never travels inside the user's message: it is published to
    // the per-session system-prompt context instead, so the bubble stays clean.
    const scope = this.#contextScope(chatType);
    const selectedFields = scope?.fields ?? [];
    const senderName = selectedFields.includes('senderName') ? await this.#senderName(openId) : null;
    const conversationTitle = selectedFields.includes('conversationTitle') && chatType !== 'p2p'
      ? await this.#chatName(chatId)
      : null;
    const sourceBlock = renderSourceBlock(scope, {
      senderId: openId,
      senderName,
      botId: this.#config.botOpenId,
      conversationTitle,
      sentAt: createTime,
    });
    // All injected context lives in the plugin's systemPrompt.context section;
    // the user's own message keeps only what they actually sent.
    const quoteBlock = renderQuoteBlock(quoted);
    const injected = [this.#guidanceContext(chatType), sourceBlock, quoteBlock, eavesdropBlock]
      .filter(Boolean)
      .join('\n\n');

    if (sessionId) await this.#syncSessionTitle(sessionId, chatId, chatType, openId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!sessionId) {
        try {
          sessionId = await create();
        } catch (error) {
          this.#log('error', 'session create failed', error);
          if (reserved) this.#eavesdrop.rollback(chatKey, reserved.seq);
          await sendNotice(this.#bot, chatId, `创建会话失败：${error.message}`, '创建失败');
          await this.#abortReaction(sessionId, messageId);
          return;
        }
      }
      try {
        // A Session may be shared by several chats. Key reactions by Session,
        // not chat, so turn/start and turn/end settle the originating message.
        if (batchIds) this.#trackReactionGroup(sessionId, batchIds, mode);
        else this.#trackReaction(sessionId, messageId, mode);
        // 私聊不引用；群聊才把回答卡片挂在触发消息下。
        if (chatType !== 'p2p') this.#triggerMessages.set(sessionId, messageId ?? batchIds?.at(-1) ?? null);
        this.#onContext(sessionId, injected);
        await this.#promptFeishu(sessionId, parts, { mode, chatKey, chatId });
        if (reserved) this.#eavesdrop.commit(chatKey, reserved.seq);
        return;
      } catch (error) {
        // A Session deleted from the Web UI must not wedge this chat forever.
        const stale = error?.code === 'session/not-found' || /not found/i.test(error?.message ?? '');
        if (!stale || attempt > 0) {
          this.#log('error', 'prompt failed', error);
          if (reserved) this.#eavesdrop.rollback(chatKey, reserved.seq);
          await sendNotice(this.#bot, chatId, `提交失败：${error.message}`, '提交失败');
          await this.#abortReaction(sessionId, messageId);
          return;
        }
        this.#forgetReaction(sessionId, messageId);
        await this.#state.unbindSession(chatKey);
        this.#forgetSessionOrigin(sessionId);
        sessionId = null;
      }
    }
  }

  /** Cached display name; a failed lookup is remembered briefly. */
  /** 旧会话第一次见到时补一次标题，之后按 meta 记录跳过。 */
  async #syncSessionTitle(sessionId, chatId, chatType, openId) {
    const title = await this.#sessionTitle(chatId, chatType, openId);
    const meta = this.#state.meta?.[sessionId] ?? {};
    if (!title || meta.titleName === title) return;
    await this.#renameSession(sessionId, title);
    await this.#state.setSessionMeta?.(sessionId, { titleName: title });
  }

  /** 改名失败不影响主流程（部分部署没有挂载 session-title）。 */
  async #renameSession(sessionId, title) {
    if (typeof this.#harness.renameSession !== 'function') return;
    await this.#harness.renameSession(sessionId, title).catch(() => undefined);
  }

  /** 会话标题：私聊用对方名字，群聊用群名，取不到时退回 chatId。 */
  async #sessionTitle(chatId, chatType, openId) {
    if (chatType === 'p2p') {
      const name = await this.#senderName(openId);
      if (name) return name;
    }
    const title = await this.#chatName(chatId);
    return title || chatId;
  }

  async #senderName(openId) {
    if (!openId) return null;
    const cached = this.#userNames.get(openId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;
    const name = await Promise.resolve(this.#bot.getUserName?.(openId)).catch(() => null) ?? null;
    this.#userNames.set(openId, { name, expiresAt: Date.now() + 30 * 60_000 });
    return name;
  }

  /** Swap the status reaction on one inbound message. */
  async #react(messageId, emoji) {
    if (!messageId || typeof this.#bot.addReaction !== 'function') return;
    const previous = this.#reactions.get(messageId);
    if (previous) {
      await this.#bot.removeReaction?.(messageId, previous).catch(() => undefined);
      this.#reactions.delete(messageId);
    }
    const created = await this.#bot.addReaction(messageId, emoji).catch(() => null);
    if (created) {
      this.#reactions.set(messageId, created);
      if (this.#reactions.size > 500) this.#reactions.delete(this.#reactions.keys().next().value);
    }
  }

  /** Cached group name; failures are remembered briefly. */
  async #chatName(chatId) {
    if (!chatId) return null;
    const cached = this.#chatNames.get(chatId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;
    const name = await Promise.resolve(this.#bot.getChatName?.(chatId)).catch(() => null) ?? null;
    if (this.#chatNames.size > 200) {
      for (const [key, item] of this.#chatNames) if (item.expiresAt <= Date.now()) this.#chatNames.delete(key);
    }
    this.#chatNames.set(chatId, { name, expiresAt: Date.now() + 30 * 60_000 });
    return name;
  }

  /** Fetch and briefly cache one parent message (used for reply + quote). */
  async #parentMessage(message) {
    const parentId = typeof message?.parent_id === 'string' && message.parent_id.trim()
      ? message.parent_id.trim()
      : '';
    if (!parentId) return null;
    const cached = this.#messageCache.get(parentId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await Promise.resolve(this.#bot.getMessage?.(parentId)).catch(() => null) ?? null;
    this.#messageCache.set(parentId, {
      value,
      expiresAt: Date.now() + (value ? PARENT_CACHE_TTL_MS : PARENT_MISS_TTL_MS),
    });
    if (this.#messageCache.size > 200) this.#messageCache.delete(this.#messageCache.keys().next().value);
    return value;
  }

  /** A reply to one of our messages counts as addressed, even without @. */
  async #isReplyToBot(message) {
    const parent = await this.#parentMessage(message);
    if (!parent) return false;
    return Boolean(parent.senderId && (
      parent.senderId === this.#config.botOpenId
      || (parent.senderType === 'app' && parent.senderId === this.#config.appId)
    ));
  }

  /** The message the user replied to; Feishu events carry only its id. */
  /**
   * 流式卡片收尾：卡片 JSON 2.0 的 config.streaming_mode 为 true 时表示
   * 内容还在增量刷新，收尾时发送方会置为 false。等它关闭后再交给模型。
   */
  /** 记下仍在流式输出的卡片，收尾后再走一遍入站流程。 */
  #trackPendingCard(data, message) {
    const created = Number(message.create_time) || Date.now();
    this.#pendingCards.set(message.message_id, {
      data,
      chatId: message.chat_id,
      created,
    });
    this.#startCardTimer();
    this.#log('info', `卡片仍在流式输出，挂起等待收尾 ${message.message_id}`);
  }

  #startCardTimer() {
    if (this.#cardTimer || this.#pendingCards.size === 0) return;
    this.#cardTimer = setInterval(() => { void this.#sweepPendingCards(); }, CARD_POLL_MS);
    this.#cardTimer?.unref?.();
  }

  /** 定时检查挂起的卡片：收尾了就重新入站，超时则丢弃。 */
  async #sweepPendingCards() {
    if (this.#disposed) return;
    for (const [messageId, pending] of [...this.#pendingCards]) {
      const now = Date.now();
      if (now - pending.created > CARD_STUCK_MS) {
        this.#pendingCards.delete(messageId);
        this.#log('warn', `卡片超过 10 分钟未收尾，丢弃 ${messageId}`);
        continue;
      }
      const latest = await this.#bot.getMessage?.(messageId).catch(() => null);
      if (!latest?.bodyContent) continue;
      if (cardStreamingOf(latest.bodyContent) === true) continue;
      this.#pendingCards.delete(messageId);
      const data = {
        ...pending.data,
        message: { ...pending.data.message, content: latest.bodyContent },
      };
      await this.handleMessage(data, { resubmitted: true }).catch((error) => {
        this.#log('warn', `收尾卡片重新入站失败 ${messageId}`, error);
      });
    }
    if (this.#pendingCards.size === 0 && this.#cardTimer) {
      clearInterval(this.#cardTimer);
      this.#cardTimer = null;
    }
  }

  async #quotedMessage(message) {
    const parent = await this.#parentMessage(message);
    if (!parent) return null;
    const senderName = parent.senderType === 'app'
      ? (this.#config.botName || '机器人')
      : ((await this.#senderName(parent.senderId)) || parent.senderId || '未知发送者');
    const messageType = parent.msgType ?? parent.message_type ?? '';
    const content = parent.bodyContent ?? parent.content ?? '';
    const description = describeMessageForEavesdrop({
      message_type: messageType,
      content,
      mentions: parent.mentions ?? [],
    });
    const imageBuild = await this.#inbound.buildQuotedImages({
      messageId: parent.messageId ?? message?.parent_id,
      messageType,
      bodyContent: content,
    });
    return {
      senderName,
      messageId: parent.messageId ?? message?.parent_id ?? '',
      messageType,
      text: description.text ?? '',
      imageCount: imageBuild.count,
      imageNotes: imageBuild.notes,
      parts: imageBuild.parts,
    };
  }

  /** Private-chat or group enhancement scope. */
  #contextScope(chatType) {
    const scopes = this.#config.contextEnhancement ?? {};
    return scopes[chatType === 'p2p' ? 'direct' : 'group'];
  }

  // ── commands ──────────────────────────────────────────────────────────────

  /** Group management (including approvals) is restricted to the manager list. */
  #canManage(chatKey, operatorId) {
    const chatType = this.#chatTypes.get(chatKey) ?? this.#state.chatTypeFor?.(chatKey);
    if (chatType === 'p2p') return Boolean(operatorId);
    if (chatType !== 'group') return false;
    const managers = this.#config.access?.managers ?? [];
    if (managers.length === 0) return false; // 默认无人可执行群内管理操作
    return Boolean(operatorId) && managers.includes(operatorId);
  }

  async #runCommand(name, argument, context) {
    const managed = name === 'new' || name === 'stop';
    if (managed && !this.#canManage(context.chatKey, context.openId ?? null)) {
      await sendNotice(this.#bot, context.chatId, '只有管理员可以在群里执行这个操作。', '需要管理员');
      return true;
    }
    return runCommand(this.#services(), name, argument, context);
  }

  /** The narrow surface commands work against. */
  #services() {
    return {
      bot: this.#bot,
      state: this.#state,
      harness: this.#harness,
      config: () => this.#config,
      forgetSession: (sessionId) => {
        const key = typeof sessionId === 'string' ? this.#state.keyForSession?.(sessionId) : null;
        if (key) this.#eavesdrop.reset(key);
        this.#forgetSessionOrigin(sessionId);
      },
      externalAsk: (sessionId) => this.#externalAsk.get(sessionId) ?? null,
      listPresets: () => this.#listPresets(),
      modelFor: (sessionId) => this.#menu.modelFor(sessionId),
      log: (level, message, error) => this.#log(level, message, error),
    };
  }

  // ── turn events（实现在 turn.js） ──────────────────────────────────────────

  /** Remember which inbound messages a turn will settle, keyed by Session. */
  #trackReaction(sessionId, messageId, mode) {
    this.#trackReactionGroup(sessionId, [messageId], mode);
  }

  /** One queued turn may settle a batch of messages. */
  #trackReactionGroup(sessionId, messageIds, mode = 'queue') {
    const ids = (messageIds ?? []).filter(Boolean);
    if (!sessionId || ids.length === 0) return;
    const active = this.#reactionActive.get(sessionId);
    if (mode === 'steer' && active && active.size > 0) {
      for (const id of ids) active.add(id);
      return;
    }
    const queue = this.#reactionQueue.get(sessionId) ?? [];
    queue.push(ids);
    this.#reactionQueue.set(sessionId, queue);
  }

  /** Drop a queued/active message without changing its reaction (retry path). */
  #forgetReaction(sessionId, messageId) {
    if (!sessionId || !messageId) return;
    const queue = this.#reactionQueue.get(sessionId);
    if (queue) {
      for (const group of queue) {
        const index = group.indexOf(messageId);
        if (index >= 0) group.splice(index, 1);
      }
      const kept = queue.filter((group) => group.length > 0);
      if (kept.length === 0) this.#reactionQueue.delete(sessionId);
      else this.#reactionQueue.set(sessionId, kept);
    }
    this.#reactionActive.get(sessionId)?.delete(messageId);
  }

  /** Prompt never became a turn: drop it from the queues and mark it stopped. */
  async #abortReaction(sessionId, messageId) {
    this.#forgetReaction(sessionId, messageId);
    if (messageId) await this.#react(messageId, REACTION.stopped).catch(() => undefined);
  }

  /** A turn started: queued prompts run one per turn, so take only the head. */
  #startTurnReactions(sessionId) {
    const queue = this.#reactionQueue.get(sessionId);
    if (!queue || queue.length === 0) return;
    const group = queue.shift();
    if (queue.length === 0) this.#reactionQueue.delete(sessionId);
    const active = this.#reactionActive.get(sessionId) ?? new Set();
    for (const messageId of group) active.add(messageId);
    this.#reactionActive.set(sessionId, active);
  }

  /** Settle every message that belonged to the finished turn. */
  async #settleTurnReactions(sessionId, reason) {
    const active = this.#reactionActive.get(sessionId);
    if (!active || active.size === 0) return;
    this.#reactionActive.delete(sessionId);
    const emoji = reason?.kind === 'completed' ? REACTION.done : REACTION.stopped;
    for (const messageId of active) await this.#react(messageId, emoji);
  }

  /** Usage-only stream for Sessions not bound to any chat (subagents). */
  onForeignSessionEvent(session, event) {
    if (event?.type !== 'assistant/message') return;
    if (event.data?.usage) this.#turns.onExternalUsage(session?.id, event.data.usage);
  }

  async onSessionEvent(session, event) {
    const sessionId = session?.id;
    if (sessionId && event?.type === 'turn/start') this.#startTurnReactions(sessionId);
    const result = await this.#turns.onSessionEvent(session, event);
    if (sessionId && event?.type === 'turn/end') {
      this.#turnOrigin.delete(sessionId);
      this.#triggerMessages.delete(sessionId);
      this.#externalAsk.delete(sessionId);
      await this.#settleTurnReactions(sessionId, event?.data?.reason).catch(() => undefined);
      await this.#drainBatch(sessionId);
    }
    return result;
  }

  onAssistantStream(agent, frame) {
    return this.#turns.onAssistantStream(agent, frame);
  }


  // ── interactions ──────────────────────────────────────────────────────────

  /** Session → its chat binding: `{ key, chatId }`, or null when unbound. */
  #chatContextFor(sessionId) {
    const key = typeof sessionId === 'string' ? this.#state.keyForSession(sessionId) : null;
    const chatId = chatIdOfKey(key);
    return chatId ? { key, chatId } : null;
  }

  /** Ask the chat to approve a tool call; races the Host's own answerer. */
  async handleApproval(request, next) {
    const sessionId = request?.agent?.session?.id;
    const binding = sessionId ? this.#chatContextFor(sessionId) : null;
    if (!binding) return next();
    const { key: chatKey, chatId } = binding;
    // 绑定会话里 Web 发起的轮次：审批留在 Web，不打扰飞书；只记下摘要供 /stop 说明。
    if (sessionId && this.#turnOrigin.get(sessionId) === 'external') {
      this.#rememberExternalAsk(sessionId, '审批', request.toolName ?? '工具');
      return next();
    }
    return this.#interactions.approve(request, next, { chatId, chatKey });
  }

  /** Ask the chat one question; a single-select answer comes back as a choice. */
  async handleQuestion(request, next) {
    const sessionId = request?.agent?.session?.id;
    const binding = sessionId ? this.#chatContextFor(sessionId) : null;
    const chatId = binding?.chatId;
    const question = Array.isArray(request?.questions) ? request.questions[0] : null;
    if (!chatId || !question) return next();
    // 绑定会话里 Web 发起的轮次：提问留在 Web，不打扰飞书；只记下摘要供 /stop 说明。
    if (sessionId && this.#turnOrigin.get(sessionId) === 'external') {
      this.#rememberExternalAsk(sessionId, '回答', question?.question ?? question?.header ?? '一个问题');
      return next();
    }
    return this.#interactions.ask(request, next, { chatId, chatKey: binding.key });
  }

  /** Card button press: `approve:<id>` / `reject:<id>` / `answer:<id>:<index>`. */
  async onCardAction(event) {
    if (this.#disposed) return undefined;
    this.#logEvent('card-action', String(event?.action?.value?.action ?? '-'));
    const value = event?.action?.value;
    const action = typeof value?.action === 'string' ? value.action : null;
    if (!action) return undefined;
    const operator = event?.operator?.open_id ?? event?.operator?.operator_id?.open_id ?? null;
    if (operator && this.#config.botOpenId && operator === this.#config.botOpenId) return undefined;

    if (this.#menu.handles(action)) {
      return this.#inboundQueue.run(event?.context?.open_chat_id, () => {
        if (!this.#disposed) return this.#menu.handle(action, event);
      });
    }
    return this.#interactions.onCardAction(action, event, operator);
  }
}
