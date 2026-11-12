/**
 * 把飞书分身能力挂到 Host：system prompt 规则与模型工具。
 *
 * Host 默认调用，因此不需要在 Agent 预设里再挂 `./user-identity` 子插件。
 */
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { USER_IDENTITY_POLICY } from './policy.js';
import { createUserIdentityTools } from './tools.js';

/** 注册失败时留一份可读记录，便于在没有控制台的环境里定位。 */
async function report(stage, error) {
  const line = `${new Date().toISOString()} ${stage} ${error?.message ?? error}\n`;
  try {
    await appendFile(join(homedir(), '.dsh', 'integrations', 'im-feishu', 'tool-registration.log'), line, { mode: 0o600 });
  } catch {
    // 记录失败不影响主流程
  }
}

/**
 * @param {object} ctx Host 或兼容作用域的 Cordis 上下文。
 * @param {object} auth 用户身份认证器。
 * @param {object|null} monitor 消息监听；提供后额外注册收件箱工具。
 */
export function installUserIdentityContributions(ctx, auth, monitor = null) {
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: 'im-feishu-user:policy',
      order: 141,
      text: USER_IDENTITY_POLICY,
    });
  });

  ctx.inject(['tools'], async (toolCtx) => {
    let tools;
    try {
      tools = createUserIdentityTools({ auth, monitor });
    } catch (error) {
      await report('create-tools', error);
      return;
    }
    for (const tool of tools) {
      try {
        toolCtx.tools.register(tool);
      } catch (error) {
        await report(`register:${tool.name}`, error);
      }
    }
  });
}
