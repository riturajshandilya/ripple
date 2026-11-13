import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCandidates, createMemoryExtractor } from '../src/memory/extraction';

const text = 'I prefer workouts shorter than thirty minutes.';
const item = {
  topic: 'workout duration',
  content: 'Prefers workouts shorter than 30 minutes',
  kind: 'preference',
  basis: 'explicit',
  change: 'new',
  source_text: text,
};
test('accepts empty extraction or bounded candidate citing the current user message', () => {
  assert.deepEqual(validateCandidates({ candidates: [] }, text), []);
  assert.deepEqual(validateCandidates({ candidates: [item] }, text), [item]);
});
test('rejects unsupported fields, mismatched evidence, overlong and too many candidates', () => {
  for (const value of [
    { candidates: [{ ...item, source_text: 'invented' }] },
    { candidates: [{ ...item, kind: 'other' }] },
    { candidates: [{ ...item, extra: 'field' }] },
    { candidates: [{ ...item, content: 'x'.repeat(501) }] },
    { candidates: [item, item, item, item] },
    { candidates: [item], extra: true },
  ])
    assert.throws(() => validateCandidates(value, text));
});
test('does not make provider calls without a valid current user turn', async () => {
  const extractor = createMemoryExtractor('groq', 'test-key', 'test-model');
  await assert.rejects(
    extractor.extract([{ role: 'assistant', content: 'hello' }], 1000),
    /user message/,
  );
  await assert.rejects(
    extractor.extract([{ role: 'user', content: 'x'.repeat(1001) }], 1000),
    /user message/,
  );
});
