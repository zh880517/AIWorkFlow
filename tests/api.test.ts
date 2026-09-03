import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from '../src/core/db.js';
import { FlowStore } from '../src/core/flowStore.js';
import { createApp } from '../src/server/http.js';
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
