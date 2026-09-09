// MCP 端点端到端测试：真实 HTTP 服务 + SDK 客户端走 Streamable HTTP 协议。
// 覆盖：initialize 会话建立、工具清单、start_run → complete_step 全链路（含会话绑定定位 run）、token 鉴权。
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

const TOKEN = 'test-token-e2e';

let tmpHome: string;
let server: Server;
let port: number;
let store: FlowStore;
let engine: ExecutionEngine;

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-mcp-'));
  process.env.AIWORKFLOW_HOME = tmpHome;

  const db = openMemoryDb();
  store = new FlowStore(db, path.join(tmpHome, 'flows'));
  const linear: Flow = {
    id: 'f_linear',
    name: '直线图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
  const r = store.save(linear);
  if (!r.ok) throw new Error(`fixture 校验失败：${JSON.stringify(r.errors)}`);
  engine = new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n) });
  const app = createApp({ store, token: TOKEN, engine });
  server = startServer(app, 0) as unknown as Server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  server.close();
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

async function connect(token = TOKEN): Promise<Client> {
  const client = new Client({ name: 'test-host', version: '1.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp?k=${token}`),
  );
  await client.connect(transport);
  return client;
}

function payloadOf(result: unknown): any {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  return JSON.parse(content.find((c) => c.type === 'text')!.text);
}

describe('MCP Streamable HTTP 端点', () => {
  it('initialize 成功，工具清单含 7 个执行类工具', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([
        'answer_gate',
        'await_gate',
        'complete_step',
        'get_current_step',
        'list_flows',
        'report_blocked',
        'start_run',
      ]);
    } finally {
      await client.close();
    }
  });

  it('错误 token → 连接被拒（401）', async () => {
    await expect(connect('wrong-token')).rejects.toThrow();
  });

  it('直线流程全链路：start_run → complete_step（不带 runId，靠会话绑定）→ 终结', async () => {
    const client = await connect();
    try {
      const start = payloadOf(
        await client.callTool({ name: 'start_run', arguments: { flowName: '直线图', cwd: 'D:/work/demo' } }),
      );
      expect(start.runId).toMatch(/^run_/);
      expect(start.step.nodeId).toBe('n1');
      expect(start.step.instruction).toBe('第一步');
      expect(start.discipline).toContain('complete_step');

      // 不带 runId：靠 Mcp-Session-Id 会话绑定定位
      const done = payloadOf(
        await client.callTool({ name: 'complete_step', arguments: { summary: '完成了第一步' } }),
      );
      expect(done.finished).toBe(true);
      expect(done.outcome).toBe('success');
      expect(done.progress).toEqual({ completed: 1 });

      const after = payloadOf(await client.callTool({ name: 'get_current_step', arguments: {} }));
      expect(after.finished).toBe(true);
      expect(after.note).toContain('已经结束');
    } finally {
      await client.close();
    }
  });

  it('非法 branchId 经 MCP 返回三段式自愈', async () => {
    // 分支图
    const branch: Flow = {
      id: 'f_branch',
      name: '分支图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '跑测试',
          branches: [
            { id: 'b1', condition: '全部通过', to: 'n2' },
            { id: 'b_default', condition: '*', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    expect(store.save(branch).ok).toBe(true);

    const client = await connect();
    try {
      await client.callTool({ name: 'start_run', arguments: { flowName: '分支图' } });
      const bad = payloadOf(
        await client.callTool({ name: 'complete_step', arguments: { summary: '跑完', branchId: 'b_typo' } }),
      );
      expect(bad.error).toBe(true);
      expect(bad.what).toContain('b_typo');
      expect(bad.what).toContain('b1');
      expect(bad.current.step.nodeId).toBe('n1');
    } finally {
      await client.close();
    }
  });

  it('hook 注入的 _host/_sid 跨 MCP 会话定位 run（模拟 Codex 重连换 Mcp-Session-Id）', async () => {
    // 第一个会话 start_run，参数带 hook 注入的宿主身份
    const c1 = await connect();
    let runId: string;
    try {
      const start = payloadOf(
        await c1.callTool({
          name: 'start_run',
          arguments: { flowName: '直线图', _host: 'codex', _sid: 'thr_hook_1' },
        }),
      );
      runId = start.runId;
      expect(start.step.nodeId).toBe('n1');
    } finally {
      await c1.close();
    }
    // 新客户端 = 全新 Mcp-Session-Id；仅靠注入身份盲调（不带 runId）仍能定位
    const c2 = await connect();
    try {
      const cur = payloadOf(
        await c2.callTool({ name: 'get_current_step', arguments: { _host: 'codex', _sid: 'thr_hook_1' } }),
      );
      expect(cur.runId).toBe(runId);
      expect(cur.step.nodeId).toBe('n1');
    } finally {
      await c2.close();
    }
  });

  it('report_blocked 经 MCP 上报：无出口 → run 判失败且轨迹可见', async () => {
    const noExit: Flow = {
      id: 'f_block_mcp',
      name: '无出口阻塞图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '干一件事', branches: [{ id: 'b1', condition: '成功', to: 'n2' }] },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    expect(store.save(noExit).ok).toBe(true);
    const client = await connect();
    try {
      await client.callTool({ name: 'start_run', arguments: { flowName: '无出口阻塞图' } });
      const res = payloadOf(await client.callTool({ name: 'report_blocked', arguments: { reason: '缺依赖' } }));
      expect(res.finished).toBe(true);
      expect(res.outcome).toBe('fail');
      expect(res.note).toContain('缺依赖');
    } finally {
      await client.close();
    }
  });

  it('gate 全链路（双通道）：MCP 推进到卡点 → 面板放行 → await_gate 醒来拿到终结态', async () => {
    const gate: Flow = {
      id: 'f_gate_mcp',
      name: '卡点图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '准备发布', next: 'n_gate' },
        {
          id: 'n_gate',
          type: 'gate',
          question: '可以发布吗？',
          options: [
            { id: 'opt_go', label: '可以发布' },
            { id: 'opt_stop', label: '先不发布' },
          ],
          branches: [
            { id: 'b_go', condition: '可以发布', to: 'n_ok', outlet: 'opt_go' },
            { id: 'b_stop', condition: '先不发布', to: 'n_bad', outlet: 'opt_stop' },
          ],
        },
        { id: 'n_ok', type: 'end', outcome: 'success' },
        { id: 'n_bad', type: 'end', outcome: 'fail' },
      ],
    };
    expect(store.save(gate).ok).toBe(true);
    const client = await connect();
    try {
      const start = payloadOf(await client.callTool({ name: 'start_run', arguments: { flowName: '卡点图' } }));
      const gateStep = payloadOf(
        await client.callTool({ name: 'complete_step', arguments: { summary: '准备好了' } }),
      );
      expect(gateStep.step.kind).toBe('gate');
      expect(gateStep.step.question).toBe('可以发布吗？');
      expect(gateStep.step.options.map((o: { id: string }) => o.id)).toEqual(['opt_go', 'opt_stop']);
      expect(gateStep.step.gateId).toMatch(/^\d+$/);
      expect(gateStep.step.branches).toBeUndefined(); // 降噪：选项即出口，不下发 branches

      // await_gate 挂起期间，"面板用户"放行（source: panel）
      const awaiting = client.callTool({
        name: 'await_gate',
        arguments: { gateId: gateStep.step.gateId },
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const panel = engine.answerGate({ runId: start.runId, optionId: 'opt_go', note: '面板点的' }, 'panel');
      expect(panel.finished).toBe(true);

      const woke = payloadOf(await awaiting);
      expect(woke.finished).toBe(true);
      expect(woke.outcome).toBe('success');
    } finally {
      await client.close();
    }
  });

  it('answer_gate 经 MCP 代填（source: chat）→ 沿选项推进到 fail 终点', async () => {
    const client = await connect();
    try {
      const start = payloadOf(await client.callTool({ name: 'start_run', arguments: { flowName: '卡点图' } }));
      await client.callTool({ name: 'complete_step', arguments: { summary: '准备好了' } });
      const cur = payloadOf(await client.callTool({ name: 'get_current_step', arguments: {} }));
      const answered = payloadOf(
        await client.callTool({
          name: 'answer_gate',
          arguments: { gateId: cur.step.gateId, optionId: 'opt_stop', note: '用户说再等等' },
        }),
      );
      expect(answered.finished).toBe(true);
      expect(answered.outcome).toBe('fail');
      // 再答一次 → 三段式自愈
      const again = payloadOf(
        await client.callTool({ name: 'answer_gate', arguments: { gateId: cur.step.gateId, optionId: 'opt_go' } }),
      );
      expect(again.error).toBe(true);
      expect(again.what).toContain('已经被答复');
      expect(start.runId).toMatch(/^run_/);
    } finally {
      await client.close();
    }
  });

  it('subagent 全链路：主客户端到派发步 → 子客户端凭 childToken 完成 → 主客户端汇聚 join → 终结', async () => {
    const flow: Flow = {
      id: 'f_sub_mcp',
      name: '派发链路图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '定题目', next: 'n_sub' },
        {
          id: 'n_sub',
          type: 'subagent',
          title: '查资料',
          extraPrompt: '去查 {{n1.payload.topic}} 的资料',
          mode: 'inline',
          next: 'n_join',
        },
        { id: 'n_join', type: 'join', aggregateInstruction: '合并成报告', next: 'n_end' },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    expect(store.save(flow).ok).toBe(true);
    const main = await connect();
    try {
      const start = payloadOf(await main.callTool({ name: 'start_run', arguments: { flowName: '派发链路图' } }));
      const dispatch = payloadOf(
        await main.callTool({ name: 'complete_step', arguments: { summary: '题目定了', payload: { topic: 'MCP 协议' } } }),
      );
      expect(dispatch.step.kind).toBe('subagent');
      expect(dispatch.note).toContain('preamble');
      const token = dispatch.step.children[0].childToken;
      expect(token).toMatch(/^c_/);
      expect(dispatch.step.children[0].preamble).toContain(`childToken 是 ${token}`);
      expect(dispatch.step.children[0].extraPrompt).toBe('去查 MCP 协议 的资料'); // 主 run 产物已插值
      // 派发步上 complete_step → 自愈指向 get_current_step
      const misuse = payloadOf(await main.callTool({ name: 'complete_step', arguments: { summary: '想硬推' } }));
      expect(misuse.error).toBe(true);
      expect(misuse.guidance).toContain('get_current_step');

      // 子 Agent：独立客户端（全新 Mcp-Session-Id），只凭 childToken 定位
      const child = await connect();
      try {
        const first = payloadOf(await child.callTool({ name: 'get_current_step', arguments: { childToken: token } }));
        expect(first.runId).not.toBe(start.runId);
        expect(first.step.instruction).toBe('去查 MCP 协议 的资料');
        const done = payloadOf(
          await child.callTool({ name: 'complete_step', arguments: { childToken: token, summary: '查到了 3 条', payload: { found: 3 } } }),
        );
        expect(done.finished).toBe(true);
        expect(done.outcome).toBe('success');
      } finally {
        await child.close();
      }

      // 主 Agent 汇聚：join 步带 childResults，完成后到 end
      const join = payloadOf(await main.callTool({ name: 'get_current_step', arguments: {} }));
      expect(join.step.kind).toBe('join');
      expect(join.step.childResults[0]).toMatchObject({ childToken: token, status: 'completed', summary: '查到了 3 条' });
      const end = payloadOf(await main.callTool({ name: 'complete_step', arguments: { summary: '报告完成' } }));
      expect(end.finished).toBe(true);
      expect(end.outcome).toBe('success');
    } finally {
      await main.close();
    }
  });

  it('list_flows 返回流程清单', async () => {
    const client = await connect();
    try {
      const res = await client.callTool({ name: 'list_flows', arguments: {} });
      const text = (res as { content: Array<{ type: string; text: string }> }).content.find(
        (c) => c.type === 'text',
      )!.text;
      expect(text).toContain('直线图');
      expect(text).toContain('f_branch');
    } finally {
      await client.close();
    }
  });
});
