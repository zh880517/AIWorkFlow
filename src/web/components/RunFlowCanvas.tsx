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
import type { Flow, FlowNode } from '../../core/types.js';
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

/** 一条轨迹隐含的转移目标 */
function transitionOf(node: FlowNode | undefined, e: RunExecutionItem): string | undefined {
  if (node === undefined) return undefined;
  if (e.status === 'limit_exceeded') return node.onLimitExceeded;
  if (e.branchId !== null) return node.branches?.find((b) => b.id === e.branchId)?.to;
  return node.next;
}

/** 走过的边及次数（from->to → N）。转移证据：branchId → branch.to；无分支 → next；limit_exceeded → onLimitExceeded */
function computeTaken(flow: Flow, executions: RunExecutionItem[], currentNode: string | null): Map<string, number> {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const taken = new Map<string, number>();
  const record = (from: string, to: string | undefined): void => {
    if (to === undefined) return;
    const key = `${from}->${to}`;
    taken.set(key, (taken.get(key) ?? 0) + 1);
  };
  for (const e of executions) {
    record(e.nodeId, transitionOf(byId.get(e.nodeId), e));
  }
  // 兜底：最后一步若推不出转移目标（如 blocked 无出口），落点只能来自 current_node；
  // 推得出时不补记，否则逃生等转移会被算两次
  const last = executions.at(-1);
  if (last !== undefined && currentNode !== null && transitionOf(byId.get(last.nodeId), last) === undefined) {
    record(last.nodeId, currentNode);
  }
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
      const count = taken.get(`${e.source}->${e.target}`) ?? 0;
      const isTaken = count > 0;
      const baseLabel = e.data?.kind === 'escape' ? '超限逃生' : undefined;
      return {
        ...e,
        className: isTaken ? 'run-edge taken' : 'run-edge untaken',
        // 走过 >1 次的边标次数（环绕几圈在边上可见）；逃生边保留说明文字
        label: count > 1 ? (baseLabel !== undefined ? `${baseLabel} ×${count}` : `×${count}`) : baseLabel,
        animated: isTaken,
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
