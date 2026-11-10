import React from 'react';

import { API, S, rpc, t } from './shared.js';

const h = React.createElement;

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
              confirmDisconnect ? t('确认断开？', 'Confirm disconnect?') : t('断开授权', 'Disconnect'))));
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

