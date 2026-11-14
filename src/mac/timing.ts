import { appendFileSync, chmodSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

export interface RetrievalSummary {
  durationMs: number;
  historyCount: number;
  memoryCount: number;
  historyComplete: boolean;
  memoryComplete: boolean;
}

// Content-free metrics only. One rotated file bounds disk use.
export class TimingLog {
  constructor(
    private readonly path: string,
    private readonly maxBytes = 1_000_000,
  ) {}
  duration(
    stage:
      | 'recording'
      | 'transcription'
      | 'formatting'
      | 'assistant'
      | 'provider'
      | 'speech_synthesis'
      | 'playback',
    durationMs: number,
    success: boolean,
  ): void {
    this.write({ stage, durationMs: Math.max(0, Math.round(durationMs)), success });
  }
  formatterAttempt(providerId: string, durationMs: number, success: boolean): void {
    if (
      ![
        'groq_1',
        'groq_2',
        'openrouter_1',
        'openrouter_2',
        'ollama:qwen3:1.7b',
        'ollama:qwen3:14b',
      ].includes(providerId)
    )
      return;
    this.write({
      stage: 'formatter_provider',
      providerId,
      durationMs: Math.max(0, Math.round(durationMs)),
      success,
    });
  }
  retrieval(summary: RetrievalSummary): void {
    this.write({
      stage: 'retrieval',
      durationMs: summary.durationMs,
      historyCount: summary.historyCount,
      memoryCount: summary.memoryCount,
      historyComplete: summary.historyComplete,
      memoryComplete: summary.memoryComplete,
    });
  }
  private write(metrics: Record<string, string | number | boolean>): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
      if (existsSync(this.path) && statSync(this.path).size >= this.maxBytes)
        renameSync(this.path, `${this.path}.1`);
      appendFileSync(
        this.path,
        `${JSON.stringify({ time: new Date().toISOString(), ...metrics })}\n`,
        { mode: 0o600 },
      );
      chmodSync(this.path, 0o600);
    } catch {
      console.error('Could not write performance metrics.');
    }
  }
}
