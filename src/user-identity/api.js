import { messageContentOf, messageTypeOf, decodePost, renderPostText } from '../message-content.js';
/**
 * 以用户身份调飞书 OpenAPI 的最小封装。
 *
 * 覆盖用户信息、会话历史、卡片/图片/文件发送。
 * 所有请求都使用 user_access_token（`Authorization: Bearer …`）。
 */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { resolveReadableLocalFile } from '../local-path.js';

import { normalizeCardColor, noticeCard } from '../cards.js';
import { imageKeysOf, readImageBytes } from '../inbound.js';
import { applyMentionPlaceholders, cardStreamingOf, interactiveTextOfContent } from '../message-text.js';
import { FeishuApiError, describeApiCode } from './errors.js';
import { USER_INFO_URL } from './oauth.js';
import { historyTimeRange, validateCardText } from '../tool-contract.js';

export const FEISHU_API_ORIGIN = 'https://open.feishu.cn';
export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_TEXT_LENGTH = 8_000;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

const IMAGE_MIME = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
});

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

function requestSignal({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const timeout = AbortSignal.timeout(Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * 发请求并校验飞书业务错误码；默认返回 `payload.data`，二进制下载返回响应流。
 */
export async function requestFeishu({
  path,
  method = 'GET',
  query,
  body,
  accessToken,
  fetchImpl = fetch,
  timeoutMs,
  signal,
  responseType = 'json',
}) {
  signal?.throwIfAborted();
  if (typeof fetchImpl !== 'function') throw new TypeError('飞书 API 需要 fetch 实现');
  const url = new URL(path, FEISHU_API_ORIGIN);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const headers = { accept: responseType === 'binary' ? '*/*' : 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json; charset=utf-8';

  const response = await fetchImpl(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    signal: requestSignal({ timeoutMs, signal }),
  });
  if (responseType === 'binary' && response.ok) {
    const mediaType = response.headers?.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    // Feishu can return a JSON business error with HTTP 200. An attachment can itself be JSON.
    if (mediaType !== 'application/json' || response.headers?.get('content-disposition')) return response;
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const feishuCode = payload && typeof payload.code === 'number' ? payload.code : null;
  if (feishuCode !== null && feishuCode !== 0) {
    const detail = describeApiCode(feishuCode);
    const message = detail
      ? `${detail}（code ${feishuCode}）`
      : `${stringOf(payload.msg) || '飞书接口调用失败'}（code ${feishuCode}）`;
    throw new FeishuApiError(message, {
      feishuCode,
      logId: stringOf(payload.error?.log_id ?? payload.log_id) || null,
      violations: payload.error?.permission_violations ?? [],
      status: response.status,
    });
  }
  if (!response.ok) {
    throw new FeishuApiError(`飞书接口返回 HTTP ${response.status}`, { status: response.status });
  }
  if (!payload || typeof payload !== 'object') {
    throw new FeishuApiError('飞书接口返回了无法解析的响应', { status: response.status });
  }
  if (responseType === 'binary') {
    throw new FeishuApiError('飞书未返回文件内容', { status: response.status });
  }
  return payload.data ?? {};
}

/** 飞书返回的 data 可能缺字段；工具输出统一转成字符串。 */
export function normalizeUserInfo(data) {
  const source = data && typeof data === 'object' ? data : {};
  return Object.freeze({
    name: stringOf(source.name),
    enName: stringOf(source.en_name),
    avatarUrl: stringOf(source.avatar_big || source.avatar_url || source.avatar_middle || source.avatar_thumb),
    openId: stringOf(source.open_id),
    unionId: stringOf(source.union_id),
    userId: stringOf(source.user_id),
    email: stringOf(source.enterprise_email || source.email),
    tenantKey: stringOf(source.tenant_key),
  });
}

/** 当前 user_access_token 对应的授权用户。 */
export async function getUserInfo({ accessToken, fetchImpl, timeoutMs, signal } = {}) {
  const data = await requestFeishu({
    path: new URL(USER_INFO_URL).pathname,
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  return normalizeUserInfo(data);
}

/** 用户身份可见的会话（私聊/群聊）列表。 */
export function normalizeChat(item) {
  const source = item && typeof item === 'object' ? item : {};
  const mode = stringOf(source.chat_mode);
  return Object.freeze({
    chatId: stringOf(source.chat_id),
    name: stringOf(source.name),
    description: stringOf(source.description),
    chatMode: mode === 'p2p' ? 'p2p' : 'group',
    chatType: stringOf(source.chat_type),
    external: Boolean(source.external),
    avatar: stringOf(source.avatar),
    ownerId: stringOf(source.owner_id),
    createTime: formatCreateTime(source.create_time),
    lastMessageAt: formatCreateTime(source.last_message_time),
  });
}

/**
 * 列出授权用户能看到的会话。
 * 用户身份没有个人收件箱事件推送，监听器先用这个接口发现会话。
 */
export async function listChats({
  accessToken,
  pageSize = 100,
  pageToken,
  types = 'p2p,group',
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const size = Math.min(100, Math.max(1, Number.parseInt(String(pageSize ?? 100), 10) || 100));
  const query = {
    user_id_type: 'open_id',
    sort_type: 'ByActiveTimeDesc',
    types,
    page_size: size,
  };
  if (typeof pageToken === 'string' && pageToken.trim()) query.page_token = pageToken.trim();
  const data = await requestFeishu({
    path: '/open-apis/im/v1/chats',
    query,
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  const items = Array.isArray(data.items) ? data.items.map(normalizeChat) : [];
  return Object.freeze({
    items: Object.freeze(items.filter((item) => item.chatId && /^oc_[A-Za-z0-9_-]{4,}$/.test(item.chatId))),
    hasMore: Boolean(data.has_more),
    pageToken: stringOf(data.page_token) || null,
  });
}

/** 按群名搜索授权用户已经加入的群聊。 */
export async function searchChats({ accessToken, query, pageSize, pageToken, fetchImpl, timeoutMs, signal }) {
  // Feishu interprets an unquoted hyphen as search syntax.
  const keyword = query.includes('-') && !(query.startsWith('"') && query.endsWith('"'))
    ? JSON.stringify(query)
    : query;
  const data = await requestFeishu({
    path: '/open-apis/im/v2/chats/search',
    method: 'POST',
    query: { page_size: pageSize, page_token: pageToken },
    body: {
      query: keyword,
      filter: { search_types: ['private', 'external', 'public_joined'], disable_search_by_user: true },
    },
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  const items = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    const chat = item?.meta_data;
    const chatId = stringOf(chat?.chat_id);
    if (!/^oc_[A-Za-z0-9_-]{4,}$/.test(chatId)) continue;
    items.push({
      chatId,
      name: stringOf(chat.name),
      description: stringOf(chat.description),
      external: chat.external === true,
      chatStatus: stringOf(chat.chat_status),
    });
  }
  const hasMore = data.has_more === true;
  const nextToken = stringOf(data.page_token) || stringOf(data.next_page_token);
  if (hasMore && (!nextToken || nextToken === pageToken)) {
    throw new FeishuApiError('飞书分页游标缺失或未前进，请重新查询');
  }
  const notice = stringOf(data.notice);
  return { items, hasMore, pageToken: hasMore ? nextToken : '', ...(notice ? { notice } : {}) };
}

/**
 * 群聊 ID 校验：`oc_` 开头。分身不替用户猜群，只接受明确 ID。
 */
export function normalizeChatId(value) {
  const chatId = typeof value === 'string' ? value.trim() : '';
  if (!/^oc_[A-Za-z0-9_-]{4,}$/.test(chatId)) {
    throw new Error('chatId 需要是 oc_ 开头的会话 ID（私聊或群聊）');
  }
  return chatId;
}

/** 指定联系人：open_id（ou_…）。 */
export function normalizeOpenId(value) {
  const openId = typeof value === 'string' ? value.trim() : '';
  if (!/^ou_[A-Za-z0-9_-]{4,}$/.test(openId)) {
    throw new Error('openId 需要是 ou_ 开头的用户 open_id');
  }
  return openId;
}

/** 指定联系人：飞书邮箱。 */
export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('email 需要是有效的邮箱地址');
  }
  return email;
}

function resolveReceiveTarget({ chatId, openId, email }) {
  const targets = [
    ['chat_id', chatId === undefined || chatId === '' ? '' : normalizeChatId(chatId)],
    ['open_id', openId === undefined || openId === '' ? '' : normalizeOpenId(openId)],
    ['email', email === undefined || email === '' ? '' : normalizeEmail(email)],
  ].filter(([, value]) => value);
  if (targets.length !== 1) {
    throw new Error('chatId、openId、email 必须且只能提供一个');
  }
  return targets[0];
}

function formatCreateTime(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number).toISOString();
}

export function extractMessageText(item) {
  const messageType = messageTypeOf(item);
  const content = messageContentOf(item);
  switch (messageType) {
    case 'text':
      return applyMentionPlaceholders(content.text, item?.mentions);
    case 'post':
      return renderPostText(decodePost(content));
    case 'image':
      return '[图片]';
    case 'file':
      return content.file_name ? `[文件] ${content.file_name}` : '[文件]';
    case 'audio':
      return '[语音]';
    case 'media':
      return '[视频]';
    case 'sticker':
      return '[表情]';
    case 'interactive':
      // 卡片默认只拿到精简投影；调用方传 card_msg_content_type 时才拿到原始卡片。
      return interactiveTextOfContent(content, { maxLength: Infinity }) || '[卡片]';
    case 'share_chat':
      return '[群名片]';
    case 'share_user':
      return '[个人名片]';
    case 'system':
      return stringOf(content.template) ? `[系统消息] ${content.template}` : '[系统消息]';
    default:
      return messageType ? `[${messageType}]` : '';
  }
}

function normalizeMentions(source) {
  const list = Array.isArray(source.mentions) ? source.mentions : [];
  const mentions = [];
  const seen = new Set();
  for (const item of list) {
    const openId = stringOf(item?.id?.open_id) || stringOf(item?.id);
    if (!openId || seen.has(openId)) continue;
    seen.add(openId);
    mentions.push(Object.freeze({ openId, name: stringOf(item?.name) }));
  }
  return Object.freeze(mentions);
}

export function normalizeMessage(item) {
  const source = item && typeof item === 'object' ? item : {};
  const sender = source.sender && typeof source.sender === 'object' ? source.sender : {};
  return Object.freeze({
    messageId: stringOf(source.message_id),
    parentId: stringOf(source.parent_id),
    rootId: stringOf(source.root_id),
    chatId: stringOf(source.chat_id),
    threadId: stringOf(source.thread_id),
    msgType: stringOf(source.msg_type),
    createTime: formatCreateTime(source.create_time),
    senderOpenId: stringOf(sender.open_bot_id) || stringOf(sender.id),
    senderName: stringOf(sender.sender_name) || stringOf(sender.name),
    senderType: stringOf(sender.sender_type),
    deleted: Boolean(source.deleted),
    bodyContent: stringOf(source.body?.content),
    imageKeys: Object.freeze(imageKeysOf(source)),
    mentions: normalizeMentions(source),
    streaming: cardStreamingOf(source.body?.content),
    text: extractMessageText(source),
  });
}

/** 单条消息（含合并转发 merge_forward 的子消息列表）。 */
export async function getMessage({
  accessToken,
  messageId,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const id = stringOf(messageId).trim();
  if (!id) throw new Error('messageId 不能为空');
  const data = await requestFeishu({
    path: `/open-apis/im/v1/messages/${encodeURIComponent(id)}`,
    query: { card_msg_content_type: 'user_card_content', user_id_type: 'open_id' },
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) return null;
  const primary = normalizeMessage(items[0]);
  if (items.length === 1) return primary;
  return Object.freeze({
    ...primary,
    subMessages: Object.freeze(items.slice(1).map(normalizeMessage)),
  });
}

export async function downloadMessageImage({ request, messageId, imageKey, maxBytes, signal }) {
  if (!/^[\w-]+$/.test(imageKey)) throw new Error('飞书返回的图片 key 无效');
  const response = await request({
    path: `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/resources/${encodeURIComponent(imageKey)}`,
    query: { type: 'image' },
    responseType: 'binary',
  });
  if (response.status !== 200 || response.headers?.has('content-range')) {
    await response.body?.cancel().catch(() => undefined);
    throw new FeishuApiError('飞书未返回完整图片', { status: response.status });
  }
  return readImageBytes(response.body, maxBytes, signal);
}

/** 以用户身份下载历史消息中的普通文件资源。 */
export async function downloadMessageFile({ request, messageId, fileKey, maxBytes = MAX_FILE_BYTES, signal }) {
  if (!/^[\w-]+$/.test(fileKey)) throw new Error('飞书返回的文件 key 无效');
  const response = await request({
    path: `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/resources/${encodeURIComponent(fileKey)}`,
    query: { type: 'file' },
    responseType: 'binary',
    timeoutMs: 120_000,
  });
  if (response.status !== 200 || response.headers?.has('content-range')) {
    await response.body?.cancel().catch(() => undefined);
    throw new FeishuApiError('飞书未返回完整文件', { status: response.status });
  }
  return readImageBytes(response.body, maxBytes, signal);
}

/**
 * 读群历史或话题回复。分页 token 由调用方原样带回来。
 */
export async function listMessages({
  accessToken,
  chatId,
  threadId,
  startTime,
  endTime,
  pageSize = 20,
  pageToken,
  sort = 'desc',
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const containerId = normalizeChatId(chatId);
  const thread = typeof threadId === 'string' ? threadId.trim() : '';
  const { start, end } = historyTimeRange(startTime, endTime);
  if (thread && (start !== null || end !== null)) {
    throw new Error('threadId 不支持 startTime/endTime，请只使用 threadId 或按 chatId 查询时间范围');
  }
  const size = Math.min(50, Math.max(1, Number.parseInt(String(pageSize ?? 20), 10) || 20));
  const query = {
    container_id_type: thread ? 'thread' : 'chat',
    container_id: thread || containerId,
    page_size: size,
    sort_type: sort === 'asc' ? 'ByCreateTimeAsc' : 'ByCreateTimeDesc',
    // 卡片默认返回精简投影；要原始卡片 JSON 才读得到正文。
    card_msg_content_type: 'user_card_content',
    with_sender_name: true,
  };
  if (start !== null) query.start_time = start;
  if (end !== null) query.end_time = end;
  if (typeof pageToken === 'string' && pageToken.trim()) query.page_token = pageToken.trim();

  const data = await requestFeishu({
    path: '/open-apis/im/v1/messages',
    query,
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  const items = Array.isArray(data.items) ? data.items.map(normalizeMessage) : [];
  if (thread) {
    for (const item of items) {
      if (item.chatId && item.chatId !== containerId) {
        throw new Error('该 thread 不属于指定会话');
      }
    }
  }
  return Object.freeze({
    chatId: containerId,
    threadId: thread,
    items: Object.freeze(items),
    hasMore: Boolean(data.has_more),
    pageToken: stringOf(data.page_token) || null,
  });
}

const MEMBER_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const avatarMemberCache = new Map();

/** 仅查本地内存缓存中的群成员姓名（不触发网络请求），供单条消息回填。 */
export function lookupCachedMemberName(chatId, openId) {
  if (!chatId || !openId) return '';
  const cached = avatarMemberCache.get(chatId);
  if (!cached || Date.now() - cached.at >= MEMBER_CACHE_TTL_MS) return '';
  return cached.members.find((item) => item.openId === openId)?.name ?? '';
}

/** 模糊查询本人所在群的成员（带 6 小时缓存，最多返回 10 个候选；超 2000 人不缓存残缺名单）。 */
export async function findChatMembers({
  accessToken,
  chatId,
  query,
  refresh = false,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const containerId = normalizeChatId(chatId);
  const needle = String(query ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  if (!needle) throw new Error('查询关键词不能为空');
  signal?.throwIfAborted();

  let members;
  const cached = avatarMemberCache.get(containerId);
  if (!refresh && cached && Date.now() - cached.at < MEMBER_CACHE_TTL_MS) {
    members = cached.members;
  } else {
    const map = await chatMemberNames({ accessToken, chatId: containerId, strict: true, fetchImpl, timeoutMs, signal });
    members = [...map.entries()].map(([openId, name]) => ({ openId, name }));
    avatarMemberCache.set(containerId, { at: Date.now(), members });
    if (avatarMemberCache.size > 100) avatarMemberCache.delete(avatarMemberCache.keys().next().value);
  }

  const ranked = [];
  for (const member of members) {
    const name = String(member.name ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    const openId = String(member.openId ?? '').toLowerCase();
    const rank = name === needle || openId === needle ? 0
      : name.startsWith(needle) ? 1
        : (name.includes(needle) || openId.includes(needle)) ? 2 : -1;
    if (rank >= 0) ranked.push({ rank, name: member.name || member.openId, openId: member.openId });
  }
  ranked.sort((left, right) => left.rank - right.rank || String(left.name).localeCompare(String(right.name)));
  return {
    chatId: containerId,
    matched: ranked.length,
    hasMore: ranked.length > 10,
    people: ranked.slice(0, 10).map(({ name, openId }) => ({ name, openId })),
  };
}

/** 撤回当前授权用户本人发出的一条消息（先核对发送者归属）。 */
export async function deleteMessage({
  accessToken,
  messageId,
  expectedSenderOpenId,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const id = stringOf(messageId).trim();
  if (!/^om_[\w-]+$/.test(id)) throw new Error('messageId 需要是 om_ 开头的消息 ID');
  const original = await getMessage({ accessToken, messageId: id, fetchImpl, timeoutMs, signal });
  if (!original || original.deleted) throw new Error('找不到要撤回的消息或该消息已撤回');
  if (expectedSenderOpenId && original.senderOpenId && original.senderOpenId !== expectedSenderOpenId) {
    throw new Error('只能撤回当前授权用户本人发送的消息');
  }
  await requestFeishu({
    path: `/open-apis/im/v1/messages/${encodeURIComponent(id)}`,
    method: 'DELETE',
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  return { recalled: true, messageId: id };
}

/**
 * 会话成员姓名表（open_id → 姓名）。
 *
 * 消息列表可能缺少发送者姓名，展示时可用成员表补齐。
 * 读不到成员（外部群等）时返回空 Map，调用方退化为 open_id。
 */
export async function chatMemberNames({
  accessToken,
  chatId,
  pageSize = 100,
  strict = false,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const containerId = normalizeChatId(chatId);
  const names = new Map();
  let pageToken = null;
  for (let page = 0; page < 20; page += 1) {
    const data = await requestFeishu({
      path: `/open-apis/im/v1/chats/${encodeURIComponent(containerId)}/members`,
      query: {
        member_id_type: 'open_id',
        page_size: Math.min(100, Math.max(1, Number(pageSize) || 100)),
        ...(pageToken ? { page_token: pageToken } : {}),
      },
      accessToken,
      fetchImpl,
      timeoutMs,
      signal,
    });
    for (const item of Array.isArray(data.items) ? data.items : []) {
      const id = stringOf(item?.member_id);
      const name = stringOf(item?.name).trim();
      if (id && name) names.set(id, name);
    }
    if (!data.has_more) break;
    const nextToken = stringOf(data.page_token) || null;
    if (!nextToken || nextToken === pageToken) {
      if (strict) throw new Error('飞书群成员分页游标缺失或未前进，未缓存不完整成员表');
      break;
    }
    if (page === 19) {
      if (strict) throw new Error('飞书群成员超过本次 2000 人读取上限，未缓存不完整成员表');
      break;
    }
    pageToken = nextToken;
  }
  return names;
}

/** 本地关键词筛选（不是飞书全文搜索）。 */
export function filterMessagesByKeyword(items, keyword) {
  const needle = typeof keyword === 'string' ? keyword.normalize('NFKC').trim().toLowerCase() : '';
  if (!needle) return items;
  return items.filter((item) => {
    const text = `${item.text ?? ''} ${item.senderName ?? ''}`.normalize('NFKC').toLowerCase();
    return text.includes(needle);
  });
}

async function postUserMessage({
  accessToken,
  receiveIdType,
  receiveId,
  msgType,
  content,
  fetchImpl,
  timeoutMs,
  signal,
}) {
  const data = await requestFeishu({
    path: '/open-apis/im/v1/messages',
    method: 'POST',
    query: { receive_id_type: receiveIdType },
    body: { receive_id: receiveId, msg_type: msgType, content },
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  if (!stringOf(data.message_id)) throw new FeishuApiError('飞书发送未返回 message_id，无法确认发送结果');
  return Object.freeze({
    messageId: stringOf(data.message_id),
    chatId: stringOf(data.chat_id) || (receiveIdType === 'chat_id' ? receiveId : ''),
    createTime: formatCreateTime(data.create_time),
    msgType: stringOf(data.msg_type) || msgType,
  });
}

function userCard(text, title, color) {
  const { body, heading } = validateCardText(text, title, MAX_TEXT_LENGTH);
  if (color && !heading) throw new Error('color 需要同时提供 title');
  return noticeCard(body, heading || null, normalizeCardColor(color));
}

/**
 * 以授权用户身份发送交互卡片。正文用 Markdown，可选标题和标题颜色。
 */
export async function sendCardMessage({
  accessToken,
  chatId,
  openId,
  email,
  text,
  title,
  color,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const [receiveIdType, receiveId] = resolveReceiveTarget({ chatId, openId, email });
  const card = userCard(text, title, color);
  return postUserMessage({
    accessToken,
    receiveIdType,
    receiveId,
    msgType: 'interactive',
    content: JSON.stringify(card),
    fetchImpl,
    timeoutMs,
    signal,
  });
}


/**
 * 以用户身份回复某条消息（保持引用关系）。
 * 是否引用由调用方的回复规则决定。
 */
export async function replyCardMessage({
  accessToken,
  messageId,
  chatId,
  text,
  title,
  color,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const id = stringOf(messageId).trim();
  if (!id) throw new Error('messageId 不能为空');
  const card = userCard(text, title, color);
  if (chatId !== undefined) {
    const target = normalizeChatId(chatId);
    const original = await getMessage({ accessToken, messageId: id, fetchImpl, timeoutMs, signal });
    if (!original?.chatId || original.chatId !== target) throw new Error('replyToMessageId 不属于指定 chatId，已取消发送');
  }
  const data = await requestFeishu({
    path: `/open-apis/im/v1/messages/${encodeURIComponent(id)}/reply`,
    method: 'POST',
    body: { msg_type: 'interactive', content: JSON.stringify(card) },
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  if (!stringOf(data.message_id)) throw new FeishuApiError('飞书回复未返回 message_id，无法确认发送结果');
  return Object.freeze({
    messageId: stringOf(data.message_id),
    chatId: stringOf(data.chat_id),
    createTime: formatCreateTime(data.create_time),
    msgType: stringOf(data.msg_type) || 'interactive',
  });
}

function safeFileName(value, fallback) {
  const name = typeof value === 'string' ? value.trim() : '';
  return basename(name || fallback || 'file').replace(/[\u0000-\u001f]/g, '').slice(0, 120) || 'file';
}

async function uploadUserMedia({
  accessToken,
  path,
  name,
  cwd,
  sandboxMode = null,
  fetchImpl = fetch,
  timeoutMs,
  signal,
} = {}) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('path 不能为空');
  if (typeof fetchImpl !== 'function') throw new TypeError('飞书 API 需要 fetch 实现');
  const { realPath: absolute, info } = await resolveReadableLocalFile(path, { cwd, signal, sandboxMode });
  const fileName = safeFileName(name, basename(absolute));
  const sourceExt = extname(absolute).toLowerCase();
  const extension = sourceExt || extname(fileName).toLowerCase();
  const mime = IMAGE_MIME[extension] ?? 'application/octet-stream';
  const isImage = Boolean(IMAGE_MIME[extension]);
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (info.size > limit) {
    throw new Error(`${isImage ? '图片' : '文件'}超过飞书 ${Math.round(limit / 1024 / 1024)}MB 上限`);
  }
  signal?.throwIfAborted?.();
  const bytes = await readFile(absolute, { signal });
  signal?.throwIfAborted?.();

  const form = new FormData();
  let endpoint;
  let keyField;
  if (isImage) {
    endpoint = '/open-apis/im/v1/images';
    keyField = 'image_key';
    form.set('image_type', 'message');
    form.append('image', new Blob([bytes], { type: mime }), fileName);
  } else {
    endpoint = '/open-apis/im/v1/files';
    keyField = 'file_key';
    form.set('file_type', 'stream');
    form.set('file_name', fileName);
    form.append('file', new Blob([bytes], { type: mime }), fileName);
  }
  const response = await fetchImpl(new URL(endpoint, FEISHU_API_ORIGIN), {
    method: 'POST',
    headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
    body: form,
    signal: requestSignal({ timeoutMs, signal }),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const code = payload && typeof payload.code === 'number' ? payload.code : null;
  if (code !== null && code !== 0) {
    const detail = describeApiCode(code);
    throw new FeishuApiError(detail ? `${detail}（code ${code}）` : `${stringOf(payload.msg) || '飞书上传失败'}（code ${code}）`, {
      feishuCode: code,
      status: response.status,
    });
  }
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new FeishuApiError(`飞书上传返回 HTTP ${response.status}`, { status: response.status });
  }
  const key = stringOf(payload.data?.[keyField] ?? payload[keyField]);
  if (!key) throw new FeishuApiError(`飞书上传没有返回 ${keyField}`, { status: response.status });
  return Object.freeze({ kind: isImage ? 'image' : 'file', key, name: fileName, bytes: bytes.length });
}

/**
 * 以授权用户身份发送本地图片或文件。
 * 图片按扩展名走 message image，其余走 file；先上传再发送。
 */
export async function sendMediaMessage({
  accessToken,
  chatId,
  openId,
  email,
  path,
  name,
  cwd,
  sandboxMode = null,
  fetchImpl,
  timeoutMs,
  signal,
  withToken = null,
} = {}) {
  const [receiveIdType, receiveId] = resolveReceiveTarget({ chatId, openId, email });
  const run = typeof withToken === 'function' ? withToken : (operation) => operation(accessToken);
  const uploaded = await run((token) => uploadUserMedia({
    accessToken: token,
    path,
    name,
    cwd,
    sandboxMode,
    fetchImpl,
    timeoutMs,
    signal,
  }));
  const content = uploaded.kind === 'image'
    ? JSON.stringify({ image_key: uploaded.key })
    : JSON.stringify({ file_key: uploaded.key, file_name: uploaded.name });
  const sent = await run((token) => postUserMessage({
    accessToken: token,
    receiveIdType,
    receiveId,
    msgType: uploaded.kind,
    content,
    fetchImpl,
    timeoutMs,
    signal,
  }));
  return Object.freeze({ ...sent, kind: uploaded.kind, name: uploaded.name, bytes: uploaded.bytes });
}
