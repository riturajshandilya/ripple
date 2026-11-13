import { HistoryDatabase } from '../src/history/database';
import { localEmbedder } from '../src/memory/semantic';
import { hybridHistorySearch, indexHistoryBatch } from '../src/retrieval/history-semantic';

// Synthetic conversations in memory only; no personal database is opened.
(async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.saveTurn(
      'fitness',
      'I prefer workouts shorter than thirty minutes.',
      'Short workouts can be effective.',
    );
    db.saveTurn('coffee', 'How do I make black coffee?', 'Use freshly ground coffee.');
    await indexHistoryBatch(db, localEmbedder(), AbortSignal.timeout(30000));
    for (const query of ['exercise', 'coffee', 'saturn']) {
      const start = Date.now();
      const result = await hybridHistorySearch(
        db,
        localEmbedder(),
        query,
        AbortSignal.timeout(10000),
      );
      console.log(
        JSON.stringify({
          query,
          conversationCount: result.evidence.length,
          firstMessage: result.evidence[0]?.messages[0]?.content ?? null,
          complete: result.complete,
          elapsedMs: Date.now() - start,
        }),
      );
    }
  } finally {
    db.close();
  }
})().catch(() => {
  console.error('Synthetic history evaluation failed.');
  process.exitCode = 1;
});
