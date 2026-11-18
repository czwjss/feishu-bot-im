import React from 'react';
import { API, S, t } from './shared.js';
import { usePolling, useRpcQuery } from './hooks.js';
import { dateText } from './conversations.js';

const h = React.createElement;

/** Mounted on demand, with message bodies rendered only as text. */
export function MonitorDetail({ connection, botId, chatId, active, onViewWorker }) {
  const { data, error, refresh } = useRpcQuery(connection, API.userMonitorDetail, null, { botId, chatId });
  usePolling(refresh, { interval: 10_000, scope: chatId, enabled: active });
  const [filter, setFilter] = React.useState('pending');
  const labels = {
    pending: t('待处理', 'Pending'), background: t('上下文消息', 'Context messages'), excluded: t('已排除', 'Excluded'),
  };
  if (error) return h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
    h('button', { type: 'button', style: S.btn(), onClick: () => void refresh() }, t('重试', 'Retry')));
  if (!data) return h('div', { className: 'bxf-work-meta' }, t('正在读取…', 'Loading…'));
  const messages = data.messages.filter((message) => message.category === filter);
  return h('div', { className: 'bxf-identity-chat-extra' },
    h('div', { className: 'bxf-work-toolbar' },
      h('select', { style: S.input, value: filter, 'aria-label': t('消息分类', 'Message category'), onChange: (event) => setFilter(event.target.value) },
        Object.entries(labels).map(([value, label]) => h('option', { key: value, value },
          `${label} · ${data.messages.filter((message) => message.category === value).length}`))),
      h('span', { className: 'bxf-work-meta' }, `${t('等待卡片收尾', 'Waiting for cards')} · ${data.pendingCards.length}`)),
    h('div', { className: 'bxf-work-batch' },
      messages.length === 0 && h('div', { className: 'bxf-work-empty' }, t('暂无记录', 'No records')),
      messages.map((message) => h('article', { key: message.messageId, className: 'bxf-work-message' },
        h('div', { className: 'bxf-work-heading' },
          h('strong', null, message.isSelf ? t('本人', 'You') : message.senderName || message.senderOpenId || t('未知发送者', 'Unknown sender')),
          h('time', { className: 'bxf-work-meta' }, dateText(message.createTime))),
        h('pre', null, message.text), h('details', { className: 'bxf-message-id' },
          h('summary', { className: 'bxf-work-meta' }, t('消息 ID', 'Message ID')), h('code', { className: 'bxf-work-meta' }, message.messageId))))),
    data.workers.some((worker) => !worker.current) && h('details', null,
      h('summary', { className: 'bxf-work-meta' }, t('历史 Worker', 'Previous Workers')),
      data.workers.filter((worker) => !worker.current).map((worker) => h('button', {
        key: worker.sessionId, type: 'button', className: 'bxf-mini', title: worker.sessionId,
        onClick: () => void onViewWorker(worker.sessionId),
      }, worker.sessionId))));
}
