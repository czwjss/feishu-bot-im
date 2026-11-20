import React from 'react';
import { API, Boundary, CSS, S, rpc, t } from './shared.js';
import { useMutation, usePolling, useRpcQuery } from './hooks.js';
import { AddBotModal } from './bot.js';
import { BotStatus } from './bot-status.js';
import { IdentityPanel } from './identity.js';
import { IDENTITY_CSS } from './identity-style.js';
import { Conversations } from './conversations.js';
import { applyChatBound, applyChatUnbound, mergeBotSnapshot } from './workspace-model.js';
import { WORKSPACE_CSS } from './workspace-style.js';
import { AVATAR_CSS } from './avatar-style.js';
import { FeishuIcon } from './icon.js';

const h = React.createElement;
const EMPTY = { bots: [], chats: [], warnings: [] };

/** Keyed by robot: query caches, drafts and selection never cross robot boundaries. */
function BotWorkspace({ connection, bot, snapshot, memory, onChanged, onRefresh, onBind, onUnbind, refreshing, openSession, workerView, leaveRef }) {
  const savedTab = memory.tabs?.[bot.id];
  const remembered = ['status', 'chats', 'avatar'].includes(savedTab) ? savedTab : 'status';
  const [tab, setTab] = React.useState(remembered);
  const [visited, setVisited] = React.useState(() => new Set([remembered]));
  const identityQuery = useRpcQuery(connection, API.userStatus);
  const connectingAvatar = identityQuery.data?.config?.app?.botId === bot.id && identityQuery.data?.connect?.phase === 'pending';
  usePolling(identityQuery.refresh, { interval: connectingAvatar ? 1500 : 30_000, enabled: tab === 'status' || tab === 'avatar', scope: connection });
  const ownsAvatar = identityQuery.data?.config?.app?.botId === bot.id;
  const authorization = ownsAvatar && identityQuery.data?.authorization;
  const messageScopesSatisfied = authorization?.messageScopesSatisfied ?? authorization?.scopeSatisfied;
  const avatarReady = Boolean(authorization?.authorized && messageScopesSatisfied !== false
    && !(authorization.refreshTokenExpiresAt > 0 && authorization.refreshTokenExpiresAt <= Date.now()));
  const monitorQuery = useRpcQuery(connection, API.userMonitorStatus, null, { botId: bot.id });
  usePolling(monitorQuery.refresh, { interval: 10_000, enabled: ownsAvatar && (tab === 'avatar' || (tab === 'status' && avatarReady)), scope: connection });
  const saveRef = React.useRef(null);
  const botSaves = React.useRef(new Map());
  const [saveError, setSaveError] = React.useState(null);
  React.useEffect(() => { setSaveError(null); }, [bot.state, avatarReady]);
  const { error, run } = useMutation();
  const registerSave = React.useCallback((key, flush) => {
    botSaves.current.set(key, flush);
    return () => { if (botSaves.current.get(key) === flush) botSaves.current.delete(key); };
  }, []);
  const chooseTab = React.useCallback((value) => {
    (memory.tabs ??= {})[bot.id] = value;
    setTab(value);
    setVisited((previous) => new Set([...previous, value]));
  }, [memory, bot.id]);
  const flush = React.useCallback(async () => {
    setSaveError(null);
    if (saveRef.current && !await saveRef.current()) { chooseTab('avatar'); return false; }
    for (const [key, save] of botSaves.current) {
      if (!await save()) {
        chooseTab('status');
        if (key.startsWith('bot:') ? bot.state !== 'connected' : !avatarReady) {
          setSaveError(t('设置尚未保存，请在连接恢复后重试。', 'Settings are not saved. Restore the connection and retry.'));
        }
        return false;
      }
    }
    return true;
  }, [chooseTab, bot.state, avatarReady]);
  React.useEffect(() => {
    leaveRef.current = flush;
    return () => { if (leaveRef.current === flush) leaveRef.current = null; };
  }, [leaveRef, flush]);
  const onOpenSession = (id) => run('open', async () => { if (await flush()) await openSession(id); });
  const tabs = [['status', t('状态', 'Status')], ['chats', t('会话', 'Chats')], ['avatar', t('分身', 'Avatar')]];
  const scoped = { ...snapshot, bots: [bot], chats: snapshot.chats.filter((chat) => chat.botId === bot.id) };
  const warnings = snapshot.warnings.filter((warning) => warning.source === bot.id);
  return h('div', { className: 'bxf-bot-content' },
    h('div', { className: 'bxf-work-tabs', role: 'tablist', 'aria-label': bot.alias || bot.botName || bot.id },
      tabs.map(([id, label], index) => h('button', {
        key: id, type: 'button', className: 'bxf-work-tab', role: 'tab', id: `bxf-tab-${id}`,
        'aria-selected': tab === id, 'aria-controls': `bxf-page-${id}`, tabIndex: tab === id ? 0 : -1,
        onClick: () => chooseTab(id),
        onKeyDown: (event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); chooseTab(tabs[next][0]);
          event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
        },
      }, label))),
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error),
    saveError && h('div', { className: 'bxf-work-alert', role: 'alert' }, saveError),
    warnings.map((warning, index) => h('div', { key: index, className: 'bxf-work-alert', role: 'status' }, warning.message)),
    tabs.map(([id]) => h('section', { key: id, className: `bxf-work-tabpage${id === 'avatar' ? ' bxf-work-tabpage-avatar' : ''}`, hidden: tab !== id, role: 'tabpanel', id: `bxf-page-${id}`, 'aria-labelledby': `bxf-tab-${id}` },
      visited.has(id) && h(Boundary, null,
        id === 'chats' ? h(Conversations, { connection, snapshot: scoped, active: tab === id, onOpenSession, onBind, onUnbind, onBot: () => chooseTab('status') })
          : id === 'avatar' ? h(IdentityPanel, { connection, bot, query: identityQuery, monitorQuery, onStatus: () => chooseTab('status'), active: tab === id, saveRef, onOpenSession, workerView })
            : h(BotStatus, { connection, bot, bots: snapshot.bots, identityQuery, monitorQuery, avatarReady, registerSave, active: tab === id, beforeRemove: flush, onChanged, refreshing, onRefresh: () => Promise.all([onRefresh(), identityQuery.refresh()]) })))));
}

export function WorkspacePage({ connection, openSession, workerView, memory: suppliedMemory }) {
  const localMemory = React.useRef({});
  const memory = suppliedMemory ?? localMemory.current;
  const query = useRpcQuery(connection, API.managementSnapshot);
  const snapshot = query.data ?? EMPTY;
  const snapshotRef = React.useRef(snapshot);
  snapshotRef.current = snapshot;
  const [selected, setSelected] = React.useState(memory.botId || null);
  const [addMode, setAddMode] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const knownBotIdsRef = React.useRef(null);
  const addRef = React.useRef(null);
  const addButton = React.useRef(null);
  const navRef = React.useRef(null);
  const leaveRef = React.useRef(null);
  const { busy, error, run } = useMutation();
  const bot = snapshot.bots.find((item) => item.id === selected) ?? snapshot.bots[0];
  React.useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [bot?.id]);
  React.useEffect(() => {
    if (!addOpen) return;
    const outside = (event) => { if (addRef.current && !addRef.current.contains(event.target)) setAddOpen(false); };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setAddOpen(false); addButton.current?.focus();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [addOpen]);
  usePolling(query.refresh, { interval: 15_000, scope: connection });
  const changed = () => { query.invalidate(); return query.refresh(); };
  const bindChat = async (binding) => {
    query.invalidate();
    const result = await rpc(connection, API.chatBind, binding);
    const next = applyChatBound(snapshotRef.current, result);
    snapshotRef.current = next;
    query.accept(next);
    await query.refresh();
    return result;
  };
  const unbindChat = async (binding) => {
    query.invalidate();
    await rpc(connection, API.chatUnbind, binding);
    const next = applyChatUnbound(snapshotRef.current, binding);
    snapshotRef.current = next;
    query.accept(next);
    // The acknowledged local change remains visible if the directory refresh fails.
    await query.refresh();
  };
  const selectBot = (id) => run('select', async () => {
    if (id === bot?.id || (leaveRef.current && !await leaveRef.current())) return;
    memory.botId = id; setSelected(id);
  });
  const refreshBot = (botId) => run('refresh', async () => {
    query.invalidate();
    return rpc(connection, API.managementSnapshot, { botId, refresh: true });
  }, (update) => {
    const merged = mergeBotSnapshot(snapshotRef.current, update, botId);
    snapshotRef.current = merged;
    query.accept(merged);
  });
  const added = async () => {
    const before = knownBotIdsRef.current ?? new Set(snapshotRef.current.bots.map((item) => item.id));
    knownBotIdsRef.current = null;
    const next = await changed();
    const newBot = next?.bots.find((item) => !before.has(item.id));
    if (newBot) await selectBot(newBot.id);
  };
  const globalWarnings = snapshot.warnings.filter((warning) => !snapshot.bots.some((item) => item.id === warning.source));
  return h('div', { className: 'bxf-page bxf-work' },
    h('style', null, CSS, IDENTITY_CSS, WORKSPACE_CSS, AVATAR_CSS),
    h('div', { className: 'bxf-work-shell' },
      h('header', { className: 'bxf-work-header' },
        h('div', { className: 'bxf-work-mark' }, h('span', { className: 'bxf-work-logo' }, h(FeishuIcon, { size: 30 })), h('h1', null, t('飞书机器人IM', 'Feishu Bot IM'))),
        h('nav', { ref: navRef, className: 'bxf-bot-nav', 'aria-label': t('机器人', 'Bots') },
          snapshot.bots.map((item) => h('button', {
            key: item.id, type: 'button', className: 'bxf-bot-nav-row', 'aria-current': item.id === bot?.id ? 'page' : undefined,
            'aria-label': item.alias || item.botName || item.id, title: item.alias || item.botName || item.id,
            'data-state': item.state,
            'aria-description': item.state === 'connected' ? t('运行正常', 'Connected') : item.state === 'error' ? t('连接异常', 'Error')
              : item.state === 'reconnecting' ? t('正在重连', 'Reconnecting') : item.state === 'connecting' ? t('正在连接', 'Connecting') : t('未连接', 'Idle'),
            disabled: busy === 'select', onClick: () => void selectBot(item.id),
          }, item.alias || item.botName || item.id))),
        h('div', { className: 'bxf-bot-more bxf-bot-add', ref: addRef,
          onBlur: (event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setAddOpen(false); } },
          h('button', { ref: addButton, type: 'button', style: S.btn('primary'), 'aria-expanded': addOpen,
            onClick: () => setAddOpen((value) => !value) }, t('添加机器人', 'Add bot')),
          addOpen && h('div', { className: 'bxf-bot-more-panel', role: 'group', 'aria-label': t('添加方式', 'Add method') },
            [['manual', t('手动添加', 'Add manually')], ['scan', t('扫码添加', 'Add by scanning')]].map(([mode, label]) =>
              h('button', {
                key: mode, type: 'button', className: 'bxf-mini',
                onClick: () => {
                  knownBotIdsRef.current = new Set(snapshotRef.current.bots.map((item) => item.id));
                  setAddOpen(false);
                  setAddMode(mode);
                },
              }, label))))),
      (error || query.error) && h('div', { className: 'bxf-work-alert', role: 'alert' }, error || query.error,
        h('button', { type: 'button', className: 'bxf-mini', onClick: () => void query.refresh() }, t('重试', 'Retry'))),
      globalWarnings.map((warning, index) => h('div', { key: index, className: 'bxf-work-alert', role: 'status' }, warning.message)),
      !query.loaded ? h('div', { className: 'bxf-work-empty', role: 'status' }, t('正在读取…', 'Loading…'))
        : !bot ? h('div', { className: 'bxf-work-surface bxf-work-empty' }, t('还没有接入机器人', 'No bots connected'))
          : h('div', { className: 'bxf-work-layout' },
            h(BotWorkspace, { key: bot.id, connection, bot, snapshot, memory, openSession, workerView, leaveRef, onChanged: changed, onBind: bindChat, onUnbind: unbindChat, onRefresh: () => refreshBot(bot.id), refreshing: busy === 'refresh' }))),
    addMode && h(Boundary, null, h(AddBotModal, { connection, mode: addMode, onClose: () => setAddMode(null), onAdded: added })));
}
