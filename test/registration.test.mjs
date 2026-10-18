import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

import {
  FEISHU_ACCOUNTS_ORIGIN,
  LARK_ACCOUNTS_ORIGIN,
  REGISTRATION_ENDPOINT,
  REGISTRATION_STATES,
  RegistrationManager,
} from '../src/registration.js';

const ENDPOINT = `${FEISHU_ACCOUNTS_ORIGIN}${REGISTRATION_ENDPOINT}`;
const LARK_ENDPOINT = `${LARK_ACCOUNTS_ORIGIN}${REGISTRATION_ENDPOINT}`;
const STARTS_AT = 1_700_000_000_000;
let scenarios = 0;

function createClock(start = STARTS_AT) {
  let current = start;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimeout(callback, delay) {
      const id = ++nextId;
      const milliseconds = Number.isFinite(delay) ? Math.max(0, delay) : 0;
      timers.set(id, { id, at: current + milliseconds, callback });
      return { id, unref() {} };
    },
    clearTimeout(handle) {
      const id = handle && typeof handle === 'object' ? handle.id : handle;
      timers.delete(id);
    },
    advance(milliseconds) {
      current += milliseconds;
      for (;;) {
        const due = [...timers.values()]
          .filter((timer) => timer.at <= current)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) return;
        timers.delete(due.id);
        due.callback();
      }
    },
    pending: () => timers.size,
  };
}

function reply(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createFetch(...responses) {
  const calls = [];
  return {
    calls,
    async fetch(url, init) {
      const index = calls.length;
      calls.push({ url, init });
      if (index >= responses.length) {
        throw new Error(`unexpected fetch #${index + 1}: ${url}`);
      }
      const item = responses[index];
      if (item instanceof Error) throw item;
      return typeof item === 'function' ? item(url, init) : item;
    },
  };
}

function createManager(responses, options = {}) {
  const clock = createClock();
  const { calls, fetch } = createFetch(...responses);
  const manager = new RegistrationManager({
    fetch,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    logger: null,
    ...options,
  });
  return { manager, clock, calls };
}

function beginReply(overrides = {}) {
  return reply({
    verification_uri_complete: 'https://open.feishu.cn/page/launcher?clientID=cli_new',
    device_code: 'dc_1',
    expires_in: 600,
    interval: 5,
    user_code: 'ABCD-EFGH',
    ...overrides,
  });
}

// 1) begin(): request protocol, QR URL parameters, qr_ready snapshot.
{
  scenarios += 1;
  const { manager, clock, calls } = createManager([beginReply()], {
    interval: 1500,
    source: 'deepseek-harness',
    createOnly: true,
    appPreset: { name: '北汇星河 AI 助手', desc: '连接飞书与 DSH' },
    addons: {
      preset: false,
      scopes: { tenant: ['im:message:send_as_bot'] },
      events: { items: { tenant: ['im.message.receive_v1'] } },
      callbacks: { items: ['card.action.trigger'] },
    },
  });

  const snapshot = await manager.begin();
  assert.equal(snapshot.state, REGISTRATION_STATES.QR_READY);
  assert.equal(snapshot.attempt, 1);
  assert.equal(snapshot.expiresAt, STARTS_AT + 600_000);
  assert.equal(snapshot.remainingSeconds, 600);
  assert.equal(snapshot.userCode, 'ABCD-EFGH');
  assert.equal(snapshot.intervalMs, 1500);
  assert.equal(snapshot.nextPollInMs, 1500);
  assert.equal(snapshot.error, null);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(
    calls[0].init.body,
    'action=begin&archetype=PersonalAgent&auth_method=client_secret&request_user_info=open_id',
  );

  const qr = new URL(snapshot.qrCodeUrl);
  assert.equal(qr.hostname, 'open.feishu.cn');
  assert.equal(qr.searchParams.get('from'), 'sdk');
  assert.equal(qr.searchParams.get('source'), 'node-sdk/deepseek-harness');
  assert.equal(qr.searchParams.get('tp'), 'sdk');
  assert.equal(qr.searchParams.get('createOnly'), 'true');
  assert.equal(qr.searchParams.get('name'), '北汇星河 AI 助手');
  assert.equal(qr.searchParams.get('desc'), '连接飞书与 DSH');

  const encodedAddons = qr.searchParams.get('addons');
  assert.ok(encodedAddons);
  const decodedAddons = JSON.parse(
    gunzipSync(Buffer.from(
      encodedAddons.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    )).toString('utf8'),
  );
  assert.deepEqual(decodedAddons, {
    preset: false,
    scopes: { tenant: ['im:message:send_as_bot'] },
    events: { items: { tenant: ['im.message.receive_v1'] } },
    callbacks: { items: ['card.action.trigger'] },
  });

  assert.deepEqual(manager.snapshot(), snapshot);
  assert.equal(clock.pending(), 1, 'only the expiry timer should remain');
}

// 2) poll(): authorization_pending -> pending, then credentials -> success.
{
  scenarios += 1;
  const { manager, calls } = createManager([
    beginReply({ interval: 2 }),
    reply({ error: 'authorization_pending' }, 400),
    reply({
      client_id: 'cli_abc',
      client_secret: 'secret_123',
      user_info: { open_id: 'ou_owner', tenant_brand: 'feishu' },
    }),
  ]);

  await manager.begin();
  const pending = await manager.poll();
  assert.equal(pending.state, REGISTRATION_STATES.PENDING);
  assert.equal(pending.error, null);
  assert.equal(pending.intervalMs, 2000);
  assert.equal(pending.nextPollInMs, 2000);
  assert.ok(pending.qrCodeUrl);
  assert.equal(Object.hasOwn(pending, 'appSecret'), false);

  const done = await manager.poll();
  assert.equal(done.state, REGISTRATION_STATES.SUCCESS);
  assert.equal(done.error, null);
  assert.equal(done.appId, 'cli_abc');
  assert.equal(done.appSecret, 'secret_123');
  assert.deepEqual(done.userInfo, { open_id: 'ou_owner', tenant_brand: 'feishu' });
  assert.equal(done.qrCodeUrl, undefined);

  assert.equal(calls.length, 3);
  assert.equal(calls[1].init.body, 'action=poll&device_code=dc_1');
  assert.equal(calls[2].init.body, 'action=poll&device_code=dc_1');

  const stored = manager.snapshot();
  assert.equal(stored.appId, 'cli_abc');
  assert.equal(stored.appSecret, 'secret_123');
  await manager.poll();
  assert.equal(calls.length, 3, 'terminal runs must not poll again');
}

// 3) poll(): access_denied -> denied.
{
  scenarios += 1;
  const { manager, calls } = createManager([
    beginReply(),
    reply({ error: 'access_denied', error_description: 'user denied' }, 400),
  ]);

  await manager.begin();
  const snapshot = await manager.poll();
  assert.equal(snapshot.state, REGISTRATION_STATES.DENIED);
  assert.equal(snapshot.error.code, 'access_denied');
  assert.match(snapshot.error.message, /拒绝/);
  assert.equal(snapshot.appSecret, undefined);

  await manager.poll();
  assert.equal(calls.length, 2, 'denied is terminal');
}

// 4) QR expiry timer -> expired.
{
  scenarios += 1;
  const { manager, clock, calls } = createManager([beginReply({ expires_in: 120 })]);

  const ready = await manager.begin();
  assert.equal(ready.expiresAt, STARTS_AT + 120_000);

  clock.advance(120_000);
  const snapshot = manager.snapshot();
  assert.equal(snapshot.state, REGISTRATION_STATES.EXPIRED);
  assert.equal(snapshot.error.code, 'expired_token');
  assert.match(snapshot.error.message, /过期/);

  await manager.poll();
  assert.equal(calls.length, 1, 'expired is terminal');
}

// 5) Network failure during begin -> error snapshot, begin() never rejects.
{
  scenarios += 1;
  const { manager, calls } = createManager([new TypeError('fetch failed: ECONNREFUSED')]);

  const snapshot = await manager.begin();
  assert.equal(snapshot.state, REGISTRATION_STATES.ERROR);
  assert.equal(snapshot.error.code, 'network_error');
  assert.match(snapshot.error.message, /网络/);
  assert.equal(calls.length, 1);
}

// 6) Network failure during poll -> error snapshot, poll() never rejects.
{
  scenarios += 1;
  const { manager, calls } = createManager([beginReply(), new Error('socket hang up')]);

  await manager.begin();
  const snapshot = await manager.poll();
  assert.equal(snapshot.state, REGISTRATION_STATES.ERROR);
  assert.equal(snapshot.error.code, 'network_error');
  assert.match(snapshot.error.message, /网络/);
  assert.equal(calls.length, 2);
}

// 7) cancel(): in-flight request aborted, cancelled is terminal.
{
  scenarios += 1;
  const { manager, calls } = createManager([
    beginReply(),
    (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    }),
  ]);

  await manager.begin();
  const polling = manager.poll();
  const cancelled = manager.cancel();
  assert.equal(cancelled.state, REGISTRATION_STATES.CANCELLED);
  assert.equal(cancelled.error.code, 'abort');

  const settled = await polling;
  assert.equal(settled.state, REGISTRATION_STATES.CANCELLED);

  await manager.poll();
  assert.equal(calls.length, 2, 'cancelled is terminal');
  assert.equal(manager.cancel().state, REGISTRATION_STATES.CANCELLED);
}

// 8) A second begin() resets the active run (attempt increments, new device code).
{
  scenarios += 1;
  const { manager, clock, calls } = createManager([
    beginReply({ device_code: 'dc_old', expires_in: 120 }),
    beginReply({ device_code: 'dc_new', expires_in: 600 }),
    reply({ error: 'authorization_pending' }, 400),
  ]);

  const first = await manager.begin();
  assert.equal(first.attempt, 1);

  const second = await manager.begin();
  assert.equal(second.state, REGISTRATION_STATES.QR_READY);
  assert.equal(second.attempt, 2);
  assert.equal(calls.length, 2);

  // The first run's 120 s expiry timer must have been cleared.
  clock.advance(120_000);
  assert.equal(manager.snapshot().state, REGISTRATION_STATES.QR_READY);

  const pending = await manager.poll();
  assert.equal(pending.state, REGISTRATION_STATES.PENDING);
  assert.equal(calls[2].init.body, 'action=poll&device_code=dc_new');
}

// 9) slow_down adds 5000 ms to the poll interval.
{
  scenarios += 1;
  const { manager, calls } = createManager([
    beginReply({ interval: 1 }),
    reply({ error: 'slow_down' }, 400),
    reply({ error: 'authorization_pending' }, 400),
    reply({
      client_id: 'cli_slow',
      client_secret: 'secret_slow',
      user_info: { open_id: 'ou_slow' },
    }),
  ]);

  await manager.begin();
  const slowed = await manager.poll();
  assert.equal(slowed.state, REGISTRATION_STATES.SLOW_DOWN);
  assert.equal(slowed.intervalMs, 6000);
  assert.equal(slowed.nextPollInMs, 6000);

  const pending = await manager.poll();
  assert.equal(pending.state, REGISTRATION_STATES.PENDING);
  assert.equal(pending.intervalMs, 6000, 'the increased interval is kept');

  const done = await manager.poll();
  assert.equal(done.state, REGISTRATION_STATES.SUCCESS);
  assert.equal(done.appId, 'cli_slow');
  assert.equal(calls.length, 4);
}

// 10) tenant_brand=lark switches the poll endpoint exactly once, then succeeds.
{
  scenarios += 1;
  const { manager, calls } = createManager([
    beginReply(),
    reply({ user_info: { tenant_brand: 'lark' } }),
    reply({
      client_id: 'cli_lark',
      client_secret: 'secret_lark',
      user_info: { open_id: 'ou_lark', tenant_brand: 'lark' },
    }),
  ]);

  await manager.begin();
  const snapshot = await manager.poll();
  assert.equal(snapshot.state, REGISTRATION_STATES.SUCCESS);
  assert.equal(snapshot.appId, 'cli_lark');
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, ENDPOINT);
  assert.equal(calls[2].url, LARK_ENDPOINT);
  assert.equal(calls[2].init.body, 'action=poll&device_code=dc_1');
}

// 11) Malformed begin response -> invalid_response error, not a throw.
{
  scenarios += 1;
  const { manager, calls } = createManager([reply({
    verification_uri_complete: 'https://open.feishu.cn/page/launcher',
    expires_in: 600,
    interval: 5,
    // device_code intentionally missing
  })]);

  const snapshot = await manager.begin();
  assert.equal(snapshot.state, REGISTRATION_STATES.ERROR);
  assert.equal(snapshot.error.code, 'invalid_response');
  assert.match(snapshot.error.message, /无法识别/);
  assert.equal(calls.length, 1);
}

// 12) dispose(): terminal teardown, credentials wiped, later begin() is refused.
{
  scenarios += 1;
  const { manager, calls } = createManager([beginReply()]);

  await manager.begin();
  const disposed = manager.dispose();
  assert.equal(disposed.state, REGISTRATION_STATES.IDLE);
  assert.equal(disposed.disposed, true);
  assert.equal(disposed.qrCodeUrl, undefined);
  assert.equal(disposed.error, null);

  const after = await manager.begin();
  assert.equal(after.state, REGISTRATION_STATES.ERROR);
  assert.equal(after.error.code, 'disposed');
  assert.equal(calls.length, 1, 'disposed managers must not reach the network');
  assert.equal(manager.snapshot().state, REGISTRATION_STATES.IDLE);
  assert.equal(manager.dispose().disposed, true);
}

console.log(`registration: ${scenarios} scenarios passed`);
