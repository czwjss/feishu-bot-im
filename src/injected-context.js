/**
 * Move the injected source block out of the user's message.
 *
 * The channel writes `<feishu_bot_source>…</feishu_bot_source>` as a leading text
 * part; on the way into a step, this module splits that part off and re-emits it
 * as its own producer-owned message, so the conversation keeps one source row per
 * inbound message while the user's bubble stays exactly what they typed.
 *
 * A split that cannot be trusted leaves the original message untouched — losing
 * the user's words is far worse than showing the block inline.
 */
import { randomUUID } from 'node:crypto';

import { INJECTED_CONTEXT_TAGS } from './context-enhancement.js';

export const INJECTED_CONTEXT_PLUGIN = 'im-feishu';

function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SOURCE_PATTERN = new RegExp(`${escapePattern(INJECTED_CONTEXT_TAGS.sourceOpen)}([\\s\\S]*?)${escapePattern(INJECTED_CONTEXT_TAGS.sourceClose)}`);
const GUIDANCE_PATTERN = new RegExp(`${escapePattern(INJECTED_CONTEXT_TAGS.guidanceOpen)}([\\s\\S]*?)${escapePattern(INJECTED_CONTEXT_TAGS.guidanceClose)}`);
const TOPIC_SYNC_PATTERN = new RegExp(`${escapePattern(INJECTED_CONTEXT_TAGS.topicSyncOpen)}([\\s\\S]*?)${escapePattern(INJECTED_CONTEXT_TAGS.topicSyncClose)}`);
const EAVESDROP_PATTERN = new RegExp(`${escapePattern(INJECTED_CONTEXT_TAGS.eavesdropOpen)}([\\s\\S]*?)${escapePattern(INJECTED_CONTEXT_TAGS.eavesdropClose)}`);
const PEOPLE_PATTERN = new RegExp(`${escapePattern(INJECTED_CONTEXT_TAGS.peopleOpen)}([\\s\\S]*?)${escapePattern(INJECTED_CONTEXT_TAGS.peopleClose)}`);

/**
 * Split the leading injected blocks off one text part.
 * @returns {{ blocks: { form: string, text: string }[], rest: string } | null}
 */
export function splitLeadingInjectedContext(text) {
  if (typeof text !== 'string' || !text) return null;
  const blocks = [];
  let rest = text;
  for (;;) {
    rest = rest.replace(/^\s+/, '');
    const source = SOURCE_PATTERN.exec(rest);
    if (source && source.index === 0) {
      blocks.push({ form: 'source', text: source[0] });
      rest = rest.slice(source[0].length);
      continue;
    }
    const sync = TOPIC_SYNC_PATTERN.exec(rest);
    if (sync && sync.index === 0) {
      blocks.push({ form: 'source', text: sync[0] });
      rest = rest.slice(sync[0].length);
      continue;
    }
    const eavesdrop = EAVESDROP_PATTERN.exec(rest);
    if (eavesdrop && eavesdrop.index === 0) {
      blocks.push({ form: 'eavesdrop', text: eavesdrop[0] });
      rest = rest.slice(eavesdrop[0].length);
      continue;
    }
    const people = PEOPLE_PATTERN.exec(rest);
    if (people && people.index === 0) {
      blocks.push({ form: 'people', text: people[0] });
      rest = rest.slice(people[0].length);
      continue;
    }
    const guidance = GUIDANCE_PATTERN.exec(rest);
    if (guidance && guidance.index === 0) {
      blocks.push({ form: 'guidance', text: guidance[0] });
      rest = rest.slice(guidance[0].length);
      continue;
    }
    break;
  }
  if (blocks.length === 0) return null;
  return { blocks, rest: rest.replace(/^\s+/, '') };
}

function contextMessage(block, newId) {
  return {
    id: newId(),
    role: 'user',
    content: [{ type: 'text', text: block.text }],
    source: { kind: `plugin:${INJECTED_CONTEXT_PLUGIN}`, form: block.form },
  };
}

/**
 * Rewrite the messages entering one step. Returns null when nothing changed so
 * the caller can keep the original decision object.
 */
export function rewriteInjectedContextMessages(messages, { newId = () => randomUUID() } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const rewritten = [];
  let changed = false;
  for (const message of messages) {
    // Only prompts that travelled through the prompt RPC carry blocks, and the
    // same gate keeps our own plugin-sourced rows out of the rewrite.
    const source = message?.source;
    if (!source || typeof source !== 'object' || source.kind !== 'user'
      || typeof source.rpcId !== 'string' || !source.rpcId
      || !Array.isArray(message.content) || message.content.length === 0) {
      rewritten.push(message);
      continue;
    }
    // Blocks can arrive as several leading text parts (source, topic sync);
    // consume every leading part that is made only of injected blocks.
    const blocks = [];
    const remaining = [];
    let index = 0;
    for (; index < message.content.length; index += 1) {
      const part = message.content[index];
      if (part?.type !== 'text' || typeof part.text !== 'string') break;
      const split = splitLeadingInjectedContext(part.text);
      if (!split) break;
      blocks.push(...split.blocks);
      if (split.rest) {
        remaining.push({ type: 'text', text: split.rest });
        index += 1;
        break;
      }
    }
    remaining.push(...message.content.slice(index));
    // An empty body would break the prompt: keep the original message instead.
    if (blocks.length === 0 || remaining.length === 0) {
      rewritten.push(message);
      continue;
    }
    changed = true;
    for (const block of blocks) rewritten.push(contextMessage(block, newId));
    rewritten.push({ ...message, content: remaining });
  }
  return changed ? rewritten : null;
}
