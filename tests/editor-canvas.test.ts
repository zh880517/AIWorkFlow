// 画布映射的纯逻辑：分支出口排序、入口标记、卡点 outlet/condition 落库规则。
import { describe, expect, it } from 'vitest';
import {
  bindGateTarget,
  buildFlow,
  canvasOf,
  spreadSourceHandles,
  type CanvasEdge,
  type CanvasNode,
} from '../dsh-plugin/src/editor/model.js';

const node = (id: string, kind: 'prompt' | 'gate' | 'end', extra: Record<string, unknown> = {}) =>
  ({ id, type: kind, title: id, ...extra }) as never;
const canvasNode = (id: string, kind: string): CanvasNode => ({
  id,
  type: 'wf',
  position: { x: 0, y: 0 },
  data: { title: id, kind: kind as never, detail: '', isEntry: false },
});
const edge = (id: string, source: string, target: string): CanvasEdge => ({ id, source, target, data: {} });

describe('spreadSourceHandles：一个分支一个出口', () => {
  it('同一节点的出边按顺序挂到 out-0 / out-1，其他节点独立计数', () => {
    const edges = [edge('e1', 'a', 'x'), edge('e2', 'b', 'y'), edge('e3', 'a', 'z')];
    const shown = spreadSourceHandles(edges);
    expect(shown.map((item) => item.sourceHandle)).toEqual(['out-0', 'out-0', 'out-1']);
  });

  it('已经排好时返回原数组（避免每帧重建边）', () => {
    const edges = [edge('e1', 'a', 'x'), edge('e2', 'a', 'z')].map((item, index) => ({
      ...item,
      sourceHandle: `out-${index}`,
    }));
    expect(spreadSourceHandles(edges)).toBe(edges);
  });
});

describe('canvasOf / buildFlow', () => {
  it('入口标记只在 entry 节点上', () => {
    const flow = {
      id: 'f',
      name: 'f',
      entry: 'b',
      nodes: [{ id: 'a', type: 'prompt', instruction: 'x' }, { id: 'b', type: 'end', outcome: 'success' }],
    } as never;
    const nodes = canvasOf(flow).nodes;
    expect(nodes.find((item) => item.id === 'b')?.data.isEntry).toBe(true);
    expect(nodes.find((item) => item.id === 'a')?.data.isEntry).toBe(false);
  });

  it('卡点分支：显式 outlet 优先，空条件用选项文案补齐', () => {
    const bodies = {
      g: node('g', 'gate', {
        question: 'q',
        options: [
          { id: 'o1', label: '继续' },
          { id: 'o2', label: '终止' },
        ],
      }),
      a: node('a', 'end', { outcome: 'success' }),
      b: node('b', 'end', { outcome: 'fail' }),
    } as never;
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'g', target: 'a', data: { outlet: 'o2' } },
      { id: 'e2', source: 'g', target: 'b', data: { outlet: 'o1' } },
    ];
    const flow = buildFlow(
      { id: 'f', name: 'f', entry: 'g', nodes: [] } as never,
      bodies,
      [canvasNode('g', 'gate'), canvasNode('a', 'end'), canvasNode('b', 'end')],
      edges,
    );
    const gate = flow.nodes.find((item) => item.id === 'g') as { branches?: Array<{ outlet?: string; condition: string }> };
    expect(gate.branches?.map((branch) => branch.outlet)).toEqual(['o2', 'o1']);
    expect(gate.branches?.map((branch) => branch.condition)).toEqual(['终止', '继续']);
  });

  it('卡点只有一条出边但绑定了选项：仍写 branches，不写 next', () => {
    const bodies = {
      g: node('g', 'gate', {
        question: 'q',
        options: [
          { id: 'o1', label: '继续' },
          { id: 'o2', label: '终止' },
        ],
      }),
      a: node('a', 'end', { outcome: 'success' }),
    } as never;
    const flow = buildFlow(
      { id: 'f', name: 'f', entry: 'g', nodes: [] } as never,
      bodies,
      [canvasNode('g', 'gate'), canvasNode('a', 'end')],
      [{ id: 'e1', source: 'g', target: 'a', data: { outlet: 'o1' } }],
    );
    const gate = flow.nodes.find((item) => item.id === 'g') as {
      next?: string;
      branches?: Array<{ to: string; outlet?: string; condition: string }>;
    };
    expect(gate.next).toBeUndefined();
    expect(gate.branches).toHaveLength(1);
    expect(gate.branches?.[0]).toMatchObject({ to: 'a', outlet: 'o1', condition: '继续' });
  });

  it('非卡点多出边：第一路默认 *，其余保持空（交给校验器报错）', () => {
    const bodies = {
      n1: node('n1', 'prompt', { instruction: 'x' }),
      n2: node('n2', 'end', { outcome: 'success' }),
      n3: node('n3', 'end', { outcome: 'fail' }),
    } as never;
    const flow = buildFlow(
      { id: 'f', name: 'f', entry: 'n1', nodes: [] } as never,
      bodies,
      [canvasNode('n1', 'prompt'), canvasNode('n2', 'end'), canvasNode('n3', 'end')],
      [edge('e1', 'n1', 'n2'), edge('e2', 'n1', 'n3')],
    );
    const first = flow.nodes.find((item) => item.id === 'n1') as { branches?: Array<{ condition: string }> };
    expect(first.branches?.map((branch) => branch.condition)).toEqual(['*', '']);
  });
});

describe('bindGateTarget：面板里给选项挑目标节点', () => {
  it('没有绑定边时补一条，分支号顺延且带 outlet', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'a', data: { branchId: 'b1', outlet: 'o1' } }];
    const result = bindGateTarget(edges, 'g', 'o2', '终止', 'b');
    expect(result.error).toBeUndefined();
    expect(result.edges).toHaveLength(2);
    const added = result.edges[1]!;
    expect(added).toMatchObject({ source: 'g', target: 'b', label: '终止' });
    expect(added.data?.outlet).toBe('o2');
    expect(added.data?.branchId).toBe('b2');
  });

  it('画布上已经拉了同目标的线：直接认领，不再重复长一条', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'b', data: {} }];
    const result = bindGateTarget(edges, 'g', 'o2', '终止', 'b');
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.data?.outlet).toBe('o2');
    expect(result.edges[0]?.label).toBe('终止');
  });

  it('已绑定的边换目标：只改 target 和标签', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'a', data: { outlet: 'o1' } }];
    const result = bindGateTarget(edges, 'g', 'o1', '继续', 'c');
    expect(result.edges[0]).toMatchObject({ id: 'e1', target: 'c', label: '继续' });
  });

  it('选「未连线」等于删掉这条出边', () => {
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'g', target: 'a', data: { outlet: 'o1' } },
      { id: 'e2', source: 'g', target: 'b', data: { outlet: 'o2' } },
    ];
    const result = bindGateTarget(edges, 'g', 'o1', '继续', '');
    expect(result.edges.map((item) => item.id)).toEqual(['e2']);
  });

  it('同一个卡点不接受两条指向同一节点的出边', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'b', data: { outlet: 'o1' } }];
    const result = bindGateTarget(edges, 'g', 'o2', '终止', 'b');
    expect(result.error).toBeDefined();
    expect(result.edges).toBe(edges);
  });

  it('不能连回自己；无变化时返回原数组', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'b', data: { outlet: 'o2' } }];
    expect(bindGateTarget(edges, 'g', 'o2', '终止', 'g').error).toBeDefined();
    expect(bindGateTarget(edges, 'g', 'o2', '终止', 'b').edges).toBe(edges);
  });

  it('绑定后存盘：分支带 outlet，condition 用选项文案', () => {
    const bodies = {
      g: node('g', 'gate', {
        question: 'q',
        options: [
          { id: 'o1', label: '都绿了' },
          { id: 'o2', label: '有问题' },
        ],
      }),
      a: node('a', 'end', { outcome: 'success' }),
      b: node('b', 'end', { outcome: 'fail' }),
    } as never;
    let edges: CanvasEdge[] = [];
    edges = bindGateTarget(edges, 'g', 'o1', '都绿了', 'a').edges;
    edges = bindGateTarget(edges, 'g', 'o2', '有问题', 'b').edges;
    const flow = buildFlow(
      { id: 'f', name: 'f', entry: 'g', nodes: [] } as never,
      bodies,
      [canvasNode('g', 'gate'), canvasNode('a', 'end'), canvasNode('b', 'end')],
      edges,
    );
    const gate = flow.nodes.find((item) => item.id === 'g') as {
      branches?: Array<{ outlet?: string; condition: string; to: string }>;
    };
    expect(gate.branches?.map((branch) => [branch.outlet, branch.to, branch.condition])).toEqual([
      ['o1', 'a', '都绿了'],
      ['o2', 'b', '有问题'],
    ]);
  });
});
