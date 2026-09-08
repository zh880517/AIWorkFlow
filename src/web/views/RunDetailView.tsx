import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { RunFlowCanvas } from '../components/RunFlowCanvas.js';
import { relTime, clockTime } from '../fmt.js';
import type { Navigate } from '../router.js';

export interface RunDetailViewProps {
  id: string;
  navigate: Navigate;
}

const ACTIVE_STATUSES = new Set(['running', 'waiting_gate', 'waiting_children']);
const STATUS_TEXT: Record<string, string> = {
  running: '进行中',
  waiting_gate: '等人工确认',
  waiting_children: '等子 Agent',
  completed: '已完成',
  failed: '失败',
  stale: '停滞',
};
const EXEC_STATUS: Record<string, { text: string; cls: string }> = {
  completed: { text: '完成', cls: 'ok' },
  blocked: { text: '阻塞', cls: 'bad' },
  limit_exceeded: { text: '超限逃生', cls: 'warn' },
};

/** run 详情（§9.2）：快照图渲染 + 节点着色 + 路径高亮 + 右侧迭代次序列表（环的每一圈逐次列出） */
export function RunDetailView({ id, navigate }: RunDetailViewProps) {
  const [detail, setDetail] = useState<api.RunDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<number | null>(null);

  const load = useCallback(() => {
    api
      .getRunDetail(id)
      .then((d) => {
        setDetail(d);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    setDetail(null);
    setErr(null);
    setSelectedNodeId(null);
    setSelectedExecId(null);
    load();
    const off = api.openRunEvents(load); // SSE：该刷新了就重拉详情
    return () => {
      off();
    };
  }, [load]);

  if (err !== null) {
    return (
      <div className="app notice-page">
        <p>
          加载失败：{err}{' '}
          <button className="btn" onClick={() => navigate('/runs')}>
            回监控列表
          </button>
        </p>
      </div>
    );
  }
  if (detail === null) {
    return (
      <div className="app notice-page">
        <p>加载中…</p>
      </div>
    );
  }

  const rootFlow = detail.snapshot !== null ? detail.snapshot.flows[detail.snapshot.rootFlowId] : undefined;
  const running = ACTIVE_STATUSES.has(detail.status);
  const nodeTitle = (nodeId: string): string => {
    const n = rootFlow?.nodes.find((x) => x.id === nodeId);
    return n !== undefined && n.title !== undefined && n.title.trim() !== '' ? n.title : nodeId;
  };
  const branchLabel = (nodeId: string, branchId: string | null): string | null => {
    if (branchId === null || rootFlow === undefined) return null;
    const n = rootFlow.nodes.find((x) => x.id === nodeId);
    const b = n?.branches?.find((x) => x.id === branchId);
    if (b === undefined) return branchId;
    return b.condition === '*' ? '默认' : b.condition;
  };
  const visibleExecs = selectedNodeId !== null ? detail.executions.filter((e) => e.nodeId === selectedNodeId) : detail.executions;
  const selectedExec = detail.executions.find((e) => e.id === selectedExecId) ?? null;
  const statusChip = `run-chip chip-${running ? 'active' : detail.status === 'stale' ? 'stale' : detail.outcome === 'fail' || detail.status === 'failed' ? 'fail' : 'ok'}`;

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn icon" title="回监控列表" onClick={() => navigate('/runs')}>
          ←
        </button>
        <span className="topbar-title">{detail.flowName ?? detail.flowId}</span>
        <span className={statusChip}>{STATUS_TEXT[detail.status] ?? detail.status}{detail.outcome !== null && !running ? ` · ${detail.outcome === 'fail' ? '未达成' : '达成'}` : ''}</span>
        <span className="topbar-hint">
          <code>{detail.id}</code> · {detail.stepsUsed} 步
          {detail.projectName !== null ? ` · ${detail.projectName}` : ''}
        </span>
      </header>
      <div className="main">
        <div className="canvas-area">
          {rootFlow !== undefined ? (
            <RunFlowCanvas
              flow={rootFlow}
              executions={detail.executions}
              currentNode={detail.currentNode}
              running={running}
              selectedNodeId={selectedNodeId}
              onNodeClick={(nodeId) => {
                setSelectedNodeId(nodeId);
                setSelectedExecId(null);
              }}
            />
          ) : (
            <div className="canvas-empty">
              <p>快照丢失（{detail.snapshotHash}），轨迹仍可看右侧列表。</p>
            </div>
          )}
        </div>
        <aside className="right-panel run-trace-panel">
          <div className="run-trace-head">
            <span className="run-trace-title">执行轨迹</span>
            {selectedNodeId !== null && (
              <button className="btn small" onClick={() => setSelectedNodeId(null)}>
                只看 {nodeTitle(selectedNodeId)} · 清除
              </button>
            )}
          </div>
          <div className="run-trace-meta">
            开始 {relTime(detail.createdAt)}（{clockTime(detail.createdAt)}）
            {detail.finishedAt !== null && <> · 结束 {clockTime(detail.finishedAt)}</>}
            {detail.cwd !== null && <> · <code>{detail.cwd}</code></>}
          </div>
          <ol className="run-trace-list">
            {visibleExecs.map((e, i) => {
              const st = EXEC_STATUS[e.status] ?? { text: e.status, cls: 'warn' };
              return (
                <li
                  key={e.id}
                  className={`run-trace-item ${selectedExecId === e.id ? 'sel' : ''}`}
                  onClick={() => {
                    setSelectedExecId(e.id);
                    setSelectedNodeId(e.nodeId);
                  }}
                >
                  <span className="run-trace-seq">{i + 1}</span>
                  <span className="run-trace-body">
                    <span className="run-trace-node">
                      {nodeTitle(e.nodeId)}
                      <em className="run-trace-iter">#{e.iteration}</em>
                      <span className={`exec-chip ${st.cls}`}>{st.text}</span>
                    </span>
                    <span className="run-trace-summary">{e.summary}</span>
                    <span className="run-trace-sub">
                      {branchLabel(e.nodeId, e.branchId) !== null && <>走了「{branchLabel(e.nodeId, e.branchId)}」· </>}
                      {clockTime(e.finishedAt ?? e.startedAt)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          {selectedExec !== null && (
            <div className="run-payload">
              <div className="run-payload-head">#{selectedExec.iteration} · {nodeTitle(selectedExec.nodeId)} 的 payload</div>
              <pre>{JSON.stringify(selectedExec.payload, null, 2)}</pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
