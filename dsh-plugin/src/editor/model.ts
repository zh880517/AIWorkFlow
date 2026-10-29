// 画布 <-> DSL 的双向映射。画布只持有布局与标题，节点本体（instruction/options/...）保存在 bodies 里，
// 保存时按边重建 next/branches，其余字段原样保留（不丢掉其它工具写入的 outlets/params 等）。
import type { Branch, Flow, FlowNode, NodeType, SubflowDef } from '@shared/index.js';
import type { Edge, Node } from '@xyflow/react';

/** 子图卡片上的只读缩略图：坐标已归一化到 0..100，直接喂 SVG viewBox */
export interface SubflowPreviewBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  entry: boolean;
}

export interface SubflowPreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SubflowPreview {
  count: number;
  entry: string;
  boxes: SubflowPreviewBox[];
  lines: SubflowPreviewLine[];
}

export interface CanvasNodeData extends Record<string, unknown> {
  title: string;
  kind: NodeType;
  detail: string;
  /** 入口节点：卡片上打「入口」标记，也用来拦住连进入口的线 */
  isEntry: boolean;
  /** 卡片右侧显式画出来的出口（卡点=每个选项一个）；空数组=按出边数量动态画 */
  outlets: CanvasOutlet[];
  /** subagent.mode=subflow 时卡片内的只读缩略图 */
  subflow?: SubflowPreview;
}

export interface CanvasOutlet {
  /** handle 后缀：卡点用选项 id，`out-<key>` 就是 React Flow 的 handle id */
  key: string;
  label: string;
}

export type CanvasNode = Node<CanvasNodeData, 'wf'>;
export type CanvasEdge = Edge<{ branchId?: string; condition?: string; when?: string; outlet?: string }>;

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
      if (node.mode === 'flowRef') return `引用 ${node.flowRef ?? ''}`;
      if (node.mode === 'subflow') {
        return node.subflow === undefined ? '内嵌子图（未创建）' : `内嵌子图 · ${node.subflow.nodes.length} 节点`;
      }
      return node.mode;
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

/** 新建 subagent.subflow 时的最小合法子图：开始 → 结束 */
export function makeSubflow(name = '子图'): SubflowDef {
  const start = makeNode('prompt', 's1');
  start.title = '子图开始';
  start.next = 's2';
  const end = makeNode('end', 's2');
  end.title = '子图结束';
  return {
    name,
    entry: 's1',
    nodes: [start, end],
    _ui: { positions: { s1: { x: 80, y: 90 }, s2: { x: 380, y: 90 } } },
  };
}

/** 子图缩略图：取前 24 个节点，按包围盒归一化到 0..100 */
export function subflowPreview(subflow: SubflowDef): SubflowPreview {
  const nodes = subflow.nodes.slice(0, 24);
  if (nodes.length === 0) return { count: 0, entry: subflow.entry, boxes: [], lines: [] };
  const positions = subflow._ui?.positions ?? {};
  const points = nodes.map((node, index) => ({
    node,
    x: positions[node.id]?.x ?? autoPosition(index).x,
    y: positions[node.id]?.y ?? autoPosition(index).y,
  }));
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const spanX = Math.max(1, maxX - minX + 160);
  const spanY = Math.max(1, maxY - minY + 90);
  const scale = 88 / Math.max(spanX, spanY);
  const boxW = Math.max(14, 148 * scale);
  const boxH = Math.max(8, 58 * scale);
  const originX = 6 + (100 - spanX * scale) / 2;
  const originY = 6 + (100 - spanY * scale) / 2;
  const center = new Map<string, { x: number; y: number }>();
  const boxes = points.map((point) => {
    const x = originX + (point.x - minX) * scale;
    const y = originY + (point.y - minY) * scale;
    center.set(point.node.id, { x: x + boxW / 2, y: y + boxH / 2 });
    return {
      id: point.node.id,
      x,
      y,
      w: boxW,
      h: boxH,
      label: point.node.title?.trim() || point.node.id,
      entry: point.node.id === subflow.entry,
    };
  });
  const known = new Set(boxes.map((box) => box.id));
  const lines: SubflowPreviewLine[] = [];
  for (const point of points) {
    const targets: string[] = [];
    if (point.node.branches !== undefined && point.node.branches.length > 0) {
      for (const branch of point.node.branches) targets.push(branch.to);
    } else if (point.node.next !== undefined) {
      targets.push(point.node.next);
    }
    const from = center.get(point.node.id);
    if (from === undefined) continue;
    for (const target of targets) {
      if (!known.has(target)) continue;
      const to = center.get(target);
      if (to === undefined) continue;
      lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  }
  return { count: subflow.nodes.length, entry: subflow.entry, boxes, lines };
}

/** 卡片右侧要画的出口：卡点一个选项一个，其余类型交给出边数量决定 */
export function outletsOf(node: FlowNode): CanvasOutlet[] {
  if (node.type !== 'gate') return [];
  return (node.options ?? []).map((option) => ({ key: option.id, label: option.label }));
}

export function canvasOf(flow: Flow): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const positions = flow._ui?.positions ?? {};
  const nodes: CanvasNode[] = flow.nodes.map((node, index) => ({
    id: node.id,
    type: 'wf',
    position: positions[node.id] ?? autoPosition(index),
    data: {
      title: node.title?.trim() || node.id,
      kind: node.type,
      detail: detailOf(node),
      isEntry: node.id === flow.entry,
      outlets: outletsOf(node),
      ...(node.type === 'subagent' && node.mode === 'subflow' && node.subflow !== undefined
        ? { subflow: subflowPreview(node.subflow) }
        : {}),
    },
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
          data: { branchId: branch.id, condition: branch.condition, when: branch.when, outlet: branch.outlet },
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
 * 画布渲染用：把每条出边挂到正确的 source handle 上。
 * - 节点声明了出口（卡点：一个选项一个）→ 按 `edge.data.outlet` 找 `out-<选项 id>`，出口名字就挂在卡片右侧；
 * - 没声明出口（其他类型）→ 按出边顺序 `out-0 / out-1 …`，一个分支一个点。
 * 只影响渲染；保存用的还是 page.tsx 里那份 edges 状态（不含 handle 绑定）。
 */
export function spreadSourceHandles(edges: CanvasEdge[], outletKeys?: Map<string, string[]>): CanvasEdge[] {
  const counters = new Map<string, number>();
  let changed = false;
  const next = edges.map((edge) => {
    const index = counters.get(edge.source) ?? 0;
    counters.set(edge.source, index + 1);
    const keys = outletKeys?.get(edge.source);
    const bound = keys === undefined ? -1 : keys.indexOf(edge.data?.outlet ?? '');
    // 绑定了选项就用那个出口；没绑定（老图）按顺序落到第 index 个出口，位置至少稳定。
    // 边比选项还多（老图脏数据）时全部挂到最后一个出口，至少能画出来并被校验器拦下。
    const key =
      keys === undefined
        ? String(index)
        : (keys[bound >= 0 ? bound : Math.min(index, keys.length - 1)] ?? String(index));
    const handle = `out-${key}`;
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
      const single = outs[0]!;
      const singleOutlet = single.data?.outlet;
      if (body.type === 'gate' && singleOutlet !== undefined) {
        // 卡点即使只有一条出边也写 branches：outlet 决定人工选中哪个选项时走它。
        // 写 next 会让所有选项都走这条，校验器还会报每个选项都没连线（W_GATE_OPTION_UNWIRED）。
        const previous = body.branches?.find((branch) => branch.id === single.data?.branchId);
        const option = (body.options ?? []).find((item) => item.id === singleOutlet);
        node.branches = [
          {
            ...(previous ?? {}),
            id: previous?.id ?? uniqueBranchId(single.data?.branchId ?? 'b1', new Set<string>()),
            condition: option?.label?.trim() || previous?.condition || '*',
            to: single.target,
            outlet: singleOutlet,
          },
        ];
        delete node.next;
      } else {
        node.next = single.target;
        delete node.branches;
      }
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
        const dataWhen = edge.data?.when;
        const when = dataWhen !== undefined ? (dataWhen.trim() === '' ? undefined : dataWhen.trim()) : previous?.when;
        const branch: Branch =
          previous !== undefined
            ? { ...previous, to: edge.target, condition, ...(outlet !== undefined ? { outlet } : {}) }
            : {
                id: uniqueBranchId(edge.data?.branchId ?? `b${index + 1}`, usedBranchIds),
                condition,
                to: edge.target,
                ...(outlet !== undefined ? { outlet } : {}),
              };
        if (when !== undefined) branch.when = when;
        else delete branch.when;
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
