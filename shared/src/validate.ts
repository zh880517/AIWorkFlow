// 图 DSL 校验：硬拒（不许保存）与警告（允许保存）两档（设计文档 §9.1）
//
// 终止性分析说明：合法终点有两种——显式 end 节点，或无 branches 且无 next 的隐式 end。
// "环无逃生出口"与"存在无法终止的路径"合并为一个判定：从 entry 可达的节点中，
// 若存在无法到达任何终点的节点（含经 onLimitExceeded 逃生边），判硬拒。
import type { Flow, FlowNode, SubflowDef } from './types.js';
import { parseWhen } from './when.js';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  nodeId?: string;
}

export interface ValidationResult {
  /** 无硬拒时为 true */
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const TERMINAL_TYPES = new Set(['end']);
const SUBAGENT_MODES = new Set(['inline', 'subflow', 'flowRef']);
const OUTCOMES = new Set(['success', 'fail']);

export function validateFlow(flow: Flow): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const err = (code: string, message: string, nodeId?: string) =>
    errors.push({ severity: 'error', code, message, nodeId });
  const warn = (code: string, message: string, nodeId?: string) =>
    warnings.push({ severity: 'warning', code, message, nodeId });

  if (!flow.id || typeof flow.id !== 'string') err('E_FLOW_ID', '图缺少 id');
  if (!flow.name || typeof flow.name !== 'string') err('E_FLOW_NAME', '图缺少 name');
  if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
    err('E_NO_NODES', '图没有任何节点');
    return finish(errors, warnings);
  }

  // --- 节点 id 唯一性 ---
  const byId = new Map<string, FlowNode>();
  for (const node of flow.nodes) {
    if (byId.has(node.id)) err('E_DUP_NODE', `节点 id 重复：${node.id}`, node.id);
    byId.set(node.id, node);
  }

  // --- entry ---
  if (!flow.entry) {
    err('E_NO_ENTRY', '图缺少 entry');
  } else if (!byId.has(flow.entry)) {
    err('E_NO_ENTRY', `entry "${flow.entry}" 不存在于节点表中`, flow.entry);
  }

  // --- 角色表（P1）：id 唯一、章程非空、产物 key 合法 ---
  const agentIds = new Set<string>();
  if (flow.agents !== undefined) {
    if (!Array.isArray(flow.agents)) {
      err('E_AGENTS', 'flow.agents 必须是数组');
    } else {
      for (const agent of flow.agents) {
        if (!agent.id || !/^[A-Za-z0-9_]+$/.test(agent.id)) {
          err('E_AGENT_ID', `角色 id 缺失或含非法字符：${agent.id ?? '（空）'}`);
        } else if (agentIds.has(agent.id)) {
          err('E_DUP_AGENT', `角色 id 重复：${agent.id}`, agent.id);
        } else {
          agentIds.add(agent.id);
        }
        if (!agent.name?.trim()) err('E_AGENT_FIELD', `角色 "${agent.id}" 缺少 name`, agent.id);
        if (!agent.charter?.trim()) err('E_AGENT_FIELD', `角色 "${agent.id}" 缺少 charter`, agent.id);
        validateKeyList(agent.produces, `角色 "${agent.id}" 的 produces`, err, agent.id);
        validateKeyList(agent.consumes, `角色 "${agent.id}" 的 consumes`, err, agent.id);
      }
    }
  }

  // --- 逐节点结构校验 ---
  for (const node of flow.nodes) validateNode(node, byId, err, warn, agentIds);

  // --- 产物声明：消费的 key 至少有一个生产者（只警告，允许跨图交接） ---
  const produced = new Set<string>();
  for (const agent of flow.agents ?? []) for (const key of agent.produces ?? []) produced.add(key);
  for (const node of flow.nodes) {
    if (node.type === 'subagent') for (const key of node.produces ?? []) produced.add(key);
  }
  for (const agent of flow.agents ?? []) {
    for (const key of agent.consumes ?? []) {
      if (!produced.has(key)) warn('W_ARTIFACT_NO_PRODUCER', `角色 "${agent.id}" 消费的产物 "${key}" 在图里没有生产者`, agent.id);
    }
  }
  for (const node of flow.nodes) {
    if (node.type !== 'subagent') continue;
    for (const key of node.consumes ?? []) {
      if (!produced.has(key)) warn('W_ARTIFACT_NO_PRODUCER', `节点 "${node.id}" 消费的产物 "${key}" 在图里没有生产者`, node.id);
    }
  }

  // --- 可达性：从 entry 出发的边（branches.to / next / onLimitExceeded） ---
  const edges = buildEdgeMap(flow.nodes);
  const reachable = reachableFrom(flow.entry, edges);
  for (const node of flow.nodes) {
    if (!reachable.has(node.id)) {
      err('E_UNREACHABLE', `孤立节点：从 entry 不可达（${node.id}）`, node.id);
    }
  }

  // --- 终止性：无法到达任何终点的可达节点 ---
  const terminals = flow.nodes.filter(isTerminal).map((n) => n.id);
  if (terminals.length === 0) {
    err('E_NO_TERMINAL', '图中不存在任何终点（显式 end 或隐式出口）');
  } else {
    const canTerminate = reverseReachable(terminals, edges);
    for (const node of flow.nodes) {
      if (reachable.has(node.id) && !canTerminate.has(node.id)) {
        err(
          'E_NO_TERMINATION',
          `节点 "${node.id}" 无法到达任何终点（环无逃生出口或死路）`,
          node.id,
        );
      }
    }
  }

  // --- 环上节点缺 iterationLimit（警告档） ---
  const cycleNodes = nodesOnCycle(flow.nodes, edges);
  for (const id of cycleNodes) {
    const node = byId.get(id)!;
    if (node.iterationLimit === undefined) {
      warn('W_CYCLE_NO_LIMIT', `节点在环上但未配置 iterationLimit：${id}`, id);
    }
  }

  return finish(errors, warnings);
}

function finish(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

function validateKeyList(
  keys: string[] | undefined,
  where: string,
  err: ErrFn,
  nodeId?: string,
): void {
  if (keys === undefined) return;
  if (!Array.isArray(keys)) {
    err('E_ARTIFACT_KEY', `${where} 必须是字符串数组`, nodeId);
    return;
  }
  const seen = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_]+$/.test(key)) {
      err('E_ARTIFACT_KEY', `${where} 含非法 key：${JSON.stringify(key)}（只允许字母/数字/下划线）`, nodeId);
    } else if (seen.has(key)) {
      err('E_ARTIFACT_KEY', `${where} 重复声明 key：${key}`, nodeId);
    } else {
      seen.add(key);
    }
  }
}

type ErrFn = (code: string, message: string, nodeId?: string) => void;
type WarnFn = (code: string, message: string, nodeId?: string) => void;

function validateNode(
  node: FlowNode,
  byId: Map<string, FlowNode>,
  err: ErrFn,
  warn: WarnFn,
  agentIds: Set<string> = new Set(),
): void {
  const id = node.id;

  // 分支与 next 的互斥 / 引用有效性
  if (node.branches !== undefined && node.next !== undefined) {
    err('E_BOTH_BRANCHES_NEXT', `节点 "${id}" 同时声明了 branches 和 next`, id);
  }
  if (node.next !== undefined && !byId.has(node.next)) {
    err('E_BAD_REF', `next 指向不存在的节点：${node.next}`, id);
  }
  if (node.onLimitExceeded !== undefined && !byId.has(node.onLimitExceeded)) {
    err('E_BAD_REF', `onLimitExceeded 指向不存在的节点：${node.onLimitExceeded}`, id);
  }
  if (node.iterationLimit !== undefined) {
    if (!Number.isInteger(node.iterationLimit) || node.iterationLimit < 1) {
      err('E_BAD_ITERATION_LIMIT', `iterationLimit 必须为正整数：${node.iterationLimit}`, id);
    }
    if (node.onLimitExceeded === undefined) {
      warn('W_LIMIT_NO_ESCAPE', `节点 "${id}" 配了 iterationLimit 但没有 onLimitExceeded，撞上限时将判 run 失败`, id);
    }
  }

  // 分支结构
  if (node.branches !== undefined) {
    const branchIds = new Set<string>();
    let defaults = 0;
    let whenCount = 0;
    for (const branch of node.branches) {
      if (!branch.id) err('E_BRANCH_ID', `节点 "${id}" 存在缺少 id 的分支`, id);
      else if (branchIds.has(branch.id)) {
        err('E_DUP_BRANCH', `分支 id 重复：${branch.id}（节点 ${id}）`, id);
      } else branchIds.add(branch.id);
      if (!branch.condition || !branch.condition.trim()) {
        err('E_EMPTY_CONDITION', `分支 "${branch.id}" 的 condition 为空（节点 ${id}）`, id);
      }
      if (branch.condition === '*') defaults++;
      if (branch.to === undefined || !byId.has(branch.to)) {
        err('E_BAD_REF', `分支 "${branch.id}" 指向不存在的节点：${branch.to}（节点 ${id}）`, id);
      }
      if (branch.when !== undefined) {
        whenCount++;
        if (branch.condition === '*') {
          err('E_WHEN_DEFAULT', `默认分支 "${branch.id}" 不应再配 when（默认分支由“其他都不命中”兜底）`, id);
        } else {
          const parsed = parseWhen(branch.when);
          if (!parsed.ok) {
            err('E_BAD_WHEN', `分支 "${branch.id}" 的 when 不合法：${parsed.error}`, id);
          }
        }
      }
    }
    if (defaults > 1) err('E_MULTI_DEFAULT', `节点 "${id}" 有多个 default（"*"）分支`, id);
    if (whenCount > 1) {
      warn(
        'W_WHEN_OVERLAP',
        `节点 "${id}" 有 ${whenCount} 条 when 分支；按声明顺序取第一个命中的，重叠时后面的不会生效`,
        id,
      );
    }
    if (defaults === 0 && node.type !== 'gate') {
      // 卡点例外：出口由人工选择，无兜底分支语义
      warn('W_NO_DEFAULT', `节点 "${id}" 的分支缺少 default（"*"），全部不满足时 run 将判失败`, id);
    }
  }

  // 类型专有字段
  switch (node.type) {
    case 'prompt':
      if (!node.instruction?.trim()) err('E_TYPE_FIELD', `prompt 节点 "${id}" 缺少 instruction`, id);
      break;
    case 'tool':
      if (!node.toolName?.trim()) err('E_TYPE_FIELD', `tool 节点 "${id}" 缺少 toolName`, id);
      break;
    case 'end':
      if (node.branches !== undefined || node.next !== undefined) {
        err('E_END_WITH_EXIT', `end 节点 "${id}" 不应有出口`, id);
      }
      if (!OUTCOMES.has(node.outcome)) {
        err('E_TYPE_FIELD', `end 节点 "${id}" 的 outcome 必须是 success 或 fail`, id);
      }
      break;
    case 'gate': {
      if (!node.question?.trim()) err('E_TYPE_FIELD', `gate 节点 "${id}" 缺少 question`, id);
      if (!Array.isArray(node.options) || node.options.length === 0) {
        err('E_TYPE_FIELD', `gate 节点 "${id}" 缺少 options`, id);
      } else {
        const optIds = new Set<string>();
        for (const opt of node.options) {
          if (!opt.id || optIds.has(opt.id)) {
            err('E_TYPE_FIELD', `gate 节点 "${id}" 的 option id 缺失或重复：${opt.id}`, id);
          } else optIds.add(opt.id);
          if (!opt.label?.trim()) {
            err('E_TYPE_FIELD', `gate 节点 "${id}" 的 option "${opt.id}" 缺少 label`, id);
          }
        }
        // 选项没连出口：人工选中它时 run 只能判失败（决策仍会记录），存图时先警告
        for (const opt of node.options) {
          const wired = (node.branches ?? []).some((b) => b.outlet === opt.id || b.id === opt.id);
          if (!wired) {
            warn('W_GATE_OPTION_UNWIRED', `卡点选项「${opt.label}」（${opt.id}）没有连线，人工选中它时 run 将判失败`, id);
          }
        }
      }
      break;
    }
    case 'join': {
      if (!node.aggregateInstruction?.trim()) {
        err('E_TYPE_FIELD', `join 节点 "${id}" 缺少 aggregateInstruction`, id);
      }
      if (node.waitFor !== undefined) {
        const target = byId.get(node.waitFor);
        if (!target) {
          err('E_BAD_REF', `waitFor 指向不存在的节点：${node.waitFor}（节点 ${id}）`, id);
        } else if (target.type !== 'subagent' || !target.fanOut) {
          warn('W_JOIN_NO_FANOUT', `join "${id}" 的 waitFor 指向的节点 "${target.id}" 不是 fan-out 的 subagent 节点`, id);
        }
      }
      break;
    }
    case 'subagent': {
      if (!node.extraPrompt?.trim()) {
        err('E_TYPE_FIELD', `subagent 节点 "${id}" 缺少 extraPrompt`, id);
      }
      if (!SUBAGENT_MODES.has(node.mode)) {
        err('E_TYPE_FIELD', `subagent 节点 "${id}" 的 mode 非法：${node.mode}`, id);
      }
      if (node.mode === 'subflow' && !node.subflow) {
        err('E_TYPE_FIELD', `subagent 节点 "${id}" mode 为 subflow 但缺少内嵌子图`, id);
      }
      if (node.mode === 'subflow' && node.subflow) validateSubflow(node.subflow, id, err, agentIds);
      if (node.mode === 'flowRef' && !node.flowRef?.trim()) {
        err('E_TYPE_FIELD', `subagent 节点 "${id}" mode 为 flowRef 但缺少 flowRef`, id);
      }
      if (node.fanOut) {
        const { from, count, max } = node.fanOut;
        const hasFrom = from !== undefined;
        const hasCount = count !== undefined;
        if (hasFrom === hasCount) {
          err('E_FANOUT_SOURCE', `fanOut 必须且只能指定 from（插值）或 count（固定数）之一（节点 ${id}）`, id);
        }
        if (max !== undefined && (!Number.isInteger(max) || max < 1)) {
          err('E_FANOUT_SOURCE', `fanOut.max 必须为正整数：${max}（节点 ${id}）`, id);
        }
      }
      if (node.role !== undefined) {
        if (!node.role.trim()) {
          err('E_BAD_ROLE', `subagent 节点 "${id}" 的 role 为空`, id);
        } else if (!agentIds.has(node.role)) {
          err('E_BAD_ROLE', `subagent 节点 "${id}" 引用了不存在的角色：${node.role}`, id);
        }
      }
      if (node.thread !== undefined) {
        if (node.thread === 'role' && node.role === undefined) {
          err('E_THREAD_NEEDS_ROLE', `subagent 节点 "${id}" 的 thread 为 role 但没有指定 role`, id);
        } else if (node.thread !== 'new' && node.thread !== 'role' && !node.thread.trim()) {
          err('E_TYPE_FIELD', `subagent 节点 "${id}" 的 thread 不能为空字符串`, id);
        }
      }
      validateKeyList(node.produces, `subagent 节点 "${id}" 的 produces`, err, id);
      validateKeyList(node.consumes, `subagent 节点 "${id}" 的 consumes`, err, id);
      break;
    }
    default:
      err('E_TYPE_FIELD', `未知节点类型：${(node as { type?: string }).type}（节点 ${id}）`, id);
  }
}

/** 内嵌子图（subflow）递归校验；只做结构校验，节点 id 作用域独立 */
function validateSubflow(subflow: SubflowDef, parentId: string, err: ErrFn, agentIds: Set<string>): void {
  if (!Array.isArray(subflow.nodes) || subflow.nodes.length === 0) {
    err('E_TYPE_FIELD', `subflow（节点 ${parentId}）没有任何节点`, parentId);
    return;
  }
  const byId = new Map<string, FlowNode>();
  for (const node of subflow.nodes) {
    if (byId.has(node.id)) {
      err('E_DUP_NODE', `subflow（节点 ${parentId}）内节点 id 重复：${node.id}`, parentId);
    }
    byId.set(node.id, node);
  }
  if (!subflow.entry || !byId.has(subflow.entry)) {
    err('E_NO_ENTRY', `subflow（节点 ${parentId}）的 entry 缺失或不存在：${subflow.entry}`, parentId);
  }
  // 子图内引用自身节点表；嵌套 subflow 继续递归
  const noopWarn: WarnFn = () => {};
  for (const node of subflow.nodes) validateNode(node, byId, err, noopWarn, agentIds);
  const edges = buildEdgeMap(subflow.nodes);
  const reachable = reachableFrom(subflow.entry, edges);
  const terminals = subflow.nodes.filter(isTerminal).map((n) => n.id);
  if (terminals.length === 0) {
    err('E_NO_TERMINAL', `subflow（节点 ${parentId}）不存在任何终点`, parentId);
  } else {
    const canTerminate = reverseReachable(terminals, edges);
    for (const node of subflow.nodes) {
      if (reachable.has(node.id) && !canTerminate.has(node.id)) {
        err('E_NO_TERMINATION', `subflow（节点 ${parentId}）内节点 "${node.id}" 无法到达任何终点`, parentId);
      }
    }
  }
}

/** 终点：显式 end，或无 branches 且无 next 的隐式 end */
function isTerminal(node: FlowNode): boolean {
  if (TERMINAL_TYPES.has(node.type)) return true;
  return node.branches === undefined && node.next === undefined;
}

/** 边表：branches.to + next + onLimitExceeded（逃生边参与终止性分析） */
function buildEdgeMap(nodes: FlowNode[]): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const node of nodes) {
    const targets: string[] = [];
    if (node.next !== undefined) targets.push(node.next);
    for (const branch of node.branches ?? []) {
      if (branch.to !== undefined) targets.push(branch.to);
    }
    if (node.onLimitExceeded !== undefined) targets.push(node.onLimitExceeded);
    edges.set(node.id, targets);
  }
  return edges;
}

function reachableFrom(start: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const to of edges.get(id) ?? []) queue.push(to);
  }
  return seen;
}

/** 从终点反向遍历：能到达终点的节点集合 */
function reverseReachable(terminals: string[], edges: Map<string, string[]>): Set<string> {
  const reverse = new Map<string, string[]>();
  for (const [from, targets] of edges) {
    for (const to of targets) {
      const list = reverse.get(to) ?? [];
      list.push(from);
      reverse.set(to, list);
    }
  }
  const seen = new Set<string>(terminals);
  const queue = [...terminals];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const from of reverse.get(id) ?? []) {
      if (!seen.has(from)) {
        seen.add(from);
        queue.push(from);
      }
    }
  }
  return seen;
}

/** 位于环上的节点（沿 branches/next 边能回到自身） */
function nodesOnCycle(nodes: FlowNode[], edges: Map<string, string[]>): Set<string> {
  const onCycle = new Set<string>();
  for (const node of nodes) {
    if (reachableExcludingStart(node.id, edges)) onCycle.add(node.id);
  }
  return onCycle;
}

/** start 的后继能否回到 start */
function reachableExcludingStart(start: string, edges: Map<string, string[]>): boolean {
  const seen = new Set<string>();
  const queue = [...(edges.get(start) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (id === start) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const to of edges.get(id) ?? []) queue.push(to);
  }
  return false;
}
