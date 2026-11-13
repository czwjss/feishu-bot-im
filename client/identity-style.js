/** Styles scoped to the identity dialog; host light/dark theme tokens stay authoritative. */
export const IDENTITY_CSS = `
.bxf-identity-overlay { box-sizing: border-box; padding: 20px; }
.bxf-identity-dialog { width: min(740px, 100%); max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden; container-type: inline-size;
  border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #1c1c1e);
  box-shadow: 0 24px 64px rgba(15,23,42,.22); font-size: 13px; line-height: 1.5; }
.bxf-identity-dialog * { box-sizing: border-box; }
.bxf-identity-header { flex: none; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 16px 22px; }
.bxf-identity-header { border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-header h2 { margin: 0; font-size: 17px; font-weight: 650; }
.bxf-identity-hint { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-hint { margin: 6px 0 0; line-height: 1.55; overflow-wrap: anywhere; }
.bxf-identity-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 22px;
  display: flex; flex-direction: column; gap: 12px; scrollbar-gutter: stable;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-body > * { flex: none; min-width: 0; }
.bxf-identity-dialog button { font-family: inherit; flex-shrink: 0; white-space: nowrap; }
.bxf-identity-dialog button:disabled { opacity: .5; cursor: not-allowed; }
.bxf-identity-close { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; flex: none;
  border: 0; border-radius: 7px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 23px; }
.bxf-identity-close:hover { background: var(--dsw-alias-bg-layer-2, #f5f6f8); }
.bxf-identity-card { width: 100%; min-width: 0; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-identity-card-head { display: flex; align-items: center; gap: 12px; padding: 16px; min-width: 0;
  cursor: pointer; list-style: none; border-radius: 12px; }
.bxf-identity-card-head::-webkit-details-marker { display: none; }
.bxf-identity-card-head::marker { content: ''; }
.bxf-identity-card-head:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-card-icon { width: 36px; height: 36px; display: grid; place-items: center; flex: none;
  border-radius: 10px; background: var(--dsw-alias-bg-layer-2, #f7f8fa); color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-card-heading { flex: 1; min-width: 0; }
.bxf-identity-card-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.bxf-identity-card-title strong { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.bxf-identity-card-description { display: block; margin-top: 3px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bxf-identity-expiry { white-space: normal; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.bxf-identity-expiry-expired { color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-card-chevron { flex: none; color: var(--dsw-alias-label-secondary, #6b7280); transition: transform .15s; }
.bxf-identity-card[open] > .bxf-identity-card-head .bxf-identity-card-chevron { transform: rotate(90deg); }
.bxf-identity-card[open] > .bxf-identity-card-head { border-radius: 12px 12px 0 0; }
.bxf-identity-card-content { min-width: 0; padding: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-avatar { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 11px;
  background: rgba(16,185,129,.1); color: var(--dsw-alias-state-success-primary, #059669); font-size: 17px; font-weight: 600; }
.bxf-identity-facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 14px; margin: 0 0 16px; font-size: 12px; }
.bxf-identity-alert + .bxf-identity-facts { margin-top: 16px; }
.bxf-identity-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-identity-actions, .bxf-identity-section-head, .bxf-identity-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.bxf-identity-actions { justify-content: flex-start; }
.bxf-identity-section-head { margin-bottom: 8px; }
.bxf-identity-section-head .bxf-identity-setting-title { margin: 0; }
.bxf-identity-list-head { margin-bottom: 14px; }
.bxf-identity-list-meta { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-chat-list { display: grid; gap: 8px; }
.bxf-identity-chat { display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; }
.bxf-identity-chat-main { min-width: 0; grid-column: 1; grid-row: 1; }
.bxf-identity-chat-controls { grid-column: 1 / -1; grid-row: 2; display: grid; min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-chat-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-chat-meta { margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-field { display: flex; flex-direction: column; min-width: 0; gap: 5px; }
.bxf-identity-field > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-dialog .bxf-identity-control { width: 100%; min-width: 0; font-family: inherit; text-overflow: ellipsis; }
.bxf-identity-remove { grid-column: 2; grid-row: 1; height: 30px; }
.bxf-identity-chat-extra { grid-column: 1 / -1; }
.bxf-identity-empty { padding: 20px 14px; text-align: center; border: 1px dashed var(--dsw-alias-border-l2, #d1d5db);
  border-radius: 10px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-picker { margin-top: 10px; padding: 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-picker-list { max-height: 200px; overflow-y: auto; overscroll-behavior: contain; margin-top: 8px; }
.bxf-identity-candidate { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-candidate:last-child { border-bottom: 0; }
.bxf-identity-candidate-info { min-width: 0; flex: 1; }
.bxf-identity-candidate-info strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
.bxf-identity-settings { display: grid; gap: 20px; }
.bxf-identity-setting { min-width: 0; }
.bxf-identity-setting + .bxf-identity-setting { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
.bxf-identity-setting-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.bxf-identity-field > .bxf-identity-setting-title { margin: 0; }
.bxf-identity-rules { display: block; width: 100%; max-width: 100%; margin-top: 12px; height: auto; max-height: 420px;
  resize: vertical; font-family: inherit; line-height: 1.7; overflow-wrap: anywhere; }
.bxf-identity-worker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-alert { font-size: 12px; padding: 9px 12px; border-radius: 8px; overflow-wrap: anywhere; background: rgba(239,68,68,.06); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-notice { font-size: 12px; padding: 9px 12px; border-radius: 8px; background: rgba(16,185,129,.08); color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-identity-connect { text-align: center; padding: 22px 12px; }
.bxf-identity-qr { display: inline-flex; padding: 12px; margin-top: 14px; border-radius: 12px; background: #fff; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); line-height: 0; }
.bxf-identity-dialog :is(button, summary, input, select, textarea):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 2px; }
@container (max-width: 440px) {
  .bxf-identity-chat-controls, .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
  .bxf-identity-card-head { padding: 14px; gap: 10px; }
  .bxf-identity-card-content { padding: 14px; }
  .bxf-identity-card-icon { width: 32px; height: 32px; }
  .bxf-identity-facts { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .bxf-identity-facts dd + dt { margin-top: 6px; }
}
@media (max-width: 480px) {
  .bxf-identity-overlay { padding: 10px !important; }
  .bxf-identity-dialog { max-height: calc(100vh - 20px); max-height: calc(100dvh - 20px); border-radius: 12px; }
  .bxf-identity-header { padding-left: 16px; padding-right: 16px; }
  .bxf-identity-body { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .bxf-identity-card-chevron { transition: none; }
}
`;
