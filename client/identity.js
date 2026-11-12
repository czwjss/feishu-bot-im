import React from 'react';

import { API, Panel, S, rpc, t } from './shared.js';

const h = React.createElement;

    function MonitorPanel({ connection }) {
      const [monitor, setMonitor] = React.useState(null);
      const [available, setAvailable] = React.useState(null);
      const [showPicker, setShowPicker] = React.useState(false);
      const [chatFilter, setChatFilter] = React.useState('');
      const [busy, setBusy] = React.useState('');
      const [error, setError] = React.useState(null);
      const [workerOptions, setWorkerOptions] = React.useState({ workspaces: [], presets: [], defaultWorkspaceId: null });

      const load = React.useCallback(async () => {
        try {
          const value = await rpc(connection, API.userMonitorStatus, {});
          setMonitor(value);
          setError(null);
          return value;
        } catch (failure) {
          setError(failure?.message ?? String(failure));
          return null;
        }
      }, [connection]);

      React.useEffect(() => { void load(); }, [load]);
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
      React.useEffect(() => {
        const timer = setInterval(() => { void load(); }, 10_000);
        return () => clearInterval(timer);
      }, [load]);

      const act = async (label, operation) => {
        setBusy(label);
        setError(null);
        try {
          const value = await operation();
          if (value) setMonitor(value);
        } catch (failure) {
          setError(failure?.message ?? String(failure));
        } finally {
          setBusy('');
        }
      };

      const add = (chat) => act(`add:${chat.chatId}`, () => rpc(connection, API.userMonitorAdd, chat));
      const remove = (chat) => act(`remove:${chat.chatId}`, () => rpc(connection, API.userMonitorRemove, { chatId: chat.chatId }));
      const setChat = (chat, patch) => act(`mode:${chat.chatId}`, () => rpc(connection, API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
      const setWorker = (patch) => act('worker', () => rpc(connection, API.userMonitorWorkerSet, patch));
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

      const sectionHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', margin: '2px 0 6px' };
      const sectionTitle = { fontSize: '12px', fontWeight: 600 };
      const divider = { borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: '10px', marginTop: '2px' };

      const chatRow = (chat) => {
        const mode = chat.mode ?? (chat.chatMode === 'p2p' ? 'all' : 'mention');
        const control = { ...S.input, height: '27px', fontSize: '12px', flex: 'none' };
        return h('div', {
          key: chat.chatId,
          style: { display: 'grid', gap: '5px', padding: '9px 0', borderTop: '1px solid var(--dsw-alias-border-l1)' },
        },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
          h('div', {
            style: { flex: '1 1 110px', minWidth: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            title: chat.name || chat.chatId,
          }, chat.name || chat.chatId),
          h('select', {
            style: { ...control, width: '110px' },
            'aria-label': t('触发规则', 'Trigger'),
            value: mode,
            disabled: busy === `mode:${chat.chatId}`,
            onChange: (event) => void setChat(chat, { mode: event.target.value }),
          },
          h('option', { value: 'all' }, t('全部消息', 'All')),
          h('option', { value: 'mention' }, t('仅 @ 与回复', 'Mentions')),
          h('option', { value: 'keyword' }, t('关键词', 'Keywords'))),
          h('select', {
            style: { ...control, width: '132px' },
            'aria-label': t('处理方式', 'Handling'),
            value: chat.replyMode === 'auto' && chat.replyToBots ? 'auto-bots' : (chat.replyMode ?? 'watch'),
            disabled: busy === `mode:${chat.chatId}`,
            onChange: (event) => {
              const value = event.target.value;
              void setChat(chat, value === 'auto-bots'
                ? { replyMode: 'auto', replyToBots: true }
                : { replyMode: value, replyToBots: false });
            },
          },
          h('option', { value: 'watch' }, t('只记录', 'Record')),
          h('option', { value: 'auto' }, t('自动回复', 'Auto')),
          h('option', { value: 'auto-bots' }, t('自动（含机器人）', 'Auto + bots'))),
          h('button', {
            type: 'button',
            className: 'bxf-mini bxf-danger',
            disabled: busy === `remove:${chat.chatId}`,
            onClick: () => void remove(chat),
          }, t('移除', 'Remove'))),
        h('div', {
          style: { ...S.hint, marginTop: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          title: chat.chatId,
        }, `${chat.chatMode === 'p2p' ? t('私聊', 'Direct') : t('群聊', 'Group')} · ${chat.chatId}`),
        mode === 'keyword'
          ? h('input', {
            style: { ...S.input, height: '28px', fontSize: '12px' },
            defaultValue: (chat.keywords ?? []).join('，'),
            placeholder: t('关键词，逗号分隔', 'Keywords, comma separated'),
            onBlur: (event) => {
              const keywords = event.target.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
              void setChat(chat, { keywords });
            },
          })
          : null,
        chat.lastError
          ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-error-primary)' } }, chat.lastError)
          : null);
      };

      const keyword = chatFilter.trim().toLowerCase();
      const filtered = keyword
        ? candidates.filter((chat) => (chat.name || '').toLowerCase().includes(keyword)
          || chat.chatId.toLowerCase().includes(keyword))
        : candidates;
      const pickerSection = showPicker
        ? h('div', { style: { display: 'grid', gap: '6px', paddingTop: '4px' } },
          h('input', {
            style: { ...S.input, height: '30px', fontSize: '12px' },
            value: chatFilter,
            placeholder: t('搜索名称或 chat_id', 'Search name or chat_id'),
            autoFocus: true,
            onChange: (event) => setChatFilter(event.target.value),
          }),
          available === null
            ? h('p', { style: S.hint }, t('正在读取会话列表…', 'Loading chats…'))
            : filtered.length === 0
              ? h('p', { style: S.hint }, t('没有匹配的会话。', 'No matching chats.'))
              : h('div', { style: { display: 'grid', gap: '2px', maxHeight: '260px', overflow: 'auto' } },
                h('div', { style: S.hint }, `${t('共', 'Total')} ${filtered.length} ${t('个', '')}`),
                filtered.map((chat) => h('div', {
                  key: chat.chatId,
                  style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' },
                },
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                    chat.name || chat.chatId),
                  h('div', { style: S.hint }, chat.chatMode === 'p2p' ? t('私聊', 'Direct') : t('群聊', 'Group'))),
                h('button', {
                  type: 'button',
                  className: 'bxf-mini',
                  disabled: busy === `add:${chat.chatId}`,
                  onClick: () => void add(chat),
                }, busy === `add:${chat.chatId}` ? t('添加中…', 'Adding…') : t('添加', 'Add'))))))
        : null;

      return h(Panel, {
        title: t('消息监听', 'Message monitoring'),
        defaultOpen: true,
        action: h('button', {
          type: 'button',
          className: 'bxf-mini',
          disabled: busy === 'toggle',
          onClick: () => void toggle(),
        }, monitor?.enabled ? t('停止监听', 'Stop') : t('开始监听', 'Start')),
      },
      h('p', { style: { ...S.hint, margin: '0 0 10px' } },
        t('定时拉取已选会话的新消息并记录；流式卡片收尾后才入库。「自动回复」会把新消息攒成一批交给 Worker 会话处理。',
          'Polls selected chats into a local inbox; streaming cards land after they finish. Auto reply hands each batch to the worker session.')),
      error ? h('div', { style: S.error }, error) : null,
      !monitor
        ? h('p', { style: S.hint }, t('正在读取监听状态…', 'Loading monitor status…'))
        : h('div', { style: { display: 'grid', gap: '10px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h('span', { style: S.badge(monitor.enabled ? 'ok' : 'muted') },
              monitor.enabled ? t('监听中', 'Watching') : t('已暂停', 'Paused')),
            h('span', { style: { ...S.hint, marginTop: 0 } }, `${t('最后检查', 'Last check')} ${formatTime(chats[0]?.lastPollAt)}`),
            h('div', { style: { ...S.row, marginLeft: 'auto', gap: '6px' } },
              h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'poll', onClick: () => void poll() },
                busy === 'poll' ? t('检查中…', 'Checking…') : t('立即检查', 'Check now')),
              pendingTotal > 0
                ? h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'flush', onClick: () => void flushPending() },
                  busy === 'flush' ? t('派发中…', 'Dispatching…') : `${t('重试派发', 'Retry dispatch')} ${pendingTotal}`)
                : null)),

          h('div', null,
            h('div', { style: sectionHead },
              h('span', { style: sectionTitle }, chats.length > 0 ? `${t('会话', 'Chats')} · ${chats.length}` : t('会话', 'Chats'))),
            chats.length === 0
              ? h('p', { style: S.hint }, t('还没有监听会话，先在下面添加一个。', 'No chats yet — add one below.'))
              : h('div', null, chats.map(chatRow))),

          h('div', { style: divider },
            h('div', { style: sectionHead },
              h('span', { style: sectionTitle }, t('添加会话', 'Add chat')),
              h('button', { type: 'button', className: 'bxf-mini', disabled: busy === 'chats', onClick: togglePicker },
                busy === 'chats' ? t('读取中…', 'Loading…') : (showPicker ? t('收起', 'Close') : t('选择会话', 'Choose')))),
            pickerSection),

          h('div', { style: divider },
            h('div', { style: sectionHead }, h('span', { style: sectionTitle }, t('Worker 会话', 'Worker session'))),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' } },
              h('label', { style: { display: 'grid', gap: '4px' } },
                h('span', { style: { ...S.hint, marginTop: 0 } }, t('分组', 'Group')),
                h('select', {
                  style: { ...S.input, height: '30px', fontSize: '12px' },
                  value: monitor.worker?.workspaceId || defaultWorkspaceId || '',
                  disabled: busy === 'worker',
                  onChange: (event) => void setWorker({ workspaceId: event.target.value, workspacePath: '' }),
                },
                workspaces.map((item) => h('option', { key: item.id, value: item.id },
                  `${item.title || item.id}${item.path ? ` · ${item.path}` : ''}${item.id === defaultWorkspaceId ? t('（默认）', ' (default)') : ''}`)))),
              h('label', { style: { display: 'grid', gap: '4px' } },
                h('span', { style: { ...S.hint, marginTop: 0 } }, t('预设', 'Preset')),
                h('select', {
                  style: { ...S.input, height: '30px', fontSize: '12px' },
                  value: monitor.worker?.preset || '',
                  disabled: busy === 'worker',
                  onChange: (event) => void setWorker({ preset: event.target.value }),
                },
                h('option', { value: '' }, t('默认（standard）', 'Default (standard)')),
                workerOptions.presets.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))))),
            h('p', { style: S.hint },
              t('自动回复的 Worker 会话建在这个分组下；改动后下一次派发自动换新会话。',
                'Auto-reply workers are created in this group; changes apply on the next dispatch.')))));
    }


    // ── 用户身份（飞书分身）────────────────────────────────────────────────
    // 不单独占设置页签：飞书机器人页右上角一个入口，点开只做授权/状态管理。
    function UserIdentityModal({ connection, bot, status, error, onClose, onRefresh }) {
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState(null);
      const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
      const currentApp = status?.config?.app;
      const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
      const pending = status?.connect?.phase === 'pending' && currentBot;

      const requestClose = React.useCallback(() => {
        if (pending) {
          void rpc(connection, API.userConnectCancel, {}).then(onRefresh).catch(() => undefined);
        }
        onClose();
      }, [pending, connection, onRefresh, onClose]);

      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') requestClose(); };
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
        setNotice({ tone: 'ok', text: t('token 已刷新', 'Token refreshed') });
      });

      const authorized = Boolean(status?.authorization?.authorized) && currentBot;
      const user = status?.authorization?.user;
      const formatTime = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString() : '—');

      let body;
      if (!status) {
        body = h('div', { style: { display: 'grid', gap: '8px' } },
          error
            ? h('div', { style: S.error }, error)
            : h('p', { style: S.hint }, t('正在读取…', 'Loading…')),
          h('div', { style: S.row },
            h('button', { type: 'button', style: S.btn(), onClick: () => void onRefresh() }, t('重试', 'Retry'))));
      } else if (pending) {
        body = h('div', { style: { display: 'grid', gap: '8px' } },
          h('p', { style: { ...S.sub, margin: 0 } },
            t('扫码后在飞书确认。', 'Confirm in Feishu after scanning.')),
          status.connect?.qrCodeDataUrl
            ? h('div', { style: { display: 'flex', justifyContent: 'center' } },
              h('div', {
                style: {
                  padding: '10px', background: '#fff', borderRadius: '12px', lineHeight: 0,
                  border: '1px solid var(--dsw-alias-border-l1)', boxShadow: '0 2px 10px rgba(15,23,42,.08)',
                },
              }, h('img', { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: 'QR' })))
            : null);
      } else if (authorized) {
        body = h('div', { style: { display: 'grid', gap: '8px' } },
          h('div', { style: S.row },
            h('strong', { style: { fontSize: '14px' } }, user?.name || t('未命名用户', 'Unnamed user')),
            h('span', { style: S.badge('ok') }, t('已连接', 'Connected'))),
          h('div', { style: S.hint }, `open_id：${user?.openId || '—'}`),
          h('div', { style: S.hint }, `${t('access_token 到期', 'access_token expires')}：${formatTime(status.authorization?.accessTokenExpiresAt)}`),
          h('div', { style: S.hint }, `${t('refresh_token 到期', 'refresh_token expires')}：${formatTime(status.authorization?.refreshTokenExpiresAt)}`),
          status.authorization?.scopeSatisfied === false
            ? h('div', { style: S.error },
              `${t('当前授权缺少权限，请重新授权：', 'Authorization is missing scopes; re-authorize: ')}${(status.authorization.missingScopes ?? []).slice(0, 6).join('、')}${(status.authorization.missingScopes?.length ?? 0) > 6 ? ' …' : ''}`)
            : null,
          h('div', { style: S.row },
            h('button', { type: 'button', style: S.btn(), disabled: busy === 'connect', onClick: () => void connect() },
              t('重新授权', 'Re-authorize')),
            h('button', { type: 'button', style: S.btn(), disabled: busy === 'refresh', onClick: () => void refreshToken() },
              busy === 'refresh' ? t('刷新中…', 'Refreshing…') : t('刷新 token', 'Refresh token')),
            h('button', { type: 'button', style: { ...S.btn(), color: 'var(--dsw-alias-state-error-primary)' }, disabled: busy === 'disconnect', onClick: () => void disconnect() },
              confirmDisconnect ? t('确认断开？', 'Confirm disconnect?') : t('断开授权', 'Disconnect'))),
          h(MonitorPanel, { connection }));
      } else {
        body = h('div', { style: { display: 'grid', gap: '8px' } },
          h('div', { style: S.row },
            h('button', {
              type: 'button',
              style: S.btn('primary'),
              disabled: busy === 'connect',
              onClick: () => void connect(),
            }, busy === 'connect' ? t('正在发起…', 'Starting…') : t('连接飞书', 'Connect Feishu')),
            h('button', { type: 'button', style: S.btn(), onClick: () => void onRefresh() }, t('刷新状态', 'Refresh'))));
      }

      return h('div', {
        style: S.overlay,
        role: 'dialog',
        'aria-modal': true,
        'aria-label': t('飞书分身', 'Feishu identity'),
        onClick: (event) => { if (event.target === event.currentTarget) requestClose(); },
      },
      h('div', { style: S.modal },
        notice ? h('div', {
          style: {
            ...S.hint,
            marginTop: '10px',
            color: notice.tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)',
          },
        }, notice.text) : null,
        !notice && error ? h('div', { style: { ...S.error, marginTop: '10px' } }, error) : null,
        h('div', { style: { marginTop: '12px' } }, body),
        h('div', { style: { ...S.row, justifyContent: 'flex-end', marginTop: '16px' } },
          h('button', { type: 'button', style: S.btn('primary'), onClick: requestClose },
            pending ? t('取消授权', 'Cancel authorization') : t('关闭', 'Close')))));
    }


    export function UserIdentityButton({ connection, bot }) {
      const [status, setStatus] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [open, setOpen] = React.useState(false);

      const load = React.useCallback(async () => {
        try {
          const value = await rpc(connection, API.userStatus, {});
          setStatus(value);
          setError(null);
          return value;
        } catch (failure) {
          setError(failure?.message ?? String(failure));
          return null;
        }
      }, [connection]);

      React.useEffect(() => { void load(); }, [load]);
      React.useEffect(() => {
        if (status?.connect?.phase !== 'pending') return undefined;
        const timer = setInterval(() => { void load(); }, 1500);
        return () => clearInterval(timer);
      }, [status?.connect?.phase, load]);

      const currentApp = status?.config?.app;
      const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
      const authorized = Boolean(status?.authorization?.authorized) && currentBot;
      const pending = status?.connect?.phase === 'pending' && currentBot;
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

