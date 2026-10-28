/**
 * Feishu message bridge.
 *
 * Inbound event → access check → command or Harness prompt → live progress in a
 * single edited message → final answer. One chat maps to one DSH Session.
 */
import { TurnRunner } from './turn.js';
import { chatIdOfKey, scopedValue, textOfContentOrPost } from './message-text.js';
import { approvalCard, questionCard, resolvedApprovalText, newSessionCard, adjustCard, noticeCard } from './cards.js';
import { isAddressed, isAllowed, senderOpenId } from './access.js';
import { buildMenuCard, collectMenuData, currentMenuValue, menuOptionLabel, runCommand } from './commands.js';
import { EavesdropStore, describeMessageForEavesdrop, renderEavesdropBlock } from './eavesdrop.js';
import { extractMentionIds, renderMentions } from './mentions.js';
import { InboundContent } from './inbound.js';
import { renderGuidanceBlock, renderSourceBlock } from './context-enhancement.js';
import { appendFile, mkdir } from 'node:fs/promises';
import { sendNotice } from './notify.js';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';


const COMMAND = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i;

/** A bare group mention carries no text; the model still needs a user turn. */
const BARE_MENTION_PROMPT = '有事找你';
const BARE_MENTION_HINT = '在的，请直接说需求；发送 /menu 可以查看和调整当前配置。';

/** Reaction emoji used as a coarse message status. */
const REACTION = Object.freeze({ processing: 'OnIt', done: 'DONE', stopped: 'DIZZY' });

export class FeishuBridge {
  #bot;
  #harness;
  #config;
  #state;
  #logger;
  #version;
  #pending = new Map();
  #pendingByChat = new Map();
  #inbound;
  #eventsPath;
  #chatTypes = new Map();
  #chatNames = new Map();
  #reactions = new Map();
  #reactionQueue = new Map();
  #feishuPromptOrigins = new Map();
  #turnOrigin = new Map();
  #externalAsk = new Map();
  #reactionActive = new Map();
  #userNames = new Map();
  #eavesdrop = new EavesdropStore();
  #participants = new Map();
  #onContext;
  #stats = { messagesReceived: 0, events: 0, lastEventAt: null, lastEventType: null };
  #saveWorkspace;
  #disposed = false;
  #turns;
  #listPresets;
  #sessionModels = new Map();
  #menuPending = new Map();
  #newSessionDraft = new Map();
  #savePreset;
  #saveModel;

  constructor({ bot, harness, config, state, logger, version, inboxDir, saveWorkspace, eventsPath, onContext, listPresets, savePreset, saveModel }) {
    this.#bot = bot;
    this.#harness = harness;
    this.#config = config;
    this.#state = state;
    this.#logger = logger ?? console;
    this.#version = version ?? '0.0.0';
    this.#inbound = new InboundContent({ bot, inboxDir, logger: this.#logger });
    this.#saveWorkspace = saveWorkspace ?? (async () => this.#config);
    this.#eventsPath = eventsPath ?? null;
    this.#onContext = typeof onContext === 'function' ? onContext : () => undefined;
    this.#listPresets = typeof listPresets === 'function' ? listPresets : async () => [];
    this.#savePreset = typeof savePreset === 'function' ? savePreset : async () => this.#config;
    this.#saveModel = typeof saveModel === 'function' ? saveModel : async () => this.#config;
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
      renderMentions: (text, { chatKey, mode }) => this.#renderMentions(text, chatKey, mode),
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
    this.#turns?.dispose();
  }

  #log(level, message, error) {
    const fn = this.#logger?.[level] ?? this.#logger?.info;
    if (typeof fn === 'function') fn.call(this.#logger, `[im-feishu] ${message}`, ...(error ? [error] : []));
  }

  // ── access ────────────────────────────────────────────────────────────────


  // ── inbound ───────────────────────────────────────────────────────────────

  async handleMessage(data) {
    if (this.#disposed) return;
    const message = data?.message;
    this.#logEvent('message', `${message?.message_id ?? '-'} chat=${message?.chat_id ?? '-'} type=${message?.message_type ?? '-'}`);
    if (!message?.message_id || !message?.chat_id) return;
    const senderType = data?.sender?.sender_type;
    const fromBot = senderType && senderType !== 'user';
    if (fromBot && this.#config.respondToBotMessages === false) return;
    const openId = senderOpenId(data);
    if (openId && this.#config.botOpenId && openId === this.#config.botOpenId) return;
    if (this.#state.hasSeen(message.message_id)) return;
    await this.#state.markSeen(message.message_id);

    if (!isAllowed(this.#config, message, openId)) {
      // With the all-group-messages scope enabled every message arrives; only
      // answer the addressed ones instead of spamming the chat with notices.
      if (isAddressed(this.#config, message)) {
        await sendNotice(this.#bot, message.chat_id, '当前账号没有使用权限。请让管理员在插件设置里把你的 Open ID 加入白名单。', '无权限');
      }
      return;
    }
    const topic = this.#config.topicsEnabled === false ? null : this.#topicForMessage(message);
    const chatKey = topic ? `topic:${message.chat_id}:${topic.topicId}` : `chat:${message.chat_id}`;
    // Remember who spoke / who was mentioned so the model can @ them later.
    const wantsMentions = this.#config.mentions?.enabled !== false;
    const wantsName = wantsMentions || this.#config.eavesdrop?.enabled === true;
    const senderName = wantsName && openId ? await this.#senderName(openId) : null;
    const mentioned = new Map();
    if (wantsMentions) {
      this.#rememberParticipant(chatKey, openId, senderName);
      for (const mention of Array.isArray(message.mentions) ? message.mentions : []) {
        const mentionId = mention?.id?.open_id;
        if (!mentionId) continue;
        this.#rememberParticipant(chatKey, mentionId, mention.name);
        if (mentionId === this.#config.botOpenId) continue;
        const name = String(mention?.name ?? '').replace(/[<>&\r\n]/g, '').trim();
        mentioned.set(mentionId, name || mentionId);
      }
    }
    // 话题内只有 @机器人 才处理；话题外按 @ 或引用机器人处理
    const addressed = topic
      ? isAddressed(this.#config, message)
      : (isAddressed(this.#config, message) || await this.#isReplyToBot(message));
    if (!addressed) {
      this.#recordEavesdrop(chatKey, message, openId, senderName);
      return;
    }

    const text = (textOfContentOrPost(message) ?? '').replace(/@_user_\d+/g, '').trim();
    this.#chatTypes.set(chatKey, message.chat_type);

    if (topic && text) {
      const nested = COMMAND.exec(text);
      const nestedArg = String(nested?.[2] ?? '').trim().toLowerCase();
      if (nested && nested[1].toLowerCase() === 'topic' && nestedArg !== 'close') {
        // 话题里不能再嵌套开话题：要新话题请回群主会话 @ 机器人
        const notice = '话题里不能再创建话题。需要新话题时，请在群里直接 @ 我并发 `/topic 标题`。';
        try {
          if (typeof this.#bot.replyCardInThread === 'function') {
            await this.#bot.replyCardInThread(topic.rootMessageId, noticeCard(notice, '话题'));
          } else {
            await sendNotice(this.#bot, message.chat_id, notice, '话题');
          }
        } catch {
          await sendNotice(this.#bot, message.chat_id, notice, '话题');
        }
        return;
      }
    }
    if (text && this.#resolveTextDecision(chatKey, message.chat_id, openId, text)) return;

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

    const supported = ['text', 'post', 'image', 'file'];
    if (!supported.includes(message.message_type)) {
      await sendNotice(this.#bot, message.chat_id, '目前支持文字、图片和文件消息；语音和视频暂不支持。', '暂不支持');
      return;
    }

    let parts = text ? [{ type: 'text', text }] : [];
    if (message.message_type === 'image' || message.message_type === 'file' || message.message_type === 'post') {
      const built = await this.#inbound.build(message, text);
      parts = built.parts;
      if (!built.hasInput) {
        await sendNotice(this.#bot, message.chat_id, '这条消息里没有可处理的内容。', '无法处理');
        return;
      }
    }

    const submitPrompt = (promptParts, promptText) => this.#submitPrompt({
      chatKey,
      chatId: message.chat_id,
      chatType: message.chat_type,
      createTime: message.create_time,
      messageId: message.message_id,
      parts: promptParts,
      text: promptText,
      openId,
      people: [...mentioned.entries()].map(([id, name]) => ({ id, name })),
    });

    // A bare mention (or an empty text body) carries no instruction. If the
    // chat already has a Session, send a minimal user turn so the model can
    // answer; a chat without one gets the hint and no Session is created.
    if (parts.length === 0) {
      if (message.chat_type !== 'group') return;
      if (this.#state.sessionFor(chatKey)) {
        await this.#react(message.message_id, REACTION.processing);
        await submitPrompt([{ type: 'text', text: BARE_MENTION_PROMPT }], BARE_MENTION_PROMPT);
        return;
      }
      await this.#sendBareMentionHint(message.chat_id, topic);
      return;
    }

    await this.#react(message.message_id, REACTION.processing);
    await submitPrompt(parts, text);
  }

  /** Hint card for a bare group mention when the chat has no Session yet. */
  async #sendBareMentionHint(chatId, topic) {
    if (topic?.rootMessageId && typeof this.#bot.replyCardInThread === 'function') {
      try {
        await this.#bot.replyCardInThread(topic.rootMessageId, noticeCard(BARE_MENTION_HINT, '在的', 'blue'));
        return;
      } catch {
        // Fall through to a normal chat card.
      }
    }
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

  /** Topic metadata for a chat key (`chat:` or `topic:`). */
  #topicOf(chatKey) {
    if (!chatKey?.startsWith('topic:')) return { topic: null };
    const [, chatId, topicId] = chatKey.split(':');
    return { topic: this.#state.topicFor?.(chatId, Number(topicId)) ?? null };
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
        return { kind: 'feishu', chatKey: origin.chatKey, chatId: origin.chatId, ...this.#topicOf(origin.chatKey) };
      }
    }
    if (source?.kind === 'schedule') {
      const chatKey = this.#state.keyForSession(sessionId);
      const chatId = chatIdOfKey(chatKey);
      if (!chatId) return null;
      return { kind: 'schedule', chatKey, chatId, ...this.#topicOf(chatKey) };
    }
    if (source?.kind === 'user') return { kind: 'external', chatKey: null, chatId: null, topic: null };
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
    }, this.#config.eavesdrop.limit ?? 0);
  }

  /** Keep the people seen in this chat/topic so mentions can be validated. */
  #rememberParticipant(chatKey, openId, name) {
    if (!openId || openId === this.#config.botOpenId) return;
    let people = this.#participants.get(chatKey);
    if (!people) {
      people = new Map();
      this.#participants.set(chatKey, people);
    }
    const current = people.get(openId);
    people.set(openId, name || current || null);
  }

  /** open_id → name for everyone the model could legitimately @ here. */
  #mentionDirectory(chatKey) {
    const directory = new Map();
    for (const [id, name] of this.#participants.get(chatKey) ?? []) {
      directory.set(id, name || id);
    }
    return directory;
  }

  #renderMentions(text, chatKey, mode) {
    const config = this.#config.mentions ?? {};
    return renderMentions(text, {
      mode,
      enabled: config.enabled !== false,
      allowAll: config.allowAll === true,
      directory: this.#mentionDirectory(chatKey),
    });
  }

  /** Fixed guidance appended to the Feishu session context. */
  #mentionHint() {
    return this.#config.mentions?.enabled !== false
      ? '默认 @ 规则（必须遵守）：涉及需要某人做决策、批准、确认、选择或答复时，一律 @ 到该当事人；纯信息同步、状态汇报、闲聊、感谢等不需要对方行动时不要 @。需要 @ 时直接输出 <at id=ou_xxx></at>，open_id 只能取自本会话上下文中出现的人；不确定具体当事人时不要 @，不要猜 id。'
      : '';
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

  async #submitPrompt({ chatKey, chatId, chatType, createTime, messageId, parts, text, openId, people = [] }) {
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
      await this.#state.setSessionMeta?.(created, {
        workspace: workspace || null,
        preset: preset ?? null,
        model: override.model ?? this.#config.model ?? null,
        origin: 'feishu',
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
    const rawGuidance = renderGuidanceBlock(scope) ?? '';
    // 话题同步来的摘要属于"会话数据"，跟 source 一样作为消息前置块，而不是常驻指令。
    let syncBlock = null;
    if (chatKey.startsWith('chat:')) {
      const synced = this.#state.syncedFor?.(chatId) ?? [];
      if (synced.length > 0) {
        const lines = synced.map((item) => `- 话题 #${item.topicId}「${item.title}」：${item.summary}`);
        syncBlock = ['<feishu_bot_topic_sync>', ...lines, '</feishu_bot_topic_sync>'].join('\n');
      }
    }
    // People mentioned in this message: gives the model their open_ids even
    // though the mention placeholders are stripped from the user text.
    let peopleBlock = null;
    if (this.#config.mentions?.enabled !== false && people.length > 0) {
      const lines = people.map((person) => `${person.name || person.id}(${person.id})`);
      peopleBlock = ['<feishu_bot_people>', `本条消息提到的人：${lines.join('、')}`, '</feishu_bot_people>'].join('\n');
    }
    // The injected blocks ride the prompt as leading text parts; the Host-side
    // pre-step rewrite turns each one into its own producer-owned row.
    const content = [
      ...(sourceBlock ? [{ type: 'text', text: sourceBlock }] : []),
      ...(peopleBlock ? [{ type: 'text', text: peopleBlock }] : []),
      ...(eavesdropBlock ? [{ type: 'text', text: eavesdropBlock }] : []),
      ...(syncBlock ? [{ type: 'text', text: syncBlock }] : []),
      ...parts,
    ];

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
        this.#trackReaction(sessionId, messageId, mode);
        // Set the per-session context before submitting so the first prompt
        // also sees the mention guidance; systemPrompt.context is read while
        // the Host builds the turn.
        const mentionHint = this.#mentionHint();
        this.#onContext(sessionId, this.#state.originOf?.(sessionId) === 'feishu'
          ? [rawGuidance, mentionHint].filter(Boolean).join('\n\n')
          : '');
        await this.#promptFeishu(sessionId, content, { mode, chatKey, chatId });
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
  async #senderName(openId) {
    if (!openId) return null;
    const cached = this.#userNames.get(openId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;
    const name = await Promise.resolve(this.#bot.getUserName?.(openId)).catch(() => null) ?? null;
    this.#userNames.set(openId, { name, expiresAt: Date.now() + 30 * 60_000 });
    return name;
  }

  /**
   * A schedule reminder has no sender of its own. Its prompt is the user's
   * instruction, so ids explicitly written there are legitimate @ targets even
   * after a restart emptied the in-memory roster.
   */
  async #seedScheduleMentions(sessionId, content) {
    if (this.#config.mentions?.enabled === false) return;
    const chatKey = this.#state.keyForSession?.(sessionId);
    if (!chatKey) return;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => (part?.type === 'text' ? String(part.text ?? '') : '')).join('\n')
        : '';
    for (const id of extractMentionIds(text).slice(0, 20)) {
      if (id === 'all' || id === this.#config.botOpenId) continue;
      const name = await this.#senderName(id);
      this.#rememberParticipant(chatKey, id, name);
    }
  }

  /** Message that belongs to a topic: a reply to its card or a thread post. */
  #topicForMessage(message) {
    const rootId = message?.root_id ?? message?.parent_id;
    const byRoot = rootId
      ? Object.values(this.#state.topics ?? {}).find((topic) => topic.rootMessageId === rootId)
      : null;
    if (byRoot) return byRoot;
    const threadId = message?.thread_id;
    if (typeof threadId === 'string') {
      for (const topic of Object.values(this.#state.topics ?? {})) {
        if (topic.threadId === threadId) return topic;
      }
    }
    return null;
  }

  /** Create an independent Session for one piece of work and announce it. */
  async openTopic({ chatId, title, content, rootMessageId = null }) {
    const body = String(content ?? '').trim();
    const cleanTitle = String(title ?? '').trim().slice(0, 20) || body.split('\n')[0].slice(0, 20).trim();
    if (!cleanTitle) throw new Error('topic title required');

    const sourceSession = this.#state.sessionFor(`chat:${chatId}`);
    const sourceMeta = (this.#state.value.meta ?? {})[sourceSession] ?? {};
    const workspace = sourceMeta.workspace ?? this.#config.workspace ?? undefined;
    const preset = sourceMeta.preset ?? this.#config.agentPreset ?? undefined;
    const model = sourceMeta.model
      ?? (sourceSession ? this.#sessionModels.get(sourceSession) : null)
      ?? this.#config.model
      ?? null;

    let workspaceId = workspace
      ? await this.#harness.resolveWorkspaceId(workspace).catch(() => null)
      : null;
    if (workspace && !workspaceId) {
      workspaceId = await this.#harness.ensureWorkspace(workspace).catch(() => null);
    }
    const sessionId = await this.#harness.createSession(workspaceId
      ? { workspaceId, agentPreset: preset }
      : { cwd: workspace, agentPreset: preset });
    await this.#state.setSessionMeta?.(sessionId, {
      workspace: workspace || null, preset: preset ?? null, model, origin: 'feishu',
    });
    if (model) await this.#harness.selectModel(sessionId, model).catch(() => undefined);
    await this.#applyPermission(sessionId, chatId);

    const topic = await this.#state.createTopic({
      chatId, title: cleanTitle, brief: body.slice(0, 1000), sessionId, rootMessageId,
    });
    await this.#state.bindSession(`topic:${chatId}:${topic.topicId}`, sessionId);
    const guidance = renderGuidanceBlock(this.#contextScope('group')) ?? '';
    const contextText = [guidance, this.#mentionHint()].filter(Boolean).join('\n\n');
    if (contextText) this.#onContext(sessionId, contextText);
    const topicKey = `topic:${chatId}:${topic.topicId}`;
    await this.#promptFeishu(sessionId, [{ type: 'text', text: body || cleanTitle }], { mode: 'queue', chatKey: topicKey, chatId })
      .catch((error) => this.#log('warn', 'topic prompt failed', error));
    return topic;
  }

  /** Ask the topic Session for a summary; the answer is synced back on turn end. */
  async syncTopic(chatId, topicId) {
    const topic = this.#state.topicFor?.(chatId, Number(topicId));
    if (!topic) return null;
    await this.#state.updateTopic(chatId, topic.topicId, { syncRequested: true });
    await this.#promptFeishu(topic.sessionId, [{
      type: 'text',
      text: '请用简洁要点总结到目前为止这个话题的讨论结论（不超过 300 字，直接给结论，不要复述过程）。',
    }], { mode: 'queue', chatKey: `topic:${chatId}:${topic.topicId}`, chatId }).catch((error) => this.#log('warn', 'topic sync prompt failed', error));
    return topic;
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

  /** A reply to one of our messages counts as addressed, even without @. */
  async #isReplyToBot(message) {
    const parentId = message?.parent_id;
    if (!parentId) return false;
    const parent = await Promise.resolve(this.#bot.getMessage?.(parentId)).catch(() => null);
    if (!parent) return false;
    if (parent.senderType === 'app') return true;
    return Boolean(this.#config.botOpenId && parent.senderId === this.#config.botOpenId);
  }

  /** Private-chat or group enhancement scope. */
  #contextScope(chatType) {
    const scopes = this.#config.contextEnhancement ?? {};
    return scopes[chatType === 'p2p' ? 'direct' : 'group'];
  }

  // ── commands ──────────────────────────────────────────────────────────────

  /** Group management (including approvals) is restricted to the manager list. */
  #canManage(chatKey, operatorId) {
    const chatType = this.#chatTypes.get(chatKey);
    if (chatType !== 'group') return true;
    const managers = this.#config.access?.managers ?? [];
    if (managers.length === 0) return false; // 默认无人可执行群内管理操作
    return Boolean(operatorId) && managers.includes(operatorId);
  }

  async #runCommand(name, argument, context) {
    if ((name === 'topic' || name === 'topic-sync') && this.#config.topicsEnabled === false) {
      await sendNotice(this.#bot, context.chatId, '话题功能已关闭，可在机器人设置里开启。', '话题已关闭');
      return true;
    }
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
      version: this.#version,
      config: () => this.#config,
      setConfig: (next) => {
        this.#config = next;
        return next;
      },
      saveWorkspace: (value) => this.#saveWorkspace(value),
      forgetSession: (sessionId) => {
        const key = typeof sessionId === 'string' ? this.#state.keyForSession?.(sessionId) : null;
        if (key) this.#eavesdrop.reset(key);
        this.#forgetSessionOrigin(sessionId);
      },
      externalAsk: (sessionId) => this.#externalAsk.get(sessionId) ?? null,
      listPresets: () => this.#listPresets(),
      modelFor: (sessionId) => this.#sessionModels.get(sessionId) ?? null,
      rememberModel: (sessionId, selection) => {
        if (typeof sessionId !== 'string') return selection;
        this.#sessionModels.set(sessionId, selection);
        if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
        return selection;
      },
      savePreset: (value) => this.#savePreset(value),
      saveModel: (value) => this.#saveModel(value),
      openTopic: (input) => this.openTopic(input),
      showTopics: async (chatId) => {
        const topics = this.#state.topicsOf?.(chatId) ?? [];
        if (topics.length === 0) {
          await sendNotice(this.#bot, chatId, '还没有话题。发送 `/topic 标题` + 换行写正文即可开启。', '话题');
          return;
        }
        const lines = topics.map((topic) => `#${topic.topicId} ${topic.title}`);
        await sendNotice(this.#bot, chatId, ['话题列表：', ...lines].join('\n'), '话题列表');
      },
      syncTopic: (chatId, topicId) => this.syncTopic(chatId, topicId),
      log: (level, message, error) => this.#log(level, message, error),
    };
  }

  // ── turn events（实现在 turn.js） ──────────────────────────────────────────

  /** Remember which inbound message a turn will settle, keyed by Session. */
  #trackReaction(sessionId, messageId, mode) {
    if (!sessionId || !messageId) return;
    const active = this.#reactionActive.get(sessionId);
    if (mode === 'steer' && active && active.size > 0) {
      active.add(messageId);
      return;
    }
    const queue = this.#reactionQueue.get(sessionId) ?? [];
    queue.push(messageId);
    this.#reactionQueue.set(sessionId, queue);
  }

  /** Drop a queued/active message without changing its reaction (retry path). */
  #forgetReaction(sessionId, messageId) {
    if (!sessionId || !messageId) return;
    const queue = this.#reactionQueue.get(sessionId);
    if (queue) {
      const index = queue.indexOf(messageId);
      if (index >= 0) queue.splice(index, 1);
      if (queue.length === 0) this.#reactionQueue.delete(sessionId);
    }
    this.#reactionActive.get(sessionId)?.delete(messageId);
  }

  /** Prompt never became a turn: drop it from the queues and mark it stopped. */
  async #abortReaction(sessionId, messageId) {
    this.#forgetReaction(sessionId, messageId);
    if (messageId) await this.#react(messageId, REACTION.stopped).catch(() => undefined);
  }

  /** A turn started: everything queued so far belongs to this turn. */
  #startTurnReactions(sessionId) {
    const queue = this.#reactionQueue.get(sessionId);
    if (!queue || queue.length === 0) return;
    this.#reactionQueue.delete(sessionId);
    const active = this.#reactionActive.get(sessionId) ?? new Set();
    for (const messageId of queue) active.add(messageId);
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
    if (event?.type === 'user/message' && event.data?.source?.kind === 'schedule') {
      await this.#seedScheduleMentions(session?.id, event.data?.content);
    }
    const sessionId = session?.id;
    if (sessionId && event?.type === 'turn/start') this.#startTurnReactions(sessionId);
    const result = await this.#turns.onSessionEvent(session, event);
    if (sessionId && event?.type === 'turn/end') {
      this.#turnOrigin.delete(sessionId);
      this.#externalAsk.delete(sessionId);
      await this.#settleTurnReactions(sessionId, event?.data?.reason).catch(() => undefined);
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

  #findApprovalId(request) {
    const events = typeof request?.agent?.session?.snapshotEvents === 'function'
      ? request.agent.session.snapshotEvents()
      : (request?.agent?.session?.events ?? []);
    if (!Array.isArray(events)) return null;
    const decided = new Set();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event?.type === 'approval/decided') decided.add(event.data?.id);
      if (event?.type !== 'approval/asked') continue;
      const id = event.data?.id;
      if (!id || decided.has(id)) continue;
      if ((request.callId ?? null) !== (event.data?.callId ?? null)) continue;
      return id;
    }
    return null;
  }

  #track(entry) {
    this.#pending.set(entry.id, entry);
    const set = this.#pendingByChat.get(entry.chatId) ?? new Set();
    set.add(entry.id);
    this.#pendingByChat.set(entry.chatId, set);
    return entry;
  }

  #untrack(id) {
    const entry = this.#pending.get(id);
    if (!entry) return null;
    this.#pending.delete(id);
    const set = this.#pendingByChat.get(entry.chatId);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.#pendingByChat.delete(entry.chatId);
    }
    return entry;
  }

  #settle(id, value) {
    const entry = this.#untrack(id);
    if (!entry) return null;
    entry.resolve(value);
    return entry;
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
    if (request.signal?.aborted) return 'cancelled';
    const approvalId = this.#findApprovalId(request);
    if (!approvalId) return next();
    if (this.#pending.has(approvalId)) return next();

    const im = new Promise((resolve) => {
      this.#track({
        id: approvalId,
        kind: 'approval',
        chatId,
        chatKey,
        messageId: null,
        resolve,
      });
    });

    void this.#bot.sendCard(chatId, approvalCard({
      toolName: request.toolName,
      reason: request.reason,
      approvalId,
    })).then((messageId) => {
      const entry = this.#pending.get(approvalId);
      if (entry) entry.messageId = messageId;
    }).catch((error) => {
      this.#log('warn', 'approval card failed', error);
    });

    const onAbort = () => {
      const entry = this.#untrack(approvalId);
      entry?.resolve('cancelled');
    };
    request.signal?.addEventListener('abort', onAbort, { once: true });

    const native = Promise.resolve().then(() => next()).then(
      (outcome) => outcome,
      () => new Promise(() => {}),
    );

    try {
      // A pure-IM turn has no Web answerer: never wait forever on a lost card.
      const timeout = new Promise((resolve) => {
        const timer = setTimeout(() => resolve('cancelled'), 10 * 60_000);
        timer.unref?.();
      });
      const outcome = await Promise.race([native, im, timeout]);
      const entry = this.#pending.get(approvalId);
      if (entry?.messageId) {
        void this.#bot.patchCard(entry.messageId, approvalCard({ approvalId, resolvedText: resolvedApprovalText(outcome) }))
          .catch(() => undefined);
      }
      this.#untrack(approvalId);
      return outcome;
    } finally {
      request.signal?.removeEventListener('abort', onAbort);
      this.#untrack(approvalId);
    }
  }

  /** Ask the chat one question; a single-select answer comes back as a choice. */
  async handleQuestion(request, next) {
    const sessionId = request?.agent?.session?.id;
    const chatId = sessionId ? this.#chatContextFor(sessionId)?.chatId ?? null : null;
    const question = Array.isArray(request?.questions) ? request.questions[0] : null;
    if (!chatId || !question) return next();
    // 绑定会话里 Web 发起的轮次：提问留在 Web，不打扰飞书；只记下摘要供 /stop 说明。
    if (sessionId && this.#turnOrigin.get(sessionId) === 'external') {
      this.#rememberExternalAsk(sessionId, '回答', question?.question ?? question?.header ?? '一个问题');
      return next();
    }
    if (question.multiSelect === true) return next();

    const questionId = question.id ?? 'q';
    const im = new Promise((resolve) => {
      this.#track({ id: questionId, kind: 'question', chatId, messageId: null, question, resolve });
    });

    void this.#bot.sendCard(chatId, questionCard({
      question: question.question ?? question.header,
      options: question.options ?? [],
      questionId,
    })).then((messageId) => {
      const entry = this.#pending.get(questionId);
      if (entry) entry.messageId = messageId;
    }).catch((error) => {
      this.#log('warn', 'question card failed', error);
    });

    const native = Promise.resolve().then(() => next()).then(
      (answer) => answer,
      () => new Promise(() => {}),
    );

    const timeout = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('the question timed out waiting for a Feishu answer');
        error.code = 'ASK_ABORTED';
        reject(error);
      }, 10 * 60_000);
      timer.unref?.();
    });
    const answer = await Promise.race([native, im, timeout]);
    const entry = this.#pending.get(questionId);
    if (entry?.messageId && answer) {
      const selected = answer?.answers?.[0]?.selected?.join(', ') ?? '';
      void this.#bot.patchCard(entry.messageId, questionCard({
        questionId,
        resolvedText: selected ? `✅ 已选择：${selected}` : '✅ 已回答',
      })).catch(() => undefined);
    }
    this.#untrack(questionId);
    return answer;
  }

  /** Card button press: `approve:<id>` / `reject:<id>` / `answer:<id>:<index>`. */
  async onCardAction(event) {
    this.#logEvent('card-action', String(event?.action?.value?.action ?? '-'));
    const value = event?.action?.value;
    const action = typeof value?.action === 'string' ? value.action : null;
    if (!action) return undefined;
    const operator = event?.operator?.open_id ?? event?.operator?.operator_id?.open_id ?? null;
    if (operator && this.#config.botOpenId && operator === this.#config.botOpenId) return undefined;

    if (action === 'session_pick' || action === 'workspace_pick' || action === 'new_session'
      || action === 'model_pick' || action === 'reasoning_pick'
      || action === 'menu_apply' || action === 'menu_cancel' || action === 'stats_toggle' || action === 'tools_toggle'
      || action === 'ns_workspace' || action === 'ns_model' || action === 'ns_reasoning' || action === 'ns_preset'
      || action === 'new_session_create' || action === 'new_session_cancel' || action === 'compact' || action === 'menu_close') {
      return this.#handleMenuAction(action, event);
    }
    const [kind, id, indexRaw] = action.split(':');
    if (kind === 'approve' || kind === 'reject') {
      const entry = this.#pending.get(id);
      if (!entry || entry.kind !== 'approval') return { toast: { type: 'info', content: '这条审批已失效' } };
      if (operator && entry.chatId !== event?.context?.open_chat_id) {
        return { toast: { type: 'info', content: '只能在发起审批的会话里操作' } };
      }
      if (!this.#canManage(entry.chatKey ?? `chat:${entry.chatId}`, operator)) {
        return { toast: { type: 'warning', content: '只有管理员可以在群里审批' } };
      }
      this.#settle(id, kind === 'approve' ? 'allowed-once' : 'rejected');
      if (entry.messageId) {
        await this.#bot.patchCard(entry.messageId, approvalCard({
          approvalId: id,
          resolvedText: resolvedApprovalText(kind === 'approve' ? 'allowed-once' : 'rejected'),
        })).catch(() => undefined);
      }
      return { toast: { type: 'success', content: kind === 'approve' ? '已批准' : '已拒绝' } };
    }
    if (kind === 'answer') {
      const entry = this.#pending.get(id);
      if (!entry || entry.kind !== 'question') return { toast: { type: 'info', content: '这个问题已回答或失效' } };
      const index = Number.parseInt(indexRaw ?? '', 10);
      const option = entry.question?.options?.[index];
      if (!option) return { toast: { type: 'info', content: '这个选项已失效' } };
      this.#settle(id, {
        answers: [{ id: entry.question.id ?? id, selected: [option.label] }],
      });
      return { toast: { type: 'success', content: '已提交选择' } };
    }
    return undefined;
  }

  /** Text fallback: 批准 / 拒绝（或 yes / no）answers a pending approval. */
  #resolveTextDecision(chatKey, chatId, openId, text) {
    const normalized = text.trim().toLowerCase();
    const approve = /^(批准|同意|允许|yes|y|ok)$/i.test(normalized);
    const reject = /^(拒绝|不同意|deny|no|n)$/i.test(normalized);
    if (!approve && !reject) return false;
    const ids = this.#pendingByChat.get(chatId);
    if (!ids || ids.size === 0) return false;
    for (const id of ids) {
      const entry = this.#pending.get(id);
      if (!entry || entry.kind !== 'approval') continue;
      if (!this.#canManage(chatKey, openId)) {
        void sendNotice(this.#bot, chatId, '只有管理员可以审批。', '需要管理员', 'orange');
        return true;
      }
      this.#settle(id, approve ? 'allowed-once' : 'rejected');
      if (entry.messageId) {
        void this.#bot.patchCard(entry.messageId, approvalCard({
          approvalId: id,
          resolvedText: resolvedApprovalText(approve ? 'allowed-once' : 'rejected'),
        })).catch(() => undefined);
      }
      void sendNotice(this.#bot, chatId, approve ? '✅ 已批准一次。' : '🚫 已拒绝。', '审批结果', approve ? 'green' : 'red');
      return true;
    }
    return false;
  }


  #optionOf(event) {
    const option = event?.action?.option ?? event?.action?.value?.option;
    if (typeof option === 'string') return option;
    if (Array.isArray(option) && typeof option[0] === 'string') return option[0];
    if (option && typeof option === 'object' && typeof option.value === 'string') return option.value;
    return null;
  }

  #chatKeyOf(chatId) {
    return `chat:${chatId}`;
  }

  async #handleMenuAction(action, event) {
    const chatId = event?.context?.open_chat_id ?? null;
    const messageId = event?.context?.open_message_id ?? null;
    if (!chatId) return { toast: { type: 'info', content: '会话信息缺失' } };
    const chatKey = this.#chatKeyOf(chatId);
    const option = this.#optionOf(event);
    const operator = event?.operator?.open_id ?? event?.operator?.operator_id?.open_id ?? null;
    const services = this.#services();
    const pickers = new Set(['session_pick', 'workspace_pick', 'model_pick', 'reasoning_pick']);
    const managedActions = new Set(['menu_apply', 'new_session', 'new_session_create', 'compact', 'stats_toggle', 'tools_toggle']);
    if (managedActions.has(action) && !this.#canManage(chatKey, operator)) {
      return { toast: { type: 'warning', content: '只有管理员可以在群里执行这个操作' } };
    }
    const draftPickers = new Set(['ns_workspace', 'ns_model', 'ns_reasoning', 'ns_preset']);

    if (pickers.has(action)) {
      if (!option) return { toast: { type: 'info', content: '没有选择任何值' } };
      const data = await collectMenuData(services, chatKey);
      if (option === currentMenuValue(data, action)) {
        this.#menuPending.get(chatKey)?.delete(action);
        return undefined;
      }
      const label = menuOptionLabel(data, action, option);
      const pending = this.#menuPending.get(chatKey) ?? new Map();
      pending.set(action, { action, value: option, label });
      this.#menuPending.set(chatKey, pending);
      // 静默记录：下拉每次选择都会回调，提示音会变成噪音，点「调整」时才反馈
      return undefined;
    }

    if (action === 'menu_apply') {
      const pending = this.#menuPending.get(chatKey);
      if (!pending || pending.size === 0) {
        return { toast: { type: 'info', content: '没有待应用的变更' } };
      }
      this.#menuPending.delete(chatKey);
      // 顺序：工作区会解绑会话，先做；随后再绑定会话、切换模型与强度。
      const order = ['workspace_pick', 'session_pick', 'model_pick', 'reasoning_pick'];
      const items = [];
      for (const kind of order) {
        const item = pending.get(kind);
        if (!item) continue;
        const result = await this.#applyMenuChoice(item, { chatId, chatKey, silent: true });
        if (!result?.ok) return result?.toast ?? { toast: { type: 'warning', content: '切换失败' } };
        items.push({ title: item.label, detail: result.detail ?? '' });
      }
      if (items.length > 0) {
        await this.#bot.sendCard(chatId, adjustCard({ items }))
          .catch(() => this.#bot.sendText(chatId, `已调整：${items.map((item) => item.title).join('、')}`));
      }
      return { toast: { type: 'success', content: `已应用 ${items.length} 项变更` } };
    }

    if (action === 'new_session') {
      const data = await collectMenuData(services, chatKey);
      const draft = this.#newSessionDraft.get(chatKey) ?? {};
      const model = draft.model ?? data.model ?? null;
      await this.#bot.sendCard(chatId, newSessionCard({
        workspaces: data.workspaces,
        models: data.models.map((item) => ({
          ...item,
          current: model ? item.value === `${model.provider}/${model.model}` : item.current,
        })),
        efforts: (data.efforts ?? []).map((item) => ({
          ...item,
          current: model?.reasoningEffort ? item.value === model.reasoningEffort : item.current,
        })),
        presets: data.presets,
        draft: { workspace: draft.workspace ?? data.currentWorkspace },
      }));
      return { toast: { type: 'info', content: '请在新卡片里设置后点「创建」' } };
    }
    if (draftPickers.has(action)) {
      if (!option) return undefined;
      const draft = { ...(this.#newSessionDraft.get(chatKey) ?? {}) };
      if (action === 'ns_workspace') draft.workspace = option;
      if (action === 'ns_preset') draft.preset = option;
      if (action === 'ns_model') {
        const [provider, ...rest] = option.split('/');
        draft.model = { provider, model: rest.join('/') };
      }
      if (action === 'ns_reasoning') {
        draft.model = { ...(draft.model ?? {}), reasoningEffort: option };
      }
      this.#newSessionDraft.set(chatKey, draft);
      return undefined;
    }
    if (action === 'new_session_create') {
      const draft = this.#newSessionDraft.get(chatKey) ?? {};
      this.#newSessionDraft.delete(chatKey);
      const previous = this.#state.sessionFor(chatKey);
      await this.#state.unbindSession(chatKey);
      this.#eavesdrop.reset(chatKey);
      this.#forgetSessionOrigin(previous);
      await this.#state.setOverride?.(chatKey, {
        workspace: draft.workspace ?? null,
        model: draft.model ?? null,
        preset: draft.preset ?? null,
      });
      const readyText = '已按所选配置准备新会话，发送任意消息即可开始。';
      return {
        toast: { type: 'success', content: '新会话已就绪' },
        card: { type: 'raw', data: noticeCard(readyText, '新会话已就绪') },
      };
    }
    if (action === 'compact') {
      const sessionId = this.#state.sessionFor(chatKey);
      if (!sessionId) return { toast: { type: 'info', content: '当前还没有可压缩的会话' } };
      try {
        const value = await this.#harness.compact?.(sessionId);
        const result = value?.result ?? value ?? {};
        if (result.kind === 'error') {
          return { toast: { type: 'warning', content: result.text ?? '压缩失败' } };
        }
        const text = result.text === 'No compactable history yet.' ? '没有可压缩的历史。' : (result.text ?? '已触发压缩');
        await sendNotice(this.#bot, chatId, `上下文压缩：${text}`, '上下文压缩');
        return { toast: { type: 'success', content: '压缩完成' } };
      } catch (error) {
        return { toast: { type: 'warning', content: `压缩失败：${error.message}` } };
      }
    }
    if (action === 'new_session_cancel') {
      this.#newSessionDraft.delete(chatKey);
      if (messageId) await this.#bot.deleteMessage?.(messageId).catch(() => undefined);
      return undefined;
    }
    if (action === 'stats_toggle' || action === 'tools_toggle') {
      const isStats = action === 'stats_toggle';
      const enabled = isStats
        ? this.#state.statsFor?.(chatKey) === true
        : this.#state.toolsFor?.(chatKey) === true;
      if (isStats) await this.#state.setStats?.(chatKey, !enabled);
      else await this.#state.setTools?.(chatKey, !enabled);
      // The rebuilt menu shows current values; drop hidden pending picks.
      this.#menuPending.delete(chatKey);
      const card = await buildMenuCard(services, { chatKey });
      return {
        toast: { type: 'success', content: `${isStats ? 'Token 统计' : '工具调用'}已${enabled ? '关闭' : '开启'}` },
        card: { type: 'raw', data: card },
      };
    }
    if (action === 'menu_close') {
      // Closing discards unapplied dropdown picks and any new-session draft.
      this.#menuPending.delete(chatKey);
      this.#newSessionDraft.delete(chatKey);
      if (messageId) await this.#bot.deleteMessage?.(messageId).catch(() => undefined);
      return undefined;
    }
    return undefined;
  }

  /** Apply one pending menu choice; returns { ok, detail, toast }. */
  async #applyMenuChoice(pending, { chatId, chatKey, silent = false }) {
    const sessionId = this.#state.sessionFor(chatKey);
    if (pending.action === 'session_pick') {
      const sessions = await this.#harness.listSessions().catch(() => []);
      if (!sessions.some((item) => item.sessionId === pending.value)) {
        return { ok: false, toast: { type: 'warning', content: '这个会话已不存在' } };
      }
      const previous = this.#state.sessionFor(chatKey);
      await this.#state.bindSession(chatKey, pending.value);
      if (previous && previous !== pending.value) {
        this.#eavesdrop.reset(chatKey);
        this.#forgetSessionOrigin(previous);
      }
      if (!silent) await sendNotice(this.#bot, chatId, `已绑定会话：${pending.label}`, '会话已绑定');
      return { ok: true, detail: '后续消息进入该会话' };
    }
    if (pending.action === 'workspace_pick') {
      await this.#state.setOverride?.(chatKey, { workspace: pending.value });
      await this.#state.unbindSession(chatKey);
      this.#eavesdrop.reset(chatKey);
      this.#forgetSessionOrigin(sessionId);
      if (!silent) await sendNotice(this.#bot, chatId, `工作区已切换为 ${pending.value}`, '工作区已切换');
      return { ok: true, detail: '下一条消息会在该目录新建会话' };
    }
    if (pending.action === 'model_pick') {
      const [provider, ...rest] = pending.value.split('/');
      const selection = { provider, model: rest.join('/') };
      if (sessionId) {
        await this.#harness.selectModel(sessionId, selection).catch((error) => this.#log('warn', 'selectModel failed', error));
        this.#sessionModels.set(sessionId, selection);
        if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
        if (!silent) await sendNotice(this.#bot, chatId, `模型已切换为 ${pending.value}`, '模型已切换');
        return { ok: true, detail: '当前会话立即生效' };
      }
      await this.#state.setOverride?.(chatKey, { model: selection });
      if (!silent) await sendNotice(this.#bot, chatId, `模型已切换为 ${pending.value}`, '模型已切换');
      return { ok: true, detail: '下一条消息的新会话生效' };
    }
    if (pending.action === 'reasoning_pick') {
      const current = sessionId ? this.#sessionModels.get(sessionId) : (this.#state.overrideFor?.(chatKey).model ?? null);
      const selection = { ...(current ?? {}), reasoningEffort: pending.value };
      if (sessionId) {
        await this.#harness.selectModel(sessionId, selection).catch((error) => this.#log('warn', 'selectReasoning failed', error));
        this.#sessionModels.set(sessionId, selection);
        if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
      } else {
        await this.#state.setOverride?.(chatKey, { model: selection });
      }
      if (!silent) await sendNotice(this.#bot, chatId, `思考强度已切换为 ${pending.value}`, '思考强度已切换');
      return { ok: true, detail: sessionId ? '当前会话立即生效' : '下一条消息的新会话生效' };
    }
    return { ok: false, toast: { type: 'info', content: '没有待切换项' } };
  }

  /** Live assistant tokens: refresh the same card while the model streams. */

}
