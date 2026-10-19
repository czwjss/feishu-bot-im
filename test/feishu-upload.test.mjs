import assert from 'node:assert/strict';

import { FeishuBot } from '../src/feishu.js';

// The SDK unwraps `data` and returns `{ file_key }` / `{ image_key }` at the
// top level; a nested response is still accepted for compatibility.
const client = {
  im: {
    v1: {
      file: { create: async () => ({ file_key: 'file-key-1' }) },
      image: { create: async () => ({ image_key: 'image-key-1' }) },
    },
  },
};
const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'x', client });
assert.equal(await bot.uploadFile(Buffer.from('hello'), 'a.txt'), 'file-key-1');
assert.equal(await bot.uploadImage(Buffer.from('png')), 'image-key-1');

const nested = new FeishuBot({
  appId: 'cli_test',
  appSecret: 'x',
  client: {
    im: {
      v1: {
        file: { create: async () => ({ data: { file_key: 'file-key-2' } }) },
        image: { create: async () => ({ data: { image_key: 'image-key-2' } }) },
      },
    },
  },
});
assert.equal(await nested.uploadFile(Buffer.from('hello'), 'a.txt'), 'file-key-2');
assert.equal(await nested.uploadImage(Buffer.from('png')), 'image-key-2');

console.log('feishu upload: 2 scenarios passed');
