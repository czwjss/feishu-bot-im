import assert from 'node:assert/strict';

import { FeishuBot } from '../src/feishu.js';

const calls = [];
let memberCalls = 0;
let chatCalls = 0;
let membershipCalls = 0;
const client = {
  im: {
    v1: {
      message: {
        async create(request) {
          calls.push(request);
          return { code: 0, data: { message_id: `om_${calls.length}` } };
        },
      },
      chat: {
        async list() {
          chatCalls += 1;
          return { code: 0, data: { items: [{ chat_id: 'oc_group', name: '研发群' }], has_more: false } };
        },
      },
      chatMembers: {
        async isInChat({ path }) {
          membershipCalls += 1;
          return { code: 0, data: { is_in_chat: path.chat_id === 'oc_group' } };
        },
        async get({ params }) {
          memberCalls += 1;
          if (!params.page_token) {
            return {
              code: 0,
              data: {
                items: [{ member_id: 'ou_zhang', name: '张三' }, { member_id: 'ou_li', name: '李四' }],
                has_more: true,
                page_token: 'next',
              },
            };
          }
          return { code: 0, data: { items: [{ member_id: 'ou_wang', name: '王五' }], has_more: false } };
        },
      },
    },
  },
};
const bot = new FeishuBot({ appId: 'cli_test', appSecret: 'secret', client });

assert.equal(await bot.sendText('oc_group', '你好'), 'om_1');
assert.equal(calls[0].params.receive_id_type, 'chat_id');
assert.equal(calls[0].data.receive_id, 'oc_group');
assert.equal(calls[0].data.msg_type, 'text');
assert.equal(JSON.parse(calls[0].data.content).text, '你好');
assert.match(calls[0].data.uuid, /^[0-9a-f-]{36}$/, 'text sends carry an idempotency uuid');

// 群成员：自动翻页，缓存六小时，refresh 强制重拉
const roster = await bot.getChatMembers('oc_group');
assert.deepEqual(roster.map((person) => person.name), ['张三', '李四', '王五'], 'all pages are merged');
assert.equal(memberCalls, 2, 'two API pages were fetched');
assert.equal((await bot.getChatMembers('oc_group')).length, 3, 'second read comes from cache');
assert.equal(memberCalls, 2, 'cache avoided another API call');
await bot.getChatMembers('oc_group', { refresh: true });
assert.equal(memberCalls, 4, 'refresh bypasses the cache');

const groups = await bot.getChats();
assert.deepEqual(groups, [{ chatId: 'oc_group', name: '研发群' }]);
await bot.getChats();
assert.equal(chatCalls, 1, 'group list is cached');
await bot.getChats({ refresh: true });
assert.equal(chatCalls, 2, 'group refresh bypasses the cache');

assert.equal(await bot.isInChat('oc_group'), true);
assert.equal(await bot.isInChat('oc_group'), true);
assert.equal(membershipCalls, 1, 'positive membership is cached');
assert.equal(await bot.isInChat('oc_missing'), false);
assert.equal(await bot.isInChat('oc_group', { refresh: true }), true);
assert.equal(membershipCalls, 3, 'refresh bypasses the membership cache');

console.log('feishu text: 21 assertions passed');
