import React from 'react';

import {
  API, BOT_COLORS, Boundary, CE_FIELDS, CE_LABELS, COLOR_NAMES, S,
  Field, FieldLabel, Panel, SaveStatus, StatusBadge, emptyEnhancement, emptyScope,
  rpc, t, text,
} from './shared.js';
import { UserIdentityButton } from './identity.js';
import { useAutoSave, useMutation, usePolling, useRpcQuery } from './hooks.js';
import { botSettingUpdates } from './bot-settings.js';
import { remainingSeconds } from './async.js';
import { DETAILS_CSS } from './details-style.js';

const h = React.createElement;

    // ── 3a. 添加机器人弹层（手动 / 扫码） ────────────────────────────────────────────────────
    export function AddBotModal({ connection, mode = 'manual', grant = null, onClose, onAdded }) {
      const [form, setForm] = React.useState({ appId: '', appSecret: '' });
      const { data: scan, error: pollError, accept: setScan, refresh: poll, invalidate } = useRpcQuery(connection, API.provisionPoll);
      const { busy, error: actionError, run } = useMutation();
      const error = actionError ?? pollError;
      const [remaining, setRemaining] = React.useState(0);
      const terminal = ['success', 'denied', 'expired', 'error', 'cancelled'].includes(scan?.state);
      usePolling(poll, { interval: Math.max(2000, scan?.nextPollInMs ?? 3000), enabled: Boolean(scan) && !terminal && !pollError && busy !== 'scan', immediate: false, scope: connection });
      usePolling(() => setRemaining(remainingSeconds(scan?.expiresAt)), {
        interval: 1000, enabled: Boolean(scan) && !terminal, scope: scan?.expiresAt,
      });
      const callbacks = React.useRef({ onAdded, onClose });
      callbacks.current = { onAdded, onClose };
      React.useEffect(() => {
        if (scan?.state === 'success') { callbacks.current.onAdded(); callbacks.current.onClose(); }
      }, [scan?.state]);
      const startScan = () => run('scan', () => {
        invalidate();
        return rpc(connection, API.provisionBegin, grant ? { botId: grant.id } : {});
      }, (snapshot) => {
        setRemaining(remainingSeconds(snapshot.expiresAt));
        setScan(snapshot);
      });
      const cancelScan = () => {
        invalidate();
        setScan(null);
        if (mode === 'scan') void rpc(connection, API.provisionCancel, {}).catch(() => undefined);
        onClose();
      };
      const close = React.useRef(cancelScan);
      close.current = cancelScan;
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') close.current(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);
      const started = React.useRef(false);
      React.useEffect(() => {
        if (mode === 'scan' && !started.current) { started.current = true; void startScan(); }
      }, [mode]);
      const submit = () => run('submit', () => rpc(connection, API.botAdd, form), () => {
        onAdded(); onClose();
      });

      return h('div', { style: S.overlay, role: 'dialog', 'aria-modal': true, onClick: (event) => { if (event.target === event.currentTarget) cancelScan(); } },
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
                (error || (scan && ['denied', 'expired', 'error', 'cancelled'].includes(scan.state)))
                  ? h('button', { type: 'button', style: S.btn('primary'), disabled: Boolean(busy), onClick: startScan }, t('重新生成', 'Retry'))
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
              ? h('button', { type: 'button', style: S.btn(), onClick: cancelScan, disabled: busy }, t('取消', 'Cancel'))
              : null,
            mode === 'manual'
              ? h('button', { type: 'button', style: S.btn('primary'), onClick: submit, disabled: busy || !form.appId || !form.appSecret },
                busy ? t('正在验证…', 'Verifying…') : t('绑定并连接', 'Bind and connect'))
              : null)));
    }

    // ── 3b. 别名与颜色弹层 ──────────────────────────────────────────────────────────
    export function AliasModal({ connection, bot, onClose, onSaved }) {
      const [value, setValue] = React.useState(bot.alias ?? '');
      const [color, setColor] = React.useState(bot.color ?? 'blue');
      const autoSave = useAutoSave();
      const requestClose = React.useCallback(async () => {
        if (await autoSave.flush()) onClose();
      }, [autoSave.flush, onClose]);
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape' && !event.isComposing) void requestClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [requestClose]);
      return h('div', { ...autoSave.compositionHandlers, style: S.overlay, role: 'dialog', 'aria-modal': true, onClick: (event) => { if (event.target === event.currentTarget) void requestClose(); } },
        h('div', { style: S.modal },
          h('h3', { style: { margin: '0 0 4px', fontSize: '15px' } }, t('外观与名称', 'Appearance')),
          h('p', { style: S.hint }, t('只在本插件里展示，不影响飞书中的机器人名称；留空恢复应用原名。', 'Shown only in this plugin; empty restores the app name.')),
          h('div', { style: S.panelBody },
            h('input', {
              style: S.input, value, autoFocus: true, placeholder: bot.botName ?? '小助手',
              onChange: (event) => {
                const next = event.target.value;
                setValue(next);
                autoSave.schedule('alias', () => rpc(connection, API.botAliasSet, { botId: bot.id, alias: next.trim() || null }), 600, onSaved);
              },
              onBlur: () => void autoSave.flush(),
              onKeyDown: (event) => { if (event.key === 'Enter' && !event.nativeEvent?.isComposing) void requestClose(); },
            }),
            h('div', null,
              h('label', { style: S.label }, t('标识色', 'Accent color')),
              h('div', { style: { display: 'flex', gap: '8px' } },
                Object.entries(BOT_COLORS).map(([key, palette]) => h('button', {
                  key,
                  type: 'button',
                  title: text(COLOR_NAMES[key]),
                  'aria-label': text(COLOR_NAMES[key]),
                  onClick: () => {
                    setColor(key);
                    autoSave.schedule('color', () => rpc(connection, API.botColorSet, { botId: bot.id, color: key }), 0, onSaved);
                  },
                  style: {
                    width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer',
                    background: palette.main, border: color === key ? '2px solid var(--dsw-alias-label-primary)' : '2px solid transparent',
                    boxShadow: color === key ? '0 0 0 2px var(--dsw-alias-bg-layer-1) inset' : 'none',
                  },
                })))),
            h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry })),
          h('div', { style: { ...S.row, justifyContent: 'flex-end', marginTop: '14px' } },
            h('button', { type: 'button', style: S.btn(), onClick: requestClose }, t('关闭', 'Close')))));
    }

    // ── 3c. 连接详情弹层 ──────────────────────────────────────────────────────
    export function DetailsModal({ bot, onClose, onGrant }) {
      const [copied, setCopied] = React.useState(false);
      const [copyError, setCopyError] = React.useState(null);
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const title = bot.alias || bot.botName || t('飞书机器人', 'Feishu bot');
      const accent = BOT_COLORS[bot.color] ?? BOT_COLORS.blue;
      const connectedAt = bot.connectedAt ? new Date(bot.connectedAt) : null;
      const connectedTime = connectedAt && Number.isFinite(connectedAt.getTime())
        ? connectedAt.toLocaleString(navigator.language || undefined) : '—';
      const section = (heading, rows) => h('section', { className: 'bxf-details-section' },
        h('h4', null, heading),
        h('dl', { className: 'bxf-details-facts' }, rows.map(([label, value, mono]) => h(React.Fragment, { key: label },
          h('dt', null, label), h('dd', { className: mono ? 'bxf-details-mono' : undefined }, value || '—')))));
      const copy = async () => {
        setCopyError(null);
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(JSON.stringify(bot, null, 2));
          setCopied(true);
        } catch {
          setCopied(false);
          setCopyError(t('复制失败，请重试', 'Copy failed. Please retry.'));
        }
      };
      return h('div', { style: S.overlay, onClick: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h('style', null, DETAILS_CSS),
        h('div', { className: 'bxf-details-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('连接详情', 'Connection details') },
          h('header', { className: 'bxf-details-header' },
            h('h3', null, t('连接详情', 'Connection details')),
            h('button', { type: 'button', className: 'bxf-mini', onClick: copy }, copied ? t('已复制', 'Copied') : t('复制详情', 'Copy details'))),
          h('div', { className: 'bxf-details-body' },
            h('div', { className: 'bxf-details-profile' },
              h('span', { className: 'bxf-details-avatar', style: { color: accent.main, background: accent.soft }, 'aria-hidden': true }, [...title][0]),
              h('div', { className: 'bxf-details-person' },
                h('div', { className: 'bxf-details-name' }, h('strong', null, title), h(StatusBadge, { state: bot.state })),
                h('div', { className: 'bxf-details-meta' }, `${t('绑定会话', 'Bound chats')} · ${bot.boundChats ?? 0}`))),
            section(t('应用信息', 'Application'), [
              [t('应用 ID', 'App ID'), bot.appIdMasked || bot.appId, true],
              [t('机器人', 'Bot'), bot.botName],
              [t('机器人 Open ID', 'Bot Open ID'), bot.botOpenId, true],
              [t('连接时间', 'Connected at'), connectedTime],
            ]),
            section(t('会话默认设置', 'Session defaults'), [
              [t('工作区', 'Workspace'), bot.workspace || t('跟随 DSH 默认', 'Host default')],
              [t('默认模型', 'Model'), bot.model ? `${bot.model.provider} · ${bot.model.model}` : t('跟随 Host 默认', 'Host default')],
              ...(bot.model?.reasoningEffort ? [[t('思考强度', 'Reasoning effort'), bot.model.reasoningEffort]] : []),
              [t('Agent 预设', 'Agent preset'), bot.agentPreset || t('跟随 Host 默认预设', 'Host default preset')],
            ]),
            bot.lastError ? h('section', { className: 'bxf-details-section bxf-details-error', role: 'alert' },
              h('h4', null, t('最近错误', 'Last error')),
              h('p', null, [bot.lastError.code, bot.lastError.message].filter(Boolean).join(' · '))) : null,
            copyError ? h('div', { style: S.error, role: 'alert' }, copyError) : null),
          h('footer', { className: 'bxf-details-footer' },
            h('span', null, t('应用权限', 'App permissions')),
            h('button', { type: 'button', style: S.btn(), onClick: onGrant }, t('补齐权限', 'Grant permissions')))));
    }

    // ── 4. 单个机器人卡片 ────────────────────────────────────────────────────
    export function BotCard({ connection, bot, models, presets, workspaces, permissionOptions, onChanged }) {
      const [open, setOpen] = React.useState(false);
      const [aliasOpen, setAliasOpen] = React.useState(false);
      const [detailsOpen, setDetailsOpen] = React.useState(false);
      const [grantOpen, setGrantOpen] = React.useState(false);

      const [draft, setDraft] = React.useState(null);
      const draftRef = React.useRef(null);
      const autoSave = useAutoSave();
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
          processDetail: source.processDetail === 'brief' ? 'brief' : 'detailed',
          permissionPreset: source.permissionPreset ?? '',
          eavesdrop: {
            enabled: source.eavesdrop?.enabled !== false,
            limit: Number.isFinite(Number(source.eavesdrop?.limit)) && Number(source.eavesdrop?.limit) > 0
              ? Math.min(500, Number(source.eavesdrop.limit)) : 20,
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
        draftRef.current = initial;
        setDraft(initial);
      }, [bot.id]);

      const run = async (key, task) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
          const result = await task();
          setNotice(key === 'check'
            ? result.connected ? t('凭证有效，长连接正常', 'Credentials verified; connection is active')
              : t('凭证有效，长连接未就绪，可点击重连', 'Credentials verified; connection is not ready. Reconnect to retry.')
            : t('操作完成', 'Done'));
          onChanged();
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(null);
        }
      };

      const set = (patch, delay = 0) => {
        const previous = draftRef.current;
        const next = typeof patch === 'function' ? patch(previous) : { ...previous, ...patch };
        draftRef.current = next;
        setDraft(next);
        for (const update of botSettingUpdates(previous, next)) {
          autoSave.schedule(update.key, () => rpc(connection, update.method, { botId: bot.id, ...update.payload }), delay, onChanged);
        }
      };

      const selectedModel = models.find((item) => item.provider === draft?.provider && item.model === draft?.model) ?? null;
      const title = bot.alias || bot.botName || t('飞书机器人', 'Feishu bot');

      const scopeEditor = (scopeKey, label) => {
        const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
        const update = (patch, delay = 0) => set((current) => ({
          ...current,
          contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...current.contextEnhancement[scopeKey], ...patch } },
        }), delay);
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
            onChange: (event) => update({ guidance: event.target.value }, 600),
            onBlur: () => void autoSave.flush(),
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
          onKeyDown: (event) => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); setOpen((value) => !value);
            }
          },
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
          h('div', { className: 'bxf-bot-meta' },
            h('span', { style: { ...S.meta, marginTop: 0 } }, `${bot.appIdMasked ?? bot.appId ?? ''} · ${t('会话', 'chats')} ${bot.boundChats ?? 0}`),
            h('div', { className: 'bxf-bot-actions', onClick: (event) => event.stopPropagation() },
              h('button', {
                type: 'button', className: 'bxf-mini', disabled: busy === 'check',
                title: t('校验凭证与长连接状态，不发送消息', 'Verify credentials and connection status without sending messages'),
                onClick: () => { void run('check', () => rpc(connection, API.botCheck, { botId: bot.id })); },
              }, busy === 'check' ? t('检查中…', 'Checking…') : t('检查连接', 'Check connection')),
              h('button', {
                type: 'button', className: 'bxf-mini', disabled: busy === 'reconnect',
                onClick: () => { void run('reconnect', () => rpc(connection, API.botReconnect, { botId: bot.id })); },
              }, t('重连', 'Reconnect')),
              h('button', {
                type: 'button', className: 'bxf-mini',
                onClick: () => setDetailsOpen(true),
              }, t('详情', 'Details')),
              h(UserIdentityButton, { connection, bot }))))),
        error ? h('div', { style: { ...S.error, padding: '0 16px 12px' }, role: 'alert' }, error) : null,
        notice ? h('div', { style: { ...S.hint, padding: '0 16px 12px' }, role: 'status' }, notice) : null,
        autoSave.state.status !== 'idle' ? h('div', { style: { padding: '0 16px 10px' } }, h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry })) : null,
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
        open && draft ? h('div', { ...autoSave.compositionHandlers, className: 'bxf-bot-settings' },

          h(Panel, { title: t('通用', 'General'), defaultOpen: true, bodyClassName: 'bxf-general-fields' },
            h(Field, { label: t('默认工作区', 'Default workspace'), fullWidth: true, hint: t('列表来自 DSH 已登记的工作区。', 'From the workspaces DSH already knows.') },
              h('select', {
                style: S.input, value: draft.workspaceMode,
                title: draft.workspace || t('跟随 DSH 默认', 'Host default'),
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
                className: 'bxf-field-wide', style: S.input, value: draft.workspaceCustom, placeholder: '/Users/you/work',
                'aria-label': t('自定义路径…', 'Custom path…'),
                onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value }, 600),
                onBlur: () => void autoSave.flush(),
              })
              : null,
            h(Field, { label: t('默认模型', 'Model'), fullWidth: true, hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
              h('select', {
                style: S.input, value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : '',
                title: selectedModel?.label || t('跟随 Host 默认', 'Host default'),
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
            h(Field, { label: t('Agent 预设', 'Agent preset'), hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
              h('select', { style: S.input, value: draft.preset, onChange: (event) => set({ preset: event.target.value }) },
                h('option', { value: '' }, t('跟随 Host 默认预设', 'Host default preset')),
                presets.map((item) => h('option', { key: item.id, value: item.id }, item.name ?? item.id))))),

          h(Panel, { title: t('私聊', 'Private chat') },
            h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
              h('select', { style: S.input, value: draft.busyMode.direct, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
                h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                h('option', { value: 'steer' }, t('插入为补充指令', 'Steer')))),
            scopeEditor('direct', t('私聊上下文注入', 'Private-chat context'))),

          h(Panel, { title: t('群聊', 'Group chat') },
            h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
              h('select', { style: S.input, value: draft.busyMode.group, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
                h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                h('option', { value: 'steer' }, t('插入为补充指令', 'Steer')))),
            h(Field, { label: t('响应其它机器人的消息', 'Reply to other bots'), hint: t('开启后，其它机器人（应用）在群里的发言也会触发本机器人。', 'When on, messages from other bots also trigger this bot.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.respondBot === true,
                  onChange: (event) => set({ respondBot: event.target.checked }),
                }),
                t('允许', 'Allow'))),
            h(Field, { label: t('旁听群消息（默认开启）', 'Eavesdrop group messages (on by default)'), hint: t('只把没有 at 你的消息记为上下文，不会触发回复；图片/文件只记占位信息，模型需要时会请你 at 它重发。需要 im:message.group_msg 权限；可用「补齐权限」扫码授权。', 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.') },
              h('label', { style: S.checkLabel },
                h('input', {
                  type: 'checkbox',
                  checked: draft.eavesdrop.enabled,
                  onChange: (event) => set({ eavesdrop: { ...draft.eavesdrop, enabled: event.target.checked } }),
                }),
                t('允许', 'Allow'))),
            draft.eavesdrop.enabled
              ? h(Field, { label: t('滚动保留条数', 'Rolling buffer size'), hint: t('默认保留最近 20 条；超过后丢弃最旧的旁听消息，最多 500 条。', 'Keeps the latest 20 messages by default; older messages are dropped past this limit, up to 500.') },
                h('input', {
                  type: 'number', min: 1, max: 500, style: S.input, value: draft.eavesdrop.limit,
                  onChange: (event) => set({
                    eavesdrop: {
                      ...draft.eavesdrop,
                      limit: Math.min(500, Math.max(1, Number.parseInt(event.target.value, 10) || 20)),
                    },
                  }),
                }))
              : null,
            h(Field, { label: t('允许机器人 at 人（默认开启）', 'Let the bot mention people (on by default)'), hint: t('涉及需要某人决策、批准、确认或选择时，一律用 at 提及当事人；纯信息同步、状态汇报和闲聊不要 at；不确定具体当事人时也不要 at。插件会校验 open_id，非法或未开启时擦除。', 'When someone must decide, approve, confirm, or choose, always mention that person; do not mention for plain information sync, status updates, or chat, and do not guess when the person is unclear. The plugin validates open_ids and erases invalid or disabled mentions.') },
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
                h('textarea', { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }, 600), onBlur: () => void autoSave.flush() }))
              : null,
            h(Field, { label: t('管理白名单 Open ID（可执行 /new、停止、调整与审批）', 'Manager allowlist (may run /new, stop, adjust and approve)'), hint: t('留空表示没有人可以在群里执行管理操作。', 'Empty means nobody may manage in groups.') },
              h('textarea', { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }, 600), onBlur: () => void autoSave.flush() })),
            scopeEditor('group', t('群聊上下文注入', 'Group-chat context'))),

          h(Panel, { title: t('移除', 'Remove'), danger: true },
            h('div', { style: { display: 'flex', justifyContent: 'flex-start' } },
              h('button', {
                type: 'button', className: 'bxf-danger', style: S.dangerBtn, disabled: busy === 'remove',
                onClick: () => {
                  if (!window.confirm(t(`移除「${title}」？本机将删除该机器人的配置与密钥，不影响飞书应用本身。`, `Remove ${title}? Local config and secret are deleted; the Feishu app stays.`))) return;
                  void run('remove', async () => { await autoSave.flush(); await rpc(connection, API.botRemove, { botId: bot.id }); });
                },
              }, t('移除此机器人', 'Remove this bot')))))
        : null);
    }

