import React from 'react';

import {
  API, Boundary, CE_FIELDS, CE_LABELS, S,
  Field, FieldLabel, SaveStatus, StatusBadge, emptyEnhancement, emptyScope,
  rpc, t, text,
} from './shared.js';
import { useAutoSave, useMutation, usePolling, useRpcQuery } from './hooks.js';
import { botSettingUpdates } from './bot-settings.js';
import { remainingSeconds } from './async.js';
import { ActionButton } from './action-button.js';

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
        if (busy === 'submit') return;
        invalidate();
        setScan(null);
        if (mode === 'scan') void rpc(connection, API.provisionCancel, {}).catch(() => undefined);
        onClose();
      };
      const dialogRef = React.useRef(null);
      const backdropDownRef = React.useRef(false);
      React.useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || typeof dialog.showModal !== 'function') return;
        if (!dialog.open) dialog.showModal();
        return () => { if (dialog.open) dialog.close(); };
      }, []);
      const started = React.useRef(false);
      React.useEffect(() => {
        if (mode === 'scan' && !started.current) { started.current = true; void startScan(); }
      }, [mode]);
      const submit = () => run('submit', () => rpc(connection, API.botAdd, form), () => {
        onAdded(); onClose();
      });

      const titleId = `bxf-add-bot-title-${mode}`;
      return h('dialog', {
        ref: dialogRef,
        className: 'bxf-modal-dialog',
        'aria-labelledby': titleId,
        onCancel: (event) => { event.preventDefault(); cancelScan(); },
        onPointerDown: (event) => { backdropDownRef.current = event.target === event.currentTarget; },
        onClick: (event) => {
          const fromBackdrop = backdropDownRef.current;
          backdropDownRef.current = false;
          if (event.target === event.currentTarget && fromBackdrop) cancelScan();
        },
      },
        h('form', {
          style: S.modal,
          onSubmit: (event) => {
            event.preventDefault();
            if (mode === 'manual' && !busy && form.appId && form.appSecret) void submit();
          },
        },
          h('h3', { id: titleId, style: { margin: '0 0 4px', fontSize: '15px' } },
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
                }, h('img', { src: scan.qrCodeDataUrl, width: 200, height: 200, alt: t('飞书授权二维码', 'Feishu authorization QR code') }))
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
                h('button', { type: 'button', style: S.btn(), onClick: cancelScan }, t('取消扫码', 'Cancel scan')),
                pollError && scan && !terminal
                  ? h('button', { type: 'button', style: S.btn(), disabled: Boolean(busy), onClick: () => void poll() }, t('继续检查', 'Resume check'))
                  : null,
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
              ? h('button', { type: 'submit', style: S.btn('primary'), disabled: busy || !form.appId || !form.appSecret },
                busy ? t('正在验证…', 'Verifying…') : t('绑定并连接', 'Bind and connect'))
              : null)));
    }

    // ── 机器人设置 ──────────────────────────────────────────────────────────
    export function BotSettings({ connection, bot, models = [], presets = [], workspaces = [], permissionOptions = [], onChanged, registerSave }) {
      const [settingsTab, setSettingsTab] = React.useState('general');
      const [draft, setDraft] = React.useState(null);
      const [limitText, setLimitText] = React.useState('20');
      const draftRef = React.useRef(null);
      const baselineRef = React.useRef(null);
      const autoSave = useAutoSave();
      React.useEffect(() => registerSave?.(`bot:${bot.id}`, autoSave.flush), [registerSave, bot.id, autoSave.flush]);

      const seed = React.useCallback((source = bot) => {
        const enhancement = source.contextEnhancement ?? emptyEnhancement();
        return {
          workspace: source.workspace ?? '',
          workspaceMode: source.workspace ?? '',
          workspaceCustom: source.workspace ?? '',
          provider: source.model?.provider ?? '',
          model: source.model?.model ?? '',
          reasoningEffort: source.model?.reasoningEffort ?? '',
          preset: source.agentPreset ?? '',
          busyMode: {
            direct: source.busyMode?.direct ?? 'queue',
            group: source.busyMode?.group ?? 'queue',
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

      const seedRef = React.useRef(seed);
      seedRef.current = seed;
      React.useEffect(() => {
        const initial = seedRef.current();
        draftRef.current = initial;
        baselineRef.current = initial;
        setDraft(initial);
        setLimitText(String(initial.eavesdrop.limit));
        setSettingsTab('general');
      }, [bot.id]);

      // 15s 轮询更新时仅同步用户未修改过的字段，保留正在编辑或未保存的脏草稿。
      React.useEffect(() => {
        const current = draftRef.current;
        const prevBase = baselineRef.current;
        if (!current || !prevBase) return;
        const nextBase = seed(bot);
        baselineRef.current = nextBase;
        const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        let changed = false;
        const merged = { ...current };
        for (const key of Object.keys(nextBase)) {
          if (sameJson(current[key], prevBase[key]) && !sameJson(nextBase[key], prevBase[key])) {
            merged[key] = nextBase[key];
            changed = true;
          }
        }
        if (changed) {
          draftRef.current = merged;
          setDraft(merged);
          if (sameJson(current.eavesdrop, prevBase.eavesdrop) && merged.eavesdrop.limit !== prevBase.eavesdrop.limit) {
            setLimitText(String(merged.eavesdrop.limit));
          }
        }
      }, [bot, seed]);
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
      const sections = [['general', t('通用', 'General')], ['direct', t('私聊', 'Private chat')], ['group', t('群聊', 'Group chat')]];
      const selectSettings = (id) => { setSettingsTab(id); void autoSave.flush(); };
      const sectionId = (id) => `bxf-${bot.id}-settings-${id}`;
      const onTabKey = (event, index) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % sections.length
            : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : null;
        if (next === null) return;
        event.preventDefault();
        selectSettings(sections[next][0]);
        event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
      };
      const pane = (id, ...children) => h('div', {
        id: sectionId(id), role: 'tabpanel', 'aria-labelledby': `${sectionId(id)}-tab`,
        hidden: settingsTab !== id, className: `bxf-settings-pane bxf-settings-pane-${id}`, tabIndex: 0,
      }, children);
      const group = (label, ...children) => h('section', { className: 'bxf-settings-group', 'aria-label': label },
        h('h4', null, label), h('div', { className: 'bxf-settings-fields' }, children));

      const scopeEditor = (scopeKey, label) => {
        const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
        const update = (patch, delay = 0) => set((current) => ({
          ...current,
          contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...current.contextEnhancement[scopeKey], ...patch } },
        }), delay);
        const fields = scopeKey === 'group' ? CE_FIELDS : CE_FIELDS.filter((field) => field !== 'conversationTitle');
        return h('section', { className: 'bxf-settings-context', 'aria-label': label },
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
            style: { ...S.area, minHeight: '120px', marginTop: '12px' },
            'aria-label': label,
            value: scope.guidance ?? '',
            placeholder: t('增强提示词（可选）', 'Guidance (optional)'),
            onChange: (event) => update({ guidance: event.target.value }, 600),
            onBlur: () => void autoSave.flush(),
          }));
      };

      return h('article', { className: 'bxf-bot-configuration' },
        draft ? h('div', { ...autoSave.compositionHandlers, className: 'bxf-bot-settings' },
          h('div', { className: 'bxf-settings-toolbar' },
            h('div', { className: 'bxf-settings-tabs', role: 'tablist', 'aria-label': t('机器人设置', 'Bot settings') },
              sections.map(([id, label], index) => h('button', {
                key: id, type: 'button', role: 'tab', id: `${sectionId(id)}-tab`, 'aria-controls': sectionId(id),
                'aria-selected': settingsTab === id, tabIndex: settingsTab === id ? 0 : -1,
                onClick: () => selectSettings(id), onKeyDown: (event) => onTabKey(event, index),
              }, label))),
            h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry, onDiscard: autoSave.discard })),
          pane('general',
            group(t('会话默认', 'Session defaults'),
              h(Field, { label: t('默认工作区', 'Default workspace'), hint: t('列表来自 DSH 已登记的工作区。', 'From the workspaces DSH already knows.') },
                (() => {
                  const knownWorkspace = workspaces.some((item) => item.path === draft.workspaceMode);
                  const effectiveWorkspaceMode = draft.workspaceMode === ''
                    ? ''
                    : (draft.workspaceMode === '__custom__' || !knownWorkspace ? '__custom__' : draft.workspaceMode);
                  return h(React.Fragment, null,
                    h('select', {
                      style: S.input, value: effectiveWorkspaceMode,
                      title: draft.workspace || t('跟随 DSH 默认', 'Host default'),
                      onChange: (event) => {
                        const next = event.target.value;
                        set((current) => ({ ...current, workspaceMode: next, workspace: next === '__custom__' ? current.workspaceCustom : next }));
                      },
                    },
                    h('option', { value: '' }, t('跟随 DSH 默认', 'Host default')),
                    workspaces.map((item) => h('option', { key: item.path, value: item.path }, item.title && item.title !== item.path ? `${item.title} — ${item.path}` : item.path)),
                    h('option', { value: '__custom__' }, t('自定义路径…', 'Custom path…'))),
                    effectiveWorkspaceMode === '__custom__'
                      ? h('input', {
                        style: { ...S.input, marginTop: '8px' }, value: draft.workspaceCustom, placeholder: '/Users/you/work',
                        'aria-label': t('自定义路径…', 'Custom path…'),
                        onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value }, 600),
                        onBlur: () => void autoSave.flush(),
                      })
                      : null);
                })()),
              h(Field, { label: t('Agent 预设', 'Agent preset'), hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
                h('select', { style: S.input, value: draft.preset, onChange: (event) => set({ preset: event.target.value }) },
                  h('option', { value: '' }, t('跟随 Host 默认预设', 'Host default preset')),
                  draft.preset && !presets.some((item) => item.id === draft.preset)
                    ? h('option', { value: draft.preset }, `${draft.preset}${t('（当前）', ' (current)')}`)
                    : null,
                  presets.map((item) => h('option', { key: item.id, value: item.id }, item.name ?? item.id)))),
              h(Field, { label: t('新会话权限档位', 'New-session permission'), hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
                h('select', {
                  style: S.input, value: draft.permissionPreset,
                  onChange: (event) => set({ permissionPreset: event.target.value }),
                },
                  h('option', { value: '' }, t('跟随 Host 默认', 'Host default')),
                  draft.permissionPreset && !(permissionOptions ?? []).some((item) => item.value === draft.permissionPreset)
                    ? h('option', { value: draft.permissionPreset }, `${draft.permissionPreset}${t('（当前）', ' (current)')}`)
                    : null,
                  (permissionOptions ?? []).map((item) => h('option', { key: item.value, value: item.value }, item.name ?? item.value))))),
            group(t('模型与输出', 'Model and output'),
              h(Field, { label: t('默认模型', 'Model'), hint: t('只影响之后新建的会话，已有会话不变。', 'Applies only to Sessions created later.') },
                h('select', {
                  style: S.input, value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : '',
                  title: selectedModel?.label || t('跟随 Host 默认', 'Host default'),
                  onChange: (event) => {
                    const [provider, ...rest] = event.target.value.split('/');
                    set({ provider, model: rest.join('/'), reasoningEffort: '' });
                  },
                },
                h('option', { value: '' }, t('跟随 Host 默认', 'Host default')),
                draft.provider && draft.model && !selectedModel
                  ? h('option', { value: `${draft.provider}/${draft.model}` }, `${draft.provider} / ${draft.model}${t('（当前）', ' (current)')}`)
                  : null,
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
                  h('option', { value: 'brief' }, t('简要', 'Brief')))))),

          pane('direct',
            group(t('消息处理', 'Message handling'),
              h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
                h('select', { 'aria-label': t('私聊消息处理', 'Private-chat message handling'), style: S.input, value: draft.busyMode.direct, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
                  h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                  h('option', { value: 'steer' }, t('插入为补充指令', 'Steer'))))),
            scopeEditor('direct', t('私聊上下文注入', 'Private-chat context'))),

          pane('group',
            group(t('消息处理', 'Message handling'),
              h(Field, { label: t('运行中收到普通消息', 'While a turn runs') },
                h('select', { 'aria-label': t('群聊消息处理', 'Group-chat message handling'), style: S.input, value: draft.busyMode.group, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
                  h('option', { value: 'queue' }, t('排队等待', 'Queue')),
                  h('option', { value: 'steer' }, t('插入为补充指令', 'Steer')))),
              h(Field, { className: 'bxf-setting-toggle', label: t('响应其它机器人的消息', 'Reply to other bots'), hint: t('开启后，其它机器人（应用）在群里的发言也会触发本机器人。', 'When on, messages from other bots also trigger this bot.') },
                h('label', { style: S.checkLabel },
                  h('input', {
                    type: 'checkbox',
                    checked: draft.respondBot === true,
                    onChange: (event) => set({ respondBot: event.target.checked }),
                  }),
                  t('允许', 'Allow'))),
              h(Field, { className: 'bxf-setting-toggle', label: t('旁听群消息（默认开启）', 'Eavesdrop group messages (on by default)'), hint: t('只把没有 at 你的消息记为上下文，不会触发回复；图片/文件只记占位信息，模型需要时会请你 at 它重发。需要 im:message.group_msg 权限；可用「补齐权限」扫码授权。', 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.') },
                h('label', { style: S.checkLabel },
                  h('input', {
                    type: 'checkbox',
                    checked: draft.eavesdrop.enabled,
                    onChange: (event) => set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, enabled: event.target.checked } })),
                  }),
                  t('允许', 'Allow'))),
              draft.eavesdrop.enabled
                ? h(Field, { label: t('滚动保留条数', 'Rolling buffer size'), hint: t('默认保留最近 20 条；超过后丢弃最旧的旁听消息，最多 500 条。', 'Keeps the latest 20 messages by default; older messages are dropped past this limit, up to 500.') },
                  h('input', {
                    type: 'number', min: 1, max: 500, style: S.input, value: limitText,
                    onChange: (event) => {
                      const raw = event.target.value;
                      setLimitText(raw);
                      const parsed = Number.parseInt(raw, 10);
                      if (Number.isFinite(parsed) && parsed >= 1) {
                        const clamped = Math.min(500, parsed);
                        set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, limit: clamped } }), 600);
                      }
                    },
                    onBlur: () => {
                      const parsed = Number.parseInt(limitText, 10);
                      const clamped = Number.isFinite(parsed) && parsed >= 1 ? Math.min(500, parsed) : 20;
                      setLimitText(String(clamped));
                      set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, limit: clamped } }));
                      void autoSave.flush();
                    },
                  }))
                : null,
              h(Field, { className: 'bxf-setting-toggle', label: t('允许机器人 at 人（默认开启）', 'Let the bot mention people (on by default)'), hint: t('涉及需要某人决策、批准、确认或选择时，一律用 at 提及当事人；纯信息同步、状态汇报和闲聊不要 at；不确定具体当事人时也不要 at。插件会校验 open_id，非法或未开启时擦除。', 'When someone must decide, approve, confirm, or choose, always mention that person; do not mention for plain information sync, status updates, or chat, and do not guess when the person is unclear. The plugin validates open_ids and erases invalid or disabled mentions.') },
                h('label', { style: S.checkLabel },
                  h('input', {
                    type: 'checkbox',
                    checked: draft.mentions.enabled,
                    onChange: (event) => set((current) => ({ ...current, mentions: { ...current.mentions, enabled: event.target.checked } })),
                  }),
                  t('允许', 'Allow'))),
              draft.mentions.enabled
                ? h(Field, { className: 'bxf-setting-toggle', label: t('禁止 @所有人（默认开启）', 'Forbid @all (on by default)'), hint: t('关闭后模型可以 @所有人；插件仍会校验 open_id。', 'When off, the model may mention everyone; open_ids are still validated.') },
                  h('label', { style: S.checkLabel },
                    h('input', {
                      type: 'checkbox',
                      checked: draft.mentions.allowAll !== true,
                      onChange: (event) => set((current) => ({ ...current, mentions: { ...current.mentions, allowAll: !event.target.checked } })),
                    }),
                    t('禁止', 'Forbid')))
                : null),
            group(t('访问权限', 'Access control'),
              h(Field, { label: t('谁能使用群聊中的机器人', 'Who may use the bot in groups') },
                h('select', { style: S.input, value: draft.group, onChange: (event) => set({ group: event.target.value }) },
                  h('option', { value: 'all' }, t('所有用户', 'Everyone')),
                  h('option', { value: 'allowlist' }, t('仅白名单', 'Allowlist')))),
              draft.group === 'allowlist'
                ? h(Field, { label: t('群聊白名单 Open ID', 'Group allowlist Open IDs') },
                  h('textarea', { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }, 600), onBlur: () => void autoSave.flush() }))
                : null,
              h(Field, { label: t('管理白名单 Open ID（可执行 /new、停止、调整与审批）', 'Manager allowlist (may run /new, stop, adjust and approve)'), hint: t('留空表示没有人可以在群里执行管理操作。', 'Empty means nobody may manage in groups.') },
                h('textarea', { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }, 600), onBlur: () => void autoSave.flush() }))),
            scopeEditor('group', t('群聊上下文注入', 'Group-chat context'))))
        : null);
    }


/** Keep routine refresh separate from connection recovery. */
export function BotHeader({ connection, bot, onChanged, onRefresh, refreshing = false, actions, extraActions, active = true }) {
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const { busy, error, run } = useMutation();
  const connecting = ['connecting', 'reconnecting'].includes(bot.state);
  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const reconnect = () => {
    return run('reconnect', () => {
      setNotice(null);
      return rpc(connection, API.botReconnect, { botId: bot.id });
    }, async (result) => {
      setNotice(result.bots?.find((item) => item.id === bot.id)?.state === 'connected'
        ? t('连接已恢复', 'Connection restored') : t('连接尚未就绪，请查看状态', 'Connection is not ready. Check its status.'));
      await onChanged();
    });
  };
  const reconnectButton = h(ActionButton, { active, hintId: `bxf-${bot.id}-reconnect-tip`,
    hint: t('断开并重新建立当前机器人的长连接，用于恢复连接异常。', 'Disconnect and re-establish this bot’s connection to recover connectivity.'), disabled: Boolean(busy) || connecting,
    onClick: () => void reconnect() }, busy === 'reconnect' || connecting ? t('重连中…', 'Reconnecting…') : t('重连', 'Reconnect'));
  const title = bot.alias || bot.botName || bot.id;
  return h('header', { className: 'bxf-status-summary' },
    h('div', { className: 'bxf-work-heading' },
      h('div', { style: S.grow },
        h('div', { style: S.nameRow },
          h('h2', null, title),
          h(StatusBadge, { state: bot.state }))),
      h('div', { className: 'bxf-bot-actions' },
        actions,
        onRefresh && h(ActionButton, { active, hintId: `bxf-${bot.id}-refresh-tip`, disabled: refreshing || Boolean(busy),
          hint: t('更新当前机器人的会话目录与运行状态，不重连，也不拉取分身新消息。', 'Refresh this bot’s chats and runtime status without reconnecting or polling avatar messages.'),
          'aria-label': t('刷新会话与状态', 'Refresh chats and status'), 'aria-busy': refreshing,
          onClick: () => void onRefresh() }, refreshing ? t('刷新中…', 'Refreshing…') : t('刷新', 'Refresh')),
        reconnectButton,
        h(ActionButton, { active, hintId: `bxf-${bot.id}-grant-tip`, disabled: Boolean(busy),
          hint: t('打开飞书扫码授权，为当前机器人补齐所需的应用权限。', 'Open Feishu authorization to grant this bot its required app permissions.'), onClick: () => setGrantOpen(true) }, t('补齐权限', 'Grant permissions')),
        extraActions)),
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error),
    notice && h('div', { className: 'bxf-work-meta', role: 'status' }, notice),
    grantOpen && h(Boundary, null, h(AddBotModal, { connection, mode: 'scan', grant: bot, onClose: () => setGrantOpen(false), onAdded: onChanged })));
}
