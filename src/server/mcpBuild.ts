// 建图类 MCP 端点：独立于执行端点 /mcp（设计文档 §6.1 建图类五件套）。
// 给"建图的 AI"用：只暴露建图工具，看不到执行类工具——注意力预算与执行侧同样适用；
// 执行端点反之亦然。宿主里注册为独立 MCP server（建议名 aiworkflow-build）。
// 建图类不做模式隔离：run 期间也可自由调用，copy-on-run 快照保证不打乱进行中的 run。
// 校验权威在 core/validate（两档：硬拒不落库、警告放行随结果返回）；工具入参刻意宽松，
// 让校验器产出带错误码的结构化报错而不是 zod 噪音。
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { Flow } from '../core/types.js';
import type { FlowStore } from '../core/flowStore.js';
import { validateFlow } from '../core/validate.js';

export interface McpBuildDeps {
  store: FlowStore;
  token: string;
}

/** 流程 DSL 简述（描述给建图 AI；完整语义以校验器报错为准） */
const DSL_HINT = `完整流程图 DSL 对象：{ id, name, entry, maxSteps?, nodes: [...] }。
节点：{ id, type: prompt|tool|gate|subagent|join|end, title?, instruction?, toolName?, params?, next?, branches?, iterationLimit?, onLimitExceeded?, outcome? }。
后继二选一：next（唯一后继）或 branches: [{ id, condition, to }]（condition "*" 为兜底默认分支，同节点至多一个）。
环必须给环上节点配 iterationLimit（建议同时配 onLimitExceeded 逃生出口）。end 节点带 outcome: success|fail。`;

export function createMcpBuildApp(deps: McpBuildDeps): Hono {
  const app = new Hono();
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  app.all('/mcp-build', async (c) => {
    const k = c.req.query('k') ?? c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (k !== deps.token) return c.json({ error: 'invalid token' }, 401);

    const sessionId = c.req.header('Mcp-Session-Id');
    const known = sessionId !== undefined ? transports.get(sessionId) : undefined;
    if (known !== undefined) {
      return known.handleRequest(c.req.raw);
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
      },
      onsessionclosed: (sid) => {
        transports.delete(sid);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId !== undefined) transports.delete(transport.sessionId);
    };
    const server = buildServer(deps);
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}

function buildServer(deps: McpBuildDeps): McpServer {
  const server = new McpServer({ name: 'aiworkflow-build', version: '0.1.0' });
  const flowInput = z.record(z.string(), z.unknown()).describe(DSL_HINT);

  server.registerTool(
    'list_flows',
    {
      title: '列出流程',
      description: '列出全部流程（id、展示名、更新时间）。get_flow / 删除以外的操作都靠 id 或展示名定位。',
    },
    async () => {
      const flows = deps.store.list();
      return text(
        flows.length === 0
          ? '还没有任何流程。用 create_flow 新建一张（建议先 validate_flow 干跑校验）。'
          : JSON.stringify(flows, null, 2),
      );
    },
  );

  server.registerTool(
    'get_flow',
    {
      title: '读取流程',
      description: '按 id 或展示名读取一张流程的完整 DSL（含 _ui 布局）。改图的标准姿势：get_flow → 改 → update_flow 整体覆盖。',
      inputSchema: {
        flowId: z.string().describe('流程 id 或展示名'),
      },
    },
    async ({ flowId }) => {
      const flow = deps.store.resolve(flowId);
      if (flow === undefined) {
        return text(
          fail(`没有找到流程「${flowId}」（按 id 和展示名都找不到）。`, '先调 list_flows 看有哪些流程，再用它的 id 或名字调 get_flow。'),
        );
      }
      return text(flow);
    },
  );

  server.registerTool(
    'validate_flow',
    {
      title: '干跑校验',
      description: '校验一张图但不落库。建图/改图前先干跑，按 errors 修正到全绿再调 create_flow / update_flow。',
      inputSchema: { flow: flowInput },
    },
    async ({ flow }) => text(validationView(deps.store, flow as unknown as Flow, { dryRun: true })),
  );

  server.registerTool(
    'create_flow',
    {
      title: '新建流程',
      description: '新建并保存一张流程图（校验硬拒时不保存）。已存在的 id 请改用 update_flow。',
      inputSchema: { flow: flowInput },
    },
    async ({ flow }) => {
      const typed = flow as unknown as Flow;
      if (typeof typed.id !== 'string' || typed.id === '') {
        return text(fail('flow.id 缺失：新建流程必须有 id。', '补上 id（短横线或下划线命名，如 f_release_flow）后重试。'));
      }
      if (deps.store.get(typed.id) !== undefined) {
        return text(
          fail(`流程 id「${typed.id}」已存在。`, `改用 update_flow 整体覆盖，或换一个 id 重新 create_flow。`),
        );
      }
      return text(validationView(deps.store, typed, { dryRun: false }));
    },
  );

  server.registerTool(
    'update_flow',
    {
      title: '覆盖更新流程',
      description: '整体覆盖一张已存在的流程（校验硬拒时不落库，原图保持不变）。改图标准姿势：get_flow → 改 → update_flow。',
      inputSchema: { flow: flowInput },
    },
    async ({ flow }) => {
      const typed = flow as unknown as Flow;
      if (typeof typed.id !== 'string' || deps.store.get(typed.id) === undefined) {
        return text(
          fail(`没有找到 id 为「${String(typed.id)}」的流程，没法更新。`, '确认 id 没写错（get_flow 可按名字反查）；确实要新建就调 create_flow。'),
        );
      }
      return text(validationView(deps.store, typed, { dryRun: false }));
    },
  );

  return server;
}

/** 校验 →（可选）落库，统一返回视图：成功带 warnings，失败带结构化 errors（三段式） */
function validationView(store: FlowStore, flow: Flow, opts: { dryRun: boolean }): unknown {
  const result = opts.dryRun ? dryValidate(flow) : store.save(flow);
  if (!result.ok) {
    const lines = result.errors.map((e) => `${e.code}: ${e.message}`).join('；');
    return fail(
      `校验不通过（${opts.dryRun ? '干跑，未落库' : '未落库，原图未动'}）：${lines}。`,
      '按 errors 逐条修正后重试；改完可先调 validate_flow 干跑确认全绿。',
      result.errors,
    );
  }
  return {
    ok: true,
    saved: !opts.dryRun,
    flowId: flow.id,
    warnings: result.warnings,
  };
}

function dryValidate(flow: Flow) {
  return validateFlow(flow);
}

function fail(what: string, guidance: string, errors?: unknown[]): unknown {
  return { error: true, what, guidance, ...(errors !== undefined ? { errors } : {}) };
}

function text(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }] };
}
