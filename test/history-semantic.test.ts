import * as sqliteVec from 'sqlite-vec';
import { removeVectorSchema } from './vector-fixture';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryDatabase } from '../src/history/database';
import {
  fuseRanks,
  hybridHistorySearch,
  indexHistoryBatch,
} from '../src/retrieval/history-semantic';
import type { Embedder } from '../src/memory/semantic';

const fake: Embedder = {
  model: 'fixture',
  async embed(texts) {
    return texts.map((t) => (/workout|exercise/i.test(t) ? [1, 0] : [0, 1]));
  },
};
test('semantic history finds synonyms, preserves neighboring turns and deletion removes embeddings', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn(
      'fitness',
      'I prefer workouts under thirty minutes',
      'That is a useful preference.',
    );
    db.saveTurn('other', 'I like espresso', 'Noted.');
    const before = await hybridHistorySearch(db, fake, 'exercise', new AbortController().signal);
    assert.equal(before.complete, false);
    assert.equal(before.evidence.length, 0);
    assert.equal(await indexHistoryBatch(db, fake, new AbortController().signal), 4);
    assert.equal(await indexHistoryBatch(db, fake, new AbortController().signal), 0);
    const result = await hybridHistorySearch(db, fake, 'exercise', new AbortController().signal);
    assert.equal(result.complete, true);
    assert.equal(result.evidence.length, 1);
    assert.deepEqual(
      result.evidence[0].messages.map((m) => m.content),
      ['I prefer workouts under thirty minutes', 'That is a useful preference.'],
    );
    db.delete(result.evidence[0].conversationId);
    const after = await hybridHistorySearch(db, fake, 'exercise', new AbortController().signal);
    assert.equal(after.evidence.length, 0);
  } finally {
    db.close();
  }
});
test('keyword search still works when local embeddings are unavailable', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn('s', 'Redis caching', 'An in-memory cache');
    await indexHistoryBatch(db, fake, new AbortController().signal);
    const broken: Embedder = {
      model: 'fixture',
      async embed() {
        throw Error('offline');
      },
    };
    const result = await hybridHistorySearch(db, broken, 'redis', new AbortController().signal);
    assert.equal(result.complete, false);
    assert.equal(result.evidence.length, 1);
  } finally {
    db.close();
  }
});
test('rank fusion rewards overlap and keeps sources distinct', () => {
  const a = { id: 1, conversationId: 'a' },
    b = { id: 2, conversationId: 'b' };
  assert.deepEqual(fuseRanks([a, b], [b])[0], b);
});
test('indexing skips a message deleted before the vector arrives', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn('s', 'private question', 'answer');
    const id = (db.list()[0] as { id: string }).id;
    const slow: Embedder = {
      model: 'fake',
      async embed(texts) {
        db.delete(id);
        return texts.map(() => [1, 0]);
      },
    };
    assert.equal(await indexHistoryBatch(db, slow, new AbortController().signal), 0);
    assert.equal(db.recentHistoryMessages().length, 0);
  } finally {
    db.close();
  }
});

test('keyword search can find history older than the vector scan window', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn('old', 'zebranotebook unique', 'answer');
    for (let i = 0; i < 250; i++) db.saveTurn(`s${i}`, 'newer message', 'newer answer');
    const result = await hybridHistorySearch(
      db,
      fake,
      'zebranotebook',
      new AbortController().signal,
    );
    assert.equal(result.complete, false);
    assert.equal(result.evidence.length, 1);
    assert.match(result.evidence[0].messages[0].content, /zebranotebook/);
  } finally {
    db.close();
  }
});

test('version 4 to 5 migration retains conversation and personal memory data', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { default: Database } = await import('better-sqlite3');
  const dir = mkdtempSync(join(tmpdir(), 'ripple-migration-'));
  const path = join(dir, 'db.sqlite');
  try {
    const first = new HistoryDatabase(path);
    first.saveTurn('s', 'old question', 'old answer');
    first.addMemory('fitness', 'short workouts');
    first.close();
    const raw = new Database(path);
    sqliteVec.load(raw);
    removeVectorSchema(raw);
    raw.exec('DROP TABLE history_embeddings; PRAGMA user_version=4;');
    raw.close();
    const migrated = new HistoryDatabase(path);
    assert.equal(migrated.list().length, 1);
    assert.equal(migrated.listMemories().length, 1);
    assert.equal(await indexHistoryBatch(migrated, fake, new AbortController().signal), 2);
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
