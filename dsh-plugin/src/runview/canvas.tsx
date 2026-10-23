// 只读画布：拖动、连线、删除全部关掉，只保留平移/缩放/点选（点节点筛轨迹）。
import * as React from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import flowCss from '@xyflow/react/dist/style.css?inline';
import type { CanvasEdge } from '../editor/model.js';
import { runCss } from './styles.js';
import type { RunCanvasNode } from './model.js';

function RunNode({ data, selected }: NodeProps<RunCanvasNode>): React.ReactElement {
  const shown = data.detail.length > 64 ? `${data.detail.slice(0, 64)}…` : data.detail;
  return (
    <div className="awr-node" data-state={data.state} data-selected={selected ? 'true' : 'false'}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="awr-node-top">
        <span className="awr-node-kind">{data.kindLabel}</span>
        {data.count > 1 && <span className="awr-node-count">×{data.count}</span>}
        <span className="awr-node-state">{data.stateLabel}</span>
      </div>
      <div className="awr-node-title">{data.title}</div>
      {shown !== '' && <div className="awr-node-detail">{shown}</div>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes: NodeTypes = { run: RunNode };

export interface RunCanvasProps {
  nodes: RunCanvasNode[];
  edges: CanvasEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function RunCanvas({ nodes, edges, selectedId, onSelect }: RunCanvasProps): React.ReactElement {
  // 选中态由外部持有（用于筛选轨迹），这里只把它同步进节点样式
  const shown = React.useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedId })),
    [nodes, selectedId],
  );

  return (
    <div className="awr-canvas">
      <style>{flowCss}</style>
      <style>{runCss}</style>
      <ReactFlow
        nodes={shown}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
