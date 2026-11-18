import React from 'react';
import { Boundary, t } from './shared.js';

const h = React.createElement;
export const WORKER_CONVERSATION_SLOT = 'im-feishu.worker.conversation';

/** The embedded view always shows the chat, independent of the main view's tab. */
export function WorkerChatView({ renderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

/** A strict Session slot: all native actions inherit this Worker's provider. */
export function WorkerConversationContent({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((value) => value);
  const conversation = useConversation((value) => value);
  const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
  const hasContent = conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running || session.promptAttempted;
  const hero = !hasContent && (session.openState === 'open' || summaryBlank === true);
  const settling = !hasContent && session.openState === 'loading' && summaryBlank !== true;
  return renderFactorySlot('conversation.content', {
    variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero,
  }, { slots: { views: WorkerChatView } });
}

function RetainedWorker({ sessionId, sessions, SessionProvider, renderSlot, onRetry }) {
  const [reference, setReference] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    let retained;
    void (async () => {
      try {
        const known = sessions.list?.getSnapshot?.()?.byId?.[sessionId] || sessions.binding?.(sessionId);
        if (!known) await sessions.refresh?.();
        if (!alive) return;
        retained = sessions.retain(sessionId, { source: 'feishuAvatar' });
        setReference(retained);
        // Bind immediately so the native conversation can display its loading state.
        await retained.ready;
      } catch (failure) {
        if (alive) setError(failure?.message ?? String(failure));
      }
    })();
    return () => {
      alive = false;
      // Releasing the UI reference never cancels or archives the Host Worker.
      retained?.release();
    };
  }, [sessions, sessionId]);
  if (error) return h('div', { className: 'bxf-work-alert', role: 'alert' }, error,
    h('button', { type: 'button', className: 'bxf-mini', onClick: onRetry }, t('重试', 'Retry')));
  if (!reference) return h('div', { className: 'bxf-work-empty', role: 'status' }, t('正在加载 Worker 会话…', 'Loading Worker conversation…'));
  return h(SessionProvider, { session: reference }, renderSlot(WORKER_CONVERSATION_SLOT, {}));
}

/** One retained native conversation, released on close, robot change or unmount. */
export function WorkerSessionView({ sessionId, workerView }) {
  const [attempt, setAttempt] = React.useState(0);
  if (typeof workerView?.sessions?.retain !== 'function' || !workerView?.SessionProvider
    || typeof workerView?.renderSlot !== 'function') {
    return h('div', { className: 'bxf-work-empty', role: 'status' },
      t('当前 DSH 未提供内嵌会话能力，可使用「独立打开」。', 'Embedded conversations are unavailable in this DSH version. Use Open separately.'));
  }
  return h(Boundary, { key: `${sessionId}:${attempt}` },
    h(RetainedWorker, { sessionId, ...workerView, onRetry: () => setAttempt((value) => value + 1) }));
}

export function WorkerConversationPanel({ worker, currentSessionId, workerView, onBack, onCurrent, onOpenSession, actions }) {
  const historical = worker.sessionId && currentSessionId !== worker.sessionId;
  return h('section', { className: 'bxf-worker-panel', 'aria-label': t('Worker 会话', 'Worker conversation') },
    h('header', { className: 'bxf-worker-header' },
      h('button', { type: 'button', className: 'bxf-mini bxf-avatar-back', onClick: onBack }, t('会话列表', 'Chat list')),
      h('div', { className: 'bxf-worker-title' }, h('strong', null, worker.name || worker.chatId),
        h('span', { className: 'bxf-work-meta', title: worker.sessionId },
          historical ? t('历史 Worker', 'Previous Worker') : worker.sessionId ? 'Worker' : t('尚未创建 Worker', 'No Worker yet'))),
      h('div', { className: 'bxf-worker-actions' }, actions,
      historical && h('button', { type: 'button', className: 'bxf-mini', onClick: onCurrent }, t('返回当前 Worker', 'Current Worker')),
      h('button', { type: 'button', className: 'bxf-mini', disabled: !worker.sessionId || !onOpenSession,
        title: worker.sessionId, onClick: () => void onOpenSession(worker.sessionId),
      }, t('独立打开', 'Open separately')))),
    h('div', { className: 'bxf-worker-native' }, worker.sessionId
      ? h(WorkerSessionView, { sessionId: worker.sessionId, workerView })
      : h('div', { className: 'bxf-avatar-worker-empty' },
        h('strong', null, t('等待首次派发', 'Awaiting first dispatch')),
        h('p', { className: 'bxf-work-meta' }, t('新消息派发后，Worker 对话会显示在这里。', 'The Worker conversation appears here after the first message batch is dispatched.')))));
}
