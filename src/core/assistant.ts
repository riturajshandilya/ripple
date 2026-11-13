import { LLMProvider } from '../llm/provider';
import { ConversationStore } from '../conversation/store';
import { HistoryWriter, type MemoryRecord } from '../history/database';
import { HistorySearch } from '../retrieval/retrieval';
import type { PersonalMemoryLookup } from '../memory/semantic';
import type { HybridHistoryLookup } from '../retrieval/history-semantic';
import type { AlwaysRetrieval } from '../retrieval/always';
import { beforeDeadline, Router, rulesRouter, validateRoute } from '../retrieval/router';

export interface RetrievalSummary {
  durationMs: number;
  historyCount: number;
  memoryCount: number;
  historyComplete: boolean;
  memoryComplete: boolean;
}

/** Transport-independent orchestration for one conversation turn. */
interface PendingCorrection {
  records: MemoryRecord[];
  value: string;
  expiresAt: number;
}

export class AssistantCore {
  private readonly pending = new Map<string, PendingCorrection>();
  private readonly activeTurns = new Map<string, symbol>();
  constructor(
    private readonly provider: LLMProvider,
    private readonly store = new ConversationStore(),
    private readonly history?: HistoryWriter & Partial<HistorySearch>,
    private readonly onHistoryError: () => void = () => {},
    private readonly router: Router = rulesRouter,
    private readonly memoryLookup?: PersonalMemoryLookup,
    private readonly historyLookup?: HybridHistoryLookup,
    private readonly alwaysRetrieval?: AlwaysRetrieval,
    private readonly onRetrieval?: (summary: RetrievalSummary) => void,
    private readonly onProviderTiming?: (summary: { durationMs: number; success: boolean }) => void,
  ) {}

  endSession(id: string): void {
    this.store.delete(id);
    this.pending.delete(id);
    this.activeTurns.delete(id);
  }

  async respond(id: string, question: string): Promise<string> {
    const turn = this.store.begin(id, question);
    if (!turn) return 'Please wait a moment and try again.';
    const deadline = Date.now() + 6000;
    const active = Symbol();
    this.activeTurns.set(id, active);
    const finish = (answer: string) => {
      turn.commit(answer);
      try {
        this.history?.saveTurn(id, question, answer, { extractMemory: false });
      } catch {
        this.onHistoryError();
      }
      return answer;
    };
    const timeProvider = async <T>(work: () => Promise<T>): Promise<T> => {
      const started = Date.now();
      let success = false;
      try {
        const value = await work();
        success = true;
        return value;
      } finally {
        try {
          this.onProviderTiming?.({ durationMs: Date.now() - started, success });
        } catch {
          /* diagnostics are optional */
        }
      }
    };
    try {
      const input = question
        .trim()
        .toLocaleLowerCase('en-US')
        .replace(/[,.!?।]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
      const confirmed =
        /^(?:yes(?: please)?(?: update it| do it)?(?: please)?|update it(?: please)?|do it(?: please)?|confirm|हाँ|जी हाँ|कर दो|हाँ कर दो)$/u.test(
          input,
        );
      const cancelled = /^(?:no|no thanks|cancel|never mind|stop|नहीं|रद्द करो)$/u.test(input);
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        if (pending.expiresAt <= Date.now()) {
          if (confirmed) return finish('That proposed update expired. Please request it again.');
        } else if (cancelled) return finish('Cancelled. I did not change your memory.');
        else if (confirmed) {
          if (!this.history?.commitMemoryCorrection)
            return finish('Memory updates are unavailable right now.');
          try {
            const result = this.history.commitMemoryCorrection(pending.records, pending.value);
            return finish(
              result === 'updated'
                ? `Updated your ${pending.records[0].topic} memory to ${pending.value}.`
                : 'Those memories changed since you reviewed them. Please request the update again.',
            );
          } catch {
            return finish('I could not update the memory because the database operation failed.');
          }
        }
        // Any other utterance cancels the old proposal and is processed as a new request.
      }
      const correction =
        /^(?:please\s+)?update\s+(?:my\s+)?memory\s+(?:for\s+)?(.{1,100}?)\s+to\s+(.{1,500}?)\s*[.!?]?$/iu.exec(
          question.trim(),
        );
      if (correction) {
        const matches =
          this.history
            ?.listMemories?.()
            .filter(
              (m) =>
                m.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US') ===
                correction[1].trim().normalize('NFKC').toLocaleLowerCase('en-US'),
            ) ?? [];
        if (!matches.length)
          return finish(
            'I could not find a memory with that exact topic. Please check the topic and try again.',
          );
        return finish(this.prepareCorrection(id, matches[0].id, correction[2]));
      }
      if (/^(?:please\s+)?update\s+(?:my\s+)?memory\b/iu.test(question.trim()))
        return finish(
          'Please say update memory for, then the exact topic, then to, followed by the new value.',
        );
      let answer: string;
      if (this.alwaysRetrieval) {
        const budget = Math.min(1800, Math.max(1, deadline - Date.now() - 2000));
        const fallback = {
          history: { records: [], complete: false },
          personalMemory: { state: 'unavailable' as const, complete: false, records: [] },
        };
        const retrievalStarted = Date.now();
        // Short replies and references such as “update it” need their recent topic.
        const followUp =
          Boolean(pending) ||
          /\b(?:it|that|this|them|those|these|that one|what about|my preference|the memory|my memory)\b/iu.test(
            question,
          ) ||
          /(?:वह|वो|इसे|उसको|इसको)/u.test(question) ||
          (question.match(/[\p{L}\p{N}]+/gu) ?? []).length <= 5;
        const recentUserQuestions = followUp
          ? turn.messages
              .slice(0, -1)
              .filter((m) => m.role === 'user')
              .slice(-2)
              .map((m) => m.content.slice(0, 300))
          : [];
        const context = await beforeDeadline(
          this.alwaysRetrieval.retrieve(question, budget, recentUserQuestions),
          budget,
        ).catch(() => fallback);
        try {
          this.onRetrieval?.({
            durationMs: Date.now() - retrievalStarted,
            historyCount: context.history.records.length,
            memoryCount: context.personalMemory.records.length,
            historyComplete: context.history.complete,
            memoryComplete: context.personalMemory.complete,
          });
        } catch {
          /* Diagnostics must not affect the answer. */
        }
        const args = [
          turn.messages,
          context.history.records.length ? context.history.records : undefined,
          deadline - Date.now(),
          context.personalMemory,
          {
            historyComplete: context.history.complete,
            memoryComplete: context.personalMemory.complete,
          },
        ] as const;
        if (
          this.provider.answerWithTools &&
          this.history?.memoryCorrectionTargets &&
          this.history.commitMemoryCorrection
        ) {
          const result = await timeProvider(() =>
            beforeDeadline(this.provider.answerWithTools!(...args), deadline - Date.now()),
          );
          if (this.activeTurns.get(id) !== active) {
            turn.commit();
            return 'The conversation ended before the request finished.';
          }
          if (result.type === 'tool') {
            if (
              result.name !== 'propose_memory_update' ||
              !result.arguments ||
              typeof result.arguments !== 'object' ||
              Array.isArray(result.arguments)
            )
              throw new Error('Invalid tool proposal');
            const proposal = result.arguments as Record<string, unknown>;
            if (
              Object.keys(proposal).sort().join(',') !== 'memory_id,new_value' ||
              typeof proposal.memory_id !== 'string' ||
              typeof proposal.new_value !== 'string' ||
              !context.personalMemory.records.some((m) => m.id === proposal.memory_id)
            )
              throw new Error('Invalid tool arguments');
            // Do not reuse a stale value from conversation history. The proposed value
            // must appear in this turn; the user still reviews it before any write.
            const normalizedQuestion = question
              .normalize('NFKC')
              .toLocaleLowerCase('en-US')
              .replace(/\s+/gu, ' ');
            const normalizedValue = proposal.new_value
              .trim()
              .normalize('NFKC')
              .toLocaleLowerCase('en-US')
              .replace(/\s+/gu, ' ');
            if (!normalizedValue || !normalizedQuestion.includes(normalizedValue))
              return finish('What new value would you like me to remember?');
            return finish(this.prepareCorrection(id, proposal.memory_id, proposal.new_value));
          }
          answer = result.text;
        } else
          answer = await timeProvider(() =>
            beforeDeadline(this.provider.answer(...args), deadline - Date.now()),
          );
      } else {
        const routeBudget = Math.min(2500, deadline - Date.now());
        const memoryPromise = this.memoryLookup
          ? beforeDeadline(this.memoryLookup.findRelevant(question, 1500), 1600).catch(() => ({
              state: 'unavailable' as const,
              records: [],
            }))
          : Promise.resolve(undefined);
        const decision = validateRoute(
          await beforeDeadline(this.router.classify(turn.messages, routeBudget), routeBudget),
        );
        const personalMemory = await memoryPromise;
        if (decision.route === 'clarify') {
          answer = 'Are you asking about a past conversation? Please mention the topic.';
        } else if (decision.route === 'search_history') {
          if (!this.history?.findEvidence) throw new Error('History search unavailable');
          const query = decision.searchTerms.join(' ');
          let complete = true;
          let evidence;
          if (this.historyLookup) {
            const budget = Math.min(1500, Math.max(0, deadline - Date.now() - 2000));
            try {
              const result = await beforeDeadline(this.historyLookup.find(query, budget), budget);
              evidence = result.evidence;
              complete = result.complete;
            } catch {
              evidence = this.history.findEvidence(query);
              complete = false;
            }
          } else evidence = this.history.findEvidence(query);
          answer = evidence.length
            ? await beforeDeadline(
                this.provider.answer(
                  turn.messages,
                  evidence,
                  deadline - Date.now(),
                  personalMemory,
                ),
                deadline - Date.now(),
              )
            : complete
              ? 'I could not find a matching conversation. Try naming the topic we discussed.'
              : 'My conversation search is not fully available yet. Please try again shortly.';
        } else {
          answer = await beforeDeadline(
            this.provider.answer(turn.messages, undefined, deadline - Date.now(), personalMemory),
            deadline - Date.now(),
          );
        }
      }
      answer = answer.trim().slice(0, 3000);
      if (!answer) throw new Error('Empty response');
      turn.commit(answer);
      try {
        this.history?.saveTurn(id, question, answer);
      } catch {
        this.onHistoryError();
      }
      return answer;
    } catch {
      turn.commit();
      return 'Sorry, I could not answer right now. Please try again.';
    } finally {
      if (this.activeTurns.get(id) === active) this.activeTurns.delete(id);
    }
  }

  private prepareCorrection(sessionId: string, memoryId: string, newValue: string): string {
    const value = newValue.trim();
    if (!value || value.length > 500 || /[\u0000-\u001f\u007f]/u.test(value))
      return 'I could not prepare that update. Please state the new value again.';
    const targets = this.history?.memoryCorrectionTargets?.(memoryId) ?? [];
    if (!targets.length) return 'I could not find that memory. Please request the update again.';
    if (
      targets.length > 5 ||
      targets.reduce((n, m) => n + m.content.length, value.length + targets[0].topic.length) > 600
    )
      return 'There are too many details to review by voice. Please review these memories locally.';
    const now = Date.now();
    for (const [key, item] of this.pending) if (item.expiresAt <= now) this.pending.delete(key);
    if (!this.pending.has(sessionId) && this.pending.size >= 100)
      return 'Too many updates are awaiting confirmation. Please try again later.';
    this.pending.set(sessionId, { records: targets, value, expiresAt: now + 120000 });
    const oldValues = targets.map((m) => m.content).join('; ');
    return `I found ${targets.length === 1 ? 'this memory' : `${targets.length} memories`} for ${targets[0].topic}: ${oldValues}. Replace ${targets.length === 1 ? 'it' : 'them'} with ${value}?`;
  }
}
