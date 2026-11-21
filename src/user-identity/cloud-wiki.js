import { pageOf, resultRows } from './cloud-discovery.js';
import { FeishuApiError } from './errors.js';

const WIKI_SPACES_PATH = '/open-apis/wiki/v2/spaces';
const WIKI_SPACE_SCOPE = 'wiki:space:retrieve';
const WIKI_NODE_SCOPE = 'wiki:node:retrieve';
const WIKI_CREATE_SCOPE = 'wiki:node:create';
const WIKI_MOVE_SCOPE = 'wiki:node:move';
const tokenPattern = /^[A-Za-z0-9_-]+$/;
const spaceIdPattern = /^\d+$/;

const stringOf = (value) => typeof value === 'string' ? value : '';

function validId(value, pattern, description) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new FeishuApiError(`飞书返回的${description}无效`);
  }
  return value;
}

async function callWiki(request, options, scope) {
  try {
    return await request(options);
  } catch (error) {
    if (![99991672, 99991679].includes(error?.feishuCode)) throw error;
    throw new FeishuApiError(`此知识库操作需要 ${scope}。请在飞书应用开通权限后，到「状态 → 分身状态 → 重新授权」扫码（code ${error.feishuCode}）`, error.details);
  }
}

export async function listWikiSpaces({ request, limit, pageToken }) {
  const data = await callWiki(request, {
    path: WIKI_SPACES_PATH,
    query: { page_size: limit, page_token: pageToken },
  }, WIKI_SPACE_SCOPE);
  const items = resultRows(data, 'items').map((space) => {
    const id = validId(space.space_id, spaceIdPattern, '知识空间 ID');
    return {
      id,
      type: 'wiki_space',
      name: stringOf(space.name),
      url: stringOf(space.url),
      target: `wiki_space:${id}`,
    };
  });
  return pageOf(items, data, data.page_token, pageToken);
}

export async function listWikiNodes({ request, spaceId, parentNodeId, limit, pageToken }) {
  const data = await callWiki(request, {
    path: `${WIKI_SPACES_PATH}/${encodeURIComponent(spaceId)}/nodes`,
    query: { parent_node_token: parentNodeId, page_size: limit, page_token: pageToken },
  }, WIKI_NODE_SCOPE);
  const items = resultRows(data, 'items').map((node) => {
    const id = validId(node.node_token, tokenPattern, '知识库节点 ID');
    return {
      id,
      type: 'wiki',
      name: stringOf(node.title),
      url: stringOf(node.url),
      target: `wiki:${id}`,
      ...(typeof node.has_child === 'boolean' ? { hasChildren: node.has_child } : {}),
      ...(typeof node.obj_type === 'string' && node.obj_type ? { objectType: node.obj_type } : {}),
    };
  });
  return pageOf(items, data, data.page_token, pageToken);
}

function wikiNodeDetails(node) {
  const id = validId(node?.node_token, tokenPattern, '知识库节点 ID');
  const objectType = stringOf(node.obj_type);
  if (!objectType) throw new FeishuApiError('飞书没有返回知识库节点的资源类型');
  return {
    id,
    type: 'wiki',
    spaceId: validId(node.space_id, spaceIdPattern, '知识空间 ID'),
    objectId: validId(node.obj_token, tokenPattern, '知识库资源 ID'),
    objectType,
    name: stringOf(node.title),
    parentNodeId: stringOf(node.parent_node_token),
    nodeType: stringOf(node.node_type),
    hasChildren: node.has_child === true,
    url: stringOf(node.url),
    target: `wiki:${id}`,
  };
}

export async function resolveWikiNode({ request, nodeId }) {
  const data = await callWiki(request, {
    path: `${WIKI_SPACES_PATH}/node_by_token`,
    query: { token: nodeId },
  }, WIKI_NODE_SCOPE);
  const node = wikiNodeDetails(data?.node);
  if (node.id !== nodeId) throw new FeishuApiError('飞书返回的知识库节点与请求的节点不一致');
  return node;
}

async function resolveWikiLocation(request, location) {
  if (location.type === 'wiki_space') return { spaceId: location.id, parentNodeId: '' };
  const parent = await resolveWikiNode({ request, nodeId: location.id });
  return { spaceId: parent.spaceId, parentNodeId: parent.id };
}

function completedWikiMutation(data, operation, spaceId, parentNodeId) {
  try {
    const node = wikiNodeDetails(data?.node);
    if (node.spaceId !== spaceId || node.parentNodeId !== parentNodeId) {
      throw new FeishuApiError('飞书返回的节点位置与操作目标不一致');
    }
    return { ...node, status: 'completed' };
  } catch (error) {
    throw new FeishuApiError(`飞书未确认 Wiki ${operation}结果，请核对目标位置后再操作。${error.message}`);
  }
}

export async function createWikiNode({ request, parent, name }) {
  const { spaceId, parentNodeId } = await resolveWikiLocation(request, parent);
  const data = await callWiki(request, {
    path: `${WIKI_SPACES_PATH}/${encodeURIComponent(spaceId)}/nodes`,
    method: 'POST',
    body: {
      obj_type: 'docx', node_type: 'origin', title: name,
      ...(parentNodeId ? { parent_node_token: parentNodeId } : {}),
    },
  }, WIKI_CREATE_SCOPE);
  const created = completedWikiMutation(data, '创建', spaceId, parentNodeId);
  if (created.objectType !== 'docx') {
    throw new FeishuApiError('飞书返回的节点类型不是 Docx，请先核对创建结果');
  }
  return created;
}

export async function moveWikiNode({ request, nodeId, destination }) {
  if (destination.type === 'wiki' && destination.id === nodeId) {
    throw Object.assign(new Error('不能将 Wiki 节点移动到自身下'), { code: 'INVALID_ARGS' });
  }
  const source = await resolveWikiNode({ request, nodeId });
  const { spaceId, parentNodeId } = await resolveWikiLocation(request, destination);
  const data = await callWiki(request, {
    path: `${WIKI_SPACES_PATH}/${encodeURIComponent(source.spaceId)}/nodes/${encodeURIComponent(source.id)}/move`,
    method: 'POST',
    body: { target_space_id: spaceId, ...(parentNodeId ? { target_parent_token: parentNodeId } : {}) },
  }, WIKI_MOVE_SCOPE);
  return completedWikiMutation(data, '移动', spaceId, parentNodeId);
}

export async function deleteWikiNode({ request, nodeId, includeChildren }) {
  const { id, spaceId } = await resolveWikiNode({ request, nodeId });
  const data = await callWiki(request, {
    path: `${WIKI_SPACES_PATH}/${encodeURIComponent(spaceId)}/nodes/${encodeURIComponent(id)}`,
    method: 'DELETE',
    body: { obj_type: 'wiki', include_children: includeChildren },
  }, WIKI_CREATE_SCOPE).catch((error) => {
    if (error?.feishuCode === 131011) {
      throw new FeishuApiError('该页面开启了删除审批，请在飞书知识库页面中申请删除', error.details);
    }
    if (includeChildren && error?.feishuCode === 131003) {
      throw new FeishuApiError('飞书无法一次删除此页面及其子页面，子树超出删除上限', error.details);
    }
    throw error;
  });
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || (data.task_id != null && data.task_id !== '' && !tokenPattern.test(stringOf(data.task_id)))) {
    throw new FeishuApiError('飞书返回的删除结果格式无效，请核对页面状态后再操作');
  }
  const result = { id, type: 'wiki', spaceId, includeChildren };
  return data.task_id ? { ...result, status: 'pending', taskId: data.task_id } : { ...result, status: 'completed' };
}

export async function checkWikiDeleteTask({ request, taskId }) {
  const data = await callWiki(request, {
    path: `/open-apis/wiki/v2/tasks/${encodeURIComponent(taskId)}`,
    query: { task_type: 'delete_node' },
  }, WIKI_CREATE_SCOPE);
  const status = stringOf(data?.task?.simple_task_result?.status).trim().toLowerCase();
  if (status === 'success') return { taskId, status: 'completed' };
  if (status === 'failure' || status === 'failed') {
    return { taskId, status: 'failed', message: '飞书报告 Wiki 删除任务失败，请核对页面状态' };
  }
  if (status === 'processing') return { taskId, status: 'pending' };
  throw new FeishuApiError('飞书未返回可识别的 Wiki 删除任务状态，请用相同的 taskId 重新查询');
}
