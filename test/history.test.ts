import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { HistoryDatabase } from '../src/history/database';

test('turns persist across reopen, are isolated, and deletion cascades', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-test-'));
  const path = join(dir, 'private', 'history.sqlite');
  try {
    let history = new HistoryDatabase(path);
    history.saveTurn('one', 'question one', 'answer one');
    history.saveTurn('one', 'follow up', 'answer two');
    history.saveTurn('two', 'another', 'response');
    const rows = history.list() as { id: string }[];
    assert.equal(rows.length, 2);
    const conversation = rows.find((r) => history.messages(r.id).length === 4)!;
    assert.ok(conversation);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    history.close();
    history = new HistoryDatabase(path);
    assert.deepEqual(
      (history.messages(conversation.id) as { content: string }[]).map((m) => m.content),
      ['question one', 'answer one', 'follow up', 'answer two'],
    );
    assert.equal(history.delete(conversation.id), true);
    assert.equal(history.messages(conversation.id).length, 0);
    assert.equal(history.list().length, 1);
    history.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('failed message write rolls back entire turn', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-test-'));
  const path = join(dir, 'db.sqlite');
  try {
    const history = new HistoryDatabase(path);
    const raw = new Database(path);
    sqliteVec.load(raw);
    raw.exec(
      "CREATE TRIGGER reject_assistant BEFORE INSERT ON messages WHEN NEW.role = 'assistant' BEGIN SELECT RAISE(ABORT, 'failed'); END",
    );
    assert.throws(() => history.saveTurn('s', 'question', 'answer'));
    assert.equal(history.list().length, 0);
    raw.close();
    history.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('retention deletes old conversations and messages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-test-'));
  const path = join(dir, 'db.sqlite');
  try {
    const history = new HistoryDatabase(path, 30);
    history.saveTurn('s', 'q', 'a');
    const id = (history.list()[0] as { id: string }).id;
    const raw = new Database(path);
    sqliteVec.load(raw);
    raw.prepare('UPDATE conversations SET updated_at = ?').run('2000-01-01T00:00:00.000Z');
    raw.close();
    assert.equal(history.prune(), 1);
    assert.equal(history.messages(id).length, 0);
    history.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search indexes existing version 1 history and new turns, with literal bounded queries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-search-'));
  const path = join(dir, 'history.sqlite');
  try {
    const raw = new Database(path);
    sqliteVec.load(raw);
    raw.exec(`CREATE TABLE conversations (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX messages_conversation ON messages(conversation_id, id);
      INSERT INTO conversations VALUES ('old', 'hash', '2026-01-01', '2999-01-01');
      INSERT INTO messages VALUES (1, 'old', 'user', 'Redis cache invalidation strategies', '2026-01-01');
      PRAGMA user_version = 1;`);
    raw.close();
    const history = new HistoryDatabase(path);
    assert.equal(history.search('redis cache')[0].conversationId, 'old');
    history.saveTurn('new', 'Redis Redis Redis caching', 'Database index');
    assert.equal(history.search('redis').length, 2);
    assert.equal(history.search('Redis OR caching').length, 0);
    assert.throws(() => history.search('"*'), /between 1 and 12/);
    assert.throws(() => history.search('x'.repeat(201)), /200/);
    assert.equal(history.delete('old'), true);
    assert.equal(history.search('invalidation').length, 0);
    history.close();
    const reopened = new HistoryDatabase(path);
    assert.equal(reopened.search('redis').length, 1);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search index follows message updates and retention deletion', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-search-'));
  const path = join(dir, 'history.sqlite');
  try {
    const history = new HistoryDatabase(path, 30);
    history.saveTurn('session', 'oldword', 'answer');
    const raw = new Database(path);
    sqliteVec.load(raw);
    raw.prepare("UPDATE messages SET content='newword' WHERE content='oldword'").run();
    assert.equal(history.search('oldword').length, 0);
    assert.equal(history.search('newword').length, 1);
    raw.prepare("UPDATE conversations SET updated_at='2000-01-01T00:00:00.000Z'").run();
    assert.equal(history.prune(), 1);
    assert.equal(history.search('newword').length, 0);
    raw.close();
    history.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search ranks a concentrated match ahead of a weak match', () => {
  const history = new HistoryDatabase(':memory:');
  try {
    history.saveTurn('strong', 'redis redis redis redis redis', 'ok');
    history.saveTurn('weak', 'redis apple banana cherry date elderberry fig grape', 'ok');
    const results = history.search('redis');
    assert.equal(results.length, 2);
    assert.match(results[0].snippet, /\[redis\] \[redis\]/i);
  } finally {
    history.close();
  }
});
