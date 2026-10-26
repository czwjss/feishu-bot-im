/**
 * Card 2.0 builders. Buttons carry `{ action: "..." }` values that come back
 * through `card.action.trigger`; the bridge resolves them by pending id.
 */
import { formatCompactTokens, formatTokens } from './format.js';

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
  usageTitle = null, usageBody = '', expanded = false,
} = {}) {
  const elements = [{ tag: 'markdown', content: typeof text === 'string' && text ? text : ' ' }];
  if (panelTitle) {
    elements.push({ tag: 'hr' });
    elements.push({
      tag: 'collapsible_panel',
      expanded,
      border: { color: 'grey', corner_radius: '8px' },
      header: { title: { tag: 'markdown', content: panelTitle } },
      elements: [{ tag: 'markdown', content: panelBody || '（没有工具调用）' }],
    });
  }
  if (usageTitle) {
    elements.push({ tag: 'hr' });
    elements.push({
      tag: 'collapsible_panel',
      expanded,
      border: { color: 'grey', corner_radius: '8px' },
      header: { title: { tag: 'markdown', content: usageTitle } },
      elements: [{ tag: 'markdown', content: usageBody || '（没有用量数据）' }],
    });
  }
  if (note) elements.push({ tag: 'markdown', content: `*${note}*` });
  return { schema: '2.0', body: { elements } };
}

/** Live panel whose body is separately addressable for CardKit updates. */
function streamPanel(elementId, title) {
  return {
    tag: 'collapsible_panel',
    expanded: true,
    border: { color: 'grey', corner_radius: '8px' },
    header: { title: { tag: 'markdown', content: `**${title}**` } },
    elements: [{
      tag: 'markdown',
      element_id: elementId,
      content: '（等待中…）',
    }],
  };
}

/** CardKit card for live text plus optional live tool/token panels. */
export function streamCard(text, { showTools = false, showStats = false } = {}) {
  const elements = [{
    tag: 'markdown',
    element_id: 'answer',
    content: typeof text === 'string' && text ? text : ' ',
  }];
  if (showTools) elements.push({ tag: 'hr' }, streamPanel('tools', '工具调用'));
  if (showStats) elements.push({ tag: 'hr' }, streamPanel('usage', 'Token 用量'));
  return {
    schema: '2.0',
    config: {
      streaming_mode: true,
      summary: { content: '正在生成…' },
      streaming_config: {
        print_frequency_ms: { default: 30 },
        print_step: { default: 1 },
        print_strategy: 'fast',
      },
    },
    body: { elements },
  };
}

/** Add the final config/title to an already-built card before a full CardKit update. */
export function finalCard(card, text) {
  return {
    ...card,
    config: {
      ...(card?.config ?? {}),
      streaming_mode: false,
      summary: { content: String(text ?? '').replace(/<[^>]+>/g, '').slice(0, 80) },
    },
  };
}

export function resolvedApprovalText(outcome) {
  if (outcome === 'allowed-once') return '✅ 已批准一次。';
  if (outcome === 'rejected') return '🚫 已拒绝。';
  return '⚠️ 审批已失效。';
}

/** One `属性 / 值` line: label left, value right-aligned. */
function statLine(label, value) {
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [
      { tag: 'column', width: '100px', vertical_align: 'center', elements: [{ tag: 'markdown', content: label }] },
      { tag: 'column', width: 'weighted', weight: 1, vertical_align: 'center', elements: [{ tag: 'markdown', content: value }] },
    ],
  };
}

/** Bordered subsection; its header carries the section title plus the summary value. */
function section(title, rows) {
  return {
    tag: 'collapsible_panel',
    expanded: true,
    border: { color: 'grey', corner_radius: '8px' },
    header: { title: { tag: 'markdown', content: `**${title}**` } },
    elements: rows,
  };
}

/** Menu statistics: token usage and context breakdown, or nothing when absent. */
function usageSections(stats) {
  const elements = [];
  const usage = stats?.tokenUsage;
  if (usage) {
    const total = (usage.uncachedInputTokens ?? 0) + (usage.cacheReadTokens ?? 0)
      + (usage.cacheWriteTokens ?? 0) + (usage.outputTokens ?? 0);
    const prompt = (usage.uncachedInputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
    const hit = prompt > 0 ? Math.round(((usage.cacheReadTokens ?? 0) / prompt) * 100) : null;
    const rows = [
      statLine('未缓存输入', formatTokens(usage.uncachedInputTokens)),
      statLine('缓存读取', formatTokens(usage.cacheReadTokens)),
      statLine('输出', formatTokens(usage.outputTokens)),
    ];
    if (hit !== null) rows.push(statLine('缓存命中', `${hit}%`));
    elements.push(section(`🪙 Token 用量　总计 ${formatTokens(total)}`, rows));
  }

  const pressure = stats?.contextPressure;
  const breakdown = stats?.contextBreakdown;
  const windowSize = Number(pressure?.contextWindow ?? 0);
  const used = Number(pressure?.projectedTokens ?? pressure?.pressureTokens ?? 0);
  if (windowSize > 0 && used > 0) {
    const percent = Math.min(100, Math.round((used / windowSize) * 100));
    const rows = [];
    if (breakdown) {
      rows.push(statLine('系统提示词', `~${formatCompactTokens(breakdown.systemTokens)}`));
      rows.push(statLine('工具定义', `~${formatCompactTokens(breakdown.toolsTokens)}`));
      rows.push(statLine('对话消息', `~${formatCompactTokens(breakdown.messageTokens)}`));
    }
    if (rows.length === 0) rows.push({ tag: 'markdown', content: '暂无明细' });
    elements.push(section(
      `📊 会话上下文　已用 ${percent}% · ${formatCompactTokens(used)} / ${formatCompactTokens(windowSize)}`,
      rows,
    ));
  }
  return elements;
}

/** Menu card: session and workspace dropdowns plus usage stats and actions. */
export function menuCard({
  sessionId, sessions = [], currentWorkspace = null, workspaces = [],
  models = [], efforts = [], sessionWorkspace = null, stats = null, statsEnabled = false, toolsEnabled = false,
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
  // The usage panel stays visible; these switches only control per-reply panels.
  elements.push(row('Token 统计', button(statsEnabled ? '已开启' : '已关闭', 'stats_toggle', statsEnabled ? 'primary' : 'default')));
  elements.push(row('工具调用', button(toolsEnabled ? '已开启' : '已关闭', 'tools_toggle', toolsEnabled ? 'primary' : 'default')));
  elements.push(...usageSections(stats));

  // 一行四个固定宽度按钮
  const fixedButton = (label, action, type) => ({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    horizontal_align: 'center',
    elements: [{ ...button(label, action, type), width: '100px' }],
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
  return card('新建会话', 'blue', elements);
}



/** Result card for a set of applied menu changes. */
export function adjustCard({ items = [] }) {
  const lines = items.map((item) => `**${item.title}**\n${item.detail}`);
  return card('已调整', 'blue', [{ tag: 'markdown', content: lines.join('\n\n') || '（没有变更）' }]);
}


