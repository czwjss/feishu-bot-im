/**
 * 用户身份（飞书分身）的预设侧插件。
 *
 * 不写进 Host：由用户自己的 Agent 预设挂载，工具只在该预设作用域内注册：
 *
 *   - id: im-feishu-user-identity
 *     name: '@czwjss/feishu-bot-im/user-identity'
 *
 * 应用与凭证复用机器人插件：默认使用第一个机器人（或配置指定的 botId）的
 * appId / App Secret；token 与配置放在同一个集成目录。
 */
import { join } from 'node:path';

import { ConfigStore, configPaths } from '../config.js';
import { UserIdentityAuth } from './auth.js';
import { UserIdentityConfigStore, USER_IDENTITY_FILE, USER_TOKEN_FILE } from './config.js';
import { USER_IDENTITY_POLICY } from './policy.js';
import { UserTokenStore } from './token-store.js';
import { createUserIdentityTools } from './tools.js';

export const name = 'im-feishu-user-identity';
export const inject = ['tools', 'systemPrompt'];

/** 预设作用域里 credentials 是 Host 服务；取不到时只能用已有的有效 token。 */
function resolveCredentials(ctx) {
  try {
    if (ctx.credentials && typeof ctx.credentials.resolve === 'function') return ctx.credentials;
  } catch {
    // 某些预设作用域可能没有 credentials。
  }
  try {
    if (typeof ctx.get === 'function') return ctx.get('credentials') ?? null;
  } catch {
    // 最小预设可能没有 credentials；读取已授权 token 不受影响。
  }
  return null;
}

/**
 * @param {object} ctx
 * @param {{ dataDir?: string }} config
 */
export async function apply(ctx, config = {}) {
  const paths = configPaths(config);
  const logger = typeof ctx.logger === 'function' ? ctx.logger('im-feishu-user') : console;

  const botConfigStore = await new ConfigStore(paths.config).load();
  const configStore = await new UserIdentityConfigStore({
    path: join(paths.root, USER_IDENTITY_FILE),
  }).load();
  const tokenStore = await new UserTokenStore({
    path: join(paths.root, USER_TOKEN_FILE),
  }).load();
  const auth = new UserIdentityAuth({
    configStore,
    tokenStore,
    botConfigStore,
    credentials: resolveCredentials(ctx),
    logger,
  });

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

  logger.info?.(`[im-feishu] 用户身份工具已加载（data dir: ${paths.root}）`);
}
