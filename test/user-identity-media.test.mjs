import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSendTool } from '../src/user-identity/tools.js';

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-user-media-'));
const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url: String(url), init });
  const target = String(url);
  if (target.endsWith('/open-apis/im/v1/images')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { image_key: 'img_key' } }) };
  }
  if (target.endsWith('/open-apis/im/v1/files')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { file_key: 'file_key' } }) };
  }
  if (target.includes('/open-apis/im/v1/messages')) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { message_id: 'om_media', chat_id: 'oc_chat' } }) };
  }
  return { ok: false, status: 404, json: async () => ({ code: -1, msg: 'unexpected' }) };
};
const auth = { async requireAccessToken() { return 'user-token'; } };

try {
  await writeFile(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await writeFile(join(dir, 'report.pdf'), Buffer.from('%PDF-1.4\n% test\n'));
  const tool = createSendTool({ auth, fetchImpl });
  const context = { agent: { session: { cwd: dir } } };

  const image = await tool.execute({ chatId: 'oc_chat', path: 'photo.png' }, context);
  assert.equal(image.kind, 'image');
  assert.equal(image.messageId, 'om_media');
  assert.match(calls[0].url, /\/im\/v1\/images$/);
  const imageSend = JSON.parse(calls[1].init.body);
  assert.equal(imageSend.msg_type, 'image');
  assert.deepEqual(JSON.parse(imageSend.content), { image_key: 'img_key' });

  calls.length = 0;
  const file = await tool.execute({ openId: 'ou_1234', path: 'report.pdf', name: '周报.pdf' }, context);
  assert.equal(file.kind, 'file');
  assert.equal(file.name, '周报.pdf');
  assert.match(calls[0].url, /\/im\/v1\/files$/);
  const fileSend = JSON.parse(calls[1].init.body);
  assert.equal(fileSend.msg_type, 'file');
  assert.deepEqual(JSON.parse(fileSend.content), { file_key: 'file_key', file_name: '周报.pdf' });

  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', text: 'x', path: 'photo.png' }, context),
    /text 和 path/,
  );
  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', path: 'photo.png', title: '标题' }, context),
    /title\/color/,
  );
  await assert.rejects(
    () => tool.execute({ chatId: 'oc_chat', path: 'missing.png' }, context),
    /文件不存在/,
  );

  console.log('im-feishu user identity media: 12 assertions passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
