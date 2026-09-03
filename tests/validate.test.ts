import { describe, expect, it } from 'vitest';
import { validateFlow } from '../src/core/validate.js';
import type { Flow, FlowNode } from '../src/core/types.js';

function flow(nodes: FlowNode[], entry = 'n1'): Flow {
  return { id: 'f_test', name: '测试图', entry, nodes };
}

const prompt = (id: string, instruction = '做点事', extra: Partial<FlowNode> = {}): FlowNode =>
  ({ id, type: 'prompt', instruction, ...extra }) as FlowNode;

const end = (id: string, outcome: 'success' | 'fail' = 'success'): FlowNode =>
  ({ id, type: 'end', outcome }) as FlowNode;

describe('校验器：合法图', () => {
  it('直线流程通过且无警告', () => {
    const result = validateFlow(
      flow([prompt('n1', undefined, { next: 'n2' }), prompt('n2', undefined, { next: 'n3' }), end('n3')]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('隐式 end（无 branches 且无 next）是合法终点', () => {
    const result = validateFlow(flow([prompt('n1')]));
    expect(result.ok).toBe(true);
  });

  it('带 default 分支与 iterationLimit 的环合法且无警告', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: '改代码',
          iterationLimit: 3,
          onLimitExceeded: 'n_fail',
          branches: [
            { id: 'b1', condition: '测试通过', to: 'n_ok' },
            { id: 'b_default', condition: '*', to: 'n1' },
          ],
        },
        end('n_ok', 'success'),
        end('n_fail', 'fail'),
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('校验器：硬拒', () => {
  it('缺少 entry', () => {
    const result = validateFlow({ ...flow([prompt('n1')]), entry: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('E_NO_ENTRY');
  });

  it('entry 指向不存在的节点', () => {
    const result = validateFlow(flow([prompt('n1')], 'nX'));
    expect(result.errors.map((e) => e.code)).toContain('E_NO_ENTRY');
  });

  it('节点 id 重复', () => {
    const result = validateFlow(flow([prompt('n1', undefined, { next: 'n2' }), prompt('n1')]));
    expect(result.errors.map((e) => e.code)).toContain('E_DUP_NODE');
  });

  it('孤立节点（从 entry 不可达）', () => {
    const result = validateFlow(flow([prompt('n1'), prompt('n_orphan'), end('n2')]));
    // n_orphan 无边可达；n1 无出口是隐式 end，合法
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('E_UNREACHABLE');
    expect(codes).not.toContain('E_NO_TERMINATION');
  });

  it('分支指向不存在的节点', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [{ id: 'b1', condition: '*', to: 'n_ghost' }],
        },
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_BAD_REF');
  });

  it('同时声明 branches 和 next', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          next: 'n2',
          branches: [{ id: 'b1', condition: '*', to: 'n2' }],
        },
        end('n2'),
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_BOTH_BRANCHES_NEXT');
  });

  it('环无逃生出口（无法终止的路径）', () => {
    // 图中存在终点 n_end，但 n2/n3 组成的环从任何分支都出不去
    const result = validateFlow(
      flow([
        {
          id: 'n0',
          type: 'prompt',
          instruction: '入口',
          branches: [
            { id: 'b1', condition: '走终点', to: 'n_end' },
            { id: 'b2', condition: '走环', to: 'n2' },
          ],
        },
        { id: 'n2', type: 'prompt', instruction: 'a', next: 'n3' },
        {
          id: 'n3',
          type: 'prompt',
          instruction: 'b',
          branches: [
            { id: 'b1', condition: '继续', to: 'n2' },
            { id: 'b2', condition: '还是继续', to: 'n3' },
          ],
        },
        end('n_end'),
      ], 'n0'),
    );
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('E_NO_TERMINATION');
    expect(result.errors.filter((e) => e.code === 'E_NO_TERMINATION').map((e) => e.nodeId).sort()).toEqual(['n2', 'n3']);
  });

  it('全图无任何终点也硬拒', () => {
    const result = validateFlow(
      flow([
        { id: 'n1', type: 'prompt', instruction: 'a', next: 'n2' },
        {
          id: 'n2',
          type: 'prompt',
          instruction: 'b',
          branches: [
            { id: 'b1', condition: '继续', to: 'n1' },
            { id: 'b2', condition: '还是继续', to: 'n2' },
          ],
        },
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_NO_TERMINAL');
  });

  it('escape 只能靠 onLimitExceeded 时也算可终止', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: '重试',
          iterationLimit: 3,
          onLimitExceeded: 'n_fail',
          branches: [{ id: 'b1', condition: '*', to: 'n1' }],
        },
        end('n_fail', 'fail'),
      ]),
    );
    expect(result.ok).toBe(true);
  });

  it('end 节点不应有出口', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'end',
          outcome: 'success',
          next: 'n2',
        },
        end('n2'),
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_END_WITH_EXIT');
  });

  it('outcome 非法', () => {
    const result = validateFlow(flow([{ id: 'n1', type: 'end', outcome: 'oops' } as unknown as FlowNode]));
    expect(result.errors.map((e) => e.code)).toContain('E_TYPE_FIELD');
  });

  it('prompt 缺 instruction', () => {
    const result = validateFlow(flow([{ id: 'n1', type: 'prompt' } as unknown as FlowNode]));
    expect(result.errors.map((e) => e.code)).toContain('E_TYPE_FIELD');
  });

  it('gate 缺 options / option id 重复', () => {
    const gate = (options: unknown) =>
      flow([
        { id: 'n1', type: 'gate', question: '确认？', options, next: 'n2' },
        end('n2'),
      ]) as unknown as Flow;
    expect(validateFlow(gate(undefined)).errors.map((e) => e.code)).toContain('E_TYPE_FIELD');
    expect(
      validateFlow(gate([{ id: 'a', label: '是' }, { id: 'a', label: '否' }])).errors.map((e) => e.code),
    ).toContain('E_TYPE_FIELD');
  });

  it('join 缺 aggregateInstruction / waitFor 悬空', () => {
    const result = validateFlow(
      flow([
        { id: 'n1', type: 'join', waitFor: 'n_ghost' } as unknown as FlowNode,
      ]),
    );
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('E_TYPE_FIELD');
    expect(codes).toContain('E_BAD_REF');
  });

  it('subagent fanOut 同时给 from 和 count / 都不给', () => {
    const make = (fanOut: unknown) =>
      flow([
        {
          id: 'n1',
          type: 'subagent',
          extraPrompt: 'x',
          mode: 'inline',
          fanOut,
          next: 'n2',
        },
        end('n2'),
      ]) as unknown as Flow;
    expect(
      validateFlow(make({ from: '{{n0.payload.x}}', count: 3 })).errors.map((e) => e.code),
    ).toContain('E_FANOUT_SOURCE');
    expect(validateFlow(make({ max: 5 })).errors.map((e) => e.code)).toContain('E_FANOUT_SOURCE');
  });

  it('subflow 内的环无逃生出口也会硬拒', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'subagent',
          extraPrompt: 'x',
          mode: 'subflow',
          subflow: {
            entry: 's0',
            nodes: [
              {
                id: 's0',
                type: 'prompt',
                instruction: '入口',
                branches: [
                  { id: 'b1', condition: '终点', to: 's_end' },
                  { id: 'b2', condition: '进环', to: 's1' },
                ],
              },
              { id: 's1', type: 'prompt', instruction: 'a', next: 's2' },
              {
                id: 's2',
                type: 'prompt',
                instruction: 'b',
                branches: [
                  { id: 'b1', condition: '继续', to: 's1' },
                  { id: 'b2', condition: '还是继续', to: 's2' },
                ],
              },
              { id: 's_end', type: 'end', outcome: 'success' },
            ],
          },
          next: 'n2',
        },
        end('n2'),
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_NO_TERMINATION');
  });

  it('多个 default 分支', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [
            { id: 'b1', condition: '*', to: 'n2' },
            { id: 'b2', condition: '*', to: 'n2' },
          ],
        },
        end('n2'),
      ]),
    );
    expect(result.errors.map((e) => e.code)).toContain('E_MULTI_DEFAULT');
  });
});

describe('校验器：警告档（允许保存）', () => {
  it('有分支但缺 default', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [{ id: 'b1', condition: '通过', to: 'n2' }],
        },
        end('n2'),
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('W_NO_DEFAULT');
  });

  it('环上节点缺 iterationLimit', () => {
    const result = validateFlow(
      flow([
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [
            { id: 'b1', condition: '通过', to: 'n2' },
            { id: 'b_default', condition: '*', to: 'n1' },
          ],
        },
        end('n2'),
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('W_CYCLE_NO_LIMIT');
  });

  it('join 的 waitFor 指向非 fan-out 节点', () => {
    const result = validateFlow(
      flow([
        prompt('n1', 'x', { next: 'n2' }),
        { id: 'n2', type: 'join', waitFor: 'n1', aggregateInstruction: '汇总', next: 'n3' },
        end('n3'),
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('W_JOIN_NO_FANOUT');
  });
});
