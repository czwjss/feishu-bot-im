import React from 'react';
import { API, rpc, t } from './shared.js';
import { useMutation } from './hooks.js';
import { BotHeader } from './bot.js';
import { dateText, Facts } from './conversations.js';
import { ActionButton } from './action-button.js';
import { ActionMenu } from './action-menu.js';
import { IdentityStatus } from './identity.js';
import { BotConfiguration } from './bots-panel.js';
import { StatusSettings } from './status-settings.js';

const h = React.createElement;

/** Status and editable settings stay grouped under the account they belong to. */
export function BotStatus({ connection, bot, bots, identityQuery, monitorQuery, avatarReady, registerSave, active, beforeRemove, onChanged, onRefresh, refreshing }) {
  const [diagnosis, setDiagnosis] = React.useState(null);
  React.useEffect(() => {
    if (bot.state === 'connected' && diagnosis && !diagnosis.connected) setDiagnosis(null);
  }, [bot.state, diagnosis]);
  const { busy, error, run } = useMutation();
  const diagnose = () => run('diagnose', () => {
    setDiagnosis(null);
    return rpc(connection, API.botCheck, { botId: bot.id });
  }, setDiagnosis);
  const remove = () => run('remove', async () => {
    if (!await beforeRemove()) return;
    const name = bot.alias || bot.botName || bot.id;
    if (!window.confirm(t(`删除「${name}」？本机将删除该机器人的配置与密钥，不影响飞书应用本身。`, `Delete ${name}? Local config and secret are deleted; the Feishu app stays.`))) return;
    await rpc(connection, API.botRemove, { botId: bot.id });
    await onChanged();
  });
  const section = (title, rows) => h('section', { className: 'bxf-status-section', 'aria-label': title },
    h('h3', null, title), h(Facts, { rows }));
  return h('article', { className: 'bxf-runtime-status' },
    h('section', { className: 'bxf-status-block', 'aria-label': t('机器人状态', 'Bot status') },
      h(BotHeader, { connection, bot, onChanged, onRefresh, refreshing, active,
        actions: h(ActionButton, { active, hintId: `bxf-${bot.id}-diagnose-tip`, disabled: Boolean(busy),
          hint: t('校验应用凭证与长连接状态，不发送消息，也不自动重连。', 'Verify app credentials and connection status without sending messages or reconnecting.'),
          onClick: () => void diagnose() }, busy === 'diagnose' ? t('诊断中…', 'Diagnosing…') : t('连接诊断', 'Diagnose connection')),
        extraActions: h(ActionMenu, { disabled: Boolean(busy), active, renderActions: (close) =>
          h('button', { type: 'button', className: 'bxf-mini bxf-danger', disabled: Boolean(busy),
            style: { color: 'var(--dsw-alias-state-error-primary)' },
            onClick: () => { close(); return remove(); },
          }, t('删除机器人', 'Delete bot')) }),
      }),
      error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error),
      diagnosis && h('div', { className: 'bxf-work-diagnosis', role: 'status' },
        h('span', null, diagnosis.connected ? t('凭证有效，长连接正常', 'Credentials verified; connection is active')
          : t('凭证有效，长连接未就绪，可点击重连', 'Credentials verified; connection is not ready. Reconnect to retry.')),
        h('time', { className: 'bxf-work-meta' }, dateText(diagnosis.checkedAt))),
      h('div', { className: 'bxf-status-grid' },
        section(t('应用信息', 'Application'), [
          [t('应用 ID', 'App ID'), h('code', null, bot.appId || '—')],
          [t('机器人', 'Bot'), bot.botName],
          [t('机器人 Open ID', 'Bot Open ID'), h('code', null, bot.botOpenId || '—')],
          [t('已绑定会话', 'Bound chats'), bot.boundChats ?? 0],
        ]),
        section(t('运行观测', 'Runtime observations'), [
          [t('连接时间', 'Connected at'), dateText(bot.connectedAt)],
          [t('本次连接接收', 'Received this connection'), bot.inbound?.messagesReceived ?? '—'],
          [t('最近事件', 'Last event'), bot.inbound?.lastEventType],
          [t('事件时间', 'Event time'), dateText(bot.inbound?.lastEventAt)],
        ])),
      bot.lastError && h('section', { className: 'bxf-status-error', role: 'status' },
        h('div', { className: 'bxf-work-heading' }, h('h3', null, t('最近错误', 'Last error')),
          bot.lastError.at && h('time', { className: 'bxf-work-meta' }, dateText(bot.lastError.at))),
        bot.lastError.code && h('code', null, bot.lastError.code),
        h('p', null, bot.lastError.message || String(bot.lastError))),
      h(StatusSettings, { visible: bot.state === 'connected', title: t('机器人设置', 'Bot settings') },
        h(BotConfiguration, { connection, bot, onChanged, registerSave }))),
    h(IdentityStatus, { connection, bot, bots, active, query: identityQuery, monitorQuery, settingsVisible: avatarReady, registerSave, beforeDisconnect: beforeRemove }));
}
