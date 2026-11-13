import { HistoryDatabase } from '../src/history/database';
import { localEmbedder, semanticMemorySearch } from '../src/memory/semantic';

// Synthetic fixtures only; in-memory SQLite; does not read or modify personal data.
(async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    db.addMemory('fitness', 'Prefers workouts shorter than thirty minutes');
    db.addMemory('coffee', 'Prefers black coffee');
    db.addMemory('programming', 'Likes TypeScript');
    for (const query of [
      'exercise preferences',
      'coffee preferences',
      'TypeScript coding',
      'favorite movie',
    ]) {
      const start = Date.now();
      const results = await semanticMemorySearch(
        db,
        localEmbedder(),
        query,
        AbortSignal.timeout(30000),
      );
      console.log(
        JSON.stringify({
          query,
          results: results.map((x) => ({
            topic: x.memory.topic,
            score: Number(x.score.toFixed(3)),
          })),
          elapsedMs: Date.now() - start,
        }),
      );
    }
  } finally {
    db.close();
  }
})().catch(() => {
  console.error('Semantic evaluation failed; check local Ollama and model.');
  process.exitCode = 1;
});
