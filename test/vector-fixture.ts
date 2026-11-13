import type Database from 'better-sqlite3';
export function removeVectorSchema(db: Database.Database): void {
  db.exec(`DROP TRIGGER memory_vector_key_delete;
  DROP TRIGGER history_vector_insert; DROP TRIGGER history_vector_update; DROP TRIGGER history_vector_delete;
  DROP TRIGGER memory_vector_insert; DROP TRIGGER memory_vector_update; DROP TRIGGER memory_vector_delete;
  DROP TRIGGER history_embedding_invalidate; DROP TRIGGER memory_embedding_invalidate;
  DROP TABLE history_vec; DROP TABLE memory_vec; DROP TABLE memory_vector_keys;`);
}
