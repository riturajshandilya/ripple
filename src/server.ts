import 'dotenv/config';
import pino from 'pino';
import { createApp } from './app';
import { createProvider } from './llm/providers';
import { HistoryDatabase } from './history/database';
import { historyPath, retentionDays } from './history/config';
import { rulesRouter } from './retrieval/router';
import { createMemoryExtractor } from './memory/extraction';
import { MemoryWorker } from './memory/worker';
import { createPersonalMemoryLookup, localEmbedder } from './memory/semantic';
import { createHybridHistoryLookup, HistoryEmbeddingWorker } from './retrieval/history-semantic';
import { MemoryEmbeddingWorker } from './memory/index-worker';
import { createAlwaysRetrieval } from './retrieval/always';
const log = pino();
const kind = process.env.LLM_PROVIDER || 'groq';
const skillId = process.env.ALEXA_SKILL_ID;
const key = kind === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
const port = Number(process.env.PORT || 3000);
if (
  !['groq', 'openai'].includes(kind) ||
  !skillId ||
  !key ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  log.error('Invalid configuration: check provider, skill ID, provider key and port');
  process.exit(1);
}
const model =
  kind === 'groq'
    ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    : process.env.OPENAI_MODEL || 'gpt-5-mini';
const provider = createProvider(
  kind,
  key,
  model,
  process.env.SYSTEM_PROMPT || 'Be a helpful assistant. Keep answers concise for speech.',
);
const routerMode = process.env.HISTORY_ROUTER || 'llm';
if (!['llm', 'rules'].includes(routerMode)) {
  log.error('Invalid HISTORY_ROUTER');
  process.exit(1);
}
const answerFlow = process.env.ANSWER_FLOW || 'always_retrieve';
if (!['always_retrieve', 'routed'].includes(answerFlow)) {
  log.error('Invalid ANSWER_FLOW');
  process.exit(1);
}
const autoMemoryValue = process.env.AUTO_MEMORY_ENABLED ?? 'true';
if (!['true', 'false'].includes(autoMemoryValue)) {
  log.error('Invalid AUTO_MEMORY_ENABLED');
  process.exit(1);
}
const autoMemory = autoMemoryValue === 'true';
const history = new HistoryDatabase(historyPath(), retentionDays(), autoMemory);
const memoryWorker = autoMemory
  ? new MemoryWorker(history, createMemoryExtractor(kind as 'groq' | 'openai', key, model), () =>
      log.warn('Memory extraction job failed'),
    )
  : undefined;
memoryWorker?.start();
const historyEmbeddingWorker = new HistoryEmbeddingWorker(history, localEmbedder(), () =>
  log.warn('Local conversation indexing unavailable'),
);
historyEmbeddingWorker.start();
const memoryEmbeddingWorker = new MemoryEmbeddingWorker(history, localEmbedder(), () =>
  log.warn('Local memory indexing unavailable'),
);
memoryEmbeddingWorker.start();
// Warm the local model with synthetic text; the first load may be slow.
void localEmbedder()
  .embed(['search_query: warmup'], AbortSignal.timeout(30000))
  .catch(() => log.warn('Local memory search unavailable'));
const server = createApp(
  skillId,
  provider,
  history,
  () => log.error('Could not save conversation history'),
  routerMode === 'llm' ? provider : rulesRouter,
  createPersonalMemoryLookup(history),
  createHybridHistoryLookup(history),
  answerFlow === 'always_retrieve' ? createAlwaysRetrieval(history) : undefined,
  (summary) => log.info(summary, 'Retrieval completed'),
).listen(port, '127.0.0.1', () => log.info({ port }, 'Listening on localhost'));
server.on('error', () => {
  log.error('Server failed to start');
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    log.info({ signal }, 'Shutting down');
    server.close(() => {
      void (async () => {
        await Promise.all([
          memoryWorker?.stop(),
          historyEmbeddingWorker.stop(),
          memoryEmbeddingWorker.stop(),
        ]);
        history.close();
        process.exit(0);
      })();
    });
    setTimeout(() => process.exit(1), 8000).unref();
  });
