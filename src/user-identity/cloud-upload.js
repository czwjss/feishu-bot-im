import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';
import { resolveReadableLocalFile } from '../local-path.js';
import { FeishuApiError } from './errors.js';

export const MAX_CLOUD_UPLOAD_BYTES = 20 * 1024 * 1024;

const FILES_PATH = '/open-apis/drive/v1/files';
const tokenPattern = /^[A-Za-z0-9_-]+$/;

async function existingFileName(request, id) {
  const data = await request({
    path: '/open-apis/drive/v1/metas/batch_query',
    method: 'POST',
    body: { request_docs: [{ doc_token: id, doc_type: 'file' }] },
  });
  const metadata = Array.isArray(data?.metas)
    ? data.metas.find((item) => item?.doc_token === id && item.doc_type === 'file') : null;
  if (typeof metadata?.title !== 'string' || !metadata.title.trim()) {
    throw new FeishuApiError('飞书未返回目标文件的现有名称，请核对文件链接和访问权限');
  }
  return metadata.title;
}

export async function uploadCloudFile({ request, path, cwd, folderId, wikiParentId, parentType, fileId, name, signal, sandboxMode = null }) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('path 必须是本地文件路径');
  if (folderId !== undefined && (typeof folderId !== 'string' || !tokenPattern.test(folderId))) {
    throw new Error('上传需要有效的文件夹 ID');
  }
  if (wikiParentId !== undefined && (typeof wikiParentId !== 'string' || !tokenPattern.test(wikiParentId))) {
    throw new Error('上传需要有效的 Wiki 父节点 ID');
  }
  if (folderId !== undefined && wikiParentId !== undefined) throw new Error('上传只能指定一个父节点');
  if (fileId !== undefined && (typeof fileId !== 'string' || !tokenPattern.test(fileId))) {
    throw new Error('覆盖需要有效的文件 ID');
  }
  if (folderId === undefined && wikiParentId === undefined && fileId === undefined) {
    throw new Error('上传需要明确的文件夹 ID 或 Wiki 父节点 ID');
  }

  signal?.throwIfAborted();
  const { realPath: absolutePath, info } = await resolveReadableLocalFile(path, { cwd, signal, sandboxMode });
  if (info.size > MAX_CLOUD_UPLOAD_BYTES) throw new Error('单次上传的文件不能超过 20 MiB');
  const file = await openAsBlob(absolutePath, { type: 'application/octet-stream' });
  if (file.size > MAX_CLOUD_UPLOAD_BYTES) throw new Error('单次上传的文件不能超过 20 MiB');
  signal?.throwIfAborted();

  const fileName = name ?? (fileId ? await existingFileName(request, fileId) : basename(absolutePath));
  if (typeof fileName !== 'string' || !fileName.trim() || /[/\\\u0000-\u001f\u007f]/u.test(fileName) || ['.', '..'].includes(fileName)) {
    throw new Error('name 必须是文件名，不能包含路径或控制字符');
  }
  signal?.throwIfAborted();
  const form = new FormData();
  form.set('file_name', fileName);
  form.set('parent_type', parentType || (wikiParentId ? 'wiki' : 'explorer'));
  form.set('parent_node', wikiParentId ?? folderId ?? '');
  if (fileId) form.set('file_token', fileId);
  form.set('size', String(file.size));
  form.set('file', file, fileName);
  const data = await request({ path: `${FILES_PATH}/upload_all`, method: 'POST', body: form, timeoutMs: 120_000 });
  const id = data?.file_token;
  if (fileId && id !== fileId) {
    throw new FeishuApiError('飞书未返回原文件 ID，原位覆盖结果未确认，请核对目标后再重试');
  }
  if (typeof id !== 'string' || !tokenPattern.test(id)) {
    throw new FeishuApiError('飞书未返回有效文件 ID，请检查目标位置中的上传结果');
  }
  const result = { id, type: 'file', name: fileName, bytes: file.size, status: 'completed' };
  if (typeof data.url === 'string' && data.url) result.url = data.url;
  return result;
}
