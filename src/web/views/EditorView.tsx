import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, type Connection, type NodePositionChange, type OnNodesChange } from '@xyflow/react';
import type { Flow, NodeType } from '../../core/types.js';
import { validateFlow } from '../../core/validate.js';
import * as api from '../api.js';
import {
  NODE_META,
  NODE_TYPES,
  addNode,
  addOutlet,
  connect,
  flowToRf,
  moveOutlet,
  nextNodeId,
  normalizeOutlets,
  removeEdge,
  removeNodes,
  removeOutlet,
  setOutletCondition,
} from '../dsl.js';
import { FlowCanvas } from '../components/FlowCanvas.js';
import { PropsPanel } from '../components/PropsPanel.js';
import { ValidationPanel } from '../components/ValidationPanel.js';
import { FlowHistory } from '../history.js';
import type { Navigate } from '../router.js';

export interface EditorViewProps {
  /** 真实 flow id；'new' 表示新草稿（保存成功后地址替换为真实 id，组件不重挂载） */
  id: string;
  navigate: Navigate;
  /** 注册路由离开守卫（有未保存改动时拦截跳转，含浏览器后退） */
  registerGuard: (guard: (() => boolean) | null) => void;
}

/** 编辑器页：只放画布相关的东西（节点面板 + 画布 + 按需出现的属性面板）。流程管理在流程库页。 */
export function EditorView({ id, navigate, registerGuard }: EditorViewProps) {
  const rf = useReactFlow();
  const [flowList, setFlowList] = useState<api.FlowMeta[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'ok' | 'err' | null>(null);
  const [valOpen, setValOpen] = useState(false);
  /** 该图历史 run 学到的 payload 字段（插值提示用，阶段 8） */
  const [payloadFields, setPayloadFields] = useState<Record<string, string[]>>({});
  /** 撤销/重做历史 + 触发按钮态刷新的计数 */
  const historyRef = useRef(new FlowHistory());
  const [histVersion, setHistVersion] = useState(0);
  /** flow 的同步镜像：变更路径在记录历史时需要读到最新状态（不受 React 批处理时序影响） */
  const flowRef = useRef<Flow | null>(null);
  /** dirty 的同步镜像：路由守卫在事件回调里读取，避开闭包过期 */
  const dirtyRef = useRef(false);

  const setFlowState = useCallback((f: Flow | null) => {
    flowRef.current = f;
    setFlow(f);
  }, []);
  const setDirtyState = useCallback((v: boolean) => {
    dirtyRef.current = v;
    setDirty(v);
  }, []);
  const bumpHist = useCallback(() => setHistVersion((v) => v + 1), []);
  const undoable = histVersion >= 0 && historyRef.current.canUndo();
  const redoable = histVersion >= 0 && historyRef.current.canRedo();
  /** 节点实测尺寸缓存（onNodesChange 的 dimensions 变更），见 flowToRf 的 measured 参数说明 */
  const measuredRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  // flow 每次变化（拖动/编辑）都会重建节点对象，此时快照最新实测尺寸一并传入
  const measured = useMemo(() => Object.fromEntries(measuredRef.current), [flow]);

  const validation = useMemo(() => (flow !== null ? validateFlow(flow) : null), [flow]);

  // 挂载时载入一次。id 仅在 new→保存成功后由 replace 变为真实 id，组件不重挂载、状态保留
  useEffect(() => {
    let cancelled = false;
    async function boot(): Promise<void> {
      // flowList 只服务于属性面板的子图下拉，失败不致命
      try {
        const metas = await api.listFlows();
        if (!cancelled) setFlowList(metas);
      } catch {
        /* 忽略 */
      }
      if (id === 'new') {
        const empty: Flow = {
          id: `flow_${Date.now().toString(36)}`,
          name: '未命名流程',
          entry: 'n1',
          nodes: [{ id: 'n1', type: 'prompt', instruction: '' }],
          _ui: { positions: { n1: { x: 320, y: 200 } } },
        };
        historyRef.current.reset();
        bumpHist();
        setFlowState(empty);
        setDirtyState(true);
        setSelectedNodeId('n1');
        setStatus('新流程：画完记得保存（Ctrl+S）', null);
        return;
      }
      try {
        const raw = await api.getFlow(id);
        // 旧数据迁移：多余的默认出口分支自动绑到新建的自定义出口（有变化则提示保存）
        const f = normalizeOutlets(raw);
        const migrated = JSON.stringify(f) !== JSON.stringify(raw);
        historyRef.current.reset();
        bumpHist();
        setFlowState(f);
        setDirtyState(migrated);
        setSelectedNodeId(null);
        setStatus(migrated ? '已自动把多余的默认出口分支迁移到自定义出口，保存后生效' : null, null);
        // 插值提示：从该图历史 run 学字段名（失败静默，编辑功能不依赖它）
        api.getPayloadFields(id).then((pf) => {
          if (!cancelled) setPayloadFields(pf);
        });
      } catch (e) {
        setStatus(`加载失败：${(e as Error).message}`, 'err');
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行
  }, []);

  // 路由离开守卫
  useEffect(() => {
    registerGuard(() => !dirtyRef.current || window.confirm('有未保存改动，离开将丢失。确定离开？'));
    return () => registerGuard(null);
  }, [registerGuard]);

  function setStatus(msg: string | null, kind: 'ok' | 'err' | null): void {
    setStatusMsg(msg);
    setStatusKind(kind);
  }

  /**
   * 统一变更入口：先记录历史（可按 group 合并连续文本/拖动变更），再应用。
   * group 形如 `cond:n1:b1`（出口条件输入）、`title:n2`（属性文本框）。
   */
  const update = useCallback(
    (updater: (f: Flow) => Flow, group?: string) => {
      const current = flowRef.current;
      if (current === null) return;
      historyRef.current.push(current, group);
      bumpHist();
      setFlowState(updater(current));
      setDirtyState(true);
      setStatus(null, null);
    },
    [bumpHist, setDirtyState, setFlowState],
  );

  /** 撤销 / 重做 */
  const undo = useCallback(() => {
    const current = flowRef.current;
    if (current === null) return;
    const prev = historyRef.current.undo(current);
    if (prev === null) return;
    setFlowState(prev);
    setDirtyState(true);
    setSelectedNodeId(null);
    setStatus('已撤销', null);
    bumpHist();
  }, [bumpHist, setDirtyState, setFlowState]);

  const redo = useCallback(() => {
    const current = flowRef.current;
    if (current === null) return;
    const next = historyRef.current.redo(current);
    if (next === null) return;
    setFlowState(next);
    setDirtyState(true);
    setSelectedNodeId(null);
    setStatus('已重做', null);
    bumpHist();
  }, [bumpHist, setDirtyState, setFlowState]);

  const save = useCallback(async (): Promise<void> => {
    const current = flowRef.current;
    if (current === null) return;
    try {
      const res = await api.saveFlow(current);
      if (res.ok) {
        setDirtyState(false);
        setStatus(`已保存${res.warnings.length > 0 ? `（${res.warnings.length} 条警告，点右上校验查看）` : ''}`, 'ok');
        if (id === 'new') {
          // 新草稿保存成功：地址替换为真实 id（不重挂载、不经过路由守卫）
          navigate(`/edit/${encodeURIComponent(current.id)}`, { replace: true });
        }
      } else {
        setStatus(`保存被拒绝：${res.errors.length} 处硬拒，见校验浮层`, 'err');
        setValOpen(true);
      }
    } catch (e) {
      const body = (e as { body?: { ok?: boolean; errors?: unknown[] } }).body;
      if (body?.ok === false) {
        setStatus(`保存被拒绝：${body.errors?.length ?? '?'} 处硬拒，见校验浮层`, 'err');
        setValOpen(true);
      } else {
        setStatus(`保存失败：${(e as Error).message}`, 'err');
      }
    }
  }, [id, navigate, setDirtyState]);

  // 快捷键：Ctrl+Z 撤销、Ctrl+Y / Ctrl+Shift+Z 重做、Ctrl+S 保存（输入框内不拦截）；Escape 取消选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setValOpen(false);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, save]);

  // ---- 画布回调 ----

  const dragActiveRef = useRef(false);
  const dragSessionRef = useRef(0);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // 缓存实测尺寸：重建节点对象时携带，避免 React Flow 重置测量导致拖动闪烁
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions != null) {
          measuredRef.current.set(c.id, c.dimensions);
        }
      }
      const positionChanges = changes.filter(
        (c): c is NodePositionChange => c.type === 'position' && c.position !== undefined,
      );
      if (positionChanges.length === 0) return;
      const current = flowRef.current;
      if (current === null) return;
      // 一次拖动的全部帧合并为一条历史；拖拽收尾帧（dragging:false）不再入栈
      const anyDragging = positionChanges.some((c) => c.dragging === true);
      if (anyDragging) {
        if (!dragActiveRef.current) {
          dragActiveRef.current = true;
          dragSessionRef.current += 1;
        }
        historyRef.current.push(current, `drag-${dragSessionRef.current}`);
      } else if (dragActiveRef.current) {
        dragActiveRef.current = false;
      } else {
        historyRef.current.push(current);
      }
      bumpHist();
      const next = structuredClone(current);
      next._ui ??= {};
      next._ui.positions ??= {};
      for (const c of positionChanges) {
        if (c.position != null) next._ui.positions[c.id] = c.position;
      }
      setFlowState(next);
      setDirtyState(true);
    },
    [bumpHist, setDirtyState, setFlowState],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      const current = flowRef.current;
      if (current === null || conn.source === undefined || conn.target === undefined) return;
      if (conn.target === current.entry) {
        setStatus('开始节点不能有入线', 'err');
        return;
      }
      const next = connect(current, conn.source, conn.target, conn.sourceHandle ?? undefined);
      if (next === null) {
        setStatus('这两个节点之间已有这条连线', 'err');
        return;
      }
      historyRef.current.push(current);
      bumpHist();
      setFlowState(next);
      setDirtyState(true);
      setStatus(null, null);
    },
    [bumpHist, setDirtyState, setFlowState],
  );

  const onNodesDelete = useCallback((ids: string[]) => update((f) => removeNodes(f, ids)), [update]);

  // 连线选中（仅高亮 + Delete 删除，无属性面板）
  const onEdgeClick = useCallback((edgeId: string) => {
    // 选中连线时清除节点选中，避免 Delete 同时删掉节点和连线
    setSelectedNodeId(null);
    setSelectedEdgeId((cur) => (cur === edgeId ? null : edgeId));
  }, []);
  const onEdgesDelete = useCallback(
    (edgeIds: string[]) => {
      setSelectedEdgeId(null);
      update((f) => {
        let next = f;
        for (const edgeId of edgeIds) {
          const edge = flowToRf(next).edges.find((e) => e.id === edgeId);
          if (edge !== undefined) next = removeEdge(next, edge);
        }
        return next;
      });
    },
    [update],
  );

  // 出口操作（在节点卡片上）
  const handleAddOutlet = useCallback(
    (nodeId: string, afterOutlet?: string): string | null => {
      const current = flowRef.current;
      if (current === null) return null;
      const r = addOutlet(current, nodeId, afterOutlet);
      if (r === null) return null;
      update(() => r.flow);
      return r.outletId;
    },
    [update],
  );
  const handleRemoveOutlet = useCallback(
    (nodeId: string, outlet: string) => {
      if (!window.confirm('删除这个出口？其上的连线会一并删除。')) return;
      update((f) => removeOutlet(f, nodeId, outlet));
    },
    [update],
  );
  const handleMoveOutlet = useCallback(
    (nodeId: string, outlet: string, toIndex: number) =>
      update((f) => moveOutlet(f, nodeId, outlet, toIndex)),
    [update],
  );
  const handleSetOutletCondition = useCallback(
    (nodeId: string, outlet: string, condition: string) =>
      update((f) => setOutletCondition(f, nodeId, outlet, condition), `cond:${nodeId}:${outlet}`),
    [update],
  );
  const addNodeAt = useCallback(
    (type: NodeType, position?: { x: number; y: number }) => {
      if (flow === null) return;
      const expectedId = nextNodeId(flow);
      // 点击添加时按网格错开，避免新节点全部叠在画布中心
      const pos =
        position ??
        (() => {
          const center = rf.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
          const i = flow.nodes.length;
          return { x: center.x + ((i % 3) - 1) * 260, y: center.y + Math.floor(i / 3) * 170 };
        })();
      update((f) => addNode(f, type, pos).flow);
      setSelectedNodeId(expectedId);
      // 新节点可能落在可视区外，稍后调整视野把它包含进来
      window.setTimeout(() => rf.fitView({ padding: 0.2, duration: 200 }), 50);
    },
    [flow, rf, update],
  );

  // 校验浮层里点问题 → 选中并定位到节点
  const jumpToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setValOpen(false);
      void rf.fitView({ nodes: [{ id: nodeId }], padding: 0.5, duration: 300 });
    },
    [rf],
  );

  // ---- 渲染 ----

  const valChip =
    validation === null
      ? null
      : !validation.ok
        ? { cls: 'err', text: `✕ ${validation.errors.length} 处硬拒` }
        : validation.warnings.length > 0
          ? { cls: 'warn', text: `⚠ ${validation.warnings.length} 条警告` }
          : { cls: 'ok', text: '✓ 校验通过' };

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn icon" title="返回流程库" onClick={() => navigate('/')}>
          ←
        </button>
        <input
          className="input flow-name"
          value={flow?.name ?? ''}
          placeholder={id === 'new' ? '未命名流程' : '加载中…'}
          onChange={(e) => update((f) => ({ ...f, name: e.target.value }), 'flow-name')}
        />
        {dirty && <span className="dirty-dot" title="有未保存改动" />}
        <div className="spacer" />
        <button className="btn icon" onClick={undo} disabled={!undoable} title="撤销（Ctrl+Z）">
          ↩
        </button>
        <button className="btn icon" onClick={redo} disabled={!redoable} title="重做（Ctrl+Y / Ctrl+Shift+Z）">
          ↪
        </button>
        {valChip !== null && (
          <button
            className={`btn val-chip ${valChip.cls} ${valOpen ? 'on' : ''}`}
            onClick={() => setValOpen((v) => !v)}
            title="校验结果（硬拒阻止保存，警告允许保存）"
          >
            {valChip.text}
          </button>
        )}
        <button
          className="btn"
          disabled={flow === null || dirty || id === 'new'}
          title={dirty || id === 'new' ? '预览展示已保存版本，请先保存' : 'Agent 视角预览'}
          onClick={() => flow !== null && navigate(`/preview/${encodeURIComponent(flow.id)}`)}
        >
          预览
        </button>
        <button className="btn primary" onClick={() => void save()} disabled={flow === null || !dirty}>
          保存
        </button>

        {valOpen && validation !== null && (
          <div className="val-popover">
            <ValidationPanel validation={validation} onSelectNode={jumpToNode} />
          </div>
        )}
      </header>

      <div className="main">
        <aside className="palette-col">
          <div className="side-title">节点</div>
          <div className="palette">
            {NODE_TYPES.map((type) => (
              <button
                key={type}
                className="palette-item"
                style={{ borderColor: NODE_META[type].color }}
                draggable={flow !== null}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/aiworkflow-node', type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => addNodeAt(type)}
                disabled={flow === null}
              >
                <span>{NODE_META[type].icon}</span> {NODE_META[type].label}
              </button>
            ))}
          </div>
        </aside>

        <div className="canvas-area">
          {flow !== null ? (
            <FlowCanvas
              flow={flow}
              measured={measured}
              preview={false}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onEdgeClick={onEdgeClick}
              onEdgesDelete={onEdgesDelete}
              onAddOutlet={handleAddOutlet}
              onRemoveOutlet={handleRemoveOutlet}
              onMoveOutlet={handleMoveOutlet}
              onSetOutletCondition={handleSetOutletCondition}
              onNodesChange={onNodesChange}
              onConnect={onConnect}
              onNodesDelete={onNodesDelete}
              onNodeClick={(nodeId) => {
                setSelectedNodeId(nodeId);
                setSelectedEdgeId(null);
              }}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData('application/aiworkflow-node');
                if (raw !== '') {
                  addNodeAt(raw as NodeType, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            />
          ) : (
            <div className="canvas-empty">
              <p>{statusMsg !== null ? statusMsg : '加载中…'}</p>
            </div>
          )}
          {statusMsg !== null && (
            <div className={`toast ${statusKind ?? ''}`} role="status">
              {statusMsg}
            </div>
          )}
        </div>

        {/* 属性面板按需出现：没选中节点时画布占满，不常驻空面板 */}
        {flow !== null && selectedNodeId !== null && (
          <aside className="right-panel">
            <PropsPanel flow={flow} nodeId={selectedNodeId} flowList={flowList} payloadFields={payloadFields} onChange={update} />
          </aside>
        )}
      </div>
    </div>
  );
}
