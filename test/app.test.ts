import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app';
import { createSkill } from '../src/alexa/skill';
import { RequestEnvelope } from 'ask-sdk-model';
const id = 'amzn1.ask.skill.test';
const envelope = (question: string): RequestEnvelope => ({
  version: '1.0',
  session: { new: true, sessionId: 's', application: { applicationId: id }, user: { userId: 'u' } },
  context: {
    System: {
      application: { applicationId: id },
      user: { userId: 'u' },
      device: { deviceId: 'd', supportedInterfaces: {} },
      apiEndpoint: 'https://example.com',
    },
  },
  request: {
    type: 'IntentRequest',
    requestId: 'r',
    timestamp: new Date().toISOString(),
    locale: 'en-US',
    intent: {
      name: 'QuestionIntent',
      confirmationStatus: 'NONE',
      slots: { question: { name: 'question', value: question, confirmationStatus: 'NONE' } },
    },
  },
});
test('health works and unsigned Alexa requests are rejected', async () => {
  const app = createApp(id, { answer: async () => 'ok' });
  assert.equal((await request(app).get('/health')).status, 200);
  assert.equal((await request(app).post('/alexa').send(envelope('hello'))).status, 400);
});
test('question response escapes speech and keeps session open', async () => {
  const skill = createSkill(id, { answer: async () => '<hello & goodbye>' });
  const result = await skill.invoke(envelope('test'));
  assert.equal(result.response.shouldEndSession, false);
  assert.ok(result.response.reprompt);
  assert.match(JSON.stringify(result.response.outputSpeech), /&lt;hello &amp; goodbye&gt;/);
});
test('provider failure returns generic speech', async () => {
  const skill = createSkill(id, {
    answer: async () => {
      throw new Error('secret');
    },
  });
  const result = await skill.invoke(envelope('test'));
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  assert.match(JSON.stringify(result), /could not answer/);
});

test('follow-up sends prior turns and sessions remain isolated', async () => {
  const calls: import('../src/llm/provider').ConversationMessage[][] = [];
  const skill = createSkill(id, {
    answer: async (messages) => {
      calls.push(messages);
      return 'answer';
    },
  });
  await skill.invoke(envelope('Explain Redis caching'));
  await skill.invoke(envelope('What about cache invalidation?'));
  const other = envelope('Hello');
  other.session!.sessionId = 'other';
  await skill.invoke(other);
  assert.deepEqual(calls[1], [
    { role: 'user', content: 'Explain Redis caching' },
    { role: 'assistant', content: 'answer' },
    { role: 'user', content: 'What about cache invalidation?' },
  ]);
  assert.deepEqual(calls[2], [{ role: 'user', content: 'Hello' }]);
});
test('failed turns do not pollute history', async () => {
  let count = 0;
  let last: import('../src/llm/provider').ConversationMessage[] = [];
  const skill = createSkill(id, {
    answer: async (messages) => {
      last = messages;
      if (++count === 2) throw Error('private');
      return 'ok';
    },
  });
  await skill.invoke(envelope('first'));
  await skill.invoke(envelope('failed'));
  await skill.invoke(envelope('next'));
  assert.deepEqual(
    last.map((m) => m.content),
    ['first', 'ok', 'next'],
  );
});
test('stop clears conversation', async () => {
  let last: import('../src/llm/provider').ConversationMessage[] = [];
  const skill = createSkill(id, {
    answer: async (messages) => {
      last = messages;
      return 'ok';
    },
  });
  await skill.invoke(envelope('first'));
  const stop = envelope('');
  if (stop.request.type === 'IntentRequest') stop.request.intent.name = 'AMAZON.StopIntent';
  assert.equal((await skill.invoke(stop)).response.shouldEndSession, true);
  await skill.invoke(envelope('next'));
  assert.deepEqual(
    last.map((m) => m.content),
    ['next'],
  );
});

test('saves successful turns and keeps answering if history fails', async () => {
  const saved: string[] = [];
  let failures = 0;
  const skill = createSkill(
    id,
    { answer: async () => 'answer' },
    undefined,
    {
      saveTurn: (_id, question, answer) => {
        saved.push(question, answer);
        throw Error('private');
      },
    },
    () => failures++,
  );
  const result = await skill.invoke(envelope('question'));
  assert.deepEqual(saved, ['question', 'answer']);
  assert.equal(failures, 1);
  assert.match(JSON.stringify(result.response.outputSpeech), /answer/);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test('explicit history requests use evidence; direct questions do not search', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const history = new HistoryDatabase(':memory:');
  try {
    history.saveTurn('old', 'What is the population of India?', 'About 1.4 billion.');
    let evidenceCount = 0;
    const skill = createSkill(
      id,
      {
        answer: async (_messages, evidence) => {
          evidenceCount = evidence?.length ?? 0;
          return evidence
            ? 'The first question was about India’s population.'
            : 'Redis is a cache.';
        },
      },
      undefined,
      history,
    );
    await skill.invoke(envelope('Explain Redis caching'));
    assert.equal(evidenceCount, 0);
    const result = await skill.invoke(
      envelope('What did we talk about regarding the Indian population?'),
    );
    assert.equal(evidenceCount, 1);
    assert.match(JSON.stringify(result.response.outputSpeech), /first question/);
  } finally {
    history.close();
  }
});
test('missing history does not call the model or invent an answer', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const history = new HistoryDatabase(':memory:');
  let calls = 0;
  try {
    const skill = createSkill(
      id,
      {
        answer: async () => {
          calls++;
          return 'invented';
        },
      },
      undefined,
      history,
    );
    const result = await skill.invoke(envelope('What did we talk about dinosaurs?'));
    assert.equal(calls, 0);
    assert.match(JSON.stringify(result.response.outputSpeech), /could not find/);
  } finally {
    history.close();
  }
});

test('LLM router selects direct, search, clarification, and fails safely', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const history = new HistoryDatabase(':memory:');
  try {
    history.saveTurn('old', 'What is the population of India?', 'About 1.4 billion.');
    let choice: any = { route: 'search_history', searchTerms: ['india', 'population'] };
    let evidenceSeen = false;
    let calls = 0;
    const skill = createSkill(
      id,
      {
        answer: async (_messages, evidence) => {
          calls++;
          evidenceSeen = !!evidence;
          return 'ok';
        },
      },
      undefined,
      history,
      undefined,
      { classify: async () => choice },
    );
    await skill.invoke(envelope('Remind me what we discussed about India population'));
    assert.equal(evidenceSeen, true);
    choice = { route: 'direct', searchTerms: [] };
    await skill.invoke(envelope('Explain Redis'));
    assert.equal(evidenceSeen, false);
    choice = { route: 'clarify', searchTerms: [] };
    const result = await skill.invoke(envelope('Remember that?'));
    assert.match(JSON.stringify(result.response.outputSpeech), /past conversation/);
    assert.equal(calls, 2);
    choice = { route: 'search_history', searchTerms: ['" OR *'] };
    const bad = await skill.invoke(envelope('bad output'));
    assert.match(JSON.stringify(bad.response.outputSpeech), /could not answer/);
    assert.equal(calls, 2);
  } finally {
    history.close();
  }
});

test('natural question intent restores the carrier phrase before routing', async () => {
  let received = '';
  const skill = createSkill(id, {
    answer: async (messages) => {
      received = messages.at(-1)!.content;
      return 'ok';
    },
  });
  const input = envelope('Redis caching');
  if (input.request.type === 'IntentRequest') input.request.intent.name = 'WhatIsIntent';
  await skill.invoke(input);
  assert.equal(received, 'what is Redis caching');
});
test('natural history intent restores wording for routing and search', async () => {
  let query = '';
  const skill = createSkill(id, { answer: async () => 'ok' }, undefined, {
    saveTurn: () => {},
    findEvidence: (q) => {
      query = q;
      return [];
    },
  });
  const input = envelope('the Indian population');
  if (input.request.type === 'IntentRequest') input.request.intent.name = 'DidWeTalkIntent';
  const result = await skill.invoke(input);
  assert.equal(query, 'india population');
  assert.match(JSON.stringify(result.response.outputSpeech), /could not find/);
});

test('remember intent preserves the utterance for context-aware routing', async () => {
  let seen = '';
  const skill = createSkill(id, { answer: async () => 'ok' }, undefined, undefined, undefined, {
    classify: async (messages) => {
      seen = messages.at(-1)!.content;
      return { route: 'clarify', searchTerms: [] };
    },
  });
  const request = envelope('about this');
  if (request.request.type === 'IntentRequest') request.request.intent.name = 'RememberIntent';
  const response = await skill.invoke(request);
  assert.equal(seen, 'do you remember about this');
  assert.match(JSON.stringify(response.response.outputSpeech), /mention the topic/);
  assert.equal(response.response.shouldEndSession, false);
});

test('natural multi-turn requests preserve opening words and recent context', async () => {
  const calls: import('../src/llm/provider').ConversationMessage[][] = [];
  const skill = createSkill(id, {
    answer: async (messages) => {
      calls.push(messages);
      return 'Sure, here is an answer.';
    },
  });
  for (const [name, slot] of [
    ['CanYouIntent', 'explain Redis'],
    ['CouldYouIntent', 'give an example'],
    ['WouldYouLikeIntent', 'to discuss caching'],
  ]) {
    const input = envelope(slot);
    if (input.request.type === 'IntentRequest') input.request.intent.name = name;
    const response = await skill.invoke(input);
    assert.equal(response.response.shouldEndSession, false);
  }
  assert.deepEqual(
    calls[2].map((m) => m.content),
    [
      'can you explain Redis',
      'Sure, here is an answer.',
      'could you give an example',
      'Sure, here is an answer.',
      'would you like to discuss caching',
    ],
  );
});

test('candidate interaction model has distinct carrier samples and a slot for each natural intent', async () => {
  const { readFileSync } = await import('node:fs');
  const model = JSON.parse(readFileSync('skill/en-US.json', 'utf8'));
  const intents = model.interactionModel.languageModel.intents as {
    name: string;
    slots?: { name: string; type: string }[];
    samples: string[];
  }[];
  const samples = intents.flatMap((i) => i.samples);
  assert.equal(new Set(samples).size, samples.length);
  for (const name of [
    'CanYouIntent',
    'CouldYouIntent',
    'WouldYouLikeIntent',
    'DoYouKnowIntent',
    'HowDoesIntent',
    'RememberIntent',
  ]) {
    const found = intents.find((i) => i.name === name);
    assert.ok(found?.slots?.some((s) => s.name === 'question' && s.type === 'AMAZON.SearchQuery'));
    assert.ok(found.samples.some((s) => s.includes(' {question}')));
  }
});

test('carrier samples are unique, within budget, and preserve their wording', async () => {
  const { readFileSync } = await import('node:fs');
  const { generatedCarriers } = await import('../src/alexa/generated-carriers');
  const model = JSON.parse(readFileSync('skill/en-US.json', 'utf8'));
  const intents = model.interactionModel.languageModel.intents as {
    name: string;
    samples: string[];
  }[];
  const samples = intents.flatMap((i) => i.samples).filter((s) => s.endsWith(' {question}'));
  assert.equal(samples.length, 138);
  assert.equal(new Set(samples).size, 138);
  assert.ok(intents.length <= 250);
  const allIntents = model.interactionModel.languageModel.intents as { slots?: unknown[] }[];
  assert.ok(intents.length + allIntents.reduce((n, i) => n + (i.slots?.length ?? 0), 0) < 350);
  let captured = '';
  const skill = createSkill(
    id,
    {
      answer: async (messages) => {
        captured = messages.at(-1)!.content;
        return 'ok';
      },
    },
    undefined,
    undefined,
    undefined,
    { classify: async () => ({ route: 'direct', searchTerms: [] }) },
  );
  for (const [name, carrier] of Object.entries(generatedCarriers)) {
    assert.deepEqual(intents.find((i) => i.name === name)?.samples, [`${carrier} {question}`]);
    const input = envelope('test topic');
    input.session!.sessionId = name;
    if (input.request.type === 'IntentRequest') input.request.intent.name = name;
    const response = await skill.invoke(input);
    assert.equal(captured, `${carrier} test topic`);
    assert.equal(response.response.shouldEndSession, false);
  }
  assert.equal(Object.keys(generatedCarriers).length, 108);
});

test('passes relevant personal memory to answer without altering conversation history', async () => {
  const records = [
    { topic: 'fitness', content: 'Prefers short workouts', source: 'automatic_unverified' },
  ];
  let seen: import('../src/llm/provider').PersonalMemoryContext | undefined;
  const skill = createSkill(
    id,
    {
      answer: async (_messages, _evidence, _timeout, memory) => {
        seen = memory;
        return 'Try a short workout.';
      },
    },
    undefined,
    undefined,
    undefined,
    { classify: async () => ({ route: 'direct', searchTerms: [] }) },
    { findRelevant: async () => ({ state: 'available', records }) },
  );
  const result = await skill.invoke(envelope('Recommend exercise'));
  assert.deepEqual(seen, { state: 'available', records });
  assert.match(JSON.stringify(result.response.outputSpeech), /short workout/);
});
test('memory lookup failure is marked unavailable for the answer model', async () => {
  let state: string | undefined;
  const skill = createSkill(
    id,
    {
      answer: async (_m, _e, _t, memory) => {
        state = memory?.state;
        return 'Memory lookup failed.';
      },
    },
    undefined,
    undefined,
    undefined,
    { classify: async () => ({ route: 'direct', searchTerms: [] }) },
    {
      findRelevant: async () => {
        throw Error('local error');
      },
    },
  );
  await skill.invoke(envelope('What do you remember?'));
  assert.equal(state, 'unavailable');
});

test('history router uses hybrid evidence and reports incomplete lookup', async () => {
  let seenEvidence: import('../src/retrieval/retrieval').Evidence[] | undefined;
  const provider = {
    answer: async (_m: unknown, e?: import('../src/retrieval/retrieval').Evidence[]) => {
      seenEvidence = e;
      return 'We discussed workouts.';
    },
  };
  const router = {
    classify: async () => ({ route: 'search_history' as const, searchTerms: ['exercise'] }),
  };
  const history = { saveTurn: () => {}, findEvidence: () => [] };
  const records = [
    {
      conversationId: 'old',
      messages: [{ role: 'user' as const, content: 'I like workouts.', createdAt: '2026-01-01' }],
    },
  ];
  const skill = createSkill(id, provider, undefined, history, undefined, router, undefined, {
    find: async () => ({ evidence: records, complete: true }),
  });
  await skill.invoke(envelope('What did we discuss about exercise?'));
  assert.deepEqual(seenEvidence, records);
  const unavailable = createSkill(id, provider, undefined, history, undefined, router, undefined, {
    find: async () => ({ evidence: [], complete: false }),
  });
  const response = await unavailable.invoke(envelope('What did we discuss about exercise?'));
  assert.match(JSON.stringify(response.response.outputSpeech), /not fully available/);
});

test('always retrieval bypasses the classifier and calls answer exactly once', async () => {
  let answers = 0,
    classifies = 0,
    searches = 0;
  const context = {
    history: {
      records: [
        {
          conversationId: 'c',
          messages: [{ role: 'user' as const, content: 'I like workouts', createdAt: '2026' }],
        },
      ],
      complete: true,
    },
    personalMemory: {
      state: 'available' as const,
      complete: true,
      records: [{ topic: 'fitness', content: 'short workouts', source: 'automatic_unverified' }],
    },
  };
  const skill = createSkill(
    id,
    {
      answer: async (_m, e, _t, m, status) => {
        answers++;
        assert.equal(e?.length, 1);
        assert.equal(m?.records.length, 1);
        assert.equal(status?.historyComplete, true);
        return 'ok';
      },
    },
    undefined,
    undefined,
    undefined,
    {
      classify: async () => {
        classifies++;
        throw Error('should not run');
      },
    },
    undefined,
    undefined,
    {
      retrieve: async () => {
        searches++;
        return context;
      },
    },
  );
  const result = await skill.invoke(envelope('exercise'));
  assert.equal(answers, 1);
  assert.equal(classifies, 0);
  assert.equal(searches, 1);
  assert.match(JSON.stringify(result.response.outputSpeech), /ok/);
});

test('Alexa passes an explicit memory correction to the shared core', async () => {
  const { HistoryDatabase } = await import('../src/history/database');
  const db = new HistoryDatabase(':memory:', 30, true);
  try {
    db.addMemory('exercise', 'less than 30 minutes');
    const skill = createSkill(
      id,
      {
        answer: async () => {
          throw new Error('LLM must not be called');
        },
      },
      undefined,
      db,
    );
    const result = await skill.invoke(envelope('update memory for exercise to 45 minutes'));
    assert.match(JSON.stringify(result.response.outputSpeech), /Replace it with 45 minutes/);
    assert.equal(db.listMemories()[0].content, 'less than 30 minutes');
    const confirmation = envelope('');
    if (confirmation.request.type !== 'IntentRequest') throw new Error('expected intent');
    confirmation.request.intent = { name: 'AMAZON.YesIntent', confirmationStatus: 'NONE' };
    const confirmed = await skill.invoke(confirmation);
    assert.match(JSON.stringify(confirmed.response.outputSpeech), /Updated your exercise memory/);
    assert.equal(db.listMemories()[0].content, '45 minutes');
    assert.equal(db.nextExtractionJob(), null);
  } finally {
    db.close();
  }
});
