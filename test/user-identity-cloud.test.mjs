import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installUserIdentityContributions } from '../src/user-identity/contributions.js';
import { createCloudTool } from '../src/user-identity/cloud-tool.js';

const auth = { async requireAccessToken() { return 'user-token'; } };
const response = (data, code = 0) => ({ ok: true, status: 200, json: async () => ({ code, data }) });

test('Host-registered cloud search keeps DOCX results and returns Wiki targets for the Wiki tool', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url.href, 'https://open.feishu.cn/open-apis/search/v2/doc_wiki/search');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.authorization, 'Bearer user-token');
    const body = JSON.parse(request.body);
    assert.equal(body.query, '发布计划');
    assert.equal(body.page_size, 10);
    if (body.page_token === 'second') return response({ res_units: [], has_more: false });
    assert.equal(body.page_token, undefined);
    return response({
      res_units: [
        { title_highlighted: '<h>发布</h>计划', entity_type: 'DOC', result_meta: { doc_types: 'DOCX', token: 'doc_1', url: 'https://example.feishu.cn/docx/doc_1' } },
        { title: 'Wiki 发布计划', entity_type: 'WIKI', result_meta: { doc_types: 'DOCX', token: 'doc_wiki_plan', url: 'https://example.feishu.cn/wiki/wik_plan' } },
      ],
      has_more: true, page_token: 'second',
    });
  });
  const tools = new Map();
  installUserIdentityContributions({ inject(_services, apply) {
    apply({ tools: { register(tool) { tools.set(tool.name, tool); } } });
  } }, auth);
  const tool = tools.get('feishu_avatar_cloud');
  const input = { action: 'search', query: '发布计划' };
  const first = await tool.execute(input);
  assert.deepEqual(first, { action: 'search', items: [
    { id: 'doc_1', type: 'docx', name: '发布计划', url: 'https://example.feishu.cn/docx/doc_1' },
    { id: 'wik_plan', type: 'wiki', name: 'Wiki 发布计划', url: 'https://example.feishu.cn/wiki/wik_plan', target: 'wiki:wik_plan' },
  ], hasMore: true, pageToken: 'second' });
  assert.deepEqual(await tool.execute({ ...input, pageToken: first.pageToken }), { action: 'search', items: [], hasMore: false, pageToken: '' });
  assert.deepEqual(JSON.parse(tool.output.render(input, first)[0].text), first);
});

test('cloud list handles root and nested folders and reports missing directory scope', async () => {
  const calls = [];
  const tool = createCloudTool({ auth, fetchImpl: async (url) => {
    assert.equal(url.pathname, '/open-apis/drive/v1/files');
    const query = Object.fromEntries(url.searchParams);
    calls.push(query);
    if (query.folder_token === 'denied') return response({}, 99991679);
    if (!query.folder_token) return response({ files: [{ token: 'folder_1', type: 'folder', name: '项目', url: 'https://example.feishu.cn/drive/folder/folder_1' }] });
    if (query.page_token === 'next') return response({ files: [], has_more: false });
    return response({ files: [], has_more: true, next_page_token: 'next' });
  } });
  const root = await tool.execute({ action: 'list' });
  assert.deepEqual(root.items, [{ id: 'folder_1', type: 'folder', name: '项目', url: 'https://example.feishu.cn/drive/folder/folder_1' }]);
  const child = { action: 'list', target: root.items[0].url, limit: 5 };
  const first = await tool.execute(child);
  assert.equal(first.pageToken, 'next');
  assert.equal((await tool.execute({ ...child, pageToken: first.pageToken })).hasMore, false);
  assert.deepEqual(calls.slice(0, 3), [
    { page_size: '20' },
    { page_size: '5', folder_token: 'folder_1' },
    { page_size: '5', folder_token: 'folder_1', page_token: 'next' },
  ]);
  await assert.rejects(tool.execute({ action: 'list', target: 'denied' }), { feishuCode: 99991679, message: /space:document:retrieve|drive:drive:readonly/ });
});

test('cloud read preserves long text across pages, detects edits, and reads legacy links', async () => {
  const original = `${'甲'.repeat(7999)}📄\n下一段`;
  let content = original;
  const tool = createCloudTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.authorization, 'Bearer user-token');
    if (url.pathname === '/open-apis/doc/v2/doc_old/raw_content') return response({ content: '旧版正文' });
    assert.match(url.pathname, /^\/open-apis\/docx\/v1\/documents\/(doc_new|other)\/raw_content$/);
    return response({ content });
  } });
  const first = await tool.execute({ action: 'read', target: 'https://example.feishu.cn/docx/doc_new?from=share' });
  assert.equal(first.text.length, 7999, 'do not split an emoji across pages');
  assert.equal(first.hasMore, true);
  const second = await tool.execute({ action: 'read', target: 'doc_new', pageToken: first.pageToken });
  assert.equal(first.text + second.text, original);
  assert.equal(second.hasMore, false);
  await assert.rejects(tool.execute({ action: 'read', target: 'other', pageToken: first.pageToken }), /从头读取/);
  content += '更新';
  await assert.rejects(tool.execute({ action: 'read', target: 'doc_new', pageToken: first.pageToken }), /从头读取/);
  assert.equal((await tool.execute({ action: 'read', target: 'https://example.feishu.cn/docs/doc_old' })).text, '旧版正文');
});

test('cloud tool rejects Wiki targets, incompatible fields and arbitrary URLs before obtaining credentials', async () => {
  const tool = createCloudTool({ auth: { requireAccessToken() { assert.fail('invalid input reached auth'); } } });
  for (const [args, detail] of [
    [{ action: 'search', query: ' ' }, /query/],
    [{ action: 'search', query: '项目', target: 'folder_1' }, /不接受 target/],
    [{ action: 'list', target: 'https://example.feishu.cn/docx/not_a_folder' }, /target/],
    [{ action: 'list', target: 'wiki' }, /target|Wiki|知识库/],
    [{ action: 'list', target: 'wiki_space:7160145948494381236' }, /target|Wiki|知识库/],
    [{ action: 'read', target: 'wiki:wik_plan' }, /target|Wiki|知识库/],
    [{ action: 'read', target: 'https://example.feishu.cn/wiki/wik_plan' }, /target|Wiki|知识库/],
    [{ action: 'read', target: 'https://feishu.cn.example.com/docx/doc_1' }, /target/],
    [{ action: 'read', target: 'doc_1', pageToken: 'wrong' }, /pageToken/],
    [{ action: 'read', target: 'doc_1', limit: 1 }, /不接受 limit/],
    [{ action: 'create', name: '周报', text: '   ' }, /非空纯文本/],
    [{ action: 'edit', target: 'doc_1', find: '原文' }, /text/],
    [{ action: 'delete', target: 'doc_1' }, /target/],
    [{ action: 'delete', target: 'docx:doc_1', pageToken: 'ignored' }, /不接受 pageToken/],
    [{ action: 'move', target: 'file:abc' }, /folder/],
    [{ action: 'upload', path: 'report.txt' }, /folder/],
  ]) await assert.rejects(tool.execute(args), detail);
});

test('cloud create and append retry only the rejected request and keep the document ID when writing fails', async () => {
  const paths = [];
  const clientTokens = [];
  let accessToken = 'stale';
  const tool = createCloudTool({
    auth: { async requireAccessToken({ force } = {}) { if (force) accessToken = 'fresh'; return accessToken; } },
    fetchImpl: async (url, request) => {
      paths.push(url.pathname);
      assert.equal(request.method, 'POST');
      if (url.pathname.endsWith('/documents')) {
        assert.deepEqual(JSON.parse(request.body), { title: '周报', folder_token: 'folder_reports' });
        return response({ document: { document_id: 'doc_created', revision_id: 1, title: '周报' } });
      }
      assert.equal(url.pathname, '/open-apis/docx/v1/documents/doc_created/blocks/doc_created/children');
      clientTokens.push(url.searchParams.get('client_token'));
      if (request.headers.authorization === 'Bearer stale') return response({}, 99991668);
      throw new Error('connection closed');
    },
  });
  const result = await tool.execute({ action: 'create', name: '周报', folder: 'folder_reports', text: '正文' });
  assert.equal(result.status, 'partial');
  assert.equal(result.id, 'doc_created');
  assert.match(result.message, /正文写入未确认/);
  assert.equal(paths.filter((path) => path.endsWith('/documents')).length, 1);
  assert.equal(clientTokens.length, 2);
  assert.ok(clientTokens[0]);
  assert.equal(clientTokens[0], clientTokens[1], 'token refresh retries the same append request');
});

test('cloud upload sends the file as multipart with the current user token', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'im-feishu-drive-tool-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'report.txt'), '报告正文');
  const tool = createCloudTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(url.pathname, '/open-apis/drive/v1/files/upload_all');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.authorization, 'Bearer user-token');
    assert.equal(request.headers['content-type'], undefined, 'fetch adds the multipart boundary');
    assert.equal(request.body.get('parent_node'), 'folder_reports');
    assert.equal(await request.body.get('file').text(), '报告正文');
    return response({ file_token: 'file_report' });
  } });
  const result = await tool.execute({ action: 'upload', path: 'report.txt', folder: 'folder_reports' }, { agent: { session: { cwd } } });
  assert.equal(result.id, 'file_report');
  assert.equal(result.status, 'completed');
});
