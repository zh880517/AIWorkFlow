import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from '../src/core/db.js';
import { FlowStore } from '../src/core/flowStore.js';
import { ExecutionEngine } from '../src/core/engine.js';
import { createApp } from '../src/server/http.js';
import { createEventBus } from '../src/server/events.js';
import type { Flow } from '../src/core/types.js';

let tmpHome: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-api-test-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
});

afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const TOKEN = 'test-token';

function makeApp(): { app: ReturnType<typeof createApp>; store: FlowStore } {
  const db = openMemoryDb();
  const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
  return { app: createApp({ store, token: TOKEN }), store };
}

const linearFlow = (id: string): Flow => ({
  id,
  name: '直线图',
  entry: 'n1',
  nodes: [
    { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
    { id: 'n2', type: 'end', outcome: 'success' },
  ],
});

describe('面板 API', () => {
  it('无 token 401，错 token 401，对 token 通过', async () => {
    const { app } = makeApp();
    expect((await app.request('/api/flows')).status).toBe(401);
    expect((await app.request('/api/flows?k=wrong')).status).toBe(401);
    expect((await app.request(`/api/flows?k=${TOKEN}`)).status).toBe(200);
  });

  it('Bearer 头也接受 token', async () => {
    const { app } = makeApp();
    const res = await app.request('/api/flows', { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(200);
  });

  it('PUT 保存合法图 → 200；GET 读回；列表可见', async () => {
    const { app } = makeApp();
    const flow = linearFlow('f_api_1');
    const put = await app.request(`/api/flows/f_api_1?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ ok: true, warnings: [] });

    const got = await app.request(`/api/flows/f_api_1?k=${TOKEN}`);
    expect(await got.json()).toEqual(flow);

    const list = await app.request(`/api/flows?k=${TOKEN}`);
    const items = (await list.json()) as Array<{ id: string }>;
    expect(items.map((i) => i.id)).toContain('f_api_1');
  });

  it('PUT 硬拒图 → 400 且不落库，错误列表可读', async () => {
    const { app } = makeApp();
    const bad = {
      ...linearFlow('f_bad'),
      nodes: [{ id: 'n1', type: 'prompt' }], // 缺 instruction、entry 悬空、无终点
    } as unknown as Flow;
    const put = await app.request(`/api/flows/f_bad?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bad),
    });
    expect(put.status).toBe(400);
    const body = (await put.json()) as { ok: boolean; errors: Array<{ code: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);

    const got = await app.request(`/api/flows/f_bad?k=${TOKEN}`);
    expect(got.status).toBe(404);
  });

  it('PUT body id 与 URL id 不一致 → 400', async () => {
    const { app } = makeApp();
    const put = await app.request(`/api/flows/f_other?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linearFlow('f_mismatch')),
    });
    expect(put.status).toBe(400);
  });

  it('警告允许保存并返回 warnings', async () => {
    const { app } = makeApp();
    const warnFlow: Flow = {
      id: 'f_warn',
      name: '缺 default',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [{ id: 'b1', condition: '通过', to: 'n2' }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const put = await app.request(`/api/flows/f_warn?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(warnFlow),
    });
    expect(put.status).toBe(200);
    const body = (await put.json()) as { ok: boolean; warnings: Array<{ code: string }> };
    expect(body.ok).toBe(true);
    expect(body.warnings.map((w) => w.code)).toContain('W_NO_DEFAULT');
  });

  it('DELETE 删除后 GET 404；再删 404', async () => {
    const { app } = makeApp();
    await app.request(`/api/flows/f_del?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linearFlow('f_del')),
    });
    expect((await app.request(`/api/flows/f_del?k=${TOKEN}`, { method: 'DELETE' })).status).toBe(200);
    expect((await app.request(`/api/flows/f_del?k=${TOKEN}`)).status).toBe(404);
    expect((await app.request(`/api/flows/f_del?k=${TOKEN}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('面板的 _ui 布局字段随图一起保存，不参与校验', async () => {
    const { app } = makeApp();
    const flow: Flow = {
      ...linearFlow('f_ui'),
      _ui: { positions: { n1: { x: 11, y: 22 }, n2: { x: 33, y: 44 } } },
    };
    const put = await app.request(`/api/flows/f_ui?k=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    expect(put.status).toBe(200);
    const got = await app.request(`/api/flows/f_ui?k=${TOKEN}`);
    expect(await got.json()).toEqual(flow);
  });
});

describe('监控只读 API（/api/runs，阶段 4）', () => {
  function makeAppWithRuns(): { app: ReturnType<typeof createApp>; store: FlowStore; engine: ExecutionEngine } {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
    const engine = new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n) });
    return { app: createApp({ store, token: TOKEN, engine, db }), store, engine };
  }

  it('run 列表与详情：引擎真实推进后可查，字段齐全', async () => {
    const { app, store, engine } = makeAppWithRuns();
    expect(store.save(linearFlow('f_runs')).ok).toBe(true);
    const start = engine.startRun({ flowName: '直线图', cwd: 'D:/work/demo', projectName: 'demo' });
    if (!('step' in start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '完成', payload: { ok: 1 } });

    const list = await app.request(`/api/runs?k=${TOKEN}`);
    expect(list.status).toBe(200);
    const items = (await list.json()) as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: start.runId,
      flowId: 'f_runs',
      flowName: '直线图',
      status: 'completed',
      stepsUsed: 1,
      cwd: 'D:/work/demo',
      projectName: 'demo',
    });

    const detail = await app.request(`/api/runs/${start.runId}?k=${TOKEN}`);
    expect(detail.status).toBe(200);
    const d = (await detail.json()) as {
      snapshotHash: string;
      executions: Array<Record<string, unknown>>;
    };
    expect(d.snapshotHash).toMatch(/^[0-9a-f]{16}$/);
    expect(d.executions).toHaveLength(1);
    expect(d.executions[0]).toMatchObject({
      nodeId: 'n1',
      iteration: 1,
      status: 'completed',
      summary: '完成',
      payload: { ok: 1 },
    });
  });

  it('鉴权同 /api/*：无 token 401；run 不存在 404', async () => {
    const { app } = makeAppWithRuns();
    expect((await app.request('/api/runs')).status).toBe(401);
    expect((await app.request(`/api/runs/run_missing?k=${TOKEN}`)).status).toBe(404);
  });
});

describe('SSE 与停滞清扫（阶段 4）', () => {
  function makeAppWithBus(): { app: ReturnType<typeof createApp>; store: FlowStore; engine: ExecutionEngine; db: import('better-sqlite3').Database } {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
    const bus = createEventBus();
    const engine = new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n), onEvent: bus.broadcast });
    return { app: createApp({ store, token: TOKEN, engine, db, events: bus }), store, engine, db };
  }

  it('/api/events：hello 握手 + 引擎动作实时推送 + 鉴权', async () => {
    const { app, store, engine } = makeAppWithBus();
    expect(store.save(linearFlow('f_sse')).ok).toBe(true);
    expect((await app.request('/api/events')).status).toBe(401);

    const res = await app.request(`/api/events?k=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const readUntil = async (needle: string): Promise<void> => {
      const deadline = Date.now() + 2000;
      while (!buf.includes(needle)) {
        if (Date.now() > deadline) throw new Error(`SSE 2 秒内没等到「${needle}」，已收到：${buf}`);
        const { value } = await Promise.race([
          reader.read(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('SSE read timeout')), 1900)),
        ]);
        buf += decoder.decode(value, { stream: true });
      }
    };
    try {
      await readUntil('event: hello');
      const start = engine.startRun({ flowName: '直线图' });
      if (!('step' in start)) throw new Error('start 失败');
      await readUntil('run_started');
      expect(buf).toContain(start.runId);
    } finally {
      await reader.cancel();
    }
  });

  it('24 小时无活动的活跃 run 被列表请求自动标 stale', async () => {
    const { app, store, engine, db } = makeAppWithBus();
    expect(store.save(linearFlow('f_stale')).ok).toBe(true);
    const a = engine.startRun({ flowName: '直线图' });
    if (!('step' in a)) throw new Error('start 失败');
    const b = engine.startRun({ flowName: '直线图' });
    if (!('step' in b)) throw new Error('start 失败');
    // 把 a 的 last_activity 拨回 25 小时前
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE runs SET last_activity = ? WHERE id = ?').run(old, a.runId);

    const list = (await (await app.request(`/api/runs?k=${TOKEN}`)).json()) as Array<{ id: string; status: string }>;
    const byId = Object.fromEntries(list.map((r) => [r.id, r.status]));
    expect(byId[a.runId]).toBe('stale');
    expect(byId[b.runId]).toBe('running');
  });

  it('run 详情附带快照图（copy-on-run 那份）', async () => {
    const { app, store, engine } = makeAppWithBus();
    expect(store.save(linearFlow('f_snap')).ok).toBe(true);
    const start = engine.startRun({ flowName: '直线图' });
    if (!('step' in start)) throw new Error('start 失败');
    const d = (await (await app.request(`/api/runs/${start.runId}?k=${TOKEN}`)).json()) as {
      snapshot: { rootFlowId: string; flows: Record<string, { id: string }> } | null;
    };
    expect(d.snapshot).not.toBeNull();
    expect(d.snapshot!.rootFlowId).toBe('f_snap');
    expect(d.snapshot!.flows['f_snap'].id).toBe('f_snap');
  });
});
