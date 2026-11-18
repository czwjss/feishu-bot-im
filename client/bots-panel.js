import React from 'react';
import { API, S, rpc, t } from './shared.js';
import { BotSettings } from './bot.js';

const h = React.createElement;

export function BotConfiguration({ connection, bot, onChanged, registerSave }) {
  const [catalog, setCatalog] = React.useState({ models: [], presets: [], workspaces: [], permissionOptions: [] });
  const [error, setError] = React.useState(null);
  const [retry, setRetry] = React.useState(0);
  const botId = bot.id;
  React.useEffect(() => {
    if (!botId) return;
    let alive = true;
    setError(null);
    void Promise.all([
      rpc(connection, API.modelsList, {}), rpc(connection, API.presetsList, { botId }),
      rpc(connection, API.workspacesList, {}), rpc(connection, API.permissionList, {}),
    ]).then(([models, presets, workspaces, permissions]) => {
      if (!alive) return;
      setCatalog({
        models: (models.groups ?? []).flatMap((group) => (group.models ?? []).map((model) => ({
          provider: group.id, model: model.id, label: `${group.name} · ${model.name}`, reasoning: model.reasoning ?? null,
        }))),
        presets: presets.presets ?? [], workspaces: workspaces.workspaces ?? [], permissionOptions: permissions.options ?? [],
      });
    }).catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [connection, botId, retry]);
  return h('div', { className: 'bxf-work-bots' },
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
      h('button', { type: 'button', style: S.btn(), onClick: () => setRetry((value) => value + 1) }, t('重试', 'Retry'))),
    h(BotSettings, { connection, bot, ...catalog, onChanged, registerSave }));
}
