/**
 * 把飞书分身能力挂到 Host：只注册模型工具。
 *
 * 全局能力约定由 `src/policy.js` 注册一次；自动批次的会话信息和回复规则
 * 由 `worker-context.js` 按 Worker 会话注入，这里不注册提示词。
 * Host 默认调用，因此不需要在 Agent 预设里再挂任何子插件。
 */
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
 */
export function installUserIdentityContributions(ctx, auth) {
  ctx.inject(['tools'], async (toolCtx) => {
    let tools;
    try {
      tools = createUserIdentityTools({ auth });
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
