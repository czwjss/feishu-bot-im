import React from 'react';
import { S, t } from './shared.js';
import { chatKey, chatState, filterChats } from './workspace-model.js';
import { useMutation } from './hooks.js';
import { ActionButton } from './action-button.js';
import { SessionBinding } from './session-binding.js';

const h = React.createElement;
export const dateText = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const modelText = (model) => model?.model ? `${model.provider} · ${model.model}${model.reasoningEffort ? ` · ${model.reasoningEffort}` : ''}` : '—';
const kind = (chat) => chat.chatType === 'p2p' ? t('私聊', 'Direct') : chat.chatType === 'group' ? t('群聊', 'Group') : t('类型未知', 'Unknown type');
export function Facts({ rows }) {
  return h('dl', { className: 'bxf-work-facts' }, rows.flatMap(([label, value]) => [
    h('dt', { key: `${label}:label` }, label), h('dd', { key: label }, value ?? '—'),
  ]));
}

export function ChatBadge({ chat }) {
  const state = chatState(chat);
  const labels = {
    conflict: t('绑定冲突', 'Binding conflict'), unbound: t('未绑定', 'Unbound'),
    unavailable: t('会话不可用', 'Session unavailable'), running: t('处理中', 'Running'),
    queued: t('排队中', 'Queued'), unknown: t('状态未知', 'Unknown'), bound: t('已绑定', 'Bound'),
  };
  return h('span', { style: S.badge(['conflict', 'unavailable'].includes(state) ? 'warn' : state === 'running' ? 'ok' : 'muted') }, labels[state]);
}

export function Conversations({ connection, snapshot, active = true, onOpenSession, onBind, onUnbind, onBot }) {
  const [query, setQuery] = React.useState('');
  const [state, setState] = React.useState('');
  const [chatType, setChatType] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [bindingChat, setBindingChat] = React.useState(null);
  const { busy, error, run } = useMutation();
  const chats = filterChats(snapshot.chats, { query, state, chatType });
  const chat = chats.find((item) => chatKey(item) === selected) ?? chats[0];
  const selectedKey = chat ? chatKey(chat) : null;
  React.useEffect(() => { setBindingChat(null); setNotice(null); }, [selectedKey]);
  const editingBinding = bindingChat !== null && bindingChat === selectedKey;
  const bot = snapshot.bots.find((item) => item.id === chat?.botId);
  const next = chat?.nextSession;
  const source = (name) => next?.overrides?.includes(name) ? t('会话覆盖', 'Chat override') : t('机器人默认', 'Bot default');
  const unbind = () => {
    if (!chat?.sessionId || busy) return;
    const binding = { botId: chat.botId, chatId: chat.chatId, sessionId: chat.sessionId };
    const title = chat.title || chat.chatId;
    if (!window.confirm(t(`解除「${title}」与当前 DSH 会话的绑定？\n原 DSH 会话及历史记录会保留，下一条触发消息将创建新会话。`,
      `Unbind “${title}” from its current DSH session?\nThe session and history are kept. The next triggering message creates a new session.`))) return;
    setNotice(null);
    return run(chatKey(chat), () => onUnbind(binding), () => setNotice(t(`已解绑「${title}」`, `Unbound “${title}”`)));
  };
  return h(React.Fragment, null,
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error),
    notice && h('div', { className: 'bxf-identity-notice', style: { marginBottom: '14px' }, role: 'status' }, notice),
    h('div', { className: 'bxf-work-toolbar bxf-chat-toolbar' },
      h('input', { style: S.input, type: 'search', value: query, onChange: (event) => setQuery(event.target.value),
        placeholder: t('搜索会话、chatId 或 Session', 'Search chats, chatId or Session'), 'aria-label': t('搜索会话', 'Search chats') }),
      h('div', { className: 'bxf-work-filters' },
        h('select', { style: S.input, value: chatType, 'aria-label': t('筛选会话类型', 'Filter chat type'), onChange: (event) => setChatType(event.target.value) },
          h('option', { value: '' }, t('全部类型', 'All types')),
          h('option', { value: 'group' }, t('群聊', 'Group')),
          h('option', { value: 'p2p' }, t('私聊', 'Direct'))),
        h('select', { style: S.input, value: state, 'aria-label': t('筛选绑定', 'Filter bindings'), onChange: (event) => setState(event.target.value) },
          h('option', { value: '' }, t('全部绑定状态', 'All bindings')),
          h('option', { value: 'bound' }, t('已绑定', 'Bound')),
          h('option', { value: 'unbound' }, t('未绑定', 'Unbound')),
          h('option', { value: 'issues' }, t('需要关注', 'Needs attention'))))),
    h('div', { className: 'bxf-work-split' },
      h('div', { className: 'bxf-work-list', 'aria-label': t('飞书会话', 'Feishu chats') },
        h('div', { className: 'bxf-work-listhead' }, `${chats.length} ${t('个会话 · 可见群聊与已知绑定', 'chats · visible groups and known bindings')}`),
        chats.length === 0 && h('div', { className: 'bxf-work-empty' }, t('没有匹配的会话', 'No matching chats')),
        chats.map((item) => {
          const owner = snapshot.bots.find((value) => value.id === item.botId);
          return h('button', { key: chatKey(item), type: 'button', className: 'bxf-work-row',
            'aria-pressed': chatKey(item) === (chat && chatKey(chat)), onClick: () => setSelected(chatKey(item)),
          }, h('div', null, h('strong', { title: item.title }, item.title),
            h('div', { className: 'bxf-work-meta' }, `${kind(item)} · ${owner?.alias || owner?.botName || item.botId}`)),
          h('div', { className: 'bxf-work-row-end' }, h(ChatBadge, { chat: item }),
            h('div', { className: 'bxf-work-meta', title: item.session?.title || item.sessionId || '' }, item.session?.title || item.sessionId || '—')));
        })),
      chat ? h('section', { className: 'bxf-work-detail', 'aria-label': t('会话详情', 'Chat details') },
        h('div', { className: 'bxf-work-heading' }, h('h2', null, chat.title), h(ChatBadge, { chat })),
        h('div', { className: 'bxf-work-meta' }, `${kind(chat)} · ${bot?.alias || bot?.botName || chat.botId}`),
        h(Facts, { rows: [
          ['Chat ID', h('code', null, chat.chatId)],
          ['DSH Session', chat.sessionId ? h('code', null, chat.sessionId) : t('未绑定', 'Unbound')],
          [t('最近活动', 'Last activity'), dateText(chat.session?.updatedAt)],
          [t('工作区', 'Workspace'), chat.session?.cwd],
          [t('当前模型', 'Current model'), modelText(chat.session?.model)],
          [t('本地排队', 'Local queue'), chat.activity?.queuedMessages ?? '—'],
        ] }),
        chat.conflict && h('div', { className: 'bxf-work-alert' }, t('此 Session 存在多个绑定，请核对后再调整。', 'This Session has multiple bindings. Review them before making changes.')),
        h('div', { style: S.row },
          !editingBinding && h(ActionButton, { active, variant: chat.sessionId ? 'default' : 'primary', hintId: `bxf-${chat.botId}-chat-bind-tip`, disabled: Boolean(busy),
            hint: t('选择已有 DSH 会话承接后续消息，保留该会话的历史与配置。', 'Select an existing DSH session for future messages, keeping its history and settings.'),
            onClick: () => { setNotice(null); setBindingChat(selectedKey); },
          }, chat.sessionId ? t('更换绑定', 'Change binding') : t('绑定会话', 'Bind session')),
          chat.sessionId && h('button', { type: 'button', style: S.btn('primary'),
            disabled: chat.bindingState === 'unavailable', onClick: () => void onOpenSession(chat.sessionId),
          }, t('打开 DSH 会话', 'Open DSH session')),
          chat.sessionId && h(ActionButton, { active, variant: 'default', hintId: `bxf-${chat.botId}-chat-unbind-tip`, disabled: Boolean(busy) || editingBinding,
            hint: t('解除与 DSH 会话的绑定，保留原会话和历史；下次触发消息会创建新会话。', 'Detach the DSH session and keep its history. The next triggering message creates a new session.'),
            style: { color: 'var(--dsw-alias-state-error-primary)' }, onClick: unbind,
          }, busy === chatKey(chat) ? t('解绑中…', 'Unbinding…') : t('解绑', 'Unbind'))),
        editingBinding && h(SessionBinding, { key: selectedKey, connection, chat, active, onBind,
          onCancel: () => setBindingChat(null),
          onBound: () => { setBindingChat(null); setNotice(t('会话已绑定，后续触发消息将进入该会话。', 'Session bound. Future triggering messages will use this session.')); },
        }),
        h('h3', null, t('下次新建会话', 'Next new session')),
        h(Facts, { rows: [
          [t('工作区', 'Workspace'), `${next?.workspace || t('跟随 Host 默认', 'Host default')} · ${source('workspace')}`],
          [t('模型', 'Model'), `${next?.model ? modelText(next.model) : t('跟随 Host 默认', 'Host default')} · ${source('model')}`],
          [t('预设', 'Preset'), `${next?.preset || t('跟随 Host 默认', 'Host default')} · ${source('preset')}`],
        ] }),
        h('button', { type: 'button', style: S.btn(), onClick: () => onBot(chat.botId) }, t('机器人配置', 'Bot settings')))
        : h('div', { className: 'bxf-work-detail bxf-work-empty' }, t('选择会话查看绑定', 'Select a chat to view its binding'))));
}
