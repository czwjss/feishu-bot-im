import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocReadTool, createDocWriteTool } from '../src/user-identity/doc-tools.js';

const auth = { async requireAccessToken() { return 'user-token'; } };
const response = (data, code = 0) => ({ ok: true, status: 200, json: async () => ({ code, data }) });

test('doc_read lists Wiki spaces/nodes and opens child nodes and document text directly', async () => {
  const wikiSpace = '/open-apis/wiki/v2/spaces';
  const spaceId = '7160145948494381236';
  const page = { node_token: 'wik_parent', obj_token: 'doc_parent', obj_type: 'docx', title: '项目首页', space_id: spaceId, has_child: true };
  const child = { node_token: 'wik_child', obj_token: 'doc_legacy', obj_type: 'doc', title: '历史说明', space_id: spaceId, has_child: false };
  const readTool = createDocReadTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.authorization, 'Bearer user-token');
    const params = Object.fromEntries(url.searchParams);
    if (url.pathname === wikiSpace) {
      if (params.page_token === 'spaces-next') return response({ items: [], has_more: false });
      assert.deepEqual(params, { page_size: '5' });
      return response({ items: [{ space_id: spaceId, name: '团队知识库' }], has_more: true, page_token: 'spaces-next' });
    }
    if (url.pathname === `${wikiSpace}/${spaceId}/nodes`) {
      assert.equal(params.page_size, '20');
      if (!params.parent_node_token) return response({ items: [page], has_more: false });
      assert.equal(params.parent_node_token, page.node_token);
      if (!params.page_token) return response({ items: [], has_more: true, page_token: 'children-next' });
      assert.equal(params.page_token, 'children-next');
      return response({ items: [child], has_more: false });
    }
    if (url.pathname === `${wikiSpace}/node_by_token`) {
      assert.ok([page.node_token, child.node_token].includes(params.token));
      return response({ node: params.token === page.node_token ? page : child });
    }
    if (url.pathname === `/open-apis/docx/v1/documents/${page.obj_token}/raw_content`) return response({ content: '首页正文' });
    if (url.pathname === `/open-apis/doc/v2/${child.obj_token}/raw_content`) return response({ content: '旧版正文' });
    assert.fail(`unexpected ${url}`);
  } });

  const wiki = { action: 'list', target: 'wiki', limit: 5 };
  const spaces = await readTool.execute(wiki);
  assert.equal(spaces.items[0].target, `wiki_space:${spaceId}`);
  assert.equal(spaces.hasMore, true);
  assert.equal((await readTool.execute({ ...wiki, pageToken: spaces.pageToken })).hasMore, false);
  const nodes = await readTool.execute({ action: 'list', target: spaces.items[0].target });
  assert.deepEqual(nodes, await readTool.execute({ action: 'list', target: `https://example.feishu.cn/wiki/space/${spaceId}` }));
  assert.deepEqual(nodes.items[0], {
    id: 'wik_parent', type: 'wiki', name: '项目首页', url: '', target: 'wiki:wik_parent', hasChildren: true, objectType: 'docx',
  });
  const nodeList = { action: 'list', target: nodes.items[0].target };
  const emptyPage = await readTool.execute(nodeList);
  assert.deepEqual(emptyPage.items, []);
  assert.equal(emptyPage.hasMore, true, 'an empty filtered Wiki page can still have children on the next page');
  const children = await readTool.execute({ ...nodeList, pageToken: emptyPage.pageToken });
  assert.equal(children.items[0].hasChildren, false);
  const rootText = await readTool.execute({ action: 'read', target: 'https://example.feishu.cn/wiki/wik_parent' });
  assert.deepEqual(rootText, { action: 'read', id: page.obj_token, type: 'docx', text: '首页正文', hasMore: false, pageToken: '' });
  const childText = await readTool.execute({ action: 'read', target: children.items[0].target });
  assert.deepEqual(childText, { action: 'read', id: child.obj_token, type: 'doc', text: '旧版正文', hasMore: false, pageToken: '' });
});

test('Wiki permissions are separate from access to the target and unsupported nodes do not fetch a document body', async () => {
  const fetchImpl = async (url) => {
    if (url.pathname === '/open-apis/wiki/v2/spaces') return response({}, 99991679);
    assert.equal(url.pathname, '/open-apis/wiki/v2/spaces/node_by_token');
    const nodeId = url.searchParams.get('token');
    if (nodeId === 'denied') return response({}, 131006);
    const objectType = nodeId === 'legacy' ? 'doc' : 'sheet';
    return response({ node: { node_token: nodeId, obj_token: 'backing_123', obj_type: objectType, space_id: '1234567890' } });
  };
  const readTool = createDocReadTool({ auth, fetchImpl });
  const writeTool = createDocWriteTool({ auth, fetchImpl });
  await assert.rejects(readTool.execute({ action: 'list', target: 'wiki' }), { feishuCode: 99991679, message: /wiki:space:retrieve.*重新授权/ });
  await assert.rejects(readTool.execute({ action: 'list', target: 'wiki:denied' }), { feishuCode: 131006 });
  await assert.rejects(readTool.execute({ action: 'read', target: 'wiki:spreadsheet' }), /sheet/);
  await assert.rejects(writeTool.execute({ action: 'append', target: 'wiki:legacy', text: '补充说明' }), /DOCX|docx|新版/);
  await assert.rejects(writeTool.execute({ action: 'edit', target: 'wiki:spreadsheet', find: '原文', text: '新内容' }), /DOCX|docx|新版/);
});

test('doc_write append and edit on Wiki nodes use backing DOCX ID and preserve formatting', async () => {
  const calls = [];
  const document = '/open-apis/docx/v1/documents/docx_backing';
  const node = '/open-apis/wiki/v2/spaces/node_by_token';
  const writeTool = createDocWriteTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(request.headers.authorization, 'Bearer user-token');
    calls.push([request.method, url.pathname]);
    if (url.pathname === node) {
      assert.equal(url.searchParams.get('token'), 'wik_plan');
      return response({ node: { node_token: 'wik_plan', obj_token: 'docx_backing', obj_type: 'docx', space_id: '1234567890' } });
    }
    if (url.pathname === `${document}/blocks/docx_backing/children`) {
      const { children } = JSON.parse(request.body);
      assert.equal(children[0].text.elements[0].text_run.content, '补充说明');
      return response({ children, document_revision_id: 7 });
    }
    if (url.pathname === document) return response({ document: { revision_id: 7 } });
    assert.equal(url.searchParams.get('document_revision_id'), '7');
    if (url.pathname === `${document}/blocks`) {
      return response({ items: [{ block_id: 'block_1', text: { elements: [
        { text_run: { content: '发布时间：周一', text_element_style: { bold: true } } },
      ] } }] });
    }
    assert.equal(url.pathname, `${document}/blocks/block_1`);
    assert.deepEqual(JSON.parse(request.body), { update_text_elements: { elements: [
      { text_run: { content: '发布时间：周二', text_element_style: { bold: true } } },
    ] } });
    return response({ block: { block_id: 'block_1' }, document_revision_id: 8 });
  } });

  const appended = await writeTool.execute({ action: 'append', target: 'https://example.feishu.cn/wiki/wik_plan', text: '补充说明' });
  const edited = await writeTool.execute({ action: 'edit', target: 'wiki:wik_plan', find: '周一', text: '周二' });
  assert.equal(appended.id, 'docx_backing');
  assert.equal(appended.blocksAdded, 1);
  assert.equal(edited.id, 'docx_backing');
  assert.equal(edited.revisionId, 8);
  assert.deepEqual(calls, [
    ['GET', node], ['POST', `${document}/blocks/docx_backing/children`],
    ['GET', node], ['GET', document], ['GET', `${document}/blocks`], ['PATCH', `${document}/blocks/block_1`],
  ]);
});

test('doc_write rename uses Wiki node token directly and preserves full HTML file name', async () => {
  const requests = [];
  const writeTool = createDocWriteTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(request.headers.authorization, 'Bearer user-token');
    assert.equal(request.method, 'PATCH');
    requests.push([url.pathname, Object.fromEntries(url.searchParams), JSON.parse(request.body)]);
    return url.pathname.endsWith('/wik_no_access') ? response({}, 981004) : response({});
  } });
  const action = 'rename';
  assert.deepEqual(await writeTool.execute({ action, target: 'https://example.feishu.cn/wiki/wik_tech', name: ' 技术文档.html ' }), {
    action, id: 'wik_tech', type: 'wiki', name: '技术文档.html', status: 'completed',
  });
  assert.deepEqual(await writeTool.execute({ action, target: 'wiki:wik_review', name: 'Review.html' }), {
    action, id: 'wik_review', type: 'wiki', name: 'Review.html', status: 'completed',
  });
  await assert.rejects(writeTool.execute({ action, target: 'wiki:wik_no_access', name: '草稿.html' }), { feishuCode: 981004 });
  assert.deepEqual(requests, [
    ['/open-apis/drive/v1/files/wik_tech', { type: 'wiki' }, { new_title: '技术文档.html' }],
    ['/open-apis/drive/v1/files/wik_review', { type: 'wiki' }, { new_title: 'Review.html' }],
    ['/open-apis/drive/v1/files/wik_no_access', { type: 'wiki' }, { new_title: '草稿.html' }],
  ]);
});

test('doc_write Wiki delete preserves children by default and tracks cascade deletion via prefixed taskId', async () => {
  const spaceId = '7160145948494381236';
  const taskId = 'delete_123';
  const failedTaskId = 'delete_failed';
  const calls = [];
  const deleteOptions = new Map([['wik_shortcut', false], ['wik_parent', true]]);
  let checks = 0;
  const writeTool = createDocWriteTool({
    auth,
    taskPollAttempts: 0,
    fetchImpl: async (url, request) => {
      assert.equal(request.headers.authorization, 'Bearer user-token');
      const query = Object.fromEntries(url.searchParams);
      const body = request.body && JSON.parse(request.body);
      calls.push([request.method, url.pathname]);
      if (request.method === 'DELETE') {
        const nodeId = url.pathname.split('/').at(-1);
        assert.ok(deleteOptions.has(nodeId));
        assert.equal(url.pathname, `/open-apis/wiki/v2/spaces/${spaceId}/nodes/${nodeId}`);
        assert.deepEqual(query, {});
        assert.deepEqual(body, { obj_type: 'wiki', include_children: deleteOptions.get(nodeId) });
        return response({ task_id: body.include_children ? taskId : '' });
      }
      assert.equal(request.method, 'GET');
      if (url.pathname.endsWith('/node_by_token')) {
        const nodeId = query.token;
        assert.ok(deleteOptions.has(nodeId));
        return response({ node: { node_token: nodeId, obj_token: 'sheet_backing', obj_type: 'sheet', space_id: spaceId } });
      }
      const polledTask = url.pathname.split('/').at(-1);
      assert.ok([taskId, failedTaskId].includes(polledTask));
      assert.equal(url.pathname, `/open-apis/wiki/v2/tasks/${polledTask}`);
      assert.deepEqual(query, { task_type: 'delete_node' });
      const status = polledTask === failedTaskId ? 'failure' : ['processing', 'success'][checks++];
      return response({ task: { simple_task_result: { status } } });
    },
  });

  const args = { action: 'delete', confirm: true };
  const deleted = { action: 'delete', type: 'wiki', spaceId };
  assert.deepEqual(await writeTool.execute({ ...args, target: 'https://example.feishu.cn/wiki/wik_shortcut' }), {
    ...deleted, id: 'wik_shortcut', status: 'completed', includeChildren: false,
  });
  const pending = await writeTool.execute({ ...args, target: 'wiki:wik_parent', includeChildren: true });
  assert.deepEqual(pending, { ...deleted, id: 'wik_parent', status: 'pending', includeChildren: true, taskId: `wiki:${taskId}` });

  const task = { action: 'task', taskId: pending.taskId };
  assert.deepEqual(await writeTool.execute(task), { ...task, status: 'pending' });
  assert.deepEqual(await writeTool.execute(task), { ...task, status: 'completed' });
  const failedTask = { ...task, taskId: `wiki:${failedTaskId}` };
  assert.deepEqual(await writeTool.execute(failedTask), { ...failedTask, status: 'failed', message: '飞书报告 Wiki 删除任务失败，请核对页面状态' });
  assert.deepEqual(calls.map(([method]) => method), ['GET', 'DELETE', 'GET', 'DELETE', 'GET', 'GET', 'GET']);
});

test('doc_write Wiki delete rejects mismatched node and reports scope and approval errors', async () => {
  const writeTool = createDocWriteTool({ auth, fetchImpl: async (url, request) => {
    if (url.pathname.endsWith('/node_by_token')) {
      const token = url.searchParams.get('token');
      return response({ node: { node_token: token === 'mismatch' ? 'different' : token, obj_token: 'docx_1', obj_type: 'docx', space_id: '1234567890' } });
    }
    assert.equal(request.method, 'DELETE');
    if (url.pathname.endsWith('/no_scope')) return response({}, 99991672);
    if (url.pathname.endsWith('/approval')) return response({}, 131011);
    assert.fail(`unexpected request to ${url.pathname}`);
  } });
  const remove = (node) => writeTool.execute({ action: 'delete', target: `wiki:${node}`, confirm: true });
  await assert.rejects(remove('mismatch'), /节点与请求的节点不一致/);
  await assert.rejects(remove('no_scope'), { feishuCode: 99991672, message: /wiki:node:create.*重新授权/ });
  await assert.rejects(remove('approval'), { feishuCode: 131011, message: /在飞书知识库页面中申请删除/ });
});

test('doc tools reject invalid Wiki targets and arguments before authorization', async () => {
  const deniedAuth = { requireAccessToken() { assert.fail('invalid input reached auth'); } };
  const readTool = createDocReadTool({ auth: deniedAuth });
  const writeTool = createDocWriteTool({ auth: deniedAuth });
  for (const [tool, args, detail] of [
    [readTool, { action: 'list', target: 'wiki_space:not_numeric' }, /知识空间 ID 必须为数字/],
    [readTool, { action: 'inspect', target: 'wiki_space:123' }, /target/],
    [writeTool, { action: 'rename', target: 'wiki:wik_plan' }, /name/],
    [writeTool, { action: 'rename', target: 'wiki:wik_plan', name: '   ' }, /name/],
    [writeTool, { action: 'rename', target: 'wiki_space:123', name: '新版文档' }, /target/],
    [writeTool, { action: 'delete', target: 'wiki:wik_plan' }, /confirm/],
    [writeTool, { action: 'delete', target: 'wiki:wik_plan', confirm: false }, /confirm/],
    [writeTool, { action: 'delete', target: 'wiki_space:123', confirm: true }, /target/],
    [writeTool, { action: 'task', taskId: '..' }, /taskId/],
    [writeTool, { action: 'append', target: 'wiki:wik_plan', text: '补充', parent: 'wiki:other' }, /不接受 parent/],
  ]) await assert.rejects(tool.execute(args), detail);
});
