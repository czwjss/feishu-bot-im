/** 机器人与分身发送工具共用的正文字符上限，避免同一模型在两种身份下遇到不同边界。 */
export const MAX_SEND_TEXT_LENGTH = 8_000;

/**
 * 解析本次工具调用应使用的会话工作目录。
 *
 * DSH 把原始项目目录记录在 `session.header.cwd`（Session 实例本身没有 `cwd`
 * 属性），`workingDirectory.ensure()` 还能在工作区被移动或删除后恢复原项目。
 * 因此优先走 harness，其次读 header，绝不用 Host 进程目录兜底。
 * @param {object} context 工具执行上下文。
 * @param {object} [harness] 提供 `workingDirectoryOf` 的适配器。
 * @returns {Promise<string>} 绝对目录；无法确定时为空字符串。
 */
export async function resolveSessionCwd(context, harness) {
  const agent = context?.agent;
  if (!agent) return '';
  if (typeof harness?.workingDirectoryOf === 'function') {
    const resolved = await harness.workingDirectoryOf(agent, context?.signal);
    if (typeof resolved === 'string' && resolved.trim()) return resolved;
  }
  const fromHeader = agent.session?.header?.cwd;
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader;
  // 兼容更早的 DSH 版本：Session 实例上曾直接暴露 cwd。
  const legacy = agent.session?.cwd;
  return typeof legacy === 'string' && legacy.trim() ? legacy : '';
}

/**
 * 读取本次调用所处的 DSH 沙箱档位。
 *
 * 只有 `danger-full-access` 会放宽插件自己的工作区校验；未知档位（含适配器
 * 不可用）一律返回 null，由路径校验按最严格规则处理。
 * @param {object} context 工具执行上下文。
 * @param {object} [harness] 提供 `sandboxModeOf` 的适配器。
 * @returns {string | null} 档位名，或无法确定时的 null。
 */
export function resolveSandboxMode(context, harness) {
  try {
    const mode = harness?.sandboxModeOf?.(context?.agent?.session);
    return typeof mode === 'string' && mode ? mode : null;
  } catch {
    return null;
  }
}

/** Native output is model input, not just a UI preview. Keep the whole value. */
export function renderToolOutput(value, summary = '') {
  return [{ type: 'text', text: [summary, JSON.stringify(value)].filter(Boolean).join('\n') }];
}

/** Flat tool inputs share their declared field names, types and enums with validation. */
export function defineFeishuTool(definition) {
  const { properties, required = [] } = definition.parameters;
  const fail = (detail) => {
    throw Object.assign(new Error(`${definition.name} 参数错误：${detail}`), { code: 'INVALID_ARGS' });
  };
  return Object.freeze({
    ...definition,
    async execute(args = {}, context) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) fail('请传入参数对象');
      for (const key of Object.keys(args)) {
        if (!Object.hasOwn(properties, key)) fail(`不支持参数 ${key}；可用参数：${Object.keys(properties).join(', ') || '无'}`);
        if (args[key] === undefined) continue;
        const rule = properties[key];
        const validType = rule.type === 'integer' ? Number.isInteger(args[key])
          : rule.type === 'number' ? Number.isFinite(args[key])
            : typeof args[key] === rule.type;
        if (!validType) fail(`${key} 必须为 ${rule.type}`);
        if (rule.enum && !rule.enum.includes(args[key])) fail(`${key} 必须为 ${rule.enum.join(' / ')}`);
      }
      for (const key of required) if (!Object.hasOwn(args, key) || args[key] === undefined) fail(`缺少 ${key}`);
      return definition.execute(args, context);
    },
  });
}

// DSH's PTC schema subset excludes minimum/maximum; ranges are enforced below.
export const HISTORY_PARAMETERS = Object.freeze({
  startTime: { type: 'string', description: '开始时间：带时区的 ISO 8601 或秒级时间戳字符串。' },
  endTime: { type: 'string', description: '结束时间，同 startTime 格式；须晚于开始时间。' },
  limit: { type: 'integer', default: 20, description: '返回条数上限，1–50，默认 20。' },
  pageToken: { type: 'string', description: '翻页游标；继续查询时保持其他条件不变。' },
  order: { type: 'string', enum: ['newest', 'oldest'], default: 'newest', description: 'newest 倒序 / oldest 正序，默认 newest。' },
  query: { type: 'string', description: '在本次扫描结果的正文或发送者名称中匹配关键词；不是飞书全文搜索。' },
  scanLimit: { type: 'integer', default: 200, description: '最多扫描的消息数，1–500，默认 200（单次最多 10 页）；未找齐时以 hasMore/pageToken 继续。' },
});

/** 机器人与分身消息历史共享的统一消息项输出结构。 */
export const MESSAGE_ITEM_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    messageId: { type: 'string' },
    time: { type: 'string' },
    senderId: { type: 'string' },
    senderName: { type: 'string' },
    msgType: { type: 'string' },
    text: { type: 'string' },
    threadId: { type: 'string' },
    imageCount: { type: 'integer' },
  },
  required: ['messageId', 'time', 'senderId', 'senderName', 'msgType', 'text'],
});

export function messageListOutputSchema({ includeThreadId = false } = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      chatId: { type: 'string' },
      ...(includeThreadId ? { threadId: { type: 'string' } } : {}),
      query: { type: 'string' },
      scanned: { type: 'number' },
      matched: { type: 'number' },
      hasMore: { type: 'boolean' },
      pageToken: { type: 'string' },
      items: { type: 'array', items: MESSAGE_ITEM_SCHEMA },
    },
    required: [
      'chatId',
      ...(includeThreadId ? ['threadId'] : []),
      'query', 'scanned', 'matched', 'hasMore', 'pageToken', 'items',
    ],
  };
}

/** 机器人与分身发送工具共享的统一回执结构。 */
export const SEND_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['card', 'image', 'file'] },
    messageId: { type: 'string' },
    chatId: { type: 'string' },
    sentAt: { type: 'string' },
    fileName: { type: 'string' },
    bytes: { type: 'number' },
  },
  required: ['kind', 'chatId', 'messageId'],
});

export function boundedInteger(value, fallback, maximum, name) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} 必须是 1–${maximum} 的整数`);
  return value;
}

export function historyOptions(args = {}) {
  const order = args.order ?? 'newest';
  if (!['newest', 'oldest'].includes(order)) throw new Error('order 必须是 newest 或 oldest');
  const query = args.query ?? '';
  if (typeof query !== 'string') throw new Error('query 必须是字符串');
  return {
    limit: boundedInteger(args.limit, 20, 50, 'limit'),
    scanLimit: boundedInteger(args.scanLimit, 200, 500, 'scanLimit'),
    order,
    query: query.normalize('NFKC').trim().toLowerCase(),
  };
}

function epochSeconds(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
  // Date.parse also accepts strings such as '-1' as calendar dates. Only let
  // ISO-shaped dates reach it; malformed timestamps must not query another day.
  const iso = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw);
  const seconds = numeric === null ? (iso ? Date.parse(raw) / 1000 : NaN) : numeric > 1e12 ? numeric / 1000 : numeric;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 8.64e12) throw new Error(`${name} 需要是 ISO 8601 时间或秒级时间戳`);
  return Math.floor(seconds);
}

export function historyTimeRange(startTime, endTime) {
  const start = epochSeconds(startTime, 'startTime');
  const end = epochSeconds(endTime, 'endTime');
  if (start !== null && end !== null && start >= end) throw new Error('startTime 必须早于 endTime');
  return { start, end };
}

export function validateCardText(text, title, maximum) {
  const body = typeof text === 'string' ? text.trim() : '';
  const heading = typeof title === 'string' ? title.trim() : '';
  if (!body) throw new Error('text 不能为空');
  if (body.length > maximum) throw new Error(`text 过长（${body.length} 字符），单条上限 ${maximum} 字符，请缩短内容或改发文件`);
  if (heading.length > 100) throw new Error('title 最多 100 字符');
  return { body, heading };
}
