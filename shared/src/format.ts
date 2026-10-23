// 公用层：时间与数值格式化（纯函数）。

export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (iso === null || iso === undefined || iso === '') return '—';
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '—';
  if (diff < 0) return '刚刚';
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function clockTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** 持续时长：58s / 3m12s / 1h04m */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
}

/** run 已运行的时长：进行中算到当前，结束的算到 finishedAt */
export function elapsedOf(
  run: { createdAt: string; finishedAt: string | null; status: string },
  now = Date.now(),
): number {
  const start = new Date(run.createdAt).getTime();
  if (Number.isNaN(start)) return 0;
  const end = run.finishedAt !== null ? new Date(run.finishedAt).getTime() : now;
  return Math.max(0, end - start);
}
