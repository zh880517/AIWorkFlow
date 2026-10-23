// 公用层：把 run 详情折叠成界面要的"进度语义"（纯函数，无 IO）。
//
// 主工程面板和 DSH 插件都用它，保证两边对"第几步 / 走到哪 / 卡在哪个节点"的理解一致。
import type { Flow, FlowSnapshot } from './types.js';
import type { RunDetail, RunExecutionItem, RunListItem } from './runTypes.js';

export type RunPhase = 'running' | 'gate' | 'children' | 'finished' | 'failed' | 'stale';

const PHASE_BY_STATUS: Record<string, RunPhase> = {
  running: 'running',
  waiting_gate: 'gate',
  waiting_children: 'children',
  completed: 'finished',
  failed: 'failed',
  stale: 'stale',
};

export function phaseOf(run: Pick<RunListItem, 'status' | 'outcome'>): RunPhase {
  const phase = PHASE_BY_STATUS[run.status];
  if (phase !== undefined) return phase;
  return run.outcome === 'fail' ? 'failed' : 'finished';
}

export function isLive(phase: RunPhase): boolean {
  return phase === 'running' || phase === 'gate' || phase === 'children';
}

export function rootFlowOf(snapshot: FlowSnapshot | null): Flow | undefined {
  if (snapshot === null) return undefined;
  return snapshot.flows[snapshot.rootFlowId];
}

/** 节点展示名：优先 title，退化为 id */
export function nodeLabel(flow: Flow | undefined, nodeId: string | null): string {
  if (nodeId === null) return '';
  const node = flow?.nodes.find((n) => n.id === nodeId);
  const title = node?.title?.trim();
  return title !== undefined && title !== '' ? title : nodeId;
}

/** 分支展示名："*" 归一成"默认"，找不到时回退分支 id */
export function branchLabel(flow: Flow | undefined, nodeId: string, branchId: string | null): string | null {
  if (branchId === null) return null;
  const node = flow?.nodes.find((n) => n.id === nodeId);
  const branch = node?.branches?.find((b) => b.id === branchId);
  if (branch === undefined) return branchId;
  return branch.condition === '*' ? null : branch.condition;
}

export interface PathStep {
  nodeId: string;
  label: string;
  /** 同一节点的连续执行合并为一步，count 记录循环圈数 */
  count: number;
  statuses: string[];
  branch: string | null;
  lastExecutionId: number;
}

/**
 * 已走过的路径：按执行顺序列出节点，连续重复的节点合并（环的每一圈只体现在 count 上）。
 * 面板用横向"路径条"呈现，比整图更适合窄栏。
 */
export function buildPath(detail: RunDetail): PathStep[] {
  const flow = rootFlowOf(detail.snapshot);
  const steps: PathStep[] = [];
  for (const exec of detail.executions) {
    const last = steps[steps.length - 1];
    const branch = branchLabel(flow, exec.nodeId, exec.branchId);
    if (last !== undefined && last.nodeId === exec.nodeId) {
      last.count += 1;
      last.statuses.push(exec.status);
      last.lastExecutionId = exec.id;
      if (branch !== null) last.branch = branch;
      continue;
    }
    steps.push({
      nodeId: exec.nodeId,
      label: nodeLabel(flow, exec.nodeId),
      count: 1,
      statuses: [exec.status],
      branch,
      lastExecutionId: exec.id,
    });
  }
  return steps;
}

export function latestExecution(detail: RunDetail): RunExecutionItem | null {
  return detail.executions.length === 0 ? null : (detail.executions[detail.executions.length - 1] ?? null);
}

/** 汇聚行部分失败（§7.5）：重派后仍失败的 child 会带部分结果推进，界面要显性可见 */
export function isPartialGather(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null || !('children' in payload)) return false;
  const kids = (payload as { children?: unknown }).children;
  return Array.isArray(kids) && kids.some((k) => (k as { status?: string } | null)?.status === 'failed');
}

export interface ExecutionTone {
  key: 'done' | 'partial' | 'blocked' | 'limit' | 'dispatched' | 'unknown';
}

export function executionTone(exec: Pick<RunExecutionItem, 'status' | 'payload'>): ExecutionTone {
  if (exec.status === 'completed') {
    return { key: isPartialGather(exec.payload) ? 'partial' : 'done' };
  }
  if (exec.status === 'blocked') return { key: 'blocked' };
  if (exec.status === 'limit_exceeded') return { key: 'limit' };
  if (exec.status === 'dispatched') return { key: 'dispatched' };
  return { key: 'unknown' };
}

/** 指令/摘要压成一行，面板里不撑破布局 */
export function oneLine(text: string | null | undefined, max = 160): string {
  if (text === null || text === undefined) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}
