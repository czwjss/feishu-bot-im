import React from 'react';

import {
  API, BOT_COLORS, Boundary, CE_FIELDS, CE_LABELS, COLOR_NAMES, S,
  Field, FieldLabel, Panel, StatusBadge, emptyEnhancement, emptyScope,
  rpc, t, text,
} from './shared.js';
import { UserIdentityButton } from './identity.js';

const h = React.createElement;

    // ── 3a. 添加机器人弹层（手动 / 扫码） ────────────────────────────────────────────────────
    export function AddBotModal({ connection, mode = 'manual', grant = null, onClose, onAdded }) {
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
    export function AliasModal({ connection, bot, onClose, onSaved }) {
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
    export function DetailsModal({ bot, onClose, onGrant }) {
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
    export function BotCard({ connection, bot, models, presets, workspaces, permissionOptions, onChanged }) {
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
          respondBot: value.respondBot, eavesdrop: value.eavesdrop,
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
              }, t('详情', 'Details')),
              h(UserIdentityButton, { connection, bot }))))),
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

