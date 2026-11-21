import { randomUUID } from 'node:crypto';
import { FeishuApiError } from './errors.js';

const DOCUMENTS = '/open-apis/docx/v1/documents';
const MAX_TEXT_LENGTH = 20_000;
const MAX_APPEND_BLOCKS = 50;
const TEXT_FIELDS = [
  'page', 'text', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5',
  'heading6', 'heading7', 'heading8', 'heading9', 'bullet', 'ordered', 'code', 'quote', 'todo',
];

function invalidInput(message) {
  return Object.assign(new Error(message), { code: 'INVALID_ARGS' });
}

function documentResult(id, revisionId) {
  return { id, type: 'docx', ...(Number.isSafeInteger(revisionId) ? { revisionId } : {}) };
}

export async function createCloudDocument({ request, name, folderId }) {
  const { document } = await request({
    path: DOCUMENTS,
    method: 'POST',
    body: { title: name, ...(folderId ? { folder_token: folderId } : {}) },
  });
  if (typeof document?.document_id !== 'string' || !document.document_id) {
    throw new FeishuApiError('创建响应未返回文档 ID，请在飞书确认结果后再重试');
  }
  return { ...documentResult(document.document_id, document.revision_id), name: document.title ?? name };
}

export function validateCloudDocumentText(text, { markdown = false } = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_LENGTH || text.includes('\0')) {
    throw invalidInput(`text 必须是非空${markdown ? ' Markdown ' : '纯'}文本，最多 ${MAX_TEXT_LENGTH} 字符`);
  }
  if (markdown) return text;
  const lines = text.split(/\r\n|[\r\n]/);
  if (lines.length > MAX_APPEND_BLOCKS) {
    throw invalidInput(`一次最多追加 ${MAX_APPEND_BLOCKS} 行正文，请分次调用`);
  }
  return lines;
}

const MAX_DESCENDANT_TOP_LEVEL = 50;
const MAX_DESCENDANT_BLOCKS = 1000;

function sanitizeConvertedBlocks(blocks) {
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    if (block.table?.property && Object.hasOwn(block.table.property, 'merge_info')) {
      const { merge_info: _ignored, ...restProp } = block.table.property;
      return { ...block, table: { ...block.table, property: restProp } };
    }
    return block;
  });
}

/** 将 convert 返回的块树按一级块分批，确保每批满足一级块 <= 50 且子树总块数 <= 1000。 */
function batchConvertedSubtrees(firstLevelIds, blocks) {
  const byId = new Map();
  for (const block of blocks) {
    if (typeof block?.block_id === 'string' && block.block_id) byId.set(block.block_id, block);
  }
  const collectSubtree = (rootId) => {
    const collected = [];
    const visited = new Set();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      const block = byId.get(current);
      if (!block) continue;
      collected.push(block);
      if (Array.isArray(block.children)) {
        for (let i = block.children.length - 1; i >= 0; i -= 1) stack.push(block.children[i]);
      }
    }
    return collected;
  };

  const batches = [];
  let batchIds = [];
  let batchBlocks = [];
  for (const rootId of firstLevelIds) {
    const subtree = collectSubtree(rootId);
    if (!subtree.length) continue;
    if (subtree.length > MAX_DESCENDANT_BLOCKS) {
      throw invalidInput(`单个顶层 Markdown 块（如超大表格）包含 ${subtree.length} 个子块，超过飞书单次 ${MAX_DESCENDANT_BLOCKS} 块上限，请拆分后写入`);
    }
    if (batchIds.length > 0 && (batchIds.length >= MAX_DESCENDANT_TOP_LEVEL || batchBlocks.length + subtree.length > MAX_DESCENDANT_BLOCKS)) {
      batches.push({ childrenIds: batchIds, descendants: batchBlocks });
      batchIds = [];
      batchBlocks = [];
    }
    batchIds.push(rootId);
    batchBlocks.push(...subtree);
  }
  if (batchIds.length > 0) batches.push({ childrenIds: batchIds, descendants: batchBlocks });
  return batches;
}

/** 通过飞书 Docx convert + descendant 接口分批写入 Markdown 结构化内容（标题/列表/代码块/表格）。 */
export async function appendCloudDocumentMarkdown({ request, id, text }) {
  validateCloudDocumentText(text, { markdown: true });
  let converted;
  try {
    converted = await request({
      path: `${DOCUMENTS}/blocks/convert`,
      method: 'POST',
      body: { content_type: 'markdown', content: text },
    });
  } catch (error) {
    if ([99991672, 99991679].includes(error?.feishuCode)) {
      throw new FeishuApiError(
        `Markdown 结构化写入需要 docx:document.block:convert 权限。请在飞书应用开通后到「状态 → 分身状态 → 重新授权」扫码，或先改用 format: "plain"（code ${error.feishuCode}）`,
        error.details,
      );
    }
    throw error;
  }
  const firstLevelIds = Array.isArray(converted?.first_level_block_ids) ? converted.first_level_block_ids : [];
  const blocks = Array.isArray(converted?.blocks) ? sanitizeConvertedBlocks(converted.blocks) : [];
  if (!firstLevelIds.length || !blocks.length) {
    throw new FeishuApiError('飞书 Markdown 转换未返回有效文档块，请检查内容格式');
  }
  const batches = batchConvertedSubtrees(firstLevelIds, blocks);
  if (!batches.length) {
    throw new FeishuApiError('飞书 Markdown 转换结果缺少匹配的块定义');
  }

  const token = encodeURIComponent(id);
  let latestRevision;
  let totalAdded = 0;
  for (const batch of batches) {
    const result = await request({
      path: `${DOCUMENTS}/${token}/blocks/${token}/descendant`,
      method: 'POST',
      query: { document_revision_id: -1, client_token: randomUUID() },
      body: {
        index: -1,
        children_id: batch.childrenIds,
        descendants: batch.descendants,
      },
    });
    if (Number.isSafeInteger(result?.document_revision_id)) latestRevision = result.document_revision_id;
    totalAdded += Array.isArray(result?.children) ? result.children.length : batch.childrenIds.length;
  }
  return { ...documentResult(id, latestRevision), blocksAdded: totalAdded };
}

export async function appendCloudDocument({ request, id, text }) {
  const lines = validateCloudDocumentText(text);
  const token = encodeURIComponent(id);
  // New text is appended to the current root. A single request avoids partial
  // multi-batch writes and the client token identifies that exact request.
  const children = lines.map((line) => ({
    block_type: 2,
    text: { elements: (line.match(/.{1,1000}/gsu) ?? []).map((content) => ({ text_run: { content } })) },
  }));
  const result = await request({
    path: `${DOCUMENTS}/${token}/blocks/${token}/children`,
    method: 'POST',
    query: { document_revision_id: -1, client_token: randomUUID() },
    body: { index: -1, children },
  });
  if (!Array.isArray(result.children) || result.children.length !== children.length) {
    throw new FeishuApiError('追加响应未确认所有正文块，请先检查文档再重试');
  }
  return { ...documentResult(id, result.document_revision_id), blocksAdded: result.children.length };
}

function locateMatch(items, match, find) {
  for (const block of items) {
    const elements = TEXT_FIELDS.map((key) => block?.[key]?.elements).find(Array.isArray);
    if (!elements) continue;
    // Keep adjacent runs searchable, but do not bridge mentions, equations or
    // other inline objects when looking for a plain text occurrence.
    const runs = elements.map((item) => typeof item?.text_run?.content === 'string' ? item.text_run.content : '\0');
    const content = runs.join('');
    let start = content.indexOf(find);
    if (start === -1) continue;
    if (match || content.indexOf(find, start + 1) !== -1) {
      throw invalidInput('find 在文档中出现多次，请提供能唯一定位的原文');
    }
    const runIndex = runs.findIndex((run) => {
      if (start < run.length) return true;
      start -= run.length;
      return false;
    });
    match = { blockId: block.block_id, elements, runIndex, start };
  }
  return match;
}

export function validateDocumentReplacement(find, text) {
  if (typeof find !== 'string' || !find.trim() || find.length > MAX_TEXT_LENGTH || find.includes('\0')) {
    throw invalidInput(`find 必须是可唯一定位的非空原文，最多 ${MAX_TEXT_LENGTH} 字符`);
  }
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH || text.includes('\0')) {
    throw invalidInput(`text 必须是替换后的纯文本，最多 ${MAX_TEXT_LENGTH} 字符，可为空以移除匹配内容`);
  }
}

export async function editCloudDocument({ request, id, find, text }) {
  validateDocumentReplacement(find, text);

  const path = `${DOCUMENTS}/${encodeURIComponent(id)}`;
  const { document } = await request({ path });
  const revisionId = document?.revision_id;
  if (!Number.isSafeInteger(revisionId) || revisionId < 1) {
    throw new FeishuApiError('飞书未返回可用于编辑的文档版本号');
  }

  let match = null;
  let pageToken;
  const seen = new Set();
  do {
    const result = await request({
      path: `${path}/blocks`,
      query: { document_revision_id: revisionId, page_size: 500, page_token: pageToken },
    });
    if (!Array.isArray(result.items)) throw new FeishuApiError('飞书未返回可用于编辑的文档块');
    match = locateMatch(result.items, match, find);
    pageToken = result.has_more === true ? result.page_token : undefined;
    if (result.has_more === true) {
      if (typeof pageToken !== 'string' || !pageToken || seen.has(pageToken)) {
        throw new FeishuApiError('读取文档块时未返回有效的下一页游标');
      }
      seen.add(pageToken);
    }
  } while (pageToken);

  if (!match) throw invalidInput('文档中没有匹配的纯文本，请核对 find');
  const { blockId, elements, runIndex, start } = match;
  const run = elements[runIndex]?.text_run;
  if (typeof blockId !== 'string' || !blockId || typeof run?.content !== 'string' || start + find.length > run.content.length) {
    throw invalidInput('匹配跨越多个格式片段，无法保留原格式，请缩小 find');
  }
  const replacement = run.content.slice(0, start) + text + run.content.slice(start + find.length);
  const updated = [...elements];
  if (replacement) updated[runIndex] = { ...elements[runIndex], text_run: { ...run, content: replacement } };
  else updated.splice(runIndex, 1);
  if (updated.length === 0) updated.push({ text_run: { content: '' } });

  // Every read and the final patch use the same explicit revision. Use the
  // provider's conflict error if another collaborator edited the document.
  const result = await request({
    path: `${path}/blocks/${encodeURIComponent(blockId)}`,
    method: 'PATCH',
    query: { document_revision_id: revisionId, client_token: randomUUID() },
    body: { update_text_elements: { elements: updated } },
  });
  if (result.block?.block_id !== blockId) throw new FeishuApiError('编辑响应未确认目标正文块，请先检查文档再重试');
  return { ...documentResult(id, result.document_revision_id), blockId };
}
