// run 详情的只读画布（§9.2）：快照图渲染 + 节点着色（已过/正在跑脉动/失败/未走到）
// + 走过的路径高亮（未走的分支虚线）+ 迭代次数角标。刻意不复用编辑器的 FlowCanvas——
// 那套带着出口编辑/连线交互的复杂度，监控只需要看。
import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodesChange,
} from '@xyflow/react';
import type { Flow, FlowNode } from '../../core/types.js';
import type { RunExecutionItem } from '../api.js';

export interface RunFlowCanvasProps {
  flow: Flow;
  executions: RunExecutionItem[];
  currentNode: string | null;
  /** run 是否仍在进行（进行中才有"正在跑"脉动） */
  running: boolean;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
}

interface RunNodeData extends Record<string, unknown> {
  label: string;
  type: string;
  state: 'current' | 'failed' | 'done' | 'pending';
  count: number;
  outcomeText?: string;
}

interface Stats {
  count: number;
  bad: boolean; // blocked / limit_exceeded 出现在该节点上
}

function computeStats(flow: Flow, executions: RunExecutionItem[]): Map<string, Stats> {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const stats = new Map<string, Stats>();
  const bump = (id: string, bad: boolean): void => {
    const cur = stats.get(id) ?? { count: 0, bad: false };
    cur.count += 1;
    if (bad) cur.bad = true;
    stats.set(id, cur);
  };
  for (const e of executions) bump(e.nodeId, e.status !== 'completed');
  // 终点节点没有执行轨迹，从 current_node / 最后一次转移补一个"到过"
  void byId;
  return stats;
}

/** 走过的边集合（from->to）。转移证据：branchId → branch.to；无分支 → next；limit_exceeded → onLimitExceeded */
function computeTaken(flow: Flow, executions: RunExecutionItem[], currentNode: string | null): Set<string> {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const taken = new Set<string>();
  const record = (from: string, to: string | undefined): void => {
    if (to !== undefined) taken.add(`${from}->${to}`);
  };
  for (const e of executions) {
    const node = byId.get(e.nodeId);
    if (node === undefined) continue;
    if (e.status === 'limit_exceeded') record(e.nodeId, node.onLimitExceeded);
    else if (e.branchId !== null) record(e.nodeId, node.branches?.find((b) => b.id === e.branchId)?.to);
    else record(e.nodeId, node.next);
  }
  // 进行中的 run：最后一步的落点就是 current_node，这条转移已经发生
  const last = executions.at(-1);
  if (last !== undefined && currentNode !== null) record(last.nodeId, currentNode);
  return taken;
}

/** 手写图（无 _ui 布局）的兜底排版：从 entry 按依赖深度分列 */
function autoLayout(flow: Flow): Map<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const queue: Array<{ id: string; d: number }> = [{ id: flow.entry, d: 0 }];
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (depth.has(id)) continue;
    depth.set(id, d);
    const node = byId.get(id);
    if (node === undefined) continue;
    const nexts = [...(node.branches ?? []).map((b) => b.to), ...(node.next !== undefined ? [node.next] : []), ...(node.onLimitExceeded !== undefined ? [node.onLimitExceeded] : [])];
    for (const to of nexts) queue.push({ id: to, d: d + 1 });
  }
  const perDepth = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const node of flow.nodes) {
    const d = depth.get(node.id) ?? 0;
    const idx = perDepth.get(d) ?? 0;
    perDepth.set(d, idx + 1);
    pos.set(node.id, { x: 40 + d * 300, y: 40 + idx * 170 });
  }
  return pos;
}

type RunNodeType = Node<RunNodeData, 'run'>;

function RunNode({ data }: NodeProps<RunNodeType>) {
  return (
    <div className={`run-node state-${data.state}${data.count > 1 ? ' multi' : ''}`}>
      {/* 边的锚点：React Flow 的边挂在 Handle 上，自定义节点不渲染 Handle 边就消失 */}
      <Handle type="target" position={Position.Left} className="run-handle" isConnectable={false} />
      <span className="run-node-type">{data.type}</span>
      <span className="run-node-label">{data.label}</span>
      {data.outcomeText !== undefined && <span className="run-node-outcome">{data.outcomeText}</span>}
      {data.count > 1 && <span className="run-node-count" title={`执行了 ${data.count} 次`}>×{data.count}</span>}
      <Handle type="source" position={Position.Right} className="run-handle" isConnectable={false} />
    </div>
  );
}

const nodeTypes = { run: RunNode };

export function RunFlowCanvas({ flow, executions, currentNode, running, selectedNodeId, onNodeClick }: RunFlowCanvasProps) {
  // 受控模式坑（同编辑器 FlowCanvas）：每次重渲染重建节点对象会丢实测尺寸，
  // 必须把 onNodesChange 的 dimensions 回灌进 node.measured，否则边（依赖两端 measured）不渲染
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setMeasured((cur) => {
      let next: Record<string, { width: number; height: number }> | null = null;
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions != null) {
          next ??= { ...cur };
          next[c.id] = c.dimensions;
        }
      }
      return next ?? cur;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const stats = computeStats(flow, executions);
    const taken = computeTaken(flow, executions, currentNode);
    const layout: Map<string, { x: number; y: number }> =
      flow._ui?.positions !== undefined ? new Map(Object.entries(flow._ui.positions)) : autoLayout(flow);
    const nodes: RunNodeType[] = flow.nodes.map((n: FlowNode) => {
      const s = stats.get(n.id);
      const state: RunNodeData['state'] =
        running && n.id === currentNode
          ? 'current'
          : s !== undefined && s.bad
            ? 'failed'
            : s !== undefined
              ? 'done'
              : n.id === currentNode // 已终结但停在终点
                ? 'done'
                : 'pending';
      const data: RunNodeData = {
        label: n.title?.trim() !== '' && n.title !== undefined ? n.title : n.id,
        type: n.type,
        state,
        count: s?.count ?? 0,
        ...(n.type === 'end' ? { outcomeText: n.outcome === 'fail' ? '✕ fail' : '✓ ok' } : {}),
      };
      return {
        id: n.id,
        type: 'run' as const,
        position: layout.get(n.id) ?? { x: 0, y: 0 },
        data,
        selected: n.id === selectedNodeId,
        measured: measured[n.id],
      };
    });
    const edges: Edge[] = [];
    for (const n of flow.nodes) {
      const outs: Array<{ id: string; to: string; label: string | undefined }> =
        n.branches !== undefined && n.branches.length > 0
          ? n.branches.map((b) => ({ id: `${n.id}~${b.id}`, to: b.to, label: b.condition === '*' ? '默认' : b.condition }))
          : n.next !== undefined
            ? [{ id: `${n.id}~next`, to: n.next, label: undefined }]
            : [];
      if (n.onLimitExceeded !== undefined) {
        outs.push({ id: `${n.id}~escape`, to: n.onLimitExceeded, label: '超限逃生' });
      }
      for (const o of outs) {
        const isTaken = taken.has(`${n.id}->${o.to}`);
        edges.push({
          id: o.id,
          source: n.id,
          target: o.to,
          label: o.label,
          className: isTaken ? 'run-edge taken' : 'run-edge untaken',
          deletable: false,
        });
      }
    }
    return { nodes, edges };
  }, [flow, executions, currentNode, running, selectedNodeId, measured]);

  return (
    <div className="canvas-wrap">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onPaneClick={() => onNodeClick(null)}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262626" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
    </div>
  );
}
