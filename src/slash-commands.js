/**
 * Native Feishu "/" command panel.
 *
 * The panel is stored on Feishu's side per application, so it outlives plugin
 * changes — whatever was registered before stays until someone removes it. This
 * module owns our manifest and reconciles the remote list with it.
 */
/** Icon keys are the documented Feishu Slash Command values. */
export const SLASH_COMMANDS = Object.freeze([
  { command: 'menu', zh: '打开功能面板', en: 'Open the feature panel' },
  { command: 'new', zh: '开启全新会话', en: 'Start a fresh session' },
  { command: 'stop', zh: '停止当前任务', en: 'Stop the current task' },
  { command: 'topic', zh: '开启/查看话题', en: 'Open or list topics' },
  { command: 'topic-sync', zh: '把话题结论同步回主会话', en: 'Sync the topic conclusion back' },
]);

export function manifestNames() {
  return new Set(SLASH_COMMANDS.map((item) => item.command));
}

/**
 * Reconcile the remote panel with our manifest: delete what we do not own,
 * create what is missing. Failures are collected, never thrown.
 */
export async function syncSlashCommands(bot, { logger = console } = {}) {
  const wanted = manifestNames();
  const remote = await bot.listSlashCommands();
  const removed = [];
  const created = [];
  const failed = [];

  for (const item of remote) {
    if (wanted.has(item.command)) continue;
    try {
      await bot.deleteSlashCommand(item.id);
      removed.push(item.command);
    } catch (error) {
      failed.push({ command: item.command, action: 'delete', message: error.message });
      logger.warn?.(`[feishu-bot] delete slash ${item.command} failed: ${error.message}`);
    }
  }

  const existing = new Set(remote.map((item) => item.command));
  for (const item of SLASH_COMMANDS) {
    if (existing.has(item.command)) continue;
    try {
      await bot.createSlashCommand(item);
      created.push(item.command);
    } catch (error) {
      failed.push({ command: item.command, action: 'create', message: error.message });
      logger.warn?.(`[feishu-bot] create slash ${item.command} failed: ${error.message}`);
    }
  }

  return { removed, created, failed };
}
