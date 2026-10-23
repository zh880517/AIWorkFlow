// 画布 <-> DSL 的双向映射。画布只持有布局与标题，节点本体（instruction/options/...）保存在 bodies 里，
// 保存时按边重建 next/branches，其余字段原样保留（不丢掉主工程编辑器写的 outlets/params 等）。
import type { Branch, Flow, FlowNode, NodeType } from '@shared/index.js';
import type { Edge, Node } from '@xyflow/react';

export interface CanvasNodeData extends Record<string, unknown> {
  title: string;
  kind: NodeType;
  detail: string;
  /** 入口节点：卡片上打「入口」标记，也用来拦住连进入口的线 */
  isEntry: boolean;
}

export type CanvasNode = Node<CanvasNodeData, 'wf'>;
export type CanvasEdge = Edge<{ branchId?: string; condition?: string; outlet?: string }>;

export const PALETTE: Array<{ type: NodeType; label: string }> = [
  { type: 'prompt', label: '指令' },
  { type: 'tool', label: '工具' },
  { type: 'subagent', label: '子 Agent' },
  { type: 'gate', label: '人工卡点' },
  { type: 'join', label: '汇聚' },
  { type: 'end', label: '结束' },
];

export function typeLabel(type: NodeType): string {
  return PALETTE.find((entry) => entry.type === type)?.label ?? type;
}

export function detailOf(node: FlowNode): string {
  switch (node.type) {
    case 'prompt':
      return node.instruction ?? '';
    case 'gate':
      return node.question ?? '';
    case 'tool':
      return node.toolName ?? '';
    case 'subagent':
      return node.mode === 'flowRef' ? `引用 ${node.flowRef ?? ''}` : node.mode;
    case 'join':
      return node.aggregateInstruction ?? '';
    case 'end':
      return node.outcome;
  }
}

function autoPosition(index: number): { x: number; y: number } {
  return { x: 80 + (index % 3) * 260, y: 60 + Math.floor(index / 3) * 170 };
}

export function makeNode(type: NodeType, id: string): FlowNode {
  const title = typeLabel(type);
  switch (type) {
    case 'prompt':
      return { id, type, title, instruction: '' };
    case 'tool':
      return { id, type, title, toolName: '' };
    case 'subagent':
      return { id, type, title, extraPrompt: '', mode: 'inline' };
    case 'gate':
      return {
        id,
        type,
        title,
        question: '',
        options: [
          { id: 'o1', label: '继续' },
          { id: 'o2', label: '终止' },
        ],
      };
    case 'join':
      return { id, type, title, aggregateInstruction: '汇总子任务结果' };
    case 'end':
      return { id, type, title, outcome: 'success' };
  }
}

export function canvasOf(flow: Flow): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const positions = flow._ui?.positions ?? {};
  const nodes: CanvasNode[] = flow.nodes.map((node, index) => ({
    id: node.id,
    type: 'wf',
    position: positions[node.id] ?? autoPosition(index),
    data: { title: node.title?.trim() || node.id, kind: node.type, detail: detailOf(node), isEntry: node.id === flow.entry },
  }));
  const known = new Set(nodes.map((node) => node.id));
  const edges: CanvasEdge[] = [];
  for (const node of flow.nodes) {
    if (node.branches !== undefined && node.branches.length > 0) {
      for (const branch of node.branches) {
        if (!known.has(branch.to)) continue;
        edges.push({
          id: `e-${node.id}-${branch.id}`,
          source: node.id,
          target: branch.to,
          label: branch.condition === '*' ? '默认' : branch.condition || '条件',
          data: { branchId: branch.id, condition: branch.condition, outlet: branch.outlet },
        });
      }
      continue;
    }
    if (node.next !== undefined && known.has(node.next)) {
      edges.push({ id: `e-${node.id}`, source: node.id, target: node.next, data: {} });
    }
  }
  return { nodes, edges };
}

/** 分支 id 必须唯一：新边优先用 preferred，撞了再加后缀（不改已有分支的 id，gate 的 outlet 靠它） */
function uniqueBranchId(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) return preferred;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * 画布渲染用：同一节点的多条出边按顺序挂到不同的 source handle（out-0 / out-1 …），
 * 让分支出口从上到下排开，而不是全挤在右边同一个点上。
 * 只影响渲染；保存用的还是 page.tsx 里那份 edges 状态（不含 handle 绑定）。
 */
export function spreadSourceHandles(edges: CanvasEdge[]): CanvasEdge[] {
  const counters = new Map<string, number>();
  let changed = false;
  const next = edges.map((edge) => {
    const index = counters.get(edge.source) ?? 0;
    counters.set(edge.source, index + 1);
    const handle = `out-${index}`;
    if (edge.sourceHandle === handle) return edge;
    changed = true;
    return { ...edge, sourceHandle: handle };
  });
  return changed ? next : edges;
}

export function buildFlow(
  base: Flow,
  bodies: Record<string, FlowNode>,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Flow {
  const outgoing = new Map<string, CanvasEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }
  const order: string[] = [];
  for (const node of nodes) {
    if (bodies[node.id] !== undefined) order.push(node.id);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  const flowNodes: FlowNode[] = order.map((id) => {
    const canvasNode = nodes.find((node) => node.id === id);
    if (canvasNode !== undefined) positions[id] = canvasNode.position;
    const body = bodies[id];
    if (body === undefined) throw new Error(`节点 ${id} 缺少定义`);
    const node: FlowNode = {
      ...body,
      title: typeof canvasNode?.data.title === 'string' ? canvasNode.data.title : body.title,
    };
    const outs = outgoing.get(id) ?? [];
    if (outs.length === 0) {
      delete node.next;
      delete node.branches;
    } else if (outs.length === 1) {
      node.next = outs[0]!.target;
      delete node.branches;
    } else {
      const usedBranchIds = new Set<string>();
      node.branches = outs.map((edge, index) => {
        const previous = body.branches?.find((branch) => branch.id === edge.data?.branchId);
        const dataCondition = edge.data?.condition;
        // undefined = 这条边没被改过，回落到原条件；显式清空（''）就保持空，
        // 让校验器报「condition 为空」。别把第二条边也补成 '*'——那会变成
        // E_MULTI_DEFAULT（多个默认分支），把真正的问题藏起来。
        const rawCondition =
          dataCondition !== undefined ? dataCondition : previous?.condition ?? (index === 0 ? '*' : '');
        const condition = rawCondition === '' && index === 0 ? '*' : rawCondition;
        // 卡点的出口绑定（option id）优先取这次在面板里选的，其次沿用旧分支
        const outlet = edge.data?.outlet ?? previous?.outlet;
        const branch: Branch =
          previous !== undefined
            ? { ...previous, to: edge.target, condition, ...(outlet !== undefined ? { outlet } : {}) }
            : {
                id: uniqueBranchId(edge.data?.branchId ?? `b${index + 1}`, usedBranchIds),
                condition,
                to: edge.target,
                ...(outlet !== undefined ? { outlet } : {}),
              };
        usedBranchIds.add(branch.id);
        return branch;
      });
      // 卡点：没显式选出口时按选项顺序兜底；condition 引擎不用，但不能为空——用选项文案补上
      if (body.type === 'gate') {
        const gateOptions = body.options ?? [];
        node.branches = node.branches.map((branch, index) => {
          const option = gateOptions.find((item) => item.id === branch.outlet) ?? gateOptions[index];
          const outlet = branch.outlet ?? option?.id;
          // 卡点的 condition 引擎不用，但校验器要求非空：统一用选项文案（可读、且门控分支不需要 default）
          const condition =
            branch.condition === '' || branch.condition === '*' ? (option?.label?.trim() || '*') : branch.condition;
          return { ...branch, condition, ...(outlet !== undefined ? { outlet } : {}) };
        });
      }
      delete node.next;
    }
    return node;
  });

  const entry = order.includes(base.entry) ? base.entry : (order[0] ?? base.entry);
  return {
    ...base,
    entry,
    nodes: flowNodes,
    _ui: { ...(base._ui ?? {}), positions },
  };
}

/** 保存前在图里做的廉价自检，避免把明显不完整的图送去校验 */
export function localIssues(bodies: Record<string, FlowNode>, nodes: CanvasNode[]): string[] {
  const issues: string[] = [];
  for (const node of nodes) {
    const body = bodies[node.id];
    if (body === undefined) continue;
    if (body.type === 'prompt' && (body.instruction ?? '').trim() === '') {
      issues.push(`「${node.data.title}」是指令节点，但指令为空`);
    }
    if (body.type === 'tool' && (body.toolName ?? '').trim() === '') {
      issues.push(`「${node.data.title}」是工具节点，但工具名为空`);
    }
    if (body.type === 'gate' && (body.question ?? '').trim() === '') {
      issues.push(`「${node.data.title}」是卡点，但问题为空`);
    }
  }
  return issues;
}
