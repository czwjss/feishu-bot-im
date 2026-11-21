/**
 * 飞书云文档 & 知识库统一工具集（按只读 / 远端写管理 / 本地文件传输边界划分）。
 *
 * 屏蔽 Drive 与 Wiki 底层差异：通过飞书链接或带类型前缀的 target（如 docx: / folder: /
 * file: / wiki: / wiki_space:）自动路由到对应接口。
 */
import { KeyedQueue } from '../queue.js';
import { boundedInteger, defineFeishuTool, renderToolOutput, resolveSandboxMode, resolveSessionCwd } from '../tool-contract.js';
import { createUserFeishuRequest } from './auth.js';
import { inspectCloudMeta, listCloudFolder, parseCloudTarget, searchCloudDocs } from './cloud-discovery.js';
import { parseDocumentCursor, readDocument } from './cloud-document-read.js';
import { appendCloudDocument, appendCloudDocumentMarkdown, createCloudDocument, editCloudDocument, validateCloudDocumentText, validateDocumentReplacement } from './cloud-document-write.js';
import { downloadCloudFile } from './cloud-download.js';
import {
  checkCloudTask, createCloudFolder, deleteCloudFile, moveCloudFile, renameCloudFile,
  DRIVE_RESOURCE_TYPES, DRIVE_MOVE_TYPES, DRIVE_RENAME_TYPES,
} from './cloud-drive-write.js';
import { uploadCloudFile } from './cloud-upload.js';
import { checkWikiDeleteTask, createWikiNode, deleteWikiNode, listWikiNodes, listWikiSpaces, moveWikiNode, resolveWikiNode } from './cloud-wiki.js';

export const DOC_READ_TOOL_NAME = 'feishu_avatar_doc_read';
export const DOC_WRITE_TOOL_NAME = 'feishu_avatar_doc_write';
export const DOC_FILE_TOOL_NAME = 'feishu_avatar_doc_file';

const driveMutations = new KeyedQueue();
const DEFAULT_TASK_POLL_ATTEMPTS = 2;
const DEFAULT_TASK_POLL_DELAY_MS = 600;

const READ_ACTION_FIELDS = Object.freeze({
  search: ['query', 'limit', 'pageToken'],
  list: ['target', 'limit', 'pageToken'],
  inspect: ['target'],
  read: ['target', 'pageToken'],
});

const WRITE_ACTION_FIELDS = Object.freeze({
  create: ['name', 'parent', 'text', 'format'],
  append: ['target', 'text', 'format'],
  edit: ['target', 'find', 'text'],
  create_folder: ['name', 'parent'],
  rename: ['target', 'name'],
  move: ['target', 'parent'],
  delete: ['target', 'confirm', 'includeChildren'],
  task: ['taskId'],
});

const FILE_ACTION_FIELDS = Object.freeze({
  download: ['target', 'path'],
  upload: ['parent', 'path', 'name'],
  replace: ['target', 'path'],
});

function invalidInput(toolName, message) {
  return Object.assign(new Error(`${toolName} 参数错误：${message}`), { code: 'INVALID_ARGS' });
}

function requiredValue(toolName, value, field) {
  const trimmed = value?.trim();
  if (!trimmed) throw invalidInput(toolName, `缺少 ${field}`);
  return trimmed;
}

function checkAllowedActionFields(toolName, table, args) {
  const allowed = table[args.action];
  const unexpected = Object.keys(args).find((key) => key !== 'action' && !allowed.includes(key));
  if (unexpected) throw invalidInput(toolName, `${args.action} 不接受 ${unexpected}`);
}

function withCanonicalTargets(page) {
  if (!Array.isArray(page?.items)) return page;
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.target) return item;
      const target = item.type && item.type !== 'unknown' && item.id ? `${item.type}:${item.id}` : '';
      return target ? { ...item, target } : item;
    }),
  };
}

function sleep(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 对短耗时异步任务做有限次内部收敛，避免模型为 1 秒内完成的任务多走一轮 task 查询。 */
async function settlePendingTask({ kind, result, check, attempts, delayMs, signal }) {
  if (result?.status !== 'pending' || !result.taskId) return result;
  const rawTaskId = result.taskId;
  const prefixedTaskId = `${kind}:${rawTaskId}`;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await sleep(delayMs, signal);
      const checked = await check(rawTaskId);
      if (checked.status === 'completed') {
        return { ...result, status: 'completed', taskId: prefixedTaskId };
      }
      if (checked.status === 'failed') {
        return { ...result, status: 'failed', taskId: prefixedTaskId, ...(checked.message ? { message: checked.message } : {}) };
      }
    } catch {
      // 查询抖动不覆盖已提交的异步任务 ID，留给调用方用 action: task 重查。
      break;
    }
  }
  return { ...result, taskId: prefixedTaskId };
}

async function writeDocContent(request, id, text, format) {
  return format === 'markdown'
    ? appendCloudDocumentMarkdown({ request, id, text })
    : appendCloudDocument({ request, id, text });
}

async function createDocumentWithText(request, { name, folderId, text, format }) {
  const document = await createCloudDocument({ request, name, folderId });
  if (text === undefined) return { ...document, status: 'completed' };
  try {
    const appended = await writeDocContent(request, document.id, text, format);
    return { ...document, ...appended, status: 'completed' };
  } catch (error) {
    return { ...document, status: 'partial', message: `文档已创建。正文写入未确认，请读取该文档核对后再补写：${error.message}` };
  }
}

async function createWikiPageWithText(request, parent, name, text, format) {
  const page = await createWikiNode({ request, parent, name });
  if (text === undefined) return page;
  try {
    const { revisionId, blocksAdded } = await writeDocContent(request, page.objectId, text, format);
    return { ...page, ...(revisionId === undefined ? {} : { revisionId }), blocksAdded };
  } catch (error) {
    return { ...page, status: 'partial', message: `页面已创建。正文写入未确认，请读取该页面核对后再补写：${error.message}` };
  }
}

/** 1. 纯只读：搜索、列目录/知识库、查看 Wiki 节点详情、读取文档正文。 */
export function createDocReadTool({ auth, fetchImpl } = {}) {
  return defineFeishuTool({
    name: DOC_READ_TOOL_NAME,
    description: '以本人身份只读检索与阅读飞书云空间及知识库，操作由 action 选择。',
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => {
      const action = args?.action ?? '';
      const kind = action === 'search' || action === 'list' ? 'search' : 'read';
      const detail = args?.query || args?.target || '';
      return { card: 'generic', kind, title: `读取飞书文档（${action}${detail ? `：${detail}` : ''}）` };
    },
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: Object.keys(READ_ACTION_FIELDS), description: 'search 搜索 / list 列目录或知识空间 / inspect 查资源或 Wiki 节点详情 / read 读文档正文。' },
        query: { type: 'string', description: '仅 search 必填，搜索词 1–30 字。' },
        target: { type: 'string', description: '飞书链接或 type:ID。list 省略列云空间根目录，传 "wiki" 列知识空间，传文件夹或 wiki/wiki_space 列子项；inspect 支持云空间资源或 Wiki 节点；read 支持云文档或 Wiki 页面。' },
        limit: { type: 'integer', description: 'search：1–20（默认 10）；list：1–50（默认 20）。' },
        pageToken: { type: 'string', description: '翻页游标；继续同一查询时原样传回。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: Object.keys(READ_ACTION_FIELDS) },
          hasMore: { type: 'boolean' },
          pageToken: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'type', 'name', 'url'],
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string' },
                target: { type: 'string' },
                hasChildren: { type: 'boolean' },
                objectType: { type: 'string' },
              },
            },
          },
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          text: { type: 'string' },
          revisionId: { type: 'integer' },
          spaceId: { type: 'string' },
          parentNodeId: { type: 'string' },
          nodeType: { type: 'string' },
          objectId: { type: 'string' },
          objectType: { type: 'string' },
          hasChildren: { type: 'boolean' },
          url: { type: 'string' },
          target: { type: 'string' },
          ownerId: { type: 'string' },
          createTime: { type: 'string' },
          latestModifyTime: { type: 'string' },
        },
      },
      render: (_args, value) => renderToolOutput(value),
    },
    async execute(args, context) {
      checkAllowedActionFields(DOC_READ_TOOL_NAME, READ_ACTION_FIELDS, args);
      const { action, target, limit, pageToken } = args;
      let operation;
      switch (action) {
        case 'search': {
          const query = args.query?.trim();
          if (!query || [...query].length > 30) throw invalidInput(DOC_READ_TOOL_NAME, 'search 需要 1–30 字的 query');
          const size = boundedInteger(limit, 10, 20, 'limit');
          operation = async (request) => withCanonicalTargets(await searchCloudDocs({ request, query, limit: size, pageToken }));
          break;
        }
        case 'list': {
          const size = boundedInteger(limit, 20, 50, 'limit');
          if (target === undefined) {
            operation = async (request) => withCanonicalTargets(await listCloudFolder({ request, target: undefined, limit: size, pageToken }));
          } else if (target.trim() === 'wiki') {
            operation = (request) => listWikiSpaces({ request, limit: size, pageToken });
          } else {
            const loc = parseCloudTarget(target, ['folder', 'wiki_space', 'wiki'], 'folder');
            if (loc.type === 'folder') {
              operation = async (request) => withCanonicalTargets(await listCloudFolder({ request, target: loc.id, limit: size, pageToken }));
            } else if (loc.type === 'wiki_space') {
              operation = (request) => listWikiNodes({ request, spaceId: loc.id, limit: size, pageToken });
            } else {
              operation = async (request) => {
                const node = await resolveWikiNode({ request, nodeId: loc.id });
                return listWikiNodes({ request, spaceId: node.spaceId, parentNodeId: node.id, limit: size, pageToken });
              };
            }
          }
          break;
        }
        case 'inspect': {
          const resource = parseCloudTarget(target, [...DRIVE_RESOURCE_TYPES, 'wiki']);
          operation = resource.type === 'wiki'
            ? (request) => resolveWikiNode({ request, nodeId: resource.id })
            : (request) => inspectCloudMeta({ request, id: resource.id, type: resource.type });
          break;
        }
        case 'read': {
          const doc = parseCloudTarget(target, ['docx', 'doc', 'wiki'], 'docx');
          const cursor = parseDocumentCursor(pageToken);
          operation = doc.type === 'wiki'
            ? async (request) => {
              const { objectId, objectType } = await resolveWikiNode({ request, nodeId: doc.id });
              if (!['doc', 'docx'].includes(objectType)) {
                throw invalidInput(DOC_READ_TOOL_NAME, `该 Wiki 节点的资源类型为 ${objectType}，read 仅支持新版和旧版文档正文`);
              }
              return readDocument(request, { id: objectId, type: objectType }, cursor);
            }
            : (request) => readDocument(request, doc, cursor);
          break;
        }
        default:
          throw invalidInput(DOC_READ_TOOL_NAME, `不支持 ${action}`);
      }
      const request = createUserFeishuRequest({ auth, fetchImpl, signal: context?.signal });
      return { action, ...await operation(request) };
    },
  });
}

/** 2. 远端文档与目录写管理（统一 Drive 与 Wiki；创建/移动父级统一使用 parent，删除统一要求 confirm: true）。 */
export function createDocWriteTool({
  auth,
  fetchImpl,
  taskPollAttempts = DEFAULT_TASK_POLL_ATTEMPTS,
  taskPollDelayMs = DEFAULT_TASK_POLL_DELAY_MS,
} = {}) {
  return defineFeishuTool({
    name: DOC_WRITE_TOOL_NAME,
    description: '以本人身份管理飞书云文档与知识库页面，操作由 action 选择。',
    timeoutMs: 30_000,
    presentCall: (args) => {
      const action = args?.action ?? '';
      const kind = action === 'delete' ? 'delete' : action === 'move' ? 'move' : 'edit';
      const detail = args?.name || args?.target || args?.taskId || '';
      return { card: 'generic', kind, title: `写入飞书文档（${action}${detail ? `：${detail}` : ''}）` };
    },
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: Object.keys(WRITE_ACTION_FIELDS), description: 'create 建文档 / append 追加 / edit 局部替换 / create_folder 建文件夹 / rename 改名 / move 移动 / delete 删除 / task 查异步任务。' },
        target: { type: 'string', description: '目标文档/文件/目录/Wiki 页面的链接或 type:ID（append/edit/rename/move/delete 必填）。' },
        parent: { type: 'string', description: '父级位置（create/create_folder 可选，省略为云空间根目录；move 必填，云空间可用 "root"，Wiki 用 wiki: 或 wiki_space:）。' },
        name: { type: 'string', description: 'create/create_folder/rename 必填。普通文件改名须保留扩展名。' },
        text: { type: 'string', description: 'create 可选正文，append 必填追加正文，edit 必填替换文本（空串表示删除匹配文字）。' },
        format: { type: 'string', enum: ['plain', 'markdown'], default: 'plain', description: '仅 create/append 可选：plain 纯文本段落（默认），markdown 转换为标题/列表/代码块/表格等结构化块。' },
        find: { type: 'string', description: 'edit 必填，文档中唯一出现的原文。' },
        confirm: { type: 'boolean', description: 'delete 必须为 true，仅在用户明确要求删除时传入。' },
        includeChildren: { type: 'boolean', description: '仅 Wiki delete 可选，默认 false（子页面上移）；明确删除整棵子树时传 true。' },
        taskId: { type: 'string', description: 'task 必填，原样传回 move/delete 返回的任务 ID。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: Object.keys(WRITE_ACTION_FIELDS) },
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          target: { type: 'string' },
          folderId: { type: 'string' },
          spaceId: { type: 'string' },
          parentNodeId: { type: 'string' },
          nodeType: { type: 'string' },
          objectId: { type: 'string' },
          objectType: { type: 'string' },
          hasChildren: { type: 'boolean' },
          includeChildren: { type: 'boolean' },
          revisionId: { type: 'integer' },
          blockId: { type: 'string' },
          blocksAdded: { type: 'integer' },
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['completed', 'pending', 'failed', 'partial'] },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => renderToolOutput(value),
    },
    async execute(args, context) {
      checkAllowedActionFields(DOC_WRITE_TOOL_NAME, WRITE_ACTION_FIELDS, args);
      const { action, target, parent, text, format = 'plain', find, confirm, includeChildren, taskId } = args;
      const signal = context?.signal;
      const markdown = format === 'markdown';
      let operation;

      switch (action) {
        case 'create': {
          const name = requiredValue(DOC_WRITE_TOOL_NAME, args.name, 'name');
          if (text !== undefined) validateCloudDocumentText(text, { markdown });
          if (parent === undefined) {
            operation = (request) => createDocumentWithText(request, { name, folderId: undefined, text, format });
          } else {
            const loc = parseCloudTarget(parent, ['folder', 'wiki_space', 'wiki'], 'folder');
            operation = loc.type === 'folder'
              ? (request) => createDocumentWithText(request, { name, folderId: loc.id, text, format })
              : (request) => createWikiPageWithText(request, loc, name, text, format);
          }
          break;
        }
        case 'append': {
          const resource = parseCloudTarget(target, ['docx', 'wiki'], 'docx');
          validateCloudDocumentText(text, { markdown });
          operation = resource.type === 'wiki'
            ? async (request) => {
              const { objectId, objectType } = await resolveWikiNode({ request, nodeId: resource.id });
              if (objectType !== 'docx') throw invalidInput(DOC_WRITE_TOOL_NAME, `该 Wiki 节点的资源类型为 ${objectType}，append 仅支持新版文档（DOCX）正文`);
              return { ...await writeDocContent(request, objectId, text, format), status: 'completed' };
            }
            : async (request) => ({ ...await writeDocContent(request, resource.id, text, format), status: 'completed' });
          break;
        }
        case 'edit': {
          const resource = parseCloudTarget(target, ['docx', 'wiki'], 'docx');
          validateDocumentReplacement(find, text);
          operation = resource.type === 'wiki'
            ? async (request) => {
              const { objectId, objectType } = await resolveWikiNode({ request, nodeId: resource.id });
              if (objectType !== 'docx') throw invalidInput(DOC_WRITE_TOOL_NAME, `该 Wiki 节点的资源类型为 ${objectType}，edit 仅支持新版文档（DOCX）正文`);
              return { ...await editCloudDocument({ request, id: objectId, find, text }), status: 'completed' };
            }
            : async (request) => ({ ...await editCloudDocument({ request, id: resource.id, find, text }), status: 'completed' });
          break;
        }
        case 'create_folder': {
          const name = requiredValue(DOC_WRITE_TOOL_NAME, args.name, 'name');
          const folderId = parent === undefined ? undefined : parseCloudTarget(parent, ['folder'], 'folder').id;
          operation = (request) => createCloudFolder({ request, name, folderId });
          break;
        }
        case 'rename': {
          const resource = parseCloudTarget(target, [...DRIVE_RENAME_TYPES, 'wiki']);
          const name = requiredValue(DOC_WRITE_TOOL_NAME, args.name, 'name');
          operation = (request) => renameCloudFile({ request, ...resource, name });
          break;
        }
        case 'move': {
          const resource = parseCloudTarget(target, [...DRIVE_MOVE_TYPES, 'wiki']);
          if (resource.type === 'wiki') {
            const destination = parseCloudTarget(parent, ['wiki_space', 'wiki']);
            if (destination.type === 'wiki' && destination.id === resource.id) {
              throw invalidInput(DOC_WRITE_TOOL_NAME, '不能将节点移动到自身');
            }
            operation = (request) => moveWikiNode({ request, nodeId: resource.id, destination });
          } else {
            const folderId = typeof parent === 'string' && parent.trim() === 'root'
              ? undefined
              : parseCloudTarget(parent, ['folder'], 'folder').id;
            operation = (request) => driveMutations.run('move-delete', async () => {
              const moved = await moveCloudFile({ request, ...resource, folderId });
              return settlePendingTask({
                kind: 'drive',
                result: moved,
                check: (rawId) => checkCloudTask({ request, taskId: rawId }),
                attempts: taskPollAttempts,
                delayMs: taskPollDelayMs,
                signal,
              });
            });
          }
          break;
        }
        case 'delete': {
          if (confirm !== true) throw invalidInput(DOC_WRITE_TOOL_NAME, 'delete 需要 confirm: true，表示用户明确要求删除');
          const resource = parseCloudTarget(target, [...DRIVE_RESOURCE_TYPES, 'wiki']);
          if (resource.type === 'wiki') {
            operation = async (request) => {
              const deleted = await deleteWikiNode({ request, nodeId: resource.id, includeChildren: includeChildren === true });
              return settlePendingTask({
                kind: 'wiki',
                result: deleted,
                check: (rawId) => checkWikiDeleteTask({ request, taskId: rawId }),
                attempts: taskPollAttempts,
                delayMs: taskPollDelayMs,
                signal,
              });
            };
          } else {
            if (includeChildren !== undefined) throw invalidInput(DOC_WRITE_TOOL_NAME, 'includeChildren 仅用于 Wiki 页面删除');
            operation = (request) => driveMutations.run('move-delete', async () => {
              const deleted = await deleteCloudFile({ request, ...resource });
              return settlePendingTask({
                kind: 'drive',
                result: deleted,
                check: (rawId) => checkCloudTask({ request, taskId: rawId }),
                attempts: taskPollAttempts,
                delayMs: taskPollDelayMs,
                signal,
              });
            });
          }
          break;
        }
        case 'task': {
          const raw = requiredValue(DOC_WRITE_TOOL_NAME, taskId, 'taskId');
          const prefixed = raw.match(/^(drive|wiki):([A-Za-z0-9_-]+)$/);
          if (prefixed) {
            const [, kind, id] = prefixed;
            operation = async (request) => {
              const checked = kind === 'wiki'
                ? await checkWikiDeleteTask({ request, taskId: id })
                : await checkCloudTask({ request, taskId: id });
              return { ...checked, taskId: raw };
            };
          } else {
            if (!/^[A-Za-z0-9_-]+$/.test(raw)) throw invalidInput(DOC_WRITE_TOOL_NAME, 'task 需要有效的 taskId');
            operation = (request) => checkCloudTask({ request, taskId: raw });
          }
          break;
        }
        default:
          throw invalidInput(DOC_WRITE_TOOL_NAME, `不支持 ${action}`);
      }

      const request = createUserFeishuRequest({ auth, fetchImpl, signal });
      return { action, ...await operation(request) };
    },
  });
}

/** 3. 本地工作区 ↔ 飞书云端/知识库文件传输（独立隔离本地磁盘 I/O 边界）。 */
export function createDocFileTool({ auth, fetchImpl, harness = null } = {}) {
  return defineFeishuTool({
    name: DOC_FILE_TOOL_NAME,
    description: '以本人身份在当前会话工作区与飞书云空间、知识库之间传输普通文件附件。',
    timeoutMs: 60_000,
    presentCall: (args) => {
      const action = args?.action ?? '';
      const kind = action === 'download' ? 'edit' : 'other';
      return { card: 'generic', kind, title: `飞书文件传输（${action}：${args?.path ?? ''}）` };
    },
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'path'],
      properties: {
        action: { type: 'string', enum: Object.keys(FILE_ACTION_FIELDS), description: 'download 下载到本地 / upload 上传到目录或 Wiki / replace 覆盖已有文件。' },
        target: { type: 'string', description: 'download/replace 必填：飞书文件或 Wiki 附件节点的链接或 type:ID。' },
        parent: { type: 'string', description: 'upload 必填：目标云空间文件夹或 Wiki 父节点的链接或 type:ID。' },
        path: { type: 'string', description: '本地文件路径（相对当前会话工作区）；download 写入工作区内新文件。' },
        name: { type: 'string', description: 'upload 可选，上传后显示的文件名（含扩展名）。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: Object.keys(FILE_ACTION_FIELDS) },
          id: { type: 'string' },
          type: { type: 'string' },
          target: { type: 'string' },
          objectId: { type: 'string' },
          objectType: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          path: { type: 'string' },
          bytes: { type: 'integer' },
          status: { type: 'string', enum: ['completed', 'pending', 'failed', 'partial'] },
        },
      },
      render: (_args, value) => renderToolOutput(value),
    },
    async execute(args, context) {
      checkAllowedActionFields(DOC_FILE_TOOL_NAME, FILE_ACTION_FIELDS, args);
      const { action, target, parent, name } = args;
      const path = requiredValue(DOC_FILE_TOOL_NAME, args.path, 'path');
      const cwd = await resolveSessionCwd(context, harness);
      const sandboxMode = resolveSandboxMode(context, harness);
      const signal = context?.signal;
      let operation;

      if (action === 'upload') {
        const loc = parseCloudTarget(parent, ['folder', 'wiki'], 'folder');
        operation = loc.type === 'wiki'
          ? (request) => uploadCloudFile({ request, path, cwd, signal, sandboxMode, wikiParentId: loc.id, name })
          : (request) => uploadCloudFile({ request, path, cwd, signal, sandboxMode, folderId: loc.id, name });
      } else {
        if (action === 'download' && sandboxMode === 'read-only') {
          throw new Error('当前会话处于只读沙箱模式，不允许向本地下载写入文件');
        }
        const resource = parseCloudTarget(target, ['file', 'wiki'], 'file');
        if (resource.type === 'wiki') {
          operation = async (request) => {
            const node = await resolveWikiNode({ request, nodeId: resource.id });
            if (node.objectType !== 'file') {
              throw invalidInput(DOC_FILE_TOOL_NAME, `${action} 需要 HTML、PDF 等普通文件节点，当前资源类型为 ${node.objectType}`);
            }
            const fileMeta = { id: node.id, type: 'wiki', target: node.target, objectId: node.objectId, objectType: node.objectType };
            if (action === 'download') {
              const result = await downloadCloudFile({ request, id: node.objectId, path, cwd, signal, sandboxMode });
              return { ...result, ...fileMeta };
            }
            if (node.nodeType !== 'origin') throw invalidInput(DOC_FILE_TOOL_NAME, 'replace 需要文件的原始 Wiki 节点，请提供原页面链接');
            if (!node.name.trim()) throw invalidInput(DOC_FILE_TOOL_NAME, '无法确认附件原名，请核对页面后再覆盖');
            const result = await uploadCloudFile({
              request, path, cwd, signal, sandboxMode, fileId: node.objectId,
              parentType: 'wiki', wikiParentId: node.parentNodeId || undefined, name: node.name,
            });
            return { ...result, ...fileMeta };
          };
        } else {
          operation = action === 'download'
            ? (request) => downloadCloudFile({ request, id: resource.id, path, cwd, signal, sandboxMode })
            : (request) => uploadCloudFile({ request, fileId: resource.id, path, cwd, signal, sandboxMode });
        }
      }

      const request = createUserFeishuRequest({ auth, fetchImpl, signal });
      return { action, ...await operation(request) };
    },
  });
}
