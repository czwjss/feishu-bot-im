/**
 * Management RPC surface for the settings page (multi-bot).
 *
 * Carried over DSH's authenticated `/api` connection channel, so the browser
 * keeps its existing login and Host/Origin trust checks.
 */
export const RPC_ENDPOINT = 'im-feishu';
export const RPC_PATH = `/api/${RPC_ENDPOINT}`;

function ok(value) {
  return { ok: true, value };
}

function fail(code, message) {
  return { ok: false, error: { code, message, details: {} } };
}

export function createRpcHandler({ manager, harness, version }) {
  const runtimeOf = (input) => {
    const botId = input?.botId ?? manager.runtimes[0]?.botId;
    return manager.runtimeForBot(botId);
  };

  return async function handle(method, payload) {
    const input = payload && typeof payload === 'object' ? payload : {};
    switch (method) {
      case 'bots.list':
        return ok({ ...(await manager.status()), version });

      case 'provision.begin':
        return ok(await manager.provisionBegin(input ?? {}));

      case 'provision.poll':
        return ok(await manager.provisionPoll());

      case 'provision.cancel':
        return ok(manager.provisionCancel());

      case 'bot.add':
        return ok(await manager.addBot({
          appId: input.appId,
          appSecret: input.appSecret,
          alias: input.alias,
        }));

      case 'bot.remove':
        await manager.removeBot(input.botId);
        return ok(await manager.status());

      case 'bot.reconnect':
        await manager.reconnectBot(input.botId);
        return ok(await manager.status());

      case 'bot.slash-sync':
        return ok(await runtimeOf(input).syncSlashCommands());

      case 'bot.test':
        await runtimeOf(input).sendTest();
        return ok({ sent: true });

      case 'bot.alias.set':
        await runtimeOf(input).save({ alias: typeof input.alias === 'string' && input.alias.trim() ? input.alias.trim() : null });
        return ok(await runtimeOf(input).status());

      case 'bot.color.set':
        await runtimeOf(input).save({ color: input.color });
        return ok(await runtimeOf(input).status());

      case 'bot.workspace.set':
        await runtimeOf(input).saveWorkspace(input.workspace);
        return ok(await runtimeOf(input).status());

      case 'bot.model.set':
        await runtimeOf(input).save({
          model: input.model && input.model.provider && input.model.model ? input.model : null,
        });
        return ok(await runtimeOf(input).status());

      case 'bot.permission.set': {
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

      case 'bot.preset.set':
        await runtimeOf(input).save({ agentPreset: typeof input.preset === 'string' && input.preset.trim() ? input.preset.trim() : null });
        return ok(await runtimeOf(input).status());

      case 'bot.access.set':
        await runtimeOf(input).save({ access: input.access });
        return ok(await runtimeOf(input).status());

      case 'bot.busy-mode.set':
        await runtimeOf(input).save({ busyMode: { ...(runtimeOf(input).config?.busyMode ?? {}), [input.scope === 'group' ? 'group' : 'direct']: input.mode === 'steer' ? 'steer' : 'queue' } });
        return ok(await runtimeOf(input).status());

      case 'bot.process-detail.set':
        await runtimeOf(input).save({ processDetail: input.mode === 'brief' ? 'brief' : 'detailed' });
        return ok(await runtimeOf(input).status());

      case 'bot.topics.set':
        await runtimeOf(input).save({ topicsEnabled: input.enabled !== false });
        return ok(await runtimeOf(input).status());

      case 'bot.bot-reply.set':
        await runtimeOf(input).save({ respondToBotMessages: input.enabled === true });
        return ok(await runtimeOf(input).status());

      case 'bot.context-enhancement.set':
        await runtimeOf(input).saveContextEnhancement(input.config);
        return ok(await runtimeOf(input).status());

      case 'models.list': {
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

      case 'permission.list': {
        const catalog = await harness.invoke('permissionPresets', 'catalog', {});
        return ok({
          options: Array.isArray(catalog?.options) ? catalog.options : [],
          defaultPreset: catalog?.defaultPreset ?? null,
        });
      }

      case 'presets.list': {
        const runtime = input.botId ? runtimeOf(input) : manager.runtimes[0];
        return ok({ presets: runtime ? await runtime.listPresets() : [] });
      }

      case 'workspaces.list': {
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

      // ── 兼容层：旧版单机器人设置页仍可工作 ─────────────────────────────
      case 'connection.status': {
        const { bots } = await manager.status();
        return ok(bots[0] ?? { state: 'idle', configured: false });
      }
      case 'bot.bind-credentials':
        return ok(await manager.addBot({
          appId: input.appId, appSecret: input.appSecret, alias: input.alias,
        }));
      case 'bot.delete': {
        const { bots } = await manager.status();
        if (!bots[0]) return ok({ bots: [] });
        await manager.removeBot(bots[0].id);
        return ok(await manager.status());
      }
      case 'connection.test':
      case 'connection.disconnect':
        return ok({ ok: true });

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
