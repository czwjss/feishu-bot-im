import { normalizeCardColor } from './cards.js';
import {
  boundedInteger,
  defineFeishuTool,
  HISTORY_PARAMETERS,
  historyOptions,
  MAX_SEND_TEXT_LENGTH,
  messageListOutputSchema,
  renderToolOutput,
  resolveSandboxMode,
  resolveSessionCwd,
  SEND_OUTPUT_SCHEMA,
  validateCardText,
} from './tool-contract.js';

/**
 * 机器人身份的模型工具定义。
 * 飞书来源的正常回复由桥接流式发送；feishu_bot_send 仅用于发送独立卡片或文件。
 */
export const SEND_TOOL_NAME = 'feishu_bot_send';
export const MESSAGES_TOOL_NAME = 'feishu_bot_messages';
export const CHATS_TOOL_NAME = 'feishu_bot_chats';
export const PEOPLE_TOOL_NAME = 'feishu_bot_people';
export const RECALL_TOOL_NAME = 'feishu_bot_recall';

const LIST_ONLY_FIELDS = ['threadId', 'startTime', 'endTime', 'limit', 'order', 'query', 'scanLimit', 'pageToken'];

export function createSendTool({ send, harness = null }) {
  return defineFeishuTool({
    name: SEND_TOOL_NAME,
    description: '以机器人身份发送一条独立卡片、图片或文件到飞书会话，支持引用回复。',
    timeoutMs: 30_000,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'other',
      title: args?.path ? `机器人发送文件：${args.name || args.path}` : `机器人发送飞书卡片${args?.title ? `：${args.title}` : ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: { type: 'string', description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。' },
        chatId: { type: 'string', description: '会话 chat_id（oc_…）；省略时使用当前会话绑定的聊天。' },
        title: { type: 'string', description: '卡片标题，仅文本卡片可用，最多 100 字符。' },
        color: { type: 'string', description: '卡片标题颜色，仅文本卡片可用，须配合 title，如 blue / green / orange / red / grey。' },
        text: { type: 'string', description: 'Markdown 正文，最多 8000 字符；与 path 二选一。' },
        path: { type: 'string', description: '本地文件/图片路径；与 text 二选一。图片上限 10MB，文件上限 30MB。' },
        name: { type: 'string', description: '文件显示名称；仅 path 模式可选。' },
        replyToMessageId: { type: 'string', description: '引用回复的消息 id（om_…）；仅支持文本卡片，不可与 path 同用。' },
      },
    },
    output: {
      schema: SEND_OUTPUT_SCHEMA,
      render: (_args, value) => renderToolOutput(value, value.kind !== 'card'
        ? `已把「${value.fileName}」（${value.bytes} 字节）发送到 ${value.chatId}。`
        : `已发送卡片到 ${value.chatId}${value.sentAt ? `（${value.sentAt}）` : ''}。`),
    },
    async execute(args, context) {
      const text = typeof args?.text === 'string' ? args.text.trim() : '';
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      const title = typeof args?.title === 'string' ? args.title.trim() : '';
      const replyToMessageId = typeof args?.replyToMessageId === 'string' ? args.replyToMessageId.trim() : '';
      const color = normalizeCardColor(args?.color);
      if ((text && path) || (!text && !path)) throw new Error('text 和 path 必须且只能提供一个');
      if (path && (title || color)) throw new Error('title/color 仅用于文本卡片');
      if (color && !title) throw new Error('color 需要同时提供 title');
      if (path && replyToMessageId) throw new Error('replyToMessageId 仅支持文本卡片，不能与 path 同用');
      if (text) validateCardText(text, title, MAX_SEND_TEXT_LENGTH);
      context?.signal?.throwIfAborted();
      const cwd = path ? await resolveSessionCwd(context, harness) : undefined;
      const sandboxMode = path ? resolveSandboxMode(context, harness) : null;
      return send({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        text: text || undefined,
        title: title || undefined,
        color,
        path: path || undefined,
        name: typeof args?.name === 'string' ? args.name : undefined,
        replyToMessageId: replyToMessageId || undefined,
        signal: context?.signal,
        cwd,
        sandboxMode,
      });
    },
  });
}

export function createMessagesTool({ list }) {
  return defineFeishuTool({
    name: MESSAGES_TOOL_NAME,
    description: '以机器人身份读取会话历史或单条消息。',
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'read',
      title: args?.messageId
        ? `读取机器人单条消息：${args.messageId}`
        : `读取机器人消息历史${args?.query ? `（筛选：${args.query}）` : ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: { type: 'string', description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。' },
        chatId: { type: 'string', description: '会话 chat_id（oc_…）；省略时使用当前会话绑定的聊天。' },
        messageId: { type: 'string', description: '按消息 ID（om_…）精确查单条消息；不可与列表查询参数同用。' },
        threadId: { type: 'string', description: 'thread_id；读取该 thread 回复，需配合 chatId，不可与 startTime/endTime 同用。' },
        ...HISTORY_PARAMETERS,
      },
    },
    output: {
      schema: messageListOutputSchema({ includeThreadId: true }),
      render: (_args, value) => renderToolOutput(
        value,
        `匹配 ${value.matched} 条，扫描 ${value.scanned} 条${value.hasMore ? '，还有更多，请使用 pageToken 继续读取' : ''}。`,
      ),
    },
    async execute(args, context) {
      const messageId = typeof args?.messageId === 'string' ? args.messageId.trim() : '';
      if (args?.messageId !== undefined) {
        if (!/^om_[\w-]+$/.test(messageId)) throw new Error('messageId 需要是 om_ 开头的消息 ID');
        const extra = LIST_ONLY_FIELDS.find((field) => args[field] !== undefined);
        if (extra) throw new Error(`按 messageId 查询单条消息时不能同时传入 ${extra}`);
      }
      const opts = messageId ? null : historyOptions(args);
      const raw = await list({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        ...(messageId ? { messageId } : {
          threadId: args?.threadId,
          startTime: args?.startTime,
          endTime: args?.endTime,
          limit: opts.limit,
          order: opts.order,
          query: opts.query,
          scanLimit: opts.scanLimit,
          pageToken: args?.pageToken,
        }),
        signal: context?.signal,
      });
      const rows = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.messages) ? raw.messages : []);
      const items = rows.map((row) => ({
        messageId: String(row.messageId ?? ''),
        time: String(row.time ?? ''),
        senderId: String(row.senderId ?? ''),
        senderName: String(row.senderName ?? ''),
        msgType: String(row.msgType ?? row.type ?? ''),
        text: String(row.text ?? ''),
        ...(row.threadId ? { threadId: String(row.threadId) } : {}),
        ...(Number.isInteger(row.imageCount) && row.imageCount > 0 ? { imageCount: row.imageCount } : {}),
      }));
      return {
        chatId: String(raw?.chatId ?? ''),
        threadId: String(raw?.threadId ?? ''),
        query: String(raw?.query ?? ''),
        scanned: Number(raw?.scanned ?? 0),
        matched: Number(raw?.matched ?? items.length),
        hasMore: Boolean(raw?.hasMore),
        pageToken: String(raw?.pageToken ?? ''),
        items,
      };
    },
  });
}

export function createChatsTool({ list }) {
  return defineFeishuTool({
    name: CHATS_TOOL_NAME,
    description: '列出机器人可见的飞书群和已知绑定会话。',
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'search',
      title: `查询机器人可见会话${args?.query ? `：${args.query}` : ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: { type: 'string', description: '按机器人别名、名称或 id 过滤；省略则列出全部机器人。' },
        query: { type: 'string', description: '按群名、chatId 或机器人名模糊过滤，可选。' },
        limit: { type: 'integer', default: 30, description: '最多返回条数，1–100，默认 30。' },
        refresh: { type: 'boolean', description: '强制从飞书刷新最新列表。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                bot: { type: 'string' },
                botId: { type: 'string' },
                chatType: { type: 'string', enum: ['group', 'p2p', 'unknown'] },
                chatId: { type: 'string' },
                name: { type: 'string' },
                sessionId: { type: 'string' },
                kind: { type: 'string' },
              },
              required: ['bot', 'botId', 'chatType', 'chatId', 'name', 'sessionId', 'kind'],
            },
          },
          total: { type: 'integer' },
          hasMore: { type: 'boolean' },
        },
        required: ['items', 'total', 'hasMore'],
      },
      render: (_args, value) => renderToolOutput(
        value,
        value.items.length
          ? `共匹配 ${value.total} 个会话${value.hasMore ? `，已显示前 ${value.items.length} 个，请用 query 或 bot 缩小范围` : ''}。`
          : '当前没有匹配的飞书会话。',
      ),
    },
    async execute(args, context) {
      const limit = boundedInteger(args?.limit, 30, 100, 'limit');
      const needle = typeof args?.query === 'string' ? args.query.normalize('NFKC').trim().toLowerCase() : '';
      const rows = await list({ bot: args?.bot, refresh: args?.refresh === true, signal: context?.signal });
      const normalized = (Array.isArray(rows) ? rows : []).map((row) => ({
        bot: String(row.bot ?? ''),
        botId: String(row.botId ?? ''),
        chatType: ['group', 'p2p'].includes(row.chatType) ? row.chatType : 'unknown',
        chatId: String(row.chatId ?? ''),
        name: String(row.name ?? row.title ?? ''),
        sessionId: String(row.sessionId ?? ''),
        kind: String(row.kind ?? 'chat'),
      }));
      const filtered = needle
        ? normalized.filter((item) => [item.name, item.chatId, item.bot, item.botId]
          .some((field) => field.normalize('NFKC').toLowerCase().includes(needle)))
        : normalized;
      const items = filtered.slice(0, limit);
      return {
        items,
        total: filtered.length,
        hasMore: filtered.length > items.length,
      };
    },
  });
}

export function createPeopleTool({ find }) {
  return defineFeishuTool({
    name: PEOPLE_TOOL_NAME,
    description: '按姓名模糊查询机器人所在群的成员，返回完整 open_id。',
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'search',
      title: `查询群成员：${args?.query ?? ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: { type: 'string', description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。' },
        chatId: { type: 'string', description: '群 chat_id（oc_…）；省略时使用当前会话绑定的群。' },
        query: { type: 'string', description: '姓名片段或完整 open_id。' },
        refresh: { type: 'boolean', description: '强制从飞书刷新群成员列表。' },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chatId: { type: 'string' },
          matched: { type: 'number' },
          hasMore: { type: 'boolean' },
          people: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                openId: { type: 'string' },
              },
              required: ['name', 'openId'],
            },
          },
        },
        required: ['chatId', 'people', 'matched', 'hasMore'],
      },
      render: (_args, value) => renderToolOutput(
        value,
        value.people.length === 0
          ? `没有找到匹配的群成员（${value.chatId}）。`
          : `找到 ${value.matched} 个候选${value.hasMore ? '，仅显示前 10 个，请缩小 query' : ''}。`,
      ),
    },
    async execute(args, context) {
      return find({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        query: args?.query,
        refresh: args?.refresh === true,
        signal: context?.signal,
      });
    },
  });
}

export function createRecallTool({ recall }) {
  return defineFeishuTool({
    name: RECALL_TOOL_NAME,
    description: '撤回机器人自己发出的一条飞书消息（不支持批量发送的消息，受企业撤销时限约束）。',
    timeoutMs: 15_000,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'delete',
      title: `撤回机器人消息：${args?.messageId ?? ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: { type: 'string', description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。' },
        messageId: { type: 'string', description: '要撤回的消息 id（om_…）。' },
      },
      required: ['messageId'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recalled: { type: 'boolean' },
          messageId: { type: 'string' },
        },
        required: ['recalled', 'messageId'],
      },
      render: (_args, value) => renderToolOutput(
        value,
        value.recalled
          ? `已撤回消息 ${value.messageId}。`
          : `撤回失败：${value.messageId}（只能撤回机器人自己发的消息，或已超过允许的时限）。`,
      ),
    },
    async execute(args, context) {
      const messageId = typeof args?.messageId === 'string' ? args.messageId.trim() : '';
      if (!messageId) throw new Error('messageId 不能为空');
      return recall({ bot: args?.bot, messageId, sessionId: context?.agent?.session?.id, signal: context?.signal });
    },
  });
}
