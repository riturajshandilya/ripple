import type { HistoryDatabase } from '../history/database';
import type { MemoryExtractor } from './extraction';

// A single in-process worker; the SQLite job row survives restarts.
export class MemoryWorker {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;
  constructor(
    private readonly history: HistoryDatabase,
    private readonly extractor: MemoryExtractor,
    private readonly onFailure: () => void = () => {},
  ) {}
  start(): void {
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    this.timer.unref();
    void this.tick();
  }
  async tick(): Promise<void> {
    if (this.stopping || this.running) return;
    this.running = this.processOne();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  private async processOne(): Promise<void> {
    let job: ReturnType<HistoryDatabase['nextExtractionJob']>;
    try {
      job = this.history.nextExtractionJob();
    } catch {
      this.onFailure();
      return;
    }
    if (!job) return;
    try {
      const candidates = await this.extractor.extract(job.messages, 5500);
      this.history.finishExtraction(job.messageId, candidates);
    } catch {
      try {
        this.history.failExtraction(job.messageId);
      } catch {
        /* job remains pending for a later restart */
      }
      this.onFailure();
    }
  }
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
