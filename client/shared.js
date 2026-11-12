import React from 'react';
import { NS } from './locale.js';

const h = React.createElement;
const RPC_ENDPOINT = 'im-feishu';

    export const API = {
      botAccessSet: 'bot.access.set',
      botAdd: 'bot.add',
      botAliasSet: 'bot.alias.set',
      botBusyModeSet: 'bot.busy-mode.set',
      botColorSet: 'bot.color.set',
      botContextSet: 'bot.context-enhancement.set',
      botEavesdropSet: 'bot.eavesdrop.set',
      botMentionsSet: 'bot.mentions.set',
      botBotReplySet: 'bot.bot-reply.set',
      botTopicsSet: 'bot.topics.set',
      botProcessDetailSet: 'bot.process-detail.set',
      botModelSet: 'bot.model.set',
      botPresetSet: 'bot.preset.set',
      botPermissionSet: 'bot.permission.set',
      botReconnect: 'bot.reconnect',
      botRemove: 'bot.remove',
      botTest: 'bot.test',
      botWorkspaceSet: 'bot.workspace.set',
      botsList: 'bots.list',
      modelsList: 'models.list',
      presetsList: 'presets.list',
      provisionBegin: 'provision.begin',
      provisionCancel: 'provision.cancel',
      provisionPoll: 'provision.poll',
      workspacesList: 'workspaces.list',
      permissionList: 'permission.list',
      userStatus: 'user.status',
      userConnectBegin: 'user.connect.begin',
      userConnectCancel: 'user.connect.cancel',
      userDisconnect: 'user.disconnect',
      userRefresh: 'user.refresh',
      userMonitorStatus: 'user.monitor.status',
      userMonitorChats: 'user.monitor.chats',
      userMonitorAdd: 'user.monitor.add',
      userMonitorRemove: 'user.monitor.remove',
      userMonitorEnable: 'user.monitor.enable',
      userMonitorWorkerSet: 'user.monitor.worker.set',
      userMonitorWorkerOptions: 'user.monitor.worker.options',
      userMonitorPoll: 'user.monitor.poll',
      userMonitorFlush: 'user.monitor.flush',
      userMonitorChatSet: 'user.monitor.chat.set',
    };

    let boundTranslate = null;
    let activeLocale = '';

    export function configureLocale(service) {
      boundTranslate = service.bind(NS);
      activeLocale = service.getLocale().active;
      return service.subscribe(() => { activeLocale = service.getLocale().active; });
    }

    export function t(zh, en) {
      const translated = boundTranslate?.(zh);
      if (translated && translated !== zh) return translated;
      const language = activeLocale || (navigator.language || '');
      return language.toLowerCase().startsWith('zh') ? zh : en;
    }
    export const text = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : String(pair));

    export const CE_FIELDS = ['senderId', 'senderName', 'botId', 'sentAt', 'conversationTitle'];
    export const CE_LABELS = {
      senderId: ['发送者 Open ID', 'Sender Open ID'],
      senderName: ['发送者名称', 'Sender name'],
      botId: ['机器人 Open ID', 'Bot Open ID'],
      sentAt: ['发送时间', 'Sent at'],
      conversationTitle: ['群名称', 'Group name'],
    };
    // 固定 5 色：每个颜色自带主色/浅底/描边三档，运行时不做颜色计算。
    export const BOT_COLORS = {
      blue: { main: '#3370ff', soft: 'rgba(51,112,255,.10)', ring: 'rgba(51,112,255,.32)', edge: '#93b4ff' },
      red: { main: '#e5484d', soft: 'rgba(229,72,77,.10)', ring: 'rgba(229,72,77,.30)', edge: '#f0a9ab' },
      green: { main: '#00b96b', soft: 'rgba(0,185,107,.10)', ring: 'rgba(0,185,107,.28)', edge: '#7fd9b4' },
      purple: { main: '#7c4dff', soft: 'rgba(124,77,255,.10)', ring: 'rgba(124,77,255,.30)', edge: '#bda6ff' },
      orange: { main: '#ff8800', soft: 'rgba(255,136,0,.12)', ring: 'rgba(255,136,0,.30)', edge: '#ffc183' },
    };
    export const COLOR_NAMES = {
      blue: ['蓝色', 'Blue'], red: ['红色', 'Red'], green: ['绿色', 'Green'],
      purple: ['紫色', 'Purple'], orange: ['橙色', 'Orange'],
    };
    export const emptyScope = () => ({ enabled: true, fields: ['senderId', 'senderName', 'botId', 'sentAt'], guidance: '' });
    export const emptyEnhancement = () => ({ group: emptyScope(), direct: emptyScope() });

    export const CSS = `
.bxf-page { --bxf-radius: 12px; }
.bxf-page select {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  padding-right: 30px !important;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
}
.bxf-page input, .bxf-page select { height: 34px; }
.bxf-page input:focus, .bxf-page select:focus, .bxf-page textarea:focus {
  outline: 2px solid var(--bxf-accent-ring, rgba(51,112,255,.32));
  outline-offset: 1px;
  border-color: var(--bxf-accent-edge, #93b4ff);
}
.bxf-page select option:checked {
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff)) !important;
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)) !important;
}
.bxf-card { transition: box-shadow .16s ease, border-color .16s ease; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-card > .bxf-head { background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,.07); border-color: var(--dsw-alias-border-l2); }
.bxf-head { border-radius: 0; }
.bxf-panel-head:hover .bxf-panel-title { color: var(--bxf-accent, #3370ff); }
.bxf-btn:hover { filter: brightness(.97); }
.bxf-icon-btn:hover { background: rgba(148,163,184,.18); color: var(--bxf-accent, var(--dsw-alias-brand-primary)); }
.bxf-mini { background: transparent !important; -webkit-appearance: none; appearance: none;
  font-size: 11px; padding: 3px 8px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #e2e8f0); background: transparent; color: var(--dsw-alias-label-secondary); }
.bxf-mini:hover { color: var(--bxf-accent, #3370ff); border-color: var(--bxf-accent-edge, #93b4ff); background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; }
.bxf-check { background: transparent !important; -webkit-appearance: none; appearance: none;
  width: 27px; height: 27px; border-radius: 8px; cursor: pointer; flex: none;
  border: 1px solid var(--dsw-alias-border-l1, #d1d5db); background: transparent;
  color: var(--bxf-accent, #3370ff); font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
.bxf-check:hover, .bxf-check:focus { background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; border-color: var(--bxf-accent-edge, #93b4ff); }
.bxf-check:active { background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; }
.bxf-danger:hover { background: rgba(185,28,28,.07); border-color: rgba(185,28,28,.55); }
.bxf-check:disabled { opacity: .45; cursor: default; }
.bxf-fieldrow { display: flex; align-items: flex-end; gap: 8px; }
.bxf-fieldgrow { flex: 1; min-width: 0; }
.bxf-btn:active { transform: translateY(1px); }
.bxf-tip { position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; margin-left: 6px; border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 700;
  cursor: help; user-select: none; flex: none; }
.bxf-tip-body { position: absolute; left: 0; top: 21px; min-width: 180px; max-width: 300px;
  padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1);
  font-size: 11px; font-weight: 400; line-height: 1.55; white-space: normal;
  box-shadow: 0 10px 26px rgba(15,23,42,.22); opacity: 0; visibility: hidden;
  transition: opacity .12s ease; z-index: 30; pointer-events: none; }
.bxf-tip:hover .bxf-tip-body, .bxf-tip:focus .bxf-tip-body, .bxf-tip:focus-within .bxf-tip-body {
  opacity: 1; visibility: visible; }
.bxf-labelrow { display: flex; align-items: center; gap: 2px; margin-bottom: 5px; }
`;

    export const S = {
      page: { padding: '18px 22px', maxWidth: '980px', color: 'var(--dsw-alias-label-primary, #1c1c1e)' },
      head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' },
      title: { margin: 0, fontSize: '18px', fontWeight: 600 },
      sub: { margin: '2px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #6b7280)' },
      labelrow: { display: 'flex', alignItems: 'center', marginBottom: '5px' },
      card: {
        border: '1px solid var(--dsw-alias-border-l1, #e5e7eb)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        marginBottom: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
      },
      cardHead: { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', cursor: 'pointer' },
      grow: { flex: 1, minWidth: 0 },
      name: { fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      nameRow: { display: 'flex', alignItems: 'center', gap: '4px' },
      idRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '2px' },
      iconBtn: {
        border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', borderRadius: '6px',
        fontSize: '12px', lineHeight: 1, color: 'var(--dsw-alias-label-secondary)', transition: 'background .15s ease, color .15s ease',
      },
      meta: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #6b7280)', marginTop: '2px' },
      badge: (tone) => ({
        display: 'inline-block', padding: '1px 8px', borderRadius: '999px', fontSize: '11px',
        background: tone === 'ok' ? 'rgba(16,185,129,.12)' : tone === 'warn' ? 'rgba(245,158,11,.16)' : 'rgba(148,163,184,.18)',
        color: tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-idle-primary)',
      }),
      body: { borderTop: '1px solid var(--dsw-alias-border-l1, #e5e7eb)', padding: '4px 14px 14px' },
      panel: { borderTop: '1px solid var(--dsw-alias-border-l1, #f1f5f9)', padding: '10px 0' },
      panelHead: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '2px 0' },
      panelBody: { marginTop: '8px', display: 'grid', gap: '10px' },
      label: { display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--dsw-alias-label-secondary, #4b5563)' },
      hint: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary, #6b7280)', marginTop: '3px', lineHeight: 1.5 },
      input: {
        width: '100%', boxSizing: 'border-box', height: '34px', padding: '0 10px', fontSize: '13px', borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-2, #fff)', color: 'var(--dsw-alias-label-primary)',
      },
      area: { width: '100%', boxSizing: 'border-box', minHeight: '62px', padding: '7px 9px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'var(--dsw-alias-bg-layer-2, #fff)', color: 'var(--dsw-alias-label-primary)' },
      row: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
      btn: (kind) => ({
        padding: '6px 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
        border: kind === 'primary' ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l1, #d1d5db)',
        background: kind === 'primary'
          ? 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff))'
          : 'transparent',
        color: kind === 'primary'
          ? 'var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff))'
          : 'inherit',
      }),
      dangerBtn: {
        padding: '5px 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-state-error-primary)', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)',
      },
      error: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' },
      toast: {
        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)', fontSize: '13px', border: '1px solid var(--dsw-alias-border-l1)',
        padding: '8px 18px', borderRadius: '8px', zIndex: 9999,
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)', pointerEvents: 'none',
      },
      check: {
        width: '27px', height: '27px', borderRadius: '8px', cursor: 'pointer', flex: 'none',
        border: '1px solid var(--dsw-alias-border-l2, #d1d5db)', background: 'transparent',
        color: 'var(--bxf-accent, #3370ff)', fontSize: '13px', lineHeight: 1,
      },
      checkRow: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
      checkLabel: { fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' },
      overlay: {
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px',
      },
      modal: {
        width: 'min(460px, 100%)', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary)',
        borderRadius: '14px', padding: '18px', boxShadow: '0 24px 60px rgba(15,23,42,.24)',
        border: '1px solid var(--dsw-alias-border-l1, #e5e7eb)',
      },
    };

    /** 出错时显示错误本身，而不是整页变白。 */
    export class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null, stack: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      componentDidCatch(error, info) {
        console.error('[im-feishu] render failed', error, info?.componentStack);
        this.setState({ stack: info?.componentStack ?? null });
      }
      render() {
        const { error, stack } = this.state;
        if (!error) return this.props.children;
        return h('div', { style: { padding: '16px', color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px' } },
          h('div', { style: { fontWeight: 600, marginBottom: '6px' } }, t('这里出错了', 'Something broke')),
          h('pre', { style: { whiteSpace: 'pre-wrap', margin: 0 } }, String(error?.message ?? error)),
          stack ? h('pre', { style: { whiteSpace: 'pre-wrap', marginTop: '8px', color: 'var(--dsw-alias-label-secondary)' } }, stack) : null);
      }
    }

    export async function rpc(connection, method, payload) {
      const result = await connection.rpc.call('/api', RPC_ENDPOINT, { method, payload }, undefined);
      if (!result || result.ok !== true) {
        const error = new Error(result?.error?.message ?? t('请求失败', 'Request failed'));
        error.code = result?.error?.code ?? 'rpc-failed';
        throw error;
      }
      return result.value;
    }

    export function FieldLabel({ label, hint }) {
      return h('div', { style: S.labelrow },
        label ? h('span', { style: S.label }, label) : null,
        hint ? h('span', {
          className: 'bxf-tip',
          tabIndex: 0,
          role: 'button',
          'aria-label': hint,
        },
        h('span', { 'aria-hidden': true }, '?'),
        h('span', { className: 'bxf-tip-body', role: 'tooltip' }, hint)) : null);
    }

    export function Field({ label, hint, children }) {
      return h('div', null,
        label ? h(FieldLabel, { label, hint }) : null,
        children);
    }

    export function Panel({ title, action, children, defaultOpen = false }) {
      const [open, setOpen] = React.useState(defaultOpen);
      return h('section', { style: S.panel },
        h('div', {
          className: 'bxf-panel-head',
          style: S.panelHead,
          role: 'button',
          tabIndex: 0,
          'aria-expanded': open,
          onClick: () => setOpen((value) => !value),
          onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((value) => !value); } },
        },
        h('span', { className: 'bxf-panel-title' }, title),
        action ? h('div', { style: { marginLeft: 'auto' }, onClick: (event) => event.stopPropagation() }, action) : null),
        open ? h('div', { style: S.panelBody }, children) : null);
    }

    export function StatusBadge({ state }) {
      const map = {
        connected: [t('运行正常', 'Connected'), 'ok'],
        connecting: [t('正在连接', 'Connecting'), 'warn'],
        reconnecting: [t('正在重连', 'Reconnecting'), 'warn'],
        error: [t('连接异常', 'Error'), 'warn'],
        idle: [t('未连接', 'Idle'), 'muted'],
      };
      const [label, tone] = map[state] ?? map.idle;
      return h('span', { style: S.badge(tone) }, label);
    }

