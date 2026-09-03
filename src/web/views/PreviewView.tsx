import { useCallback, useEffect, useState } from 'react';
import type { OnNodesChange } from '@xyflow/react';
import type { Flow } from '../../core/types.js';
import * as api from '../api.js';
import { normalizeOutlets } from '../dsl.js';
import { FlowCanvas } from '../components/FlowCanvas.js';
import { StepPreview } from '../components/StepPreview.js';
import type { Navigate } from '../router.js';

export interface PreviewViewProps {
  id: string;
  navigate: Navigate;
}

/** Agent 视角预览：只读画布 + 单步下发内容（设计文档 §6.2 的降噪视图）。展示的是已保存版本。 */
export function PreviewView({ id, navigate }: PreviewViewProps) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});

  useEffect(() => {
    let cancelled = false;
    setFlow(null);
    setErr(null);
    setSelectedNodeId(null);
    api
      .getFlow(id)
      .then((raw) => {
        if (!cancelled) setFlow(normalizeOutlets(raw));
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 只读视图也要缓存节点实测尺寸，否则受控模式下节点不渲染
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

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="btn icon"
          title="返回编辑"
          onClick={() => navigate(`/edit/${encodeURIComponent(id)}`)}
        >
          ←
        </button>
        <span className="topbar-title">{flow?.name ?? (err !== null ? '加载失败' : '加载中…')}</span>
        <span className="topbar-hint">Agent 视角 · 画布只读，点击节点查看单步下发内容</span>
      </header>
      <div className="main">
        <div className="canvas-area">
          {flow !== null ? (
            <FlowCanvas
              flow={flow}
              measured={measured}
              preview
              selectedNodeId={selectedNodeId}
              selectedEdgeId={null}
              onEdgeClick={() => {}}
              onEdgesDelete={() => {}}
              onAddOutlet={() => null}
              onRemoveOutlet={() => {}}
              onMoveOutlet={() => {}}
              onSetOutletCondition={() => {}}
              onNodesChange={onNodesChange}
              onConnect={() => {}}
              onNodesDelete={() => {}}
              onNodeClick={setSelectedNodeId}
              onPaneClick={() => setSelectedNodeId(null)}
              onDrop={(e) => e.preventDefault()}
              onDragOver={(e) => e.preventDefault()}
            />
          ) : (
            <div className="canvas-empty">
              <p>{err !== null ? `加载失败：${err}` : '加载中…'}</p>
            </div>
          )}
        </div>
        <aside className="right-panel">
          {flow !== null && selectedNodeId !== null ? (
            <StepPreview flow={flow} nodeId={selectedNodeId} />
          ) : (
            <div className="panel-empty">点击画布上的节点，查看 Agent 将收到的单步内容</div>
          )}
        </aside>
      </div>
    </div>
  );
}
