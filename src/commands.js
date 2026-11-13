import { menuCard } from './cards.js';
import { sendNotice } from './notify.js';

/**
 * Slash commands.
 *
 * Every case works through the small `services` surface (bot / state / harness /
 * config) instead of reaching into the bridge, so a command can be tested on its
 * own and added without touching inbound plumbing.
 */
export async function runCommand(services, name, argument, context) {
  const { bot, state, harness, log } = services;
  const { chatId, chatKey } = context;
  const notice = (text, title = null, tone = null) => sendNotice(bot, chatId, text, title, tone);
  switch (name) {
    case 'menu': {
      try {
        await bot.sendCard(chatId, await buildMenuCard(services, { chatKey }));
      } catch (error) {
        log('warn', 'menu card failed; sending text', error);
        const sessionId = state.sessionFor(chatKey);
        await bot.sendText(chatId, [
          '功能菜单：',
          '/menu 卡片菜单 · /new 新会话 · /stop 停止',
          `当前会话：${sessionId ?? '尚未创建'}`,
        ].join('\n'));
      }
      return true;
    }

    case 'new': {
      const previous = state.sessionFor(chatKey);
      await state.unbindSession(chatKey);
      services.forgetSession?.(previous);
      await notice('已解除当前会话绑定，下一条消息会开启全新会话。', '新会话');
      return true;
    }
    case 'stop': {
      const sessionId = state.sessionFor(chatKey);
      if (!sessionId) {
        await notice('当前没有可停止的会话。', '无法停止');
        return true;
      }
      const ask = services.externalAsk?.(sessionId) ?? null;
      await harness.cancel(sessionId).catch((error) => log('warn', 'cancel failed', error));
      const note = ask ? `\n（刚才在等你${ask.kind}：${ask.text}）` : '';
      await notice(`已请求停止当前任务。${note}`, '已停止');
      return true;
    }

    default:
      return false;
  }
}

/** Everything the menu card shows; shared by the command and the repaint path. */
export async function collectMenuData(services, chatKey) {
  const { state, harness, listPresets, modelFor } = services;
  const config = services.config();
  const override = state.overrideFor?.(chatKey) ?? {};
  const sessionId = state.sessionFor(chatKey) ?? null;
  const [sessions, baseline] = await Promise.all([
    harness.listSessions().catch(() => []),
    harness.workspaceBaseline().catch(() => ({})),
  ]);
  const archived = new Set(Array.isArray(baseline?.archivedSessionIds) ? baseline.archivedSessionIds : []);
  const workspaces = (Array.isArray(baseline?.items) ? baseline.items : [])
    .map((item) => item?.path).filter(Boolean);
  const label = (item) => {
    const when = item.updatedAt ? new Date(item.updatedAt) : null;
    const stamp = when
      ? `${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
      : '未知时间';
    const title = item.title ?? item.projections?.values?.title ?? null;
    const name = title ? String(title).slice(0, 24) : String(item.sessionId).replace(/^session-/, '').slice(0, 8);
    return `${name} · ${stamp}${item.running ? ' · 运行中' : ''}`;
  };
  const visible = sessions
    .filter((item) => !archived.has(item.sessionId))
    // Empty / child / incompatible sessions cannot be meaningfully switched to.
    .filter((item) => item.blank !== true)
    .filter((item) => item.origin !== 'subagent')
    .filter((item) => item.formatStatus !== 'migration-required')
    .slice(0, 20)
    .map((item) => ({ ...item, label: label(item) }));
  const currentSession = sessions.find((item) => item.sessionId === sessionId) ?? null;
  const catalog = await harness.modelCatalog().catch(() => null);
  // The durable Session projection is the source of truth; the in-memory map is
  // only a fallback for the brief window before a projection update lands.
  const projections = sessionId && typeof harness.sessionProjections === 'function'
    ? await harness.sessionProjections(sessionId).catch(() => null)
    : null;
  const projected = projections?.modelSelection?.next ?? projections?.modelSelection?.lastUsed ?? null;
  const selected = (sessionId ? projected ?? modelFor?.(sessionId) : null) ?? override.model ?? config.model ?? null;
  const models = [];
  let efforts = [];
  let reasoningEffort = selected?.reasoningEffort ?? null;
  for (const group of catalog?.groups ?? []) {
    for (const item of group.models ?? []) {
      models.push({
        value: `${group.id}/${item.id}`,
        label: `${group.name} · ${item.name}`,
        current: selected ? selected.provider === group.id && selected.model === item.id : false,
      });
      if (selected && selected.provider === group.id && selected.model === item.id) {
        reasoningEffort = selected.reasoningEffort ?? item.reasoning?.defaultEffort ?? null;
        efforts = (item.reasoning?.efforts ?? []).map((effort) => ({
          value: effort.id,
          label: effort.name ?? effort.id,
          current: reasoningEffort === effort.id,
        }));
      }
    }
  }
  const presets = (await listPresets().catch(() => []))
    .map((item) => ({ value: item.id, label: item.name ?? item.id, current: item.id === (override.preset ?? config.agentPreset ?? null) }));
  return {
    sessionId,
    statsEnabled: state.statsFor?.(chatKey) === true,
    toolsEnabled: state.toolsFor?.(chatKey) === true,
    presets,
    sessions: visible,
    sessionWorkspace: currentSession?.cwd ?? override.workspace ?? null,
    currentWorkspace: override.workspace ?? config.workspace ?? null,
    workspaces,
    model: selected,
    reasoningEffort,
    models,
    efforts,
  };
}

export async function buildMenuCard(services, { chatKey }) {
  const data = await collectMenuData(services, chatKey);
  const stats = data.sessionId ? await services.harness.sessionProjections?.(data.sessionId).catch(() => null) : null;
  return menuCard({ ...data, stats });
}

/** The value a picker currently has, mirroring the menu card. */
export function currentMenuValue(data, kind) {
  if (kind === 'model_pick') {
    return data.model ? `${data.model.provider}/${data.model.model}` : null;
  }
  if (kind === 'reasoning_pick') return data.reasoningEffort ?? data.model?.reasoningEffort ?? null;
  if (kind === 'workspace_pick') return data.currentWorkspace;
  if (kind === 'session_pick') return data.sessionId;
  return null;
}

/** The human label for one option, used by the pending row. */
export function menuOptionLabel(data, kind, value) {
  const list = kind === 'model_pick' ? data.models
    : kind === 'reasoning_pick' ? data.efforts
      : kind === 'workspace_pick' ? data.workspaces.map((path) => ({ value: path, label: path }))
        : data.sessions.map((item) => ({ value: item.sessionId, label: item.label }));
  return list.find((item) => item.value === value)?.label ?? value;
}
