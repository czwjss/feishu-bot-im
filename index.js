/**
 * @czwjss/feishu-bot-im — Feishu-only Host plugin.
 *
 * Multiple bots are supported: each bot has its own App Secret ref, state file,
 * long connection, settings and chat→Session bindings.
 */
import { readFile } from 'node:fs/promises';

import { ConfigStore, StateStore, configPaths } from './src/config.js';
import { HarnessAdapter } from './src/harness.js';
import { RuntimeManager } from './src/runtime.js';
import { createRpcHandler, installRpc } from './src/rpc.js';
import { createDeliverTool, createReturnFileTool } from './src/tool.js';
import { rewriteInjectedContextMessages } from './src/injected-context.js';

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
    promptCtx.systemPrompt.context({
      name: 'im-feishu:context',
      order: 120,
      text: (assembly) => manager.injectedContextFor(assembly?.agent?.session?.id),
    });
  });

  ctx.inject(['agentPresets'], (presetCtx) => {
    manager.setPresetSource(() => presetCtx.agentPresets.list());
  });

  const handler = createRpcHandler({ manager, harness, version: pluginVersion });
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
    toolCtx.tools.register(createReturnFileTool({
      send: (input) => manager.sendFileForSession(input),
    }));
    toolCtx.tools.register(createDeliverTool({
      send: (input) => manager.deliver(input),
    }));
  });

  ctx.effect(() => () => manager.dispose(), 'feishu-bot: runtimes');

  try {
    await manager.start();
  } catch (error) {
    logger.error?.('[im-feishu] initial connection failed; the settings page can retry', error);
  }
}
