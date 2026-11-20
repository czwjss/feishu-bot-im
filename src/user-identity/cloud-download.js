import { createWriteStream } from 'node:fs';
import { link, lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isPathInside, isSensitivePath } from '../local-path.js';
import { FeishuApiError } from './errors.js';

const EXISTS_ERROR = '下载目标已存在，请更换本地路径';

async function resolveDownloadPath(path, cwd) {
  if (typeof path !== 'string' || !path.trim() || path.includes('\0')) throw new Error('path 必须是本地文件路径');
  if (typeof cwd !== 'string' || !cwd.trim()) throw new Error('缺少当前会话工作目录，无法保存下载文件');
  const workspace = await realpath(cwd);
  const target = resolve(cwd, path);
  const directory = await realpath(dirname(target));
  if (!isPathInside(workspace, directory)) {
    throw new Error('下载路径必须位于当前会话的工作目录内');
  }
  const destination = join(directory, basename(target));
  if (await isSensitivePath(destination)) {
    throw new Error('禁止向系统及凭据敏感目录写入文件');
  }
  const existing = await lstat(destination).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
  if (existing) throw new Error(EXISTS_ERROR);
  return destination;
}

export async function downloadCloudFile({ request, id, path, cwd, signal }) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('下载需要有效的文件 ID');
  signal?.throwIfAborted();
  const destination = await resolveDownloadPath(path, cwd);
  signal?.throwIfAborted();
  const response = await request({
    path: `/open-apis/drive/v1/files/${encodeURIComponent(id)}/download`,
    responseType: 'binary',
    timeoutMs: 120_000,
  });
  const body = response?.body;
  if (!body) throw new FeishuApiError('飞书未返回文件内容');

  let temporaryDirectory;
  let bytes = 0;
  try {
    if (response.status !== 200 || response.headers?.has('content-range')) {
      throw new FeishuApiError('飞书未返回完整文件内容', { status: response.status });
    }
    const contentLength = Number(response.headers?.get('content-length') ?? NaN);
    const contentEncoding = response.headers?.get('content-encoding');
    signal?.throwIfAborted();
    temporaryDirectory = await mkdtemp(join(dirname(destination), '.feishu-download-'));
    const temporaryFile = join(temporaryDirectory, 'file');
    const output = createWriteStream(temporaryFile, { flags: 'wx', mode: 0o600 });
    await pipeline(body, output, { signal });
    bytes = output.bytesWritten;
    if (Number.isSafeInteger(contentLength) && contentLength >= 0
      && (!contentEncoding || contentEncoding.toLowerCase() === 'identity') && contentLength !== bytes) {
      throw new FeishuApiError('下载字节数与飞书返回的长度不符');
    }
    signal?.throwIfAborted();
    // Link the complete file into place without replacing any concurrent output.
    await link(temporaryFile, destination);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(EXISTS_ERROR, { cause: error });
    throw error;
  } finally {
    if (!body.locked) await body.cancel().catch(() => undefined);
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
  return { id, type: 'file', path: destination, bytes, status: 'completed' };
}
