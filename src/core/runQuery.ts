// run 只读查询：监控面板的数据源（设计文档 §9）。SQLite 是唯一事实源。
// 分组（按 cwd）与排序在 UI 层做。原 §9.2 停滞检测（15 分钟标黄 / 24 小时标 stale）
// 已按用户决定移除（2026-09-08）：AI 执行中长时间暂停是常态，不按超时判异常。
import type Database from 'better-sqlite3';
import { loadSnapshot } from './snapshot.js';
import type { FlowSnapshot } from './types.js';

export interface RunListItem {
  id: string;
  parentRunId: string | null;
  rootRunId: string;
  flowId: string;
  flowName: string | null;
  status: string;
  /** 终结时落库（v3 起）；completed 且为 null 的旧数据在读取时从快照终点推导 */
  outcome: 'success' | 'fail' | null;
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

/** 卡点决策（§5.3 gate_decisions）；未决时 optionId/decidedAt/source 为 null */
export interface GateDecisionItem {
  /** 即下发给 Agent 的 gateId */
  id: number;
  nodeId: string;
  question: string | null;
  optionId: string | null;
  note: string | null;
  /** 'panel' | 'chat' | 'pending'（未决占位） */
  source: string | null;
  decidedAt: string | null;
}

/** 当前挂起的卡点（阶段 5 面板点选用）；options 从快照 gate 节点解析 */
export interface PendingGate {
  gateId: number;
  nodeId: string;
  question: string;
  options: Array<{ id: string; label: string }>;
}

export interface RunDetail extends RunListItem {
  snapshotHash: string;
  /** run 实际执行的那份快照图（copy-on-run，§5.2）；详情渲染用它而不是当前图 */
  snapshot: FlowSnapshot | null;
  /** 按 id 升序 = 发生顺序 */
  executions: RunExecutionItem[];
  /** 全部卡点决策（含未决），按 id 升序 */
  gates: GateDecisionItem[];
  /** run 正挂在卡点上等确认时有值 */
  pendingGate: PendingGate | null;
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
  outcome: 'success' | 'fail' | null;
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
  for (const row of rows) backfillOutcome(db, row);
  return rows.map(toListItem);
}

export function getRunDetail(db: Database.Database, runId: string): RunDetail | undefined {
  const row = db.prepare(`${LIST_SQL} WHERE r.id = ?`).get(runId) as RunRowJoined | undefined;
  if (row === undefined) return undefined;
  backfillOutcome(db, row);
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
  const snapshot = loadSnapshot(db, row.flow_snapshot_hash) ?? null;
  const gateRows = db
    .prepare('SELECT id, node_id, question, option_id, note, source, decided_at FROM gate_decisions WHERE run_id = ? ORDER BY id')
    .all(runId) as Array<{
    id: number;
    node_id: string;
    question: string | null;
    option_id: string | null;
    note: string | null;
    source: string;
    decided_at: string | null;
  }>;
  // 面板点选（§7.6）：挂起中的卡点带选项（从快照 gate 节点解析；快照丢失时选项为空仍可展示问题）
  const pendingRow =
    row.status === 'waiting_gate' && row.current_node !== null
      ? gateRows.find((g) => g.node_id === row.current_node && g.decided_at === null)
      : undefined;
  let pendingGate: PendingGate | null = null;
  if (pendingRow !== undefined) {
    const node = snapshot?.flows[snapshot.rootFlowId]?.nodes.find((n) => n.id === pendingRow.node_id);
    pendingGate = {
      gateId: pendingRow.id,
      nodeId: pendingRow.node_id,
      question: pendingRow.question ?? '',
      options: node !== undefined && node.type === 'gate' ? node.options.map((o) => ({ id: o.id, label: o.label })) : [],
    };
  }
  return {
    ...toListItem(row),
    snapshotHash: row.flow_snapshot_hash,
    snapshot,
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
    gates: gateRows.map((g) => ({
      id: g.id,
      nodeId: g.node_id,
      question: g.question,
      optionId: g.option_id,
      note: g.note,
      source: g.decided_at === null ? null : g.source,
      decidedAt: g.decided_at,
    })),
    pendingGate,
  };
}

/** 旧数据（v3 前完成的 run）没有 outcome，从快照终点推导；只影响读取，不回写 */
function backfillOutcome(db: Database.Database, row: RunRowJoined): void {
  if (row.status !== 'completed' || row.outcome !== null) return;
  if (row.current_node === null) {
    row.outcome = 'success'; // 隐式 end
    return;
  }
  const snapshot = loadSnapshot(db, row.flow_snapshot_hash);
  const end = snapshot?.flows[snapshot.rootFlowId]?.nodes.find((n) => n.id === row.current_node);
  row.outcome = end?.type === 'end' ? end.outcome : null;
}

function toListItem(row: RunRowJoined): RunListItem {
  return {
    id: row.id,
    parentRunId: row.parent_run_id,
    rootRunId: row.root_run_id,
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
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
