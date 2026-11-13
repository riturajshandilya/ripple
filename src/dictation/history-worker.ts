import 'dotenv/config';
import { join } from 'node:path';
import { DictationHistory, type DictationRecord } from './history';
import {
  createDictationFormatter,
  isValidTargetLanguage,
  type DictationFormatter,
  type DictationOutputMode,
  type DictationStyle,
} from './formatter';
import type { DictationMode } from './service';

export async function handleHistoryRequest(
  request: unknown,
  dbPath = join(process.cwd(), 'data', 'dictations.sqlite'),
  formatterFactory: () => DictationFormatter = () => createDictationFormatter(process.env),
): Promise<DictationRecord[] | DictationRecord | boolean | number> {
  if (!request || typeof request !== 'object' || Array.isArray(request))
    throw Error('Invalid request');
  const data = request as Record<string, unknown>;
  if (
    typeof data.action !== 'string' ||
    !['list', 'delete', 'clear', 'reformat'].includes(data.action)
  )
    throw Error('Invalid action');

  if (data.action === 'list' || data.action === 'clear') {
    if (Object.keys(data).join(',') !== 'action') throw Error('Invalid request');
  } else if (data.action === 'delete') {
    if (
      Object.keys(data).sort().join(',') !== 'action,id' ||
      typeof data.id !== 'string' ||
      !/^[a-f0-9-]{36}$/u.test(data.id)
    )
      throw Error('Invalid request');
  } else if (data.action === 'reformat') {
    const allowed = new Set([
      'action',
      'id',
      'mode',
      'style',
      'outputMode',
      'targetLanguage',
      'instruction',
    ]);
    if (
      Object.keys(data).some((key) => !allowed.has(key)) ||
      typeof data.id !== 'string' ||
      !/^[a-f0-9-]{36}$/u.test(data.id) ||
      !['raw', 'polish'].includes(String(data.mode)) ||
      !['plain', 'email', 'code'].includes(String(data.style)) ||
      !['spoken', 'romanize', 'translate'].includes(String(data.outputMode)) ||
      typeof data.targetLanguage !== 'string' ||
      !isValidTargetLanguage(data.targetLanguage) ||
      (data.instruction !== undefined &&
        (typeof data.instruction !== 'string' || data.instruction.trim().length > 500))
    )
      throw Error('Invalid request');
  }

  const db = new DictationHistory(dbPath);
  try {
    if (data.action === 'list') return db.list();
    if (data.action === 'delete') return db.delete(data.id as string);
    if (data.action === 'clear') return db.clear();

    const id = data.id as string;
    const mode = data.mode as DictationMode;
    const style = data.style as DictationStyle;
    const outputMode = data.outputMode as DictationOutputMode;
    const targetLanguage = (data.targetLanguage as string).trim();
    const instruction =
      typeof data.instruction === 'string' && data.instruction.trim().length > 0
        ? data.instruction.trim()
        : undefined;

    const existing = db.get(id);
    if (!existing) throw Error('Record not found');

    if (!instruction && mode === 'raw' && outputMode === 'spoken') {
      const updated = db.update(id, {
        text: existing.rawText,
        mode: 'raw',
        style,
        outputMode: 'spoken',
        targetLanguage,
        status: 'raw',
      });
      if (!updated) throw Error('Update failed');
      return updated;
    }

    const formatter = formatterFactory();
    const formatted = await formatter.format(
      instruction ?? existing.rawText,
      style,
      instruction
        ? {
            outputMode,
            targetLanguage,
            polish: true,
            selectionText: existing.rawText,
          }
        : {
            outputMode,
            targetLanguage,
            polish: mode === 'polish',
          },
    );
    if (!formatted.trim()) throw Error('Empty formatter output');
    const nextMode: DictationMode = instruction ? 'polish' : mode;
    const nextStatus: DictationRecord['status'] =
      instruction || nextMode === 'polish'
        ? 'polished'
        : outputMode === 'romanize'
          ? 'romanized'
          : 'translated';
    const updated = db.update(id, {
      text: formatted,
      mode: nextMode,
      style,
      outputMode,
      targetLanguage,
      status: nextStatus,
    });
    if (!updated) throw Error('Update failed');
    return updated;
  } finally {
    db.close();
  }
}

/** The native app invokes this through stdin/stdout; neither text nor errors are logged. */
async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (input.length > 16 * 1024) throw Error('Input too large');
  }
  const result = await handleHistoryRequest(JSON.parse(input));
  process.stdout.write(JSON.stringify({ ok: true, result }));
}

if (require.main === module)
  void main().catch(() => {
    process.stdout.write(JSON.stringify({ ok: false }));
    process.exitCode = 1;
  });
