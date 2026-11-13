import { ConversationMessage } from '../llm/provider';

export interface EvidenceMessage extends ConversationMessage {
  createdAt: string;
}
export interface Evidence {
  conversationId: string;
  messages: EvidenceMessage[];
}
export interface HistorySearch {
  findEvidence(query: string): Evidence[];
}

// Only route clear requests about a prior conversation; this is not a general intent classifier.
export function historyQuery(question: string): string | null {
  const match = question.match(
    /\b(?:what (?:did|have) we (?:talk|discuss|speak)(?:ed)? about|what was my first question about|what did i (?:ask|say) about|what have we discussed about|recall (?:our|my) (?:conversation|discussion) about)\s+(.+)/i,
  );
  if (!match) return null;
  const stop = new Set([
    'the',
    'a',
    'an',
    'of',
    'about',
    'regarding',
    'our',
    'my',
    'previous',
    'earlier',
    'conversation',
    'discussion',
    'please',
    'and',
    'in',
    'on',
    'for',
    'what',
    'was',
    'is',
    'did',
    'we',
  ]);
  const words = (
    match[1]
      .toLowerCase()
      .replace(/[’']s\b/g, '')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .filter((w) => !stop.has(w))
    .map((w) => (w === 'indian' ? 'india' : w));
  return [...new Set(words)].slice(0, 8).join(' ');
}
