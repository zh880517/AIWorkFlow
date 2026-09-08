// DSL ↔ React Flow 转换与画布编辑操作。
// DSL 是唯一事实源：画布上的一切改动都翻译成对 Flow 对象的变更，再派生回画布。
import type { Edge, Node } from '@xyflow/react';
import type { Flow, FlowNode, NodeType, OutletDef } from '../core/types.js';

export const NODE_META: Record<NodeType, { label: string; color: string; icon: string }> = {
  prompt: { label: '提示', color: '#2563eb', icon: '✏️' },
  tool: { label: '工具', color: '#7c3aed', icon: '🔧' },
  subagent: { label: '子代理', color: '#d97706', icon: '🤖' },
  gate: { label: '卡点', color: '#dc2626', icon: '🛑' },
  join: { label: '汇聚', color: '#0d9488', icon: '⛓️' },
  end: { label: '结束', color: '#4b5563', icon: '🏁' },
};

export const NODE_TYPES: NodeType[] = ['prompt', 'tool', 'subagent', 'gate', 'join', 'end'];

export interface FlowNodeData extends Record<string, unknown> {
  flowNode: FlowNode;
  isEntry: boolean;
}
export type FlowRFNode = Node<FlowNodeData, 'flow'>;

export interface EdgeData extends Record<string, unknown> {
  kind: 'next' | 'branch' | 'escape';
  branchId?: string;
}
export type FlowRFEdge = Edge<EdgeData>;

export const edgeId = (nodeId: string, key: string): string => `e:${nodeId}:${key}`;

/** 节点显示名：标题优先，缺省用类型名（不在 UI 上暴露内部 id） */
export function nodeTitle(flow: Flow, nodeId: string): string {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return nodeId;
  return node.title?.trim() || NODE_META[node.type].label;
}

export function outgoing(node: FlowNode): string[] {
  return [...(node.next !== undefined ? [node.next] : []), ...(node.branches ?? []).map((b) => b.to)];
}

/** 无保存坐标时的兜底布局：按 BFS 深度分层 */
export function autoLayout(flow: Flow): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const queue: Array<[string, number]> = [[flow.entry, 0]];
  while (queue.length > 0) {
    const [id, d] = queue.shift()!;
    if (depth.has(id)) continue;
    depth.set(id, d);
    const node = flow.nodes.find((n) => n.id === id);
    if (node !== undefined) {
      for (const to of outgoing(node)) {
        if (!depth.has(to)) queue.push([to, d + 1]);
      }
    }
  }
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  const buckets = new Map<number, string[]>();
  for (const node of flow.nodes) {
    const d = depth.get(node.id) ?? maxDepth + 1;
    const bucket = buckets.get(d) ?? [];
    bucket.push(node.id);
    buckets.set(d, bucket);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [d, ids] of buckets) {
    ids.forEach((id, i) => {
      positions[id] = { x: 60 + i * 250, y: 60 + d * 170 };
    });
  }
  return positions;
}

/**
 * flow → RF 节点/边。measured 为编辑器缓存的节点实测尺寸（来自 onNodesChange 的
 * dimensions 变更）：受控模式下每次重渲染都会重建节点对象，带上 measured 可避免
 * React Flow 重置测量状态导致拖动时节点闪烁消失。
 */
export function flowToRf(
  flow: Flow,
  measured?: Record<string, { width: number; height: number }>,
): { nodes: FlowRFNode[]; edges: FlowRFEdge[] } {
  const positions = { ...autoLayout(flow), ...flow._ui?.positions };
  const nodes: FlowRFNode[] = flow.nodes.map((n) => ({
    id: n.id,
    type: 'flow' as const,
    position: positions[n.id] ?? { x: 60, y: 60 },
    measured: measured?.[n.id],
    data: { flowNode: n, isEntry: n.id === flow.entry },
  }));
  const edges: FlowRFEdge[] = [];
  for (const n of flow.nodes) {
    if (n.type === 'end') continue;
    if (n.next !== undefined) {
      edges.push({
        id: edgeId(n.id, 'next'),
        source: n.id,
        target: n.next,
        data: { kind: 'next' },
      });
    }
    for (const b of n.branches ?? []) {
      edges.push({
        id: edgeId(n.id, b.id),
        source: n.id,
        target: b.to,
        sourceHandle: b.outlet,
        data: { kind: 'branch', branchId: b.id },
      });
    }
    if (n.onLimitExceeded !== undefined) {
      edges.push({
        id: edgeId(n.id, 'escape'),
        source: n.id,
        target: n.onLimitExceeded,
        data: { kind: 'escape' },
        deletable: false,
        className: 'edge-escape',
      });
    }
  }
  return { nodes, edges };
}

// ---------- 以下为编辑操作（全部返回新 Flow） ----------

function clone(flow: Flow): Flow {
  return structuredClone(flow);
}

export function nextNodeId(flow: Flow): string {
  let max = 0;
  for (const n of flow.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m !== null) max = Math.max(max, Number(m[1]));
  }
  return `n${max + 1}`;
}

function nextBranchId(node: FlowNode): string {
  let max = 0;
  for (const b of node.branches ?? []) {
    const m = /^b(\d+)$/.exec(b.id);
    if (m !== null) max = Math.max(max, Number(m[1]));
  }
  return `b${max + 1}`;
}

export function makeNode(id: string, type: NodeType): FlowNode {
  const base = { id };
  switch (type) {
    case 'prompt':
      return { ...base, type, instruction: '' };
    case 'tool':
      return { ...base, type, toolName: '', params: {} };
    case 'subagent':
      return { ...base, type, extraPrompt: '', mode: 'inline' };
    case 'gate':
      return { ...base, type, question: '', options: [{ id: 'opt1', label: '通过' }] };
    case 'join':
      return { ...base, type, aggregateInstruction: '' };
    case 'end':
      return { ...base, type, outcome: 'success' as const };
  }
}

export function addNode(flow: Flow, type: NodeType, position: { x: number; y: number }): { flow: Flow; nodeId: string } {
  const next = clone(flow);
  const id = nextNodeId(next);
  next.nodes.push(makeNode(id, type));
  next._ui ??= {};
  next._ui.positions ??= {};
  next._ui.positions[id] = position;
  if (next.entry === '') next.entry = id;
  return { flow: next, nodeId: id };
}

/**
 * 出口占用检查：一个出口只能连一条线（一个入口可接收多条）。
 * 默认出口被 next 或未绑定自定义出口的分支占用；自定义出口被 outlet 匹配的分支占用。
 */
export function isOutletOccupied(flow: Flow, nodeId: string, outlet?: string): boolean {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (node === undefined || node.type === 'end') return true;
  if (outlet === undefined) {
    return node.next !== undefined || (node.branches ?? []).some((b) => b.outlet === undefined);
  }
  return (node.branches ?? []).some((b) => b.outlet === outlet);
}

/** 出口当前连向的目标（next 或绑定该出口的分支）；未连接返回 undefined */
export function outletTarget(node: FlowNode, outlet?: string): string | undefined {
  if (outlet === undefined) {
    return node.next ?? node.branches?.find((b) => b.outlet === undefined)?.to;
  }
  return node.branches?.find((b) => b.outlet === outlet)?.to;
}

/** 清除出口上的连线（不动其它出口） */
function clearOutlet(node: FlowNode, outlet?: string): void {
  if (outlet === undefined) {
    if (node.next !== undefined) {
      node.next = undefined;
      return;
    }
    const bs = (node.branches ?? []).filter((b) => b.outlet !== undefined);
    node.branches = bs.length > 0 ? bs : undefined;
  } else {
    const bs = (node.branches ?? []).filter((b) => b.outlet !== outlet);
    node.branches = bs.length > 0 ? bs : undefined;
  }
}

/**
 * 连线（落线自动替换旧连线，参考 VisualBridge）：
 * 一个出口只能有一条线——从已占用的出口连向新目标时，旧连线被替换（清旧 + 连新是一次变更，一次撤销可回退）。
 * 返回 null 的情况：自环 / 目标是开始节点 / 该出口已连着同一目标（重复连线）。
 */
export function connect(flow: Flow, sourceId: string, targetId: string, sourceOutlet?: string): Flow | null {
  if (sourceId === targetId) return null;
  if (targetId === flow.entry) return null; // 开始节点没有入线
  const node0 = flow.nodes.find((n) => n.id === sourceId);
  if (node0 === undefined || node0.type === 'end') return null;
  if (outletTarget(node0, sourceOutlet) === targetId) return null; // 重复连线

  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === sourceId)!;
  // 落线替换：先清掉本出口上的旧连线
  clearOutlet(node, sourceOutlet);
  if ((node.branches ?? []).length > 0) {
    if (sourceOutlet === undefined) {
      // 默认出口是兜底出口：其上的分支即默认分支（*），无需填写条件；
      // 若 * 已在别的出口上，让位（置空待填，自定义出口行可编辑）
      for (const b of node.branches!) {
        if (b.condition === '*') b.condition = '';
      }
      node.branches!.push({ id: nextBranchId(node), condition: '*', to: targetId });
    } else {
      const outletCond = node.type === 'gate'
        ? node.options?.find((o) => o.id === sourceOutlet)?.label ?? ''
        : node.outlets?.find((o) => o.id === sourceOutlet)?.condition ?? '';
      node.branches!.push({ id: nextBranchId(node), condition: outletCond, to: targetId, outlet: sourceOutlet });
    }
  } else if (node.next !== undefined) {
    const old = node.next;
    node.next = undefined;
    node.branches = [
      { id: 'b_default', condition: '*', to: old },
      { id: 'b2', condition: '', to: targetId, outlet: sourceOutlet! },
    ];
  } else if (sourceOutlet !== undefined) {
    // 从自定义出口拉出的首条连线：作为分支而非 next（next 锚定在默认出口），条件取出口上编辑的文本
    const outletCond = node.type === 'gate'
      ? node.options?.find((o) => o.id === sourceOutlet)?.label ?? ''
      : node.outlets?.find((o) => o.id === sourceOutlet)?.condition ?? '';
    node.branches = [{ id: 'b1', condition: outletCond, to: targetId, outlet: sourceOutlet }];
  } else {
    node.next = targetId;
  }
  return next;
}

/**
 * 添加自定义出口：插入到 anchor 出口之后（缺省追加末尾）。
 * 返回新流程与新出口 id（供调用方选中新行）；end 节点返回 null。
 */
export function addOutlet(
  flow: Flow,
  nodeId: string,
  afterOutlet?: string,
): { flow: Flow; outletId: string } | null {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node === undefined || node.type === 'end') return null;
  if (node.type === 'gate') {
    // 卡点：出口即选项
    const id = nextOptionId(node);
    const options = node.options ?? [];
    const at =
      afterOutlet !== undefined ? options.findIndex((o) => o.id === afterOutlet) + 1 : options.length;
    node.options = [...options.slice(0, at), { id, label: '' }, ...options.slice(at)];
    return { flow: next, outletId: id };
  }
  const id = nextOutletId(node);
  const outlets = node.outlets ?? [];
  const at =
    afterOutlet !== undefined ? outlets.findIndex((o) => o.id === afterOutlet) + 1 : outlets.length;
  node.outlets = [...outlets.slice(0, at), { id, condition: '' }, ...outlets.slice(at)];
  return { flow: next, outletId: id };
}

function nextOptionId(node: FlowNode): string {
  let max = 0;
  for (const o of (node as { options?: Array<{ id: string }> }).options ?? []) {
    const m = /^opt(\d+)$/.exec(o.id);
    if (m !== null) max = Math.max(max, Number(m[1]));
  }
  return `opt${max + 1}`;
}

/** 出口列表重排：id 保持稳定（分支的 outlet 绑定不受影响）；toIndex 为移除后的插入位置 */
export function moveOutlet(flow: Flow, nodeId: string, outlet: string, toIndex: number): Flow {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return next;
  if (node.type === 'gate') {
    if (node.options === undefined) return next;
    const from = node.options.findIndex((o) => o.id === outlet);
    if (from === -1) return next;
    const list = [...node.options];
    const [moved] = list.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, list.length));
    list.splice(clamped, 0, moved!);
    node.options = list;
    return next;
  }
  if (node.outlets === undefined) return next;
  const from = node.outlets.findIndex((o) => o.id === outlet);
  if (from === -1) return next;
  const list = [...node.outlets];
  const [moved] = list.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, list.length));
  list.splice(clamped, 0, moved!);
  node.outlets = list;
  return next;
}

/** 编辑出口上的条件（未连接也可编辑）；已连接时同步到分支（引擎读取分支条件）。卡点：编辑选项文案 */
export function setOutletCondition(flow: Flow, nodeId: string, outlet: string, condition: string): Flow {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return next;
  if (node.type === 'gate') {
    const opt = (node.options ?? []).find((x) => x.id === outlet);
    if (opt === undefined) return next;
    opt.label = condition;
    const branch = node.branches?.find((b) => b.outlet === outlet);
    if (branch !== undefined) branch.condition = condition;
    return next;
  }
  const o = (node.outlets ?? []).find((x) => x.id === outlet);
  if (o === undefined) return next;
  o.condition = condition;
  const branch = node.branches?.find((b) => b.outlet === outlet);
  if (branch !== undefined) branch.condition = condition;
  return next;
}

/** 删除自定义出口；绑在该出口上的分支一并删除 */
export function removeOutlet(flow: Flow, nodeId: string, outlet: string): Flow {
  // 防御：outlet 必须是明确的出口 id，绝不允许空值（否则会误删未绑定出口的默认分支）
  if (outlet === undefined || outlet === null || outlet === '') return flow;
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return next;
  if (node.type === 'gate') {
    node.options = node.options.filter((o) => o.id !== outlet);
    if (node.branches !== undefined) {
      node.branches = node.branches.filter((b) => b.outlet !== outlet);
      if (node.branches.length === 0) node.branches = undefined;
    }
    return next;
  }
  node.outlets = (node.outlets ?? []).filter((o) => o.id !== outlet);
  if (node.outlets.length === 0) node.outlets = undefined;
  if (node.branches !== undefined) {
    node.branches = node.branches.filter((b) => b.outlet !== outlet);
    collapseSingleBranch(node);
  }
  return next;
}

function nextOutletId(node: FlowNode): string {
  let max = 0;
  for (const o of node.outlets ?? []) {
    const m = /^o(\d+)$/.exec(o.id);
    if (m !== null) max = Math.max(max, Number(m[1]));
  }
  return `o${max + 1}`;
}

/**
 * 兼容旧数据（一出口一线规则之前创建的图）：多个分支锚在默认出口时，
 * 第 2 个起的分支迁移到自动创建的自定义出口上，保证每个分支在出口行上可见可编辑。
 * 同时把默认分支（*）归位到默认出口——默认出口是兜底出口，不携带文本条件。
 */
export function normalizeOutlets(flow: Flow): Flow {
  const next = clone(flow);
  for (const node of next.nodes) {
    // 旧数据兼容：字符串出口迁移为对象；出口条件缺省时从绑定分支回填
    if (node.outlets !== undefined) {
      node.outlets = node.outlets.map((o) => {
        const def: OutletDef = typeof o === 'string' ? { id: o } : o;
        if (def.condition === undefined) {
          def.condition = node.branches?.find((b) => b.outlet === def.id)?.condition ?? '';
        }
        return def;
      });
    }
    // 卡点：出口即选项——旧 outlets 迁移为选项；next 转为选项分支
    if (node.type === 'gate') {
      if (node.outlets !== undefined) {
        for (const o of node.outlets) {
          const def: OutletDef = typeof o === 'string' ? { id: o } : o;
          const exists = (node.options ?? []).some((x) => x.id === def.id);
          if (!exists) {
            node.options = [...(node.options ?? []), { id: def.id, label: def.condition ?? '' }];
          }
        }
        node.outlets = undefined;
      }
      if (node.next !== undefined) {
        const id = nextOptionId(node);
        node.options = [...(node.options ?? []), { id, label: '' }];
        node.branches = [...(node.branches ?? []), { id: `b_${id}`, condition: '', to: node.next, outlet: id }];
        node.next = undefined;
      }
    }
    if (node.branches === undefined) continue;
    let seenDefault = false;
    for (const b of node.branches) {
      if (b.outlet !== undefined) continue;
      if (!seenDefault) {
        seenDefault = true; // 第一个留在默认出口
        continue;
      }
      const id = nextOutletId(node);
      b.outlet = id;
      node.outlets = [...(node.outlets ?? []), { id, condition: b.condition }];
    }
    // * 分支应锚在默认出口：与默认出口分支交换条件，或直接移回默认出口
    const branches = node.branches;
    const defaultAnchored = branches.find((b) => b.outlet === undefined);
    const starred = branches.find((b) => b.condition === '*');
    if (starred !== undefined && starred !== defaultAnchored) {
      if (defaultAnchored !== undefined) {
        const c = defaultAnchored.condition;
        defaultAnchored.condition = '*';
        starred.condition = c;
      } else {
        starred.outlet = undefined;
      }
    }
    // 手写 / API 建的图分支没有 outlet 归属，不能把第一个普通分支错当默认兜底展示——
    // 只有 * 兜底分支或 next（无条件后继）才有资格留在默认出口，其余的各分配独立出口
    if (starred === undefined && node.next === undefined) {
      for (const b of branches) {
        if (b.outlet !== undefined) continue;
        const id = nextOutletId(node);
        b.outlet = id;
        node.outlets = [...(node.outlets ?? []), { id, condition: b.condition }];
      }
    }
  }
  return next;
}

function collapseSingleBranch(node: FlowNode): void {
  if (node.type === 'gate') return; // 卡点的出口即选项，不收敛为 next
  if ((node.branches ?? []).length === 1) {
    const b = node.branches![0]!;
    if (b.condition === '*' || b.condition.trim() === '') {
      node.next = b.to;
      node.branches = undefined;
    }
  } else if ((node.branches ?? []).length === 0) {
    node.branches = undefined;
  }
}

export function removeEdge(flow: Flow, edge: FlowRFEdge): Flow {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === edge.source);
  if (node === undefined || edge.data === undefined) return next;
  if (edge.data.kind === 'next') {
    node.next = undefined;
  } else if (edge.data.kind === 'branch' && edge.data.branchId !== undefined) {
    node.branches = (node.branches ?? []).filter((b) => b.id !== edge.data!.branchId);
    collapseSingleBranch(node);
  }
  // escape 边不可删（deletable: false），到这里属防御
  return next;
}

export function removeNodes(flow: Flow, ids: string[]): Flow {
  const next = clone(flow);
  const idSet = new Set(ids);
  next.nodes = next.nodes.filter((n) => !idSet.has(n.id));
  if (idSet.has(next.entry)) next.entry = next.nodes[0]?.id ?? '';
  for (const n of next.nodes) {
    if (n.branches !== undefined) {
      n.branches = n.branches.filter((b) => !idSet.has(b.to));
      collapseSingleBranch(n);
    }
    if (n.next !== undefined && idSet.has(n.next)) n.next = undefined;
    if (n.onLimitExceeded !== undefined && idSet.has(n.onLimitExceeded)) n.onLimitExceeded = undefined;
    if (n.type === 'join' && n.waitFor !== undefined && idSet.has(n.waitFor)) n.waitFor = undefined;
  }
  if (next._ui?.positions !== undefined) {
    for (const id of ids) delete next._ui.positions[id];
  }
  return next;
}

export function updateNode(flow: Flow, nodeId: string, patch: Record<string, unknown>): Flow {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return next;
  Object.assign(node, patch);
  return next;
}

export function updateBranch(
  flow: Flow,
  nodeId: string,
  branchId: string,
  patch: { condition?: string; makeDefault?: boolean },
): Flow {
  const next = clone(flow);
  const node = next.nodes.find((n) => n.id === nodeId);
  const branch = node?.branches?.find((b) => b.id === branchId);
  if (branch === undefined) return next;
  if (patch.condition !== undefined) branch.condition = patch.condition;
  if (patch.makeDefault === true) {
    for (const b of node!.branches!) {
      if (b.id !== branchId && b.condition === '*') b.condition = '其他';
    }
    branch.condition = '*';
  }
  return next;
}

export function setEntry(flow: Flow, nodeId: string): Flow {
  const next = clone(flow);
  next.entry = nodeId;
  return next;
}

export function newPosition(flow: Flow, index: number): { x: number; y: number } {
  return { x: 80 + (index % 4) * 60, y: 80 + Math.floor(index / 4) * 60 };
}
