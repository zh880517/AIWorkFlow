// 执行引擎（设计文档 §7）。Phase 2-3：串行推进 prompt / tool / end，
// 分支求值边界（§7.3）、环与迭代上限（§4.5 iterationLimit / maxSteps）、report_blocked（§7.8）；
// 阶段 5：gate 卡点挂起与双通道放行（§7.6）；阶段 6：subagent 派发 + join 汇聚（§7.1/§7.5）。
// 三条铁律（§6.2 / §6.3 / §7.2）：
// - 单事务推进：校验、落 node_executions、定位后继、更新 run 一个事务内完成，中途失败不推进
// - 降噪下发：branches 剥离 to、progress 不含总数；每个响应复述 runId + nodeId
// - 自愈式报错：所有拒绝路径返回三段式（错在哪 + 正确姿势 + 当前这一步）
import crypto from 'node:crypto';
import type { Flow, FlowNode, FlowSnapshot, GateNode, JoinNode, NodeType, SubagentNode } from './types.js';
import type { SqlWriter } from './sql.js';
import { buildSnapshot, buildSubSnapshot, loadSnapshot, persistSnapshot } from './snapshot.js';
import { validateFlow } from './validate.js';

/** 支持推进的节点类型（阶段 6 起六种全支持） */
const SUPPORTED_TYPES: ReadonlySet<NodeType> = new Set(['prompt', 'tool', 'end', 'gate', 'subagent', 'join']);

/** 服务端下发的循环纪律文本（§6.4：不进 Skill 文件，跟服务端版本走） */
export const DISCIPLINE_TEXT = [
  '你正在按一张流程图分步推进任务。图不会一次给你全部内容——每次只给当前这一步，做完回报后才给下一步。',
  '硬的一条：每步做完必须调 complete_step，否则链条断在你这里。',
  '完全放开的：执行某一步时你想多读文件、多跑命令、多查一点，随意，只要最后把结果回报。',
  '不确定自己在哪：调 get_current_step()，它幂等，随时可调。',
  '遇到人工卡点（gate）：把问题原样转达用户，调 await_gate(gateId) 等答复（每轮 60 秒，到点就再调一次）；用户当场答复了就调 answer_gate 代填。',
  '派出子 Agent（subagent）：把每个 child 的 preamble 原样放进对应子任务开头（不许改写或摘要）；等全部子任务返回后再调 get_current_step()，服务端会汇聚结果给出下一步。',
  '干不下去（缺依赖、没权限、分支全不满足且没有默认出口）：调 report_blocked(reason) 如实上报，别硬编。',
].join('\n');

// ---- 下发结构（降噪形态） ----

export interface StepBranch {
  id: string;
  condition: string;
}

export interface StepView {
  nodeId: string;
  kind: NodeType;
  title: string;
  instruction: string;
  tool?: { name: string; params: Record<string, unknown> };
  /** 分支只含 id + condition，刻意剥离 to（§4.3 降噪） */
  branches?: StepBranch[];
  outcome?: 'success' | 'fail';
  /** gate 专有（§6.2）：gateId 由此处取得，用于 await_gate / answer_gate */
  gateId?: string;
  question?: string;
  options?: Array<{ id: string; label: string }>;
  /** subagent 专有（§6.2）：待派发的子任务（重派时只含要重派的那批） */
  children?: Array<{ childToken: string; preamble: string; extraPrompt: string }>;
  /** join 专有（§6.2）：各子任务结果与汇总指令 */
  childResults?: Array<{ childToken: string; status: string; summary: string }>;
  aggregateInstruction?: string;
}

export interface StepResult {
  runId: string;
  step: StepView;
  discipline: string;
  /** 刻意不含总数（§6.2 降噪） */
  progress: { completed: number };
  /** 例外推进的说明（如迭代逃生），正常推进不带 */
  note?: string;
}

export interface RunFinishedResult {
  runId: string;
  finished: true;
  outcome: 'success' | 'fail';
  note?: string;
  progress: { completed: number };
}

/** 自愈式报错：三段式，目标一次往返修复（§6.3） */
export interface SelfHealError {
  error: true;
  /** 错在哪 */
  what: string;
  /** 正确姿势 */
  guidance: string;
  /** 当前这一步是什么；run 尚未建立或已终结时为 null / finished 形态 */
  current: { runId: string; step: StepView } | { runId: string; finished: true; outcome: 'success' | 'fail' } | null;
}

export type StepOpResult = StepResult | RunFinishedResult | SelfHealError;
export type StartRunResult = StepResult | SelfHealError;

export interface StartRunParams {
  flowName: string;
  cwd?: string;
  projectName?: string;
  inputs?: Record<string, unknown>;
  /** DSH 会话绑定（`dsh:<sessionId>`），主 Agent 的身份锚点 */
  hostSession?: string;
}

/** run 定位：子 Agent 用 childToken；主 Agent 用 runId 或 DSH 会话绑定 */
export interface RunRef {
  runId?: string;
  childToken?: string;
  /** DSH 会话绑定（`dsh:<sessionId>`） */
  hostSession?: string;
}

export interface CompleteStepParams extends RunRef {
  /** 可选：复述当前节点 id。省略按当前节点处理；传了但和当前步不一致 → 自愈（抓上下文过期） */
  nodeId?: string;
  summary: string;
  payload?: Record<string, unknown>;
  branchId?: string;
}

/** report_blocked（§7.8）：干不下去了，如实上报原因 */
export interface ReportBlockedParams extends RunRef {
  reason: string;
  nodeId?: string;
}

/** answer_gate（§7.6）：代填用户在聊天中的答复（source: chat）；source: panel 保留给面板点选接入，当前插件未提供该 UI */
export interface AnswerGateParams extends RunRef {
  /** 卡点 id（gate 步骤下发里的 gateId）；省略则按 run 定位当前挂起卡点 */
  gateId?: string;
  optionId: string;
  note?: string;
}

/** await_gate（§7.6）：长轮询等人工答复，上限 60 秒，到点返回"仍在等待，请再调一次" */
export interface AwaitGateParams extends RunRef {
  gateId?: string;
}

/** 引擎事件（§9.3 面板刷新的数据源）。核心层只回调不落地传输——由插件决定怎么消费 */
export type EngineEvent =
  | { type: 'run_started'; runId: string; flowId: string; at: string }
  | { type: 'step_completed'; runId: string; nodeId: string; status: 'completed' | 'blocked' | 'limit_exceeded'; at: string }
  | { type: 'gate_pending'; runId: string; nodeId: string; gateId: string; question: string; at: string }
  | { type: 'child_spawned'; runId: string; nodeId: string; childRunId: string; at: string }
  | { type: 'run_finished'; runId: string; outcome: 'success' | 'fail'; at: string };

/** 迭代上限逃生时落的一条"未执行"轨迹 */
interface LimitRow {
  nodeId: string;
  iteration: number;
  limit: number;
}

/** 后继解析结果：正常推进 / 判失败（无逃生出口或逃生链成环）/ 后继悬空 */
type AdvanceOutcome =
  | { kind: 'advance'; targetId: string | null; limitRows: LimitRow[] }
  | { kind: 'fail'; reason: string }
  | { kind: 'dangling'; nodeId: string };

interface RunRow {
  id: string;
  parent_run_id: string | null;
  root_run_id: string;
  flow_id: string;
  flow_snapshot_hash: string;
  entry_node: string;
  current_node: string | null;
  status: string;
  outcome: string | null;
  cwd: string | null;
  project_name: string | null;
  child_token: string | null;
  /** 派出该 child 的 subagent 节点（v4 起）；主 run 为 null */
  parent_node: string | null;
  /** 重派：替代的旧 child run id（v4 起）；首轮为 null */
  retry_of: string | null;
  /** fan-out：该 child 对应的条目（JSON 序列化，v5 起）；非 fan-out 为 null */
  fanout_item: string | null;
  steps_used: number;
}

/** 预构建的 child run 落库参数（快照已提前持久化，事务内只做 INSERT） */
interface ChildPlan {
  runId: string;
  token: string;
  flowId: string;
  snapshotHash: string;
  entry: string;
  retryOf: string | null;
  /** fan-out 条目（JSON 序列化）；非 fan-out 为 null */
  fanoutItem: string | null;
}

/** gate_decisions 行；pending 时 option_id/decided_at 为 NULL、source 为占位 'pending' */
interface GateDecisionRow {
  id: number;
  run_id: string;
  node_id: string;
  question: string | null;
  option_id: string | null;
  note: string | null;
  source: string;
  decided_at: string | null;
}

export interface EngineDeps {
  /** 可写 SQLite 连接（插件用 node:sqlite，测试用内存库） */
  db: SqlWriter;
  /** 按图 id 或展示名解析（start_run 的 flowName） */
  resolveFlow(flowName: string): Flow | undefined;
  /** 引擎事件回调（§9.3）；不传则丢弃 */
  onEvent?: (event: EngineEvent) => void;
}

export class ExecutionEngine {
  private readonly db: SqlWriter;
  private readonly resolveFlow: (name: string) => Flow | undefined;
  private readonly emit: (event: EngineEvent) => void;

  constructor(deps: EngineDeps) {
    this.db = deps.db;
    this.resolveFlow = deps.resolveFlow;
    this.emit = deps.onEvent ?? (() => {});
  }

  /** 建 run（含 copy-on-run 快照），返回纪律文本 + 第一步 */
  startRun(params: StartRunParams): StartRunResult {
    const flow = this.resolveFlow(params.flowName);
    if (flow === undefined) {
      return selfHeal(
        `没有找到流程「${params.flowName}」（按 id 或展示名都找不到）。`,
        '先调 list_flows 看有哪些流程，再用它的 id 或名字调 start_run。',
      );
    }
    const result = validateFlow(flow);
    if (!result.ok) {
      const lines = result.errors.map((e) => `${e.code}: ${e.message}`).join('；');
      return selfHeal(
        `流程「${flow.name}」校验不通过：${lines}。`,
        '这张图有必然出错的硬伤，需要在面板里修好后再跑。',
      );
    }
    const unsupported = flow.nodes.filter((n) => !SUPPORTED_TYPES.has(n.type));
    if (unsupported.length > 0) {
      const list = unsupported.map((n) => `${n.type}（${n.title ?? n.id}）`).join('、');
      return selfHeal(
        `流程「${flow.name}」包含当前版本不认识的节点类型：${list}。`,
        '这张图可能由更新版本的服务创建，请升级 aiworkflow 后再跑。',
      );
    }

    let snapshot: FlowSnapshot;
    try {
      snapshot = buildSnapshot(flow, { get: (id) => this.resolveFlow(id) });
    } catch (e) {
      return selfHeal(
        `流程「${flow.name}」的快照构建失败：${(e as Error).message}`,
        '通常是 flowRef 引用的图已被删除或引用成环，在面板修好后再跑。',
      );
    }
    const hash = persistSnapshot(this.db, snapshot);
    const runId = `run_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO runs (id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node,
           status, cwd, project_name, host_session, steps_used, last_activity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, 0, ?, ?)`,
      )
      .run(runId, runId, flow.id, hash, flow.entry, flow.entry, params.cwd ?? null, params.projectName ?? null, params.hostSession ?? null, now, now);
    this.emit({ type: 'run_started', runId, flowId: flow.id, at: now });

    // 入口即卡点：start 后直接挂起等人工（§7.6）
    const entryNode = flow.nodes.find((n) => n.id === flow.entry);
    if (entryNode !== undefined && entryNode.type === 'gate') {
      const gateId = this.enterGate(runId, entryNode, now);
      this.emit({ type: 'gate_pending', runId, nodeId: entryNode.id, gateId: String(gateId), question: entryNode.question, at: now });
    }
    // 入口即派发：start 后直接进入子 Agent 派发步（§7.1）
    if (entryNode !== undefined && entryNode.type === 'subagent') {
      const spawned = this.enterSubagent(runId, entryNode, now);
      if (spawned !== undefined) return spawned;
    }

    return this.stepResult(runId);
  }

  /** 幂等。返回"我在哪、要干啥"；上下文压缩后的恢复入口。
   *  例外（§7.5）：主 Agent 在派发步上（waiting_children）调用即触发汇聚——
   *  前提是宿主的 Task 调用已返回，此时 children 该完成的都完成了，没完成的按"未回报"处理。 */
  getCurrentStep(ref: RunRef): StepOpResult {
    const run = this.resolveRun(ref);
    if (run === null) {
      return selfHeal(
        ref.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run。',
        '主 Agent 调 start_run 开始一个流程；如果上下文被压缩过、不确定自己在哪，这个结果就是答案的来源——先 start_run 或问用户该跑哪张图。',
      );
    }
    if (run.status === 'waiting_children') {
      return this.gatherChildren(run);
    }
    return this.resultForRun(run, 'get_current_step');
  }

  /** 推进一格：校验 → 落库 → 定位后继（含迭代上限逃生）→ 渲染插值 → 返回下一步 */
  completeStep(params: CompleteStepParams): StepOpResult {
    const run = this.resolveRun(params);
    if (run === null) {
      return selfHeal(
        params.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run，没法提交结果。',
        '调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。',
      );
    }
    if (run.status === 'waiting_gate') {
      return selfHeal(
        'run 正挂在人工卡点上等确认，complete_step 推不动它。',
        '调 await_gate(gateId) 等用户答复（每轮 60 秒）；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。gateId 和选项见下面这一步。',
        this.currentRef(run),
      );
    }
    if (run.status === 'waiting_children') {
      return selfHeal(
        '这一步是子 Agent 派发步，完成由子任务回报驱动，不用 complete_step。',
        '把每个 child 的 preamble 原样放进子任务开头派出；等全部子任务返回后调 get_current_step()，服务端会汇聚结果给出下一步。',
        this.currentRef(run),
      );
    }
    if (run.status !== 'running') {
      return this.resultForRun(run, 'complete_step');
    }
    if (params.summary === undefined || params.summary.trim() === '') {
      return selfHeal(
        'complete_step 必须带 summary：这一步做了什么，一句话，给人看的。',
        `重新调 complete_step，带上 summary 和这一步的结果。当前节点是 ${run.current_node}。`,
        this.currentRef(run),
      );
    }
    const snapshot = this.snapshotOf(run);
    const maxSteps = this.maxStepsOf(snapshot);
    if (run.steps_used >= maxSteps) {
      // run 级防绕圈（§4.5）：第 maxSteps+1 步不再执行
      this.failRun(run);
      return this.finishedResult(
        run.id,
        'fail',
        `已超出全局步数上限（${maxSteps} 步），run 判失败。如任务仍需推进，请用户修图（调大 maxSteps 或拆分流程）后重新 start_run。`,
      );
    }
    const node = snapshot.flows[snapshot.rootFlowId]!.nodes.find((n) => n.id === run.current_node);
    if (node === undefined) {
      return selfHeal(
        `快照里找不到节点 ${run.current_node}（run ${run.id} 的数据异常）。`,
        '这是服务端数据问题，请把这条错误原样反馈给用户。',
        null,
      );
    }
    if (params.nodeId !== undefined && params.nodeId !== run.current_node) {
      return selfHeal(
        `节点不匹配：你提交的是 ${params.nodeId}，但当前这一步是 ${run.current_node}（可能是上下文压缩后记串了）。`,
        `对当前节点 ${run.current_node} 重新调 complete_step；不确定的话先调 get_current_step() 取回最新状态。`,
        this.currentRef(run),
      );
    }

    // 分支定位（无分支节点走 next / 隐式 end）
    let successorId: string | null;
    if ((node.branches ?? []).length > 0) {
      const branch = node.branches!.find((b) => b.id === params.branchId);
      if (branch === undefined) {
        const valid = node.branches!.map((b) => `${b.id}（${b.condition === '*' ? '默认' : b.condition}）`).join('、');
        return selfHeal(
          `branchId 无效：你给的是「${params.branchId ?? '（缺失）'}」，节点 ${node.id} 的合法分支是 ${valid}。`,
          `重新调 complete_step，branchId 从上面列表里选一个最符合你结果的。`,
          this.currentRef(run),
        );
      }
      successorId = branch.to;
    } else if (node.next !== undefined) {
      successorId = node.next;
    } else {
      successorId = null; // 隐式 end：无分支且无后继
    }

    const now = new Date().toISOString();
    const plan: AdvanceOutcome =
      successorId === null
        ? { kind: 'advance', targetId: null, limitRows: [] }
        : this.resolveAdvance(run, snapshot, successorId);
    this.advanceTransaction(run, snapshot, plan, {
      nodeId: node.id,
      status: 'completed',
      summary: params.summary,
      payload: JSON.stringify(params.payload ?? {}),
      branchId: params.branchId ?? null,
    }, now);
    // 推进到派发步（§7.1/§7.4）：主 run 已提交并挂 waiting_children，现在建 child（ren）——
    // 放在事务后是为了 extraPrompt 的插值能取到刚提交的本步产物（{{nodeId.payload…}}）；
    // fan-out 先把 N 个 child run 全部建好再返回 children[]（§7.4：面板立刻可见、token 白名单、截断可记录）
    if (plan.kind === 'advance' && plan.targetId !== null) {
      const target = findNode(snapshot, plan.targetId);
      if (target !== undefined && target.type === 'subagent') {
        const list = this.childItems(run, target);
        if ('error' in list) {
          this.failRun(run);
          return selfHeal(list.error.what, `${list.error.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
        }
        const plans: ChildPlan[] = [];
        for (const item of list.items) {
          const planned = this.planChild(run, target, null, item === null ? null : JSON.stringify(item));
          if ('error' in planned) {
            this.failRun(run);
            return selfHeal(planned.error.what, `${planned.error.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
          }
          plans.push(planned);
        }
        this.spawnChildren(run, target.id, plans, list.fanOuted ? { dropped: list.dropped } : undefined);
      }
    }
    return this.resultForPlan(run.id, snapshot, plan);
  }

  /** 干不下去了（§7.8）：落 blocked 轨迹，三级出口 onLimitExceeded → default 分支 → run 判失败。不做自动重试 */
  reportBlocked(params: ReportBlockedParams): StepOpResult {
    const run = this.resolveRun(params);
    if (run === null) {
      return selfHeal(
        params.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run，没法上报阻塞。',
        '调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。',
      );
    }
    if (run.status === 'waiting_gate') {
      return selfHeal(
        'run 正挂在人工卡点上等确认，这不是阻塞，不需要 report_blocked。',
        '调 await_gate(gateId) 等用户答复；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。',
        this.currentRef(run),
      );
    }
    if (run.status === 'waiting_children') {
      return selfHeal(
        '这一步是子 Agent 派发步，不是阻塞点。',
        '等全部子任务返回后调 get_current_step() 汇聚；确实派不出去（例如 DSH 侧没有可用的子 Agent）就请用户改图，去掉 subagent 节点后重跑。',
        this.currentRef(run),
      );
    }
    if (run.status !== 'running') {
      return this.resultForRun(run, 'report_blocked');
    }
    if (params.reason === undefined || params.reason.trim() === '') {
      return selfHeal(
        'report_blocked 必须带 reason：一句话说清干不下去的原因，给人看的。',
        `重新调 report_blocked，带上 reason。当前节点是 ${run.current_node}。`,
        this.currentRef(run),
      );
    }
    const snapshot = this.snapshotOf(run);
    const maxSteps = this.maxStepsOf(snapshot);
    if (run.steps_used >= maxSteps) {
      this.failRun(run);
      return this.finishedResult(run.id, 'fail', `已超出全局步数上限（${maxSteps} 步），run 判失败。`);
    }
    const node = run.current_node !== null ? findNode(snapshot, run.current_node) : undefined;
    if (node === undefined) {
      return selfHeal(
        `快照里找不到节点 ${run.current_node}（run ${run.id} 的数据异常）。`,
        '这是服务端数据问题，请把这条错误原样反馈给用户。',
        null,
      );
    }
    if (params.nodeId !== undefined && params.nodeId !== run.current_node) {
      return selfHeal(
        `节点不匹配：你上报的是 ${params.nodeId}，但当前这一步是 ${run.current_node}（可能是上下文压缩后记串了）。`,
        `对当前节点 ${run.current_node} 重新调 report_blocked；不确定的话先调 get_current_step() 取回最新状态。`,
        this.currentRef(run),
      );
    }

    // child run 的阻塞（§7.8 末行）：不走三级出口，直接置 failed，由 §7.5 的失败处理接管（父级重派或带部分结果推进）
    if (run.child_token !== null) {
      const now = new Date().toISOString();
      this.db.transaction((): void => {
        this.db
          .prepare(
            `INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
             VALUES (?, ?, ?, 'blocked', ?, '{}', NULL, ?, ?)`,
          )
          .run(run.id, node.id, this.execCount(run.id, node.id) + 1, params.reason, now, now);
        this.db
          .prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`)
          .run(now, now, run.id);
      })();
      this.emit({ type: 'step_completed', runId: run.id, nodeId: node.id, status: 'blocked', at: now });
      this.emit({ type: 'run_finished', runId: run.id, outcome: 'fail', at: now });
      return this.finishedResult(
        run.id,
        'fail',
        `子任务上报阻塞：${params.reason}。该子任务已置为失败；主流程汇聚时（get_current_step）会自动重派一轮或带部分结果推进。`,
      );
    }

    const defaultTo = node.branches?.find((b) => b.condition === '*')?.to;
    const exitId = node.onLimitExceeded ?? defaultTo;
    const now = new Date().toISOString();
    const blockedRow = {
      nodeId: node.id,
      status: 'blocked' as const,
      summary: params.reason,
      payload: '{}',
      branchId: null,
    };
    if (exitId === undefined) {
      const reason = `节点 ${node.id} 上报阻塞且没有任何出口（无 onLimitExceeded、无 default 分支），run 判失败。`;
      this.advanceTransaction(run, snapshot, { kind: 'fail', reason }, blockedRow, now);
      return this.finishedResult(run.id, 'fail', `节点 ${node.id} 上报阻塞：${params.reason}。没有可用出口，run 判失败。`);
    }
    const plan = this.resolveAdvance(run, snapshot, exitId);
    this.advanceTransaction(run, snapshot, plan, blockedRow, now);
    return this.resultForPlan(run.id, snapshot, plan);
  }

  /** 卡点放行（§7.6）：source 记录来源；当前插件走 chat，panel 保留给后续面板点选接入。
   *  决策记 gate_decisions（含来源），并落一条 completed 轨迹（payload 带选项与来源）供插值与回看。 */
  answerGate(params: AnswerGateParams, source: 'panel' | 'chat'): StepOpResult {
    // 定位挂起卡点：gateId 直查；省略则按 run ref 找当前挂起点
    let run: RunRow | null = null;
    let row: GateDecisionRow | null = params.gateId !== undefined ? this.pendingGateById(params.gateId) : null;
    if (row !== null) run = this.runById(row.run_id);
    if (row === null && params.gateId !== undefined) {
      const decided = this.gateRowById(params.gateId);
      if (decided !== undefined) {
        const r = this.runById(decided.run_id);
        return selfHeal(
          `卡点 ${params.gateId} 已经被答复过了（不能重复作答）。`,
          '调 get_current_step() 看当前进展；如果流程又走到新的卡点，用新下发的 gateId 作答。',
          r !== null ? this.currentOf(r) : null,
        );
      }
      return selfHeal(
        `gateId 无效：「${params.gateId}」不对应任何卡点。`,
        'gateId 从 gate 步骤的下发内容里取；也可以省略 gateId，按当前 run 的挂起卡点作答。',
        null,
      );
    }
    if (row === null) {
      run = this.resolveRun(params);
      if (run === null) {
        return selfHeal(
          params.childToken !== undefined
            ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
            : '没有找到你正在进行的 run，没有可作答的卡点。',
          '调 start_run 开始一个流程；不确定在哪就先调 get_current_step。',
        );
      }
      if (run.current_node !== null) row = this.pendingDecisionOf(run.id, run.current_node);
      if (row === null) {
        return selfHeal(
          `run ${run.id} 当前不在人工卡点上（状态 ${run.status}），没有可作答的问题。`,
          '调 get_current_step() 看当前这一步是什么。',
          this.currentOf(run),
        );
      }
    }
    if (run === null || row === null) {
      return selfHeal('卡点数据异常：找不到所属 run。', '这是服务端数据问题，请把这条错误原样反馈给用户。', null);
    }

    const snapshot = this.snapshotOf(run);
    const node = findNode(snapshot, row.node_id);
    if (node === undefined || node.type !== 'gate') {
      return selfHeal(
        `卡点数据异常：快照里 ${row.node_id} 不是 gate 节点（run ${run.id}）。`,
        '这是服务端数据问题，请把这条错误原样反馈给用户。',
        null,
      );
    }
    const option = node.options.find((o) => o.id === params.optionId);
    if (option === undefined) {
      const valid = node.options.map((o) => `${o.id}（${o.label}）`).join('、');
      return selfHeal(
        `optionId 无效：你给的是「${params.optionId ?? '（缺失）'}」。卡点 ${node.id} 的问题是「${node.question}」，合法选项：${valid}。`,
        '重新调 answer_gate，optionId 从上面列表里选；或把问题原样转给用户再等答复。',
        { runId: run.id, step: this.buildStepView(run, node) },
      );
    }

    const maxSteps = this.maxStepsOf(snapshot);
    if (run.steps_used >= maxSteps) {
      const now = new Date().toISOString();
      this.db.transaction((): void => {
        this.decideGateRow(row.id, option.id, params.note ?? null, source, now);
        this.db
          .prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`)
          .run(now, now, run.id);
      })();
      this.emit({ type: 'run_finished', runId: run.id, outcome: 'fail', at: now });
      return this.finishedResult(run.id, 'fail', `已超出全局步数上限（${maxSteps} 步），答复已记录但 run 判失败。`);
    }

    // 出口解析：选项 → 出口连线（outlet 匹配，兜底分支 id 同名）；没连线的选项记录决策后判失败（校验器存图时会警告）
    const branches = node.branches ?? [];
    const matched = branches.find((b) => b.outlet === option.id) ?? branches.find((b) => b.id === option.id);
    let successorId: string | null;
    let branchId: string | null = matched?.id ?? null;
    if (matched !== undefined) {
      successorId = matched.to;
    } else if (branches.length === 0 && node.next !== undefined) {
      successorId = node.next;
    } else if (branches.length === 0) {
      successorId = null; // 裸卡点：记录决策即隐式收尾
    } else {
      successorId = null;
    }

    const now = new Date().toISOString();
    const gateRow = {
      nodeId: node.id,
      status: 'completed' as const,
      summary: `人工确认：${option.label}（${source === 'panel' ? '面板点选' : '聊天代填'}）`,
      payload: JSON.stringify({ optionId: option.id, optionLabel: option.label, note: params.note ?? null, source }),
      branchId,
    };
    if (branches.length > 0 && matched === undefined) {
      const reason = `卡点 ${node.id} 的选项「${option.label}」（${option.id}）没有连线，决策已记录但无法推进，run 判失败。`;
      this.advanceTransaction(run, snapshot, { kind: 'fail', reason }, gateRow, now, {
        decisionId: row.id,
        optionId: option.id,
        note: params.note ?? null,
        source,
      });
      return this.finishedResult(run.id, 'fail', `人工选了「${option.label}」，但该选项在图上没有连线，run 判失败。请把选项连上出口后重新 start_run。`);
    }
    const plan: AdvanceOutcome =
      successorId === null
        ? { kind: 'advance', targetId: null, limitRows: [] }
        : this.resolveAdvance(run, snapshot, successorId);
    this.advanceTransaction(run, snapshot, plan, gateRow, now, {
      decisionId: row.id,
      optionId: option.id,
      note: params.note ?? null,
      source,
    });
    return this.resultForPlan(run.id, snapshot, plan);
  }

  /** 长轮询等卡点答复（§7.6）：上限默认 60 秒，到点返回"仍在等待，请再调一次"；已答复（或已不在卡点）返回当前状态 */
  async awaitGate(params: AwaitGateParams, timeoutMs = 60_000): Promise<StepOpResult> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let row: GateDecisionRow | null = params.gateId !== undefined ? this.pendingGateById(params.gateId) : null;
      let run: RunRow | null = row !== null ? this.runById(row.run_id) : this.resolveRun(params);
      if (row !== null && run === null) {
        return selfHeal(`卡点 ${row.id} 所属的 run 不存在（${row.run_id}），数据异常。`, '这是服务端数据问题，请把这条错误原样反馈给用户。', null);
      }
      if (run === null) {
        return selfHeal(
          params.childToken !== undefined
            ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
            : '没有找到你正在进行的 run，也没有可等待的卡点。',
          '先调 start_run 开始流程，或 get_current_step 确认状态。',
        );
      }
      if (row === null && run.status === 'waiting_gate' && run.current_node !== null) {
        row = this.pendingDecisionOf(run.id, run.current_node);
      }
      if (row === null) {
        // 不在卡点上：多半是刚被放行（含 gateId 已答完），返回已推进的当前状态
        return this.resultForRun(run, 'await_gate');
      }
      if (Date.now() >= deadline) {
        const step = this.stepResult(run.id);
        return 'step' in step
          ? {
              ...step,
              note: `仍在等待人工确认（等待了 ${Math.round(timeoutMs / 1000)} 秒到点）。请再调一次 await_gate 继续等；用户若已在本对话答复，调 answer_gate(gateId, optionId) 代填。`,
            }
          : step;
      }
      await sleep(Math.min(400, Math.max(1, deadline - Date.now())));
    }
  }

  // ---- subagent 派发与 join 汇聚（§7.1 / §7.5，阶段 6）----

  /** 入口即派发：start 后直接建 child 并挂 waiting_children（与入口即 gate 对称） */
  private enterSubagent(runId: string, node: SubagentNode, now: string): SelfHealError | undefined {
    const run = this.runById(runId);
    if (run === null) {
      return selfHeal(`run ${runId} 不存在（数据异常）。`, '这是服务端数据问题，请把这条错误原样反馈给用户。', null);
    }
    const list = this.childItems(run, node);
    if ('error' in list) return list.error;
    const plans: ChildPlan[] = [];
    for (const item of list.items) {
      const planned = this.planChild(run, node, null, item === null ? null : JSON.stringify(item));
      if ('error' in planned) return planned.error;
      plans.push(planned);
    }
    const events: EngineEvent[] = [];
    this.db.transaction((): void => {
      this.db
        .prepare(`UPDATE runs SET status = 'waiting_children', last_activity = ? WHERE id = ?`)
        .run(now, runId);
      this.insertChildRuns(run, node.id, plans, events, now);
    })();
    for (const e of events) this.emit(e);
    return undefined;
  }

  /** fan-out 条目解析（§7.4）：from 插值（数组，max 截断）/ 固定 count / 无 fanOut（单 child）。
   *  items 元素为 null 表示该 child 没有对应条目（count 模式与非 fan-out）。 */
  private childItems(run: RunRow, node: SubagentNode): { items: unknown[]; dropped: unknown[]; fanOuted: boolean } | { error: SelfHealError } {
    const fan = node.fanOut;
    if (fan === undefined) return { items: [null], dropped: [], fanOuted: false };
    if (fan.count !== undefined) {
      const n = Math.floor(fan.count);
      if (n < 1) {
        return { error: selfHeal(`fanOut.count 必须是正整数（当前 ${fan.count}）。`, '在面板把 count 改成 ≥1，或改用 from 按数据条数派发。', this.currentRef(run)) };
      }
      return { items: Array.from({ length: n }, () => null), dropped: [], fanOuted: true };
    }
    const from = fan.from ?? '';
    const m = /^\{\{\s*(.+?)\s*\}\}$/.exec(from.trim());
    if (m === null) {
      return {
        error: selfHeal(
          `fanOut.from 应是一个 {{...}} 插值表达式（当前 ${JSON.stringify(from)}）。`,
          '改成如 "{{n3.payload.modules}}"——解析结果必须是数组，每个元素派一个子 Agent。',
          this.currentRef(run),
        ),
      };
    }
    const value = this.lookupExpr(m[1]!, run.id);
    if (value === undefined) {
      return {
        error: selfHeal(
          `fanOut.from 引用的数据还不存在：${from}（引用的节点没跑过或字段缺失）。`,
          '把 fanOut.from 指向一个已完成节点返回的数组字段，或改用 count 固定数量。',
          this.currentRef(run),
        ),
      };
    }
    if (!Array.isArray(value)) {
      return {
        error: selfHeal(
          `fanOut.from 解析结果不是数组：${from} → ${JSON.stringify(value).slice(0, 80)}。`,
          'from 必须指向数组字段（每个元素派一个子 Agent），单值请走普通 subagent 节点。',
          this.currentRef(run),
        ),
      };
    }
    if (value.length === 0) {
      return {
        error: selfHeal(
          `fanOut.from 解析结果是空数组：${from}，没有可派发的条目。`,
          '确认上游节点会产出非空数组，或改用 count 固定数量。',
          this.currentRef(run),
        ),
      };
    }
    const max = fan.max !== undefined ? fan.max : value.length;
    const items = value.slice(0, max);
    return { items, dropped: value.slice(max), fanOuted: true };
  }

  /** 预构建一个 child run（初始派发与重派共用）：
   *  子图（inline/subflow/flowRef）→ 从父快照切子快照（不回读当前库）→ 持久化 → 落库参数。
   *  fanoutItem：该 child 对应的 fan-out 条目（JSON）；inline 模式下渲染进子任务指令。 */
  private planChild(run: RunRow, node: SubagentNode, retryOf: string | null, fanoutItem: string | null): ChildPlan | { error: SelfHealError } {
    const snapshot = this.snapshotOf(run);
    try {
      const childFlow = this.childFlowOf(run, node, snapshot, fanoutItem);
      const childSnapshot = buildSubSnapshot(snapshot, childFlow);
      const hash = persistSnapshot(this.db, childSnapshot);
      return {
        runId: `run_${crypto.randomBytes(4).toString('hex')}`,
        token: `c_${crypto.randomBytes(4).toString('hex')}`,
        flowId: childFlow.id,
        snapshotHash: hash,
        entry: childFlow.entry,
        retryOf,
        fanoutItem,
      };
    } catch (e) {
      return {
        error: selfHeal(
          `子任务图构建失败：${(e as Error).message}`,
          '在面板修好该 subagent 节点后重新 start_run。',
          this.currentRef(run),
        ),
      };
    }
  }

  /** §7.5 汇聚：主 Agent 在派发步上调 get_current_step 触发。
   *  前提是宿主的 Task 调用已全部返回——children 没完成的就是"未回报"，判 failed 后走失败处理。
   *  对稳定的 child 终态收敛（重复调用幂等）：要么推进离开派发步，要么重派后仍在派发步等新一轮回报。 */
  private gatherChildren(run: RunRow): StepOpResult {
    const snapshot = this.snapshotOf(run);
    const node = run.current_node !== null ? findNode(snapshot, run.current_node) : undefined;
    if (node === undefined || node.type !== 'subagent') {
      return selfHeal(
        `run ${run.id} 处于 waiting_children 但当前节点不是 subagent（${run.current_node}），数据异常。`,
        '这是服务端数据问题，请把这条错误原样反馈给用户。',
        null,
      );
    }
    let slots = this.childSlots(run.id, node.id);
    if (slots.length === 0) {
      // 崩溃窗口自愈：推进事务已提交但 child 没落库——按节点配置补建（fan-out 按当时的数据重算），而不是把 run 卡死
      const list = this.childItems(run, node);
      if ('error' in list) return list.error;
      const plans: ChildPlan[] = [];
      for (const item of list.items) {
        const planned = this.planChild(run, node, null, item === null ? null : JSON.stringify(item));
        if ('error' in planned) return planned.error;
        plans.push(planned);
      }
      this.spawnChildren(run, node.id, plans, list.fanOuted ? { dropped: list.dropped } : undefined);
      slots = this.childSlots(run.id, node.id);
    }
    const now = new Date().toISOString();
    // Task 已返回仍未终结的 child：挂了或未回报（§7.5 第二行），置 failed 后转失败处理
    const stuck = slots.filter((s) => !isTerminalRun(s.latest));
    for (const s of stuck) {
      this.failChild(s.latest, now);
    }
    if (stuck.length > 0) slots = this.childSlots(run.id, node.id);

    const failedSlots = slots.filter((s) => s.latest.status === 'failed');
    // 重派只做一轮（§7.5）：失败的最新 child 若是原始 run（没被重派替代过）才可重派；
    // fan-out 的重派沿用原 slot 的条目（fanout_item），子任务拿到的还是同一条数据
    const retryable = failedSlots.filter((s) => s.latest.id === s.original.id);
    if (retryable.length > 0) {
      const plans: ChildPlan[] = [];
      for (const s of retryable) {
        const plan = this.planChild(run, node, s.original.id, s.original.fanout_item);
        if ('error' in plan) return plan.error;
        plans.push(plan);
      }
      this.spawnChildren(run, node.id, plans, node.fanOut !== undefined ? { dropped: [] } : undefined);
      const step = this.stepResult(run.id);
      const note = `${failedSlots.length} 个子任务失败（原因见监控页对应子任务），已建新的 child run 重派——只重派这一轮：把新的 preamble 原样发给子 Agent 再跑一次，全部返回后再调 get_current_step()。`;
      return 'step' in step ? { ...step, note } : step;
    }

    // 全部完成，或失败但已重派过 → 带已有结果推进（部分失败在汇总与 note 里显性记明缺了谁；fan-out 用条目名）
    const missing = failedSlots.map((s) => {
      if (s.latest.fanout_item === null) return s.latest.id;
      try {
        return formatItem(JSON.parse(s.latest.fanout_item));
      } catch {
        return s.latest.id;
      }
    });
    const results = slots.map((s) => this.childResultOf(s.latest));
    const sRow = {
      nodeId: node.id,
      status: 'completed' as const,
      summary:
        missing.length === 0
          ? `子 Agent 全部回报（${slots.length} 个）`
          : `子 Agent 汇聚：${slots.length - missing.length} 完成、${missing.length} 失败（缺：${missing.join('、')}）`,
      payload: JSON.stringify({ children: results }),
      branchId: null,
    };
    const successorId = node.next ?? null;
    const plan: AdvanceOutcome =
      successorId === null
        ? { kind: 'advance', targetId: null, limitRows: [] }
        : this.resolveAdvance(run, snapshot, successorId);
    this.advanceTransaction(run, snapshot, plan, sRow, now);
    const r = this.resultForPlan(run.id, snapshot, plan);
    if (missing.length === 0) return r;
    const missingNote = `部分子任务失败（缺：${missing.join('、')}），已带部分结果推进；失败详情在监控页对应子任务里。`;
    if ('step' in r || 'finished' in r) {
      return { ...r, note: r.note !== undefined ? `${r.note}${missingNote}` : missingNote };
    }
    return r;
  }

  /** child 批量落库（独立小事务 + child_spawned 事件）；主 run 指针已在先前的推进事务里更新。
   *  fan-out 节点同时落一条 dispatched 轨迹：N 个 child 与被 max 截断丢弃的条目都显性在案（铁律：不静默截断）。 */
  private spawnChildren(run: RunRow, parentNodeId: string, plans: ChildPlan[], fanout?: { dropped: unknown[] }): void {
    const now = new Date().toISOString();
    const events: EngineEvent[] = [];
    this.db.transaction((): void => {
      this.db.prepare(`UPDATE runs SET last_activity = ? WHERE id = ?`).run(now, run.id);
      this.insertChildRuns(run, parentNodeId, plans, events, now);
      if (fanout !== undefined) {
        const droppedNote =
          fanout.dropped.length > 0
            ? `（max 截断，丢弃 ${fanout.dropped.length} 个：${fanout.dropped.map(formatItem).join('、')}）`
            : '';
        this.db
          .prepare(
            `INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
             VALUES (?, ?, ?, 'dispatched', ?, ?, NULL, ?, ?)`,
          )
          .run(
            run.id,
            parentNodeId,
            this.execCount(run.id, parentNodeId) + 1,
            `派出 ${plans.length} 个子任务${droppedNote}`,
            JSON.stringify({ children: plans.map((p) => p.runId), dropped: fanout.dropped }),
            now,
            now,
          );
      }
    })();
    for (const e of events) this.emit(e);
  }

  /** child 落库（在事务内调用）；child_spawned 事件随事务提交后发出 */
  private insertChildRuns(run: RunRow, parentNodeId: string, plans: ChildPlan[], events: EngineEvent[], now: string): void {
    const stmt = this.db
      .prepare(
        `INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node,
           status, cwd, project_name, child_token, parent_node, retry_of, fanout_item, steps_used, last_activity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      );
    for (const c of plans) {
      stmt.run(c.runId, run.id, run.root_run_id, c.flowId, c.snapshotHash, c.entry, c.entry, run.cwd, run.project_name, c.token, parentNodeId, c.retryOf, c.fanoutItem, now, now);
      events.push({ type: 'child_spawned', runId: run.id, nodeId: parentNodeId, childRunId: c.runId, at: now });
    }
  }

  /** (run, 派发节点) 的 child 槽位：每槽 = 原始 run + 最新替代（重派后的那个，若有）。
   *  nodeId 为 null 表示该 run 的全部 child（join 缺省语义，§4 join.waitFor）。 */
  private childSlots(runId: string, nodeId: string | null): Array<{ original: RunRow; latest: RunRow }> {
    const rows = (
      nodeId !== null
        ? this.db
            .prepare(
              `SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NULL ORDER BY created_at, rowid`,
            )
            .all(runId, nodeId)
        : this.db
            .prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND retry_of IS NULL ORDER BY created_at, rowid`)
            .all(runId)
    ) as RunRow[];
    return rows.map((o) => {
      const retry = this.runBy('retry_of = ?', o.id);
      return { original: o, latest: retry ?? o };
    });
  }

  /** 派发步当前要派的那一批 child（视图用）：有重派批就只看重派批，否则原始批 */
  private currentWave(runId: string, nodeId: string): RunRow[] {
    const retries = this.db
      .prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NOT NULL ORDER BY created_at, rowid`)
      .all(runId, nodeId) as RunRow[];
    if (retries.length > 0) return retries;
    return this.db
      .prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NULL ORDER BY created_at, rowid`)
      .all(runId, nodeId) as RunRow[];
  }

  /** child 置 failed（§7.5 "未回报"路径）；run_finished 事件让面板立即看到 */
  private failChild(child: RunRow, now: string): void {
    this.db
      .prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`)
      .run(now, now, child.id);
    this.emit({ type: 'run_finished', runId: child.id, outcome: 'fail', at: now });
  }

  /** child 的结果条目（join 视图与汇总 payload 用）；summary 取它最后一条轨迹 */
  private childResultOf(child: RunRow): { childToken: string; status: string; summary: string } {
    return { childToken: child.child_token ?? '', status: child.status, summary: this.childSummaryOf(child.id) };
  }

  private childSummaryOf(runId: string): string {
    const row = this.db
      .prepare('SELECT summary FROM node_executions WHERE run_id = ? ORDER BY id DESC LIMIT 1')
      .get(runId) as { summary: string | null } | undefined;
    return row?.summary ?? '';
  }

  /** fan-out 条目渲染：把 extraPrompt 里的 {{item}} 替换为该 child 的条目（非 fan-out 原样返回） */
  private renderItem(text: string, fanoutItem: string | null): string {
    if (fanoutItem === null || !text.includes('{{')) return text;
    let value: unknown;
    try {
      value = JSON.parse(fanoutItem);
    } catch {
      value = fanoutItem;
    }
    return text.replace(/\{\{\s*item\s*\}\}/g, () => (typeof value === 'string' ? value : JSON.stringify(value)));
  }

private childFlowOf(run: RunRow, node: SubagentNode, snapshot: FlowSnapshot, fanoutItem: string | null): Flow {
  const parent = snapshot.flows[snapshot.rootFlowId]!;
  const name = node.title?.trim() !== '' && node.title !== undefined ? node.title : node.id;
  if (node.mode === 'inline') {
    return {
      id: `${parent.id}::${node.id}`,
      name,
      entry: 'task',
      // 主 run 产物插值 + fan-out 条目（{{item}}）都渲染进子任务指令——child 上下文里两者都取不到
      nodes: [{ id: 'task', type: 'prompt', instruction: this.renderItem(this.render(node.extraPrompt, run.id), fanoutItem) }],
    };
  }
  if (node.mode === 'subflow') {
    const sub = node.subflow;
    if (sub === undefined) throw new Error(`节点 ${node.id} 是 subflow 模式但没有内嵌子图`);
    return { id: `${parent.id}::${node.id}`, name, entry: sub.entry, maxSteps: sub.maxSteps, nodes: sub.nodes };
  }
  const ref = snapshot.flows[node.flowRef ?? ''];
  if (ref === undefined) throw new Error(`flowRef 引用的图不在快照里：${node.flowRef}（节点 ${node.id}）`);
  return ref;
}


  // ---- 内部 ----

  private resultForRun(run: RunRow, via: string): StepOpResult {
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'stale') {
      const outcome = this.runOutcome(run);
      const note =
        run.status === 'stale'
          ? `这个 run 已被标记为 stale（服务端重启或长时间无活动）。`
          : `这个 run 已经结束（${run.status}）。`;
      return this.finishedResult(run.id, outcome, `${note}via ${via} 查询；如需重跑请调 start_run。`);
    }
    return this.stepResult(run.id);
  }

  private runOutcome(run: RunRow): 'success' | 'fail' {
    if (run.status === 'failed') return 'fail';
    const snapshot = this.snapshotOf(run);
    const end = run.current_node !== null ? findNode(snapshot, run.current_node) : undefined;
    if (end !== undefined && end.type === 'end') return end.outcome;
    return 'success';
  }

  private stepResult(runId: string): StepResult | SelfHealError {
    const run = this.runById(runId);
    if (run === null || run.current_node === null) {
      return selfHeal(`run ${runId} 不存在或没有当前节点。`, '调 get_current_step 查最新状态。');
    }
    const snapshot = this.snapshotOf(run);
    const node = findNode(snapshot, run.current_node);
    if (node === undefined) {
      return selfHeal(
        `快照里找不到节点 ${run.current_node}（run ${runId} 的数据异常）。`,
        '这是服务端数据问题，请把这条错误原样反馈给用户。',
        null,
      );
    }
    const result: StepResult = {
      runId: run.id,
      step: this.buildStepView(run, node),
      discipline: DISCIPLINE_TEXT,
      progress: { completed: this.completedCount(run.id) },
    };
    if (node.type === 'gate') {
      result.note = '人工卡点：run 已挂起等确认。把问题转达用户后调 await_gate(gateId) 等待（每轮 60 秒）；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。';
    }
    if (node.type === 'subagent') {
      result.note = '派发步：把每个 child 的 preamble 原样放进对应子任务开头（不许改写或摘要），extraPrompt 一并带上。等全部子任务返回后再调 get_current_step()，服务端会汇聚结果给出下一步。';
      // 不静默截断（铁律 6）：被 max 丢弃的条目在下发内容里也说一遍
      const dRow = this.db
        .prepare("SELECT payload FROM node_executions WHERE run_id = ? AND node_id = ? AND status = 'dispatched' ORDER BY id DESC LIMIT 1")
        .get(run.id, node.id) as { payload: string } | undefined;
      if (dRow !== undefined) {
        const dropped = (JSON.parse(dRow.payload) as { dropped?: unknown[] }).dropped ?? [];
        if (dropped.length > 0) {
          result.note += `fan-out 已按 max 截断：丢弃了 ${dropped.length} 个条目（${dropped.map(formatItem).join('、')}），监控页轨迹有完整记录。`;
        }
      }
    }
    return result;
  }

  private finishedResult(runId: string, outcome: 'success' | 'fail', note?: string): RunFinishedResult {
    return {
      runId,
      finished: true,
      outcome,
      note,
      progress: { completed: this.completedCount(runId) },
    };
  }

  private currentRef(run: RunRow): SelfHealError['current'] {
    const snapshot = this.snapshotOf(run);
    const node = run.current_node !== null ? findNode(snapshot, run.current_node) : undefined;
    if (node === undefined) return null;
    return { runId: run.id, step: this.buildStepView(run, node) };
  }

  /** 下发视图：插值已渲染、branches 已剥离 to、'*' 条件转成人话 */
  private buildStepView(run: RunRow, node: FlowNode): StepView {
    const view: StepView = {
      nodeId: node.id,
      kind: node.type,
      title: node.title?.trim() !== '' && node.title !== undefined ? node.title : node.id,
      instruction: this.render(
        node.instruction?.trim() !== '' && node.instruction !== undefined
          ? node.instruction
          : node.type === 'gate'
            ? '人工卡点：把问题原样转达用户，等他答复。'
            : '',
        run.id,
      ),
    };
    if (node.type === 'tool') {
      view.tool = {
        name: node.toolName,
        params: renderParams(node.params ?? {}, (text) => this.render(text, run.id)),
      };
    }
    // gate 不下发 branches：选项即出口（options），人工选择，Agent 无需分支条件（降噪）
    if ((node.branches ?? []).length > 0 && node.type !== 'gate') {
      view.branches = node.branches!.map((b) => ({
        id: b.id,
        condition: b.condition === '*' ? '默认：其他分支都不满足时走这条' : b.condition,
      }));
    }
    if (node.type === 'end') {
      view.outcome = node.outcome;
    }
    if (node.type === 'gate') {
      const pending = this.pendingDecisionOf(run.id, node.id);
      if (pending !== null) view.gateId = String(pending.id);
      view.question = node.question;
      view.options = node.options.map((o) => ({ id: o.id, label: o.label }));
    }
    if (node.type === 'subagent') {
      // 派发步（§6.2）：当前批 child 的 token + preamble + 任务提示；extraPrompt 随主 run 插值渲染，fan-out 再渲染各自条目
      const wave = this.currentWave(run.id, node.id);
      if (wave.length > 0) {
        view.children = wave.map((c) => ({
          childToken: c.child_token ?? '',
          preamble: preambleText(run.id, node.id, c.child_token ?? ''),
          extraPrompt: this.renderItem(this.render(node.extraPrompt, run.id), c.fanout_item),
        }));
      }
    }
    if (node.type === 'join') {
      // 汇聚步（§6.2）：childResults + aggregateInstruction（结果摘要拼进 instruction，主 Agent 直接可读）
      const slots = this.childSlots(run.id, node.waitFor ?? null);
      const results = slots.map((s) => this.childResultOf(s.latest));
      const lines = results.map((r) => `- ${r.status === 'completed' ? '✓' : '✗'} ${r.summary}`);
      view.childResults = results;
      view.aggregateInstruction = this.render(node.aggregateInstruction, run.id);
      view.instruction =
        lines.length > 0
          ? `${view.aggregateInstruction}\n\n各子任务结果：\n${lines.join('\n')}`
          : view.aggregateInstruction;
    }
    return view;
  }

  /** {{nodeId.payload.field}} 插值：用该 run 中该节点最近一次执行的 payload 渲染（§4.4）。
   *  引用的节点没跑过或字段不存在时保留原 token——让 Agent 能看出缺了什么，而不是拿到一段静默错误的文本。 */
  private render(text: string, runId: string): string {
    return text.replace(/\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g, (raw, expr: string) => {
      const value = this.lookupExpr(expr, runId);
      return value === undefined ? raw : typeof value === 'string' ? value : JSON.stringify(value);
    });
  }

  private lookupExpr(expr: string, runId: string): unknown {
    const parts = expr.split('.');
    const [nodeId, payloadSeg, ...path] = parts;
    if (payloadSeg !== 'payload' || nodeId === undefined || path.length === 0) return undefined;
    // 只取 completed：blocked / limit_exceeded 轨迹不带产物，不能遮蔽此前真实执行的结果
    const row = this.db
      .prepare(
        "SELECT payload FROM node_executions WHERE run_id = ? AND node_id = ? AND status = 'completed' ORDER BY iteration DESC, id DESC LIMIT 1",
      )
      .get(runId, nodeId) as { payload: string } | undefined;
    if (row === undefined) return undefined;
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    let cur: unknown = payload;
    for (const seg of path) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  }

  private completedCount(runId: string): number {
    return (
      this.db
        .prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND status = 'completed'")
        .get(runId) as { c: number }
    ).c;
  }

  /** run 定位顺序：childToken（子 Agent）→ runId（显式）→ hostSession（DSH 会话绑定） */
  private resolveRun(ref: RunRef): RunRow | null {
    if (ref.childToken !== undefined) {
      return this.runBy('child_token = ?', ref.childToken);
    }
    if (ref.runId !== undefined) {
      return this.runBy('id = ?', ref.runId);
    }
    if (ref.hostSession !== undefined) {
      return this.latestRunByHostSession(ref.hostSession);
    }
    return null;
  }

  /** 按 DSH 会话定位：优先活跃 run；没有时回落到最近的 run（已终结也能答"跑完了"而不是"找不到"）。rowid 决胜同一毫秒的建 run */
  private latestRunByHostSession(hostSession: string): RunRow | null {
    const active = this.db
      .prepare(
        `SELECT * FROM runs WHERE host_session = ? AND status IN ('running', 'waiting_gate', 'waiting_children') ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .get(hostSession) as RunRow | undefined;
    if (active !== undefined) return active;
    return (
      (this.db
        .prepare(`SELECT * FROM runs WHERE host_session = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
        .get(hostSession) as RunRow | undefined) ?? null
    );
  }

  private runBy(where: string, arg: string): RunRow | null {
    return (this.db.prepare(`SELECT * FROM runs WHERE ${where}`).get(arg) as RunRow | undefined) ?? null;
  }

  private runById(runId: string): RunRow | null {
    return this.runBy('id = ?', runId);
  }

  // ---- 卡点（§7.6）----

  /** gateId → 未决（pending）决策行；不是数字、不存在或已决都返回 null */
  private pendingGateById(gateId: string): GateDecisionRow | null {
    const id = Number.parseInt(gateId, 10);
    if (!Number.isInteger(id) || id <= 0) return null;
    return (
      (this.db.prepare('SELECT * FROM gate_decisions WHERE id = ? AND decided_at IS NULL').get(id) as
        | GateDecisionRow
        | undefined) ?? null
    );
  }

  /** gateId → 决策行（不论已决与否） */
  private gateRowById(gateId: string): { run_id: string } | undefined {
    const id = Number.parseInt(gateId, 10);
    if (!Number.isInteger(id) || id <= 0) return undefined;
    return this.db.prepare('SELECT run_id FROM gate_decisions WHERE id = ?').get(id) as { run_id: string } | undefined;
  }

  /** run + 节点 → 最近一条未决决策行 */
  private pendingDecisionOf(runId: string, nodeId: string): GateDecisionRow | null {
    return (
      (this.db
        .prepare(
          'SELECT * FROM gate_decisions WHERE run_id = ? AND node_id = ? AND decided_at IS NULL ORDER BY id DESC LIMIT 1',
        )
        .get(runId, nodeId) as GateDecisionRow | undefined) ?? null
    );
  }

  /** 写 pending 决策行（在事务内调用）；source 先占位 'pending'，放行时更新为真实通道 */
  private insertPendingGate(runId: string, node: GateNode): number {
    const info = this.db
      .prepare(
        "INSERT INTO gate_decisions (run_id, node_id, question, option_id, note, source, decided_at) VALUES (?, ?, ?, NULL, NULL, 'pending', NULL)",
      )
      .run(runId, node.id, node.question);
    return Number(info.lastInsertRowid);
  }

  /** run 直接落在卡点上（入口即 gate）：挂起 + 写 pending，独立事务 */
  private enterGate(runId: string, node: GateNode, now: string): number {
    return this.db.transaction((): number => {
      this.db
        .prepare(`UPDATE runs SET status = 'waiting_gate', last_activity = ? WHERE id = ?`)
        .run(now, runId);
      return this.insertPendingGate(runId, node);
    })();
  }

  /** 放行：决策行落选项、备注、来源与时间（在事务内调用） */
  private decideGateRow(decisionId: number, optionId: string, note: string | null, source: 'panel' | 'chat', now: string): void {
    this.db
      .prepare('UPDATE gate_decisions SET option_id = ?, note = ?, source = ?, decided_at = ? WHERE id = ?')
      .run(optionId, note, source, now, decisionId);
  }

  /** 自愈三段式的 current：终结态给 finished 形态，其余给当前步 */
  private currentOf(run: RunRow): SelfHealError['current'] {
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'stale') {
      return { runId: run.id, finished: true, outcome: this.runOutcome(run) };
    }
    return this.currentRef(run);
  }

  /** 解析最终推进目标（§4.5）：目标撞 iterationLimit 时不执行它，落 limit_exceeded 轨迹并改走 onLimitExceeded；
   *  无逃生出口判失败。校验器已保证逃生边可达终点，逃生链成环只是防御性兜底。 */
  private resolveAdvance(run: RunRow, snapshot: FlowSnapshot, successorId: string): AdvanceOutcome {
    const limitRows: LimitRow[] = [];
    const seen = new Set<string>();
    let targetId: string | null = successorId;
    while (typeof targetId === 'string') {
      const target = findNode(snapshot, targetId);
      if (target === undefined) return { kind: 'dangling', nodeId: targetId };
      if (
        target.type !== 'end' &&
        target.iterationLimit !== undefined &&
        this.execCount(run.id, target.id) >= target.iterationLimit
      ) {
        if (target.onLimitExceeded === undefined) {
          return {
            kind: 'fail',
            reason: `节点 ${target.id} 已到迭代上限（${target.iterationLimit} 次）且没有配 onLimitExceeded 逃生出口，run 判失败。`,
          };
        }
        if (seen.has(target.id)) {
          return { kind: 'fail', reason: `节点 ${target.id} 撞迭代上限后逃生链成环，run 判失败。` };
        }
        seen.add(target.id);
        limitRows.push({ nodeId: target.id, iteration: this.execCount(run.id, target.id) + 1, limit: target.iterationLimit });
        targetId = target.onLimitExceeded;
        continue;
      }
      return { kind: 'advance', targetId, limitRows };
    }
    return { kind: 'advance', targetId: null, limitRows };
  }

  /** 单事务推进：落本步轨迹（completed / blocked）+ 迭代逃生轨迹 + 卡点决策更新 + 子 run 落库 + 更新 run 指针/状态，任何一步失败整体回滚。
   *  目标是 gate 时置 waiting_gate 并写 pending 卡点决策（§7.6）；目标是 subagent 时置 waiting_children（child 落库由调用方在事务后补，见 completeStep）。
   *  事件在事务提交后才发（事务内只收集），回滚不会产生假事件。 */
  private advanceTransaction(
    run: RunRow,
    snapshot: FlowSnapshot,
    plan: AdvanceOutcome,
    first: { nodeId: string; status: 'completed' | 'blocked'; summary: string; payload: string; branchId: string | null },
    now: string,
    gate?: { decisionId: number; optionId: string; note: string | null; source: 'panel' | 'chat' },
  ): void {
    const events: EngineEvent[] = [{ type: 'step_completed', runId: run.id, nodeId: first.nodeId, status: first.status, at: now }];
    this.db.transaction((): void => {
      if (gate !== undefined) {
        this.decideGateRow(gate.decisionId, gate.optionId, gate.note, gate.source, now);
      }
      const insert = this.db.prepare(
        `INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run(run.id, first.nodeId, this.execCount(run.id, first.nodeId) + 1, first.status, first.summary, first.payload, first.branchId, now, now);
      const limitRows = plan.kind === 'advance' ? plan.limitRows : [];
      for (const row of limitRows) {
        insert.run(run.id, row.nodeId, row.iteration, 'limit_exceeded', `撞迭代上限（${row.limit} 次），未执行该节点，按 onLimitExceeded 逃生`, '{}', null, now, now);
        events.push({ type: 'step_completed', runId: run.id, nodeId: row.nodeId, status: 'limit_exceeded', at: now });
      }
      const stepsUsed = run.steps_used + 1 + limitRows.length;
      if (plan.kind === 'fail' || plan.kind === 'dangling') {
        this.db
          .prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`)
          .run(stepsUsed, now, now, run.id);
        events.push({ type: 'run_finished', runId: run.id, outcome: 'fail', at: now });
        return;
      }
      if (plan.targetId === null) {
        // 隐式 end（无后继）：run 终结
        this.db
          .prepare(`UPDATE runs SET current_node = NULL, status = 'completed', outcome = 'success', steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`)
          .run(stepsUsed, now, now, run.id);
        events.push({ type: 'run_finished', runId: run.id, outcome: 'success', at: now });
        return;
      }
      const target = findNode(snapshot, plan.targetId);
      if (target !== undefined && target.type === 'end') {
        this.db
          .prepare(`UPDATE runs SET current_node = ?, status = 'completed', outcome = ?, steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`)
          .run(target.id, target.outcome, stepsUsed, now, now, run.id);
        events.push({ type: 'run_finished', runId: run.id, outcome: target.outcome, at: now });
      } else if (target !== undefined && target.type === 'gate') {
        // 卡点（§7.6）：挂起等人工，写 pending 决策行
        this.db
          .prepare(`UPDATE runs SET current_node = ?, status = 'waiting_gate', steps_used = ?, last_activity = ? WHERE id = ?`)
          .run(target.id, stepsUsed, now, run.id);
        const gateId = this.insertPendingGate(run.id, target);
        events.push({ type: 'gate_pending', runId: run.id, nodeId: target.id, gateId: String(gateId), question: target.question, at: now });
      } else if (target !== undefined && target.type === 'subagent') {
        // 派发步（§7.1）：挂起等子 Agent 回报；child run 由调用方在事务提交后落库（extraPrompt 插值需要本事务刚提交的产物）
        this.db
          .prepare(`UPDATE runs SET current_node = ?, status = 'waiting_children', steps_used = ?, last_activity = ? WHERE id = ?`)
          .run(target.id, stepsUsed, now, run.id);
      } else {
        // 普通推进：status 显式回 running——从卡点放行出来时 run 还挂着 waiting_gate
        this.db
          .prepare(`UPDATE runs SET current_node = ?, status = 'running', steps_used = ?, last_activity = ? WHERE id = ?`)
          .run(plan.targetId, stepsUsed, now, run.id);
      }
    })();
    for (const e of events) this.emit(e);
  }

  /** 推进事务提交后的应答：失败/悬空/隐式 end/显式 end/下一步，与 complete_step / report_blocked 共用 */
  private resultForPlan(runId: string, snapshot: FlowSnapshot, plan: AdvanceOutcome): StepOpResult {
    if (plan.kind === 'fail') return this.finishedResult(runId, 'fail', plan.reason);
    if (plan.kind === 'dangling') {
      return this.finishedResult(runId, 'fail', `后继节点 ${plan.nodeId} 在快照里不存在，run 判失败。`);
    }
    // 逃生说明：Agent 刚交完一步就看到跳变，必须解释为什么
    const escapeNote =
      plan.limitRows.length > 0
        ? `迭代逃生：${plan.limitRows.map((r) => `${r.nodeId} 撞迭代上限（${r.limit} 次）未执行，改走 onLimitExceeded。`).join('')}`
        : undefined;
    if (plan.targetId === null) {
      return this.finishedResult(runId, 'success', escapeNote ?? '节点没有后继，按隐式 end 收尾。');
    }
    const target = findNode(snapshot, plan.targetId);
    if (target !== undefined && target.type === 'end') {
      return this.finishedResult(runId, target.outcome, escapeNote);
    }
    const step = this.stepResult(runId);
    if (escapeNote !== undefined && 'step' in step) {
      return { ...step, note: step.note !== undefined ? `${escapeNote}${step.note}` : escapeNote };
    }
    return step;
  }

  /** 该节点在本次 run 里的轨迹条数（completed / blocked / limit_exceeded 都算占了一次迭代） */
  private execCount(runId: string, nodeId: string): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND node_id = ?').get(runId, nodeId) as {
        c: number;
      }
    ).c;
  }

  /** run 级防绕圈（§4.5）：默认 200 步，撞上判 run 失败 */
  private maxStepsOf(snapshot: FlowSnapshot): number {
    return snapshot.flows[snapshot.rootFlowId]!.maxSteps ?? 200;
  }

  private failRun(run: RunRow): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`)
      .run(now, now, run.id);
    this.emit({ type: 'run_finished', runId: run.id, outcome: 'fail', at: now });
  }

  private snapshotOf(run: RunRow): FlowSnapshot {
    const snapshot = loadSnapshot(this.db, run.flow_snapshot_hash);
    if (snapshot === undefined) {
      throw new Error(`快照丢失：${run.flow_snapshot_hash}（run ${run.id}）`);
    }
    return snapshot;
  }
}

function findNode(snapshot: FlowSnapshot, nodeId: string): FlowNode | undefined {
  return snapshot.flows[snapshot.rootFlowId]!.nodes.find((n) => n.id === nodeId);
}

/** run 是否已到终态（child 汇聚用：没到终态的就是"未回报"） */
function isTerminalRun(run: RunRow): boolean {
  return run.status === 'completed' || run.status === 'failed' || run.status === 'stale';
}

/** subagent 节点 → 子 run 要跑的图（§4 subagent.mode 三态）。
 *  inline：合成单节点图（extraPrompt 即任务，用主 run 数据渲染插值——child 上下文里没有主 run 的产物）；
 *  subflow：内嵌子图（自包含，插值在 child 上下文里正常走）；flowRef：从父快照取——
 *  不回读当前库，child 与主 run 钉同一版本（copy-on-run 一致性，§5.2）。 */
/** §8.3 子 Agent preamble：必须原样前置的块，主 Agent 派发时逐字携带 */
function preambleText(runId: string, nodeId: string, token: string): string {
  return [
    '[以下三行由流程引擎提供，请原样前置，不要改写或摘要]',
    `你是流程 ${runId} 节点 ${nodeId} 派出的子任务，你的 childToken 是 ${token}。`,
    `调 get_current_step({childToken:"${token}"}) 取你这一步要做什么。`,
    `做完调 complete_step({childToken:"${token}", summary, payload?, branchId})。`,
    '[主 Agent 的补充说明写在这行之后]',
  ].join('\n');
}

/** fan-out 条目转可读文本（截断记录、缺失名单用） */
function formatItem(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function renderParams(
  params: Record<string, unknown>,
  render: (text: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = typeof value === 'string' ? render(value) : value;
  }
  return out;
}

function selfHeal(
  what: string,
  guidance: string,
  current: SelfHealError['current'] = null,
): SelfHealError {
  return { error: true, what, guidance, current };
}

/** await_gate 轮询间隔让出事件循环（SQLite 同步查询本身不阻塞） */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
