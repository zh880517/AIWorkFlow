// 执行引擎测试（设计文档 §6.2 / §6.3 / §7.2 / §7.3 的 Phase 2 范围）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb, type TestDb } from './support/db.js';
import { FlowStore } from './support/flowStore.js';
import {
  ExecutionEngine,
  DISCIPLINE_TEXT,
  type StepResult,
  type RunFinishedResult,
  type SelfHealError,
  type EngineEvent,
} from '../shared/src/engine.js';
import type { Flow } from '../shared/src/types.js';

let tmpHome: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-engine-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
});

afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

// ---- fixtures ----

function linearFlow(): Flow {
  return {
    id: 'f_linear',
    name: '直线图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
}

function branchFlow(): Flow {
  return {
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
}

function interpolationFlow(): Flow {
  return {
    id: 'f_interp',
    name: '插值图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '确定项目', next: 'n2' },
      {
        id: 'n2',
        type: 'tool',
        title: '跑测试',
        toolName: 'Bash',
        instruction: '对 {{n1.payload.project}} 跑测试',
        params: { command: 'dotnet test {{n1.payload.project}}' },
        next: 'n3',
      },
      { id: 'n3', type: 'end', outcome: 'success' },
    ],
  };
}

function gateFlow(): Flow {
  return {
    id: 'f_gate',
    name: '卡点图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '准备发布', next: 'n_gate' },
      {
        id: 'n_gate',
        type: 'gate',
        title: '发布确认',
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
}

/** 入口即卡点（无 branches，走 next） */
function entryGateFlow(): Flow {
  return {
    id: 'f_entry_gate',
    name: '入口卡点图',
    entry: 'n_gate',
    nodes: [
      {
        id: 'n_gate',
        type: 'gate',
        question: '要开始吗？',
        options: [{ id: 'opt_yes', label: '开始' }],
        next: 'n2',
      },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
}

/** 裸卡点：选项没连任何出口（校验器警告档），决策后判失败 */
function unwiredGateFlow(): Flow {
  return {
    id: 'f_unwired_gate',
    name: '未连线卡点图',
    entry: 'n_gate',
    nodes: [
      {
        id: 'n_gate',
        type: 'gate',
        question: '选哪条路？',
        options: [
          { id: 'opt_a', label: 'A 路' },
          { id: 'opt_b', label: 'B 路' },
        ],
        branches: [{ id: 'b_a', condition: 'A 路', to: 'n_end', outlet: 'opt_a' }],
      },
      { id: 'n_end', type: 'end', outcome: 'success' },
    ],
  };
}

// 验收场景：改代码 → 跑测试，失败回退重跑（环），撞 iterationLimit 走逃生
function retryFlow(escape: boolean): Flow {
  return {
    id: escape ? 'f_retry' : 'f_retry_noesc',
    name: escape ? '测试回退环' : '无逃生回退环',
    entry: 'n_fix',
    nodes: [
      { id: 'n_fix', type: 'prompt', instruction: '按失败原因改代码（第 {{n_test.payload.round}} 轮）', next: 'n_test' },
      {
        id: 'n_test',
        type: 'tool',
        title: '跑测试',
        toolName: 'Bash',
        instruction: '跑测试',
        params: { command: 'npm test' },
        iterationLimit: 2,
        ...(escape ? { onLimitExceeded: 'n_fail' } : {}),
        branches: [
          { id: 'b_pass', condition: '全部通过', to: 'n_ok' },
          { id: 'b_fail', condition: '有测试失败', to: 'n_fix' },
        ],
      },
      { id: 'n_ok', type: 'end', outcome: 'success' },
      // 无逃生变体不配 onLimitExceeded，n_fail 没有入边会被 E_UNREACHABLE 硬拒
      ...(escape ? [{ id: 'n_fail', type: 'end' as const, outcome: 'fail' as const }] : []),
    ],
  };
}

// 回路级上限：控制器 n_test 每跑一次算一轮；n_fix 与 n_test 共享同一个 loopId
function loopLimitFlow(): Flow {
  return {
    id: 'f_loop_limit',
    name: '回路上限图',
    entry: 'n_fix',
    nodes: [
      { id: 'n_fix', type: 'prompt', instruction: '按失败原因改代码', next: 'n_test', loopId: 'test-loop' },
      {
        id: 'n_test',
        type: 'prompt',
        instruction: '跑测试',
        loopId: 'test-loop',
        maxRounds: 2,
        // 故意给一个更高、不会被用到的节点级上限：验证回路上限优先
        iterationLimit: 10,
        onLimitExceeded: 'n_fail',
        branches: [
          { id: 'b_pass', condition: '全部通过', to: 'n_ok' },
          { id: 'b_fail', condition: '*', to: 'n_fix' },
        ],
      },
      { id: 'n_ok', type: 'end', outcome: 'success' },
      { id: 'n_fail', type: 'end', outcome: 'fail' },
    ],
  };
}

// 两个修正节点共用一个循环：控制器仍在 n_test，验证非控制器目标也按同一计数逃生
function loopLimitSharedFlow(): Flow {
  return {
    id: 'f_loop_shared',
    name: '回路共享上限图',
    entry: 'n_fix',
    nodes: [
      { id: 'n_fix', type: 'prompt', instruction: '改一版', next: 'n_fix2', loopId: 'test-loop' },
      { id: 'n_fix2', type: 'prompt', instruction: '再补一版', next: 'n_test', loopId: 'test-loop' },
      {
        id: 'n_test',
        type: 'prompt',
        instruction: '跑测试',
        loopId: 'test-loop',
        maxRounds: 2,
        iterationLimit: 10,
        onLimitExceeded: 'n_fail',
        branches: [
          { id: 'b_pass', condition: '全部通过', to: 'n_ok' },
          { id: 'b_fail', condition: '*', to: 'n_fix' },
        ],
      },
      { id: 'n_ok', type: 'end', outcome: 'success' },
      { id: 'n_fail', type: 'end', outcome: 'fail' },
    ],
  };
}

function maxStepsFlow(): Flow {
  return {
    id: 'f_max',
    name: '小上限图',
    entry: 'n1',
    maxSteps: 1,
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
      { id: 'n2', type: 'prompt', instruction: '第二步', next: 'n3' },
      { id: 'n3', type: 'end', outcome: 'success' },
    ],
  };
}

// n1 有 onLimitExceeded 逃生、无 default 分支；n_esc 的插值引用 n1 的产物
function blockedFlow(): Flow {
  return {
    id: 'f_block',
    name: '阻塞图',
    entry: 'n1',
    nodes: [
      {
        id: 'n1',
        type: 'prompt',
        instruction: '干一件事',
        iterationLimit: 5,
        onLimitExceeded: 'n_esc',
        branches: [{ id: 'b1', condition: '再试一次', to: 'n1' }],
      },
      { id: 'n_esc', type: 'prompt', instruction: '善后，处理 {{n1.payload.x}}', next: 'n_end' },
      { id: 'n_end', type: 'end', outcome: 'fail' },
    ],
  };
}

// n1 无 onLimitExceeded、无 default：report_blocked 后没有任何出口
function blockedNoExitFlow(): Flow {
  return {
    id: 'f_block2',
    name: '无出口阻塞图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '干一件事', branches: [{ id: 'b1', condition: '成功', to: 'n2' }] },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
}

function makeEngine(flows: Flow[], onEvent?: (event: EngineEvent) => void): { engine: ExecutionEngine; store: FlowStore; db: TestDb } {
  const db = openMemoryDb();
  const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
  for (const f of flows) {
    const r = store.save(f);
    if (!r.ok) throw new Error(`fixture 校验失败：${JSON.stringify(r.errors)}`);
  }
  return {
    db,
    engine: new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n), ...(onEvent !== undefined ? { onEvent } : {}) }),
    store,
  };
}

const isStep = (r: unknown): r is StepResult =>
  typeof r === 'object' && r !== null && 'step' in r && !('error' in r);
const isFinished = (r: unknown): r is RunFinishedResult =>
  typeof r === 'object' && r !== null && 'finished' in r;
const isErr = (r: unknown): r is SelfHealError =>
  typeof r === 'object' && r !== null && (r as { error?: unknown }).error === true;

// ---- start_run ----

describe('start_run', () => {
  it('返回纪律文本 + 第一步（降噪形态）', () => {
    const { engine } = makeEngine([linearFlow()]);
    const r = engine.startRun({ flowName: '直线图' });
    expect(isStep(r)).toBe(true);
    if (!isStep(r)) return;
    expect(r.runId).toMatch(/^run_/);
    expect(r.step.nodeId).toBe('n1');
    expect(r.step.kind).toBe('prompt');
    expect(r.step.instruction).toBe('第一步');
    expect(r.discipline).toContain('complete_step');
    expect(r.discipline).toBe(DISCIPLINE_TEXT);
    // 降噪：progress 不含总数
    expect(r.progress).toEqual({ completed: 0 });
    expect('total' in r.progress).toBe(false);
    // 降噪：无分支节点不下发 branches 字段
    expect(r.step.branches).toBeUndefined();
  });

  it('按 id 或展示名都能解析', () => {
    const { engine } = makeEngine([linearFlow()]);
    expect(isStep(engine.startRun({ flowName: 'f_linear' }))).toBe(true);
    expect(isStep(engine.startRun({ flowName: '直线图' }))).toBe(true);
  });

  it('流程不存在 → 三段式自愈（指向 list_flows）', () => {
    const { engine } = makeEngine([linearFlow()]);
    const r = engine.startRun({ flowName: '不存在的图' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('不存在的图');
    expect(r.guidance).toContain('list_flows');
    expect(r.current).toBeNull();
  });

  it('未知节点类型 → 校验层拒绝，三段式自愈（六种 DSL 类型阶段 6 起全支持）', () => {
    // 不经 store（存图校验会硬拒），直接喂给引擎：走 startRun 内的 validateFlow 分支
    const flow = {
      id: 'f_unknown_type',
      name: '未知类型图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'custom', instruction: 'x', next: 'n2' },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    } as unknown as Flow;
    const db = openMemoryDb();
    const engine = new ExecutionEngine({ db, resolveFlow: (n) => (n === '未知类型图' || n === 'f_unknown_type' ? flow : undefined) });
    const r = engine.startRun({ flowName: '未知类型图' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('校验不通过');
    expect(r.what).toContain('custom');
  });

  it('同一张图的 run 互不影响：各自持有快照', () => {
    const { engine } = makeEngine([linearFlow()]);
    const a = engine.startRun({ flowName: '直线图' });
    const b = engine.startRun({ flowName: '直线图' });
    if (!isStep(a) || !isStep(b)) throw new Error('start 失败');
    expect(a.runId).not.toBe(b.runId);
  });
});

// ---- complete_step 推进 ----

describe('complete_step', () => {
  it('直线推进：完成一步 → 到 end → run 终结', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '完成了第一步',
      payload: { foo: 1 },
    });
    expect(isFinished(r)).toBe(true);
    if (!isFinished(r)) return;
    expect(r.finished).toBe(true);
    expect(r.outcome).toBe('success');
    expect(r.progress).toEqual({ completed: 1 });
  });

  it('推进到中间节点：返回下一步且插值已渲染', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    const start = engine.startRun({ flowName: '插值图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '项目定了',
      payload: { project: 'apps/battle' },
    });
    expect(isStep(r)).toBe(true);
    if (!isStep(r)) return;
    expect(r.step.nodeId).toBe('n2');
    expect(r.step.kind).toBe('tool');
    expect(r.step.instruction).toBe('对 apps/battle 跑测试');
    expect(r.step.tool).toEqual({ name: 'Bash', params: { command: 'dotnet test apps/battle' } });
    expect(r.progress).toEqual({ completed: 1 });
  });

  it('插值引用的节点没跑过 → 保留原 token', () => {
    // n2 引用后继 n3 的 payload：n3 尚未执行，token 原样保留
    const flow: Flow = {
      id: 'f_interp_missing',
      name: '插值缺失图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
        {
          id: 'n2',
          type: 'tool',
          toolName: 'Bash',
          instruction: '看 {{n3.payload.report}}',
          next: 'n3',
        },
        { id: 'n3', type: 'prompt', instruction: '出报告', next: 'n4' },
        { id: 'n4', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '插值缺失图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '做完', payload: {} });
    if (!isStep(r)) throw new Error('推进失败');
    expect(r.step.nodeId).toBe('n2');
    expect(r.step.instruction).toContain('{{n3.payload.report}}');
  });

  it('插值引用的字段不存在 → 同样保留原 token', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    const start = engine.startRun({ flowName: '插值图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: 'payload 里没有 project 字段',
      payload: { other: 1 },
    });
    if (!isStep(r)) throw new Error('推进失败');
    expect(r.step.instruction).toContain('{{n1.payload.project}}');
  });

  it('分支：合法 branchId 推进，branches 下发时剥离 to', () => {
    const { engine } = makeEngine([branchFlow()]);
    const start = engine.startRun({ flowName: '分支图' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.branches).toEqual([
      { id: 'b1', condition: '全部通过' },
      { id: 'b_default', condition: '默认：其他分支都不满足时走这条' },
    ]);
    const ok = engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '全过',
      branchId: 'b1',
    });
    expect(isFinished(ok)).toBe(true);
    if (isFinished(ok)) expect(ok.outcome).toBe('success');
  });

  it('非法 branchId → 自愈列出合法分支，且不落执行记录（不推进）', () => {
    const { engine, store } = makeEngine([branchFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    void store;
    const start = engine.startRun({ flowName: '分支图' });
    if (!isStep(start)) throw new Error('start 失败');
    const bad = engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '全过',
      branchId: 'b_typo',
    });
    expect(isErr(bad)).toBe(true);
    if (!isErr(bad)) return;
    expect(bad.what).toContain('b_typo');
    expect(bad.what).toContain('b1');
    expect(bad.guidance).toContain('complete_step');
    // 三段式的第三段：当前这一步
    expect(bad.current?.step.nodeId).toBe('n1');
    // 事务性：失败不落库
    const count = (
      db.prepare('SELECT COUNT(*) AS c FROM node_executions').get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  it('节点不匹配 → 自愈并附当前步', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    const start = engine.startRun({ flowName: '插值图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, nodeId: 'n2', summary: '串了' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('n2');
    expect(r.what).toContain('n1');
    expect(r.current?.step.nodeId).toBe('n1');
  });

  it('缺 summary → 自愈', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '  ' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('summary');
  });

  it('省略 nodeId 按当前节点处理（少一轮往返）', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, summary: '做完' });
    expect(isFinished(r)).toBe(true);
  });

  it('run 结束后再 complete_step → 返回已终结信息而非报错', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '做完' });
    const r = engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '再来一次' });
    expect(isFinished(r)).toBe(true);
    if (!isFinished(r)) return;
    expect(r.note).toContain('已经结束');
  });
});

// ---- get_current_step ----

describe('get_current_step', () => {
  it('幂等：重复调用返回同一步，不产生副作用', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    const start = engine.startRun({ flowName: '插值图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '项目定了',
      payload: { project: 'apps/battle' },
    });
    const a = engine.getCurrentStep({ runId: start.runId });
    const b = engine.getCurrentStep({ runId: start.runId });
    expect(isStep(a)).toBe(true);
    expect(a).toEqual(b);
    if (!isStep(a)) return;
    expect(a.step.nodeId).toBe('n2');
    expect(a.progress).toEqual({ completed: 1 });
  });

  it('上下文压缩后的恢复入口：不带 runId 时按 DSH 会话绑定解析', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', hostSession: 'dsh:session-1' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.getCurrentStep({ hostSession: 'dsh:session-1' });
    expect(isStep(r)).toBe(true);
    if (!isStep(r)) return;
    expect(r.runId).toBe(start.runId);
    expect(r.step.nodeId).toBe('n1');
  });

  it('找不到 run → 三段式自愈', () => {
    const { engine } = makeEngine([linearFlow()]);
    const r = engine.getCurrentStep({ runId: 'run_nope' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.guidance).toContain('start_run');
    expect(r.current).toBeNull();
  });

  it('已完成的 run → 返回终结态与 outcome', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '做完' });
    const r = engine.getCurrentStep({ runId: start.runId });
    expect(isFinished(r)).toBe(true);
    if (!isFinished(r)) return;
    expect(r.outcome).toBe('success');
  });
});

// ---- 数据落库 ----

describe('执行轨迹落库', () => {
  it('node_executions 记录 summary / payload / branch_id / iteration', () => {
    const { engine } = makeEngine([branchFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '分支图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({
      runId: start.runId,
      nodeId: 'n1',
      summary: '全过',
      payload: { cases: 42 },
      branchId: 'b1',
    });
    const rows = db
      .prepare('SELECT node_id, iteration, status, summary, payload, branch_id FROM node_executions')
      .all() as Array<{
      node_id: string;
      iteration: number;
      status: string;
      summary: string;
      payload: string;
      branch_id: string;
    }>;
    expect(rows).toEqual([
      {
        node_id: 'n1',
        iteration: 1,
        status: 'completed',
        summary: '全过',
        payload: JSON.stringify({ cases: 42 }),
        branch_id: 'b1',
      },
    ]);
  });

  it('run 行含快照 hash 与 cwd / projectName', () => {
    const { engine } = makeEngine([linearFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({
      flowName: '直线图',
      cwd: 'D:/work/demo',
      projectName: 'demo',
    });
    if (!isStep(start)) throw new Error('start 失败');
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(start.runId) as {
      flow_snapshot_hash: string;
      cwd: string;
      project_name: string;
      status: string;
    };
    expect(run.flow_snapshot_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(run.cwd).toBe('D:/work/demo');
    expect(run.project_name).toBe('demo');
    expect(run.status).toBe('running');
  });
});

describe('DSH 会话定位（hostSession）', () => {
  it('start_run 持久化 host_session', () => {
    const { engine } = makeEngine([linearFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '直线图', hostSession: 'dsh:session-1' });
    if (!isStep(start)) throw new Error('start 失败');
    const run = db.prepare('SELECT host_session FROM runs WHERE id = ?').get(start.runId) as {
      host_session: string | null;
    };
    expect(run.host_session).toBe('dsh:session-1');
  });

  it('不带 runId/childToken 时按 hostSession 定位当前步', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', hostSession: 'dsh:session-2' });
    const cur = engine.getCurrentStep({ hostSession: 'dsh:session-2' });
    if (!isStep(cur)) throw new Error('应按 hostSession 定位成功');
    expect(cur.runId).toBe(start.runId);
    expect(cur.step.nodeId).toBe('n1');
  });

  it('run 终结后按 hostSession 回落最近 run，返回终结态而非找不到', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', hostSession: 'dsh:session-3' });
    engine.completeStep({ runId: start.runId, summary: '完成' });
    const cur = engine.getCurrentStep({ hostSession: 'dsh:session-3' });
    if (!isFinished(cur)) throw new Error('应返回终结态');
    expect(cur.runId).toBe(start.runId);
  });

  it('complete_step 同样按 hostSession 定位并推进', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    engine.startRun({ flowName: '插值图', hostSession: 'dsh:session-4' });
    const next = engine.completeStep({
      hostSession: 'dsh:session-4',
      summary: '项目是 demo',
      payload: { project: 'apps/demo' },
    });
    if (!isStep(next)) throw new Error('应推进成功');
    expect(next.step.nodeId).toBe('n2');
    expect(next.step.instruction).toContain('apps/demo');
  });
});

// ---- 阶段 3：分支边界 / 环与迭代上限 / report_blocked ----

describe('分支求值边界（§7.3）', () => {
  it('选 default 分支（condition:"*"）按其 to 推进', () => {
    const { engine } = makeEngine([branchFlow()]); // b_default → n3（end/fail）
    const start = engine.startRun({ flowName: '分支图' });
    if (!isStep(start)) throw new Error('start 失败');
    const res = engine.completeStep({ runId: start.runId, summary: '一个条件都不满足', branchId: 'b_default' });
    if (!isFinished(res)) throw new Error('default 指向 end，应终结');
    expect(res.outcome).toBe('fail');
  });
});

describe('环与迭代上限（§4.5）', () => {
  it('回退环正常推进：测试失败 → 回到改代码 → 重跑 → 通过（验收场景）', () => {
    const { engine } = makeEngine([retryFlow(true)]);
    const start = engine.startRun({ flowName: '测试回退环' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.nodeId).toBe('n_fix');
    // 首轮：未跑过测试，插值 token 原样保留
    expect(start.step.instruction).toContain('{{n_test.payload.round}}');

    engine.completeStep({ runId: start.runId, nodeId: 'n_fix', summary: '改了空指针' });
    const fail1 = engine.completeStep({
      runId: start.runId,
      nodeId: 'n_test',
      summary: '2 个用例失败',
      payload: { round: 2 },
      branchId: 'b_fail',
    });
    if (!isStep(fail1)) throw new Error('回退应回到 n_fix');
    expect(fail1.step.nodeId).toBe('n_fix');
    // 第二轮进改代码：插值用最近一次 completed 的 payload
    expect(fail1.step.instruction).toContain('第 2 轮');

    engine.completeStep({ runId: start.runId, summary: '修好了' });
    const done = engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '全过', branchId: 'b_pass' });
    if (!isFinished(done)) throw new Error('应终结');
    expect(done.outcome).toBe('success');
    expect(done.progress).toEqual({ completed: 4 });
  });

  it('撞 iterationLimit 不执行该节点：落 limit_exceeded 轨迹并走 onLimitExceeded 逃生', () => {
    const { engine } = makeEngine([retryFlow(true)]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '测试回退环' });
    if (!isStep(start)) throw new Error('start 失败');
    // 两轮失败（iterationLimit 2 已用完）
    engine.completeStep({ runId: start.runId, summary: '改一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, summary: '改二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '又失败', branchId: 'b_fail' });
    // 第三次推进目标 n_test 撞上限：不执行，直接逃生到 n_fail（end/fail）
    const third = engine.completeStep({ runId: start.runId, summary: '改三' });
    if (!isFinished(third)) throw new Error('应经逃生口终结');
    expect(third.outcome).toBe('fail');
    expect(third.note).toContain('迭代上限');

    const rows = db
      .prepare("SELECT node_id, iteration, status, summary FROM node_executions WHERE node_id = 'n_test' ORDER BY id")
      .all() as Array<{ node_id: string; iteration: number; status: string; summary: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.status === 'completed')).toHaveLength(2);
    expect(rows[2]).toMatchObject({ status: 'limit_exceeded' });
    expect(rows[2]!.summary).toContain('未执行');
    // n_test 的第三次进位被逃生替代，run 在 n_fail 终结（completed）
    const run = db.prepare('SELECT status, current_node FROM runs WHERE id = ?').get(start.runId) as {
      status: string;
      current_node: string;
    };
    expect(run).toEqual({ status: 'completed', current_node: 'n_fail' });
  });

  it('撞上限且无 onLimitExceeded → run 判失败', () => {
    const { engine } = makeEngine([retryFlow(false)]);
    const start = engine.startRun({ flowName: '无逃生回退环' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '改一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, summary: '改二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '又失败', branchId: 'b_fail' });
    const third = engine.completeStep({ runId: start.runId, summary: '改三' });
    if (!isFinished(third)) throw new Error('应判失败终结');
    expect(third.outcome).toBe('fail');
    expect(third.note).toContain('迭代上限');
  });

  it('撞 loopId + maxRounds：按控制器轮次计数，不执行目标节点并走控制器逃生出口', () => {
    const { engine } = makeEngine([loopLimitFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '回路上限图' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.nodeId).toBe('n_fix');

    // 第 1 轮：改代码 → 测试失败；第 2 轮同理
    engine.completeStep({ runId: start.runId, summary: '改一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败一', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, summary: '改二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败二', branchId: 'b_fail' });
    // 控制器已执行 2 次（maxRounds=2），再推进到 n_test 时直接逃生到 n_fail
    const thirdFix = engine.completeStep({ runId: start.runId, summary: '改三' });

    if (!isFinished(thirdFix)) throw new Error(`应在回路上限处终结：${JSON.stringify(thirdFix)}`);
    expect(thirdFix.outcome).toBe('fail');
    expect(thirdFix.note).toContain('maxRounds');

    const rows = db
      .prepare("SELECT node_id, iteration, status, summary FROM node_executions WHERE node_id = 'n_test' ORDER BY id")
      .all() as Array<{ node_id: string; iteration: number; status: string; summary: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.status === 'completed')).toHaveLength(2);
    expect(rows[2]).toMatchObject({ status: 'limit_exceeded' });
    expect(rows[2]!.summary).toContain('test-loop');
    expect(rows[2]!.summary).toContain('maxRounds');
  });

  it('非控制器节点也共享回路计数，并用控制器 onLimitExceeded 逃生', () => {
    const { engine } = makeEngine([loopLimitSharedFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '回路共享上限图' });
    if (!isStep(start)) throw new Error('start 失败');

    engine.completeStep({ runId: start.runId, summary: '改一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_fix2', summary: '补一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败一', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_fix', summary: '改二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_fix2', summary: '补二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败二', branchId: 'b_fail' });
    // 推进目标 n_fix2 不是控制器，但共享 loopId 的 n_test 已执行 2 次 → 逃生
    const hit = engine.completeStep({ runId: start.runId, nodeId: 'n_fix', summary: '改三' });
    if (!isFinished(hit)) throw new Error(`应在共享回路上限处终结：${JSON.stringify(hit)}`);
    expect(hit.outcome).toBe('fail');
    expect(hit.note).toContain('maxRounds');

    const rows = db
      .prepare("SELECT node_id, status, summary FROM node_executions WHERE node_id = 'n_fix2' ORDER BY id")
      .all() as Array<{ node_id: string; status: string; summary: string }>;
    expect(rows.filter((row) => row.status === 'completed')).toHaveLength(2);
    expect(rows.at(-1)?.status).toBe('limit_exceeded');
    expect(rows.at(-1)?.summary).toContain('test-loop');
  });

  it('超出 maxSteps → 第 maxSteps+1 步不再执行，run 判失败', () => {
    const { engine } = makeEngine([maxStepsFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '小上限图' });
    if (!isStep(start)) throw new Error('start 失败');
    const step2 = engine.completeStep({ runId: start.runId, summary: '做完一' });
    if (!isStep(step2)) throw new Error('第一步应正常推进');
    expect(step2.step.nodeId).toBe('n2');
    const over = engine.completeStep({ runId: start.runId, summary: '做完二' });
    if (!isFinished(over)) throw new Error('应判失败终结');
    expect(over.outcome).toBe('fail');
    expect(over.note).toContain('全局步数上限');
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('failed');
    // 超限那步没有落轨迹
    const count = (
      db.prepare('SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ?').get(start.runId) as { c: number }
    ).c;
    expect(count).toBe(1);
  });
});

describe('report_blocked（§7.8）', () => {
  it('节点无任何出口 → 落 blocked 轨迹并判 run 失败', () => {
    const { engine } = makeEngine([blockedNoExitFlow()]);
    const db = (engine as unknown as { db: TestDb }).db;
    const start = engine.startRun({ flowName: '无出口阻塞图' });
    if (!isStep(start)) throw new Error('start 失败');
    const res = engine.reportBlocked({ runId: start.runId, reason: '缺少构建依赖 X' });
    if (!isFinished(res)) throw new Error('应判失败终结');
    expect(res.outcome).toBe('fail');
    expect(res.note).toContain('缺少构建依赖 X');
    expect(res.note).toContain('没有可用出口');
    const row = db
      .prepare("SELECT node_id, iteration, status, summary FROM node_executions WHERE run_id = ?")
      .get(start.runId) as { node_id: string; iteration: number; status: string; summary: string };
    expect(row).toEqual({ node_id: 'n1', iteration: 1, status: 'blocked', summary: '缺少构建依赖 X' });
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('failed');
  });

  it('有 onLimitExceeded → 走逃生节点，返回其步骤', () => {
    const { engine } = makeEngine([blockedFlow()]);
    const start = engine.startRun({ flowName: '阻塞图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, nodeId: 'n1', summary: '干了一轮', payload: { x: '真实产物' }, branchId: 'b1' });
    const res = engine.reportBlocked({ runId: start.runId, reason: '依赖没了' });
    if (!isStep(res)) throw new Error('应推进到逃生节点');
    expect(res.step.nodeId).toBe('n_esc');
    // blocked 轨迹不带产物，不得遮蔽此前 completed 的插值来源
    expect(res.step.instruction).toContain('真实产物');
  });

  it('无 onLimitExceeded 但有 default 分支 → 走 default', () => {
    const { engine } = makeEngine([branchFlow()]); // b_default → n3（end/fail）
    const start = engine.startRun({ flowName: '分支图' });
    if (!isStep(start)) throw new Error('start 失败');
    const res = engine.reportBlocked({ runId: start.runId, reason: '判断不了' });
    if (!isFinished(res)) throw new Error('default 指向 end，应终结');
    expect(res.outcome).toBe('fail');
  });

  it('reason 必填，缺失自愈', () => {
    const { engine } = makeEngine([blockedFlow()]);
    const start = engine.startRun({ flowName: '阻塞图' });
    if (!isStep(start)) throw new Error('start 失败');
    const res = engine.reportBlocked({ runId: start.runId, reason: '  ' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.what).toContain('reason');
  });

  it('结束后再调 report_blocked 返回终结态', () => {
    const { engine } = makeEngine([blockedFlow()]);
    const start = engine.startRun({ flowName: '阻塞图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.reportBlocked({ runId: start.runId, reason: '干不下去' }); // → n_esc
    engine.completeStep({ runId: start.runId, summary: '善后完成' }); // → n_end 终结
    const res = engine.reportBlocked({ runId: start.runId, reason: '还想报' });
    expect(isFinished(res)).toBe(true);
    if (isFinished(res)) expect(res.note).toContain('已经结束');
  });
});

describe('引擎事件（§9.3 SSE 数据源）', () => {
  it('直线完成：run_started → step_completed → run_finished(success)，顺序正确', () => {
    const events: EngineEvent[] = [];
    const { engine } = makeEngine([linearFlow()], (e) => events.push(e));
    const start = engine.startRun({ flowName: '直线图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '完成' });
    expect(events.map((e) => e.type)).toEqual(['run_started', 'step_completed', 'run_finished']);
    expect(events[0]).toMatchObject({ type: 'run_started', runId: start.runId, flowId: 'f_linear' });
    expect(events[1]).toMatchObject({ type: 'step_completed', nodeId: 'n1', status: 'completed' });
    expect(events[2]).toMatchObject({ type: 'run_finished', outcome: 'success' });
  });

  it('撞上限逃生：limit_exceeded 事件先于 run_finished(fail)', () => {
    const events: EngineEvent[] = [];
    const { engine } = makeEngine([retryFlow(true)], (e) => events.push(e));
    const start = engine.startRun({ flowName: '测试回退环' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '改一' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '失败', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, summary: '改二' });
    engine.completeStep({ runId: start.runId, nodeId: 'n_test', summary: '又失败', branchId: 'b_fail' });
    engine.completeStep({ runId: start.runId, summary: '改三' });
    const types = events.map((e) => (e.type === 'step_completed' ? `step:${e.status}` : e.type));
    expect(types).toContain('step:limit_exceeded');
    const limitIdx = types.indexOf('step:limit_exceeded');
    const finishIdx = types.lastIndexOf('run_finished');
    expect(finishIdx).toBeGreaterThan(limitIdx);
    const finished = events[finishIdx] as Extract<EngineEvent, { type: 'run_finished' }>;
    expect(finished.outcome).toBe('fail');
  });

  it('report_blocked 发 step_completed(blocked)；无出口紧接着 run_finished(fail)', () => {
    const events: EngineEvent[] = [];
    const { engine } = makeEngine([blockedNoExitFlow()], (e) => events.push(e));
    const start = engine.startRun({ flowName: '无出口阻塞图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.reportBlocked({ runId: start.runId, reason: '缺依赖' });
    expect(events.map((e) => e.type)).toEqual(['run_started', 'step_completed', 'run_finished']);
    expect(events[1]).toMatchObject({ status: 'blocked' });
    expect(events[2]).toMatchObject({ outcome: 'fail' });
  });
});


// ---- gate 卡点（§7.6，阶段 5）----

describe('gate 卡点（§7.6）', () => {
  /** 跑到卡点：返回 { runId, gateId } */
  function toGate(engine: ExecutionEngine): { runId: string; gateId: string } {
    const start = engine.startRun({ flowName: '卡点图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, summary: '准备好了' });
    if (!isStep(r) || r.step.gateId === undefined) throw new Error(`应推进到 gate：${JSON.stringify(r)}`);
    return { runId: start.runId, gateId: r.step.gateId };
  }

  it('推进进 gate：run 挂起 waiting_gate，step 带 gateId/question/options 与等待提示', () => {
    const { engine, db } = makeEngine([gateFlow()]);
    const { runId, gateId } = toGate(engine);
    // 下发形态（§6.2）：gate 专有字段；选项即出口，不下发 branches（降噪）
    const r = engine.getCurrentStep({ runId });
    if (!isStep(r)) throw new Error('get 应返回 gate 步');
    expect(r.step.kind).toBe('gate');
    expect(r.step.nodeId).toBe('n_gate');
    expect(r.step.gateId).toBe(gateId);
    expect(r.step.question).toBe('可以发布吗？');
    expect(r.step.options).toEqual([
      { id: 'opt_go', label: '可以发布' },
      { id: 'opt_stop', label: '先不发布' },
    ]);
    expect(r.step.branches).toBeUndefined();
    expect(r.note).toContain('await_gate');
    // 库：run 状态 + pending 决策行
    const run = db.prepare('SELECT status, current_node FROM runs WHERE id = ?').get(runId) as {
      status: string;
      current_node: string;
    };
    expect(run).toMatchObject({ status: 'waiting_gate', current_node: 'n_gate' });
    const pending = db
      .prepare('SELECT node_id, question, option_id, decided_at FROM gate_decisions WHERE run_id = ? AND decided_at IS NULL')
      .get(runId) as { node_id: string; question: string; option_id: string | null; decided_at: string | null };
    expect(pending).toMatchObject({ node_id: 'n_gate', question: '可以发布吗？', option_id: null, decided_at: null });
  });

  it('面板通道放行（source: panel）：按选项 outlet 分支推进，决策与轨迹都记录来源', () => {
    const { engine, db } = makeEngine([gateFlow()]);
    const { runId } = toGate(engine);
    const r = engine.answerGate({ runId, optionId: 'opt_go', note: '用户在面板点的' }, 'panel');
    if (!isFinished(r)) throw new Error(`应终结：${JSON.stringify(r)}`);
    expect(r.outcome).toBe('success');
    const decision = db
      .prepare('SELECT option_id, note, source, decided_at FROM gate_decisions WHERE run_id = ?')
      .get(runId) as { option_id: string; note: string; source: string; decided_at: string | null };
    expect(decision).toMatchObject({ option_id: 'opt_go', note: '用户在面板点的', source: 'panel' });
    expect(decision.decided_at).not.toBeNull();
    // 卡点决策也落一条 completed 轨迹（供插值与回看）
    const exec = db
      .prepare("SELECT status, summary, payload, branch_id FROM node_executions WHERE run_id = ? AND node_id = 'n_gate'")
      .get(runId) as { status: string; summary: string; payload: string; branch_id: string };
    expect(exec.status).toBe('completed');
    expect(exec.summary).toContain('可以发布');
    expect(exec.summary).toContain('面板');
    expect(JSON.parse(exec.payload)).toMatchObject({ optionId: 'opt_go', source: 'panel' });
    expect(exec.branch_id).toBe('b_go');
  });

  it('聊天通道代填（source: chat）：沿另一选项推进到 fail 终点', () => {
    const { engine, db } = makeEngine([gateFlow()]);
    const { runId } = toGate(engine);
    const r = engine.answerGate({ runId, optionId: 'opt_stop' }, 'chat');
    if (!isFinished(r)) throw new Error('应终结');
    expect(r.outcome).toBe('fail');
    const decision = db.prepare('SELECT option_id, source FROM gate_decisions WHERE run_id = ?').get(runId) as {
      option_id: string;
      source: string;
    };
    expect(decision).toMatchObject({ option_id: 'opt_stop', source: 'chat' });
  });

  it('挂起时 complete_step / report_blocked → 自愈指向 await_gate / answer_gate，不推进', () => {
    const { engine } = makeEngine([gateFlow()]);
    const { runId } = toGate(engine);
    const c = engine.completeStep({ runId, summary: '想硬推' });
    expect(isErr(c)).toBe(true);
    if (isErr(c)) {
      expect(c.guidance).toContain('await_gate');
      expect(c.guidance).toContain('answer_gate');
    }
    const b = engine.reportBlocked({ runId, reason: '等不及了' });
    expect(isErr(b)).toBe(true);
    // run 仍在卡点上
    const cur = engine.getCurrentStep({ runId });
    expect(isStep(cur) && cur.step.kind === 'gate').toBe(true);
  });

  it('optionId 非法 → 自愈列出合法选项，不落库不推进', () => {
    const { engine, db } = makeEngine([gateFlow()]);
    const { runId } = toGate(engine);
    const r = engine.answerGate({ runId, optionId: 'opt_没这个' }, 'panel');
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('opt_go');
    expect(r.what).toContain('opt_stop');
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(runId) as { status: string };
    expect(run.status).toBe('waiting_gate');
    const decided = db
      .prepare('SELECT COUNT(*) AS c FROM gate_decisions WHERE run_id = ? AND decided_at IS NOT NULL')
      .get(runId) as { c: number };
    expect(decided.c).toBe(0);
  });

  it('gateId 已被答复再作答 → 自愈（附当前状态，不重复推进）', () => {
    const { engine } = makeEngine([gateFlow()]);
    const { runId, gateId } = toGate(engine);
    const first = engine.answerGate({ runId, gateId, optionId: 'opt_go' }, 'panel');
    expect(isFinished(first)).toBe(true);
    const again = engine.answerGate({ runId, gateId, optionId: 'opt_stop' }, 'chat');
    expect(isErr(again)).toBe(true);
    if (!isErr(again)) return;
    expect(again.what).toContain('已经被答复');
  });

  it('await_gate：等待中被面板放行 → 醒来返回放行后的终结态', async () => {
    const { engine } = makeEngine([gateFlow()]);
    const { runId, gateId } = toGate(engine);
    const waiting = engine.awaitGate({ runId, gateId }, 5_000);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const panel = engine.answerGate({ runId, optionId: 'opt_go' }, 'panel');
    expect(isFinished(panel)).toBe(true);
    const r = await waiting;
    if (!isFinished(r)) throw new Error(`应返回终结态：${JSON.stringify(r)}`);
    expect(r.outcome).toBe('success');
  });

  it('await_gate 超时 → 返回 gate 步 + "仍在等待"提示，run 仍挂起', async () => {
    const { engine, db } = makeEngine([gateFlow()]);
    const { runId, gateId } = toGate(engine);
    const r = await engine.awaitGate({ runId, gateId }, 120);
    if (!isStep(r)) throw new Error('超时应返回 gate 步');
    expect(r.step.gateId).toBe(gateId);
    expect(r.note).toContain('仍在等待');
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(runId) as { status: string };
    expect(run.status).toBe('waiting_gate');
  });

  it('await_gate：放行后再调 → 直接返回当前状态（幂等，不再等 60 秒）', async () => {
    const { engine } = makeEngine([gateFlow()]);
    const { runId, gateId } = toGate(engine);
    engine.answerGate({ runId, optionId: 'opt_go' }, 'panel');
    const r = await engine.awaitGate({ runId, gateId }, 60_000);
    if (!isFinished(r)) throw new Error('应返回终结态');
    expect(r.outcome).toBe('success');
  });

  it('入口即 gate：start_run 直接挂起（waiting_gate + pending）', () => {
    const { engine, db } = makeEngine([entryGateFlow()]);
    const r = engine.startRun({ flowName: '入口卡点图' });
    if (!isStep(r)) throw new Error('start 失败');
    expect(r.step.kind).toBe('gate');
    expect(r.step.gateId).toMatch(/^\d+$/);
    expect(r.note).toContain('await_gate');
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(r.runId) as { status: string };
    expect(run.status).toBe('waiting_gate');
    // 无 branches 的卡点：选项即唯一出口，放行走 next
    const done = engine.answerGate({ runId: r.runId, optionId: 'opt_yes' }, 'chat');
    if (!isFinished(done)) throw new Error('应终结');
    expect(done.outcome).toBe('success');
  });

  it('选项没连线：决策记录在案，run 判失败（note 说明）', () => {
    const { engine, db } = makeEngine([unwiredGateFlow()]);
    const start = engine.startRun({ flowName: '未连线卡点图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.answerGate({ runId: start.runId, optionId: 'opt_b' }, 'panel');
    if (!isFinished(r)) throw new Error('应判失败');
    expect(r.outcome).toBe('fail');
    expect(r.note).toContain('没有连线');
    // 人的决策仍然记录在案（含来源）
    const decision = db
      .prepare('SELECT option_id, source, decided_at FROM gate_decisions WHERE run_id = ?')
      .get(start.runId) as { option_id: string; source: string; decided_at: string | null };
    expect(decision).toMatchObject({ option_id: 'opt_b', source: 'panel' });
    expect(decision.decided_at).not.toBeNull();
  });

  it('裸卡点（无分支无 next）：记录决策即隐式收尾 success', () => {
    const bare: Flow = {
      id: 'f_bare_gate',
      name: '裸卡点图',
      entry: 'n_gate',
      nodes: [{ id: 'n_gate', type: 'gate', question: '到头了吗？', options: [{ id: 'opt_yes', label: '到了' }] }],
    };
    const { engine } = makeEngine([bare]);
    const start = engine.startRun({ flowName: '裸卡点图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.answerGate({ runId: start.runId, optionId: 'opt_yes' }, 'chat');
    if (!isFinished(r)) throw new Error('应隐式收尾');
    expect(r.outcome).toBe('success');
  });

  it('卡点放行后继续执行中间节点直到终点（回归：放行要把 status 从 waiting_gate 拨回 running）', () => {
    const flow: Flow = {
      id: 'f_gate_mid',
      name: '卡点后中间节点图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '准备', next: 'n_gate' },
        {
          id: 'n_gate',
          type: 'gate',
          question: '继续吗？',
          options: [{ id: 'opt_yes', label: '继续' }],
          next: 'n_mid',
        },
        { id: 'n_mid', type: 'prompt', instruction: '收尾工作', next: 'n_ok' },
        { id: 'n_ok', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '卡点后中间节点图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '准备好了' });
    const released = engine.answerGate({ runId: start.runId, optionId: 'opt_yes' }, 'panel');
    if (!isStep(released)) throw new Error(`放行应到中间节点：${JSON.stringify(released)}`);
    expect(released.step.nodeId).toBe('n_mid');
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('running'); // 关键：不再是 waiting_gate
    const done = engine.completeStep({ runId: start.runId, nodeId: 'n_mid', summary: '收尾完成' });
    if (!isFinished(done)) throw new Error(`应推进到终点：${JSON.stringify(done)}`);
    expect(done.outcome).toBe('success');
  });

  it('事件：进 gate 发 gate_pending（带 gateId 与问题），放行发 step_completed + run_finished', () => {
    const events: EngineEvent[] = [];
    const { engine } = makeEngine([gateFlow()], (e) => events.push(e));
    const start = engine.startRun({ flowName: '卡点图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '准备好了' });
    engine.answerGate({ runId: start.runId, optionId: 'opt_go' }, 'panel');
    expect(events.map((e) => e.type)).toEqual([
      'run_started',
      'step_completed',
      'gate_pending',
      'step_completed',
      'run_finished',
    ]);
    const gate = events[2] as Extract<EngineEvent, { type: 'gate_pending' }>;
    expect(gate.nodeId).toBe('n_gate');
    expect(gate.question).toBe('可以发布吗？');
    expect(gate.gateId).toMatch(/^\d+$/);
  });
});

// ---- subagent 派发与 join 汇聚（§7.1 / §7.5，阶段 6）----

function subagentFlow(mode: 'inline' | 'subflow' | 'flowRef'): Flow {
  return {
    id: 'f_sub',
    name: '派发图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '定题目', next: 'n_sub' },
      {
        id: 'n_sub',
        type: 'subagent',
        title: '查资料',
        extraPrompt: '去查 {{n1.payload.topic}} 的资料并总结成三行',
        mode,
        next: 'n_join',
        ...(mode === 'subflow'
          ? {
              subflow: {
                entry: 's1',
                nodes: [
                  { id: 's1', type: 'prompt', instruction: '查资料第一步', next: 's2' },
                  { id: 's2', type: 'prompt', instruction: '整理成摘要' },
                ],
              },
            }
          : {}),
        ...(mode === 'flowRef' ? { flowRef: 'f_child' } : {}),
      },
      { id: 'n_join', type: 'join', aggregateInstruction: '把各子任务结果合并成一份报告', next: 'n_end' },
      { id: 'n_end', type: 'end', outcome: 'success' },
    ],
  };
}

function refChildFlow(): Flow {
  return {
    id: 'f_child',
    name: '被引用子图',
    entry: 'c1',
    nodes: [
      { id: 'c1', type: 'prompt', instruction: '子任务第一棒', next: 'c2' },
      { id: 'c2', type: 'prompt', instruction: '子任务收尾' },
    ],
  };
}

describe('subagent 派发与 join 汇聚（§7.1/§7.5）', () => {
  /** 跑到派发步：返回 { runId, token }（token = 派发步下发的第一个 child） */
  function toDispatch(engine: ExecutionEngine): { runId: string; token: string } {
    const start = engine.startRun({ flowName: '派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    const done = engine.completeStep({ runId: start.runId, summary: '题目定了', payload: { topic: '配表系统' } });
    if (!isStep(done) || done.step.children === undefined) throw new Error(`应推进到派发步：${JSON.stringify(done)}`);
    return { runId: start.runId, token: done.step.children[0]!.childToken };
  }

  function makeSubEngine(mode: 'inline' | 'subflow' | 'flowRef') {
    const flows = mode === 'flowRef' ? [subagentFlow(mode), refChildFlow()] : [subagentFlow(mode)];
    return makeEngine(flows);
  }

  it('推进到派发步：主 run 挂 waiting_children，children 带 token/preamble/插值后的 extraPrompt，child run 落库', () => {
    const events: EngineEvent[] = [];
    const { engine, db } = makeEngine([subagentFlow('inline')], (e) => events.push(e));
    const start = engine.startRun({ flowName: '派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, summary: '题目定了', payload: { topic: '配表系统' } });
    if (!isStep(r)) throw new Error(`应到派发步：${JSON.stringify(r)}`);
    expect(r.step.kind).toBe('subagent');
    expect(r.note).toContain('preamble');
    const child = r.step.children![0]!;
    expect(child.childToken).toMatch(/^c_/);
    expect(child.preamble).toContain(`你是流程 ${start.runId} 节点 n_sub 派出的子任务`);
    expect(child.preamble).toContain(`get_current_step({childToken:"${child.childToken}"})`);
    expect(child.extraPrompt).toBe('去查 配表系统 的资料并总结成三行'); // 主 run 插值已渲染
    // 库：主 run 状态 + child run 行（run 树 / 白名单 token）
    const main = db.prepare('SELECT status, current_node FROM runs WHERE id = ?').get(start.runId) as { status: string; current_node: string };
    expect(main).toMatchObject({ status: 'waiting_children', current_node: 'n_sub' });
    const childRow = db
      .prepare('SELECT parent_run_id, root_run_id, parent_node, child_token, status, flow_id FROM runs WHERE child_token = ?')
      .get(child.childToken) as { parent_run_id: string; root_run_id: string; parent_node: string; child_token: string; status: string; flow_id: string };
    expect(childRow).toMatchObject({
      parent_run_id: start.runId,
      root_run_id: start.runId,
      parent_node: 'n_sub',
      status: 'running',
    });
    expect(childRow.flow_id).toBe('f_sub::n_sub');
    expect(events.map((e) => e.type)).toContain('child_spawned');
    const spawned = events.find((e) => e.type === 'child_spawned') as Extract<EngineEvent, { type: 'child_spawned' }>;
    expect(spawned.nodeId).toBe('n_sub');
  });

  it('inline：子 Agent 靠 childToken 领步并完成（单节点隐式 end），主 run 挂起不动', () => {
    const { engine, db } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    // 子 Agent 盲调（只有 childToken）
    const first = engine.getCurrentStep({ childToken: token });
    if (!isStep(first)) throw new Error('child 应领到任务步');
    expect(first.runId).not.toBe(runId);
    expect(first.step.instruction).toBe('去查 配表系统 的资料并总结成三行');
    const done = engine.completeStep({ childToken: token, summary: '查完了：三行摘要', payload: { lines: 3 } });
    if (!isFinished(done)) throw new Error('child 应隐式收尾');
    expect(done.outcome).toBe('success');
    // 主 run 仍在派发步等汇聚
    const main = db.prepare('SELECT status FROM runs WHERE id = ?').get(runId) as { status: string };
    expect(main.status).toBe('waiting_children');
  });

  it('subflow：子 Agent 走内嵌子图两步完成', () => {
    const { engine } = makeSubEngine('subflow');
    const { token } = toDispatch(engine);
    const s1 = engine.completeStep({ childToken: token, summary: '第一步完成' });
    if (!isStep(s1)) throw new Error('应到子图第二步');
    expect(s1.step.nodeId).toBe('s2');
    const done = engine.completeStep({ childToken: token, summary: '摘要整理完毕' });
    if (!isFinished(done)) throw new Error('子图走完应终结');
    expect(done.outcome).toBe('success');
  });

  it('flowRef：子 Agent 走引用图（主 run 快照里的版本）', () => {
    const { engine, store } = makeSubEngine('flowRef');
    const { runId, token } = toDispatch(engine);
    // 汇聚前改原图：child 仍跑快照版本（copy-on-run 一致性）
    const mutated = refChildFlow();
    mutated.nodes = [
      { id: 'c1', type: 'prompt', instruction: '被改过的第一棒', next: 'c2' },
      { id: 'c2', type: 'prompt', instruction: '子任务收尾' },
    ];
    expect(store.save(mutated).ok).toBe(true);
    const first = engine.getCurrentStep({ childToken: token });
    if (!isStep(first)) throw new Error('child 应领到步');
    expect(first.step.instruction).toBe('子任务第一棒');
    expect(first.runId).not.toBe(runId);
    engine.completeStep({ childToken: token, summary: '第一棒完成' });
    const done = engine.completeStep({ childToken: token, summary: '收尾完成' });
    if (!isFinished(done)) throw new Error('应终结');
    expect(done.outcome).toBe('success');
  });

  it('汇聚（全部完成）：get_current_step 返回 join 步，childResults 带结果，join 完成后到 end', () => {
    const { engine, db } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    engine.completeStep({ childToken: token, summary: '查完了：三行摘要', payload: { lines: 3 } });
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error(`应汇聚到 join：${JSON.stringify(join)}`);
    expect(join.step.kind).toBe('join');
    expect(join.step.nodeId).toBe('n_join');
    expect(join.step.aggregateInstruction).toBe('把各子任务结果合并成一份报告');
    expect(join.step.childResults).toHaveLength(1);
    expect(join.step.childResults![0]).toMatchObject({ childToken: token, status: 'completed', summary: '查完了：三行摘要' });
    expect(join.step.instruction).toContain('✓ 查完了：三行摘要');
    // 派发步落一条汇总轨迹
    const sRow = db
      .prepare("SELECT summary, payload FROM node_executions WHERE run_id = ? AND node_id = 'n_sub'")
      .get(runId) as { summary: string; payload: string };
    expect(sRow.summary).toContain('全部回报');
    const done = engine.completeStep({ runId, nodeId: 'n_join', summary: '报告写完了' });
    if (!isFinished(done)) throw new Error('join 后应到 end');
    expect(done.outcome).toBe('success');
  });

  it('child report_blocked → child 判失败；主汇聚自动重派一轮（新 child run、旧 run 留档）', () => {
    const { engine, db } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    const blocked = engine.reportBlocked({ childToken: token, reason: '缺数据库权限' });
    if (!isFinished(blocked)) throw new Error('child 应判失败');
    expect(blocked.outcome).toBe('fail');
    expect(blocked.note).toContain('重派');
    // child 落 blocked 轨迹
    const childRow = db.prepare('SELECT id, status FROM runs WHERE child_token = ?').get(token) as { id: string; status: string };
    expect(childRow.status).toBe('failed');
    // 主汇聚：重派一轮，children 只含新 token
    const retry = engine.getCurrentStep({ runId });
    if (!isStep(retry) || retry.step.children === undefined) throw new Error(`应重派：${JSON.stringify(retry)}`);
    expect(retry.step.kind).toBe('subagent');
    expect(retry.note).toContain('重派');
    expect(retry.step.children).toHaveLength(1);
    const newToken = retry.step.children[0]!.childToken;
    expect(newToken).not.toBe(token);
    const newChild = db.prepare('SELECT retry_of, status FROM runs WHERE child_token = ?').get(newToken) as { retry_of: string; status: string };
    expect(newChild).toMatchObject({ retry_of: childRow.id, status: 'running' });
    // 重派成功 → join 用新 child 的结果
    engine.completeStep({ childToken: newToken, summary: '第二次查完了' });
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error('应汇聚到 join');
    expect(join.step.childResults![0]).toMatchObject({ childToken: newToken, status: 'completed', summary: '第二次查完了' });
    const done = engine.completeStep({ runId, summary: '报告完成' });
    if (!isFinished(done)) throw new Error('应到 end');
    expect(done.outcome).toBe('success');
  });

  it('子任务未回报（Task 返回后仍 running）→ 判 failed 并重派一轮', () => {
    const { engine, db } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    // 主 Agent 不等子任务直接汇聚（子 Agent 挂了/没回报）
    const r = engine.getCurrentStep({ runId });
    if (!isStep(r) || r.step.children === undefined) throw new Error(`应重派：${JSON.stringify(r)}`);
    const oldChild = db.prepare('SELECT status FROM runs WHERE child_token = ?').get(token) as { status: string };
    expect(oldChild.status).toBe('failed'); // 未回报判 failed
    expect(r.step.children[0]!.childToken).not.toBe(token);
    expect(r.note).toContain('重派');
  });

  it('重派后仍失败 → 不再重派，带部分结果推进 join（note 与汇总显性记明缺了谁）', () => {
    const { engine } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    engine.reportBlocked({ childToken: token, reason: '第一次失败' });
    const retry = engine.getCurrentStep({ runId }); // 重派
    if (!isStep(retry) || retry.step.children === undefined) throw new Error('应重派');
    const newToken = retry.step.children[0]!.childToken;
    engine.reportBlocked({ childToken: newToken, reason: '第二次还是失败' });
    // 再汇聚：不再重派，带部分结果（其实全缺）推进到 join
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error(`应带部分结果推进：${JSON.stringify(join)}`);
    expect(join.step.kind).toBe('join');
    expect(join.note).toContain('部分子任务失败');
    expect(join.step.instruction).toContain('✗');
    expect(join.step.childResults![0]).toMatchObject({ status: 'failed' });
    // 主流程还能继续走完
    const done = engine.completeStep({ runId, summary: '带着缺口写了报告' });
    if (!isFinished(done)) throw new Error('join 后应到 end');
    expect(done.outcome).toBe('success');
  });

  it('主 run 在派发步上 complete_step / report_blocked → 自愈不推进', () => {
    const { engine } = makeSubEngine('inline');
    const { runId } = toDispatch(engine);
    const c = engine.completeStep({ runId, summary: '想硬推' });
    expect(isErr(c)).toBe(true);
    if (isErr(c)) expect(c.guidance).toContain('get_current_step');
    const b = engine.reportBlocked({ runId, reason: '派不出去' });
    expect(isErr(b)).toBe(true);
    if (isErr(b)) expect(b.guidance).toContain('get_current_step');
    const cur = engine.getCurrentStep({ runId }); // 触发汇聚：子任务未回报 → 判失败 → 重派，仍回到派发步
    expect(isStep(cur)).toBe(true);
  });

  it('入口即 subagent：start 直接进入派发步', () => {
    const flow: Flow = {
      id: 'f_entry_sub',
      name: '入口派发图',
      entry: 'n_sub',
      nodes: [
        { id: 'n_sub', type: 'subagent', extraPrompt: '直接干活', mode: 'inline', next: 'n_end' },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '入口派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.kind).toBe('subagent');
    expect(start.step.children).toHaveLength(1);
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('waiting_children');
  });

  it('join 缺省（无 waitFor）：等该 run 全部 child', () => {
    // n_join 不带 waitFor，靠 run 全量 child 汇聚（§4）
    const { engine } = makeSubEngine('inline');
    const { runId, token } = toDispatch(engine);
    engine.completeStep({ childToken: token, summary: '完成' });
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error('应汇聚到 join');
    expect(join.step.childResults).toHaveLength(1);
    expect(join.step.childResults![0]!.status).toBe('completed');
  });
});

// ---- fan-out 并行与部分失败（§7.4，阶段 7）----

function fanoutFlow(max?: number): Flow {
  return {
    id: 'f_fanout',
    name: '按模块派发图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '列出模块', next: 'n_sub' },
      {
        id: 'n_sub',
        type: 'subagent',
        title: '逐模块调研',
        extraPrompt: '调研 {{item}} 的对外接口',
        mode: 'inline',
        fanOut: max === undefined ? { from: '{{n1.payload.modules}}' } : { from: '{{n1.payload.modules}}', max },
        next: 'n_join',
      },
      { id: 'n_join', type: 'join', aggregateInstruction: '合并成模块清单', next: 'n_ok' },
      { id: 'n_ok', type: 'end', outcome: 'success' },
    ],
  };
}

describe('fan-out 并行（§7.4，阶段 7）', () => {
  /** 跑到派发步，返回所有 child token（按条目顺序） */
  function toFanout(engine: ExecutionEngine, modules: string[]): { runId: string; tokens: string[] } {
    const start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    const done = engine.completeStep({ runId: start.runId, summary: '模块定了', payload: { modules } });
    if (!isStep(done) || done.step.children === undefined) throw new Error(`应到派发步：${JSON.stringify(done)}`);
    return { runId: start.runId, tokens: done.step.children.map((c) => c.childToken) };
  }

  it('from 派 N：每 child 一个条目（{{item}} 已渲染），全部完成后 join 正确汇聚', () => {
    const { engine, db } = makeEngine([fanoutFlow()]);
    const start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    const done = engine.completeStep({ runId: start.runId, summary: '模块定了', payload: { modules: ['battle', 'shop', 'chat'] } });
    if (!isStep(done) || done.step.children === undefined) throw new Error('应到派发步');
    expect(done.step.children).toHaveLength(3);
    expect(done.step.children.map((c) => c.extraPrompt)).toEqual([
      '调研 battle 的对外接口',
      '调研 shop 的对外接口',
      '调研 chat 的对外接口',
    ]);
    // 子 Agent 各自领到自己的条目任务
    const instr = done.step.children.map((c) => {
      const s = engine.getCurrentStep({ childToken: c.childToken });
      return isStep(s) ? s.step.instruction : `ERR:${JSON.stringify(s)}`;
    });
    expect(instr).toEqual(['调研 battle 的对外接口', '调研 shop 的对外接口', '调研 chat 的对外接口']);
    // 无截断：dispatched 轨迹记录 3 个 child、丢弃 0
    const dRow = db
      .prepare("SELECT summary, payload FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' AND status = 'dispatched'")
      .get(start.runId) as { summary: string; payload: string };
    expect(dRow.summary).toContain('派出 3 个子任务');
    expect(JSON.parse(dRow.payload).dropped).toEqual([]);
    // 全部完成 → 汇聚
    for (const c of done.step.children) engine.completeStep({ childToken: c.childToken, summary: `${c.extraPrompt.slice(2, 8)} 完成` });
    const join = engine.getCurrentStep({ runId: start.runId });
    if (!isStep(join)) throw new Error('应汇聚到 join');
    expect(join.step.childResults).toHaveLength(3);
    const end = engine.completeStep({ runId: start.runId, summary: '清单合并完成' });
    if (!isFinished(end)) throw new Error('应到 end');
    expect(end.outcome).toBe('success');
  });

  it('max 截断：只派前 N 个，被丢弃的条目显性记录在派发轨迹（铁律：不静默截断）', () => {
    const { engine, db } = makeEngine([fanoutFlow(2)]);
    const start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    const done = engine.completeStep({ runId: start.runId, summary: '模块定了', payload: { modules: ['battle', 'shop', 'chat', 'guild'] } });
    if (!isStep(done) || done.step.children === undefined) throw new Error('应到派发步');
    expect(done.step.children).toHaveLength(2);
    expect(done.note ?? '').toContain('截断'); // note 提示? — 派发步 note 是固定文案，截断信息在轨迹；这里只验轨迹
    const dRow = db
      .prepare("SELECT summary, payload FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' AND status = 'dispatched'")
      .get(start.runId) as { summary: string; payload: string };
    expect(dRow.summary).toContain('丢弃 2 个');
    expect(dRow.summary).toContain('chat');
    expect(dRow.summary).toContain('guild');
    const payload = JSON.parse(dRow.payload) as { children: string[]; dropped: string[] };
    expect(payload.children).toHaveLength(2);
    expect(payload.dropped).toEqual(['chat', 'guild']);
    engine.completeStep({ childToken: done.step.children[0]!.childToken, summary: 'battle 完成' });
    engine.completeStep({ childToken: done.step.children[1]!.childToken, summary: 'shop 完成' });
    const join = engine.getCurrentStep({ runId: start.runId });
    if (!isStep(join)) throw new Error('应汇聚');
    expect(join.step.childResults).toHaveLength(2); // 只汇聚被派出的
  });

  it('count 固定 N：派 N 个相同子任务', () => {
    const flow: Flow = {
      id: 'f_fanout_count',
      name: '定数派发图',
      entry: 'n_sub',
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          extraPrompt: '抽查一个文件',
          mode: 'inline',
          fanOut: { count: 3 },
          next: 'n_ok',
        },
        { id: 'n_ok', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '定数派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.children).toHaveLength(3);
    for (const c of start.step.children!) {
      engine.completeStep({ childToken: c.childToken, summary: '抽查完成' });
    }
    const done = engine.getCurrentStep({ runId: start.runId });
    if (!isFinished(done)) throw new Error(`n_sub 后无 join，直接隐式推进到 end：${JSON.stringify(done)}`);
    expect(done.outcome).toBe('success');
  });

  it('from 数据问题（非数组 / 空数组 / 未产出）→ 三段式自愈且 run 判失败', () => {
    const { engine, db } = makeEngine([fanoutFlow()]);
    // 非数组
    let start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    let r = engine.completeStep({ runId: start.runId, summary: 'x', payload: { modules: 'battle' } });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.what).toContain('不是数组');
    expect((db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string }).status).toBe('failed');
    // 空数组
    start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    r = engine.completeStep({ runId: start.runId, summary: 'x', payload: { modules: [] } });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.what).toContain('空数组');
    // 字段缺失（没跑过）
    start = engine.startRun({ flowName: '按模块派发图' });
    if (!isStep(start)) throw new Error('start 失败');
    r = engine.completeStep({ runId: start.runId, summary: 'x', payload: { other: 1 } });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.what).toContain('不存在');
  });

  it('部分失败：只重派失败的槽（沿用原条目），重派成功后 join 齐活', () => {
    const { engine } = makeEngine([fanoutFlow()]);
    const { runId, tokens } = toFanout(engine, ['battle', 'shop']);
    engine.completeStep({ childToken: tokens[0]!, summary: 'battle 完成' });
    engine.reportBlocked({ childToken: tokens[1]!, reason: 'shop 文档缺失' });
    // 汇聚 → 只重派 shop 那个槽
    const retry = engine.getCurrentStep({ runId });
    if (!isStep(retry) || retry.step.children === undefined) throw new Error('应重派');
    expect(retry.step.children).toHaveLength(1);
    const newToken = retry.step.children[0]!.childToken;
    expect(retry.step.children[0]!.extraPrompt).toBe('调研 shop 的对外接口'); // 沿用原条目
    const task = engine.getCurrentStep({ childToken: newToken });
    expect(isStep(task) && task.step.instruction).toBe('调研 shop 的对外接口');
    engine.completeStep({ childToken: newToken, summary: 'shop 补齐' });
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error('应汇聚');
    const results = join.step.childResults!;
    expect(results).toHaveLength(2);
    expect(results.map((x) => x.childToken).sort()).toEqual([tokens[0]!, newToken].sort());
    expect(results.every((x) => x.status === 'completed')).toBe(true);
    const end = engine.completeStep({ runId, summary: '合并完成' });
    if (!isFinished(end)) throw new Error('应到 end');
    expect(end.outcome).toBe('success');
  });

  it('重派再失败 → 带部分结果推进 join：note 记明缺哪个条目，汇总行 payload 留 failed 痕迹（面板黄标数据源）', () => {
    const { engine, db } = makeEngine([fanoutFlow()]);
    const { runId, tokens } = toFanout(engine, ['battle', 'shop']);
    engine.completeStep({ childToken: tokens[0]!, summary: 'battle 完成' });
    engine.reportBlocked({ childToken: tokens[1]!, reason: 'shop 挂了' });
    const retry = engine.getCurrentStep({ runId }); // 重派
    if (!isStep(retry) || retry.step.children === undefined) throw new Error('应重派');
    engine.reportBlocked({ childToken: retry.step.children[0]!.childToken, reason: 'shop 还是挂' });
    // 再汇聚：不再重派，带部分结果推进
    const join = engine.getCurrentStep({ runId });
    if (!isStep(join)) throw new Error('应带部分结果推进');
    expect(join.step.kind).toBe('join');
    expect(join.note).toContain('部分子任务失败');
    expect(join.note).toContain('shop'); // 用条目名记明缺谁
    expect(join.step.childResults!.map((r) => r.status)).toEqual(['completed', 'failed']);
    // 汇总行（部分完成 → 面板黄标）
    const sRow = db
      .prepare("SELECT payload FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' AND status = 'completed'")
      .get(runId) as { payload: string };
    const kids = (JSON.parse(sRow.payload) as { children: Array<{ status: string }> }).children;
    expect(kids.some((k) => k.status === 'failed')).toBe(true);
    const end = engine.completeStep({ runId, summary: '带缺口合并' });
    if (!isFinished(end)) throw new Error('应到 end');
    expect(end.outcome).toBe('success');
  });
});
