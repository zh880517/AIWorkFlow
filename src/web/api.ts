import type { Flow } from '../core/types.js';

export interface FlowMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export interface SaveOk {
  ok: true;
  warnings: unknown[];
}

export interface SaveRejected {
  ok: false;
  errors: Array<{ code: string; message: string; nodeId?: string }>;
  warnings: Array<{ code: string; message: string; nodeId?: string }>;
}

const token = new URLSearchParams(window.location.search).get('k') ?? '';

export function hasToken(): boolean {
  return token !== '';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`/api${path}${sep}k=${encodeURIComponent(token)}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(`API ${res.status}`), { status: res.status, body });
  }
  return body as T;
}

export const listFlows = (): Promise<FlowMeta[]> => req<FlowMeta[]>('/flows');

export const getFlow = (id: string): Promise<Flow> => req<Flow>(`/flows/${encodeURIComponent(id)}`);

export const saveFlow = (flow: Flow): Promise<SaveOk | SaveRejected> =>
  req<SaveOk | SaveRejected>(`/flows/${encodeURIComponent(flow.id)}`, {
    method: 'PUT',
    body: JSON.stringify(flow),
  });

export const deleteFlow = (id: string): Promise<{ ok: true }> =>
  req<{ ok: true }>(`/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- 监控（阶段 4）----

export interface RunListItem {
  id: string;
  parentRunId: string | null;
  rootRunId: string;
  flowId: string;
  flowName: string | null;
  status: string;
  outcome: 'success' | 'fail' | null;
  currentNode: string | null;
  cwd: string | null;
  projectName: string | null;
  stepsUsed: number;
  createdAt: string;
  lastActivity: string | null;
  finishedAt: string | null;
}

export interface RunExecutionItem {
  id: number;
  nodeId: string;
  iteration: number;
  status: string;
  summary: string | null;
  payload: unknown;
  branchId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface FlowSnapshotView {
  rootFlowId: string;
  flows: Record<string, Flow>;
}

export interface RunDetail extends RunListItem {
  snapshotHash: string;
  snapshot: FlowSnapshotView | null;
  executions: RunExecutionItem[];
}

export const listRuns = (): Promise<RunListItem[]> => req<RunListItem[]>('/runs');

export const getRunDetail = (id: string): Promise<RunDetail> =>
  req<RunDetail>(`/runs/${encodeURIComponent(id)}`);

/**
 * SSE 订阅（§9.3）：事件只当"该刷新了"的信号用，收到任意事件即回调。
 * EventSource 自带断线重连；返回关闭函数。
 */
export function openRunEvents(onSignal: () => void): () => void {
  const es = new EventSource(`/api/events?k=${encodeURIComponent(token)}`);
  const handler = (): void => onSignal();
  for (const t of ['hello', 'run_started', 'step_completed', 'run_finished']) {
    es.addEventListener(t, handler);
  }
  return () => {
    for (const t of ['hello', 'run_started', 'step_completed', 'run_finished']) {
      es.removeEventListener(t, handler);
    }
    es.close();
  };
}
