/**
 * Turn lifecycle: progress, answer card, final reply.
 *
 * Owns the per-turn state (turns map, card health) so the bridge only routes
 * events; every dependency arrives through the constructor.
 */
import { randomUUID } from 'node:crypto';
import { textOfContent } from './harness.js';
import { splitText } from './feishu.js';
import { chatIdOfKey } from './message-text.js';
import { finalCard as buildFinalCard, streamCard as buildStreamCard, turnCard } from './cards.js';
import {
  CARDKIT_RETRY_MS,
  RATE_LIMIT_RETRY_MS,
  feishuErrorCode,
  feishuHttpStatus,
  isRateLimitError,
  isRetryableCardKitError,
  sleep,
} from './feishu-errors.js';
import { sendNotice } from './notify.js';
import { buildProgressText, buildPanelTitle, buildStepsMarkdown, buildUsageRows, buildUsageTitle, summarizeArguments } from './progress.js';

/** Raw-card progress cadence. */
const REFRESH_MS = 10_000;
/** CardKit text updates; panels need headroom under the 10 calls/second ceiling. */
const STREAM_REFRESH_MS = 200;
const PANEL_REFRESH_MS = 1_000;

export class TurnRunner {
  #bot;
  #state;
  #log;
  #logEvent;
  #turns = new Map();
  #childTurns = new Map();
  #contextWindows = new Map();
  #cardKitDisabled = false;
  #cardKitCooldownUntil = 0;
  #disposed = false;

  constructor({ bot, state, log, logEvent, processDetail, classifyUserMessage, onTurnOrigin, showStats, showTools, renderMentions }) {
    this.#bot = bot;
    this.#state = state;
    this.#log = log;
    this.#logEvent = logEvent;
    this.#processDetail = typeof processDetail === 'function' ? processDetail : () => 'detailed';
    this.#classifyUserMessage = typeof classifyUserMessage === 'function' ? classifyUserMessage : () => null;
    this.#onTurnOrigin = typeof onTurnOrigin === 'function' ? onTurnOrigin : () => undefined;
    this.#showStats = typeof showStats === 'function' ? showStats : () => false;
    this.#showTools = typeof showTools === 'function' ? showTools : () => false;
    this.#renderMentions = typeof renderMentions === 'function' ? renderMentions : (text) => text;
  }

  #classifyUserMessage;

  #onTurnOrigin;

  #showStats;

  #showTools;

  #processDetail;

  #renderMentions;

  /** Validate/convert @ tags for the output path (card vs text). */
  #mentionText(turn, text, mode) {
    return this.#renderMentions(text, { chatKey: turn.chatKey, mode });
  }

  dispose() {
    this.#disposed = true;
    this.#turns.clear();
    this.#childTurns.clear();
    this.#contextWindows.clear();
  }

  onAssistantStream(agent, frame) {
    const sessionId = agent?.session?.id;
    if (typeof sessionId !== 'string' || !frame) return;
    if (frame.type === 'start') {
      const turn = this.#turnFor(sessionId, frame.turn) ?? this.#activeTurnFor(sessionId);
      if (turn && !turn.silent) {
        // A new attempt replaces the previous step's partial text.
        turn.streamAttemptId = frame.attemptId ?? null;
        turn.streamText = '';
      }
      return;
    }
    if (frame.type && frame.type !== 'chunk') return;
    // Chunk frames carry no turn number; one turn is active per Session.
    const turn = this.#activeTurnFor(sessionId);
    if (!turn || turn.silent) return;
    if (turn.streamAttemptId !== (frame.attemptId ?? null)) {
      turn.streamAttemptId = frame.attemptId ?? null;
      turn.streamText = '';
    }
    const chunk = frame?.chunk;
    // LLM chunks are text-delta; keep the legacy text shape for unit tests.
    if (!chunk || (chunk.type !== 'text-delta' && chunk.type !== 'text')
      || typeof chunk.text !== 'string' || !chunk.text) return;
    if (!turn.firstTokenAt) turn.firstTokenAt = Date.now();
    turn.streamText = `${turn.streamText ?? ''}${chunk.text}`;
    void this.#flushTurn(turn, turn.streamText);
  }

  #turnFor(sessionId, turn) {
    if (turn === undefined) return null;
    return this.#turns.get(`${sessionId}:${turn}`) ?? null;
  }

  /** Latest active turn for a session (schedule events carry no turn number). */
  #activeTurnFor(sessionId) {
    let latest = null;
    for (const turn of this.#turns.values()) {
      if (turn.sessionId === sessionId) latest = turn;
    }
    return latest;
  }

  async onSessionEvent(session, event) {
    if (this.#disposed) return;
    const sessionId = session?.id;
    if (typeof sessionId !== 'string' || !event) return;
    const chatKey = Object.entries(this.#state.value.sessions)
      .find(([, value]) => value === sessionId)?.[0];
    if (!chatKey) return;
    const topic = chatKey.startsWith('topic:')
      ? this.#state.topicFor?.(chatKey.split(':')[1], Number(chatKey.split(':')[2]))
      : null;
    const chatId = chatIdOfKey(chatKey);
    if (!chatId) return;

    if (event.type === 'turn/start') {
      // The turn starts silent; its user/message source decides whether (and
      // to which chat) it renders. Ordinary Web turns stay silent.
      this.#onTurnOrigin(sessionId, 'external');
      const key = `${sessionId}:${event.data?.turn}`;
      if (this.#turns.has(key)) return;
      const turn = {
        sessionId,
        chatId,
        chatKey,
        silent: true,
        originKind: null,
        cardKind: null,
        cardKitId: null,
        cardSequence: 0,
        cardKitFailed: false,
        cardSendUuid: null,
        streamAttemptId: null,
        streamPanels: null,
        streamPanelBodies: null,
        streamPanelAt: 0,
        streamText: '',
        topic: topic ?? null,
        turn: event.data?.turn,
        answer: '',
        steps: [],
        contextWindow: this.#contextWindows.get(sessionId) ?? null,
        contextTokens: 0,
        firstTokenAt: null,
        toolPanel: null,
        toolPanelAt: 0,
        usagePanel: null,
        usagePanelAt: 0,
        usageRows: [],
        subagents: new Map(),
        childIds: new Set(),
        openSteps: new Map(),
        stepStarts: new Map(),
        toolMsByStep: new Map(),
        thinkingMs: 0,
        placeholderId: null,
        rendered: '',
        startedAt: Date.now(),
      };
      this.#turns.set(key, turn);
      return;
    }

    if (event.type === 'request/context') {
      const window = event.data?.contextWindow;
      if (Number.isFinite(window) && window > 0) {
        this.#contextWindows.set(sessionId, window);
        if (this.#contextWindows.size > 200) {
          this.#contextWindows.delete(this.#contextWindows.keys().next().value);
        }
        for (const active of this.#turns.values()) {
          if (active.sessionId === sessionId) active.contextWindow = window;
        }
      }
      return;
    }

    // The actual user message carries the prompt rpcId (Feishu) or
    // source.kind=schedule. Plugin/system rows carry neither and are ignored
    // until the real message arrives. Its origin also picks the exact chat for
    // shared Sessions and un-silences the turn.
    if (event.type === 'user/message') {
      const active = this.#activeTurnFor(sessionId);
      if (!active || active.originKind) return;
      const origin = this.#classifyUserMessage(sessionId, event.data?.source);
      if (!origin) return;
      active.originKind = origin.kind;
      if (origin.chatKey) active.chatKey = origin.chatKey;
      if (origin.chatId) active.chatId = origin.chatId;
      if (origin.topic !== undefined) active.topic = origin.topic;
      this.#onTurnOrigin(sessionId, origin.kind === 'feishu' ? 'feishu' : 'external');
      if (origin.kind !== 'external' && active.silent) {
        active.silent = false;
        await this.#flushTurn(active, '⏳ 已收到，正在处理…');
      }
      return;
    }

    const turn = this.#turnFor(sessionId, event.data?.turn);
    if (!turn) return;

    if (turn.silent && event.type !== 'assistant/message' && event.type !== 'subagent/catalog' && event.type !== 'turn/end') {
      return;
    }
    if (event.type === 'step/start') {
      turn.stepStarts.set(event.data?.step, Date.now());
      return;
    }
    if (event.type === 'step/end') {
      const step = event.data?.step;
      const startedAt = turn.stepStarts.get(step);
      if (typeof startedAt === 'number') {
        const spent = Date.now() - startedAt;
        const toolMs = turn.toolMsByStep.get(step) ?? 0;
        turn.thinkingMs += Math.max(0, spent - toolMs);
      }
      return;
    }
    if (event.type === 'tool/call') {
      const name = event.data?.name ?? 'tool';
      const callId = event.data?.callId;
      const step = {
        callId,
        step: event.data?.step,
        name,
        args: summarizeArguments(name, event.data?.arguments),
        startedAt: Date.now(),
        ms: 0,
        ok: null,
        running: true,
      };
      turn.steps.push(step);
      if (callId) turn.openSteps.set(callId, step);
      await this.#flushTurn(turn, this.#progressText(turn));
      return;
    }
    if (event.type === 'tool/result') {
      const message = event.data?.message ?? {};
      const callId = message.toolCallId ?? message.source?.callId;
      const step = callId ? turn.openSteps.get(callId) : null;
      if (step) {
        turn.openSteps.delete(callId);
        step.running = false;
        step.ok = message.isError !== true;
        step.ms = Date.now() - (step.startedAt ?? Date.now());
        if (!step.ok) step.error = this.#errorText(message);
        const stepNumber = step.step ?? event.data?.step;
        if (typeof stepNumber !== 'undefined') {
          turn.toolMsByStep.set(stepNumber, (turn.toolMsByStep.get(stepNumber) ?? 0) + step.ms);
        }
      }
      await this.#flushTurn(turn, this.#progressText(turn));
      return;
    }
    if (event.type === 'subagent/catalog') {
      const childId = event.data?.childId;
      if (typeof childId === 'string') {
        const label = event.data?.label
          ? `子智能体 · ${String(event.data.label).slice(0, 24)}`
          : `子智能体 · ${childId.slice(0, 8)}`;
        if (!turn.subagents.has(childId)) turn.subagents.set(childId, { label, input: 0, cache: 0, output: 0, calls: 0 });
        turn.childIds.add(childId);
        this.#childTurns.set(childId, turn);
      }
      return;
    }
    if (event.type === 'assistant/message') {
      const usage = event.data?.usage;
      const text = textOfContent(event.data?.message?.content).trim();
      if (usage) {
        this.#recordUsage(turn, usage, '主 Agent');
        const total = Number(usage.totalTokens) || 0;
        if (total > 0) turn.contextTokens = total;
      }
      if (!turn.firstTokenAt && text) turn.firstTokenAt = Date.now();
      if (turn.silent) return;
      if (text) turn.answer = text;
      if (text) await this.#flushTurn(turn, text);
      return;
    }
    if (event.type === 'turn/end') {
      await this.#finishTurn(turn, event.data?.reason);
    }
  }

  #recordUsage(turn, usage, label) {
    // inputTokens 未包含缓存命中部分；总输入 = 未缓存输入 + 缓存读取。
    const fresh = Number(usage.inputTokens) || 0;
    const cache = Number(usage.cacheReadTokens) || 0;
    const input = fresh + cache;
    const output = Number(usage.outputTokens) || 0;
    if (input <= 0 && output <= 0) return;
    turn.usageRows.push({ label, input, cache, output });
  }

  /** Usage of a subagent Session (they are not bound to a chat). */
  onExternalUsage(sessionId, usage) {
    const turn = this.#childTurns.get(sessionId);
    if (!turn || !usage) return;
    const entry = turn.subagents.get(sessionId) ?? { label: `子智能体 · ${String(sessionId).slice(0, 8)}`, input: 0, cache: 0, output: 0, calls: 0 };
    const fresh = Number(usage.inputTokens) || 0;
    const cache = Number(usage.cacheReadTokens) || 0;
    const input = fresh + cache;
    const output = Number(usage.outputTokens) || 0;
    if (input <= 0 && output <= 0) return;
    entry.input += input;
    entry.output += output;
    entry.cache += cache;
    entry.calls += 1;
    turn.subagents.set(sessionId, entry);
  }

  #usageSnapshot(turn) {
    const total = { input: 0, output: 0, cache: 0, calls: 0 };
    for (const row of turn.usageRows) {
      total.input += row.input ?? 0;
      total.cache += row.cache ?? 0;
      total.output += row.output ?? 0;
      total.calls += 1;
    }
    const rows = [...turn.usageRows];
    for (const entry of turn.subagents.values()) {
      total.input += entry.input;
      total.cache += entry.cache;
      total.output += entry.output;
      total.calls += entry.calls;
      rows.push({ label: `${entry.label}（${entry.calls} 步）`, input: entry.input, cache: entry.cache });
    }
    return { total, rows: rows.slice(-20) };
  }

  /** First text chunk of a failed tool result, clipped for the card. */
  #errorText(message) {
    const parts = Array.isArray(message?.content) ? message.content : [];
    const text = parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join(' ').trim();
    return text || '工具返回错误';
  }

  #progressText() {
    return buildProgressText();
  }

  #toolPanel(turn, statusNote, force) {
    const now = Date.now();
    if (!force && turn.toolPanel && now - turn.toolPanelAt < REFRESH_MS) {
      return turn.toolPanel;
    }
    const stepsMarkdown = buildStepsMarkdown(turn.steps, this.#processDetail());
    const panel = stepsMarkdown ? {
      panelTitle: buildPanelTitle({
        steps: turn.steps,
        elapsedMs: now - turn.startedAt,
        thinkingMs: turn.thinkingMs,
        firstTokenMs: turn.firstTokenAt ? turn.firstTokenAt - turn.startedAt : 0,
        note: statusNote,
      }),
      panelBody: stepsMarkdown,
    } : null;
    turn.toolPanel = panel;
    turn.toolPanelAt = now;
    return panel;
  }

  #card(turn, text, { statusNote = null, force = false, expanded = false } = {}) {
    const panel = this.#showTools(turn.chatKey) ? this.#toolPanel(turn, statusNote, force) : null;
    const usage = this.#showStats(turn.chatKey) ? this.#usagePanel(turn, force) : null;
    return turnCard(this.#mentionText(turn, text, 'card'), {
      ...(panel ?? {}),
      ...(panel ? {} : { note: statusNote }),
      ...(usage ?? {}),
      expanded,
    });
  }

  /** Full final card; closes CardKit streaming and restores tool/usage panels. */
  #finalCard(turn, text, statusNote) {
    return buildFinalCard(
      this.#card(turn, text, { statusNote, force: true, expanded: true }),
      text,
    );
  }

  /** Token panel shares the 10s refresh cadence with the tool panel. */
  #usagePanel(turn, force) {
    const now = Date.now();
    if (!force && turn.usagePanelAt && now - turn.usagePanelAt < REFRESH_MS) {
      return turn.usagePanel ?? null;
    }
    const cumulative = this.#state.usageFor?.(`usage:${turn.sessionId}`) ?? null;
    const snapshot = this.#usageSnapshot(turn);
    const usageTitle = buildUsageTitle({
      cumulative,
      turn: snapshot.total,
      context: { tokens: turn.contextTokens, window: turn.contextWindow ?? 0 },
    });
    turn.usagePanelAt = now;
    turn.usagePanel = usageTitle ? { usageTitle, usageBody: buildUsageRows(snapshot.rows) } : null;
    return turn.usagePanel;
  }

  /** Serialize flushes per turn: only one card request may be in flight. */
  async #flushTurn(turn, text) {
    if (turn.flushPromise) return turn.flushPromise;
    const run = this.#flushTurnOnce(turn, text).catch((error) => {
      this.#log('warn', 'card flush failed', error);
    });
    turn.flushPromise = run.finally(() => { turn.flushPromise = null; });
    return turn.flushPromise;
  }

  /** Patch one card, retrying when Feishu rate-limits updates to that message. */
  async #patchCard(turn, card) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.#bot.patchCard(turn.cardMessageId, card);
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= RATE_LIMIT_RETRY_MS.length) throw error;
        this.#logEvent('card-rate-limit', `session=${turn.sessionId} turn=${turn.turn} retry=${attempt + 1}`);
        await sleep(RATE_LIMIT_RETRY_MS[attempt]);
      }
    }
  }

  #cardKitReady() {
    return !this.#cardKitDisabled && Date.now() >= this.#cardKitCooldownUntil;
  }

  /** Retry only transient CardKit errors; deterministic failures go straight to fallback. */
  async #retryCardKit(operation, label) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableCardKitError(error) || attempt >= CARDKIT_RETRY_MS.length) throw error;
        this.#logEvent('cardkit-retry', `${label} attempt=${attempt + 1}`);
        await sleep(CARDKIT_RETRY_MS[attempt]);
      }
    }
  }

  #degradeCardKit(error) {
    const code = feishuErrorCode(error);
    const message = String(error?.message ?? error);
    if (code === 300311 || feishuHttpStatus(error) === 403 || /unavailable|permission/i.test(message)) {
      this.#cardKitDisabled = true;
    } else {
      // Transient outage: keep CardKit enabled, but stop paying the retry cost on every turn.
      this.#cardKitCooldownUntil = Date.now() + 60_000;
    }
    this.#log('warn', 'CardKit degraded; falling back to raw cards', error);
    this.#logEvent('cardkit-degraded', String(error?.message ?? error).slice(0, 300));
  }

  /** Refresh live tool/usage panel bodies, at most once per second. */
  async #refreshStreamPanels(turn) {
    if (!turn.streamPanels || !turn.cardKitId) return;
    if (Date.now() - (turn.streamPanelAt ?? 0) < PANEL_REFRESH_MS) return;
    const bodies = {};
    if (turn.streamPanels.tools) {
      bodies.tools = this.#toolPanel(turn, null, true)?.panelBody || '（等待中…）';
    }
    if (turn.streamPanels.usage) {
      bodies.usage = this.#usagePanel(turn, true)?.usageBody || '（等待中…）';
    }
    for (const [elementId, body] of Object.entries(bodies)) {
      if (body === turn.streamPanelBodies?.[elementId]) continue;
      try {
        const sequence = ++turn.cardSequence;
        await this.#retryCardKit(
          () => this.#bot.updateCardText(turn.cardKitId, elementId, body, sequence, randomUUID()),
          `panel-${elementId}`,
        );
        if (!turn.streamPanelBodies) turn.streamPanelBodies = {};
        turn.streamPanelBodies[elementId] = body;
        turn.cardAt = Date.now();
        this.#logEvent('cardkit-panel', `session=${turn.sessionId} turn=${turn.turn} element=${elementId} seq=${sequence}`);
      } catch (error) {
        this.#log('warn', `CardKit ${elementId} panel update failed`, error);
        this.#logEvent('cardkit-error', String(error?.message ?? error).slice(0, 300));
      }
    }
    turn.streamPanelAt = Date.now();
  }

  /** Open the answer card: CardKit first, then raw, then text fallback. */
  async #openAnswerCard(turn, body) {
    if (!turn.cardMessageId && !turn.cardBroken) {
      if (turn.cardKind !== 'raw' && this.#cardKitReady()) {
        try {
          const cardId = await this.#retryCardKit(
            () => this.#bot.createCard(buildStreamCard(
              this.#mentionText(turn, body, 'card'),
              { showTools: this.#showTools(turn.chatKey), showStats: this.#showStats(turn.chatKey) },
            )),
            'create',
          );
          turn.cardSendUuid ??= randomUUID();
          let messageId = null;
          if (turn.topic?.rootMessageId) {
            if (typeof this.#bot.replyCardRefInThread !== 'function') {
              throw new Error('CardKit thread reply is unavailable');
            }
            const reply = await this.#retryCardKit(
              () => this.#bot.replyCardRefInThread(turn.topic.rootMessageId, cardId, turn.cardSendUuid),
              'send',
            );
            messageId = reply?.messageId ?? reply?.message_id ?? null;
            if (turn.topic && reply?.threadId) {
              this.#state.updateTopic?.(turn.topic.chatId, turn.topic.topicId, { threadId: reply.threadId }).catch(() => undefined);
            }
          } else {
            messageId = await this.#retryCardKit(
              () => this.#bot.sendCardRef(turn.chatId, cardId, turn.cardSendUuid),
              'send',
            );
          }
          if (!messageId) throw new Error('CardKit message returned no message_id');
          this.#cardKitCooldownUntil = 0;
          turn.cardKind = 'cardkit';
          turn.cardKitId = cardId;
          turn.cardMessageId = messageId;
          turn.streamPanels = {
            tools: this.#showTools(turn.chatKey),
            usage: this.#showStats(turn.chatKey),
          };
          turn.streamPanelBodies = {};
          turn.rendered = body;
          turn.cardAt = Date.now();
          this.#logEvent('cardkit-send', `session=${turn.sessionId} turn=${turn.turn} card=${cardId} id=${messageId}`);
          return true;
        } catch (error) {
          this.#degradeCardKit(error);
          turn.cardKind = 'raw';
        }
      }
      try {
        if (turn.topic?.rootMessageId && this.#bot.replyCardInThread) {
          const reply = await this.#bot.replyCardInThread(turn.topic.rootMessageId, this.#card(turn, body));
          turn.cardMessageId = reply?.messageId ?? reply?.message_id ?? null;
          if (turn.topic && reply?.threadId) {
            this.#state.updateTopic?.(turn.topic.chatId, turn.topic.topicId, { threadId: reply.threadId }).catch(() => undefined);
          }
        } else {
          turn.cardMessageId = await this.#bot.sendCard(turn.chatId, this.#card(turn, body));
        }
        turn.cardKind = 'raw';
        turn.rendered = body;
        turn.cardAt = Date.now();
        this.#logEvent('card-send', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId ?? '-'}`);
        return true;
      } catch (error) {
        this.#log('warn', 'answer card unavailable; falling back to text', error);
        this.#logEvent('answer-card-error', String(error?.message ?? error).slice(0, 300));
        turn.cardBroken = true;
      }
    }
    return false;
  }

  async #flushTurnOnce(turn, text) {
    const body = typeof text === 'string' ? text : '';
    if (!body || turn.rendered === body) return;

    if (!turn.cardMessageId && !turn.cardBroken) {
      if (await this.#openAnswerCard(turn, body)) return;
    }
    if (turn.cardKind === 'cardkit' && turn.cardKitId) {
      if (turn.cardKitFailed) return;
      await this.#refreshStreamPanels(turn);
      if (Date.now() - (turn.cardAt ?? 0) < STREAM_REFRESH_MS) return;
      // Reserve the window before awaiting; concurrent flushes must not pass this check.
      turn.cardAt = Date.now();
      try {
        const sequence = ++turn.cardSequence;
        const uuid = randomUUID();
        await this.#retryCardKit(
          () => this.#bot.updateCardText(
            turn.cardKitId,
            'answer',
            this.#mentionText(turn, body, 'card'),
            sequence,
            uuid,
          ),
          'update',
        );
        this.#logEvent('cardkit-update', `session=${turn.sessionId} turn=${turn.turn} seq=${sequence}`);
        turn.rendered = body;
        return;
      } catch (error) {
        this.#log('warn', 'CardKit text update failed', error);
        this.#logEvent('cardkit-error', String(error?.message ?? error).slice(0, 300));
        turn.cardKitFailed = true;
        return;
      }
    }
    if (turn.cardKind === 'raw' && turn.cardMessageId) {
      if (Date.now() - (turn.cardAt ?? 0) < REFRESH_MS) return;
      // Reserve the window before awaiting; concurrent flushes must not pass this check.
      turn.cardAt = Date.now();
      try {
        await this.#patchCard(turn, this.#card(turn, body));
        this.#logEvent('card-patch', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId}`);
        turn.rendered = body;
        return;
      } catch (error) {
        if (isRateLimitError(error)) {
          this.#logEvent('card-rate-limit', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId}`);
          return;
        }
        this.#log('warn', 'answer card update failed; falling back to text', error);
        this.#logEvent('answer-card-error', String(error?.message ?? error).slice(0, 300));
        turn.cardMessageId = null;
        turn.cardBroken = true;
      }
    }
    try {
      const rendered = this.#mentionText(turn, body, 'text');
      if (!turn.placeholderId) {
        turn.placeholderId = await this.#bot.sendText(turn.chatId, rendered);
      } else {
        await this.#bot.updateText(turn.placeholderId, rendered);
      }
      turn.rendered = body;
    } catch (error) {
      this.#log('warn', 'progress render failed', error);
      turn.placeholderId = null;
    }
  }

  async #sendFinalText(turn, final, kind) {
    const note = this.#statusNote(kind);
    const chunks = splitText(this.#mentionText(turn, final, 'text'), 3_500);
    const first = [chunks[0] ?? '', note].filter(Boolean).join('\n\n');
    if (first) await this.#bot.sendText(turn.chatId, first);
    for (const rest of chunks.slice(1)) await this.#bot.sendText(turn.chatId, rest);
  }

  /** Footer for non-completed final cards. */
  #statusNote(kind) {
    if (kind === 'completed') return null;
    return kind === 'aborted' ? '已停止' : `结束：${kind}`;
  }

  async #finishTurn(turn, reason) {
    const key = `${turn.sessionId}:${turn.turn}`;
    this.#turns.delete(key);
    for (const childId of turn.childIds) this.#childTurns.delete(childId);
    const kind = reason?.kind ?? 'completed';
    let final = turn.answer;
    if (!final && kind !== 'completed') {
      final = kind === 'aborted'
        ? '任务已停止。'
        : `任务结束：${reason?.error?.code ?? kind}${reason?.error?.message ? ` · ${reason.error.message}` : ''}`;
    }
    if (!final) final = '（本轮没有产生文字回答）';

    const snapshot = this.#usageSnapshot(turn);

    if (turn.silent) {
      if (snapshot.total.calls > 0) {
        await this.#state.addUsage?.(`usage:${turn.sessionId}`, snapshot.total).catch(() => undefined);
      }
      return;
    }

    // A streamed progress patch may still be in flight; the final patch must not race it.
    if (turn.flushPromise) await turn.flushPromise.catch(() => undefined);

    if (turn.topic) {
      const current = this.#state.topicFor?.(turn.topic.chatId, turn.topic.topicId) ?? turn.topic;
      await this.#state.updateTopic?.(turn.topic.chatId, turn.topic.topicId, {
        lastAnswer: String(final).slice(0, 2000),
        ...(current?.syncRequested ? { summary: String(final).slice(0, 1200), syncRequested: false } : {}),
      }).catch(() => undefined);
      if (current?.syncRequested) {
        await this.#state.addSynced?.(turn.topic.chatId, {
          topicId: turn.topic.topicId,
          title: turn.topic.title,
          summary: String(final).slice(0, 1200),
          at: new Date().toISOString(),
        }).catch(() => undefined);
        await sendNotice(this.#bot, turn.chatId, `话题 #${turn.topic.topicId}「${turn.topic.title}」已同步到主会话。`, '话题已同步');
      }
    }
    let cardPatched = false;
    try {
      if (turn.cardKind === 'cardkit' && turn.cardKitId) {
        const chunks = splitText(final, 24_000);
        // Respect the per-card update window between the last text update and the final rewrite.
        const wait = (turn.cardAt ?? 0) + STREAM_REFRESH_MS - Date.now();
        if (wait > 0) await sleep(wait);
        const sequence = ++turn.cardSequence;
        const uuid = randomUUID();
        turn.cardAt = Date.now();
        await this.#retryCardKit(
          () => this.#bot.updateCard(
            turn.cardKitId,
            this.#finalCard(turn, chunks[0] ?? final, this.#statusNote(kind)),
            sequence,
            uuid,
          ),
          'final',
        );
        cardPatched = true;
        this.#logEvent('cardkit-final', `session=${turn.sessionId} turn=${turn.turn} seq=${turn.cardSequence}`);
        for (const rest of chunks.slice(1)) await sendNotice(this.#bot, turn.chatId, this.#mentionText(turn, rest, 'card'));
      } else if (turn.cardMessageId) {
        const chunks = splitText(final, 24_000);
        turn.cardAt = Date.now();
        await this.#patchCard(turn, this.#card(turn, chunks[0] ?? final, {
          statusNote: this.#statusNote(kind),
          force: true,
        }));
        cardPatched = true;
        this.#logEvent('card-final', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId}`);
        for (const rest of chunks.slice(1)) await sendNotice(this.#bot, turn.chatId, this.#mentionText(turn, rest, 'card'));
      } else if (turn.placeholderId) {
        const chunks = splitText(final, 3_500);
        await this.#bot.updateText(turn.placeholderId, `${this.#mentionText(turn, chunks[0] ?? final, 'text')}\n\n${this.#statusNote(kind)}`);
        cardPatched = true;
        for (const rest of chunks.slice(1)) await sendNotice(this.#bot, turn.chatId, this.#mentionText(turn, rest, 'card'));
      } else {
        await this.#bot.sendText(turn.chatId, this.#mentionText(turn, final, 'text'));
        cardPatched = true;
      }
    } catch (error) {
      // The card may be rate-limited or otherwise unavailable; still deliver the answer.
      this.#log('warn', 'final answer card failed', error);
      if (cardPatched) return;
      try {
        await this.#sendFinalText(turn, final, kind);
      } catch (fallbackError) {
        this.#log('error', 'final answer failed', fallbackError);
        await sendNotice(this.#bot, turn.chatId, `回复发送失败：${fallbackError.message}`, '发送失败');
      }
    }
    if (snapshot.total.calls > 0) {
      await this.#state.addUsage?.(`usage:${turn.sessionId}`, snapshot.total).catch(() => undefined);
    }
  }
}
