import React from 'react';

import { configureLocale } from './shared.js';
import { dictionaries, NS } from './locale.js';
import { WorkspacePage } from './workspace.js';
import { FeishuIcon } from './icon.js';
import { WorkerConversationContent, WORKER_CONVERSATION_SLOT } from './worker-conversation.js';

const h = React.createElement;

function BoundPage({ connection, locale, page: Page, ...props }) {
  React.useSyncExternalStore(
    (callback) => locale.subscribe(callback),
    () => locale.getLocale().revision,
    () => 0,
  );
  return h(Page, { ...props, connection });
}

export function createPlugin() {
  return {
    inject: ['slots', 'connection', 'locale', 'uiWorkspace', 'sessions'],
    apply(ctx) {
      const connection = ctx.connection;
      if (!connection || typeof connection.rpc?.call !== 'function') {
        console.error('[im-feishu] client connection service is missing; the main panel cannot call the Host');
      }
      ctx.effect(() => ctx.locale.register(NS, dictionaries()), 'im-feishu: locale');
      ctx.effect(() => configureLocale(ctx.locale), 'im-feishu: locale subscription');
      const memory = {};
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: 'im-feishu',
        children: { [WORKER_CONVERSATION_SLOT]: { kind: 'single', scope: 'session' } },
      }, (props) => h(BoundPage, {
        ...props, page: WorkspacePage, connection, locale: ctx.locale, memory,
        openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
        workerView: { sessions: ctx.sessions, SessionProvider: props.SessionProvider, renderSlot: props.renderSlot },
      })));
      ctx.slots.inject(WORKER_CONVERSATION_SLOT, () => ctx.slots.register({
        name: WORKER_CONVERSATION_SLOT,
      }, WorkerConversationContent));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: 'im-feishu', order: 22,
        label: () => ctx.locale.bind(NS)('飞书机器人IM'),
      }, FeishuIcon));
    },
  };
}
