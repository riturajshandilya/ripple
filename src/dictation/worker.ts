import 'dotenv/config';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { DictationService, SelectionTransformError, type DictationMode } from './service';
import {
  createDictationFormatter,
  isValidTargetLanguage,
  type DictationFormatter,
  type DictationOutputMode,
  type DictationStyle,
} from './formatter';
import {
  WhisperCppTranscriber,
  WhisperLanguageVerificationError,
  type SpeechTranscriber,
} from '../speech/transcription';
import { isWhisperLanguageCode } from '../speech/languages';
import { TimingLog } from '../mac/timing';
import { DictationHistory } from './history';

interface WorkRequest {
  audioFile: string;
  mode: DictationMode;
  style: DictationStyle;
  outputMode: DictationOutputMode;
  targetLanguage: string;
  recordingDurationMs?: number;
  saveHistory?: boolean;
  selectedText?: string;
  inputLanguage: string;
  verifyEnglish: boolean;
}
export function validateWorkRequest(value: unknown): WorkRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid request');
  const request = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'audioFile',
    'mode',
    'style',
    'recordingDurationMs',
    'saveHistory',
    'outputMode',
    'targetLanguage',
    'selectedText',
    'inputLanguage',
    'verifyEnglish',
  ]);
  if (
    Object.keys(request).some((key) => !allowedKeys.has(key)) ||
    !['audioFile', 'mode', 'style'].every((key) => key in request) ||
    typeof request.audioFile !== 'string' ||
    !['raw', 'polish'].includes(String(request.mode)) ||
    !['plain', 'email', 'code'].includes(String(request.style)) ||
    (request.outputMode !== undefined &&
      !['spoken', 'romanize', 'translate'].includes(String(request.outputMode))) ||
    (request.targetLanguage !== undefined &&
      (typeof request.targetLanguage !== 'string' ||
        !isValidTargetLanguage(request.targetLanguage))) ||
    (request.saveHistory !== undefined && typeof request.saveHistory !== 'boolean') ||
    (request.selectedText !== undefined &&
      (typeof request.selectedText !== 'string' || request.selectedText.length > 12_000)) ||
    (request.inputLanguage !== undefined &&
      (typeof request.inputLanguage !== 'string' ||
        (request.inputLanguage !== 'auto' && !isWhisperLanguageCode(request.inputLanguage)))) ||
    (request.verifyEnglish !== undefined && typeof request.verifyEnglish !== 'boolean') ||
    (request.verifyEnglish === true && request.inputLanguage !== 'en') ||
    (request.recordingDurationMs !== undefined &&
      (typeof request.recordingDurationMs !== 'number' ||
        !Number.isFinite(request.recordingDurationMs) ||
        request.recordingDurationMs < 0 ||
        request.recordingDurationMs > 301000))
  )
    throw Error('Invalid request');
  const file = realpathSync(request.audioFile);
  const folder = dirname(file);
  const temp = realpathSync(tmpdir());
  const rel = relative(temp, folder);
  if (
    !rel ||
    rel.startsWith('..') ||
    rel.includes('/') ||
    !basename(folder).startsWith('ripple-dictation-') ||
    basename(file) !== 'input.wav'
  )
    throw Error('Invalid audio location');
  return {
    audioFile: file,
    mode: request.mode as DictationMode,
    style: request.style as DictationStyle,
    outputMode: (request.outputMode ?? 'spoken') as DictationOutputMode,
    targetLanguage: (request.targetLanguage ?? 'English') as string,
    recordingDurationMs: request.recordingDurationMs as number | undefined,
    saveHistory: request.saveHistory as boolean | undefined,
    selectedText: request.selectedText as string | undefined,
    inputLanguage: (request.inputLanguage ?? 'auto') as string,
    verifyEnglish: (request.verifyEnglish ?? false) as boolean,
  };
}
async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (input.length > 64 * 1024) throw Error('Request too large');
  }
  const request = validateWorkRequest(JSON.parse(input));
  const root = process.cwd();
  const timing = new TimingLog(join(root, 'data', 'performance.jsonl'));
  if (request.recordingDurationMs !== undefined)
    timing.duration('recording', request.recordingDurationMs, true);
  const progress = (stage: 'transcribing' | 'polishing' | 'formatting') =>
    process.stderr.write(`${JSON.stringify({ stage })}\n`);
  const baseTranscriber = new WhisperCppTranscriber(
    '/opt/homebrew/bin/whisper-cli',
    resolve(root, '.voice-models/ggml-small.bin'),
    undefined,
    request.inputLanguage,
    request.verifyEnglish ? 'en' : undefined,
  );
  const transcriber: SpeechTranscriber = {
    transcribe: async (audio, output) => {
      const start = Date.now();
      let success = false;
      progress('transcribing');
      try {
        const value = await baseTranscriber.transcribe(audio, output);
        success = true;
        return value;
      } finally {
        timing.duration('transcription', Date.now() - start, success);
      }
    },
  };
  const needsFormatter =
    request.mode === 'polish' ||
    request.outputMode !== 'spoken' ||
    request.selectedText !== undefined;
  const baseFormatter = needsFormatter
    ? createDictationFormatter(process.env, (provider, duration, success) =>
        timing.formatterAttempt(provider, duration, success),
      )
    : undefined;
  const formatter: DictationFormatter | undefined = baseFormatter
    ? {
        id: baseFormatter.id,
        location: 'local',
        format: async (text, style, options) => {
          const start = Date.now();
          let success = false;
          progress(options?.polish ? 'polishing' : 'formatting');
          try {
            const value = await baseFormatter.format(text, style, options);
            success = true;
            return value;
          } finally {
            timing.duration('formatting', Date.now() - start, success);
          }
        },
      }
    : undefined;
  const service = new DictationService(transcriber, formatter);
  const result = await service.process(
    request.audioFile,
    join(dirname(request.audioFile), 'transcript'),
    {
      mode: request.mode,
      style: request.style,
      outputMode: request.outputMode,
      targetLanguage: request.targetLanguage,
      cloudAllowed: true,
      selectionText: request.selectedText,
    },
  );
  let historySaved = false;
  let historyId: string | undefined;
  if (request.saveHistory) {
    try {
      const history = new DictationHistory(join(root, 'data', 'dictations.sqlite'));
      try {
        historyId = history.add({
          rawText: result.rawText,
          text: result.text,
          mode: result.mode,
          style: request.style,
          outputMode: result.outputMode,
          targetLanguage: result.targetLanguage,
          status: result.status,
        });
        historySaved = true;
      } finally {
        history.close();
      }
    } catch {
      /* report the failure to the UI without logging dictated text */
    }
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      ...result,
      historySaved,
      ...(historyId ? { historyId } : {}),
    }),
  );
}
if (require.main === module)
  void main().catch((error: unknown) => {
    const code =
      error instanceof SelectionTransformError
        ? error.code
        : error instanceof WhisperLanguageVerificationError
          ? 'language_check_failed'
          : 'processing_failed';
    process.stdout.write(JSON.stringify({ ok: false, error: code }));
    process.exitCode = 1;
  });
