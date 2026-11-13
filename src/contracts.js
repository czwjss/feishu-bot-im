/** Browser-safe definitions shared by settings and the backend. */
export const RPC_ENDPOINT = 'im-feishu';
export const ACCESS_MODES = Object.freeze({ ALL: 'all', ALLOWLIST: 'allowlist' });
export const BUSY_MODES = Object.freeze({ QUEUE: 'queue', STEER: 'steer' });
// Keep both existing pink configurations and the red option exposed by the UI.
export const BOT_COLORS = Object.freeze(['blue', 'green', 'purple', 'orange', 'pink', 'red']);
export const CONTEXT_ENHANCEMENT_FIELDS = Object.freeze([
  'senderId', 'senderName', 'botId', 'sentAt', 'conversationTitle',
]);

export const API = Object.freeze({
  botAccessSet: 'bot.access.set',
  botAdd: 'bot.add',
  botAliasSet: 'bot.alias.set',
  botBusyModeSet: 'bot.busy-mode.set',
  botColorSet: 'bot.color.set',
  botContextSet: 'bot.context-enhancement.set',
  botEavesdropSet: 'bot.eavesdrop.set',
  botMentionsSet: 'bot.mentions.set',
  botBotReplySet: 'bot.bot-reply.set',
  botProcessDetailSet: 'bot.process-detail.set',
  botModelSet: 'bot.model.set',
  botPresetSet: 'bot.preset.set',
  botPermissionSet: 'bot.permission.set',
  botReconnect: 'bot.reconnect',
  botRemove: 'bot.remove',
  botCheck: 'bot.check',
  // Legacy clients use this name; the server now routes it to the same read-only check.
  botTest: 'bot.test',
  botWorkspaceSet: 'bot.workspace.set',
  botsList: 'bots.list',
  modelsList: 'models.list',
  presetsList: 'presets.list',
  provisionBegin: 'provision.begin',
  provisionCancel: 'provision.cancel',
  provisionPoll: 'provision.poll',
  workspacesList: 'workspaces.list',
  permissionList: 'permission.list',
  userStatus: 'user.status',
  userConnectBegin: 'user.connect.begin',
  userConnectCancel: 'user.connect.cancel',
  userDisconnect: 'user.disconnect',
  userRefresh: 'user.refresh',
  userMonitorStatus: 'user.monitor.status',
  userMonitorChats: 'user.monitor.chats',
  userMonitorAdd: 'user.monitor.add',
  userMonitorRemove: 'user.monitor.remove',
  userMonitorEnable: 'user.monitor.enable',
  userMonitorWorkerSet: 'user.monitor.worker.set',
  userMonitorHandoffSet: 'user.monitor.handoff.set',
  userMonitorReplyRulesSet: 'user.monitor.reply-rules.set',
  userMonitorWorkerOptions: 'user.monitor.worker.options',
  userMonitorPoll: 'user.monitor.poll',
  userMonitorFlush: 'user.monitor.flush',
  userMonitorChatSet: 'user.monitor.chat.set',
});
