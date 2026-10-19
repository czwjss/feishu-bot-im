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
import { RegistrationManager } from './registration.js';
import { syncSlashCommands } from './slash-commands.js';

/** 扫码补齐权限时，由二维码携带的目标配置。 */
export const REQUIRED_SCOPES = Object.freeze([
  'im:message.p2p_msg:readonly',
  'im:message.group_at_msg:readonly',
  'im:message:send_as_bot',
  'im:resource',
  'contact:user.base:readonly',
  'im:chat:readonly',
  'cardkit:card:write',
]);
export const REQUIRED_EVENTS = Object.freeze(['im.message.receive_v1']);

/** Extra scope needed to receive messages the bot was not mentioned in. */
export const EAVESDROP_SCOPES = Object.freeze(['im:message.group_msg']);

const STATES = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
});

function maskAppId(appId) {
  if (!appId) return null;
  return appId.length > 12 ? `${appId.slice(0, 8)}••••${appId.slice(-4)}` : 'cli_••••';
}

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
  #contexts = new Map();
  #disposed = false;

  constructor({ ctx, botId, configStore, stateStore, harness, logger, version, dataDir, verify, createBot }) {
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
      color: config.color ?? 'blue',
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
      appIdMasked: maskAppId(config.appId),
      alias: config.alias ?? null,
      color: config.color ?? 'blue',
      botName: config.botName ?? null,
      botOpenId: config.botOpenId ?? null,
      workspace: config.workspace ?? null,
      model: config.model ?? null,
      agentPreset: config.agentPreset ?? null,
      respondToBotMessages: config.respondToBotMessages !== false,
      topicsEnabled: config.topicsEnabled !== false,
      processDetail: config.processDetail === 'brief' ? 'brief' : 'detailed',
      permissionPreset: config.permissionPreset ?? null,
      busyMode: config.busyMode ?? 'queue',
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
        version: this.#version,
        inboxDir: join(this.#dataDir, 'inbox', this.#botId),
        eventsPath: join(this.#dataDir, `events-${this.#botId}.log`),
        saveWorkspace: (value) => this.saveWorkspace(value),
        onContext: (sessionId, text) => this.setInjectedContext(sessionId, text),
        listPresets: () => this.listPresets(),
        savePreset: (value) => this.save({ agentPreset: value }).then((next) => next),
        saveModel: (value) => this.save({ model: value }).then((next) => next),
      });
      const wsState = await bot.startLongConnection({
        onMessage: (data) => { void bridge.handleMessage(data); },
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
    const items = await this.#presetSource().catch(() => []);
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


  /** Send plain text to a chat_id (oc_…) or open_id (ou_…). */
  async deliver(target, text) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    const route = typeof target === 'string' ? target.trim() : '';
    const body = typeof text === 'string' ? text.trim().slice(0, 4000) : '';
    if (!body) throw new Error('投递内容不能为空');
    if (!/^(oc|ou)_[A-Za-z0-9_-]+$/.test(route)) {
      throw new Error('投递目标必须是 oc_…（群聊）或 ou_…（用户）');
    }
    if (route.startsWith('ou_')) await this.#bot.sendTextToUser(route, body);
    else await this.#bot.sendText(route, body);
    return { targetId: route, sentAt: new Date().toISOString() };
  }

  async syncSlashCommands() {
    if (!this.#bot) throw new Error('机器人尚未连接');
    return syncSlashCommands(this.#bot, { logger: this.#logger });
  }

  async sendTest() {
    if (!this.#bot) throw new Error('机器人尚未连接');
    const chatKey = Object.keys(this.#stateStore.value.sessions)[0];
    const chatId = chatIdOfKey(chatKey);
    if (!chatId) throw new Error('还没有可测试的会话：先在飞书里给这个机器人发一条消息');
    await this.#bot.sendText(chatId, 'DeepSeek Harness 连接测试成功 ✅');
    return true;
  }

  async sendFileForSession({ sessionId, path, name, signal }) {
    if (!this.#bot) throw new Error('机器人尚未连接');
    const chatKey = (sessionId ? this.#stateStore.keyForSession(sessionId) : null)
      ?? Object.keys(this.#stateStore.value.sessions ?? {})[0];
    const chatId = chatIdOfKey(chatKey);
    if (!chatId) throw new Error('还没有可用的飞书会话：先在飞书里给机器人发一条消息');
    const base = this.config?.workspace ?? process.cwd();
    const absolute = isAbsolute(path) ? path : resolve(base, path);
    signal?.throwIfAborted?.();
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new Error(`文件不存在或不是普通文件：${absolute}`);
    const LIMIT = 30 * 1024 * 1024;
    if (info.size > LIMIT) throw new Error(`文件超过飞书 30MB 上限：${info.size} 字节`);
    const bytes = await readFile(absolute);
    const fileName = (typeof name === 'string' && name.trim() ? name.trim() : basename(absolute)).slice(0, 120);
    signal?.throwIfAborted?.();
    if (/\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
      const imageKey = await this.#bot.uploadImage(bytes);
      await this.#bot.sendImage(chatId, imageKey);
    } else {
      const fileKey = await this.#bot.uploadFile(bytes, fileName);
      await this.#bot.sendFile(chatId, fileKey, fileName);
    }
    return { fileName, bytes: bytes.length, chatId };
  }

  onSessionEvent(session, event) {
    void this.#bridge?.onSessionEvent(session, event);
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
  #disposed = false;

  constructor({ ctx, configStore, harness, logger, version, dataDir, openState, verify, createBot }) {
    this.#ctx = ctx;
    this.#configStore = configStore;
    this.#harness = harness;
    this.#logger = logger ?? console;
    this.#version = version;
    this.#dataDir = dataDir;
    this.#openState = openState;
    this.#verify = verify;
    this.#createBot = createBot;
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
          scopes: { tenant: bot.eavesdrop?.enabled ? [...REQUIRED_SCOPES, ...EAVESDROP_SCOPES] : REQUIRED_SCOPES },
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
        appIdMasked: maskAppId(bot.appId), alias: bot.alias, botName: bot.botName,
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
      const hit = list.find((item) => item.config?.alias === wanted
        || item.config?.botName === wanted
        || item.config?.appId === wanted
        || item.botId === wanted);
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

  async deliver({ sessionId, bot, target, text }) {
    const runtime = this.#runtimeForDelivery({ sessionId, bot });
    return runtime.deliver(target, text);
  }

  async sendFileForSession(input) {
    const sessionId = input?.sessionId;
    const runtime = sessionId ? this.#runtimeForSession(sessionId) : null;
    if (!runtime) throw new Error('这个会话没有绑定飞书机器人');
    return runtime.sendFileForSession(input);
  }

  dispose() {
    this.#disposed = true;
    for (const runtime of this.#runtimes.values()) runtime.dispose();
    this.#runtimes.clear();
  }
}
