/**
 * @czwjss/feishu-bot-im — Feishu-only Host plugin.
 *
 * Multiple bots are supported: each bot has its own App Secret ref, state file,
 * long connection, settings and chat→Session bindings.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ConfigStore, StateStore, configPaths } from './src/config.js';
import { HarnessAdapter } from './src/harness.js';
import { RuntimeManager } from './src/runtime.js';
import { createRpcHandler, installRpc } from './src/rpc.js';
import { createChatsTool, createMessagesTool, createPeopleTool, createSendTool } from './src/tool.js';
import { rewriteInjectedContextMessages } from './src/injected-context.js';
import { FEISHU_POLICY } from './src/policy.js';
import { UserIdentityAuth } from './src/user-identity/auth.js';
import { UserIdentityConfigStore, USER_IDENTITY_FILE, USER_TOKEN_FILE } from './src/user-identity/config.js';
import { UserIdentityConnect } from './src/user-identity/connect.js';
import { UserIdentityManager } from './src/user-identity/manager.js';
import { UserTokenStore } from './src/user-identity/token-store.js';
import { installUserIdentityContributions } from './src/user-identity/contributions.js';
import { installWorkerTools } from './src/user-identity/worker-tools.js';
import { UserMonitorManager } from './src/user-identity/monitor.js';
import { MonitorStore, MONITOR_FILE, MONITOR_STATE_FILE } from './src/user-identity/monitor-store.js';

export const name = 'feishu-bot-im';
export const inject = ['connection', 'credentials', 'typertGateway'];

async function version() {
  try {
    const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    return typeof manifest.version === 'string' ? manifest.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** 用户身份（飞书分身）：复用机器人应用；Host 全局注册模型工具。 */
async function createUserIdentity(ctx, paths, botConfigStore, logger) {
  const configStore = await new UserIdentityConfigStore({
    path: join(paths.root, USER_IDENTITY_FILE),
  }).load();
  const tokenStore = await new UserTokenStore({
    path: join(paths.root, USER_TOKEN_FILE),
  }).load();
  const auth = new UserIdentityAuth({
    configStore,
    tokenStore,
    botConfigStore,
    credentials: ctx.credentials,
    logger,
  });
  const connect = new UserIdentityConnect({ auth, logger });
  const manager = new UserIdentityManager({
    configStore,
    botConfigStore,
    auth,
    connect,
    logger,
  });
  return { manager, auth };
}

export async function apply(ctx, config = {}) {
  const logger = typeof ctx.logger === 'function' ? ctx.logger('feishu-bot') : console;
  const paths = configPaths(config);
  const configStore = await new ConfigStore(paths.config).load();
  const harness = new HarnessAdapter(ctx);
  const pluginVersion = await version();

  // One state file per bot keeps chat bindings isolated.
  const stateStores = new Map();
  const openState = async (botId) => {
    if (stateStores.has(botId)) return stateStores.get(botId);
    const store = await new StateStore(paths.state(botId)).load();
    stateStores.set(botId, store);
    return store;
  };

  const manager = new RuntimeManager({
    ctx,
    configStore,
    harness,
    logger,
    version: pluginVersion,
    dataDir: paths.root,
    openState,
  });

  ctx.effect(() => ctx.on('agent/pre-step', async (request, next) => {
    const decision = await next();
    if (!decision || typeof decision !== 'object' || decision.kind !== 'enter'
      || !Array.isArray(decision.messages)) return decision;
    try {
      const rewritten = rewriteInjectedContextMessages(decision.messages);
      return rewritten ? { ...decision, messages: rewritten } : decision;
    } catch (error) {
      logger.warn?.('[im-feishu] unable to split the injected context block', error?.message ?? error);
      return decision;
    }
  }, { global: true }), 'feishu-bot: injected context split');

  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: 'im-feishu:policy',
      order: 130,
      text: FEISHU_POLICY,
    });
    promptCtx.systemPrompt.context({
      name: 'im-feishu:context',
      order: 120,
      text: (assembly) => manager.injectedContextFor(assembly?.agent?.session?.id),
    });
  });

  ctx.inject(['agentPresets'], (presetCtx) => {
    manager.setPresetSource(() => presetCtx.agentPresets.list());
  });

  const { manager: userIdentity, auth: userIdentityAuth } = await createUserIdentity(ctx, paths, configStore, logger);
  userIdentity.startKeepalive();

  const monitorStore = await new MonitorStore({
    configPath: join(paths.root, MONITOR_FILE),
    statePath: join(paths.root, MONITOR_STATE_FILE),
  }).load();
  // 归档/删除的 Worker 会话不能再跑模型步骤，派发前必须换新会话。
  const sessionGuard = {
    isArchived: (sessionId) => {
      try {
        return ctx.workspaceRegistry?.archivedSessionIds?.includes(sessionId) === true;
      } catch {
        return false;
      }
    },
    exists: (sessionId) => {
      try {
        return Boolean(ctx.sessions?.get?.(sessionId));
      } catch {
        return true;
      }
    },
  };

  const userMonitor = new UserMonitorManager({
    auth: userIdentityAuth,
    store: monitorStore,
    harness,
    sessionGuard,
    logger,
  });
  installUserIdentityContributions(ctx, userIdentityAuth, userMonitor);
  const workerTools = installWorkerTools(ctx, userMonitor, logger);
  userMonitor.setWorkerPreparer((sessionId) => workerTools.ensure(sessionId));
  userMonitor.start();

  const handler = createRpcHandler({ manager, harness, version: pluginVersion, userIdentity, userMonitor });
  ctx.effect(() => installRpc(ctx, handler), 'feishu-bot: management rpc');

  ctx.effect(() => ctx.on('session/event', (session, event) => {
    manager.dispatchSessionEvent(session, event);
  }, { global: true }), 'feishu-bot: session events');

  ctx.effect(() => ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    manager.dispatchAssistantStream(agent, frame);
  }, { global: true }), 'feishu-bot: assistant stream');

  ctx.effect(() => ctx.on('approval/request', (request, next) => manager.handleApproval(request, next), {
    global: true,
    prepend: true,
  }), 'feishu-bot: approvals');

  ctx.effect(() => ctx.on('user-questions/request', (request, next) => manager.handleQuestion(request, next), {
    global: true,
    prepend: true,
  }), 'feishu-bot: questions');

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register(createSendTool({
      send: (input) => manager.send(input),
    }));
    toolCtx.tools.register(createMessagesTool({
      list: (input) => manager.listMessages(input),
    }));
    toolCtx.tools.register(createChatsTool({
      list: (input) => manager.listChats(input),
    }));
    toolCtx.tools.register(createPeopleTool({
      find: (input) => manager.findPeople(input),
    }));
  });

  ctx.effect(() => () => manager.dispose(), 'feishu-bot: runtimes');
  ctx.effect(() => () => userIdentity.dispose(), 'feishu-bot: user identity');
  ctx.effect(() => () => userMonitor.dispose(), 'feishu-bot: user message monitor');

  try {
    await manager.start();
  } catch (error) {
    logger.error?.('[im-feishu] initial connection failed; the settings page can retry', error);
  }
}
