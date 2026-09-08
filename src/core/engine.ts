// 执行引擎（设计文档 §7）。Phase 2-3 范围：串行推进 prompt / tool / end，
// 分支求值边界（§7.3）、环与迭代上限（§4.5 iterationLimit / maxSteps）、report_blocked（§7.8）；
// gate / subagent / join 在阶段 5-6。
// 三条铁律（§6.2 / §6.3 / §7.2）：
// - 单事务推进：校验、落 node_executions、定位后继、更新 run 一个事务内完成，中途失败不推进
// - 降噪下发：branches 剥离 to、progress 不含总数；每个响应复述 runId + nodeId
// - 自愈式报错：所有拒绝路径返回三段式（错在哪 + 正确姿势 + 当前这一步）
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Flow, FlowNode, FlowSnapshot, NodeType } from './types.js';
import { buildSnapshot, loadSnapshot, persistSnapshot } from './snapshot.js';
import { validateFlow } from './validate.js';

/** Phase 2 支持串行推进的节点类型；其余类型在 start_run 时整体拒绝 */
const SUPPORTED_TYPES: ReadonlySet<NodeType> = new Set(['prompt', 'tool', 'end']);

/** 服务端下发的循环纪律文本（§6.4：不进 Skill 文件，跟服务端版本走） */
export const DISCIPLINE_TEXT = [
  '你正在按一张流程图分步推进任务。图不会一次给你全部内容——每次只给当前这一步，做完回报后才给下一步。',
  '硬的一条：每步做完必须调 complete_step，否则链条断在你这里。',
  '完全放开的：执行某一步时你想多读文件、多跑命令、多查一点，随意，只要最后把结果回报。',
  '不确定自己在哪：调 get_current_step()，它幂等，随时可调。',
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
  /** 宿主会话 id（"<host>:<sid>"，PreToolUse hook 注入），主 Agent 的首要身份锚点，重连不变 */
  hostSession?: string;
  /** 宿主 MCP 会话 id（Mcp-Session-Id），传输层兜底锚点；Codex 侧会话过期重握手会更换 */
  mcpSessionId?: string;
}

/** run 定位：子 Agent 用 childToken；主 Agent 用 runId 或会话绑定 */
export interface RunRef {
  runId?: string;
  childToken?: string;
  /** 宿主会话 id（hook 注入），优先于 mcpSessionId */
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

/** 引擎事件（§9.3 SSE 的数据源）。core 层只回调不落地传输——HTTP/SSE 由 server 层接线 */
export type EngineEvent =
  | { type: 'run_started'; runId: string; flowId: string; at: string }
  | { type: 'step_completed'; runId: string; nodeId: string; status: 'completed' | 'blocked' | 'limit_exceeded'; at: string }
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
  flow_id: string;
  flow_snapshot_hash: string;
  entry_node: string;
  current_node: string | null;
  status: string;
  steps_used: number;
}

export interface EngineDeps {
  db: Database.Database;
  /** 按图 id 或展示名解析（start_run 的 flowName） */
  resolveFlow(flowName: string): Flow | undefined;
  /** 引擎事件回调（SSE 数据源，§9.3）；不传则丢弃 */
  onEvent?: (event: EngineEvent) => void;
}

export class ExecutionEngine {
  private readonly db: Database.Database;
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
        `流程「${flow.name}」包含当前版本尚未支持的节点类型：${list}。`,
        '换一张只含 prompt / tool / end 的流程，或在面板里删掉这些节点。gate / subagent / join 将在后续版本支持。',
      );
    }

    const snapshot = buildSnapshot(flow, { get: (id) => this.resolveFlow(id) });
    const hash = persistSnapshot(this.db, snapshot);
    const runId = `run_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO runs (id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node,
           status, cwd, project_name, host_session, mcp_session_id, steps_used, last_activity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(runId, runId, flow.id, hash, flow.entry, flow.entry, params.cwd ?? null, params.projectName ?? null, params.hostSession ?? null, params.mcpSessionId ?? null, now, now);
    this.emit({ type: 'run_started', runId, flowId: flow.id, at: now });

    return this.stepResult(runId);
  }

  /** 幂等。返回"我在哪、要干啥"；上下文压缩后的恢复入口 */
  getCurrentStep(ref: RunRef, mcpSessionId?: string): StepOpResult {
    const run = this.resolveRun(ref, mcpSessionId);
    if (run === null) {
      return selfHeal(
        ref.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run。',
        '主 Agent 调 start_run 开始一个流程；如果上下文被压缩过、不确定自己在哪，这个结果就是答案的来源——先 start_run 或问用户该跑哪张图。',
      );
    }
    return this.resultForRun(run, 'get_current_step');
  }

  /** 推进一格：校验 → 落库 → 定位后继（含迭代上限逃生）→ 渲染插值 → 返回下一步 */
  completeStep(params: CompleteStepParams, mcpSessionId?: string): StepOpResult {
    const run = this.resolveRun(params, mcpSessionId);
    if (run === null) {
      return selfHeal(
        params.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run，没法提交结果。',
        '调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。',
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
    return this.resultForPlan(run.id, snapshot, plan);
  }

  /** 干不下去了（§7.8）：落 blocked 轨迹，三级出口 onLimitExceeded → default 分支 → run 判失败。不做自动重试 */
  reportBlocked(params: ReportBlockedParams, mcpSessionId?: string): StepOpResult {
    const run = this.resolveRun(params, mcpSessionId);
    if (run === null) {
      return selfHeal(
        params.childToken !== undefined
          ? '这个 childToken 没有对应的 run（可能已过期或写错）。'
          : '没有找到你正在进行的 run，没法上报阻塞。',
        '调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。',
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
    return {
      runId: run.id,
      step: this.buildStepView(run, node),
      discipline: DISCIPLINE_TEXT,
      progress: { completed: this.completedCount(run.id) },
    };
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
      instruction: this.render(node.instruction ?? '', run.id),
    };
    if (node.type === 'tool') {
      view.tool = {
        name: node.toolName,
        params: renderParams(node.params ?? {}, (text) => this.render(text, run.id)),
      };
    }
    if ((node.branches ?? []).length > 0) {
      view.branches = node.branches!.map((b) => ({
        id: b.id,
        condition: b.condition === '*' ? '默认：其他分支都不满足时走这条' : b.condition,
      }));
    }
    if (node.type === 'end') {
      view.outcome = node.outcome;
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

  /** run 定位顺序：childToken（子 Agent）→ runId（显式）→ hostSession（宿主会话，hook 注入）→ mcpSessionId（传输层兜底） */
  private resolveRun(ref: RunRef, mcpSessionId?: string): RunRow | null {
    if (ref.childToken !== undefined) {
      return this.runBy('child_token = ?', ref.childToken);
    }
    if (ref.runId !== undefined) {
      return this.runBy('id = ?', ref.runId);
    }
    if (ref.hostSession !== undefined) {
      const run = this.latestRunBy('host_session', ref.hostSession);
      if (run !== null) return run;
    }
    if (mcpSessionId !== undefined) {
      return this.latestRunBy('mcp_session_id', mcpSessionId);
    }
    return null;
  }

  /** 按会话列定位：优先活跃 run；没有时回落到最近的 run（已终结也能答"跑完了"而不是"找不到"）。rowid 决胜同一毫秒的建 run */
  private latestRunBy(column: 'host_session' | 'mcp_session_id', value: string): RunRow | null {
    const active = this.db
      .prepare(
        `SELECT * FROM runs WHERE ${column} = ? AND status IN ('running', 'waiting_gate', 'waiting_children') ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .get(value) as RunRow | undefined;
    if (active !== undefined) return active;
    return (
      (this.db
        .prepare(`SELECT * FROM runs WHERE ${column} = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
        .get(value) as RunRow | undefined) ?? null
    );
  }

  private runBy(where: string, arg: string): RunRow | null {
    return (this.db.prepare(`SELECT * FROM runs WHERE ${where}`).get(arg) as RunRow | undefined) ?? null;
  }

  private runById(runId: string): RunRow | null {
    return this.runBy('id = ?', runId);
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

  /** 单事务推进：落本步轨迹（completed / blocked）+ 迭代逃生轨迹 + 更新 run 指针/状态，任何一步失败整体回滚。
   *  事件在事务提交后才发（事务内只收集），回滚不会产生假事件。 */
  private advanceTransaction(
    run: RunRow,
    snapshot: FlowSnapshot,
    plan: AdvanceOutcome,
    first: { nodeId: string; status: 'completed' | 'blocked'; summary: string; payload: string; branchId: string | null },
    now: string,
  ): void {
    const events: EngineEvent[] = [{ type: 'step_completed', runId: run.id, nodeId: first.nodeId, status: first.status, at: now }];
    this.db.transaction((): void => {
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
      } else {
        this.db
          .prepare(`UPDATE runs SET current_node = ?, steps_used = ?, last_activity = ? WHERE id = ?`)
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
    return escapeNote !== undefined && 'step' in step ? { ...step, note: escapeNote } : step;
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
