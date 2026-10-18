import assert from 'node:assert/strict';
import { SLASH_COMMANDS, syncSlashCommands, manifestNames } from '../src/slash-commands.js';

function fakeBot(remote, { failDelete = new Set(), failCreate = new Set() } = {}) {
  const calls = [];
  return {
    calls,
    async listSlashCommands() { return remote; },
    async createSlashCommand(item) {
      calls.push(['create', item.command]);
      if (failCreate.has(item.command)) throw new Error('no write scope');
    },
    async deleteSlashCommand(id) {
      calls.push(['delete', id]);
      if (failDelete.has(id)) throw new Error('denied');
    },
  };
}

// 1) 遗留命令被删除，缺失的被创建
{
  const bot = fakeBot([
    { id: 'c1', command: 'cancel' },
    { id: 'c2', command: 'repair' },
    { id: 'c3', command: 'stop' },
  ]);
  const result = await syncSlashCommands(bot, { logger: { warn() {} } });
  assert.deepEqual(result.removed.sort(), ['cancel', 'repair']);
  assert.equal(result.failed.length, 0);
  const created = result.created.sort();
  assert.deepEqual(created.sort(), ['menu', 'new', 'topic', 'topic-sync']);
  assert.ok(bot.calls.some(([kind, arg]) => kind === 'delete' && arg === 'c1'));
}

// 2) 已对齐时什么都不做
{
  const remote = SLASH_COMMANDS.map((item, index) => ({ id: `id${index}`, command: item.command }));
  const bot = fakeBot(remote);
  const result = await syncSlashCommands(bot, { logger: { warn() {} } });
  assert.deepEqual(result, { removed: [], created: [], failed: [] });
  assert.equal(bot.calls.length, 0);
}

// 3) 失败被收集而不是抛出
{
  const bot = fakeBot([{ id: 'x1', command: 'batch' }], { failDelete: new Set(['x1']) });
  const result = await syncSlashCommands(bot, { logger: { warn() {} } });
  assert.equal(result.removed.length, 0);
  assert.ok(result.failed.some((item) => item.action === 'delete' && item.command === 'batch'));
}

// 4) 清单是 5 条且包含必需命令
{
  const names = manifestNames();
  assert.equal(names.size, 5);
  for (const required of ['menu', 'new', 'stop', 'topic', 'topic-sync']) {
    assert.ok(names.has(required), `missing ${required}`);
  }
  assert.ok(SLASH_COMMANDS.every((item) => item.zh && item.en));
}

console.log('slash commands: 4 scenarios passed');
