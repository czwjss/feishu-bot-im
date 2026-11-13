/** Owns pending IM interactions, their callbacks, and their entire lifetime. */
import { randomUUID } from 'node:crypto';
import { approvalCard, questionCard, resolvedApprovalText } from './cards.js';
import { sendNotice } from './notify.js';

function approvalIdOf(request) {
  const session = request?.agent?.session;
  const events = typeof session?.snapshotEvents === 'function' ? session.snapshotEvents() : session?.events;
  if (!Array.isArray(events)) return null;
  const decided = new Set();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === 'approval/decided') decided.add(event.data?.id);
    if (event?.type === 'approval/asked' && event.data?.id && !decided.has(event.data.id)
      && (request.callId ?? null) === (event.data.callId ?? null)) return event.data.id;
  }
  return null;
}

function questionAborted(reason) {
  return Object.assign(new Error(`Feishu question ${reason}`), { code: 'ASK_ABORTED' });
}

const toast = (content, type = 'info') => ({ toast: { type, content } });

export class InteractionManager {
  #bot;
  #canManage;
  #canAnswer;
  #log;
  #timeoutMs;
  #pending = new Map();
  #disposed = false;

  constructor({ bot, canManage, canAnswer, log, timeoutMs = 10 * 60_000 }) {
    this.#bot = bot;
    this.#canManage = canManage;
    this.#canAnswer = canAnswer;
    this.#log = log;
    this.#timeoutMs = timeoutMs;
  }

  approve(request, next, binding) {
    const approvalId = approvalIdOf(request);
    if (!approvalId) return next();
    const hostKey = `${request.agent.session.id}:${approvalId}`;
    if ([...this.#pending.values()].some((entry) => entry.hostKey === hostKey)) return next();
    return this.#wait({ ...binding, kind: 'approval', hostKey, request }, next);
  }

  ask(request, next, binding) {
    const questions = request?.questions;
    // Multiple questions and multi-select answers stay with the native UI.
    if (!Array.isArray(questions) || questions.length !== 1 || questions[0].multiSelect === true) return next();
    return this.#wait({ ...binding, kind: 'question', question: questions[0], request }, next);
  }

  #card(entry, resolved = false) {
    if (entry.kind === 'approval') return approvalCard({
      approvalId: entry.id,
      toolName: entry.request.toolName,
      reason: entry.request.reason,
      ...(resolved ? { resolvedText: resolvedApprovalText(entry.outcome) } : {}),
    });
    const selected = entry.outcome?.answers?.[0]?.selected?.join(', ');
    return questionCard({
      questionId: entry.id,
      question: entry.question.question ?? entry.question.header,
      options: entry.question.options ?? [],
      ...(resolved ? { resolvedText: entry.error ? '已取消或超时' : (selected ? `✅ 已选择：${selected}` : '✅ 已回答') } : {}),
    });
  }

  #paint(entry) {
    if (!entry.messageId || !entry.done) return;
    void Promise.resolve().then(() => this.#bot.patchCard(entry.messageId, this.#card(entry, true)))
      .catch((error) => this.#log('warn', 'resolved interaction card failed', error));
  }

  #wait(details, next) {
    const entry = { ...details, id: randomUUID(), messageId: null, done: false };
    const signal = entry.request.signal;
    let timer;
    const result = new Promise((resolve, reject) => {
      const onAbort = () => entry.cancel('cancelled');
      entry.finish = (outcome, error) => {
        if (entry.done) return;
        entry.done = true;
        entry.outcome = outcome;
        entry.error = error;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.#pending.delete(entry.id);
        this.#paint(entry);
        if (error) reject(error);
        else resolve(outcome);
      };
      entry.cancel = (reason) => entry.kind === 'approval'
        ? entry.finish('cancelled') : entry.finish(null, questionAborted(reason));
      if (this.#disposed || signal?.aborted) { entry.cancel('cancelled'); return; }
      this.#pending.set(entry.id, entry);
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => entry.cancel('timed out'), this.#timeoutMs);
      timer.unref?.();
    });
    if (!entry.done) {
      // A missing native answerer must not prevent an IM answer.
      void Promise.resolve().then(next).then((answer) => entry.finish(answer), () => undefined);
      void Promise.resolve().then(() => {
        if (!entry.done) return this.#bot.sendCard(entry.chatId, this.#card(entry));
      }).then((messageId) => {
        entry.messageId = messageId;
        // Cancellation/native answers can beat the card-send response.
        this.#paint(entry);
      }).catch((error) => this.#log('warn', `${entry.kind} card failed`, error));
    }
    return result;
  }

  onCardAction(action, event, operator) {
    const [kind, id, indexRaw] = action.split(':');
    if (!['approve', 'reject', 'answer'].includes(kind)) return undefined;
    const entry = this.#pending.get(id);
    const expected = kind === 'answer' ? 'question' : 'approval';
    if (!entry || entry.kind !== expected) return toast('这条交互已回答或失效');
    if (!operator || entry.chatId !== event?.context?.open_chat_id) return toast('只能在发起交互的会话里操作');
    if (entry.kind === 'approval') {
      if (!this.#canManage(entry.chatKey, operator)) return toast('只有管理员可以在群里审批', 'warning');
      entry.finish(kind === 'approve' ? 'allowed-once' : 'rejected');
      return toast(kind === 'approve' ? '已批准' : '已拒绝', 'success');
    }
    if (!this.#canAnswer(entry.chatKey, operator)) return toast('当前账号没有回答权限', 'warning');
    const index = /^\d+$/.test(indexRaw ?? '') ? Number(indexRaw) : -1;
    const option = entry.question.options?.[index];
    if (!option) return toast('这个选项已失效');
    entry.finish({ answers: [{ id: entry.question.id ?? 'q', selected: [option.label] }] });
    return toast('已提交选择', 'success');
  }

  resolveText(chatKey, chatId, openId, text) {
    const approve = /^(批准|同意|允许|yes|y|ok)$/i.test(text.trim());
    const reject = /^(拒绝|不同意|deny|no|n)$/i.test(text.trim());
    if (!approve && !reject) return false;
    const entry = [...this.#pending.values()].find((item) => item.chatId === chatId && item.kind === 'approval');
    if (!entry) return false;
    if (!this.#canManage(chatKey, openId)) {
      void sendNotice(this.#bot, chatId, '只有管理员可以审批。', '需要管理员', 'orange').catch(() => undefined);
      return true;
    }
    entry.finish(approve ? 'allowed-once' : 'rejected');
    void sendNotice(this.#bot, chatId, approve ? '✅ 已批准一次。' : '🚫 已拒绝。', '审批结果', approve ? 'green' : 'red')
      .catch(() => undefined);
    return true;
  }

  dispose() {
    this.#disposed = true;
    for (const entry of this.#pending.values()) entry.cancel('cancelled');
  }
}
