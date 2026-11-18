import assert from 'node:assert/strict';
import test from 'node:test';

import { checkCloudTask, deleteCloudFile, moveCloudFile } from '../src/user-identity/cloud-drive-write.js';
import { FeishuApiError } from '../src/user-identity/errors.js';

test('Drive move to root resolves the owner root before writing and refuses a missing root ID', async () => {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    return options.method === 'GET' ? { token: 'actual-root' } : { task_id: 'move-task' };
  };
  const result = await moveCloudFile({ request, id: 'folder-1', type: 'folder' });
  assert.deepEqual(calls, [
    { path: '/open-apis/drive/explorer/v2/root_folder/meta', method: 'GET' },
    { path: '/open-apis/drive/v1/files/folder-1/move', method: 'POST', body: { type: 'folder', folder_token: 'actual-root' } },
  ]);
  assert.deepEqual(result, { id: 'folder-1', type: 'folder', folderId: 'actual-root', taskId: 'move-task', status: 'pending' });
  await assert.rejects(moveCloudFile({ id: 'folder-1', type: 'folder', request: async ({ method }) => {
    assert.equal(method, 'GET');
    return {};
  } }), /未执行移动/);
});

test('Drive delete preserves async task ID and task check distinguishes failure from success', async () => {
  const result = await deleteCloudFile({ id: 'folder-2', type: 'folder', request: async ({ query }) => {
    assert.deepEqual(query, { type: 'folder' });
    return { task_id: 'delete-task' };
  } });
  assert.deepEqual(result, { id: 'folder-2', type: 'folder', taskId: 'delete-task', status: 'pending' });

  const task = async (response) => checkCloudTask({ taskId: result.taskId, request: async ({ query }) => {
    assert.deepEqual(query, { task_id: result.taskId });
    return response;
  } });
  assert.equal((await task({ status: 'processing' })).status, 'pending');
  assert.equal((await task({ status: 'success' })).status, 'completed');
  assert.deepEqual(await task({ result: { status: 'fail', message: '操作遇到冲突' } }), {
    taskId: 'delete-task', status: 'failed', message: '操作遇到冲突',
  });
});

test('Drive permission failures specify the required scope and preserve Feishu error details', async () => {
  const denied = new FeishuApiError('scope missing', { feishuCode: 99991672, logId: 'scope-log', status: 400 });
  await assert.rejects(deleteCloudFile({ id: 'file-1', type: 'file', request: async () => { throw denied; } }), {
    message: /space:document:delete/,
    feishuCode: 99991672,
    logId: 'scope-log',
    status: 400,
  });
});
