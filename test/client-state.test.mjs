import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createQuery, startPolling, syncDraft, commitDraft, remainingSeconds } from '../client/async.js';
import { BOT_COLORS, API, RPC_ENDPOINT } from '../src/contracts.js';
import { normalizeColor } from '../src/config.js';
import { createRpcHandler } from '../src/rpc.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
class Visibility extends EventTarget {
  hidden = false;
  set(hidden) { this.hidden = hidden; this.dispatchEvent(new Event('visibilitychange')); }
}

test('polling waits for a slow request, pauses when hidden, and aborts on cleanup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new Visibility();
  const first = deferred();
  const signals = [];
  const stop = startPolling(async (signal) => {
    signals.push(signal);
    if (signals.length === 1) await first.promise;
  }, { interval: 100, document });
  t.after(stop);
  assert.equal(signals.length, 1);
  t.mock.timers.tick(1000);
  document.set(true);
  document.set(false);
  assert.equal(signals.length, 1, 'visibility changes cannot overlap a request');
  first.resolve();
  await tick();
  t.mock.timers.tick(100);
  assert.equal(signals.length, 2);
  await tick();
  document.set(true);
  t.mock.timers.tick(1000);
  assert.equal(signals.length, 2);
  document.set(false);
  assert.equal(signals.length, 3);
  stop();
  await tick();
  assert.ok(signals.every((signal) => signal.aborted));
  document.set(true);
  document.set(false);
  t.mock.timers.tick(1000);
  assert.equal(signals.length, 3);
});

test('manual refresh shares an in-flight query and old responses cannot overwrite saved data', async () => {
  const pending = deferred();
  const values = [];
  let calls = 0;
  const query = createQuery(() => { calls += 1; return pending.promise; }, { onValue: (value) => values.push(value), onError: assert.fail });
  const first = query.refresh();
  assert.equal(query.refresh(), first);
  await tick();
  assert.equal(calls, 1);
  query.accept('saved');
  pending.resolve('old snapshot');
  await first;
  assert.deepEqual(values, ['saved']);
});

test('query cleanup ignores late failures and a later activation can refresh again', async () => {
  const pending = deferred();
  const errors = [];
  const values = [];
  let fetch = () => pending.promise;
  const query = createQuery(() => fetch(), { onValue: (value) => values.push(value), onError: (error) => errors.push(error) });
  const first = query.refresh();
  await tick();
  query.dispose();
  pending.reject(new Error('late'));
  await first;
  assert.deepEqual(errors, []);
  query.activate();
  fetch = async () => 'new';
  await query.refresh();
  assert.deepEqual(values, ['new']);
});

test('query failure is reported and does not block retry', async () => {
  let calls = 0;
  const errors = [];
  const values = [];
  const query = createQuery(async () => {
    if (++calls === 1) throw new Error('offline');
    return 'recovered';
  }, { onValue: (value) => values.push(value), onError: (error) => errors.push(error.message) });
  assert.equal(await query.refresh(), null);
  assert.equal(await query.refresh(), 'recovered');
  assert.deepEqual(errors, ['offline']);
  assert.deepEqual(values, ['recovered']);
});

test('background status updates preserve dirty drafts, including edits during save', () => {
  const initial = { baseline: 'old', value: 'old' };
  assert.deepEqual(syncDraft(initial, 'server'), { baseline: 'server', value: 'server' });
  const edited = { ...initial, value: 'typing' };
  assert.equal(syncDraft(edited, 'server').value, 'typing');
  assert.deepEqual(commitDraft(edited, 'normalized', 'typing'), { baseline: 'normalized', value: 'normalized' });
  const laterEdit = { ...edited, value: 'new typing' };
  const committed = commitDraft(laterEdit, 'normalized', 'typing');
  assert.equal(committed.value, 'new typing');
  assert.equal(syncDraft(committed, 'normalized').value, 'new typing');
});

test('scan countdown follows the server expiry, including non-five-minute grants', () => {
  assert.equal(remainingSeconds(720_000, 0), 720);
  assert.equal(remainingSeconds(720_000, 719_001), 1);
  assert.equal(remainingSeconds(720_000, 720_001), 0);
  assert.equal(remainingSeconds(null, 0), 0);
});

test('every displayed color round-trips and shared RPC names reach the backend', async () => {
  const result = await build({ entryPoints: [new URL('../client/shared.js', import.meta.url).pathname], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'] });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => ({ Component: class {}, createElement() {} }) });
  const palette = module.exports.BOT_COLORS;
  assert.deepEqual(Object.keys(palette).sort(), [...BOT_COLORS].sort());
  for (const color of Object.keys(palette)) {
    assert.equal(normalizeColor(color), color);
    assert.match(palette[color].main, /^#[\da-f]{6}$/i);
    assert.ok(module.exports.COLOR_NAMES[color]);
  }
  assert.equal(RPC_ENDPOINT, 'im-feishu');
  const handler = createRpcHandler({ manager: { status: async () => ({ bots: [] }) }, version: 'test' });
  assert.deepEqual(await handler(API.botsList, {}), { ok: true, value: { bots: [], version: 'test' } });
});

test('a bot card can mount with a populated model catalog before its draft effect runs', async () => {
  const React = {
    Component: class {},
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: (current) => ({ current }), useCallback: (callback) => callback, useEffect() {},
  };
  const result = await build({ entryPoints: [new URL('../client/bot.js', import.meta.url).pathname], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'] });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => React, navigator: { language: 'zh-CN' } });
  const card = module.exports.BotCard({
    connection: {}, bot: { id: 'first-render', state: 'connected' },
    models: [{ provider: 'test', model: 'test-model', label: 'Test model' }],
    presets: [], workspaces: [], permissionOptions: [], onChanged() {},
  });
  assert.equal(card.type, 'article');
});

// A small hook runner exercises the real hooks without adding a React runtime dependency.
async function hookFixture() {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];
  const same = (left, right) => left?.length === right?.length && left.every((value, index) => Object.is(value, right[index]));
  const React = {
    Component: class {}, createElement() {},
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (update) => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }];
    },
    useRef(initial) { const index = cursor++; return (slots[index] ??= { current: initial }); },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { value: factory(), dependencies };
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) {
        const previous = slots[index];
        const slot = slots[index] = { dependencies };
        pendingEffects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const result = await build({ entryPoints: [new URL('../client/hooks.js', import.meta.url).pathname], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'] });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => React, setTimeout, clearTimeout });
  return {
    hooks: module.exports,
    render(callback) { cursor = 0; const value = callback(); const effects = pendingEffects; pendingEffects = []; effects.forEach((effect) => effect()); return value; },
    dispose() { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

test('the draft hook preserves typing on a real server-value effect and settles a save', async (t) => {
  const fixture = await hookFixture();
  t.after(() => fixture.dispose());
  let server = 'old';
  const render = () => fixture.render(() => fixture.hooks.useDraft(server));
  let draft = render();
  draft[1]('typing');
  server = 'changed remotely';
  render();
  draft = render();
  assert.equal(draft[0], 'typing');
  draft[2]('normalized', 'typing');
  assert.equal(render()[0], 'normalized');
});

test('the mutation hook serializes independent saves and discards queued work on unmount', async () => {
  const fixture = await hookFixture();
  const { run } = fixture.render(() => fixture.hooks.useMutation());
  const first = deferred();
  const calls = [];
  const a = run('a', async () => { calls.push('a'); await first.promise; }, () => calls.push('saved-a'));
  const b = run('b', async () => { calls.push('b'); });
  await tick();
  assert.deepEqual(calls, ['a']);
  fixture.dispose();
  first.resolve();
  await Promise.all([a, b]);
  assert.deepEqual(calls, ['a'], 'neither callbacks nor queued remote writes run after unmount');
});

test('autosave completes accepted edits on unmount without updating the unmounted component', async () => {
  const fixture = await hookFixture();
  const save = fixture.render(() => fixture.hooks.useAutoSave());
  const first = deferred();
  const calls = [];
  save.schedule('rules', async () => { await first.promise; calls.push('first'); }, 0, () => calls.push('stale callback'));
  await tick();
  save.schedule('rules', async () => calls.push('latest'), 60_000, () => calls.push('stale callback'));
  fixture.dispose();
  first.resolve();
  assert.equal(await save.flush(), true);
  assert.deepEqual(calls, ['first', 'latest']);
});
