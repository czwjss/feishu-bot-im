import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/json-store.js';
import { ConfigStore, StateStore } from '../src/config.js';
import { UserTokenStore } from '../src/user-identity/token-store.js';
import { UserIdentityConfigStore } from '../src/user-identity/config.js';
import { MonitorStore } from '../src/user-identity/monitor-store.js';

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'feishu-json-'));
  t.after(() => rm(path, { force: true, recursive: true }));
  return path;
}

test('failed state writes keep the last committed memory and remove temporary files', async (t) => {
  const root = await directory(t);
  const path = join(root, 'state.json');
  const store = await new StateStore(path).load();
  await store.bindSession('chat:a', 'original');
  await rm(path);
  await mkdir(path);
  await assert.rejects(store.bindSession('chat:a', 'failed'));
  assert.equal(store.sessionFor('chat:a'), 'original');
  assert.deepEqual(await readdir(root), ['state.json']);
  await rm(path, { recursive: true });
  await store.bindSession('chat:b', 'later');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')).sessions, { 'chat:a': 'original', 'chat:b': 'later' });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test('transactional state changes merge against the latest committed document', async (t) => {
  const path = join(await directory(t), 'state.json');
  const store = await new StateStore(path).load();
  await Promise.all([
    store.addUsage('chat:a', { input: 2, calls: 1 }),
    store.addUsage('chat:a', { input: 3, calls: 1 }),
    store.setOverride('chat:a', { workspace: '/work' }),
    store.setOverride('chat:a', { preset: 'helper' }),
    store.setStats('chat:a', true), store.setTools('chat:a', true),
    store.markSeen('same'), store.markSeen('same'),
  ]);
  assert.deepEqual(store.usageFor('chat:a'), { input: 5, output: 0, cache: 0, calls: 2 });
  assert.deepEqual(store.overrideFor('chat:a'), { workspace: '/work', preset: 'helper' });
  assert.equal(store.statsFor('chat:a'), true);
  assert.equal(store.toolsFor('chat:a'), true);
  assert.deepEqual(store.value.seen, ['same']);
  assert.deepEqual((await new StateStore(path).load()).value, store.value);
});

test('all stores distinguish corrupt documents from absent ones', async (t) => {
  const root = await directory(t);
  const factories = [
    (path) => new ConfigStore(path), (path) => new StateStore(path),
    (path) => new UserTokenStore({ path }), (path) => new UserIdentityConfigStore({ path }),
    (path) => new MonitorStore({ configPath: path, statePath: join(root, 'monitor-state.json') }),
  ];
  for (const [index, make] of factories.entries()) {
    const path = join(root, `${index}.json`);
    await make(path).load();
    await writeFile(path, '{');
    await assert.rejects(make(path).load(), { code: 'INVALID_JSON' });
    assert.equal(await readFile(path, 'utf8'), '{');
  }
});

test('a failed load blocks accidental overwrites until the document is repaired', async (t) => {
  const path = join(await directory(t), 'config.json');
  await writeFile(path, '{');
  const store = new JsonStore(path, (value) => value ?? {});
  await assert.rejects(store.load());
  await assert.rejects(store.update(() => ({ replacement: true })));
  assert.equal(await readFile(path, 'utf8'), '{');
  await writeFile(path, '{"recovered":true}');
  await store.load();
  await store.update((value) => ({ ...value, saved: true }));
  assert.deepEqual(store.value, { recovered: true, saved: true });
});

test('identity and token patches do not lose concurrent independent fields', async (t) => {
  const root = await directory(t);
  const config = await new UserIdentityConfigStore({ path: join(root, 'identity.json') }).load();
  await Promise.all([config.save({ botId: 'bot-a' }), config.save({ scope: 'im:message' })]);
  assert.equal(config.config.botId, 'bot-a');
  assert.equal(config.config.scope, 'im:message');
  const tokens = await new UserTokenStore({ path: join(root, 'tokens.json') }).load();
  await Promise.all([tokens.save({ accessToken: 'test-access' }), tokens.save({ refreshToken: 'test-refresh' })]);
  assert.equal(tokens.document.accessToken, 'test-access');
  assert.equal(tokens.document.refreshToken, 'test-refresh');
  await Promise.all([tokens.save({ appId: 'old' }), tokens.clear(), tokens.save({ appId: 'new' })]);
  assert.equal(tokens.document.appId, 'new');
  assert.equal(tokens.document.accessToken, '');
  assert.equal(tokens.document.refreshToken, '');
});
