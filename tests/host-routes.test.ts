// Host 路由的写路径守门：编辑器/面板保存图走的是 PUT，不能只靠手动冒烟。
// 用假 ctx 拿到 apply 注册的 handler，直接喂 IncomingMessage / ServerResponse 的最小替身。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../dsh-plugin/src/host.js';
import { closeDatabase } from '../dsh-plugin/src/db.js';

interface Mounted {
  handler: (req: unknown, res: unknown) => Promise<void>;
  dispose: () => void;
}

function mountHost(): Mounted {
  const disposers: Array<() => void> = [];
  let handler: Mounted['handler'] | null = null;
  const ctx = {
    effect(fn: () => unknown) {
      const dispose = fn();
      if (typeof dispose === 'function') disposers.push(dispose as () => void);
    },
    webServer: {
      register(opts: { handler: Mounted['handler'] }) {
        handler = opts.handler;
        return () => {};
      },
    },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
  };
  apply(ctx);
  if (handler === null) throw new Error('host 没有注册路由');
  return {
    handler,
    dispose: () => {
      for (const dispose of disposers.reverse()) dispose();
    },
  };
}

function fakeReq(method: string, url: string, body?: unknown): unknown {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  stream.method = method;
  stream.url = url;
  stream.headers = {};
  return stream;
}

function fakeRes(): {
  statusCode: number;
  headers: Record<string, string | number>;
  text: string;
  setHeader: (name: string, value: string | number) => void;
  end: (chunk?: string | Buffer) => void;
} {
  const out = {
    statusCode: 0,
    headers: {} as Record<string, string | number>,
    text: '',
    setHeader(name: string, value: string | number) {
      out.headers[name] = value;
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) out.text += chunk.toString();
    },
  };
  return out;
}

async function call(mounted: Mounted, method: string, url: string, body?: unknown): Promise<{
  status: number;
  json: any;
}> {
  const res = fakeRes();
  await mounted.handler(fakeReq(method, url, body), res);
  return { status: res.statusCode, json: JSON.parse(res.text) as any };
}

const flow = {
  id: 'f_host_routes',
  name: '宿主路由图',
  kind: 'flow',
  entry: 'n1',
  nodes: [{ id: 'n1', type: 'end', outcome: 'success' }],
};

let mounted: Mounted;
let home: string;

beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-host-routes-'));
  process.env.AIWORKFLOW_HOME = home;
  mounted = mountHost();
});

afterAll(() => {
  mounted.dispose();
  closeDatabase();
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('Host 路由：流程图 CRUD', () => {
  it('PUT 保存 → GET 读回 → DELETE 删除', async () => {
    const saved = await call(mounted, 'PUT', `/aiworkflow/flows/${flow.id}`, flow);
    expect(saved.status).toBe(200);
    expect(saved.json.ok).toBe(true);

    const read = await call(mounted, 'GET', `/aiworkflow/flows/${flow.id}`);
    expect(read.status).toBe(200);
    expect(read.json.flow).toEqual(flow);

    const deleted = await call(mounted, 'DELETE', `/aiworkflow/flows/${flow.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.json.deleted).toBe(true);

    const gone = await call(mounted, 'GET', `/aiworkflow/flows/${flow.id}`);
    expect(gone.status).toBe(404);
  });

  it('流程列表按 kind 过滤子 Agent 配置', async () => {
    const profile = {
      ...flow,
      id: 'f_host_agent',
      name: '子 Agent 配置',
      kind: 'agent',
      agents: [{ id: 'reviewer', name: '评审员', charter: '挑剔' }],
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '评审' },
      ],
      entry: 'n1',
    };
    expect((await call(mounted, 'PUT', `/aiworkflow/flows/${flow.id}`, flow)).json.ok).toBe(true);
    expect((await call(mounted, 'PUT', `/aiworkflow/flows/${profile.id}`, profile)).json.ok).toBe(true);

    const agents = await call(mounted, 'GET', '/aiworkflow/flows?kind=agent');
    expect(agents.json.flows.map((item: { id: string }) => item.id)).toEqual(['f_host_agent']);
    expect(agents.json.flows[0].kind).toBe('agent');

    // 启动工作流面板拉的就是这个视图：只能是主流程，配置不能出现在里面
    const flows = await call(mounted, 'GET', '/aiworkflow/flows?kind=flow');
    expect(flows.json.flows.map((item: { id: string }) => item.id)).toEqual(['f_host_routes']);
    expect(flows.json.flows.every((item: { kind: string }) => item.kind === 'flow')).toBe(true);

    expect((await call(mounted, 'DELETE', `/aiworkflow/flows/${profile.id}`)).json.deleted).toBe(true);
  });

  it('校验失败不落库，原图保持不变', async () => {
    const good = await call(mounted, 'PUT', `/aiworkflow/flows/${flow.id}`, flow);
    expect(good.json.ok).toBe(true);

    const broken = { ...flow, entry: 'missing' };
    const rejected = await call(mounted, 'PUT', `/aiworkflow/flows/${flow.id}`, broken);
    expect(rejected.status).toBe(200);
    expect(rejected.json.ok).toBe(false);
    expect(rejected.json.errors.length).toBeGreaterThan(0);

    const read = await call(mounted, 'GET', `/aiworkflow/flows/${flow.id}`);
    expect(read.json.flow).toEqual(flow);
  });

  it('URL id 与 body id 不一致 → 400，不写库', async () => {
    const mismatch = await call(mounted, 'PUT', '/aiworkflow/flows/other', flow);
    expect(mismatch.status).toBe(400);
    expect(mismatch.json.error.code).toBe('id-mismatch');
    const read = await call(mounted, 'GET', '/aiworkflow/flows/other');
    expect(read.status).toBe(404);
  });

  it('坏 JSON → 400', async () => {
    const res = fakeRes();
    const broken = Readable.from([Buffer.from('{not json')]) as unknown as {
      method: string;
      url: string;
      headers: Record<string, string>;
    };
    broken.method = 'PUT';
    broken.url = `/aiworkflow/flows/${flow.id}`;
    broken.headers = {};
    await mounted.handler(broken, res);
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.text) as any).error.code).toBe('bad-json');
  });

  it('POST /runs/abandon 能把进行中的 run 置为 failed', async () => {
    const runnable = {
      id: 'f_host_abandon',
      name: '可放弃的图',
      kind: 'flow',
      entry: 'a1',
      nodes: [
        { id: 'a1', type: 'prompt', instruction: '第一步', next: 'a2' },
        { id: 'a2', type: 'end', outcome: 'success' },
      ],
    };
    expect((await call(mounted, 'PUT', `/aiworkflow/flows/${runnable.id}`, runnable)).json.ok).toBe(true);

    const started = await call(mounted, 'POST', '/aiworkflow/runs', { flowId: runnable.id });
    expect(started.json.ok).toBe(true);
    const runId = started.json.result.runId as string;
    expect(runId).toMatch(/^run_/);

    const abandoned = await call(mounted, 'POST', '/aiworkflow/runs/abandon', { runId });
    expect(abandoned.status).toBe(200);
    expect(abandoned.json.ok).toBe(true);
    expect(abandoned.json.result.abandoned).toBeGreaterThanOrEqual(1);

    const state = await call(mounted, 'GET', `/aiworkflow/state?run=${runId}`);
    expect(state.json.detail.id).toBe(runId);
    expect(state.json.detail.status).toBe('failed');
    expect(state.json.detail.outcome).toBe('fail');
  });

  it('POST /runs/abandon 缺少 runId → 400', async () => {
    const res = await call(mounted, 'POST', '/aiworkflow/runs/abandon', {});
    expect(res.status).toBe(400);
  });
});
