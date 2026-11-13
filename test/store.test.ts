import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationStore } from '../src/conversation/store';

test('history is bounded and inactive sessions expire', () => {
  let time = 0;
  const store = new ConversationStore(100, 3, 2, () => time);
  store.begin('a', 'one')!.commit('1');
  store.begin('a', 'two')!.commit('2');
  const turn = store.begin('a', 'three')!;
  assert.deepEqual(
    turn.messages.map((m) => m.content),
    ['two', '2', 'three'],
  );
  turn.commit('3');
  time = 100;
  assert.deepEqual(
    store.begin('a', 'new')!.messages.map((m) => m.content),
    ['new'],
  );
});
test('busy sessions are bounded, and deleted in-flight work cannot restore history', () => {
  const store = new ConversationStore(1000, 1, 2, () => 0);
  const old = store.begin('a', 'one')!;
  assert.equal(store.begin('a', 'overlap'), null);
  assert.equal(store.begin('b', 'over capacity'), null);
  store.delete('a');
  old.commit('late');
  assert.deepEqual(
    store.begin('a', 'new')!.messages.map((m) => m.content),
    ['new'],
  );
});
