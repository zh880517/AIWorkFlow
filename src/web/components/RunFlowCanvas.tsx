// run 详情的只读画布（§9.2）：复用编辑器的正常节点卡（FlowNodeCard，含出口/条件完整视觉），
// 运行状态作为附加层——外圈状态环（已过/正在跑脉动/失败）+ ×N 迭代角标 + 路径高亮（走过实线、未走虚线）。
// 只读：出口、条件、连线都不可编辑；但节点可以拖动摆放（位置只存内存，不回写图）。
import { useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeProps,
} from '@xyflow/react';
import type { Flow } from '../../core/types.js';
import type { RunExecutionItem } from '../api.js';
import { flowToRf, normalizeOutlets, nodeTitle, type FlowRFNode } from '../dsl.js';
import { FlowNodeCard } from './FlowNodeCard.js';
import { NodeActionsContext, type NodeActions } from './nodeActions.js';

export interface RunFlowCanvasProps {
  flow: Flow;
  executions: RunExecutionItem[];
  currentNode: string | null;
  /** run 是否仍在进行（进行中才有"正在跑"脉动） */
  running: boolean;
  onNodeClick: (nodeId: string | null) => void;
}

/** 叠加在 FlowNodeCard 之上的运行状态（FlowNodeCard 只认 flowNode/isEntry，多余字段它不看） */
interface RunNodeData extends Record<string, unknown> {
  flowNode: FlowRFNode['data']['flowNode'];
  isEntry: boolean;
  runState: 'current' | 'failed' | 'done' | 'pending';
  runCount: number;
}

interface Stats {
  count: number;
  bad: boolean; // blocked / limit_exceeded 出现在该节点上
}

function computeStats(executions: RunExecutionItem[]): Map<string, Stats> {
  const stats = new Map<string, Stats>();
  for (const e of executions) {
    const cur = stats.get(e.nodeId) ?? { count: 0, bad: false };
    cur.count += 1;
    if (e.status !== 'completed') cur.bad = true;
    stats.set(e.nodeId, cur);
  }
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

function RunFlowNodeCard(props: NodeProps<FlowRFNode>) {
  const data = props.data as RunNodeData;
  return (
    <div className={`run-wrap state-${data.runState}`}>
      <FlowNodeCard {...props} />
      {data.runCount > 1 && (
        <span className="run-node-count" title={`执行了 ${data.runCount} 次`}>
          ×{data.runCount}
        </span>
      )}
    </div>
  );
}

const nodeTypes = { flow: RunFlowNodeCard };

export function RunFlowCanvas({ flow, executions, currentNode, running, onNodeClick }: RunFlowCanvasProps) {
  // 拖动位置单独持久（run 状态刷新/重挂画布后节点仍停在用户摆的位置）
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number }>>({});

  const normalized = useMemo(() => normalizeOutlets(flow), [flow]);
  const base = useMemo(() => flowToRf(normalized), [normalized]);

  const { nodes, edges } = useMemo(() => {
    const stats = computeStats(executions);
    const taken = computeTaken(flow, executions, currentNode);
    const nodes = base.nodes.map((n) => {
      const s = stats.get(n.id);
      const state: RunNodeData['runState'] =
        running && n.id === currentNode
          ? 'current'
          : s !== undefined && s.bad
            ? 'failed'
            : s !== undefined || n.id === currentNode // 已终结但停在终点也算到过
              ? 'done'
              : 'pending';
      return {
        ...n,
        position: dragPos[n.id] ?? n.position,
        data: { ...n.data, runState: state, runCount: s?.count ?? 0 } as FlowRFNode['data'],
      };
    });
    const edges = base.edges.map((e) => {
      const isTaken = taken.has(`${e.source}->${e.target}`);
      return {
        ...e,
        className: isTaken ? 'run-edge taken' : 'run-edge untaken',
        label: e.data?.kind === 'escape' ? '超限逃生' : undefined,
        deletable: false,
        focusable: false,
      };
    });
    return { nodes, edges };
  }, [base, dragPos, executions, currentNode, running, flow]);

  // run 状态变化才重挂画布。刻意用完全非受控（defaultNodes/defaultEdges、不传 onNodesChange）：
  // 受控模式下若不把变更应用回 nodes 数组，React Flow 的内部测量（measured/handleBounds）
  // 永远完不成，边会静默不渲染——测量竞态时好时坏，非受控是官方保证测量的路径。
  const viewKey = `${currentNode ?? '-'}:${running}:${executions.length}:${executions.at(-1)?.id ?? 0}`;

  // 只读动作集：出口增删/排序/条件编辑全部禁用，titleOf 供出口行显示"→ 目标名"
  const readOnlyActions: NodeActions = useMemo(
    () => ({
      addOutlet: () => null,
      removeOutlet: () => {},
      moveOutlet: () => {},
      setOutletCondition: () => {},
      titleOf: (id) => nodeTitle(normalized, id),
      readOnly: true,
    }),
    [normalized],
  );

  return (
    <div className="canvas-wrap">
      <NodeActionsContext.Provider value={readOnlyActions}>
        <ReactFlow
          key={viewKey}
          defaultNodes={nodes}
          defaultEdges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          elementsSelectable
          onNodeDragStop={(_, node) => setDragPos((cur) => ({ ...cur, [node.id]: node.position }))}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          onPaneClick={() => onNodeClick(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262626" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </NodeActionsContext.Provider>
    </div>
  );
}
