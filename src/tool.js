import { normalizeCardColor } from './cards.js';
import { defineFeishuTool, HISTORY_PARAMETERS, historyOptions, renderToolOutput, validateCardText } from './tool-contract.js';

/**
 * Model-facing Feishu tools.
 *
 * `feishu_bot_send` sends a standalone message/file. Feishu-origin replies are
 * streamed by the bridge itself, so there is deliberately no agent-facing
 * "reply with a card" tool.
 */
export const SEND_TOOL_NAME = 'feishu_bot_send';

export function createSendTool({ send }) {
  return defineFeishuTool({
    name: SEND_TOOL_NAME,
    description: '以机器人身份立即发送一条独立卡片或文件到飞书会话（群里显示机器人名称，不是你自己）。'
      + '省略 chatId 时发到当前会话绑定的飞书会话。返回 messageId，可供撤回使用。',
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
          description: '私聊或群聊的 chat_id（oc_…）；省略时使用当前会话绑定的聊天。',
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
          description: '本地文件/图片路径；与 text 二选一。相对路径优先按当前 Session 工作区解析，否则使用机器人默认工作区。图片上限 10MB，文件上限 30MB。',
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
          kind: { type: 'string', enum: ['card', 'image', 'file'] },
          messageId: { type: 'string' },
          chatId: { type: 'string' },
          sentAt: { type: 'string' },
          fileName: { type: 'string' },
          bytes: { type: 'number' },
        },
        required: ['kind', 'chatId', 'messageId'],
      },
      render: (_args, value) => renderToolOutput(value, value.kind !== 'card'
          ? `已把「${value.fileName}」（${value.bytes} 字节）发送到 ${value.chatId}。`
          : `已发送卡片到 ${value.chatId}（${value.sentAt}）。`),
    },
    async execute(args, context) {
      const text = typeof args?.text === 'string' ? args.text.trim() : '';
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      const title = typeof args?.title === 'string' ? args.title.trim() : '';
      const color = normalizeCardColor(args?.color);
      if ((text && path) || (!text && !path)) throw new Error('text 和 path 必须且只能提供一个');
      if (path && (title || color)) throw new Error('title/color 仅用于文本卡片');
      if (text) validateCardText(text, title, 4000);
      context?.signal?.throwIfAborted();
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
        cwd: context?.agent?.session?.cwd,
      });
    },
  });
}


export const MESSAGES_TOOL_NAME = 'feishu_bot_messages';

export function createMessagesTool({ list }) {
  return defineFeishuTool({
    name: MESSAGES_TOOL_NAME,
    description: '以机器人身份读取它所在会话的历史消息（群聊或私聊），支持时间范围、分页、thread，'
      + '以及本次拉取范围内的本地关键词筛选；不是飞书全文搜索。',
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
          description: '私聊或群聊的 chat_id（oc_…）；省略时使用当前会话绑定的聊天。',
        },
        threadId: {
          type: 'string',
          description: 'thread_id；指定后读取该 thread 的回复，仍需要 chatId 做会话校验。不可同时使用 startTime/endTime。',
        },
        ...HISTORY_PARAMETERS,
        scanLimit: {
          type: 'integer',
          default: 200,
          description: '最多扫描的消息数，1–500，默认 200；单次最多请求 10 页。匹配不足时也可能有下一页，以 hasMore/pageToken 为准。',
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
                at: { type: 'number' },
                time: { type: 'string' },
                senderId: { type: 'string' },
                senderName: { type: 'string' },
                type: { type: 'string' },
                text: { type: 'string' },
                threadId: { type: 'string' },
              },
              required: ['messageId', 'at', 'time', 'senderId', 'senderName', 'type', 'text', 'threadId'],
            },
          },
        },
        required: ['chatId', 'threadId', 'query', 'scanned', 'matched', 'hasMore', 'pageToken', 'messages'],
      },
      render: (_args, value) => renderToolOutput(value,
        `匹配 ${value.matched} 条，扫描 ${value.scanned} 条${value.hasMore ? '，还有更多，请使用 pageToken 继续读取' : ''}。`),
    },
    async execute(args, context) {
      return list({
        sessionId: context?.agent?.session?.id,
        bot: args?.bot,
        chatId: args?.chatId,
        threadId: args?.threadId,
        startTime: args?.startTime,
        endTime: args?.endTime,
        ...historyOptions(args),
        scanLimit: args?.scanLimit,
        pageToken: args?.pageToken,
        signal: context?.signal,
      });
    },
  });
}


export const CHATS_TOOL_NAME = 'feishu_bot_chats';

/** Discover the chats the bot belongs to, with bound Session markers. */
export function createChatsTool({ list }) {
  return defineFeishuTool({
    name: CHATS_TOOL_NAME,
    description: '列出机器人可见的飞书群和已知绑定的私聊/会话，并标记 Session 与 chatType（group/p2p/unknown）。'
      + '不是用户全部私聊的目录；返回的 chatId 可用于发送或查历史，botId 可精确选择机器人。',
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
                botId: { type: 'string' },
                chatType: { type: 'string', enum: ['group', 'p2p', 'unknown'] },
                chatId: { type: 'string' },
                title: { type: 'string' },
                sessionId: { type: 'string' },
                kind: { type: 'string' },
              },
              required: ['bot', 'botId', 'chatType', 'chatId', 'title', 'sessionId', 'kind'],
            },
          },
        },
        required: ['chats'],
      },
      render: (_args, value) => renderToolOutput(value, value.chats.length ? `共 ${value.chats.length} 个会话。` : '当前没有可用的飞书会话。'),
    },
    async execute(args, context) {
      const rows = await list({ bot: args?.bot, refresh: args?.refresh === true, signal: context?.signal });
      return {
        chats: (Array.isArray(rows) ? rows : []).map((row) => ({
          bot: String(row.bot ?? ''),
          botId: String(row.botId ?? ''),
          chatType: ['group', 'p2p'].includes(row.chatType) ? row.chatType : 'unknown',
          chatId: String(row.chatId ?? ''),
          title: String(row.title ?? ''),
          sessionId: String(row.sessionId ?? ''),
          kind: String(row.kind ?? 'chat'),
        })),
      };
    },
  });
}


export const PEOPLE_TOOL_NAME = 'feishu_bot_people';
export const RECALL_TOOL_NAME = 'feishu_bot_recall';

/** Resolve a group member's exact open_id without dumping the roster. */
export function createPeopleTool({ find }) {
  return defineFeishuTool({
    name: PEOPLE_TOOL_NAME,
    description: '按姓名模糊查询机器人所在群的成员，返回完整 open_id；写 <at> 标签前先调用。'
      + '成员缓存 6 小时；最多返回 10 个候选，hasMore 为 true 时请缩小 query，避免遗漏同名成员。',
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
      render: (_args, value) => renderToolOutput(value, value.people.length === 0
          ? `没有找到匹配的群成员（${value.chatId}）。`
          : `找到 ${value.matched} 个候选${value.hasMore ? '，仅显示前 10 个，请缩小 query' : ''}。`),
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


/** Recall one message the bot sent itself. */
export function createRecallTool({ recall }) {
  return defineFeishuTool({
    name: RECALL_TOOL_NAME,
    description: '撤回机器人自己发出的一条飞书消息（误发到群里时用）。'
      + '只能撤回机器人自己发的消息；撤销时限由企业管理员配置；批量发送的消息不支持。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: '机器人别名、名称或 id；多机器人且当前会话未绑定时需要。',
        },
        messageId: {
          type: 'string',
          description: '要撤回的消息 id（om_…）。',
        },
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
      render: (_args, value) => renderToolOutput(value, value.recalled
          ? `已撤回消息 ${value.messageId}。`
          : `撤回失败：${value.messageId}（只能撤回机器人自己发的消息，或已超过允许的时限）。`),
    },
    async execute(args, context) {
      const messageId = typeof args?.messageId === 'string' ? args.messageId.trim() : '';
      if (!messageId) throw new Error('messageId 不能为空');
      return recall({ bot: args?.bot, messageId, sessionId: context?.agent?.session?.id, signal: context?.signal });
    },
  });
}
