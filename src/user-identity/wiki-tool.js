import { boundedInteger, defineFeishuTool, renderToolOutput } from '../tool-contract.js';
import { createUserFeishuRequest } from './auth.js';
import { parseCloudTarget } from './cloud-discovery.js';
import { parseDocumentCursor, readDocument } from './cloud-document-read.js';
import { appendCloudDocument, editCloudDocument, validateCloudDocumentText, validateDocumentReplacement } from './cloud-document-write.js';
import { downloadCloudFile } from './cloud-download.js';
import { renameCloudFile } from './cloud-drive-write.js';
import { uploadCloudFile } from './cloud-upload.js';
import { checkWikiDeleteTask, createWikiNode, deleteWikiNode, listWikiNodes, listWikiSpaces, moveWikiNode, resolveWikiNode } from './cloud-wiki.js';

export const WIKI_TOOL_NAME = 'feishu_avatar_wiki';

const ACTION_FIELDS = {
  list: ['target', 'limit', 'pageToken'],
  inspect: ['target'],
  read: ['target', 'pageToken'],
  create: ['target', 'name', 'text'],
  append: ['target', 'text'],
  edit: ['target', 'find', 'text'],
  download: ['target', 'path'],
  upload: ['target', 'path', 'name'],
  replace: ['target', 'path'],
  rename: ['target', 'name'],
  move: ['target', 'destination'],
  delete: ['target', 'confirm', 'includeChildren'],
  task: ['taskId'],
};

function invalidInput(message) {
  return Object.assign(new Error(`${WIKI_TOOL_NAME} 参数错误：${message}`), { code: 'INVALID_ARGS' });
}

function requiredValue(value, field) {
  const trimmed = value?.trim();
  if (!trimmed) throw invalidInput(`缺少 ${field}`);
  return trimmed;
}

async function listWiki(request, location, limit, pageToken) {
  if (!location) return listWikiSpaces({ request, limit, pageToken });
  if (location.type === 'wiki_space') return listWikiNodes({ request, spaceId: location.id, limit, pageToken });
  const node = await resolveWikiNode({ request, nodeId: location.id });
  return listWikiNodes({ request, spaceId: node.spaceId, parentNodeId: node.id, limit, pageToken });
}

async function createWikiPage(request, parent, name, text) {
  const page = await createWikiNode({ request, parent, name });
  if (text === undefined) return page;
  try {
    const { revisionId, blocksAdded } = await appendCloudDocument({ request, id: page.objectId, text });
    return { ...page, ...(revisionId === undefined ? {} : { revisionId }), blocksAdded };
  } catch (error) {
    return { ...page, status: 'partial', message: `页面已创建。正文写入未确认，请读取该页面核对后再补写：${error.message}` };
  }
}

function operateOnWikiFile(action, args, nodeId, context, harness) {
  const path = requiredValue(args.path, 'path');
  const cwd = context?.agent?.session?.cwd;
  const signal = context?.signal;
  if (action === 'upload') {
    return (request) => uploadCloudFile({ request, path, cwd, signal, wikiParentId: nodeId, name: args.name });
  }
  if (action === 'download' && harness?.sandboxModeOf?.(context?.agent?.session) === 'read-only') {
    throw new Error('当前会话处于只读沙箱模式，不允许向本地下载写入文件');
  }

  return async (request) => {
    const node = await resolveWikiNode({ request, nodeId });
    if (node.objectType !== 'file') throw invalidInput(`${action} 需要 HTML、PDF 等普通文件节点，当前资源类型为 ${node.objectType}`);
    const file = { id: node.id, type: 'wiki', target: node.target, objectId: node.objectId, objectType: node.objectType };
    if (action === 'download') {
      const result = await downloadCloudFile({ request, id: node.objectId, path, cwd, signal });
      return { ...result, ...file };
    }
    if (node.nodeType !== 'origin') throw invalidInput('replace 需要文件的原始 Wiki 节点，请提供原页面链接');
    if (!node.name.trim()) throw invalidInput('无法确认附件原名，请核对页面后再覆盖');
    const result = await uploadCloudFile({
      request, path, cwd, signal, fileId: node.objectId,
      parentType: 'wiki', wikiParentId: node.parentNodeId || undefined, name: node.name,
    });
    return { ...result, ...file };
  };
}

function operationFor(args, context, harness) {
  const { action, target, limit, pageToken, text, find, confirm, includeChildren = false, taskId } = args;
  if (action === 'list') {
    const location = target === undefined || target.trim() === 'wiki'
      ? null : parseCloudTarget(target, ['wiki_space', 'wiki']);
    const pageSize = boundedInteger(limit, 20, 50, 'limit');
    return (request) => listWiki(request, location, pageSize, pageToken);
  }

  if (action === 'task') {
    if (!taskId || !/^[A-Za-z0-9_-]+$/.test(taskId)) throw invalidInput('task 需要有效的 taskId');
    return (request) => checkWikiDeleteTask({ request, taskId });
  }
  if (action === 'create') {
    const parent = parseCloudTarget(target, ['wiki_space', 'wiki']);
    const name = requiredValue(args.name, 'name');
    if (text !== undefined) validateCloudDocumentText(text);
    return (request) => createWikiPage(request, parent, name, text);
  }

  const { id: nodeId } = parseCloudTarget(target, ['wiki']);
  if (action === 'inspect') return (request) => resolveWikiNode({ request, nodeId });
  if (['download', 'upload', 'replace'].includes(action)) return operateOnWikiFile(action, args, nodeId, context, harness);
  if (action === 'rename') {
    const name = requiredValue(args.name, 'name');
    return (request) => renameCloudFile({ request, id: nodeId, type: 'wiki', name });
  }
  if (action === 'move') {
    const destination = parseCloudTarget(args.destination, ['wiki_space', 'wiki']);
    if (destination.type === 'wiki' && destination.id === nodeId) throw invalidInput('不能将节点移动到自身');
    return (request) => moveWikiNode({ request, nodeId, destination });
  }
  if (action === 'delete') {
    if (confirm !== true) throw invalidInput('delete 需要 confirm: true，表示用户明确要求删除指定页面');
    return (request) => deleteWikiNode({ request, nodeId, includeChildren });
  }
  if (action === 'read') {
    const cursor = parseDocumentCursor(pageToken);
    return async (request) => {
      const { objectId, objectType } = await resolveWikiNode({ request, nodeId });
      if (!['doc', 'docx'].includes(objectType)) throw invalidInput(`该 Wiki 节点的资源类型为 ${objectType}，read 支持新版和旧版文档正文`);
      return readDocument(request, { id: objectId, type: objectType }, cursor);
    };
  }

  const append = action === 'append';
  if (append) validateCloudDocumentText(text);
  else validateDocumentReplacement(find, text);
  return async (request) => {
    const { objectId, objectType } = await resolveWikiNode({ request, nodeId });
    if (objectType !== 'docx') throw invalidInput(`该 Wiki 节点的资源类型为 ${objectType}，${action} 仅支持新版文档（DOCX）正文`);
    const result = append
      ? await appendCloudDocument({ request, id: objectId, text })
      : await editCloudDocument({ request, id: objectId, find, text });
    return { ...result, status: 'completed' };
  };
}

export function createWikiTool({ auth, fetchImpl, harness = null } = {}) {
  return defineFeishuTool({
    name: WIKI_TOOL_NAME,
    description: '以本人身份浏览和管理飞书知识库节点，读写文档正文，下载、上传或覆盖附件。按关键词搜索用 feishu_avatar_cloud。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: Object.keys(ACTION_FIELDS) },
        target: { type: 'string', description: 'Wiki 页面链接或 wiki:节点ID。list/create 可用 wiki_space:空间ID。create/upload 的 target 是父级。list 省略时列空间。' },
        destination: { type: 'string', description: 'move 必填，使用目标父页面的 Wiki 链接、wiki:节点ID 或 wiki_space:空间ID（顶层）。' },
        limit: { type: 'integer', description: 'list 每页条数，1–50，默认 20。' },
        pageToken: { type: 'string', description: 'list/read 继续读取同一目标时原样传回返回的游标。' },
        text: { type: 'string', description: 'create 的可选正文、append 的追加正文或 edit 的替换文本。edit 可传空串删除匹配文字。' },
        find: { type: 'string', description: 'edit 必填，文档中唯一出现的原文。' },
        name: { type: 'string', description: 'create/rename 必填，upload 可选。文件节点改名须保留扩展名。' },
        path: { type: 'string', description: 'download/upload/replace 必填。本地文件路径，下载写入会话工作区内的新文件。' },
        confirm: { type: 'boolean', description: 'delete 必须为 true。仅在用户明确要求删除指定 Wiki 页面时传入。' },
        includeChildren: { type: 'boolean', description: '仅 delete。默认 false，直属子页面移到上一级。用户明确要求删除整棵子树时才传 true。' },
        taskId: { type: 'string', description: 'task 必填，查询 delete 返回的异步任务 ID。' },
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
            type: 'object', additionalProperties: false, required: ['id', 'type', 'name', 'url', 'target'],
            properties: {
              id: { type: 'string' }, type: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' },
              target: { type: 'string' }, hasChildren: { type: 'boolean' }, objectType: { type: 'string' },
            },
          } },
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          text: { type: 'string' },
          revisionId: { type: 'integer' },
          blockId: { type: 'string' },
          blocksAdded: { type: 'integer' },
          spaceId: { type: 'string' },
          parentNodeId: { type: 'string' },
          nodeType: { type: 'string' },
          objectId: { type: 'string' },
          objectType: { type: 'string' },
          hasChildren: { type: 'boolean' },
          url: { type: 'string' },
          target: { type: 'string' },
          path: { type: 'string' },
          bytes: { type: 'integer' },
          includeChildren: { type: 'boolean' },
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
