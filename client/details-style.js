export const DETAILS_CSS = `
.bxf-details-dialog { width: min(560px, 100%); max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
  display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 16px;
  border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e); box-shadow: 0 24px 64px rgba(15,23,42,.22); font-size: 13px; line-height: 1.5; }
.bxf-details-dialog * { box-sizing: border-box; }
.bxf-details-header, .bxf-details-footer { display: flex; align-items: center; justify-content: space-between;
  flex: none; flex-wrap: wrap; gap: 12px; padding: 16px 20px; }
.bxf-details-header { border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-details-header h3 { margin: 0; font-size: 16px; font-weight: 650; }
.bxf-details-header button, .bxf-details-footer button { flex: none; white-space: nowrap; font-family: inherit; }
.bxf-details-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 20px;
  display: flex; flex-direction: column; gap: 16px; }
.bxf-details-body > * { flex: none; min-width: 0; }
.bxf-details-profile { display: flex; align-items: center; gap: 12px; }
.bxf-details-avatar { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; font-size: 19px; font-weight: 600; }
.bxf-details-person { min-width: 0; flex: 1; }
.bxf-details-name { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; }
.bxf-details-name strong { font-size: 15px; overflow-wrap: anywhere; }
.bxf-details-meta { margin-top: 3px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-details-section { padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-details-section h4 { margin: 0 0 12px; font-size: 12px; font-weight: 600; }
.bxf-details-facts { margin: 0; display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 10px 14px; }
.bxf-details-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-details-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-details-mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.bxf-details-error { border-color: rgba(239,68,68,.2); background: rgba(239,68,68,.05); color: var(--dsw-alias-state-error-primary, #dc2626); overflow-wrap: anywhere; }
.bxf-details-error p { margin: 0; }
.bxf-details-footer { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-details-footer > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-details-dialog button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 3px; }
@media (max-width: 480px) {
  .bxf-details-header, .bxf-details-footer { padding: 14px 16px; }
  .bxf-details-body { padding: 14px 16px; gap: 12px; }
  .bxf-details-section { padding: 12px; }
  .bxf-details-facts { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .bxf-details-facts dd + dt { margin-top: 9px; }
}
`;
