import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectedWhisperLanguage,
  WhisperCppTranscriber,
  WhisperLanguageVerificationError,
} from '../src/speech/transcription';
import { MithiSynthesizer } from '../src/speech/synthesis';

test('Whisper adapter passes the file and model to the command and reads the private transcript', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-speech-test-'));
  try {
    const outputBase = join(dir, 'result');
    let invoked = false;
    const transcriber = new WhisperCppTranscriber('whisper', 'model.bin', async (command, args) => {
      invoked = true;
      assert.equal(command, 'whisper');
      assert.ok(args.includes('input.wav'));
      assert.ok(args.includes('model.bin'));
      assert.ok(args.includes('auto'));
      writeFileSync(`${outputBase}.txt`, ' example transcript ');
    });
    assert.equal(await transcriber.transcribe('input.wav', outputBase), ' example transcript ');
    assert.equal(invoked, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Whisper adapter forces a manually selected language', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-speech-language-test-'));
  try {
    const outputBase = join(dir, 'result');
    const calls: string[][] = [];
    const transcriber = new WhisperCppTranscriber(
      'whisper',
      'model.bin',
      async (_command, args) => {
        calls.push(args);
        writeFileSync(`${outputBase}.txt`, 'नमस्ते');
      },
      'hi',
    );
    assert.equal(await transcriber.transcribe('input.wav', outputBase), 'नमस्ते');
    assert.deepEqual(calls[0].slice(calls[0].indexOf('-l'), calls[0].indexOf('-l') + 2), [
      '-l',
      'hi',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('strict English mode detects first and refuses non-English or unknown detections', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ripple-speech-language-test-'));
  try {
    const outputBase = join(dir, 'result');
    const calls: string[][] = [];
    const accepted = new WhisperCppTranscriber(
      'whisper',
      'model.bin',
      async (_command, args) => {
        calls.push(args);
        if (args.includes('--detect-language')) return 'auto-detected language: en (p = 0.98)';
        writeFileSync(`${outputBase}.txt`, 'Good morning.');
      },
      'en',
      'en',
    );
    assert.equal(await accepted.transcribe('input.wav', outputBase), 'Good morning.');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].includes('--detect-language'), true);
    assert.deepEqual(calls[1].slice(calls[1].indexOf('-l'), calls[1].indexOf('-l') + 2), [
      '-l',
      'en',
    ]);

    const rejected = new WhisperCppTranscriber(
      'whisper',
      'model.bin',
      async () => 'auto-detected language: hi (p = 0.99)',
      'en',
      'en',
    );
    await assert.rejects(
      rejected.transcribe('input.wav', outputBase),
      WhisperLanguageVerificationError,
    );
    const unknown = new WhisperCppTranscriber(
      'whisper',
      'model.bin',
      async () => 'no language line',
      'en',
      'en',
    );
    await assert.rejects(
      unknown.transcribe('input.wav', outputBase),
      WhisperLanguageVerificationError,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Whisper detected-language parser accepts the CLI diagnostic shape', () => {
  assert.equal(detectedWhisperLanguage('auto-detected language: en (p = 0.984427)'), 'en');
  assert.equal(detectedWhisperLanguage('auto-detected language: hi (p = 0.81)'), 'hi');
  assert.equal(detectedWhisperLanguage('no detection available'), undefined);
});

test('Mithi adapter sends speech text on stdin rather than a process argument', async () => {
  let called = false;
  const synth = new MithiSynthesizer('python', 'speak.py', 'model', async (cmd, args, input) => {
    called = true;
    assert.equal(cmd, 'python');
    assert.deepEqual(args, ['speak.py', 'model']);
    assert.deepEqual(JSON.parse(input!), {
      text: 'private sentence',
      lang: 'hi',
      voice: 'charvi',
      output: 'audio.wav',
    });
    assert.ok(!args.join(' ').includes('private sentence'));
  });
  await synth.synthesize('private sentence', 'hi', 'audio.wav');
  assert.equal(called, true);
});
