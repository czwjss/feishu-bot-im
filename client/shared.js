import React from 'react';

import { API, RPC_ENDPOINT, CONTEXT_ENHANCEMENT_FIELDS } from '../src/contracts.js';
export { API };

const h = React.createElement;

    let activeLocale = '';

    export function configureLocale(service) {
      activeLocale = service.getLocale().active;
      const unsubscribe = service.subscribe(() => { activeLocale = service.getLocale().active; });
      return () => {
        unsubscribe?.();
        activeLocale = '';
      };
    }

    export function t(zh, en) {
      const language = activeLocale || (navigator.language || '');
      return language.toLowerCase().startsWith('zh') ? zh : en;
    }
    export const text = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : String(pair));

    export const CE_FIELDS = CONTEXT_ENHANCEMENT_FIELDS;
    export const CE_LABELS = {
      senderId: ['发送者 Open ID', 'Sender Open ID'],
      senderName: ['发送者名称', 'Sender name'],
      botId: ['机器人 Open ID', 'Bot Open ID'],
      sentAt: ['发送时间', 'Sent at'],
      conversationTitle: ['群名称', 'Group name'],
    };
    export const emptyScope = () => ({ enabled: true, fields: ['senderId', 'senderName', 'botId', 'sentAt'], guidance: '' });
    export const emptyEnhancement = () => ({ group: emptyScope(), direct: emptyScope() });

    export const CSS = `
.bxf-page { --bxf-radius: 12px; }
.bxf-page select:not(.bxf-worker-native *) {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  padding-right: 30px !important;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
}
.bxf-page input:not([type="checkbox"]):not([type="radio"]):not(.bxf-worker-native *),
.bxf-page select:not(.bxf-worker-native *) { height: 34px; }
.bxf-page :is(input, select, textarea):not(.bxf-worker-native *):focus {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 32%, transparent);
  outline-offset: 1px;
  border-color: var(--dsw-alias-brand-primary, #3370ff);
}
.bxf-page select:not(.bxf-worker-native *) option:checked {
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff)) !important;
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)) !important;
}
.bxf-field { min-width: 0; }
.bxf-bot-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bxf-mini { background: transparent !important; -webkit-appearance: none; appearance: none;
  font-size: 11px; padding: 3px 8px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #e2e8f0); color: var(--dsw-alias-label-secondary); }
.bxf-mini:hover { color: var(--dsw-alias-brand-primary, #3370ff); border-color: var(--dsw-alias-brand-primary, #3370ff); background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 10%, transparent) !important; }
.bxf-button { appearance: none; display: inline-flex; align-items: center; justify-content: center;
  min-height: 34px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #d1d5db); background: transparent; color: inherit; }
.bxf-button:not(:disabled):hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); border-color: var(--dsw-alias-border-l2, #d1d5db); }
.bxf-button[data-variant="primary"] { border-color: transparent;
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #111318));
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)); }
.bxf-button[data-variant="primary"]:not(:disabled):hover { border-color: transparent;
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #252830))); }
.bxf-danger:hover { background: rgba(185,28,28,.07); border-color: rgba(185,28,28,.55); }
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
.bxf-save-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0;
  font-size: 11px; color: var(--dsw-alias-label-secondary); }
.bxf-save-status > span { min-width: 0; overflow-wrap: anywhere; }
.bxf-save-status[data-state="error"] { color: var(--dsw-alias-state-error-primary); }
`;

    export const S = {
      labelrow: { display: 'flex', alignItems: 'center', marginBottom: '5px' },
      grow: { flex: 1, minWidth: 0 },
      nameRow: { display: 'flex', alignItems: 'center', gap: '4px' },
      badge: (tone) => ({
        display: 'inline-block', padding: '1px 8px', borderRadius: '999px', fontSize: '11px',
        background: tone === 'ok' ? 'rgba(16,185,129,.12)' : tone === 'warn' ? 'rgba(245,158,11,.16)' : 'rgba(148,163,184,.18)',
        color: tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-idle-primary)',
      }),
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
      error: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' },
      checkRow: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
      checkLabel: { fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' },
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

    export function Field({ label, hint, children, className = '' }) {
      return h('div', { className: `bxf-field ${className}`.trim() },
        label ? h(FieldLabel, { label, hint }) : null,
        children);
    }

    export function SaveStatus({ state, onRetry, onDiscard }) {
      if (state.status === 'idle') return null;
      const label = state.status === 'error' ? `${t('保存失败：', 'Save failed: ')}${state.error}`
        : state.status === 'pending' ? t('等待保存…', 'Waiting to save…')
          : state.status === 'saving' ? t('保存中…', 'Saving…') : t('已保存', 'Saved');
      return h('div', { className: 'bxf-save-status', 'data-state': state.status, role: 'status' },
        h('span', null, label),
        state.status === 'error' ? h('button', { type: 'button', className: 'bxf-mini', onClick: onRetry }, t('重试', 'Retry')) : null,
        state.status === 'error' && onDiscard
          ? h('button', { type: 'button', className: 'bxf-mini', onClick: onDiscard }, t('放弃修改', 'Discard'))
          : null);
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
