import React from 'react';
import { API, S, t } from './shared.js';
import { useMutation, useRpcQuery } from './hooks.js';

const h = React.createElement;

export function SessionBinding({ connection, chat, active, onBind, onCancel, onBound }) {
  const { data, loaded, error: loadError, refresh } = useRpcQuery(connection, API.chatSessions, null, { botId: chat.botId, chatId: chat.chatId });
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState('');
  const [limit, setLimit] = React.useState(40);
  const { busy, error, run } = useMutation();
  React.useEffect(() => { if (active) void refresh(); }, [active, refresh]);
  const keyword = search.trim().toLowerCase();
  const sessions = (data?.sessions ?? []).filter((item) => !keyword
    || [item.title, item.sessionId, item.cwd].filter(Boolean).join(' ').toLowerCase().includes(keyword));
  const target = sessions.find((item) => item.sessionId === selected);
  const changed = Boolean(data && (chat.sessionId ?? null) !== data.currentSessionId);
  const ready = loaded && !loadError && !changed && target && !target.unavailableReason && selected !== data.currentSessionId;
  const submit = () => {
    if (!ready || busy) return;
    const binding = { botId: chat.botId, chatId: chat.chatId, sessionId: selected, expectedSessionId: data.currentSessionId };
    if (binding.expectedSessionId && !window.confirm(t(`将「${chat.title || chat.chatId}」更换绑定到「${target.title}」？\n原 DSH 会话及历史记录会保留。`,
      `Bind “${chat.title || chat.chatId}” to “${target.title}” instead?\nThe previous DSH session and history are kept.`))) return;
    return run('bind', () => onBind(binding), onBound);
  };
  return h('section', { className: 'bxf-session-binding', 'aria-label': t('绑定 DSH 会话', 'Bind a DSH session') },
    h('div', { className: 'bxf-work-heading' },
      h('strong', null, t('选择 DSH 会话', 'Choose a DSH session')),
      h('button', { type: 'button', className: 'bxf-mini', disabled: Boolean(busy), onClick: () => void refresh() }, t('刷新列表', 'Refresh list'))),
    h('p', { className: 'bxf-work-meta' }, t('后续触发消息将进入所选会话，保留其历史、模型和工作区。', 'Future triggering messages use the selected session, keeping its history, model and workspace.')),
    h('input', { type: 'search', style: S.input, value: search, disabled: Boolean(busy),
      placeholder: t('搜索名称、Session ID 或工作区', 'Search name, Session ID or workspace'),
      'aria-label': t('搜索 DSH 会话', 'Search DSH sessions'),
      onChange: (event) => { setSearch(event.target.value); setLimit(40); } }),
    (loadError || error) && h('div', { className: 'bxf-work-alert', role: 'alert' }, loadError || error),
    changed && h('div', { className: 'bxf-work-alert', role: 'alert' }, t('当前绑定已变化，请刷新列表后重新选择。', 'The current binding changed. Refresh the list and select again.')),
    !loaded ? h('p', { className: 'bxf-work-meta', role: 'status' }, t('正在读取会话…', 'Loading sessions…'))
      : !loadError && h('fieldset', { className: 'bxf-session-options', disabled: Boolean(busy), 'aria-label': t('DSH 会话列表', 'DSH sessions') },
        sessions.length === 0 && h('p', { className: 'bxf-work-empty' }, t('没有匹配的 DSH 会话', 'No matching DSH sessions')),
        sessions.slice(0, limit).map((item) => h('label', { key: item.sessionId, className: 'bxf-session-option', 'data-selected': selected === item.sessionId },
          h('input', { type: 'radio', name: `session-binding-${chat.botId}-${chat.chatId}`, value: item.sessionId,
            checked: selected === item.sessionId, disabled: Boolean(item.unavailableReason) || item.sessionId === data.currentSessionId,
            onChange: () => setSelected(item.sessionId) }),
          h('span', null,
            h('strong', null, item.title),
            h('span', { className: 'bxf-work-meta' }, item.cwd || t('未指定工作区', 'No workspace')),
            h('code', null, item.sessionId),
            (item.unavailableReason || item.sessionId === data.currentSessionId) && h('span', { className: 'bxf-work-meta' },
              item.unavailableReason || t('当前绑定', 'Current binding'))))),
        sessions.length > limit && h('button', { type: 'button', className: 'bxf-mini', onClick: () => setLimit((value) => value + 40) }, t('显示更多', 'Show more'))),
    h('div', { className: 'bxf-session-binding-actions' },
      h('button', { type: 'button', className: 'bxf-button', disabled: Boolean(busy), onClick: onCancel }, t('取消', 'Cancel')),
      h('button', { type: 'button', className: 'bxf-button', 'data-variant': 'primary', disabled: !ready || Boolean(busy), onClick: submit },
        busy ? t('绑定中…', 'Binding…') : t('确认绑定', 'Bind session'))));
}
