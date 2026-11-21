/**
 * 会话工作区本地文件路径校验：与 DSH 会话范围对齐。
 *
 * 所有“读取本地文件并外发到飞书/云盘/Wiki”的入口共用本模块：
 * 1. 强制提供明确的会话工作目录（不静默回退 Host 的 process.cwd()）；
 * 2. 用 realpath() 解析符号链接，杜绝工作区内 symlink 指向外部；
 * 3. 硬拦截 $DSH_HOME（~/.dsh）、~/.ssh 等敏感目录/凭据文件；
 * 4. 校验真实文件必须落在允许的会话目录内。
 *
 * 唯一例外是 DSH 的 `danger-full-access`：该档位在 DSH 自身语义里不对文件操作
 * 设围栏，插件若仍锁死工作区就会比宿主更严。此时跳过第 4 条（工作区限制），
 * 但第 3 条敏感目录黑名单**始终生效**。
 */
import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** DSH 中不对文件路径设围栏的权限档位。 */
export const FULL_ACCESS_MODE = 'danger-full-access';

export function isFullAccess(sandboxMode) {
  return sandboxMode === FULL_ACCESS_MODE;
}

export function isPathInside(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function canonicalPath(target) {
  try {
    return await realpath(target);
  } catch {
    return resolve(target);
  }
}

async function sensitivePaths() {
  const home = homedir();
  const dshHome = process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(home, '.dsh');
  const candidates = [
    dshHome,
    join(home, '.ssh'),
    join(home, '.aws'),
    join(home, '.gnupg'),
    join(home, '.kube'),
    join(home, '.npmrc'),
    join(home, '.netrc'),
    '/etc',
    '/private/etc',
  ];
  return Promise.all(candidates.map(canonicalPath));
}

export async function isSensitivePath(target) {
  const blocked = await sensitivePaths();
  return blocked.some((secretPath) => isPathInside(secretPath, target));
}

/**
 * 解析并校验允许外发/上传的本地普通文件。
 * @param {string} filePath 模型或调用方传入的文件路径
 * @param {{ cwd?: string, extraRoots?: string[], signal?: AbortSignal, sandboxMode?: string | null }} options
 */
export async function resolveReadableLocalFile(filePath, { cwd, extraRoots = [], signal, sandboxMode = null } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\0')) {
    throw new Error('path 必须是有效的本地文件路径');
  }
  const cleanCwd = typeof cwd === 'string' && cwd.trim() ? cwd.trim() : '';
  const fullAccess = isFullAccess(sandboxMode);
  // 完全访问下 DSH 不提供会话工作区是允许的；相对路径按 Host 进程目录解析，
  // 与 shell 的相对路径语义一致。其余档位仍要求明确的会话工作目录。
  if (!cleanCwd && !fullAccess) {
    throw new Error('缺少当前会话工作目录，无法读取本地文件');
  }
  signal?.throwIfAborted?.();

  let workspaceRoot = null;
  if (cleanCwd) {
    try {
      workspaceRoot = await realpath(resolve(cleanCwd));
    } catch {
      if (!fullAccess) throw new Error('当前会话工作目录不存在或不可访问');
    }
  }

  const allowedRoots = workspaceRoot ? [workspaceRoot] : [];
  for (const extra of extraRoots) {
    if (typeof extra !== 'string' || !extra.trim()) continue;
    try {
      allowedRoots.push(await realpath(resolve(extra)));
    } catch {
      // 可选附加目录（如尚未创建的 inbox）不存在时忽略。
    }
  }

  const base = workspaceRoot ?? (fullAccess ? process.cwd() : null);
  if (!base) throw new Error('缺少当前会话工作目录，无法读取本地文件');
  const candidate = isAbsolute(filePath) ? resolve(filePath) : resolve(base, filePath);
  let realTarget;
  try {
    realTarget = await realpath(candidate);
  } catch {
    throw new Error('文件不存在或不是普通文件');
  }
  signal?.throwIfAborted?.();

  if (await isSensitivePath(realTarget)) {
    throw new Error('禁止读取或外发系统及凭据敏感目录中的文件');
  }

  if (!fullAccess && !allowedRoots.some((root) => isPathInside(root, realTarget))) {
    throw new Error('path 必须位于当前会话工作目录内');
  }

  const info = await stat(realTarget).catch(() => null);
  if (!info?.isFile()) {
    throw new Error('path 必须指向普通文件');
  }
  return { realPath: realTarget, info };
}
