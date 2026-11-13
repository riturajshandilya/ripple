import 'dotenv/config';
import { createProvider } from '../src/llm/providers';
import { rulesRouter } from '../src/retrieval/router';
import { ConversationMessage } from '../src/llm/provider';

// Synthetic examples only: do not use personal conversation data in evaluation logs.
const cases: {
  label: string;
  expected: 'direct' | 'search_history' | 'clarify';
  messages: ConversationMessage[];
}[] = [
  {
    label: 'ordinary',
    expected: 'direct',
    messages: [{ role: 'user', content: 'Explain Redis caching.' }],
  },
  {
    label: 'follow-up',
    expected: 'direct',
    messages: [
      { role: 'user', content: 'Explain Redis caching.' },
      { role: 'assistant', content: 'Redis can cache data.' },
      { role: 'user', content: 'What about invalidation?' },
    ],
  },
  {
    label: 'history',
    expected: 'search_history',
    messages: [
      { role: 'user', content: 'What did we talk about regarding the Indian population?' },
    ],
  },
  {
    label: 'paraphrased history',
    expected: 'search_history',
    messages: [{ role: 'user', content: 'Remind me of our earlier discussion on Redis caching.' }],
  },
  {
    label: 'missing topic',
    expected: 'clarify',
    messages: [{ role: 'user', content: 'What did we talk about last time?' }],
  },
  {
    label: 'historical question',
    expected: 'search_history',
    messages: [{ role: 'user', content: 'What was my first question about India population?' }],
  },
];
const kind = process.env.LLM_PROVIDER || 'groq';
const key = kind === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
if (!key || !['groq', 'openai'].includes(kind)) throw new Error('Configure a provider key locally');
const model =
  kind === 'groq'
    ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    : process.env.OPENAI_MODEL || 'gpt-5-mini';
const provider = createProvider(kind, key, model, 'Be concise.');
(async () => {
  for (const item of cases) {
    const start = Date.now();
    const rule = await rulesRouter.classify(item.messages, 2500);
    try {
      const result = await provider.classify(item.messages, 2500);
      console.log(
        JSON.stringify({
          label: item.label,
          expected: item.expected,
          rules: rule.route,
          llm: result.route,
          searchTerms: result.searchTerms,
          elapsedMs: Date.now() - start,
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          label: item.label,
          expected: item.expected,
          rules: rule.route,
          llm: 'error',
          elapsedMs: Date.now() - start,
        }),
      );
    }
  }
})().catch(() => {
  console.error('Evaluation failed');
  process.exitCode = 1;
});
