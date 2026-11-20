export const WORKSPACE_CSS = `
.bxf-work { height: 100%; min-height: 0; min-width: 0; overflow: hidden; container: feishu / inline-size;
  background: var(--dsw-alias-bg-base, #f8f9fb); color: var(--dsw-alias-label-primary, #1c1c1e); font-size: 13px; line-height: 1.5; }
.bxf-work :not(.bxf-worker-native *), .bxf-work :not(.bxf-worker-native *)::before, .bxf-work :not(.bxf-worker-native *)::after { box-sizing: border-box; }
.bxf-work :is(button, input, select):not(.bxf-worker-native *) { font: inherit; }
.bxf-work button:not(.bxf-worker-native *) { cursor: pointer; }
.bxf-work button:not(.bxf-worker-native *):disabled { opacity: .45; cursor: not-allowed; }
.bxf-work button:not(.bxf-worker-native *):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 3px; }
.bxf-work [hidden] { display: none !important; }
.bxf-work-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; }
.bxf-work-header, .bxf-work-toolbar, .bxf-work-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.bxf-work-header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 20px; flex: none; padding: 12px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-header h1 { font-size: 19px; font-weight: 650; letter-spacing: -.6px; margin: 0; }
.bxf-work-mark { display: flex; align-items: center; gap: 12px; white-space: nowrap; }
.bxf-work-logo { display: grid; place-items: center; width: 30px; height: 30px; flex: none; }
.bxf-work-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); margin: 0; padding: 0 12px; flex: none; }
.bxf-work-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); padding: 11px 17px; border-bottom: 2px solid transparent; }
.bxf-work-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary, #1c1c1e); border-color: var(--dsw-alias-brand-primary, #3370ff); font-weight: 650; }
.bxf-work-toolbar { margin-bottom: 14px; }
.bxf-work-toolbar input { flex: 1; min-width: 160px; max-width: 380px; }
.bxf-work-toolbar select { max-width: 210px; }
.bxf-work-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 360px; max-width: 100%; }
.bxf-work-filters select { min-width: 0; max-width: none; }
.bxf-work-split { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(290px, 1fr); align-items: start; gap: 18px; }
.bxf-work-list, .bxf-work-detail, .bxf-work-surface { min-width: 0; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 14px; overflow: hidden; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-work-listhead { padding: 12px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 16px; text-align: left;
  background: transparent; color: inherit; border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-left: 3px solid transparent; }
.bxf-work-row:last-child { border-bottom: 0; }
.bxf-work-row:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-work-row[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2, #f7f8fa); border-left-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-work-row > div { min-width: 0; }
.bxf-work-row strong { display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-size: 13px; }
.bxf-work-meta { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; overflow-wrap: anywhere; }
.bxf-work-row .bxf-work-meta { margin-top: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.bxf-work-row-end { flex-shrink: 0; text-align: right; max-width: 42%; }
.bxf-work-detail { padding: 20px; position: sticky; top: 16px; }
.bxf-work-detail h2, .bxf-work-surface h2 { font-size: 16px; margin: 0 0 6px; overflow-wrap: anywhere; }
.bxf-work-detail h3 { margin: 22px 0 10px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); font-size: 12px; }
.bxf-work-facts { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 9px 14px; margin: 14px 0; font-size: 12px; }
.bxf-work-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-work-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-work-facts code { font-size: 11px; }
.bxf-session-binding { margin-top: 18px; padding: 16px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; }
.bxf-session-binding > p { margin: 8px 0 12px; }
.bxf-session-binding > .bxf-work-alert { margin: 12px 0 0; }
.bxf-session-options { padding: 0; margin: 12px 0; border: 0; min-width: 0; max-height: 300px; overflow: auto; overscroll-behavior: contain; }
.bxf-session-option { display: flex; align-items: start; gap: 10px; padding: 10px 8px; border-radius: 6px; cursor: pointer; }
.bxf-session-option:hover, .bxf-session-option[data-selected="true"] { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-work .bxf-session-option input { flex: none; width: 15px; height: 15px; margin: 3px 0 0; accent-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-session-option > span { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.bxf-session-option code { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-session-option:has(input:disabled) { opacity: .6; cursor: default; }
.bxf-session-binding-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.bxf-work-empty { color: var(--dsw-alias-label-secondary, #6b7280); padding: 44px 20px; text-align: center; }
.bxf-work-alert { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 14px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 10px; color: var(--dsw-alias-state-error-primary, #dc2626); overflow-wrap: anywhere; }
.bxf-work-bots { max-width: 1280px; min-width: 0; }
.bxf-work-identity { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.bxf-work-message { padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-message pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; margin: 8px 0; }
.bxf-work-message code { font-size: 11px; overflow-wrap: anywhere; }
.bxf-work-batch { margin-top: 14px; }
.bxf-work .bxf-identity-control { width: 100%; min-width: 0; }
.bxf-work-layout { flex: 1; display: flex; min-width: 0; min-height: 0; }
.bxf-bot-nav { display: flex; align-items: center; justify-content: safe center; gap: 24px; min-width: 0; overflow-x: auto; overflow-y: hidden; padding: 4px; overscroll-behavior-x: contain; scrollbar-width: thin; }
.bxf-bot-nav-row { flex: 0 0 auto; min-width: 0; max-width: 220px; padding: 8px 0; border: 0; border-bottom: 1px solid transparent; border-radius: 0; box-shadow: none; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-work .bxf-bot-nav-row { font-weight: 400; }
.bxf-work .bxf-bot-nav-row[aria-current="page"] { font-weight: 600; border-bottom-color: var(--dsw-alias-label-primary, #1c1c1e); }
.bxf-bot-nav-row:hover { border-bottom-color: var(--dsw-alias-border-l2, #d1d5db); }
.bxf-bot-nav-row[data-state="connected"] { color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-bot-nav-row[data-state="error"] { color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-bot-content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; container: robot / inline-size; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-work-tabpage { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 20px; }
.bxf-work-tabpage-avatar { display: flex; flex-direction: column; overflow: hidden; padding: 0; }
.bxf-runtime-status { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.bxf-status-block { min-width: 0; padding: 20px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-status-summary { padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-summary h2 { margin: 0; font-size: 17px; overflow-wrap: anywhere; }
.bxf-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 32px; padding-top: 8px; }
.bxf-status-section { min-width: 0; }
.bxf-status-section h3, .bxf-status-error h3 { margin: 0; font-size: 14px; font-weight: 600; }
.bxf-status-section .bxf-work-facts { grid-template-columns: 100px minmax(0, 1fr); gap: 12px; margin: 16px 0 0; }
.bxf-status-identity-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; }
.bxf-status-avatar > .bxf-work-facts { margin: 0; }
.bxf-status-avatar > .bxf-work-facts:empty { display: none; }
.bxf-avatar-credentials { display: grid; grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 1fr)); gap: 16px 32px; max-width: 1280px; margin: 0; padding: 4px 0; }
.bxf-avatar-credentials > div { min-width: 0; }
.bxf-avatar-credentials dt { margin-bottom: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-avatar-credentials dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.bxf-status-avatar > .bxf-identity-alert, .bxf-status-avatar > .bxf-identity-notice { margin-bottom: 16px; }
.bxf-status-settings { min-width: 0; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-settings > h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; }
.bxf-reply-settings-grid { grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 32px; align-items: start; max-width: 1280px; }
.bxf-reply-options { display: grid; gap: 24px; min-width: 0; }
.bxf-reply-options .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
.bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-field { gap: 8px; }
.bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-setting-title { display: flex; align-items: center; min-height: 28px; }
.bxf-reply-rules-setting .bxf-identity-section-head { min-height: 28px; margin-bottom: 8px; }
.bxf-reply-rules-setting .bxf-identity-rules { margin-top: 0; }
.bxf-status-settings > .bxf-save-status { margin-top: 12px; }
.bxf-status-auth-scan { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-error { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-status-error code { display: block; margin-top: 12px; }
.bxf-status-error p { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.bxf-bot-add { z-index: 10; }
.bxf-bot-settings { display: grid; gap: 12px; }
.bxf-settings-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-settings-tabs { display: inline-flex; gap: 4px; padding: 3px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-settings-tabs button { border: 1px solid transparent; border-radius: 6px; padding: 5px 20px; color: var(--dsw-alias-label-secondary, #6b7280); background: transparent; }
.bxf-settings-tabs button:hover { color: var(--dsw-alias-label-primary, #1c1c1e); }
.bxf-settings-tabs button[aria-selected="true"] { border-color: var(--dsw-alias-border-l1, #e5e7eb); color: var(--dsw-alias-label-primary, #1c1c1e); background: var(--dsw-alias-bg-layer-1, #fff); font-weight: 600; }
.bxf-settings-pane { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 28px 40px; min-width: 0; padding-top: 8px; }
.bxf-settings-pane:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 4px; border-radius: 4px; }
.bxf-settings-group, .bxf-settings-context { min-width: 0; }
.bxf-settings-group h4 { font-size: 13px; font-weight: 600; margin: 0 0 16px; }
.bxf-settings-fields { display: grid; gap: 18px; min-width: 0; }
.bxf-bot-settings :is(input, select, textarea) { min-width: 0; font-family: inherit; }
.bxf-bot-settings select { text-overflow: ellipsis; }
.bxf-bot-settings textarea { resize: vertical; max-width: 100%; line-height: 1.6; }
.bxf-bot-settings input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-setting-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.bxf-setting-toggle > label { flex: none; }
.bxf-settings-pane-group > .bxf-settings-context { grid-column: 1 / -1; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
@container feishu (max-width: 600px) {
  .bxf-work-header { gap: 8px; padding: 8px 12px; }
  .bxf-work-mark { gap: 6px; }
  .bxf-work-header h1 { font-size: 16px; }
  .bxf-bot-nav { gap: 16px; }
  .bxf-bot-nav-row { max-width: 160px; padding: 7px 0; }
  .bxf-bot-add > button { padding: 7px 9px !important; }
}
@container feishu (max-width: 440px) {
  .bxf-work-logo { display: none; }
}
@container robot (max-width: 880px) {
  .bxf-reply-settings-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .bxf-reply-options .bxf-identity-worker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-setting-title { min-height: 0; }
}
@container robot (max-width: 760px) {
  .bxf-work-split { grid-template-columns: minmax(0, 1fr); }
  .bxf-work-detail { position: static; }
  .bxf-avatar-credentials { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
  .bxf-avatar-credentials > div:first-child { grid-column: 1 / -1; }
}
@container robot (max-width: 700px) {
  .bxf-status-grid { grid-template-columns: minmax(0, 1fr); }
  .bxf-status-section + .bxf-status-section { padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
  .bxf-settings-pane { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .bxf-settings-pane > :not(:first-child) { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
}
@container robot (max-width: 600px) {
  .bxf-chat-toolbar > input { flex-basis: 100%; max-width: none; }
  .bxf-work-filters { width: 100%; }
}
@container robot (max-width: 520px) {
  .bxf-work-tabs { padding: 0 4px; gap: 0; }
  .bxf-work-tab { flex: 1; padding: 9px 8px; }
  .bxf-work-tabpage:not(.bxf-work-tabpage-avatar) { padding: 12px; }
  .bxf-work-facts { grid-template-columns: 76px minmax(0, 1fr); }
  .bxf-runtime-status { gap: 16px; }
  .bxf-status-block { padding: 16px; }
  .bxf-status-section .bxf-work-facts { grid-template-columns: 88px minmax(0, 1fr); gap: 12px; }
  .bxf-reply-options .bxf-identity-worker, .bxf-avatar-credentials { grid-template-columns: minmax(0, 1fr); }
}

.bxf-work .bxf-work-icon { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; }
.bxf-bot-more { position: relative; }
.bxf-bot-more-panel { position: absolute; z-index: 5; right: 0; top: calc(100% + 6px); min-width: 112px; padding: 6px;
  background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; box-shadow: 0 6px 20px rgba(15,23,42,.12); }
.bxf-bot-more-panel .bxf-mini { width: 100%; border-color: transparent; text-align: left; }
.bxf-bot-more-panel .bxf-action-tip { width: 100%; }
.bxf-work-diagnosis { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 0; }
.bxf-action-tip { position: relative; display: inline-flex; }
.bxf-action-tip-body { position: absolute; top: calc(100% + 8px); z-index: 20; width: min(280px, calc(100vw - 24px)); padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 8px; background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #1c1c1e); font-size: 12px; line-height: 1.6; white-space: normal; box-shadow: 0 6px 18px rgba(15,23,42,.12); }
.bxf-modal-dialog { padding: 0; border: 0; background: transparent; max-width: calc(100vw - 40px); overflow: visible; }
.bxf-modal-dialog::backdrop { background: rgba(15,23,42,.35); }

`;
