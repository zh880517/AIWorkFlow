// HTTP 服务：面板 REST API（/api/*，token 鉴权）+ 静态面板（dist-web）。
// MCP 端点（/mcp）在 Phase 2 加入。服务只绑 127.0.0.1（设计文档 §3）。
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ServerType } from '@hono/node-server';
import fs from 'node:fs';
import path from 'node:path';
import type { Flow } from '../core/types.js';
import type { FlowStore } from '../core/flowStore.js';

export interface ServerDeps {
  store: FlowStore;
  token: string;
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

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
