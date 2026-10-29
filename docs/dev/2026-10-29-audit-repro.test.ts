// 审计复现用例（2026-10-29，基线 bd660ed）：保留的是"审计当时的现状/期望对照"。
// - 未应用补丁的 HEAD：除 BUG-13 / BUG-6 第二条（记录现状）外都会失败；
// - 修复后的回归断言已固化在 tests/regressions.test.ts（21 条）+ tests/host-routes.test.ts；
// - BUG-17 按产品决策保留"普通节点必须显式选分支"的实现（文档已对齐），本文件里的
//   "自动走 default" 断言仍会失败，属预期；BUG-20 加了"一会话一活跃 run"守卫后，
//   本文件的第二次 start_run 会被拒，也已由 regressions 的新用例覆盖。
// 用法：复制到 tests/，再 npx vitest run tests/audit-repro.test.ts。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from './support/db.js';
import { FlowStore } from './support/flowStore.js';
import { ExecutionEngine, type StepResult } from '../shared/src/engine.js';
import { buildSnapshot } from '../shared/src/snapshot.js';
import { readMonitorState } from '../shared/src/sql.js';
import { saveFlow } from '../shared/src/flows.js';
import { validateFlow } from '../shared/src/validate.js';
import type { Flow } from '../shared/src/types.js';

let tmpHome: string;
beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-audit-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
});
afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const isStep = (r: unknown): r is StepResult =>
  typeof r === 'object' && r !== null && 'step' in r && !('error' in r);

function engineFor(flows: Flow[]): { engine: ExecutionEngine; store: FlowStore; db: ReturnType<typeof openMemoryDb> } {
  const db = openMemoryDb();
  const store = new FlowStore(db, path.join(tmpHome, `flows-${Math.random().toString(36).slice(2)}`));
  for (const flow of flows) {
    const result = store.save(flow);
    if (!result.ok) throw new Error(`fixture 校验失败：${JSON.stringify(result.errors)}`);
  }
  return { db, store, engine: new ExecutionEngine({ db, resolveFlow: (n) => store.resolve(n) }) };
}

// ---- 1. 运行图里点 child run：session 过滤下选不中 ----

describe('BUG-1 运行图选中 child run', () => {
  it('按会话过滤时，显式指定本会话 root 名下的 child run 应能选中', () => {
    const db = openMemoryDb();
    const snapshot = JSON.stringify({
      rootFlowId: 'f',
      flows: {
        f: {
          id: 'f',
          name: 'f',
          entry: 'n1',
          nodes: [
            { id: 'n1', type: 'subagent', extraPrompt: 'x', mode: 'inline', next: 'n2' },
            { id: 'n2', type: 'end', outcome: 'success' },
          ],
        },
      },
    });
    db.prepare('INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?)').run('h', snapshot, 'now');
    const insert = db.prepare(
      `INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node, status, steps_used, created_at, last_activity, host_session, parent_node)
       VALUES (?, ?, ?, 'f', 'h', ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run('run_root', null, 'run_root', 'n1', 'n1', 'running', 0, '2026-10-30T09:00:00.000Z', '2026-10-30T09:00:00.000Z', 'dsh:s1', null);
    insert.run('run_child', 'run_root', 'run_root', 'n1', 'n2', 'completed', 1, '2026-10-30T09:00:01.000Z', '2026-10-30T09:00:02.000Z', null, 'n1');

    const state = readMonitorState(db, 'run_child', {}, 'dsh:s1');
    expect(state.selectedId).toBe('run_child');
    expect(state.detail?.id).toBe('run_child');
    db.close();
  });
});

// ---- 2. 两层以上内嵌子图里的 flowRef 不会进快照 ----

describe('BUG-2 嵌套子图里的 flowRef', () => {
  function deepFlow(): { parent: Flow; deep: Flow } {
    const deep: Flow = {
      id: 'f_deep',
      name: '被引用的深图',
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
          title: '外层子图',
          extraPrompt: '',
          mode: 'subflow',
          next: 'n_end',
          subflow: {
            entry: 's1',
            nodes: [
              {
                id: 's1',
                type: 'subagent',
                title: '内层子图',
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
    return { parent, deep };
  }

  it('buildSnapshot 应递归收进任意层子图里的 flowRef', () => {
    const { parent, deep } = deepFlow();
    const snapshot = buildSnapshot(parent, { get: (id) => (id === 'f_deep' ? deep : undefined) });
    expect(Object.keys(snapshot.flows).sort()).toEqual(['f_deep', 'f_parent']);
  });

  it('端到端：跑到外层子图派发时不应因快照缺图判失败', () => {
    const { parent, deep } = deepFlow();
    const { engine, db } = engineFor([parent, deep]);
    const start = engine.startRun({ flowName: '两层子图' });
    if (!isStep(start)) throw new Error('start 失败');
    const r = engine.completeStep({ runId: start.runId, summary: '开始完成' });
    expect(isStep(r) && r.step.kind === 'subagent').toBe(true);
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(start.runId) as { status: string };
    expect(run.status).toBe('waiting_children');
  });
});

// ---- 3. fan-out 的 dispatched 轨迹占用 iterationLimit 计数 ----

describe('BUG-3 fan-out 节点在回路里的 iterationLimit', () => {
  function runLoop(fanOut: boolean): number {
    const flow: Flow = {
      id: fanOut ? 'f_fan_loop' : 'f_plain_loop',
      name: fanOut ? '并行回环' : '串行回环',
      entry: 'n_sub',
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          title: '干活',
          extraPrompt: '做一份取样',
          mode: 'inline',
          ...(fanOut ? { fanOut: { count: 1 } } : {}),
          iterationLimit: 6,
          onLimitExceeded: 'n_fail',
          branches: [{ id: 'again', condition: '*', to: 'n_sub' }],
        },
        { id: 'n_fail', type: 'end', outcome: 'fail' },
      ],
    };
    const { engine, db } = engineFor([flow]);
    let step: unknown = engine.startRun({ flowName: flow.name });
    const runId = isStep(step) ? step.runId : '';
    for (let guard = 0; guard < 30; guard += 1) {
      if (!isStep(step)) break;
      for (const child of step.step.children ?? []) {
        engine.completeStep({ childToken: child.childToken, summary: '取样完成' });
      }
      step = engine.getCurrentStep({ runId });
      if (!isStep(step) || step.step.kind === 'end') break;
    }
    const rows = db
      .prepare("SELECT status FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' ORDER BY id")
      .all(runId) as Array<{ status: string }>;
    return rows.filter((row) => row.status === 'completed').length;
  }

  it('iterationLimit=6 时，fan-out 与串行节点应完成同样多次执行', () => {
    const plain = runLoop(false);
    const fanOut = runLoop(true);
    expect({ plain, fanOut }).toEqual({ plain: 6, fanOut: 6 });
  });
});

// ---- 7. 自环节点的 iterationLimit 差一 ----

describe('BUG-7 自环节点的 iterationLimit', () => {
  it('iterationLimit=2 的自环节点应只执行 2 次（当前执行 3 次，且逃生行写"未执行"）', () => {
    const flow: Flow = {
      id: 'f_self_loop',
      name: '自环图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '再试一次',
          iterationLimit: 2,
          onLimitExceeded: 'n_fail',
          branches: [{ id: 'again', condition: '*', to: 'n1' }],
        },
        { id: 'n_fail', type: 'end', outcome: 'fail' },
      ],
    };
    const { engine, db } = engineFor([flow]);
    const start = engine.startRun({ flowName: '自环图' });
    if (!isStep(start)) throw new Error('start 失败');
    for (let i = 0; i < 5; i += 1) {
      const r = engine.completeStep({ runId: start.runId, summary: `第 ${i + 1} 次`, branchId: 'again' });
      if (!isStep(r) || r.step.kind === 'end') break;
    }
    const rows = db
      .prepare("SELECT status FROM node_executions WHERE run_id = ? AND node_id = 'n1' ORDER BY id")
      .all(start.runId) as Array<{ status: string }>;
    const completed = rows.filter((row) => row.status === 'completed').length;
    const limitRows = rows.filter((row) => row.status === 'limit_exceeded').length;
    expect({ completed, limitRows }).toEqual({ completed: 2, limitRows: 1 });
  });
});

// ---- 8. 入口就是 fan-out subagent 且 data 解析失败：run 卡在 running ----

describe('BUG-8 入口派发失败时的 run 状态', () => {
  it('入口 fanOut 数据非法时 run 应判失败，而不是永远停在 running', () => {
    const flow: Flow = {
      id: 'f_entry_fanout',
      name: '入口并行图',
      entry: 'n_sub',
      nodes: [
        {
          id: 'n_sub',
          type: 'subagent',
          extraPrompt: '查 {{item}}',
          mode: 'inline',
          fanOut: { from: '{{inputs.modules}}' },
          next: 'n_end',
        },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = engineFor([flow]);
    const start = engine.startRun({ flowName: '入口并行图', inputs: { modules: 'not-an-array' } });
    expect('error' in start && start.error === true).toBe(true); // 入口解析失败：自愈错误
    const run = db.prepare('SELECT status FROM runs WHERE id = ?').get((start as { runId?: string }).runId ?? '') as
      | { status: string }
      | undefined;
    // startRun 的自愈错误里没有 runId；用库里的唯一 run
    const anyRun = db.prepare('SELECT id, status FROM runs ORDER BY rowid DESC LIMIT 1').get() as {
      id: string;
      status: string;
    };
    expect(anyRun.status).toBe('failed');
    void run;
  });
});

// ---- 9. 属性面板清空 when 后保存又复活 ----

describe('BUG-9 清空 when 不生效', () => {
  it('把边上的 when 清空后，buildFlow 不应从旧分支把 when 复活', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_when',
      name: 'when 图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '评审',
          branches: [
            { id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.verdict}} == 'pass'" },
            { id: 'b2', condition: '*', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    // 模拟 inspector 的 setWhen(edgeId, '')：data.when 显式置为 undefined
    const edges = canvas.edges.map((edge) =>
      edge.id === 'e-n1-b1' ? { ...edge, data: { ...edge.data, when: undefined } } : edge,
    );
    const built = buildFlow(base, bodies, canvas.nodes, edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    const b1 = n1.branches?.find((branch) => branch.id === 'b1');
    expect(b1?.when).toBeUndefined();
  });
});

// ---- 10. 崩溃窗口自愈：刚补建的 child 立刻被判"未回报" ----

describe('BUG-10 派发步崩溃自愈', () => {
  it('补建 child 后不应立刻把它们判失败再重派', () => {
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
    const { engine, db } = engineFor([flow]);
    const start = engine.startRun({ flowName: '崩溃窗口图' });
    if (!isStep(start)) throw new Error('start 失败');
    engine.completeStep({ runId: start.runId, summary: '准备完成' }); // 到派发步，child 已建
    // 模拟"推进事务已提交、child 未落库"的崩溃窗口
    db.prepare('DELETE FROM runs WHERE parent_run_id = ?').run(start.runId);
    const healed = engine.getCurrentStep({ runId: start.runId });
    if (!isStep(healed)) throw new Error(`自愈失败：${JSON.stringify(healed)}`);
    const children = db
      .prepare('SELECT id, status FROM runs WHERE parent_run_id = ? ORDER BY rowid')
      .all(start.runId) as Array<{ id: string; status: string }>;
    expect(children.map((c) => c.status)).toEqual(['running']);
    expect(healed.note ?? '').not.toContain('重派');
  });
});

// ---- 11. maxSteps 在"汇聚自动推进"路径上不生效 ----

describe('BUG-11 run 级步数上限', () => {
  it('subagent 自动汇聚回环也不能绕过 maxSteps', () => {
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
    const { engine, db } = engineFor([flow]);
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
    expect(run.status).toBe('failed');
    expect(run.steps_used).toBeGreaterThan(3); // 已经超过上限才被发现
  });
});

// ---- 14. 入口 fan-out 的 max 截断没有被记录 ----

describe('BUG-14 入口 fan-out 的截断记录', () => {
  it('入口派发按 max 截断时也要落 dispatched 轨迹/提示（铁律：不静默截断）', () => {
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
    const { engine, db } = engineFor([flow]);
    const start = engine.startRun({ flowName: '入口截断图', inputs: { modules: ['a', 'b', 'c'] } });
    if (!isStep(start)) throw new Error(`start 失败：${JSON.stringify(start)}`);
    expect(start.step.children).toHaveLength(1);
    const dispatched = db
      .prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND node_id = 'n_sub' AND status = 'dispatched'")
      .get(start.runId) as { c: number };
    expect(dispatched.c).toBe(1);
    expect(start.note ?? '').toContain('截断');
  });
});

// ---- 13. 子 Agent 配置的 payload 字段提示永远为空 ----

describe('BUG-13 配置的 payload 字段提示', () => {
  it('配置的 run 都是 child run，payloadFieldsOf 的 parent_run_id IS NULL 过滤会把它们全排除', () => {
    const db = openMemoryDb();
    const snapshot = JSON.stringify({ rootFlowId: 'cfg', agents: [], flows: { cfg: { id: 'cfg', name: '配置', entry: 'p1', nodes: [{ id: 'p1', type: 'prompt', instruction: 'x', next: 'p2' }, { id: 'p2', type: 'end', outcome: 'success' }] } } });
    db.prepare('INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?)').run('h', snapshot, 'now');
    db.prepare(
      `INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node, status, steps_used, created_at, last_activity)
       VALUES ('run_root', NULL, 'run_root', 'main', 'h', 'm1', 'm1', 'running', 1, 'now', 'now')`,
    ).run();
    db.prepare(
      `INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node, status, steps_used, created_at, last_activity)
       VALUES ('run_cfg', 'run_root', 'run_root', 'cfg', 'h', 'p1', 'p2', 'completed', 1, 'now', 'now')`,
    ).run();
    db.prepare(
      `INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, started_at, finished_at)
       VALUES ('run_cfg', 'p1', 1, 'completed', 'ok', '{"verdict":"pass"}', 'now', 'now')`,
    ).run();
    const withParentFilter = db
      .prepare(
        `SELECT ne.node_id, ne.payload FROM node_executions ne JOIN runs r ON r.id = ne.run_id
         WHERE r.flow_id = 'cfg' AND r.parent_run_id IS NULL AND ne.status = 'completed'`,
      )
      .all() as unknown[];
    const withoutParentFilter = db
      .prepare(
        `SELECT ne.node_id, ne.payload FROM node_executions ne JOIN runs r ON r.id = ne.run_id
         WHERE r.flow_id = 'cfg' AND ne.status = 'completed'`,
      )
      .all() as unknown[];
    expect({ withParentFilter: withParentFilter.length, withoutParentFilter: withoutParentFilter.length }).toEqual({
      withParentFilter: 0,
      withoutParentFilter: 1,
    });
    db.close();
  });
});

// ---- 15. 非法 DSL 形状让校验器抛 TypeError（不是硬拒） ----

describe('BUG-15 校验器对畸形输入的健壮性', () => {
  it('nodes 里有 null / branches 不是数组时，validateFlow 应返回 errors 而不是抛异常', () => {
    const base = { id: 'f_bad_shape', name: '畸形图', entry: 'n1' };
    const cases: unknown[] = [
      { ...base, nodes: [null] },
      { ...base, nodes: [{ id: 'n1', type: 'prompt', instruction: 'x', branches: 'oops' }] },
      { ...base, nodes: [{ id: 'n1', type: 'prompt', instruction: 'x', branches: [{ id: 'b', condition: 'x', to: 'n1', when: 42 }] }] },
    ];
    const outcomes = cases.map((flow) => {
      try {
        const result = validateFlow(flow as Flow);
        return result.ok === false ? 'rejected' : 'accepted';
      } catch (error) {
        return `threw:${(error as Error).name}`;
      }
    });
    expect(outcomes).toEqual(['rejected', 'rejected', 'rejected']);
  });
});

// ---- 16. 派发轨迹让面板"已走路径"把一轮算成两圈，并一直显示进行中 ----

describe('BUG-16 面板已走路径的派发行', () => {
  it('fan-out 节点完成一轮后，路径条不应显示 ×2 / running', async () => {
    const { getRunDetail } = await import('../shared/src/sql.js');
    const { buildPath } = await import('../shared/src/progress.js');
    const flow: Flow = {
      id: 'f_path',
      name: '路径图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '列模块', next: 'n_sub' },
        {
          id: 'n_sub',
          type: 'subagent',
          extraPrompt: '查 {{item}}',
          mode: 'inline',
          fanOut: { from: '{{n1.payload.modules}}' },
          next: 'n_end',
        },
        { id: 'n_end', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = engineFor([flow]);
    const start = engine.startRun({ flowName: '路径图' });
    if (!isStep(start)) throw new Error('start 失败');
    const disp = engine.completeStep({ runId: start.runId, summary: '模块定了', payload: { modules: ['a'] } });
    if (!isStep(disp) || disp.step.children === undefined) throw new Error('应到派发步');
    engine.completeStep({ childToken: disp.step.children[0]!.childToken, summary: 'a 完成' });
    engine.getCurrentStep({ runId: start.runId }); // 汇聚并推进到 n_end
    const detail = getRunDetail(db, start.runId);
    if (detail === undefined) throw new Error('详情缺失');
    const step = buildPath(detail).find((item) => item.nodeId === 'n_sub');
    expect(step === undefined ? [] : [step.count, step.statuses]).toEqual([1, ['completed']]);
  });
});

// ---- 17. 普通节点：when 都不命中时应自动走 default（设计 §7.3） ----

describe('BUG-17 when 不命中 + default', () => {
  it('when 不命中、只剩 default 时，complete_step 不带 branchId 也应自动走 default', () => {
    const flow: Flow = {
      id: 'f_when_default',
      name: 'when 兜底图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '评审',
          branches: [
            { id: 'pass', condition: '通过', to: 'n_ok', when: "{{n1.payload.verdict}} == 'pass'" },
            { id: 'fallback', condition: '*', to: 'n_fail' },
          ],
        },
        { id: 'n_ok', type: 'end', outcome: 'success' },
        { id: 'n_fail', type: 'end', outcome: 'fail' },
      ],
    };
    const { engine } = engineFor([flow]);
    const start = engine.startRun({ flowName: 'when 兜底图' });
    if (!isStep(start)) throw new Error('start 失败');
    const next = engine.completeStep({ runId: start.runId, summary: '没通过', payload: { verdict: 'fail' } });
    expect('finished' in next && next.outcome === 'fail').toBe(true);
  });
});

// ---- 18. 单出边把 branches 降级成 next，丢 when/condition/outlet ----

describe('BUG-18 单出边降级', () => {
  it('只有一个分支（带 when）的节点，画布往返后应保留 branches', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_single_branch',
      name: '单分支图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '评审',
          branches: [{ id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.verdict}} == 'pass'" }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const built = buildFlow(base, bodies, canvas.nodes, canvas.edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    expect({ branches: n1.branches, next: n1.next }).toEqual({
      branches: [{ id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.verdict}} == 'pass'" }],
      next: undefined,
    });
  });

  it('两条分支删掉一条后保存，剩下的分支不应被降级成 next', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_two_to_one',
      name: '两分支图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '评审',
          branches: [
            { id: 'b1', condition: '通过', to: 'n2', when: "{{n1.payload.verdict}} == 'pass'" },
            { id: 'b2', condition: '*', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const edges = canvas.edges.filter((edge) => edge.id !== 'e-n1-b2');
    const built = buildFlow(base, bodies, canvas.nodes, edges);
    const n1 = built.nodes.find((node) => node.id === 'n1')!;
    expect(n1.next).toBeUndefined();
    expect(n1.branches?.[0]?.when).toBe("{{n1.payload.verdict}} == 'pass'");
  });

  it('卡点只有一条无 outlet 的分支时，round-trip 不应变成 next（否则未连线选项也被放行）', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_gate_single',
      name: '单分支卡点',
      entry: 'g',
      nodes: [
        {
          id: 'g',
          type: 'gate',
          question: '选？',
          options: [
            { id: 'o1', label: '继续' },
            { id: 'o2', label: '终止' },
          ],
          branches: [{ id: 'o1', condition: '继续', to: 'n2' }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const canvas = canvasOf(base);
    const bodies = Object.fromEntries(base.nodes.map((node) => [node.id, node]));
    const built = buildFlow(base, bodies, canvas.nodes, canvas.edges);
    const g = built.nodes.find((node) => node.id === 'g')!;
    expect(g.next).toBeUndefined();
    expect(g.branches?.length).toBe(1);
  });
});

// ---- 19. 第 1 路条件清空被强改成默认分支 ----

describe('BUG-19 清空条件的不一致', () => {
  it('两路条件都清空时，不应一路变 * 一路报错', async () => {
    const { buildFlow, canvasOf } = await import('../dsh-plugin/src/editor/model.js');
    const base: Flow = {
      id: 'f_clear_cond',
      name: '清空条件图',
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
    const conditions = (n1.branches ?? []).map((branch) => branch.condition);
    const result = validateFlow(built);
    expect({ conditions, errors: result.errors.map((e) => e.code) }).toEqual({
      conditions: ['', ''],
      errors: ['E_EMPTY_CONDITION', 'E_EMPTY_CONDITION'],
    });
  });
});

// ---- 20. 同一会话两个活跃 run：complete_step 只认最新的一个 ----

describe('BUG-20 同会话多活跃 run', () => {
  it('同一 hostSession 起两个 run 后，旧 run 的 complete_step 会打到新 run 上', () => {
    const flowA: Flow = {
      id: 'f_multi_a',
      name: '流程A',
      entry: 'a1',
      nodes: [
        { id: 'a1', type: 'prompt', instruction: 'A 第一步', next: 'a2' },
        { id: 'a2', type: 'end', outcome: 'success' },
      ],
    };
    const flowB: Flow = {
      id: 'f_multi_b',
      name: '流程B',
      entry: 'b1',
      nodes: [
        { id: 'b1', type: 'prompt', instruction: 'B 第一步', next: 'b2' },
        { id: 'b2', type: 'end', outcome: 'success' },
      ],
    };
    const { engine, db } = engineFor([flowA, flowB]);
    const a = engine.startRun({ flowName: '流程A', hostSession: 'dsh:s1' });
    if (!isStep(a)) throw new Error('start A 失败');
    const b = engine.startRun({ flowName: '流程B', hostSession: 'dsh:s1' });
    if (!isStep(b)) throw new Error('start B 失败');
    // 用户还在 A 上，但 complete_step 不带 runId（工具层也不暴露 runId）→ 解析到最新的 B
    engine.completeStep({ summary: 'A 的第一步做完了', hostSession: 'dsh:s1' });
    const aRun = db.prepare('SELECT current_node, steps_used FROM runs WHERE id = ?').get(a.runId) as {
      current_node: string;
      steps_used: number;
    };
    const bRun = db.prepare('SELECT steps_used FROM runs WHERE id = ?').get(b.runId) as { steps_used: number };
    // 期望：A 推进（current_node=a2/steps=1）、B 不动；实际：B 被推进，A 永远停在 a1
    expect({ a: aRun, bSteps: bRun.steps_used }).toEqual({ a: { current_node: 'a2', steps_used: 1 }, bSteps: 0 });
  });
});

describe('BUG-4 {{artifacts}} 插值', () => {
  it('不带 key 的 {{artifacts}} 不应渲染成 null', () => {
    const flow: Flow = {
      id: 'f_art',
      name: '产物图',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: '产出设计', next: 'n2' },
        { id: 'n2', type: 'prompt', instruction: '汇总：{{artifacts}}', next: 'n3' },
        { id: 'n3', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = engineFor([flow]);
    const start = engine.startRun({ flowName: '产物图' });
    if (!isStep(start)) throw new Error('start 失败');
    const next = engine.completeStep({
      runId: start.runId,
      summary: '设计好了',
      artifacts: [{ key: 'design', path: 'docs/design.md' }],
    });
    if (!isStep(next)) throw new Error('应到下一步');
    expect(next.step.instruction).not.toContain('{{artifacts}}');
    expect(next.step.instruction).not.toBe('汇总：null');
  });
});

// ---- 5. 图 id 未做字符集校验：flows/*.json 镜像可写到目录外 ----

describe('BUG-5 图 id 路径穿越', () => {
  it('id 含 ../ 时应被校验硬拒，而不是把镜像写到 flows 目录之外', () => {
    const db = openMemoryDb();
    const dir = path.join(tmpHome, 'flows-jail');
    const flow: Flow = {
      id: '../escaped',
      name: '穿越图',
      entry: 'n1',
      nodes: [{ id: 'n1', type: 'end', outcome: 'success' }],
    };
    const validation = validateFlow(flow);
    const outside = path.join(dir, '..', 'escaped.json');
    if (validation.ok) saveFlow(db, flow, dir); // 模拟 Agent 工具 create 的落库路径
    expect({ validationOk: validation.ok, escaped: fs.existsSync(outside) }).toEqual({
      validationOk: false,
      escaped: false,
    });
    db.close();
  });
});

// ---- 6. 卡点分支 outlet 指向不存在的选项 ----

describe('BUG-6 卡点 outlet 校验', () => {
  it('outlet 指向不存在的选项时应在保存前报硬错（当前只报选项未连线警告）', () => {
    const flow: Flow = {
      id: 'f_bad_outlet',
      name: '错出口卡点',
      entry: 'g',
      nodes: [
        {
          id: 'g',
          type: 'gate',
          question: '选哪个？',
          options: [
            { id: 'o1', label: '甲' },
            { id: 'o2', label: '乙' },
          ],
          branches: [
            { id: 'b1', condition: '甲', to: 'e_ok', outlet: 'o9' },
            { id: 'b2', condition: '乙', to: 'e_ok', outlet: 'o2' },
          ],
        },
        { id: 'e_ok', type: 'end', outcome: 'success' },
      ],
    };
    const result = validateFlow(flow);
    // 现状：只有 W_GATE_OPTION_UNWIRED 警告，没有针对 outlet 指向不存在选项的硬拒
    expect(result.errors.map((e) => e.code)).toContain('E_BAD_OUTLET');
  });

  it('后果证明：该图能保存，但人工选「甲」时直接判 run 失败', () => {
    const flow: Flow = {
      id: 'f_bad_outlet2',
      name: '错出口卡点2',
      entry: 'g',
      nodes: [
        {
          id: 'g',
          type: 'gate',
          question: '选哪个？',
          options: [
            { id: 'o1', label: '甲' },
            { id: 'o2', label: '乙' },
          ],
          branches: [
            { id: 'b1', condition: '甲', to: 'e_ok', outlet: 'o9' },
            { id: 'b2', condition: '乙', to: 'e_ok', outlet: 'o2' },
          ],
        },
        { id: 'e_ok', type: 'end', outcome: 'success' },
      ],
    };
    const { engine } = engineFor([flow]);
    const start = engine.startRun({ flowName: '错出口卡点2' });
    if (!isStep(start)) throw new Error('start 失败');
    const answered = engine.answerGate({ runId: start.runId, optionId: 'o1' }, 'panel');
    expect('finished' in answered && answered.outcome === 'fail').toBe(true); // 现状：选「甲」直接判失败
  });
});

