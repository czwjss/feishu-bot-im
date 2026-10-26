/**
 * Feishu error classification and retry policy.
 *
 * Kept separate from the turn runner so card-delivery code reads as lifecycle
 * instead of HTTP-status plumbing.
 */

export const RATE_LIMIT_CODE = 230020;
export const RATE_LIMIT_RETRY_MS = Object.freeze([1_000, 2_000]);
export const CARDKIT_RETRY_MS = Object.freeze([200, 500, 1_000]);

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
]);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** First Feishu/API error code found in the nested Axios response shape. */
export function feishuErrorCode(error) {
  const stack = [error?.response?.data];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (typeof value.code === 'number' || /^\d+$/.test(String(value.code ?? ''))) {
      return Number(value.code);
    }
  }
  const code = Number(error?.code);
  return Number.isFinite(code) ? code : null;
}

export function feishuHttpStatus(error) {
  const status = Number(error?.response?.status ?? error?.status);
  return Number.isFinite(status) ? status : 0;
}

/** Raw message.patch rate limit. */
export function isRateLimitError(error) {
  return feishuErrorCode(error) === RATE_LIMIT_CODE
    || /frequency|too frequently/i.test(String(error?.message ?? ''));
}

/** Only retry errors that can succeed on a second attempt. */
export function isRetryableCardKitError(error) {
  const status = feishuHttpStatus(error);
  if (status === 408 || status === 429 || status >= 500) return true;
  if (TRANSIENT_NETWORK_CODES.has(String(error?.code ?? ''))) return true;
  const code = feishuErrorCode(error);
  return code === RATE_LIMIT_CODE || code === 300120 || code === 99991400 || code === 99991401;
}
