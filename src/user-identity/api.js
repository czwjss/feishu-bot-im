/**
 * 以用户身份调飞书 OpenAPI 的最小封装。
 *
 * 只覆盖分身第一版需要的三个能力：用户信息、会话历史、发送文本消息。
 * 所有请求都使用 user_access_token（`Authorization: Bearer …`）。
 */
import { normalizeCardColor, noticeCard } from '../cards.js';
import { FeishuApiError, describeApiCode } from './errors.js';

export const FEISHU_API_ORIGIN = 'https://open.feishu.cn';
export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_TEXT_LENGTH = 8_000;

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

function parseJsonObject(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function requestSignal({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const timeout = AbortSignal.timeout(Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * 发请求并校验飞书业务错误码；返回 `payload.data`。
 */
async function requestFeishu({
  path,
  method = 'GET',
  query,
  body,
  accessToken,
  fetchImpl = fetch,
  timeoutMs,
  signal,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('飞书 API 需要 fetch 实现');
  const url = new URL(path, FEISHU_API_ORIGIN);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const headers = { accept: 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['content-type'] = 'application/json; charset=utf-8';

  const response = await fetchImpl(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: requestSignal({ timeoutMs, signal }),
  });
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
    path: '/open-apis/authen/v1/user_info',
    accessToken,
    fetchImpl,
    timeoutMs,
    signal,
  });
  return normalizeUserInfo(data);
}

/**
 * 群聊 ID 校验：`oc_` 开头。分身不替用户猜群，只接受明确 ID。
 */
export function normalizeChatId(value) {
  const chatId = typeof value === 'string' ? value.trim() : '';
  if (!/^oc_[A-Za-z0-9_-]{4,}$/.test(chatId)) {
    throw new Error('chatId 需要是 oc_ 开头的群 ID');
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

function toEpochSeconds(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value > 1e12 ? value / 1000 : value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    return Math.floor(number > 1e12 ? number / 1000 : number);
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${label} 需要是 ISO 8601 时间或秒级时间戳`);
  return Math.floor(parsed / 1000);
}

function formatCreateTime(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number).toISOString();
}

/** 把 post（富文本）消息拼成纯文本。 */
function postToText(content) {
  const localized = content?.zh_cn ?? content?.en_us ?? content?.ja_jp ?? content;
  if (!localized || typeof localized !== 'object') return '';
  const title = stringOf(localized.title);
  const paragraphs = Array.isArray(localized.content) ? localized.content : [];
  const lines = paragraphs.map((paragraph) => {
    if (!Array.isArray(paragraph)) return '';
    return paragraph.map((node) => {
      if (!node || typeof node !== 'object') return '';
      if (typeof node.text === 'string') return node.text;
      if (typeof node.href === 'string') return node.href;
      return '';
    }).join('');
  });
  return [title, ...lines].filter((line) => line).join('\n');
}

export function extractMessageText(item) {
  const messageType = stringOf(item?.msg_type);
  const content = parseJsonObject(item?.body?.content) ?? {};
  switch (messageType) {
    case 'text':
      return stringOf(content.text);
    case 'post':
      return postToText(content);
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
      return '[卡片]';
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

export function normalizeMessage(item) {
  const source = item && typeof item === 'object' ? item : {};
  const sender = source.sender && typeof source.sender === 'object' ? source.sender : {};
  return Object.freeze({
    messageId: stringOf(source.message_id),
    parentId: stringOf(source.parent_id),
    chatId: stringOf(source.chat_id),
    msgType: stringOf(source.msg_type),
    createTime: formatCreateTime(source.create_time),
    senderOpenId: stringOf(sender.id),
    senderName: stringOf(sender.name),
    senderType: stringOf(sender.sender_type),
    deleted: Boolean(source.deleted),
    text: extractMessageText(source),
  });
}

/**
 * 读群历史消息。分页 token 由调用方原样带回来。
 */
export async function listMessages({
  accessToken,
  chatId,
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
  const size = Math.min(50, Math.max(1, Number.parseInt(String(pageSize ?? 20), 10) || 20));
  const query = {
    container_id_type: 'chat',
    container_id: containerId,
    page_size: size,
    sort_type: sort === 'asc' ? 'ByCreateTimeAsc' : 'ByCreateTimeDesc',
  };
  const start = toEpochSeconds(startTime, 'startTime');
  const end = toEpochSeconds(endTime, 'endTime');
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
  return Object.freeze({
    chatId: containerId,
    items: Object.freeze(items),
    hasMore: Boolean(data.has_more),
    pageToken: stringOf(data.page_token) || null,
  });
}

/** 本地关键词筛选（不是飞书全文搜索）。 */
export function filterMessagesByKeyword(items, keyword) {
  const needle = typeof keyword === 'string' ? keyword.trim().toLowerCase() : '';
  if (!needle) return items;
  return items.filter((item) => {
    const text = `${item.text ?? ''} ${item.senderName ?? ''}`.toLowerCase();
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
  return Object.freeze({
    messageId: stringOf(data.message_id),
    chatId: stringOf(data.chat_id) || (receiveIdType === 'chat_id' ? receiveId : ''),
    createTime: formatCreateTime(data.create_time),
    msgType: stringOf(data.msg_type) || msgType,
  });
}

function validateText(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) throw new Error('text 不能为空');
  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error(`text 过长（${value.length} 字符），单条上限 ${MAX_TEXT_LENGTH} 字符`);
  }
  return value;
}

/**
 * 以授权用户身份发送文本消息（普通 text 消息）。
 */
export async function sendTextMessage({
  accessToken,
  chatId,
  openId,
  email,
  text,
  fetchImpl,
  timeoutMs,
  signal,
} = {}) {
  const [receiveIdType, receiveId] = resolveReceiveTarget({ chatId, openId, email });
  const value = validateText(text);
  return postUserMessage({
    accessToken,
    receiveIdType,
    receiveId,
    msgType: 'text',
    content: JSON.stringify({ text: value }),
    fetchImpl,
    timeoutMs,
    signal,
  });
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
  const value = validateText(text);
  const heading = typeof title === 'string' ? title.trim() : '';
  if (heading.length > 100) throw new Error('title 最多 100 字符');
  if (color && !heading) throw new Error('color 需要同时提供 title');
  const card = noticeCard(value, heading || null, normalizeCardColor(color));
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
