import { KeyedQueue } from '../queue.js';
import { boundedInteger, defineFeishuTool, renderToolOutput } from '../tool-contract.js';
import { createUserFeishuRequest } from './auth.js';
import { listCloudFolder, parseCloudTarget, searchCloudDocs } from './cloud-discovery.js';
import { parseDocumentCursor, readDocument } from './cloud-document-read.js';
import { appendCloudDocument, createCloudDocument, editCloudDocument, validateCloudDocumentText } from './cloud-document-write.js';
import { downloadCloudFile } from './cloud-download.js';
import {
  checkCloudTask, createCloudFolder, deleteCloudFile, moveCloudFile, renameCloudFile,
  DRIVE_RESOURCE_TYPES, DRIVE_MOVE_TYPES, DRIVE_RENAME_TYPES,
} from './cloud-drive-write.js';
import { uploadCloudFile } from './cloud-upload.js';

export const CLOUD_TOOL_NAME = 'feishu_avatar_cloud';

// Drive rejects concurrent move and delete requests. Serialize these calls
// without blocking reads or waiting for asynchronous Feishu jobs to finish.
const driveMutations = new KeyedQueue();
const ACTION_FIELDS = {
  search: ['query', 'limit', 'pageToken'],
  list: ['target', 'limit', 'pageToken'],
  read: ['target', 'pageToken'],
  create: ['name', 'folder', 'text'],
  append: ['target', 'text'],
  edit: ['target', 'find', 'text'],
  create_folder: ['name', 'folder'],
  download: ['target', 'path'],
  upload: ['path', 'folder', 'name'],
  replace: ['target', 'path'],
  rename: ['target', 'name'],
  move: ['target', 'folder'],
  delete: ['target'],
  task: ['taskId'],
};

function invalidInput(message) {
  return Object.assign(new Error(`${CLOUD_TOOL_NAME} 参数错误：${message}`), { code: 'INVALID_ARGS' });
}

function parseDriveTarget(target, allowedTypes, defaultType) {
  const resource = parseCloudTarget(target, [...allowedTypes, 'wiki', 'wiki_space'], defaultType);
  if (resource.type === 'wiki' || resource.type === 'wiki_space') {
    throw invalidInput('Wiki target 请改用 feishu_avatar_wiki');
  }
  return resource;
}

function requiredValue(value, field) {
  if (!value?.trim()) throw invalidInput(`缺少 ${field}`);
  return value.trim();
}

function folderId(folder) {
  return parseCloudTarget(folder, ['folder'], 'folder').id;
}

function documentId(target) {
  return parseDriveTarget(target, ['docx'], 'docx').id;
}

async function createDocumentWithText(request, { name, folderId, text }) {
  const document = await createCloudDocument({ request, name, folderId });
  if (text === undefined) return { ...document, status: 'completed' };
  try {
    const appended = await appendCloudDocument({ request, id: document.id, text });
    return { ...document, ...appended, status: 'completed' };
  } catch (error) {
    return { ...document, status: 'partial', message: `文档已创建。正文写入未确认，请读取该文档核对后再补写：${error.message}` };
  }
}

function operationFor(args, context, harness) {
  const { action, pageToken, target, text, folder } = args;
  switch (action) {
    case 'search': {
      const query = args.query?.trim();
      if (!query || [...query].length > 30) throw invalidInput('search 需要 1–30 字的 query');
      const limit = boundedInteger(args.limit, 10, 20, 'limit');
      return (request) => searchCloudDocs({ request, query, limit, pageToken });
    }
    case 'list': {
      if (target?.trim() === 'wiki') throw invalidInput('Wiki target 请改用 feishu_avatar_wiki');
      const id = target === undefined ? undefined : parseDriveTarget(target, ['folder'], 'folder').id;
      const limit = boundedInteger(args.limit, 20, 50, 'limit');
      return (request) => listCloudFolder({ request, target: id, limit, pageToken });
    }
    case 'read': {
      const document = parseDriveTarget(target, ['docx', 'doc'], 'docx');
      const cursor = parseDocumentCursor(pageToken);
      return (request) => readDocument(request, document, cursor);
    }
    case 'create': {
      const name = requiredValue(args.name, 'name');
      const parent = folder === undefined ? undefined : folderId(folder);
      if (text !== undefined) validateCloudDocumentText(text);
      return (request) => createDocumentWithText(request, { name, folderId: parent, text });
    }
    case 'append': {
      const id = documentId(target);
      validateCloudDocumentText(text);
      return async (request) => ({ ...await appendCloudDocument({ request, id, text }), status: 'completed' });
    }
    case 'edit': {
      const id = documentId(target);
      return async (request) => ({ ...await editCloudDocument({ request, id, find: args.find, text }), status: 'completed' });
    }
    case 'create_folder': {
      const name = requiredValue(args.name, 'name');
      const parent = folder === undefined ? undefined : folderId(folder);
      return (request) => createCloudFolder({ request, name, folderId: parent });
    }
    case 'upload': {
      const path = requiredValue(args.path, 'path');
      const parent = folderId(folder);
      return (request) => uploadCloudFile({ request, path, cwd: context?.agent?.session?.cwd, folderId: parent, name: args.name, signal: context?.signal });
    }
    case 'download':
    case 'replace': {
      const { id } = parseDriveTarget(target, ['file'], 'file');
      const path = requiredValue(args.path, 'path');
      const cwd = context?.agent?.session?.cwd;
      const signal = context?.signal;
      if (action === 'download' && harness?.sandboxModeOf?.(context?.agent?.session) === 'read-only') {
        throw new Error('当前会话处于只读沙箱模式，不允许向本地下载写入文件');
      }
      return action === 'download'
        ? (request) => downloadCloudFile({ request, id, path, cwd, signal })
        : (request) => uploadCloudFile({ request, fileId: id, path, cwd, signal });
    }
    case 'rename': {
      const resource = parseCloudTarget(target, DRIVE_RENAME_TYPES);
      const name = requiredValue(args.name, 'name');
      return (request) => renameCloudFile({ request, ...resource, name });
    }
    case 'move': {
      const resource = parseCloudTarget(target, DRIVE_MOVE_TYPES);
      const parent = typeof folder === 'string' && folder.trim() === 'root' ? undefined : folderId(folder);
      return (request) => driveMutations.run('move-delete', () => moveCloudFile({ request, ...resource, folderId: parent }));
    }
    case 'delete': {
      const resource = parseCloudTarget(target, DRIVE_RESOURCE_TYPES);
      return (request) => driveMutations.run('move-delete', () => deleteCloudFile({ request, ...resource }));
    }
    case 'task': {
      const taskId = requiredValue(args.taskId, 'taskId');
      return (request) => checkCloudTask({ request, taskId });
    }
    default:
      throw invalidInput(`不支持 ${action}`);
  }
}

export function createCloudTool({ auth, fetchImpl, harness = null } = {}) {
  return defineFeishuTool({
    name: CLOUD_TOOL_NAME,
    description: '以本人身份管理飞书云空间文件、目录和文档。search 也能找到 Wiki，Wiki 结果用 feishu_avatar_wiki 打开。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: Object.keys(ACTION_FIELDS) },
        query: { type: 'string', description: '仅 search，必填。搜索词最多 30 字。' },
        target: { type: 'string', description: '云空间链接或 type:ID。list 用文件夹，省略列根目录。read 用文档，append/edit 用 DOCX，download/replace 用普通文件。' },
        limit: { type: 'integer', description: 'search：1–20，默认 10。list：1–50，默认 20。' },
        pageToken: { type: 'string', description: '继续同一查询时原样传回返回的游标。' },
        name: { type: 'string', description: 'create/create_folder/rename 必填，upload 可选。普通文件名包含扩展名。' },
        folder: { type: 'string', description: '目标文件夹链接或 ID。create/create_folder 可省略。upload/move 必填，move 可传 root。' },
        text: { type: 'string', description: 'create 可选正文，append 必填追加正文，edit 必填替换文本（空串表示移除匹配内容）。' },
        find: { type: 'string', description: 'edit 必填，文档中唯一出现的原文。' },
        path: { type: 'string', description: 'download/upload/replace 必填。本地文件路径，下载写入会话工作区内的新文件。' },
        taskId: { type: 'string', description: 'task 必填，原样传回 move/delete 返回的任务 ID。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: Object.keys(ACTION_FIELDS) },
          hasMore: { type: 'boolean' },
          pageToken: { type: 'string' },
          items: { type: 'array', items: {
            type: 'object', additionalProperties: false, required: ['id', 'type', 'name', 'url'],
            properties: {
              id: { type: 'string' }, type: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' },
              target: { type: 'string', description: 'Wiki 搜索结果可传给 feishu_avatar_wiki。' },
            },
          } },
          id: { type: 'string' },
          type: { type: 'string' },
          text: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          folderId: { type: 'string' },
          revisionId: { type: 'integer' },
          blockId: { type: 'string' },
          blocksAdded: { type: 'integer' },
          bytes: { type: 'integer' },
          path: { type: 'string' },
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['completed', 'pending', 'failed', 'partial'] },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => renderToolOutput(value),
    },
    async execute(args, context) {
      const { action } = args;
      const unexpected = Object.keys(args).find((key) => key !== 'action' && !ACTION_FIELDS[action].includes(key));
      if (unexpected) throw invalidInput(`${action} 不接受 ${unexpected}`);
      const operation = operationFor(args, context, harness);
      const request = createUserFeishuRequest({ auth, fetchImpl, signal: context?.signal });
      return { action, ...await operation(request) };
    },
  });
}
