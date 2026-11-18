import React from 'react';
import { API, S, SaveStatus, rpc, t } from './shared.js';
import { useAutoSave, useMutation } from './hooks.js';
import { Drawer } from './drawer.js';
import { MonitorDetail } from './monitor-detail.js';
import { WorkerConversationPanel } from './worker-conversation.js';

const h = React.createElement;

export function AvatarWorkspace({ connection, botId, saveRef, onOpenSession, workerView, query, active = true }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = query;
  const call = (method, payload = {}) => rpc(connection, method, { ...payload, botId });
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? loadError;
  const directEnabled = monitor?.directEnabled === true;
  const autoSave = useAutoSave();
  React.useEffect(() => {
    if (!saveRef) return;
    saveRef.current = autoSave.flush;
    return () => { saveRef.current = null; };
  }, [saveRef, autoSave.flush]);
  const [available, setAvailable] = React.useState(null);
  const [drawer, setDrawer] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState(null);
  const [historicalWorker, setHistoricalWorker] = React.useState(null);
  const [mobileDetail, setMobileDetail] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const closeDrawer = async () => { if (await autoSave.flush()) setDrawer(null); };
  const selectChat = (chat, sessionId = null) => run('select-chat', async () => {
    if (!await autoSave.flush()) return;
    setSelectedId(chat.chatId);
    setHistoricalWorker(sessionId ? { chatId: chat.chatId, sessionId } : null);
    setMobileDetail(true);
    setDrawer(null);
  });
  const [chatFilter, setChatFilter] = React.useState('');
  const act = (label, operation, onSaved) => run(label, () => {
    invalidate();
    return operation();
  }, (value) => {
    if (value) setMonitor(value);
    onSaved?.(value);
  });

  const add = (chat) => act(`add:${chat.chatId}`, () => call(API.userMonitorAdd, chat));
  const remove = async (chat) => {
    autoSave.cancel(`keywords:${chat.chatId}`);
    if (!await autoSave.flush()) return;
    autoSave.cancel(`keywords:${chat.chatId}`);
    return act(`remove:${chat.chatId}`, () => call(API.userMonitorRemove, { chatId: chat.chatId }), () => {
      setDrawer(null);
      setHistoricalWorker(null);
    });
  };
  const setChat = (chat, patch) => act(`mode:${chat.chatId}`, () => call(API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    autoSave.schedule(key, () => {
      invalidate();
      return call(method, payload);
    }, delay, (value) => { setMonitor(value); onSaved?.(value); });
  };
  const toggle = () => act('toggle', () => call(API.userMonitorEnable, { enabled: monitor?.enabled !== true }));
  const toggleDirect = () => act('toggle-direct', () => call(API.userMonitorDirectEnable, { enabled: !directEnabled }));
  const poll = () => act('poll', () => call(API.userMonitorPoll, {}));
  const flushPending = () => act('flush', () => call(API.userMonitorFlush, {}));
  const flushChat = (chatId) => act(`flush:${chatId}`, () => call(API.userMonitorFlush, { chatId }));

  const discover = () => act('chats', async () => {
    const value = await call(API.userMonitorChats, {});
    setAvailable(Array.isArray(value?.chats) ? value.chats.filter((chat) => chat.chatMode === 'group') : []);
    return null;
  });
  const openPicker = () => {
    setDrawer('add');
    if (!available) void discover();
  };

  const chats = (Array.isArray(monitor?.chats) ? monitor.chats : []).filter((chat) => directEnabled || chat.chatMode !== 'p2p');
  const groupChats = chats.filter((chat) => chat.chatMode === 'group');
  const directChats = chats.filter((chat) => chat.chatMode === 'p2p');
  const monitored = new Set(groupChats.map((chat) => chat.chatId));
  const candidates = (available ?? []).filter((chat) => !monitored.has(chat.chatId));
  const pendingTotal = chats.reduce((sum, chat) => sum + (chat.pendingBatch || 0), 0);
  const formatTime = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleTimeString() : '—');

  const lastPollAt = chats.reduce((latest, chat) => Math.max(latest, Number(chat.lastPollAt) || 0), 0);
  const control = { ...S.input, height: '36px' };
  const shortId = (id = '') => id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
  const field = (label, props, options) => h('label', { className: 'bxf-identity-field' },
    h('span', null, label), h('select', { 'aria-label': label, ...props, style: control, className: 'bxf-identity-control' }, options));

  const chatSettings = (chat) => {
    const mode = chat.mode ?? 'mention';
    return h('div', { key: chat.chatId, className: 'bxf-avatar-chat-settings' },
      h('strong', null, chat.name || chat.chatId),
      h('code', { className: 'bxf-work-meta' }, chat.chatId),
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
        })) : null);
  };
  const keyword = chatFilter.trim().toLowerCase();
  // Searching also shows selected chats, so an exact match never looks missing.
  const filtered = keyword
    ? (available ?? []).filter((chat) => `${chat.name || ''} ${chat.chatId}`.toLowerCase().includes(keyword))
    : candidates;
  const pickerSection = drawer === 'add' ? h('div', { className: 'bxf-identity-picker' },
    h('input', { style: control, className: 'bxf-identity-control', value: chatFilter, autoFocus: true,
      'aria-label': t('搜索群聊', 'Search group chats'), placeholder: t('搜索群名或 ID', 'Search group name or ID'),
      onChange: (event) => setChatFilter(event.target.value),
    }),
    available === null ? h('p', { className: 'bxf-identity-hint', role: 'status' }, busy === 'chats' ? t('正在读取群聊列表…', 'Loading group chats…') : t('群聊列表尚未加载，可重试。', 'Group chats could not be loaded. Retry to load them.'))
      : filtered.length === 0 ? h('p', { className: 'bxf-identity-hint' }, keyword
        ? t('没有找到匹配的群聊，试试其他关键词。', 'No matching group chats. Try another keyword.')
        : available.length ? t('所有可用群聊都已添加。', 'All available group chats have been added.')
          : t('暂无可添加的群聊。', 'No group chats are available.'))
        : h('div', { className: 'bxf-identity-picker-list' }, filtered.map((chat) => {
          const added = monitored.has(chat.chatId);
          return h('div', { key: chat.chatId, className: 'bxf-identity-candidate' },
            h('div', { className: 'bxf-identity-candidate-info' },
              h('strong', { title: chat.name || chat.chatId }, chat.name || chat.chatId),
              h('span', { className: 'bxf-identity-chat-meta', title: chat.chatId }, shortId(chat.chatId))),
            h('button', { type: 'button', className: 'bxf-mini', disabled: added || busy === `add:${chat.chatId}`,
              onClick: () => void add(chat),
            }, added ? t('已添加', 'Added') : busy === `add:${chat.chatId}` ? t('添加中…', 'Adding…') : t('添加', 'Add')));
        }))) : null;

  const selectedChat = chats.find((chat) => chat.chatId === selectedId);
  const selected = selectedChat ?? chats[0];
  React.useEffect(() => {
    if (!monitor || !selectedId || selectedChat) return;
    setSelectedId(null);
    setHistoricalWorker(null);
    setMobileDetail(false);
    setDrawer((value) => value === 'add' ? value : null);
  }, [monitor, selectedId, selectedChat]);
  const openDetails = (kind) => {
    setSelectedId(selected.chatId);
    setDrawer(kind);
  };
  const sessionId = historicalWorker && historicalWorker.chatId === selected?.chatId ? historicalWorker.sessionId : selected?.sessionId;
  const needle = search.trim().toLowerCase();
  const watching = monitor?.enabled && monitor.authorization?.authorized;
  const status = !monitor?.enabled ? t('已暂停', 'Paused') : !monitor.authorization?.authorized ? t('等待授权', 'Awaiting authorization') : t('监听中', 'Watching');
  const titles = { chat: t('监听设置', 'Monitoring settings'), messages: t('消息详情', 'Message details'), add: t('添加群聊', 'Add group chat') };
  const saveStatus = h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry });
  const chatRows = (items, empty) => {
    const visible = items.filter((chat) => `${chat.name || ''} ${chat.chatId}`.toLowerCase().includes(needle));
    if (!visible.length) {
      const message = items.length && needle ? t('没有匹配的会话', 'No matching chats') : empty;
      return message ? h('p', { className: 'bxf-avatar-section-empty' }, message) : null;
    }
    return visible.map((chat) => h('button', {
      key: chat.chatId, type: 'button', className: 'bxf-avatar-chat-row', 'aria-label': `${t('查看会话', 'View chat')} ${chat.name || chat.chatId}`,
      'aria-pressed': selected?.chatId === chat.chatId, disabled: busy === 'select-chat', onClick: () => void selectChat(chat),
    }, h('span', { className: 'bxf-avatar-chat-top' }, h('strong', null, chat.name || chat.chatId),
      chat.pendingBatch > 0 && h('span', { className: 'bxf-avatar-count' }, chat.pendingBatch)),
    h('span', { className: 'bxf-work-meta' }, chat.dispatching ? t('派发中', 'Dispatching') : chat.lastError ? t('派发异常', 'Dispatch error') : chat.sessionId ? t('Worker 已就绪', 'Worker ready') : t('等待首次派发', 'Awaiting first dispatch'))));
  };
  const showChatDrawer = Boolean(selectedChat && (drawer === 'messages' || (drawer === 'chat' && selectedChat.chatMode === 'group')));
  return h('div', { className: 'bxf-avatar-workspace' },
    error && !drawer && h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
      loadError && h('button', { type: 'button', className: 'bxf-mini', onClick: () => void load() }, t('重试', 'Retry'))),
    !drawer && autoSave.state.status === 'error' && saveStatus,
    h('div', { className: 'bxf-avatar-split', 'data-detail': mobileDetail && selected ? 'true' : 'false' },
      h('aside', { className: 'bxf-avatar-rail', 'aria-label': t('监听会话', 'Monitored chats') },
        h('div', { className: 'bxf-avatar-rail-head' },
          h('div', { className: 'bxf-work-heading' }, h('strong', null, `${t('监听会话', 'Monitored chats')} · ${chats.length}`),
            monitor && h('span', { style: S.badge(watching ? 'ok' : 'muted') }, status)),
          h('div', { className: 'bxf-avatar-rail-actions' },
            h('button', { type: 'button', className: 'bxf-mini', disabled: !monitor || Boolean(busy), onClick: () => void toggle() }, monitor?.enabled ? t('停止监听', 'Stop monitoring') : t('开始监听', 'Start monitoring')),
            h('button', { type: 'button', className: 'bxf-mini', disabled: !monitor?.enabled || Boolean(busy), onClick: () => void poll() }, busy === 'poll' ? t('检查中…', 'Checking…') : t('立即检查', 'Check now')),
            h('button', { type: 'button', className: 'bxf-mini', disabled: !monitor, onClick: openPicker }, t('添加群聊', 'Add group chat'))),
          h('button', { type: 'button', className: 'bxf-avatar-direct-toggle', role: 'switch', 'aria-checked': directEnabled,
            disabled: !monitor || Boolean(busy), onClick: () => void toggleDirect() }, t('监听所有私聊', 'Monitor all direct chats')),
          h('input', { style: control, value: search, 'aria-label': t('搜索监听会话', 'Search monitored chats'), placeholder: t('搜索会话', 'Search chats'), onChange: (event) => setSearch(event.target.value) })),
        h('nav', { className: 'bxf-avatar-chat-list', 'aria-label': t('监听会话列表', 'Monitored chat list') },
          !monitor ? h('div', { className: 'bxf-work-empty', role: 'status' }, t('正在读取…', 'Loading…'))
            : h(React.Fragment, null,
              h('section', { className: 'bxf-avatar-chat-section', 'aria-label': t('群聊', 'Group chats') },
                h('h3', null, `${t('群聊', 'Group chats')} · ${groupChats.length}`),
                chatRows(groupChats, t('还没有添加群聊。', 'No groups added yet.'))),
              h('section', { className: 'bxf-avatar-chat-section', 'aria-label': t('私聊', 'Direct chats') },
                h('h3', null, `${t('私聊', 'Direct chats')} · ${directChats.length}`),
                directEnabled && monitor.directError && h('p', { className: 'bxf-avatar-section-empty bxf-avatar-section-error', role: 'alert' }, monitor.directError),
                directEnabled && chatRows(directChats, monitor.directError ? null
                  : !monitor.enabled ? t('启动监听后将自动发现私聊。', 'Direct chats will be discovered when monitoring starts.')
                    : !watching ? t('授权后将自动发现私聊。', 'Direct chats will be discovered after authorization.')
                      : t('等待自动发现私聊。', 'Waiting to discover direct chats.'))))),
        h('footer', { className: 'bxf-avatar-rail-footer' },
          h('span', { className: 'bxf-work-meta' }, `${t('最近检查', 'Last checked')} ${formatTime(lastPollAt)}`),
          pendingTotal > 0 && h('button', { type: 'button', className: 'bxf-mini', disabled: !monitor?.enabled || Boolean(busy), onClick: () => void flushPending() }, t('重试派发', 'Retry dispatch')))),
      h('main', { className: 'bxf-avatar-conversation' }, selected
        ? h(WorkerConversationPanel, {
          worker: { ...selected, sessionId }, currentSessionId: selected.sessionId, workerView, onOpenSession,
          onBack: () => setMobileDetail(false), onCurrent: () => void selectChat(selected),
          actions: h(React.Fragment, null,
            h('button', { type: 'button', className: 'bxf-mini', onClick: () => openDetails('messages') }, t('查看消息', 'View messages')),
            selected.chatMode === 'group' && h('button', { type: 'button', className: 'bxf-mini', onClick: () => openDetails('chat') }, t('监听设置', 'Monitoring settings'))),
        }) : h('div', { className: 'bxf-work-empty' }, t('添加群聊或开启私聊监听', 'Add a group or enable direct chat monitoring')))),
    h(Drawer, { open: (drawer === 'add' || showChatDrawer) && active, title: titles[drawer] || '', onClose: closeDrawer },
      error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error),
      saveStatus,
      drawer === 'chat' && showChatDrawer && chatSettings(selected),
      drawer === 'messages' && showChatDrawer && h(React.Fragment, null,
        h('h3', null, selected.name || selected.chatId),
        h('div', { className: 'bxf-avatar-delivery' },
          h('span', { className: 'bxf-work-meta', title: t('已投递给 Worker，不代表已回复', 'Delivered to the Worker; not a reply receipt') }, `${t('最近投递', 'Last delivered')} ${formatTime(selected.lastDispatchAt)}`),
          selected.dispatching ? h('span', null, t('派发中…', 'Dispatching…')) : selected.scheduledAt ? h('span', { className: 'bxf-work-meta' }, `${t('计划派发', 'Scheduled dispatch')} ${formatTime(selected.scheduledAt)}`) : null,
          selected.pendingBatch > 0 && h('button', { type: 'button', className: 'bxf-mini', disabled: !monitor.enabled || Boolean(busy) || selected.dispatching, onClick: () => void flushChat(selected.chatId) }, t('派发本批', 'Dispatch batch'))),
        selected.lastError && h('div', { className: 'bxf-work-alert', role: 'alert' }, selected.lastError),
        h(MonitorDetail, { key: selected.chatId, connection, botId, chatId: selected.chatId, active: active && drawer === 'messages', onViewWorker: (id) => selectChat(selected, id) })),
      drawer === 'add' && h(React.Fragment, null, pickerSection,
        available === null && busy !== 'chats' && h('button', { type: 'button', className: 'bxf-mini', onClick: () => void discover() }, t('重试', 'Retry')))));
}
