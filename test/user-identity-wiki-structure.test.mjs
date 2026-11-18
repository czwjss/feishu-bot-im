import assert from 'node:assert/strict';
import test from 'node:test';

import { createWikiNode, moveWikiNode, resolveWikiNode } from '../src/user-identity/cloud-wiki.js';

const SPACES = '/open-apis/wiki/v2/spaces';
const LOOKUP = `${SPACES}/node_by_token`;

test('resolves Wiki attachment details using the node token and preserves the underlying file ID', async () => {
  const request = async (options) => {
    assert.deepEqual(options, { path: LOOKUP, query: { token: 'wik_html' } });
    return { node: {
      node_token: 'wik_html', obj_token: 'file_html', obj_type: 'file', space_id: '123',
      title: 'Review.html', parent_node_token: 'wik_parent', node_type: 'origin', has_child: false,
      url: 'https://example.feishu.cn/wiki/wik_html',
    } };
  };
  assert.deepEqual(await resolveWikiNode({ request, nodeId: 'wik_html' }), {
    id: 'wik_html', type: 'wiki', objectId: 'file_html', objectType: 'file', spaceId: '123',
    name: 'Review.html', parentNodeId: 'wik_parent', nodeType: 'origin', hasChildren: false,
    url: 'https://example.feishu.cn/wiki/wik_html', target: 'wiki:wik_html',
  });
});

test('creates a new Docx inside a Wiki page or directly in a knowledge space', async () => {
  const requests = [];
  const request = async (options) => {
    requests.push(options);
    if (options.path === LOOKUP) {
      return { node: { node_token: 'wik_parent', obj_token: 'doc_parent', obj_type: 'docx', space_id: '123' } };
    }
    return { node: {
      node_token: 'wik_new', obj_token: 'doc_new', obj_type: 'docx', space_id: '123',
      parent_node_token: options.body.parent_node_token, title: options.body.title,
    } };
  };
  const created = await createWikiNode({ request, parent: { type: 'wiki', id: 'wik_parent' }, name: '技术文档' });
  assert.equal(created.target, 'wiki:wik_new');
  assert.equal(created.objectId, 'doc_new');
  assert.equal(created.parentNodeId, 'wik_parent');
  assert.equal(created.status, 'completed');

  const root = await createWikiNode({ request, parent: { type: 'wiki_space', id: '123' }, name: '根目录文档' });
  assert.equal(root.parentNodeId, '');
  assert.deepEqual(requests, [
    { path: LOOKUP, query: { token: 'wik_parent' } },
    { path: `${SPACES}/123/nodes`, method: 'POST', body: {
      obj_type: 'docx', node_type: 'origin', title: '技术文档', parent_node_token: 'wik_parent',
    } },
    { path: `${SPACES}/123/nodes`, method: 'POST', body: {
      obj_type: 'docx', node_type: 'origin', title: '根目录文档',
    } },
  ]);
});

test('moves existing Wiki pages and checks the returned location without polling', async () => {
  const requests = [];
  const request = async (options) => {
    requests.push(options);
    if (options.path === LOOKUP) {
      const id = options.query.token;
      return { node: { node_token: id, obj_token: `doc_${id}`, obj_type: 'docx', space_id: id === 'wik_source' ? '123' : '456' } };
    }
    return { node: {
      node_token: 'wik_source', obj_token: 'doc_wik_source', obj_type: 'docx', has_child: true,
      space_id: options.body.target_space_id, parent_node_token: options.body.target_parent_token,
    } };
  };
  const moved = await moveWikiNode({ request, nodeId: 'wik_source', destination: { type: 'wiki', id: 'wik_destination' } });
  assert.equal(moved.status, 'completed');
  assert.equal(moved.spaceId, '456');
  assert.equal(moved.parentNodeId, 'wik_destination');
  assert.equal(moved.hasChildren, true);
  assert.deepEqual(requests, [
    { path: LOOKUP, query: { token: 'wik_source' } },
    { path: LOOKUP, query: { token: 'wik_destination' } },
    { path: `${SPACES}/123/nodes/wik_source/move`, method: 'POST', body: {
      target_space_id: '456', target_parent_token: 'wik_destination',
    } },
  ]);

  requests.length = 0;
  const root = await moveWikiNode({ request, nodeId: 'wik_source', destination: { type: 'wiki_space', id: '456' } });
  assert.equal(root.parentNodeId, '');
  assert.deepEqual(requests, [
    { path: LOOKUP, query: { token: 'wik_source' } },
    { path: `${SPACES}/123/nodes/wik_source/move`, method: 'POST', body: { target_space_id: '456' } },
  ]);

  requests.length = 0;
  await assert.rejects(moveWikiNode({ request, nodeId: 'wik_source', destination: { type: 'wiki', id: 'wik_source' } }), /自身/);
  assert.deepEqual(requests, []);
});
