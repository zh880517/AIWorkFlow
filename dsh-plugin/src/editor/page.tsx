// DSH 内的流程图页面：流程库 ⇄ 画布编辑器。整页跑在宿主 React 里，不嵌 iframe。
import * as React from 'react';
import { addEdge, useEdgesState, useNodesState, type Connection, type EdgeChange } from '@xyflow/react';
import type { AgentDef, Flow, FlowNode, NodeType, SubagentNode } from '@shared/index.js';
import { relTime } from '@shared/index.js';
import { Boundary, reportInfo } from '../diagnostics.js';
import * as api from './api.js';
import { FlowCanvas, type CanvasApi, type Point } from './canvas.js';
import { Inspector } from './inspector.js';
import { ContextMenu, type MenuItem } from './menu.js';
import {
  buildFlow,
  canvasOf,
  detailOf,
  makeNode,
  makeSubflow,
  outletsOf,
  subflowPreview,
  PALETTE,
  typeLabel,
  type CanvasEdge,
  type CanvasNode,
} from './model.js';
import { editorCss } from './styles.js';

export interface WorkflowPageProps {
  /** 回到会话面板（ctx.layout.selectPanel(null)） */
  onExit?: () => void;
}

const PAGE_STYLE: React.CSSProperties = {
  // 不在样式表里兜底颜色：万一 token 作用域异常，页面也不会「同色隐身」
  background: 'var(--dsw-alias-bg-base, Canvas)',
  color: 'var(--dsw-alias-label-primary, CanvasText)',
  minHeight: 420,
  height: '100%',
  overflow: 'auto',
};

const HISTORY_LIMIT = 50;
/** 同一个输入框连续敲字合并成一步撤销 */
const MERGE_WINDOW_MS = 900;
/** 右侧属性面板宽度：拖动分隔条调整，双击复位 */
const INSPECTOR_MIN = 240;
const INSPECTOR_MAX = 640;
const INSPECTOR_DEFAULT = 312;
/** 拖到最宽时也要给画布留出的最小宽度 */
const CANVAS_MIN = 280;
const INSPECTOR_WIDTH_KEY = 'aiworkflow.editor.inspectorWidth';

function clampInspectorWidth(value: number, max = INSPECTOR_MAX): number {
  return Math.min(Math.max(INSPECTOR_MIN, Math.round(value)), Math.max(INSPECTOR_MIN, max));
}

function readInspectorWidth(): number {
  try {
    const raw = window.localStorage.getItem(INSPECTOR_WIDTH_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? clampInspectorWidth(value) : INSPECTOR_DEFAULT;
  } catch {
    return INSPECTOR_DEFAULT;
  }
}

export function WorkflowPage({ onExit }: WorkflowPageProps = {}): React.ReactElement {
  const [flows, setFlows] = React.useState<api.FlowMeta[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<Flow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<void> => {
    setError(null);
    try {
      setFlows(await api.listFlows());
    } catch (cause) {
      setError(errorText(cause));
      setFlows([]);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    // 挂载确认：页面若没渲染出来，这条也不会出现
    reportInfo('可视化工作流页已挂载');
  }, []);

  const open = async (id: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setDoc(await api.getFlow(id));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const create = (): void => {
    const start = makeNode('prompt', 'n1');
    start.title = '开始';
    setDoc({
      id: `flow-${Date.now().toString(36)}`,
      name: '未命名流程',
      entry: 'n1',
      nodes: [start, makeNode('end', 'n2')],
      _ui: { positions: { n1: { x: 80, y: 120 }, n2: { x: 420, y: 120 } } },
    });
  };

  const remove = async (id: string, label: string): Promise<void> => {
    if (!window.confirm(`删除流程「${label}」（${id}）？删除后不可恢复。`)) return;
    try {
      await api.deleteFlow(id);
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  if (doc !== null) {
    return (
      <Editor
        key={doc.id}
        initial={doc}
        flows={flows ?? []}
        onExit={onExit}
        onBack={() => {
          setDoc(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="wf-page" style={PAGE_STYLE}>
      <style>{editorCss}</style>
      <header className="wf-head">
        <span className="wf-title">可视化工作流</span>
        <span className="wf-sub">{flows === null ? '加载中…' : `${flows.length} 张图`}</span>
        <span className="wf-spacer" />
        <button type="button" className="wf-btn" onClick={() => void refresh()} disabled={busy}>
          刷新
        </button>
        <button type="button" className="wf-btn" data-primary="true" onClick={create}>
          新建流程
        </button>
        {onExit !== undefined && (
          <button type="button" className="wf-btn" onClick={onExit}>
            返回会话
          </button>
        )}
      </header>
      {error !== null && (
        <div className="wf-banner" data-kind="error">
          {error}
        </div>
      )}
      <div className="wf-list">
        {flows !== null && flows.length === 0 && (
          <div className="wf-empty">
            <b>还没有工作流</b>
            <span>新建一张，从「指令 → 结束」开始。</span>
          </div>
        )}
        {(flows ?? []).map((flow) => (
          <div className="wf-item" key={flow.id} onClick={() => void open(flow.id)} role="button" tabIndex={0}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wf-item-name">{flow.name}</div>
              <div className="wf-item-meta">
                {flow.id} · {relTime(flow.updatedAt)}
              </div>
            </div>
            <button
              type="button"
              className="wf-btn"
              onClick={(event) => {
                event.stopPropagation();
                void remove(flow.id, flow.name);
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EditorProps {
  initial: Flow;
  /** 流程库列表：flowRef 下拉用（不含当前图） */
  flows: api.FlowMeta[];
  onBack: () => void;
  onExit?: () => void;
}

interface Snapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  bodies: Record<string, FlowNode>;
  agents: AgentDef[];
  entry: string;
  name: string;
}

/** 进入内嵌子图时压栈：父图快照 + 父节点 id，返回时把子图写回父节点 */
interface SubflowFrame {
  parentNodeId: string;
  title: string;
  snapshot: Snapshot;
  base: Flow;
  /** 进入子图前的撤销栈；返回时恢复，子图自己的历史不跨层 */
  history: { past: Snapshot[]; future: Snapshot[] };
}

interface ClipboardEntry {
  body: FlowNode;
  title: string;
}

type MenuState =
  | { kind: 'pane'; x: number; y: number; at: Point }
  | { kind: 'node'; x: number; y: number; id: string }
  | { kind: 'edge'; x: number; y: number; id: string };

function Editor({ initial, flows, onBack, onExit }: EditorProps): React.ReactElement {
  const seed = React.useMemo(() => canvasOf(initial), [initial]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(seed.edges);
  const [bodies, setBodies] = React.useState<Record<string, FlowNode>>(() =>
    Object.fromEntries(initial.nodes.map((node) => [node.id, node])),
  );
  const [agents, setAgents] = React.useState<AgentDef[]>(initial.agents ?? []);
  const [name, setName] = React.useState(initial.name);
  const [entry, setEntry] = React.useState(initial.entry);
  const [dirty, setDirty] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const [clipboard, setClipboard] = React.useState<ClipboardEntry | null>(null);
  const [history, setHistory] = React.useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  /** 干跑校验结果（防抖 350ms，与保存共用同一个校验器） */
  const [validation, setValidation] = React.useState<api.ValidationResult | null>(null);
  const [valOpen, setValOpen] = React.useState(false);
  /** 历史 run 学到的 payload 字段名（插值提示用） */
  const [payloadFields, setPayloadFields] = React.useState<Record<string, string[]>>({});
  /** 右侧属性面板宽度：可拖动分隔条调整，记到 localStorage */
  const [inspectorWidth, setInspectorWidth] = React.useState<number>(readInspectorWidth);
  const [resizing, setResizing] = React.useState(false);
  /** 点出口名字后待连线的来源：再点一个目标节点就把它连上 */
  const [pendingLink, setPendingLink] = React.useState<{ nodeId: string; outletKey: string } | null>(null);
  /** 内嵌子图编辑栈：空 = 主图，非空 = 正在编辑最内层子图 */
  const [frames, setFrames] = React.useState<SubflowFrame[]>([]);

  const pageRef = React.useRef<HTMLDivElement | null>(null);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  /** 拖动分隔条时的起点，避免每帧读 state */
  const resizeRef = React.useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);
  const baseRef = React.useRef<Flow>(initial);
  const canvasApiRef = React.useRef<CanvasApi | null>(null);
  const clipboardRef = React.useRef<ClipboardEntry | null>(null);
  const addSeq = React.useRef(0);
  /** 本次会话已经发过的 id：连续点击 / 撤销后再删时不会把同一个 id 发两次 */
  const issuedRef = React.useRef<Set<string>>(new Set());
  /** 同一个 mergeKey 的连续编辑只压一次历史 */
  const mergeRef = React.useRef<{ key: string; at: number } | null>(null);
  const historyRef = React.useRef(history);
  const selectedRef = React.useRef<string | null>(null);
  const saveRef = React.useRef<(() => void) | null>(null);
  /** frames 的同步副本：composeRoot 等事件处理里立刻要读，不等下一次 render */
  const framesRef = React.useRef<SubflowFrame[]>([]);
  // 事件处理器一律读这里：避免把 nodes/edges/bodies 全部塞进每个 useCallback 的依赖
  const liveRef = React.useRef<Snapshot>({
    nodes: seed.nodes,
    edges: seed.edges,
    bodies,
    agents,
    entry: initial.entry,
    name: initial.name,
  });

  liveRef.current = { nodes, edges, bodies, agents, entry, name };
  historyRef.current = history;
  selectedRef.current = selectedId;
  clipboardRef.current = clipboard;
  framesRef.current = frames;

  const record = React.useCallback((mergeKey?: string): void => {
    const now = Date.now();
    const last = mergeRef.current;
    if (mergeKey !== undefined && last !== null && last.key === mergeKey && now - last.at < MERGE_WINDOW_MS) {
      last.at = now;
      return;
    }
    mergeRef.current = mergeKey === undefined ? null : { key: mergeKey, at: now };
    setHistory((current) => ({ past: [...current.past.slice(-(HISTORY_LIMIT - 1)), liveRef.current], future: [] }));
    setDirty(true);
  }, []);

  const restore = React.useCallback(
    (snapshot: Snapshot): void => {
      setNodes(withEntryFlags(snapshot.nodes, snapshot.entry));
      setEdges(snapshot.edges);
      setBodies(snapshot.bodies);
      setAgents(snapshot.agents);
      setEntry(snapshot.entry);
      setName(snapshot.name);
      setSelectedId((current) =>
        current !== null && snapshot.nodes.some((node) => node.id === current) ? current : null,
      );
      mergeRef.current = null;
      setDirty(true);
    },
    [setNodes, setEdges],
  );

  /** 切换当前编辑的画布（主图 / 子图）：整份状态换掉，不走进度历史 */
  const loadGraph = React.useCallback(
    (flow: Flow): void => {
      const canvas = canvasOf(flow);
      setNodes(withEntryFlags(canvas.nodes, flow.entry));
      setEdges(canvas.edges);
      setBodies(Object.fromEntries(flow.nodes.map((node) => [node.id, node])));
      setAgents(flow.agents ?? []);
      setName(flow.name);
      setEntry(flow.entry);
      setSelectedId(null);
      setPendingLink(null);
      setHistory({ past: [], future: [] });
      setValidation(null);
      mergeRef.current = null;
      baseRef.current = flow;
      // 等 ReactFlow 收到新 nodes/edges 后再 fit，否则量的还是上一张图
      window.setTimeout(() => canvasApiRef.current?.fitAll?.(), 40);
    },
    [setNodes, setEdges],
  );

  /** 把当前正在编辑的层（可能是最内层子图）折回主图，得到可保存/校验的根 Flow */
  const composeRoot = React.useCallback((): Flow => {
    const snapshot = liveRef.current;
    let flow = buildFlow(
      { ...baseRef.current, name: snapshot.name, entry: snapshot.entry, agents: snapshot.agents },
      snapshot.bodies,
      snapshot.nodes,
      snapshot.edges,
    );
    const stack = framesRef.current;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      const frame = stack[index];
      if (frame === undefined) throw new Error('子图栈损坏：帧缺失');
      const owner = frame.snapshot.bodies[frame.parentNodeId];
      if (owner === undefined || owner.type !== 'subagent') {
        throw new Error(`子图栈损坏：父节点 ${frame.parentNodeId} 不是 subagent`);
      }
      const subagent: SubagentNode = owner;
      const updated: SubagentNode = {
        ...subagent,
        mode: 'subflow',
        subflow: {
          name: flow.name,
          entry: flow.entry,
          maxSteps: subagent.subflow?.maxSteps,
          nodes: flow.nodes,
          _ui: flow._ui,
        },
      };
      const parentSnapshot: Snapshot = {
        ...frame.snapshot,
        bodies: { ...frame.snapshot.bodies, [frame.parentNodeId]: updated },
      };
      flow = buildFlow(
        { ...frame.base, name: parentSnapshot.name, entry: parentSnapshot.entry, agents: parentSnapshot.agents },
        parentSnapshot.bodies,
        parentSnapshot.nodes,
        parentSnapshot.edges,
      );
    }
    return flow;
  }, []);

  /** 进入某个 subagent 节点的内嵌子图；没有子图时先建一张最小合法子图 */
  const openSubflow = React.useCallback(
    (nodeId: string): void => {
      const snapshot = liveRef.current;
      const body = snapshot.bodies[nodeId];
      if (body === undefined || body.type !== 'subagent') return;
      const created = body.subflow === undefined;
      const subagent: SubagentNode = created
        ? { ...body, mode: 'subflow', subflow: makeSubflow(`${body.title?.trim() || body.id} 子图`) }
        : { ...body, mode: 'subflow' };
      const sub = subagent.subflow;
      if (sub === undefined) return;
      const nextBodies = { ...snapshot.bodies, [nodeId]: subagent };
      const nextSnapshot: Snapshot = { ...snapshot, bodies: nextBodies };
      const subFlow: Flow = {
        id: `${baseRef.current.id}::${nodeId}`,
        name: sub.name ?? `${body.title?.trim() || nodeId} 子图`,
        entry: sub.entry,
        maxSteps: sub.maxSteps,
        nodes: sub.nodes,
        agents: snapshot.agents,
        _ui: sub._ui,
      };
      const frame: SubflowFrame = {
        parentNodeId: nodeId,
        title: body.title?.trim() || nodeId,
        snapshot: nextSnapshot,
        base: baseRef.current,
        history: historyRef.current,
      };
      const nextFrames = [...framesRef.current, frame];
      framesRef.current = nextFrames;
      setFrames(nextFrames);
      loadGraph(subFlow);
      if (created) setDirty(true);
    },
    [loadGraph],
  );

  /** 从当前子图返回上一层：把子图写回父节点的 subflow，再恢复父图状态 */
  const backToParent = React.useCallback((): void => {
    const frame = framesRef.current[framesRef.current.length - 1];
    if (frame === undefined) return;
    const snapshot = liveRef.current;
    const built = buildFlow(
      { ...baseRef.current, name: snapshot.name, entry: snapshot.entry, agents: snapshot.agents },
      snapshot.bodies,
      snapshot.nodes,
      snapshot.edges,
    );
    const owner = frame.snapshot.bodies[frame.parentNodeId];
    if (owner === undefined || owner.type !== 'subagent') return;
    const subagent: SubagentNode = {
      ...owner,
      mode: 'subflow',
      subflow: {
        name: built.name,
        entry: built.entry,
        maxSteps: owner.subflow?.maxSteps,
        nodes: built.nodes,
        _ui: built._ui,
      },
    };
    const nextBodies = { ...frame.snapshot.bodies, [frame.parentNodeId]: subagent };
    const parentFlow = buildFlow(
      { ...frame.base, name: frame.snapshot.name, entry: frame.snapshot.entry, agents: frame.snapshot.agents },
      nextBodies,
      frame.snapshot.nodes,
      frame.snapshot.edges,
    );
    const nextFrames = framesRef.current.slice(0, -1);
    framesRef.current = nextFrames;
    setFrames(nextFrames);
    loadGraph(parentFlow);
    // loadGraph 会清空历史；返回父层时把进入前的撤销栈还回去
    setHistory(frame.history);
    setDirty(true);
  }, [loadGraph]);

  const undo = React.useCallback((): void => {
    const { past, future } = historyRef.current;
    const previous = past[past.length - 1];
    if (previous === undefined) return;
    setHistory({ past: past.slice(0, -1), future: [liveRef.current, ...future].slice(0, HISTORY_LIMIT) });
    restore(previous);
  }, [restore]);

  const redo = React.useCallback((): void => {
    const { past, future } = historyRef.current;
    const next = future[0];
    if (next === undefined) return;
    setHistory({ past: [...past.slice(-(HISTORY_LIMIT - 1)), liveRef.current], future: future.slice(1) });
    restore(next);
  }, [restore]);

  /** 删节点/删边一次算完：bodies、入口、选中一起收拾，只写一次历史 */
  const removeGraph = React.useCallback(
    (nodeIds: string[], edgeIds: string[]): void => {
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      const deadNodes = new Set(nodeIds);
      const deadEdges = new Set(edgeIds);
      const snapshot = liveRef.current;
      const keptNodes = snapshot.nodes.filter((node) => !deadNodes.has(node.id));
      const keptEdges = snapshot.edges.filter(
        (edge) => !deadEdges.has(edge.id) && !deadNodes.has(edge.source) && !deadNodes.has(edge.target),
      );
      const nextBodies: Record<string, FlowNode> = {};
      for (const [id, body] of Object.entries(snapshot.bodies)) {
        if (!deadNodes.has(id)) nextBodies[id] = body;
      }
      const nextEntry = deadNodes.has(snapshot.entry) ? (keptNodes[0]?.id ?? '') : snapshot.entry;
      setNodes(withEntryFlags(keptNodes, nextEntry));
      setEdges(keptEdges);
      setBodies(nextBodies);
      setEntry(nextEntry);
      setSelectedId((current) => (current !== null && deadNodes.has(current) ? null : current));
      mergeRef.current = null;
      setDirty(true);
    },
    [setNodes, setEdges],
  );

  const deleteSelected = React.useCallback((): void => {
    const snapshot = liveRef.current;
    const nodeIds = snapshot.nodes.filter((node) => node.selected === true).map((node) => node.id);
    const deadNodes = new Set(nodeIds);
    const edgeIds = snapshot.edges
      .filter((edge) => edge.selected === true && !deadNodes.has(edge.source) && !deadNodes.has(edge.target))
      .map((edge) => edge.id);
    if (nodeIds.length === 0 && edgeIds.length === 0) return;
    record();
    removeGraph(nodeIds, edgeIds);
  }, [record, removeGraph]);

  const deleteNodeById = React.useCallback(
    (id: string): void => {
      if (!liveRef.current.nodes.some((node) => node.id === id)) return;
      record();
      removeGraph([id], []);
    },
    [record, removeGraph],
  );

  const deleteEdgeById = React.useCallback(
    (id: string): void => {
      if (!liveRef.current.edges.some((edge) => edge.id === id)) return;
      record();
      removeGraph([], [id]);
    },
    [record, removeGraph],
  );

  const setEntryId = React.useCallback(
    (id: string): void => {
      record();
      setEntry(id);
      setNodes((all) => withEntryFlags(all, id));
    },
    [record, setNodes],
  );

  const placePoint = React.useCallback((at?: Point): Point => {
    if (at !== undefined) return { x: Math.round(at.x), y: Math.round(at.y) };
    const center = canvasApiRef.current?.center() ?? { x: 140, y: 140 };
    // 连续添加时错开一点，避免新节点完全叠在上一颗上
    const step = addSeq.current % 6;
    addSeq.current += 1;
    return { x: Math.round(center.x - 70 + step * 22), y: Math.round(center.y - 28 + step * 20) };
  }, []);

  const insertNode = React.useCallback(
    (body: FlowNode, title: string, at?: Point): void => {
      const id = body.id;
      const position = placePoint(at);
      setBodies((all) => ({ ...all, [id]: body }));
      setNodes((all) => [
        ...all.map((node) => (node.selected === true ? { ...node, selected: false } : node)),
        {
          id,
          type: 'wf',
          position,
          selected: true,
          data: { title, kind: body.type, detail: detailOf(body), isEntry: false, outlets: outletsOf(body) },
        },
      ]);
      setSelectedId(id);
      setDirty(true);
    },
    [placePoint, setNodes],
  );

  const addNode = React.useCallback(
    (type: NodeType, at?: Point): void => {
      record();
      const id = nextNodeId(liveRef.current.nodes, issuedRef.current);
      issuedRef.current.add(id);
      const body = makeNode(type, id);
      insertNode(body, body.title ?? typeLabel(type), at);
    },
    [record, insertNode],
  );

  const copyNode = React.useCallback((id: string | null): void => {
    if (id === null) return;
    const snapshot = liveRef.current;
    const body = snapshot.bodies[id];
    if (body === undefined) return;
    const node = snapshot.nodes.find((item) => item.id === id);
    const copy: FlowNode = { ...body };
    // 出口由画布上的连线重建，复制品不该带着原节点的 next/branches
    delete copy.next;
    delete copy.branches;
    const title = node?.data.title ?? body.title ?? id;
    setClipboard({ body: copy, title });
    reportInfo(`已复制节点「${title}」`);
  }, []);

  const pasteNode = React.useCallback(
    (at?: Point): void => {
      const item = clipboardRef.current;
      if (item === null) return;
      record();
      const id = nextNodeId(liveRef.current.nodes, issuedRef.current);
      issuedRef.current.add(id);
      const body: FlowNode = { ...item.body, id };
      insertNode(body, item.title, at);
    },
    [record, insertNode],
  );

  /** 从卡点出口拖出来的线：带上 outlet，保存时才知道这条分支属于哪个选项 */
  const outletOfConnection = (
    source: string,
    sourceHandle: string | null,
    snapshot: { nodes: CanvasNode[] },
  ): { key: string; label: string } | undefined => {
    if (sourceHandle === null) return undefined;
    const node = snapshot.nodes.find((item) => item.id === source);
    return (node?.data.outlets ?? []).find((outlet) => `out-${outlet.key}` === sourceHandle);
  };

  const onConnect = React.useCallback(
    (connection: Connection): void => {
      if (connection.source === null || connection.target === null) return;
      const snapshot = liveRef.current;
      if (!snapshot.nodes.some((node) => node.id === connection.target)) return;
      // 入口不能有入线（canvas 已经把入口的 target handle 藏了，这里是兜底）
      if (connection.target === snapshot.entry) {
        reportInfo('入口节点不能有入线：先把别的节点设为入口');
        return;
      }
      // 同一条有向边不重复连：重复边在 DSL 里会变成同 to 的重复分支
      if (snapshot.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return;
      const outlet = outletOfConnection(connection.source, connection.sourceHandle, snapshot);
      // 卡点一个出口只连一条：否则人工选中这个选项时不知道该走哪条
      if (
        outlet !== undefined &&
        snapshot.edges.some((edge) => edge.source === connection.source && edge.data?.outlet === outlet.key)
      ) {
        reportInfo(`出口「${outlet.label}」已经连了别的节点：先删掉那条线，或从别的出口连`);
        return;
      }
      record();
      setEdges((current) =>
        addEdge<CanvasEdge>(
          {
            id: newEdgeId(),
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            ...(outlet !== undefined ? { label: outlet.label, data: { outlet: outlet.key } } : { data: {} }),
          },
          current,
        ),
      );
      setDirty(true);
    },
    [record, setEdges],
  );

  /** 拖动已有连线的端点改指向：保留边上的条件/出口绑定，只换 source/target */
  const onReconnect = React.useCallback(
    (oldEdge: CanvasEdge, connection: Connection): void => {
      const source = connection.source;
      const target = connection.target;
      if (source === null || target === null) return;
      const snapshot = liveRef.current;
      if (target === snapshot.entry) {
        reportInfo('入口节点不能有入线：先把别的节点设为入口');
        return;
      }
      if (snapshot.edges.some((edge) => edge.id !== oldEdge.id && edge.source === source && edge.target === target)) {
        reportInfo('这两个节点之间已经有这条连线了');
        return;
      }
      record();
      setEdges((all) =>
        all.map((edge) => {
          if (edge.id !== oldEdge.id) return edge;
          // 从哪个出口拖出来就归哪个选项；换成别的节点的入口就清掉 outlet
          const outlet = outletOfConnection(source, connection.sourceHandle, snapshot);
          const data = { ...(edge.data ?? {}) };
          if (outlet !== undefined) data.outlet = outlet.key;
          else delete data.outlet;
          return {
            ...edge,
            source,
            target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            ...(outlet !== undefined ? { label: outlet.label } : {}),
            data,
          };
        }),
      );
      setDirty(true);
    },
    [record, setEdges],
  );

  const handleEdgesChange = React.useCallback(
    (changes: EdgeChange<CanvasEdge>[]): void => {
      // 只有增删边才算改动；点选/取消选中也会走这里，别把它当成「未保存」
      const removing = changes.some((change) => change.type === 'remove');
      const mutating = changes.some((change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace');
      if (removing) record();
      onEdgesChange(changes);
      if (mutating) setDirty(true);
    },
    [onEdgesChange, record],
  );

  const patchNode = (patch: Record<string, unknown>): void => {
    if (selectedId === null) return;
    const current = bodies[selectedId];
    if (current === undefined) return;
    record(`patch:${selectedId}:${Object.keys(patch).join(',')}`);
    const next = { ...current, ...patch } as FlowNode;
    setBodies((all) => ({ ...all, [selectedId]: next }));
    // 卡点选项变了：改文案同步出边标签，删选项连带删掉它的出边（不留无主的线）
    if (current.type === 'gate' && Array.isArray(patch.options)) {
      const labels = new Map(
        (patch.options as Array<{ id: string; label: string }>).map((entry) => [entry.id, entry.label]),
      );
      setEdges((all) => {
        let changed = false;
        const kept: CanvasEdge[] = [];
        for (const edge of all) {
          const outlet = edge.source === selectedId ? edge.data?.outlet : undefined;
          if (outlet === undefined) {
            kept.push(edge);
            continue;
          }
          const label = labels.get(outlet);
          if (label === undefined) {
            changed = true;
            continue;
          }
          if (edge.label === label) {
            kept.push(edge);
            continue;
          }
          changed = true;
          kept.push({ ...edge, label });
        }
        return changed ? kept : all;
      });
    }
    setNodes((all) =>
      all.map((node) =>
        node.id === selectedId
          ? {
              ...node,
              data: {
                ...node.data,
                title: typeof patch.title === 'string' ? patch.title : node.data.title,
                detail: detailOf(next),
                // 卡点的出口 = 选项：选项增删改要立刻反映到卡片右侧
                outlets: outletsOf(next),
                subflow:
                  next.type === 'subagent' && next.mode === 'subflow' && next.subflow !== undefined
                    ? subflowPreview(next.subflow)
                    : undefined,
              },
            }
          : node,
      ),
    );
    setDirty(true);
  };

  const deleteNode = (): void => {
    if (selectedId === null) return;
    deleteNodeById(selectedId);
  };

  const setCondition = (edgeId: string, value: string): void => {
    record(`condition:${edgeId}`);
    setEdges((all) =>
      all.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label: value === '' ? '条件' : value === '*' ? '默认' : value,
              data: { ...(edge.data ?? {}), condition: value },
            }
          : edge,
      ),
    );
    setDirty(true);
  };

  const setWhen = (edgeId: string, value: string): void => {
    record(`when:${edgeId}`);
    const when = value.trim() === '' ? undefined : value;
    setEdges((all) =>
      all.map((edge) =>
        edge.id === edgeId ? { ...edge, data: { ...(edge.data ?? {}), when } } : edge,
      ),
    );
    setDirty(true);
  };

  /** 角色表改动：整体替换，撤销栈里也存一份 */
  const changeAgents = (next: AgentDef[]): void => {
    record('agents');
    setAgents(next);
    setDirty(true);
  };


  /** 点了卡片右侧的出口名字：记下来，下一次点目标节点就把它连上（鼠标也可以直接从圆点拖） */
  const startOutletLink = (nodeId: string, outletKey: string): void => {
    setPendingLink((current) =>
      current !== null && current.nodeId === nodeId && current.outletKey === outletKey ? null : { nodeId, outletKey },
    );
  };

  const completeOutletLink = (targetId: string): void => {
    const pending = pendingLink;
    if (pending === null) return;
    setPendingLink(null);
    const { nodeId, outletKey } = pending;
    if (targetId === nodeId) return;
    const sourceNode = nodes.find((node) => node.id === nodeId);
    const outlet = (sourceNode?.data.outlets ?? []).find((item) => item.key === outletKey);
    if (outlet === undefined) return;
    if (targetId === entry) {
      reportInfo('入口节点不能有入线：先把别的节点设为入口');
      return;
    }
    if (edges.some((edge) => edge.source === nodeId && edge.data?.outlet === outletKey)) {
      reportInfo(`出口「${outlet.label}」已经连了别的节点：先删掉那条线，或从别的出口连`);
      return;
    }
    if (edges.some((edge) => edge.source === nodeId && edge.target === targetId)) {
      reportInfo('这两个节点之间已经有这条连线了');
      return;
    }
    record(`connect:${nodeId}:${outletKey}`);
    setEdges((all) =>
      addEdge<CanvasEdge>(
        {
          id: newEdgeId(),
          source: nodeId,
          target: targetId,
          sourceHandle: `out-${outletKey}`,
          label: outlet.label,
          data: { outlet: outletKey },
        },
        all,
      ),
    );
    setDirty(true);
  };

  const rename = (value: string): void => {
    record('flow-name');
    setName(value);
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const page = pageRef.current;
      const active = document.activeElement;
      if (page !== null && active !== null && active !== document.body && !page.contains(active)) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // Ctrl+S 在页面任何地方都先拦下来（浏览器默认是保存网页）
      if (mod && key === 's') {
        event.preventDefault();
        saveRef.current?.();
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return; // 输入框里让浏览器自己处理撤销/复制
      }

      if (event.key === 'Escape') {
        // 依次收起：待连线 → 校验浮层 → 右键菜单 → 取消选中
        if (pendingLink !== null) {
          setPendingLink(null);
          return;
        }
        setValOpen(false);
        setMenu(null);
        setSelectedId(null);
        return;
      }

      if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (!mod) return;
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (key === 'c') {
        if ((window.getSelection()?.toString() ?? '') !== '') return;
        event.preventDefault();
        copyNode(selectedRef.current);
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        pasteNode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, redo, undo, copyNode, pasteNode, pendingLink]);

  const handleApi = React.useCallback((next: CanvasApi): void => {
    canvasApiRef.current = next;
  }, []);

  React.useEffect(() => {
    let alive = true;
    void api
      .payloadFields(initial.id)
      .then((fields) => {
        if (alive) setPayloadFields(fields);
      })
      .catch(() => {
        // 插值提示是可选增强：图还没跑过 / 读不到历史都正常
      });
    return () => {
      alive = false;
    };
  }, [initial.id]);

  // 实时校验：防抖 350ms 走 Host 的干跑接口，不落库；保存仍以服务端结果为准
  React.useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      let flow: Flow;
      try {
        flow = composeRoot();
      } catch {
        return;
      }
      void api
        .validateFlow(flow)
        .then((result) => {
          if (alive) setValidation(result);
        })
        .catch(() => {
          // 接口不可用时不阻塞编辑；保存会再校验一次
        });
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [nodes, edges, bodies, agents, entry, name, frames.length]);

  const save = async (): Promise<void> => {
    setBusy(true);
    setBanner(null);
    try {
      const flow = composeRoot();
      const result = await api.saveFlow(flow);
      if (result.ok) {
        const nextFrames: SubflowFrame[] = [];
        framesRef.current = nextFrames;
        setFrames(nextFrames);
        loadGraph(result.flow);
        setDirty(false);
        setBanner({
          kind: 'ok',
          lines: result.warnings.length > 0 ? ['已保存（有警告）', ...result.warnings.map((item) => item.message)] : ['已保存'],
        });
      } else {
        setBanner({
          kind: 'error',
          lines: result.errors.length > 0 ? result.errors.map((item) => item.message) : ['校验未通过'],
        });
      }
    } catch (cause) {
      setBanner({ kind: 'error', lines: [errorText(cause)] });
    } finally {
      setBusy(false);
    }
  };

  const selected = selectedId === null ? undefined : bodies[selectedId];
  const selectedCanvas = nodes.find((node) => node.id === selectedId);
  const selectedEdges = edges.filter((edge) => edge.source === selectedId);

  const validationChip =
    validation === null
      ? null
      : !validation.ok
        ? { kind: 'error' as const, text: `✕ ${validation.errors.length} 处硬拒` }
        : validation.warnings.length > 0
          ? { kind: 'warn' as const, text: `⚠ ${validation.warnings.length} 条警告` }
          : { kind: 'ok' as const, text: '✓ 校验通过' };

  const jumpToNode = (nodeId: string | undefined): void => {
    if (nodeId === undefined) return;
    setSelectedId(nodeId);
    canvasApiRef.current?.focusNode?.(nodeId);
    setValOpen(false);
  };

  saveRef.current = () => {
    void save();
  };

  const confirmLeave = (): boolean =>
    !dirty || window.confirm('有未保存的改动，离开会丢失。确定离开？');

  React.useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(inspectorWidth));
    } catch {
      // 隐私模式 / 存储被禁用时忽略：只影响下次打开时的宽度记忆
    }
  }, [inspectorWidth]);

  /** 面板最宽：画布至少留 CANVAS_MIN（再扣掉分隔条本身的宽度） */
  const maxInspectorWidth = (): number => {
    const total = bodyRef.current?.clientWidth ?? 0;
    return total > 0 ? Math.min(INSPECTOR_MAX, total - CANVAS_MIN - 8) : INSPECTOR_MAX;
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { startX: event.clientX, startWidth: inspectorWidth, pointerId: event.pointerId };
    setResizing(true);
    // 拖出分隔条后也保持「改宽度」的手感，并避免顺手选中页面文字
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = resizeRef.current;
    if (drag === null) return;
    // 分隔条往左拖 = 面板变宽
    setInspectorWidth(clampInspectorWidth(drag.startWidth + (drag.startX - event.clientX), maxInspectorWidth()));
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = resizeRef.current;
    if (drag === null) return;
    resizeRef.current = null;
    setResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    } catch {
      // 指针已经释放
    }
  };

  // 拖动中途被卸载时把 body 上的临时样式还回去
  React.useEffect(
    () => () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },
    [],
  );

  const onSplitterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setInspectorWidth((width) => clampInspectorWidth(width + step, maxInspectorWidth()));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setInspectorWidth((width) => clampInspectorWidth(width - step, maxInspectorWidth()));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setInspectorWidth(INSPECTOR_DEFAULT);
    }
  };

  const menuItems = React.useMemo<MenuItem[]>(() => {
    if (menu === null) return [];
    if (menu.kind === 'pane') {
      const at = menu.at;
      return [
        {
          id: 'create',
          label: '新建节点',
          children: PALETTE.map((item) => ({
            id: `add-${item.type}`,
            label: item.label,
            onSelect: () => addNode(item.type, at),
          })),
        },
        {
          id: 'paste',
          label: '粘贴节点',
          hint: clipboard === null ? '剪贴板为空' : 'Ctrl+V',
          disabled: clipboard === null,
          onSelect: () => pasteNode(at),
        },
      ];
    }
    if (menu.kind === 'node') {
      const id = menu.id;
      return [
        { id: 'copy', label: '复制节点', hint: 'Ctrl+C', onSelect: () => copyNode(id) },
        {
          id: 'paste',
          label: '粘贴节点',
          hint: clipboard === null ? '剪贴板为空' : 'Ctrl+V',
          disabled: clipboard === null,
          onSelect: () => pasteNode(),
        },
        { id: 'entry', label: '设为入口', disabled: entry === id, onSelect: () => setEntryId(id) },
        { id: 'delete', label: '删除节点', hint: 'Delete', danger: true, onSelect: () => deleteNodeById(id) },
      ];
    }
    const edgeId = menu.id;
    return [
      { id: 'delete-edge', label: '删除连线', hint: 'Delete', danger: true, onSelect: () => deleteEdgeById(edgeId) },
    ];
  }, [menu, clipboard, entry, addNode, pasteNode, copyNode, setEntryId, deleteNodeById, deleteEdgeById]);

  return (
    <div className="wf-page" style={PAGE_STYLE} ref={pageRef}>
      <style>{editorCss}</style>
      <header className="wf-head">
        <button
          type="button"
          className="wf-btn"
          onClick={() => {
            if (frames.length > 0) {
              backToParent();
              return;
            }
            if (confirmLeave()) onBack();
          }}
          title={frames.length > 0 ? '返回上一层子图（当前子图会写回父节点）' : '返回流程库（有未保存改动会先确认）'}
        >
          {frames.length > 0 ? (frames.length > 1 ? '← 返回上层' : '← 返回主图') : '← 流程库'}
        </button>
        <input
          className="wf-input"
          style={{ width: 200 }}
          value={name}
          onChange={(event) => rename(event.target.value)}
        />
        {frames.length > 0 && (
          <span className="wf-crumb" title={['主图', ...frames.map((frame) => frame.title), name].join(' / ')}>
            主图
            {frames.map((frame) => (
              <React.Fragment key={frame.parentNodeId}>
                <span>/</span>
                <b>{frame.title}</b>
              </React.Fragment>
            ))}
            <span>/</span>
            <b>{name}</b>
          </span>
        )}
        <span className="wf-sub">{dirty ? '未保存' : '已同步'}</span>
        {validationChip !== null && (
          <button
            type="button"
            className="wf-btn"
            data-tone={validationChip.kind}
            onClick={() => setValOpen((open) => !open)}
            title="校验结果（与保存同一个校验器；点条目可定位节点）"
          >
            {validationChip.text}
          </button>
        )}
        <button
          type="button"
          className="wf-btn"
          onClick={undo}
          disabled={history.past.length === 0}
          title="撤销（Ctrl+Z）"
        >
          撤销
        </button>
        <button
          type="button"
          className="wf-btn"
          onClick={redo}
          disabled={history.future.length === 0}
          title="重做（Ctrl+Shift+Z / Ctrl+Y）"
        >
          重做
        </button>
        <span className="wf-spacer" />
        <span className="wf-sub">入口：{bodies[entry]?.title ?? entry}</span>
        <button type="button" className="wf-btn" data-primary="true" onClick={() => void save()} disabled={busy}>
          {busy ? '保存中…' : '保存'}
        </button>
        {onExit !== undefined && (
          <button
            type="button"
            className="wf-btn"
            onClick={() => {
              if (confirmLeave()) onExit();
            }}
          >
            返回会话
          </button>
        )}
      </header>
      {valOpen && validation !== null && (
        <div className="wf-val-pop" role="dialog" aria-label="校验结果">
          <div className="wf-val-head">校验结果（与保存同一个 validateFlow）</div>
          {validation.errors.length === 0 && validation.warnings.length === 0 && (
            <div className="wf-hint">没有发现问题，可以保存。</div>
          )}
          {[...validation.errors, ...validation.warnings].map((issue, index) => (
            <button
              type="button"
              key={`${issue.code}-${index}`}
              className="wf-val-item"
              data-kind={issue.severity}
              disabled={issue.nodeId === undefined}
              title={issue.nodeId === undefined ? '这条问题没有关联节点' : `定位到 ${issue.nodeId}`}
              onClick={() => jumpToNode(issue.nodeId)}
            >
              <span className="wf-val-code">{issue.code}</span>
              <span className="wf-val-msg">{issue.message}</span>
            </button>
          ))}
        </div>
      )}
      <div className="wf-palette">
        <span className="wf-sub">添加节点：</span>
        {PALETTE.map((item) => (
          <button type="button" className="wf-btn" key={item.type} onClick={() => addNode(item.type)}>
            + {item.label}
          </button>
        ))}
        <span className="wf-spacer" />
        <span className="wf-sub">右键画布可在指针处新建 / 粘贴；选中后 Ctrl+C 复制</span>
      </div>
      {banner !== null && (
        <div className="wf-banner" data-kind={banner.kind}>
          {banner.lines[0]}
          {banner.lines.length > 1 && (
            <ul>
              {banner.lines.slice(1).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="wf-body" ref={bodyRef}>
        <Boundary label="画布">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onSelect={(id) => {
              if (id === null) {
                setPendingLink(null);
                setSelectedId(null);
                return;
              }
              if (pendingLink !== null) {
                completeOutletLink(id);
                return;
              }
              setSelectedId(id);
            }}
            onOutletClick={startOutletLink}
            onOpenSubflow={openSubflow}
            onMoveNode={() => setDirty(true)}
            onDragNode={() => record()}
            onPaneMenu={(screen, flowPoint) => setMenu({ kind: 'pane', x: screen.x, y: screen.y, at: flowPoint })}
            onNodeMenu={(screen, id) => {
              setNodes((all) =>
                all.map((node) =>
                  node.selected === (node.id === id) ? node : { ...node, selected: node.id === id },
                ),
              );
              setMenu({ kind: 'node', x: screen.x, y: screen.y, id });
            }}
            onEdgeMenu={(screen, id) => setMenu({ kind: 'edge', x: screen.x, y: screen.y, id })}
            onApi={handleApi}
          />
        </Boundary>
        {pendingLink !== null && (
          <div className="wf-connect-hint">
            <span>
              已选出口「
              {nodes.find((node) => node.id === pendingLink.nodeId)?.data.outlets?.find(
                (outlet) => outlet.key === pendingLink.outletKey,
              )?.label ?? pendingLink.outletKey}
              」：点一个目标节点完成连接，或按 Esc 取消
            </span>
            <button type="button" className="wf-btn" onClick={() => setPendingLink(null)}>
              取消
            </button>
          </div>
        )}
        <div
          className="wf-splitter"
          data-dragging={resizing ? 'true' : 'false'}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整属性面板宽度"
          aria-valuemin={INSPECTOR_MIN}
          aria-valuemax={INSPECTOR_MAX}
          aria-valuenow={inspectorWidth}
          tabIndex={0}
          title="拖动调整属性面板宽度；双击复位"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={() => setInspectorWidth(INSPECTOR_DEFAULT)}
          onKeyDown={onSplitterKeyDown}
        />
        <aside className="wf-inspector" style={{ width: inspectorWidth }}>
          <Inspector
            body={selected}
            canvasNode={selectedCanvas}
            nodes={nodes}
            flows={flows.filter((item) => item.id !== initial.id)}
            agents={agents}
            payloadFields={payloadFields}
            edges={selectedEdges}
            isEntry={selectedId !== null && entry === selectedId}
            onPatch={patchNode}
            onDelete={deleteNode}
            onCondition={setCondition}
            onWhen={setWhen}
            onAgentsChange={changeAgents}
            onOpenSubflow={openSubflow}
            onSetEntry={() => {
              if (selectedId !== null) setEntryId(selectedId);
            }}
          />
        </aside>
      </div>
      {menu !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          heading={menu.kind === 'pane' ? '画布' : menu.kind === 'node' ? '节点操作' : '连线操作'}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

let edgeSeq = 0;

function newEdgeId(): string {
  edgeSeq += 1;
  return `e-${Date.now().toString(36)}-${edgeSeq}`;
}

/** 按入口 id 给画布节点刷「入口」标记；状态没变的对象原样返回，别制造无谓重建 */
function withEntryFlags(nodes: CanvasNode[], entry: string): CanvasNode[] {
  return nodes.map((node) => {
    const isEntry = node.id === entry;
    if (node.data.isEntry === isEntry) return node;
    return { ...node, data: { ...node.data, isEntry } };
  });
}

/** 复用被删掉的最小 nN，保证 id 可读且不撞（nodes + 本次会话已发过的 id 都算占用） */
function nextNodeId(nodes: CanvasNode[], issued: Set<string>): string {
  const used = new Set(issued);
  for (const node of nodes) used.add(node.id);
  for (let index = 1; index < 100000; index += 1) {
    const id = `n${index}`;
    if (!used.has(id)) return id;
  }
  return `n${Date.now().toString(36)}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
