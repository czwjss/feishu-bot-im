import { normalizeCardColor } from './cards.js';
import { formatEavesdropTime } from './eavesdrop.js';

/**
 * Model-facing Feishu tools.
 *
 * `feishu_bot_send` sends a standalone message/file. Feishu-origin replies are
 * streamed by the bridge itself, so there is deliberately no agent-facing
 * "reply with a card" tool.
 */
export const SEND_TOOL_NAME = 'feishu_bot_send';

export function createSendTool({ send }) {
  return Object.freeze({
    name: SEND_TOOL_NAME,
    description: '立即发送一条独立卡片消息或文件到飞书群。'
      + '飞书消息的回复会自动流式发送；不要用本工具重复回复当前飞书消息。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。',
        },
        chatId: {
          type: 'string',
          description: '群 chat_id（oc_…）；省略时使用当前会话绑定的群。',
        },
        title: {
          type: 'string',
          description: '卡片标题；仅文本卡片使用，可选，最多 100 字。',
        },
        color: {
          type: 'string',
          description: '标题颜色；仅文本卡片使用，可选。常用 blue、green、orange、red、grey；其他飞书合法值按传入使用，未知值回退 grey。',
        },
        text: {
          type: 'string',
          description: '卡片正文，Markdown；与 path 二选一，最多 4000 字。',
        },
        path: {
          type: 'string',
          description: '要发送的文件/图片路径；与 text 二选一。',
        },
        name: {
          type: 'string',
          description: '文件显示名称；仅 path 模式使用，可选。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string' },
          chatId: { type: 'string' },
          sentAt: { type: 'string' },
          fileName: { type: 'string' },
          bytes: { type: 'number' },
        },
        required: ['kind', 'chatId'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.kind === 'file'
          ? `已把「${value.fileName}」（${value.bytes} 字节）发送到 ${value.chatId}。`
          : `已发送卡片到 ${value.chatId}（${value.sentAt}）。`,
      }],
    },
    async execute(args, context) {
      const text = typeof args?.text === 'string' ? args.text.trim() : '';
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      const title = typeof args?.title === 'string' ? args.title.trim() : '';
      const color = normalizeCardColor(args?.color);
      if ((text && path) || (!text && !path)) throw new Error('text 和 path 必须且只能提供一个');
      if (path && (title || color)) throw new Error('title/color 仅用于文本卡片');
      return send({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        text: text || undefined,
        title: title || undefined,
        color,
        path: path || undefined,
        name: typeof args?.name === 'string' ? args.name : undefined,
        signal: context?.signal,
      });
    },
  });
}


export const MESSAGES_TOOL_NAME = 'feishu_bot_messages';

export function createMessagesTool({ list }) {
  return Object.freeze({
    name: MESSAGES_TOOL_NAME,
    description: '读取飞书群历史消息，支持时间范围、分页和本次拉取范围内的本地关键词筛选；不是飞书全文搜索。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。',
        },
        chatId: {
          type: 'string',
          description: '群 chat_id（oc_…）；省略时使用当前会话绑定的群。',
        },
        threadId: {
          type: 'string',
          description: '话题 thread_id；指定后读取该话题回复，仍需要 chatId 做群校验。',
        },
        startTime: {
          type: 'string',
          description: '开始时间，ISO 8601，例如 2026-11-05T00:00:00+08:00。',
        },
        endTime: {
          type: 'string',
          description: '结束时间，ISO 8601，例如 2026-11-06T00:00:00+08:00。',
        },
        limit: {
          type: 'number',
          description: '返回条数，1-50，默认 20。',
        },
        scanLimit: {
          type: 'number',
          description: '有 query 时最多扫描多少条，默认 200，最大 500。',
        },
        pageToken: {
          type: 'string',
          description: '上一页返回的 pageToken，用于继续翻页。',
        },
        order: {
          type: 'string',
          description: 'newest（默认）或 oldest。',
        },
        query: {
          type: 'string',
          description: '可选关键词；只在本次拉取范围内做本地包含匹配。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chatId: { type: 'string' },
          threadId: { type: 'string' },
          query: { type: 'string' },
          scanned: { type: 'number' },
          matched: { type: 'number' },
          hasMore: { type: 'boolean' },
          pageToken: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                messageId: { type: 'string' },
                time: { type: 'string' },
                senderId: { type: 'string' },
                senderName: { type: 'string' },
                type: { type: 'string' },
                text: { type: 'string' },
                threadId: { type: 'string' },
              },
              required: ['messageId', 'time', 'senderId', 'senderName', 'type', 'text', 'threadId'],
            },
          },
        },
        required: ['chatId', 'threadId', 'query', 'scanned', 'matched', 'hasMore', 'pageToken', 'messages'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `匹配 ${value.matched} 条，扫描 ${value.scanned} 条${value.query ? `（关键词：${value.query}）` : ''}${value.hasMore ? '，还有更多' : ''}`,
          ...value.messages.slice(0, 20).map((row) => {
            const when = row.time ? formatEavesdropTime(Date.parse(row.time)) : '-';
            const text = String(row.text ?? '').replace(/\s+/g, ' ').slice(0, 300);
            return `${when} ${row.senderName || row.senderId || '未知'}：${text}`;
          }),
        ].join('\n'),
      }],
    },
    async execute(args, context) {
      return list({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        threadId: args?.threadId,
        startTime: args?.startTime,
        endTime: args?.endTime,
        limit: args?.limit,
        scanLimit: args?.scanLimit,
        pageToken: args?.pageToken,
        order: args?.order,
        query: args?.query,
      });
    },
  });
}


export const CHATS_TOOL_NAME = 'feishu_bot_chats';

/** Discover the chats the bot belongs to, with bound Session markers. */
export function createChatsTool({ list }) {
  return Object.freeze({
    name: CHATS_TOOL_NAME,
    description: '列出机器人所在的飞书群，并标记已绑定的 Session。返回的 chatId 可用于发送。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: '按机器人别名、名称或 id 过滤；省略则列出全部机器人。',
        },
        refresh: {
          type: 'boolean',
          description: '绕过 6 小时群列表缓存，重新从飞书拉取。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chats: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                bot: { type: 'string' },
                chatId: { type: 'string' },
                title: { type: 'string' },
                sessionId: { type: 'string' },
                kind: { type: 'string' },
                topics: { type: 'number' },
              },
              required: ['bot', 'chatId', 'title', 'sessionId', 'kind', 'topics'],
            },
          },
        },
        required: ['chats'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.chats.length === 0
          ? '当前没有可用的飞书群。'
          : value.chats.slice(0, 20).map((chat) => `${chat.title || chat.chatId}（${chat.chatId}，${chat.bot}）`).join('\n'),
      }],
    },
    async execute(args) {
      const rows = await list({ bot: args?.bot, refresh: args?.refresh === true });
      return {
        chats: (Array.isArray(rows) ? rows : []).map((row) => ({
          bot: String(row.bot ?? ''),
          chatId: String(row.chatId ?? ''),
          title: String(row.title ?? ''),
          sessionId: String(row.sessionId ?? ''),
          kind: String(row.kind ?? 'chat'),
          topics: Number(row.topics) || 0,
        })),
      };
    },
  });
}


export const PEOPLE_TOOL_NAME = 'feishu_bot_people';

/** Resolve a group member's exact open_id without dumping the roster. */
export function createPeopleTool({ find }) {
  return Object.freeze({
    name: PEOPLE_TOOL_NAME,
    description: '按姓名模糊查询指定飞书群的成员，返回完整 open_id；写 <at> 标签前先调用。'
      + '成员缓存 6 小时。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。',
        },
        chatId: {
          type: 'string',
          description: '群 chat_id（oc_…）；省略时使用当前会话绑定的群。',
        },
        query: {
          type: 'string',
          description: '姓名片段或完整 open_id，例如“志文”；忽略大小写和空格。',
        },
        refresh: {
          type: 'boolean',
          description: '绕过 6 小时缓存，重新拉取群成员。',
        },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chatId: { type: 'string' },
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
        required: ['chatId', 'people'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.people.length === 0
          ? `没有找到匹配的群成员（${value.chatId}）。`
          : value.people.map((person) => `${person.name}（${person.openId}）`).join('\n'),
      }],
    },
    async execute(args, context) {
      return find({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        query: args?.query,
        refresh: args?.refresh === true,
      });
    },
  });
}
