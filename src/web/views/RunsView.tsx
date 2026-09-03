import { PageShell } from '../components/PageShell.js';
import type { Navigate } from '../router.js';

export interface RunsViewProps {
  navigate: Navigate;
}

/** 监控页：阶段 4 上线（run 列表 + 详情 + SSE）。先占位，保证一级导航结构完整。 */
export function RunsView({ navigate }: RunsViewProps) {
  return (
    <PageShell active="runs" navigate={navigate}>
      <div className="page">
        <div className="empty-state tall">
          <h2>监控</h2>
          <p>run 列表与执行轨迹将在阶段 4 上线。</p>
          <p className="page-sub">SSE 实时推送、人工卡点直接回答、停滞检测（15 分钟标黄，24 小时标 stale）。</p>
        </div>
      </div>
    </PageShell>
  );
}
