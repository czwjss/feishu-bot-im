import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const result = await build({
  absWorkingDir: rootDir,
  entryPoints: ['client/index.js'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  loader: { '.svg': 'dataurl' },
  external: ['react'],
  legalComments: 'none',
  logLevel: 'warning',
});
const bundle = result.outputFiles[0].text;
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const output = `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(pkg.name)},\n  factory(require) {\n    const module = { exports: {} };\n    (function (module, exports, require) {\n${bundle}\n    })(module, module.exports, require);\n    return module.exports.createPlugin();\n  },\n});\n`;
await writeFile(join(rootDir, 'client.js'), output);
console.log(`built client.js (${output.length} bytes)`);
