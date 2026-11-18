import { FeishuApiError } from './errors.js';

const FILES_PATH = '/open-apis/drive/v1/files';
const ROOT_FOLDER_PATH = '/open-apis/drive/explorer/v2/root_folder/meta';

export const DRIVE_MOVE_TYPES = Object.freeze(['file', 'docx', 'bitable', 'doc', 'sheet', 'mindnote', 'folder', 'slides']);
export const DRIVE_RESOURCE_TYPES = Object.freeze([...DRIVE_MOVE_TYPES, 'shortcut']);
export const DRIVE_RENAME_TYPES = Object.freeze(['file', 'folder', 'docx']);

const RENAME_SCOPES = {
  docx: 'docx:document:write_only',
  wiki: '与 Wiki 节点资源类型匹配的写权限（如 drive:file:upload 或 docx:document:write_only）',
};

async function callDrive(request, options, scope) {
  try {
    return await request(options);
  } catch (error) {
    if (![99991672, 99991679].includes(error?.feishuCode)) throw error;
    throw new FeishuApiError(`此操作需要 ${scope}。请在飞书应用开通权限后，到「状态 → 飞书分身 → 重新授权」扫码（code ${error.feishuCode}）`, error.details);
  }
}

function filePath(id) {
  return `${FILES_PATH}/${encodeURIComponent(id)}`;
}

function operationStatus(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || (data.task_id != null && typeof data.task_id !== 'string')) {
    throw new FeishuApiError('飞书返回的操作结果格式无效，请核对资源状态后再操作');
  }
  return data.task_id ? { status: 'pending', taskId: data.task_id } : { status: 'completed' };
}

export async function createCloudFolder({ request, name, folderId }) {
  const data = await callDrive(request, {
    path: `${FILES_PATH}/create_folder`,
    method: 'POST',
    body: { name, folder_token: folderId ?? '' },
  }, 'space:folder:create');
  if (typeof data?.token !== 'string' || !data.token.trim()) {
    throw new FeishuApiError('飞书未返回新建文件夹 ID，请先核对目录结果再重试');
  }
  const result = { id: data.token, type: 'folder', name, status: 'completed' };
  if (typeof data.url === 'string' && data.url) result.url = data.url;
  return result;
}

export async function renameCloudFile({ request, id, type, name }) {
  const scope = RENAME_SCOPES[type] ?? 'drive:file:upload';
  await callDrive(request, {
    path: filePath(id),
    method: 'PATCH',
    query: { type },
    body: { new_title: name },
  }, scope);
  return { id, type, name, status: 'completed' };
}

export async function moveCloudFile({ request, id, type, folderId }) {
  let destination = folderId;
  if (destination === undefined) {
    const data = await callDrive(request, { path: ROOT_FOLDER_PATH, method: 'GET' }, 'space:document:retrieve 或等效的云空间目录读取权限');
    if (typeof data?.token !== 'string' || !data.token.trim()) {
      throw new FeishuApiError('飞书未返回根文件夹 ID，未执行移动');
    }
    destination = data.token;
  }
  if (type === 'folder' && id === destination) throw new Error('不能将文件夹移动到自身');
  const data = await callDrive(request, {
    path: `${filePath(id)}/move`,
    method: 'POST',
    body: { type, folder_token: destination },
  }, 'space:document:move');
  return { id, type, folderId: destination, ...operationStatus(data) };
}

export async function deleteCloudFile({ request, id, type }) {
  const data = await callDrive(request, {
    path: filePath(id),
    method: 'DELETE',
    query: { type },
  }, 'space:document:delete');
  return { id, type, ...operationStatus(data) };
}

export async function checkCloudTask({ request, taskId }) {
  const data = await callDrive(request, {
    path: `${FILES_PATH}/task_check`,
    method: 'GET',
    query: { task_id: taskId },
  }, 'drive:drive.metadata:readonly 或等效的云空间元数据读取权限');
  const raw = data?.result ?? data;
  const status = typeof raw?.status === 'string' ? raw.status.trim().toLowerCase() : '';
  if (!status) throw new FeishuApiError('飞书未返回异步任务状态，请用相同的 taskId 重新查询');
  if (status === 'success') return { taskId, status: 'completed' };
  if (status === 'fail' || status === 'failed') {
    const message = typeof raw?.message === 'string' && raw.message ? raw.message : '飞书报告操作失败';
    return { taskId, status: 'failed', message };
  }
  return { taskId, status: 'pending' };
}
