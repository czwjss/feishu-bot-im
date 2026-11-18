import assert from 'node:assert/strict';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MAX_CLOUD_UPLOAD_BYTES, uploadCloudFile } from '../src/user-identity/cloud-upload.js';

test('Drive upload uses the session path and sends the original bytes in multipart form data', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-upload-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bytes = Buffer.from([0, 0xff, 0x0a, 0x11]);
  await writeFile(join(cwd, 'fixture.bin'), bytes);

  const result = await uploadCloudFile({
    cwd,
    path: 'fixture.bin',
    folderId: 'fld_demo',
    name: '验证 文件.bin',
    async request({ path, method, body }) {
      assert.equal(path, '/open-apis/drive/v1/files/upload_all');
      assert.equal(method, 'POST');
      const multipart = await new Request(`https://open.feishu.cn${path}`, { method, body }).formData();
      assert.equal(multipart.get('file_name'), '验证 文件.bin');
      assert.equal(multipart.get('parent_type'), 'explorer');
      assert.equal(multipart.get('parent_node'), 'fld_demo');
      assert.equal(multipart.get('size'), String(bytes.length));
      assert.equal(multipart.get('file').name, '验证 文件.bin');
      assert.deepEqual(Buffer.from(await multipart.get('file').arrayBuffer()), bytes);
      return { file_token: 'box_demo', url: 'https://example.feishu.cn/file/box_demo' };
    },
  });
  assert.deepEqual(result, {
    id: 'box_demo', type: 'file', name: '验证 文件.bin', bytes: bytes.length, status: 'completed', url: 'https://example.feishu.cn/file/box_demo',
  });
});

test('Wiki upload and replacement use the parent node token and existing file token in different fields', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-upload-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'local.html'), '<p>Updated</p>');

  const upload = await uploadCloudFile({
    cwd, path: 'local.html', wikiParentId: 'wik_parent',
    async request({ path, body }) {
      assert.equal(path, '/open-apis/drive/v1/files/upload_all');
      assert.equal(body.get('parent_type'), 'wiki');
      assert.equal(body.get('parent_node'), 'wik_parent');
      assert.equal(body.has('file_token'), false);
      return { file_token: 'box_uploaded' };
    },
  });
  assert.equal(upload.id, 'box_uploaded');

  const replace = await uploadCloudFile({
    cwd, path: 'local.html', wikiParentId: 'wik_parent', fileId: 'box_existing', name: '原文件.html',
    async request({ path, body }) {
      assert.equal(path, '/open-apis/drive/v1/files/upload_all');
      assert.equal(body.get('parent_type'), 'wiki');
      assert.equal(body.get('parent_node'), 'wik_parent');
      assert.equal(body.get('file_token'), 'box_existing');
      assert.equal(body.get('file_name'), '原文件.html');
      assert.equal(await body.get('file').text(), '<p>Updated</p>');
      return { file_token: 'box_existing' };
    },
  });
  assert.equal(replace.id, 'box_existing');
  await assert.rejects(uploadCloudFile({
    cwd, path: 'local.html', wikiParentId: 'wik_parent', fileId: 'box_existing', name: '原文件.html',
    request: async () => ({ file_token: 'box_other' }),
  }), /原位覆盖结果未确认/);
});

test('Drive replacement reads the existing name before updating the same file token', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-upload-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'local.html'), '<p>Updated</p>');
  const requests = [];

  const result = await uploadCloudFile({
    cwd, path: 'local.html', fileId: 'box_existing',
    async request({ path, method, body }) {
      requests.push(path);
      assert.equal(method, 'POST');
      if (path === '/open-apis/drive/v1/metas/batch_query') {
        assert.deepEqual(body, { request_docs: [{ doc_token: 'box_existing', doc_type: 'file' }] });
        return { metas: [{ doc_token: 'box_existing', doc_type: 'file', title: '远端名称.html' }] };
      }
      assert.equal(body.get('parent_type'), 'explorer');
      assert.equal(body.get('parent_node'), '');
      assert.equal(body.get('file_name'), '远端名称.html');
      assert.equal(body.get('file_token'), 'box_existing');
      return { file_token: 'box_existing' };
    },
  });
  assert.deepEqual(requests, ['/open-apis/drive/v1/metas/batch_query', '/open-apis/drive/v1/files/upload_all']);
  assert.equal(result.name, '远端名称.html');
});

test('Drive upload rejects an unspecified folder, oversized files, directories and aborted uploads before sending', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-cloud-upload-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const path = join(cwd, 'large.bin');
  await writeFile(path, 'fixture');
  await truncate(path, MAX_CLOUD_UPLOAD_BYTES + 1);

  const options = { cwd, path, folderId: 'fld_demo', request: () => assert.fail('invalid upload contacted Feishu') };
  await assert.rejects(uploadCloudFile({ ...options, folderId: '' }), /文件夹 ID/);
  await assert.rejects(uploadCloudFile(options), /20 MiB/);
  await assert.rejects(uploadCloudFile({ ...options, path: cwd }), /普通文件/);
  await assert.rejects(uploadCloudFile({ ...options, signal: AbortSignal.abort() }), { name: 'AbortError' });
});
