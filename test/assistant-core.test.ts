import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssistantCore } from '../src/core/assistant';
import type { ConversationMessage } from '../src/llm/provider';

test('core carries context across turns, isolates sessions, and clears ended sessions', async () => {
  const calls: ConversationMessage[][] = [];
  const assistant = new AssistantCore({
    answer: async (messages) => {
      calls.push(messages);
      return 'A spoken answer';
    },
  });
  await assistant.respond('mac:one', 'Explain Redis');
  await assistant.respond('mac:one', 'What about invalidation?');
  await assistant.respond('mac:two', 'Hello');
  assert.deepEqual(
    calls[1].map((message) => message.content),
    ['Explain Redis', 'A spoken answer', 'What about invalidation?'],
  );
  assert.deepEqual(
    calls[2].map((message) => message.content),
    ['Hello'],
  );
  assistant.endSession('mac:one');
  await assistant.respond('mac:one', 'New conversation');
  assert.deepEqual(
    calls[3].map((message) => message.content),
    ['New conversation'],
  );
});

test('core returns a generic error and excludes failed turns from context', async () => {
  let count = 0;
  let last: ConversationMessage[] = [];
  const assistant = new AssistantCore({
    answer: async (messages) => {
      last = messages;
      if (++count === 2) throw new Error('private details');
      return 'ok';
    },
  });
  await assistant.respond('mac:one', 'first');
  assert.equal(
    await assistant.respond('mac:one', 'failed'),
    'Sorry, I could not answer right now. Please try again.',
  );
  await assistant.respond('mac:one', 'next');
  assert.deepEqual(
    last.map((message) => message.content),
    ['first', 'ok', 'next'],
  );
});

test('explicit correction requires confirmation and is not re-extracted', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const db = new HistoryDatabase(':memory:', 30, true);
  try {
    const id = db.addMemory('workout', 'less than 30 minutes');
    let calls = 0;
    const assistant = new AssistantCore(
      {
        answer: async () => {
          calls++;
          return 'unexpected';
        },
      },
      undefined,
      db,
    );
    assert.equal(
      await assistant.respond('mac', 'update my memory for workout to 45 minutes'),
      'I found this memory for workout: less than 30 minutes. Replace it with 45 minutes?',
    );
    assert.equal(db.listMemories()[0].content, 'less than 30 minutes');
    assert.match(await assistant.respond('mac', 'update it'), /Updated your workout memory/);
    assert.equal(db.listMemories()[0].content, '45 minutes');
    assert.deepEqual(
      (db.memoryRevisions(id) as { content: string }[]).map((r) => r.content),
      ['less than 30 minutes'],
    );
    assert.equal(db.nextExtractionJob(), null);
    assert.equal(calls, 0);
    assert.equal(
      await assistant.respond('mac', 'update memory for missing to a value'),
      'I could not find a memory with that exact topic. Please check the topic and try again.',
    );
    db.addMemory('workout', 'another preference');
    assert.match(
      await assistant.respond('mac', 'update memory for workout to 60 minutes'),
      /2 memories/,
    );
    assert.equal(await assistant.respond('mac', 'no'), 'Cancelled. I did not change your memory.');
    assert.equal(db.listMemories().find((m) => m.id === id)?.content, '45 minutes');
    assert.equal(db.deleteMemory(id), true);
    assert.deepEqual(db.memoryRevisions(id), []);
  } finally {
    db.close();
  }
});

test('failed correction never claims success', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const db = new HistoryDatabase(':memory:');
  try {
    db.addMemory('workout', 'short');
    const original = db.commitMemoryCorrection.bind(db);
    db.commitMemoryCorrection = () => {
      throw new Error('database error');
    };
    const assistant = new AssistantCore({ answer: async () => 'unexpected' }, undefined, db);
    assert.match(
      await assistant.respond('mac', 'update memory for workout to 45 minutes'),
      /Replace it/,
    );
    assert.match(await assistant.respond('mac', 'yes'), /database operation failed/);
    assert.equal(db.listMemories()[0].content, 'short');
    db.commitMemoryCorrection = original;
  } finally {
    db.close();
  }
});

test('retrieval diagnostics contain counts and completeness, not private content', async () => {
  const summaries: unknown[] = [];
  const assistant = new AssistantCore(
    { answer: async () => 'answer' },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      retrieve: async () => ({
        history: {
          records: [
            {
              conversationId: 'secret-id',
              messages: [{ role: 'user', content: 'secret history', createdAt: '2020' }],
            },
          ],
          complete: true,
        },
        personalMemory: {
          state: 'available',
          records: [
            { topic: 'private topic', content: 'private memory', source: 'explicit_local' },
          ],
          complete: true,
        },
      }),
    },
    (summary) => summaries.push(summary),
  );
  await assistant.respond('session', 'private question');
  assert.equal(summaries.length, 1);
  assert.deepEqual(Object.keys(summaries[0] as object).sort(), [
    'durationMs',
    'historyComplete',
    'historyCount',
    'memoryComplete',
    'memoryCount',
  ]);
  assert.doesNotMatch(JSON.stringify(summaries), /private|secret|question/);
});

test('a short or referential follow-up supplies recent user topics to retrieval', async () => {
  const contexts: string[][] = [];
  const assistant = new AssistantCore(
    { answer: async () => 'answer' },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      retrieve: async (_question, _timeout, previous) => {
        contexts.push(previous ?? []);
        return {
          history: { records: [], complete: true },
          personalMemory: { state: 'available', records: [], complete: true },
        };
      },
    },
  );
  await assistant.respond('s', 'Do you know what is my favorite drink?');
  await assistant.respond('s', 'I want to update it to Mountain Dew. Can you do it?');
  assert.deepEqual(contexts[1], ['Do you know what is my favorite drink?']);
});

test('provider timing emits only duration and success without message content', async () => {
  const timings: unknown[] = [];
  const assistant = new AssistantCore(
    { answer: async () => 'private answer' },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      retrieve: async () => ({
        history: { records: [], complete: true },
        personalMemory: { state: 'available', records: [], complete: true },
      }),
    },
    undefined,
    (value) => timings.push(value),
  );
  await assistant.respond('s', 'private question');
  assert.equal(timings.length, 1);
  assert.deepEqual(Object.keys(timings[0] as object).sort(), ['durationMs', 'success']);
  assert.doesNotMatch(JSON.stringify(timings), /private/);
});
