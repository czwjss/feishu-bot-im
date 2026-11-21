import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMessageAttachmentTool } from '../src/message-image-tool.js';
import { createMessagesTool as createBotMessagesTool, createSendTool as createBotSendTool } from '../src/tool.js';
import {
  createAvatarFileDownloader,
  createMessagesTool as createAvatarMessagesTool,
  createPeopleTool as createAvatarPeopleTool,
  createRecallTool as createAvatarRecallTool,
} from '../src/user-identity/tools.js';
import { createDocFileTool, createDocReadTool, createDocWriteTool } from '../src/user-identity/doc-tools.js';
import { RuntimeManager } from '../src/runtime.js';
import { ConfigStore, StateStore } from '../src/config.js';

const response = (data, code = 0) => ({ ok: true, status: 200, json: async () => ({ code, data }) });

test('1) feishu_message_attachment 合并看图与历史文件下载，受只读沙箱与工作区约束', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'feishu-msg-attach-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const fileBytes = Buffer.from('PDF-REPORT-BYTES');
  const fileBody = JSON.stringify({ file_key: 'file_k1', file_name: '周报.pdf' });

  const avatarFetch = async (url) => {
    if (url.pathname.includes('/resources/file_k1')) {
      assert.equal(url.searchParams.get('type'), 'file');
      return new Response(fileBytes, { headers: { 'content-type': 'application/octet-stream' } });
    }
    return response({
      items: [{
        message_id: 'om_file_1',
        chat_id: 'oc_chat_1',
        msg_type: 'file',
        body: { content: fileBody },
      }],
    });
  };
  const auth = { async requireAccessToken() { return 'tok'; } };
  let sandboxMode = 'workspace-write';
  const tool = createMessageAttachmentTool({
    downloadBotFile: async ({ chatId, messageId }) => ({ chatId, fileName: '日志.log', bytes: Buffer.from('bot-log') }),
    downloadAvatarFile: createAvatarFileDownloader({ auth, fetchImpl: avatarFetch }),
    harness: { sandboxModeOf: () => sandboxMode },
  });

  // 并发安全按 action 区分：read_image 并发安全，download_file 串行
  assert.equal(tool.isConcurrencySafe({ action: 'read_image' }), true);
  assert.equal(tool.isConcurrencySafe({ action: 'download_file' }), false);

  const context = { agent: { session: { id: 's1', cwd } } };

  // 分身下载历史文件到工作区
  const avatarSaved = await tool.execute({
    action: 'download_file', identity: 'avatar', chatId: 'oc_chat_1', messageId: 'om_file_1', path: 'report.pdf',
  }, context);
  assert.equal(avatarSaved.kind, 'file');
  assert.equal(avatarSaved.fileName, '周报.pdf');
  assert.equal(avatarSaved.bytes, fileBytes.length);
  assert.equal(avatarSaved.path, join(await realpath(cwd), 'report.pdf'));
  assert.deepEqual(await readFile(avatarSaved.path), fileBytes);

  // 机器人下载历史文件到工作区
  const botSaved = await tool.execute({
    action: 'download_file', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: 'bot.log',
  }, context);
  assert.equal(botSaved.fileName, '日志.log');
  assert.equal(await readFile(botSaved.path, 'utf8'), 'bot-log');

  // 拒绝覆盖已有文件、拒绝越界路径、拒绝只读沙箱、拒绝互斥参数
  await assert.rejects(tool.execute({
    action: 'download_file', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: 'bot.log',
  }, context), /已存在/);
  await assert.rejects(tool.execute({
    action: 'download_file', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: '../escape.log',
  }, context), /工作目录/);
  await assert.rejects(tool.execute({
    action: 'download_file', identity: 'avatar', chatId: 'oc_other', messageId: 'om_file_1', path: 'wrong.pdf',
  }, context), /不属于指定会话/);
  await assert.rejects(tool.execute({
    action: 'download_file', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: 'a.log', imageIndex: 1,
  }, context), /不接受 imageIndex/);
  await assert.rejects(tool.execute({
    action: 'read_image', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: 'a.png',
  }, context), /不接受 path/);

  sandboxMode = 'read-only';
  await assert.rejects(tool.execute({
    action: 'download_file', identity: 'bot', chatId: 'oc_chat_1', messageId: 'om_file_2', path: 'blocked.log',
  }, context), /只读沙箱/);
});

test('2) 分身侧 feishu_avatar_people 与 feishu_avatar_recall', async () => {
  let memberFetches = 0;
  const members = Array.from({ length: 12 }, (_, i) => ({ member_id: `ou_${i}`, name: i === 5 ? '陈志文' : `张同事${i}` }));
  const auth = {
    async requireAccessIdentity() { return { accessToken: 'tok', openId: 'ou_self' }; },
    async requireAccessToken() { return 'tok'; },
  };
  const fetchImpl = async (url, init) => {
    if (url.pathname.endsWith('/members')) {
      memberFetches += 1;
      return response({ items: members, has_more: false });
    }
    if (init.method === 'GET' && url.pathname.includes('/messages/om_mine')) {
      return response({ items: [{ message_id: 'om_mine', chat_id: 'oc_group_1', sender: { id: 'ou_self' } }] });
    }
    if (init.method === 'GET' && url.pathname.includes('/messages/om_other')) {
      return response({ items: [{ message_id: 'om_other', chat_id: 'oc_group_1', sender: { id: 'ou_someone_else' } }] });
    }
    if (init.method === 'DELETE' && url.pathname.endsWith('/messages/om_mine')) {
      return response({});
    }
    assert.fail(`unexpected ${init.method} ${url}`);
  };

  const peopleTool = createAvatarPeopleTool({ auth, fetchImpl });
  assert.equal(peopleTool.isConcurrencySafe({}), true);
  const exact = await peopleTool.execute({ chatId: 'oc_group_1', query: '志文' });
  assert.deepEqual(exact, { chatId: 'oc_group_1', matched: 1, hasMore: false, people: [{ name: '陈志文', openId: 'ou_5' }] });
  // 命中 6 小时缓存，不再重复拉取
  const many = await peopleTool.execute({ chatId: 'oc_group_1', query: '张同事' });
  assert.equal(many.matched, 11);
  assert.equal(many.people.length, 10);
  assert.equal(many.hasMore, true);
  assert.equal(memberFetches, 1);
  // refresh: true 强制刷新
  await peopleTool.execute({ chatId: 'oc_group_1', query: '志文', refresh: true });
  assert.equal(memberFetches, 2);

  const recallTool = createAvatarRecallTool({ auth, fetchImpl });
  const recalled = await recallTool.execute({ messageId: 'om_mine' });
  assert.deepEqual(recalled, { recalled: true, messageId: 'om_mine' });
  await assert.rejects(recallTool.execute({ messageId: 'om_other' }), /本人发送/);
});

test('3) feishu_avatar_doc_write 支持 format: "markdown" 结构化写入（云文档与 Wiki）', async () => {
  const calls = [];
  const auth = { async requireAccessToken() { return 'tok'; } };
  const writeTool = createDocWriteTool({
    auth,
    fetchImpl: async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push([init.method, url.pathname, body]);
      if (url.pathname === '/open-apis/docx/v1/documents') {
        return response({ document: { document_id: 'docx_md', revision_id: 1, title: '方案' } });
      }
      if (url.pathname === '/open-apis/docx/v1/documents/blocks/convert') {
        assert.equal(body.content_type, 'markdown');
        return response({
          first_level_block_ids: ['b1', 'b2'],
          blocks: [
            { block_id: 'b1', block_type: 3, heading1: { elements: [{ text_run: { content: '背景' } }] } },
            { block_id: 'b2', block_type: 31, table: { property: { row_size: 2, column_size: 2, merge_info: [] } } },
          ],
        });
      }
      if (url.pathname === '/open-apis/docx/v1/documents/docx_md/blocks/docx_md/descendant') {
        assert.deepEqual(body.children_id, ['b1', 'b2']);
        assert.equal(Object.hasOwn(body.descendants[1].table.property, 'merge_info'), false, 'merge_info stripped');
        return response({ children: body.descendants, document_revision_id: 2 });
      }
      assert.fail(`unexpected ${url}`);
    },
  });

  // 允许超过 50 行的 Markdown 文档
  const longMd = ['# 背景', ...Array.from({ length: 60 }, (_, i) => `- 条目 ${i}`)].join('\n');
  const created = await writeTool.execute({ action: 'create', name: '方案', text: longMd, format: 'markdown' });
  assert.equal(created.status, 'completed');
  assert.equal(created.id, 'docx_md');
  assert.equal(created.revisionId, 2);
  assert.equal(created.blocksAdded, 2);
  assert.deepEqual(calls.map(([m, p]) => `${m} ${p}`), [
    'POST /open-apis/docx/v1/documents',
    'POST /open-apis/docx/v1/documents/blocks/convert',
    'POST /open-apis/docx/v1/documents/docx_md/blocks/docx_md/descendant',
  ]);
});

test('4) 双身份按 messageId 精确查单条消息 & 分身支持 threadId 话题查询', async () => {
  const auth = { async requireAccessToken() { return 'tok'; } };
  const queries = [];
  const fetchImpl = async (url) => {
    queries.push([url.pathname, Object.fromEntries(url.searchParams)]);
    if (url.pathname === '/open-apis/im/v1/messages/om_single') {
      return response({
        items: [{
          message_id: 'om_single',
          chat_id: 'oc_chat_1',
          thread_id: 'omt_1',
          msg_type: 'text',
          create_time: '1793849554000',
          sender: { id: 'ou_1', name: '张三' },
          body: { content: JSON.stringify({ text: '单条内容' }) },
        }],
      });
    }
    if (url.pathname === '/open-apis/im/v1/messages') {
      const container = url.searchParams.get('container_id');
      return response({
        items: [{
          message_id: 'om_thread_reply',
          chat_id: container === 'omt_cross' ? 'oc_other' : 'oc_chat_1',
          thread_id: container,
          msg_type: 'text',
          create_time: '1793849555000',
          sender: { id: 'ou_2', name: '李四' },
          body: { content: JSON.stringify({ text: '话题回复' }) },
        }],
        has_more: false,
      });
    }
    assert.fail(`unexpected ${url}`);
  };

  const avatarMessages = createAvatarMessagesTool({ auth, fetchImpl });
  const single = await avatarMessages.execute({ chatId: 'oc_chat_1', messageId: 'om_single' });
  assert.equal(single.matched, 1);
  assert.equal(single.items[0].messageId, 'om_single');
  assert.equal(single.items[0].text, '单条内容');
  assert.equal(single.items[0].threadId, 'omt_1');

  await assert.rejects(avatarMessages.execute({ chatId: 'oc_chat_1', messageId: 'om_single', query: 'x' }), /不能同时传入 query/);
  await assert.rejects(avatarMessages.execute({ chatId: 'oc_other', messageId: 'om_single' }), /不属于指定会话/);

  const thread = await avatarMessages.execute({ chatId: 'oc_chat_1', threadId: 'omt_1' });
  assert.equal(thread.threadId, 'omt_1');
  assert.equal(thread.items[0].text, '话题回复');
  assert.equal(queries.at(-1)[1].container_id_type, 'thread');
  assert.equal(queries.at(-1)[1].container_id, 'omt_1');

  await assert.rejects(avatarMessages.execute({ chatId: 'oc_chat_1', threadId: 'omt_1', startTime: '0' }), /threadId 不支持/);
  await assert.rejects(avatarMessages.execute({ chatId: 'oc_chat_1', threadId: 'omt_cross' }), /不属于指定会话/);

  // 机器人侧 messageId 互斥校验
  const botMessages = createBotMessagesTool({ list: async (input) => ({ chatId: 'oc_chat_1', threadId: '', query: '', scanned: 1, matched: 1, hasMore: false, pageToken: '', messages: [{ messageId: input.messageId, time: '', senderId: 'ou_1', senderName: 'A', type: 'text', text: 'ok' }] }) });
  assert.equal((await botMessages.execute({ chatId: 'oc_chat_1', messageId: 'om_single' })).items[0].messageId, 'om_single');
  await assert.rejects(botMessages.execute({ chatId: 'oc_chat_1', messageId: 'om_single', limit: 5 }), /不能同时传入 limit/);
});

test('5) 机器人 feishu_bot_send 支持 replyToMessageId 引用回复并校验原消息归属', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-bot-reply-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configStore = await new ConfigStore(join(dir, 'config.json')).load();
  const secrets = new Map();
  const replied = [];
  const fakeBot = {
    async startLongConnection({ onState }) { onState('connected'); return 'connected'; },
    async stop() {},
    isInChat: async () => true,
    getMessage: async (id) => ({
      messageId: id,
      chatId: id === 'om_other_chat' ? 'oc_other' : 'oc_chat_1',
      msgType: 'text',
      bodyContent: '{}',
    }),
    replyCard: async (id, card) => { replied.push({ id, card }); return 'om_replied'; },
    sendCard: async () => 'om_new',
    listSlashCommands: async () => [],
  };
  const manager = new RuntimeManager({
    ctx: {
      credentials: {
        async resolve(ref) { return { value: secrets.get(ref) }; },
        async describe(ref) { return { configured: secrets.has(ref) }; },
        async set(ref, value) { secrets.set(ref, value); },
        async unset(ref) { secrets.delete(ref); },
      },
    },
    configStore,
    harness: {},
    logger: null,
    version: '0.12.0',
    dataDir: dir,
    openState: async (id) => new StateStore(join(dir, `state-${id}.json`)).load(),
    verify: async () => ({ name: '测试机器人', openId: 'ou_bot' }),
    createBot: () => fakeBot,
  });
  t.after(() => manager.dispose());
  await manager.addBot({ appId: 'cli_bot_1', appSecret: 'sec' });

  const sendTool = createBotSendTool({ send: manager.send.bind(manager) });
  const res = await sendTool.execute({ chatId: 'oc_chat_1', text: '收到', replyToMessageId: 'om_orig' });
  assert.equal(res.kind, 'card');
  assert.equal(res.messageId, 'om_replied');
  assert.equal(replied.length, 1);
  assert.equal(replied[0].id, 'om_orig');

  await assert.rejects(
    sendTool.execute({ chatId: 'oc_chat_1', text: '跨群回复', replyToMessageId: 'om_other_chat' }),
    /不属于指定 chatId/,
  );
  await assert.rejects(
    sendTool.execute({ chatId: 'oc_chat_1', path: 'a.txt', replyToMessageId: 'om_orig' }),
    /仅支持文本卡片/,
  );
});

test('6) API 修复回归：Markdown 超过 50 顶层块分批提交 + 缺 convert 权限友好提示', async () => {
  const auth = { async requireAccessToken() { return 'tok'; } };
  const descendantBatches = [];
  const totalTop = 65;
  const firstLevelIds = Array.from({ length: totalTop }, (_, i) => `b_${i}`);
  const blocks = firstLevelIds.map((id) => ({ block_id: id, block_type: 2, text: { elements: [{ text_run: { content: id } }] } }));

  const writeTool = createDocWriteTool({
    auth,
    fetchImpl: async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (url.pathname === '/open-apis/docx/v1/documents/blocks/convert') {
        if (body.content.includes('NO_SCOPE')) return response({}, 99991679);
        return response({ first_level_block_ids: firstLevelIds, blocks });
      }
      if (url.pathname.endsWith('/descendant')) {
        descendantBatches.push({ topCount: body.children_id.length, blockCount: body.descendants.length });
        return response({ children: body.descendants, document_revision_id: descendantBatches.length + 1 });
      }
      assert.fail(`unexpected ${url}`);
    },
  });

  await assert.rejects(
    writeTool.execute({ action: 'append', target: 'docx:doc_1', text: 'NO_SCOPE', format: 'markdown' }),
    /docx:document\.block:convert.*format: "plain"/,
  );
  const appended = await writeTool.execute({ action: 'append', target: 'docx:doc_1', text: '# 长文档', format: 'markdown' });
  assert.equal(appended.blocksAdded, 65);
  assert.equal(appended.revisionId, 3);
  assert.deepEqual(descendantBatches, [
    { topCount: 50, blockCount: 50 },
    { topCount: 15, blockCount: 15 },
  ]);
});

test('7) API 修复回归：merge_forward 完整展开子消息 + 超 2000 人群不缓存残缺名单 + doc_read(inspect) 兼容 Drive', async () => {
  const auth = { async requireAccessToken() { return 'tok'; } };
  let hugeMemberCalls = 0;
  const fetchImpl = async (url, init) => {
    if (url.pathname === '/open-apis/im/v1/chats/oc_cached_chat/members') {
      return response({ items: [{ member_id: 'ou_alice', name: '爱丽丝' }], has_more: false });
    }
    if (url.pathname === '/open-apis/im/v1/chats/oc_huge_chat/members') {
      hugeMemberCalls += 1;
      const page = Number(url.searchParams.get('page_token') || 0);
      return response({
        items: [{ member_id: `ou_${page}`, name: `成员${page}` }],
        has_more: true,
        page_token: String(page + 1),
      });
    }
    if (url.pathname === '/open-apis/im/v1/messages/om_merged') {
      assert.equal(url.searchParams.get('user_id_type'), 'open_id');
      return response({
        items: [
          { message_id: 'om_merged', chat_id: 'oc_cached_chat', msg_type: 'merge_forward', create_time: '1793849554000', sender: { id: 'ou_alice' }, body: { content: 'Merged and Forwarded Message' } },
          { message_id: 'om_child_1', chat_id: 'oc_cached_chat', msg_type: 'text', create_time: '1793849554100', sender: { id: 'ou_alice' }, body: { content: JSON.stringify({ text: '第一条转发内容' }) } },
          { message_id: 'om_child_2', chat_id: 'oc_cached_chat', msg_type: 'text', create_time: '1793849554200', sender: { id: 'ou_bob', name: '鲍勃' }, body: { content: JSON.stringify({ text: '第二条转发内容' }) } },
        ],
      });
    }
    if (url.pathname === '/open-apis/drive/v1/metas/batch_query') {
      const body = JSON.parse(init.body);
      assert.deepEqual(body, { request_docs: [{ doc_token: 'doc_meta_1', doc_type: 'docx' }], with_url: true });
      return response({
        metas: [{
          doc_token: 'doc_meta_1',
          doc_type: 'docx',
          title: '架构设计文档',
          url: 'https://example.feishu.cn/docx/doc_meta_1',
          parent_token: 'fld_parent',
          owner_id: 'ou_owner',
          create_time: '1700000000',
          latest_modify_time: '1700003600',
        }],
      });
    }
    assert.fail(`unexpected ${url}`);
  };

  // 先查一次成员触发缓存，验证单条查询能用缓存补全空的 senderName
  const peopleTool = createAvatarPeopleTool({ auth, fetchImpl });
  assert.equal((await peopleTool.execute({ chatId: 'oc_cached_chat', query: '爱丽丝' })).people[0].openId, 'ou_alice');

  // merge_forward 完整展开全部子消息
  const msgTool = createAvatarMessagesTool({ auth, fetchImpl });
  const merged = await msgTool.execute({ chatId: 'oc_cached_chat', messageId: 'om_merged' });
  assert.equal(merged.matched, 3);
  assert.equal(merged.items.length, 3);
  assert.equal(merged.items[0].senderName, '爱丽丝', 'senderName backfilled from cached members');
  assert.equal(merged.items[1].text, '第一条转发内容');
  assert.equal(merged.items[2].text, '第二条转发内容');
  assert.equal(merged.items[2].senderName, '鲍勃');

  // 超 2000 人大群不缓存残缺名单：两次调用均报错且第二次不会命中缓存
  await assert.rejects(peopleTool.execute({ chatId: 'oc_huge_chat', query: '成员' }), /2000 人读取上限/);
  assert.equal(hugeMemberCalls, 20);
  await assert.rejects(peopleTool.execute({ chatId: 'oc_huge_chat', query: '成员' }), /2000 人读取上限/);
  assert.equal(hugeMemberCalls, 40, 'truncated member list was not cached');

  // feishu_avatar_doc_read(inspect) 兼容 Drive 资源
  const readTool = createDocReadTool({ auth, fetchImpl });
  const inspected = await readTool.execute({ action: 'inspect', target: 'https://example.feishu.cn/docx/doc_meta_1' });
  assert.deepEqual(inspected, {
    action: 'inspect',
    id: 'doc_meta_1',
    type: 'docx',
    name: '架构设计文档',
    url: 'https://example.feishu.cn/docx/doc_meta_1',
    target: 'docx:doc_meta_1',
    parentNodeId: 'fld_parent',
    ownerId: 'ou_owner',
    createTime: new Date(1700000000 * 1000).toISOString(),
    latestModifyTime: new Date(1700003600 * 1000).toISOString(),
  });
});

test('8) 会话工作目录解析：读 session.header.cwd 与 workingDirectory.ensure，而非不存在的 session.cwd', async () => {
  const { resolveSessionCwd } = await import('../src/tool-contract.js');
  const dir = await mkdtemp(join(tmpdir(), 'feishu-cwd-'));
  try {
    // DSH 的 Session 只在 header 上记录 cwd；实例本身没有 cwd 属性。
    assert.equal(await resolveSessionCwd({ agent: { session: { id: 's1', header: { cwd: dir } } } }), dir);
    assert.equal(await resolveSessionCwd({ agent: { session: { id: 's1' } } }), '', '缺少 header 时不得回退进程目录');
    assert.equal(await resolveSessionCwd({}), '');
    // 旧版 DSH 兼容
    assert.equal(await resolveSessionCwd({ agent: { session: { id: 's1', cwd: '/legacy/path' } } }), '/legacy/path');

    // harness 的 workingDirectoryOf 优先，并能覆盖 header
    const ensured = [];
    const harness = {
      async workingDirectoryOf(agent, signal) {
        ensured.push([agent.session.header.cwd, signal?.aborted ?? false]);
        return '/ensured/dir';
      },
    };
    const context = { agent: { session: { header: { cwd: dir } } }, signal: new AbortController().signal };
    assert.equal(await resolveSessionCwd(context, harness), '/ensured/dir');
    assert.deepEqual(ensured, [[dir, false]]);

    // ensure 返回空时回退 header，仍不用进程目录
    const emptyHarness = { async workingDirectoryOf() { return ''; } };
    assert.equal(await resolveSessionCwd(context, emptyHarness), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('9) 发送工具把解析到的会话目录传给上传路径，纯文本发送不解析目录', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-send-cwd-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'note.txt'), 'hello');

  const seen = [];
  const botSend = createBotSendTool({
    send: async (input) => {
      seen.push(input.cwd);
      return input.path
        ? { kind: 'file', messageId: 'om_f', chatId: 'oc_1', fileName: 'note.txt', bytes: 5 }
        : { kind: 'card', messageId: 'om_c', chatId: 'oc_1' };
    },
  });
  await botSend.execute({ path: 'note.txt' }, { agent: { session: { header: { cwd: dir } } } });
  assert.deepEqual(seen, [dir], 'file send resolves the session working directory');

  // 纯文本发送不做无谓的工作区解析
  await botSend.execute({ text: 'hello' }, { agent: { session: { id: 's1' } } });
  assert.deepEqual(seen, [dir, undefined], 'text-only sends do not resolve a working directory');
});

test('10) doc_file upload 返回飞书 url 时仍符合声明的输出 schema（回归：invalid output）', async () => {
  const tool = createDocFileTool({
    auth: { async requireAccessToken() { return 'tok'; } },
    fetchImpl: async () => response({ file_token: 'box_uploaded', url: 'https://example.feishu.cn/file/box_uploaded' }),
  });
  const dir = await mkdtemp(join(tmpdir(), 'feishu-docfile-url-'));
  try {
    await writeFile(join(dir, 'report.txt'), 'data');
    const value = await tool.execute(
      { action: 'upload', path: 'report.txt', parent: 'folder:fld_1' },
      { agent: { session: { header: { cwd: dir } } } },
    );
    assert.equal(value.id, 'box_uploaded');
    assert.equal(value.url, 'https://example.feishu.cn/file/box_uploaded');
    // additionalProperties: false —— 每个返回字段都必须已声明，否则 DSH 判为 invalid output。
    const declared = new Set(Object.keys(tool.output.schema.properties));
    for (const key of Object.keys(value)) {
      assert.ok(declared.has(key), `${key} must be declared in the doc_file output schema`);
    }
    for (const required of tool.output.schema.required ?? []) {
      assert.ok(Object.hasOwn(value, required), `missing required output field ${required}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/** 严格按 schema 校验一个工具返回值：additionalProperties: false 下任何未声明字段都算失败。 */
function assertDeclaredOutput(tool, value, schema = tool.output.schema, path = tool.name) {
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value), `${path} must be an array`);
    const itemSchema = schema.items;
    if (!itemSchema) return;
    value.forEach((item, index) => assertDeclaredOutput(tool, item, itemSchema, `${path}[${index}]`));
    return;
  }
  if (schema.type === 'object' || schema.properties) {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
    const declared = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) {
      assert.ok(declared.has(key), `${path}: "${key}" is not a declared output property`);
    }
    for (const required of schema.required ?? []) {
      assert.ok(Object.hasOwn(value, required), `${path}: missing required output "${required}"`);
    }
    for (const [key, rule] of Object.entries(schema.properties ?? {})) {
      if (!Object.hasOwn(value, key) || value[key] === undefined) continue;
      assertDeclaredOutput(tool, value[key], rule, `${path}.${key}`);
    }
    return;
  }
  if (schema.enum) assert.ok(schema.enum.includes(value), `${path} = ${JSON.stringify(value)} is outside its enum`);
  if (schema.type === 'integer') assert.ok(Number.isInteger(value), `${path} must be an integer`);
  else if (schema.type) assert.equal(typeof value, schema.type, `${path} has the wrong type`);
}

test('11) 三个 doc 工具的分支返回值全部落在声明的输出 schema 内（回归：invalid output）', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-doc-output-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'payload.txt'), 'data');
  const context = { agent: { session: { header: { cwd: dir } } } };
  const auth = { async requireAccessToken() { return 'tok'; } };

  const readTool = createDocReadTool({ auth, fetchImpl: async (url, init) => {
    if (url.pathname === '/open-apis/search/v2/doc_wiki/search') {
      return response({ res_units: [
        { title: '文档', entity_type: 'DOC', result_meta: { doc_types: 'DOCX', token: 'doc_1', url: 'https://example.feishu.cn/docx/doc_1' } },
        { title: '页面', entity_type: 'WIKI', result_meta: { doc_types: 'DOCX', token: 'wik_1', url: 'https://example.feishu.cn/wiki/wik_1' } },
      ], has_more: false });
    }
    if (url.pathname === '/open-apis/drive/v1/files') {
      return response({ files: [{ token: 'box_1', type: 'file', name: '附件', url: 'https://example.feishu.cn/file/box_1' }], has_more: false });
    }
    if (url.pathname === '/open-apis/wiki/v2/spaces') {
      return response({ items: [{ space_id: '123', name: '空间', url: 'https://example.feishu.cn/wiki/space/123' }], has_more: false });
    }
    if (/^\/open-apis\/wiki\/v2\/spaces\/123\/nodes$/.test(url.pathname)) {
      return response({ items: [{
        node_token: 'wik_1', obj_token: 'docx_1', obj_type: 'docx', title: '页面',
        has_child: true, url: 'https://example.feishu.cn/wiki/wik_1',
      }], has_more: false });
    }
    if (url.pathname === '/open-apis/wiki/v2/spaces/node_by_token') {
      return response({ node: {
        node_token: 'wik_1', obj_token: 'docx_1', obj_type: 'docx', node_type: 'origin',
        space_id: '123', parent_node_token: 'wik_root', title: '页面', has_child: true,
        url: 'https://example.feishu.cn/wiki/wik_1',
      } });
    }
    if (url.pathname === '/open-apis/drive/v1/metas/batch_query') {
      return response({ metas: [{
        doc_token: 'doc_1', doc_type: 'docx', title: '文档', url: 'https://example.feishu.cn/docx/doc_1',
        parent_token: 'fld_1', owner_id: 'ou_owner', create_time: '1700000000', latest_modify_time: '1700003600',
      }] });
    }
    if (url.pathname.endsWith('/raw_content')) return response({ content: '正文' });
    assert.fail(`unexpected ${url}`);
  } });

  for (const args of [
    { action: 'search', query: '文档' },
    { action: 'list' },
    { action: 'list', target: 'wiki' },
    { action: 'list', target: 'wiki:wik_1' },
    { action: 'inspect', target: 'wiki:wik_1' },
    { action: 'inspect', target: 'docx:doc_1' },
    { action: 'read', target: 'docx:doc_1' },
  ]) assertDeclaredOutput(readTool, await readTool.execute(args, context));

  const writeTool = createDocWriteTool({ auth, taskPollAttempts: 0, fetchImpl: async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.pathname === '/open-apis/docx/v1/documents') return response({ document: { document_id: 'docx_new', revision_id: 1, title: '新文档' } });
    if (url.pathname === '/open-apis/drive/v1/files/create_folder') {
      // 飞书会回传 url，这正是之前 doc_file 漏声明的同类字段。
      return response({ token: 'fld_new', url: 'https://example.feishu.cn/drive/folder/fld_new' });
    }
    if (url.pathname.endsWith('/blocks/convert')) return response({ first_level_block_ids: ['b1'], blocks: [{ block_id: 'b1', block_type: 2, text: { elements: [{ text_run: { content: 'x' } }] } }] });
    if (url.pathname.endsWith('/descendant')) return response({ children: body.descendants, document_revision_id: 2 });
    if (url.pathname.endsWith('/children')) return response({ children: body.children, document_revision_id: 2 });
    if (url.pathname === '/open-apis/wiki/v2/spaces/node_by_token') {
      return response({ node: { node_token: 'wik_1', obj_token: 'docx_1', obj_type: 'docx', node_type: 'origin', space_id: '123', parent_node_token: '', title: '页面', has_child: false, url: 'https://example.feishu.cn/wiki/wik_1' } });
    }
    if (url.pathname === '/open-apis/wiki/v2/spaces/123/nodes' && init.method === 'POST') {
      return response({ node: { node_token: 'wik_new', obj_token: 'docx_new', obj_type: 'docx', node_type: 'origin', space_id: '123', parent_node_token: '', title: '新页面', has_child: false, url: 'https://example.feishu.cn/wiki/wik_new' } });
    }
    if (init.method === 'PATCH') return response({ block: { block_id: 'b1' }, document_revision_id: 3 });
    if (init.method === 'DELETE') return response({ task_id: 'task_1' });
    if (url.pathname.endsWith('/move')) return response({});
    assert.fail(`unexpected ${init.method} ${url}`);
  } });

  for (const args of [
    { action: 'create', name: '新文档' },
    { action: 'create', name: '新文档', text: '正文', format: 'markdown' },
    { action: 'create_folder', name: '新文件夹' },
    { action: 'delete', target: 'file:box_1', confirm: true },
  ]) assertDeclaredOutput(writeTool, await writeTool.execute(args, context));

  const fileTool = createDocFileTool({ auth, fetchImpl: async (url, init) => {
    if (url.pathname === '/open-apis/drive/v1/files/upload_all') {
      return response({ file_token: init.body.get('file_token') ?? 'box_new', url: 'https://example.feishu.cn/file/box_new' });
    }
    if (url.pathname === '/open-apis/wiki/v2/spaces/node_by_token') {
      return response({ node: { node_token: 'wik_file', obj_token: 'box_old', obj_type: 'file', node_type: 'origin', space_id: '123', parent_node_token: 'wik_parent', title: '附件.html' } });
    }
    if (url.pathname.endsWith('/download')) {
      return new Response('bytes', { headers: { 'content-type': 'application/octet-stream' } });
    }
    assert.fail(`unexpected ${init.method} ${url}`);
  } });

  assertDeclaredOutput(fileTool, await fileTool.execute({ action: 'upload', path: 'payload.txt', parent: 'folder:fld_1' }, context));
  assertDeclaredOutput(fileTool, await fileTool.execute({ action: 'replace', target: 'wiki:wik_file', path: 'payload.txt' }, context));
  assertDeclaredOutput(fileTool, await fileTool.execute({ action: 'download', target: 'wiki:wik_file', path: 'saved.txt' }, context));
});
