import { createHash } from 'node:crypto';
import { FeishuApiError } from './errors.js';

const TEXT_PAGE_SIZE = 8_000;

function invalidPage(message) {
  return Object.assign(new Error(message), { code: 'INVALID_ARGS' });
}

export function parseDocumentCursor(pageToken) {
  if (!pageToken) return null;
  const cursor = /^(\d{1,10})\.([0-9a-f]{32})$/.exec(pageToken);
  if (!cursor || Number(cursor[1]) < 1) throw invalidPage('请使用 read 返回的 pageToken');
  return { offset: Number(cursor[1]), version: cursor[2] };
}

export async function readDocument(request, { id, type }, cursor) {
  const path = type === 'doc'
    ? `/open-apis/doc/v2/${id}/raw_content`
    : `/open-apis/docx/v1/documents/${id}/raw_content`;
  const { content } = await request({ path });
  if (typeof content !== 'string') throw new FeishuApiError('飞书未返回文档正文');

  // Bind local cursors to the document and its content for consistent paging.
  const version = createHash('sha256').update(`${type}:${id}\0`).update(content).digest('hex').slice(0, 32);
  const start = cursor?.offset ?? 0;
  if (cursor && (cursor.version !== version || start >= content.length)) {
    throw invalidPage('文档或正文已变化，请去掉 pageToken 从头读取');
  }
  let end = Math.min(start + TEXT_PAGE_SIZE, content.length);
  if (end < content.length && /[\uD800-\uDBFF]/u.test(content[end - 1])) end -= 1;
  const hasMore = end < content.length;
  return { id, type, text: content.slice(start, end), hasMore, pageToken: hasMore ? `${end}.${version}` : '' };
}
