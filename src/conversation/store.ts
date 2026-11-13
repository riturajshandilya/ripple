import { ConversationMessage } from '../llm/provider';

interface Session {
  messages: ConversationMessage[];
  touched: number;
  busy: boolean;
}

// Entire turns are kept or discarded together. Cleanup happens on access; capacity is bounded.
export class ConversationStore {
  private readonly sessions = new Map<string, Session>();
  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly maxSessions = 100,
    private readonly maxTurns = 5,
    private readonly now = Date.now,
  ) {}

  begin(
    id: string,
    question: string,
  ): { messages: ConversationMessage[]; commit: (answer?: string) => void } | null {
    const time = this.now();
    for (const [key, entry] of this.sessions)
      if (time - entry.touched >= this.ttlMs) this.sessions.delete(key);
    let entry = this.sessions.get(id);
    if (entry?.busy) return null;
    if (!entry) {
      if (this.sessions.size >= this.maxSessions) {
        let oldest: string | undefined;
        let oldestTime = Infinity;
        for (const [key, value] of this.sessions)
          if (!value.busy && value.touched < oldestTime) {
            oldest = key;
            oldestTime = value.touched;
          }
        if (oldest === undefined) return null;
        this.sessions.delete(oldest);
      }
      entry = { messages: [], touched: time, busy: false };
      this.sessions.set(id, entry);
    }
    entry.busy = true;
    entry.touched = time;
    const current = entry;
    const messages: ConversationMessage[] = [
      ...entry.messages.slice(-2 * (this.maxTurns - 1)),
      { role: 'user', content: question },
    ];
    return {
      messages,
      commit: (answer?: string) => {
        if (this.sessions.get(id) !== current) return;
        if (answer !== undefined)
          current.messages = [...messages, { role: 'assistant' as const, content: answer }].slice(
            -2 * this.maxTurns,
          );
        current.busy = false;
        current.touched = this.now();
      },
    };
  }
  delete(id: string): void {
    this.sessions.delete(id);
  }
}
