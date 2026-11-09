import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_USER_SCOPE,
  UserIdentityConfigStore,
  normalizeIdentityConfig,
  normalizeUserScope,
} from '../src/user-identity/config.js';
import { UserTokenStore, EXPIRY_MARGIN_MS } from '../src/user-identity/token-store.js';

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-user-config-'));
try {
  assert.equal(normalizeUserScope(undefined), DEFAULT_USER_SCOPE);
  assert.equal(DEFAULT_USER_SCOPE.split(' ').length, 23);
  assert.match(DEFAULT_USER_SCOPE, /im:resource/);
  assert.doesNotMatch(DEFAULT_USER_SCOPE, /im:resource:upload/);
  assert.match(DEFAULT_USER_SCOPE, /docx:document:readonly/);
  assert.doesNotMatch(DEFAULT_USER_SCOPE, /wiki:node|sheets:spreadsheet|base:app|calendar:calendar|task:task|approval:/);
  assert.equal(normalizeUserScope(''), '');
  assert.equal(normalizeUserScope('offline_access  im:message offline_access'), 'offline_access im:message');

  const config = normalizeIdentityConfig({ botId: ' b1 ', scope: 'offline_access im:message' });
  assert.equal(config.botId, 'b1');
  assert.equal(config.scope, 'offline_access im:message');

  const configPath = join(dir, 'user-identity.json');
  const configStore = await new UserIdentityConfigStore({ path: configPath }).load();
  assert.equal(configStore.config.botId, '');
  await configStore.save({ botId: 'bot_1' });
  await configStore.save({ scope: 'offline_access im:message' });
  assert.equal(configStore.config.botId, 'bot_1', 'patch keeps untouched fields');
  assert.equal((await stat(configPath)).mode & 0o777, 0o600);

  const tokenPath = join(dir, 'user-token.json');
  const tokens = await new UserTokenStore({ path: tokenPath }).load();
  assert.equal(tokens.document, null);
  const now = 1_800_000_000_000;
  await tokens.save({
    appId: 'cli_app',
    accessToken: 'a1',
    refreshToken: 'r1',
    accessTokenExpiresAt: now + 3_600_000,
    refreshTokenExpiresAt: now + 86_400_000,
    scope: 'offline_access',
    authorizedAt: new Date(now).toISOString(),
    user: { name: '陈志文', openId: 'ou_1' },
  });
  assert.equal((await stat(tokenPath)).mode & 0o777, 0o600);
  assert.equal(tokens.accessTokenUsable(now), true);
  assert.equal(tokens.accessTokenUsable(now + 3_600_000 - EXPIRY_MARGIN_MS + 1), false);
  const status = tokens.status(now);
  assert.equal(status.present, true);
  assert.equal(status.user.name, '陈志文');
  assert.equal(JSON.stringify(status).includes('a1'), false, 'status hides tokens');

  const reloaded = await new UserTokenStore({ path: tokenPath }).load();
  assert.equal(reloaded.document.refreshToken, 'r1');
  await reloaded.clear();
  assert.equal(reloaded.document, null);

  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  assert.equal(raw.version, 1);
  assert.equal(raw.scopeVersion, 4);

  const legacyPath = join(dir, 'legacy-identity.json');
  await writeFile(legacyPath, JSON.stringify({
    version: 1,
    botId: 'legacy',
    scope: 'offline_access im:resource docx:document:readonly',
  }));
  const legacy = await new UserIdentityConfigStore({ path: legacyPath }).load();
  assert.equal(legacy.config.scope, DEFAULT_USER_SCOPE, 'legacy full scope is migrated to the minimal set');

  console.log('im-feishu user identity config: 27 assertions passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
