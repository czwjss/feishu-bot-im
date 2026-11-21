import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDocFileTool, createDocReadTool, createDocWriteTool } from '../src/user-identity/doc-tools.js';

const auth = { async requireAccessToken() { return 'user-token'; } };
const response = (data) => Response.json({ code: 0, data });
const spaces = '/open-apis/wiki/v2/spaces';
const sourceSpace = '7160145948494381236';
const destinationSpace = '7160145948494381237';

function wikiNode(nodeId, docId, fields) {
  return {
    node_token: nodeId, obj_token: docId, obj_type: 'docx', node_type: 'origin', space_id: sourceSpace,
    ...fields,
  };
}

test('doc_read & doc_write inspect, create with parent, and move Wiki pages using distinct node/doc IDs', async () => {
  const parent = wikiNode('wik_parent', 'docx_parent', {
    title: '设计资料', parent_node_token: 'wik_root', has_child: true,
    url: 'https://example.feishu.cn/wiki/wik_parent',
  });
  const page = wikiNode('wik_new', 'docx_new', { parent_node_token: parent.node_token, title: '发布说明' });
  const destination = wikiNode('wik_archive', 'docx_archive', { space_id: destinationSpace });
  const nodes = new Map([parent, page, destination].map((node) => [node.node_token, node]));
  const fetchImpl = async (url, request) => {
    assert.equal(request.headers.authorization, 'Bearer user-token');
    if (url.pathname === `${spaces}/node_by_token`) {
      assert.equal(request.method, 'GET');
      const node = nodes.get(url.searchParams.get('token'));
      assert.ok(node, 'Wiki lookups use node tokens');
      return response({ node });
    }

    assert.equal(request.method, 'POST');
    const body = JSON.parse(request.body);
    if (url.pathname === `${spaces}/${sourceSpace}/nodes`) {
      assert.deepEqual(body, {
        obj_type: 'docx', node_type: 'origin', parent_node_token: parent.node_token, title: page.title,
      });
      return response({ node: page });
    }
    if (url.pathname === '/open-apis/docx/v1/documents/docx_new/blocks/docx_new/children') {
      assert.equal(body.children[0].text.elements[0].text_run.content, '上线步骤');
      return response({ children: body.children, document_revision_id: 2 });
    }
    assert.equal(url.pathname, `${spaces}/${sourceSpace}/nodes/${page.node_token}/move`);
    assert.deepEqual(body, { target_space_id: destinationSpace, target_parent_token: destination.node_token });
    return response({ node: { ...page, space_id: destinationSpace, parent_node_token: destination.node_token } });
  };
  const readTool = createDocReadTool({ auth, fetchImpl });
  const writeTool = createDocWriteTool({ auth, fetchImpl });

  const inspected = await readTool.execute({ action: 'inspect', target: parent.url });
  assert.equal(inspected.id, parent.node_token);
  assert.equal(inspected.objectId, parent.obj_token);
  assert.equal(inspected.objectType, 'docx');
  assert.equal(inspected.nodeType, 'origin');
  assert.equal(inspected.parentNodeId, 'wik_root');
  assert.equal(inspected.name, parent.title);

  const created = await writeTool.execute({ action: 'create', parent: inspected.target, name: page.title, text: '上线步骤' });
  assert.equal(created.id, page.node_token);
  assert.equal(created.objectId, page.obj_token);
  assert.equal(created.parentNodeId, parent.node_token);
  assert.equal(created.blocksAdded, 1);
  assert.equal(created.revisionId, 2);
  assert.equal(created.status, 'completed');

  const moved = await writeTool.execute({ action: 'move', target: created.target, parent: `wiki:${destination.node_token}` });
  assert.equal(moved.id, page.node_token);
  assert.equal(moved.spaceId, destinationSpace);
  assert.equal(moved.parentNodeId, destination.node_token);
  assert.equal(moved.status, 'completed');
});

test('doc_file uses parent node for Wiki upload and backing file for download and replacement', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-wiki-workflow-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const content = '<h1>新版设计资料</h1>';
  const path = 'local.html';
  await writeFile(join(cwd, path), content);
  const context = { agent: { session: { cwd } } };
  const file = wikiNode('wik_file', 'box_original', { obj_type: 'file', parent_node_token: 'wik_parent', title: '资料.html' });
  const shortcut = { ...file, node_token: 'wik_shortcut', node_type: 'shortcut' };
  const uploads = [];
  const fileTool = createDocFileTool({ auth, fetchImpl: async (url, request) => {
    assert.equal(request.headers.authorization, 'Bearer user-token');
    if (url.pathname === `${spaces}/node_by_token`) {
      const id = url.searchParams.get('token');
      assert.ok([file.node_token, shortcut.node_token].includes(id));
      return response({ node: id === shortcut.node_token ? shortcut : file });
    }
    if (url.pathname === `/open-apis/drive/v1/files/${file.obj_token}/download`) {
      assert.equal(request.method, 'GET');
      return new Response(content, { headers: { 'content-type': 'application/octet-stream' } });
    }
    assert.equal(url.pathname, '/open-apis/drive/v1/files/upload_all');
    assert.equal(request.method, 'POST');
    const form = request.body;
    assert.equal(form.get('parent_type'), 'wiki');
    assert.equal(form.get('parent_node'), 'wik_parent');
    assert.equal(await form.get('file').text(), content);
    const fileToken = form.get('file_token');
    uploads.push([fileToken, form.get('file_name')]);
    return response({ file_token: fileToken ?? 'box_uploaded' });
  } });

  const uploaded = await fileTool.execute({ action: 'upload', parent: 'wiki:wik_parent', path, name: '新附件.html' }, context);
  assert.equal(uploaded.id, 'box_uploaded');
  assert.equal(uploaded.type, 'file');

  const target = `wiki:${file.node_token}`;
  const replaced = await fileTool.execute({ action: 'replace', target, path }, context);
  assert.equal(replaced.id, file.node_token);
  assert.equal(replaced.objectId, file.obj_token);
  assert.equal(replaced.target, target);
  assert.equal(replaced.name, file.title);
  await assert.rejects(fileTool.execute({ action: 'replace', target: 'wiki:wik_shortcut', path }, context), /原始 Wiki 节点/);
  assert.deepEqual(uploads, [[null, '新附件.html'], [file.obj_token, file.title]]);

  const downloaded = await fileTool.execute({ action: 'download', target, path: 'downloaded.html' }, context);
  assert.equal(downloaded.id, file.node_token);
  assert.equal(downloaded.objectId, file.obj_token);
  assert.equal(downloaded.path, join(await realpath(cwd), 'downloaded.html'));
  assert.equal(await readFile(downloaded.path, 'utf8'), content);
});
