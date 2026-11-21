import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSendTool } from '../src/user-identity/tools.js';
import { installUserIdentityContributions } from '../src/user-identity/contributions.js';

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-user-media-'));
const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url: String(url), init });
  const target = String(url);
  if (target.endsWith('/open-apis/im/v1/images')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { image_key: 'img_key' } }) };
  }
  if (target.endsWith('/open-apis/im/v1/files')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { file_key: 'file_key' } }) };
  }
  if (target.includes('/open-apis/im/v1/messages')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { message_id: 'om_media', chat_id: 'oc_chat' } }) };
  }
  return { ok: false, status: 404, json: async () => ({ code: -1, msg: 'unexpected' }) };
};
const auth = { async requireAccessToken() { return 'user-token'; } };

try {
  await writeFile(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await writeFile(join(dir, 'report.pdf'), Buffer.from('%PDF-1.4\n% test\n'));
  const tool = createSendTool({ auth, fetchImpl });
  const context = { agent: { session: { cwd: dir } } };

  const image = await tool.execute({ chatId: 'oc_chat', path: 'photo.png' }, context);
  assert.equal(image.kind, 'image');
  assert.equal(image.messageId, 'om_media');
  assert.match(calls[0].url, /\/im\/v1\/images$/);
  const imageSend = JSON.parse(calls[1].init.body);
  assert.equal(imageSend.msg_type, 'image');
  assert.deepEqual(JSON.parse(imageSend.content), { image_key: 'img_key' });

  calls.length = 0;
  const file = await tool.execute({ openId: 'ou_1234', path: 'report.pdf', name: '周报.pdf' }, context);
  assert.equal(file.kind, 'file');
  assert.equal(file.fileName, '周报.pdf');
  assert.match(calls[0].url, /\/im\/v1\/files$/);
  const fileSend = JSON.parse(calls[1].init.body);
  assert.equal(fileSend.msg_type, 'file');
  assert.deepEqual(JSON.parse(fileSend.content), { file_key: 'file_key', file_name: '周报.pdf' });

  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', text: 'x', path: 'photo.png' }, context),
    /text 和 path/,
  );
  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', path: 'photo.png', title: '标题' }, context),
    /title\/color/,
  );
  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', path: 'missing.png' }, context),
    /文件不存在/,
  );

  console.log('im-feishu user identity media: 12 assertions passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}

async function registeredSend(identity = auth) {
  const registered = [], registrations = [];
  installUserIdentityContributions({ inject(services, apply) {
    if (services.includes('tools')) {
      registrations.push(apply({ tools: { register(tool) { registered.push(tool); } } }));
    }
  } }, identity);
  await Promise.all(registrations);
  const tool = registered.find((item) => item.name === 'feishu_avatar_send');
  assert.ok(tool, 'use the real Host registration, without injecting fetchImpl');
  return tool;
}

async function mediaFixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'im-feishu-native-media-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const body = Buffer.from('local media fixture');
  await Promise.all(['report.html', 'photo.png'].map((name) => writeFile(join(cwd, name), body)));
  return { body, context: { agent: { session: { cwd } } } };
}

const response = (data, code = 0, status = 200) => ({ ok: status < 400, status, json: async () => ({ code, data }) });

test('Host-registered avatar uploads files and images using default fetch and the same user identity', async (t) => {
  const { body, context } = await mediaFixture(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, init });
    assert.equal(url.origin, 'https://open.feishu.cn');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.authorization, 'Bearer user-token');
    if (url.pathname.endsWith('/files')) return response({ file_key: 'file_native' });
    if (url.pathname.endsWith('/images')) return response({ image_key: 'image_native' });
    assert.equal(url.pathname, '/open-apis/im/v1/messages');
    return response({ message_id: 'om_native', chat_id: 'oc_chat' });
  });
  const tool = await registeredSend();
  for (const [target, receiveType, path, name, kind] of [
    [{ chatId: 'oc_chat' }, 'chat_id', 'report.html', '报告.html', 'file'],
    [{ openId: 'ou_user' }, 'open_id', 'photo.png', 'photo.png', 'image'],
    [{ email: 'person@example.com' }, 'email', 'report.html', 'report.html', 'file'],
  ]) {
    requests.length = 0;
    const result = await tool.execute({ ...target, path, name }, context);
    assert.equal(result.messageId, 'om_native');
    assert.equal(result.kind, kind);
    assert.equal(result.fileName, name);
    assert.equal(requests.length, 2, 'one upload, then one send');
    const form = requests[0].init.body;
    assert.ok(form instanceof FormData);
    assert.equal(requests[0].init.headers['content-type'], undefined, 'fetch supplies the multipart boundary');
    assert.equal(form.get(kind).name, name);
    assert.deepEqual(Buffer.from(await form.get(kind).arrayBuffer()), body);
    assert.equal(form.get(`${kind}_type`), kind === 'file' ? 'stream' : 'message');
    const sent = JSON.parse(requests[1].init.body);
    assert.equal(requests[1].url.searchParams.get('receive_id_type'), receiveType);
    assert.equal(sent.receive_id, Object.values(target)[0]);
    assert.equal(sent.msg_type, kind);
    assert.equal(JSON.parse(sent.content)[`${kind}_key`], `${kind}_native`);
  }
});

test('default avatar upload failures do not send a message or switch identity', async (t) => {
  const { context } = await mediaFixture(t);
  let failure, requests = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests += 1;
    assert.match(url.pathname, /\/(files|images)$/);
    assert.equal(init.headers.authorization, 'Bearer user-token');
    return failure;
  });
  const tool = await registeredSend();
  for (const [path, result, expected] of [
    ['report.html', response({}, 99991679), /授权范围不足/],
    ['photo.png', response({}), /没有返回 image_key/],
    ['report.html', response({}, 0, 503), /HTTP 503/],
  ]) {
    requests = 0; failure = result;
    await assert.rejects(tool.execute({ chatId: 'oc_chat', path }, context), expected);
    assert.equal(requests, 1);
  }
});

test('default avatar media upload refreshes an expired user token once before sending', async (t) => {
  const { context } = await mediaFixture(t);
  const credentials = [], refreshes = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    credentials.push(init.headers.authorization);
    if (url.pathname.endsWith('/files')) {
      return init.headers.authorization === 'Bearer expired-user-token'
        ? response({}, 99991668) : response({ file_key: 'file_refreshed' });
    }
    assert.equal(url.pathname, '/open-apis/im/v1/messages');
    return response({ message_id: 'om_refreshed', chat_id: 'oc_chat' });
  });
  const tool = await registeredSend({ async requireAccessToken(options) {
    refreshes.push(options?.force === true);
    return options?.force ? 'refreshed-user-token' : 'expired-user-token';
  } });
  assert.equal((await tool.execute({ chatId: 'oc_chat', path: 'report.html' }, context)).messageId, 'om_refreshed');
  assert.deepEqual(refreshes, [false, true]);
  assert.deepEqual(credentials, ['Bearer expired-user-token', 'Bearer refreshed-user-token', 'Bearer refreshed-user-token']);
});

test('cancelling default avatar upload prevents the later send', async (t) => {
  const { context } = await mediaFixture(t);
  const controller = new AbortController();
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests += 1;
    assert.equal(url.pathname, '/open-apis/im/v1/files');
    assert.equal(init.signal.aborted, false);
    controller.abort(new Error('cancel media upload'));
    assert.equal(init.signal.aborted, true);
    return response({ file_key: 'file_cancelled' });
  });
  const tool = await registeredSend();
  await assert.rejects(tool.execute({ chatId: 'oc_chat', path: 'report.html' }, { ...context, signal: controller.signal }), /cancel media upload/);
  assert.equal(requests, 1);
});
