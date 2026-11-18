export const AVATAR_CSS = `
.bxf-avatar-workspace { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.bxf-avatar-split { display: grid; grid-template-columns: 260px minmax(0, 1fr); flex: 1; min-height: 0; }
.bxf-avatar-rail { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-rail-head { flex: none; padding: 14px 12px 10px; display: grid; gap: 12px; }
.bxf-avatar-rail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.bxf-avatar-rail-actions .bxf-mini { font-size: 11px; padding: 5px 8px; }
.bxf-avatar-direct-toggle { appearance: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.bxf-avatar-direct-toggle:disabled { cursor: default; opacity: .55; }
.bxf-avatar-direct-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 2px; }
.bxf-avatar-direct-toggle::after { content: ''; flex: none; width: 28px; height: 16px; border-radius: 12px; background: radial-gradient(circle at 8px center, #fff 0 5px, transparent 5.5px) var(--dsw-alias-label-secondary, #6b7280); }
.bxf-avatar-direct-toggle[aria-checked="true"]::after { background: radial-gradient(circle at 20px center, #fff 0 5px, transparent 5.5px) var(--dsw-alias-brand-primary, #3370ff); }
.bxf-avatar-chat-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 6px 8px; }
.bxf-avatar-chat-section + .bxf-avatar-chat-section { margin-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-chat-section h3 { padding: 9px 8px 6px; margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; font-weight: 600; }
.bxf-avatar-section-empty { margin: 0; padding: 8px 8px 14px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-avatar-section-error { color: var(--dsw-alias-state-error-primary, #b91c1c); overflow-wrap: anywhere; }
.bxf-avatar-chat-row { display: grid; gap: 5px; width: 100%; padding: 14px 12px; border: 0; border-radius: 8px; color: inherit; background: transparent; text-align: left; }
.bxf-avatar-chat-row:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-avatar-chat-row[aria-pressed="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 9%, transparent); box-shadow: inset 3px 0 var(--dsw-alias-brand-primary, #3370ff); }
.bxf-avatar-chat-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bxf-avatar-chat-top strong { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-avatar-count { flex: none; font-size: 11px; padding: 1px 6px; border-radius: 10px; background: var(--dsw-alias-brand-primary, #3370ff); color: #fff; }
.bxf-avatar-rail-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; padding: 10px 12px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-conversation { min-width: 0; min-height: 0; overflow: hidden; }
.bxf-worker-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.bxf-worker-header { flex: none; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-worker-title { display: grid; gap: 3px; flex: 1; min-width: 100px; }
.bxf-worker-title strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.bxf-worker-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.bxf-worker-native { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
.bxf-avatar-worker-empty { margin: auto; padding: 30px; text-align: center; }
.bxf-avatar-back { display: none; }
.bxf-avatar-delivery { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.bxf-avatar-chat-settings { display: flex; flex-direction: column; gap: 18px; }
.bxf-avatar-chat-settings .bxf-identity-chat-controls { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
.bxf-avatar-chat-settings .bxf-identity-remove { order: 1; align-self: flex-start; margin-top: 16px; }
.bxf-message-id { margin-top: 10px; }
.bxf-message-id summary { cursor: pointer; }
.bxf-drawer { position: fixed; inset: 0; margin: 0 0 0 auto; width: min(560px, 100vw); height: 100dvh; max-width: none; max-height: none; border: 0; padding: 0; background: transparent; color: var(--dsw-alias-label-primary, #1c1c1e); overflow: hidden; font: inherit; box-shadow: -12px 0 48px rgba(15,23,42,.16); }
.bxf-drawer::backdrop { background: rgba(15,23,42,.28); }
.bxf-drawer-sheet { height: 100%; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #fff); container-type: inline-size; }
.bxf-drawer-header { flex: none; padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-drawer-header h2 { font-size: 16px; margin: 0; }
.bxf-drawer-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 22px; }
.bxf-drawer-body h3 { margin: 0 0 12px; font-size: 14px; }
.bxf-drawer .bxf-identity-settings { display: grid; gap: 24px; }
.bxf-drawer .bxf-identity-setting { border: 0; border-radius: 0; padding: 0 0 22px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); background: transparent; }
.bxf-drawer .bxf-identity-setting:last-child { border: 0; padding: 0; }
@container robot (max-width: 640px) {
  .bxf-avatar-split { grid-template-columns: minmax(0, 1fr); }
  .bxf-avatar-split[data-detail="false"] .bxf-avatar-conversation { display: none; }
  .bxf-avatar-split[data-detail="true"] .bxf-avatar-rail { display: none; }
  .bxf-avatar-rail { border-right: 0; }
  .bxf-avatar-back { display: inline-flex; }
  .bxf-worker-header { padding: 10px 12px; }
}
`;
