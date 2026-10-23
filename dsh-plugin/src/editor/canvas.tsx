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
  useStore,
  type Connection,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import flowCss from '@xyflow/react/dist/style.css?inline';
import { spreadSourceHandles, typeLabel, type CanvasEdge, type CanvasNode } from './model.js';
import { editorCss } from './styles.js';

/** 点卡片右侧的出口名字 = 开始连一条线（再点目标节点完成），回调由页面给 */
const OutletClickContext = React.createContext<(nodeId: string, outletKey: string) => void>(() => {});

function WfNode({ id, data, selected }: NodeProps<CanvasNode>): React.ReactElement {
  // 没有声明出口的节点（非卡点）：出边数量决定右侧画几个点，一个分支一个
  const outCount = useStore(
    (state) => state.edges.reduce((total, edge) => (edge.source === id ? total + 1 : total), 0),
  );
  // 哪些出口已经连上线了：用字符串订阅，状态没变就不重建
  const wired = useStore((state) =>
    state.edges
      .filter((edge) => edge.source === id && typeof edge.data?.outlet === 'string')
      .map((edge) => edge.data?.outlet)
      .join('|'),
  );
  const onOutletClick = React.useContext(OutletClickContext);
  const declared = data.outlets ?? [];
  const slots: Array<{ key: string; label: string | undefined }> =
    declared.length > 0
      ? declared.map((outlet) => ({ key: outlet.key, label: outlet.label }))
      : Array.from({ length: Math.max(outCount, 1) }, (_, index) => ({ key: String(index), label: undefined }));
  const wiredKeys = new Set(wired === '' ? [] : wired.split('|'));
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
      {slots.map((slot, index) => (
        <React.Fragment key={slot.key}>
          <Handle
            id={`out-${slot.key}`}
            type="source"
            position={Position.Right}
            style={{ top: `${((index + 1) / (slots.length + 1)) * 100}%` }}
          />
          {/* 没连线的出口：名字挂在卡片右侧外面，点它开始连线 */}
          {slot.label !== undefined && !wiredKeys.has(slot.key) && (
            <span
              className="wf-outlet-tag"
              data-node={id}
              data-outlet={slot.key}
              style={{ top: `${((index + 1) / (slots.length + 1)) * 100}%` }}
              title="点击后再点目标节点即可连上；也可以直接从圆点拖线"
              onPointerDown={(event) => {
                // 别让点名字变成拖节点
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onOutletClick(id, slot.key);
              }}
            >
              {slot.label}
            </span>
          )}
        </React.Fragment>
      ))}
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
  /** 把某个节点滚进视野（校验问题定位用） */
  focusNode: (id: string) => void;
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
  /** 点了卡片右侧的出口名字：页面记下来，等下一次点目标节点 */
  onOutletClick: (nodeId: string, outletKey: string) => void;
  onApi: (api: CanvasApi) => void;
}

function CanvasFlow(props: FlowCanvasProps): React.ReactElement {
  const flow = useReactFlow();
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const apiSink = React.useRef(props.onApi);
  apiSink.current = props.onApi;
  // 出边挂到正确的出口：声明了出口的节点（卡点）按 outlet 匹配，其余按顺序 out-0 / out-1 …
  const outletKeys = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of props.nodes) {
      const outlets = node.data.outlets ?? [];
      if (outlets.length > 0) map.set(node.id, outlets.map((outlet) => outlet.key));
    }
    return map;
  }, [props.nodes]);
  const renderedEdges = React.useMemo(
    () => spreadSourceHandles(props.edges, outletKeys),
    [props.edges, outletKeys],
  );

  React.useEffect(() => {
    apiSink.current({
      center: (): Point => {
        const element = wrapRef.current;
        if (element === null) return { x: 0, y: 0 };
        const rect = element.getBoundingClientRect();
        return flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
      focusNode: (id: string): void => {
        void flow.fitView({ nodes: [{ id }], padding: 0.6, duration: 300 });
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
      <OutletClickContext.Provider value={props.onOutletClick}>
        <ReactFlow
          nodes={props.nodes}
          edges={renderedEdges}
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
      </OutletClickContext.Provider>
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
