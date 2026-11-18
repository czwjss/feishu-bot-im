import React from 'react';
import { API, S, SaveStatus, rpc, t } from './shared.js';
import { useAutoSave, useDraft, useMutation } from './hooks.js';

const h = React.createElement;

/** Global reply settings share the monitor snapshot with the conversation page. */
export function AvatarReplySettings({ connection, botId, query, registerSave }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = query;
  const call = (method, payload = {}) => rpc(connection, method, { ...payload, botId });
  const { busy, error: actionError, run } = useMutation();
  const [optionsError, setOptionsError] = React.useState(null);
  const [optionsRetry, setOptionsRetry] = React.useState(0);
  const error = actionError || loadError || optionsError;
  const autoSave = useAutoSave();
  React.useEffect(() => registerSave(`avatar-reply:${botId}`, autoSave.flush), [registerSave, botId, autoSave.flush]);
  const [handoffText, setHandoffText, commitHandoff] = useDraft((monitor?.handoffKeywords ?? []).join('，'));
  const [replyRules, setReplyRules, commitReplyRules] = useDraft(monitor?.replyRules ?? '');
  const [workerOptions, setWorkerOptions] = React.useState({ workspaces: [], presets: [], defaultWorkspaceId: null });

  React.useEffect(() => {
    let alive = true;
    setOptionsError(null);
    void call(API.userMonitorWorkerOptions, {}).then((value) => {
      if (!alive) return;
      setWorkerOptions({
        workspaces: Array.isArray(value?.workspaces) ? value.workspaces : [],
        presets: Array.isArray(value?.presets) ? value.presets : [],
        defaultWorkspaceId: typeof value?.defaultWorkspaceId === 'string' ? value.defaultWorkspaceId : null,
      });
    }).catch((failure) => { if (alive) setOptionsError(failure.message); });
    return () => { alive = false; };
  }, [connection, botId, optionsRetry]);
  const setWorker = (patch) => run('worker', () => { invalidate(); return call(API.userMonitorWorkerSet, patch); }, setMonitor);
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    autoSave.schedule(key, () => {
      invalidate();
      return call(method, payload);
    }, delay, (value) => { setMonitor(value); onSaved?.(value); });
  };
  const updateHandoff = (text) => {
    setHandoffText(text);
    const keywords = text.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    scheduleSetting('handoff', API.userMonitorHandoffSet, { keywords }, 600,
      (value) => commitHandoff((value.handoffKeywords ?? keywords).join('，'), text));
  };
  const updateReplyRules = (text, delay = 600) => {
    setReplyRules(text);
    scheduleSetting('reply-rules', API.userMonitorReplyRulesSet, { rules: text }, delay,
      (value) => commitReplyRules(value.replyRules, text));
  };
  const defaultWorkspaceId = workerOptions.defaultWorkspaceId ?? null;
  const workspaces = [...workerOptions.workspaces].sort((left, right) => {
    if (left.id === defaultWorkspaceId) return -1;
    if (right.id === defaultWorkspaceId) return 1;
    return 0;
  });

  const control = { ...S.input, height: '36px' };
  const field = (label, props, options) => h('label', { className: 'bxf-identity-field' },
    h('span', null, label), h('select', { 'aria-label': label, ...props, style: control, className: 'bxf-identity-control' }, options));

  const settings = monitor ? h('div', { className: 'bxf-identity-settings bxf-reply-settings-grid' },
    h('div', { className: 'bxf-reply-options' },
      h('div', { className: 'bxf-identity-setting' },
        h('label', { className: 'bxf-identity-field' },
          h('strong', { className: 'bxf-identity-setting-title' }, t('转人工关键词', 'Handoff keywords')),
          h('input', { ...autoSave.compositionHandlers, style: control, className: 'bxf-identity-control', value: handoffText,
            placeholder: t('转人工，人工客服', 'human, agent'), onChange: (event) => updateHandoff(event.target.value),
            onBlur: () => void autoSave.flush(),
            onKeyDown: (event) => { if (event.key === 'Enter' && !event.nativeEvent?.isComposing) void autoSave.flush(); },
          })),
        h('p', { className: 'bxf-identity-hint' }, t('用逗号分隔。命中时跳过当前回复，交由人工处理。', 'Separate with commas. Matching messages are left for a person.'))),
      h('div', { className: 'bxf-identity-setting' },
        h('p', { className: 'bxf-identity-setting-title' }, t('处理会话', 'Reply session')),
        h('div', { className: 'bxf-identity-worker' },
          field(t('分组', 'Group'), {
            value: monitor.worker?.workspaceId || defaultWorkspaceId || '', disabled: busy === 'worker',
            title: workspaces.find((item) => item.id === (monitor.worker?.workspaceId || defaultWorkspaceId))?.path || '',
            onChange: (event) => void setWorker({ workspaceId: event.target.value, workspacePath: '' }),
          }, workspaces.map((item) => h('option', { key: item.id, value: item.id, title: item.path || '' },
            `${item.title || item.path?.split('/').filter(Boolean).at(-1) || item.id}${item.id === defaultWorkspaceId ? t('（默认）', ' (default)') : ''}`))),
          field(t('预设', 'Preset'), { value: monitor.worker?.preset || '', disabled: busy === 'worker', onChange: (event) => void setWorker({ preset: event.target.value }) }, [
            h('option', { key: '', value: '' }, t('默认', 'Default')),
            ...workerOptions.presets.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id)),
          ])),
        h('p', { className: 'bxf-identity-hint' }, t('更改后，将在下次自动回复时创建新会话。', 'Changes create a new session on the next automatic reply.')))),
    h('div', { className: 'bxf-identity-setting bxf-reply-rules-setting' },
      h('div', { className: 'bxf-identity-section-head' },
        h('h3', { className: 'bxf-identity-setting-title' }, t('分身回复规则', 'Avatar reply rules')),
        h('button', { type: 'button', className: 'bxf-mini',
          onClick: () => updateReplyRules(monitor.defaultReplyRules ?? '', 0),
        }, t('恢复默认模板', 'Restore default template'))),
      h('textarea', { ...autoSave.compositionHandlers, style: { ...S.area, minHeight: '280px', padding: '12px 14px', fontSize: '13px' }, className: 'bxf-identity-rules', rows: 12,
        'aria-label': t('分身回复规则', 'Avatar reply rules'), value: replyRules,
        onChange: (event) => updateReplyRules(event.target.value), spellCheck: false,
        onBlur: () => void autoSave.flush(),
      }))) : null;

  return h(React.Fragment, null,
    error && h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
      (loadError || optionsError) && h('button', { type: 'button', className: 'bxf-mini', onClick: () => {
        if (loadError) void load();
        if (optionsError) setOptionsRetry((value) => value + 1);
      } }, t('重试', 'Retry'))),
    !monitor && !loadError && h('p', { className: 'bxf-work-meta', role: 'status' }, t('正在读取…', 'Loading…')),
    settings,
    h(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry }));
}
