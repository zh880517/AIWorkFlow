// 表结构与迁移（与驱动无关）。插件用 node:sqlite，测试用同一份 MIGRATIONS：
// 唯一事实源的表结构不能被复制成两份。
// 适配层只需实现 exec / userVersion / setUserVersion / transaction 四个动作。

/** 迁移需要的最小连接能力（node:sqlite 适配层实现） */
export interface SchemaDb {
  exec(sql: string): void;
  userVersion(): number;
  setUserVersion(version: number): void;
  transaction<T>(fn: () => T): () => T;
}

export const MIGRATIONS: string[] = [
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
  // v2：run 绑定 DSH 会话 id（"dsh:<sessionId>"，来自工具执行上下文）
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
  // v6：移除 MCP 会话锚点——只支持 DSH 插件，run 的会话身份统一由 host_session 承担
  `
  ALTER TABLE runs DROP COLUMN mcp_session_id;
  `,
  // v7：多 Agent——角色/线程/run 输入；子 Agent 同角色跨轮共享 thread_id，线程摘要据此查询
  `
  ALTER TABLE runs ADD COLUMN role TEXT;
  ALTER TABLE runs ADD COLUMN thread_id TEXT;
  ALTER TABLE runs ADD COLUMN inputs TEXT;
  CREATE INDEX IF NOT EXISTS idx_runs_thread ON runs(root_run_id, thread_id, created_at);
  `,
  // v8：产物总线——每个 key 按版本递增，插值 {{artifacts.key.path}} 永远取最新版
  `
  CREATE TABLE IF NOT EXISTS run_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_run_id TEXT NOT NULL,
    key TEXT NOT NULL,
    version INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    role TEXT,
    summary TEXT,
    path TEXT,
    content TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(root_run_id, key, version)
  );
  CREATE INDEX IF NOT EXISTS idx_artifacts_root_key ON run_artifacts(root_run_id, key, version DESC);
  `,
  // v9：同一 subagent 节点可能在回路里多轮派发；用 parent_iteration 把“本轮 child”与历史轮次分开
  `
  ALTER TABLE runs ADD COLUMN parent_iteration INTEGER;
  CREATE INDEX IF NOT EXISTS idx_runs_parent_iteration ON runs(parent_run_id, parent_node, parent_iteration);
  `,
  // v10：区分主流程与「子 Agent 配置」；老图默认 flow，不改变任何现有行
  `
  ALTER TABLE flows ADD COLUMN kind TEXT NOT NULL DEFAULT 'flow';
  CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows(kind);
  `,
];

/** 逐级迁移；库版本高于程序支持版本时拒绝启动，避免旧代码写坏新库 */
export function migrateSchema(db: SchemaDb): void {
  const version = db.userVersion();
  if (version > MIGRATIONS.length) {
    throw new Error(
      `数据库版本 ${version} 高于当前程序支持的 ${MIGRATIONS.length}，请升级 aiworkflow DSH 插件后再试。`,
    );
  }
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.setUserVersion(v + 1);
    })();
  }
}
