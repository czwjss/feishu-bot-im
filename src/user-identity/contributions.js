/**
 * 把飞书分身能力挂到 Host：system prompt 规则与模型工具。
 *
 * Host 默认调用，因此不需要在 Agent 预设里再挂 `./user-identity` 子插件。
 */
import { USER_IDENTITY_POLICY } from './policy.js';
import { createUserIdentityTools } from './tools.js';

/**
 * @param {object} ctx Host 或兼容作用域的 Cordis 上下文。
 * @param {object} auth 用户身份认证器。
 */
export function installUserIdentityContributions(ctx, auth) {
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: 'im-feishu-user:policy',
      order: 141,
      text: USER_IDENTITY_POLICY,
    });
  });

  ctx.inject(['tools'], (toolCtx) => {
    for (const tool of createUserIdentityTools({ auth })) {
      toolCtx.tools.register(tool);
    }
  });
}
