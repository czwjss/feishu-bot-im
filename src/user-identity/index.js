/**
 * 兼容旧预设的占位插件。
 *
 * 飞书分身工具现在由 Host 的 `feishu-bot-im` 插件全局注册，默认即挂载；
 * 旧预设若还保留这一行，也不会重复注册工具。
 */
export const name = 'im-feishu-user-identity';
export const inject = [];

/** 旧版预设可能仍挂载该子插件；保留 no-op 以兼容已保存的预设。 */
export async function apply(ctx) {
  const logger = typeof ctx.logger === 'function' ? ctx.logger('im-feishu-user') : null;
  logger?.warn?.('[im-feishu] 用户身份工具已由 Host 默认挂载，预设子插件已停用。');
}
