// 卡点出口：一个选项一个出口（未连线的也画出来），出边挂到正确的 handle 上。
import { describe, expect, it } from 'vitest';
import { canvasOf, outletsOf, spreadSourceHandles, type CanvasEdge } from '../dsh-plugin/src/editor/model.js';

const gateBody = {
  id: 'g',
  type: 'gate',
  title: 'g',
  question: 'q',
  options: [
    { id: 'o1', label: '都绿了，收尾' },
    { id: 'o2', label: '有问题，回炉' },
    { id: 'o3', label: '新选项' },
  ],
};

describe('outletsOf：卡点按选项声明出口', () => {
  it('一个选项一个出口，key 用选项 id', () => {
    expect(outletsOf(gateBody as never)).toEqual([
      { key: 'o1', label: '都绿了，收尾' },
      { key: 'o2', label: '有问题，回炉' },
      { key: 'o3', label: '新选项' },
    ]);
  });

  it('非卡点不声明出口（按出边数量动态画）', () => {
    expect(outletsOf({ id: 'p', type: 'prompt', instruction: 'x' } as never)).toEqual([]);
  });

  it('canvasOf 把选项带进节点数据，撤销/重开都能画出未连线的出口', () => {
    const flow = {
      id: 'f',
      name: 'f',
      entry: 'g',
      nodes: [gateBody, { id: 'a', type: 'end', outcome: 'success' }],
    } as never;
    const nodes = canvasOf(flow).nodes;
    expect(nodes.find((item) => item.id === 'g')?.data.outlets).toHaveLength(3);
    expect(nodes.find((item) => item.id === 'a')?.data.outlets).toEqual([]);
  });
});

describe('spreadSourceHandles：出边挂到声明过的出口', () => {
  const outletKeys = new Map<string, string[]>([['g', ['o1', 'o2', 'o3']]]);

  it('按 outlet 找出口，而不是按边的顺序', () => {
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'g', target: 'b', data: { outlet: 'o3' } },
      { id: 'e2', source: 'g', target: 'a', data: { outlet: 'o1' } },
    ];
    expect(spreadSourceHandles(edges, outletKeys).map((item) => item.sourceHandle)).toEqual(['out-o3', 'out-o1']);
  });

  it('没绑定选项的老边按顺序落到第 N 个出口（位置稳定）', () => {
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'g', target: 'a', data: {} },
      { id: 'e2', source: 'g', target: 'b', data: {} },
    ];
    expect(spreadSourceHandles(edges, outletKeys).map((item) => item.sourceHandle)).toEqual(['out-o1', 'out-o2']);
  });

  it('没声明出口的节点仍按 out-0 / out-1 排', () => {
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'p', target: 'a', data: {} },
      { id: 'e2', source: 'p', target: 'b', data: {} },
    ];
    expect(spreadSourceHandles(edges, outletKeys).map((item) => item.sourceHandle)).toEqual(['out-0', 'out-1']);
  });

  it('已经排好时返回原数组（避免每帧重建边）', () => {
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'g', target: 'a', data: { outlet: 'o1' }, sourceHandle: 'out-o1' }];
    expect(spreadSourceHandles(edges, outletKeys)).toBe(edges);
  });
});
