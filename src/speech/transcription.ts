import { readFileSync } from 'node:fs';
import { runSpeechCommand, type SpeechCommand } from './process';

export class WhisperLanguageVerificationError extends Error {
  constructor() {
    super('Could not verify the selected speech language.');
  }
}

export const detectedWhisperLanguage = (diagnostics: string): string | undefined =>
  /auto-detected language:\s*([a-z]{2,3})\s*\(p\s*=\s*[0-9.]+\)/iu
    .exec(diagnostics)?.[1]
    ?.toLowerCase();

export interface SpeechTranscriber {
  /** Transcribe an audio file; outputBase must be in a caller-owned private temporary directory. */
  transcribe(audioFile: string, outputBase: string): Promise<string>;
}

export class WhisperCppTranscriber implements SpeechTranscriber {
  constructor(
    private readonly executable: string,
    private readonly model: string,
    private readonly run: SpeechCommand = runSpeechCommand,
    private readonly language = 'auto',
    private readonly verifyLanguage?: string,
  ) {}
  async transcribe(audioFile: string, outputBase: string): Promise<string> {
    if (this.verifyLanguage) {
      const diagnostics = await this.run(
        this.executable,
        ['-m', this.model, '-f', audioFile, '-l', 'auto', '--detect-language'],
        undefined,
        false,
        true,
      );
      if (
        typeof diagnostics !== 'string' ||
        detectedWhisperLanguage(diagnostics) !== this.verifyLanguage
      )
        throw new WhisperLanguageVerificationError();
    }
    await this.run(this.executable, [
      '-m',
      this.model,
      '-f',
      audioFile,
      '-l',
      this.language,
      '-otxt',
      '-of',
      outputBase,
      '-nt',
      '-np',
    ]);
    // whisper-cli terminates the output file with one transport newline.
    return readFileSync(`${outputBase}.txt`, 'utf8').replace(/\r?\n$/u, '');
  }
}
