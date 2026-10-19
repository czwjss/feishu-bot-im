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
  const { bot, state, harness, version, saveWorkspace, listPresets, savePreset, modelFor, log } = services;
  let config = services.config();
    const { chatId, chatKey, messageId } = context;
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
            '/menu 卡片菜单 · /new 新会话 · /stop 停止 · /topic 话题 · /topic-sync 同步结论',
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
      case 'topic-sync': {
        const inTopic = typeof chatKey === 'string' && chatKey.startsWith('topic:');
        if (!inTopic) {
          await notice('请在话题内使用 `/topic-sync`。', '话题同步');
          return true;
        }
        const topicId = Number(chatKey.split(':')[2]);
        await services.syncTopic?.(chatId, topicId);
        return true;
      }

      case 'topic': {
        const arg = String(argument ?? '').trim();
        const inTopic = typeof chatKey === 'string' && chatKey.startsWith('topic:');
        if (inTopic) {
          await notice('话题内可直接对话；需要把结论同步回主会话时用 `/topic-sync`。', '话题');
          return true;
        }
        if (!arg || arg.toLowerCase() === 'list') {
          await services.showTopics?.(chatId);
          return true;
        }
        const [firstLine] = arg.split('\n');
        await services.openTopic?.({
          chatId,
          title: firstLine.trim().slice(0, 20),
          content: arg,
          rootMessageId: context?.messageId ?? null,
        });
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
    .slice(0, 20)
    .map((item) => ({ ...item, label: label(item) }));
  const currentSession = sessions.find((item) => item.sessionId === sessionId) ?? null;
  const catalog = await harness.modelCatalog().catch(() => null);
  const selected = (sessionId ? modelFor?.(sessionId) : null) ?? override.model ?? config.model ?? null;
  const models = [];
  let efforts = [];
  for (const group of catalog?.groups ?? []) {
    for (const item of group.models ?? []) {
      models.push({
        value: `${group.id}/${item.id}`,
        label: `${group.name} · ${item.name}`,
        current: selected ? selected.provider === group.id && selected.model === item.id : false,
      });
      if (selected && selected.provider === group.id && selected.model === item.id) {
        efforts = (item.reasoning?.efforts ?? []).map((effort) => ({
          value: effort.id,
          label: effort.name ?? effort.id,
          current: selected.reasoningEffort === effort.id,
        }));
      }
    }
  }
  const presets = (await listPresets().catch(() => []))
    .map((item) => ({ value: item.id, label: item.name ?? item.id, current: item.id === (override.preset ?? config.agentPreset ?? null) }));
  const projections = sessionId ? await harness.sessionProjections?.(sessionId).catch(() => null) : null;
  return {
    sessionId,
    presets,
    sessions: visible,
    sessionWorkspace: currentSession?.cwd ?? override.workspace ?? null,
    currentWorkspace: override.workspace ?? config.workspace ?? null,
    workspaces,
    model: selected,
    models,
    efforts,
    stats: projections,
  };
}

export async function buildMenuCard(services, { chatKey, pending = null }) {
  return menuCard({ ...(await collectMenuData(services, chatKey)), pending });
}

/** The value a picker currently has, mirroring the menu card. */
export function currentMenuValue(data, kind) {
  if (kind === 'model_pick') {
    return data.model ? `${data.model.provider}/${data.model.model}` : null;
  }
  if (kind === 'reasoning_pick') return data.model?.reasoningEffort ?? null;
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
