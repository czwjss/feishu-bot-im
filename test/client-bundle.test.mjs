import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let spec = null;
globalThis.window = {
  __ModuleLoader__: {
    load(value) { spec = value; },
  },
};
await import('../client.js');
assert.ok(spec, 'client bundle registers a module factory');
assert.equal(spec.id, '@czwjss/feishu-bot-im');

class Component {}
const React = {
  Component,
  createElement: (type, props, ...children) => ({ type, props, children }),
  useSyncExternalStore: () => 0,
};
const dictionaries = [];
const cleanup = [];
const locale = {
  register(ns, dict) { dictionaries.push({ ns, dict }); return () => {}; },
  bind() { return (key) => key; },
  getLocale() { return { active: 'en', revision: 0 }; },
  subscribe() { return () => {}; },
};
let section = null;
const registrations = new Map();
const navigation = [];
const ctx = {
  connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
  locale,
  layout: { selectPanel(id) { navigation.push(['panel', id]); } },
  sessions: { retain() { throw new Error('Registration must not retain sessions'); } },
  uiWorkspace: { openSession(id) { navigation.push(['session', id]); } },
  effect(fn) { cleanup.push(fn()); },
  slots: {
    inject(_name, fn) { fn(); },
    register(options, component) { section = { options, component }; registrations.set(options.name, section); },
  },
};
const plugin = spec.factory(() => React);
assert.deepEqual(plugin.inject, ['slots', 'connection', 'locale', 'uiWorkspace', 'sessions']);
plugin.apply(ctx);
assert.equal(dictionaries.length, 1, 'locale dictionary is registered');
assert.equal(dictionaries[0].ns, 'imFeishu');
assert.equal(dictionaries[0].dict.en['飞书机器人IM'], 'Feishu Bot IM');
assert.equal(registrations.size, 3);
assert.deepEqual(registrations.get('main').options.children, { 'im-feishu.worker.conversation': { kind: 'single', scope: 'session' } });
assert.equal(typeof registrations.get('im-feishu.worker.conversation').component, 'function');
assert.equal(registrations.has('settings.section'), false, 'main panel is the only management entry');
assert.equal(registrations.get('sidebar.panellist').options.label(), '飞书机器人IM');
assert.equal(registrations.get('main').options.key, registrations.get('sidebar.panellist').options.id);
const sessionProvider = () => null;
const renderSlot = () => null;
const main = registrations.get('main').component({ SessionProvider: sessionProvider, renderSlot });
assert.equal(main.props.workerView.sessions, ctx.sessions);
assert.equal(main.props.workerView.SessionProvider, sessionProvider);
assert.equal(main.props.workerView.renderSlot, renderSlot);
main.props.openSession('session-example');
assert.deepEqual(navigation, [['session', 'session-example']], 'navigation uses native DSH services');
for (const [file, title] of [['zh', '飞书机器人IM'], ['en', 'Feishu Bot IM']]) {
  assert.equal(JSON.parse(readFileSync(new URL(`../locale/${file}.json`, import.meta.url))).meta.title, title);
}
assert.equal(readFileSync(new URL('../client.js', import.meta.url), 'utf8').includes('__ModuleLoader__'), true);
assert.match(readFileSync(new URL('../src/contracts.js', import.meta.url), 'utf8'), /const RPC_ENDPOINT = 'im-feishu'/);
console.log('client bundle: 9 assertions passed');
