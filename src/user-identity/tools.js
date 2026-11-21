/**
 * 飞书分身的模型工具定义。
 *
 * 由 contributions.js 在 Host 全局按需激活注册；这里只定义工具契约与执行逻辑。
 * 用户基础身份通过上下文注入；历史图片与文件附件通过共享的 feishu_message_attachment 读取/下载。
 */
import { createTokenSession, withAccessToken } from './auth.js';
import {
  createDocFileTool,
  createDocReadTool,
  createDocWriteTool,
  DOC_FILE_TOOL_NAME,
  DOC_READ_TOOL_NAME,
  DOC_WRITE_TOOL_NAME,
} from './doc-tools.js';
import {
  boundedInteger,
  defineFeishuTool,
  HISTORY_PARAMETERS,
  historyOptions,
  historyTimeRange,
  messageListOutputSchema,
  renderToolOutput,
  resolveSandboxMode,
  resolveSessionCwd,
  SEND_OUTPUT_SCHEMA,
  validateCardText,
} from '../tool-contract.js';
import { messageFileResource, messageImageKey } from '../message-image-tool.js';
import {
  MAX_TEXT_LENGTH,
  deleteMessage,
  downloadMessageFile,
  downloadMessageImage,
  filterMessagesByKeyword,
  findChatMembers,
  getMessage,
  listChats,
  listMessages,
  lookupCachedMemberName,
  normalizeChatId,
  replyCardMessage,
  requestFeishu,
  searchChats,
  sendCardMessage,
  sendMediaMessage,
} from './api.js';

export const CHATS_TOOL_NAME = 'feishu_avatar_chats';
export const PEOPLE_TOOL_NAME = 'feishu_avatar_people';
export const MESSAGES_TOOL_NAME = 'feishu_avatar_messages';
export const SEND_TOOL_NAME = 'feishu_avatar_send';
export const RECALL_TOOL_NAME = 'feishu_avatar_recall';
export { DOC_READ_TOOL_NAME, DOC_WRITE_TOOL_NAME, DOC_FILE_TOOL_NAME, createDocReadTool, createDocWriteTool, createDocFileTool };

const MAX_SCAN_PAGES = 10;
const LIST_ONLY_FIELDS = ['threadId', 'startTime', 'endTime', 'limit', 'order', 'query', 'scanLimit', 'pageToken'];

function messageOutputItem(item, fallbackChatId = '') {
  const senderId = item.senderOpenId ?? '';
  const senderName = item.senderName || (fallbackChatId && senderId ? lookupCachedMemberName(fallbackChatId, senderId) : '');
  return {
    messageId: item.messageId ?? '',
    time: item.createTime ?? '',
    senderId,
    senderName,
    msgType: item.msgType ?? '',
    text: item.deleted ? '[已撤回消息]' : (item.text ?? ''),
    ...(item.threadId ? { threadId: item.threadId } : {}),
    ...(!item.deleted && item.imageKeys?.length ? { imageCount: item.imageKeys.length } : {}),
  };
}

/** 供共享 feishu_message_attachment 工具以本人身份下载历史消息图片。 */
export function createAvatarImageDownloader({ auth, fetchImpl } = {}) {
  return ({ chatId, messageId, imageIndex, maxBytes, signal }) => withAccessToken(auth, async (accessToken) => {
    const message = await getMessage({ accessToken, messageId, fetchImpl, signal });
    const imageKey = messageImageKey(message, { chatId, messageId, imageIndex });
    const request = (input) => requestFeishu({ ...input, accessToken, fetchImpl, signal });
    return downloadMessageImage({ request, messageId, imageKey, maxBytes, signal });
  }, signal);
}

/** 供共享 feishu_message_attachment 工具以本人身份下载历史消息文件附件。 */
export function createAvatarFileDownloader({ auth, fetchImpl } = {}) {
  return ({ chatId, messageId, maxBytes, signal }) => withAccessToken(auth, async (accessToken) => {
    const message = await getMessage({ accessToken, messageId, fetchImpl, signal });
    const { fileKey, fileName } = messageFileResource(message, { chatId, messageId });
    const request = (input) => requestFeishu({ ...input, accessToken, fetchImpl, signal });
    const bytes = await downloadMessageFile({ request, messageId, fileKey, maxBytes, signal });
    return { chatId, fileName, bytes };
  }, signal);
}

export function createChatsTool({ auth, fetchImpl }) {
  return defineFeishuTool({
    name: CHATS_TOOL_NAME,
    description: '以本人身份查找或列出已加入的飞书会话。',
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'search',
      title: args?.query ? `搜索本人飞书群：${args.query}` : '列出本人最近飞书会话',
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: '可选，群名或关键词（1–64 字符）；省略时按活跃度列出最近会话。' },
        limit: { type: 'integer', default: 20, description: '每页条数上限，1–100，默认 20。' },
        pageToken: { type: 'string', description: '翻页游标；继续查询时保持同一 query 和 limit。' },
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
                chatId: { type: 'string' },
                name: { type: 'string' },
                chatType: { type: 'string', enum: ['group', 'p2p', 'unknown'] },
                description: { type: 'string' },
                external: { type: 'boolean' },
                chatStatus: { type: 'string' },
              },
              required: ['chatId', 'name', 'description', 'external', 'chatStatus'],
            },
          },
          hasMore: { type: 'boolean' },
          pageToken: { type: 'string' },
          notice: { type: 'string' },
        },
        required: ['items', 'hasMore', 'pageToken'],
      },
      render: (_args, value) => renderToolOutput(value),
    },
    async execute(args, context) {
      const pageSize = boundedInteger(args.limit, 20, 100, 'limit');
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (args.query !== undefined && (!query || [...query].length > 64)) {
        throw new Error('query 需要是 1–64 字符的群名或关键词');
      }
      if (query) {
        const result = await withAccessToken(auth, (accessToken) => searchChats({
          accessToken,
          query,
          pageSize,
          pageToken: args.pageToken?.trim(),
          fetchImpl,
          signal: context?.signal,
        }), context?.signal);
        return {
          ...result,
          items: result.items.map((item) => ({ ...item, chatType: 'group' })),
        };
      }
      const listed = await withAccessToken(auth, (accessToken) => listChats({
        accessToken,
        pageSize,
        pageToken: args.pageToken?.trim(),
        types: 'p2p,group',
        fetchImpl,
        signal: context?.signal,
      }), context?.signal);
      if (listed.hasMore && (!listed.pageToken || listed.pageToken === args.pageToken?.trim())) {
        throw new Error('飞书分页游标缺失或未前进，请重新查询');
      }
      return {
        items: listed.items.map((item) => ({
          chatId: item.chatId,
          name: item.name,
          chatType: item.chatMode === 'p2p' ? 'p2p' : 'group',
          description: item.description,
          external: item.external,
          chatStatus: '',
        })),
        hasMore: listed.hasMore,
        pageToken: listed.hasMore ? (listed.pageToken ?? '') : '',
      };
    },
  });
}

export function createPeopleTool({ auth, fetchImpl }) {
  return defineFeishuTool({
    name: PEOPLE_TOOL_NAME,
    description: '以本人身份按姓名模糊查询已加入群的成员，返回完整 open_id。',
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'search',
      title: `本人查询群成员：${args?.query ?? ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chatId: { type: 'string', description: '群 chat_id（oc_…），必须显式提供。' },
        query: { type: 'string', description: '姓名片段或完整 open_id。' },
        refresh: { type: 'boolean', description: '强制从飞书刷新群成员列表。' },
      },
      required: ['chatId', 'query'],
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
      const chatId = normalizeChatId(args?.chatId);
      const query = typeof args?.query === 'string' ? args.query.trim() : '';
      if (!query) throw new Error('查询关键词不能为空');
      return withAccessToken(auth, (accessToken) => findChatMembers({
        accessToken,
        chatId,
        query,
        refresh: args?.refresh === true,
        fetchImpl,
        signal: context?.signal,
      }), context?.signal);
    },
  });
}

export function createMessagesTool({ auth, fetchImpl }) {
  return defineFeishuTool({
    name: MESSAGES_TOOL_NAME,
    description: '以本人身份读取会话历史或单条消息。',
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'read',
      title: args?.messageId
        ? `读取本人单条消息：${args.messageId}`
        : `读取本人消息历史${args?.query ? `（筛选：${args.query}）` : ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chatId: {
          type: 'string',
          description: '会话 chat_id（oc_…），必须显式提供。',
        },
        messageId: {
          type: 'string',
          description: '按消息 ID（om_…）精确查单条消息；不可与列表查询参数同用。',
        },
        threadId: {
          type: 'string',
          description: 'thread_id；读取该 thread 回复，需配合 chatId，不可与 startTime/endTime 同用。',
        },
        ...HISTORY_PARAMETERS,
      },
      required: ['chatId'],
    },
    output: {
      schema: messageListOutputSchema({ includeThreadId: true }),
      render: (_args, value) => renderToolOutput(
        value,
        `匹配 ${value.matched} 条，扫描 ${value.scanned} 条${value.hasMore ? '，还有更多，请使用 pageToken 继续读取' : ''}。`,
      ),
    },
    async execute(args, context) {
      const chatId = normalizeChatId(args?.chatId);
      const messageId = typeof args?.messageId === 'string' ? args.messageId.trim() : '';
      if (args?.messageId !== undefined) {
        if (!/^om_[\w-]+$/.test(messageId)) throw new Error('messageId 需要是 om_ 开头的消息 ID');
        const extra = LIST_ONLY_FIELDS.find((field) => args[field] !== undefined);
        if (extra) throw new Error(`按 messageId 查询单条消息时不能同时传入 ${extra}`);
        const msg = await withAccessToken(auth, (accessToken) => getMessage({
          accessToken,
          messageId,
          fetchImpl,
          signal: context?.signal,
        }), context?.signal);
        if (!msg) throw new Error('找不到指定的飞书消息');
        if (msg.chatId && msg.chatId !== chatId) throw new Error('飞书消息不属于指定会话');
        const entries = [msg, ...(Array.isArray(msg.subMessages) ? msg.subMessages : [])];
        const items = entries.map((entry) => messageOutputItem(entry, chatId));
        return {
          chatId,
          threadId: msg.threadId || '',
          query: '',
          scanned: items.length,
          matched: items.length,
          hasMore: false,
          pageToken: '',
          items,
        };
      }

      const threadId = typeof args?.threadId === 'string' ? args.threadId.trim() : '';
      const { limit, scanLimit, order, query } = historyOptions(args);
      const { start, end } = historyTimeRange(args?.startTime, args?.endTime);
      if (threadId && (start !== null || end !== null)) {
        throw new Error('threadId 不支持 startTime/endTime，请只使用 threadId 或按 chatId 查询时间范围');
      }

      const matched = [];
      let scanned = 0;
      let token = args?.pageToken?.trim() || undefined;
      let hasMore = false;
      let resolvedChatId = chatId;
      const scanCap = query ? Math.max(limit, scanLimit) : limit;
      const tokenSession = createTokenSession(auth, { signal: context?.signal });

      for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
        const remainingScan = scanCap - scanned;
        if (remainingScan <= 0) break;
        const pageSize = query ? Math.min(50, remainingScan) : Math.min(50, limit - matched.length);
        if (pageSize <= 0) break;

        const currentToken = token;
        const result = await tokenSession.run((accessToken) => listMessages({
          accessToken,
          chatId,
          threadId: threadId || undefined,
          startTime: args?.startTime,
          endTime: args?.endTime,
          pageSize,
          pageToken: currentToken,
          sort: order === 'oldest' ? 'asc' : 'desc',
          fetchImpl,
          signal: context?.signal,
        }));
        resolvedChatId = result.chatId || resolvedChatId;
        if (result.hasMore && (!result.pageToken || result.pageToken === currentToken)) {
          throw new Error('飞书分页游标缺失或未前进，请重新查询');
        }
        scanned += result.items.length;
        const filtered = filterMessagesByKeyword(result.items, query);
        for (const item of filtered) {
          matched.push(messageOutputItem(item));
          if (matched.length >= limit) break;
        }
        hasMore = Boolean(result.hasMore);
        token = hasMore ? result.pageToken : undefined;
        if (!hasMore || scanned >= scanCap || matched.length >= limit) break;
      }

      return {
        chatId: resolvedChatId,
        threadId,
        query,
        scanned,
        matched: matched.length,
        hasMore,
        pageToken: hasMore ? (token ?? '') : '',
        items: matched,
      };
    },
  });
}

export function createSendTool({ auth, fetchImpl, harness = null }) {
  return defineFeishuTool({
    name: SEND_TOOL_NAME,
    description: '以本人身份发送交互卡片、图片或文件。',
    timeoutMs: 30_000,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'other',
      title: args?.path ? `以本人身份发送文件：${args.name || args.path}` : `以本人身份发送飞书卡片${args?.title ? `：${args.title}` : ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chatId: { type: 'string', description: '会话 chat_id（oc_…）；与 openId、email 三选一，引用回复时必填。' },
        openId: { type: 'string', description: '联系人 open_id（ou_…）；与 chatId、email 三选一。' },
        email: { type: 'string', description: '联系人飞书邮箱；与 chatId、openId 三选一。' },
        title: { type: 'string', description: '卡片标题，最多 100 字符，可选。' },
        color: { type: 'string', description: '卡片标题颜色，可选，须配合 title，如 blue / green / orange / red / grey。' },
        text: { type: 'string', description: `Markdown 正文，最多 ${MAX_TEXT_LENGTH} 字符；与 path 二选一。` },
        path: { type: 'string', description: '本地图片/文件路径（相对会话工作区）；与 text 二选一。图片上限 10MB，文件上限 30MB。' },
        name: { type: 'string', description: '文件显示名，仅 path 模式可选。' },
        replyToMessageId: { type: 'string', description: '引用回复的消息 id（om_…）；仅支持 text + chatId，不可与 path/openId/email 同用。' },
      },
      required: [],
    },
    output: {
      schema: SEND_OUTPUT_SCHEMA,
      render: (args, value) => {
        const target = value.chatId || args?.openId || args?.email || '指定会话';
        if (value.kind === 'image') {
          return renderToolOutput(value, `已以本人身份发送图片到 ${target}（消息 ${value.messageId}）。`);
        }
        if (value.kind === 'file') {
          return renderToolOutput(value, `已以本人身份发送文件「${value.fileName || '未命名'}」到 ${target}（消息 ${value.messageId}）。`);
        }
        return renderToolOutput(value, `已以本人身份发送卡片到 ${target}（消息 ${value.messageId}）。`);
      },
    },
    async execute(args, context) {
      const chatId = typeof args?.chatId === 'string' ? args.chatId.trim() : '';
      const openId = typeof args?.openId === 'string' ? args.openId.trim() : '';
      const email = typeof args?.email === 'string' ? args.email.trim() : '';
      const targets = [chatId, openId, email].filter(Boolean);
      if (targets.length !== 1) throw new Error('chatId、openId、email 必须且只能提供一个');

      const text = typeof args?.text === 'string' ? args.text.trim() : '';
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      const title = typeof args?.title === 'string' ? args.title.trim() : '';
      const color = typeof args?.color === 'string' ? args.color.trim() : '';
      const name = typeof args?.name === 'string' ? args.name.trim() : '';
      const replyToMessageId = typeof args?.replyToMessageId === 'string' ? args.replyToMessageId.trim() : '';
      if ((text && path) || (!text && !path)) throw new Error('text 和 path 必须且只能提供一个');
      if (path && (title || color)) throw new Error('title/color 仅用于文本卡片');
      if (replyToMessageId && path) throw new Error('replyToMessageId 仅支持文本卡片，不能与 path 同用');
      if (replyToMessageId && !chatId) throw new Error('replyToMessageId 需要同时提供 chatId');
      if (text) validateCardText(text, title, MAX_TEXT_LENGTH);

      const recipient = {
        chatId: chatId || undefined,
        openId: openId || undefined,
        email: email || undefined,
        fetchImpl,
        signal: context?.signal,
      };
      if (path) {
        const tokenSession = createTokenSession(auth, { signal: context?.signal });
        const cwd = await resolveSessionCwd(context, harness);
        const sandboxMode = resolveSandboxMode(context, harness);
        const sent = await sendMediaMessage({
          ...recipient,
          path,
          name: name || undefined,
          cwd,
          sandboxMode,
          withToken: (operation) => tokenSession.run(operation),
        });
        return {
          kind: sent.kind,
          messageId: sent.messageId,
          chatId: sent.chatId,
          ...(sent.createTime ? { sentAt: sent.createTime } : {}),
          ...(sent.name ? { fileName: sent.name } : {}),
        };
      }
      const sent = await withAccessToken(auth, (accessToken) => (replyToMessageId
        ? replyCardMessage({
          accessToken,
          messageId: replyToMessageId,
          chatId,
          text,
          title: title || undefined,
          color: color || undefined,
          fetchImpl,
          signal: context?.signal,
        })
        : sendCardMessage({
          ...recipient,
          accessToken,
          text,
          title: title || undefined,
          color: color || undefined,
        })), context?.signal);
      return {
        kind: 'card',
        messageId: sent.messageId,
        chatId: sent.chatId,
        ...(sent.createTime ? { sentAt: sent.createTime } : {}),
      };
    },
  });
}

export function createRecallTool({ auth, fetchImpl }) {
  return defineFeishuTool({
    name: RECALL_TOOL_NAME,
    description: '以本人身份撤回自己发出的一条飞书消息，受企业撤销时限约束。',
    timeoutMs: 15_000,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'delete',
      title: `以本人身份撤回消息：${args?.messageId ?? ''}`,
    }),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
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
        value.recalled ? `已以本人身份撤回消息 ${value.messageId}。` : `撤回失败：${value.messageId}。`,
      ),
    },
    async execute(args, context) {
      const messageId = typeof args?.messageId === 'string' ? args.messageId.trim() : '';
      if (!/^om_[\w-]+$/.test(messageId)) throw new Error('messageId 需要是 om_ 开头的消息 ID');
      const tokenSession = createTokenSession(auth, { signal: context?.signal });
      return tokenSession.run((accessToken) => deleteMessage({
        accessToken,
        messageId,
        expectedSenderOpenId: tokenSession.openId || auth?.availability?.()?.user?.openId || undefined,
        fetchImpl,
        signal: context?.signal,
      }));
    },
  });
}

export function createUserIdentityTools({ auth, fetchImpl, harness } = {}) {
  return [
    createChatsTool({ auth, fetchImpl }),
    createPeopleTool({ auth, fetchImpl }),
    createMessagesTool({ auth, fetchImpl }),
    createSendTool({ auth, fetchImpl, harness }),
    createRecallTool({ auth, fetchImpl }),
    createDocReadTool({ auth, fetchImpl }),
    createDocWriteTool({ auth, fetchImpl }),
    createDocFileTool({ auth, fetchImpl, harness }),
  ];
}
