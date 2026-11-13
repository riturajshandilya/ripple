import type { Evidence } from '../retrieval/retrieval';
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface PersonalMemoryContext {
  state: 'available' | 'unavailable';
  records: { id?: string; topic: string; content: string; source: string }[];
}
export type AssistantResult =
  { type: 'answer'; text: string } | { type: 'tool'; name: string; arguments: unknown };
export interface LLMProvider {
  answerWithTools?(
    messages: ConversationMessage[],
    evidence?: Evidence[],
    timeoutMs?: number,
    personalMemory?: PersonalMemoryContext,
    retrievalStatus?: { historyComplete: boolean; memoryComplete: boolean },
  ): Promise<AssistantResult>;
  answer(
    messages: ConversationMessage[],
    evidence?: Evidence[],
    timeoutMs?: number,
    personalMemory?: PersonalMemoryContext,
    retrievalStatus?: { historyComplete: boolean; memoryComplete: boolean },
  ): Promise<string>;
}
