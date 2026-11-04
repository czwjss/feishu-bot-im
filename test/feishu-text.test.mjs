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
        async list({ params }) {
          calls.push({ list: params });
          return { code: 0, data: { items: [{ message_id: 'om_history' }], has_more: true, page_token: 'next_page' } };
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

const start = Date.parse('2026-11-05T00:00:00Z');
const end = Date.parse('2026-11-06T00:00:00Z');
const history = await bot.listMessages('oc_group', {
  startTime: start, endTime: end, pageSize: 10, pageToken: 'pt', order: 'oldest',
});
const historyRequest = calls.find((call) => call.list)?.list;
assert.equal(historyRequest.container_id_type, 'chat');
assert.equal(historyRequest.container_id, 'oc_group');
assert.equal(historyRequest.start_time, String(Math.floor(start / 1000)));
assert.equal(historyRequest.end_time, String(Math.floor(end / 1000)));
assert.equal(historyRequest.sort_type, 'ByCreateTimeAsc');
assert.equal(historyRequest.with_sender_name, true);
assert.equal(historyRequest.page_token, 'pt');
assert.equal(history.items[0].message_id, 'om_history');
assert.equal(history.hasMore, true);
assert.equal(history.pageToken, 'next_page');

console.log('feishu text: 29 assertions passed');
