import { noticeCard } from './cards.js';

/**
 * Send one status notice as a card, falling back to plain text only when the
 * card API itself is unavailable. Shared by the bridge, commands and turns so
 * every human-facing notice has the same shape.
 */
export async function sendNotice(bot, chatId, text, title = null, tone = null) {
  try {
    await bot.sendCard(chatId, noticeCard(text, title, tone));
  } catch {
    await bot.sendText(chatId, text).catch(() => undefined);
  }
}
