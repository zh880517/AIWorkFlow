// run 只读查询：监控面板的数据源（设计文档 §9）。SQLite 是唯一事实源，这里只读不写。
// 面板侧的分组（按 cwd）、停滞判定（15 分钟 / 24 小时）在 UI 层做，这里给原始事实。
import type Database from 'better-sqlite3';

export interface RunListItem {
  id: string;
  parentRunId: string | null;
  rootRunId: string;
  flowId: string;
  flowName: string | null;
  status: string;
  currentNode: string | null;
  cwd: string | null;
  projectName: string | null;
  stepsUsed: number;
  createdAt: string;
  lastActivity: string | null;
  finishedAt: string | null;
}

export interface RunExecutionItem {
  id: number;
  nodeId: string;
  iteration: number;
  status: string;
  summary: string | null;
  /** 已解析的对象；空 payload 为 {} */
  payload: unknown;
  branchId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunDetail extends RunListItem {
  snapshotHash: string;
  /** 按 id 升序 = 发生顺序 */
  executions: RunExecutionItem[];
}

interface RunRowJoined {
  id: string;
  parent_run_id: string | null;
  root_run_id: string;
  flow_id: string;
  flow_name: string | null;
  flow_snapshot_hash: string;
  current_node: string | null;
  status: string;
  cwd: string | null;
  project_name: string | null;
  steps_used: number;
  last_activity: string | null;
  created_at: string;
  finished_at: string | null;
}

const LIST_SQL = `SELECT r.*, f.name AS flow_name
  FROM runs r LEFT JOIN flows f ON f.id = r.flow_id`;

export function listRuns(db: Database.Database, limit = 200): RunListItem[] {
  const rows = db
    .prepare(`${LIST_SQL} ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?`)
    .all(limit) as RunRowJoined[];
  return rows.map(toListItem);
}

export function getRunDetail(db: Database.Database, runId: string): RunDetail | undefined {
  const row = db.prepare(`${LIST_SQL} WHERE r.id = ?`).get(runId) as RunRowJoined | undefined;
  if (row === undefined) return undefined;
  const executions = db
    .prepare(
      'SELECT id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at FROM node_executions WHERE run_id = ? ORDER BY id',
    )
    .all(runId) as Array<{
    id: number;
    node_id: string;
    iteration: number;
    status: string;
    summary: string | null;
    payload: string;
    branch_id: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
  return {
    ...toListItem(row),
    snapshotHash: row.flow_snapshot_hash,
    executions: executions.map((e) => ({
      id: e.id,
      nodeId: e.node_id,
      iteration: e.iteration,
      status: e.status,
      summary: e.summary,
      payload: parsePayload(e.payload),
      branchId: e.branch_id,
      startedAt: e.started_at,
      finishedAt: e.finished_at,
    })),
  };
}

function toListItem(row: RunRowJoined): RunListItem {
  return {
    id: row.id,
    parentRunId: row.parent_run_id,
    rootRunId: row.root_run_id,
    flowId: row.flow_id,
    flowName: row.flow_name,
    status: row.status,
    currentNode: row.current_node,
    cwd: row.cwd,
    projectName: row.project_name,
    stepsUsed: row.steps_used,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    finishedAt: row.finished_at,
  };
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
