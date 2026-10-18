/**
 * Turn lifecycle: progress, answer card, final reply.
 *
 * Owns the per-turn state (turns map, card health) so the bridge only routes
 * events; every dependency arrives through the constructor.
 */
import { textOfContent } from './harness.js';
import { splitText } from './feishu.js';
import { turnCard } from './cards.js';
import { buildProgressText, buildPanelTitle, buildStepsMarkdown, buildUsageRows, buildUsageTitle, summarizeArguments } from './progress.js';

/** Minimum gap between two card updates; shorter ones are coalesced. */
const CARD_THROTTLE_MS = 1500;
/** Tool/token panel snapshots refresh at most this often; the answer text streams faster. */
const PANEL_REFRESH_MS = 10_000;

export class TurnRunner {
  #bot;
  #state;
  #log;
  #logEvent;
  #turns = new Map();
  #childTurns = new Map();
  #contextWindows = new Map();
  #disposed = false;

  constructor({ bot, state, log, logEvent, processDetail, shouldRenderTurn }) {
    this.#bot = bot;
    this.#state = state;
    this.#log = log;
    this.#logEvent = logEvent;
    this.#processDetail = typeof processDetail === 'function' ? processDetail : () => 'detailed';
    this.#shouldRenderTurn = typeof shouldRenderTurn === 'function' ? shouldRenderTurn : () => true;
  }

  #shouldRenderTurn;

  #processDetail;

  dispose() {
    this.#disposed = true;
    this.#turns.clear();
    this.#childTurns.clear();
    this.#contextWindows.clear();
  }

  onAssistantStream(agent, frame) {
    const sessionId = agent?.session?.id;
    if (typeof sessionId !== 'string' || typeof frame?.turn !== 'number') return;
    const turn = this.#turns.get(`${sessionId}:${frame.turn}`);
    if (!turn) return;
    const chunk = frame?.chunk;
    if (!chunk || chunk.type !== 'text' || typeof chunk.text !== 'string' || !chunk.text) return;
    if (!turn.firstTokenAt) turn.firstTokenAt = Date.now();
    turn.streamText = `${turn.streamText ?? ''}${chunk.text}`;
    void this.#flushTurn(turn, turn.streamText);
  }

  #turnFor(sessionId, turn) {
    if (turn === undefined) return null;
    return this.#turns.get(`${sessionId}:${turn}`) ?? null;
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
    const chatId = chatKey.startsWith('topic:') ? chatKey.split(':')[1] : chatKey.replace(/^chat:/, '');

    if (event.type === 'turn/start') {
      // 绑定到已有会话时，Web 侧触发的轮次不应往飞书推卡片。
      if (!this.#shouldRenderTurn(sessionId)) return;
      const key = `${sessionId}:${event.data?.turn}`;
      if (this.#turns.has(key)) return;
      const turn = {
        sessionId,
        chatId,
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
      await this.#flushTurn(turn, '⏳ 已收到，正在处理…');
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

    const turn = this.#turnFor(sessionId, event.data?.turn);
    if (!turn) return;

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

  #progressText(turn) {
    return buildProgressText({
      steps: turn.steps,
      elapsedMs: Date.now() - turn.startedAt,
      thinkingMs: turn.thinkingMs,
    });
  }

  #toolPanel(turn, statusNote, force) {
    const now = Date.now();
    if (!force && turn.toolPanel && now - turn.toolPanelAt < PANEL_REFRESH_MS) {
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

  #card(turn, text, statusNote = null, force = false) {
    const panel = this.#toolPanel(turn, statusNote, force);
    const usage = this.#usagePanel(turn, force);
    return turnCard(text, {
      ...(panel ?? {}),
      ...(panel ? {} : { note: statusNote }),
      ...(usage ?? {}),
    });
  }

  /** Token panel shares the 10s refresh cadence with the tool panel. */
  #usagePanel(turn, force) {
    const now = Date.now();
    if (!force && turn.usagePanelAt && now - turn.usagePanelAt < PANEL_REFRESH_MS) {
      return turn.usagePanel ?? null;
    }
    const cumulative = this.#state.usageFor?.(`usage:${turn.chatId}`) ?? null;
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

  async #flushTurn(turn, text) {
    const body = typeof text === 'string' ? text : '';
    if (!body || turn.rendered === body) return;

    // 第一张卡片：话题内走线程回复，其它情况直接发卡片。
    if (!turn.cardMessageId && !turn.cardBroken) {
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
        turn.rendered = body;
        turn.cardAt = Date.now();
        this.#logEvent('card-send', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId ?? '-'}`);
        return;
      } catch (error) {
        this.#log('warn', 'answer card unavailable; falling back to text', error);
        this.#logEvent('answer-card-error', String(error?.message ?? error).slice(0, 300));
        turn.cardBroken = true;
      }
    }
    if (turn.cardMessageId) {
      if (Date.now() - (turn.cardAt ?? 0) < CARD_THROTTLE_MS) return;
      try {
        await this.#bot.patchCard(turn.cardMessageId, this.#card(turn, body));
        this.#logEvent('card-patch', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId}`);
        turn.rendered = body;
        turn.cardAt = Date.now();
        this.#logEvent('card-send', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId ?? '-'}`);
        return;
      } catch (error) {
        this.#log('warn', 'answer card update failed; falling back to text', error);
        this.#logEvent('answer-card-error', String(error?.message ?? error).slice(0, 300));
        turn.cardMessageId = null;
        turn.cardBroken = true;
      }
    }
    try {
      if (!turn.placeholderId) {
        turn.placeholderId = await this.#bot.sendText(turn.chatId, body);
      } else {
        await this.#bot.updateText(turn.placeholderId, body);
      }
      turn.rendered = body;
    } catch (error) {
      this.#log('warn', 'progress render failed', error);
      turn.placeholderId = null;
    }
  }

  /** Footer for the final card: steps, duration, thinking time, failures. */
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
        await this.#bot.sendText(turn.chatId, `话题 #${turn.topic.topicId}「${turn.topic.title}」已同步到主会话。`)
          .catch(() => undefined);
      }
    }
    try {
      if (turn.cardMessageId) {
        const chunks = splitText(final, 24_000);
        await this.#bot.patchCard(turn.cardMessageId, this.#card(turn, chunks[0] ?? final, this.#statusNote(kind), true));
        this.#logEvent('card-final', `session=${turn.sessionId} turn=${turn.turn} id=${turn.cardMessageId}`);
        for (const rest of chunks.slice(1)) await this.#bot.sendText(turn.chatId, rest);
      } else if (turn.placeholderId) {
        const chunks = splitText(final, 3_500);
        await this.#bot.updateText(turn.placeholderId, `${chunks[0] ?? final}\n\n${this.#statusNote(kind)}`);
        for (const rest of chunks.slice(1)) await this.#bot.sendText(turn.chatId, rest);
      } else {
        await this.#bot.sendText(turn.chatId, final);
      }
    } catch (error) {
      this.#log('error', 'final answer failed', error);
      await this.#bot.sendText(turn.chatId, `回复发送失败：${error.message}`).catch(() => undefined);
    }
    if (snapshot.total.calls > 0) {
      await this.#state.addUsage?.(`usage:${turn.chatId}`, snapshot.total).catch(() => undefined);
    }
  }
}
