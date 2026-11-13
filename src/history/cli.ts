import 'dotenv/config';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { historyPath, retentionDays } from './config';
import { HistoryDatabase } from './database';
import { hybridHistorySearch } from '../retrieval/history-semantic';
import { localEmbedder } from '../memory/semantic';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const id = args[0];
  if (
    !['list', 'show', 'delete', 'search', 'semantic'].includes(command) ||
    (['show', 'delete', 'search'].includes(command) && !id) ||
    (command !== 'search' && args.length > (['list', 'semantic'].includes(command) ? 0 : 1))
  ) {
    console.error(
      'Usage: npm run history -- list | show <id> | delete <id> | search <words> | semantic',
    );
    process.exitCode = 1;
    return;
  }
  if (!existsSync(historyPath())) {
    console.log('No history database exists yet.');
    return;
  }
  const db = new HistoryDatabase(historyPath(), retentionDays());
  try {
    if (command === 'list') console.log(JSON.stringify(db.list(), null, 2));
    else if (command === 'search') console.log(JSON.stringify(db.search(args.join(' ')), null, 2));
    else if (command === 'semantic') {
      const prompt = createInterface({ input: stdin, output: stdout });
      try {
        const query = await prompt.question('Search words: ');
        console.log(
          JSON.stringify(
            await hybridHistorySearch(db, localEmbedder(), query, AbortSignal.timeout(10000)),
            null,
            2,
          ),
        );
      } finally {
        prompt.close();
      }
    } else if (command === 'show') console.log(JSON.stringify(db.messages(id), null, 2));
    else console.log(db.delete(id) ? 'Conversation deleted.' : 'Conversation not found.');
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error('History operation failed; check input and local services.');
  process.exitCode = 1;
});
