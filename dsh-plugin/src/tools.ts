// Host 半：把插件的操作暴露给 Agent（建图五件套 + 执行类工具 + 会话信息）。
// 与面板 UI 走同一套 Host 函数（shared/flows + 同一个 SQLite 连接），不另写一份逻辑。
import { readMonitorState } from '@shared/index.js';
import type { Flow } from '@shared/index.js';
import { getFlow, listFlows, saveFlow, validateFlowOnly } from '@shared/flows.js';
import { database, databasePath, flowsDir } from './db.js';
import { workflowEngine } from './engine.js';

const FLOW_ACTIONS = ['list', 'get', 'validate', 'create', 'update'] as const;

/** 模型可见的 DSL 速查（完整语义以校验器报错为准） */
const DSL_HINT =
  '完整流程图 DSL：{ id, name, entry, maxSteps?, nodes: [...] }。' +
  '节点 { id, type: prompt|tool|gate|subagent|join|end, title?, instruction?, toolName?, params?, next?, branches?, iterationLimit?, onLimitExceeded?, outcome? }。' +
  '后继二选一：next（唯一后继）或 branches: [{ id, condition, to }]（condition "*" 是默认分支，同节点至多一个）。' +
  '环必须给环上节点配 iterationLimit。end 节点带 outcome: success|fail。';

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: Record<string, unknown>;
    render: (args: unknown, value: unknown) => Array<{ type: 'text'; text: string }>;
  };
  execute: (args: any, exec: any) => Promise<unknown>;
  timeoutMs?: number;
}

function textResult(value: unknown): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }];
}

/** 注册 Agent 工具，返回一次性释放句柄 */
export function registerTools(ctx: any): () => void {
  const disposers: Array<() => void> = [];
  for (const definition of [contextTool(ctx), flowTool(), ...runTools(ctx)]) {
    disposers.push(ctx.tools.register(definition));
  }
  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose();
      } catch {
        // 重复释放忽略
      }
    }
  };
}

function contextTool(ctx: any): AgentTool {
  return {
    name: 'aiworkflow_context',
    description:
      '读取当前 DSH 会话与 aiworkflow 的对应关系：会话 id、工作目录、数据库路径，以及库里有多少张流程图、几个进行中/最近的 run。' +
      '只读，不改任何状态。要在会话里引用某张图或以后的 run 时先调它确认身份。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textResult(value),
    },
    async execute(_args, exec) {
      const snapshot: Record<string, unknown> = {
        sessionId: typeof exec?.agent?.id === 'string' ? exec.agent.id : null,
        cwd: await currentDirectory(ctx, exec),
        dbPath: databasePath(),
        flowsDir: flowsDir(),
        flows: null,
        activeRuns: null,
        recentRuns: null,
      };
      try {
        const db = database();
        const state = readMonitorState(db, null);
        snapshot.flows = listFlows(db).length;
        snapshot.activeRuns = state.active.length;
        snapshot.recentRuns = state.recent.length;
      } catch (error) {
        snapshot.available = false;
        snapshot.reason = describeDatabaseError(error);
      }
      return snapshot;
    },
  };
}

function flowTool(): AgentTool {
  return {
    name: 'aiworkflow_flow',
    description:
      'aiworkflow 流程图的读写入口（与 DSH 里的「可视化工作流」面板共用同一份 SQLite）。' +
      'action=list 列出全部流程；get 按 id 或名字读完整 DSL；validate 干跑校验、不落库；' +
      'create 新建（id 必须尚不存在）；update 整体覆盖已存在的流程。校验不通过时不落库，原图保持不变。' +
      DSL_HINT,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [...FLOW_ACTIONS],
          description: '要做的事：list / get / validate / create / update',
        },
        flowId: {
          type: 'string',
          description: '流程 id 或展示名；get 必填，update 也可用它定位（与 flow.id 一致时以 flow.id 为准）',
        },
        flow: {
          type: 'object',
          description: `完整 DSL 对象；validate / create / update 必填。${DSL_HINT}`,
          additionalProperties: true,
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textResult(value),
    },
    async execute(args) {
      const action = String(args?.action ?? '');
      const db = openOrExplain();

      if (action === 'list') {
        const flows = listFlows(db);
        return { ok: true, count: flows.length, flows };
      }

      if (action === 'get') {
        const wanted = requiredString(args?.flowId, 'flowId', 'get 需要 flowId（id 或展示名）。');
        const found = resolveFlow(db, wanted);
        if (found === undefined) {
          throw new Error(
            `没有找到流程「${wanted}」（按 id 和展示名都找不到）。` +
              '先调 aiworkflow_flow action=list 看有哪些流程，再用返回的 id 或名字重试。',
          );
        }
        return { ok: true, flow: found };
      }

      const flow = args?.flow as Flow | undefined;
      if (flow === undefined || flow === null || typeof flow !== 'object') {
        throw new Error(
          `action=${action} 需要 flow 对象。` +
            '传入完整 DSL：{ id, name, entry, nodes: [...] }；不确定结构时先调 action=get 看一张现有的图。',
        );
      }
      const flowId = requiredString(flow.id, 'flow.id', `flow.id 缺失：${action} 必须先有 id。`);

      if (action === 'validate') {
        const result = validateFlowOnly(flow);
        return { ok: result.ok, action, flowId, errors: result.errors, warnings: result.warnings };
      }

      if (action === 'create') {
        if (getFlow(db, flowId) !== undefined) {
          throw new Error(
            `流程 id「${flowId}」已存在，不能再用 create。` +
              '要覆盖它请改用 action=update；要另建一张请换一个 id。',
          );
        }
      } else if (action === 'update') {
        if (getFlow(db, flowId) === undefined) {
          throw new Error(
            `没有找到 id 为「${flowId}」的流程，没法 update。` +
              '确认 id 没写错（name 反查可用 action=get）；确实要新建请改用 action=create。',
          );
        }
      } else {
        throw new Error(`未知 action「${action}」：只支持 ${FLOW_ACTIONS.join(' / ')}。`);
      }

      const saved = saveFlow(db, flow, flowsDir());
      if (!saved.ok) {
        return {
          ok: false,
          action,
          flowId,
          what: `校验不通过，未落库，原图未动（${saved.errors.length} 条错误）。`,
          guidance: '按 errors 逐条修正后重试；改完先调 action=validate 干跑确认全绿。',
          errors: saved.errors,
          warnings: saved.warnings,
        };
      }
      return { ok: true, action, flowId, saved: true, warnings: saved.warnings };
    },
  };
}

/** 执行类工具：与引擎方法同名同义，DSH 里加 aiworkflow_ 前缀避免撞名 */
function runTools(ctx: any): AgentTool[] {
  const hostSessionOf = (exec: any): string | undefined =>
    typeof exec?.agent?.id === 'string' ? `dsh:${exec.agent.id}` : undefined;
  const childTokenOf = (args: any): string | undefined =>
    typeof args?.childToken === 'string' && args.childToken !== '' ? args.childToken : undefined;
  const refOf = (args: any, exec: any) => ({ childToken: childTokenOf(args), hostSession: hostSessionOf(exec) });

  const start: AgentTool = {
    name: 'aiworkflow_start_run',
    description:
      '按流程名开始一个 run（引擎纪律文本里的 start_run）。返回循环纪律 + 第一步。' +
      'flowName 可以是流程 id 或展示名（先调 aiworkflow_flow action=list 查）。之后每步做完必须调 aiworkflow_complete_step 回报。',
    parameters: {
      type: 'object',
      properties: {
        flowName: { type: 'string', description: '流程 id 或展示名' },
        cwd: { type: 'string', description: '项目目录，面板按项目分组用；省略取当前会话的工作目录' },
        projectName: { type: 'string', description: '项目名，面板展示用；省略只记目录' },
      },
      required: ['flowName'],
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    async execute(args, exec) {
      const flowName = requiredString(args?.flowName, 'flowName', 'start_run 需要 flowName（流程 id 或展示名）。');
      const given = typeof args?.cwd === 'string' ? args.cwd.trim() : '';
      const cwd = given !== '' ? given : ((await currentDirectory(ctx, exec)) ?? undefined);
      return jsonSafe(
        workflowEngine().startRun({
          flowName,
          cwd,
          projectName:
            typeof args?.projectName === 'string' && args.projectName.trim() !== '' ? args.projectName.trim() : undefined,
          hostSession: hostSessionOf(exec),
        }),
      );
    },
  };

  const current: AgentTool = {
    name: 'aiworkflow_get_current_step',
    description:
      '幂等：返回"我在哪、要干啥"（= get_current_step）。上下文被压缩、不确定自己进度时随时调它找回状态。',
    parameters: {
      type: 'object',
      properties: {
        childToken: { type: 'string', description: '子 Agent 专用身份令牌（派发步骤下发的那一个）' },
      },
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    async execute(args, exec) {
      return jsonSafe(workflowEngine().getCurrentStep(refOf(args, exec)));
    },
  };

  const complete: AgentTool = {
    name: 'aiworkflow_complete_step',
    description:
      '回报当前步骤的结果并领取下一步（= complete_step）。summary 必填（一句话，给人看）；' +
      '节点有 branches 时必须给 branchId（从步骤下发的 branches 列表里选）。',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '这一步做了什么，一句话，给人看的' },
        payload: {
          type: 'object',
          description: '给后续节点插值用的结构化结果，如 { project: "apps/battle" }',
          additionalProperties: true,
        },
        branchId: { type: 'string', description: '选中分支的 id；节点有 branches 时必填' },
        nodeId: { type: 'string', description: '当前节点 id（复述身份用，省略亦可）' },
        childToken: { type: 'string', description: '子 Agent 专用身份令牌' },
      },
      required: ['summary'],
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    async execute(args, exec) {
      return jsonSafe(
        workflowEngine().completeStep({
          ...refOf(args, exec),
          summary: requiredString(args?.summary, 'summary', 'complete_step 需要 summary（一句话说清这一步做了什么）。'),
          payload: isPlainObject(args?.payload) ? (args.payload as Record<string, unknown>) : undefined,
          branchId: optionalString(args?.branchId),
          nodeId: optionalString(args?.nodeId),
        }),
      );
    },
  };

  const blocked: AgentTool = {
    name: 'aiworkflow_report_blocked',
    description:
      '当前这一步干不下去了（缺依赖、没权限、分支全不满足且没有默认出口）时如实上报（= report_blocked）。' +
      '引擎按节点的逃生出口推进；没有任何出口则 run 判失败。不会自动重试。',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '一句话说清干不下去的原因，给人看的' },
        nodeId: { type: 'string', description: '当前节点 id（复述身份用，省略亦可）' },
        childToken: { type: 'string', description: '子 Agent 专用身份令牌' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    async execute(args, exec) {
      return jsonSafe(
        workflowEngine().reportBlocked({
          ...refOf(args, exec),
          reason: requiredString(args?.reason, 'reason', 'report_blocked 需要 reason（一句话说清卡在哪）。'),
          nodeId: optionalString(args?.nodeId),
        }),
      );
    },
  };

  const awaitGate: AgentTool = {
    name: 'aiworkflow_await_gate',
    description:
      '当前步骤是人工卡点（gate）时，长轮询等用户答复（= await_gate）。每轮最多 60 秒，到点返回"仍在等待"就再调一次。' +
      '用户当场在对话里答复了就别等，直接调 aiworkflow_answer_gate 代填。',
    parameters: {
      type: 'object',
      properties: {
        gateId: { type: 'string', description: '卡点 id（gate 步骤下发里的 gateId；省略则等当前 run 的挂起卡点）' },
        childToken: { type: 'string', description: '子 Agent 专用身份令牌' },
      },
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    timeoutMs: 90_000,
    async execute(args, exec) {
      return jsonSafe(await workflowEngine().awaitGate({ ...refOf(args, exec), gateId: optionalString(args?.gateId) }));
    },
  };

  const answerGate: AgentTool = {
    name: 'aiworkflow_answer_gate',
    description:
      '用户在对话里答复了人工卡点（gate）的问题时，代填他的选择（= answer_gate）。' +
      '这里记 source: chat，事后回看轨迹可分辨这是对话代填的决策。',
    parameters: {
      type: 'object',
      properties: {
        optionId: { type: 'string', description: '选中的选项 id（从 gate 步骤下发的 options 里选）' },
        gateId: { type: 'string', description: '卡点 id（省略则按当前 run 的挂起卡点）' },
        note: { type: 'string', description: '用户的原话或补充说明，给人看的' },
        childToken: { type: 'string', description: '子 Agent 专用身份令牌' },
      },
      required: ['optionId'],
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => textResult(value) },
    async execute(args, exec) {
      return jsonSafe(
        workflowEngine().answerGate(
          {
            ...refOf(args, exec),
            gateId: optionalString(args?.gateId),
            optionId: requiredString(args?.optionId, 'optionId', 'answer_gate 需要 optionId（从 options 里选一个）。'),
            note: optionalString(args?.note),
          },
          'chat',
        ),
      );
    },
  };

  return [start, current, complete, blocked, awaitGate, answerGate];
}

/**
 * 引擎结果里存在 `note: undefined` 这类字段（JSON.stringify 会直接丢掉），
 * 宿主工具返回值要求可无损 JSON 化，所以统一过一遍序列化。
 */
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function openOrExplain() {
  try {
    return database();
  } catch (error) {
    throw new Error(describeDatabaseError(error));
  }
}

function resolveFlow(db: ReturnType<typeof database>, wanted: string): Flow | undefined {
  const direct = getFlow(db, wanted);
  if (direct !== undefined) return direct;
  const byName = listFlows(db).find((flow) => flow.name === wanted);
  return byName === undefined ? undefined : getFlow(db, byName.id);
}

function requiredString(value: unknown, field: string, message: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(message);
  return value.trim();
}

async function currentDirectory(ctx: any, exec: any): Promise<string | null> {
  const workingDirectory = ctx.get('workingDirectory') as
    | { ensure?: (agent: unknown, signal?: AbortSignal) => Promise<string> }
    | undefined;
  if (workingDirectory?.ensure !== undefined && exec?.agent !== undefined) {
    try {
      return await workingDirectory.ensure(exec.agent, exec.signal);
    } catch {
      // 取不到当前会话目录时退回进程目录
    }
  }
  return process.cwd();
}

function describeDatabaseError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'ENOENT' || code === 'SQLITE_CANTOPEN') {
    return (
      `还没有 aiworkflow 数据库（${databasePath()}）。` +
      '先在 DSH 的「可视化工作流」里新建并保存一张图，插件会自动建库。'
    );
  }
  return `读取 ${databasePath()} 失败：${error instanceof Error ? error.message : String(error)}`;
}
