import 'dotenv/config';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { HistoryDatabase } from '../history/database';
import { localEmbedder, semanticMemorySearch } from './semantic';
import { historyPath, retentionDays } from '../history/config';

async function main(): Promise<void> {
  const [command, id, ...extra] = process.argv.slice(2);
  if (
    !['add', 'list', 'update', 'delete', 'search', 'semantic', 'status', 'revisions'].includes(
      command,
    ) ||
    extra.length ||
    (['update', 'delete', 'revisions'].includes(command) ? !id : !!id)
  ) {
    console.error(
      'Usage: npm run memory -- add | list | search | semantic | status | revisions <id> | update <id> | delete <id>',
    );
    process.exitCode = 1;
    return;
  }
  if (command !== 'add' && !existsSync(historyPath())) {
    console.log('No memory database exists yet.');
    return;
  }
  const db = new HistoryDatabase(historyPath(), retentionDays());
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    if (command === 'revisions') console.log(JSON.stringify(db.memoryRevisions(id!), null, 2));
    else if (command === 'list') console.log(JSON.stringify(db.listMemories(), null, 2));
    else if (command === 'status') console.log(JSON.stringify(db.extractionCounts(), null, 2));
    else if (command === 'semantic') {
      const query = await prompt.question('Search meaning: ');
      console.log(
        JSON.stringify(
          await semanticMemorySearch(db, localEmbedder(), query, AbortSignal.timeout(30000)),
          null,
          2,
        ),
      );
    } else if (command === 'search') {
      const query = await prompt.question('Search words: ');
      console.log(JSON.stringify(db.searchMemories(query), null, 2));
    } else if (command === 'add' || command === 'update') {
      const topic = await prompt.question('Topic: ');
      const content = await prompt.question('Memory: ');
      if (command === 'add') console.log(`Memory saved: ${db.addMemory(topic, content)}`);
      else
        console.log(db.updateMemory(id!, topic, content) ? 'Memory updated.' : 'Memory not found.');
    } else console.log(db.deleteMemory(id!) ? 'Memory deleted.' : 'Memory not found.');
  } finally {
    prompt.close();
    db.close();
  }
}
main().catch(() => {
  console.error('Memory operation failed; check the input and database.');
  process.exitCode = 1;
});
