/**
 * Card 2.0 builders. Buttons carry `{ action: "..." }` values that come back
 * through `card.action.trigger`; the bridge resolves them by pending id.
 */

function plain(content) {
  return { tag: 'plain_text', content };
}

function markdown(content) {
  return { tag: 'markdown', content };
}

function button(label, action, kind = 'default', extra = null) {
  return {
    tag: 'button',
    type: kind,
    text: plain(label),
    behaviors: [{ type: 'callback', value: extra ? { action, ...extra } : { action } }],
  };
}

function card(title, template, elements) {
  return {
    schema: '2.0',
    header: { title: plain(title), template },
    body: { elements },
  };
}

/** One approval request, resolvable by pressing a button or replying in text. */
export function approvalCard({ toolName, reason, approvalId, resolvedText }) {
  if (resolvedText) {
    return card('审批已处理', 'green', [markdown(resolvedText)]);
  }
  const lines = [`**工具**：${toolName || '未知工具'}`];
  if (reason) lines.push(`**原因**：${reason}`);
  return card('需要审批', 'orange', [
    markdown(lines.join('\n')),
    markdown('回复「批准」或「拒绝」也可以完成审批。'),
    {
      tag: 'column_set',
      flex_mode: 'none',
      columns: [
        { tag: 'column', width: 'auto', elements: [button('批准一次', `approve:${approvalId}`, 'primary')] },
        { tag: 'column', width: 'auto', elements: [button('拒绝', `reject:${approvalId}`, 'danger')] },
      ],
    },
  ]);
}

/** One single-select question with its options as buttons. */
export function questionCard({ question, options, questionId, resolvedText }) {
  if (resolvedText) {
    return card('已回答', 'green', [markdown(resolvedText)]);
  }
  const list = (options ?? []).slice(0, 8);
  const elements = [
    markdown(question || '请选择'),
    ...list.map((option, index) => ({
      tag: 'button',
      type: 'default',
      text: plain(`${index + 1}. ${option.label ?? option}`),
      behaviors: [{ type: 'callback', value: { action: `answer:${questionId}:${index}` } }],
    })),
  ];
  if ((options ?? []).length > 8) {
    elements.push(markdown('选项较多：直接回复选项文字也可以。'));
  }
  return card('需要你的选择', 'blue', elements);
}

/** Plain notice card used for command results and status messages. */
const NOTICE_TONES = Object.freeze({
  新会话: 'green',
  新会话已就绪: 'green',
  会话已绑定: 'green',
  工作区已切换: 'green',
  模型已切换: 'green',
  思考强度已切换: 'green',
  话题已同步: 'green',
  上下文压缩: 'green',
  已停止: 'orange',
  无权限: 'orange',
  需要管理员: 'orange',
  暂不支持: 'orange',
  无法处理: 'orange',
  无法停止: 'orange',
  话题已关闭: 'orange',
  话题: 'blue',
  话题列表: 'blue',
  话题同步: 'blue',
  发送失败: 'red',
  创建失败: 'red',
  提交失败: 'red',
  审批结果: 'green',
});

export function noticeCard(text, title = null, tone = null) {
  const card = {
    schema: '2.0',
    body: { elements: [{ tag: 'markdown', content: typeof text === 'string' && text ? text : ' ' }] },
  };
  if (title) card.header = { title: plain(title), template: tone ?? NOTICE_TONES[title] ?? 'grey' };
  return card;
}

/** Answer/progress card with a collapsible panel holding the tool calls. */
export function turnCard(text, {
  panelTitle = null, panelBody = '', note = null,
  usageTitle = null, usageBody = '',
} = {}) {
  const elements = [{ tag: 'markdown', content: typeof text === 'string' && text ? text : ' ' }];
  if (panelTitle) {
    elements.push({ tag: 'hr' });
    elements.push({
      tag: 'collapsible_panel',
      expanded: false,
      border: { color: 'grey', corner_radius: '8px' },
      header: { title: { tag: 'markdown', content: panelTitle } },
      elements: [{ tag: 'markdown', content: panelBody || '（没有工具调用）' }],
    });
  }
  if (usageTitle) {
    elements.push({ tag: 'hr' });
    elements.push({
      tag: 'collapsible_panel',
      expanded: false,
      border: { color: 'grey', corner_radius: '8px' },
      header: { title: { tag: 'markdown', content: usageTitle } },
      elements: [{ tag: 'markdown', content: usageBody || '（没有用量数据）' }],
    });
  }
  if (note) elements.push({ tag: 'markdown', content: `*${note}*` });
  return { schema: '2.0', body: { elements } };
}

export function resolvedApprovalText(outcome) {
  if (outcome === 'allowed-once') return '✅ 已批准一次。';
  if (outcome === 'rejected') return '🚫 已拒绝。';
  return '⚠️ 审批已失效。';
}

/** Menu card: session and workspace dropdowns plus the common actions. */
export function menuCard({
  sessionId, sessions = [], currentWorkspace = null, workspaces = [],
  running = false, model = null, models = [], efforts = [], presets = [], sessionWorkspace = null,
}) {
  const select = (name, action, items, placeholder) => ({
    tag: 'select_static',
    name,
    width: 'fill',
    placeholder: plain(placeholder),
    options: items.slice(0, 30).map((item) => ({
      text: plain(`${item.current ? '✓ ' : ''}${item.label}`),
      value: item.value,
    })),
    behaviors: [{ type: 'callback', value: { action } }],
  });
  // 标题与下拉同一行：左列标题 + 右列选择器
  const row = (title, control) => ({
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      {
        tag: 'column',
        width: '88px',
        vertical_align: 'center',
        elements: [{ tag: 'markdown', content: `**${title}**` }],
      },
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        vertical_align: 'center',
        elements: [control],
      },
    ],
  });

  const effectiveWorkspace = sessionWorkspace ?? currentWorkspace;
  const elements = [];
  if (sessions.length > 0) {
    elements.push(row('会话', select('session_pick', 'session_pick',
      sessions.map((item) => ({
        value: item.sessionId,
        label: item.label ?? item.sessionId,
        current: item.sessionId === sessionId,
      })),
      sessions.find((item) => item.sessionId === sessionId)?.label ?? '选择会话')));
  }
  if (workspaces.length > 0) {
    elements.push(row('工作区', select('workspace_pick', 'workspace_pick',
      workspaces.map((path) => ({ value: path, label: path, current: path === effectiveWorkspace })),
      effectiveWorkspace ?? '选择工作区')));
  }
  if (models.length > 0) {
    elements.push(row('模型', select('model_pick', 'model_pick', models,
      models.find((item) => item.current)?.label ?? '选择模型')));
  }
  if (efforts.length > 0) {
    elements.push(row('思考强度', select('reasoning_pick', 'reasoning_pick', efforts,
      efforts.find((item) => item.current)?.label ?? '选择强度')));
  }
  if (presets.length > 0) {
    const control = select('preset_pick', 'preset_pick', presets,
      presets.find((item) => item.current)?.label ?? '跟随 Host 默认');
    control.disabled = true;
    elements.push(row('预设', control));
  }
  // 三等分栅格，每格内放一个固定宽度的按钮（约五个汉字）
  const fixedButton = (label, action, type) => ({
    tag: 'column',
    width: '80px',
    horizontal_align: 'center',
    elements: [{ ...button(label, action, type), width: 'fill' }],
  });
  elements.push({ tag: 'hr' });
  elements.push({
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      fixedButton('新会话', 'new_session', 'primary'),
      fixedButton('压缩', 'compact', 'primary'),
      fixedButton('调整', 'menu_apply', 'primary'),
      fixedButton('关闭', 'menu_close', 'danger'),
    ],
  });
  return card('功能菜单', 'turquoise', elements);
}

/** Session-creation card: everything that only applies to a brand-new Session. */
export function newSessionCard({ workspaces = [], models = [], efforts = [], presets = [], draft = {} }) {
  const select = (name, action, items, placeholder) => ({
    tag: 'select_static',
    name,
    width: 'fill',
    placeholder: plain(placeholder),
    options: items.slice(0, 30).map((item) => ({
      text: plain(`${item.current ? '✓ ' : ''}${item.label}`),
      value: item.value,
    })),
    behaviors: [{ type: 'callback', value: { action } }],
  });
  const row = (title, control) => ({
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      { tag: 'column', width: '88px', vertical_align: 'center', elements: [{ tag: 'markdown', content: `**${title}**` }] },
      { tag: 'column', width: 'weighted', weight: 1, vertical_align: 'center', elements: [control] },
    ],
  });
  const elements = [];
  if (workspaces.length > 0) {
    elements.push(row('工作区', select('ns_workspace', 'ns_workspace',
      workspaces.map((path) => ({ value: path, label: path, current: path === draft.workspace })),
      draft.workspace ?? '默认')));
  }
  elements.push(row('模型', select('ns_model', 'ns_model', models,
    models.find((item) => item.current)?.label ?? '默认')));
  if (efforts.length > 0) {
    elements.push(row('思考强度', select('ns_reasoning', 'ns_reasoning', efforts,
      efforts.find((item) => item.current)?.label ?? '模型默认')));
  }
  elements.push(row('预设', select('ns_preset', 'ns_preset', presets,
    presets.find((item) => item.current)?.label ?? '跟随 Host 默认')));
  elements.push({ tag: 'hr' });
  elements.push({
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      { tag: 'column', width: 'weighted', weight: 1, horizontal_align: 'center', elements: [button('创建', 'new_session_create', 'primary')] },
      { tag: 'column', width: 'weighted', weight: 1, horizontal_align: 'center', elements: [button('取消', 'new_session_cancel')] },
    ],
  });
  elements.push({ tag: 'markdown', content: '创建后发送任意消息，会话即按以上配置建立。' });
  return card('新建会话', 'blue', elements);
}



/** Result card for a set of applied menu changes. */
export function adjustCard({ items = [] }) {
  const lines = items.map((item) => `**${item.title}**\n${item.detail}`);
  return card('已调整', 'blue', [{ tag: 'markdown', content: lines.join('\n\n') || '（没有变更）' }]);
}


