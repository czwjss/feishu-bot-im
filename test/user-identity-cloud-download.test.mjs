import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createUserFeishuRequest } from '../src/user-identity/auth.js';
import { downloadCloudFile } from '../src/user-identity/cloud-download.js';

test('Drive download refreshes expired authorization and saves attachment bytes', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-download-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bytes = Buffer.from('{"file":"原始 JSON"}');
  const accessTokens = [];
  const request = createUserFeishuRequest({
    auth: { requireAccessToken: async ({ force } = {}) => force ? 'new-token' : 'old-token' },
    async fetchImpl(url, init) {
      assert.equal(url.pathname, '/open-apis/drive/v1/files/box_example/download');
      assert.equal(init.method, 'GET');
      accessTokens.push(init.headers.authorization);
      if (accessTokens.length === 1) return Response.json({ code: 99991668 });
      return new Response(bytes, { headers: {
        'content-type': 'application/json', 'content-disposition': 'attachment; filename="example.json"',
      } });
    },
  });

  const path = join(await realpath(cwd), 'example.json');
  assert.deepEqual(await downloadCloudFile({ request, id: 'box_example', path: 'example.json', cwd }), {
    id: 'box_example', type: 'file', path, bytes: bytes.length, status: 'completed',
  });
  assert.deepEqual(accessTokens, ['Bearer old-token', 'Bearer new-token']);
  assert.deepEqual(await readFile(path), bytes);
  assert.deepEqual(await readdir(cwd), ['example.json']);
});

test('Drive download refuses paths outside the workspace and local files, including a concurrent write', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-download-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await symlink(tmpdir(), join(cwd, 'outside'));
  await writeFile(join(cwd, 'existing.html'), 'existing content');
  const options = { cwd, id: 'box_example', request: async () => assert.fail('unsafe path contacted Feishu') };
  await assert.rejects(downloadCloudFile({ ...options, path: '../outside.html' }), /工作目录内/);
  await assert.rejects(downloadCloudFile({ ...options, path: 'outside/file.html' }), /工作目录内/);
  await assert.rejects(downloadCloudFile({ ...options, path: 'existing.html' }), /已存在/);

  await assert.rejects(downloadCloudFile({
    ...options,
    path: 'race.html',
    async request() {
      await writeFile(join(cwd, 'race.html'), 'concurrent content');
      return new Response('<p>Feishu response</p>');
    },
  }), /已存在/);
  assert.equal(await readFile(join(cwd, 'race.html'), 'utf8'), 'concurrent content');
  assert.deepEqual((await readdir(cwd)).sort(), ['existing.html', 'outside', 'race.html']);
});

test('Drive download does not leave a file behind when the response is incomplete or streaming fails', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-download-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const options = { cwd, id: 'box_example', path: 'example.html' };
  await assert.rejects(downloadCloudFile({
    ...options,
    request: async () => new Response('truncated', { headers: { 'content-length': '99' } }),
  }), /长度不符/);
  await assert.rejects(downloadCloudFile({
    ...options,
    request: async () => new Response('partial', { status: 206 }),
  }), /完整文件内容/);
  await assert.rejects(downloadCloudFile({
    ...options,
    request: async () => new Response('partial', { headers: { 'content-range': 'bytes 0-6/99' } }),
  }), /完整文件内容/);
  await assert.rejects(downloadCloudFile({
    ...options,
    request: async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('connection lost')); },
    })),
  }), /connection lost/);
  assert.deepEqual(await readdir(cwd), []);
});
