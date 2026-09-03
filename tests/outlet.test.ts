import { describe, expect, it } from 'vitest';
import type { Flow, FlowNode } from '../src/core/types.js';
import {
  addOutlet,
  connect,
  flowToRf,
  isOutletOccupied,
  moveOutlet,
  normalizeOutlets,
  removeEdge,
  removeOutlet,
  setOutletCondition,
  updateBranch,
  type FlowRFEdge,
} from '../src/web/dsl.js';

function baseFlow(): Flow {
  return {
    id: 'f_outlet',
    name: '出口测试',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: 'x' },
      { id: 'n2', type: 'prompt', instruction: 'y' },
      { id: 'n3', type: 'end', outcome: 'success' },
    ],
  };
}

/** n1（入口，双出口 o1/o2）→ n2 / n3 */
function flowWithOutlets(): Flow {
  let f = addOutlet(baseFlow(), 'n1')!.flow;
  f = addOutlet(f, 'n1')!.flow;
  return f;
}

function mustConnect(flow: Flow, source: string, target: string, outlet?: string): Flow {
  const next = connect(flow, source, target, outlet);
  if (next === null) throw new Error('connect 被意外拒绝');
  return next;
}

function n1Of(flow: Flow): FlowNode {
  return flow.nodes[0]!;
}

describe('节点自定义出口', () => {
  it('addOutlet 生成递增的出口 id', () => {
    expect(n1Of(flowWithOutlets()).outlets).toEqual([{ id: 'o1', condition: '' }, { id: 'o2', condition: '' }]);
  });

  it('从自定义出口拉首条连线 → 生成绑定该出口的分支（而非 next）', () => {
    const f = mustConnect(flowWithOutlets(), 'n1', 'n2', 'o1');
    const n1 = n1Of(f);
    expect(n1.next).toBeUndefined();
    expect(n1.branches).toEqual([{ id: 'b1', condition: '', to: 'n2', outlet: 'o1' }]);
  });

  it('已有 next 时从自定义出口连线 → next 升级为双分支，默认分支留在默认出口', () => {
    let f = baseFlow();
    f = { ...f, nodes: [{ ...n1Of(f), next: 'n2' }, ...f.nodes.slice(1)] };
    f = addOutlet(f, 'n1')!.flow;
    f = mustConnect(f, 'n1', 'n3', 'o1');
    expect(n1Of(f).branches).toEqual([
      { id: 'b_default', condition: '*', to: 'n2' },
      { id: 'b2', condition: '', to: 'n3', outlet: 'o1' },
    ]);
  });

  it('从默认出口连线（节点无任何出口占用）→ next 语义', () => {
    const f = mustConnect(flowWithOutlets(), 'n1', 'n2', undefined);
    expect(n1Of(f).next).toBe('n2');
  });

  it('边的 sourceHandle 跟随分支的 outlet 绑定', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = mustConnect(f, 'n1', 'n3', 'o2');
    const { edges } = flowToRf(f);
    expect(edges.map((e) => ({ id: e.id, sourceHandle: e.sourceHandle }))).toEqual([
      { id: 'e:n1:b1', sourceHandle: 'o1' },
      { id: 'e:n1:b2', sourceHandle: 'o2' },
    ]);
  });

  it('removeOutlet 连带删除绑在该出口上的分支', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = mustConnect(f, 'n1', 'n3', 'o2');
    f = updateBranch(f, 'n1', 'b1', { condition: '正常路径' });
    f = updateBranch(f, 'n1', 'b2', { condition: '异常路径' });

    f = removeOutlet(f, 'n1', 'o1');
    const n1 = n1Of(f);
    expect(n1.outlets).toEqual([{ id: 'o2', condition: '' }]);
    expect(n1.branches?.map((b) => b.id)).toEqual(['b2']);
    expect(n1.branches?.[0]?.outlet).toBe('o2');
  });

  it('删除出口后仅剩一条无条件分支时收敛回 next（出口绑定脱落）', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = mustConnect(f, 'n1', 'n3', 'o2');
    f = updateBranch(f, 'n1', 'b2', { makeDefault: true });
    f = removeOutlet(f, 'n1', 'o1');
    const n1 = n1Of(f);
    expect(n1.outlets.map((o) => o.id)).toEqual(['o2']);
    expect(n1.branches).toBeUndefined();
    expect(n1.next).toBe('n3');
  });

  it('end 节点不添加出口', () => {
    expect(addOutlet(flowWithOutlets(), 'n3')).toBeNull();
  });

  it('addOutlet 插入到指定出口之后并返回新 id', () => {
    const f0 = flowWithOutlets();
    const r = addOutlet(f0, 'n1', 'o1');
    expect(r!.outletId).toBe('o3');
    expect(n1Of(r!.flow).outlets.map((o) => o.id)).toEqual(['o1', 'o3', 'o2']);
    // 缺省 anchor 追加末尾
    const r2 = addOutlet(f0, 'n1');
    expect(n1Of(r2!.flow).outlets.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('moveOutlet 重排出口且 id 稳定（分支绑定不变）', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = updateBranch(f, 'n1', 'b1', { condition: '条件一' });
    // 把 o2 移到最前（toIndex=0）
    f = moveOutlet(f, 'n1', 'o2', 0);
    expect(n1Of(f).outlets.map((o) => o.id)).toEqual(['o2', 'o1']);
    // o1 的分支绑定不受影响
    expect(n1Of(f).branches).toEqual([{ id: 'b1', condition: '条件一', to: 'n2', outlet: 'o1' }]);
    // 把 o1 移到末尾（移除后插入位置 1）
    f = moveOutlet(f, 'n1', 'o1', 1);
    expect(n1Of(f).outlets.map((o) => o.id)).toEqual(['o2', 'o1']);
    // 越界与不存在出口的安全处理
    expect(moveOutlet(f, 'n1', 'o1', 99).nodes[0]!.outlets.map((o) => o.id)).toEqual(['o2', 'o1']);
    expect(moveOutlet(f, 'n1', 'oX', 0).nodes[0]!.outlets.map((o) => o.id)).toEqual(['o2', 'o1']);
  });
});

describe('卡点：选项即出口', () => {
  function gateFlow(): Flow {
    return {
      id: 'f_gate', name: 't', entry: 'g',
      nodes: [
        { id: 'g', type: 'gate', question: '是否继续？', options: [{ id: 'opt1', label: '继续' }] },
        { id: 'n1', type: 'prompt', instruction: 'x' },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
  }
  const g = (f: Flow) => f.nodes[0]!;

  it('addOutlet 对 gate 添加选项（插入到选中项之后）', () => {
    const r1 = addOutlet(gateFlow(), 'g')!;
    expect(g(r1.flow).options).toEqual([{ id: 'opt1', label: '继续' }, { id: 'opt2', label: '' }]);
    const r2 = addOutlet(r1.flow, 'g', 'opt1')!;
    expect(g(r2.flow).options.map((o) => o.id)).toEqual(['opt1', 'opt3', 'opt2']);
  });

  it('gate 选项连线 → 分支绑定选项 id，条件取选项文案', () => {
    let f = gateFlow();
    f = mustConnect(f, 'g', 'n1', 'opt1');
    expect(g(f).branches).toEqual([{ id: 'b1', condition: '继续', to: 'n1', outlet: 'opt1' }]);
    // 替换连线保留文案
    f = mustConnect(f, 'g', 'n2', 'opt1');
    expect(g(f).branches).toEqual([{ id: 'b1', condition: '继续', to: 'n2', outlet: 'opt1' }]);
  });

  it('编辑选项文案 → 选项与分支同步', () => {
    let f = gateFlow();
    f = mustConnect(f, 'g', 'n1', 'opt1');
    f = setOutletCondition(f, 'g', 'opt1', '继续执行');
    expect(g(f).options[0]!.label).toBe('继续执行');
    expect(g(f).branches![0]!.condition).toBe('继续执行');
  });

  it('删除选项连带其分支，剩余分支不收敛为 next', () => {
    let f = addOutlet(gateFlow(), 'g')!.flow;
    f = mustConnect(f, 'g', 'n1', 'opt1');
    f = mustConnect(f, 'g', 'n2', 'opt2');
    f = removeOutlet(f, 'g', 'opt1');
    const gd = g(f);
    expect(gd.options.map((o) => o.id)).toEqual(['opt2']);
    expect(gd.branches).toEqual([{ id: 'b2', condition: '', to: 'n2', outlet: 'opt2' }]);
    expect(gd.next).toBeUndefined();
  });

  it('选项重排（id 稳定，分支绑定不变）', () => {
    let f = addOutlet(gateFlow(), 'g')!.flow;
    f = mustConnect(f, 'g', 'n1', 'opt1');
    f = moveOutlet(f, 'g', 'opt2', 0);
    expect(g(f).options.map((o) => o.id)).toEqual(['opt2', 'opt1']);
    expect(g(f).branches![0]!.outlet).toBe('opt1');
  });

  it('normalizeOutlets：gate 的 next 转为选项分支，旧 outlets 迁移为选项', () => {
    const legacy: Flow = {
      id: 'f_g2', name: 't', entry: 'g',
      nodes: [
        { id: 'g', type: 'gate', question: 'q', next: 'n1',
          options: [{ id: 'opt1', label: 'A' }],
          outlets: [{ id: 'o1', condition: 'B' }] } as unknown as FlowNode,
        { id: 'n1', type: 'end', outcome: 'success' },
      ],
    };
    const f = normalizeOutlets(legacy);
    const gd = g(f);
    expect(gd.outlets).toBeUndefined();
    expect(gd.next).toBeUndefined();
    expect(gd.options).toEqual([{ id: 'opt1', label: 'A' }, { id: 'o1', label: 'B' }, { id: 'opt2', label: '' }]);
    expect(gd.branches).toEqual([{ id: 'b_opt2', condition: '', to: 'n1', outlet: 'opt2' }]);
  });
});

describe('一出口一线 / 一入口多线（落线自动替换旧连线）', () => {
  it('同一自定义出口连向新目标 → 替换旧连线', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = updateBranch(f, 'n1', 'b1', { condition: '原条件' });
    f = mustConnect(f, 'n1', 'n3', 'o1'); // 替换
    expect(n1Of(f).branches).toEqual([{ id: 'b1', condition: '', to: 'n3', outlet: 'o1' }]);
    // 重复连同一目标 → 拒绝
    expect(connect(f, 'n1', 'n3', 'o1')).toBeNull();
  });

  it('默认出口的 next 被替换', () => {
    let f = baseFlow();
    f = mustConnect(f, 'n1', 'n2', undefined);
    f = mustConnect(f, 'n1', 'n3', undefined); // 替换 next
    expect(n1Of(f).next).toBe('n3');
  });

  it('默认出口的默认分支被替换（其它出口的分支保留）', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = updateBranch(f, 'n1', 'b1', { condition: '出口一条件' });
    f = mustConnect(f, 'n1', 'n3', undefined); // 默认出口 → b2(*)
    f = mustConnect(f, 'n1', 'n2', undefined); // 替换默认出口的分支
    const n1 = n1Of(f);
    expect(n1.branches).toEqual([
      { id: 'b1', condition: '出口一条件', to: 'n2', outlet: 'o1' },
      { id: 'b2', condition: '*', to: 'n2' },
    ]);
    expect(isOutletOccupied(f, 'n1', undefined)).toBe(true);
  });

  it('不同出口可以连向同一个入口（一入多出）', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = mustConnect(f, 'n1', 'n2', 'o2');
    expect(n1Of(f).branches?.map((b) => b.to)).toEqual(['n2', 'n2']);
    expect(flowToRf(f).edges.every((e) => e.target === 'n2')).toBe(true);
  });

  it('删除连线后出口释放，可再次连接', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    expect(isOutletOccupied(f, 'n1', 'o1')).toBe(true);
    const edge = flowToRf(f).edges.find((e) => e.id === 'e:n1:b1') as FlowRFEdge;
    f = removeEdge(f, edge);
    expect(isOutletOccupied(f, 'n1', 'o1')).toBe(false);
    f = mustConnect(f, 'n1', 'n3', 'o1');
    expect(n1Of(f).branches?.[0]).toEqual({ id: 'b1', condition: '', to: 'n3', outlet: 'o1' });
  });

  it('自环连线被拒绝', () => {
    expect(connect(flowWithOutlets(), 'n1', 'n1', 'o1')).toBeNull();
  });

  it('取消默认分支后条件置空（可再编辑）', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = updateBranch(f, 'n1', 'b1', { makeDefault: true });
    expect(n1Of(f).branches?.[0]?.condition).toBe('*');
    f = updateBranch(f, 'n1', 'b1', { condition: '新条件' });
    expect(n1Of(f).branches?.[0]?.condition).toBe('新条件');
  });

  it('normalizeOutlets 迁移旧数据：多余的默认出口分支绑到新建出口', () => {
    // 旧数据：两个分支都锚在默认出口（一出口一线规则之前创建）
    const legacy: Flow = {
      id: 'f_legacy',
      name: '旧图',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [
            { id: 'b_default', condition: '*', to: 'n2' },
            { id: 'b2', condition: '直接结束', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    const f = normalizeOutlets(legacy);
    const n1 = n1Of(f);
    expect(n1.outlets).toEqual([{ id: 'o1', condition: '直接结束' }]);
    expect(n1.branches).toEqual([
      { id: 'b_default', condition: '*', to: 'n2' },
      { id: 'b2', condition: '直接结束', to: 'n3', outlet: 'o1' },
    ]);
  });

  it('已有分支时从默认出口连线 → 自动成为默认分支（*），别处的 * 让位', () => {
    let f = flowWithOutlets();
    f = mustConnect(f, 'n1', 'n2', 'o1');
    f = updateBranch(f, 'n1', 'b1', { makeDefault: true }); // * 在 o1 上
    f = mustConnect(f, 'n1', 'n3', undefined); // 默认出口连线
    const n1 = n1Of(f);
    // 新分支锚默认出口且为 *；原 * 分支条件置空（可在自定义出口行编辑）
    expect(n1.branches).toEqual([
      { id: 'b1', condition: '', to: 'n2', outlet: 'o1' },
      { id: 'b2', condition: '*', to: 'n3' },
    ]);
  });

  it('未连接的出口也可以编辑条件，连线时自动携带', () => {
    let f = flowWithOutlets();
    f = setOutletCondition(f, 'n1', 'o1', '测试全部通过');
    // 未连接：只写出口，不生成分支
    expect(n1Of(f).branches).toBeUndefined();
    expect(n1Of(f).outlets?.find((o) => o.id === 'o1')?.condition).toBe('测试全部通过');
    // 连线 → 分支携带出口条件
    f = mustConnect(f, 'n1', 'n2', 'o1');
    expect(n1Of(f).branches).toEqual([{ id: 'b1', condition: '测试全部通过', to: 'n2', outlet: 'o1' }]);
    // 已连接时编辑 → 出口与分支同步
    f = setOutletCondition(f, 'n1', 'o1', '条件改了');
    expect(n1Of(f).outlets?.find((o) => o.id === 'o1')?.condition).toBe('条件改了');
    expect(n1Of(f).branches?.[0]?.condition).toBe('条件改了');
    // 替换连线 → 条件保留
    f = mustConnect(f, 'n1', 'n3', 'o1');
    expect(n1Of(f).branches).toEqual([{ id: 'b1', condition: '条件改了', to: 'n3', outlet: 'o1' }]);
  });

  it('normalizeOutlets 把 * 归位到默认出口（交换条件 / 移回默认出口）', () => {
    // 情形一：* 在自定义出口，默认出口另有条件分支 → 交换
    let f: Flow = {
      id: 'f_star',
      name: 't',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          outlets: ['o1'],
          branches: [
            { id: 'b1', condition: '*', to: 'n2', outlet: 'o1' },
            { id: 'b2', condition: '主路径', to: 'n3' },
          ],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
        { id: 'n3', type: 'end', outcome: 'fail' },
      ],
    };
    f = normalizeOutlets(f);
    expect(n1Of(f).branches).toEqual([
      { id: 'b1', condition: '主路径', to: 'n2', outlet: 'o1' },
      { id: 'b2', condition: '*', to: 'n3' },
    ]);
    // 情形二：* 在自定义出口，默认出口无分支 → 移回默认出口
    let g: Flow = {
      id: 'f_star2',
      name: 't',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          outlets: ['o1'],
          branches: [{ id: 'b1', condition: '*', to: 'n2', outlet: 'o1' }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    g = normalizeOutlets(g);
    expect(n1Of(g).branches).toEqual([{ id: 'b1', condition: '*', to: 'n2' }]);
  });

  it('normalizeOutlets 对合规数据是恒等变换', () => {
    const f = flowWithOutlets();
    expect(normalizeOutlets(f)).toEqual(f);
  });

  it('开始节点（entry）不能被连入', () => {
    // n1 是 entry：任何节点连向它都被拒绝
    expect(connect(flowWithOutlets(), 'n2', 'n1', undefined)).toBeNull();
    expect(connect(flowWithOutlets(), 'n2', 'n1', 'o1')).toBeNull();
  });
});
