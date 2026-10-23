// 公用层：run 只读模型（监控视图的数据契约）。
//
// 与 src/core/runQuery.ts 的对外形状保持一致；这里独立声明是因为 runQuery 依赖
// better-sqlite3（原生模块），不能被插件 bundle 引入。字段变化时两边一起改。
import type { FlowSnapshot } from './types.js';

export interface RunListItem {
  id: string;
  parentRunId: string | null;
  rootRunId: string;
  flowId: string;
  flowName: string | null;
  status: string;
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
  payload: unknown;
  branchId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GateDecisionItem {
  id: number;
  nodeId: string;
  question: string | null;
  optionId: string | null;
  note: string | null;
  source: string | null;
  decidedAt: string | null;
}

export interface PendingGate {
  gateId: number;
  nodeId: string;
  question: string;
  options: Array<{ id: string; label: string }>;
}

export interface RunDetail extends RunListItem {
  snapshotHash: string;
  snapshot: FlowSnapshot | null;
  executions: RunExecutionItem[];
  gates: GateDecisionItem[];
  pendingGate: PendingGate | null;
}
