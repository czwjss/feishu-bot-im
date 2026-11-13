import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MenuController } from '../src/menu.js';

function fixture(t) {
  let sessionId = 'session';
  const applied = [];
  const state = {
    sessionFor: () => sessionId, overrideFor: () => ({}),
    bindSession: async (_, id) => { sessionId = id; applied.push(`session:${id}`); },
  };
  let fail = true;
  const harness = {
    listSessions: async () => [{ sessionId: 'session' }, { sessionId: 'other' }],
    workspaceBaseline: async () => ({ items: [] }),
    modelCatalog: async () => ({ groups: [{ id: 'provider', name: 'Provider', models: [{ id: 'model', name: 'Model' }] }] }),
    selectModel: async (id, model) => {
      if (fail) throw new Error('model unavailable');
      applied.push(`model:${id}:${model.model}`);
    },
  };
  const cards = [];
  let menu;
  const services = () => ({ state, harness, config: () => ({}), listPresets: async () => [], modelFor: (id) => menu.modelFor(id) });
  menu = new MenuController({
    bot: { sendCard: async (_, card) => { cards.push(card); } }, harness, state, services,
    canManage: (_, operator) => operator === 'manager', forgetSession() {},
  });
  t.after(() => menu.dispose());
  const event = (option, operator = 'manager') => ({
    operator: { open_id: operator }, context: { open_chat_id: 'a' }, action: { option },
  });
  return { menu, event, applied, cards, recover: () => { fail = false; } };
}

test('failed menu changes remain retryable and do not report or cache success', async (t) => {
  const { menu, event, applied, cards, recover } = fixture(t);
  await menu.handle('session_pick', event('other'));
  await menu.handle('model_pick', event('provider/model'));
  const failed = await menu.handle('menu_apply', event());
  assert.equal(failed.toast.type, 'warning');
  assert.match(failed.toast.content, /model unavailable/);
  assert.equal(menu.modelFor('other'), null);
  assert.equal(cards.length, 0);
  assert.deepEqual(applied, ['session:other']);
  recover();
  const success = await menu.handle('menu_apply', event());
  assert.equal(success.toast.type, 'success');
  assert.deepEqual(applied, ['session:other', 'model:other:model'], 'completed picks are not replayed');
  assert.deepEqual(menu.modelFor('other'), { provider: 'provider', model: 'model' });
  assert.match((await menu.handle('menu_apply', event())).toast.content, /没有待应用/);
});

test('menu cancellation discards drafts and cannot be triggered by a non-manager', async (t) => {
  const { menu, event, recover, applied } = fixture(t);
  recover();
  await menu.handle('model_pick', event('provider/model'));
  assert.equal((await menu.handle('menu_cancel', event(null, 'outsider'))).toast.type, 'warning');
  assert.equal((await menu.handle('menu_apply', event())).toast.type, 'success');
  await menu.handle('model_pick', event('provider/another'));
  await menu.handle('menu_cancel', event());
  assert.match((await menu.handle('menu_apply', event())).toast.content, /没有待应用/);
  assert.equal(applied.length, 1);
});
