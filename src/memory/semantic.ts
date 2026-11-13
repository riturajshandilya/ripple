import { createHash } from 'node:crypto';
import type { HistoryDatabase, MemoryRecord } from '../history/database';

export interface Embedder {
  model: string;
  embed(texts: string[], signal: AbortSignal): Promise<number[][]>;
}
export interface SemanticMatch {
  memory: MemoryRecord;
  score: number;
}
export const embeddingText = (m: MemoryRecord) => `${m.topic}\n${m.content}`;
export const embeddingHash = (text: string) => createHash('sha256').update(text).digest('hex');
export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) throw new Error('Embedding dimensions differ');
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('Invalid embedding');
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  if (!aa || !bb) throw new Error('Invalid embedding');
  return dot / Math.sqrt(aa * bb);
}
export function localEmbedder(): Embedder {
  return {
    model: 'nomic-embed-text:latest',
    async embed(texts, signal) {
      const response = await fetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text:latest', input: texts }),
        signal,
      });
      if (!response.ok) throw new Error('Embedding service unavailable');
      const data = (await response.json()) as { embeddings?: unknown };
      if (
        !Array.isArray(data.embeddings) ||
        data.embeddings.length !== texts.length ||
        !data.embeddings.every(
          (v) =>
            Array.isArray(v) &&
            v.length > 0 &&
            v.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)),
        )
      )
        throw new Error('Invalid embedding response');
      return data.embeddings as number[][];
    },
  };
}
export async function semanticMemorySearch(
  db: HistoryDatabase,
  embedder: Embedder,
  query: string,
  signal: AbortSignal,
): Promise<SemanticMatch[]> {
  if (!query.trim() || query.length > 1000) throw new Error('Invalid semantic query');
  const memories = db.listMemories().slice(0, 500);
  if (!memories.length) return [];
  const records = memories.map((memory) => {
    const text = embeddingText(memory);
    const hash = embeddingHash(text);
    return { memory, text, hash, vector: db.getMemoryEmbedding(memory.id, embedder.model, hash) };
  });
  const missing = records.filter((r) => !r.vector);
  // Query and missing records are embedded together; the model and input prefixes must match.
  const input = [`search_query: ${query}`, ...missing.map((r) => `search_document: ${r.text}`)];
  const vectors = await embedder.embed(input, signal);
  const queryVector = vectors[0];
  for (let i = 0; i < missing.length; i++) {
    const record = missing[i];
    record.vector = vectors[i + 1];
    db.saveMemoryEmbedding(record.memory.id, embedder.model, record.hash, record.vector);
  }
  const current = new Map(db.listMemories().map((m) => [m.id, embeddingHash(embeddingText(m))]));
  return records
    .filter((r) => current.get(r.memory.id) === r.hash)
    .map((r) => ({ memory: r.memory, score: cosine(queryVector, r.vector!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export interface PersonalMemoryLookup {
  findRelevant(
    question: string,
    timeoutMs: number,
  ): Promise<import('../llm/provider').PersonalMemoryContext>;
}
export function createPersonalMemoryLookup(db: HistoryDatabase): PersonalMemoryLookup {
  return {
    async findRelevant(question, timeoutMs) {
      try {
        const results = await semanticMemorySearch(
          db,
          localEmbedder(),
          question,
          AbortSignal.timeout(timeoutMs),
        );
        const top = results.filter((r) => r.score >= 0.65).slice(0, 1);
        return {
          state: 'available',
          records: top.map(({ memory }) => ({
            topic: memory.topic,
            content: memory.content,
            source: memory.source,
          })),
        };
      } catch {
        return { state: 'unavailable', records: [] };
      }
    },
  };
}
