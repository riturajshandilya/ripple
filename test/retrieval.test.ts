import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryDatabase } from '../src/history/database';
import { historyQuery } from '../src/retrieval/retrieval';

test('routes explicit requests for earlier conversation and extracts a bounded query', () => {
  assert.equal(
    historyQuery('What did we talk about regarding the Indian population?'),
    'india population',
  );
  assert.equal(
    historyQuery('What was my first question about India’s population?'),
    'india population',
  );
  assert.equal(historyQuery('What is the population of India?'), null);
  assert.equal(historyQuery('Explain Redis caching'), null);
  assert.equal(historyQuery('What did we talk about?'), null);
});
test('retrieval finds old user question with neighboring answer and excludes unrelated conversations', () => {
  const history = new HistoryDatabase(':memory:');
  try {
    history.saveTurn('one', 'What is the population of India?', 'About 1.4 billion.');
    history.saveTurn('one', 'How many are men?', 'An estimate.');
    history.saveTurn('two', 'What is Redis?', 'A data store.');
    const records = history.findEvidence('india population');
    assert.equal(records.length, 1);
    assert.deepEqual(
      records[0].messages.slice(0, 2).map((m) => m.content),
      ['What is the population of India?', 'About 1.4 billion.'],
    );
    assert.equal(history.findEvidence('missingtopic').length, 0);
  } finally {
    history.close();
  }
});
