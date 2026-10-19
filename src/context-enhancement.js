/**
 * Context enhancement: a per-scope prompt preamble for Feishu messages.
 *
 * Two independent scopes (private chat / group chat), each selects which source
 * fields to publish plus an optional operator guidance. The prefix uses a fixed
 * tag grammar:
 *
 *   <feishu_bot_source>{"channel":"feishu",...}</feishu_bot_source>
 *
 *   <feishu_bot_source_guidance>
 *   ...
 *   </feishu_bot_source_guidance>
 */
export const INJECTED_CONTEXT_TAGS = Object.freeze({
  sourceOpen: '<feishu_bot_source>',
  sourceClose: '</feishu_bot_source>',
  guidanceOpen: '<feishu_bot_source_guidance>',
  guidanceClose: '</feishu_bot_source_guidance>',
  topicSyncOpen: '<feishu_bot_topic_sync>',
  topicSyncClose: '</feishu_bot_topic_sync>',
  eavesdropOpen: '<feishu_bot_eavesdrop>',
  eavesdropClose: '</feishu_bot_eavesdrop>',
  peopleOpen: '<feishu_bot_people>',
  peopleClose: '</feishu_bot_people>',
});

export const CONTEXT_ENHANCEMENT_FIELDS = Object.freeze([
  'senderId', 'senderName', 'botId', 'sentAt', 'conversationTitle',
]);

export const CONTEXT_GUIDANCE_MAX_LENGTH = 8_000;

const SOURCE_LIMITS = Object.freeze({
  senderId: 256, senderName: 256, botId: 128, sentAt: 32, conversationTitle: 128,
});

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

function invalid(message) {
  const error = new TypeError(message);
  error.code = 'context-enhancement-invalid';
  return error;
}

function normalizeFields(value) {
  if (!Array.isArray(value)) return [];
  return CONTEXT_ENHANCEMENT_FIELDS.filter((field) => value.includes(field));
}

/** Damage-tolerant read used by the config store. */
export function normalizeContextEnhancementConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  const scope = (key) => {
    const raw = source[key] && typeof source[key] === 'object' ? source[key] : {};
    return Object.freeze({
      enabled: true,
      fields: Object.freeze(normalizeFields(raw.fields)),
      guidance: typeof raw.guidance === 'string' ? raw.guidance.slice(0, CONTEXT_GUIDANCE_MAX_LENGTH) : '',
    });
  };
  return Object.freeze({ group: scope('group'), direct: scope('direct') });
}

/** Strict validation for the settings RPC; a damaged save is reported. */
export function validateContextEnhancementConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('请提交完整的上下文增强设置。');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes('group') || !keys.includes('direct')) {
    throw invalid('请同时提交群聊与私聊两组设置。');
  }
  for (const scopeKey of ['group', 'direct']) {
    const scope = value[scopeKey];
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
      throw invalid('上下文增强设置结构不正确。');
    }
    if (typeof scope.enabled !== 'boolean') throw invalid('启用开关必须是布尔值。');
    if (!Array.isArray(scope.fields)
      || scope.fields.some((field) => !CONTEXT_ENHANCEMENT_FIELDS.includes(field))) {
      throw invalid('来源字段只能选择已定义的字段。');
    }
    if (typeof scope.guidance !== 'string' || scope.guidance.length > CONTEXT_GUIDANCE_MAX_LENGTH) {
      throw invalid(`增强提示词不得超过 ${CONTEXT_GUIDANCE_MAX_LENGTH} 个字符。`);
    }
  }
  return normalizeContextEnhancementConfig(value);
}

function cleanSource(value, field) {
  if ((field === 'senderId' || field === 'botId') && (typeof value === 'bigint' || Number.isFinite(value))) {
    value = String(value);
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(CONTROL_CHARACTERS, '').trim().slice(0, SOURCE_LIMITS[field]);
  if (!normalized) return undefined;
  return normalized;
}

function formatTimestamp(value) {
  // Feishu reports create_time as a millisecond-epoch string ("1760700000000").
  const raw = typeof value === 'string' ? value.trim() : value;
  const ms = typeof raw === 'number'
    ? raw
    : (typeof raw === 'string' && /^\d{10,16}$/.test(raw) ? Number(raw) : Date.parse(String(raw ?? '')));
  if (!Number.isSafeInteger(ms)) return undefined;
  const date = new Date(ms);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeJson(json) {
  return json.replace(/[<>&]/g, (character) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[character]);
}

function escapeGuidance(text) {
  return text.replace(/<\/?feishu_bot_source_guidance\b[^>]*(?:>|$)/gi, (tag) => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
}

/**
 * Render the prefix for one prompt, or null when the scope is off / empty.
 * Missing source fields are omitted rather than guessed.
 */
export function renderSourceBlock(scope, source = {}) {
  if (!scope) return null;
  const projected = {};
  for (const field of scope.fields ?? []) {
    if (field === 'sentAt') {
      const formatted = formatTimestamp(source.sentAt);
      if (formatted) projected.sentAt = formatted;
      continue;
    }
    const normalized = cleanSource(source[field], field);
    if (normalized !== undefined) projected[field] = normalized;
  }
  if (Object.keys(projected).length === 0) return null;
  return `${INJECTED_CONTEXT_TAGS.sourceOpen}${escapeJson(JSON.stringify(projected))}${INJECTED_CONTEXT_TAGS.sourceClose}`;
}

export function renderGuidanceBlock(scope) {
  if (!scope) return null;
  const guidance = typeof scope.guidance === 'string' ? scope.guidance.trim() : '';
  if (!guidance) return null;
  return `${INJECTED_CONTEXT_TAGS.guidanceOpen}\n${escapeGuidance(guidance)}\n${INJECTED_CONTEXT_TAGS.guidanceClose}`;
}
