import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { DictationHistory, type DictationRecord } from '../src/dictation/history';
import { handleHistoryRequest } from '../src/dictation/history-worker';

test('local dictation history persists raw and polished text, supports deletion, and restricts the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-history-'));
  const path = join(dir, 'dictations.sqlite');
  try {
    let db = new DictationHistory(path);
    const id = db.add({
      rawText: 'um hello',
      text: 'Hello.',
      mode: 'polish',
      style: 'plain',
      outputMode: 'spoken',
      targetLanguage: 'English',
      status: 'polished',
    });
    assert.equal(statSync(path).mode & 0o077, 0);
    db.close();
    db = new DictationHistory(path);
    assert.equal(db.list()[0].rawText, 'um hello');
    assert.equal(db.list()[0].text, 'Hello.');
    assert.equal(db.delete(id), true);
    assert.equal(db.list().length, 0);
    db.add({
      rawText: 'one',
      text: 'one',
      mode: 'raw',
      style: 'plain',
      outputMode: 'spoken',
      targetLanguage: 'English',
      status: 'raw',
    });
    assert.equal(db.clear(), 1);
    assert.equal(db.list().length, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('history v1 is migrated with spoken-language defaults without dropping rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-history-v1-'));
  const path = join(dir, 'dictations.sqlite');
  try {
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE dictations (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, raw_text TEXT NOT NULL, final_text TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('raw','polish')),
        style TEXT NOT NULL CHECK (style IN ('plain','email','code')),
        status TEXT NOT NULL CHECK (status IN ('raw','polished','fallback'))
      );
      INSERT INTO dictations VALUES ('legacy-id','2026-01-01T00:00:00.000Z','नमस्ते','नमस्ते','raw','plain','raw');
      PRAGMA user_version=1;
    `);
    legacy.close();

    const history = new DictationHistory(path);
    const [record] = history.list();
    assert.equal(record.rawText, 'नमस्ते');
    assert.equal(record.outputMode, 'spoken');
    assert.equal(record.targetLanguage, 'English');
    assert.equal(record.status, 'raw');
    history.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('history worker supports reformatting an existing record with presets, raw revert, and custom instructions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-history-reformat-'));
  const path = join(dir, 'dictations.sqlite');
  try {
    const db = new DictationHistory(path);
    const id = db.add({
      rawText: 'hey team let us meet at 5 no 6 pm',
      text: 'hey team let us meet at 5 no 6 pm',
      mode: 'raw',
      style: 'plain',
      outputMode: 'spoken',
      targetLanguage: 'English',
      status: 'raw',
    });
    db.close();

    let lastCall: { text: string; style: string; options: unknown } | undefined;
    const mockFormatter = () => ({
      id: 'mock',
      location: 'local' as const,
      format: async (text: string, style: string, options?: unknown) => {
        lastCall = { text, style, options };
        return 'Hi team,\n\nLet us meet at 6 PM.\n\nBest regards,';
      },
    });

    const polished = (await handleHistoryRequest(
      {
        action: 'reformat',
        id,
        mode: 'polish',
        style: 'email',
        outputMode: 'spoken',
        targetLanguage: 'English',
      },
      path,
      mockFormatter,
    )) as DictationRecord;
    assert.equal(polished.text, 'Hi team,\n\nLet us meet at 6 PM.\n\nBest regards,');
    assert.equal(polished.mode, 'polish');
    assert.equal(polished.style, 'email');
    assert.equal(polished.status, 'polished');
    assert.equal(polished.rawText, 'hey team let us meet at 5 no 6 pm');
    assert.deepEqual(lastCall, {
      text: 'hey team let us meet at 5 no 6 pm',
      style: 'email',
      options: { outputMode: 'spoken', targetLanguage: 'English', polish: true },
    });

    const reverted = (await handleHistoryRequest(
      {
        action: 'reformat',
        id,
        mode: 'raw',
        style: 'plain',
        outputMode: 'spoken',
        targetLanguage: 'English',
      },
      path,
      () => {
        throw Error('should not call formatter for raw spoken revert');
      },
    )) as DictationRecord;
    assert.equal(reverted.text, 'hey team let us meet at 5 no 6 pm');
    assert.equal(reverted.mode, 'raw');
    assert.equal(reverted.status, 'raw');

    const custom = (await handleHistoryRequest(
      {
        action: 'reformat',
        id,
        mode: 'polish',
        style: 'plain',
        outputMode: 'spoken',
        targetLanguage: 'English',
        instruction: 'Turn this into a one-line bullet point',
      },
      path,
      () => ({
        id: 'mock',
        location: 'local' as const,
        format: async (text, style, options) => {
          lastCall = { text, style, options };
          return '• Meet at 6 PM.';
        },
      }),
    )) as DictationRecord;
    assert.equal(custom.text, '• Meet at 6 PM.');
    assert.equal(custom.status, 'polished');
    assert.deepEqual(lastCall, {
      text: 'Turn this into a one-line bullet point',
      style: 'plain',
      options: {
        outputMode: 'spoken',
        targetLanguage: 'English',
        polish: true,
        selectionText: 'hey team let us meet at 5 no 6 pm',
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('handleHistoryRequest enforces strict request validation, rejects invalid inputs, and deletes individual records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-history-validation-'));
  const path = join(dir, 'dictations.sqlite');
  try {
    const validId = '11111111-1111-1111-1111-111111111111';
    const nonExistentId = '22222222-2222-2222-2222-222222222222';

    // 1. Invalid requests and actions
    await assert.rejects(() => handleHistoryRequest(null, path), /Invalid request/);
    await assert.rejects(() => handleHistoryRequest([], path), /Invalid request/);
    await assert.rejects(() => handleHistoryRequest('list', path), /Invalid request/);
    await assert.rejects(() => handleHistoryRequest({ action: 'unknown' }, path), /Invalid action/);

    // 2. Unexpected keys
    await assert.rejects(
      () => handleHistoryRequest({ action: 'list', unexpected: true }, path),
      /Invalid request/,
    );
    await assert.rejects(
      () => handleHistoryRequest({ action: 'clear', unexpected: true }, path),
      /Invalid request/,
    );
    await assert.rejects(
      () => handleHistoryRequest({ action: 'delete', id: validId, extra: 1 }, path),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'spoken',
            targetLanguage: 'English',
            extraField: 'not-allowed',
          },
          path,
        ),
      /Invalid request/,
    );

    // 3. Invalid UUIDs
    await assert.rejects(
      () => handleHistoryRequest({ action: 'delete', id: 'not-a-uuid' }, path),
      /Invalid request/,
    );
    await assert.rejects(
      () => handleHistoryRequest({ action: 'delete', id: '' }, path),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: 'not-a-uuid',
            mode: 'polish',
            style: 'plain',
            outputMode: 'spoken',
            targetLanguage: 'English',
          },
          path,
        ),
      /Invalid request/,
    );

    // 4. Invalid reformat options
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'unsupported-mode',
            style: 'plain',
            outputMode: 'spoken',
            targetLanguage: 'English',
          },
          path,
        ),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'unsupported-style',
            outputMode: 'spoken',
            targetLanguage: 'English',
          },
          path,
        ),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'unsupported-output',
            targetLanguage: 'English',
          },
          path,
        ),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'translate',
            targetLanguage: '123',
          },
          path,
        ),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'translate',
            targetLanguage: '',
          },
          path,
        ),
      /Invalid request/,
    );
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: validId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'spoken',
            targetLanguage: 'English',
            instruction: 'x'.repeat(501),
          },
          path,
        ),
      /Invalid request/,
    );

    // 5. Non-existent record ID
    await assert.rejects(
      () =>
        handleHistoryRequest(
          {
            action: 'reformat',
            id: nonExistentId,
            mode: 'polish',
            style: 'plain',
            outputMode: 'spoken',
            targetLanguage: 'English',
          },
          path,
        ),
      /Record not found/,
    );

    // 6. Single-entry delete via handleHistoryRequest
    const db = new DictationHistory(path);
    const createdId = db.add({
      rawText: 'to be deleted',
      text: 'To be deleted.',
      mode: 'raw',
      style: 'plain',
      outputMode: 'spoken',
      targetLanguage: 'English',
      status: 'raw',
    });
    db.close();

    const deleted = await handleHistoryRequest({ action: 'delete', id: createdId }, path);
    assert.equal(deleted, true);

    const checkDb = new DictationHistory(path);
    assert.equal(checkDb.list().length, 0);
    assert.equal(checkDb.get(createdId), undefined);
    checkDb.close();

    // Deleting again returns false
    const deletedAgain = await handleHistoryRequest({ action: 'delete', id: createdId }, path);
    assert.equal(deletedAgain, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
