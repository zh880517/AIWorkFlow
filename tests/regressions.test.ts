// 2026-10-29 审计修复的回归测试：每个用例对应审计报告里的一个缺陷，防止回退。
// 覆盖：会话/子 run、快照递归、迭代上限、maxSteps、入口派发、崩溃窗口、截断记录、
// 卡点 outlet 校验、畸形 DSL、产物插值、编辑器单出边/清空 when、放弃 run 与一会话一活跃 run。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from './support/db.js';
import { FlowStore } from './support/flowStore.js';
import {
  ExecutionEngine,
  type RunFinishedResult,
  type SelfHealError,
  type StepResult,
} from '../shared/src/engine.js';
import { buildSnapshot } from '../shared/src/snapshot.js';
import { readMonitorState } from '../shared/src/sql.js';
import { validateFlow } from '../shared/src/validate.js';
import type { Flow } from '../shared/src/types.js';

let tmpHome: string;
beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-regressions-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
});
afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const isStep = (r: unknown): r is StepResult =>
  typeof r === 'object' && r !== null && 'step' in r && !('error' in r);
const isFinished = (r: unknown): r is RunFinishedResult =>
  typeof r === 'object' && r !== null && 'finished' in r;
const isErr = (r: unknown): r is SelfHealError =>
  typeof r === 'object' && r !== null && (r as { error?: unknown }).error === true;

function makeEngine(flows: Flow[]): {
  engine: ExecutionEngine;
  db: ReturnType<typeof openMemoryDb>;
  store: FlowStore;
} {
  const db = openMemoryDb();
  const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
  for (const flow of flows) {
    const result = store.save(flow);
    if (!result.ok) throw new Error(`fixture 校验失败：${JSON.stringify(result.errors)}`);
  }
  return {
    db,
    store,
    engine: new ExecutionEngine({ db, resolveFlow: (name) => store.resolve(name) }),
  };
}

// ---- 会话过滤：child run 通过父 run 的会话被允许选中 ----

describe('readMonitorState：child run 的会话归属', () => {
  it('显式选中本会话 root 名下的 child run 时不会被回退到父 run', () => {
    const db = openMemoryDb();
    const snapshot = JSON.stringify({
      rootFlowId: 'f',
      flows: { f: { id: 'f', name: 'f', entry: 'n1', nodes: [{ id: 'n1', type: 'end', outcome: 'success' }] } },
    });
    db.prepare('INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?)').run('h', snapshot, 'now');
    const insert = db.prepare(
      `INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node, status, steps_used, created_at, last_activity, host_session, parent_node)
       VALUES (?, ?, ?, 'f', 'h', 'n1', 'n1', ?, 0, ?, ?, ?, ?)`,
    );
    insert.run('run_root', null, 'run_root', 'running', '2026-10-30T09:00:00.000Z', '2026-10-30T09:00:00.000Z', 'dsh:s1', null);
    insert.run('run_child', 'run_root', 'run_root', 'completed', '2026-10-30T09:00:01.000Z', '2026-10-30T09:00:02.000Z', null, 'n1');

    const state = readMonitorState(db, 'run_child', {}, 'dsh:s1');
    expect(state.selectedId).toBe('run_child');
    expect(state.detail?.id).toBe('run_child');
    // 仍然不能跨会话
    const other = readMonitorState(db, 'run_child', {}, 'dsh:s2');
    expect(other.selectedId).not.toBe('run_child');
    db.close();
  });
});

// ---- 任意深度子图里的 flowRef 都要进快照 ----

describe('buildSnapshot：嵌套子图的 flowRef', () => {
  it('两层子图内的 flowRef 会被递归收进快照并可派发', () => {
    const deep: Flow = {
      id: 'f_deep',
      name: '深图',
      entry: 'd1',
      nodes: [
        { id: 'd1', type: 'prompt', instruction: '深图第一步', next: 'd2' },
        { id: 'd2', type: 'end', outcome: 'success' },
      ],
    };
    const parent: Flow = {
      id: 'f_parent',
      name: '两层子图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '开始', next: 'n_a' },
        {
          id: 'n_a',
          type: 'subagent',
          title: '外层',
          extraPrompt: '',
          mode: 'subflow',
          next: 'n_end',
          subflow: {
            entry: 's1',
            nodes: [
              {
                id: 's1',
                type: 'subagent',
                title: '内层',
                extraPrompt: '',
                mode: 'subflow',
                next: 's2',
                subflow: {
                  entry: 't1',
                  nodes: [
                    { id: 't1', type: 'subagent', extraPrompt: '调深图', mode: 'flowRef', flowRef: 'f_deep', next: 't2' },
                    { id: 't2', type: 'end', outcome: 'success' },
                  ],
                },
              },
              { id: 's2', type: 'end', outcome: 'success' },
            ],
          },
        },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const snapshot = buildSnapshot(parent, { get: (id) => (id === 'f_deep' ? deep : undefined) });
    expect(Object.keys(snapshot.flows).sort()).toEqual(['f_deep', 'f_parent']);

    const { engine, db } = makeEngine([parent, deep]);
    const start = engine.startRun({ flowName: '两层子图' });
    if (!isStep(start)) throw new Error('start 失败');
    const next = engine.completeStep({ runId: start.runId, summary: '开始完成' });
    expect(isStep(next) && next.step.kind === 'subagent').toBe(true);
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('waiting_children');
  });
});

// ---- 迭代上限：派发轨迹不占配额、自环不差一 ----

describe('迭代上限计数', () => {
  function loopFlow(fanOut: boolean): Flow {
    return {
      id: fanOut ? 'f_fan_loop' : 'f_plain_loop',
      name: fanOut ? '并行回环' : '串行回环',
      entry: 'n_sub',
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          title: '干活',
          extraPrompt: '取样',
          mode: 'inline',
          ...(fanOut ? { fanOut: { count: 1 } } : {}),
          iterationLimit: 6,
          onLimitExceeded: 'n_fail',
          branches: [{ id: 'again', condition: '*', to: 'n_sub' }],
        },
        { id: 'n_fail', type: 'end', outcome: 'fail' },
      ],
    };
  }

  function runLoop(fanOut: boolean): number {
    const { engine, db } = makeEngine([loopFlow(fanOut)]);
    let step: unknown = engine.startRun({ flowName: fanOut ? '并行回环' : '串行回环' });
    const runId = isStep(step) ? step.runId : '';
    for (let guard = 0; guard < 30; guard += 1) {
      if (!isStep(step)) break;
      for (const child of step.step.children ?? []) {
        engine.completeStep({ childToken: child.childToken, summary: '完成' });
      }
      step = engine.getCurrentStep({ runId });
    }
    const rows = db
      .prepare("SELECT status FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' ORDER BY id")
      .all(runId) as Array<{ status: string }>;
    return rows.filter((row) => row.status === 'completed').length;
  }

  it('fan-out 与串行节点在回路里执行同样多次', () => {
    expect({ plain: runLoop(false), fanOut: runLoop(true) }).toEqual({ plain: 6, fanOut: 6 });
  });

  it('自环节点 iterationLimit=2 只执行 2 次', () => {
    const flow: Flow = {
      id: 'f_self_loop',
      name: '自环图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '再试',
          iterationLimit: 2,
          onLimitExceeded: 'n_fail',
          branches: [{ id: 'again', condition: '*', to: 'n1' }],
        },
        { id: 'n_fail', type: 'end', outcome: 'fail' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '自环图' });
    if (!isStep(start)) throw new Error('start 失败');
    for (let i = 0; i < 5; i += 1) {
      const r = engine.completeStep({ runId: start.runId, summary: `第 ${i + 1} 次`, branchId: 'again' });
      if (!isStep(r)) break;
    }
    const rows = db
      .prepare("SELECT status FROM node_executions WHERE run_id = ? AND node_id = 'n1'")
      .all(start.runId) as Array<{ status: string }>;
    expect(rows.filter((row) => row.status === 'completed')).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'limit_exceeded')).toHaveLength(1);
  });

  it('自动汇聚回环也不能绕过 maxSteps', () => {
    const flow: Flow = {
      id: 'f_maxsteps_gap',
      name: '汇聚回环',
      entry: 'n_sub',
      maxSteps: 3,
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          extraPrompt: '干活',
          mode: 'inline',
          onLimitExceeded: 'n_end',
          branches: [{ id: 'again', condition: '*', to: 'n_sub' }],
        },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    let step: unknown = engine.startRun({ flowName: '汇聚回环' });
    const runId = isStep(step) ? step.runId : '';
    for (let i = 0; i < 8; i += 1) {
      if (!isStep(step)) break;
      for (const child of step.step.children ?? []) {
        engine.completeStep({ childToken: child.childToken, summary: '完成' });
      }
      step = engine.getCurrentStep({ runId });
    }
    const run = db.prepare('SELECT status, steps_used FROM runs WHERE id = ?').get(runId) as {
      status: string;
      steps_used: number;
    };
    expect(run).toEqual({ status: 'failed', steps_used: 3 });
  });
});

// ---- 入口派发失败 / 崩溃窗口 / 截断记录 ----

describe('派发步边界', () => {
  it('入口 fanOut 数据非法时 run 判失败而不是停在 running', () => {
    const flow: Flow = {
      id: 'f_entry_fanout',
      name: '入口并行图',
      entry: 'n_sub',
      nodes: [
        { id: 'n_sub', type: 'subagent', extraPrompt: '查 {{item}}', mode: 'inline', fanOut: { from: '{{inputs.modules}}' }, next: 'n_end' },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '入口并行图', inputs: { modules: 'not-an-array' } });
    expect(isErr(start)).toBe(true);
    const run = db.prepare('SELECT status FROM runs ORDER BY rowid DESC LIMIT 1').get() as { status: string };
    expect(run.status).toBe('failed');
  });

  it('入口 fan-out 的 max 截断会落 dispatched 轨迹并提示', () => {
    const flow: Flow = {
      id: 'f_entry_truncate',
      name: '入口截断图',
      entry: 'n_sub',
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          extraPrompt: '查 {{item}}',
          mode: 'inline',
          fanOut: { from: '{{inputs.modules}}', max: 1 },
          next: 'n_end',
        },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '入口截断图', inputs: { modules: ['a', 'b', 'c'] } });
    if (!isStep(start)) throw new Error('start 失败');
    expect(start.step.children).toHaveLength(1);
    const dispatched = db
      .prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' AND status = 'dispatched'")
      .get(start.runId) as { c: number };
    expect(dispatched.c).toBe(1);
    expect(start.note ?? '').toContain('截断');
  });

  it('崩溃窗口补建 child 后不会立刻判失败再重派', () => {
    const flow: Flow = {
      id: 'f_crash_window',
      name: '崩溃窗口图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '准备', next: 'n_sub' },
        { id: 'n_sub', type: 'subagent', extraPrompt: '干活', mode: 'inline', next: 'n_end' },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '崩溃窗口图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '准备完成' });
    db.prepare('DELETE FROM runs WHERE parent_run_id = ?').run(start.runId);
    const healed = engine.getCurrentStep({ runId: start.runId });
    if (!isStep(healed)) throw new Error(`自愈失败：${JSON.stringify(healed)}`);
    const children = db
      .prepare('SELECT status FROM runs WHERE parent_run_id = ? ORDER BY rowid')
      .all(start.runId) as Array<{ status: string }>;
    expect(children.map((c) => c.status)).toEqual(['running']);
    expect(healed.note ?? '').not.toContain('重派');
  });

  it('未回报的 child 会落一条 blocked 轨迹说明原因', () => {
    const flow: Flow = {
      id: 'f_unreported',
      name: '未回报图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '准备', next: 'n_sub' },
        { id: 'n_sub', type: 'subagent', extraPrompt: '干活', mode: 'inline', next: 'n_end' },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '未回报图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '准备完成' });
    engine.getCurrentStep({ runId: start.runId }); // 汇聚：child 未回报 → failed + 重派
    const failed = db
      .prepare("SELECT id FROM runs WHERE parent_run_id = ? AND status = 'failed' LIMIT 1")
      .get(start.runId) as { id: string };
    const row = db
      .prepare("SELECT summary FROM node_executions WHERE run_id = ? AND status = 'blocked'")
      .get(failed.id) as { summary: string };
    expect(row.summary).toContain('未回报');
  });
});

// ---- 校验：outlet / 畸形输入 / 路径 id ----

describe('校验守门', () => {
  const badOutlet: Flow = {
    id: 'f_bad_outlet',
    name: '错出口',
    entry: 'g',
    nodes: [
      {
        id: 'g',
        type: 'gate',
        question: '选？',
        options: [
          { id: 'o1', label: '甲' },
          { id: 'o2', label: '乙' },
        ],
        branches: [
          { id: 'b1', condition: '甲', to: 'e', outlet: 'o9' },
          { id: 'b2', condition: '乙', to: 'e', outlet: 'o2' },
        ],
      },
      { id: 'e', type: 'end', outcome: 'success' },
    ],
  };

  it('卡点 outlet 指向不存在的选项 → E_BAD_OUTLET', () => {
    expect(validateFlow(badOutlet).errors.map((e) => e.code)).toContain('E_BAD_OUTLET');
  });

  it('同一 outlet 连两条分支 → E_DUP_OUTLET', () => {
    const flow: Flow = {
      id: 'f_dup_outlet',
      name: '重复出口',
      entry: 'g',
      nodes: [
        {
          id: 'g',
          type: 'gate',
          question: '选？',
          options: [
            { id: 'o1', label: '甲' },
            { id: 'o2', label: '乙' },
          ],
          branches: [
            { id: 'b1', condition: '甲', to: 'e', outlet: 'o1' },
            { id: 'b2', condition: '乙', to: 'e', outlet: 'o1' },
          ],
        },
        { id: 'e', type: 'end', outcome: 'success' },
      ],
    };
    expect(validateFlow(flow).errors.map((e) => e.code)).toContain('E_DUP_OUTLET');
  });

  it('畸形 DSL 返回硬拒而不是抛异常', () => {
    const cases: unknown[] = [
      { id: 'f_shape', name: 'x', entry: 'n1', nodes: [null] },
      { id: 'f_shape2', name: 'x', entry: 'n1', nodes: [{ id: 'n1', type: 'prompt', instruction: 'x', branches: [{ id: 'b', condition: 'x', to: 'n1', when: 42 }] }] },
    ];
    for (const flow of cases) {
      expect(() => validateFlow(flow as Flow)).not.toThrow();
      expect(validateFlow(flow as Flow).ok).toBe(false);
    }
  });

  it('图 id 不能包含路径分隔符', () => {
    const flow: Flow = { id: '../escape', name: 'x', entry: 'n1', nodes: [{ id: 'n1', type: 'end', outcome: 'success' }] };
    expect(validateFlow(flow).ok).toBe(false);
  });
});

// ---- 产物插值 ----

describe('产物插值', () => {
  it('裸 {{artifacts}} 保持原 token，不渲染 null', () => {
    const flow: Flow = {
      id: 'f_art',
      name: '产物图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '产出', next: 'n2' },
        { id: 'n2', type: 'prompt', instruction: '汇总：{{artifacts}}', next: 'n3' },
        { id: 'n3', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '产物图' });
    if (!isStep(start)) throw new Error('start 失败');
    const next = engine.completeStep({ runId: start.runId, summary: '好了', artifacts: [{ key: 'design', path: 'a.md' }] });
    if (!isStep(next)) throw new Error('应到下一步');
    expect(next.step.instruction).toBe('汇总：{{artifacts}}');
  });

  it('{{artifacts.key.path}} 取最新版', () => {
    const flow: Flow = {
      id: 'f_art2',
      name: '产物图2',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '产出', next: 'n2' },
        { id: 'n2', type: 'prompt', instruction: '看 {{artifacts.design.path}}', next: 'n3' },
        { id: 'n3', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '产物图2' });
    if (!isStep(start)) throw new Error('start 失败');
    const next = engine.completeStep({ runId: start.runId, summary: '好了', artifacts: [{ key: 'design', path: 'docs/d.md' }] });
    if (!isStep(next)) throw new Error('应到下一步');
    expect(next.step.instruction).toBe('看 docs/d.md');
  });
});

// ---- 放弃 run / 一会话一活跃 run ----

describe('放弃 run 与会话互斥', () => {
  function twoFlows(): Flow[] {
    return [
      {
        id: 'f_abandon',
        name: '放弃图',
        entry: 'n1',
        nodes: [
          { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
          { id: 'n2', type: 'end', outcome: 'success' },
        ],
      },
      {
        id: 'f_second',
        name: '第二张',
        entry: 'm1',
        nodes: [
          { id: 'm1', type: 'prompt', instruction: '第一步', next: 'm2' },
          { id: 'm2', type: 'end', outcome: 'success' },
        ],
      },
    ];
  }

  it('同一 hostSession 已有活跃 run 时 start_run 被拒', () => {
    const { engine } = makeEngine(twoFlows());
    const a = engine.startRun({ flowName: '放弃图', hostSession: 'dsh:s1' });
    expect(isStep(a)).toBe(true);
    const b = engine.startRun({ flowName: '第二张', hostSession: 'dsh:s1' });
    expect(isErr(b)).toBe(true);
    if (isErr(b)) expect(b.what).toContain('已有进行中的 run');
  });

  it('放弃挂起中的卡点 run 后，旧 gateId 不能把 run 复活', () => {
    const flow: Flow = {
      id: 'f_abandon_gate',
      name: '卡点放弃图',
      entry: 'g',
      nodes: [
        {
          id: 'g',
          type: 'gate',
          question: '选？',
          options: [{ id: 'o1', label: '继续' }],
          branches: [{ id: 'b1', condition: '继续', to: 'n2', outlet: 'o1' }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = makeEngine([flow]);
    const start = engine.startRun({ flowName: '卡点放弃图', hostSession: 'dsh:s1' });
    if (!isStep(start) || start.step.gateId === undefined) throw new Error('应停在卡点');
    const gateId = start.step.gateId;
    expect('error' in engine.abandonRun({ runId: start.runId })).toBe(false);
    const answered = engine.answerGate({ gateId, optionId: 'o1' }, 'chat');
    expect(isErr(answered)).toBe(true);
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('failed');
  });

  it('abandon_run 把 run 置 failed 并记录原因，之后可以起新 run', () => {
    const { engine, db } = makeEngine(twoFlows());
    const a = engine.startRun({ flowName: '放弃图', hostSession: 'dsh:s1' });
    if (!isStep(a)) throw new Error('start 失败');
    const result = engine.abandonRun({ runId: a.runId, reason: '测试放弃' });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.abandoned).toBeGreaterThanOrEqual(1);
    const run = db.prepare('SELECT status, outcome FROM runs WHERE id = ?').get(a.runId) as {
      status: string;
      outcome: string;
    };
    expect(run).toEqual({ status: 'failed', outcome: 'fail' });
    const row = db
      .prepare("SELECT summary FROM node_executions WHERE run_id = ? AND status = 'blocked'")
      .get(a.runId) as { summary: string };
    expect(row.summary).toBe('测试放弃');
    const b = engine.startRun({ flowName: '第二张', hostSession: 'dsh:s1' });
    expect(isStep(b)).toBe(true);
  });
});

// ---- 编辑器：单出边不清空 branches / 清空 when / 清空条件 ----

describe('编辑器 buildFlow 往返', () => {
  it('只有一个分支（带 when）时保留 branches', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_single_branch',
      name: '单分支',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [{ id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.v}} == '1'" }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const built = buildFlow(base, bodies, canvas.nodes, canvas.edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    expect(n1.next).toBeUndefined();
    expect(n1.branches).toEqual([{ id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.v}} == '1'" }]);
  });

  it('清空 when（data.when = ""）会真的删掉它', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_when',
      name: 'when',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [
            { id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.v}} == '1'" },
            { id: 'b2', condition: '*', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const edges = canvas.edges.map((edge) =>
      edge.id === 'e-n1-b1' ? { ...edge, data: { ...edge.data, when: '' } } : edge,
    );
    const built = buildFlow(base, bodies, canvas.nodes, edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    expect(n1.branches?.find((b) => b.id === 'b1')?.when).toBeUndefined();
  });

  it('两路条件都显式清空时都保持空（交给校验器统一报错）', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_clear_cond',
      name: '清空条件',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [
            { id: 'b1', condition: '第一路', to: 'n2' },
            { id: 'b2', condition: '第二路', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const edges = canvas.edges.map((edge) => ({ ...edge, data: { ...edge.data, condition: '' } }));
    const built = buildFlow(base, bodies, canvas.nodes, edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    expect(n1.branches?.map((b) => b.condition)).toEqual(['', '']);
  });
});

// ---- 保留：isFinished 用到的场景（避免 tree-shaking 误删） ----

describe('终点结果', () => {
  it('end 节点返回 finished', () => {
    const { engine } = makeEngine([
      {
        id: 'f_end',
        name: '终点图',
        entry: 'n1',
        nodes: [
          { id: 'n1', type: 'prompt', instruction: 'x', next: 'n2' },
          { id: 'n2', type: 'end', outcome: 'success' },
        ],
      },
    ]);
    const start = engine.startRun({ flowName: '终点图' });
    if (!isStep(start)) throw new Error('start 失败');
    expect(isFinished(engine.completeStep({ runId: start.runId, summary: 'done' }))).toBe(true);
  });
});
