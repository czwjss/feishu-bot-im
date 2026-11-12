/**
 * Thin Feishu Open Platform adapter.
 *
 * Wraps only what this plugin needs: tenant verification, text/card message
 * delivery, resource download and the long-connection event loop.
 */
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Lark from '@larksuiteoapi/node-sdk';

import { DELIVERY_RETRY_MS, isRetryableDeliveryError, sleep } from './feishu-errors.js';

const OPEN_ORIGIN = 'https://open.feishu.cn';
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const MEMBERSHIP_TTL_MS = 5 * 60 * 1_000;
const MEMBERSHIP_MISS_TTL_MS = 30 * 1_000;

function assertApiSuccess(operation, response) {
  if (response && typeof response === 'object' && typeof response.code === 'number' && response.code !== 0) {
    const error = new Error(`${operation} failed: ${response.msg || `code ${response.code}`}`);
    error.code = String(response.code);
    throw error;
  }
  return response;
}

/** Inline card reference content used by both chat send and thread reply. */
function cardRefContent(cardId) {
  return JSON.stringify({ type: 'card', data: { card_id: cardId } });
}

/** CardKit payload shared by create and full update. */
function cardJsonBody(card) {
  return { type: 'card_json', data: JSON.stringify(card) };
}

/** Read the tenant token and bot identity so a bad App ID/Secret fails fast. */
export async function verifyCredentials({ appId, appSecret, timeoutMs = 15_000 }) {
  if (!appId || !appSecret) throw new Error('App ID and App Secret are required');
  const http = Lark.defaultHttpInstance;
  const token = assertApiSuccess('Feishu authentication', await http.request({
    method: 'POST',
    url: `${OPEN_ORIGIN}/open-apis/auth/v3/tenant_access_token/internal`,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    data: { app_id: appId, app_secret: appSecret },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }));
  if (!token?.tenant_access_token) throw new Error('Feishu authentication returned no tenant access token');
  const info = assertApiSuccess('Feishu bot info', await http.request({
    method: 'GET',
    url: `${OPEN_ORIGIN}/open-apis/bot/v3/info/`,
    headers: { authorization: `Bearer ${token.tenant_access_token}` },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }));
  const bot = info?.bot ?? {};
  return Object.freeze({
    name: bot.app_name ?? bot.bot_name ?? null,
    openId: bot.open_id ?? null,
    activated: bot.activate_status ?? null,
  });
}

/** Feishu caps one text body; split on line boundaries well below it. */
export function splitText(text, limit = 3_500) {
  const value = typeof text === 'string' ? text : '';
  if (value.length <= limit) return [value];
  const chunks = [];
  let rest = value;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export class FeishuBot {
  #client;
  #ws;
  #appId;
  #appSecret;
  #token = null;
  #memberCache = new Map();
  #chatCache = new Map();
  #membershipCache = new Map();

  constructor({ appId, appSecret, client }) {
    this.#appId = appId;
    this.#appSecret = appSecret;
    // Tests inject a recording client; production builds the real SDK client.
    this.#client = client ?? new Lark.Client({ appId, appSecret, domain: Lark.Domain.Feishu });
  }

  get raw() {
    return this.#client;
  }

  /** Recall (delete) one message we sent; used to keep the chat clean. */
  async deleteMessage(messageId) {
    if (!messageId) return false;
    try {
      await this.#client.im.v1.message.delete({ path: { message_id: messageId } });
      return true;
    } catch {
      return false;
    }
  }

  /** Chat name (needs im:chat:readonly); null when unavailable. */
  async getChatName(chatId) {
    if (!chatId) return null;
    try {
      const response = await this.#client.im.v1.chat.get({ path: { chat_id: chatId } });
      const name = response?.data?.name ?? response?.data?.chat?.name;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    } catch {
      return null;
    }
  }

  /** Whether this bot is currently a member of the chat. */
  async isInChat(chatId, { refresh = false } = {}) {
    if (!chatId) return false;
    const cached = this.#membershipCache.get(chatId);
    if (!refresh && cached && Date.now() - cached.at < (cached.value ? MEMBERSHIP_TTL_MS : MEMBERSHIP_MISS_TTL_MS)) {
      return cached.value;
    }
    const response = assertApiSuccess('Feishu chat membership', await this.#client.im.v1.chatMembers.isInChat({
      path: { chat_id: chatId },
    }));
    const value = response?.data?.is_in_chat === true;
    this.#membershipCache.set(chatId, { at: Date.now(), value });
    return value;
  }

  /** Groups the bot belongs to, cached for six hours. */
  async getChats({ refresh = false } = {}) {
    const cached = this.#chatCache.get('all');
    if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.chats;
    const chats = [];
    const seen = new Set();
    let pageToken = '';
    for (let page = 0; page < 20; page += 1) {
      const response = assertApiSuccess('Feishu chat list', await this.#client.im.v1.chat.list({
        params: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
      }));
      for (const item of response?.data?.items ?? []) {
        const chatId = item?.chat_id;
        if (!chatId || seen.has(chatId)) continue;
        seen.add(chatId);
        chats.push({ chatId, name: String(item?.name ?? '').trim() });
      }
      if (!response?.data?.has_more) break;
      pageToken = response?.data?.page_token;
      if (!pageToken) break;
    }
    this.#chatCache.set('all', { at: Date.now(), chats });
    return chats;
  }

  /** Full chat roster (open_id + name), cached for six hours. */
  async getChatMembers(chatId, { refresh = false } = {}) {
    if (!chatId) return [];
    const cached = this.#memberCache.get(chatId);
    if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.members;
    const members = [];
    const seen = new Set();
    let pageToken = '';
    for (let page = 0; page < 20; page += 1) {
      const response = assertApiSuccess('Feishu chat members', await this.#client.im.v1.chatMembers.get({
        path: { chat_id: chatId },
        params: { member_id_type: 'open_id', page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
      }));
      for (const item of response?.data?.items ?? []) {
        const openId = item?.member_id;
        if (!openId || seen.has(openId)) continue;
        seen.add(openId);
        members.push({ openId, name: String(item?.name ?? '').trim() });
      }
      if (!response?.data?.has_more) break;
      pageToken = response?.data?.page_token;
      if (!pageToken) break;
    }
    this.#memberCache.set(chatId, { at: Date.now(), members });
    return members;
  }

  /** Read one page of chat/thread history; times are epoch milliseconds. */
  async listMessages(chatId, {
    threadId = null,
    startTime = null,
    endTime = null,
    pageSize = 20,
    pageToken = null,
    order = 'newest',
    withSenderName = true,
  } = {}) {
    if (!threadId && !chatId) throw new Error('缺少 chatId 或 threadId');
    const params = {
      container_id_type: threadId ? 'thread' : 'chat',
      container_id: threadId || chatId,
      page_size: Math.min(50, Math.max(1, Number(pageSize) || 20)),
      sort_type: order === 'oldest' ? 'ByCreateTimeAsc' : 'ByCreateTimeDesc',
      with_sender_name: withSenderName === true,
    };
    if (startTime) params.start_time = String(Math.floor(Number(startTime) / 1000));
    if (endTime) params.end_time = String(Math.floor(Number(endTime) / 1000));
    if (pageToken) params.page_token = pageToken;
    const response = assertApiSuccess('Feishu message history', await this.#client.im.v1.message.list({ params }));
    return {
      items: Array.isArray(response?.data?.items) ? response.data.items : [],
      hasMore: response?.data?.has_more === true,
      pageToken: response?.data?.page_token ?? null,
    };
  }

  /** Read one message (reply recognition and quoted-message context). */
  async getMessage(messageId) {
    if (!messageId) return null;
    try {
      const response = await this.#client.im.v1.message.get({
        path: { message_id: messageId },
        params: { card_msg_content_type: 'user_card_content' },
      });
      const item = (response?.data?.items ?? [])[0];
      if (!item) return null;
      return {
        senderId: item.sender?.id ?? item.sender?.sender_id?.open_id ?? null,
        senderType: item.sender?.sender_type ?? null,
        messageId: item.message_id ?? messageId,
        msgType: item.msg_type ?? item.message_type ?? null,
        bodyContent: item.body?.content ?? '',
        updatedAt: Number(item.update_time) || Number(item.create_time) || Date.now(),
        mentions: Array.isArray(item.mentions) ? item.mentions : [],
      };
    } catch {
      return null;
    }
  }

  /** Send one text body, retrying the same idempotency uuid on transient failures. */
  async sendText(chatId, text) {
    const parts = splitText(text);
    const sent = [];
    for (const part of parts) {
      const uuid = randomUUID();
      let response;
      for (let attempt = 0; ; attempt += 1) {
        try {
          response = assertApiSuccess('Feishu message send', await this.#client.im.v1.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: part }), uuid },
          }));
          break;
        } catch (error) {
          if (attempt >= DELIVERY_RETRY_MS.length || !isRetryableDeliveryError(error)) throw error;
          await sleep(DELIVERY_RETRY_MS[attempt]);
        }
      }
      const messageId = response?.data?.message_id;
      if (messageId) sent.push(messageId);
    }
    return sent.at(-1) ?? null;
  }

  /** Add one emoji reaction; returns its reaction_id (null when unavailable). */
  async addReaction(messageId, emojiType) {
    if (!messageId || !emojiType) return null;
    try {
      const response = await this.#client.im.v1.messageReaction.create({
        path: { message_id: messageId },
        data: { reaction_type: { emoji_type: emojiType } },
      });
      return response?.data?.reaction_id ?? null;
    } catch {
      return null;
    }
  }

  async removeReaction(messageId, reactionId) {
    if (!messageId || !reactionId) return false;
    try {
      await this.#client.im.v1.messageReaction.delete({ path: { message_id: messageId, reaction_id: reactionId } });
      return true;
    } catch {
      return false;
    }
  }

  /** Reply inside the message's thread (Feishu "话题" view). */
  async replyCardInThread(messageId, card) {
    const response = assertApiSuccess('Feishu threaded card reply', await this.#client.im.v1.message.reply({
      path: { message_id: messageId },
      data: { msg_type: 'interactive', content: JSON.stringify(card), reply_in_thread: true },
    }));
    return { messageId: response?.data?.message_id ?? null, threadId: response?.data?.thread_id ?? null };
  }

  /** Edit an existing text message (used for the live progress bubble). */
  async updateText(messageId, text) {
    const parts = splitText(text);
    const body = parts.join('\n');
    const response = assertApiSuccess('Feishu message update', await this.#client.im.v1.message.update({
      path: { message_id: messageId },
      data: { msg_type: 'text', content: JSON.stringify({ text: body }) },
    }));
    return response?.data?.message_id ?? messageId;
  }

  /** Tenant token for direct OpenAPI calls the SDK does not wrap. */
  async #tenantToken() {
    if (this.#token && this.#token.expiresAt > Date.now() + 60_000) return this.#token.value;
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: this.#appId, app_secret: this.#appSecret }),
    });
    const body = await response.json();
    if (body?.code !== 0 || typeof body.tenant_access_token !== 'string') {
      throw new Error(`tenant token failed: ${body?.code ?? '?'} ${body?.msg ?? ''}`.trim());
    }
    this.#token = {
      value: body.tenant_access_token,
      expiresAt: Date.now() + (Number(body.expire ?? 7200) * 1000),
    };
    return this.#token.value;
  }

  async #slash(path, init = {}) {
    const token = await this.#tenantToken();
    const response = await fetch(`https://open.feishu.cn/open-apis/application/v7/app_slash_commands${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new Error('slash command API returned a non-JSON response');
    if (body.code !== 0) throw new Error(`slash command API ${body.code}: ${body.msg ?? ''}`.trim());
    return body.data ?? {};
  }

  async listSlashCommands() {
    const data = await this.#slash('?page_size=100');
    return (data.commands ?? data.items ?? []).map((item) => ({ id: item.id ?? item.command_id, command: item.command }));
  }

  async createSlashCommand(item) {
    await this.#slash('', {
      method: 'POST',
      body: JSON.stringify({
        command: item.command,
        description: {
          default_value: item.zh,
          i18n: { zh_cn: item.zh, en_us: item.en },
        },
      }),
    });
  }

  async deleteSlashCommand(id) {
    await this.#slash(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Resolve one user's display name; needs contact:user.base:readonly. */
  async getUserName(openId) {
    if (!openId) return null;
    try {
      const response = await this.#client.contact.v3.user.get({
        path: { user_id: openId },
        params: { user_id_type: 'open_id' },
      });
      const name = response?.data?.user?.name;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    } catch {
      return null;
    }
  }

  /** Upload bytes as a Feishu file resource (`im.v1.file.create`). */
  async uploadFile(bytes, name) {
    const response = assertApiSuccess('Feishu file upload', await this.#client.im.v1.file.create({
      data: { file_type: 'stream', file_name: name, file: Buffer.from(bytes) },
    }));
    const key = response?.file_key ?? response?.data?.file_key;
    if (!key) throw new Error('Feishu file upload returned no file_key');
    return key;
  }

  /** Upload bytes as a Feishu message image (`im.v1.image.create`). */
  async uploadImage(bytes) {
    const response = assertApiSuccess('Feishu image upload', await this.#client.im.v1.image.create({
      data: { image_type: 'message', image: Buffer.from(bytes) },
    }));
    const key = response?.image_key ?? response?.data?.image_key;
    if (!key) throw new Error('Feishu image upload returned no image_key');
    return key;
  }

  async sendFile(chatId, fileKey, name) {
    const response = assertApiSuccess('Feishu file message', await this.#client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify({ file_key: fileKey, file_name: name }),
      },
    }));
    return response?.data?.message_id ?? null;
  }

  async sendImage(chatId, imageKey) {
    const response = assertApiSuccess('Feishu image message', await this.#client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'image',
        content: JSON.stringify({ image_key: imageKey }),
      },
    }));
    return response?.data?.message_id ?? null;
  }

  /** Send one interactive card; returns its message id. */
  async sendCard(chatId, card) {
    const uuid = randomUUID();
    let response;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = assertApiSuccess('Feishu card send', await this.#client.im.v1.message.create({
          params: { receive_id_type: 'chat_id' },
          data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card), uuid },
        }));
        break;
      } catch (error) {
        if (attempt >= DELIVERY_RETRY_MS.length || !isRetryableDeliveryError(error)) throw error;
        await sleep(DELIVERY_RETRY_MS[attempt]);
      }
    }
    const messageId = response?.data?.message_id;
    if (!messageId) throw new Error('Feishu card send returned no message_id');
    return messageId;
  }

  /** CardKit API surface; absent in older SDKs or test doubles. */
  #cardKitClient() {
    const cardkit = this.#client?.cardkit?.v1;
    if (!cardkit?.card?.create || !cardkit?.card?.update || !cardkit?.cardElement?.content) {
      throw new Error('Feishu CardKit is unavailable');
    }
    return cardkit;
  }

  /** Create a CardKit card entity and return its card_id. */
  async createCard(card) {
    const response = assertApiSuccess('Feishu card entity create', await this.#cardKitClient().card.create({
      data: cardJsonBody(card),
    }));
    const cardId = response?.data?.card_id;
    if (!cardId) throw new Error('Feishu card entity returned no card_id');
    return cardId;
  }

  /** Stream a full text value into one markdown element. */
  async updateCardText(cardId, elementId, content, sequence, uuid = null) {
    const response = await this.#cardKitClient().cardElement.content({
      path: { card_id: cardId, element_id: elementId },
      data: { content, sequence, uuid: uuid ?? randomUUID() },
    });
    assertApiSuccess('Feishu card text update', response);
    return cardId;
  }

  /** Replace the whole card entity, e.g. to close streaming and add panels. */
  async updateCard(cardId, card, sequence, uuid = null) {
    const response = await this.#cardKitClient().card.update({
      path: { card_id: cardId },
      data: {
        card: cardJsonBody(card),
        sequence,
        uuid: uuid ?? randomUUID(),
      },
    });
    assertApiSuccess('Feishu card update', response);
    return cardId;
  }

  /** Post an already-created CardKit card by reference. */
  async sendCardRef(chatId, cardId, uuid = null) {
    const response = assertApiSuccess('Feishu card message', await this.#client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'interactive',
        content: cardRefContent(cardId),
        ...(uuid ? { uuid } : {}),
      },
    }));
    const messageId = response?.data?.message_id;
    if (!messageId) throw new Error('Feishu card message returned no message_id');
    return messageId;
  }

  /** Post an already-created CardKit card as a thread reply. */
  async replyCardRefInThread(messageId, cardId, uuid = null) {
    const response = assertApiSuccess('Feishu threaded card message', await this.#client.im.v1.message.reply({
      path: { message_id: messageId },
      data: {
        msg_type: 'interactive',
        content: cardRefContent(cardId),
        reply_in_thread: true,
        ...(uuid ? { uuid } : {}),
      },
    }));
    return { messageId: response?.data?.message_id ?? null, threadId: response?.data?.thread_id ?? null };
  }

  /** Replace an existing interactive card in place. */
  async patchCard(messageId, card) {
    const response = assertApiSuccess('Feishu card patch', await this.#client.im.v1.message.patch({
      path: { message_id: messageId },
      data: { content: JSON.stringify(card) },
    }));
    return response?.data?.message_id ?? messageId;
  }

  /** Download one image/file resource of an inbound message. */
  async downloadResource(messageId, fileKey, type) {
    const directory = await mkdtemp(join(tmpdir(), 'im-feishu-'));
    const target = join(directory, 'resource');
    try {
      const response = await this.#client.im.v1.messageResource.get({
        path: { message_id: messageId, file_key: fileKey },
        params: { type: type === 'image' ? 'image' : 'file' },
      });
      if (typeof response?.writeFile === 'function') {
        await response.writeFile(target);
      } else if (typeof response?.getReadableStream === 'function') {
        const chunks = [];
        for await (const chunk of response.getReadableStream()) chunks.push(Buffer.from(chunk));
        await import('node:fs/promises').then(({ writeFile }) => writeFile(target, Buffer.concat(chunks)));
      } else {
        throw new Error('Feishu resource download returned no body');
      }
      await chmod(target, 0o600);
      return await readFile(target);
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Start the Feishu long connection. `handlers.onMessage` receives every
   * `im.message.receive_v1` event; `handlers.onCardAction` every card callback.
   */
  async startLongConnection({ onMessage, onCardAction, onState }) {
    const dispatcher = new Lark.EventDispatcher({});
    const register = {};
    if (typeof onMessage === 'function') {
      register['im.message.receive_v1'] = (data) => { onMessage(data); };
    }
    if (typeof onCardAction === 'function') {
      register['card.action.trigger'] = (data) => onCardAction(data);
    }
    dispatcher.register(register);
    this.#ws = new Lark.WSClient({
      appId: this.#appId,
      appSecret: this.#appSecret,
      domain: Lark.Domain.Feishu,
      loggerLevel: Lark.LoggerLevel.warn,
      onReady: () => onState?.('connected'),
      onError: (error) => onState?.('error', error),
      onReconnecting: () => onState?.('reconnecting'),
      onReconnected: () => onState?.('connected'),
    });
    onState?.('connecting');
    await this.#ws.start({ eventDispatcher: dispatcher });
    // The SDK's start() only arms its reconnect loop and returns immediately, so
    // "started" is not "connected": wait for the first real handshake.
    const state = await this.#waitForReady(20_000);
    onState?.(state);
    return state;
  }

  /** Poll the SDK's own lifecycle until it reports a settled state. */
  #waitForReady(timeoutMs) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        const state = this.#ws?.getConnectionStatus?.()?.state ?? 'idle';
        if (state === 'connected') return resolve('connected');
        if (state === 'failed') return resolve('failed');
        if (Date.now() - startedAt > timeoutMs) return resolve(state === 'idle' ? 'timeout' : state);
        const timer = setTimeout(tick, 250);
        timer.unref?.();
        return undefined;
      };
      tick();
    });
  }

  /** Current SDK-reported lifecycle, cheap and side-effect free. */
  connectionStatus() {
    return this.#ws?.getConnectionStatus?.() ?? { state: 'idle' };
  }

  async stop() {
    const ws = this.#ws;
    this.#ws = undefined;
    if (!ws) return;
    try {
      await ws.close?.({ force: true });
    } catch {
      // The connection is being torn down anyway.
    }
  }
}
