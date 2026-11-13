import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MonitorStore } from '../src/user-identity/monitor-store.js';
import { UserMonitorManager } from '../src/user-identity/monitor.js';
import { AutoReplyEngine } from '../src/user-identity/auto-reply.js';
import { DEFAULT_REPLY_RULES, installWorkerContexts } from '../src/user-identity/worker-context.js';
import { FEISHU_POLICY } from '../src/policy.js';

function contexts(store) {
  const registered = [];
  installWorkerContexts({ inject(_services, apply) {
    apply({ systemPrompt: {
      section() { assert.fail('automatic worker rules must not become a global section'); },
      context(value) { registered.push(value); },
    } });
  } }, store);
  assert.equal(registered.length, 2);
  for (const item of registered) {
    assert.equal(item.required, true);
    assert.equal(item.interpolate, false, 'custom rule text is literal, not a harness template');
  }
  return {
    chat: (id) => registered[0].text({ agent: { session: { id } } }),
    rules: (id) => registered[1].text({ agent: { session: { id } } }),
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'feishu-worker-context-'));
  const options = { configPath: join(root, 'config.json'), statePath: join(root, 'state.json') };
  const store = await new MonitorStore(options).load();
  const chat = { chatId: 'oc_context', name: '测试聊天', chatMode: 'p2p', replyToBots: true };
  await store.saveConfig({ enabled: true, chats: [chat] });
  const ctx = contexts(store);
  let sessionCount = 0;
  const prompts = [];
  const engine = new AutoReplyEngine({
    store,
    harness: {
      createSession: async () => `session-${++sessionCount}`,
      prompt: async (id, text) => {
        assert.match(ctx.chat(id), /oc_context/, 'binding exists before the host accepts the prompt');
        prompts.push({ id, text, rules: ctx.rules(id) });
      },
    },
    setTimeout: () => ({ unref() {} }), clearTimeout() {},
  });
  const monitor = new UserMonitorManager({ store, autoReply: engine, auth: { status: async () => ({}) } });
  const enqueue = async (id, text = '你好') => engine.enqueue(chat, [id], {
    messages: [...(store.state.chats[chat.chatId]?.messages ?? []), {
      messageId: id, senderType: 'user', createTime: new Date().toISOString(), text,
    }],
  });
  t.after(async () => { monitor.dispose(); await rm(root, { recursive: true, force: true }); });
  return { store, options, chat, ctx, engine, monitor, enqueue, prompts };
}

test('only owned worker sessions receive the two dynamic contexts, including after acknowledgement', async (t) => {
  const f = await fixture(t);
  assert.equal(f.ctx.chat('ordinary-host'), '');
  assert.equal(f.ctx.rules('ordinary-host'), '');
  assert.equal(f.ctx.rules(undefined), '');
  assert.match(FEISHU_POLICY, /feishu_avatar_send/);
  assert.ok(!FEISHU_POLICY.includes(DEFAULT_REPLY_RULES), 'global active-send capability does not include the worker template');
  await f.enqueue('om_first');
  await f.engine.flush(f.chat);
  assert.deepEqual(f.store.state.chats[f.chat.chatId].batch.messageIds, []);
  assert.match(f.ctx.chat('session-1'), /^<feishu_avatar_reply_task_chat>\n[\s\S]*测试聊天[\s\S]*oc_context[\s\S]*私聊\n<\/feishu_avatar_reply_task_chat>$/);
  assert.equal(f.ctx.rules('session-1'), `<feishu_avatar_reply_task_rules>\n${DEFAULT_REPLY_RULES}\n</feishu_avatar_reply_task_rules>`);
  assert.match(f.prompts[0].text, /om_first[\s\S]*你好/);
  assert.doesNotMatch(f.prompts[0].text, /oc_context|测试聊天|要求：|feishu_avatar_send/);
  await f.enqueue('om_second', '下一批');
  await f.engine.flush(f.chat);
  assert.match(f.prompts[0].text, /你好/);
  assert.doesNotMatch(f.prompts[0].text, /下一批/, 'already-submitted user messages are immutable snapshots');
});

test('custom rules are dynamic, persisted, resettable and independent of worker session creation', async (t) => {
  const f = await fixture(t);
  await f.enqueue('om_first');
  await f.engine.flush(f.chat);
  const custom = '先给结论。\n保留字面量 ${chatId} 和 {{name}}。';
  const status = await f.monitor.setReplyRules(custom);
  assert.equal(status.replyRules, custom);
  assert.equal(status.defaultReplyRules, DEFAULT_REPLY_RULES);
  assert.equal(f.ctx.rules('session-1'), `<feishu_avatar_reply_task_rules>\n${custom}\n</feishu_avatar_reply_task_rules>`, 'next context assembly uses the saved rule immediately');
  assert.equal(f.ctx.rules('ordinary-host'), '');
  assert.equal(f.store.state.chats[f.chat.chatId].sessionId, 'session-1');
  const restored = await new MonitorStore(f.options).load();
  assert.equal(contexts(restored).rules('session-1'), `<feishu_avatar_reply_task_rules>\n${custom}\n</feishu_avatar_reply_task_rules>`);
  await assert.rejects(f.monitor.setReplyRules({ rules: 'bad' }), /必须是文本/);
  assert.equal(f.store.config.replyRules, custom, 'invalid save preserves the previous rules');
  await f.monitor.setReplyRules('   ');
  assert.equal(f.store.config.replyRules, DEFAULT_REPLY_RULES);
  assert.equal(f.ctx.rules('session-1'), `<feishu_avatar_reply_task_rules>\n${DEFAULT_REPLY_RULES}\n</feishu_avatar_reply_task_rules>`);
});

test('accepted tasks keep their chat binding across worker replacement, removal and restart', async (t) => {
  const f = await fixture(t);
  await f.enqueue('om_first');
  await f.engine.flush(f.chat);
  await f.monitor.setWorker({ preset: 'new-preset' });
  await f.enqueue('om_second');
  await f.engine.flush(f.chat);
  assert.equal(f.store.state.chats[f.chat.chatId].sessionId, 'session-2');
  assert.match(f.ctx.chat('session-1'), /oc_context/);
  assert.match(f.ctx.chat('session-2'), /oc_context/);
  await f.monitor.removeChat(f.chat.chatId);
  assert.equal(f.store.state.chats[f.chat.chatId], undefined);
  const reloaded = contexts(await new MonitorStore(f.options).load());
  for (const id of ['session-1', 'session-2']) {
    assert.match(reloaded.chat(id), /测试聊天[\s\S]*私聊/);
    assert.ok(reloaded.rules(id).includes(DEFAULT_REPLY_RULES));
  }
});

test('existing workers receive context after upgrade and chat names stay literal', async (t) => {
  const f = await fixture(t);
  await f.store.saveState({ chats: { [f.chat.chatId]: { sessionId: 'legacy-worker' } } });
  await f.store.saveConfig({ chats: [{ ...f.chat, name: '名字\n{{unresolved_variable}}' }] });
  const value = f.ctx.chat('legacy-worker');
  assert.match(value, /名字\\n\{\{unresolved_variable\}\}/);
  assert.match(value, /私聊/);
  assert.ok(f.ctx.rules('legacy-worker').includes(DEFAULT_REPLY_RULES));
  await f.monitor.removeChat(f.chat.chatId);
  const reloaded = contexts(await new MonitorStore(f.options).load());
  assert.match(reloaded.chat('legacy-worker'), /私聊/, 'migrated workers retain their chat type after removal');
});
