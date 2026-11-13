import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAutoSave } from '../client/autosave.js';
import { botSettingUpdates } from '../client/bot-settings.js';
import { API } from '../src/contracts.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('text edits debounce per setting while switches save immediately', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const save = createAutoSave();
  const calls = [];
  save.schedule('rules', async () => calls.push('old text'), 600);
  t.mock.timers.tick(300);
  save.schedule('rules', async () => calls.push('latest text'), 600);
  save.schedule('color', async () => calls.push('color'));
  await tick();
  assert.deepEqual(calls, ['color']);
  t.mock.timers.tick(599); await tick();
  assert.deepEqual(calls, ['color']);
  t.mock.timers.tick(1); await tick();
  assert.deepEqual(calls, ['color', 'latest text']);
});

test('composition pauses text writes until Chinese input is committed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const save = createAutoSave();
  const calls = [];
  save.schedule('rules', async () => calls.push('partial'), 600);
  save.pauseText();
  save.schedule('rules', async () => calls.push('composing'), 600);
  save.schedule('switch', async () => calls.push('switch'));
  t.mock.timers.tick(2000); await tick();
  assert.deepEqual(calls, ['switch']);
  save.resumeText();
  save.schedule('rules', async () => calls.push('中文输入'), 600);
  t.mock.timers.tick(600); await tick();
  assert.deepEqual(calls, ['switch', '中文输入']);
});

test('a slow save cannot overtake or discard later edits to the same setting', async () => {
  const save = createAutoSave();
  const gate = deferred();
  const calls = [];
  let persisted;
  save.schedule('rules', async () => { calls.push('first'); await gate.promise; persisted = 'first'; });
  await tick();
  save.schedule('rules', async () => { calls.push('superseded'); persisted = 'superseded'; });
  save.schedule('rules', async () => { calls.push('latest'); persisted = 'latest'; });
  await tick(); assert.deepEqual(calls, ['first']);
  gate.resolve();
  assert.equal(await save.flush(), true);
  assert.deepEqual(calls, ['first', 'latest']);
  assert.equal(persisted, 'latest');
});

test('failures retain the submitted edit for retry without blocking unrelated settings', async () => {
  const save = createAutoSave();
  let state, attempts = 0;
  save.subscribe((value) => { state = value; });
  const calls = [];
  save.schedule('rules', async () => { if (++attempts === 1) throw new Error('offline'); calls.push('rules'); });
  save.schedule('color', async () => calls.push('color'));
  assert.equal(await save.flush(), false);
  assert.equal(state.status, 'error');
  assert.match(state.error, /offline/);
  assert.deepEqual(calls, ['color']);
  assert.equal(await save.flush(), false, 'closing does not silently discard or repeatedly retry a failed write');
  assert.equal(attempts, 1);
  assert.equal(await save.flush(true), true);
  assert.equal(state.status, 'saved');
  assert.deepEqual(calls, ['color', 'rules']);
});

test('an edit made during a failing request supersedes the failed value', async () => {
  const save = createAutoSave();
  const gate = deferred();
  const calls = [];
  save.schedule('rules', async () => { await gate.promise; throw new Error('old value rejected'); });
  await tick();
  save.schedule('rules', async () => calls.push('corrected'));
  gate.resolve();
  assert.equal(await save.flush(), true);
  assert.deepEqual(calls, ['corrected']);
});

test('closing flushes the debounce and drains edits made during the pending save', async () => {
  const save = createAutoSave();
  const gate = deferred();
  const calls = [];
  save.schedule('rules', async () => { await gate.promise; calls.push('first'); }, 60_000);
  const closing = save.flush();
  await tick();
  save.schedule('rules', async () => calls.push('last'), 60_000);
  gate.resolve();
  assert.equal(await closing, true);
  assert.deepEqual(calls, ['first', 'last']);
});

test('cancelling a removed chat setting clears its pending timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const save = createAutoSave();
  const calls = [];
  save.schedule('chat-keywords', async () => calls.push('removed chat'), 600);
  save.cancel('chat-keywords');
  t.mock.timers.tick(1000);
  await save.flush();
  assert.deepEqual(calls, []);
});

const initial = () => ({
  workspace: '', workspaceMode: '', workspaceCustom: '', provider: 'p', model: 'm', reasoningEffort: '',
  preset: '', permissionPreset: '', processDetail: 'detailed', busyMode: { direct: 'queue', group: 'queue' },
  contextEnhancement: { direct: { enabled: true, fields: [], guidance: '' }, group: { enabled: true, fields: [], guidance: '' } },
  respondBot: true, eavesdrop: { enabled: true, limit: 20 }, mentions: { enabled: true, allowAll: false },
  group: 'all', allow: '', managers: '',
});

test('bot autosave submits only changed settings and keeps coupled payloads complete', () => {
  const before = initial();
  assert.deepEqual(botSettingUpdates(before, { ...before, workspaceMode: '__custom__' }), []);
  assert.deepEqual(botSettingUpdates(before, { ...before, reasoningEffort: 'high' }), [
    { key: API.botModelSet, method: API.botModelSet, payload: { model: { provider: 'p', model: 'm', reasoningEffort: 'high' } } },
  ]);
  const next = { ...before, busyMode: { direct: 'steer', group: 'steer' }, managers: ' ou_a，ou_b ' };
  const changes = botSettingUpdates(before, next);
  assert.equal(new Set(changes.map((item) => item.key)).size, 3, 'direct/group writes have separate keys');
  assert.deepEqual(changes.at(-1).payload.access, { group: 'all', allowOpenIds: [], managers: ['ou_a', 'ou_b'] });
  const directEdit = { ...before, contextEnhancement: { ...before.contextEnhancement, direct: { ...before.contextEnhancement.direct, guidance: 'direct' } } };
  const groupEdit = { ...directEdit, contextEnhancement: { ...directEdit.contextEnhancement, group: { ...before.contextEnhancement.group, guidance: 'group' } } };
  const [context] = botSettingUpdates(directEdit, groupEdit);
  assert.equal(context.method, API.botContextSet);
  assert.equal(context.payload.config.direct.guidance, 'direct');
  assert.equal(context.payload.config.group.guidance, 'group');
});
