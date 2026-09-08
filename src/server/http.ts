// HTTP 服务：面板 REST API（/api/*，token 鉴权）+ MCP 端点（/mcp）+ 静态面板（dist-web）。
// 服务只绑 127.0.0.1（设计文档 §3）。
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ServerType } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { Flow } from '../core/types.js';
import type { FlowStore } from '../core/flowStore.js';
import type { ExecutionEngine } from '../core/engine.js';
import { createMcpApp } from './mcp.js';
import { createMcpBuildApp } from './mcpBuild.js';
import { listRuns, getRunDetail } from '../core/runQuery.js';
import type { EventBus } from './events.js';

export interface ServerDeps {
  store: FlowStore;
  token: string;
  /** 执行引擎（MCP 端点用；Phase 2 起必传） */
  engine?: ExecutionEngine;
  /** 监控只读查询用（阶段 4 起传入；不传则 /api/runs 不注册） */
  db?: Database.Database;
  /** SSE 事件总线（阶段 4；不传则 /api/events 不注册） */
  events?: EventBus;
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

  // MCP 执行端点（Streamable HTTP，token 鉴权在 mcp.ts 内）
  if (deps.engine !== undefined) {
    app.route('/', createMcpApp({ engine: deps.engine, store: deps.store, token: deps.token }));
  }

  // MCP 建图端点：与执行端点分开（给建图的 AI 用，工具集只有建图五件套）
  app.route('/', createMcpBuildApp({ store: deps.store, token: deps.token }));

  // token 鉴权：查询参数 k 或 Bearer 头（面板静态资源本身不含数据，只拦 API）
  app.use('/api/*', async (c, next) => {
    const k = c.req.query('k') ?? c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (k !== deps.token) return c.json({ error: 'invalid token' }, 401);
    await next();
  });

  app.get('/api/flows', (c) => c.json(deps.store.list()));

  app.get('/api/flows/:id', (c) => {
    const flow = deps.store.get(c.req.param('id'));
    if (flow === undefined) return c.json({ error: 'flow not found' }, 404);
    return c.json(flow);
  });

  app.put('/api/flows/:id', async (c) => {
    const flow = (await c.req.json()) as Flow;
    if (flow?.id !== c.req.param('id')) {
      return c.json({ error: 'body id 与 URL id 不一致' }, 400);
    }
    // 硬拒在 store.save 内拦截（先校验后落库）；警告允许保存并返回
    const result = deps.store.save(flow);
    if (!result.ok) {
      return c.json({ ok: false, errors: result.errors, warnings: result.warnings }, 400);
    }
    return c.json({ ok: true, warnings: result.warnings });
  });

  app.delete('/api/flows/:id', (c) => {
    const deleted = deps.store.delete(c.req.param('id'));
    return deleted ? c.json({ ok: true }) : c.json({ error: 'flow not found' }, 404);
  });

  // 监控只读查询（阶段 4）：run 列表 + 详情（含快照图与完整执行轨迹）
  const db = deps.db;
  if (db !== undefined) {
    app.get('/api/runs', (c) => c.json(listRuns(db)));
    app.get('/api/runs/:id', (c) => {
      const run = getRunDetail(db, c.req.param('id'));
      return run === undefined ? c.json({ error: 'run not found' }, 404) : c.json(run);
    });
  }

  // SSE 实时通道（§9.3）：事件即"该刷新了"的信号，面板收到后重拉 /api/runs
  if (deps.events !== undefined) {
    const bus = deps.events;
    app.get('/api/events', (c) =>
      streamSSE(c, async (stream) => {
        await stream.writeSSE({ event: 'hello', data: JSON.stringify({ at: new Date().toISOString() }) });
        let closed = false;
        const unsubscribe = bus.subscribe((e) => {
          if (closed) return;
          void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }).catch(() => {
            closed = true;
          });
        });
        stream.onAbort(() => {
          closed = true;
          unsubscribe();
        });
        let seq = 0;
        while (!closed) {
          await stream.sleep(15000);
          if (closed) break;
          await stream.writeSSE({ event: 'ping', data: String(seq++) });
        }
        unsubscribe();
      }),
    );
  }

  // 静态面板（Vite 构建产物）；root 需相对 cwd，dist-web 不存在时仅 API 可用
  const webDir = resolveWebDir();
  if (webDir !== undefined) {
    const rel = path.relative(process.cwd(), webDir).replace(/\\/g, '/');
    app.use('/*', serveStatic({ root: rel }));
    app.get('*', serveStatic({ root: rel, path: 'index.html' }));
  }

  return app;
}

/** 查找面板构建产物目录：cwd/dist-web → 包根/dist-web */
function resolveWebDir(): string | undefined {
  const candidates = [
    path.join(process.cwd(), 'dist-web'),
    path.join(path.resolve(import.meta.dirname, '..', '..'), 'dist-web'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
}

export function startServer(app: Hono, port: number, hostname = '127.0.0.1'): ServerType {
  return serve({ fetch: app.fetch, port, hostname });
}
