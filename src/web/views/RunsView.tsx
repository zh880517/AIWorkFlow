import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { relTime } from '../fmt.js';
import type { Navigate } from '../router.js';

export interface RunsViewProps {
  navigate: Navigate;
}

type Bucket = 'active' | 'done' | 'failed';

const BUCKETS: Array<{ key: Bucket; label: string }> = [
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'failed', label: '失败' },
];

/** 排序：最近活动（默认，lastActivity）/ 开始时间（createdAt） */
type SortKey = 'activity' | 'started';
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'activity', label: '最近活动' },
  { key: 'started', label: '开始时间' },
];
const GROUP_PAGE_SIZE = 10;

const ACTIVE_STATUSES = new Set(['running', 'waiting_gate', 'waiting_children']);

function bucketOf(r: api.RunListItem): Bucket {
  // stale 是历史遗留状态（停滞检测已按用户决定移除），按未完成归入进行中
  if (ACTIVE_STATUSES.has(r.status) || r.status === 'stale') return 'active';
  if (r.status === 'failed') return 'failed';
  return r.outcome === 'fail' ? 'failed' : 'done'; // completed：终点成败分栏
}

/** 监控首页（§9.2）：按 cwd 分组，进行中 / 已完成 / 失败分栏。
 *  每目录默认显示最近活动的 10 条，可切排序、可展开全部。SSE 事件当刷新信号。 */
export function RunsView({ navigate }: RunsViewProps) {
  const [runs, setRuns] = useState<api.RunListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('activity');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    const timeOf = (r: api.RunListItem): number =>
      sort === 'activity'
        ? new Date(r.lastActivity ?? r.createdAt).getTime()
        : new Date(r.createdAt).getTime();
    const map = new Map<string, api.RunListItem[]>();
    for (const r of runs ?? []) {
      const key = r.cwd ?? '（未指定目录）';
      const arr = map.get(key);
      if (arr !== undefined) arr.push(r);
      else map.set(key, [r]);
    }
    // 组内统一按当前排序键降序，裁剪交给展示层（展开时要看全部）
    for (const [, list] of map) list.sort((a, b) => timeOf(b) - timeOf(a));
    return [...map.entries()];
  }, [runs, sort]);

  return (
    <PageShell active="runs" navigate={navigate}>
      <div className="page runs-page">
        <div className="page-head">
          <h1>监控</h1>
          <span className="page-sub">
            {runs === null ? '加载中…' : `共 ${runs.length} 个 run · 按项目目录分组 · 每目录默认显示最近活动的 ${GROUP_PAGE_SIZE} 条`}
          </span>
          <div className="seg">
            {SORTS.map((s) => (
              <button key={s.key} className={`seg-btn${sort === s.key ? ' on' : ''}`} onClick={() => setSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
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
          const showAll = expanded[cwd] === true;
          const visible = showAll ? list : list.slice(0, GROUP_PAGE_SIZE);
          const cols = BUCKETS.map((b) => ({ ...b, items: visible.filter((r) => bucketOf(r) === b.key) }));
          return (
            <section className="run-group" key={cwd}>
              <header className="run-group-head">
                <span className="run-group-name">{first.projectName ?? cwd}</span>
                <code className="run-group-cwd">{cwd}</code>
                <span className="run-group-total">{list.length} 条</span>
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
                          <span className={`run-card-dot dot-${bucketOf(r)}`} />
                          <span className="run-card-main">
                            <span className="run-card-title">{r.flowName ?? r.flowId}</span>
                            <span className="run-card-meta">
                              {ACTIVE_STATUSES.has(r.status) && r.currentNode !== null
                                ? `正在 ${r.currentNode} · 活动于 ${relTime(r.lastActivity ?? r.createdAt)}`
                                : `${r.stepsUsed} 步 · ${relTime(r.createdAt)}`}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {list.length > GROUP_PAGE_SIZE && (
                <button className="run-group-more" onClick={() => setExpanded((cur) => ({ ...cur, [cwd]: !showAll }))}>
                  {showAll ? '收起' : `显示全部 ${list.length} 条`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
