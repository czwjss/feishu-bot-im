import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const used = new Set(source.match(/--dsw-[a-z0-9-]+/g) ?? []);
const allowed = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-label-primary-foreground',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
]);

for (const token of used) {
  assert.ok(allowed.has(token), `client.js uses unknown DSH theme token ${token}`);
}

for (const legacy of [
  '--dsw-alias-bg-elevated',
  '--dsw-alias-text-primary',
  '--dsw-alias-text-secondary',
  '--dsw-alias-brand-bg',
]) {
  assert.ok(!source.includes(legacy), `client.js still uses legacy theme token ${legacy}`);
}
assert.ok(!/var\(--dsw-alias-border,/.test(source), 'client.js still uses ambiguous --dsw-alias-border');

console.log(`client theme: ${used.size} tokens checked`);
