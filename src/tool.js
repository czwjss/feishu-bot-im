/**
 * `im_feishu_return_file` — send one file or image to the calling Feishu chat.
 *
 * The tool sends the file immediately through the chat bound to the calling
 * Session, so the model can describe it as sent once the call succeeds.
 */
export const TOOL_NAME = 'im_feishu_return_file';

export function createReturnFileTool({ send }) {
  return Object.freeze({
    name: TOOL_NAME,
    description: 'Send one local file or image to the current Feishu chat as a native attachment. '
      + 'Only meaningful in a Feishu conversation: the chat is resolved from the calling Session. '
      + 'The file is uploaded and sent before this call returns, so report it as sent only when the result says so.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path, or a path relative to the bot workspace.',
        },
        name: {
          type: 'string',
          description: 'Optional display name for the attachment.',
        },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fileName: { type: 'string' },
          bytes: { type: 'number' },
          chatId: { type: 'string' },
        },
        required: ['fileName', 'bytes', 'chatId'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: `已把「${value.fileName}」（${value.bytes} 字节）发送到飞书会话。`,
      }],
    },
    async execute(args, exec) {
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      if (!path) throw new Error('path 不能为空');
      return send({
        sessionId: exec?.agent?.session?.id ?? null,
        path,
        name: typeof args?.name === 'string' ? args.name : undefined,
        signal: exec?.signal,
      });
    },
  });
}


export const DELIVER_TOOL_NAME = 'im_feishu_deliver';

/** Proactive delivery: push text to a chat id or a user open_id. */
export function createDeliverTool({ send }) {
  return Object.freeze({
    name: DELIVER_TOOL_NAME,
    description: 'Push a plain-text message to one Feishu conversation. '
      + 'Use im_feishu_chats to discover a chat id when the target is not the calling Session\'s bound chat. '
      + 'Delivery is confirmed before this call returns.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: 'Bot alias, name, or id. Set it when several bots are configured and the Session is not bound.',
        },
        target: {
          type: 'string',
          description: 'Exact chat_id (oc_…) or user open_id (ou_…). Omit to use the calling Session\'s bound chat.',
        },
        text: { type: 'string', description: 'Message text, at most 4000 characters.' },
      },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          targetId: { type: 'string' },
          sentAt: { type: 'string' },
        },
        required: ['targetId', 'sentAt'],
      },
      render: (_args, value) => [{ type: 'text', text: `已投递到 ${value.targetId}（${value.sentAt}）` }],
    },
    async execute(args, context) {
      return send({
        sessionId: context?.agent?.session?.id,
        bot: args.bot,
        target: args.target,
        text: args.text,
      });
    },
  });
}


export const CHATS_TOOL_NAME = 'im_feishu_chats';

/** Discover the chats already bound to this plugin so a Web agent can quote an exact id. */
export function createChatsTool({ list }) {
  return Object.freeze({
    name: CHATS_TOOL_NAME,
    description: 'List Feishu chats bound to this plugin. Use the returned chatId with im_feishu_deliver.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: 'Bot alias, name, or id to filter by. Omit to list every configured bot.',
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
          ? '当前没有绑定任何飞书群聊。'
          : value.chats.slice(0, 20).map((chat) => `${chat.title || chat.chatId}（${chat.chatId}，${chat.bot}）`).join('\n'),
      }],
    },
    async execute(args) {
      const rows = await list({ bot: args?.bot });
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


export const PEOPLE_TOOL_NAME = 'im_feishu_people';

/** Resolve a person's or group member's exact open_id without dumping the roster. */
export function createPeopleTool({ find }) {
  return Object.freeze({
    name: PEOPLE_TOOL_NAME,
    description: 'Fuzzy-search the members of one Feishu chat and return exact open_ids. '
      + 'Use it before writing an <at> tag. Members are cached for six hours; set refresh=true to refetch.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: 'Bot alias, name, or id. Set it when several bots are configured and the Session is not bound.',
        },
        chatId: {
          type: 'string',
          description: 'Chat id (oc_…). Omit to use the calling Session\'s bound chat.',
        },
        query: {
          type: 'string',
          description: 'Name fragment or exact open_id, for example "志文". Case and spaces are ignored.',
        },
        refresh: {
          type: 'boolean',
          description: 'Bypass the six-hour cache and refetch the group roster.',
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
