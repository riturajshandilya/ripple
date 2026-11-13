import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryDatabase } from '../src/history/database';
import { cosine, semanticMemorySearch, type Embedder } from '../src/memory/semantic';

test('semantic search ranks, caches, refreshes on edit, and removes deleted vectors', async () => {
  const db = new HistoryDatabase(':memory:');
  let batches: string[][] = [];
  const fake: Embedder = {
    model: 'test-v1',
    embed: async (texts) => {
      batches.push(texts);
      return texts.map((t) => (t.includes('coffee') ? [0, 1] : [1, 0]));
    },
  };
  try {
    const id = db.addMemory('fitness', 'Prefers short exercise');
    db.addMemory('coffee', 'Prefers espresso');
    const signal = new AbortController().signal;
    assert.equal((await semanticMemorySearch(db, fake, 'workout', signal))[0].memory.id, id);
    assert.equal(batches[0].length, 3);
    await semanticMemorySearch(db, fake, 'workout', signal);
    assert.equal(batches[1].length, 1);
    db.updateMemory(id, 'fitness', 'Prefers long exercise');
    await semanticMemorySearch(db, fake, 'workout', signal);
    assert.equal(batches[2].length, 2);
    db.deleteMemory(id);
    assert.ok(
      (await semanticMemorySearch(db, fake, 'workout', signal)).every((x) => x.memory.id !== id),
    );
  } finally {
    db.close();
  }
});
test('cosine rejects incompatible and zero vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.throws(() => cosine([1], [1, 0]));
  assert.throws(() => cosine([0], [1]));
});

test('deleted memory is not returned when it is removed during embedding', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('fitness', 'Prefers exercise');
    const embedder: Embedder = {
      model: 'fake',
      embed: async (texts) => {
        db.deleteMemory(id);
        return texts.map(() => [1, 0]);
      },
    };
    assert.deepEqual(
      await semanticMemorySearch(db, embedder, 'exercise', new AbortController().signal),
      [],
    );
  } finally {
    db.close();
  }
});
