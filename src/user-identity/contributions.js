/**
 * 把飞书分身能力挂到 Host：按需激活注册模型工具，并在已授权时注入当前身份摘要。
 *
 * 全局能力约定由 `src/policy.js` 注册一次；自动批次的会话信息和回复规则
 * 由 `worker-context.js` 按 Worker 会话注入。
 */
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  DOC_FILE_TOOL_NAME,
  DOC_READ_TOOL_NAME,
  DOC_WRITE_TOOL_NAME,
  createUserIdentityTools,
} from './tools.js';

const DOC_READ_SCOPES = [
  'docx:document:readonly',
  'docs:doc:readonly',
  'drive:drive.metadata:readonly',
  'search:docs:read',
  'space:document:retrieve',
  'wiki:space:retrieve',
  'wiki:node:retrieve',
];

const DOC_WRITE_SCOPES = [
  'docx:document:create',
  'docx:document:write_only',
  'docx:document.block:convert',
  'docs:doc',
  'space:folder:create',
  'space:document:move',
  'space:document:delete',
  'wiki:node:create',
  'wiki:node:move',
];

const DOC_FILE_SCOPES = [
  'drive:file:download',
  'drive:file:upload',
];

/** 注册失败时留一份可读记录，便于在没有控制台的环境里定位。 */
async function report(stage, error) {
  const line = `${new Date().toISOString()} ${stage} ${error?.message ?? error}\n`;
  try {
    await appendFile(join(homedir(), '.dsh', 'integrations', 'im-feishu', 'tool-registration.log'), line, { mode: 0o600 });
  } catch {
    // 记录失败不影响主流程
  }
}

function checkAvailability(auth, requiredAnyScopes = null) {
  if (typeof auth?.availability !== 'function') return true;
  const state = auth.availability();
  if (!state?.authorized) return false;
  if (!requiredAnyScopes || !state.hasRecordedScope) return true;
  return requiredAnyScopes.some((scope) => state.scopes.has(scope));
}

export function activationForAvatarTool(toolName, auth) {
  if (toolName === DOC_READ_TOOL_NAME) return () => checkAvailability(auth, DOC_READ_SCOPES);
  if (toolName === DOC_WRITE_TOOL_NAME) return () => checkAvailability(auth, DOC_WRITE_SCOPES);
  if (toolName === DOC_FILE_TOOL_NAME) return () => checkAvailability(auth, DOC_FILE_SCOPES);
  return () => checkAvailability(auth);
}

export function formatAvatarIdentityContext(auth) {
  if (typeof auth?.availability !== 'function') return '';
  const { authorized, user } = auth.availability();
  if (!authorized || !user?.openId) return '';
  const parts = [
    user.name ? `姓名：${user.name}` : '',
    `openId：${user.openId}`,
    user.email ? `邮箱：${user.email}` : '',
  ].filter(Boolean);
  return `<feishu_avatar_identity>${parts.join(' | ')}</feishu_avatar_identity>`;
}

/**
 * @param {object} ctx Host 或兼容作用域的 Cordis 上下文。
 * @param {object} auth 用户身份认证器。
 */
export function installUserIdentityContributions(ctx, auth, harness) {
  ctx.inject(['tools'], async (toolCtx) => {
    let tools;
    try {
      tools = createUserIdentityTools({ auth, harness });
    } catch (error) {
      await report('create-tools', error);
      return;
    }
    for (const tool of tools) {
      try {
        toolCtx.tools.register(tool, { when: activationForAvatarTool(tool.name, auth) });
      } catch (error) {
        await report(`register:${tool.name}`, error);
      }
    }
  });

  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], (promptCtx) => {
      if (typeof promptCtx?.systemPrompt?.context !== 'function') return;
      promptCtx.systemPrompt.context({
        name: 'im-feishu:avatar-identity',
        order: 121,
        text: () => formatAvatarIdentityContext(auth),
      });
    });
  }
}
