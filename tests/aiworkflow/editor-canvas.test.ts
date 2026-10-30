// 画布映射的纯逻辑：分支出口排序、入口标记、卡点 outlet/condition 落库规则。
import { describe, expect, it } from 'vitest';
import {
  buildFlow,
  canvasOf,
  makeReviewSubflow,
  makeSubflow,
  makeTestSubflow,
  spreadSourceHandles,
  subflowPreview,
  summarizeNode,
  TEMPLATES,
  type CanvasEdge,
  type CanvasNode,
} from '../../plugins/aiworkflow/src/editor/model.js';
import { validateFlow } from '../../shared/src/validate.js';
import type { GateNode, SubagentNode } from '../../shared/src/types.js';

const node = (id: string, kind: 'prompt' | 'gate' | 'end', extra: Record<string, unknown> = {}) =>
  ({ id, type: kind, title: id, ...extra }) as never;
const canvasNode = (id: string, kind: string): CanvasNode => ({
  id,
  type: 'wf',
  position: { x: 0, y: 0 },
  data: { title: id, kind: kind as never, detail: '', isEntry: false, outlets: [] },
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

describe('内嵌子图：缩略图与保存往返', () => {
  it('makeSubflow 生成最小合法子图，入口/缩略图计数正确', () => {
    const sub = makeSubflow('设计子图');
    expect(sub.name).toBe('设计子图');
    expect(sub.entry).toBe('s1');
    expect(sub.nodes).toHaveLength(2);
    const preview = subflowPreview(sub);
    expect(preview.count).toBe(2);
    expect(preview.boxes).toHaveLength(2);
    expect(preview.boxes.find((box) => box.entry)?.id).toBe('s1');
    expect(preview.lines).toHaveLength(1);
  });

  it('canvasOf 给 subflow 节点挂缩略图，buildFlow 保留 subflow 与内部布局', () => {
    const sub = makeSubflow('内嵌');
    const flow = {
      id: 'f',
      name: 'f',
      entry: 'n1',
      nodes: [
        { id: 'n1', type: 'subagent', extraPrompt: 'x', mode: 'subflow', subflow: sub, next: 'n2' },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    } as never;
    const canvas = canvasOf(flow);
    const card = canvas.nodes.find((item) => item.id === 'n1');
    expect(card?.data.subflow?.count).toBe(2);
    expect(card?.data.subflow?.entry).toBe('s1');

    const bodies = Object.fromEntries((flow as never as { nodes: Array<{ id: string }> }).nodes.map((item) => [item.id, item]));
    const built = buildFlow(flow, bodies as never, canvas.nodes, canvas.edges);
    const node = built.nodes.find((item) => item.id === 'n1') as {
      subflow?: { name?: string; entry: string; nodes: unknown[]; _ui?: { positions?: Record<string, unknown> } };
    };
    expect(node.subflow?.name).toBe('内嵌');
    expect(node.subflow?.entry).toBe('s1');
    expect(node.subflow?.nodes).toHaveLength(2);
    expect(node.subflow?._ui?.positions).toBeDefined();
  });
});

describe('回路模板', () => {
  it('评审/测试模板都是带 loopId + maxRounds 的合法内嵌子图', () => {
    for (const template of TEMPLATES) {
      const sub = template.subflow();
      expect(sub.nodes.length).toBeGreaterThanOrEqual(3);
      const controller = sub.nodes.find((item) => item.maxRounds !== undefined);
      expect(controller?.loopId).toBeDefined();
      expect(controller?.onLimitExceeded).toBeDefined();
      expect(sub.nodes.filter((item) => item.loopId === controller?.loopId).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('评审回路子图能通过完整校验', () => {
    const sub = makeReviewSubflow();
    const result = validateFlow({
      id: 'f_template',
      name: '模板图',
      entry: 'agent',
      nodes: [
        {
          id: 'agent',
          type: 'subagent',
          title: '评审回路',
          extraPrompt: '按评审标准检查',
          mode: 'subflow',
          subflow: sub,
          next: 'done',
        },
        { id: 'done', type: 'end', outcome: 'success' },
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('测试回路子图能通过完整校验', () => {
    const sub = makeTestSubflow();
    const result = validateFlow({
      id: 'f_template_test',
      name: '模板图',
      entry: 'agent',
      nodes: [
        {
          id: 'agent',
          type: 'subagent',
          title: '测试回路',
          extraPrompt: '按验收标准测试',
          mode: 'subflow',
          subflow: sub,
          next: 'done',
        },
        { id: 'done', type: 'end', outcome: 'success' },
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('summarizeNode：属性面板概览 chip', () => {
  const subagent = (extra: Partial<SubagentNode> = {}): SubagentNode => ({
    id: 'n2',
    type: 'subagent',
    title: '评审',
    extraPrompt: '',
    mode: 'inline',
    ...extra,
  });

  it('inline 且没有运行时配置时不产生 chip', () => {
    expect(summarizeNode(subagent(), { edgeCount: 1 })).toEqual([]);
  });

  it('按固定顺序产出角色/线程、产物、子图、并行、回路、分支', () => {
    const chips = summarizeNode(
      subagent({
        role: 'review',
        thread: 'role',
        produces: ['design'],
        consumes: ['issues'],
        subflow: makeSubflow('评审子图'),
        fanOut: { count: 3 },
        loopId: 'review-loop',
        maxRounds: 3,
        onLimitExceeded: 'n9',
      }),
      { edgeCount: 2 },
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      'review · 线程 role',
      'design → issues',
      '子图 2 节点',
      '并行 3 项',
      '回路 review-loop ≤3 → n9',
      '2 条分支',
    ]);
    expect(chips.find((chip) => chip.key === 'subflow')?.action).toBe('open-subflow');
    expect(chips.find((chip) => chip.key === 'loop')?.group).toBe('loop');
    expect(chips.find((chip) => chip.key === 'artifacts')?.group).toBe('contract');
  });

  it('线程 new 视为默认值，不占 chip；flowRef 单独显示引用目标', () => {
    const chips = summarizeNode(subagent({ thread: 'new', mode: 'flowRef', flowRef: 'f_other' }));
    expect(chips.map((chip) => chip.label)).toEqual(['引用 f_other']);
    expect(
      summarizeNode(subagent({ mode: 'flowRef', flowRef: 'f_other' }), {
        flowNames: { f_other: '评审配置' },
      }).map((chip) => chip.label),
    ).toEqual(['引用 评审配置']);
  });

  it('只有迭代上限时用「迭代」而不是「回路」表述', () => {
    expect(summarizeNode(subagent({ iterationLimit: 5 })).map((chip) => chip.label)).toEqual(['迭代 ≤5']);
  });

  it('卡点的出口数来自选项，而不是出边', () => {
    const gate: GateNode = {
      id: 'g1',
      type: 'gate',
      question: '继续吗',
      options: [
        { id: 'o1', label: '继续' },
        { id: 'o2', label: '终止' },
      ],
    };
    expect(summarizeNode(gate, { edgeCount: 1 }).map((chip) => chip.label)).toEqual(['2 个选项']);
  });

  it('end 节点没有可展示的运行时配置', () => {
    expect(summarizeNode({ id: 'e1', type: 'end', outcome: 'success' }, { edgeCount: 0 })).toEqual([]);
  });
});

