import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssistantCore } from '../src/core/assistant';
import { HistoryDatabase } from '../src/history/database';
import type { LLMProvider } from '../src/llm/provider';
import type { AlwaysRetrieval } from '../src/retrieval/always';

function fixture(
  db: HistoryDatabase,
  targetId: string,
  proposal: unknown = { memory_id: targetId, new_value: 'Diet Pepsi' },
) {
  let calls = 0;
  const provider: LLMProvider = {
    answer: async () => 'ordinary answer',
    answerWithTools: async () => {
      calls++;
      return { type: 'tool', name: 'propose_memory_update', arguments: proposal };
    },
  };
  const retrieval: AlwaysRetrieval = {
    retrieve: async () => ({
      history: { records: [], complete: true },
      personalMemory: {
        state: 'available',
        complete: true,
        records: db
          .listMemories()
          .map((m) => ({ id: m.id, topic: m.topic, content: m.content, source: m.source })),
      },
    }),
  };
  return {
    core: new AssistantCore(
      provider,
      undefined,
      db,
      undefined,
      undefined,
      undefined,
      undefined,
      retrieval,
    ),
    calls: () => calls,
  };
}

test('natural proposal requires confirmation, resolves same-topic conflicts atomically, and keeps revisions', async () => {
  const db = new HistoryDatabase(':memory:', 30, true);
  try {
    const one = db.addMemory('drink preference', 'Diet Coke');
    db.addMemory('drink preference', 'Diet Pepsi');
    const { core, calls } = fixture(db, one);
    const preview = await core.respond('s', 'I prefer Diet Pepsi; can you update my preference?');
    assert.match(preview, /2 memories/);
    assert.match(preview, /Diet Coke/);
    assert.match(preview, /Diet Pepsi/);
    assert.equal(db.listMemories().length, 2);
    assert.equal(db.nextExtractionJob(), null);
    assert.match(
      await core.respond('s', 'Yes, update it please.'),
      /Updated your drink preference memory to Diet Pepsi/,
    );
    assert.equal(db.listMemories().length, 1);
    const survivor = db.listMemories()[0];
    assert.equal(survivor.content, 'Diet Pepsi');
    assert.deepEqual(
      new Set((db.memoryRevisions(survivor.id) as { content: string }[]).map((r) => r.content)),
      new Set(['Diet Coke', 'Diet Pepsi']),
    );
    assert.equal(calls(), 1);
  } finally {
    db.close();
  }
});

test('cancellation, a changed record, and session end never apply a pending correction', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink', 'tea');
    const { core } = fixture(db, id);
    await core.respond('s', 'change my drink to Diet Pepsi');
    assert.match(await core.respond('s', 'no'), /Cancelled/);
    assert.equal(db.listMemories()[0].content, 'tea');
    await core.respond('s', 'change my drink to Diet Pepsi');
    db.updateMemory(id, 'drink', 'coffee');
    assert.match(await core.respond('s', 'yes'), /changed since/);
    assert.equal(db.listMemories()[0].content, 'coffee');
    await core.respond('s', 'change my drink to Diet Pepsi');
    core.endSession('s');
    await core.respond('s', 'yes');
    assert.equal(db.listMemories()[0].content, 'coffee');
  } finally {
    db.close();
  }
});

test('unknown memory IDs and invalid tool arguments do not create pending updates', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink', 'tea');
    for (const proposal of [
      { memory_id: 'not-retrieved', new_value: 'coffee' },
      { memory_id: id, new_value: 'coffee', extra: true },
    ]) {
      const { core } = fixture(db, id, proposal);
      assert.match(await core.respond('s', 'update my preference'), /could not answer/);
      assert.equal(db.listMemories()[0].content, 'tea');
    }
  } finally {
    db.close();
  }
});

test('approval cannot be reused or applied in another session', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink', 'tea');
    const { core } = fixture(db, id);
    await core.respond('one', 'change my preference to Diet Pepsi');
    await core.respond('two', 'yes');
    assert.equal(db.listMemories()[0].content, 'tea');
    assert.match(await core.respond('one', 'yes'), /Updated/);
    await core.respond('one', 'yes');
    assert.equal((db.memoryRevisions(id) as unknown[]).length, 1);
  } finally {
    db.close();
  }
});

test('a pending correction expires before confirmation', async () => {
  const db = new HistoryDatabase(':memory:');
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const id = db.addMemory('drink', 'tea');
    const { core } = fixture(db, id);
    await core.respond('s', 'change my preference to Diet Pepsi');
    now += 120001;
    assert.match(await core.respond('s', 'yes'), /expired/);
    assert.equal(db.listMemories()[0].content, 'tea');
  } finally {
    Date.now = originalNow;
    db.close();
  }
});

test('ending a session while the model is deciding cannot create a pending action', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink', 'tea');
    let resolve!: (v: { type: 'tool'; name: string; arguments: unknown }) => void;
    const delayed = new Promise<{ type: 'tool'; name: string; arguments: unknown }>((done) => {
      resolve = done;
    });
    const retrieval: AlwaysRetrieval = {
      retrieve: async () => ({
        history: { records: [], complete: true },
        personalMemory: {
          state: 'available',
          complete: true,
          records: [{ id, topic: 'drink', content: 'tea', source: 'explicit_local' }],
        },
      }),
    };
    const core = new AssistantCore(
      { answer: async () => 'ordinary', answerWithTools: async () => delayed },
      undefined,
      db,
      undefined,
      undefined,
      undefined,
      undefined,
      retrieval,
    );
    const response = core.respond('s', 'update my drink');
    await new Promise((done) => setImmediate(done));
    core.endSession('s');
    resolve({
      type: 'tool',
      name: 'propose_memory_update',
      arguments: { memory_id: id, new_value: 'coffee' },
    });
    assert.match(await response, /conversation ended/);
    assert.equal(db.listMemories()[0].content, 'tea');
    assert.equal((db.memoryRevisions(id) as unknown[]).length, 0);
  } finally {
    db.close();
  }
});

test('pronoun follow-up carries the previous topic through retrieval into a tool proposal', async () => {
  const { retrieveAlways } = await import('../src/retrieval/always');
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink preference', 'Diet Coke');
    let observedIds: (string | undefined)[] = [];
    const provider: LLMProvider = {
      answer: async () => 'unused',
      answerWithTools: async (messages, _evidence, _timeout, memory) => {
        observedIds = memory?.records.map((r) => r.id) ?? [];
        return messages.length === 1
          ? { type: 'answer', text: 'Your favorite drink is Diet Coke.' }
          : {
              type: 'tool',
              name: 'propose_memory_update',
              arguments: { memory_id: id, new_value: 'Mountain Dew' },
            };
      },
    };
    const retrieval: AlwaysRetrieval = {
      retrieve: (question, _timeout, previous) =>
        retrieveAlways(
          db,
          {
            model: 'test',
            embed: async () => {
              throw Error('offline');
            },
          },
          question,
          AbortSignal.timeout(1000),
          previous,
        ),
    };
    const core = new AssistantCore(
      provider,
      undefined,
      db,
      undefined,
      undefined,
      undefined,
      undefined,
      retrieval,
    );
    await core.respond('s', 'Do you know what is my favorite drink?');
    const preview = await core.respond('s', 'I want to update it to Mountain Dew. Can you do it?');
    assert.ok(observedIds.includes(id));
    assert.match(preview, /Replace it with Mountain Dew/);
    assert.equal(db.listMemories()[0].content, 'Diet Coke');
    assert.match(await core.respond('s', 'yes'), /Updated/);
    assert.equal(db.listMemories()[0].content, 'Mountain Dew');
  } finally {
    db.close();
  }
});

test('a stale value from earlier conversation cannot be proposed as a new update', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink preference', 'Diet Pepsi');
    const { core } = fixture(db, id, { memory_id: id, new_value: 'mount and view' });
    assert.equal(
      await core.respond('s', 'I want to update my favorite drink.'),
      'What new value would you like me to remember?',
    );
    assert.equal(db.listMemories()[0].content, 'Diet Pepsi');
    assert.equal((db.memoryRevisions(id) as unknown[]).length, 0);
  } finally {
    db.close();
  }
});

test('a new update request replaces a pending proposal and is processed on the same turn', async () => {
  const db = new HistoryDatabase(':memory:');
  try {
    const id = db.addMemory('drink preference', 'Diet Coke');
    const provider: LLMProvider = {
      answer: async () => 'unused',
      answerWithTools: async (messages) => ({
        type: 'tool',
        name: 'propose_memory_update',
        arguments: {
          memory_id: id,
          new_value: messages.at(-1)!.content.includes('Coca-Cola') ? 'Coca-Cola' : 'Diet Pepsi',
        },
      }),
    };
    const retrieval: AlwaysRetrieval = {
      retrieve: async () => ({
        history: { records: [], complete: true },
        personalMemory: {
          state: 'available',
          complete: true,
          records: [
            { id, topic: 'drink preference', content: 'Diet Coke', source: 'explicit_local' },
          ],
        },
      }),
    };
    const core = new AssistantCore(
      provider,
      undefined,
      db,
      undefined,
      undefined,
      undefined,
      undefined,
      retrieval,
    );
    assert.match(await core.respond('s', 'Update it to Diet Pepsi'), /Diet Pepsi/);
    const next = await core.respond('s', 'Can you update the memory to Coca-Cola?');
    assert.match(next, /Replace it with Coca-Cola/);
    assert.equal(db.listMemories()[0].content, 'Diet Coke');
    assert.match(await core.respond('s', 'yes'), /Updated/);
    assert.equal(db.listMemories()[0].content, 'Coca-Cola');
  } finally {
    db.close();
  }
});
