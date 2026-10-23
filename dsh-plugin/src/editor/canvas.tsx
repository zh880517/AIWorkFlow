// 画布：React Flow 直接跑在 DSH 页面里（不是 iframe），节点/边由 page.tsx 持有。
import * as React from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import flowCss from '@xyflow/react/dist/style.css?inline';
import { typeLabel, type CanvasEdge, type CanvasNode } from './model.js';
import { editorCss } from './styles.js';

function WfNode({ data, selected }: NodeProps<CanvasNode>): React.ReactElement {
  return (
    <div className="wf-node" data-kind={data.kind} data-selected={selected ? 'true' : 'false'}>
      {/* 入口没有入线：不渲染 target handle，避免把线连进起点 */}
      {!data.isEntry && <Handle type="target" position={Position.Left} />}
      <div className="wf-node-kind">
        {typeLabel(data.kind)}
        {data.isEntry && <span className="wf-entry-badge">入口</span>}
      </div>
      <div className="wf-node-title">{data.title}</div>
      {data.detail !== '' && <div className="wf-node-detail">{data.detail}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = { wf: WfNode };
const edgeTypes: EdgeTypes = {};

export interface Point {
  x: number;
  y: number;
}

/** 交给父组件的画布能力：新节点按当前视口中心放置，避免落在可视区外 */
export interface CanvasApi {
  center: () => Point;
}

export interface FlowCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange<CanvasEdge>;
  onConnect: (connection: Connection) => void;
  /** 拖动已有连线的端点：改 source/target，保留边上的条件/出口数据 */
  onReconnect: (edge: CanvasEdge, connection: Connection) => void;
  onSelect: (id: string | null) => void;
  onMoveNode: () => void;
  /** 开始拖节点：父组件在这里压一次历史，整段拖拽只算一步撤销 */
  onDragNode: () => void;
  onPaneMenu: (screen: Point, flow: Point) => void;
  onNodeMenu: (screen: Point, id: string) => void;
  onEdgeMenu: (screen: Point, id: string) => void;
  onApi: (api: CanvasApi) => void;
}

function CanvasFlow(props: FlowCanvasProps): React.ReactElement {
  const flow = useReactFlow();
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const apiSink = React.useRef(props.onApi);
  apiSink.current = props.onApi;

  React.useEffect(() => {
    apiSink.current({
      center: (): Point => {
        const element = wrapRef.current;
        if (element === null) return { x: 0, y: 0 };
        const rect = element.getBoundingClientRect();
        return flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
    });
  }, [flow]);

  const openPaneMenu = (event: React.MouseEvent | MouseEvent): void => {
    event.preventDefault();
    props.onPaneMenu(
      { x: event.clientX, y: event.clientY },
      flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    );
  };

  // deleteKeyCode 置 null：删除交给 page.tsx 统一处理（要同时清 bodies、修入口并记进撤销栈）
  return (
    <div className="wf-flow" ref={wrapRef}>
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={props.onConnect}
        onReconnect={(oldEdge, connection) => props.onReconnect(oldEdge, connection)}
        onNodeClick={(_, node) => props.onSelect(node.id)}
        onPaneClick={() => props.onSelect(null)}
        onNodeDragStart={() => props.onDragNode()}
        onNodeDragStop={() => props.onMoveNode()}
        onPaneContextMenu={openPaneMenu}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          props.onSelect(node.id);
          props.onNodeMenu({ x: event.clientX, y: event.clientY }, node.id);
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          props.onEdgeMenu({ x: event.clientX, y: event.clientY }, edge.id);
        }}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps): React.ReactElement {
  return (
    <div className="wf-canvas">
      <style>{flowCss}</style>
      <style>{editorCss}</style>
      <ReactFlowProvider>
        <CanvasFlow {...props} />
      </ReactFlowProvider>
    </div>
  );
}
