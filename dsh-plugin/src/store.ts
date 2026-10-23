// 客户端数据源：轮询 Host 半的同源路由，只做"该刷新了就重拉"。
// 面板打开时 2s 一次，收起时 6s 一次；页面隐藏时暂停，避免后台空转。
import type { RunDetail, RunListItem } from '@shared/index.js';
import { resolveEndpoint } from './endpoint.js';

export interface ProgressSnapshot {
  open: boolean;
  loading: boolean;
  available: boolean;
  reason: string | null;
  active: RunListItem[];
  recent: RunListItem[];
  detail: RunDetail | null;
  selectedId: string | null;
  /** 只读哪个会话的 run（原始 sessionId）；null = 不筛（全部） */
  sessionId: string | null;
  dbPath: string;
  updatedAt: number | null;
  error: string | null;
  /** 实际请求的数据端点，用于诊断跨源/协议问题 */
  endpoint: string;
}

export interface ProgressStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ProgressSnapshot;
  toggle(): void;
  setOpen(open: boolean): void;
  /** 会话切进来时由标题栏胶囊调用：切会话会清空列表并重拉，避免串会话 */
  setSession(sessionId: string | null): void;
  select(runId: string): void;
  refresh(): void;
  dispose(): void;
}

// 相对页面基址解析，兼容部署在子路径下的宿主；路由实现见 src/host.ts
const ENDPOINT = 'aiworkflow/';
const OPEN_INTERVAL = 2000;
const CLOSED_INTERVAL = 6000;

export function createProgressStore(): ProgressStore {
  let state: ProgressSnapshot = {
    open: false,
    loading: true,
    available: false,
    reason: null,
    active: [],
    recent: [],
    detail: null,
    selectedId: null,
    sessionId: null,
    dbPath: '',
    updatedAt: null,
    error: null,
    endpoint: '',
  };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;
  let disposed = false;
  let polling = false;

  const publish = (patch: Partial<ProgressSnapshot>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (): void => {
    clearTimer();
    if (disposed || !polling) return;
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, state.open ? OPEN_INTERVAL : CLOSED_INTERVAL);
  };

  const load = async (): Promise<void> => {
    if (disposed) return;
    inflight?.abort();
    const controller = new AbortController();
    inflight = controller;
    const url = resolveEndpoint(ENDPOINT);
    if (state.sessionId !== null) url.searchParams.set('session', state.sessionId);
    if (state.selectedId !== null) url.searchParams.set('run', state.selectedId);
    publish({ endpoint: url.toString() });
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      const body = (await response.json()) as any;
      if (body === null || typeof body !== 'object') throw new Error(`unexpected response ${response.status}`);
      if (body.ok === false) {
        publish({ loading: false, error: body.error?.message ?? `HTTP ${response.status}` });
        return;
      }
      publish({
        loading: false,
        error: null,
        available: body.available === true,
        reason: typeof body.reason === 'string' ? body.reason : null,
        active: Array.isArray(body.active) ? body.active : [],
        recent: Array.isArray(body.recent) ? body.recent : [],
        detail: body.detail ?? null,
        selectedId: typeof body.selectedId === 'string' ? body.selectedId : state.selectedId,
        dbPath: typeof body.dbPath === 'string' ? body.dbPath : state.dbPath,
        updatedAt: Date.now(),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      publish({
        loading: false,
        error: `无法连接插件 Host 半：${errorText(error)}`,
      });
    } finally {
      if (inflight === controller) inflight = null;
    }
  };

  const tick = async (): Promise<void> => {
    if (disposed || !polling) return;
    if (document.visibilityState === 'hidden') {
      schedule();
      return;
    }
    await load();
    schedule();
  };

  const start = (): void => {
    if (polling) return;
    polling = true;
    void tick();
  };

  const stop = (): void => {
    polling = false;
    clearTimer();
    inflight?.abort();
    inflight = null;
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible' && polling) void tick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot(): ProgressSnapshot {
      return state;
    },
    toggle(): void {
      publish({ open: !state.open });
      if (state.open) void tick();
      else schedule();
    },
    setOpen(open: boolean): void {
      if (state.open === open) return;
      publish({ open });
      if (open) void tick();
      else schedule();
    },
    setSession(sessionId: string | null): void {
      const next = sessionId === null || sessionId === '' ? null : sessionId;
      if (state.sessionId === next) return;
      // 先清空：切会话时不能把上一个会话的 run 留在面板上
      publish({ sessionId: next, active: [], recent: [], detail: null, selectedId: null, loading: true, error: null });
      void load();
    },
    select(runId: string): void {
      if (state.selectedId === runId) return;
      // 先切选中项，详情等下一次响应替换；不阻塞点击反馈
      publish({ selectedId: runId, loading: true });
      void load();
    },
    refresh(): void {
      void load();
    },
    dispose(): void {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      listeners.clear();
    },
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
