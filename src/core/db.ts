// SQLite 层：唯一事实源（设计文档 §5）。表结构见 §5.3。
// 单进程独占连接，better-sqlite3 同步 API；迁移用 user_version 递增。
import Database from 'better-sqlite3';
import { dbPath, ensureLayout } from './paths.js';

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
  migrate(db);
  return db;
}

const MIGRATIONS: string[] = [
  // v1：Phase 1 全量建表
  `
  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS flow_snapshots (
    hash TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    parent_run_id TEXT REFERENCES runs(id),
    root_run_id TEXT,
    flow_id TEXT NOT NULL,
    flow_snapshot_hash TEXT NOT NULL REFERENCES flow_snapshots(hash),
    entry_node TEXT NOT NULL,
    current_node TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    cwd TEXT,
    project_name TEXT,
    mcp_session_id TEXT,
    child_token TEXT UNIQUE,
    steps_used INTEGER NOT NULL DEFAULT 0,
    last_activity TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_runs_root ON runs(root_run_id);
  CREATE INDEX IF NOT EXISTS idx_runs_cwd ON runs(cwd);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
  CREATE TABLE IF NOT EXISTS node_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    payload TEXT,
    branch_id TEXT,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_exec_run_node ON node_executions(run_id, node_id);
  CREATE TABLE IF NOT EXISTS gate_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    question TEXT,
    option_id TEXT,
    note TEXT,
    source TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gates_run ON gate_decisions(run_id);
  `,
  // v2：阶段 2.5 宿主身份注入——run 绑定宿主会话 id（"<host>:<sid>"，由 PreToolUse hook 注入）
  `
  ALTER TABLE runs ADD COLUMN host_session TEXT;
  CREATE INDEX IF NOT EXISTS idx_runs_host_session ON runs(host_session);
  `,
  // v3：阶段 4 监控——run 终结时落 outcome（success/fail），列表分栏（已完成/失败）直接可判
  `
  ALTER TABLE runs ADD COLUMN outcome TEXT;
  `,
  // v4：阶段 6 子 Agent——child run 记录派出它的 subagent 节点（parent_node）；
  // 重派一轮时新 child run 指向被替换的旧 run（retry_of），旧 run 保留为失败记录便于回看（§7.5）
  `
  ALTER TABLE runs ADD COLUMN parent_node TEXT;
  ALTER TABLE runs ADD COLUMN retry_of TEXT REFERENCES runs(id);
  CREATE INDEX IF NOT EXISTS idx_runs_parent_node ON runs(parent_run_id, parent_node);
  `,
  // v5：阶段 7 fan-out——每个 child 对应的条目（JSON，重派时沿用原 slot 条目；非 fan-out 为 NULL）
  `
  ALTER TABLE runs ADD COLUMN fanout_item TEXT;
  `,
];

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** 测试辅助：内存库（共享 schema） */
export function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
