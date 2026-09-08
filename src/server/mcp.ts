// MCP 端点：Streamable HTTP（有状态会话，设计文档 §3 / §6.1）。
// - Mcp-Session-Id 由 SDK 生成并下发，是主 Agent 的身份锚点：run 与会话绑定，
//   上下文压缩后不带 runId 盲调 get_current_step / complete_step 也能定位（探针 P0-1 的兼容设计）
// - 鉴权与 /api/* 同一套：查询参数 k 或 Bearer token
// - 每个会话一个 transport + 一个 McpServer 实例，工具闭包持有本会话 id
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { ExecutionEngine } from '../core/engine.js';
import type { FlowStore } from '../core/flowStore.js';

export interface McpDeps {
  engine: ExecutionEngine;
  store: FlowStore;
  token: string;
}

export function createMcpApp(deps: McpDeps): Hono {
  const app = new Hono();
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  app.all('/mcp', async (c) => {
    const k = c.req.query('k') ?? c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (k !== deps.token) return c.json({ error: 'invalid token' }, 401);

    const sessionId = c.req.header('Mcp-Session-Id');
    const known = sessionId !== undefined ? transports.get(sessionId) : undefined;
    if (known !== undefined) {
      return known.handleRequest(c.req.raw);
    }

    // 新会话（initialize）：SDK 会校验协议；非 initialize 的未知会话由 SDK 按协议拒绝
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
    const server = buildMcpServer(deps, () => transport.sessionId);
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}

function buildMcpServer(deps: McpDeps, sessionId: () => string | undefined): McpServer {
  const server = new McpServer({ name: 'aiworkflow', version: '0.1.0' });

  server.registerTool(
    'list_flows',
    {
      title: '列出流程',
      description: '列出所有可用的流程图（id 与展示名）。start_run 的 flowName 两者都接受。',
    },
    async () => {
      const flows = deps.store.list();
      return text(
        flows.length === 0
          ? '还没有任何流程。请用户在面板 http://127.0.0.1:4123 上画一张图，或用面板新建。'
          : JSON.stringify(flows, null, 2),
      );
    },
  );

  server.registerTool(
    'start_run',
    {
      title: '开始流程',
      description:
        '按流程名开始一个 run。返回循环纪律文本和第一步。之后每步做完调 complete_step 回报。',
      inputSchema: {
        flowName: z.string().describe('流程 id 或展示名（可先调 list_flows 查）'),
        cwd: z.string().optional().describe('当前项目目录，用于面板按项目分组'),
        projectName: z.string().optional().describe('项目名，面板展示用'),
        ...injectedIdentity,
      },
    },
    async ({ _host, _sid, ...args }) =>
      text(deps.engine.startRun({ ...args, hostSession: hostSessionOf(_host, _sid), mcpSessionId: sessionId() })),
  );

  server.registerTool(
    'get_current_step',
    {
      title: '取当前步骤',
      description:
        '幂等。返回"我在哪、要干啥"。上下文被压缩、不确定自己进度时随时调它找回状态。',
      inputSchema: {
        runId: z.string().optional().describe('run id（可省略，按 MCP 会话自动定位）'),
        childToken: z.string().optional().describe('子 Agent 专用的身份令牌'),
        ...injectedIdentity,
      },
    },
    async ({ _host, _sid, ...args }) =>
      text(deps.engine.getCurrentStep({ ...args, hostSession: hostSessionOf(_host, _sid) }, sessionId())),
  );

  server.registerTool(
    'complete_step',
    {
      title: '完成当前步骤',
      description:
        '回报当前步骤的结果并领取下一步。summary 必填（一句话，给人看）；有分支的节点必须给 branchId（从步骤下发里的 branches 列表选）。',
      inputSchema: {
        summary: z.string().describe('这一步做了什么，一句话，给人看的'),
        payload: z.record(z.string(), z.unknown()).optional().describe('给后续节点插值用的结构化结果，如 { project: "apps/battle" }'),
        branchId: z.string().optional().describe('选中分支的 id；节点有 branches 时必填'),
        nodeId: z.string().optional().describe('当前节点 id（复述身份用，省略亦可）'),
        runId: z.string().optional().describe('run id（可省略，按 MCP 会话自动定位）'),
        childToken: z.string().optional().describe('子 Agent 专用的身份令牌'),
        ...injectedIdentity,
      },
    },
    async ({ _host, _sid, ...args }) =>
      text(deps.engine.completeStep({ ...args, hostSession: hostSessionOf(_host, _sid) }, sessionId())),
  );

  server.registerTool(
    'report_blocked',
    {
      title: '上报阻塞',
      description:
        '当前这一步干不下去了（缺依赖、没权限、分支全不满足且没有默认出口等）时如实上报。服务端按节点的逃生出口推进；没有任何出口则 run 判失败。不会自动重试。',
      inputSchema: {
        reason: z.string().describe('一句话说清干不下去的原因，给人看的'),
        nodeId: z.string().optional().describe('当前节点 id（复述身份用，省略亦可）'),
        runId: z.string().optional().describe('run id（可省略，按 MCP 会话自动定位）'),
        childToken: z.string().optional().describe('子 Agent 专用的身份令牌'),
        ...injectedIdentity,
      },
    },
    async ({ _host, _sid, ...args }) =>
      text(deps.engine.reportBlocked({ ...args, hostSession: hostSessionOf(_host, _sid) }, sessionId())),
  );

  return server;
}

function text(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }] };
}

/** 宿主 PreToolUse hook 自动注入的身份字段（设计文档 §8.1）。模型不应填写；_aid 暂不消费，阶段 6 预留 */
const injectedIdentity = {
  _host: z.string().optional().describe('宿主 hook 自动注入，勿手动填写'),
  _sid: z.string().optional().describe('宿主 hook 自动注入的会话 id，勿手动填写'),
  _aid: z.string().optional().describe('宿主 hook 自动注入的子 Agent id，勿手动填写'),
};

/** 注入字段 → 引擎的 hostSession（"<host>:<sid>"）；缺失时 undefined，回退 Mcp-Session-Id 定位 */
function hostSessionOf(host: string | undefined, sid: string | undefined): string | undefined {
  return host !== undefined && sid !== undefined ? `${host}:${sid}` : undefined;
}
