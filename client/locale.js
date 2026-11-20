/** Minimal locale dictionary for Host-level UI chrome (component copy lives inline in `t(zh, en)`). */
export const NS = 'imFeishu';

export const MESSAGES = Object.freeze({
  "飞书机器人IM": "Feishu Bot IM",
});

export function dictionaries() {
  const zh = {};
  const en = {};
  for (const [key, value] of Object.entries(MESSAGES)) {
    zh[key] = key;
    en[key] = value;
  }
  return { zh, en };
}
