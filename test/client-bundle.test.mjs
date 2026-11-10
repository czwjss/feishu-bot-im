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
  createElement: () => null,
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
const ctx = {
  connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
  locale,
  effect(fn) { cleanup.push(fn()); },
  slots: {
    inject(_name, fn) { fn(); },
    register(options, component) { section = { options, component }; },
  },
};
const plugin = spec.factory(() => React);
assert.deepEqual(plugin.inject, ['slots', 'connection', 'locale']);
plugin.apply(ctx);
assert.equal(dictionaries.length, 1, 'locale dictionary is registered');
assert.equal(dictionaries[0].ns, 'imFeishu');
assert.equal(dictionaries[0].dict.en['飞书机器人'], 'Feishu bots');
assert.equal(section.options.id, 'im-feishu');
assert.equal(section.options.locale, 'imFeishu');
assert.equal(typeof section.component, 'function');
assert.equal(readFileSync(new URL('../client.js', import.meta.url), 'utf8').includes('__ModuleLoader__'), true);
assert.match(readFileSync(new URL('../client/shared.js', import.meta.url), 'utf8'), /const RPC_ENDPOINT = 'im-feishu'/);
console.log('client bundle: 9 assertions passed');
