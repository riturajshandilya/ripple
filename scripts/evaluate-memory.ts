import 'dotenv/config';
import { createProvider } from '../src/llm/providers';

// Synthetic data only. This evaluation does not read stored memories.
const cases = [
  { label: 'general fact', question: 'What is Redis?', expected: 'skip' },
  {
    label: 'explicit preference',
    question: 'What do you remember about my coffee preference?',
    expected: 'search',
  },
  {
    label: 'personal recommendation',
    question: 'Recommend a workout that fits my preferences.',
    expected: 'search',
  },
  {
    label: 'missing topic',
    question: 'What do you remember about my preference?',
    expected: 'clarify',
  },
];
const kind = process.env.LLM_PROVIDER || 'groq';
const key = kind === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
if (!key || !['groq', 'openai'].includes(kind)) throw new Error('Configure the provider locally');
const model =
  kind === 'groq'
    ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    : process.env.OPENAI_MODEL || 'gpt-5-mini';
const provider = createProvider(kind, key, model, 'Be helpful.');
(async () => {
  for (const c of cases) {
    const start = Date.now();
    try {
      const decision = await provider.decideMemory([{ role: 'user', content: c.question }], 2500);
      console.log(
        JSON.stringify({
          label: c.label,
          expected: c.expected,
          ...decision,
          elapsedMs: Date.now() - start,
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          label: c.label,
          expected: c.expected,
          action: 'error',
          elapsedMs: Date.now() - start,
        }),
      );
    }
  }
})().catch(() => {
  console.error('Evaluation failed');
  process.exitCode = 1;
});
