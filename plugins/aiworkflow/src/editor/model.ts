// 画布 <-> DSL 的双向映射。画布只持有布局与标题，节点本体（instruction/options/...）保存在 bodies 里，
// 保存时按边重建 next/branches，其余字段原样保留（不丢掉其它工具写入的 outlets/params 等）。
import type { Branch, FanOutConfig, Flow, FlowNode, NodeType, SubflowDef } from '@shared/index.js';
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

/** 属性面板可折叠的「高级」分组 id */
export type InspectorGroupId = 'runtime' | 'contract' | 'fanout' | 'loop';

/**
 * 属性面板概览 chip：把运行时关键配置压成一行，不展开高级分组也能读到。
 * group 指向点击后要展开的分组；action 表示 chip 自带动作（如直接打开子图）。
 */
export interface NodeSummaryChip {
  key: 'runtime' | 'mode' | 'artifacts' | 'subflow' | 'fanout' | 'loop' | 'branches';
  label: string;
  group?: InspectorGroupId;
  action?: 'open-subflow';
}

/** 线程摘要：省掉「一次性」这种默认值，避免每个节点都多一个无信息 chip */
export function threadSummary(thread: string | undefined): string | undefined {
  if (thread === undefined || thread.trim() === '' || thread === 'new') return undefined;
  return `线程 ${thread}`;
}

export function artifactSummary(
  produces: string[] | undefined,
  consumes: string[] | undefined,
): string | undefined {
  const from = (produces ?? []).filter((key) => key.trim() !== '');
  const to = (consumes ?? []).filter((key) => key.trim() !== '');
  if (from.length === 0 && to.length === 0) return undefined;
  if (from.length > 0 && to.length > 0) return `${from.join('/')} → ${to.join('/')}`;
  return from.length > 0 ? `产出 ${from.join('/')}` : `消费 ${to.join('/')}`;
}

export function fanoutSummary(fanOut: FanOutConfig | undefined): string | undefined {
  if (fanOut === undefined) return undefined;
  if (fanOut.from !== undefined && fanOut.from.trim() !== '') return `并行 ${fanOut.from}`;
  if (fanOut.count !== undefined && fanOut.max !== undefined) return `并行 ${fanOut.count} 项 ≤${fanOut.max}`;
  if (fanOut.count !== undefined) return `并行 ${fanOut.count} 项`;
  if (fanOut.max !== undefined) return `并行 ≤${fanOut.max}`;
  return undefined;
}

export function loopSummary(node: FlowNode): string | undefined {
  const parts: string[] = [];
  if (node.loopId !== undefined && node.loopId !== '') parts.push(`回路 ${node.loopId}`);
  else if (node.maxRounds !== undefined) parts.push('回路');
  if (node.maxRounds !== undefined) parts.push(`≤${node.maxRounds}`);
  if (node.iterationLimit !== undefined) parts.push(`迭代 ≤${node.iterationLimit}`);
  if (node.onLimitExceeded !== undefined) parts.push(`→ ${node.onLimitExceeded}`);
  return parts.length === 0 ? undefined : parts.join(' ');
}

/** 概览 chip 的数据源：纯函数，便于单测与后续复用（运行图卡片等） */
export function summarizeNode(
  node: FlowNode,
  context: { edgeCount?: number; flowNames?: Record<string, string> } = {},
): NodeSummaryChip[] {
  const chips: NodeSummaryChip[] = [];
  if (node.type === 'subagent') {
    const runtime = [node.role, threadSummary(node.thread)].filter((part): part is string => part !== undefined);
    if (runtime.length > 0) chips.push({ key: 'runtime', label: runtime.join(' · '), group: 'runtime' });
    if (node.mode === 'flowRef' && node.flowRef !== undefined && node.flowRef !== '') {
      const name = context.flowNames?.[node.flowRef];
      chips.push({ key: 'mode', label: `引用 ${name ?? node.flowRef}` });
    }
    const artifacts = artifactSummary(node.produces, node.consumes);
    if (artifacts !== undefined) chips.push({ key: 'artifacts', label: artifacts, group: 'contract' });
    if (node.subflow !== undefined) {
      chips.push({
        key: 'subflow',
        label: `子图 ${node.subflow.nodes.length} 节点`,
        action: 'open-subflow',
      });
    }
    const fanout = fanoutSummary(node.fanOut);
    if (fanout !== undefined) chips.push({ key: 'fanout', label: fanout, group: 'fanout' });
  }
  const loop = loopSummary(node);
  if (loop !== undefined) chips.push({ key: 'loop', label: loop, group: 'loop' });
  const branchCount = node.type === 'gate' ? node.options.length : (context.edgeCount ?? 0);
  if (branchCount > 1) {
    chips.push({
      key: 'branches',
      label: node.type === 'gate' ? `${branchCount} 个选项` : `${branchCount} 条分支`,
    });
  }
  return chips;
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

/** 评审回路：子 Agent 内先评审，不通过则按 issues 修订后复审；超轮次直接结束 */
export function makeReviewSubflow(): SubflowDef {
  return {
    name: '评审回路',
    entry: 'review',
    nodes: [
      {
        id: 'review',
        type: 'prompt',
        title: '评审',
        instruction: '按评审标准逐条检查，输出 verdict（pass/fail）与 issues；pass 才允许进入下一阶段。',
        branches: [
          { id: 'pass', condition: '评审通过', to: 'done' },
          { id: 'fix', condition: '*', to: 'fix' },
        ],
        loopId: 'review-loop',
        maxRounds: 3,
        iterationLimit: 3,
        onLimitExceeded: 'done',
      },
      {
        id: 'fix',
        type: 'prompt',
        title: '按评审意见修订',
        instruction: '按上一轮 issues 逐条修订，然后在 summary 里说明改了什么。',
        next: 'review',
        loopId: 'review-loop',
      },
      { id: 'done', type: 'end', title: '评审结束', outcome: 'success' },
    ],
    _ui: {
      positions: {
        review: { x: 80, y: 90 },
        fix: { x: 380, y: 90 },
        done: { x: 680, y: 90 },
      },
    },
  };
}

/** 测试回路：子 Agent 内执行测试，失败按 failureType 修复后重测；超轮次结束 */
export function makeTestSubflow(): SubflowDef {
  return {
    name: '测试回路',
    entry: 'test',
    nodes: [
      {
        id: 'test',
        type: 'prompt',
        title: '执行测试',
        instruction: '按验收标准执行测试，输出 verdict（pass/fail）与 failureType（impl/design/env）。',
        branches: [
          { id: 'pass', condition: '测试通过', to: 'done' },
          { id: 'fix', condition: '*', to: 'fix' },
        ],
        loopId: 'test-loop',
        maxRounds: 4,
        iterationLimit: 4,
        onLimitExceeded: 'done',
      },
      {
        id: 'fix',
        type: 'prompt',
        title: '按失败类型修复',
        instruction: 'impl 改代码；design 回到设计；env 重跑测试。修完回到测试。',
        next: 'test',
        loopId: 'test-loop',
      },
      { id: 'done', type: 'end', title: '测试结束', outcome: 'success' },
    ],
    _ui: {
      positions: {
        test: { x: 80, y: 90 },
        fix: { x: 380, y: 90 },
        done: { x: 680, y: 90 },
      },
    },
  };
}

export type TemplateKind = 'review' | 'test';

export interface FlowTemplate {
  kind: TemplateKind;
  label: string;
  hint: string;
  title: string;
  extraPrompt: string;
  reportHint: string;
  produces: string;
  subflow: () => SubflowDef;
}

export const TEMPLATES: FlowTemplate[] = [
  {
    kind: 'review',
    label: '评审回路',
    hint: '插入一个带内嵌评审子图的子 Agent + 完成节点；子图内是评审→修订→复审的回路',
    title: '评审回路',
    extraPrompt: '按评审标准检查当前交付物，输出 verdict（pass/fail）与 issues；不通过时给出可执行的修订项。',
    reportHint: 'payload 带 verdict（pass/fail）与 issues[]；需要修订时把 issues 写具体。',
    produces: 'review',
    subflow: makeReviewSubflow,
  },
  {
    kind: 'test',
    label: '测试回路',
    hint: '插入一个带内嵌测试子图的子 Agent + 完成节点；子图内按失败类型修复后重测',
    title: '测试回路',
    extraPrompt: '按验收标准执行测试，失败时归类为 impl/design/env，并驱动对应修复后重测。',
    reportHint: 'payload 带 verdict（pass/fail）与 failureType（impl/design/env）。',
    produces: 'test',
    subflow: makeTestSubflow,
  },
];

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
      // 这条边本来就属于一个分支（body 里有 branches，或边上带 branchId/condition/when）：
      // 即使只剩一条也要保留 branches，否则 when/outlet 会被静默降级成 next。
      const meta = single.data ?? {};
      const wasBranch =
        (body.branches?.length ?? 0) > 0 ||
        meta.branchId !== undefined ||
        meta.condition !== undefined ||
        meta.when !== undefined;
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
      } else if (wasBranch) {
        const previous = body.branches?.find((branch) => branch.id === meta.branchId);
        const dataCondition = meta.condition;
        const condition = dataCondition !== undefined ? dataCondition : (previous?.condition ?? '*');
        const branch: Branch = {
          ...(previous ?? {}),
          id: previous?.id ?? uniqueBranchId(meta.branchId ?? 'b1', new Set<string>()),
          condition,
          to: single.target,
        };
        // 显式清空（''）表示用户删掉了出口绑定，不能再从旧分支复活
        const rawOutlet = meta.outlet;
        const outlet = rawOutlet !== undefined ? (rawOutlet === '' ? undefined : rawOutlet) : previous?.outlet;
        if (outlet !== undefined) branch.outlet = outlet;
        const dataWhen = meta.when;
        const when = dataWhen !== undefined ? (dataWhen.trim() === '' ? undefined : dataWhen.trim()) : previous?.when;
        if (when !== undefined) branch.when = when;
        else delete branch.when;
        node.branches = [branch];
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
          dataCondition !== undefined ? dataCondition : (previous?.condition ?? (index === 0 ? '*' : ''));
        // 显式清空（''）就保持空，让校验器统一报 E_EMPTY_CONDITION；不要偷偷补成 '*'。
        const condition = rawCondition;
        // 卡点的出口绑定（option id）优先取这次在面板里选的；'' = 显式清除，不能再从旧分支复活
        const rawOutlet = edge.data?.outlet;
        const outlet = rawOutlet !== undefined ? (rawOutlet === '' ? undefined : rawOutlet) : previous?.outlet;
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
