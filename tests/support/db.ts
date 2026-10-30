// 测试用内存库：与插件 Host 半用同一个 node:sqlite 适配层与同一份迁移。
import { migrateSchema } from '../../shared/src/schema.js';
import { NodeSqliteDb } from '../../plugins/aiworkflow/src/sqlite.js';

export type TestDb = NodeSqliteDb;

export function openMemoryDb(): TestDb {
  const db = new NodeSqliteDb(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrateSchema(db);
  return db;
}
