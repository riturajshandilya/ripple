import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../src/llm/providers';

test('Groq answer call sends the local tool schema and returns a tool proposal', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'propose_memory_update',
                    arguments: JSON.stringify({ memory_id: 'm1', new_value: 'tea' }),
                  },
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const provider = createProvider('groq', 'test-key', 'openai/gpt-oss-20b', 'Be helpful');
    const result = await provider.answerWithTools!(
      [{ role: 'user', content: 'change it to tea' }],
      undefined,
      1000,
      {
        state: 'available',
        records: [{ id: 'm1', topic: 'drink', content: 'coffee', source: 'explicit_local' }],
      },
      { historyComplete: true, memoryComplete: true },
    );
    assert.equal(requestBody.tool_choice, 'auto');
    assert.equal(requestBody.tools[0].function.name, 'propose_memory_update');
    assert.deepEqual(result, {
      type: 'tool',
      name: 'propose_memory_update',
      arguments: { memory_id: 'm1', new_value: 'tea' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
