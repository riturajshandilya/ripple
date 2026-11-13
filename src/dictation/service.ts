import type { SpeechTranscriber } from '../speech/transcription';
import type { DictationFormatter, DictationOutputMode, DictationStyle } from './formatter';
import { isSelectionTransformCommand, MAX_SELECTED_TEXT_CODE_UNITS } from './selection-transform';

export type DictationMode = 'raw' | 'polish';
export interface DictationResult {
  rawText: string;
  text: string;
  mode: DictationMode;
  status: 'raw' | 'polished' | 'romanized' | 'translated' | 'fallback';
  outputMode: DictationOutputMode;
  targetLanguage: string;
  formatter?: string;
  fallbackReason?: 'no_formatter' | 'cloud_not_allowed' | 'formatter_failed';
  selectionTransform: boolean;
}

export class SelectionTransformError extends Error {
  constructor(readonly code: 'selection_required' | 'transformation_failed') {
    super(code);
  }
}

/** No UI, insertion, persistence or implicit cloud access. Caller owns temporary audio and transcript files. */
export class DictationService {
  constructor(
    private readonly transcriber: SpeechTranscriber,
    private readonly formatter?: DictationFormatter,
  ) {}
  async process(
    audioFile: string,
    outputBase: string,
    options: {
      mode: DictationMode;
      style: DictationStyle;
      outputMode?: DictationOutputMode;
      targetLanguage?: string;
      cloudAllowed?: boolean;
      selectionText?: string;
    },
  ): Promise<DictationResult> {
    const rawText = await this.transcriber.transcribe(audioFile, outputBase);
    if (
      !rawText.trim() ||
      /^\s*\[(?:music(?: playing)?|applause|silence|noise|blank_audio)\]\s*$/iu.test(rawText)
    )
      throw new Error('No speech recognized');
    const outputMode = options.outputMode ?? 'spoken';
    const targetLanguage = options.targetLanguage?.trim() || 'English';
    const transformingSelection = isSelectionTransformCommand(rawText);
    if (
      transformingSelection &&
      (!options.selectionText || options.selectionText.trim().length === 0)
    )
      throw new SelectionTransformError('selection_required');
    if (transformingSelection && options.selectionText!.length > MAX_SELECTED_TEXT_CODE_UNITS)
      throw new SelectionTransformError('transformation_failed');
    if (options.mode === 'raw' && outputMode === 'spoken' && !transformingSelection)
      return {
        rawText,
        text: rawText,
        mode: 'raw',
        status: 'raw',
        outputMode,
        targetLanguage,
        selectionTransform: false,
      };
    if (!this.formatter && transformingSelection)
      throw new SelectionTransformError('transformation_failed');
    if (!this.formatter)
      return {
        rawText,
        text: rawText,
        mode: 'polish',
        status: 'fallback',
        fallbackReason: 'no_formatter',
        outputMode,
        targetLanguage,
        selectionTransform: false,
      };
    if (
      this.formatter.location === 'cloud' &&
      options.cloudAllowed !== true &&
      transformingSelection
    )
      throw new SelectionTransformError('transformation_failed');
    if (this.formatter.location === 'cloud' && options.cloudAllowed !== true)
      return {
        rawText,
        text: rawText,
        mode: 'polish',
        status: 'fallback',
        fallbackReason: 'cloud_not_allowed',
        outputMode,
        targetLanguage,
        selectionTransform: false,
      };
    try {
      const text = await this.formatter.format(rawText, options.style, {
        outputMode,
        targetLanguage,
        polish: transformingSelection || options.mode === 'polish',
        ...(transformingSelection ? { selectionText: options.selectionText } : {}),
      });
      if (!text.trim()) throw new Error('Empty formatter result');
      const status = transformingSelection
        ? 'polished'
        : options.mode === 'raw'
          ? outputMode === 'romanize'
            ? 'romanized'
            : 'translated'
          : 'polished';
      return {
        rawText,
        text,
        mode: options.mode,
        status,
        outputMode,
        targetLanguage,
        formatter: this.formatter.id,
        selectionTransform: transformingSelection,
      };
    } catch {
      if (transformingSelection) throw new SelectionTransformError('transformation_failed');
      return {
        rawText,
        text: rawText,
        mode: 'polish',
        status: 'fallback',
        fallbackReason: 'formatter_failed',
        outputMode,
        targetLanguage,
        selectionTransform: false,
      };
    }
  }
}
