import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigStore, StateStore } from '../src/config.js';
import { RuntimeManager } from '../src/runtime.js';

const dir = await mkdtemp(join(tmpdir(), 'im-feishu-runtime-'));
const configStore = await new ConfigStore(join(dir, 'config.json')).load();

const secrets = new Map();
const credentials = {
  async resolve(ref) { return secrets.has(ref) ? { value: secrets.get(ref) } : undefined; },
  async describe(ref) { return { configured: secrets.has(ref) }; },
  async set(ref, value) { secrets.set(ref, value); },
  async unset(ref) { secrets.delete(ref); },
};

const calls = [];
class FakeBot {
  constructor(options) { this.options = options; }
  async startLongConnection(handlers) { handlers.onState('connected'); return 'connected'; }
  async stop() {}
  connectionStatus() { return { state: 'connected' }; }
  async sendText(chatId, text) { calls.push({ kind: 'text', chatId, text }); }
  async sendTextToUser(openId, text) { calls.push({ kind: 'user', openId, text }); }
  async uploadFile(bytes, name) { calls.push({ kind: 'file', name }); return 'fk'; }
  async uploadImage() { calls.push({ kind: 'image' }); return 'ik'; }
  async sendFile(chatId, key, name) { calls.push({ kind: 'file-msg', chatId, name }); }
  async sendImage(chatId) { calls.push({ kind: 'image-msg', chatId }); }
}

const states = new Map();
const manager = new RuntimeManager({
  ctx: { credentials },
  configStore,
  harness: {},
  logger: { info() {}, warn() {}, error() {} },
  version: '0.1.0',
  dataDir: dir,
  openState: async (botId) => {
    if (!states.has(botId)) {
      const store = await new StateStore(join(dir, `state-${botId}.json`)).load();
      states.set(botId, store);
    }
    return states.get(botId);
  },
  verify: async ({ appId }) => ({ name: `bot-${appId.slice(-4)}`, openId: `ou_${appId.slice(-4)}` }),
  createBot: (options) => new FakeBot(options),
});

// 1) 空配置启动
await manager.start();
assert.deepEqual(await manager.status(), { bots: [], presetsReady: false });

// 2) 绑定两个机器人：各自独立凭证/状态/连接
const first = await manager.addBot({ appId: 'cli_aaaaaaaaaaaaaaaa', appSecret: 's1' });
const second = await manager.addBot({ appId: 'cli_bbbbbbbbbbbbbbbb', appSecret: 's2', alias: '二号机' });
assert.equal(first.state, 'connected');
assert.equal(second.state, 'connected');
assert.equal(second.alias, '二号机');
assert.equal(secrets.size, 2, 'each bot stores its own secret');
assert.notEqual(first.id, second.id);

// 3) 重复绑定同一应用被拒绝
await assert.rejects(() => manager.addBot({ appId: 'cli_aaaaaaaaaaaaaaaa', appSecret: 'x' }), /已经绑定/);

// 4) 每个机器人独立设置
const r1 = manager.runtimeForBot(first.id);
const r2 = manager.runtimeForBot(second.id);
await r1.save({ workspace: '/tmp/one' });
await r2.save({ workspace: '/tmp/two' });
assert.equal(configStore.bot(first.id).workspace, '/tmp/one');
assert.equal(configStore.bot(second.id).workspace, '/tmp/two', 'settings stay per bot');

// 5) 会话绑定按机器人隔离 + 事件按 session 路由
const s1 = states.get(first.id);
const s2 = states.get(second.id);
await s1.bindSession('chat:oc_1', 'sess-1');
await s2.bindSession('chat:oc_2', 'sess-2');
assert.equal(r1.handlesSession('sess-1'), true);
assert.equal(r1.handlesSession('sess-2'), false);
assert.equal(r2.handlesSession('sess-2'), true);

// 6) 测试消息发往各自会话
await r1.sendTest();
await r2.sendTest();
assert.deepEqual(calls.filter((c) => c.kind === 'text').map((c) => c.chatId), ['oc_1', 'oc_2']);

// 7) 文件回传
const file = join(dir, 'a.txt');
await writeFile(file, 'hi');
const sent = await manager.sendFileForSession({ sessionId: 'sess-2', path: file });
assert.equal(sent.fileName, 'a.txt');
assert.equal(calls.at(-1).kind, 'file-msg');

// 7b) 话题会话回传文件也发到群 chat id
{
  await s1.bindSession('topic:oc_3:1', 'sess-3');
  const topicSent = await manager.sendFileForSession({ sessionId: 'sess-3', path: file });
  assert.equal(topicSent.chatId, 'oc_3', 'topic binding resolves to the chat id');
  assert.equal(calls.at(-1).chatId, 'oc_3');
}

// 8) 投递：按路由直发（不再有目标清单）
{
  await r1.deliver('oc_daily', '测试消息');
  assert.equal(calls.at(-1).kind, 'text');
  assert.equal(calls.at(-1).chatId, 'oc_daily');
  await r1.deliver('ou_me', '测试消息');
  assert.equal(calls.at(-1).kind, 'user');
  assert.equal(calls.at(-1).openId, 'ou_me');
  await assert.rejects(() => r1.deliver('日报群', 'x'), /必须是 oc_/);
  await assert.rejects(() => r1.deliver('oc_daily', '   '), /内容不能为空/);
}

// 9) 任意会话投递：按机器人别名指定（Web 定时任务场景）
{
  await second.catch?.(() => undefined);
  const alias = '二号机';
  const result = await manager.deliver({ sessionId: 'sess-web', bot: alias, target: 'oc_daily', text: '来自 Web 定时任务' });
  assert.equal(result.targetId, 'oc_daily');
  assert.equal(calls.at(-1).chatId, 'oc_daily');
  await assert.rejects(
    () => manager.deliver({ sessionId: 'sess-web', bot: '不存在的机器人', target: 'oc_daily', text: 'x' }),
    /没有这个机器人/,
  );
}

// 10) 移除机器人：只清它自己的密钥、配置与落盘数据
const exists = (path) => access(path).then(() => true, () => false);
await writeFile(join(dir, `state-${first.id}.json`), '{}');
await writeFile(join(dir, `status-${first.id}.json`), '{}');
await writeFile(join(dir, `events-${first.id}.log`), '');
await writeFile(join(dir, `state-${second.id}.json`), '{}');
await mkdir(join(dir, 'inbox', first.id), { recursive: true });
await writeFile(join(dir, 'inbox', first.id, 'a.txt'), 'hi');
await manager.removeBot(first.id);
assert.equal(configStore.bots.length, 1);
assert.equal(configStore.bots[0].id, second.id);
assert.equal(secrets.size, 1);
assert.equal(await exists(join(dir, `state-${first.id}.json`)), false, 'state file removed');
assert.equal(await exists(join(dir, `status-${first.id}.json`)), false, 'status file removed');
assert.equal(await exists(join(dir, `events-${first.id}.log`)), false, 'event log removed');
assert.equal(await exists(join(dir, 'inbox', first.id)), false, 'inbox removed');
assert.equal(await exists(join(dir, `state-${second.id}.json`)), true, 'other bot untouched');

await rm(dir, { recursive: true, force: true });
console.log('runtime (multi-bot): 12 scenarios passed');
