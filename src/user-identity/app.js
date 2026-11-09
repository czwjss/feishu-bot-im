/**
 * 用户身份使用的飞书应用：默认复用某个机器人已经配置好的应用。
 *
 * 不要求用户再建一个飞书应用；App Secret 仍然从 DSH credentials 读取。
 */
import { NotConfiguredError } from './errors.js';

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function maskAppId(appId) {
  const value = clean(appId);
  if (!value) return '';
  if (value.length <= 12) return `${value.slice(0, 4)}****`;
  return `${value.slice(0, 8)}****${value.slice(-4)}`;
}

/**
 * @param {{ botConfigStore: { bots: readonly object[] }, credentials: object|null, identityConfig: { botId?: string } }} input
 * @returns {Promise<{ botId: string, botName: string|null, appId: string, appSecret: string, secretRef: string }>}
 */
export async function resolveIdentityApp({ botConfigStore, credentials, identityConfig }) {
  const bots = Array.isArray(botConfigStore?.bots) ? botConfigStore.bots : [];
  const wanted = clean(identityConfig?.botId);
  const bot = wanted ? bots.find((item) => item.id === wanted) : bots[0];
  if (!bot) {
    throw new NotConfiguredError(wanted
      ? `机器人不存在：${wanted}`
      : '还没有飞书机器人；用户身份需要复用机器人的应用');
  }
  const secretRef = clean(bot.secretRef);
  const resolved = credentials && typeof credentials.resolve === 'function'
    ? await credentials.resolve(secretRef).catch(() => undefined)
    : undefined;
  const appSecret = typeof resolved?.value === 'string' ? resolved.value : '';
  if (!appSecret) {
    throw new NotConfiguredError(`机器人「${bot.botName ?? bot.id}」没有保存 App Secret，请先在机器人设置里补齐`);
  }
  return Object.freeze({
    botId: bot.id,
    botName: bot.botName ?? null,
    appId: clean(bot.appId),
    appSecret,
    secretRef,
  });
}
