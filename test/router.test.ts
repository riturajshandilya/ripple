import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beforeDeadline, validateRoute } from '../src/retrieval/router';

test('router validates route and literal bounded terms', () => {
  assert.deepEqual(
    validateRoute({ route: 'search_history', searchTerms: ['india', 'population'] }),
    { route: 'search_history', searchTerms: ['india', 'population'] },
  );
  for (const value of [
    { route: 'search_history', searchTerms: ['redis OR *'] },
    { route: 'search_history', searchTerms: [] },
    { route: 'direct', searchTerms: ['secret'] },
    { route: 'unknown', searchTerms: [] },
    { route: 'direct', searchTerms: [], extra: 1 },
  ])
    assert.throws(() => validateRoute(value));
});
test('deadline rejects slow work', async () => {
  await assert.rejects(
    beforeDeadline(new Promise((resolve) => setTimeout(resolve, 50)), 5),
    /Deadline/,
  );
});
