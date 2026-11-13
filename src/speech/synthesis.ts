import { runSpeechCommand, type SpeechCommand } from './process';

export interface SpeechSynthesizer {
  synthesize(text: string, language: 'hi' | 'en', outputFile: string): Promise<void>;
}

export class MithiSynthesizer implements SpeechSynthesizer {
  constructor(
    private readonly python: string,
    private readonly script: string,
    private readonly modelDirectory: string,
    private readonly run: SpeechCommand = runSpeechCommand,
  ) {}
  async synthesize(text: string, language: 'hi' | 'en', outputFile: string): Promise<void> {
    await this.run(
      this.python,
      [this.script, this.modelDirectory],
      JSON.stringify({
        text,
        lang: language,
        voice: 'charvi',
        output: outputFile,
      }),
    );
  }
}
