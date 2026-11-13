import type { HistoryDatabase } from '../history/database';
import { embeddingHash, embeddingText, type Embedder } from './semantic';
export async function indexMemoryBatch(
  db: HistoryDatabase,
  embedder: Embedder,
  signal: AbortSignal,
): Promise<number> {
  const pending = db
    .recentMemoriesForIndex()
    .map((memory) => {
      const text = embeddingText(memory);
      const hash = embeddingHash(text);
      return { memory, text, hash };
    })
    .filter((x) => !db.getMemoryEmbedding(x.memory.id, embedder.model, x.hash))
    .slice(0, 16);
  if (!pending.length) return 0;
  const vectors = await embedder.embed(
    pending.map((x) => `search_document: ${x.text}`),
    signal,
  );
  if (signal.aborted) throw Error('Indexing cancelled');
  let saved = 0;
  for (let i = 0; i < pending.length; i++)
    if (db.saveMemoryEmbedding(pending[i].memory.id, embedder.model, pending[i].hash, vectors[i]))
      saved++;
  return saved;
}
export class MemoryEmbeddingWorker {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;
  private retryAfter = 0;
  constructor(
    private readonly db: HistoryDatabase,
    private readonly embedder: Embedder,
    private readonly onFailure: () => void = () => {},
  ) {}
  start(): void {
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    this.timer.unref();
    void this.tick();
  }
  async tick(): Promise<void> {
    if (this.stopping || this.running || Date.now() < this.retryAfter) return;
    this.running = (async () => {
      try {
        await indexMemoryBatch(this.db, this.embedder, AbortSignal.timeout(20000));
      } catch {
        this.retryAfter = Date.now() + 30000;
        this.onFailure();
      }
    })();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
