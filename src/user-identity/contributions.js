/**
 * 把飞书分身能力挂到 Host：system prompt 规则与模型工具。
 *
 * Host 默认调用，因此不需要在 Agent 预设里再挂 `./user-identity` 子插件。
 */
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { USER_IDENTITY_POLICY } from './policy.js';
import { createUserIdentityTools, REPLY_TOOL_NAME, SKIP_TOOL_NAME } from './tools.js';

const AUTO_REPLY_TOOLS = new Set([REPLY_TOOL_NAME, SKIP_TOOL_NAME]);

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
      // 决策工具只在自动回复的 Worker 会话里出现，其他会话看不到也不可调用。
      const options = AUTO_REPLY_TOOLS.has(tool.name) && monitor
        ? { when: ({ agent }) => Boolean(monitor.isAutoReplySession?.(agent?.session?.id)) }
        : undefined;
      try {
        toolCtx.tools.register(tool, options);
      } catch (error) {
        await report(`register:${tool.name}`, error);
      }
    }
  });
}
