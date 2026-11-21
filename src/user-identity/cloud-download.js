import { createWriteStream } from 'node:fs';
import { link, lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isFullAccess, isPathInside, isSensitivePath } from '../local-path.js';
import { FeishuApiError } from './errors.js';

const EXISTS_ERROR = '下载目标已存在，请更换本地路径';

export async function resolveWorkspaceDownloadPath(path, cwd, sandboxMode = null) {
  if (typeof path !== 'string' || !path.trim() || path.includes('\0')) throw new Error('path 必须是本地文件路径');
  const fullAccess = isFullAccess(sandboxMode);
  const cleanCwd = typeof cwd === 'string' && cwd.trim() ? cwd.trim() : '';
  if (!cleanCwd && !fullAccess) throw new Error('缺少当前会话工作目录，无法保存下载文件');
  // 完全访问下相对路径按 Host 进程目录解析，与 shell 语义一致；
  // 其余档位必须在会话工作区内。
  const base = cleanCwd || (fullAccess ? process.cwd() : '');
  const workspace = cleanCwd ? await realpath(cleanCwd) : null;
  const target = resolve(base, path);
  const directory = await realpath(dirname(target));
  if (!fullAccess && (!workspace || !isPathInside(workspace, directory))) {
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

/** 原子写入内存字节到工作区新文件（不覆盖已有文件，异常自动清理临时文件）。 */
export async function writeNewWorkspaceFile({ path, cwd, data, signal, sandboxMode = null }) {
  signal?.throwIfAborted();
  const destination = await resolveWorkspaceDownloadPath(path, cwd, sandboxMode);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let temporaryDirectory;
  try {
    signal?.throwIfAborted();
    temporaryDirectory = await mkdtemp(join(dirname(destination), '.feishu-download-'));
    const temporaryFile = join(temporaryDirectory, 'file');
    await writeFile(temporaryFile, buffer, { flag: 'wx', mode: 0o600, signal });
    signal?.throwIfAborted();
    await link(temporaryFile, destination);
    return { path: destination, bytes: buffer.length };
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(EXISTS_ERROR, { cause: error });
    throw error;
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function downloadCloudFile({ request, id, path, cwd, signal, sandboxMode = null }) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('下载需要有效的文件 ID');
  signal?.throwIfAborted();
  const destination = await resolveWorkspaceDownloadPath(path, cwd, sandboxMode);
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
