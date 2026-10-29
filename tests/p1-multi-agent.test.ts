// P1 多 Agent 协作：角色/线程、子结果回传、subagent 分支、产物总线、when、inputs
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb, type TestDb } from './support/db.js';
import { FlowStore } from './support/flowStore.js';
import { ExecutionEngine, type StepResult, type SelfHealError } from '../shared/src/engine.js';
import type { Flow } from '../shared/src/types.js';
import { validateFlow } from '../shared/src/validate.js';
import { getRunDetail } from '../shared/src/sql.js';
import { evaluateWhen, parseWhen } from '../shared/src/when.js';

let tmpHome: string;
let db: TestDb;
let store: FlowStore;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-p1-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
  db = openMemoryDb();
  store = new FlowStore(db, path.join(tmpHome, 'flows'));
});

afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function engine(): ExecutionEngine {
  return new ExecutionEngine({ db, resolveFlow: (name) => store.resolve(name) });
}

function collaborationFlow(): Flow {
  return {
    id: 'f_p1_team',
    name: 'P1 设计评审回路',
    entry: 'design',
    agents: [
      { id: 'designer', name: '设计 Agent', charter: '负责设计方案，按评审意见修订', produces: ['design'] },
      { id: 'developer', name: '开发 Agent', charter: '按设计实现代码', consumes: ['design'] },
    ],
    nodes: [
      {
        id: 'design',
        type: 'subagent',
        mode: 'inline',
        role: 'designer',
        thread: 'role',
        extraPrompt: '为 {{inputs.feature}} 出设计案，产出 design 产物',
        reportHint: 'payload 带 verdict（pass/fail）与 issues；产物 key=design',
        iterationLimit: 5,
        onLimitExceeded: 'end',
        branches: [
          { id: 'design_pass', condition: '设计通过', when: "{{design.payload.verdict}} == 'pass'", to: 'dev' },
          { id: 'design_fix', condition: '*', to: 'design_fix' },
        ],
      },
      {
        id: 'design_fix',
        type: 'prompt',
        instruction: '按评审意见修订设计：{{design.payload.issues}}',
        next: 'design',
        iterationLimit: 5,
        onLimitExceeded: 'end',
      },
      {
        id: 'dev',
        type: 'subagent',
        mode: 'inline',
        role: 'developer',
        thread: 'role',
        extraPrompt: '按 {{artifacts.design.path}} 实现；设计版本 v{{artifacts.design.version}}',
        next: 'end',
      },
      { id: 'end', type: 'end', outcome: 'success' },
    ],
  };
}

function asStep(result: unknown): StepResult {
  expect((result as SelfHealError).error).toBeUndefined();
  return result as StepResult;
}

describe('when 解析与判定', () => {
  it('解析单比较并求值', () => {
    const parsed = parseWhen("{{review.payload.verdict}} == 'pass'");
    expect(parsed.ok).toBe(true);
    expect(evaluateWhen("{{review.payload.verdict}} == 'pass'", (expr) => (expr === 'review.payload.verdict' ? 'pass' : undefined)).value).toBe(true);
    expect(evaluateWhen("{{review.payload.issues}} truthy", () => 2).value).toBe(true);
    expect(evaluateWhen("{{review.payload.verdict}} in 'design,dev'", () => 'dev').value).toBe(true);
    expect(evaluateWhen("{{n.payload.round}} >= 2", () => 3).value).toBe(true);
    expect(evaluateWhen("{{n.payload.flag}} empty", () => '').value).toBe(true);
  });

  it('拒绝坏语法', () => {
    expect(parseWhen('verdict == pass').ok).toBe(false);
    expect(parseWhen("{{verdict}} = 'pass'").ok).toBe(false);
    expect(parseWhen("{{a}} == pass").ok).toBe(false);
  });
});

describe('P1 引擎', () => {
  it('角色/线程/inputs 进入 preamble 与子任务指令；子 payload 回传并自动路由', () => {
    const flow = collaborationFlow();
    const saved = store.save(flow);
    expect(saved.ok).toBe(true);
    const e = engine();
    const start = asStep(e.startRun({ flowName: flow.id, inputs: { feature: '登录' } }));
    expect(start.step.children).toHaveLength(1);
    const first = start.step.children![0]!;
    expect(first.extraPrompt).toContain('登录');
    expect(first.preamble).toContain('设计 Agent');
    expect(first.preamble).toContain('role=designer');
    expect(first.preamble).toContain('第 1 轮');

    // child 领步：能知道自己是谁
    const childStep = asStep(e.getCurrentStep({ childToken: first.childToken }));
    expect(childStep.step.role).toBe('designer');
    expect(childStep.step.thread).toBe('role:designer');
    expect(childStep.step.turn).toBe(1);

    // 第一轮 fail → default 自动回 design_fix
    const childDone = e.completeStep({
      childToken: first.childToken,
      summary: '设计 v1',
      payload: { verdict: 'fail', issues: '缺异常流' },
      artifacts: [{ key: 'design', path: 'docs/design.md', summary: '设计 v1' }],
    });
    expect((childDone as { finished?: boolean }).finished).toBe(true);

    const afterFail = asStep(e.getCurrentStep({ runId: start.runId }));
    expect(afterFail.step.nodeId).toBe('design_fix');
    expect(afterFail.step.instruction).toContain('缺异常流');

    // 修完再派设计：线程摘要带上第一轮
    const fix = asStep(e.completeStep({ runId: start.runId, summary: '设计已修', payload: {} }));
    expect(fix.step.nodeId).toBe('design');
    const second = fix.step.children![0]!;
    expect(second.preamble).toContain('第 2 轮');
    expect(second.preamble).toContain('设计 v1');

    // 第二轮 pass → 自动走 dev；产物路径/版本插值到子任务
    e.completeStep({
      childToken: second.childToken,
      summary: '设计 v2',
      payload: { verdict: 'pass' },
      artifacts: [{ key: 'design', path: 'docs/design-v2.md', summary: '设计 v2' }],
    });
    const dev = asStep(e.getCurrentStep({ runId: start.runId }));
    expect(dev.step.nodeId).toBe('dev');
    expect(dev.step.children![0]!.extraPrompt).toContain('docs/design-v2.md');
    expect(dev.step.children![0]!.extraPrompt).toContain('v2');
  });

  it('产物按 key 版本递增，lookup 取最新版', () => {
    const run = db
      .prepare('SELECT id, root_run_id FROM runs WHERE flow_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get('f_p1_team') as { id: string; root_run_id: string };
    const rows = db
      .prepare('SELECT key, version, path FROM run_artifacts WHERE root_run_id = ? AND key = ? ORDER BY version')
      .all(run.root_run_id, 'design') as Array<{ key: string; version: number; path: string }>;
    expect(rows.map((row) => row.version)).toEqual([1, 2]);
    expect(rows[1]!.path).toBe('docs/design-v2.md');
  });

  it('只读监控详情带角色/线程/派发轮次/产物', () => {
    const run = db
      .prepare('SELECT id, root_run_id FROM runs WHERE flow_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get('f_p1_team') as { id: string; root_run_id: string };
    const detail = getRunDetail(db, run.id);
    expect(detail).toBeDefined();
    expect(detail!.artifacts.map((item) => `${item.key}@${item.version}`)).toEqual(['design@1', 'design@2']);
    const child = db
      .prepare('SELECT id FROM runs WHERE parent_run_id = ? AND parent_node = ? ORDER BY parent_iteration LIMIT 1')
      .get(run.id, 'design') as { id: string };
    const childDetail = getRunDetail(db, child.id);
    expect(childDetail).toMatchObject({ role: 'designer', threadId: 'role:designer', parentIteration: 1 });
    expect(childDetail!.artifacts).toHaveLength(2);
  });

  it('普通节点上的 when 命中后不用 branchId', () => {
    const flow: Flow = {
      id: 'f_when_prompt',
      name: 'when prompt',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: '判定',
          branches: [
            { id: 'yes', condition: '通过', when: "{{n1.payload.ok}} == 'yes'", to: 'ok' },
            { id: 'no', condition: '*', to: 'bad' },
          ],
        },
        { id: 'ok', type: 'end', outcome: 'success' },
        { id: 'bad', type: 'end', outcome: 'fail' },
      ],
    };
    expect(store.save(flow).ok).toBe(true);
    const e = engine();
    const start = asStep(e.startRun({ flowName: flow.id }));
    const done = e.completeStep({ runId: start.runId, summary: '通过', payload: { ok: 'yes' } });
    expect((done as { finished?: boolean; outcome?: string }).outcome).toBe('success');
  });

  it('subagent 的自然语言分支会停在路由步，选 branchId 后推进', () => {
    const flow: Flow = {
      id: 'f_route_manual',
      name: 'route manual',
      entry: 'sub',
      nodes: [
        {
          id: 'sub',
          type: 'subagent',
          mode: 'inline',
          extraPrompt: '评审',
          branches: [
            { id: 'pass', condition: '通过', to: 'ok' },
            { id: 'fix', condition: '打回', to: 'fix' },
          ],
        },
        { id: 'fix', type: 'prompt', instruction: '修', next: 'ok' },
        { id: 'ok', type: 'end', outcome: 'success' },
      ],
    };
    expect(store.save(flow).ok).toBe(true);
    const e = engine();
    const start = asStep(e.startRun({ flowName: flow.id }));
    const token = start.step.children![0]!.childToken;
    e.completeStep({ childToken: token, summary: '评审完成', payload: { verdict: 'pass' } });
    const route = asStep(e.getCurrentStep({ runId: start.runId }));
    expect(route.step.nodeId).toBe('sub');
    expect(route.step.childResults?.[0]?.payload).toMatchObject({ verdict: 'pass' });
    expect(route.step.branches?.map((b) => b.id)).toEqual(['pass', 'fix']);
    const next = e.completeStep({ runId: start.runId, branchId: 'pass', summary: '选通过' });
    expect((next as { finished?: boolean }).finished).toBe(true);
    expect((next as { outcome?: string }).outcome).toBe('success');
  });

  it('role/thread/when/artifacts 的校验错误码', () => {
    const flow = collaborationFlow();
    const ghostFlow = {
      ...flow,
      nodes: flow.nodes.map((node, index) => (index === 0 ? { ...node, role: 'ghost' } : node)),
    } as Flow;
    const badRole = validateFlow(ghostFlow);
    expect(badRole.errors.map((e) => e.code)).toContain('E_BAD_ROLE');

    const badWhen: Flow = {
      id: 'f_bad_when',
      name: 'bad when',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'prompt', instruction: 'x', branches: [{ id: 'b', condition: 'c', when: 'verdict == pass', to: 'n2' }] },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    expect(validateFlow(badWhen).errors.map((e) => e.code)).toContain('E_BAD_WHEN');

    const threadNoRole: Flow = {
      id: 'f_thread_no_role',
      name: 'thread no role',
      entry: 's',
      nodes: [{ id: 's', type: 'subagent', mode: 'inline', extraPrompt: 'x', thread: 'role', next: 'e' }, { id: 'e', type: 'end', outcome: 'success' }],
    };
    expect(validateFlow(threadNoRole).errors.map((e) => e.code)).toContain('E_THREAD_NEEDS_ROLE');

    const badKey: Flow = {
      id: 'f_bad_key',
      name: 'bad key',
      entry: 's',
      nodes: [{ id: 's', type: 'subagent', mode: 'inline', extraPrompt: 'x', produces: ['design-v1'], next: 'e' }, { id: 'e', type: 'end', outcome: 'success' }],
    };
    expect(validateFlow(badKey).errors.map((e) => e.code)).toContain('E_ARTIFACT_KEY');
  });

  it('迁移到 v9：runs 新列、parent_iteration 与 run_artifacts 表都在', () => {
    const columns = db.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>;
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['role', 'thread_id', 'inputs', 'parent_iteration']),
    );
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'run_artifacts'")
      .get() as { name: string } | undefined;
    expect(table?.name).toBe('run_artifacts');
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBeGreaterThanOrEqual(9);
  });
});
