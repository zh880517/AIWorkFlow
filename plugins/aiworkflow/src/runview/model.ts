// 运行图：把 run 的快照图 + 执行记录映射成"只读画布"（节点着色、走过的边高亮）。
// 与编辑器共用 canvasOf 的布局语义，但这里不产生任何编辑行为。
import type { Node } from '@xyflow/react';
import type { Flow, FlowSnapshot, NodeType, RunDetail } from '@shared/index.js';
import { canvasOf, detailOf, typeLabel, type CanvasEdge } from '../editor/model.js';

export type NodeState = 'done' | 'current' | 'waiting' | 'blocked' | 'idle';

export interface RunNodeData extends Record<string, unknown> {
  title: string;
  kind: NodeType;
  kindLabel: string;
  detail: string;
  state: NodeState;
  count: number;
  stateLabel: string;
}

export type RunCanvasNode = Node<RunNodeData, 'run'>;

export interface RunGraph {
  nodes: RunCanvasNode[];
  edges: CanvasEdge[];
  flow: Flow;
}

const ACTIVE_RUN = new Set(['running', 'waiting_gate', 'waiting_children']);

const STATE_LABEL: Record<NodeState, string> = {
  done: '已完成',
  current: '进行中',
  waiting: '等子 Agent',
  blocked: '阻塞',
  idle: '未走到',
};

export function isActiveRun(detail: RunDetail): boolean {
  return ACTIVE_RUN.has(detail.status);
}

interface NodeProgress {
  state: NodeState;
  count: number;
}

/** 节点状态：阻塞/派发优先，其次"当前步"，再次"跑过"，最后"没走到" */
export function progressOf(detail: RunDetail, nodeId: string): NodeProgress {
  const execs = detail.executions.filter((exec) => exec.nodeId === nodeId);
  const completed = execs.filter((exec) => exec.status === 'completed').length;
  const last = execs[execs.length - 1];
  if (last?.status === 'blocked') return { state: 'blocked', count: completed };
  if (last?.status === 'dispatched') return { state: 'waiting', count: completed };
  if (detail.currentNode === nodeId) {
    // 终结点没有 node_executions 行，靠 run 的终态把它标成"已完成/失败"
    if (isActiveRun(detail)) return { state: 'current', count: completed };
    if (detail.status === 'completed') return { state: 'done', count: completed };
    if (detail.status === 'failed' || detail.status === 'stale') return { state: 'blocked', count: completed };
  }
  if (completed > 0) return { state: 'done', count: completed };
  return { state: 'idle', count: 0 };
}

/** 走过的边：完成的执行记录带 branchId 时走对应分支，否则走唯一后继 */
function traversedEdges(detail: RunDetail): Set<string> {
  const ids = new Set<string>();
  for (const exec of detail.executions) {
    if (exec.status !== 'completed') continue;
    ids.add(exec.branchId !== null ? `e-${exec.nodeId}-${exec.branchId}` : `e-${exec.nodeId}`);
  }
  return ids;
}

export function buildRunGraph(detail: RunDetail): RunGraph | null {
  const snapshot: FlowSnapshot | null = detail.snapshot;
  const flow = snapshot === null ? undefined : snapshot.flows[snapshot.rootFlowId];
  if (flow === undefined) return null;

  const base = canvasOf(flow);
  const traversed = traversedEdges(detail);
  const nodes: RunCanvasNode[] = base.nodes.map((node) => {
    const progress = progressOf(detail, node.id);
    const source = flow.nodes.find((candidate) => candidate.id === node.id);
    return {
      ...node,
      type: 'run',
      draggable: false,
      data: {
        title: node.data.title,
        kind: node.data.kind,
        kindLabel: typeLabel(node.data.kind),
        detail: source === undefined ? '' : detailOf(source),
        state: progress.state,
        count: progress.count,
        stateLabel: STATE_LABEL[progress.state],
      },
    };
  });

  const edges: CanvasEdge[] = base.edges.map((edge) => {
    const walked = traversed.has(edge.id);
    return {
      ...edge,
      selectable: false,
      style: walked
        ? { stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 2 }
        : { stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 1.2, strokeDasharray: '5 4' },
      labelStyle: walked ? { fill: 'var(--dsw-alias-brand-primary)' } : undefined,
    };
  });

  return { nodes, edges, flow };
}
