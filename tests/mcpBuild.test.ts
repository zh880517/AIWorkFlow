// 建图类 MCP 端点端到端测试：独立端点 /mcp-build、工具集与执行端点 /mcp 互不可见、
// create/update/get/validate/list 回环、硬拒不落库、自愈式指引。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { openMemoryDb } from '../src/core/db.js';
import { FlowStore } from '../src/core/flowStore.js';
import { ExecutionEngine } from '../src/core/engine.js';
import { createApp, startServer } from '../src/server/http.js';
import type { Flow } from '../src/core/types.js';

const TOKEN = 'test-token-build';

let tmpHome: string;
let server: Server;
let port: number;
let store: FlowStore;

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-mcpbuild-'));
  process.env.AIWORKFLOW_HOME = tmpHome;

  const db = openMemoryDb();
  store = new FlowStore(db, path.join(tmpHome, 'flows'));
  const engine = new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n) });
  const app = createApp({ store, token: TOKEN, engine, db });
  server = startServer(app, 0) as unknown as Server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  server.close();
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

async function connectBuild(token = TOKEN): Promise<Client> {
  const client = new Client({ name: 'test-build-host', version: '1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp-build?k=${token}`)));
  return client;
}

function payloadOf(result: unknown): any {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  return JSON.parse(content.find((c) => c.type === 'text')!.text);
}

const validFlow = (): Flow => ({
  id: 'f_build_demo',
  name: '建图演示',
  entry: 'n1',
  nodes: [
    { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
    { id: 'n2', type: 'end', outcome: 'success' },
  ],
});

describe('建图 MCP 端点（/mcp-build）', () => {
  it('工具清单恰好是建图五件套，与执行端点 /mcp 互不可见', async () => {
    const build = await connectBuild();
    try {
      const { tools } = await build.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        'create_flow',
        'get_flow',
        'list_flows',
        'update_flow',
        'validate_flow',
      ]);
      const exec = new Client({ name: 'test-exec-host', version: '1.0' });
      await exec.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp?k=${TOKEN}`)),
      );
      try {
        const { tools: execTools } = await exec.listTools();
        const names = execTools.map((t) => t.name).sort();
        expect(names).toEqual(['answer_gate', 'await_gate', 'complete_step', 'get_current_step', 'list_flows', 'report_blocked', 'start_run']);
        for (const t of ['create_flow', 'update_flow', 'validate_flow', 'get_flow']) {
          expect(names).not.toContain(t);
        }
      } finally {
        await exec.close();
      }
    } finally {
      await build.close();
    }
  });

  it('错误 token → 401', async () => {
    await expect(connectBuild('wrong-token')).rejects.toThrow();
  });

  it('validate_flow 干跑：坏图给结构化 errors 且不落库；好图全绿', async () => {
    const client = await connectBuild();
    try {
      const bad = payloadOf(
        await client.callTool({
          name: 'validate_flow',
          arguments: { flow: { ...validFlow(), nodes: [{ id: 'n1', type: 'prompt' }] } },
        }),
      );
      expect(bad.error).toBe(true);
      expect(bad.errors.length).toBeGreaterThan(0);
      expect(bad.errors[0].code).toMatch(/^E_/);

      const good = payloadOf(await client.callTool({ name: 'validate_flow', arguments: { flow: validFlow() } }));
      expect(good).toMatchObject({ ok: true, saved: false });

      // 干跑后不落库：列表里不该出现（空列表时 list_flows 返回纯文本提示，同样不含该 id）
      const listRes = await client.callTool({ name: 'list_flows', arguments: {} });
      const listText = (listRes as { content: Array<{ type: string; text: string }> }).content
        .find((c) => c.type === 'text')!
        .text;
      expect(listText).not.toContain('f_build_demo');
    } finally {
      await client.close();
    }
  });

  it('create_flow → get_flow（按名/按 id）→ update_flow 覆盖回环', async () => {
    const client = await connectBuild();
    try {
      const created = payloadOf(await client.callTool({ name: 'create_flow', arguments: { flow: validFlow() } }));
      expect(created).toMatchObject({ ok: true, saved: true, flowId: 'f_build_demo', warnings: [] });

      const byName = payloadOf(await client.callTool({ name: 'get_flow', arguments: { flowId: '建图演示' } }));
      expect(byName).toEqual(validFlow());

      const updated: Flow = {
        ...validFlow(),
        nodes: [
          { id: 'n1', type: 'prompt', instruction: '改过的第一步', next: 'n2' },
          { id: 'n2', type: 'end', outcome: 'success' },
        ],
      };
      const res = payloadOf(await client.callTool({ name: 'update_flow', arguments: { flow: updated } }));
      expect(res).toMatchObject({ ok: true, saved: true });
      const byId = payloadOf(await client.callTool({ name: 'get_flow', arguments: { flowId: 'f_build_demo' } }));
      expect(byId.nodes[0].instruction).toBe('改过的第一步');
    } finally {
      await client.close();
    }
  });

  it('create_flow 撞已有 id / update_flow 更新不存在的 id → 自愈指引，不误伤原图', async () => {
    const client = await connectBuild();
    try {
      const dup = payloadOf(await client.callTool({ name: 'create_flow', arguments: { flow: validFlow() } }));
      expect(dup.error).toBe(true);
      expect(dup.guidance).toContain('update_flow');

      const miss = payloadOf(
        await client.callTool({
          name: 'update_flow',
          arguments: { flow: { ...validFlow(), id: 'f_not_exist' } },
        }),
      );
      expect(miss.error).toBe(true);
      expect(miss.guidance).toContain('create_flow');

      // 原图未被坏操作影响
      const still = payloadOf(await client.callTool({ name: 'get_flow', arguments: { flowId: 'f_build_demo' } }));
      expect(still.id).toBe('f_build_demo');
    } finally {
      await client.close();
    }
  });

  it('create_flow 硬拒不落库：原图保持，errors 可读', async () => {
    const client = await connectBuild();
    try {
      const bad = payloadOf(
        await client.callTool({
          name: 'create_flow',
          arguments: {
            flow: { id: 'f_bad_build', name: '坏图', entry: 'n1', nodes: [{ id: 'n1', type: 'prompt' }] },
          },
        }),
      );
      expect(bad.error).toBe(true);
      expect(bad.what).toContain('E_');
      const miss = payloadOf(await client.callTool({ name: 'get_flow', arguments: { flowId: 'f_bad_build' } }));
      expect(miss.error).toBe(true);
    } finally {
      await client.close();
    }
  });
});
