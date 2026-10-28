// 数据目录与单条连接：HTTP 路由与 Agent 工具共用（WAL 下避免多句柄竞争写锁）。
// 路径与表结构都在公用层（shared/src/paths.ts、schema.ts），面板与工具共用一份。
import { join } from 'node:path';
import { ensureLayout, flowsDir as coreFlowsDir, homeDir } from '@shared/paths.js';
import { migrateSchema } from '@shared/schema.js';
import { NodeSqliteDb } from './sqlite.js';

interface OpenDatabase {
  path: string;
  db: NodeSqliteDb;
}

let opened: OpenDatabase | null = null;

export function aiworkflowHome(): string {
  return homeDir();
}

export function databasePath(): string {
  return join(aiworkflowHome(), 'aiworkflow.db');
}

export function flowsDir(): string {
  return coreFlowsDir();
}

/** 库不存在时创建并建表：插件自己就能开场，不依赖任何外部命令 */
export function database(): NodeSqliteDb {
  const file = databasePath();
  if (opened !== null && opened.path === file) return opened.db;
  closeDatabase();
  ensureLayout();
  const db = new NodeSqliteDb(file);
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrateSchema(db);
  } catch (error) {
    db.close();
    throw error;
  }
  opened = { path: file, db };
  return db;
}

export function closeDatabase(): void {
  if (opened === null) return;
  try {
    opened.db.close();
  } catch {
    // 关闭失败不阻塞卸载
  }
  opened = null;
}
