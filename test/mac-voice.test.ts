import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechLanguage, isNonSpeechTranscript } from '../src/mac/voice';

test('speech language chooses Hindi for Devanagari and English otherwise', () => {
  assert.equal(speechLanguage('Hello, how are you?'), 'en');
  assert.equal(speechLanguage('आपकी meeting कल है'), 'hi');
  // Romanized Hinglish is ambiguous; this heuristic deliberately falls back to English.
  assert.equal(speechLanguage('Kal meeting hai'), 'en');
});

test('known non-speech Whisper captions are not passed to the assistant', () => {
  assert.equal(isNonSpeechTranscript('[MUSIC PLAYING]'), true);
  assert.equal(isNonSpeechTranscript('[Music]'), true);
  assert.equal(isNonSpeechTranscript('Please stop the music'), false);
});
