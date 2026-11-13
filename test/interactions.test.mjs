import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InteractionManager } from '../src/interactions.js';

const never = () => new Promise(() => {});
const tick = () => new Promise((resolve) => setImmediate(resolve));
const actionOf = (card, prefix) => [...JSON.stringify(card).matchAll(/"action":"([^"]+)"/g)]
  .map((match) => match[1]).find((action) => action.startsWith(prefix));
const question = (id = 'q1', label = 'A', signal) => ({
  signal, agent: { session: { id: 'session' } }, questions: [{ id, question: 'Pick', options: [{ label }] }],
});
const binding = (chatId) => ({ chatId, chatKey: `chat:${chatId}` });
const event = (chatId) => ({ context: { open_chat_id: chatId } });
const approval = (signal) => ({
  signal, toolName: 'test', callId: 'call', agent: { session: {
    id: 'session', events: [{ type: 'approval/asked', data: { id: 'approval', callId: 'call' } }],
  } },
});
function fixture(t, options = {}) {
  const cards = [];
  const patches = [];
  const manager = new InteractionManager({
    bot: {
      async sendCard(chatId, card) { cards.push({ chatId, card }); return `card-${cards.length}`; },
      async patchCard(id, card) { patches.push({ id, card }); },
    },
    canManage: (_, operator) => operator === 'manager', canAnswer: (_, operator) => operator === 'user',
    log() {}, ...options,
  });
  t.after(() => manager.dispose());
  return { manager, cards, patches };
}

test('same question ID in two chats cannot collide or be answered from another chat', async (t) => {
  const { manager, cards } = fixture(t);
  const a = manager.ask(question('q1', 'A'), never, binding('a'));
  const b = manager.ask(question('q1', 'B'), never, binding('b'));
  await tick();
  const actionA = actionOf(cards[0].card, 'answer:');
  const actionB = actionOf(cards[1].card, 'answer:');
  assert.notEqual(actionA, actionB);
  assert.notEqual(manager.onCardAction(actionB, event('a'), 'user').toast.type, 'success');
  assert.notEqual(manager.onCardAction(actionA, {}, 'user').toast.type, 'success');
  assert.equal(manager.onCardAction(actionA, event('a'), 'outsider').toast.type, 'warning');
  assert.equal(manager.onCardAction(actionA, event('a'), 'user').toast.type, 'success');
  assert.deepEqual(await a, { answers: [{ id: 'q1', selected: ['A'] }] });
  assert.equal(manager.onCardAction(actionB, event('b'), 'user').toast.type, 'success');
  assert.deepEqual(await b, { answers: [{ id: 'q1', selected: ['B'] }] });
  assert.notEqual(manager.onCardAction(actionA, event('a'), 'user').toast.type, 'success');
});

test('question cancellation clears its callback and abort listener', async (t) => {
  const { manager, cards } = fixture(t);
  const controller = new AbortController();
  const add = t.mock.method(controller.signal, 'addEventListener');
  const remove = t.mock.method(controller.signal, 'removeEventListener');
  const result = manager.ask(question('q1', 'A', controller.signal), never, binding('a'));
  const rejected = assert.rejects(result, { code: 'ASK_ABORTED' });
  await tick();
  controller.abort();
  await rejected;
  assert.equal(add.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 1);
  assert.notEqual(manager.onCardAction(actionOf(cards[0].card, 'answer:'), event('a'), 'user').toast.type, 'success');
});

test('native answer before a slow card send still resolves that card exactly once', async (t) => {
  let send;
  let native;
  const patches = [];
  const { manager } = fixture(t, { bot: {
    sendCard: () => new Promise((resolve) => { send = resolve; }),
    patchCard: async (...args) => { patches.push(args); },
  } });
  const pending = manager.ask(question(), () => new Promise((resolve) => { native = resolve; }), binding('a'));
  await tick();
  const answer = { answers: [{ id: 'q1', selected: ['native'] }] };
  native(answer);
  assert.deepEqual(await pending, answer);
  send('slow-card');
  await tick();
  assert.equal(patches.length, 1);
  assert.match(JSON.stringify(patches[0]), /native/);
  assert.doesNotMatch(JSON.stringify(patches[0]), /answer:/);
});

test('timeout rejects questions, cancels approvals, and makes old buttons inert', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { manager, cards } = fixture(t, { timeoutMs: 25 });
  const q = manager.ask(question(), never, binding('a'));
  const rejected = assert.rejects(q, { code: 'ASK_ABORTED' });
  const a = manager.approve(approval(), never, binding('b'));
  await tick();
  t.mock.timers.tick(25);
  await rejected;
  assert.equal(await a, 'cancelled');
  for (const card of cards) {
    const action = actionOf(card.card, 'answer:') ?? actionOf(card.card, 'approve:');
    assert.notEqual(manager.onCardAction(action, event(card.chatId), 'manager').toast.type, 'success');
  }
});

test('dispose cancels every waiter, including approvals, without sending new cards', async (t) => {
  const { manager, cards } = fixture(t);
  const q = manager.ask(question(), never, binding('a'));
  const rejected = assert.rejects(q, { code: 'ASK_ABORTED' });
  const a = manager.approve(approval(), never, binding('b'));
  manager.dispose();
  await rejected;
  assert.equal(await a, 'cancelled');
  await tick();
  assert.equal(cards.length, 0);
  await assert.rejects(manager.ask(question(), never, binding('a')), { code: 'ASK_ABORTED' });
});

test('approvals validate source chat and manager, then clear their timeout', async (t) => {
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const { manager, cards } = fixture(t);
  const pending = manager.approve(approval(), never, binding('a'));
  await tick();
  const action = actionOf(cards[0].card, 'approve:');
  assert.notEqual(manager.onCardAction(action, event('b'), 'manager').toast.type, 'success');
  assert.equal(manager.onCardAction(action, event('a'), 'user').toast.type, 'warning');
  assert.equal(manager.onCardAction(action, event('a'), 'manager').toast.type, 'success');
  assert.equal(await pending, 'allowed-once');
  assert.equal(clear.mock.callCount(), 1);
});

test('multiple questions and multi-select keep their native answer contract', async (t) => {
  const { manager, cards } = fixture(t);
  const multiple = question();
  multiple.questions.push({ id: 'q2', question: 'Other' });
  const answer = { answers: [{ id: 'q1', selected: ['A'] }, { id: 'q2', selected: ['B'] }] };
  assert.equal(await manager.ask(multiple, async () => answer, binding('a')), answer);
  const multiSelect = question();
  multiSelect.questions[0].multiSelect = true;
  assert.equal(await manager.ask(multiSelect, async () => answer, binding('a')), answer);
  assert.equal(cards.length, 0);
});
