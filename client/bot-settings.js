import { API } from '../src/contracts.js';

const ids = (text) => text.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean);
const model = (draft) => draft.provider && draft.model
  ? { provider: draft.provider, model: draft.model, ...(draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {}) } : null;

/** Match each changed setting to its RPC; UI-only draft fields never cause a write. */
export function botSettingUpdates(previous, next) {
  const updates = [];
  const changed = (method, payload, before, after, key = method) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) updates.push({ key, method, payload });
  };
  changed(API.botWorkspaceSet, { workspace: next.workspace || null }, previous.workspace, next.workspace);
  changed(API.botModelSet, { model: model(next) }, model(previous), model(next));
  changed(API.botPresetSet, { preset: next.preset || null }, previous.preset, next.preset);
  changed(API.botProcessDetailSet, { mode: next.processDetail }, previous.processDetail, next.processDetail);
  changed(API.botPermissionSet, { permissionPreset: next.permissionPreset || null }, previous.permissionPreset, next.permissionPreset);
  for (const scope of ['direct', 'group']) {
    changed(API.botBusyModeSet, { scope, mode: next.busyMode[scope] }, previous.busyMode[scope], next.busyMode[scope], `${API.botBusyModeSet}:${scope}`);
  }
  changed(API.botContextSet, { config: next.contextEnhancement }, previous.contextEnhancement, next.contextEnhancement);
  changed(API.botBotReplySet, { enabled: next.respondBot }, previous.respondBot, next.respondBot);
  changed(API.botEavesdropSet, { eavesdrop: next.eavesdrop }, previous.eavesdrop, next.eavesdrop);
  changed(API.botMentionsSet, { mentions: next.mentions }, previous.mentions, next.mentions);
  const access = (draft) => ({ group: draft.group, allowOpenIds: ids(draft.allow), managers: ids(draft.managers) });
  changed(API.botAccessSet, { access: access(next) }, access(previous), access(next));
  return updates;
}
