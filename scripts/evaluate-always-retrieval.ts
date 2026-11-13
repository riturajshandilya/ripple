import { HistoryDatabase } from '../src/history/database';
import { localEmbedder } from '../src/memory/semantic';
import { indexMemoryBatch } from '../src/memory/index-worker';
import { indexHistoryBatch } from '../src/retrieval/history-semantic';
import { retrieveAlways } from '../src/retrieval/always';
// Synthetic in-memory data only; never reads personal history.
(async () => {
  const db = new HistoryDatabase(':memory:');
  const embedder = localEmbedder();
  try {
    db.addMemory('fitness', 'Prefers workouts shorter than thirty minutes');
    db.addMemory('drinks', 'Prefers black coffee');
    db.saveTurn(
      'fitness',
      'I prefer workouts shorter than thirty minutes.',
      'Short workouts can be effective.',
    );
    db.saveTurn('coffee', 'How do I prepare black coffee?', 'Use freshly ground coffee.');
    await indexMemoryBatch(db, embedder, AbortSignal.timeout(30000));
    await indexHistoryBatch(db, embedder, AbortSignal.timeout(30000));
    for (const q of [
      'What exercise fits my preferences?',
      'What did we discuss about coffee?',
      'How do I deploy a Node server?',
      'Tell me about Saturn',
    ]) {
      const start = Date.now();
      const result = await retrieveAlways(db, embedder, q, AbortSignal.timeout(10000));
      console.log(
        JSON.stringify({
          query: q,
          memoryTopics: result.personalMemory.records.map((m) => m.topic),
          historyExcerpts: result.history.records.map((c) => c.messages[0]?.content),
          complete: result.history.complete && result.personalMemory.complete,
          elapsedMs: Date.now() - start,
        }),
      );
    }
  } finally {
    db.close();
  }
})().catch(() => {
  console.error('Synthetic retrieval evaluation failed.');
  process.exitCode = 1;
});
