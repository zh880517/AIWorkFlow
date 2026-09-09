import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { relTime } from '../fmt.js';
import { RunDetailView } from './RunDetailView.js';
import type { Navigate } from '../router.js';

export interface RunsViewProps {
  navigate: Navigate;
  /** 来自路由 #/runs/:id；有值时主区显示该 run 的流程图详情 */
  runId: string | null;
}

/** 排序：最近活动（默认，lastActivity）/ 开始时间（createdAt） */
type SortKey = 'activity' | 'started';
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'activity', label: '最近活动' },
  { key: 'started', label: '开始时间' },
];
const LIST_PAGE_SIZE = 10;

const ACTIVE_STATUSES = new Set(['running', 'waiting_gate', 'waiting_children']);

type DotKind = 'active' | 'done' | 'failed';

function dotOf(r: api.RunListItem): DotKind {
  // stale 是历史遗留状态（停滞检测已移除），按未完成归入进行中
  if (ACTIVE_STATUSES.has(r.status) || r.status === 'stale') return 'active';
  if (r.status === 'failed') return 'failed';
  return r.outcome === 'fail' ? 'failed' : 'done'; // completed：终点成败分色
}

interface Workspace {
  key: string;
  cwd: string;
  name: string;
  runs: api.RunListItem[];
  activeCount: number;
  latest: number;
}

/** 监控页（§9.2 改版）：左侧工作区（按 cwd 分组）→ 选中显示任务列表 → 点开显示流程图详情 */
export function RunsView({ navigate, runId }: RunsViewProps) {
  const [runs, setRuns] = useState<api.RunListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('activity');
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    api
      .listRuns()
      .then((list) => {
        setRuns(list);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
    const off = api.openRunEvents(load); // SSE：收到任意事件即重拉（EventSource 自带重连）
    const timer = window.setInterval(load, 30_000); // 兜底轮询（相对时间也需要周期重绘）
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [load]);

  const workspaces = useMemo<Workspace[]>(() => {
    const timeOf = (r: api.RunListItem): number =>
      sort === 'activity'
        ? new Date(r.lastActivity ?? r.createdAt).getTime()
        : new Date(r.createdAt).getTime();
    const map = new Map<string, Workspace>();
    for (const r of runs ?? []) {
      const key = r.cwd ?? '（未指定目录）';
      let ws = map.get(key);
      if (ws === undefined) {
        ws = { key, cwd: key, name: r.projectName ?? key, runs: [], activeCount: 0, latest: 0 };
        map.set(key, ws);
      }
      ws.runs.push(r);
      if (dotOf(r) === 'active') ws.activeCount += 1;
      ws.latest = Math.max(ws.latest, new Date(r.lastActivity ?? r.createdAt).getTime());
    }
    const list = [...map.values()];
    for (const ws of list) ws.runs.sort((a, b) => timeOf(b) - timeOf(a));
    list.sort((a, b) => b.latest - a.latest); // 工作区按最近活动排
    return list;
  }, [runs, sort]);

  const selected = useMemo(
    () => workspaces.find((ws) => ws.key === selectedWs) ?? null,
    [workspaces, selectedWs],
  );

  const selectWs = useCallback((key: string) => {
    setSelectedWs(key);
    setShowAll(false);
  }, []);

  const visibleRuns = useMemo(() => {
    if (selected === null) return [];
    return showAll ? selected.runs : selected.runs.slice(0, LIST_PAGE_SIZE);
  }, [selected, showAll]);

  return (
    <PageShell active="runs" navigate={navigate}>
      <div className="runs-layout">
        <aside className="runs-side">
          <div className="runs-side-head">工作区</div>
          {runs !== null && runs.length === 0 && <div className="runs-side-empty">还没有任何 run</div>}
          {workspaces.map((ws) => (
            <button
              key={ws.key}
              className={`ws-item${selectedWs === ws.key ? ' on' : ''}`}
              onClick={() => selectWs(ws.key)}
            >
              <span className="ws-line">
                <span className="ws-name">{ws.name}</span>
                <span className="ws-count">
                  {ws.activeCount > 0 && <i className="run-card-dot dot-active" />}
                  {ws.runs.length}
                </span>
              </span>
              <code className="ws-cwd">{ws.cwd}</code>
            </button>
          ))}
        </aside>
        <section className="runs-main">
          {runId !== null ? (
            <RunDetailView id={runId} navigate={navigate} />
          ) : err !== null ? (
            <div className="run-error">加载失败：{err}（服务可能已关闭）</div>
          ) : selected === null ? (
            <div className="empty-state tall">
              <h2>任务列表</h2>
              <p className="page-sub">在左侧选择一个工作区，查看它的任务（run）。</p>
            </div>
          ) : (
            <>
              <div className="runs-toolbar">
                <span className="runs-ws-name">{selected.name}</span>
                <code className="run-group-cwd">{selected.cwd}</code>
                <span className="page-sub">
                  {selected.runs.length} 个任务 · 默认显示最近活动的 {LIST_PAGE_SIZE} 条
                </span>
                <div className="seg">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      className={`seg-btn${sort === s.key ? ' on' : ''}`}
                      onClick={() => {
                        setSort(s.key);
                        setShowAll(false);
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="task-list">
                {visibleRuns.map((r) => (
                  <button
                    className="task-row"
                    key={r.id}
                    onClick={() => navigate(`/runs/${encodeURIComponent(r.id)}`)}
                  >
                    <span className={`run-card-dot dot-${dotOf(r)}`} />
                    <span className="task-title">
                      {r.parentRunId !== null ? '↳ ' : ''}
                      {r.flowName ?? r.flowId}
                    </span>
                    <span className="task-meta">
                      {ACTIVE_STATUSES.has(r.status) && r.currentNode !== null
                        ? `正在 ${r.currentNode} · 活动于 ${relTime(r.lastActivity ?? r.createdAt)}`
                        : `${r.stepsUsed} 步 · ${relTime(r.createdAt)}`}
                    </span>
                    <code className="task-runid">{r.id}</code>
                  </button>
                ))}
              </div>
              {selected.runs.length > LIST_PAGE_SIZE && (
                <button className="run-group-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? '收起' : `显示全部 ${selected.runs.length} 条`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
