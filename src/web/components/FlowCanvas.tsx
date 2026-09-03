import { useMemo, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
} from '@xyflow/react';
import type { Flow } from '../../core/types.js';
import { NODE_META, flowToRf, nodeTitle } from '../dsl.js';
import { FlowNodeCard } from './FlowNodeCard.js';
import { NodeActionsContext, type NodeActions } from './nodeActions.js';

const nodeTypes: NodeTypes = { flow: FlowNodeCard };

export interface FlowCanvasProps {
  flow: Flow;
  /** 节点实测尺寸缓存，防止受控模式下重建节点对象时测量状态被重置（拖动闪烁） */
  measured: Record<string, { width: number; height: number }>;
  preview: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onEdgeClick: (edgeId: string) => void;
  onEdgesDelete: (edgeIds: string[]) => void;
  onAddOutlet: (nodeId: string, afterOutlet?: string) => string | null;
  onRemoveOutlet: (nodeId: string, outlet: string) => void;
  onMoveOutlet: (nodeId: string, outlet: string, toIndex: number) => void;
  onSetOutletCondition: (nodeId: string, outlet: string, condition: string) => void;
  onNodesChange: OnNodesChange;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (nodeIds: string[]) => void;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
}

export function FlowCanvas(props: FlowCanvasProps) {
  const { flow, measured, preview } = props;
  // 点击连线仅选中（高亮 + Delete 删除），不打开属性面板
  const { nodes, edges } = useMemo(() => flowToRf(flow, measured), [flow, measured]);

  const actions = useMemo<NodeActions>(
    () => ({
      addOutlet: props.onAddOutlet,
      removeOutlet: props.onRemoveOutlet,
      moveOutlet: props.onMoveOutlet,
      setOutletCondition: props.onSetOutletCondition,
      titleOf: (nodeId: string) => nodeTitle(flow, nodeId),
      readOnly: preview,
    }),
    [
      flow,
      preview,
      props.onAddOutlet,
      props.onRemoveOutlet,
      props.onMoveOutlet,
      props.onSetOutletCondition,
    ],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        selected: edge.id === props.selectedEdgeId,
        markerEnd: { type: MarkerType.ArrowClosed },
      })) satisfies Edge[],
    [edges, props.selectedEdgeId],
  );

  const styledNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === props.selectedNodeId })),
    [nodes, props.selectedNodeId],
  );

  return (
    <div
      className={`canvas-wrap ${preview ? 'preview' : ''}`}
      onDrop={props.onDrop}
      onDragOver={props.onDragOver}
    >
      <NodeActionsContext.Provider value={actions}>
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          onNodesChange={props.onNodesChange}
          onConnect={props.onConnect}
          onNodesDelete={(deleted) => props.onNodesDelete(deleted.map((n) => n.id))}
          onEdgesDelete={(deleted) => props.onEdgesDelete(deleted.map((e) => e.id))}
          onNodeClick={(_, node) => props.onNodeClick(node.id)}
          onEdgeClick={(_, edge) => props.onEdgeClick(edge.id)}
          onPaneClick={props.onPaneClick}
          nodesDraggable={!preview}
          nodesConnectable={!preview}
          edgesReconnectable={false}
          isValidConnection={(conn) => {
            if (conn.source === undefined || conn.source === conn.target) return false;
            if (conn.target === flow.entry) return false; // 开始节点没有入线
            // 出口已被占用时允许落线：自动替换旧连线（connect 内处理）
            return true;
          }}
          deleteKeyCode={preview ? null : ['Backspace', 'Delete']}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            nodeColor={(node) =>
              NODE_META[
                (node as { data?: { flowNode?: { type?: keyof typeof NODE_META } } })?.data?.flowNode?.type ?? 'prompt'
              ].color
            }
          />
        </ReactFlow>
      </NodeActionsContext.Provider>
    </div>
  );
}
