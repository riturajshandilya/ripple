import { ConversationMessage } from '../llm/provider';
import { historyQuery } from './retrieval';

export type Route =
  | { route: 'direct' | 'clarify'; searchTerms: [] }
  | { route: 'search_history'; searchTerms: string[] };
export interface Router {
  classify(messages: ConversationMessage[], timeoutMs: number): Promise<Route>;
}

export function validateRoute(value: unknown): Route {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid router output');
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).sort().join(',') !== 'route,searchTerms' || !Array.isArray(obj.searchTerms))
    throw new Error('Invalid router output');
  if (obj.route === 'direct' || obj.route === 'clarify') {
    if (obj.searchTerms.length) throw new Error('Unexpected search terms');
    return { route: obj.route, searchTerms: [] };
  }
  if (
    obj.route !== 'search_history' ||
    obj.searchTerms.length < 1 ||
    obj.searchTerms.length > 5 ||
    !obj.searchTerms.every((t) => typeof t === 'string' && /^[\p{L}\p{N}]{2,40}$/u.test(t))
  )
    throw new Error('Invalid search terms');
  return { route: 'search_history', searchTerms: obj.searchTerms as string[] };
}
export const rulesRouter: Router = {
  async classify(messages) {
    const query = historyQuery(messages[messages.length - 1]?.content ?? '');
    return query === null
      ? { route: 'direct', searchTerms: [] }
      : query
        ? { route: 'search_history', searchTerms: query.split(' ') }
        : { route: 'clarify', searchTerms: [] };
  },
};

export async function beforeDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  if (milliseconds <= 0) throw new Error('Deadline exceeded');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Deadline exceeded')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
