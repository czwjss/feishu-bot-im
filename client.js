/**
 * Browser half: the "飞书机器人" settings section (multi-bot).
 *
 * Sections, in file order:
 *   1. constants  — RPC contract, palette, styles
 *   2. primitives — ErrorBoundary, rpc(), Field/FieldLabel, Panel, StatusBadge
 *   3. modals     — AddBotModal（手动/扫码）, AliasModal（名称+颜色）, DetailsModal
 *   4. BotCard    — one bot: header, panels, footer actions
 *   5. SettingsPage — list + add entries + polling
 *
 * client.js is loaded by the Host as a single file, so it stays one module; keep
 * new components inside their section instead of adding another file.
 *
 * Layout: a bot list of cards. Each card expands into collapsible panels
 * (通用 / 过程与上下文 / 群聊与访问 / 诊断). Adding a bot opens a modal.
 * Every mutation goes through the Host RPC endpoint `im-feishu`.
 */
window.__ModuleLoader__.load({
  id: '@czwjss/feishu-bot-im',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const RPC_ENDPOINT = 'im-feishu';
    const API = {
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
    };

    const t = (zh, en) => ((navigator.language || '').toLowerCase().startsWith('zh') ? zh : en);
    const text = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : String(pair));

    const CE_FIELDS = ['senderId', 'senderName', 'botId', 'sentAt', 'conversationTitle'];
    const CE_LABELS = {
      senderId: ['发送者 Open ID', 'Sender Open ID'],
      senderName: ['发送者名称', 'Sender name'],
      botId: ['机器人 Open ID', 'Bot Open ID'],
      sentAt: ['发送时间', 'Sent at'],
      conversationTitle: ['群名称', 'Group name'],
    };
    // 固定 5 色：每个颜色自带主色/浅底/描边三档，运行时不做颜色计算。
    const BOT_COLORS = {
      blue: { main: '#3370ff', soft: 'rgba(51,112,255,.10)', ring: 'rgba(51,112,255,.32)', edge: '#93b4ff' },
      red: { main: '#e5484d', soft: 'rgba(229,72,77,.10)', ring: 'rgba(229,72,77,.30)', edge: '#f0a9ab' },
      green: { main: '#00b96b', soft: 'rgba(0,185,107,.10)', ring: 'rgba(0,185,107,.28)', edge: '#7fd9b4' },
      purple: { main: '#7c4dff', soft: 'rgba(124,77,255,.10)', ring: 'rgba(124,77,255,.30)', edge: '#bda6ff' },
      orange: { main: '#ff8800', soft: 'rgba(255,136,0,.12)', ring: 'rgba(255,136,0,.30)', edge: '#ffc183' },
    };
    const COLOR_NAMES = {
      blue: ['蓝色', 'Blue'], red: ['红色', 'Red'], green: ['绿色', 'Green'],
      purple: ['紫色', 'Purple'], orange: ['橙色', 'Orange'],
    };
    const emptyScope = () => ({ enabled: true, fields: ['senderId', 'senderName', 'botId', 'sentAt'], guidance: '' });
    const emptyEnhancement = () => ({ group: emptyScope(), direct: emptyScope() });

    const CSS = `
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

    const S = {
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
    class Boundary extends React.Component {
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

    async function rpc(connection, method, payload) {
      const result = await connection.rpc.call('/api', RPC_ENDPOINT, { method, payload }, undefined);
      if (!result || result.ok !== true) {
        const error = new Error(result?.error?.message ?? t('请求失败', 'Request failed'));
        error.code = result?.error?.code ?? 'rpc-failed';
        throw error;
      }
      return result.value;
    }

    function FieldLabel({ label, hint }) {
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

    function Field({ label, hint, children }) {
      return h('div', null,
        label ? h(FieldLabel, { label, hint }) : null,
        children);
    }

    function Panel({ title, action, children, defaultOpen = false }) {
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

    function StatusBadge({ state }) {
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

    // ── 3a. 添加机器人弹层（手动 / 扫码） ────────────────────────────────────────────────────
    function AddBotModal({ connection, mode = 'manual', grant = null, onClose, onAdded }) {
      const [form, setForm] = React.useState({ appId: '', appSecret: '' });
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [scan, setScan] = React.useState(null);
      const [remaining, setRemaining] = React.useState(0);
      const deadline = React.useRef(0);
      const timer = React.useRef(null);
      const stop = React.useCallback(() => {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
      }, []);
      React.useEffect(() => stop, [stop]);
      const startScan = async () => {
        setBusy(true);
        setError(null);
        try {
          const snapshot = await rpc(connection, API.provisionBegin, grant ? { botId: grant.id } : {});
          setScan(snapshot);
          if (snapshot.state === 'success') { onAdded(); onClose(); return; }
          stop();
          deadline.current = Date.now() + 5 * 60_000;
          setRemaining(5 * 60);
          timer.current = setInterval(async () => {
            try {
              const next = await rpc(connection, API.provisionPoll, {});
              setScan(next);
              if (['success', 'denied', 'expired', 'error', 'cancelled'].includes(next.state)) {
                stop();
                if (next.state === 'success') { onAdded(); onClose(); }
              }
            } catch (cause) {
              stop();
              setError(cause.message);
            }
          }, Math.max(2000, snapshot.nextPollInMs ?? 3000));
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(false);
        }
      };
      const cancelScan = () => {
        stop();
        void rpc(connection, API.provisionCancel, {}).catch(() => undefined);
        setScan(null);
        setRemaining(0);
        onClose();
      };

      React.useEffect(() => {
        if (!scan) return undefined;
        const id = setInterval(() => {
          const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
          setRemaining(left);
          if (left === 0) {
            clearInterval(id);
            stop();
            void rpc(connection, API.provisionCancel, {}).catch(() => undefined);
            setScan(null);
            onClose();
          }
        }, 1000);
        return () => clearInterval(id);
      }, [scan, connection, onClose, stop]);
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      // 扫码模式一打开就开始，不需要再点一次
      React.useEffect(() => {
        if (mode === 'scan') void startScan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [mode]);

      const submit = async () => {
        setBusy(true);
        setError(null);
        try {
          await rpc(connection, API.botAdd, form);
          onAdded();
          onClose();
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(false);
        }
      };

      return h('div', { style: S.overlay, role: 'dialog', 'aria-modal': true, onClick: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h('div', { style: S.modal },
          h('h3', { style: { margin: '0 0 4px', fontSize: '15px' } },
            mode === 'scan'
              ? (grant ? t('扫码补齐权限', 'Grant by scanning') : t('扫码添加机器人', 'Add by scanning'))
              : t('手动添加机器人', 'Add manually')),
          mode === 'scan'
            ? h('div', { style: { display: 'grid', justifyItems: 'center', gap: '8px', marginTop: '10px' } },
              scan?.qrCodeDataUrl
                ? h('div', {
                  style: {
                    padding: '10px', background: '#fff', borderRadius: '12px', lineHeight: 0,
                    border: '1px solid var(--dsw-alias-border-l1)', boxShadow: '0 2px 10px rgba(15,23,42,.08)',
                  },
                }, h('img', { src: scan.qrCodeDataUrl, width: 200, height: 200, alt: 'QR' }))
                : h('div', {
                  style: {
                    width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '10px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-secondary)', fontSize: '12px',
                  },
                }, t('正在生成二维码…', 'Preparing QR…')),
              h('div', { style: { ...S.hint, textAlign: 'center' } },
                scan
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · ${scan.state === 'pending' || scan.state === 'qr_ready'
                    ? t('等待扫码确认', 'Waiting for scan')
                    : scan.state === 'slow_down'
                      ? t('请在飞书里确认', 'Confirm in Feishu')
                      : scan.state === 'denied'
                        ? t('已在飞书里取消', 'Cancelled in Feishu')
                        : scan.state === 'expired'
                          ? t('已过期', 'Expired')
                          : scan.state === 'success'
                            ? t('已生效', 'Applied')
                            : scan.state}`
                  : t('请稍候…', 'Please wait…')),
              error ? h('div', { style: S.error }, error) : null,
              h('div', { style: { display: 'flex', gap: '8px' } },
                h('button', { type: 'button', style: S.btn(), onClick: cancelScan }, t('取消扫码', 'Stop')),
                scan && ['denied', 'expired', 'error', 'cancelled'].includes(scan.state)
                  ? h('button', { type: 'button', style: S.btn('primary'), onClick: startScan }, t('重新生成', 'Retry'))
                  : null))
            : null,
          mode === 'manual'
            ? h('p', { style: S.hint }, t('飞书开放平台 → 自建应用 → 凭证与基础信息，复制 App ID 与 App Secret。', 'Feishu console → custom app → credentials.'))
            : null,
          h('div', { style: { ...S.panelBody, display: mode === 'manual' ? 'grid' : 'none' } },
            h(Field, { label: 'App ID' },
              h('input', { style: S.input, value: form.appId, placeholder: 'cli_xxxxxxxxxxxxxxxx', onChange: (event) => setForm({ ...form, appId: event.target.value }) })),
            h(Field, { label: 'App Secret', hint: t('只提交给本机 Host，写入 DSH 凭据库，不会回传浏览器。', 'Stored by the local Host credential service; never returned.') },
              h('input', { style: S.input, type: 'password', value: form.appSecret, onChange: (event) => setForm({ ...form, appSecret: event.target.value }) })),
            error ? h('div', { style: S.error }, error) : null),
          h('div', { style: { ...S.row, justifyContent: 'flex-end', marginTop: '14px' } },
            mode === 'manual'
              ? h('button', { type: 'button', style: S.btn(), onClick: onClose, disabled: busy }, t('取消', 'Cancel'))
              : null,
            mode === 'manual'
              ? h('button', { type: 'button', style: S.btn('primary'), onClick: submit, disabled: busy || !form.appId || !form.appSecret },
                busy ? t('正在验证…', 'Verifying…') : t('绑定并连接', 'Bind and connect'))
              : null)));
    }

    // ── 3b. 别名与颜色弹层 ──────────────────────────────────────────────────────────
    function AliasModal({ connection, bot, onClose, onSaved }) {
      const [value, setValue] = React.useState(bot.alias ?? '');
      const [color, setColor] = React.useState(bot.color ?? 'blue');
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const save = async () => {
        setBusy(true);
        setError(null);
        try {
          await rpc(connection, API.botAliasSet, { botId: bot.id, alias: value.trim() || null });
          await rpc(connection, API.botColorSet, { botId: bot.id, color });
          onSaved();
          onClose();
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(false);
        }
      };
      return h('div', { style: S.overlay, role: 'dialog', 'aria-modal': true, onClick: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h('div', { style: S.modal },
          h('h3', { style: { margin: '0 0 4px', fontSize: '15px' } }, t('外观与名称', 'Appearance')),
          h('p', { style: S.hint }, t('只在本插件里展示，不影响飞书中的机器人名称；留空恢复应用原名。', 'Shown only in this plugin; empty restores the app name.')),
          h('div', { style: S.panelBody },
            h('input', {
              style: S.input, value, autoFocus: true, placeholder: bot.botName ?? '小助手',
              onChange: (event) => setValue(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter') void save(); },
            }),
            h('div', null,
              h('label', { style: S.label }, t('标识色', 'Accent color')),
              h('div', { style: { display: 'flex', gap: '8px' } },
                Object.entries(BOT_COLORS).map(([key, palette]) => h('button', {
                  key,
                  type: 'button',
                  title: text(COLOR_NAMES[key]),
                  'aria-label': text(COLOR_NAMES[key]),
                  onClick: () => setColor(key),
                  style: {
                    width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer',
                    background: palette.main, border: color === key ? '2px solid var(--dsw-alias-label-primary)' : '2px solid transparent',
                    boxShadow: color === key ? '0 0 0 2px var(--dsw-alias-bg-layer-1) inset' : 'none',
                  },
                })))),
            error ? h('div', { style: S.error }, error) : null),
          h('div', { style: { ...S.row, justifyContent: 'flex-end', marginTop: '14px' } },
            h('button', { type: 'button', style: S.btn(), onClick: onClose, disabled: busy }, t('取消', 'Cancel')),
            h('button', { type: 'button', style: S.btn('primary'), onClick: save, disabled: busy }, busy ? t('保存中…', 'Saving…') : t('保存', 'Save')))));
    }

    // ── 3c. 连接详情弹层 ──────────────────────────────────────────────────────
    function DetailsModal({ bot, onClose, onGrant }) {
      const [copied, setCopied] = React.useState(false);
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const rows = [
        [t('状态', 'State'), bot.state],
        [t('应用 ID', 'App ID'), bot.appIdMasked ?? bot.appId],
        [t('机器人', 'Bot'), bot.botName],
        [t('机器人 Open ID', 'Bot Open ID'), bot.botOpenId],
        [t('绑定会话', 'Bound chats'), String(bot.boundChats ?? 0)],
        [t('工作区', 'Workspace'), bot.workspace ?? '—'],
        [t('默认模型', 'Model'), bot.model ? `${bot.model.provider} · ${bot.model.model}${bot.model.reasoningEffort ? ` · ${bot.model.reasoningEffort}` : ''}` : '—'],
        [t('Agent 预设', 'Agent preset'), bot.agentPreset ?? '—'],
        [t('连接时间', 'Connected at'), bot.connectedAt ?? '—'],
        [t('最近错误', 'Last error'), bot.lastError ? `${bot.lastError.code}：${bot.lastError.message}` : '—'],
      ];
      const copy = () => {
        void navigator.clipboard?.writeText(JSON.stringify(bot, null, 2)).then(() => setCopied(true), () => setCopied(false));
      };
      return h('div', { style: S.overlay, role: 'dialog', 'aria-modal': true, onClick: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h('div', { style: S.modal },
          h('h3', { style: { margin: '0 0 10px', fontSize: '15px' } }, t('连接详情', 'Connection details')),
          h('div', { style: { display: 'grid', gap: '6px' } },
            rows.map(([key, value]) => h('div', { key, style: { display: 'flex', gap: '10px', fontSize: '12px' } },
              h('span', { style: { width: '96px', color: 'var(--dsw-alias-label-secondary, #6b7280)', flex: 'none' } }, key),
              h('span', { style: { wordBreak: 'break-all' } }, value ?? '—')))),
          h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l1, #e5e7eb)', marginTop: '14px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #6b7280)' } },
              t('缺少权限时，扫码一次即可补齐', 'Scan once to grant the required permissions')),
            h('button', { type: 'button', style: S.btn('primary'), onClick: onGrant },
              t('补齐权限', 'Grant permissions'))),
          h('div', { style: { ...S.row, justifyContent: 'flex-end', marginTop: '16px' } },
            h('button', { type: 'button', style: S.btn(), onClick: copy }, copied ? t('已复制', 'Copied') : t('复制', 'Copy')),
            h('button', { type: 'button', style: S.btn('primary'), onClick: onClose }, t('关闭', 'Close')))));
    }

    // ── 4. 单个机器人卡片 ────────────────────────────────────────────────────
    function BotCard({ connection, bot, models, presets, workspaces, permissionOptions, onChanged }) {
      const [open, setOpen] = React.useState(false);
      const [aliasOpen, setAliasOpen] = React.useState(false);
      const [detailsOpen, setDetailsOpen] = React.useState(false);
      const [grantOpen, setGrantOpen] = React.useState(false);

      const [draft, setDraft] = React.useState(null);
      const [baseline, setBaseline] = React.useState(null);
      const [busy, setBusy] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [notice, setNotice] = React.useState(null);
      React.useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), 3000);
        return () => clearTimeout(timer);
      }, [notice]);

      const seed = React.useCallback((source = bot) => {
        const enhancement = source.contextEnhancement ?? emptyEnhancement();
        return {
          alias: source.alias ?? '',
          workspace: source.workspace ?? '',
          workspaceMode: source.workspace ?? '',
          workspaceCustom: source.workspace ?? '',
          provider: source.model?.provider ?? '',
          model: source.model?.model ?? '',
          reasoningEffort: source.model?.reasoningEffort ?? '',
          preset: source.agentPreset ?? '',
          busyMode: {
            direct: (source.busyMode && typeof source.busyMode === 'object' ? source.busyMode.direct : source.busyMode) ?? 'queue',
            group: (source.busyMode && typeof source.busyMode === 'object' ? source.busyMode.group : source.busyMode) ?? 'queue',
          },
          contextEnhancement: {
            group: { ...emptyScope(), ...(enhancement.group ?? {}), enabled: true },
            direct: { ...emptyScope(), ...(enhancement.direct ?? {}), enabled: true },
          },
          respondBot: source.respondToBotMessages !== false,
          topics: source.topicsEnabled !== false,
          processDetail: source.processDetail === 'brief' ? 'brief' : 'detailed',
          permissionPreset: source.permissionPreset ?? '',
          eavesdrop: {
            enabled: source.eavesdrop?.enabled !== false,
            limit: Number.isFinite(Number(source.eavesdrop?.limit)) ? Number(source.eavesdrop.limit) : 0,
          },
          mentions: {
            enabled: source.mentions?.enabled !== false,
            allowAll: source.mentions?.allowAll === true,
          },
          group: source.access?.group ?? 'all',
          allow: (source.access?.allowOpenIds ?? []).join(', '),
          managers: (source.access?.managers ?? []).join(', '),
        };
      }, [bot]);

      // Re-seed only when the identity changes: the 15s poll must not wipe edits.
      const seedRef = React.useRef(seed);
      seedRef.current = seed;
      React.useEffect(() => {
        const initial = seedRef.current();
        setDraft(initial);
        setBaseline(initial);
      }, [bot.id]);

      const run = async (key, task) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
          await task();
          setNotice(t('已保存', 'Saved'));
          try {
            const fresh = await rpc(connection, API.botsList, {});
            const latest = (fresh?.bots ?? []).find((item) => item.id === bot.id);
            if (latest) {
              const initial = seed(latest);
              setDraft(initial);
              setBaseline(initial);
            }
          } catch {
            // 拉取失败时至少把当前草稿当作基线，保证 ✓ 消失
            const snap = groupSnapshot(draft ?? {});
            setBaseline((previous) => ({ ...(previous ?? draft ?? {}), ...snap }));
          }
          onChanged();
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(null);
        }
      };

      const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

      const saveModel = () => rpc(connection, API.botModelSet, {
        botId: bot.id,
        model: draft.provider && draft.model
          ? { provider: draft.provider, model: draft.model, ...(draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {}) }
          : null,
      });

      const saveAccess = () => rpc(connection, API.botAccessSet, {
        botId: bot.id,
        access: {
          group: draft.group,
          allowOpenIds: draft.allow.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean),
          managers: draft.managers.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean),
        },
      });

      const groupSnapshot = (value) => ({
        general: {
          workspace: value.workspace, provider: value.provider, model: value.model,
          reasoningEffort: value.reasoningEffort, preset: value.preset, processDetail: value.processDetail,
          permissionPreset: value.permissionPreset,
        },
        direct: { busyMode: value.busyMode?.direct, ce: value.contextEnhancement?.direct },
        group: {
          busyMode: value.busyMode?.group,
          group: value.group, allow: value.allow, managers: value.managers, ce: value.contextEnhancement?.group,
          respondBot: value.respondBot, topics: value.topics, eavesdrop: value.eavesdrop,
          mentions: value.mentions,
        },
      });

      const isDirty = (name) => {
        if (!draft || !baseline) return false;
        return JSON.stringify(groupSnapshot(draft)[name]) !== JSON.stringify(groupSnapshot(baseline)[name]);
      };

      const saveGeneral = () => run('g', async () => {
        await rpc(connection, API.botWorkspaceSet, { botId: bot.id, workspace: draft.workspace || null });
        await rpc(connection, API.botModelSet, {
          botId: bot.id,
          model: draft.provider && draft.model
            ? { provider: draft.provider, model: draft.model, ...(draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {}) }
            : null,
        });
        await rpc(connection, API.botPresetSet, { botId: bot.id, preset: draft.preset || null });
        await rpc(connection, API.botProcessDetailSet, { botId: bot.id, mode: draft.processDetail === 'brief' ? 'brief' : 'detailed' });
        await rpc(connection, API.botPermissionSet, { botId: bot.id, permissionPreset: draft.permissionPreset || null });
      });

      const saveScope = (scope) => run(`s-${scope}`, async () => {
        await rpc(connection, API.botContextSet, {
          botId: bot.id,
          config: { group: draft.contextEnhancement.group, direct: draft.contextEnhancement.direct },
        });
        await rpc(connection, API.botBusyModeSet, { botId: bot.id, scope, mode: draft.busyMode[scope] });
        if (scope === 'group') {
          await rpc(connection, API.botBotReplySet, { botId: bot.id, enabled: draft.respondBot === true });
          await rpc(connection, API.botTopicsSet, { botId: bot.id, enabled: draft.topics !== false });
          await rpc(connection, API.botEavesdropSet, { botId: bot.id, eavesdrop: draft.eavesdrop });
          await rpc(connection, API.botMentionsSet, { botId: bot.id, mentions: draft.mentions });
          await saveAccess();
        }
      });

      const saveButton = (key, task) => h('button', {
        type: 'button', className: 'bxf-check', style: S.check,
        disabled: busy === key,
        title: t('保存', 'Save'), 'aria-label': t('保存', 'Save'),
        onClick: task,
      }, busy === key ? '…' : '✓');

      const selectedModel = models.find((item) => item.provider === draft.provider && item.model === draft.model) ?? null;
      const title = bot.alias || bot.botName || t('飞书机器人', 'Feishu bot');

      const scopeEditor = (scopeKey, label) => {
        const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
        const update = (patch) => setDraft((current) => ({
          ...current,
          contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...scope, ...patch } },
        }));
        const fields = scopeKey === 'group' ? CE_FIELDS : CE_FIELDS.filter((field) => field !== 'conversationTitle');
        return h('div', { style: { borderTop: '1px dashed var(--dsw-alias-border-l1, #e5e7eb)', paddingTop: '8px' } },
          h(FieldLabel, { label, hint: t('注入哪些来源字段：只勾选模型无法自行推断的消息元信息。', 'Which source fields to inject.') }),
          h('div', { style: S.checkRow },
            fields.map((field) => h('label', { key: field, style: S.checkLabel },
              h('input', {
                type: 'checkbox',
                checked: (scope.fields ?? []).includes(field),
                onChange: (event) => {
                  const next = new Set(scope.fields ?? []);
                  if (event.target.checked) next.add(field); else next.delete(field);
                  update({ fields: CE_FIELDS.filter((item) => next.has(item)) });
                },
              }),
              text(CE_LABELS[field])))),
          h('textarea', {
            style: { ...S.area, marginTop: '6px' },
            value: scope.guidance ?? '',
            placeholder: t('增强提示词（可选）', 'Guidance (optional)'),
            onChange: (event) => update({ guidance: event.target.value }),
          }));
      };

      const accent = BOT_COLORS[bot.color] ?? BOT_COLORS.blue;
      return h('article', {
        className: 'bxf-card',
        style: {
          ...S.card,
          borderLeft: `3px solid ${accent.main}`,
          '--bxf-accent': accent.main,
          '--bxf-accent-soft': accent.soft,
          '--bxf-accent-ring': accent.ring,
          '--bxf-accent-edge': accent.edge,
        },
      },
        h('div', {
          className: 'bxf-head',
          style: S.cardHead,
          role: 'button',
          tabIndex: 0,
          'aria-expanded': open,
          onClick: () => setOpen((value) => !value),
          onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((value) => !value); } },
        },
        h('div', { style: S.grow },
          h('div', { style: S.nameRow },
            h('span', { style: S.name }, title),
            h('button', {
              type: 'button',
              className: 'bxf-icon-btn',
              style: S.iconBtn,
              title: t('修改显示名称', 'Rename'),
              'aria-label': t('修改显示名称', 'Rename'),
              onClick: (event) => { event.stopPropagation(); setAliasOpen(true); },
            }, h('svg', {
              width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none',
              stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
              'aria-hidden': true,
            },
            h('path', { d: 'M12 20h9' }),
            h('path', { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }))),
            h(StatusBadge, { state: bot.state })),
          h('div', { style: S.idRow },
            h('span', { style: { ...S.meta, marginTop: 0 } }, `${bot.appIdMasked ?? bot.appId ?? ''} · ${t('会话', 'chats')} ${bot.boundChats ?? 0}`),
            h('div', { style: { display: 'flex', gap: '6px', flex: 'none' }, onClick: (event) => event.stopPropagation() },
              h('button', {
                type: 'button', className: 'bxf-mini', disabled: busy === 'test',
                onClick: () => { void run('test', () => rpc(connection, API.botTest, { botId: bot.id })); },
              }, t('测试', 'Test')),
              h('button', {
                type: 'button', className: 'bxf-mini', disabled: busy === 'reconnect',
                onClick: () => { void run('reconnect', () => rpc(connection, API.botReconnect, { botId: bot.id })); },
              }, t('重连', 'Reconnect')),
              h('button', {
                type: 'button', className: 'bxf-mini',
                onClick: () => setDetailsOpen(true),
              }, t('详情', 'Details')))))),
        aliasOpen ? h(AliasModal, { connection, bot, onClose: () => setAliasOpen(false), onSaved: onChanged }) : null,
        detailsOpen ? h(DetailsModal, {
          bot,
          onClose: () => setDetailsOpen(false),
          onGrant: () => { setDetailsOpen(false); setGrantOpen(true); },
        }) : null,
        grantOpen ? h(Boundary, null, h(AddBotModal, {
          connection,
          mode: 'scan',
          grant: bot,
          onClose: () => setGrantOpen(false),
          onAdded: onChanged,
        })) : null,
        open && draft ? h('div', { style: S.body },

          h(Panel, { title: t('通用', 'General'), defaultOpen: true, action: isDirty('general') ? saveButton('g', saveGeneral) : null },
            h(Field, { label: t('默认工作区', 'Default workspace'), hint: t('列表来自 DSH 已登记的工作区。', 'From the workspaces DSH already knows.') },
              h('select', {
                style: S.input, value: draft.workspaceMode,
                onChange: (event) => {
                  const next = event.target.value;
                  set({ workspaceMode: next, workspace: next === '__custom__' ? draft.workspaceCustom : next });
                },
              },
              h('option', { value: '' }, t('跟随 DSH 默认', 'Host default')),
              workspaces.map((item) => h('option', { key: item.path, value: item.path }, item.title && item.title !== item.path ? `${item.title} — ${item.path}` : item.path)),
              h('option', { value: '__custom__' }, t('自定义路径…', 'Custom path…')))),
            draft.workspaceMode === '__custom__'
              ? h('input', {
                style: S.input, value: draft.workspaceCustom, placeholder: '/Users/you/work',
                onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value }),
              })
              : null,
            h(Field, { label: t('默认模型（只影响新会话）', 'Default model (new Sessions)') },
              h('select', {
                style: S.input, value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : '',
                onChange: (event) => {
                  const [provider, ...rest] = event.target.value.split('/');
                  set({ provider, model: rest.join('/'), reasoningEffort: '' });
                },
              },
              h('option', { value: '' }, t('跟随 Host 默认', 'Host default')),
              models.map((item) => h('option', { key: `${item.provider}/${item.model}`, value: `${item.provider}/${item.model}` }, item.label)))),
            h(Field, { label: t('思考强度', 'Reasoning effort') },
              h('select', {
                style: S.input, value: draft.reasoningEffort, disabled: !selectedModel,
                onChange: (event) => set({ reasoningEffort: event.target.value }),
              },
              h('option', { value: '' }, t('跟随模型默认', 'Model default')),
              (selectedModel?.reasoning?.efforts ?? []).map((effort) => h('option', { key: effort.id, value: effort.id }, effort.name ?? effort.id)))),
            h(Field, { label: t('过程详细度', 'Progress detail'), hint: t('详细：显示每个工具的名称与参数；简要：只显示工具名与汇总。', 'Detailed shows tool arguments; brief keeps names and the summary.') },
              h('select', {
                style: S.input, value: draft.processDetail,
                onChange: (event) => set({ processDetail: event.target.value }),
              },
                h('option', { value: 'detailed' }, t('详细', 'Detailed')),
                h('option', { value: 'brief' }, t('简要', 'Brief')))),
            h(Field, { label: t('新会话权限档位', 'New-session permission'), hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
              h('select', {
                style: S.input, value: draft.permissionPreset,
                onChange: (event) => set({ permissionPreset: event.target.value }),
              },
                h('option', { value: '' }, t('跟随 Host 默认', 'Host default')),
                draft.permissionPreset && !(permissionOptions ?? []).some((item) => item.value === draft.permissionPreset)
                  ? h('option', { value: draft.permissionPreset }, `${draft.permissionPreset}${t('（当前）', ' (current)')}`)
                  : null,
                (permissionOptions ?? []).map((item) => h('option', { key: item.value, value: item.value }, item.name ?? item.value)))),
            h(Field, { label: t('默认 Agent 预设（只影响新会话）', 'Default agent preset (new Sessions)') },
              h('select', { style: S.input, value: draft.preset, onChange: (event) => set({ preset: event.target.value }) },
                h('option', { value: '' }, t('跟随 Host 默认预设', 'Host default preset')),
                presets.map((item) => h('option', { key: item.id, value: item.id }, item.name ?? item.id))))),

          h(Panel, { title: t('私聊', 'Private chat'), action: isDirty('direct') ? saveButton('s-direct', () => saveScope('direct')) : null },
            h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
              h('select', { style: S.input, value: draft.busyMode.direct, onChange: (event) => setDraft((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
                h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                h('option', { value: 'steer' }, t('插入为补充指令', 'Steer')))),
            scopeEditor('direct', t('私聊上下文注入', 'Private-chat context'))),

          h(Panel, { title: t('群聊', 'Group chat'), action: isDirty('group') ? saveButton('s-group', () => saveScope('group')) : null },
            h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
              h('select', { style: S.input, value: draft.busyMode.group, onChange: (event) => setDraft((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
                h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                h('option', { value: 'steer' }, t('插入为补充指令', 'Steer')))),
            h(Field, { label: t('启用话题', 'Enable topics'), hint: t('开启后所有群成员都能用 /topic 开话题、/topic-sync 同步结论，不受管理白名单限制。', 'Anyone in the group may open or sync topics; the manager list does not apply.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.topics !== false,
                  onChange: (event) => set({ topics: event.target.checked }),
                }),
                t('允许', 'Allow'))),
            h(Field, { label: t('响应其它机器人的消息', 'Reply to other bots'), hint: t('开启后，其它机器人（应用）在群里的发言也会触发本机器人。', 'When on, messages from other bots also trigger this bot.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.respondBot === true,
                  onChange: (event) => set({ respondBot: event.target.checked }),
                }),
                t('允许', 'Allow'))),
            h(Field, { label: t('旁听群消息（默认开启）', 'Eavesdrop group messages (on by default)'), hint: t('只把未 @ 你的消息记为上下文，不会触发回复；图片/文件只记占位信息，模型需要时会请你 @ 它重发。需要 im:message.group_msg 权限；可用「补齐权限」扫码授权。', 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.eavesdrop.enabled,
                  onChange: (event) => set({ eavesdrop: { ...draft.eavesdrop, enabled: event.target.checked } }),
                }),
                t('允许', 'Allow'))),
            draft.eavesdrop.enabled
              ? h(Field, { label: t('滚动保留条数', 'Rolling buffer size'), hint: t('0 表示不限制；超过后丢弃最旧的旁听消息。', '0 means unlimited; older messages are dropped past this limit.') },
                h('input', {
                  type: 'number', min: 0, style: S.input, value: draft.eavesdrop.limit,
                  onChange: (event) => set({
                    eavesdrop: {
                      ...draft.eavesdrop,
                      limit: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    },
                  }),
                }))
              : null,
            h(Field, { label: t('允许机器人 @ 人（默认开启）', 'Let the bot mention people (on by default)'), hint: t('只在需要明确让某人收到消息或同步重要信息时才 @；常规对话不需要。插件会校验 open_id，非法或未开启时擦除。', 'Mention only when someone must receive the message or important information must be synced; normal replies do not mention. The plugin validates open_ids and erases invalid or disabled mentions.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.mentions.enabled,
                  onChange: (event) => set({ mentions: { ...draft.mentions, enabled: event.target.checked } }),
                }),
                t('允许', 'Allow'))),
            draft.mentions.enabled
              ? h(Field, { label: t('禁止 @所有人（默认开启）', 'Forbid @all (on by default)'), hint: t('关闭后模型可以 @所有人；插件仍会校验 open_id。', 'When off, the model may mention everyone; open_ids are still validated.') },
                h('label', { style: S.checkLabel },
                  h('input', {
                    type: 'checkbox',
                    checked: draft.mentions.allowAll !== true,
                    onChange: (event) => set({ mentions: { ...draft.mentions, allowAll: !event.target.checked } }),
                  }),
                  t('禁止', 'Forbid')))
              : null,
            h(Field, { label: t('谁能使用群聊中的机器人', 'Who may use the bot in groups') },
              h('select', { style: S.input, value: draft.group, onChange: (event) => set({ group: event.target.value }) },
                h('option', { value: 'all' }, t('所有用户', 'Everyone')),
                h('option', { value: 'allowlist' }, t('仅白名单', 'Allowlist')))),
            draft.group === 'allowlist'
              ? h(Field, { label: t('群聊白名单 Open ID', 'Group allowlist Open IDs') },
                h('textarea', { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }) }))
              : null,
            h(Field, { label: t('管理白名单 Open ID（可执行 /new、停止、调整与审批）', 'Manager allowlist (may run /new, stop, adjust and approve)'), hint: t('留空表示没有人可以在群里执行管理操作。', 'Empty means nobody may manage in groups.') },
              h('textarea', { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }) })),
            scopeEditor('group', t('群聊上下文注入', 'Group-chat context'))),

          h(Panel, { title: t('移除', 'Remove') },
            h('div', { style: { display: 'flex', justifyContent: 'center' } },
              h('button', {
                type: 'button', className: 'bxf-danger', style: S.dangerBtn, disabled: busy === 'remove',
                onClick: () => {
                  if (!window.confirm(t(`移除「${title}」？本机将删除该机器人的配置与密钥，不影响飞书应用本身。`, `Remove ${title}? Local config and secret are deleted; the Feishu app stays.`))) return;
                  void run('remove', () => rpc(connection, API.botRemove, { botId: bot.id }));
                },
              }, t('移除此机器人', 'Remove this bot')))),

          error ? h('div', { style: { ...S.error, marginTop: '8px' } }, error) : null,
          notice ? h('div', { className: 'bxf-toast', style: S.toast }, notice) : null)
        : null);
    }

    // ── 5. 设置页 ──────────────────────────────────────────────────────────────
    function SettingsPage({ connection }) {
      const [state, setState] = React.useState({ bots: [], version: null });
      const [models, setModels] = React.useState([]);
      const [presets, setPresets] = React.useState([]);
      const [workspaces, setWorkspaces] = React.useState([]);
      const [permissionOptions, setPermissionOptions] = React.useState([]);
      const [addMode, setAddMode] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [loaded, setLoaded] = React.useState(false);

      const refresh = React.useCallback(async () => {
        try {
          const value = await rpc(connection, API.botsList, {});
          // 数据没变就不触发重渲染（轮询只关心状态变化）
          setState((previous) => {
            const nextBots = value.bots ?? [];
            const same = previous.version === (value.version ?? null)
              && JSON.stringify(previous.bots) === JSON.stringify(nextBots);
            return same ? previous : { bots: nextBots, version: value.version ?? null };
          });
          setError(null);
          setLoaded(true);
          return value;
        } catch (cause) {
          setError(cause.message);
          setLoaded(true);
          return null;
        }
      }, [connection]);

      // 状态轮询：页面可见时 30 秒一次，隐藏时完全暂停，回到页面立即补一次。
      React.useEffect(() => {
        const POLL_MS = 30_000;
        let timer = null;
        const tick = () => { if (!document.hidden) void refresh(); };
        const start = () => {
          if (timer) clearInterval(timer);
          timer = setInterval(tick, POLL_MS);
        };
        const onVisibility = () => {
          if (document.hidden) {
            if (timer) clearInterval(timer);
            timer = null;
          } else {
            void refresh();
            start();
          }
        };
        void refresh();
        start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
          if (timer) clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [refresh]);

      React.useEffect(() => {
        if (!loaded || state.bots.length === 0) return;
        let alive = true;
        const botId = state.bots[0].id;
        void rpc(connection, API.modelsList, {}).then((catalog) => {
          if (!alive) return;
          const flat = [];
          for (const group of catalog.groups ?? []) {
            for (const model of group.models ?? []) {
              flat.push({ provider: group.id, model: model.id, label: `${group.name} · ${model.name}`, reasoning: model.reasoning ?? null });
            }
          }
          setModels(flat);
        }).catch(() => undefined);
        void rpc(connection, API.presetsList, { botId }).then((value) => {
          if (alive) setPresets(Array.isArray(value?.presets) ? value.presets : []);
        }).catch(() => undefined);
        void rpc(connection, API.workspacesList, {}).then((value) => {
          if (alive) setWorkspaces(Array.isArray(value?.workspaces) ? value.workspaces : []);
        }).catch(() => undefined);
        void rpc(connection, API.permissionList, {}).then((value) => {
          if (alive) setPermissionOptions(Array.isArray(value?.options) ? value.options : []);
        }).catch(() => undefined);
        return () => { alive = false; };
      }, [connection, loaded, state.bots.length]);

      if (!loaded) {
        return h('div', { style: S.page },
          h('h2', { style: S.title }, t('飞书机器人', 'Feishu bots')),
          error
            ? h('div', null,
              h('p', { style: S.error }, `${t('读取失败：', 'Failed: ')}${error}`),
              h('button', { type: 'button', style: S.btn('primary'), onClick: () => { setError(null); void refresh(); } }, t('重试', 'Retry')))
            : h('p', { style: S.sub }, t('正在读取…', 'Loading…')));
      }

      return h('div', { className: 'bxf-page', style: S.page },
        h('style', null, CSS),
        h('div', { style: S.head },
          h('div', null,
            h('h2', { style: S.title }, t('飞书机器人', 'Feishu bots')),
            h('p', { style: S.sub }, state.version ? `v${state.version}` : '')),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { type: 'button', style: S.btn(), onClick: () => setAddMode('manual') }, t('手动添加', 'Add manually')),
            h('button', { type: 'button', style: S.btn('primary'), onClick: () => setAddMode('scan') }, t('扫码添加', 'Add by scanning')))),
        error ? h('div', { style: { ...S.error, marginBottom: '8px' } }, error) : null,
        state.bots.length === 0
          ? h('div', { style: { ...S.card, padding: '18px' } },
            h('p', { style: { margin: 0, fontSize: '13px' } }, t('还没有机器人。点击右上角「添加机器人」，填入飞书应用的 App ID / App Secret。', 'No bots yet. Use “Add bot” and paste the app credentials.')))
          : state.bots.map((bot) => h(BotCard, {
            key: bot.id,
            connection,
            bot,
            models,
            presets,
            workspaces,
            permissionOptions,
            onChanged: () => { void refresh(); },
          })),
        addMode
          ? h(Boundary, null, h(AddBotModal, {
            connection,
            mode: addMode,
            onClose: () => setAddMode(null),
            onAdded: () => { void refresh(); },
          }))
          : null);
    }

    return {
      inject: ['slots', 'connection'],
      apply(ctx) {
        const connection = ctx.connection;
        function BoundPage(props) {
          return h(Boundary, null, h(SettingsPage, { ...props, connection }));
        }
        if (!connection || typeof connection.rpc?.call !== 'function') {
          console.error('[im-feishu] client connection service is missing; the settings page cannot call the Host');
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'im-feishu',
          order: 22,
          label: () => t('飞书机器人', 'Feishu Bots'),
        }, BoundPage));
      },
    };
  },
});
