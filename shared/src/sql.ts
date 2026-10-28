// 公用层：aiworkflow.db 的只读查询。
//
// 连接由调用方注入（插件用 node:sqlite 的 DatabaseSync，测试可用内存库），
// 这里只依赖最小的 prepare/get/all 接口，不绑定具体驱动。
import type { FlowSnapshot } from './types.js';
import type {
  GateDecisionItem,
  PendingGate,
  RunDetail,
  RunExecutionItem,
  RunListItem,
} from './runTypes.js';

export type SqlParam = string | number | null;

/** 写入语句的返回值；两种 SQLite 驱动都返回 number 或 bigint */
export interface SqlRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface SqlStatement {
  get(...params: SqlParam[]): unknown;
  all(...params: SqlParam[]): unknown[];
  run(...params: SqlParam[]): SqlRunResult;
}

/** 只读连接需要的最小能力 */
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
}

/** 可写连接需要的最小能力（node:sqlite 的 DatabaseSync 直接满足） */
export interface SqlWriter extends SqlDatabase {
  exec(sql: string): void;
  transaction<T>(fn: () => T): () => T;
}

const ACTIVE_STATUSES = ['running', 'waiting_gate', 'waiting_children'] as const;

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

const LIST_SQL = `SELECT r.*, f.name AS flow_name
  FROM runs r LEFT JOIN flows f ON f.id = r.flow_id`;

const RUN_COLUMNS = [
  'id',
  'parent_run_id',
  'root_run_id',
  'flow_id',
  'flow_name',
  'flow_snapshot_hash',
  'current_node',
  'status',
  'outcome',
  'cwd',
  'project_name',
  'steps_used',
  'last_activity',
  'created_at',
  'finished_at',
] as const;

interface RunRow {
  id: string;
  parent_run_id: string | null;
  root_run_id: string | null;
  flow_id: string;
  flow_name: string | null;
  flow_snapshot_hash: string;
  current_node: string | null;
  status: string;
  outcome: 'success' | 'fail' | null;
  cwd: string | null;
  project_name: string | null;
  steps_used: number;
  last_activity: string | null;
  created_at: string;
  finished_at: string | null;
}

function asRunRow(raw: unknown): RunRow {
  return raw as RunRow;
}

export function listRuns(db: SqlDatabase, limit = 60, hostSession?: string | null): RunListItem[] {
  const session = typeof hostSession === 'string' && hostSession !== '' ? hostSession : null;
  const sql = `${LIST_SQL}${session === null ? '' : ' WHERE r.host_session = ?'} ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?`;
  const rows = (session === null ? db.prepare(sql).all(limit) : db.prepare(sql).all(session, limit)) as unknown[];
  return rows.map((row) => toListItem(asRunRow(row)));
}

export function loadSnapshot(db: SqlDatabase, hash: string): FlowSnapshot | undefined {
  const row = db.prepare('SELECT content FROM flow_snapshots WHERE hash = ?').get(hash) as
    | { content: string }
    | undefined;
  if (row === undefined) return undefined;
  try {
    return JSON.parse(row.content) as FlowSnapshot;
  } catch {
    return undefined;
  }
}

export function getRunDetail(db: SqlDatabase, runId: string): RunDetail | undefined {
  const raw = db.prepare(`${LIST_SQL} WHERE r.id = ?`).get(runId);
  if (raw === undefined || raw === null) return undefined;
  const row = asRunRow(raw);
  const snapshot = loadSnapshot(db, row.flow_snapshot_hash) ?? null;
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
    payload: string | null;
    branch_id: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
  const gateRows = db
    .prepare(
      'SELECT id, node_id, question, option_id, note, source, decided_at FROM gate_decisions WHERE run_id = ? ORDER BY id',
    )
    .all(runId) as Array<{
    id: number;
    node_id: string;
    question: string | null;
    option_id: string | null;
    note: string | null;
    source: string;
    decided_at: string | null;
  }>;

  const pendingGate = resolvePendingGate(row, snapshot, gateRows);

  return {
    ...toListItem(row),
    snapshotHash: row.flow_snapshot_hash,
    outcome: row.outcome ?? deriveOutcome(row, snapshot),
    snapshot,
    executions: executions.map(toExecution),
    gates: gateRows.map(toGate),
    pendingGate,
  };
}

/**
 * 一次请求返回监控页需要的全部数据：活跃 run、最近结束的 run、以及选中 run 的详情。
 * 面板每 2 秒拉一次，避免三方请求带来的时序错乱。
 */
export interface MonitorState {
  active: RunListItem[];
  recent: RunListItem[];
  selectedId: string | null;
  detail: RunDetail | null;
}

export function readMonitorState(
  db: SqlDatabase,
  selectedId?: string | null,
  limits: { runs?: number; list?: number } = {},
  /** 只读某会话的 run（`runs.host_session`，形如 `dsh:<sessionId>`）；缺省 = 全部 */
  hostSession?: string | null,
): MonitorState {
  const all = listRuns(db, limits.runs ?? 60, hostSession ?? null);
  const active = all.filter((r) => isActiveStatus(r.status)).slice(0, limits.list ?? 8);
  const recent = all.filter((r) => !isActiveStatus(r.status)).slice(0, limits.list ?? 8);
  const chosen =
    (selectedId !== null && selectedId !== undefined ? all.find((r) => r.id === selectedId)?.id : undefined) ??
    active[0]?.id ??
    recent[0]?.id ??
    null;
  const detail = chosen === null ? null : (getRunDetail(db, chosen) ?? null);
  return { active, recent, selectedId: chosen, detail };
}

function resolvePendingGate(
  row: RunRow,
  snapshot: FlowSnapshot | null,
  gateRows: Array<{ id: number; node_id: string; question: string | null; decided_at: string | null }>,
): PendingGate | null {
  // 未决卡点才是"真卡点"：不论 status 是否已切到 waiting_gate，只要当前节点上
  // 还有未决行，就说明这一步在等人（引擎先落行再改状态，面板轮询可能撞上中间态）。
  if (row.current_node === null || !isActiveStatus(row.status)) return null;
  const pending = gateRows.find((g) => g.node_id === row.current_node && g.decided_at === null);
  if (pending === undefined) return null;
  const root = snapshot?.flows[snapshot.rootFlowId];
  const node = root?.nodes.find((n) => n.id === pending.node_id);
  return {
    gateId: pending.id,
    nodeId: pending.node_id,
    question: pending.question ?? '',
    options: node !== undefined && node.type === 'gate' ? node.options.map((o) => ({ id: o.id, label: o.label })) : [],
  };
}

/** v3 之前完成的 run 没有 outcome，从快照终点推导（只读，不回写） */
function deriveOutcome(row: RunRow, snapshot: FlowSnapshot | null): 'success' | 'fail' | null {
  if (row.status !== 'completed') return null;
  if (row.current_node === null) return 'success';
  const root = snapshot?.flows[snapshot.rootFlowId];
  const end = root?.nodes.find((n) => n.id === row.current_node);
  return end !== undefined && end.type === 'end' ? end.outcome : null;
}

function toExecution(e: {
  id: number;
  node_id: string;
  iteration: number;
  status: string;
  summary: string | null;
  payload: string | null;
  branch_id: string | null;
  started_at: string | null;
  finished_at: string | null;
}): RunExecutionItem {
  return {
    id: e.id,
    nodeId: e.node_id,
    iteration: e.iteration,
    status: e.status,
    summary: e.summary,
    payload: parsePayload(e.payload ?? ''),
    branchId: e.branch_id,
    startedAt: e.started_at,
    finishedAt: e.finished_at,
  };
}

function toGate(g: {
  id: number;
  node_id: string;
  question: string | null;
  option_id: string | null;
  note: string | null;
  source: string;
  decided_at: string | null;
}): GateDecisionItem {
  return {
    id: g.id,
    nodeId: g.node_id,
    question: g.question,
    optionId: g.option_id,
    note: g.note,
    source: g.decided_at === null ? null : g.source,
    decidedAt: g.decided_at,
  };
}

function toListItem(row: RunRow): RunListItem {
  return {
    id: row.id,
    parentRunId: row.parent_run_id,
    rootRunId: row.root_run_id ?? row.id,
    flowId: row.flow_id,
    flowName: row.flow_name,
    status: row.status,
    outcome: row.outcome,
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
  if (raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** 大 payload 不整包下发，避免面板轮询被单步输出拖慢 */
export function trimPayload(value: unknown, maxChars = 4000): unknown {
  const text = JSON.stringify(value);
  if (text === undefined || text.length <= maxChars) return value;
  return { __truncated: true, size: text.length, preview: text.slice(0, maxChars) };
}

export { RUN_COLUMNS };
