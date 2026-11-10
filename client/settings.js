import React from 'react';

import { API, Boundary, CSS, S, rpc, t } from './shared.js';
import { AddBotModal, BotCard } from './bot.js';

const h = React.createElement;

    export function SettingsPage({ connection }) {
      const [state, setState] = React.useState({ bots: [], version: null });
      const [models, setModels] = React.useState([]);
      const [presets, setPresets] = React.useState([]);
      const [workspaces, setWorkspaces] = React.useState([]);
      const [permissionOptions, setPermissionOptions] = React.useState([]);
      const [addMode, setAddMode] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [loaded, setLoaded] = React.useState(false);

      const refresh = React.useCallback(async () => {
        try {
          const value = await rpc(connection, API.botsList, {});
          // 数据没变就不触发重渲染（轮询只关心状态变化）
          setState((previous) => {
            const nextBots = value.bots ?? [];
            const same = previous.version === (value.version ?? null)
              && JSON.stringify(previous.bots) === JSON.stringify(nextBots);
            return same ? previous : { bots: nextBots, version: value.version ?? null };
          });
          setError(null);
          setLoaded(true);
          return value;
        } catch (cause) {
          setError(cause.message);
          setLoaded(true);
          return null;
        }
      }, [connection]);

      // 状态轮询：页面可见时 30 秒一次，隐藏时完全暂停，回到页面立即补一次。
      React.useEffect(() => {
        const POLL_MS = 30_000;
        let timer = null;
        const tick = () => { if (!document.hidden) void refresh(); };
        const start = () => {
          if (timer) clearInterval(timer);
          timer = setInterval(tick, POLL_MS);
        };
        const onVisibility = () => {
          if (document.hidden) {
            if (timer) clearInterval(timer);
            timer = null;
          } else {
            void refresh();
            start();
          }
        };
        void refresh();
        start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
          if (timer) clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [refresh]);

      React.useEffect(() => {
        if (!loaded || state.bots.length === 0) return;
        let alive = true;
        const botId = state.bots[0].id;
        void rpc(connection, API.modelsList, {}).then((catalog) => {
          if (!alive) return;
          const flat = [];
          for (const group of catalog.groups ?? []) {
            for (const model of group.models ?? []) {
              flat.push({ provider: group.id, model: model.id, label: `${group.name} · ${model.name}`, reasoning: model.reasoning ?? null });
            }
          }
          setModels(flat);
        }).catch(() => undefined);
        void rpc(connection, API.presetsList, { botId }).then((value) => {
          if (alive) setPresets(Array.isArray(value?.presets) ? value.presets : []);
        }).catch(() => undefined);
        void rpc(connection, API.workspacesList, {}).then((value) => {
          if (alive) setWorkspaces(Array.isArray(value?.workspaces) ? value.workspaces : []);
        }).catch(() => undefined);
        void rpc(connection, API.permissionList, {}).then((value) => {
          if (alive) setPermissionOptions(Array.isArray(value?.options) ? value.options : []);
        }).catch(() => undefined);
        return () => { alive = false; };
      }, [connection, loaded, state.bots.length]);

      if (!loaded) {
        return h('div', { style: S.page },
          h('h2', { style: S.title }, t('飞书机器人', 'Feishu bots')),
          error
            ? h('div', null,
              h('p', { style: S.error }, `${t('读取失败：', 'Failed: ')}${error}`),
              h('button', { type: 'button', style: S.btn('primary'), onClick: () => { setError(null); void refresh(); } }, t('重试', 'Retry')))
            : h('p', { style: S.sub }, t('正在读取…', 'Loading…')));
      }

      return h('div', { className: 'bxf-page', style: S.page },
        h('style', null, CSS),
        h('div', { style: S.head },
          h('div', null,
            h('h2', { style: S.title }, t('飞书机器人', 'Feishu bots')),
            h('p', { style: S.sub }, state.version ? `v${state.version}` : '')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', { type: 'button', style: S.btn(), onClick: () => setAddMode('manual') }, t('手动添加', 'Add manually')),
            h('button', { type: 'button', style: S.btn('primary'), onClick: () => setAddMode('scan') }, t('扫码添加', 'Add by scanning')))),
        error ? h('div', { style: { ...S.error, marginBottom: '8px' } }, error) : null,
        state.bots.length === 0
          ? h('div', { style: { ...S.card, padding: '18px' } },
            h('p', { style: { margin: 0, fontSize: '13px' } }, t('还没有机器人。点击右上角「添加机器人」，填入飞书应用的 App ID / App Secret。', 'No bots yet. Use “Add bot” and paste the app credentials.')))
          : state.bots.map((bot) => h(BotCard, {
            key: bot.id,
            connection,
            bot,
            models,
            presets,
            workspaces,
            permissionOptions,
            onChanged: () => { void refresh(); },
          })),
        addMode
          ? h(Boundary, null, h(AddBotModal, {
            connection,
            mode: addMode,
            onClose: () => setAddMode(null),
            onAdded: () => { void refresh(); },
          }))
          : null);
    }


