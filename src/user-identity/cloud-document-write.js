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

export function validateCloudDocumentText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_LENGTH || text.includes('\0')) {
    throw invalidInput(`text 必须是非空纯文本，最多 ${MAX_TEXT_LENGTH} 字符`);
  }
  const lines = text.split(/\r\n|[\r\n]/);
  if (lines.length > MAX_APPEND_BLOCKS) {
    throw invalidInput(`一次最多追加 ${MAX_APPEND_BLOCKS} 行正文，请分次调用`);
  }
  return lines;
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
