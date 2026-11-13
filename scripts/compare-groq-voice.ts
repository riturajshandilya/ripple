import 'dotenv/config';
import { createProvider } from '../src/llm/providers';
import type { ConversationMessage, PersonalMemoryContext } from '../src/llm/provider';

// Synthetic prompts only: never reads personal memories or conversation history.
const key = process.env.GROQ_API_KEY;
if (!key) throw new Error('Groq API key is not configured.');
const memory: PersonalMemoryContext = {
  state: 'available',
  records: [
    {
      id: 'synthetic-id',
      topic: 'drink preference',
      content: 'The user prefers lemonade',
      source: 'explicit_local',
    },
  ],
};
const examples: {
  name: string;
  messages: ConversationMessage[];
  expectation: 'answer' | 'tool' | 'no_action_claim';
}[] = [
  {
    name: 'general answer',
    messages: [{ role: 'user', content: 'In one sentence, what is Redis?' }],
    expectation: 'answer',
  },
  {
    name: 'missing new value',
    messages: [
      { role: 'user', content: 'Earlier I mentioned tea.' },
      { role: 'assistant', content: 'Okay.' },
      { role: 'user', content: 'Please update my drink preference.' },
    ],
    expectation: 'answer',
  },
  {
    name: 'proposed correction',
    messages: [
      { role: 'user', content: 'What is my favorite drink?' },
      { role: 'assistant', content: 'You prefer lemonade.' },
      { role: 'user', content: 'Please update it to mango juice.' },
    ],
    expectation: 'tool',
  },
  {
    name: 'unsupported action',
    messages: [{ role: 'user', content: 'Stop the music on my computer.' }],
    expectation: 'no_action_claim',
  },
];
async function main() {
  for (const model of ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']) {
    const provider = createProvider('groq', key!, model, 'Be a helpful assistant.');
    for (const example of examples) {
      const start = Date.now();
      try {
        const result = await provider.answerWithTools!(example.messages, undefined, 5500, memory, {
          historyComplete: true,
          memoryComplete: true,
        });
        let pass =
          example.expectation === 'tool'
            ? result.type === 'tool' &&
              result.name === 'propose_memory_update' &&
              typeof result.arguments === 'object' &&
              result.arguments !== null &&
              String((result.arguments as Record<string, unknown>).new_value).toLowerCase() ===
                'mango juice'
            : result.type === 'answer';
        if (example.expectation === 'no_action_claim' && result.type === 'answer')
          pass =
            !/\b(stopped|stopping|paused|pausing) (?:the |your )?music\b/i.test(result.text) ||
            /\b(can'?t|cannot|unable|not able|not capable|can not)\b/i.test(result.text);
        console.log(
          JSON.stringify({
            model,
            case: example.name,
            result: result.type,
            pass,
            durationMs: Date.now() - start,
          }),
        );
      } catch {
        console.log(
          JSON.stringify({
            model,
            case: example.name,
            result: 'error',
            pass: false,
            durationMs: Date.now() - start,
          }),
        );
      }
    }
  }
}
void main().catch(() => {
  console.error('Synthetic comparison failed.');
  process.exitCode = 1;
});
