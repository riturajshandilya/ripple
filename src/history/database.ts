import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evidence } from '../retrieval/retrieval';
import { validateCandidates, type MemoryCandidate } from '../memory/extraction';
import type { ConversationMessage } from '../llm/provider';

export interface SearchResult {
  conversationId: string;
  role: 'user' | 'assistant';
  createdAt: string;
  snippet: string;
}

export interface MemoryRecord {
  id: string;
  topic: string;
  content: string;
  source: 'explicit_local' | 'automatic_unverified';
  sourceMessageId: number | null;
  kind: string | null;
  basis: string | null;
  changeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryWriter {
  saveTurn(
    sessionId: string,
    question: string,
    answer: string,
    options?: { extractMemory?: boolean },
  ): void;
  listMemories?(): MemoryRecord[];
  memoryCorrectionTargets?(id: string): MemoryRecord[];
  commitMemoryCorrection?(expected: MemoryRecord[], content: string): 'updated' | 'stale';
  correctMemoryByTopic?(
    topic: string,
    content: string,
  ): 'updated' | 'unchanged' | 'not_found' | 'ambiguous';
}

export class HistoryDatabase implements HistoryWriter {
  private readonly db: Database.Database;
  constructor(
    path: string,
    private readonly retentionDays = 30,
    private readonly autoMemory = false,
  ) {
    if (!Number.isInteger(retentionDays) || retentionDays < 1)
      throw new Error('Retention must be a positive number of days');
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      closeSync(openSync(path, 'a', 0o600));
      chmodSync(path, 0o600);
    }
    this.db = new Database(path);
    sqliteVec.load(this.db);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 250');
    this.db.pragma('secure_delete = ON');
    const version = this.db.pragma('user_version', { simple: true }) as number;
    if (version > 7) throw new Error('Database schema is newer than this application');
    if (version === 0)
      this.db.transaction(() => {
        this.db
          .exec(`CREATE TABLE conversations (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX messages_conversation ON messages(conversation_id, id);
        PRAGMA user_version = 1;`);
      })();
    if (version < 2)
      this.db.transaction(() => {
        this.db
          .exec(`CREATE VIRTUAL TABLE messages_fts USING fts5(content, content='messages', content_rowid='id');
          CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
          END;
          CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
          END;
          CREATE TRIGGER messages_fts_update AFTER UPDATE OF content ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
          END;
          INSERT INTO messages_fts(messages_fts) VALUES ('rebuild');
          PRAGMA user_version = 2;`);
      })();
    if (version < 3)
      this.db.transaction(() => {
        this.db.exec(`CREATE TABLE personal_memories (
          id TEXT PRIMARY KEY, topic TEXT NOT NULL, content TEXT NOT NULL,
          source TEXT NOT NULL CHECK(source = 'explicit_local'), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE personal_memories_fts USING fts5(topic, content, content='personal_memories', content_rowid='rowid');
        CREATE TRIGGER memories_fts_insert AFTER INSERT ON personal_memories BEGIN
          INSERT INTO personal_memories_fts(rowid, topic, content) VALUES (new.rowid, new.topic, new.content);
        END;
        CREATE TRIGGER memories_fts_delete AFTER DELETE ON personal_memories BEGIN
          INSERT INTO personal_memories_fts(personal_memories_fts, rowid, topic, content) VALUES ('delete', old.rowid, old.topic, old.content);
        END;
        CREATE TRIGGER memories_fts_update AFTER UPDATE OF topic, content ON personal_memories BEGIN
          INSERT INTO personal_memories_fts(personal_memories_fts, rowid, topic, content) VALUES ('delete', old.rowid, old.topic, old.content);
          INSERT INTO personal_memories_fts(rowid, topic, content) VALUES (new.rowid, new.topic, new.content);
        END;
        PRAGMA user_version = 3;`);
      })();
    if (version < 4)
      this.db.transaction(() => {
        this.db
          .exec(`DROP TRIGGER memories_fts_insert; DROP TRIGGER memories_fts_delete; DROP TRIGGER memories_fts_update;
          DROP TABLE personal_memories_fts;
          ALTER TABLE personal_memories RENAME TO personal_memories_v3;
          CREATE TABLE personal_memories (
            id TEXT PRIMARY KEY, topic TEXT NOT NULL, content TEXT NOT NULL,
            source TEXT NOT NULL CHECK(source IN ('explicit_local', 'automatic_unverified')),
            source_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
            kind TEXT, basis TEXT, change_type TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          INSERT INTO personal_memories(id, topic, content, source, created_at, updated_at)
            SELECT id, topic, content, source, created_at, updated_at FROM personal_memories_v3;
          DROP TABLE personal_memories_v3;
          CREATE UNIQUE INDEX automatic_memory_per_source ON personal_memories(source_message_id, topic, content) WHERE source_message_id IS NOT NULL;
          CREATE VIRTUAL TABLE personal_memories_fts USING fts5(topic, content, content='personal_memories', content_rowid='rowid');
          CREATE TRIGGER memories_fts_insert AFTER INSERT ON personal_memories BEGIN
            INSERT INTO personal_memories_fts(rowid, topic, content) VALUES (new.rowid, new.topic, new.content);
          END;
          CREATE TRIGGER memories_fts_delete AFTER DELETE ON personal_memories BEGIN
            INSERT INTO personal_memories_fts(personal_memories_fts, rowid, topic, content) VALUES ('delete', old.rowid, old.topic, old.content);
          END;
          CREATE TRIGGER memories_fts_update AFTER UPDATE OF topic, content ON personal_memories BEGIN
            INSERT INTO personal_memories_fts(personal_memories_fts, rowid, topic, content) VALUES ('delete', old.rowid, old.topic, old.content);
            INSERT INTO personal_memories_fts(rowid, topic, content) VALUES (new.rowid, new.topic, new.content);
          END;
          INSERT INTO personal_memories_fts(personal_memories_fts) VALUES ('rebuild');
          CREATE TABLE memory_extraction_jobs (message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK(status IN ('pending','done','failed')), attempts INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE memory_embeddings (memory_id TEXT NOT NULL REFERENCES personal_memories(id) ON DELETE CASCADE, model TEXT NOT NULL, content_hash TEXT NOT NULL, vector_json TEXT NOT NULL, PRIMARY KEY(memory_id, model));
          PRAGMA user_version = 4;`);
      })();
    if (version < 5)
      this.db.transaction(() => {
        this.db.exec(`CREATE TABLE history_embeddings (
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          model TEXT NOT NULL, content_hash TEXT NOT NULL, vector_json TEXT NOT NULL,
          PRIMARY KEY (message_id, model)
        ); PRAGMA user_version = 5;`);
      })();
    if (version < 6)
      this.db.transaction(() => {
        this.db
          .exec(`CREATE VIRTUAL TABLE history_vec USING vec0(embedding float[768] distance_metric=cosine);
          CREATE VIRTUAL TABLE memory_vec USING vec0(embedding float[768] distance_metric=cosine);
          CREATE TABLE memory_vector_keys (id INTEGER PRIMARY KEY, memory_id TEXT UNIQUE NOT NULL REFERENCES personal_memories(id) ON DELETE CASCADE);
          CREATE TRIGGER memory_vector_key_delete BEFORE DELETE ON memory_vector_keys BEGIN DELETE FROM memory_vec WHERE rowid=old.id; END;
          CREATE TRIGGER history_vector_insert AFTER INSERT ON history_embeddings WHEN new.model='nomic-embed-text:latest' AND json_array_length(new.vector_json)=768 BEGIN
            INSERT INTO history_vec(rowid, embedding) VALUES (new.message_id, vec_f32(new.vector_json)); END;
          CREATE TRIGGER history_vector_update AFTER UPDATE ON history_embeddings WHEN old.model='nomic-embed-text:latest' BEGIN
            DELETE FROM history_vec WHERE rowid=old.message_id;
            INSERT INTO history_vec(rowid,embedding) SELECT new.message_id,vec_f32(new.vector_json) WHERE json_array_length(new.vector_json)=768 AND new.model='nomic-embed-text:latest'; END;
          CREATE TRIGGER history_vector_delete AFTER DELETE ON history_embeddings WHEN old.model='nomic-embed-text:latest' BEGIN DELETE FROM history_vec WHERE rowid=old.message_id; END;
          CREATE TRIGGER memory_vector_insert AFTER INSERT ON memory_embeddings WHEN new.model='nomic-embed-text:latest' AND json_array_length(new.vector_json)=768 BEGIN
            INSERT OR IGNORE INTO memory_vector_keys(memory_id) VALUES(new.memory_id);
            INSERT INTO memory_vec(rowid,embedding) SELECT id,vec_f32(new.vector_json) FROM memory_vector_keys WHERE memory_id=new.memory_id; END;
          CREATE TRIGGER memory_vector_update AFTER UPDATE ON memory_embeddings WHEN old.model='nomic-embed-text:latest' BEGIN
            DELETE FROM memory_vec WHERE rowid=(SELECT id FROM memory_vector_keys WHERE memory_id=old.memory_id);
            INSERT OR IGNORE INTO memory_vector_keys(memory_id) VALUES(new.memory_id);
            INSERT INTO memory_vec(rowid,embedding) SELECT id,vec_f32(new.vector_json) FROM memory_vector_keys WHERE memory_id=new.memory_id AND json_array_length(new.vector_json)=768 AND new.model='nomic-embed-text:latest'; END;
          CREATE TRIGGER memory_vector_delete AFTER DELETE ON memory_embeddings WHEN old.model='nomic-embed-text:latest' BEGIN
            DELETE FROM memory_vec WHERE rowid=(SELECT id FROM memory_vector_keys WHERE memory_id=old.memory_id); END;
          CREATE TRIGGER history_embedding_invalidate AFTER UPDATE OF content ON messages BEGIN DELETE FROM history_embeddings WHERE message_id=new.id; END;
          CREATE TRIGGER memory_embedding_invalidate AFTER UPDATE OF topic, content ON personal_memories BEGIN DELETE FROM memory_embeddings WHERE memory_id=new.id; END;
          INSERT INTO history_vec(rowid,embedding) SELECT message_id,vec_f32(vector_json) FROM history_embeddings WHERE model='nomic-embed-text:latest' AND json_array_length(vector_json)=768;
          INSERT INTO memory_vector_keys(memory_id) SELECT memory_id FROM memory_embeddings WHERE model='nomic-embed-text:latest' AND json_array_length(vector_json)=768;
          INSERT INTO memory_vec(rowid,embedding) SELECT k.id,vec_f32(e.vector_json) FROM memory_embeddings e JOIN memory_vector_keys k ON k.memory_id=e.memory_id WHERE e.model='nomic-embed-text:latest' AND json_array_length(e.vector_json)=768;
          PRAGMA user_version=6;`);
      })();
    if (version < 7)
      this.db.transaction(() => {
        this.db.exec(`CREATE TABLE IF NOT EXISTS memory_revisions (
          id INTEGER PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES personal_memories(id) ON DELETE CASCADE,
          topic TEXT NOT NULL, content TEXT NOT NULL, source TEXT NOT NULL,
          source_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
          recorded_at TEXT NOT NULL
        ); PRAGMA user_version=7;`);
      })();
    this.prune();
  }
  search(query: string): SearchResult[] {
    if (query.length > 200) throw new Error('Search query must be at most 200 characters');
    const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!terms.length || terms.length > 12)
      throw new Error('Search needs between 1 and 12 words or numbers');
    // Quote each literal token: FTS query operators are never executed from user input.
    const match = terms.map((term) => `"${term}"`).join(' AND ');
    return this.db
      .prepare(
        `SELECT m.conversation_id AS conversationId, m.role, m.created_at AS createdAt,
      snippet(messages_fts, 0, '[', ']', ' … ', 20) AS snippet
      FROM messages_fts JOIN messages m ON m.id = messages_fts.rowid
      WHERE messages_fts MATCH ? ORDER BY rank, m.id DESC LIMIT 10`,
      )
      .all(match) as SearchResult[];
  }
  findEvidence(query: string): Evidence[] {
    if (query.length > 200) throw new Error('Search query too long');
    const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!terms.length || terms.length > 12) return [];
    const match = terms.map((term) => `"${term}"`).join(' AND ');
    const hits = this.db
      .prepare(
        `SELECT m.id, m.conversation_id AS conversationId FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid WHERE messages_fts MATCH ?
      ORDER BY rank, m.id DESC LIMIT 4`,
      )
      .all(match) as { id: number; conversationId: string }[];
    return this.evidenceForHits(hits);
  }
  keywordHistoryHits(query: string): { id: number; conversationId: string }[] {
    if (query.length > 200) throw new Error('Search query too long');
    const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!terms.length || terms.length > 12) return [];
    return this.db
      .prepare(
        `SELECT m.id, m.conversation_id AS conversationId FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid WHERE messages_fts MATCH ? ORDER BY rank, m.id DESC LIMIT 10`,
      )
      .all(terms.map((t) => `"${t}"`).join(' AND ')) as { id: number; conversationId: string }[];
  }
  evidenceForHits(hits: { id: number; conversationId: string }[]): Evidence[] {
    const groups = new Map<
      string,
      Map<number, { id: number; role: 'user' | 'assistant'; content: string; createdAt: string }>
    >();
    const around = this.db.prepare(`SELECT id, role, content, created_at AS createdAt FROM messages
      WHERE conversation_id = ? AND id IN (
        SELECT id FROM (SELECT id FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT 1)
        UNION SELECT ?
        UNION SELECT id FROM (SELECT id FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT 1)
      ) ORDER BY id`);
    for (const hit of hits) {
      const group = groups.get(hit.conversationId) ?? new Map();
      const rows = around.all(
        hit.conversationId,
        hit.conversationId,
        hit.id,
        hit.id,
        hit.conversationId,
        hit.id,
      ) as { id: number; role: 'user' | 'assistant'; content: string; createdAt: string }[];
      for (const row of rows) group.set(row.id, row);
      groups.set(hit.conversationId, group);
    }
    return [...groups].map(([conversationId, rows]) => ({
      conversationId,
      messages: [...rows.values()]
        .sort((a, b) => a.id - b.id)
        .slice(0, 8)
        .map((row) => ({
          role: row.role,
          content: row.content.slice(0, 500),
          createdAt: row.createdAt,
        })),
    }));
  }
  prune(): number {
    return this.db
      .prepare(
        "DELETE FROM conversations WHERE updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)",
      )
      .run(`-${this.retentionDays} days`).changes;
  }
  saveTurn(
    sessionId: string,
    question: string,
    answer: string,
    options?: { extractMemory?: boolean },
  ): void {
    const hash = createHash('sha256').update(sessionId).digest('hex');
    this.db.transaction(() => {
      this.prune();
      const now = new Date().toISOString();
      this.db
        .prepare(
          'INSERT INTO conversations (id, session_hash, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_hash) DO UPDATE SET updated_at=excluded.updated_at',
        )
        .run(randomUUID(), hash, now, now);
      const conversation = this.db
        .prepare('SELECT id FROM conversations WHERE session_hash = ?')
        .get(hash) as { id: string };
      const insert = this.db.prepare(
        'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      );
      const userMessage = insert.run(conversation.id, 'user', question, now);
      if (this.autoMemory && options?.extractMemory !== false)
        this.db
          .prepare("INSERT INTO memory_extraction_jobs(message_id, status) VALUES (?, 'pending')")
          .run(userMessage.lastInsertRowid);
      insert.run(conversation.id, 'assistant', answer, now);
    })();
  }
  addMemory(topic: string, content: string): string {
    const cleanTopic = topic.trim();
    const cleanContent = content.trim();
    if (!cleanTopic || cleanTopic.length > 100 || !cleanContent || cleanContent.length > 500)
      throw new Error('Topic must be 1 to 100 characters and memory must be 1 to 500 characters');
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO personal_memories (id, topic, content, source, created_at, updated_at) VALUES (?, ?, ?, 'explicit_local', ?, ?)",
      )
      .run(id, cleanTopic, cleanContent, now, now);
    return id;
  }
  updateMemory(id: string, topic: string, content: string): boolean {
    const cleanTopic = topic.trim();
    const cleanContent = content.trim();
    if (!cleanTopic || cleanTopic.length > 100 || !cleanContent || cleanContent.length > 500)
      throw new Error('Topic must be 1 to 100 characters and memory must be 1 to 500 characters');
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const saved = this.db
        .prepare(
          `INSERT INTO memory_revisions(memory_id,topic,content,source,source_message_id,recorded_at)
        SELECT id,topic,content,source,source_message_id,? FROM personal_memories WHERE id=?`,
        )
        .run(now, id);
      if (!saved.changes) return false;
      this.db
        .prepare(
          `UPDATE personal_memories SET topic=?,content=?,updated_at=?,source='explicit_local',
        source_message_id=NULL,kind=NULL,basis=NULL,change_type='correction' WHERE id=?`,
        )
        .run(cleanTopic, cleanContent, now, id);
      return true;
    })();
  }
  correctMemoryByTopic(
    topic: string,
    content: string,
  ): 'updated' | 'unchanged' | 'not_found' | 'ambiguous' {
    const key = topic.trim().normalize('NFKC').toLocaleLowerCase('en-US');
    const value = content.trim();
    if (!key || key.length > 100 || !value || value.length > 500)
      throw new Error('Invalid correction');
    return this.db.transaction(() => {
      const matches = this.listMemories().filter(
        (m) => m.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US') === key,
      );
      if (!matches.length) return 'not_found' as const;
      if (matches.length !== 1) return 'ambiguous' as const;
      if (matches[0].content === value) return 'unchanged' as const;
      if (!this.updateMemory(matches[0].id, matches[0].topic, value))
        throw new Error('Memory update failed');
      return 'updated' as const;
    })();
  }
  memoryCorrectionTargets(id: string): MemoryRecord[] {
    const all = this.listMemories();
    const selected = all.find((m) => m.id === id);
    if (!selected) return [];
    const key = selected.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US');
    return all
      .filter((m) => m.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US') === key)
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  commitMemoryCorrection(expected: MemoryRecord[], content: string): 'updated' | 'stale' {
    const value = content.trim();
    if (!expected.length || expected.length > 5 || !value || value.length > 500)
      throw new Error('Invalid correction');
    return this.db.transaction(() => {
      const current = this.memoryCorrectionTargets(expected[0].id);
      if (JSON.stringify(current) !== JSON.stringify(expected)) return 'stale' as const;
      const now = new Date().toISOString();
      const survivor = expected[0];
      for (const duplicate of expected.slice(1)) {
        this.db
          .prepare('UPDATE memory_revisions SET memory_id=? WHERE memory_id=?')
          .run(survivor.id, duplicate.id);
        this.db
          .prepare(
            `INSERT INTO memory_revisions(memory_id,topic,content,source,source_message_id,recorded_at)
          VALUES (?,?,?,?,?,?)`,
          )
          .run(
            survivor.id,
            duplicate.topic,
            duplicate.content,
            duplicate.source,
            duplicate.sourceMessageId,
            now,
          );
        this.deleteMemory(duplicate.id);
      }
      if (!this.updateMemory(survivor.id, survivor.topic, value))
        throw new Error('Memory update failed');
      return 'updated' as const;
    })();
  }
  memoryRevisions(id: string): unknown[] {
    return this.db
      .prepare(
        'SELECT topic,content,source,source_message_id AS sourceMessageId,recorded_at AS recordedAt FROM memory_revisions WHERE memory_id=? ORDER BY id DESC',
      )
      .all(id);
  }
  deleteMemory(id: string): boolean {
    return this.db.prepare('DELETE FROM personal_memories WHERE id = ?').run(id).changes > 0;
  }
  listMemories(): MemoryRecord[] {
    return this.db
      .prepare(
        'SELECT id, topic, content, source, source_message_id AS sourceMessageId, kind, basis, change_type AS changeType, created_at AS createdAt, updated_at AS updatedAt FROM personal_memories ORDER BY updated_at DESC, id',
      )
      .all() as MemoryRecord[];
  }
  searchMemories(query: string): MemoryRecord[] {
    if (query.length > 200) throw new Error('Search query must be at most 200 characters');
    const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!words.length || words.length > 12)
      throw new Error('Search needs between 1 and 12 words or numbers');
    const match = words.map((word) => `"${word}"`).join(' OR ');
    return this.db
      .prepare(
        `SELECT m.id, m.topic, m.content, m.source, m.source_message_id AS sourceMessageId, m.kind, m.basis, m.change_type AS changeType, m.created_at AS createdAt, m.updated_at AS updatedAt
      FROM personal_memories_fts JOIN personal_memories m ON m.rowid = personal_memories_fts.rowid
      WHERE personal_memories_fts MATCH ? ORDER BY rank, m.updated_at DESC LIMIT 3`,
      )
      .all(match) as MemoryRecord[];
  }
  recentMemoriesForIndex(): MemoryRecord[] {
    return this.db
      .prepare(
        `SELECT id,topic,content,source,source_message_id AS sourceMessageId,kind,basis,change_type AS changeType,created_at AS createdAt,updated_at AS updatedAt FROM personal_memories ORDER BY updated_at DESC,id LIMIT 500`,
      )
      .all() as MemoryRecord[];
  }
  hasMoreMemories(): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM personal_memories ORDER BY updated_at DESC,id LIMIT 1 OFFSET 500')
      .get();
  }
  memoryVectorCoverage(): { total: number; indexed: number } {
    return this.db
      .prepare(
        `WITH recent AS (SELECT id FROM personal_memories ORDER BY updated_at DESC,id LIMIT 500)
      SELECT (SELECT count(*) FROM recent) AS total,(SELECT count(*) FROM recent JOIN memory_embeddings e ON e.memory_id=recent.id WHERE e.model='nomic-embed-text:latest' AND json_array_length(e.vector_json)=768) AS indexed`,
      )
      .get() as { total: number; indexed: number };
  }
  keywordHistoryHitsNatural(query: string): { id: number; conversationId: string }[] {
    const stop = new Set([
      'what',
      'when',
      'where',
      'why',
      'which',
      'how',
      'the',
      'and',
      'that',
      'this',
      'with',
      'about',
      'from',
      'have',
      'your',
      'does',
      'did',
      'was',
      'were',
      'you',
      'our',
      'for',
      'are',
      'can',
      'could',
      'would',
      'should',
      'please',
      'tell',
      'remember',
      'discuss',
      'discussed',
      'talk',
      'talked',
      'conversation',
      'conversations',
    ]);
    const terms = [
      ...new Set(
        (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
          (t) => t.length >= 3 && !stop.has(t),
        ),
      ),
    ].slice(0, 12);
    if (!terms.length) return [];
    return this.db
      .prepare(
        `SELECT m.id,m.conversation_id AS conversationId FROM messages_fts JOIN messages m ON m.id=messages_fts.rowid WHERE messages_fts MATCH ? ORDER BY rank,m.id DESC LIMIT 10`,
      )
      .all(terms.map((t) => `"${t}"`).join(' OR ')) as { id: number; conversationId: string }[];
  }
  vectorHistoryHits(
    query: number[],
    threshold = 0.65,
  ): { id: number; conversationId: string; score: number }[] {
    const input = Buffer.from(new Float32Array(query).buffer);
    if (query.length !== 768 || query.some((v) => !Number.isFinite(v)))
      throw new Error('Invalid query vector');
    return this.db
      .prepare(
        `SELECT v.rowid AS id, m.conversation_id AS conversationId, 1-v.distance AS score
      FROM history_vec v JOIN messages m ON m.id=v.rowid
      WHERE v.embedding MATCH ? AND k=10 AND v.distance <= ? AND v.rowid IN (SELECT id FROM messages ORDER BY id DESC LIMIT 500)
      ORDER BY v.distance`,
      )
      .all(input, 1 - threshold) as { id: number; conversationId: string; score: number }[];
  }
  vectorMemoryHits(query: number[], threshold = 0.65): (MemoryRecord & { score: number })[] {
    const input = Buffer.from(new Float32Array(query).buffer);
    if (query.length !== 768 || query.some((v) => !Number.isFinite(v)))
      throw new Error('Invalid query vector');
    return this.db
      .prepare(
        `SELECT m.id,m.topic,m.content,m.source,m.source_message_id AS sourceMessageId,m.kind,m.basis,m.change_type AS changeType,m.created_at AS createdAt,m.updated_at AS updatedAt,1-v.distance AS score
      FROM memory_vec v JOIN memory_vector_keys k ON k.id=v.rowid JOIN personal_memories m ON m.id=k.memory_id
      WHERE v.embedding MATCH ? AND k=3 AND v.distance <= ? AND v.rowid IN (SELECT kv.id FROM memory_vector_keys kv JOIN (SELECT id FROM personal_memories ORDER BY updated_at DESC,id LIMIT 500) recent ON recent.id=kv.memory_id)
      ORDER BY v.distance`,
      )
      .all(input, 1 - threshold) as (MemoryRecord & { score: number })[];
  }
  historyVectorCoverage(): { total: number; indexed: number } {
    return this.db
      .prepare(
        `WITH recent AS (SELECT id FROM messages ORDER BY id DESC LIMIT 500)
      SELECT (SELECT count(*) FROM recent) AS total,(SELECT count(*) FROM recent JOIN history_embeddings e ON e.message_id=recent.id WHERE e.model='nomic-embed-text:latest' AND json_array_length(e.vector_json)=768) AS indexed`,
      )
      .get() as { total: number; indexed: number };
  }
  hasMoreHistory(): boolean {
    return !!this.db.prepare('SELECT 1 FROM messages ORDER BY id DESC LIMIT 1 OFFSET 500').get();
  }
  recentHistoryMessages(): { id: number; conversationId: string; content: string }[] {
    return this.db
      .prepare(
        'SELECT id, conversation_id AS conversationId, content FROM messages ORDER BY id DESC LIMIT 500',
      )
      .all() as { id: number; conversationId: string; content: string }[];
  }
  getHistoryEmbedding(id: number, model: string, hash: string): number[] | null {
    const row = this.db
      .prepare(
        'SELECT vector_json AS vector FROM history_embeddings WHERE message_id=? AND model=? AND content_hash=?',
      )
      .get(id, model, hash) as { vector: string } | undefined;
    if (!row) return null;
    try {
      const v: unknown = JSON.parse(row.vector);
      return Array.isArray(v) &&
        v.length > 0 &&
        v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? v
        : null;
    } catch {
      return null;
    }
  }
  saveHistoryEmbedding(id: number, model: string, hash: string, vector: number[]): boolean {
    const row = this.db.prepare('SELECT content FROM messages WHERE id=?').get(id) as
      { content: string } | undefined;
    if (!row || createHash('sha256').update(row.content).digest('hex') !== hash) return false;
    this.db
      .prepare(
        'INSERT INTO history_embeddings(message_id, model, content_hash, vector_json) VALUES(?,?,?,?) ON CONFLICT(message_id, model) DO UPDATE SET content_hash=excluded.content_hash, vector_json=excluded.vector_json',
      )
      .run(id, model, hash, JSON.stringify(vector));
    return true;
  }
  getMemoryEmbedding(id: string, model: string, hash: string): number[] | null {
    const row = this.db
      .prepare(
        'SELECT vector_json AS vector FROM memory_embeddings WHERE memory_id = ? AND model = ? AND content_hash = ?',
      )
      .get(id, model, hash) as { vector: string } | undefined;
    if (!row) return null;
    try {
      const vector: unknown = JSON.parse(row.vector);
      return Array.isArray(vector) &&
        vector.length > 0 &&
        vector.every((v) => typeof v === 'number' && Number.isFinite(v))
        ? vector
        : null;
    } catch {
      return null;
    }
  }
  saveMemoryEmbedding(id: string, model: string, hash: string, vector: number[]): boolean {
    const current = this.db
      .prepare('SELECT topic, content FROM personal_memories WHERE id = ?')
      .get(id) as { topic: string; content: string } | undefined;
    if (
      !current ||
      createHash('sha256').update(`${current.topic}\n${current.content}`).digest('hex') !== hash
    )
      return false;
    this.db
      .prepare(
        'INSERT INTO memory_embeddings (memory_id, model, content_hash, vector_json) VALUES (?, ?, ?, ?) ON CONFLICT(memory_id, model) DO UPDATE SET content_hash=excluded.content_hash, vector_json=excluded.vector_json',
      )
      .run(id, model, hash, JSON.stringify(vector));
    return true;
  }
  nextExtractionJob(): { messageId: number; messages: ConversationMessage[] } | null {
    const row = this.db
      .prepare(
        `SELECT j.message_id AS messageId, m.conversation_id AS conversationId FROM memory_extraction_jobs j
      JOIN messages m ON m.id = j.message_id WHERE j.status='pending' ORDER BY j.message_id LIMIT 1`,
      )
      .get() as { messageId: number; conversationId: string } | undefined;
    if (!row) return null;
    const previous = this.db
      .prepare(
        `SELECT role, content FROM messages WHERE conversation_id=? AND id < ? ORDER BY id DESC LIMIT 4`,
      )
      .all(row.conversationId, row.messageId) as ConversationMessage[];
    const current = this.db
      .prepare('SELECT role, content FROM messages WHERE id=?')
      .get(row.messageId) as ConversationMessage;
    return { messageId: row.messageId, messages: [...previous.reverse(), current] };
  }
  finishExtraction(messageId: number, candidates: MemoryCandidate[]): number {
    return this.db.transaction(() => {
      const job = this.db
        .prepare(
          "SELECT status FROM memory_extraction_jobs WHERE message_id=? AND status='pending'",
        )
        .get(messageId);
      if (!job) return 0;
      const source = this.db
        .prepare("SELECT content FROM messages WHERE id = ? AND role = 'user'")
        .get(messageId) as { content: string } | undefined;
      if (!source) return 0;
      const validated = validateCandidates({ candidates }, source.content);
      let added = 0;
      const now = new Date().toISOString();
      const insert = this.db
        .prepare(`INSERT OR IGNORE INTO personal_memories (id,topic,content,source,source_message_id,kind,basis,change_type,created_at,updated_at)
         VALUES (?, ?, ?, 'automatic_unverified', ?, ?, ?, ?, ?, ?)`);
      const duplicate = this.db.prepare(
        'SELECT id FROM personal_memories WHERE lower(trim(topic))=lower(trim(?)) AND lower(trim(content))=lower(trim(?)) LIMIT 1',
      );
      for (const c of validated) {
        const key = c.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US');
        const protectedTopic = this.listMemories().some(
          (m) =>
            m.source === 'explicit_local' &&
            m.topic.trim().normalize('NFKC').toLocaleLowerCase('en-US') === key,
        );
        if (c.basis !== 'explicit' || protectedTopic || duplicate.get(c.topic, c.content)) continue;
        added += insert.run(
          randomUUID(),
          c.topic.trim(),
          c.content.trim(),
          messageId,
          c.kind,
          c.basis,
          c.change,
          now,
          now,
        ).changes;
      }
      this.db
        .prepare("UPDATE memory_extraction_jobs SET status='done' WHERE message_id=?")
        .run(messageId);
      return added;
    })();
  }
  failExtraction(messageId: number): void {
    this.db
      .prepare(
        "UPDATE memory_extraction_jobs SET attempts=attempts+1, status=CASE WHEN attempts+1>=3 THEN 'failed' ELSE 'pending' END WHERE message_id=? AND status='pending'",
      )
      .run(messageId);
  }
  extractionCounts(): unknown {
    return this.db
      .prepare('SELECT status, count(*) AS count FROM memory_extraction_jobs GROUP BY status')
      .all();
  }
  list(): unknown[] {
    return this.db
      .prepare('SELECT id, created_at, updated_at FROM conversations ORDER BY updated_at DESC')
      .all();
  }
  messages(id: string): unknown[] {
    return this.db
      .prepare(
        'SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id',
      )
      .all(id);
  }
  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id).changes > 0;
  }
  close(): void {
    this.db.close();
  }
}
