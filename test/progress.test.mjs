import assert from 'node:assert/strict';

import {
  ARG_LIMIT,
  STEP_OPTION_LIMIT,
  buildPanelTitle,
  buildProgressText,
  buildStepsMarkdown,
  buildUsageRows,
  buildUsageTitle,
  cacheHitRate,
  formatDuration,
  summarizeArguments,
} from '../src/progress.js';
import { formatTokens } from '../src/format.js';

// 1) 参数摘要：按工具类型取关键字段并压平换行
assert.equal(summarizeArguments('bash', JSON.stringify({ command: 'git status', description: 'show state' })), 'git status');
assert.equal(summarizeArguments('read', JSON.stringify({ path: '/tmp/a.js' })), '/tmp/a.js');
assert.equal(summarizeArguments('grep', JSON.stringify({ pattern: 'TODO' })), 'TODO');
assert.equal(summarizeArguments('custom', JSON.stringify({ foo: 'bar' })), '{"foo":"bar"}');
assert.equal(summarizeArguments('bash', JSON.stringify({ command: 'a\nb   c' })), 'a b c');
assert.equal(summarizeArguments('bash', JSON.stringify({ command: 'echo `date`' })), 'echo ´date´');

// 2) 超长参数被截断
const long = summarizeArguments('bash', JSON.stringify({ command: 'x'.repeat(ARG_LIMIT * 2) }));
assert.equal(long.length, ARG_LIMIT);
assert.equal(ARG_LIMIT, 30);
assert.ok(long.endsWith('…'));

// 3) 时长格式
assert.equal(formatDuration(400), '0.4s');
assert.equal(formatDuration(12_000), '12s');
assert.equal(formatDuration(65_000), '1m05s');

// 4) 过程正文只保留标题行，不占用答案区域
const steps = Array.from({ length: STEP_OPTION_LIMIT + 3 }, (_, index) => ({
  name: `tool${index}`,
  args: `arg${index}`,
  ms: 500,
  ok: index === STEP_OPTION_LIMIT + 1 ? false : true,
  error: index === STEP_OPTION_LIMIT + 1 ? 'boom' : undefined,
}));
const text = buildProgressText({ steps, elapsedMs: 12_000, thinkingMs: 3_000 });
assert.equal(text, '⏳ 正在处理…');

// 5) 折叠面板列表只保留最近 20 条，包含失败原因
const list = buildStepsMarkdown(steps, 'detailed');
assert.equal(list.split('\n').filter((line) => /^\d{3}\. /.test(line)).length, STEP_OPTION_LIMIT);
assert.match(list, /^004\. ✅ tool3 · `arg3`/, 'numbering starts at 001 and args are backticked');
assert.match(list, /❌ tool21/);
assert.match(list, /错误：boom/);
assert.ok(!/0\.5s/.test(list), 'step durations are gone');

// 5b) 简要模式隐藏参数
const briefList = buildStepsMarkdown(steps.slice(-1), 'brief');
assert.match(briefList, /tool22/);
assert.ok(!briefList.includes('arg22'));

// 6) 折叠栏收起时展示统计信息
assert.equal(
  buildPanelTitle({ steps, elapsedMs: 45_000, thinkingMs: 9_000, firstTokenMs: 1_200 }),
  '**🤖 总耗时 45s · 首字 1s · 思考耗时 9s · 工具调用 23 · 失败 1**',
);
assert.equal(
  buildPanelTitle({ steps: steps.slice(-1), elapsedMs: 1_000, note: '已停止' }),
  '**🤖 总耗时 1s · 工具调用 1 · 已停止**',
);
assert.equal(buildStepsMarkdown([], 'detailed'), '', 'no panel body without steps');

// 7) Token 统计：格式化、命中率、面板标题与明细
assert.equal(formatTokens(512), '512 tok');
assert.equal(formatTokens(9700), '9.5Ki tok');
assert.equal(formatTokens(1024 * 1024 * 1.2), '1.2Mi tok');
assert.equal(cacheHitRate(896, 9700), '9.2%');
assert.equal(cacheHitRate(0, 0), null);

const usageTitle = buildUsageTitle({
  cumulative: { input: 1000, cache: 900, calls: 2 },
  turn: { input: 2048, cache: 1800, calls: 3 },
});
assert.equal(usageTitle, '**🪙 累计 3.0Ki tok · 本轮 2.0Ki tok · 缓存命中 88.6%**');
assert.equal(buildUsageTitle({ cumulative: null, turn: { input: 0, calls: 0 } }), null);
assert.equal(
  buildUsageTitle({ cumulative: null, turn: { input: 2048, calls: 1 }, context: { tokens: 900, window: 1000 } }),
  '**🪙 累计 2.0Ki tok · 本轮 2.0Ki tok · 缓存命中 0.0% · 上下文 90%**',
);

// 7b) 累计口径包含输出 token（不能只算输入）
assert.equal(
  buildUsageTitle({
    cumulative: { input: 1000, output: 500, cache: 900, calls: 2 },
    turn: { input: 2048, output: 948, cache: 1800, calls: 3 },
  }),
  '**🪙 累计 4.4Ki tok · 本轮 2.9Ki tok · 缓存命中 88.6%**',
);

const usageRows = buildUsageRows([
  { label: '主 Agent', input: 9700, cache: 896 },
  { label: '子智能体 · 调查', input: 1024, cache: 512 },
]);
assert.match(usageRows, /^001\. 主 Agent · 消耗 9\.5Ki tok · 缓存命中 9\.2%/);
assert.match(usageRows, /\n002\. 子智能体 · 调查 · 消耗 1\.0Ki tok · 缓存命中 50\.0%/);

console.log('progress: 8 scenarios passed');
