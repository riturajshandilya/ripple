import type { HistoryDatabase } from '../history/database';
import type { Evidence } from './retrieval';
import type { PersonalMemoryContext } from '../llm/provider';
import { localEmbedder, type Embedder } from '../memory/semantic';
import { fuseRanks } from './history-semantic';

export interface RetrievalContext {
  history: { records: Evidence[]; complete: boolean };
  personalMemory: PersonalMemoryContext & { complete: boolean };
}
export interface AlwaysRetrieval {
  retrieve(
    question: string,
    timeoutMs: number,
    recentUserQuestions?: string[],
  ): Promise<RetrievalContext>;
}

export async function retrieveAlways(
  db: HistoryDatabase,
  embedder: Embedder,
  question: string,
  signal: AbortSignal,
  recentUserQuestions: string[] = [],
): Promise<RetrievalContext> {
  if (!question.trim() || question.length > 1000) throw Error('Invalid question');
  const lexical = db.keywordHistoryHitsNatural(question);
  const hc = db.historyVectorCoverage(),
    mc = db.memoryVectorCoverage();
  let historyHits: { id: number; conversationId: string }[] = [];
  let memoryHits: ReturnType<HistoryDatabase['vectorMemoryHits']> = [];
  let vectorAvailable = true;
  if (hc.indexed || mc.indexed) {
    try {
      const query = [question, ...recentUserQuestions.slice(-2).map((q) => q.slice(0, 300))].join(
        '\n',
      );
      const [vector] = await embedder.embed([`search_query: ${query}`], signal);
      if (signal.aborted) throw Error('Search cancelled');
      historyHits = db.vectorHistoryHits(vector);
      memoryHits = db.vectorMemoryHits(vector);
    } catch {
      vectorAvailable = false;
    }
  } else if (hc.total || mc.total) vectorAvailable = false;
  // Newly corrected memories have their old vectors invalidated. Literal topic/content
  // search provides a fallback until the background index catches up.
  const lexicalMemories = [question, ...recentUserQuestions.slice(-2)].flatMap((text) => {
    const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 12);
    const query = words.join(' ').slice(0, 200);
    return query ? db.searchMemories(query) : [];
  });
  const combinedMemories = [...memoryHits, ...lexicalMemories].filter(
    (memory, index, all) => all.findIndex((other) => other.id === memory.id) === index,
  );
  const historyComplete = vectorAvailable && hc.indexed === hc.total && !db.hasMoreHistory();
  const memoryComplete = vectorAvailable && mc.indexed === mc.total && !db.hasMoreMemories();
  const records = db
    .evidenceForHits(fuseRanks(lexical, historyHits))
    .slice(0, 2)
    .map((group) => ({
      ...group,
      messages: group.messages.slice(0, 4).map((m) => ({ ...m, content: m.content.slice(0, 300) })),
    }));
  return {
    history: { records, complete: historyComplete },
    personalMemory: {
      state: vectorAvailable ? 'available' : 'unavailable',
      complete: memoryComplete,
      records: combinedMemories
        .slice(0, 2)
        .map((m) => ({ id: m.id, topic: m.topic, content: m.content, source: m.source })),
    },
  };
}
export function createAlwaysRetrieval(db: HistoryDatabase): AlwaysRetrieval {
  return {
    retrieve: (question, timeoutMs, recentUserQuestions) =>
      retrieveAlways(
        db,
        localEmbedder(),
        question,
        AbortSignal.timeout(timeoutMs),
        recentUserQuestions,
      ),
  };
}
