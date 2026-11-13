import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { AssistantCore } from '../core/assistant';
import { createProvider } from '../llm/providers';
import { HistoryDatabase } from '../history/database';
import { historyPath, retentionDays } from '../history/config';
import { createAlwaysRetrieval } from '../retrieval/always';
import { rulesRouter } from '../retrieval/router';
import { TimingLog } from './timing';
import { runSpeechCommand, ProcessFailure } from '../speech/process';
import { WhisperCppTranscriber } from '../speech/transcription';
import { MithiSynthesizer } from '../speech/synthesis';

export function isNonSpeechTranscript(text: string): boolean {
  return /^\s*\[(?:music(?: playing)?|applause|silence|noise)\]\s*$/iu.test(text);
}

// Only use Devanagari as a basic hint, not as full language detection.
export function speechLanguage(text: string): 'hi' | 'en' {
  return /[\u0900-\u097f]/u.test(text) ? 'hi' : 'en';
}

async function main(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error('Run voice mode from an interactive terminal.');
  const root = process.cwd();
  const model = join(root, '.voice-models', 'ggml-small.bin');
  const mithi = join(root, '.voice-models', 'mithi');
  const python = join(root, '.voice-venv', 'bin', 'python');
  const recorder = join(root, 'scripts', 'voice', 'record.py');
  const transcriber = new WhisperCppTranscriber('/opt/homebrew/bin/whisper-cli', model);
  const synthesizer = new MithiSynthesizer(
    python,
    join(root, 'scripts', 'voice', 'speak.py'),
    mithi,
  );
  for (const path of [model, join(mithi, 'decoder.safetensors'), python, recorder]) {
    if (!existsSync(path))
      throw new Error('Voice dependencies are missing. See the Mac voice setup in README.md.');
  }
  const kind = process.env.LLM_PROVIDER || 'groq';
  if (!['groq', 'openai'].includes(kind)) throw new Error('Invalid LLM_PROVIDER.');
  const key = kind === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) throw new Error('The selected provider key is missing from the local environment.');
  const selectedModel =
    kind === 'groq'
      ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
      : process.env.OPENAI_MODEL || 'gpt-5-mini';
  const provider = createProvider(
    kind,
    key,
    selectedModel,
    `${process.env.SYSTEM_PROMPT || 'Be a helpful assistant.'} Respond naturally in the language or mix of languages the user uses.`,
  );
  const autoMemory = process.env.AUTO_MEMORY_ENABLED ?? 'true';
  if (!['true', 'false'].includes(autoMemory)) throw new Error('Invalid AUTO_MEMORY_ENABLED.');
  const history = new HistoryDatabase(historyPath(), retentionDays(), autoMemory === 'true');
  const timing = new TimingLog(join(root, 'data', 'performance.jsonl'));
  const core = new AssistantCore(
    provider,
    undefined,
    history,
    () => console.error('Could not save conversation history.'),
    rulesRouter,
    undefined,
    undefined,
    createAlwaysRetrieval(history),
    (summary) => {
      timing.retrieval(summary);
      console.log('Retrieval:', JSON.stringify(summary));
    },
    (summary) => {
      timing.duration('provider', summary.durationMs, summary.success);
      console.log('Provider timing:', JSON.stringify(summary));
    },
  );
  const timed = async <T>(
    stage: 'transcription' | 'assistant' | 'speech_synthesis' | 'playback',
    work: () => Promise<T>,
  ): Promise<T> => {
    const start = Date.now();
    let success = false;
    try {
      const result = await work();
      success = true;
      return result;
    } finally {
      const durationMs = Date.now() - start;
      timing.duration(stage, durationMs, success);
      console.log('Timing:', JSON.stringify({ stage, durationMs, success }));
    }
  };
  const session = `mac:${randomUUID()}`;
  const temp = mkdtempSync(join(tmpdir(), 'ripple-voice-'));
  const cleanupOnInterrupt = () => {
    rmSync(temp, { recursive: true, force: true });
    process.exit(130);
  };
  process.once('SIGINT', cleanupOnInterrupt);
  try {
    while (true) {
      const recording = join(temp, 'input.wav');
      const result = join(temp, 'transcript');
      const output = join(temp, 'answer.wav');
      try {
        try {
          await runSpeechCommand(python, [recorder, recording], undefined, true);
        } catch (error) {
          if (error instanceof ProcessFailure && error.code === 4) continue;
          throw error;
        }
        // WAV is 16 kHz, mono, 16-bit PCM, with Python wave's 44-byte header.
        timing.duration('recording', Math.max(0, statSync(recording).size - 44) / 32, true);
        console.log('Transcribing locally...');
        const question = (
          await timed('transcription', () => transcriber.transcribe(recording, result))
        ).trim();
        if (!question || question.length > 1000 || isNonSpeechTranscript(question)) {
          console.log('No usable question was recognized. Please try again.');
          continue;
        }
        console.log('Thinking...');
        const answer = await timed('assistant', () => core.respond(session, question));
        console.log('Preparing speech locally...');
        await timed('speech_synthesis', () =>
          synthesizer.synthesize(answer, speechLanguage(answer), output),
        );
        await timed('playback', () => runSpeechCommand('/usr/bin/afplay', [output]));
      } catch (error) {
        console.error('The voice turn failed. Check permissions and local model setup.');
        if (error instanceof ProcessFailure && error.code === 3) break;
      } finally {
        for (const file of [recording, `${result}.txt`, output]) rmSync(file, { force: true });
      }
    }
  } finally {
    process.removeListener('SIGINT', cleanupOnInterrupt);
    core.endSession(session);
    history.close();
    rmSync(temp, { recursive: true, force: true });
  }
}

if (require.main === module)
  void main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
