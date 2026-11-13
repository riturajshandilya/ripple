import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DictationMode } from './service';
import type { DictationOutputMode, DictationStyle } from './formatter';

export interface DictationRecord {
  id: string;
  createdAt: string;
  rawText: string;
  text: string;
  mode: DictationMode;
  style: DictationStyle;
  outputMode: DictationOutputMode;
  targetLanguage: string;
  status: 'raw' | 'polished' | 'romanized' | 'translated' | 'fallback';
}

/** Separate local history. It stores text, not audio or provider credentials. */
export class DictationHistory {
  private readonly db: Database.Database;
  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      closeSync(openSync(path, 'a', 0o600));
      chmodSync(path, 0o600);
    }
    this.db = new Database(path);
    this.db.pragma('busy_timeout = 250');
    this.db.pragma('secure_delete = ON');
    const version = this.db.pragma('user_version', { simple: true }) as number;
    if (version > 2) throw Error('Unsupported dictation database version');
    if (version === 0)
      this.db.transaction(() =>
        this.db.exec(`
      CREATE TABLE dictations (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, raw_text TEXT NOT NULL, final_text TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('raw','polish')),
        style TEXT NOT NULL CHECK (style IN ('plain','email','code')),
        output_mode TEXT NOT NULL CHECK (output_mode IN ('spoken','romanize','translate')),
        target_language TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('raw','polished','romanized','translated','fallback'))
      );
      PRAGMA user_version=2;
    `),
      )();
    else if (version === 1)
      this.db.transaction(() =>
        this.db.exec(`
          ALTER TABLE dictations RENAME TO dictations_v1;
          CREATE TABLE dictations (
            id TEXT PRIMARY KEY, created_at TEXT NOT NULL, raw_text TEXT NOT NULL, final_text TEXT NOT NULL,
            mode TEXT NOT NULL CHECK (mode IN ('raw','polish')),
            style TEXT NOT NULL CHECK (style IN ('plain','email','code')),
            output_mode TEXT NOT NULL CHECK (output_mode IN ('spoken','romanize','translate')),
            target_language TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('raw','polished','romanized','translated','fallback'))
          );
          INSERT INTO dictations(id,created_at,raw_text,final_text,mode,style,output_mode,target_language,status)
            SELECT id,created_at,raw_text,final_text,mode,style,'spoken','English',status FROM dictations_v1;
          DROP TABLE dictations_v1;
          PRAGMA user_version=2;
        `),
      )();
  }
  add(value: Omit<DictationRecord, 'id' | 'createdAt'>): string {
    if (
      !value.rawText.trim() ||
      !value.text.trim() ||
      value.rawText.length > 50_000 ||
      value.text.length > 50_000 ||
      !['raw', 'polish'].includes(value.mode) ||
      !['plain', 'email', 'code'].includes(value.style) ||
      !['spoken', 'romanize', 'translate'].includes(value.outputMode) ||
      !value.targetLanguage.trim() ||
      value.targetLanguage.length > 40 ||
      !['raw', 'polished', 'romanized', 'translated', 'fallback'].includes(value.status)
    )
      throw Error('Invalid dictation');
    const id = randomUUID();
    this.db
      .prepare(
        'INSERT INTO dictations(id,created_at,raw_text,final_text,mode,style,output_mode,target_language,status) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        new Date().toISOString(),
        value.rawText,
        value.text,
        value.mode,
        value.style,
        value.outputMode,
        value.targetLanguage,
        value.status,
      );
    return id;
  }
  list(): DictationRecord[] {
    return this.db
      .prepare(
        'SELECT id,created_at AS createdAt,raw_text AS rawText,final_text AS text,mode,style,output_mode AS outputMode,target_language AS targetLanguage,status FROM dictations ORDER BY created_at DESC,id DESC LIMIT 200',
      )
      .all() as DictationRecord[];
  }
  get(id: string): DictationRecord | undefined {
    return this.db
      .prepare(
        'SELECT id,created_at AS createdAt,raw_text AS rawText,final_text AS text,mode,style,output_mode AS outputMode,target_language AS targetLanguage,status FROM dictations WHERE id=?',
      )
      .get(id) as DictationRecord | undefined;
  }
  update(
    id: string,
    value: Pick<
      DictationRecord,
      'text' | 'mode' | 'style' | 'outputMode' | 'targetLanguage' | 'status'
    >,
  ): DictationRecord | undefined {
    if (
      !value.text.trim() ||
      value.text.length > 50_000 ||
      !['raw', 'polish'].includes(value.mode) ||
      !['plain', 'email', 'code'].includes(value.style) ||
      !['spoken', 'romanize', 'translate'].includes(value.outputMode) ||
      !value.targetLanguage.trim() ||
      value.targetLanguage.length > 40 ||
      !['raw', 'polished', 'romanized', 'translated', 'fallback'].includes(value.status)
    )
      throw Error('Invalid dictation update');
    const changes = this.db
      .prepare(
        'UPDATE dictations SET final_text=?,mode=?,style=?,output_mode=?,target_language=?,status=? WHERE id=?',
      )
      .run(
        value.text,
        value.mode,
        value.style,
        value.outputMode,
        value.targetLanguage,
        value.status,
        id,
      ).changes;
    return changes > 0 ? this.get(id) : undefined;
  }
  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM dictations WHERE id=?').run(id).changes > 0;
  }
  clear(): number {
    return this.db.prepare('DELETE FROM dictations').run().changes;
  }
  close(): void {
    this.db.close();
  }
}
