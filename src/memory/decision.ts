import type { ConversationMessage } from '../llm/provider';
export type MemoryDecision =
  { action: 'skip' | 'clarify'; terms: [] } | { action: 'search'; terms: string[] };
export interface MemoryDecisionProvider {
  decideMemory(messages: ConversationMessage[], timeoutMs: number): Promise<MemoryDecision>;
}
export function validateMemoryDecision(value: unknown): MemoryDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid memory decision');
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).sort().join(',') !== 'action,terms' || !Array.isArray(obj.terms))
    throw new Error('Invalid memory decision');
  if (obj.action === 'skip' || obj.action === 'clarify') {
    if (obj.terms.length) throw new Error('Unexpected search terms');
    return { action: obj.action, terms: [] };
  }
  if (
    obj.action !== 'search' ||
    obj.terms.length < 1 ||
    obj.terms.length > 5 ||
    !obj.terms.every((x) => typeof x === 'string' && /^[\p{L}\p{N}]{2,40}$/u.test(x))
  )
    throw new Error('Invalid memory search terms');
  return { action: 'search', terms: obj.terms as string[] };
}
