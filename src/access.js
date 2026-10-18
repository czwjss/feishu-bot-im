/**
 * Which inbound messages the bot answers, and from whom.
 *
 * Pure functions over (config, message) so the rules can be tested and changed
 * without touching the bridge's plumbing.
 */

export function senderOpenId(data) {
  return data?.sender?.sender_id?.open_id ?? null;
}

/** Private chats are always addressed; groups depend on mode and mentions. */
export function isAddressed(config, message) {
  if (message?.chat_type === 'p2p') return true;
  const botOpenId = config?.botOpenId;
  if (!botOpenId) return false;
  const mentions = Array.isArray(message?.mentions) ? message.mentions : [];
  return mentions.some((mention) => mention?.id?.open_id === botOpenId);
}

/** The allowlist only constrains group chats; direct messages stay open. */
export function isAllowed(config, message, openId) {
  const access = config?.access ?? {};
  const mode = message?.chat_type === 'p2p' ? 'all' : access.group;
  if (mode !== 'allowlist') return true;
  if (!openId) return false;
  return Array.isArray(access.allowOpenIds) && access.allowOpenIds.includes(openId);
}
