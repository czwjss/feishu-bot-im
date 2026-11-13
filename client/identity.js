import React from 'react';

import { API, S, SaveStatus, rpc, t } from './shared.js';
import { useAutoSave, useDraft, useMutation, usePolling, useRpcQuery } from './hooks.js';
import { IDENTITY_CSS } from './identity-style.js';

const h = React.createElement;

/** Keep the content mounted so folding a card never discards an unsaved draft. */
function IdentityCard({ title, description, descriptionClassName = '', descriptionTitle, badge, kind, avatar, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const paths = {
    account: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    monitor: 'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5',
    reply: 'M9 7H6a3 3 0 0 0-3 3v9l4-4h6a3 3 0 0 0 3-3v-1m1-9 1.5 4.5L23 8l-4.5 1.5L17 14l-1.5-4.5L11 8l4.5-1.5L17 2Z',
  };
  return h('details', {
    className: 'bxf-identity-card', open,
    onToggle: (event) => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); },
  },
  h('summary', { className: 'bxf-identity-card-head' },
    avatar ?? h('span', { className: 'bxf-identity-card-icon', 'aria-hidden': true },
      h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: paths[kind] }))),
    h('span', { className: 'bxf-identity-card-heading' },
      h('span', { className: 'bxf-identity-card-title' }, h('strong', null, title), badge),
      description ? h('span', { className: `bxf-identity-card-description ${descriptionClassName}`.trim(), title: descriptionTitle ?? description }, description) : null),
    h('svg', { className: 'bxf-identity-card-chevron', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true },
      h('path', { d: 'm9 5 7 7-7 7' }))),
  h('div', { className: 'bxf-identity-card-content' }, children));
}

function MonitorPanel({ connection, saveRef }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = useRpcQuery(connection, API.userMonitorStatus);
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? loadError;
  const [handoffText, setHandoffText, commitHandoff] = useDraft((monitor?.handoffKeywords ?? []).join('，'));
  const [replyRules, setReplyRules, commitReplyRules] = useDraft(monitor?.replyRules ?? '');
  const autoSave = useAutoSave();
  React.useEffect(() => {
    saveRef.current = autoSave.flush;
    return () => { saveRef.current = null; };
  }, [saveRef, autoSave.flush]);
  usePolling(load, { interval: 10_000, scope: connection });
  const [available, setAvailable] = React.useState(null);
  const [showPicker, setShowPicker] = React.useState(false);
  const [chatFilter, setChatFilter] = React.useState('');
  const [workerOptions, setWorkerOptions] = React.useState({ workspaces: [], presets: [], defaultWorkspaceId: null });

  React.useEffect(() => {
    let alive = true;
    void rpc(connection, API.userMonitorWorkerOptions, {}).then((value) => {
      if (!alive) return;
      setWorkerOptions({
        workspaces: Array.isArray(value?.workspaces) ? value.workspaces : [],
        presets: Array.isArray(value?.presets) ? value.presets : [],
        defaultWorkspaceId: typeof value?.defaultWorkspaceId === 'string' ? value.defaultWorkspaceId : null,
      });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [connection]);
  const act = (label, operation, onSaved) => run(label, () => {
    invalidate();
    return operation();
  }, (value) => {
    if (value) setMonitor(value);
    onSaved?.(value);
  });

  const add = (chat) => act(`add:${chat.chatId}`, () => rpc(connection, API.userMonitorAdd, chat));
  const remove = async (chat) => {
    autoSave.cancel(`keywords:${chat.chatId}`);
    await autoSave.flush();
    autoSave.cancel(`keywords:${chat.chatId}`);
    return act(`remove:${chat.chatId}`, () => rpc(connection, API.userMonitorRemove, { chatId: chat.chatId }));
  };
  const setChat = (chat, patch) => act(`mode:${chat.chatId}`, () => rpc(connection, API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
  const setWorker = (patch) => act('worker', () => rpc(connection, API.userMonitorWorkerSet, patch));
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    autoSave.schedule(key, () => {
      invalidate();
      return rpc(connection, method, payload);
    }, delay, (value) => { setMonitor(value); onSaved?.(value); });
  };
  const updateHandoff = (text) => {
    setHandoffText(text);
    const keywords = text.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    scheduleSetting('handoff', API.userMonitorHandoffSet, { keywords }, 600,
      (value) => commitHandoff((value.handoffKeywords ?? keywords).join('，'), text));
  };
  const updateReplyRules = (text, delay = 600) => {
    setReplyRules(text);
    scheduleSetting('reply-rules', API.userMonitorReplyRulesSet, { rules: text }, delay,
      (value) => commitReplyRules(value.replyRules, text));
  };
  const toggle = () => act('toggle', () => rpc(connection, API.userMonitorEnable, { enabled: monitor?.enabled !== true }));
  const poll = () => act('poll', () => rpc(connection, API.userMonitorPoll, {}));
  const flushPending = () => act('flush', () => rpc(connection, API.userMonitorFlush, {}));

  const togglePicker = () => {
    const next = !showPicker;
    setShowPicker(next);
    if (next && !available) {
      void act('chats', async () => {
        const value = await rpc(connection, API.userMonitorChats, {});
        setAvailable(Array.isArray(value?.chats) ? value.chats : []);
        return null;
      });
    }
  };

  const chats = Array.isArray(monitor?.chats) ? monitor.chats : [];
  const monitored = new Set(chats.map((chat) => chat.chatId));
  const candidates = (available ?? []).filter((chat) => !monitored.has(chat.chatId));
  const pendingTotal = chats.reduce((sum, chat) => sum + (chat.pendingBatch || 0), 0);
  const formatTime = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleTimeString() : '—');
  const defaultWorkspaceId = workerOptions.defaultWorkspaceId ?? null;
  const workspaces = [...workerOptions.workspaces].sort((left, right) => {
    if (left.id === defaultWorkspaceId) return -1;
    if (right.id === defaultWorkspaceId) return 1;
    return 0;
  });

  const lastPollAt = Math.max(0, ...chats.map((chat) => Number(chat.lastPollAt) || 0));
  const control = { ...S.input, height: '36px' };
  const shortId = (id = '') => id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
  const chatKind = (chat) => chat.chatMode === 'p2p' ? t('私聊', 'Direct') : t('群聊', 'Group');
  const field = (label, props, options) => h('label', { className: 'bxf-identity-field' },
    h('span', null, label), h('select', { ...props, style: control, className: 'bxf-identity-control' }, options));

  const chatRow = (chat) => {
    const mode = chat.mode ?? (chat.chatMode === 'p2p' ? 'all' : 'mention');
    return h('div', { key: chat.chatId, className: 'bxf-identity-chat' },
      h('div', { className: 'bxf-identity-chat-main' },
        h('div', { className: 'bxf-identity-chat-title', title: chat.name || chat.chatId }, chat.name || chat.chatId),
        h('div', { className: 'bxf-identity-chat-meta', title: chat.chatId }, `${chatKind(chat)} · ${shortId(chat.chatId)}`)),
      h('div', { className: 'bxf-identity-chat-controls' },
        field(t('触发规则', 'Trigger'), {
          value: mode, disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { mode: event.target.value }),
        }, [
          h('option', { key: 'all', value: 'all' }, t('全部消息', 'All messages')),
          h('option', { key: 'mention', value: 'mention' }, t('仅 @ 与回复', 'Mentions & replies')),
          h('option', { key: 'keyword', value: 'keyword' }, t('关键词', 'Keywords')),
        ]),
        field(t('回复对象', 'Reply to'), {
          value: chat.replyToBots ? 'bots' : 'human', disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { replyToBots: event.target.value === 'bots' }),
        }, [
          h('option', { key: 'human', value: 'human' }, t('仅真人', 'People only')),
          h('option', { key: 'bots', value: 'bots' }, t('包含机器人', 'People & bots')),
        ])),
      h('button', { type: 'button', className: 'bxf-mini bxf-danger bxf-identity-remove',
        disabled: busy === `remove:${chat.chatId}`, onClick: () => void remove(chat),
        'aria-label': `${t('移除', 'Remove')} ${chat.name || chat.chatId}`,
      }, t('移除', 'Remove')),
      mode === 'keyword' ? h('label', { className: 'bxf-identity-field bxf-identity-chat-extra' },
        h('span', null, t('匹配关键词', 'Match keywords')),
        h('input', { ...autoSave.compositionHandlers, style: control, className: 'bxf-identity-control',
          defaultValue: (chat.keywords ?? []).join('，'), placeholder: t('关键词，逗号分隔', 'Keywords, comma separated'),
          onChange: (event) => {
            const keywords = event.target.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
            scheduleSetting(`keywords:${chat.chatId}`, API.userMonitorChatSet, { chatId: chat.chatId, keywords });
          },
          onBlur: () => void autoSave.flush(),
        })) : null,
      chat.lastError ? h('div', { className: 'bxf-identity-alert bxf-identity-chat-extra', role: 'alert' }, chat.lastError) : null);
  };

  const keyword = chatFilter.trim().toLowerCase();
  // Searching also shows selected chats, so an exact match never looks missing.
  const filtered = keyword
    ? (available ?? []).filter((chat) => `${chat.name || ''} ${chat.chatId}`.toLowerCase().includes(keyword))
    : candidates;
  const pickerSection = showPicker ? h('div', { className: 'bxf-identity-picker' },
    h('input', { style: control, className: 'bxf-identity-control', value: chatFilter, autoFocus: true,
      'aria-label': t('搜索会话', 'Search chats'), placeholder: t('搜索会话名称或 ID', 'Search chat name or ID'),
      onChange: (event) => setChatFilter(event.target.value),
    }),
    available === null ? h('p', { className: 'bxf-identity-hint', role: 'status' }, t('正在读取会话列表…', 'Loading chats…'))
      : filtered.length === 0 ? h('p', { className: 'bxf-identity-hint' }, keyword
        ? t('没有找到匹配的会话，试试其他关键词。', 'No matching chats. Try another keyword.')
        : t('所有可用会话都已添加。', 'All available chats have been added.'))
        : h('div', { className: 'bxf-identity-picker-list' }, filtered.map((chat) => {
          const added = monitored.has(chat.chatId);
          return h('div', { key: chat.chatId, className: 'bxf-identity-candidate' },
            h('div', { className: 'bxf-identity-candidate-info' },
              h('strong', { title: chat.name || chat.chatId }, chat.name || chat.chatId),
              h('span', { className: 'bxf-identity-chat-meta', title: chat.chatId }, `${chatKind(chat)} · ${shortId(chat.chatId)}`)),
            h('button', { type: 'button', className: 'bxf-mini', disabled: added || busy === `add:${chat.chatId}`,
              onClick: () => void add(chat),
            }, added ? t('已添加', 'Added') : busy === `add:${chat.chatId}` ? t('添加中…', 'Adding…') : t('添加', 'Add')));
        }))) : null;

  return h(React.Fragment, null,
    error ? h('div', { className: 'bxf-identity-alert', role: 'alert' }, error) : null,
    h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry }),
    h(IdentityCard, {
      title: t('消息监听', 'Message monitoring'), kind: 'monitor', defaultOpen: true,
      description: monitor ? `${t('已选会话', 'Selected chats')} ${chats.length} · ${lastPollAt
        ? `${t('最近检查', 'Last checked')} ${formatTime(lastPollAt)}` : t('尚未检查', 'Not checked yet')}`
        : t('正在读取监听状态…', 'Loading monitor status…'),
      badge: monitor ? h('span', { style: S.badge(monitor.enabled ? 'ok' : 'muted') }, monitor.enabled ? t('监听中', 'Watching') : t('已暂停', 'Paused')) : null,
    },
      !monitor ? h('p', { className: 'bxf-identity-hint', role: 'status' }, t('正在读取监听状态…', 'Loading monitor status…'))
        : h(React.Fragment, null,
          h('div', { className: 'bxf-identity-list-head' },
            h('button', { type: 'button', style: S.btn(monitor.enabled ? undefined : 'primary'),
              disabled: busy === 'toggle', onClick: () => void toggle(),
            }, monitor.enabled ? t('停止监听', 'Stop monitoring') : t('开始监听', 'Start monitoring')),
            h('div', { className: 'bxf-identity-actions' },
              h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'poll', onClick: () => void poll() }, busy === 'poll' ? t('检查中…', 'Checking…') : t('立即检查', 'Check now')),
              h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'chats', 'aria-expanded': showPicker, onClick: togglePicker },
                showPicker ? t('收起列表', 'Hide list') : t('添加会话', 'Add chat')))),
          chats.length ? h('div', { className: 'bxf-identity-chat-list' }, chats.map(chatRow))
            : h('div', { className: 'bxf-identity-empty' }, t('添加需要自动回复的会话，然后设置触发规则。', 'Add a chat to reply to, then choose a trigger.')),
          pickerSection,
          pendingTotal > 0 ? h('div', { className: 'bxf-identity-list-head', style: { margin: '10px 0 0' } },
            h('span', { className: 'bxf-identity-list-meta' }, `${pendingTotal} ${t('条消息待处理', 'messages pending')}`),
            h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'flush', onClick: () => void flushPending() },
              busy === 'flush' ? t('派发中…', 'Dispatching…') : t('重试派发', 'Retry dispatch'))) : null)),
    h(IdentityCard, {
      title: t('自动回复设置', 'Auto-reply settings'), kind: 'reply',
      description: t('转人工、处理会话与回复规则', 'Handoff, reply session and reply rules'),
    }, monitor ? h('div', { className: 'bxf-identity-settings' },
      h('div', { className: 'bxf-identity-setting' },
        h('label', { className: 'bxf-identity-field' },
          h('strong', { className: 'bxf-identity-setting-title' }, t('转人工关键词', 'Handoff keywords')),
          h('input', { ...autoSave.compositionHandlers, style: control, className: 'bxf-identity-control', value: handoffText,
            placeholder: t('转人工，人工客服', 'human, agent'), onChange: (event) => updateHandoff(event.target.value),
            onBlur: () => void autoSave.flush(),
            onKeyDown: (event) => { if (event.key === 'Enter' && !event.nativeEvent?.isComposing) void autoSave.flush(); },
          })),
        h('p', { className: 'bxf-identity-hint' }, t('用逗号分隔。命中时跳过当前回复，交由人工处理。', 'Separate with commas. Matching messages are left for a person.'))),
      h('div', { className: 'bxf-identity-setting' },
        h('p', { className: 'bxf-identity-setting-title' }, t('处理会话', 'Reply session')),
        h('div', { className: 'bxf-identity-worker' },
          field(t('分组', 'Group'), {
            value: monitor.worker?.workspaceId || defaultWorkspaceId || '', disabled: busy === 'worker',
            title: workspaces.find((item) => item.id === (monitor.worker?.workspaceId || defaultWorkspaceId))?.path || '',
            onChange: (event) => void setWorker({ workspaceId: event.target.value, workspacePath: '' }),
          }, workspaces.map((item) => h('option', { key: item.id, value: item.id, title: item.path || '' },
            `${item.title || item.path?.split('/').filter(Boolean).at(-1) || item.id}${item.id === defaultWorkspaceId ? t('（默认）', ' (default)') : ''}`))),
          field(t('预设', 'Preset'), { value: monitor.worker?.preset || '', disabled: busy === 'worker', onChange: (event) => void setWorker({ preset: event.target.value }) }, [
            h('option', { key: '', value: '' }, t('默认', 'Default')),
            ...workerOptions.presets.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id)),
          ])),
        h('p', { className: 'bxf-identity-hint' }, t('更改后，将在下次自动回复时创建新会话。', 'Changes create a new session on the next automatic reply.'))),
      h('div', { className: 'bxf-identity-setting' },
        h('div', { className: 'bxf-identity-section-head' },
          h('h3', { className: 'bxf-identity-setting-title' }, t('分身回复规则', 'Avatar reply rules')),
          h('button', { type: 'button', className: 'bxf-mini',
            onClick: () => updateReplyRules(monitor.defaultReplyRules ?? '', 0),
          }, t('恢复默认模板', 'Restore default template'))),
        h('textarea', { ...autoSave.compositionHandlers, style: { ...S.area, minHeight: '220px', padding: '12px', fontSize: '13px' }, className: 'bxf-identity-rules', rows: 10,
          'aria-label': t('分身回复规则', 'Avatar reply rules'), value: replyRules,
          onChange: (event) => updateReplyRules(event.target.value), spellCheck: false,
          onBlur: () => void autoSave.flush(),
        })))
      : h('p', { className: 'bxf-identity-hint', role: 'status' }, t('正在读取…', 'Loading…'))));
}


// ── 用户身份（飞书分身）────────────────────────────────────────────────
// 不单独占设置页签：机器人卡片入口内管理授权、监听和自动回复规则。
function UserIdentityModal({ connection, bot, status, error, onClose, onRefresh }) {
  const [busy, setBusy] = React.useState('');
  const [notice, setNotice] = React.useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const saveRef = React.useRef(null);
  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const pending = status?.connect?.phase === 'pending' && currentBot;

  const requestClose = React.useCallback(async () => {
    if (saveRef.current && !await saveRef.current()) return;
    if (pending) {
      void rpc(connection, API.userConnectCancel, {}).then(onRefresh).catch(() => undefined);
    }
    onClose();
  }, [pending, connection, onRefresh, onClose]);

  React.useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !event.isComposing) void requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  React.useEffect(() => {
    if (!confirmDisconnect) return undefined;
    const timer = setTimeout(() => setConfirmDisconnect(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmDisconnect]);

  const run = async (label, operation) => {
    setBusy(label);
    setNotice(null);
    try {
      await operation();
    } catch (failure) {
      setNotice({ tone: 'error', text: failure?.message ?? String(failure) });
    } finally {
      setBusy('');
    }
  };

  const connect = () => run('connect', async () => {
    const value = await rpc(connection, API.userConnectBegin, { botId: bot.id });
    // 有二维码时优先让用户扫码；没有 QR 才直接打开链接。
    if (value?.url && !value?.qrCodeDataUrl) window.open(value.url, '_blank', 'noopener,noreferrer');
    await onRefresh();
    if (!value?.url) setNotice({ tone: 'error', text: t('没有拿到飞书授权链接', 'No authorization URL returned') });
  });

  const disconnect = () => run('disconnect', async () => {
    if (!confirmDisconnect) { setConfirmDisconnect(true); return; }
    await rpc(connection, API.userDisconnect, {});
    setConfirmDisconnect(false);
    await onRefresh();
    setNotice({ tone: 'ok', text: t('已断开授权', 'Disconnected') });
  });

  const refreshToken = () => run('refresh', async () => {
    await rpc(connection, API.userRefresh, {});
    await onRefresh();
    setNotice({ tone: 'ok', text: t('凭证已刷新', 'Credentials refreshed') });
  });

  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
  const user = status?.authorization?.user;
  const formatTime = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString() : '—');
  const refreshExpiresAt = status?.authorization?.refreshTokenExpiresAt;
  const hasRefreshExpiry = Number.isFinite(refreshExpiresAt) && refreshExpiresAt > 0 && Number.isFinite(new Date(refreshExpiresAt).getTime());
  const refreshExpired = authorized && hasRefreshExpiry && refreshExpiresAt <= Date.now();
  const expiryDescription = !authorized ? null : hasRefreshExpiry
    ? `${t('授权到期', 'Authorization expires')} · ${formatTime(refreshExpiresAt)}`
    : t('授权到期时间未知', 'Authorization expiry unavailable');

  const displayName = user?.name || t('未命名用户', 'Unnamed user');
  let body;
  if (!status) {
    body = h('div', { className: 'bxf-identity-connect' },
      h('p', { className: 'bxf-identity-hint' }, error ? t('读取状态失败，请重试。', 'Unable to load status. Please retry.') : t('正在读取…', 'Loading…')),
      h('button', { type: 'button', style: S.btn(), onClick: () => void onRefresh() }, t('重试', 'Retry')));
  } else if (pending) {
    body = h('div', { className: 'bxf-identity-connect' },
      h('strong', null, t('扫码连接飞书', 'Scan to connect Feishu')),
      h('p', { className: 'bxf-identity-hint' }, t('扫码后在飞书确认。', 'Confirm in Feishu after scanning.')),
      status.connect?.qrCodeDataUrl ? h('div', { className: 'bxf-identity-qr' },
        h('img', { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: t('飞书授权二维码', 'Feishu authorization QR code') })) : null);
  } else if (authorized) {
    body = h(React.Fragment, null,
      status.authorization?.scopeSatisfied === false ? h('div', { className: 'bxf-identity-alert', role: 'alert' },
        `${t('当前授权缺少权限，请重新授权：', 'Authorization is missing scopes; re-authorize: ')}${(status.authorization.missingScopes ?? []).slice(0, 6).join('、')}${(status.authorization.missingScopes?.length ?? 0) > 6 ? ' …' : ''}`) : null,
      h('dl', { className: 'bxf-identity-facts' },
        h('dt', null, 'Open ID'), h('dd', null, user?.openId || '—'),
        h('dt', null, t('访问凭证到期', 'Access token expires')), h('dd', null, formatTime(status.authorization?.accessTokenExpiresAt)),
        h('dt', null, t('刷新凭证到期', 'Refresh token expires')), h('dd', null, formatTime(status.authorization?.refreshTokenExpiresAt))),
      h('div', { className: 'bxf-identity-actions' },
        h('button', { type: 'button', style: S.btn(), disabled: Boolean(busy), onClick: () => void connect() }, t('重新授权', 'Re-authorize')),
        h('button', { type: 'button', style: S.btn(), disabled: Boolean(busy), onClick: () => void refreshToken() }, busy === 'refresh' ? t('刷新中…', 'Refreshing…') : t('刷新凭证', 'Refresh credentials')),
        h('button', { type: 'button', style: { ...S.btn(), color: 'var(--dsw-alias-state-error-primary)' }, disabled: Boolean(busy), onClick: () => void disconnect() }, confirmDisconnect ? t('确认断开？', 'Confirm disconnect?') : t('断开授权', 'Disconnect'))));
  } else {
    body = h('div', { className: 'bxf-identity-connect' },
      h('p', { className: 'bxf-identity-hint', style: { marginBottom: '16px' } }, t('连接飞书账号后，即可设置消息监听与自动回复。', 'Connect your Feishu account to set up monitoring and automatic replies.')),
      h('div', { className: 'bxf-identity-actions', style: { justifyContent: 'center' } },
        h('button', { type: 'button', style: S.btn('primary'), disabled: Boolean(busy), onClick: () => void connect() }, busy === 'connect' ? t('正在发起…', 'Starting…') : t('连接飞书', 'Connect Feishu')),
        h('button', { type: 'button', style: S.btn(), onClick: () => void onRefresh() }, t('刷新状态', 'Refresh'))));
  }

  return h('div', { className: 'bxf-identity-overlay', style: S.overlay,
    onClick: (event) => { if (event.target === event.currentTarget) requestClose(); },
  },
    h('style', null, IDENTITY_CSS),
    h('div', { className: 'bxf-identity-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('飞书分身', 'Feishu identity') },
      h('header', { className: 'bxf-identity-header' },
        h('h2', null, t('飞书分身', 'Feishu identity')),
        h('button', { type: 'button', className: 'bxf-identity-close', onClick: requestClose,
          'aria-label': pending ? t('取消授权', 'Cancel authorization') : t('关闭', 'Close'),
        }, '×')),
      h('div', { className: 'bxf-identity-body' },
        notice ? h('div', { className: notice.tone === 'error' ? 'bxf-identity-alert' : 'bxf-identity-notice', role: 'status' }, notice.text) : null,
        !notice && error ? h('div', { className: 'bxf-identity-alert', role: 'alert' }, error) : null,
        h(IdentityCard, {
          key: pending ? 'pending' : authorized ? 'connected' : 'connect',
          title: authorized ? displayName : !status ? t('飞书账号', 'Feishu account')
            : pending ? t('扫码连接飞书', 'Scan to connect Feishu') : t('连接飞书', 'Connect Feishu'),
          kind: 'account',
          avatar: authorized ? h('span', { className: 'bxf-identity-avatar', 'aria-hidden': true }, [...displayName][0]) : null,
          description: expiryDescription,
          descriptionClassName: `bxf-identity-expiry${refreshExpired ? ' bxf-identity-expiry-expired' : ''}`,
          descriptionTitle: t('刷新凭证到期后需重新授权；此时间随凭证刷新更新。', 'Re-authorize when the refresh token expires. This time updates when credentials are refreshed.'),
          defaultOpen: !authorized || pending || refreshExpired || status?.authorization?.scopeSatisfied === false,
          badge: status ? h('span', { style: S.badge(pending || refreshExpired || (authorized && status.authorization?.scopeSatisfied === false) ? 'warn' : authorized ? 'ok' : 'muted') },
            pending ? t('等待扫码', 'Awaiting scan') : refreshExpired ? t('需重新授权', 'Re-authorization required') : authorized && status.authorization?.scopeSatisfied === false
              ? t('授权不完整', 'Incomplete authorization') : authorized ? t('已连接', 'Connected') : t('未连接', 'Disconnected')) : null,
        }, body),
        authorized && !pending ? h(MonitorPanel, { connection, saveRef }) : null)));
}


export function UserIdentityButton({ connection, bot }) {
  const { data: status, error, refresh: load } = useRpcQuery(connection, API.userStatus);
  const [open, setOpen] = React.useState(false);
  const connecting = status?.connect?.phase === 'pending';
  usePolling(load, { interval: connecting ? 1500 : 30_000, enabled: open || connecting || !status, scope: connection });

  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
  const label = authorized
    ? `${t('分身', 'Identity')}：${status.authorization.user?.name || t('已连接', 'Connected')}`
    : t('分身', 'Identity');

  return h('div', { style: { display: 'flex', alignItems: 'center' } },
    h('button', {
      type: 'button',
      className: 'bxf-mini',
      onClick: () => { setOpen(true); void load(); },
    }, label),
    open
      ? h(UserIdentityModal, {
        connection,
        bot,
        status,
        error,
        onClose: () => setOpen(false),
        onRefresh: async () => { const value = await load(); return value; },
      })
      : null);
}

