import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { createSkill } from './alexa/skill';
import { LLMProvider } from './llm/provider';
import { HistoryWriter } from './history/database';
import { HistorySearch } from './retrieval/retrieval';
import { Router } from './retrieval/router';
import type { PersonalMemoryLookup } from './memory/semantic';
import type { HybridHistoryLookup } from './retrieval/history-semantic';
import type { AlwaysRetrieval } from './retrieval/always';
import type { RetrievalSummary } from './core/assistant';
export function createApp(
  skillId: string,
  provider: LLMProvider,
  history?: HistoryWriter & Partial<HistorySearch>,
  onHistoryError?: () => void,
  router?: Router,
  memoryLookup?: PersonalMemoryLookup,
  historyLookup?: HybridHistoryLookup,
  alwaysRetrieval?: AlwaysRetrieval,
  onRetrieval?: (summary: RetrievalSummary) => void,
) {
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post(
    '/alexa',
    new ExpressAdapter(
      createSkill(
        skillId,
        provider,
        undefined,
        history,
        onHistoryError,
        router,
        memoryLookup,
        historyLookup,
        alwaysRetrieval,
        onRetrieval,
      ),
      true,
      true,
    ).getRequestHandlers(),
  );
  return app;
}
