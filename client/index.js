import React from 'react';

import { configureLocale } from './shared.js';
import { dictionaries, NS } from './locale.js';
import { SettingsPage } from './settings.js';

const h = React.createElement;

function BoundPage({ connection, locale, ...props }) {
  React.useSyncExternalStore(
    (callback) => locale.subscribe(callback),
    () => locale.getLocale().revision,
    () => 0,
  );
  return h(SettingsPage, { ...props, connection });
}

export function createPlugin() {
  return {
    inject: ['slots', 'connection', 'locale'],
    apply(ctx) {
      const connection = ctx.connection;
      if (!connection || typeof connection.rpc?.call !== 'function') {
        console.error('[im-feishu] client connection service is missing; the settings page cannot call the Host');
      }
      ctx.effect(() => ctx.locale.register(NS, dictionaries()), 'im-feishu: locale');
      ctx.effect(() => configureLocale(ctx.locale), 'im-feishu: locale subscription');
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'im-feishu',
        order: 22,
        locale: NS,
        label: () => ctx.locale.bind(NS)('飞书机器人'),
      }, (props) => h(BoundPage, { ...props, connection, locale: ctx.locale })));
    },
  };
}
