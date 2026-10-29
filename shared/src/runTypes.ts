// 公用层：run 只读模型（监控视图的数据契约）。
//
// 只依赖最小 SQL 接口，不绑定具体驱动，插件 Host 半直接使用。
import type { FlowKind, FlowSnapshot } from './types.js';

export interface RunListItem {
  id: string;
  parentRunId: string | null;
  /** 派发该 child 的父节点 id（根 run 为 null） */
  parentNode: string | null;
  rootRunId: string;
  flowId: string;
  flowName: string | null;
  /** flow（主流程）/ agent（子 Agent 配置）；图被删或老快照时为 null */
  flowKind: FlowKind | null;
  status: string;
  outcome: 'success' | 'fail' | null;
  currentNode: string | null;
  cwd: string | null;
  projectName: string | null;
  stepsUsed: number;
  /** P1：角色/线程（根 run 为 null；child run 带派发节点的 role/thread） */
  role: string | null;
  threadId: string | null;
  /** P1：该 child 是父节点第几轮派发（根 run 为 null） */
  parentIteration: number | null;
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

export interface RunArtifactItem {
  key: string;
  version: number;
  summary: string | null;
  path: string | null;
  role: string | null;
  createdAt: string;
}

export interface RunDetail extends RunListItem {
  snapshotHash: string;
  snapshot: FlowSnapshot | null;
  executions: RunExecutionItem[];
  gates: GateDecisionItem[];
  pendingGate: PendingGate | null;
  /** 直接子 run（subagent 派发出来的 child；内嵌子图也在这里） */
  children: RunListItem[];
  /** P1：整个 root run 的产物（按 key/version 升序）；child run 详情也能看到同一批 */
  artifacts: RunArtifactItem[];
}
