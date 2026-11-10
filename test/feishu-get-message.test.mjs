import assert from 'node:assert/strict';

import { FeishuBot } from '../src/feishu.js';

const calls = [];
const client = {
  im: {
    v1: {
      message: {
        async get(args) {
          calls.push(args);
          return {
            data: {
              items: [{
                message_id: 'om_card',
                msg_type: 'interactive',
                body: { content: JSON.stringify({ body: { elements: [{ tag: 'markdown', content: '卡片正文' }] } }) },
                sender: { id: 'cli_app', sender_type: 'app' },
              }],
            },
          };
        },
      },
    },
  },
};
const bot = new FeishuBot({ appId: 'cli_app', appSecret: 'secret', client });
const message = await bot.getMessage('om_card');
assert.equal(calls.length, 1);
assert.equal(calls[0].params.card_msg_content_type, 'user_card_content');
assert.equal(message.msgType, 'interactive');
assert.match(message.bodyContent, /卡片正文/);
console.log('feishu getMessage: 3 assertions passed');
