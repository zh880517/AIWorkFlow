// 执行引擎测试（设计文档 §6.2 / §6.3 / §7.2 / §7.3 的 Phase 2 范围）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from '../src/core/db.js';
import { FlowStore } from '../src/core/flowStore.js';
import {
  ExecutionEngine,
  DISCIPLINE_TEXT,
  type StepResult,
  type RunFinishedResult,
  type SelfHealError,
} from '../src/core/engine.js';
import type { Flow } from '../src/core/types.js';

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
      {
        id: 'n1',
        type: 'gate',
        question: '可以发布吗？',
        options: [{ id: 'opt1', label: '可以' }],
        next: 'n2',
      },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
}

function makeEngine(flows: Flow[]): { engine: ExecutionEngine; store: FlowStore } {
  const db = openMemoryDb();
  const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
  for (const f of flows) {
    const r = store.save(f);
    if (!r.ok) throw new Error(`fixture 校验失败：${JSON.stringify(r.errors)}`);
  }
  return { engine: new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n) }), store };
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

  it('含 gate 等未支持类型 → start_run 整体拒绝', () => {
    const { engine } = makeEngine([gateFlow()]);
    const r = engine.startRun({ flowName: '卡点图' });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.what).toContain('gate');
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
    const db = (engine as unknown as { db: import('better-sqlite3').Database }).db;
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

  it('上下文压缩后的恢复入口：不带 runId 时按会话绑定解析', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', mcpSessionId: 'sess-1' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.getCurrentStep({}, 'sess-1');
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
    const db = (engine as unknown as { db: import('better-sqlite3').Database }).db;
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
    const db = (engine as unknown as { db: import('better-sqlite3').Database }).db;
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

describe('宿主会话定位（阶段 2.5：hostSession，hook 注入）', () => {
  it('start_run 持久化 host_session', () => {
    const { engine } = makeEngine([linearFlow()]);
    const db = (engine as unknown as { db: import('better-sqlite3').Database }).db;
    const start = engine.startRun({ flowName: '直线图', hostSession: 'claude-code:s1' });
    if (!isStep(start)) throw new Error('start 失败');
    const run = db.prepare('SELECT host_session FROM runs WHERE id = ?').get(start.runId) as {
      host_session: string | null;
    };
    expect(run.host_session).toBe('claude-code:s1');
  });

  it('不带 runId/childToken 时按 hostSession 定位当前步', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', hostSession: 'codex:thr_1' });
    const cur = engine.getCurrentStep({ hostSession: 'codex:thr_1' });
    if (!isStep(cur)) throw new Error('应按 hostSession 定位成功');
    expect(cur.runId).toBe(start.runId);
    expect(cur.step.nodeId).toBe('n1');
  });

  it('hostSession 优先于 mcpSessionId（即使后者匹配更新的 run）', () => {
    const { engine } = makeEngine([linearFlow()]);
    const a = engine.startRun({ flowName: '直线图', hostSession: 'claude-code:s1', mcpSessionId: 'm1' });
    engine.startRun({ flowName: '直线图', mcpSessionId: 'm2' }); // 更晚创建，只绑 MCP 会话
    const cur = engine.getCurrentStep({ hostSession: 'claude-code:s1' }, 'm2');
    if (!isStep(cur)) throw new Error('应定位成功');
    expect(cur.runId).toBe(a.runId);
  });

  it('hostSession 无匹配时回落 mcpSessionId', () => {
    const { engine } = makeEngine([linearFlow()]);
    const a = engine.startRun({ flowName: '直线图', mcpSessionId: 'm1' });
    const cur = engine.getCurrentStep({ hostSession: 'claude-code:unknown' }, 'm1');
    if (!isStep(cur)) throw new Error('应回落到 mcpSessionId 定位');
    expect(cur.runId).toBe(a.runId);
  });

  it('run 终结后按 hostSession 回落最近 run，返回终结态而非找不到', () => {
    const { engine } = makeEngine([linearFlow()]);
    const start = engine.startRun({ flowName: '直线图', hostSession: 'claude-code:s1' });
    engine.completeStep({ runId: start.runId, summary: '完成' });
    const cur = engine.getCurrentStep({ hostSession: 'claude-code:s1' });
    if (!isFinished(cur)) throw new Error('应返回终结态');
    expect(cur.runId).toBe(start.runId);
  });

  it('complete_step 同样按 hostSession 定位并推进（MCP 会话已换的场景）', () => {
    const { engine } = makeEngine([interpolationFlow()]);
    engine.startRun({ flowName: '插值图', hostSession: 'claude-code:s1' });
    // 模拟 Codex 会话过期重握手：Mcp-Session-Id 已变，仅靠 hostSession 定位
    const next = engine.completeStep(
      { hostSession: 'claude-code:s1', summary: '项目是 demo', payload: { project: 'apps/demo' } },
      'mcp-new-after-reconnect',
    );
    if (!isStep(next)) throw new Error('应推进成功');
    expect(next.step.nodeId).toBe('n2');
    expect(next.step.instruction).toContain('apps/demo');
  });
});
