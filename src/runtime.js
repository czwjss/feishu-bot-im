/**
 * Per-bot runtime plus the manager that owns every configured bot.
 *
 * Each bot has its own credential ref, state file, long connection, bridge and
 * settings; the manager routes Host events to the bot that owns the Session.
 */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';

import { validateContextEnhancementConfig } from './context-enhancement.js';
import { secretRefFor } from './config.js';
import { chatIdOfKey } from './message-text.js';
import { FeishuBot, verifyCredentials } from './feishu.js';
import { FeishuBridge } from './bridge.js';
import { normalizeCardColor, noticeCard } from './cards.js';
import { describeMessageForEavesdrop } from './eavesdrop.js';
import { imageKeysOf } from './inbound.js';
import { messageImageKey } from './message-image-tool.js';
import { RegistrationManager } from './registration.js';
import { syncSlashCommands } from './slash-commands.js';
import { boundedInteger, historyOptions, historyTimeRange, validateCardText } from './tool-contract.js';

/** 扫码补齐权限时，由二维码携带的目标配置。 */
export const REQUIRED_SCOPES = Object.freeze([
  'im:message.p2p_msg:readonly',
  'im:message.group_at_msg:readonly',
  'im:message.group_msg',
  'im:message:send_as_bot',
  'im:resource',
  'contact:user.base:readonly',
  'im:chat:readonly',
  'im:chat.members:read',
  'cardkit:card:write',
]);
export const REQUIRED_EVENTS = Object.freeze(['im.message.receive_v1']);


const STATES = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
});

export class BotRuntime {
  #ctx;
  #configStore;
  #stateStore;
  #harness;
  #logger;
  #version;
  #dataDir;
  #verify;
  #createBot;
  #botId;
  #bot = null;
  #bridge = null;
  #state = STATES.IDLE;
  #stateSince = new Date().toISOString();
  #lastError = null;
  #statusTimer = null;
  #presetSource = null;
  #handoffKeywords = null;
  #contexts = new Map();
  #disposed = false;

  constructor({ ctx, botId, configStore, stateStore, harness, logger, version, dataDir, verify, createBot, handoffKeywords = null }) {
    this.#ctx = ctx;
    this.#botId = botId;
    this.#configStore = configStore;
    this.#stateStore = stateStore;
    this.#harness = harness;
    this.#logger = logger ?? console;
    this.#version = version;
    this.#dataDir = dataDir;
    this.#verify = verify ?? verifyCredentials;
    this.#createBot = createBot ?? ((options) => new FeishuBot(options));
    this.#handoffKeywords = handoffKeywords;
  }

  get botId() {
    return this.#botId;
  }

  get state() {
    return this.#state;
  }

  get config() {
    return this.#configStore.bot(this.#botId);
  }

  #log(level, message, error) {
    const fn = this.#logger?.[level] ?? this.#logger?.info;
    if (typeof fn === 'function') fn.call(this.#logger, `[im-feishu:${this.#botId}] ${message}`, ...(error ? [error] : []));
  }

  handlesSession(sessionId) {
    return typeof this.#stateStore.keyForSession(sessionId) === 'string';
  }

  chatKeyForSession(sessionId) {
    return this.#stateStore.keyForSession(sessionId);
  }

  get sessionBindings() {
    return this.#stateStore.value.sessions;
  }

  #writeStatus() {
    if (!this.#dataDir || this.#disposed) return;
    const config = this.config ?? {};
    const snapshot = {
      botId: this.#botId,
      state: this.#state,
      since: this.#stateSince,
      updatedAt: new Date().toISOString(),
      appId: config.appId ?? null,
      alias: config.alias ?? null,
      botName: config.botName ?? null,
      ws: this.#bot?.connectionStatus?.() ?? null,
      inbound: this.#bridge?.stats?.() ?? null,
      lastError: this.#lastError,
    };
    void mkdir(this.#dataDir, { recursive: true })
      .then(() => writeFile(join(this.#dataDir, `status-${this.#botId}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 }))
      .catch(() => undefined);
  }

  #startStatusPolling() {
    if (this.#statusTimer) return;
    this.#statusTimer = setInterval(() => {
      const ws = this.#bot?.connectionStatus?.();
      if (ws && this.#state === STATES.CONNECTED && ws.state !== 'connected') {
        this.#lastError = { code: `ws-${ws.state}`, message: `长连接状态：${ws.state}`, at: new Date().toISOString() };
        this.#setState(ws.state === 'reconnecting' ? STATES.RECONNECTING : STATES.ERROR);
        return;
      }
      if (ws && this.#state !== STATES.CONNECTED && ws.state === 'connected') {
        this.#lastError = null;
        this.#setState(STATES.CONNECTED);
      }
      this.#writeStatus();
    }, 5_000);
    this.#statusTimer.unref?.();
  }

  #setState(next) {
    if (this.#state === next) return;
    this.#state = next;
    this.#stateSince = new Date().toISOString();
    this.#writeStatus();
  }

  async status() {
    const config = this.config ?? {};
    const credentials = this.#ctx.credentials;
    const described = credentials && typeof credentials.describe === 'function'
      ? await credentials.describe(config.secretRef ?? secretRefFor(this.#botId)).catch(() => null)
      : null;
    return {
      id: this.#botId,
      state: this.#state,
      configured: Boolean(config.appId) && described?.configured === true,
      appId: config.appId ?? null,
      alias: config.alias ?? null,
      botName: config.botName ?? null,
      botOpenId: config.botOpenId ?? null,
      workspace: config.workspace ?? null,
      model: config.model ?? null,
      agentPreset: config.agentPreset ?? null,
      respondToBotMessages: config.respondToBotMessages !== false,
      processDetail: config.processDetail === 'brief' ? 'brief' : 'detailed',
      permissionPreset: config.permissionPreset ?? null,
      busyMode: config.busyMode ?? { direct: 'queue', group: 'queue' },
      contextEnhancement: config.contextEnhancement ?? null,
      eavesdrop: config.eavesdrop ?? null,
      mentions: config.mentions ?? null,
      access: config.access ?? null,
      connectedAt: config.connectedAt ?? null,
      boundChats: Object.keys(this.#stateStore.value.sessions).length,
      lastError: this.#lastError,
      version: this.#version,
    };
  }

  async start() {
    if (this.#disposed) return;
    const config = this.config;
    if (!config?.appId) {
      this.#setState(STATES.IDLE);
      return;
    }
    await this.connect();
  }

  async connect() {
    if (this.#disposed) return null;
    const config = this.config;
    const secret = await this.#secret();
    if (!config?.appId || !secret) {
      this.#setState(STATES.IDLE);
      return null;
    }
    this.#setState(STATES.CONNECTING);
    try {
      const identity = await this.#verify({ appId: config.appId, appSecret: secret });
      if (identity.name !== config.botName || identity.openId !== config.botOpenId) {
        await this.#configStore.update(this.#botId, {
          botName: identity.name,
          botOpenId: identity.openId,
          connectedAt: new Date().toISOString(),
        });
      }
      const bot = this.#createBot({ appId: config.appId, appSecret: secret });
      const bridge = new FeishuBridge({
        bot,
        harness: this.#harness,
        config: this.config,
        state: this.#stateStore,
        logger: this.#logger,
        inboxDir: join(this.#dataDir, 'inbox', this.#botId),
        eventsPath: join(this.#dataDir, `events-${this.#botId}.log`),
        onContext: (sessionId, text) => this.setInjectedContext(sessionId, text),
        listPresets: () => this.listPresets(),
        handoffKeywords: this.#handoffKeywords,
      });
      const wsState = await bot.startLongConnection({
        onMessage: (data) => {
          void bridge.handleMessage(data).catch((error) => this.#log('error', 'inbound message failed', error));
        },
        onCardAction: (data) => bridge.onCardAction(data),
        onState: (state, error) => {
          if (state === 'connected') this.#setState(STATES.CONNECTED);
          else if (state === 'reconnecting') this.#setState(STATES.RECONNECTING);
          else if (state === 'connecting') this.#setState(STATES.CONNECTING);
          else if (state === 'error') {
            this.#setState(STATES.ERROR);
            this.#lastError = { code: 'connection-error', message: error?.message ?? '长连接错误', at: new Date().toISOString() };
            this.#writeStatus();
          }
        },
      });
      this.#bot = bot;
      this.#bridge = bridge;
      if (wsState !== 'connected') {
        this.#lastError = {
          code: `ws-${wsState}`,
          message: wsState === 'timeout'
            ? '长连接 20 秒内未完成握手：请检查开发者后台的长连接订阅方式与 im.message.receive_v1 事件'
            : `长连接状态：${wsState}`,
          at: new Date().toISOString(),
        };
        this.#setState(STATES.ERROR);
        return { botId: this.#botId, wsState };
      }
      this.#lastError = null;
      this.#setState(STATES.CONNECTED);
      this.#startStatusPolling();
      // 命令面板存在飞书侧，连接后对齐一次（失败只记日志）
      void syncSlashCommands(bot, { logger: this.#logger })
        .then((result) => {
          if (result.removed.length || result.created.length) {
            this.#log('info', `slash commands synced: -${result.removed.join(',') || '0'} +${result.created.join(',') || '0'}`);
          }
        })
        .catch((error) => this.#log('warn', 'slash command sync failed', error));
      this.#log('info', `connected as ${identity.name ?? config.appId}`);
      return { botId: this.#botId, botName: identity.name, wsState };
    } catch (error) {
      this.#lastError = { code: error.code ?? 'connect-failed', message: error.message, at: new Date().toISOString() };
      this.#setState(STATES.ERROR);
      this.#log('error', 'connect failed', error);
      throw error;
    }
  }

  async #secret() {
    const credentials = this.#ctx.credentials;
    if (!credentials || typeof credentials.resolve !== 'function') return null;
    const config = this.config;
    const resolved = await credentials.resolve(config?.secretRef ?? secretRefFor(this.#botId)).catch(() => undefined);
    return typeof resolved?.value === 'string' && resolved.value ? resolved.value : null;
  }

  async disconnect() {
    const bot = this.#bot;
    this.#bot = null;
    this.#bridge?.dispose();
    this.#bridge = null;
    this.#setState(STATES.IDLE);
    if (bot) await bot.stop();
  }

  async reconnect() {
    await this.disconnect();
    return this.connect();
  }

  async saveWorkspace(workspace) {
    const value = typeof workspace === 'string' && workspace.trim() ? workspace.trim() : null;
    await this.#configStore.update(this.#botId, { workspace: value });
    this.#bridge?.setConfig(this.config);
    return value;
  }

  async save(fields) {
    const next = await this.#configStore.update(this.#botId, fields);
    this.#bridge?.setConfig(next);
    return next;
  }

  async saveContextEnhancement(contextEnhancement) {
    const validated = validateContextEnhancementConfig(contextEnhancement);
    await this.save({ contextEnhancement: validated });
    return validated;
  }

  setPresetSource(source) {
    this.#presetSource = typeof source === 'function' ? source : null;
  }

  async listPresets() {
    if (!this.#presetSource) return [];
    const items = await Promise.resolve().then(() => this.#presetSource()).catch(() => []);
    return (Array.isArray(items) ? items : [])
      .filter((item) => item && typeof item.id === 'string' && !item.broken)
      .map((item) => ({ id: item.id, name: item.name ?? item.id, description: item.description ?? null }))
      .sort((left, right) => (left.name > right.name ? 1 : left.name < right.name ? -1 : 0));
  }

  setInjectedContext(sessionId, text) {
    if (typeof sessionId !== 'string') return;
    if (!text) this.#contexts.delete(sessionId);
    else {
      this.#contexts.set(sessionId, text);
      if (this.#contexts.size > 200) this.#contexts.delete(this.#contexts.keys().next().value);
    }
  }

  injectedContextFor(sessionId) {
    return typeof sessionId === 'string' ? (this.#contexts.get(sessionId) ?? '') : '';
  }


  /** Fail early when the selected bot cannot send to a group. */
  async #assertInChat(chatId, signal) {
    signal?.throwIfAborted();
    if (!String(chatId).startsWith('oc_')) return;
    const label = this.config?.alias ?? this.config?.botName ?? this.botId;
    const inChat = await this.#bot.isInChat(chatId, { signal });
    signal?.throwIfAborted();
    if (!inChat) throw new Error(`机器人 ${label} 不在群 ${chatId}；请换 bot 或先把机器人拉进群`);
  }

  /** Verify ownership; administrators must not accidentally recall another sender's message. */
  async recallMessage(messageId, signal) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    signal?.throwIfAborted();
    const message = await this.#bot.getMessage(messageId, { strict: true, signal });
    if (!message) throw new Error('找不到要撤回的消息');
    const identities = [this.config.botOpenId, this.config.appId].filter(Boolean);
    if (message.senderType !== 'app' || !identities.includes(message.senderId)) {
      throw new Error('只能撤回所选机器人自己发送的消息');
    }
    signal?.throwIfAborted();
    return this.#bot.deleteMessage(messageId, { strict: true, signal });
  }

  /** Send a standalone interactive card with Markdown text. */
  async sendCardText(chatId, text, title = null, color = null, signal) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    if (!chatId) throw new Error('缺少飞书群 chatId');
    const { body, heading } = validateCardText(text, title, 4000);
    await this.#assertInChat(chatId, signal);
    const messageId = await this.#bot.sendCard(chatId, noticeCard(body, heading || null, normalizeCardColor(color)), { signal });
    if (!messageId) throw new Error('飞书发送未返回 message_id，无法确认发送结果');
    return { messageId, sentAt: new Date().toISOString() };
  }

  /** Upload and send one file/image to a chat. */
  async sendFileToChat(chatId, path, name, signal, cwd) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    if (!chatId) throw new Error('缺少飞书群 chatId');
    await this.#assertInChat(chatId, signal);
    const base = cwd || this.config?.workspace || process.cwd();
    const absolute = isAbsolute(path) ? path : resolve(base, path);
    signal?.throwIfAborted?.();
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new Error(`文件不存在或不是普通文件：${absolute}`);
    const fileName = basename(typeof name === 'string' && name.trim() ? name.trim() : absolute).replace(/[\u0000-\u001f]/g, '').slice(0, 120) || 'file';
    const isImage = /\.(png|jpe?g|webp|gif|bmp|ico|tiff?|heic)$/i.test(fileName);
    const limitMB = isImage ? 10 : 30;
    if (info.size > limitMB * 1024 * 1024) throw new Error(`${isImage ? '图片' : '文件'}超过飞书 ${limitMB}MB 上限：${info.size} 字节`);
    const bytes = await readFile(absolute);
    signal?.throwIfAborted?.();
    let messageId;
    if (isImage) {
      const imageKey = await this.#bot.uploadImage(bytes, { signal });
      signal?.throwIfAborted();
      messageId = await this.#bot.sendImage(chatId, imageKey, { signal });
    } else {
      const fileKey = await this.#bot.uploadFile(bytes, fileName, { signal });
      signal?.throwIfAborted();
      messageId = await this.#bot.sendFile(chatId, fileKey, fileName, { signal });
    }
    if (!messageId) throw new Error('飞书发送未返回 message_id，无法确认发送结果');
    return { kind: isImage ? 'image' : 'file', messageId, fileName, bytes: bytes.length, chatId };
  }

  /** Groups the bot belongs to, with the bound Session when one exists. */
  async listChats({ refresh = false, onError = null, signal } = {}) {
    signal?.throwIfAborted();
    const sessions = this.#stateStore.value.sessions ?? {};
    const bound = new Map();
    for (const [key, sessionId] of Object.entries(sessions)) {
      if (!key.startsWith('chat:')) continue;
      const chatId = chatIdOfKey(key);
      if (!chatId) continue;
      bound.set(chatId, sessionId);
    }
    const apiChats = await Promise.resolve(this.#bot?.getChats?.({ refresh, signal })).catch((error) => {
      signal?.throwIfAborted();
      if (!onError) throw error;
      onError?.(error);
      return [];
    }) ?? [];
    const known = new Map();
    for (const item of apiChats) known.set(item.chatId, { title: item.name || '', chatType: item.chatType });
    for (const chatId of bound.keys()) if (!known.has(chatId)) known.set(chatId, { title: '' });
    const alias = this.config?.alias ?? this.config?.botName ?? this.botId;
    const rows = [];
    for (const [chatId, item] of known) {
      signal?.throwIfAborted();
      const sessionId = bound.get(chatId) || '';
      let title = item.title;
      let chatType = ['p2p', 'group'].includes(item.chatType) ? item.chatType : this.#stateStore.chatTypeFor(`chat:${chatId}`);
      if (!title || !chatType) {
        if (this.#bot?.getChatInfo) {
          const info = await this.#bot.getChatInfo(chatId, { refresh, signal }).catch((error) => {
            signal?.throwIfAborted();
            return null;
          });
          title ||= info?.name || '';
          if (['p2p', 'group'].includes(info?.chatType)) chatType = info.chatType;
        } else if (!title) {
          title = await Promise.resolve(this.#bot?.getChatName?.(chatId)).catch(() => null) ?? '';
        }
      }
      signal?.throwIfAborted();
      rows.push({ bot: alias, botId: this.botId, chatId, title, sessionId, kind: 'chat', chatType: chatType || 'unknown' });
    }
    return rows.sort((left, right) => String(left.title || left.chatId).localeCompare(String(right.title || right.chatId)));
  }

  /** Bind an existing Session without changing its title, model, history or workspace. */
  async bindChat({ chatId, sessionId, expectedSessionId }, { prepare, validate }) {
    const bridge = this.#bridge;
    const change = async (assertIdle = () => {}) => {
      const session = await prepare();
      await this.#stateStore.bindSession(`chat:${chatId}`, sessionId, { expectedSessionId, preserveTitle: true, validate: () => {
        assertIdle();
        if (this.#disposed || this.#bridge !== bridge) {
          throw Object.assign(new Error('连接状态已变化，请刷新后重新绑定'), { code: 'conflict' });
        }
        validate();
      } });
      return session;
    };
    const session = bridge ? await bridge.changeChatBinding(chatId, expectedSessionId, change) : await change();
    if (expectedSessionId && expectedSessionId !== sessionId && !this.handlesSession(expectedSessionId)) {
      this.#contexts.delete(expectedSessionId);
    }
    return { botId: this.botId, chatId, sessionId, previousSessionId: expectedSessionId, session };
  }

  /** Remove this robot's exact binding, including a deleted or offline DSH Session. */
  async unbindChat({ chatId, sessionId }) {
    if (![chatId, sessionId].every((id) => typeof id === 'string' && id.trim() && id === id.trim())) {
      throw Object.assign(new Error('缺少有效的会话 ID 或绑定 Session ID'), { code: 'bad-request' });
    }
    const previous = this.#bridge
      ? await this.#bridge.unbindChat(chatId, sessionId)
      : await this.#stateStore.unbindSession(`chat:${chatId}`, sessionId);
    if (previous && !this.handlesSession(previous)) this.#contexts.delete(previous);
    return { botId: this.botId, chatId, previousSessionId: previous, unbound: Boolean(previous) };
  }

  /** Management projection: never exposes credentials or alters chat/session bindings. */
  async managementSnapshot({ refresh = false } = {}) {
    let directoryError = null;
    const chats = await this.listChats({ refresh, onError: (error) => { directoryError = error.message; } });
    return {
      botId: this.botId,
      inbound: this.#bridge?.stats() ?? null,
      directoryError,
      chats: chats.map((chat) => {
        const key = `chat:${chat.chatId}`;
        const overrides = this.#stateStore.overrideFor(key);
        const meta = this.#stateStore.meta[chat.sessionId] ?? {};
        return {
          botId: this.botId, chatId: chat.chatId,
          title: chat.title || meta.titleName || chat.chatId,
          chatType: chat.chatType,
          sessionId: chat.sessionId || null,
          activity: this.#bridge?.managementState(key) ?? null,
          usage: this.#stateStore.usageFor(key),
          nextSession: {
            workspace: overrides.workspace ?? this.config.workspace ?? null,
            model: overrides.model ?? this.config.model ?? null,
            preset: overrides.preset ?? this.config.agentPreset ?? null,
            overrides: Object.keys(overrides),
          },
        };
      }),
    };
  }

  /** Read history messages from this chat or one thread. */
  async listMessages(args) {
    const { chatId, threadId = null, startTime, endTime, scanLimit, pageToken, signal } = args;
    if (!this.#bot) throw new Error('机器人尚未连接');
    if (!chatId) throw new Error('缺少 chatId');
    const { start, end } = historyTimeRange(startTime, endTime);
    if (threadId && (start !== null || end !== null)) throw new Error('threadId 不支持 startTime/endTime，请只使用 threadId 或按 chatId 查询时间范围');
    const { limit: pageLimit, order, query: needle } = historyOptions(args);
    const scanCap = boundedInteger(scanLimit, 200, 500, 'scanLimit');
    await this.#assertInChat(chatId, signal);
    const map = (item) => {
      const at = Number(item?.create_time) || 0;
      const sender = item?.sender ?? {};
      const imageCount = item?.deleted ? 0 : imageKeysOf(item).length;
      return {
        messageId: String(item?.message_id ?? ''),
        at,
        time: at ? new Date(at).toISOString() : '',
        senderId: sender.id_type === 'open_id' ? String(sender.id ?? '') : String(sender.open_bot_id ?? sender.id ?? ''),
        senderName: String(sender.sender_name ?? sender.name ?? '').trim(),
        type: String(item?.msg_type ?? ''),
        text: describeMessageForEavesdrop(item, { maxLength: Infinity }).text,
        threadId: String(item?.thread_id ?? ''),
        ...(imageCount ? { imageCount } : {}),
      };
    };
    let token = pageToken || null;
    let scanned = 0;
    const matched = [];
    let hasMore = false;
    for (let page = 0; page < 10; page += 1) {
      signal?.throwIfAborted();
      // Consume every fetched item before advancing its page cursor. Fetch only
      // the remaining output capacity so matching messages are never skipped.
      const result = await this.#bot.listMessages(chatId, {
        threadId, startTime: start === null ? null : start * 1000, endTime: end === null ? null : end * 1000,
        pageSize: Math.min(pageLimit - matched.length, scanCap - scanned),
        pageToken: token, order, signal,
      });
      signal?.throwIfAborted();
      for (const item of result.items) {
        scanned += 1;
        const row = map(item);
        if (!needle || `${row.text} ${row.senderName}`.normalize('NFKC').toLowerCase().includes(needle)) matched.push(row);
      }
      hasMore = result.hasMore;
      if (hasMore && (!result.pageToken || result.pageToken === token)) throw new Error('飞书分页游标缺失或未前进，请重新查询');
      token = hasMore ? result.pageToken : null;
      if (!hasMore || scanned >= scanCap || matched.length >= pageLimit) break;
    }
    return {
      chatId, threadId: threadId || '', query: needle, messages: matched,
      scanned, matched: matched.length, hasMore,
      pageToken: token || '',
    };
  }

  async downloadMessageImage(target) {
    const bot = this.#bot;
    if (!bot) throw new Error('机器人尚未连接');
    const { messageId, maxBytes, signal } = target;
    const message = await bot.getMessage(messageId, { strict: true, signal });
    const imageKey = messageImageKey(message, target);
    return bot.downloadResource(messageId, imageKey, 'image', { maxBytes, signal });
  }

  /** Fuzzy lookup in the cached group roster; refreshes only when asked. */
  async findPeople(chatId, query, { refresh = false, signal } = {}) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    if (!chatId) throw new Error('缺少 chatId');
    const needle = String(query ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    if (!needle) throw new Error('查询关键词不能为空');
    signal?.throwIfAborted();
    const members = await this.#bot.getChatMembers(chatId, { refresh, signal });
    signal?.throwIfAborted();
    const ranked = [];
    for (const member of members) {
      const name = String(member.name ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
      const openId = String(member.openId ?? '').toLowerCase();
      const rank = name === needle || openId === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) || openId.includes(needle) ? 2 : -1;
      if (rank >= 0) ranked.push({ rank, name: member.name || member.openId, openId: member.openId });
    }
    ranked.sort((left, right) => left.rank - right.rank || String(left.name).localeCompare(String(right.name)));
    return { chatId, matched: ranked.length, hasMore: ranked.length > 10, people: ranked.slice(0, 10).map(({ name, openId }) => ({ name, openId })) };
  }

  /** Check credentials and the current socket without choosing a chat or sending a message. */
  async checkConnection() {
    const config = this.config;
    const secret = await this.#secret();
    if (!config?.appId || !secret) throw new Error('请先配置 App ID 和 App Secret');
    const identity = await this.#verify({ appId: config.appId, appSecret: secret });
    const connectionState = this.#bot?.connectionStatus?.()?.state ?? this.#state;
    return {
      credentialsValid: true,
      connected: connectionState === STATES.CONNECTED,
      connectionState,
      botName: identity.name,
      botOpenId: identity.openId,
      checkedAt: new Date().toISOString(),
    };
  }

  onSessionEvent(session, event) {
    void this.#bridge?.onSessionEvent(session, event)
      .catch((error) => this.#log('error', 'session event failed', error));
  }

  /** Events of Sessions this bot does not own (e.g. subagents) still carry usage. */
  onForeignSessionEvent(session, event) {
    this.#bridge?.onForeignSessionEvent?.(session, event);
  }

  onAssistantStream(agent, frame) {
    this.#bridge?.onAssistantStream(agent, frame);
  }

  handleApproval(request, next) {
    if (!this.#bridge) return next();
    return this.#bridge.handleApproval(request, next);
  }

  handleQuestion(request, next) {
    if (!this.#bridge) return next();
    return this.#bridge.handleQuestion(request, next);
  }

  dispose() {
    this.#disposed = true;
    if (this.#statusTimer) {
      clearInterval(this.#statusTimer);
      this.#statusTimer = null;
    }
    this.#bridge?.dispose();
    this.#bridge = null;
    void this.#bot?.stop().catch(() => undefined);
    this.#bot = null;
  }
}

/** Owns every bot runtime and routes Host events by Session. */
export class RuntimeManager {
  #ctx;
  #configStore;
  #harness;
  #logger;
  #version;
  #dataDir;
  #openState;
  #verify;
  #createBot;
  #runtimes = new Map();
  #presetSource = null;
  #registration = null;
  #qrCodeDataUrl = null;
  #provision = null;
  #handoffKeywords = null;
  #disposed = false;

  constructor({ ctx, configStore, harness, logger, version, dataDir, openState, verify, createBot, handoffKeywords = null }) {
    this.#ctx = ctx;
    this.#configStore = configStore;
    this.#harness = harness;
    this.#logger = logger ?? console;
    this.#version = version;
    this.#dataDir = dataDir;
    this.#openState = openState;
    this.#verify = verify ?? verifyCredentials;
    this.#createBot = createBot;
    this.#handoffKeywords = handoffKeywords;
  }

  get runtimes() {
    return [...this.#runtimes.values()];
  }

  setPresetSource(source) {
    this.#presetSource = source;
    for (const runtime of this.#runtimes.values()) runtime.setPresetSource(source);
  }

  async #createRuntime(botId) {
    const stateStore = await this.#openState(botId);
    const runtime = new BotRuntime({
      ctx: this.#ctx,
      botId,
      configStore: this.#configStore,
      stateStore,
      harness: this.#harness,
      logger: this.#logger,
      version: this.#version,
      dataDir: this.#dataDir,
      verify: this.#verify,
      createBot: this.#createBot,
      handoffKeywords: this.#handoffKeywords,
    });
    runtime.setPresetSource(() => this.#presetSource?.());
    this.#runtimes.set(botId, runtime);
    return runtime;
  }

  async start() {
    if (this.#disposed) return;
    for (const bot of this.#configStore.bots) {
      const runtime = await this.#createRuntime(bot.id);
      try {
        await runtime.start();
      } catch (error) {
        this.#logger?.error?.(`[im-feishu] bot ${bot.id} failed to start`, error);
      }
    }
  }

  /** Bind a brand-new bot: verify, store the secret, persist and connect. */
  async addBot({ appId, appSecret, alias }) {
    const cleanId = typeof appId === 'string' ? appId.trim() : '';
    const cleanSecret = typeof appSecret === 'string' ? appSecret.trim() : '';
    if (!cleanId || !cleanSecret) throw new Error('请填写 App ID 与 App Secret');
    const identity = await this.#verify({ appId: cleanId, appSecret: cleanSecret });
    if (this.#configStore.bots.some((bot) => bot.appId === cleanId)) {
      throw new Error('这个飞书应用已经绑定过了');
    }
    const bot = await this.#configStore.add({
      appId: cleanId,
      alias: typeof alias === 'string' && alias.trim() ? alias.trim() : null,
      botName: identity.name,
      botOpenId: identity.openId,
      connectedAt: new Date().toISOString(),
    });
    await this.#ctx.credentials.set(bot.secretRef, cleanSecret);
    const runtime = await this.#createRuntime(bot.id);
    await runtime.connect();
    return runtime.status();
  }

  async removeBot(botId) {
    const runtime = this.#runtimes.get(botId);
    const bot = this.#configStore.bot(botId);
    if (!bot) throw new Error(`机器人不存在：${botId}`);
    runtime?.dispose();
    this.#runtimes.delete(botId);
    await this.#ctx.credentials.unset(bot.secretRef).catch(() => undefined);
    await this.#configStore.remove(botId);
    await this.#removeBotData(botId);
    return true;
  }

  /** Drop the per-bot state, status, event log and inbox left on disk. */
  async #removeBotData(botId) {
    if (!this.#dataDir || !/^[A-Za-z0-9_-]+$/.test(botId)) return;
    const targets = [
      join(this.#dataDir, `state-${botId}.json`),
      join(this.#dataDir, `status-${botId}.json`),
      join(this.#dataDir, `events-${botId}.log`),
      join(this.#dataDir, 'inbox', botId),
    ];
    await Promise.all(targets.map((path) => rm(path, { recursive: true, force: true }).catch(() => undefined)));
  }

  async reconnectBot(botId) {
    const runtime = this.#runtimes.get(botId);
    if (!runtime) throw new Error(`机器人不存在：${botId}`);
    await runtime.reconnect();
    return runtime.status();
  }

  runtimeForBot(botId) {
    const runtime = this.#runtimes.get(botId);
    if (!runtime) throw new Error(`机器人不存在：${botId}`);
    return runtime;
  }

  /** Start a scan-to-create run; the QR is rendered on the Host as a data URL. */
  async provisionBegin(input = {}) {
    const { default: QRCode } = await import('qrcode');
    this.#registration ??= new RegistrationManager({ logger: this.#logger });
    // 补齐权限：对已有应用发起一次"定向更新"，扫描后由开放平台写入缺失的 scope/事件。
    let options = input;
    if (input.botId) {
      const bot = this.#configStore.bot(input.botId);
      if (!bot) throw new Error(`机器人不存在：${input.botId}`);
      this.#provision = { kind: 'grant', botId: bot.id };
      options = {
        createOnly: false,
        appId: bot.appId,
        addons: {
          scopes: { tenant: REQUIRED_SCOPES },
          events: { items: { tenant: REQUIRED_EVENTS } },
        },
      };
    } else {
      this.#provision = { kind: 'create' };
    }
    const snapshot = await this.#registration.begin(options);
    this.#qrCodeDataUrl = snapshot.qrCodeUrl
      ? await QRCode.toDataURL(snapshot.qrCodeUrl, { margin: 1, width: 220 }).catch(() => null)
      : null;
    return { ...snapshot, qrCodeDataUrl: this.#qrCodeDataUrl };
  }

  async provisionPoll() {
    if (!this.#registration) return { state: 'idle' };
    const snapshot = await this.#registration.poll();
    const { appSecret, ...rest } = snapshot;
    const terminal = ['success', 'denied', 'expired', 'error', 'cancelled'].includes(snapshot.state);
    // Keep the QR visible while the run is still active.
    const qrCodeDataUrl = terminal ? null : this.#qrCodeDataUrl;
    if (terminal) this.#qrCodeDataUrl = null;
    if (snapshot.state === 'success') {
      try {
        if (this.#provision?.kind === 'grant' && this.#provision.botId) {
          const status = await this.reconnectBot(this.#provision.botId);
          return { ...rest, qrCodeDataUrl: null, bot: status };
        }
        if (snapshot.appId && appSecret) {
          const bot = await this.addBot({ appId: snapshot.appId, appSecret });
          return { ...rest, qrCodeDataUrl: null, bot };
        }
      } catch (error) {
        return { ...rest, qrCodeDataUrl: null, state: 'error', error: { code: 'bind-failed', message: error.message } };
      }
    }
    return { ...rest, qrCodeDataUrl };
  }

  provisionCancel() {
    this.#qrCodeDataUrl = null;
    this.#registration?.cancel();
    return { state: 'cancelled' };
  }

  async status() {
    const bots = [];
    for (const bot of this.#configStore.bots) {
      const runtime = this.#runtimes.get(bot.id);
      bots.push(runtime ? await runtime.status() : {
        id: bot.id, state: 'idle', configured: Boolean(bot.appId), appId: bot.appId,
        alias: bot.alias, botName: bot.botName,
      });
    }
    return { bots, presetsReady: typeof this.#presetSource === 'function' };
  }

  dispatchAssistantStream(agent, frame) {
    const runtime = this.#runtimeForSession(agent?.session?.id);
    runtime?.onAssistantStream(agent, frame);
  }

  /** Route one Session event to the bot that owns it. */
  dispatchSessionEvent(session, event) {
    const sessionId = session?.id;
    for (const runtime of this.#runtimes.values()) {
      if (runtime.handlesSession(sessionId)) {
        runtime.onSessionEvent(session, event);
        return;
      }
    }
    // 未绑定任何聊天的会话（子智能体）只转发用量，不渲染卡片。
    for (const runtime of this.#runtimes.values()) runtime.onForeignSessionEvent(session, event);
  }

  #runtimeForSession(sessionId) {
    for (const runtime of this.#runtimes.values()) {
      if (runtime.handlesSession(sessionId)) return runtime;
    }
    return null;
  }

  handleApproval(request, next) {
    const sessionId = request?.agent?.session?.id;
    const runtime = sessionId ? this.#runtimeForSession(sessionId) : null;
    return runtime ? runtime.handleApproval(request, next) : next();
  }

  handleQuestion(request, next) {
    const sessionId = request?.agent?.session?.id;
    const runtime = sessionId ? this.#runtimeForSession(sessionId) : null;
    return runtime ? runtime.handleQuestion(request, next) : next();
  }

  injectedContextFor(sessionId) {
    for (const runtime of this.#runtimes.values()) {
      if (runtime.handlesSession(sessionId)) return runtime.injectedContextFor(sessionId);
    }
    return '';
  }

  /** Resolve the bot by Session, or by name/alias/appId for non-Feishu sessions. */
  #runtimeForDelivery({ sessionId, bot }) {
    const fromSession = sessionId ? this.#runtimeForSession(sessionId) : null;
    if (fromSession && !bot) return fromSession;
    const wanted = typeof bot === 'string' ? bot.trim() : '';
    const list = this.runtimes;
    if (wanted) {
      const exact = list.find((item) => item.config?.appId === wanted || item.botId === wanted);
      const named = list.filter((item) => item.config?.alias === wanted || item.config?.botName === wanted);
      if (!exact && named.length > 1) throw new Error(`有多个同名机器人：${wanted}；请使用 feishu_bot_chats 返回的 botId 或应用 ID`);
      const hit = exact ?? named[0];
      if (!hit) {
        const names = list.map((item) => item.config?.alias ?? item.config?.botName ?? item.botId).join('、');
        throw new Error(`没有这个机器人：${wanted}；当前可选：${names || '（无）'}`);
      }
      return hit;
    }
    if (fromSession) return fromSession;
    if (list.length === 1) return list[0];
    throw new Error('有多个机器人，请用 bot 参数指定（别名或机器人名）');
  }

  /** Resolve the runtime and an explicit-or-bound chat target. */
  #deliveryTarget({ sessionId, bot, chatId, label = 'chatId' }) {
    const runtime = this.#runtimeForDelivery({ sessionId, bot });
    const bound = sessionId ? chatIdOfKey(runtime.chatKeyForSession(sessionId)) : null;
    const target = String(chatId ?? '').trim() || bound;
    if (!target) {
      throw new Error(`没有 ${label}，且当前 Session 没有绑定飞书聊天；请先用 feishu_bot_chats 查询`);
    }
    return { runtime, target };
  }

  async send({ sessionId, bot, chatId, text, title, color, path, name, signal, cwd }) {
    signal?.throwIfAborted();
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasFile = typeof path === 'string' && path.trim().length > 0;
    if (hasText === hasFile) throw new Error('text 和 path 必须且只能提供一个');
    if (hasFile && (title || color)) throw new Error('title/color 仅用于文本卡片');
    const resolved = this.#deliveryTarget({ sessionId, bot, chatId });
    if (hasText) {
      const result = await resolved.runtime.sendCardText(resolved.target, text, title, color, signal);
      return { kind: 'card', chatId: resolved.target, ...result };
    }
    return resolved.runtime.sendFileToChat(resolved.target, path, name, signal, cwd);
  }

  /** Recall one message the bot itself sent. */
  async recall({ bot, messageId, sessionId, signal }) {
    const id = typeof messageId === 'string' ? messageId.trim() : '';
    if (!id) throw new Error('缺少 messageId');
    const runtime = this.#runtimeForDelivery({ bot, sessionId });
    const ok = await runtime.recallMessage(id, signal);
    return { recalled: ok, messageId: id };
  }

  async listMessages({ sessionId, bot, chatId, ...options }) {
    const resolved = this.#deliveryTarget({ sessionId, bot, chatId });
    return resolved.runtime.listMessages({ chatId: resolved.target, ...options });
  }

  async downloadMessageImage({ sessionId, bot, chatId, ...options }) {
    const resolved = this.#deliveryTarget({ sessionId, bot, chatId });
    return resolved.runtime.downloadMessageImage({ chatId: resolved.target, ...options });
  }

  async listChats({ bot, refresh = false, signal } = {}) {
    const wanted = typeof bot === 'string' ? bot.trim() : '';
    const runtimes = wanted
      ? [this.#runtimeForDelivery({ bot: wanted })]
      : this.runtimes;
    const rows = [];
    for (const runtime of runtimes) rows.push(...await runtime.listChats({ refresh: refresh === true, signal }));
    return rows;
  }

  async findPeople({ sessionId, bot, chatId, query, refresh = false, signal }) {
    const resolved = this.#deliveryTarget({ sessionId, bot, chatId });
    return resolved.runtime.findPeople(resolved.target, query, { refresh: refresh === true, signal });
  }

  dispose() {
    this.#disposed = true;
    for (const runtime of this.#runtimes.values()) runtime.dispose();
    this.#runtimes.clear();
  }
}
