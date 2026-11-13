import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryDatabase } from '../src/history/database';
import { embeddingHash, embeddingText, type Embedder } from '../src/memory/semantic';
import { retrieveAlways } from '../src/retrieval/always';
import { indexMemoryBatch } from '../src/memory/index-worker';
import { indexHistoryBatch } from '../src/retrieval/history-semantic';

const model = 'nomic-embed-text:latest';
const vec = (similarity: number) => {
  const v = Array(768).fill(0);
  v[0] = similarity;
  v[1] = Math.sqrt(1 - similarity * similarity);
  return v;
};
test('SQLite returns only top vectors at or above cosine threshold; updates and deletes remove stale vectors', () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const high = db.addMemory('high', 'high memory'),
      low = db.addMemory('low', 'low memory');
    for (const m of db.listMemories())
      db.saveMemoryEmbedding(
        m.id,
        model,
        embeddingHash(embeddingText(m)),
        vec(m.id === high ? 0.8 : 0.64),
      );
    const results = db.vectorMemoryHits(vec(1));
    assert.deepEqual(
      results.map((x) => x.id),
      [high],
    );
    assert.ok(results[0].score >= 0.65);
    db.updateMemory(high, 'changed', 'new content');
    assert.equal(db.vectorMemoryHits(vec(1)).length, 0);
    db.deleteMemory(low);
    db.saveTurn('s', 'high question', 'low answer');
    for (const m of db.recentHistoryMessages())
      db.saveHistoryEmbedding(
        m.id,
        model,
        embeddingHash(m.content),
        vec(m.content.startsWith('high') ? 0.8 : 0.64),
      );
    assert.deepEqual(db.vectorHistoryHits(vec(1)).map((x) => x.id).length, 1);
    const conversation = (db.list()[0] as { id: string }).id;
    db.delete(conversation);
    assert.equal(db.vectorHistoryHits(vec(1)).length, 0);
  } finally {
    db.close();
  }
});
test('one query embedding retrieves both sources and uses bounded results', async () => {
  const db = new HistoryDatabase(':memory:');
  const calls: string[][] = [];
  const embedder: Embedder = {
    model,
    async embed(texts) {
      calls.push(texts);
      return texts.map(() => vec(0.9));
    },
  };
  try {
    db.addMemory('fitness', 'Prefers short workouts');
    db.saveTurn('s', 'I prefer workouts', 'Okay');
    await indexMemoryBatch(db, embedder, new AbortController().signal);
    await indexHistoryBatch(db, embedder, new AbortController().signal);
    calls.length = 0;
    const result = await retrieveAlways(
      db,
      embedder,
      'What exercise do I prefer?',
      new AbortController().signal,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].length, 1);
    assert.equal(result.personalMemory.records.length, 1);
    assert.equal(result.history.records.length, 1);
    assert.equal(result.personalMemory.complete, true);
    assert.equal(result.history.complete, true);
  } finally {
    db.close();
  }
});
test('provider outage falls back to keywords and reports incomplete retrieval', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn('s', 'Redis caching', 'A cache');
    const embedder: Embedder = {
      model,
      async embed() {
        throw Error('offline');
      },
    };
    const r = await retrieveAlways(
      db,
      embedder,
      'What did we say about Redis?',
      new AbortController().signal,
    );
    assert.equal(r.history.records.length, 1);
    assert.equal(r.history.complete, false);
  } finally {
    db.close();
  }
});

test('schema upgrade backfills existing vectors and keeps source data', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { default: Database } = await import('better-sqlite3');
  const sqliteVec = await import('sqlite-vec');
  const { removeVectorSchema } = await import('./vector-fixture');
  const dir = mkdtempSync(join(tmpdir(), 'ripple-vec-'));
  const path = join(dir, 'db.sqlite');
  try {
    let db = new HistoryDatabase(path);
    const id = db.addMemory('fitness', 'short workouts');
    const memory = db.listMemories()[0];
    db.saveMemoryEmbedding(id, model, embeddingHash(embeddingText(memory)), vec(0.8));
    db.saveTurn('s', 'exercise question', 'answer');
    const msg = db.recentHistoryMessages().find((m) => m.content === 'exercise question')!;
    db.saveHistoryEmbedding(msg.id, model, embeddingHash(msg.content), vec(0.8));
    db.close();
    const old = new Database(path);
    sqliteVec.load(old);
    removeVectorSchema(old);
    old.pragma('user_version = 5');
    old.close();
    db = new HistoryDatabase(path);
    assert.equal(db.vectorMemoryHits(vec(1))[0].id, id);
    assert.equal(db.vectorHistoryHits(vec(1))[0].id, msg.id);
    assert.equal(db.list().length, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrected memory is available by literal topic while its vector is being rebuilt', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('exercise', 'short workouts');
    assert.equal(db.correctMemoryByTopic('exercise', '45 minute workouts'), 'updated');
    const result = await retrieveAlways(
      db,
      {
        model: 'test',
        embed: async () => {
          throw Error('offline');
        },
      },
      'What is my exercise preference?',
      AbortSignal.timeout(1000),
    );
    assert.equal(
      result.personalMemory.records.some((r) => r.content === '45 minute workouts'),
      true,
    );
    assert.equal(result.personalMemory.complete, false);
    assert.equal(db.listMemories()[0].id, id);
  } finally {
    db.close();
  }
});

test('recent topic helps a pronoun follow-up retrieve the relevant memory', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.addMemory('drink preference', 'Diet Coke');
    const withoutContext = await retrieveAlways(
      db,
      {
        model: 'test',
        embed: async () => {
          throw Error('offline');
        },
      },
      'I want to update it to Mountain Dew',
      AbortSignal.timeout(1000),
    );
    assert.equal(withoutContext.personalMemory.records.length, 0);
    const withContext = await retrieveAlways(
      db,
      {
        model: 'test',
        embed: async () => {
          throw Error('offline');
        },
      },
      'I want to update it to Mountain Dew',
      AbortSignal.timeout(1000),
      ['What is my favorite drink?'],
    );
    assert.equal(withContext.personalMemory.records[0].topic, 'drink preference');
    assert.ok(withContext.personalMemory.records[0].id);
  } finally {
    db.close();
  }
});
