// SQLite 层：唯一事实源（设计文档 §5）。表结构见 §5.3 与 schema.ts。
// 单进程独占连接，better-sqlite3 同步 API；迁移用 user_version 递增。
import Database from 'better-sqlite3';
import { dbPath, ensureLayout } from './paths.js';
import { migrateSchema, type SchemaDb } from './schema.js';

export type RunStatus =
  | 'running'
  | 'waiting_gate'
  | 'waiting_children'
  | 'completed'
  | 'failed'
  | 'stale';

export function openDb(dbFile?: string): Database.Database {
  if (dbFile === undefined) ensureLayout();
  const db = new Database(dbFile ?? dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateSchema(betterSqlite(db));
  return db;
}

/** better-sqlite3 → 迁移所需的四个动作 */
export function betterSqlite(db: Database.Database): SchemaDb {
  return {
    exec: (sql: string) => {
      db.exec(sql);
    },
    userVersion: () => db.pragma('user_version', { simple: true }) as number,
    setUserVersion: (version: number) => {
      db.pragma(`user_version = ${version}`);
    },
    transaction: <T>(fn: () => T): (() => T) => () => db.transaction(fn)(),
  };
}

/** 测试辅助：内存库（共享 schema） */
export function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrateSchema(betterSqlite(db));
  return db;
}
