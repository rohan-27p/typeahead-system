import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeQuery, prefixUpperBound } from './normalize.js';

export class QueryStore {
  constructor(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.prepareSchema();
    this.prepareStatements();
  }

  prepareSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_queries_normalized
      ON queries(normalized_query);

      CREATE INDEX IF NOT EXISTS idx_queries_count
      ON queries(count DESC);
    `);
  }

  prepareStatements() {
    this.countRowsStmt = this.db.prepare('SELECT COUNT(*) AS total FROM queries');
    this.upsertStmt = this.db.prepare(`
      INSERT INTO queries (query, normalized_query, count, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(normalized_query) DO UPDATE SET
        count = queries.count + excluded.count,
        query = excluded.query,
        updated_at = CURRENT_TIMESTAMP
    `);
    this.suggestCountStmt = this.db.prepare(`
      SELECT query, normalized_query AS normalizedQuery, count
      FROM queries
      WHERE normalized_query >= ? AND normalized_query < ?
      ORDER BY count DESC, normalized_query ASC
      LIMIT ?
    `);
    this.topStmt = this.db.prepare(`
      SELECT query, normalized_query AS normalizedQuery, count
      FROM queries
      ORDER BY count DESC, normalized_query ASC
      LIMIT ?
    `);
    this.byNormalizedStmt = this.db.prepare(`
      SELECT query, normalized_query AS normalizedQuery, count
      FROM queries
      WHERE normalized_query = ?
    `);
  }

  countRows() {
    return this.countRowsStmt.get().total;
  }

  upsertDelta(query, delta) {
    const normalized = normalizeQuery(query);
    if (!normalized || delta <= 0) return;
    this.upsertStmt.run(query.trim(), normalized, delta);
  }

  upsertBatch(entries) {
    this.db.exec('BEGIN');
    try {
      for (const [query, delta] of entries) {
        this.upsertDelta(query, delta);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  suggestionsByCount(prefix, limit = 10) {
    const normalizedPrefix = normalizeQuery(prefix);
    if (!normalizedPrefix) return [];
    const upper = prefixUpperBound(normalizedPrefix);
    return this.suggestCountStmt.all(normalizedPrefix, upper, limit);
  }

  topByCount(limit = 10) {
    return this.topStmt.all(limit);
  }

  rowsByNormalizedQueries(normalizedQueries) {
    const rows = [];
    for (const normalized of normalizedQueries) {
      const row = this.byNormalizedStmt.get(normalized);
      if (row) rows.push(row);
    }
    return rows;
  }
}
