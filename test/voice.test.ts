import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceInstructions } from '../src/llm/providers';

test('voice instructions apply alongside custom and evidence instructions', () => {
  const direct = voiceInstructions('Custom instruction.', false);
  assert.match(direct, /Custom instruction/);
  assert.match(direct, /voice assistant/);
  assert.match(direct, /Never use Markdown/);
  const history = voiceInstructions('Custom instruction.', true);
  assert.match(history, /untrusted data/);
  assert.match(history, /Never use Markdown/);
});
