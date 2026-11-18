import test from 'node:test';
import assert from 'node:assert/strict';
import { clientRenderer, findNodes, textOf } from './helpers/client-renderer.mjs';
import { workerViewFixture } from './helpers/worker-view.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('embedded Worker retains its own scope immediately and releases only its client reference', async (t) => {
  const r = await clientRenderer(); t.after(() => r.dispose());
  const opening = deferred();
  const f = workerViewFixture({ ready: () => opening.promise });
  r.mount('WorkerSessionView', { sessionId: 'worker-a', workerView: f.workerView });
  await r.settle();
  assert.deepEqual(f.retained, [{ sessionId: 'worker-a', source: 'feishuAvatar' }]);
  assert.equal(findNodes(r.tree, (node) => node.props['data-native-worker'] === 'worker-a').length, 1);
  assert.ok(f.slots.every((slot) => slot.name === 'im-feishu.worker.conversation'));
  r.dispose();
  assert.deepEqual(f.released, ['worker-a']);
  opening.reject(new Error('late close rejection'));
  await new Promise(setImmediate);
});

test('switching Workers ignores a late open failure from the released Worker', async (t) => {
  const r = await clientRenderer(); t.after(() => r.dispose());
  const old = deferred();
  const f = workerViewFixture({ ready: (id) => id === 'old' ? old.promise : Promise.resolve() });
  r.mount('WorkerSessionView', { sessionId: 'old', workerView: f.workerView }); await r.settle();
  r.mount('WorkerSessionView', { sessionId: 'new', workerView: f.workerView }); await r.settle();
  old.reject(new Error('stale failure')); await r.settle();
  assert.deepEqual(f.released, ['old']);
  assert.deepEqual(f.retained.map((item) => item.sessionId), ['old', 'new']);
  assert.doesNotMatch(textOf(r.tree), /stale failure/);
  assert.equal(findNodes(r.tree, (node) => node.props['data-native-worker'] === 'new').length, 1);
});

test('failed Worker opens remain retryable and refresh missing catalog entries before retain', async (t) => {
  const r = await clientRenderer(); t.after(() => r.dispose());
  let attempts = 0, refreshed = 0;
  const f = workerViewFixture({ known: false, refresh: async () => { refreshed++; }, ready: () => ++attempts === 1 ? Promise.reject(new Error('history unavailable')) : Promise.resolve() });
  r.mount('WorkerSessionView', { sessionId: 'worker-a', workerView: f.workerView }); await r.settle();
  assert.match(textOf(r.tree), /history unavailable/);
  const retry = findNodes(r.tree, (node) => node.type === 'button' && textOf(node) === '重试')[0];
  retry.props.onClick(); await r.settle();
  assert.equal(refreshed, 2);
  assert.deepEqual(f.released, ['worker-a']);
  assert.doesNotMatch(textOf(r.tree), /history unavailable/);
  assert.equal(findNodes(r.tree, (node) => node.props['data-native-worker'] === 'worker-a').length, 1);
});

test('closing while catalog refresh is pending never acquires an orphaned reference', async (t) => {
  const r = await clientRenderer(); t.after(() => r.dispose());
  const pending = deferred();
  const f = workerViewFixture({ known: false, refresh: () => pending.promise });
  r.mount('WorkerSessionView', { sessionId: 'worker-a', workerView: f.workerView }); await r.settle();
  r.dispose(); pending.resolve(); await new Promise(setImmediate);
  assert.deepEqual(f.retained, []);
});

test('native conversation uses the embedded factory with Chat view and proper loading phases', async (t) => {
  const r = await clientRenderer(); t.after(() => r.dispose());
  for (const [state, summaryBlank, targets, expected] of [
    [{ blank: true, awaitingFirstTurn: true, openState: 'loading' }, undefined, 0, 'settling'],
    [{ blank: true, awaitingFirstTurn: true, openState: 'open' }, true, 0, 'hero'],
    [{ blank: false, awaitingFirstTurn: false, openState: 'open' }, false, 1, 'active'],
    [{ blank: true, awaitingFirstTurn: true, running: true, openState: 'open' }, true, 0, 'active'],
  ]) {
    const calls = [];
    r.mount('WorkerConversationContent', {
      sessionId: 'worker-a', useSession: (select) => select(state),
      useConversation: (select) => select({ activeTargets: new Set(Array.from({ length: targets }, (_, i) => i)) }),
      useSessions: (select) => select({ byId: { 'worker-a': { blank: summaryBlank } } }),
      renderFactorySlot: (...args) => { calls.push(args); return null; },
    });
    const [name, input, options] = calls.at(-1);
    assert.equal(name, 'conversation.content');
    assert.deepEqual(JSON.parse(JSON.stringify(input)), { variant: 'embedded', phase: expected, hero: expected === 'hero' });
    let view;
    options.slots.views({ renderSlot: (slot, props) => { view = { slot, ...props }; return null; } });
    assert.deepEqual(view, { slot: 'conversation.session', view: 'chat' });
    assert.equal(options.slots.widthControls, undefined);
  }
});
