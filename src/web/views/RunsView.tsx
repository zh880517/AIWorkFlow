import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { relTime } from '../fmt.js';
import type { Navigate } from '../router.js';

export interface RunsViewProps {
  navigate: Navigate;
}

type Bucket = 'active' | 'done' | 'failed' | 'stale';

const BUCKETS: Array<{ key: Bucket; label: string }> = [
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'failed', label: '失败' },
  { key: 'stale', label: '停滞' },
];

const ACTIVE_STATUSES = new Set(['running', 'waiting_gate', 'waiting_children']);
const STALE_AFTER_MS = 15 * 60 * 1000; // §9.2：15 分钟标黄（只是提示，不做处理）

function bucketOf(r: api.RunListItem): Bucket {
  if (r.status === 'stale') return 'stale';
  if (ACTIVE_STATUSES.has(r.status)) return 'active';
  if (r.status === 'failed') return 'failed';
  return r.outcome === 'fail' ? 'failed' : 'done'; // completed：终点成败分栏
}

function looksStalled(r: api.RunListItem): boolean {
  return ACTIVE_STATUSES.has(r.status) && r.lastActivity !== null
    && Date.now() - new Date(r.lastActivity).getTime() > STALE_AFTER_MS;
}

/** 监控首页（§9.2）：按 cwd 分组，进行中 / 已完成 / 失败 / 停滞分栏。SSE 事件当刷新信号。 */
export function RunsView({ navigate }: RunsViewProps) {
  const [runs, setRuns] = useState<api.RunListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const groups = useMemo(() => {
    const map = new Map<string, api.RunListItem[]>();
    for (const r of runs ?? []) {
      const key = r.cwd ?? '（未指定目录）';
      const arr = map.get(key);
      if (arr !== undefined) arr.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()];
  }, [runs]);

  return (
    <PageShell active="runs" navigate={navigate}>
      <div className="page runs-page">
        <div className="page-head">
          <h1>监控</h1>
          <span className="page-sub">
            {runs === null ? '加载中…' : `共 ${runs.length} 个 run · 按项目目录分组 · 实时刷新`}
          </span>
        </div>
        {err !== null && <div className="run-error">加载失败：{err}（服务可能已关闭）</div>}
        {runs !== null && runs.length === 0 && (
          <div className="empty-state">
            <h2>还没有 run</h2>
            <p className="page-sub">Agent 通过 MCP 调 start_run 后，这里会出现执行轨迹。</p>
          </div>
        )}
        {groups.map(([cwd, list]) => {
          const first = list[0]!;
          const cols = BUCKETS.map((b) => ({ ...b, items: list.filter((r) => bucketOf(r) === b.key) }));
          return (
            <section className="run-group" key={cwd}>
              <header className="run-group-head">
                <span className="run-group-name">{first.projectName ?? cwd}</span>
                <code className="run-group-cwd">{cwd}</code>
              </header>
              <div className="run-cols">
                {cols.map((col) => (
                  <div className={`run-col run-col-${col.key}`} key={col.key}>
                    <div className="run-col-head">
                      {col.label}
                      {col.items.length > 0 && <span className="run-col-count">{col.items.length}</span>}
                    </div>
                    <div className="run-col-body">
                      {col.items.map((r) => (
                        <button
                          className="run-card"
                          key={r.id}
                          onClick={() => navigate(`/runs/${encodeURIComponent(r.id)}`)}
                        >
                          <span className={`run-card-dot dot-${bucketOf(r)}${looksStalled(r) ? ' stalled' : ''}`} />
                          <span className="run-card-main">
                            <span className="run-card-title">{r.flowName ?? r.flowId}</span>
                            <span className="run-card-meta">
                              {ACTIVE_STATUSES.has(r.status) && r.currentNode !== null
                                ? `正在 ${r.currentNode}`
                                : `${r.stepsUsed} 步`}
                              {' · '}
                              {relTime(r.createdAt)}
                            </span>
                          </span>
                          {looksStalled(r) && <span className="run-card-warn" title="超过 15 分钟无活动">停滞?</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
