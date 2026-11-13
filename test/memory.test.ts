import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { removeVectorSchema } from './vector-fixture';
import { HistoryDatabase } from '../src/history/database';
import { validateMemoryDecision } from '../src/memory/decision';

test('memories persist separately, can be corrected, found, and deleted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-memory-'));
  const path = join(dir, 'history.sqlite');
  try {
    let db = new HistoryDatabase(path);
    db.saveTurn('s', 'question', 'answer');
    const id = db.addMemory('coffee', 'I prefer black coffee');
    assert.equal(db.listMemories()[0].source, 'explicit_local');
    assert.equal(db.searchMemories('coffee')[0].id, id);
    db.close();
    db = new HistoryDatabase(path);
    assert.equal(db.listMemories()[0].content, 'I prefer black coffee');
    assert.equal(db.updateMemory(id, 'tea', 'I prefer green tea'), true);
    assert.equal(db.searchMemories('coffee').length, 0);
    assert.equal(db.searchMemories('tea')[0].content, 'I prefer green tea');
    assert.equal(db.deleteMemory(id), true);
    assert.equal(db.deleteMemory(id), false);
    assert.equal(db.searchMemories('tea').length, 0);
    assert.equal(db.list().length, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('memory search is bounded, literal and does not store unrequested facts', () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn('s', 'I like green tea', 'Noted');
    assert.equal(db.listMemories().length, 0);
    for (let i = 0; i < 5; i++) db.addMemory('coffee', `Preference ${i}`);
    assert.equal(db.searchMemories('coffee').length, 3);
    assert.throws(() => db.searchMemories('"*'));
    assert.throws(() => db.addMemory('', 'fact'));
    assert.throws(() => db.addMemory('topic', 'x'.repeat(501)));
  } finally {
    db.close();
  }
});
test('version 2 migration preserves history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-memory-'));
  const path = join(dir, 'history.sqlite');
  try {
    const db = new HistoryDatabase(path);
    db.saveTurn('s', 'old question', 'old answer');
    db.close();
    const raw = new Database(path);
    sqliteVec.load(raw);
    removeVectorSchema(raw);
    raw.exec(
      'DROP TABLE history_embeddings; DROP TABLE memory_embeddings; DROP TABLE memory_extraction_jobs; DROP TRIGGER memories_fts_insert; DROP TRIGGER memories_fts_delete; DROP TRIGGER memories_fts_update; DROP TABLE personal_memories_fts; DROP TABLE personal_memories; PRAGMA user_version = 2;',
    );
    raw.close();
    const migrated = new HistoryDatabase(path);
    assert.equal(migrated.list().length, 1);
    assert.equal(migrated.listMemories().length, 0);
    migrated.addMemory('topic', 'value');
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('memory decision validates action and bounded literal terms', () => {
  assert.deepEqual(validateMemoryDecision({ action: 'search', terms: ['coffee'] }), {
    action: 'search',
    terms: ['coffee'],
  });
  for (const value of [
    { action: 'search', terms: [] },
    { action: 'search', terms: ['coffee OR *'] },
    { action: 'skip', terms: ['coffee'] },
    { action: 'write', terms: [] },
    { action: 'skip', terms: [], extra: true },
  ])
    assert.throws(() => validateMemoryDecision(value));
});

test('automatic extraction jobs persist, retain source, deduplicate, and respect deletion', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-auto-'));
  const path = join(dir, 'db.sqlite');
  try {
    let db = new HistoryDatabase(path, 30, true);
    db.saveTurn('s', 'I prefer short workouts.', 'Okay.');
    const job = db.nextExtractionJob()!;
    assert.equal(job.messages.at(-1)?.content, 'I prefer short workouts.');
    db.close();
    db = new HistoryDatabase(path, 30, true);
    const candidate = {
      topic: 'exercise',
      content: 'Prefers short workouts',
      kind: 'preference' as const,
      basis: 'explicit' as const,
      change: 'new' as const,
      source_text: 'I prefer short workouts.',
    };
    assert.equal(db.finishExtraction(job.messageId, [candidate]), 1);
    assert.equal(db.finishExtraction(job.messageId, [candidate]), 0);
    assert.equal(db.listMemories()[0].source, 'automatic_unverified');
    assert.equal(db.listMemories()[0].sourceMessageId, job.messageId);
    db.saveTurn('s', 'I prefer short workouts.', 'Okay.');
    const duplicate = db.nextExtractionJob()!;
    assert.equal(db.finishExtraction(duplicate.messageId, [candidate]), 0);
    assert.equal(db.listMemories().length, 1);
    db.saveTurn('s', 'A third turn.', 'Okay.');
    const pending = db.nextExtractionJob()!;
    const conversation = (db.list()[0] as { id: string }).id;
    db.delete(conversation);
    assert.equal(db.finishExtraction(pending.messageId, [candidate]), 0);
    assert.equal(db.listMemories()[0].sourceMessageId, null);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('automatic jobs stop retrying after three failures; disabled mode creates no job', () => {
  const db = new HistoryDatabase(':memory:', 30, true);
  try {
    db.saveTurn('s', 'Question', 'Answer');
    const job = db.nextExtractionJob()!;
    db.failExtraction(job.messageId);
    db.failExtraction(job.messageId);
    db.failExtraction(job.messageId);
    assert.equal(db.nextExtractionJob(), null);
    assert.deepEqual(db.extractionCounts(), [{ status: 'failed', count: 1 }]);
  } finally {
    db.close();
  }
  const off = new HistoryDatabase(':memory:');
  try {
    off.saveTurn('s', 'q', 'a');
    assert.equal(off.nextExtractionJob(), null);
  } finally {
    off.close();
  }
});

test('worker processes new turns and does not log or write fabricated source text', async () => {
  const { MemoryWorker } = await import('../src/memory/worker');
  const db = new HistoryDatabase(':memory:', 30, true);
  let failures = 0;
  try {
    db.saveTurn('s', 'I prefer cycling.', 'Okay.');
    const worker = new MemoryWorker(
      db,
      {
        extract: async () => [
          {
            topic: 'exercise',
            content: 'Prefers cycling',
            kind: 'preference',
            basis: 'explicit',
            change: 'new',
            source_text: 'I prefer cycling.',
          },
        ],
      },
      () => failures++,
    );
    await worker.tick();
    assert.equal(db.listMemories()[0].content, 'Prefers cycling');
    assert.equal(failures, 0);
    await worker.stop();
    db.saveTurn('s', 'Just a question?', 'Okay.');
    const invalid = new MemoryWorker(
      db,
      {
        extract: async () => [
          {
            topic: 'bad',
            content: 'fabricated',
            kind: 'personal_fact',
            basis: 'explicit',
            change: 'new',
            source_text: 'not in the turn',
          },
        ],
      },
      () => failures++,
    );
    await invalid.tick();
    assert.equal(db.listMemories().length, 1);
    assert.equal(failures, 1);
    await invalid.stop();
  } finally {
    db.close();
  }
});

test('a pending older extraction cannot replace a manually corrected exact topic', () => {
  const db = new HistoryDatabase(':memory:', 30, true);
  try {
    db.saveTurn('s', 'I prefer short workouts.', 'Okay.');
    const job = db.nextExtractionJob()!;
    db.addMemory('exercise', 'prefers old workouts');
    assert.equal(db.correctMemoryByTopic('exercise', 'prefers longer workouts'), 'updated');
    assert.equal(
      db.finishExtraction(job.messageId, [
        {
          topic: 'exercise',
          content: 'Prefers short workouts',
          kind: 'preference',
          basis: 'explicit',
          change: 'new',
          source_text: 'I prefer short workouts.',
        },
      ]),
      0,
    );
    assert.deepEqual(
      db.listMemories().map((m) => m.content),
      ['prefers longer workouts'],
    );
  } finally {
    db.close();
  }
});
