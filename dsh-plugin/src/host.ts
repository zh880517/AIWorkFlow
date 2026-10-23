// Host 半：只读监控 + flow 图读写。
// 监控走 node:sqlite 只读查询；图编辑直接写 SQLite（唯一事实源）并刷新 flows/*.json 镜像，
// 校验复用主工程的 validateFlow，语义与 src/core/flowStore.ts 一致。
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  readMonitorState,
  trimPayload,
  type RunDetail,
  type RunListItem,
} from '@shared/index.js';
import { deleteFlow, getFlow, listFlows, saveFlow, type FlowWriter } from '@shared/flows.js';
import { closeDatabase, database, databasePath, flowsDir } from './db.js';
import { workflowEngine } from './engine.js';
import { registerTools } from './tools.js';

/** 路由前缀：不以 `/` 结尾（宿主按 `path === prefix || path.startsWith(prefix + '/')` 匹配） */
const ROUTE_PREFIX = '/aiworkflow';
const STATE_PATHS = new Set(['/aiworkflow', '/aiworkflow/', '/aiworkflow/state']);
const FLOWS_PATH = '/aiworkflow/flows';
const RUNS_PATH = '/aiworkflow/runs';

/** apply 时记下的插件上下文，HTTP 处理里要用它拿 agents 服务 */
let pluginCtx: any = null;

export const inject = ['webServer', 'tools'];

interface StatePayload {
  ok: true;
  available: boolean;
  reason: string | null;
  dbPath: string;
  generatedAt: string;
  active: RunListItem[];
  recent: RunListItem[];
  selectedId: string | null;
  detail: RunDetail | null;
}

export function apply(ctx: any): void {
  pluginCtx = ctx;
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: handleRequest,
    });
    return () => {
      disposeRoute();
      closeDatabase();
    };
  });

  // 同一批操作也暴露给 Agent：面板点、Agent 调，改的是同一份数据
  ctx.effect(() => registerTools(ctx));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const method = req.method ?? 'GET';

    if (method === 'OPTIONS') {
      // 桌面壳用 file:// 载入渲染器时页面源是 null，需要显式放行跨源读写
      res.statusCode = 204;
      setCorsHeaders(res);
      res.end();
      return;
    }

    if (STATE_PATHS.has(url.pathname)) {
      if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res);
      send(res, 200, buildState(url.searchParams.get('run'), url.searchParams.get('session')));
      return;
    }

    if (url.pathname === RUNS_PATH || url.pathname === `${RUNS_PATH}/`) {
      if (method !== 'POST') return methodNotAllowed(res);
      const body = await readJson(req);
      const flowId = readFlowId(body);
      if (flowId === null) {
        send(res, 400, { ok: false, error: { code: 'bad-request', message: '需要 flowId（流程 id 或展示名）' } });
        return;
      }
      try {
        // 界面会带上当前会话 id；没有时退回"唯一活跃会话"，再没有就不绑
        const explicit = readSessionId(body);
        const roots = explicit === null ? liveRoots() : [];
        const boundSession = explicit ?? (roots.length === 1 ? roots[0]!.id : null);
        const hostSession = boundSession === null ? undefined : `dsh:${boundSession}`;
        const result = workflowEngine().startRun({ flowName: flowId, hostSession });
        const failed = (result as { error?: boolean }).error === true;
        const woke = failed || boundSession === null ? false : wakeAgent(boundSession, flowId, readNote(body));
        send(res, 200, { ok: true, bound: hostSession ?? null, woke, result });
      } catch (error) {
        send(res, 500, { ok: false, error: { code: 'start-failed', message: errorText(error) } });
      }
      return;
    }

    if (url.pathname === FLOWS_PATH || url.pathname === `${FLOWS_PATH}/`) {
      if (method === 'GET') {
        send(res, 200, { ok: true, flows: listFlows(database()) });
        return;
      }
      return methodNotAllowed(res);
    }

    if (url.pathname.startsWith(`${FLOWS_PATH}/`)) {
      const flowId = decodeURIComponent(url.pathname.slice(FLOWS_PATH.length + 1));
      if (flowId === '') return sendNotFound(res, url.pathname);
      if (method === 'GET' || method === 'HEAD') {
        const flow = getFlow(database(), flowId);
        if (flow === undefined) return sendNotFound(res, url.pathname);
        send(res, 200, { ok: true, flow });
        return;
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        if (body === undefined) {
          send(res, 400, { ok: false, error: { code: 'bad-json', message: '请求体不是合法 JSON' } });
          return;
        }
        const flow = body as Record<string, unknown>;
        if (typeof flow.id !== 'string' || flow.id !== flowId) {
          send(res, 400, { ok: false, error: { code: 'id-mismatch', message: '图 id 与 URL 不一致' } });
          return;
        }
        const result = saveFlow(database() as unknown as FlowWriter, flow as never, flowsDir());
        if (!result.ok) {
          send(res, 200, { ok: false, errors: result.errors, warnings: result.warnings });
          return;
        }
        send(res, 200, { ok: true, flow: result.flow, warnings: result.warnings });
        return;
      }
      if (method === 'DELETE') {
        const deleted = deleteFlow(database() as unknown as FlowWriter, flowId, flowsDir());
        send(res, 200, { ok: true, deleted });
        return;
      }
      return methodNotAllowed(res);
    }

    sendNotFound(res, url.pathname);
  } catch (error) {
    send(res, 500, {
      ok: false,
      error: { code: 'internal', message: errorText(error) },
    });
  }
}

/** 启动入口没有会话上下文，只有唯一活跃会话时才绑定它 */
function liveRoots(): Array<{ id: string }> {
  try {
    const roots = pluginCtx?.get?.('agents')?.roots?.();
    if (!Array.isArray(roots)) return [];
    return roots
      .map((agent: { id?: unknown }) => agent)
      .filter((agent: { id?: unknown }) => typeof agent?.id === 'string')
      .map((agent: { id?: unknown }) => ({ id: agent.id as string }));
  } catch {
    return [];
  }
}

/**
 * 唤醒绑定的 Agent（与定时提醒同一套机制：followup 一条用户态消息）。
 * 只是尽力而为：拿不到 agents 服务或 Agent 不在线时静默跳过，run 仍会等下一次对话。
 */
function wakeAgent(sessionId: string, flowRef: string, note: string | null): boolean {
  try {
    const agent = pluginCtx?.get?.('agents')?.get?.(sessionId) as
      | { followup?: (message: unknown) => void }
      | undefined;
    if (agent === undefined || typeof agent.followup !== 'function') return false;
    let label = flowRef;
    try {
      label = getFlow(database(), flowRef)?.name ?? flowRef;
    } catch {
      // 库读不到就用传入的 id
    }
    const head = `【aiworkflow】已启动流程「${label}」，run 已创建并绑定当前会话。`;
    const supplied = note === null ? '' : `\n用户随运行一起提交的补充信息：\n"""\n${note}\n"""\n`;
    const text =
      head +
      supplied +
      '请调用 aiworkflow_get_current_step 领取第一步并开始执行，之后每步做完调 aiworkflow_complete_step 回报。';
    agent.followup({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'schedule' },
    });
    return true;
  } catch {
    return false;
  }
}

/** 输入框里带过来的补充信息（可空） */
function readNote(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as Record<string, unknown>).note;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readSessionId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as Record<string, unknown>).sessionId;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readFlowId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  for (const key of ['flowId', 'flowName']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function methodNotAllowed(res: ServerResponse): void {
  send(res, 405, { ok: false, error: { code: 'method-not-allowed', message: 'method not allowed' } });
}

function sendNotFound(res: ServerResponse, pathname: string): void {
  send(res, 404, { ok: false, error: { code: 'not-found', message: `unknown route ${pathname}` } });
}

function buildState(runId: string | null, sessionId: string | null): StatePayload {
  const file = databasePath();
  const base: StatePayload = {
    ok: true,
    available: false,
    reason: null,
    dbPath: file,
    generatedAt: new Date().toISOString(),
    active: [],
    recent: [],
    selectedId: null,
    detail: null,
  };
  try {
    const db = database();
    const state = readMonitorState(db, runId, {}, hostSessionOf(sessionId));
    return {
      ...base,
      available: true,
      selectedId: state.selectedId,
      active: state.active,
      recent: state.recent,
      detail: state.detail === null ? null : trimDetail(state.detail),
    };
  } catch (error) {
    // 读失败（库被删 / 版本不符 / 锁）时丢弃连接，下一次请求重新打开
    closeDatabase();
    return {
      ...base,
      reason: describeDatabaseError(error, file),
    };
  }
}

/** 界面传原始会话 id；库里存的是 `dsh:<sessionId>`（与 start_run / 面板启动一致） */
function hostSessionOf(sessionId: string | null): string | null {
  if (sessionId === null) return null;
  const value = sessionId.trim();
  if (value === '') return null;
  return value.startsWith('dsh:') ? value : `dsh:${value}`;
}

function trimDetail(detail: RunDetail): RunDetail {
  return {
    ...detail,
    executions: detail.executions.map((exec) => ({ ...exec, payload: trimPayload(exec.payload) })),
  };
}

function describeDatabaseError(error: unknown, file: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'ENOENT' || code === 'SQLITE_CANTOPEN') {
    return `未找到 ${file}：先运行 npx aiworkflow，面板会自动出现数据。`;
  }
  return `读取 ${file} 失败：${errorText(error)}`;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > 2 * 1024 * 1024) throw new Error('请求体过大');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  setCorsHeaders(res);
  res.end(text);
}

/**
 * 只读本地数据的跨源放行：页面可能来自 `dsh web`（同源，无需 CORS），
 * 也可能来自桌面壳的 file:// 渲染器（源为 null），后者必须显式允许。
 */
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, HEAD, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', 'accept, content-type');
  res.setHeader('access-control-max-age', '600');
}
