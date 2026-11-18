/** Authorization status and editable fields used throughout the workspace. */
export const IDENTITY_CSS = `
.bxf-identity-hint { margin: 6px 0 0; line-height: 1.55; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.bxf-identity-section-head { margin-bottom: 8px; }
.bxf-identity-section-head .bxf-identity-setting-title { margin: 0; }
.bxf-identity-chat-controls { display: grid; min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-chat-meta { margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-field { display: flex; flex-direction: column; min-width: 0; gap: 5px; }
.bxf-identity-field > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-chat-extra { grid-column: 1 / -1; }
.bxf-identity-picker { min-width: 0; }
.bxf-identity-picker-list { margin-top: 12px; }
.bxf-identity-candidate { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-candidate:last-child { border-bottom: 0; }
.bxf-identity-candidate-info { min-width: 0; flex: 1; }
.bxf-identity-candidate-info strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
.bxf-identity-settings { display: grid; gap: 20px; }
.bxf-identity-setting { min-width: 0; }
.bxf-identity-setting-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.bxf-identity-field > .bxf-identity-setting-title { margin: 0; }
.bxf-identity-rules { display: block; width: 100%; max-width: 100%; margin-top: 12px; height: auto; max-height: 420px;
  resize: vertical; font-family: inherit; line-height: 1.7; overflow-wrap: anywhere; }
.bxf-identity-worker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-alert { font-size: 12px; padding: 9px 12px; border-radius: 8px; overflow-wrap: anywhere; background: rgba(239,68,68,.06); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-notice { font-size: 12px; padding: 9px 12px; border-radius: 8px; background: rgba(16,185,129,.08); color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-identity-qr { display: inline-flex; padding: 12px; margin-top: 14px; border-radius: 12px; background: #fff; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); line-height: 0; }
@container (max-width: 440px) {
  .bxf-identity-chat-controls, .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
}
`;
