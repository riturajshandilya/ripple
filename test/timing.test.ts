import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TimingLog } from '../src/mac/timing';

test('performance log stores only allowed timing metadata with restricted permissions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-timing-'));
  try {
    const path = join(dir, 'perf.jsonl');
    const log = new TimingLog(path);
    log.duration('transcription', 42, true);
    log.retrieval({
      durationMs: 9,
      historyCount: 1,
      memoryCount: 2,
      historyComplete: true,
      memoryComplete: false,
    });
    const entries = readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(Object.keys(entries[0]).sort(), ['durationMs', 'stage', 'success', 'time']);
    assert.deepEqual(Object.keys(entries[1]).sort(), [
      'durationMs',
      'historyComplete',
      'historyCount',
      'memoryComplete',
      'memoryCount',
      'stage',
      'time',
    ]);
    assert.equal(statSync(path).mode & 0o077, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
