/**
 * Turn progress rendering: tool steps, timings and the final summary line.
 *
 * Kept separate from TurnRunner so the formatting rules are unit-testable and
 * the runner only owns state transitions.
 */

/** How many tool calls the dropdown keeps (newest first). */
export const STEP_OPTION_LIMIT = 20;
/** Longest argument summary shown per step. */
export const ARG_LIMIT = 30;

/** Human duration: 0.4s / 12s / 1m05s. */
export function formatDuration(ms) {
  const value = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  if (value < 1000) return `${(value / 1000).toFixed(1)}s`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`;
}

function clip(text, limit = ARG_LIMIT) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/`/g, '´');
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1)}…`;
}

/** Pick the most meaningful parameter of one tool call and clip it. */
export function summarizeArguments(name, raw) {
  let args = null;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      args = JSON.parse(raw);
    } catch {
      args = null;
    }
  } else if (raw && typeof raw === 'object') {
    args = raw;
  }
  if (!args || typeof args !== 'object') return typeof raw === 'string' ? clip(raw) : '';
  const preferred = ['command', 'path', 'file_path', 'filePath', 'pattern', 'glob', 'query', 'name', 'description'];
  for (const key of preferred) {
    if (typeof args[key] === 'string' && args[key].trim()) return clip(args[key]);
  }
  try {
    return clip(JSON.stringify(args));
  } catch {
    return '';
  }
}

/** One step line: icon + name + `argument` (no duration, per request). */
export function formatStep(step, detail = 'detailed') {
  const icon = step.ok === false ? '❌' : step.running ? '⏳' : '✅';
  const parts = [icon, step.name];
  if (detail !== 'brief' && step.args) parts.push(`· \`${step.args}\``);
  const head = parts.join(' ');
  if (step.ok === false && step.error) {
    return `${head}\n   错误：${clip(step.error, 120)}`;
  }
  return head;
}

/**
 * Progress body while the turn runs: a status line only.
 * Timings and counts live in the tool/token panels, which refresh less often.
 */
export function buildProgressText() {
  return '⏳ 正在处理…';
}

/** Ordered list for the collapsible panel (newest 20 steps). */
export function buildStepsMarkdown(steps = [], detail = 'detailed') {
  if (steps.length === 0) return '';
  const visible = steps.slice(-STEP_OPTION_LIMIT);
  return visible.map((step, index) => {
    const number = String(steps.length - visible.length + index + 1).padStart(3, '0');
    const line = formatStep(step, detail).replace(/\n/g, '\n   ');
    return `${number}. ${line}`;
  }).join('\n');
}

/** Collapsed-panel header: the one-line stats the user sees before expanding. */
export function buildPanelTitle({ steps = [], elapsedMs = 0, thinkingMs = 0, firstTokenMs = 0, note = null }) {
  const failures = steps.filter((step) => step.ok === false).length;
  const parts = [`总耗时 ${formatDuration(elapsedMs)}`];
  if (firstTokenMs > 0) parts.push(`首字 ${formatDuration(firstTokenMs)}`);
  if (thinkingMs > 0) parts.push(`思考耗时 ${formatDuration(thinkingMs)}`);
  parts.push(`工具调用 ${steps.length}`);
  if (failures > 0) parts.push(`失败 ${failures}`);
  if (note) parts.push(note);
  return `**🤖 ${parts.join(' · ')}**`;
}


/** Token sizes: 9.5Ki / 1.2Mi. */
export function formatTokens(value) {
  const amount = Number.isFinite(value) && value > 0 ? value : 0;
  if (amount < 1024) return `${amount} tok`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)}Ki tok`;
  return `${(amount / (1024 * 1024)).toFixed(1)}Mi tok`;
}

/** Cache hit rate over input tokens; null when nothing was measured. */
export function cacheHitRate(cache, input) {
  if (!input || input <= 0) return null;
  return `${((cache / input) * 100).toFixed(1)}%`;
}

/** Collapsed token panel title: cumulative + this turn + cache hit. */
export function buildUsageTitle({ cumulative = null, turn = null, context = null } = {}) {
  const total = {
    input: (cumulative?.input ?? 0) + (turn?.input ?? 0),
    cache: (cumulative?.cache ?? 0) + (turn?.cache ?? 0),
    calls: (cumulative?.calls ?? 0) + (turn?.calls ?? 0),
  };
  if (total.calls <= 0) return null;
  const hit = cacheHitRate(total.cache, total.input);
  const consumed = (total.input ?? 0) + (total.output ?? 0);
  const turnConsumed = (turn?.input ?? 0) + (turn?.output ?? 0);
  const parts = [
    `累计 ${formatTokens(consumed)}`,
    `本轮 ${formatTokens(turnConsumed)}`,
  ];
  if (hit) parts.push(`缓存命中 ${hit}`);
  if (context && context.window > 0 && context.tokens > 0) {
    parts.push(`上下文 ${Math.round((context.tokens / context.window) * 100)}%`);
  }
  return `**🪙 ${parts.join(' · ')}**`;
}

/** One line per model call; subagents are aggregated per child. */
export function buildUsageRows(rows = []) {
  return rows
    .map((row, index) => {
      const hit = cacheHitRate(row.cache ?? 0, row.input ?? 0);
      const consumed = (row.input ?? 0) + (row.output ?? 0);
      const tail = hit ? ` · 缓存命中 ${hit}` : '';
      return `${String(index + 1).padStart(3, '0')}. ${row.label} · 消耗 ${formatTokens(consumed)}${tail}`;
    })
    .join('\n');
}
