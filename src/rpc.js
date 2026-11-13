/**
 * Management RPC surface for the settings page (multi-bot).
 *
 * Carried over DSH's authenticated `/api` connection channel, so the browser
 * keeps its existing login and Host/Origin trust checks.
 */
import { API, RPC_ENDPOINT } from './contracts.js';
export { RPC_ENDPOINT };
export const RPC_PATH = `/api/${RPC_ENDPOINT}`;

function ok(value) {
  return { ok: true, value };
}

function fail(code, message) {
  return { ok: false, error: { code, message, details: {} } };
}

export function createRpcHandler({ manager, harness, version, userIdentity = null, userMonitor = null }) {
  const runtimeOf = (input) => {
    const botId = input?.botId ?? manager.runtimes[0]?.botId;
    return manager.runtimeForBot(botId);
  };

  const requireUserIdentity = () => {
    if (!userIdentity) throw new Error('用户身份模块没有加载');
    return userIdentity;
  };

  const requireUserMonitor = () => {
    if (!userMonitor) throw new Error('用户身份消息监听没有加载');
    return userMonitor;
  };

  return async function handle(method, payload) {
    const input = payload && typeof payload === 'object' ? payload : {};
    switch (method) {
      case API.botsList:
        return ok({ ...(await manager.status()), version });

      case API.provisionBegin:
        return ok(await manager.provisionBegin(input ?? {}));

      case API.provisionPoll:
        return ok(await manager.provisionPoll());

      case API.provisionCancel:
        return ok(manager.provisionCancel());

      case API.botAdd:
        return ok(await manager.addBot({
          appId: input.appId,
          appSecret: input.appSecret,
          alias: input.alias,
        }));

      case API.botRemove:
        await manager.removeBot(input.botId);
        return ok(await manager.status());

      case API.botReconnect:
        await manager.reconnectBot(input.botId);
        return ok(await manager.status());

      case 'bot.slash-sync':
        return ok(await runtimeOf(input).syncSlashCommands());

      case API.botCheck:
      case API.botTest:
        return ok(await runtimeOf(input).checkConnection());

      case API.botAliasSet:
        await runtimeOf(input).save({ alias: typeof input.alias === 'string' && input.alias.trim() ? input.alias.trim() : null });
        return ok(await runtimeOf(input).status());

      case API.botColorSet:
        await runtimeOf(input).save({ color: input.color });
        return ok(await runtimeOf(input).status());

      case API.botWorkspaceSet:
        await runtimeOf(input).saveWorkspace(input.workspace);
        return ok(await runtimeOf(input).status());

      case API.botModelSet:
        await runtimeOf(input).save({
          model: input.model && input.model.provider && input.model.model ? input.model : null,
        });
        return ok(await runtimeOf(input).status());

      case API.botPermissionSet: {
        const permissionPreset = typeof input.permissionPreset === 'string' && input.permissionPreset.trim()
          ? input.permissionPreset.trim()
          : null;
        if (permissionPreset) {
          const catalog = await harness.invoke('permissionPresets', 'catalog', {}).catch(() => null);
          if (catalog && !(catalog.options ?? []).some((item) => item.value === permissionPreset)) {
            return fail('bad-request', `未知权限档位：${permissionPreset}`);
          }
        }
        await runtimeOf(input).save({ permissionPreset });
        return ok(await runtimeOf(input).status());
      }

      case API.botPresetSet:
        await runtimeOf(input).save({ agentPreset: typeof input.preset === 'string' && input.preset.trim() ? input.preset.trim() : null });
        return ok(await runtimeOf(input).status());

      case API.botAccessSet:
        await runtimeOf(input).save({ access: input.access });
        return ok(await runtimeOf(input).status());

      case API.botBusyModeSet:
        await runtimeOf(input).save({ busyMode: { ...(runtimeOf(input).config?.busyMode ?? {}), [input.scope === 'group' ? 'group' : 'direct']: input.mode === 'steer' ? 'steer' : 'queue' } });
        return ok(await runtimeOf(input).status());

      case API.botProcessDetailSet:
        await runtimeOf(input).save({ processDetail: input.mode === 'brief' ? 'brief' : 'detailed' });
        return ok(await runtimeOf(input).status());

      case API.botBotReplySet:
        await runtimeOf(input).save({ respondToBotMessages: input.enabled === true });
        return ok(await runtimeOf(input).status());

      case API.botContextSet:
        await runtimeOf(input).saveContextEnhancement(input.config);
        return ok(await runtimeOf(input).status());

      case API.botEavesdropSet:
        await runtimeOf(input).save({ eavesdrop: input.eavesdrop });
        return ok(await runtimeOf(input).status());

      case API.botMentionsSet:
        await runtimeOf(input).save({ mentions: input.mentions });
        return ok(await runtimeOf(input).status());

      case API.modelsList: {
        const catalog = await harness.modelCatalog();
        const groups = (catalog?.groups ?? []).map((group) => ({
          id: group.id,
          name: group.name,
          models: (group.models ?? []).map((model) => ({
            id: model.id,
            name: model.name,
            reasoning: model.reasoning ?? null,
          })),
        }));
        return ok({ groups, default: catalog?.default ?? null });
      }

      case API.permissionList: {
        const catalog = await harness.invoke('permissionPresets', 'catalog', {});
        return ok({
          options: Array.isArray(catalog?.options) ? catalog.options : [],
          defaultPreset: catalog?.defaultPreset ?? null,
        });
      }

      case API.presetsList: {
        const runtime = input.botId ? runtimeOf(input) : manager.runtimes[0];
        return ok({ presets: runtime ? await runtime.listPresets() : [] });
      }

      case API.workspacesList: {
        const baseline = await harness.workspaceBaseline();
        const items = Array.isArray(baseline?.items) ? baseline.items : [];
        return ok({
          workspaces: items
            .filter((item) => typeof item?.path === 'string' && item.path)
            .map((item) => ({ path: item.path, title: item.title ?? null })),
        });
      }

      case 'version':
        return ok({ version });

      // ── 用户身份（飞书分身）────────────────────────────────────────────
      case API.userStatus:
        return ok(await requireUserIdentity().status());

      case API.userConnectBegin:
        return ok(await requireUserIdentity().connectBegin(input));

      case API.userConnectCancel:
        return ok(await requireUserIdentity().connectCancel());

      case API.userDisconnect:
        return ok(await requireUserIdentity().disconnect());

      case API.userRefresh:
        return ok(await requireUserIdentity().refresh());

      case API.userMonitorStatus:
        return ok(await requireUserMonitor().status());

      case API.userMonitorChats:
        return ok({ chats: await requireUserMonitor().discoverChats() });

      case API.userMonitorAdd:
        return ok(await requireUserMonitor().addChat(input));

      case API.userMonitorRemove:
        return ok(await requireUserMonitor().removeChat(input.chatId));

      case API.userMonitorHandoffSet:
        return ok(await requireUserMonitor().setHandoffKeywords(input.keywords));

      case API.userMonitorWorkerSet:
        return ok(await requireUserMonitor().setWorker({
          workspaceId: input.workspaceId,
          workspacePath: input.workspacePath,
          preset: input.preset,
        }));

      case API.userMonitorWorkerOptions: {
        const baseline = await harness.workspaceBaseline().catch(() => ({}));
        const items = Array.isArray(baseline?.items) ? baseline.items : [];
        const runtime = manager.runtimes[0] ?? null;
        const presets = runtime ? await runtime.listPresets().catch(() => []) : [];
        const monitor = requireUserMonitor();
        const defaultWorkspaceId = typeof monitor.resolveDefaultWorkspaceId === 'function'
          ? await monitor.resolveDefaultWorkspaceId().catch(() => null)
          : null;
        return ok({
          defaultWorkspaceId,
          workspaces: items
            .filter((item) => typeof item?.workspaceId === 'string' && item.workspaceId)
            .map((item) => ({
              id: String(item.workspaceId),
              path: String(item.path ?? ''),
              title: item.title ? String(item.title) : '',
            })),
          presets: (Array.isArray(presets) ? presets : []).map((preset) => ({
            id: String(preset?.id ?? ''),
            name: String(preset?.name ?? preset?.id ?? ''),
          })).filter((preset) => preset.id),
        });
      }

      case API.userMonitorEnable:
        return ok(await requireUserMonitor().setEnabled(input.enabled === true));

      case API.userMonitorFlush:
        return ok(await requireUserMonitor().flushPending());

      case API.userMonitorPoll:
        await requireUserMonitor().pollOnce();
        return ok(await requireUserMonitor().status());

      case API.userMonitorChatSet:
        return ok(await requireUserMonitor().setChat(input.chatId, {
          mode: input.mode,
          keywords: input.keywords,
          replyToBots: input.replyToBots,
        }));

      case API.userMonitorReplyRulesSet:
        return ok(await requireUserMonitor().setReplyRules(input.rules));

      default:
        return fail('bad-request', `unknown method: ${String(method)}`);
    }
  };
}

function reply(rpcId, result) {
  const value = result.ok === false
    ? { ...result, error: { ...result.error, details: result.error.details ?? {} } }
    : result;
  return Response.json({ type: 'server-response', rpcId, result: value });
}

/** Register the handler on the Host connection fetch carrier. */
export function installRpc(ctx, handler) {
  if (typeof ctx?.connection?.fetch?.register !== 'function') {
    throw new TypeError('feishu-bot requires ctx.connection.fetch.register');
  }
  return ctx.connection.fetch.register({
    path: RPC_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
      const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('body is not JSON', { status: 400 });
      }
      const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request';
      const call = body?.payload;
      if (body?.type !== 'client-request' || typeof body.rpcId !== 'string'
        || body.method !== RPC_ENDPOINT || !call || typeof call.method !== 'string'
        || !Object.hasOwn(call, 'payload')) {
        return reply(rpcId, fail('bad-request', 'Invalid IM management request.'));
      }
      try {
        return reply(rpcId, await handler(call.method, call.payload));
      } catch (error) {
        return reply(rpcId, fail(error?.code ?? 'internal', error?.message ?? String(error)));
      }
    },
  });
}
