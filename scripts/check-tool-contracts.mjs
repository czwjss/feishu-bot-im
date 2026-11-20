/** Check against an installed DSH, without making any Feishu API calls. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as bot from '../src/tool.js';
import { createUserIdentityTools } from '../src/user-identity/tools.js';
import { FEISHU_POLICY } from '../src/policy.js';

// Optional first argument: the installed @deepseek-ai/dsh package directory.
const dshDir = process.argv[2] || process.env.DSH_INSTALL_DIR || '';
const require = createRequire(dshDir ? join(resolve(dshDir), 'package.json') : import.meta.url);
let dshToolsPath;
try {
  dshToolsPath = require.resolve('@deepseek-ai/dsh-tools');
} catch {
  console.error('用法：node scripts/check-tool-contracts.mjs <DSH安装目录> [baseline.json]');
  process.exit(1);
}
const { assertSupportedJsonSchema, projectToolSchema } = await import(pathToFileURL(dshToolsPath));
const { jsonSchemaToTs, jsonSchemaToPy, renderToolsSdk } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-tool-executor-ptc')));
const tools = [
  bot.createSendTool({}), bot.createMessagesTool({}), bot.createChatsTool({}),
  bot.createPeopleTool({}), bot.createRecallTool({}), ...createUserIdentityTools({}),
];
for (const tool of tools) {
  assertSupportedJsonSchema(tool.parameters);
  assertSupportedJsonSchema(tool.output.schema);
  assert.notEqual(jsonSchemaToTs(tool.parameters), 'unknown', `${tool.name}: TypeScript input lost`);
  assert.notEqual(jsonSchemaToPy(tool.parameters), 'Any', `${tool.name}: Python input lost`);
}
const measure = (projections, outputs) => {
  const schemas = projections.map((tool) => {
    const matched = outputs.find((item) => item.name === tool.name);
    if (!matched) throw new Error(`baseline 缺少工具 ${tool.name} 的 output schema`);
    return { ...tool, output: matched.schema };
  });
  return {
    nativeCharacters: JSON.stringify(projections).length,
    ptcCharacters: renderToolsSdk(schemas).length - renderToolsSdk([]).length,
    unknownInputs: schemas.filter((tool) => jsonSchemaToTs(tool.parameters) === 'unknown').map((tool) => tool.name),
  };
};
const current = measure(tools.map((tool) => projectToolSchema(tool, true)), tools.map((tool) => ({ name: tool.name, schema: tool.output.schema })));
const baseline = process.argv[3] ? JSON.parse(await readFile(resolve(process.argv[3]), 'utf8')) : null;
console.log(JSON.stringify({
  checkedTools: tools.length,
  current,
  ...(baseline ? { before: measure(baseline.projections, baseline.outputs), policyUnchanged: baseline.policy === FEISHU_POLICY } : {}),
}, null, 2));
