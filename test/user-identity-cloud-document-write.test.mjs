import assert from 'node:assert/strict';
import test from 'node:test';
import { appendCloudDocument, createCloudDocument, editCloudDocument, validateCloudDocumentText } from '../src/user-identity/cloud-document-write.js';

const documents = '/open-apis/docx/v1/documents';
const paragraph = (id, elements) => ({ block_id: id, block_type: 2, text: { elements } });
const textRun = (content, style) => ({ text_run: { content, ...(style ? { text_element_style: style } : {}) } });

test('create returns the document identity, and append writes one batch of plain paragraphs', async () => {
  const created = await createCloudDocument({ name: '发布计划', folderId: 'folder_1', request: async (params) => {
    assert.deepEqual(params, { path: documents, method: 'POST', body: { title: '发布计划', folder_token: 'folder_1' } });
    return { document: { document_id: 'docx_1', title: '发布计划', revision_id: 1 } };
  } });
  assert.deepEqual(created, { id: 'docx_1', type: 'docx', name: '发布计划', revisionId: 1 });
  const appended = await appendCloudDocument({ id: created.id, text: '时间\r\n\r\n内容', request: async (params) => {
    assert.equal(params.method, 'POST');
    assert.equal(params.path, `${documents}/docx_1/blocks/docx_1/children`);
    assert.equal(params.query.document_revision_id, -1);
    assert.match(params.query.client_token, /^[0-9a-f-]{36}$/);
    assert.deepEqual(params.body, { index: -1, children: [
      { block_type: 2, text: { elements: [textRun('时间')] } },
      { block_type: 2, text: { elements: [] } },
      { block_type: 2, text: { elements: [textRun('内容')] } },
    ] });
    return { children: params.body.children, document_revision_id: 2 };
  } });
  assert.deepEqual(appended, { id: 'docx_1', type: 'docx', revisionId: 2, blocksAdded: 3 });
  assert.throws(() => validateCloudDocumentText('新行\n'.repeat(50)), { code: 'INVALID_ARGS' });
});

test('edit searches one snapshot and changes only the matching run without losing its style', async () => {
  const calls = [];
  const style = { bold: true, comment_ids: ['comment_1'] };
  const mention = { mention_user: { user_id: 'ou_member' } };
  const result = await editCloudDocument({ id: 'docx_1', find: '周一', text: '周二', request: async (params) => {
    calls.push(params);
    if (params.path === `${documents}/docx_1`) return { document: { revision_id: 14 } };
    assert.equal(params.query.document_revision_id, 14);
    if (params.method === 'PATCH') {
      assert.equal(params.path, `${documents}/docx_1/blocks/block_2`);
      assert.deepEqual(params.body, { update_text_elements: {
        elements: [textRun('修改者 '), mention, textRun('发布日期：周二', style)],
      } });
      return { block: { block_id: 'block_2' }, document_revision_id: 15 };
    }
    if (!params.query.page_token) return { items: [paragraph('block_1', [textRun('发布日期')])], has_more: true, page_token: 'next' };
    assert.equal(params.query.page_token, 'next');
    return { items: [paragraph('block_2', [textRun('修改者 '), mention, textRun('发布日期：周一', style)])], has_more: false };
  } });
  assert.equal(calls.length, 4);
  assert.deepEqual(result, { id: 'docx_1', type: 'docx', revisionId: 15, blockId: 'block_2' });
});

test('edit rejects ambiguous and cross-format matches without sending a patch', async () => {
  for (const [items, expectation] of [
    [[paragraph('block_1', [textRun('周一或周一')])], /出现多次/],
    [[paragraph('block_1', [textRun('周'), textRun('一', { bold: true })])], /跨越多个格式片段/],
  ]) {
    await assert.rejects(editCloudDocument({ id: 'docx_1', find: '周一', text: '', request: async (params) => {
      assert.equal(params.method, undefined);
      return params.path.endsWith('/blocks') ? { items } : { document: { revision_id: 9 } };
    } }), expectation);
  }
});
