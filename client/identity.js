import React from 'react';

import { API, S, rpc, t } from './shared.js';
import { Facts, dateText } from './conversations.js';
import { useMutation } from './hooks.js';
import { ActionButton } from './action-button.js';
import { ActionMenu } from './action-menu.js';
import { AvatarWorkspace } from './avatar-workspace.js';
import { AvatarReplySettings } from './avatar-reply-settings.js';
import { StatusSettings } from './status-settings.js';

const h = React.createElement;

/** Authorization details and actions live in the selected bot's status page. */
export function IdentityStatus({ connection, bot, bots, active, query, monitorQuery, settingsVisible, registerSave, beforeDisconnect }) {
  const { data: status, error: queryError } = query;
  const [notice, setNotice] = React.useState(null);
  const { busy, error: actionError, run } = useMutation();
  const ownerId = status?.config?.app?.botId;
  const currentBot = ownerId === bot.id;
  const authorized = currentBot && status?.authorization?.authorized;
  const pending = currentBot && status?.connect?.phase === 'pending';
  const owner = bots.find((item) => item.id === ownerId);
  const auth = authorized ? status.authorization : null;
  const expired = auth?.refreshTokenExpiresAt > 0 && auth.refreshTokenExpiresAt <= Date.now();
  const incomplete = auth?.scopeSatisfied === false;
  const name = auth?.user?.name || t('飞书分身', 'Feishu avatar');
  const state = pending ? t('等待扫码', 'Awaiting scan') : expired ? t('需重新授权', 'Re-authorization required')
    : incomplete ? t('授权不完整', 'Incomplete authorization') : authorized ? t('已连接', 'Connected') : t('未连接', 'Disconnected');
  const error = actionError || queryError || (currentBot && status?.connect?.error);
  const update = (label, method, success) => run(label, async () => {
    setNotice(null);
    query.invalidate();
    const result = await rpc(connection, method, { botId: bot.id });
    // Mutations returning a full snapshot replace older in-flight status reads.
    if (method === API.userConnectBegin) { query.invalidate(); await query.refresh(); }
    else query.accept(result);
  }, () => setNotice(success || null));
  const disconnect = async () => {
    if (!await beforeDisconnect()) return;
    if (!window.confirm(t(`断开「${name}」的分身授权？将清除本地凭证，保留监听配置和 Worker 会话。`, `Disconnect ${name}? Local credentials are cleared; monitoring settings and Worker sessions are kept.`))) return;
    return update('disconnect', API.userDisconnect, t('已断开授权', 'Disconnected'));
  };
  const action = (id, hint, onClick, label, disabled = Boolean(busy)) => h(ActionButton, {
    active, hintId: `bxf-${bot.id}-avatar-${id}-tip`, hint, disabled, onClick,
  }, label);
  return h('section', { className: 'bxf-status-block bxf-status-avatar', 'aria-label': t('分身状态', 'Avatar status') },
    h('header', { className: 'bxf-status-summary bxf-work-heading' },
      h('div', { className: 'bxf-status-identity-title' },
        h('h2', null, name),
        authorized && auth.user?.name && h('span', { className: 'bxf-work-meta' }, t('飞书分身', 'Feishu avatar')),
        status && h('span', { style: S.badge(expired || incomplete || pending ? 'warn' : authorized ? 'ok' : 'muted') }, state)),
      h('div', { className: 'bxf-bot-actions' },
        pending ? action('cancel', t('取消当前扫码授权请求，保留已有授权。', 'Cancel this authorization request and keep the existing grant.'),
          () => update('cancel', API.userConnectCancel), busy === 'cancel' ? t('取消中…', 'Cancelling…') : t('取消扫码', 'Cancel scan'))
          : action('connect', t('扫码授权当前分身，以本人身份访问飞书。', 'Authorize this avatar by scanning to access Feishu as yourself.'),
            () => update('connect', API.userConnectBegin), busy === 'connect' ? t('正在发起…', 'Starting…')
              : authorized ? t('重新授权', 'Re-authorize') : t('连接分身', 'Connect avatar'), !status || Boolean(busy)),
        authorized && action('refresh', t('使用刷新凭证更新访问凭证；授权到期后需要重新扫码。', 'Use the refresh token to renew access. Re-authorize if the grant has expired.'),
          () => update('refresh', API.userRefresh, t('凭证已刷新', 'Credentials refreshed')), busy === 'refresh' ? t('刷新中…', 'Refreshing…') : t('刷新凭证', 'Refresh credentials'), Boolean(busy) || pending),
        authorized && h(ActionMenu, { active, disabled: Boolean(busy) || pending, label: t('分身更多操作', 'More avatar actions'),
          renderActions: (close) => h(ActionButton, { active, disabled: Boolean(busy) || pending,
            hintId: `bxf-${bot.id}-avatar-disconnect-tip`,
            hint: t('清除分身的本地授权凭证，保留监听配置与 Worker 会话。', 'Clear local avatar credentials while keeping monitoring settings and Worker sessions.'),
            style: { color: 'var(--dsw-alias-state-error-primary)' },
            onClick: () => { close(); return disconnect(); },
          }, t('断开授权', 'Disconnect')),
        }))),
    error && h('div', { className: 'bxf-identity-alert', role: 'alert' }, error,
      queryError && h('button', { type: 'button', className: 'bxf-mini', onClick: () => void query.refresh() }, t('重试', 'Retry'))),
    !error && notice && h('div', { className: 'bxf-identity-notice', role: 'status' }, notice),
    incomplete && h('div', { className: 'bxf-identity-alert', role: 'alert' },
      `${t('当前授权缺少权限，请重新授权：', 'Authorization is missing scopes; re-authorize: ')}${(auth.missingScopes ?? []).slice(0, 6).join('、')}${auth.missingScopes?.length > 6 ? ' …' : ''}`),
    !status ? h('p', { className: 'bxf-work-meta', role: 'status' }, queryError ? t('读取状态失败，请重试。', 'Unable to load status. Please retry.') : t('正在读取…', 'Loading…'))
      : authorized ? h('dl', { className: 'bxf-avatar-credentials' }, [
        ['Open ID', auth.user?.openId],
        [t('授权到期', 'Authorization expires'), dateText(auth.refreshTokenExpiresAt)],
        [t('访问凭证到期', 'Access token expires'), dateText(auth.accessTokenExpiresAt)],
      ].map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value || '—'))))
        : h(Facts, { rows: owner && !currentBot ? [[t('当前分身归属', 'Current avatar belongs to'), owner.alias || owner.botName || owner.id]] : [] }),
    ownerId && !currentBot && h('p', { className: 'bxf-identity-hint' }, t('当前仅支持一份分身授权；连接后会切换授权应用，并沿用现有监听配置。', 'Only one avatar authorization is supported. Connecting switches its app and retains existing monitoring settings.')),
    pending && h('div', { className: 'bxf-status-auth-scan' },
      h('p', { className: 'bxf-work-meta' }, t('扫码后在飞书确认。', 'Confirm in Feishu after scanning.')),
      status.connect.qrCodeDataUrl && h('div', { className: 'bxf-identity-qr' },
        h('img', { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: t('飞书授权二维码', 'Feishu authorization QR code') })),
      h('p', { className: 'bxf-work-meta' }, `${t('二维码到期', 'QR code expires')} · ${dateText(status.connect.expiresAt)}`)),
    h(StatusSettings, { visible: settingsVisible, title: t('自动回复设置', 'Auto-reply settings') },
      h(AvatarReplySettings, { connection, botId: bot.id, query: monitorQuery, registerSave })));
}

export function IdentityPanel({ connection, bot, active, query, monitorQuery, onStatus, saveRef, onOpenSession, workerView }) {
  const { data: status, error, refresh } = query;
  const currentBot = status?.config?.app?.botId === bot.id;
  return h('div', { className: 'bxf-work-identity' },
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
      h('button', { type: 'button', className: 'bxf-mini', onClick: () => void refresh() }, t('重试', 'Retry'))),
    currentBot ? h(AvatarWorkspace, { connection, botId: bot.id, query: monitorQuery, saveRef, onOpenSession, workerView, active })
      : h('div', { className: 'bxf-work-empty' }, !status ? t('正在读取…', 'Loading…') : h(React.Fragment, null,
        h('p', null, t('此机器人尚未连接分身', 'This bot has no connected avatar')),
        h('button', { type: 'button', className: 'bxf-mini', onClick: onStatus }, t('前往状态页连接', 'Connect on the status page')))));
}
