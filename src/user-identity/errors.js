/**
 * 用户身份的错误类型与飞书错误码说明。
 */
export class UserIdentityError extends Error {
  constructor(message, { code = 'user-identity', details = {} } = {}) {
    super(message);
    this.name = 'UserIdentityError';
    this.code = code;
    this.details = details;
  }
}

export class NotConfiguredError extends UserIdentityError {
  constructor(message = '用户身份还没有可用的飞书应用') {
    super(message, { code: 'not-configured' });
    this.name = 'NotConfiguredError';
  }
}

export class NotAuthorizedError extends UserIdentityError {
  constructor(message = '用户身份还没有完成授权') {
    super(message, { code: 'not-authorized' });
    this.name = 'NotAuthorizedError';
  }
}

export class FeishuOAuthError extends UserIdentityError {
  constructor(message, { feishuCode = null, error = null, errorDescription = null, status = null } = {}) {
    super(message, { code: 'feishu-oauth', details: { feishuCode, error, errorDescription, status } });
    this.name = 'FeishuOAuthError';
    this.feishuCode = feishuCode;
    this.error = error;
    this.errorDescription = errorDescription;
    this.status = status;
  }
}

export class FeishuApiError extends UserIdentityError {
  constructor(message, { feishuCode = null, logId = null, violations = [], status = null } = {}) {
    super(message, { code: 'feishu-api', details: { feishuCode, logId, violations, status } });
    this.name = 'FeishuApiError';
    this.feishuCode = feishuCode;
    this.logId = logId;
    this.violations = Array.isArray(violations) ? violations : [];
    this.status = status;
  }
}

const OAUTH_ERROR_MESSAGES = Object.freeze({
  20001: '请求缺少必要参数',
  20002: 'App ID 或 App Secret 不正确',
  20003: '授权码无效',
  20004: '授权码已过期，请重新发起授权',
  20010: '用户没有该应用的使用权限',
  20024: '凭证与 client_id 不匹配',
  20026: 'refresh_token 无效，请重新授权',
  20037: 'refresh_token 已过期，请重新授权',
  20050: '飞书服务端错误，请稍后重试',
  20064: 'refresh_token 已被撤销，请重新授权',
  20068: 'scope 超出了用户已授权的范围',
  20071: 'redirect_uri 与授权时不一致',
  20072: '飞书服务暂时不可用，请稍后重试',
  20073: 'refresh_token 已被使用，请重新授权',
  20074: '应用后台没有开启“刷新 user_access_token”开关',
});



export function describeOAuthCode(code) {
  return OAUTH_ERROR_MESSAGES[Number(code)] ?? null;
}

const API_ERROR_MESSAGES = Object.freeze({
  99991663: 'user_access_token 无效',
  99991668: 'user_access_token 已过期',
  99991679: '授权范围不足，需要补充对应 scope 后重新授权',
  99992402: '请求参数校验失败',
  230002: '群聊不存在，或授权用户不在该群',
  230013: '没有获取该会话的权限，请确认授权用户在该群内',
});

export function describeApiCode(code) {
  return API_ERROR_MESSAGES[Number(code)] ?? null;
}

export function isExpiredTokenError(error) {
  const code = Number(error?.feishuCode);
  return code === 99991663 || code === 99991668;
}

export function isRefreshTokenDeadError(error) {
  const code = Number(error?.feishuCode);
  return code === 20026 || code === 20037 || code === 20064 || code === 20073;
}

export function describeError(error) {
  if (!error) return '未知错误';
  if (error instanceof UserIdentityError) return error.message;
  if (typeof error?.message === 'string' && error.message) return error.message;
  return String(error);
}
