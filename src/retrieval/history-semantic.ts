import type { HistoryDatabase } from '../history/database';
import type { Evidence } from './retrieval';
import { cosine, embeddingHash, localEmbedder, type Embedder } from '../memory/semantic';

export interface HistoryRetrievalResult {
  evidence: Evidence[];
  complete: boolean;
}
export interface HybridHistoryLookup {
  find(query: string, timeoutMs: number): Promise<HistoryRetrievalResult>;
}

type Hit = { id: number; conversationId: string };
// Rank fusion: use ranks, never combine incomparable BM25 and cosine scores directly.
export function fuseRanks(lexical: Hit[], semantic: Hit[]): Hit[] {
  const fused = new Map<number, { hit: Hit; score: number }>();
  for (const list of [lexical, semantic])
    list.forEach((hit, index) => {
      const existing = fused.get(hit.id);
      fused.set(hit.id, { hit, score: (existing?.score ?? 0) + 1 / (60 + index + 1) });
    });
  return [...fused.values()]
    .sort((a, b) => b.score - a.score || b.hit.id - a.hit.id)
    .slice(0, 4)
    .map((x) => x.hit);
}

export async function indexHistoryBatch(
  db: HistoryDatabase,
  embedder: Embedder,
  signal: AbortSignal,
): Promise<number> {
  const unindexed = db
    .recentHistoryMessages()
    .map((m) => ({ ...m, hash: embeddingHash(m.content) }))
    .filter((m) => !db.getHistoryEmbedding(m.id, embedder.model, m.hash))
    .slice(0, 16);
  if (!unindexed.length) return 0;
  const vectors = await embedder.embed(
    unindexed.map((m) => `search_document: ${m.content}`),
    signal,
  );
  if (signal.aborted) throw new Error('Indexing cancelled');
  let saved = 0;
  for (let i = 0; i < unindexed.length; i++)
    if (db.saveHistoryEmbedding(unindexed[i].id, embedder.model, unindexed[i].hash, vectors[i]))
      saved++;
  return saved;
}

export async function hybridHistorySearch(
  db: HistoryDatabase,
  embedder: Embedder,
  query: string,
  signal: AbortSignal,
): Promise<HistoryRetrievalResult> {
  const lexical = db.keywordHistoryHits(query);
  const messages = db.recentHistoryMessages();
  if (!messages.length) return { evidence: [], complete: true };
  const records = messages.map((message) => ({
    ...message,
    vector: db.getHistoryEmbedding(message.id, embedder.model, embeddingHash(message.content)),
  }));
  const indexed = records.filter((r) => r.vector !== null);
  let available = true;
  let semantic: Hit[] = [];
  if (indexed.length) {
    try {
      const vector = (await embedder.embed([`search_query: ${query}`], signal))[0];
      if (signal.aborted) throw new Error('Search cancelled');
      semantic = indexed
        .map((r) => ({
          hit: { id: r.id, conversationId: r.conversationId },
          score: cosine(vector, r.vector!),
        }))
        .filter((r) => r.score >= 0.65)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((r) => r.hit);
    } catch {
      available = false;
    }
  } else available = false;
  // A concurrent deletion must not be restored from stale in-memory results.
  const current = new Set(db.recentHistoryMessages().map((m) => m.id));
  const hits = fuseRanks(
    lexical,
    semantic.filter((hit) => current.has(hit.id)),
  );
  return {
    evidence: db.evidenceForHits(hits),
    complete: available && indexed.length === records.length && !db.hasMoreHistory(),
  };
}
export function createHybridHistoryLookup(db: HistoryDatabase): HybridHistoryLookup {
  return {
    find: (query, timeoutMs) =>
      hybridHistorySearch(db, localEmbedder(), query, AbortSignal.timeout(timeoutMs)),
  };
}

export class HistoryEmbeddingWorker {
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
        await indexHistoryBatch(this.db, this.embedder, AbortSignal.timeout(20000));
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
