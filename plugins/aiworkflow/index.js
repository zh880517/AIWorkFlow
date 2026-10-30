import crypto, { randomUUID } from "node:crypto";
import fs from "node:fs";
import path, { join } from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
//#region
var ACTIVE_STATUSES = [
	"running",
	"waiting_gate",
	"waiting_children"
];
function isActiveStatus(status) {
	return ACTIVE_STATUSES.includes(status);
}
var LIST_SQL = `SELECT r.*, f.name AS flow_name, f.kind AS flow_kind
  FROM runs r LEFT JOIN flows f ON f.id = r.flow_id`;
function asRunRow(raw) {
	return raw;
}
function listRuns(db, limit = 60, hostSession) {
	const session = typeof hostSession === "string" && hostSession !== "" ? hostSession : null;
	const sql = `${LIST_SQL}${session === null ? "" : " WHERE r.host_session = ?"} ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?`;
	return (session === null ? db.prepare(sql).all(limit) : db.prepare(sql).all(session, limit)).map((row) => toListItem(asRunRow(row)));
}
function loadSnapshot$1(db, hash) {
	const row = db.prepare("SELECT content FROM flow_snapshots WHERE hash = ?").get(hash);
	if (row === void 0) return void 0;
	try {
		return JSON.parse(row.content);
	} catch {
		return;
	}
}
function getRunDetail(db, runId) {
	const raw = db.prepare(`${LIST_SQL} WHERE r.id = ?`).get(runId);
	if (raw === void 0 || raw === null) return void 0;
	const row = asRunRow(raw);
	const snapshot = loadSnapshot$1(db, row.flow_snapshot_hash) ?? null;
	const executions = db.prepare("SELECT id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at FROM node_executions WHERE run_id = ? ORDER BY id").all(runId);
	const gateRows = db.prepare("SELECT id, node_id, question, option_id, note, source, decided_at FROM gate_decisions WHERE run_id = ? ORDER BY id").all(runId);
	const pendingGate = resolvePendingGate(row, snapshot, gateRows);
	const rootId = row.root_run_id ?? row.id;
	const artifacts = db.prepare("SELECT key, version, summary, path, role, created_at FROM run_artifacts WHERE root_run_id = ? ORDER BY key, version").all(rootId);
	const childRows = db.prepare(`${LIST_SQL} WHERE r.parent_run_id = ? ORDER BY r.created_at, r.rowid`).all(runId);
	return {
		...toListItem(row),
		snapshotHash: row.flow_snapshot_hash,
		outcome: row.outcome ?? deriveOutcome(row, snapshot),
		snapshot,
		executions: executions.map(toExecution),
		gates: gateRows.map(toGate),
		pendingGate,
		children: childRows.map((child) => toListItem(asRunRow(child))),
		artifacts: artifacts.map((item) => ({
			key: item.key,
			version: item.version,
			summary: item.summary,
			path: item.path,
			role: item.role,
			createdAt: item.created_at
		}))
	};
}
function readMonitorState(db, selectedId, limits = {}, hostSession) {
	const all = listRuns(db, limits.runs ?? 60, hostSession ?? null);
	const active = all.filter((r) => isActiveStatus(r.status)).slice(0, limits.list ?? 8);
	const recent = all.filter((r) => !isActiveStatus(r.status)).slice(0, limits.list ?? 8);
	const requested = selectedId !== null && selectedId !== void 0 && (hostSession === null || hostSession === void 0 || runSessionOf(db, selectedId) === hostSession) ? selectedId : void 0;
	const rootActive = active.filter((r) => r.parentRunId === null);
	const rootRecent = recent.filter((r) => r.parentRunId === null);
	const chosen = requested ?? rootActive[0]?.id ?? rootRecent[0]?.id ?? active[0]?.id ?? recent[0]?.id ?? null;
	return {
		active,
		recent,
		selectedId: chosen,
		detail: chosen === null ? null : getRunDetail(db, chosen) ?? null
	};
}
/** run 所属的会话：child run 取它 root run 的 host_session（child 自己不带）。 */
function runSessionOf(db, runId) {
	return db.prepare(`SELECT COALESCE(root.host_session, r.host_session) AS session
       FROM runs r LEFT JOIN runs root ON root.id = r.root_run_id
       WHERE r.id = ?`).get(runId)?.session;
}
function resolvePendingGate(row, snapshot, gateRows) {
	if (row.current_node === null || !isActiveStatus(row.status)) return null;
	const pending = gateRows.find((g) => g.node_id === row.current_node && g.decided_at === null);
	if (pending === void 0) return null;
	const node = (snapshot?.flows[snapshot.rootFlowId])?.nodes.find((n) => n.id === pending.node_id);
	return {
		gateId: pending.id,
		nodeId: pending.node_id,
		question: pending.question ?? "",
		options: node !== void 0 && node.type === "gate" ? node.options.map((o) => ({
			id: o.id,
			label: o.label
		})) : []
	};
}
/** v3 之前完成的 run 没有 outcome，从快照终点推导（只读，不回写） */
function deriveOutcome(row, snapshot) {
	if (row.status !== "completed") return null;
	if (row.current_node === null) return "success";
	const end = (snapshot?.flows[snapshot.rootFlowId])?.nodes.find((n) => n.id === row.current_node);
	return end !== void 0 && end.type === "end" ? end.outcome : null;
}
function toExecution(e) {
	return {
		id: e.id,
		nodeId: e.node_id,
		iteration: e.iteration,
		status: e.status,
		summary: e.summary,
		payload: parsePayload(e.payload ?? ""),
		branchId: e.branch_id,
		startedAt: e.started_at,
		finishedAt: e.finished_at
	};
}
function toGate(g) {
	return {
		id: g.id,
		nodeId: g.node_id,
		question: g.question,
		optionId: g.option_id,
		note: g.note,
		source: g.decided_at === null ? null : g.source,
		decidedAt: g.decided_at
	};
}
function toListItem(row) {
	return {
		id: row.id,
		parentRunId: row.parent_run_id,
		parentNode: row.parent_node ?? null,
		rootRunId: row.root_run_id ?? row.id,
		flowId: row.flow_id,
		flowName: row.flow_name,
		flowKind: row.flow_kind === "agent" ? "agent" : row.flow_kind === "flow" ? "flow" : null,
		status: row.status,
		outcome: row.outcome,
		currentNode: row.current_node,
		cwd: row.cwd,
		projectName: row.project_name,
		stepsUsed: row.steps_used,
		role: row.role ?? null,
		threadId: row.thread_id ?? null,
		parentIteration: row.parent_iteration ?? null,
		createdAt: row.created_at,
		lastActivity: row.last_activity,
		finishedAt: row.finished_at
	};
}
function parsePayload(raw) {
	if (raw === "") return {};
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}
/** 大 payload 不整包下发，避免面板轮询被单步输出拖慢 */
function trimPayload(value, maxChars = 4e3) {
	const text = JSON.stringify(value);
	if (text === void 0 || text.length <= maxChars) return value;
	return {
		__truncated: true,
		size: text.length,
		preview: text.slice(0, maxChars)
	};
}
//#endregion
//#region
var OPS = [
	"==",
	"!=",
	">=",
	"<=",
	">",
	"<",
	"contains",
	"in",
	"truthy",
	"empty"
];
var EXPR_RE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;
/** 解析一条 when；校验器与引擎共用，避免两套语法 */
function parseWhen(text) {
	const raw = text.trim();
	if (raw === "") return {
		ok: false,
		error: "when 为空"
	};
	const match = /^\{\{\s*([^{}]+?)\s*\}\}\s*(==|!=|>=|<=|>|<|contains|in|truthy|empty)\s*(.*)$/.exec(raw);
	if (match === null) return {
		ok: false,
		error: `when 语法应为 "{{表达式}} 运算符 值"（运算符：${OPS.join(" / ")}）`
	};
	const left = match[1].trim();
	const op = match[2];
	const rest = match[3].trim();
	if (!EXPR_RE.test(left)) return {
		ok: false,
		error: `when 左侧不是合法插值表达式：{{${left}}}`
	};
	if (op === "truthy" || op === "empty") {
		if (rest !== "") return {
			ok: false,
			error: `${op} 不接受右侧值`
		};
		return {
			ok: true,
			expr: {
				left,
				op
			}
		};
	}
	if (rest === "") return {
		ok: false,
		error: `${op} 缺少右侧值`
	};
	const rhs = parseRight(rest);
	if (rhs === null) return {
		ok: false,
		error: `when 右侧值不合法：${rest}。字符串要加引号，数字/布尔/null 直接写，或写成 {{表达式}}`
	};
	if (rhs.expr !== void 0) return {
		ok: true,
		expr: {
			left,
			op,
			rightExpr: rhs.expr
		}
	};
	return {
		ok: true,
		expr: {
			left,
			op,
			right: rhs.value
		}
	};
}
function parseRight(text) {
	if (text.startsWith("{{") && text.endsWith("}}")) {
		const expr = text.slice(2, -2).trim();
		return EXPR_RE.test(expr) ? { expr } : null;
	}
	if (text.startsWith("'") && text.endsWith("'") && text.length >= 2 || text.startsWith("\"") && text.endsWith("\"") && text.length >= 2) return { value: text.slice(1, -1).replace(/\\(['"\\])/g, "$1") };
	if (text === "true") return { value: true };
	if (text === "false") return { value: false };
	if (text === "null") return { value: null };
	if (/^-?\d+(?:\.\d+)?$/.test(text)) return { value: Number(text) };
	return null;
}
/** 判定一条 when；lookup 由引擎提供（节点 payload / artifacts / inputs） */
function evaluateWhen(text, lookup) {
	const parsed = parseWhen(text);
	if (!parsed.ok) return {
		value: false,
		error: parsed.error
	};
	const { left, op, right, rightExpr } = parsed.expr;
	const lhs = lookup(left);
	const rhs = rightExpr !== void 0 ? lookup(rightExpr) : right;
	if (op === "truthy") return { value: truthy(lhs) };
	if (op === "empty") return { value: !truthy(lhs) };
	if (lhs === void 0 || rhs === void 0) return { value: false };
	switch (op) {
		case "==": return { value: looseEqual(lhs, rhs) };
		case "!=": return { value: !looseEqual(lhs, rhs) };
		case ">":
		case ">=":
		case "<":
		case "<=": {
			const a = toNumber(lhs);
			const b = toNumber(rhs);
			if (a === null || b === null) return { value: false };
			if (op === ">") return { value: a > b };
			if (op === ">=") return { value: a >= b };
			if (op === "<") return { value: a < b };
			return { value: a <= b };
		}
		case "contains": return { value: contains(lhs, rhs) };
		case "in": return { value: oneOf(lhs, rhs) };
		default: return { value: false };
	}
}
/** 按分支声明顺序选第一条命中的 when；返回命中的分支 id 与未命中原因 */
function matchWhenBranch(branches, lookup) {
	for (const branch of branches) {
		if (branch.when === void 0) continue;
		if (!evaluateWhen(branch.when, lookup).value) continue;
		return { branchId: branch.id };
	}
	return { branchId: null };
}
function truthy(value) {
	if (value === void 0 || value === null || value === false || value === "") return false;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}
function toNumber(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}
function looseEqual(a, b) {
	const na = toNumber(a);
	const nb = toNumber(b);
	if (na !== null && nb !== null) return na === nb;
	return String(a) === String(b);
}
function contains(haystack, needle) {
	if (Array.isArray(haystack)) return haystack.some((item) => looseEqual(item, needle));
	if (typeof haystack === "string") return haystack.includes(String(needle));
	if (haystack !== null && typeof haystack === "object") return JSON.stringify(haystack).includes(String(needle));
	return false;
}
function oneOf(value, candidates) {
	if (Array.isArray(candidates)) return candidates.some((item) => looseEqual(item, value));
	if (typeof candidates === "string") return candidates.split(",").map((item) => item.trim()).filter((item) => item !== "").some((item) => looseEqual(item, value));
	return looseEqual(value, candidates);
}
//#endregion
//#region
var TERMINAL_TYPES = /* @__PURE__ */ new Set(["end"]);
var SUBAGENT_MODES = /* @__PURE__ */ new Set([
	"inline",
	"subflow",
	"flowRef"
]);
var OUTCOMES = /* @__PURE__ */ new Set(["success", "fail"]);
function validateFlow(flow) {
	const errors = [];
	const warnings = [];
	const err = (code, message, nodeId) => errors.push({
		severity: "error",
		code,
		message,
		nodeId
	});
	const warn = (code, message, nodeId) => warnings.push({
		severity: "warning",
		code,
		message,
		nodeId
	});
	if (!flow.id || typeof flow.id !== "string") err("E_FLOW_ID", "图缺少 id");
	else if (/[\\/:*?"<>|\u0000-\u001f]/.test(flow.id) || flow.id === "." || flow.id === ".." || flow.id !== flow.id.trim() || flow.id.endsWith(".")) err("E_FLOW_ID", `图 id 不能包含路径分隔符或文件名非法字符，也不能是 . / ..：${JSON.stringify(flow.id)}`);
	if (!flow.name || typeof flow.name !== "string") err("E_FLOW_NAME", "图缺少 name");
	if (flow.kind !== void 0 && flow.kind !== "flow" && flow.kind !== "agent") err("E_FLOW_KIND", `flow.kind 必须是 flow 或 agent：${String(flow.kind)}`);
	if (flow.maxSteps !== void 0 && (!Number.isInteger(flow.maxSteps) || flow.maxSteps < 1)) err("E_MAX_STEPS", `flow.maxSteps 必须为正整数：${String(flow.maxSteps)}`);
	if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
		err("E_NO_NODES", "图没有任何节点");
		return finish(errors, warnings);
	}
	for (const node of flow.nodes) if (node === null || typeof node !== "object" || typeof node.id !== "string") {
		err("E_NODE_SHAPE", "节点必须是带字符串 id 的对象");
		return finish(errors, warnings);
	}
	for (const node of flow.nodes) if (node.type === "subagent" && node.mode === "flowRef" && node.flowRef === flow.id) err("E_FLOW_REF_SELF", `节点 "${node.id}" 引用了当前图自身`, node.id);
	const byId = /* @__PURE__ */ new Map();
	for (const node of flow.nodes) {
		if (byId.has(node.id)) err("E_DUP_NODE", `节点 id 重复：${node.id}`, node.id);
		byId.set(node.id, node);
	}
	if (!flow.entry) err("E_NO_ENTRY", "图缺少 entry");
	else if (!byId.has(flow.entry)) err("E_NO_ENTRY", `entry "${flow.entry}" 不存在于节点表中`, flow.entry);
	const agentIds = /* @__PURE__ */ new Set();
	if (flow.agents !== void 0) {
		if (!Array.isArray(flow.agents)) err("E_AGENTS", "flow.agents 必须是数组");
		else for (const agent of flow.agents) {
			if (!agent.id || !/^[A-Za-z0-9_]+$/.test(agent.id)) err("E_AGENT_ID", `角色 id 缺失或含非法字符：${agent.id ?? "（空）"}`);
			else if (agentIds.has(agent.id)) err("E_DUP_AGENT", `角色 id 重复：${agent.id}`, agent.id);
			else agentIds.add(agent.id);
			if (!agent.name?.trim()) err("E_AGENT_FIELD", `角色 "${agent.id}" 缺少 name`, agent.id);
			if (!agent.charter?.trim()) err("E_AGENT_FIELD", `角色 "${agent.id}" 缺少 charter`, agent.id);
			validateKeyList(agent.produces, `角色 "${agent.id}" 的 produces`, err, agent.id);
			validateKeyList(agent.consumes, `角色 "${agent.id}" 的 consumes`, err, agent.id);
		}
	}
	if (flow.kind === "agent" && (flow.agents === void 0 || flow.agents.length === 0)) warn("W_AGENT_CONFIG_NO_ROLE", "子 Agent 配置没有角色：内部节点无法引用角色");
	for (const node of flow.nodes) validateNode(node, byId, err, warn, agentIds);
	const loopControllers = validateLoops(flow.nodes, err, warn);
	const produced = /* @__PURE__ */ new Set();
	for (const agent of flow.agents ?? []) for (const key of agent.produces ?? []) produced.add(key);
	for (const node of flow.nodes) if (node.type === "subagent") for (const key of node.produces ?? []) produced.add(key);
	for (const agent of flow.agents ?? []) for (const key of agent.consumes ?? []) if (!produced.has(key)) warn("W_ARTIFACT_NO_PRODUCER", `角色 "${agent.id}" 消费的产物 "${key}" 在图里没有生产者`, agent.id);
	for (const node of flow.nodes) {
		if (node.type !== "subagent") continue;
		for (const key of node.consumes ?? []) if (!produced.has(key)) warn("W_ARTIFACT_NO_PRODUCER", `节点 "${node.id}" 消费的产物 "${key}" 在图里没有生产者`, node.id);
	}
	const edges = buildEdgeMap(flow.nodes);
	const reachable = reachableFrom(flow.entry, edges);
	for (const node of flow.nodes) if (!reachable.has(node.id)) err("E_UNREACHABLE", `孤立节点：从 entry 不可达（${node.id}）`, node.id);
	const terminals = flow.nodes.filter(isTerminal).map((n) => n.id);
	if (terminals.length === 0) err("E_NO_TERMINAL", "图中不存在任何终点（显式 end 或隐式出口）");
	else {
		const canTerminate = reverseReachable(terminals, edges);
		for (const node of flow.nodes) if (reachable.has(node.id) && !canTerminate.has(node.id)) err("E_NO_TERMINATION", `节点 "${node.id}" 无法到达任何终点（环无逃生出口或死路）`, node.id);
	}
	const cycleNodes = nodesOnCycle(flow.nodes, edges);
	for (const id of cycleNodes) {
		const node = byId.get(id);
		if (node.iterationLimit === void 0 && !(node.loopId !== void 0 && loopControllers.has(node.loopId))) warn("W_CYCLE_NO_LIMIT", `节点在环上但未配置 iterationLimit / 回路 maxRounds：${id}`, id);
	}
	return finish(errors, warnings);
}
function finish(errors, warnings) {
	return {
		ok: errors.length === 0,
		errors,
		warnings
	};
}
function validateKeyList(keys, where, err, nodeId) {
	if (keys === void 0) return;
	if (!Array.isArray(keys)) {
		err("E_ARTIFACT_KEY", `${where} 必须是字符串数组`, nodeId);
		return;
	}
	const seen = /* @__PURE__ */ new Set();
	for (const key of keys) if (typeof key !== "string" || !/^[A-Za-z0-9_]+$/.test(key)) err("E_ARTIFACT_KEY", `${where} 含非法 key：${JSON.stringify(key)}（只允许字母/数字/下划线）`, nodeId);
	else if (seen.has(key)) err("E_ARTIFACT_KEY", `${where} 重复声明 key：${key}`, nodeId);
	else seen.add(key);
}
function validateNode(node, byId, err, warn, agentIds = /* @__PURE__ */ new Set()) {
	const id = node.id;
	if (node.branches !== void 0 && node.next !== void 0) err("E_BOTH_BRANCHES_NEXT", `节点 "${id}" 同时声明了 branches 和 next`, id);
	if (node.next !== void 0 && !byId.has(node.next)) err("E_BAD_REF", `next 指向不存在的节点：${node.next}`, id);
	if (node.onLimitExceeded !== void 0 && !byId.has(node.onLimitExceeded)) err("E_BAD_REF", `onLimitExceeded 指向不存在的节点：${node.onLimitExceeded}`, id);
	if (node.iterationLimit !== void 0) {
		if (!Number.isInteger(node.iterationLimit) || node.iterationLimit < 1) err("E_BAD_ITERATION_LIMIT", `iterationLimit 必须为正整数：${node.iterationLimit}`, id);
		if (node.onLimitExceeded === void 0) warn("W_LIMIT_NO_ESCAPE", `节点 "${id}" 配了 iterationLimit 但没有 onLimitExceeded，撞上限时将判 run 失败`, id);
	}
	if (node.loopId !== void 0 && node.loopId.trim() === "") err("E_BAD_LOOP_ID", `loopId 不能为空字符串（节点 ${id}）`, id);
	if (node.maxRounds !== void 0) {
		if (node.loopId === void 0 || node.loopId.trim() === "") err("E_LOOP_ID_REQUIRED", `节点 "${id}" 配了 maxRounds 但没有 loopId；回路控制器必须属于一个回路`, id);
		if (!Number.isInteger(node.maxRounds) || node.maxRounds < 1) err("E_BAD_LOOP_LIMIT", `maxRounds 必须为正整数：${node.maxRounds}（节点 ${id}）`, id);
		if (node.onLimitExceeded === void 0) warn("W_LIMIT_NO_ESCAPE", `节点 "${id}" 配了 maxRounds 但没有 onLimitExceeded，撞上限时将判 run 失败`, id);
	}
	if (node.branches !== void 0 && !Array.isArray(node.branches)) err("E_BRANCHES_TYPE", `节点 "${id}" 的 branches 必须是数组`, id);
	if (Array.isArray(node.branches)) {
		const branchIds = /* @__PURE__ */ new Set();
		let defaults = 0;
		let whenCount = 0;
		const gateOptionIds = node.type === "gate" && Array.isArray(node.options) ? new Set(node.options.map((opt) => opt?.id).filter((value) => typeof value === "string")) : null;
		const usedOutlets = /* @__PURE__ */ new Set();
		for (const branch of node.branches) {
			if (branch === null || typeof branch !== "object") {
				err("E_BRANCH_SHAPE", `节点 "${id}" 存在非对象分支`, id);
				continue;
			}
			if (!branch.id) err("E_BRANCH_ID", `节点 "${id}" 存在缺少 id 的分支`, id);
			else if (branchIds.has(branch.id)) err("E_DUP_BRANCH", `分支 id 重复：${branch.id}（节点 ${id}）`, id);
			else branchIds.add(branch.id);
			if (typeof branch.condition !== "string" || branch.condition.trim() === "") err("E_EMPTY_CONDITION", `分支 "${branch.id}" 的 condition 为空（节点 ${id}）`, id);
			if (branch.condition === "*") defaults++;
			if (branch.to === void 0 || !byId.has(branch.to)) err("E_BAD_REF", `分支 "${branch.id}" 指向不存在的节点：${branch.to}（节点 ${id}）`, id);
			if (branch.outlet !== void 0 && gateOptionIds !== null) {
				if (typeof branch.outlet !== "string" || !gateOptionIds.has(branch.outlet)) err("E_BAD_OUTLET", `分支 "${branch.id}" 的 outlet 指向不存在的选项：${String(branch.outlet)}（节点 ${id}）`, id);
				else if (usedOutlets.has(branch.outlet)) err("E_DUP_OUTLET", `卡点 "${id}" 的选项 ${branch.outlet} 连了多条出口分支`, id);
				else usedOutlets.add(branch.outlet);
			}
			if (branch.when !== void 0) {
				whenCount++;
				if (typeof branch.when !== "string") err("E_BAD_WHEN", `分支 "${branch.id}" 的 when 必须是字符串（节点 ${id}）`, id);
				else if (branch.condition === "*") err("E_WHEN_DEFAULT", `默认分支 "${branch.id}" 不应再配 when（默认分支由“其他都不命中”兜底）`, id);
				else {
					const parsed = parseWhen(branch.when);
					if (!parsed.ok) err("E_BAD_WHEN", `分支 "${branch.id}" 的 when 不合法：${parsed.error}`, id);
				}
			}
		}
		if (defaults > 1) err("E_MULTI_DEFAULT", `节点 "${id}" 有多个 default（"*"）分支`, id);
		if (whenCount > 1) warn("W_WHEN_OVERLAP", `节点 "${id}" 有 ${whenCount} 条 when 分支；按声明顺序取第一个命中的，重叠时后面的不会生效`, id);
		if (defaults === 0 && node.type !== "gate") warn("W_NO_DEFAULT", `节点 "${id}" 的分支缺少 default（"*"），全部不满足时 run 将判失败`, id);
	}
	switch (node.type) {
		case "prompt":
			if (!node.instruction?.trim()) err("E_TYPE_FIELD", `prompt 节点 "${id}" 缺少 instruction`, id);
			break;
		case "tool":
			if (!node.toolName?.trim()) err("E_TYPE_FIELD", `tool 节点 "${id}" 缺少 toolName`, id);
			break;
		case "end":
			if (node.branches !== void 0 || node.next !== void 0) err("E_END_WITH_EXIT", `end 节点 "${id}" 不应有出口`, id);
			if (!OUTCOMES.has(node.outcome)) err("E_TYPE_FIELD", `end 节点 "${id}" 的 outcome 必须是 success 或 fail`, id);
			break;
		case "gate":
			if (!node.question?.trim()) err("E_TYPE_FIELD", `gate 节点 "${id}" 缺少 question`, id);
			if (!Array.isArray(node.options) || node.options.length === 0) err("E_TYPE_FIELD", `gate 节点 "${id}" 缺少 options`, id);
			else {
				const optIds = /* @__PURE__ */ new Set();
				for (const opt of node.options) {
					if (!opt.id || optIds.has(opt.id)) err("E_TYPE_FIELD", `gate 节点 "${id}" 的 option id 缺失或重复：${opt.id}`, id);
					else optIds.add(opt.id);
					if (!opt.label?.trim()) err("E_TYPE_FIELD", `gate 节点 "${id}" 的 option "${opt.id}" 缺少 label`, id);
				}
				for (const opt of node.options) if (!(node.branches ?? []).some((b) => b.outlet === opt.id || b.id === opt.id)) warn("W_GATE_OPTION_UNWIRED", `卡点选项「${opt.label}」（${opt.id}）没有连线，人工选中它时 run 将判失败`, id);
			}
			break;
		case "join":
			if (!node.aggregateInstruction?.trim()) err("E_TYPE_FIELD", `join 节点 "${id}" 缺少 aggregateInstruction`, id);
			if (node.waitFor !== void 0) {
				const target = byId.get(node.waitFor);
				if (!target) err("E_BAD_REF", `waitFor 指向不存在的节点：${node.waitFor}（节点 ${id}）`, id);
				else if (target.type !== "subagent" || !target.fanOut) warn("W_JOIN_NO_FANOUT", `join "${id}" 的 waitFor 指向的节点 "${target.id}" 不是 fan-out 的 subagent 节点`, id);
			}
			break;
		case "subagent":
			if (node.mode === "inline" && !node.extraPrompt?.trim()) err("E_TYPE_FIELD", `subagent 节点 "${id}" 缺少 extraPrompt`, id);
			if (!SUBAGENT_MODES.has(node.mode)) err("E_TYPE_FIELD", `subagent 节点 "${id}" 的 mode 非法：${node.mode}`, id);
			if (node.mode === "subflow" && !node.subflow) err("E_TYPE_FIELD", `subagent 节点 "${id}" mode 为 subflow 但缺少内嵌子图`, id);
			if (node.mode === "subflow" && node.subflow) validateSubflow(node.subflow, id, err, warn, agentIds);
			if (node.mode === "flowRef" && !node.flowRef?.trim()) err("E_TYPE_FIELD", `subagent 节点 "${id}" mode 为 flowRef 但缺少 flowRef`, id);
			if (node.fanOut) {
				const { from, count, max } = node.fanOut;
				if (from !== void 0 === (count !== void 0)) err("E_FANOUT_SOURCE", `fanOut 必须且只能指定 from（插值）或 count（固定数）之一（节点 ${id}）`, id);
				if (max !== void 0 && (!Number.isInteger(max) || max < 1)) err("E_FANOUT_SOURCE", `fanOut.max 必须为正整数：${max}（节点 ${id}）`, id);
				if (count !== void 0 && (!Number.isInteger(count) || count < 1)) err("E_FANOUT_SOURCE", `fanOut.count 必须为正整数：${String(count)}（节点 ${id}）`, id);
			}
			if (node.role !== void 0) {
				if (!node.role.trim()) err("E_BAD_ROLE", `subagent 节点 "${id}" 的 role 为空`, id);
				else if (!agentIds.has(node.role)) err("E_BAD_ROLE", `subagent 节点 "${id}" 引用了不存在的角色：${node.role}`, id);
			}
			if (node.thread !== void 0) {
				if (node.thread === "role" && node.role === void 0) err("E_THREAD_NEEDS_ROLE", `subagent 节点 "${id}" 的 thread 为 role 但没有指定 role`, id);
				else if (node.thread !== "new" && node.thread !== "role" && !node.thread.trim()) err("E_TYPE_FIELD", `subagent 节点 "${id}" 的 thread 不能为空字符串`, id);
			}
			validateKeyList(node.produces, `subagent 节点 "${id}" 的 produces`, err, id);
			validateKeyList(node.consumes, `subagent 节点 "${id}" 的 consumes`, err, id);
			break;
		default: err("E_TYPE_FIELD", `未知节点类型：${node.type}（节点 ${id}）`, id);
	}
}
/** 回路控制器校验：每个 loopId 最多一个 maxRounds 控制器；有 loopId 但无控制器时警告 */
function validateLoops(nodes, err, warn) {
	const controllers = /* @__PURE__ */ new Map();
	const loopIds = /* @__PURE__ */ new Set();
	for (const node of nodes) {
		if (node.loopId === void 0 || node.loopId.trim() === "") continue;
		loopIds.add(node.loopId);
		if (node.maxRounds !== void 0) {
			const list = controllers.get(node.loopId) ?? [];
			list.push(node.id);
			controllers.set(node.loopId, list);
		}
	}
	const first = /* @__PURE__ */ new Map();
	for (const [loopId, ids] of controllers) {
		first.set(loopId, ids[0]);
		if (ids.length > 1) err("E_DUP_LOOP_CONTROLLER", `回路 "${loopId}" 有多个 maxRounds 控制器：${ids.join(", ")}；每个回路只能有一个控制器`, ids[1]);
	}
	for (const loopId of loopIds) if (!controllers.has(loopId)) warn("W_LOOP_NO_CONTROLLER", `回路 "${loopId}" 没有任何节点配 maxRounds，回路级上限不会生效`);
	return first;
}
/** 内嵌子图（subflow）递归校验；只做结构校验，节点 id 作用域独立 */
function validateSubflow(subflow, parentId, err, warn, agentIds) {
	if (!Array.isArray(subflow.nodes) || subflow.nodes.length === 0) {
		err("E_TYPE_FIELD", `subflow（节点 ${parentId}）没有任何节点`, parentId);
		return;
	}
	const byId = /* @__PURE__ */ new Map();
	for (const node of subflow.nodes) {
		if (byId.has(node.id)) err("E_DUP_NODE", `subflow（节点 ${parentId}）内节点 id 重复：${node.id}`, parentId);
		byId.set(node.id, node);
	}
	if (!subflow.entry || !byId.has(subflow.entry)) err("E_NO_ENTRY", `subflow（节点 ${parentId}）的 entry 缺失或不存在：${subflow.entry}`, parentId);
	for (const node of subflow.nodes) validateNode(node, byId, err, warn, agentIds);
	const loopControllers = validateLoops(subflow.nodes, err, warn);
	const edges = buildEdgeMap(subflow.nodes);
	const cycleNodes = nodesOnCycle(subflow.nodes, edges);
	for (const id of cycleNodes) {
		const node = byId.get(id);
		if (node.iterationLimit === void 0 && !(node.loopId !== void 0 && loopControllers.has(node.loopId))) warn("W_CYCLE_NO_LIMIT", `subflow（节点 ${parentId}）内节点在环上但未配置 iterationLimit / maxRounds：${id}`, id);
	}
	const reachable = reachableFrom(subflow.entry, edges);
	const terminals = subflow.nodes.filter(isTerminal).map((n) => n.id);
	if (subflow.maxSteps !== void 0 && (!Number.isInteger(subflow.maxSteps) || subflow.maxSteps < 1)) err("E_MAX_STEPS", `subflow（节点 ${parentId}）的 maxSteps 必须为正整数：${String(subflow.maxSteps)}`, parentId);
	for (const node of subflow.nodes) if (!reachable.has(node.id)) err("E_UNREACHABLE", `subflow（节点 ${parentId}）内的孤立节点：从 entry 不可达（${node.id}）`, node.id);
	if (terminals.length === 0) err("E_NO_TERMINAL", `subflow（节点 ${parentId}）不存在任何终点`, parentId);
	else {
		const canTerminate = reverseReachable(terminals, edges);
		for (const node of subflow.nodes) if (reachable.has(node.id) && !canTerminate.has(node.id)) err("E_NO_TERMINATION", `subflow（节点 ${parentId}）内节点 "${node.id}" 无法到达任何终点`, parentId);
	}
}
/** 终点：显式 end，或无 branches 且无 next 的隐式 end */
function isTerminal(node) {
	if (TERMINAL_TYPES.has(node.type)) return true;
	return node.branches === void 0 && node.next === void 0;
}
/** 边表：branches.to + next + onLimitExceeded（逃生边参与终止性分析） */
function buildEdgeMap(nodes) {
	const edges = /* @__PURE__ */ new Map();
	for (const node of nodes) {
		const targets = [];
		if (node.next !== void 0) targets.push(node.next);
		for (const branch of node.branches ?? []) if (branch.to !== void 0) targets.push(branch.to);
		if (node.onLimitExceeded !== void 0) targets.push(node.onLimitExceeded);
		edges.set(node.id, targets);
	}
	return edges;
}
function reachableFrom(start, edges) {
	const seen = /* @__PURE__ */ new Set();
	const queue = [start];
	while (queue.length > 0) {
		const id = queue.pop();
		if (seen.has(id)) continue;
		seen.add(id);
		for (const to of edges.get(id) ?? []) queue.push(to);
	}
	return seen;
}
/** 从终点反向遍历：能到达终点的节点集合 */
function reverseReachable(terminals, edges) {
	const reverse = /* @__PURE__ */ new Map();
	for (const [from, targets] of edges) for (const to of targets) {
		const list = reverse.get(to) ?? [];
		list.push(from);
		reverse.set(to, list);
	}
	const seen = new Set(terminals);
	const queue = [...terminals];
	while (queue.length > 0) {
		const id = queue.pop();
		for (const from of reverse.get(id) ?? []) if (!seen.has(from)) {
			seen.add(from);
			queue.push(from);
		}
	}
	return seen;
}
/** 位于环上的节点（沿 branches/next 边能回到自身） */
function nodesOnCycle(nodes, edges) {
	const onCycle = /* @__PURE__ */ new Set();
	for (const node of nodes) if (reachableExcludingStart(node.id, edges)) onCycle.add(node.id);
	return onCycle;
}
/** start 的后继能否回到 start */
function reachableExcludingStart(start, edges) {
	const seen = /* @__PURE__ */ new Set();
	const queue = [...edges.get(start) ?? []];
	while (queue.length > 0) {
		const id = queue.pop();
		if (id === start) return true;
		if (seen.has(id)) continue;
		seen.add(id);
		for (const to of edges.get(id) ?? []) queue.push(to);
	}
	return false;
}
//#endregion
//#region
function kindOf(value) {
	return value === "agent" ? "agent" : "flow";
}
/** 干跑校验：与落库路径用的是同一个校验器，仅不写库 */
function validateFlowOnly(flow) {
	return validateFlow(flow);
}
function listFlows(db, kind) {
	const sql = "SELECT id, name, kind, updated_at FROM flows";
	return (kind === void 0 ? db.prepare(`${sql} ORDER BY updated_at DESC`).all() : db.prepare(`${sql} WHERE kind = ? ORDER BY updated_at DESC`).all(kind)).map((row) => ({
		id: row.id,
		name: row.name,
		kind: kindOf(row.kind),
		updatedAt: row.updated_at
	}));
}
function getFlow(db, flowId) {
	const row = db.prepare("SELECT kind, content FROM flows WHERE id = ?").get(flowId);
	if (row === void 0) return void 0;
	try {
		return {
			...JSON.parse(row.content),
			kind: kindOf(row.kind)
		};
	} catch {
		return;
	}
}
/** 镜像文件必须落在 jsonDir 一层内；id 带路径分隔符时拒绝，避免写到数据目录之外 */
function mirrorPath(jsonDir, flowId) {
	const root = path.resolve(jsonDir);
	const file = path.resolve(root, `${flowId}.json`);
	if (path.dirname(file) !== root) throw new Error(`图 id 会写到 flows 目录之外，已拒绝：${JSON.stringify(flowId)}`);
	return file;
}
function saveFlow(db, flow, jsonDir) {
	const existing = db.prepare("SELECT kind FROM flows WHERE id = ?").get(flow.id);
	const inherited = flow.kind ?? existing?.kind;
	const candidate = inherited === void 0 ? flow : {
		...flow,
		kind: inherited
	};
	const result = validateFlow(candidate);
	if (!result.ok) return result;
	const mirror = mirrorPath(jsonDir, candidate.id);
	const kind = kindOf(candidate.kind);
	const stored = {
		...candidate,
		kind
	};
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const content = JSON.stringify(stored, null, 2);
	db.prepare(`INSERT INTO flows (id, name, kind, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
       content = excluded.content, updated_at = excluded.updated_at`).run(stored.id, stored.name, kind, content, now, now);
	fs.mkdirSync(jsonDir, { recursive: true });
	fs.writeFileSync(mirror, content, "utf-8");
	return {
		...result,
		flow: stored
	};
}
function deleteFlow(db, flowId, jsonDir) {
	const info = db.prepare("DELETE FROM flows WHERE id = ?").run(flowId);
	const changes = Number(info.changes);
	let mirror = null;
	try {
		mirror = mirrorPath(jsonDir, flowId);
	} catch {
		mirror = null;
	}
	if (changes > 0 && mirror !== null && fs.existsSync(mirror)) fs.rmSync(mirror);
	return changes > 0;
}
//#endregion
//#region
function homeDir() {
	return process.env.AIWORKFLOW_HOME ?? path.join(os.homedir(), ".aiworkflow");
}
function flowsDir$1() {
	return path.join(homeDir(), "flows");
}
function cacheDir() {
	return path.join(homeDir(), "cache");
}
/** 确保目录布局存在（幂等） */
function ensureLayout() {
	fs.mkdirSync(flowsDir$1(), { recursive: true });
	fs.mkdirSync(cacheDir(), { recursive: true });
}
//#endregion
//#region
var MIGRATIONS = [
	`
  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS flow_snapshots (
    hash TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    parent_run_id TEXT REFERENCES runs(id),
    root_run_id TEXT,
    flow_id TEXT NOT NULL,
    flow_snapshot_hash TEXT NOT NULL REFERENCES flow_snapshots(hash),
    entry_node TEXT NOT NULL,
    current_node TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    cwd TEXT,
    project_name TEXT,
    mcp_session_id TEXT,
    child_token TEXT UNIQUE,
    steps_used INTEGER NOT NULL DEFAULT 0,
    last_activity TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_runs_root ON runs(root_run_id);
  CREATE INDEX IF NOT EXISTS idx_runs_cwd ON runs(cwd);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
  CREATE TABLE IF NOT EXISTS node_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    payload TEXT,
    branch_id TEXT,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_exec_run_node ON node_executions(run_id, node_id);
  CREATE TABLE IF NOT EXISTS gate_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    question TEXT,
    option_id TEXT,
    note TEXT,
    source TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gates_run ON gate_decisions(run_id);
  `,
	`
  ALTER TABLE runs ADD COLUMN host_session TEXT;
  CREATE INDEX IF NOT EXISTS idx_runs_host_session ON runs(host_session);
  `,
	`
  ALTER TABLE runs ADD COLUMN outcome TEXT;
  `,
	`
  ALTER TABLE runs ADD COLUMN parent_node TEXT;
  ALTER TABLE runs ADD COLUMN retry_of TEXT REFERENCES runs(id);
  CREATE INDEX IF NOT EXISTS idx_runs_parent_node ON runs(parent_run_id, parent_node);
  `,
	`
  ALTER TABLE runs ADD COLUMN fanout_item TEXT;
  `,
	`
  ALTER TABLE runs DROP COLUMN mcp_session_id;
  `,
	`
  ALTER TABLE runs ADD COLUMN role TEXT;
  ALTER TABLE runs ADD COLUMN thread_id TEXT;
  ALTER TABLE runs ADD COLUMN inputs TEXT;
  CREATE INDEX IF NOT EXISTS idx_runs_thread ON runs(root_run_id, thread_id, created_at);
  `,
	`
  CREATE TABLE IF NOT EXISTS run_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_run_id TEXT NOT NULL,
    key TEXT NOT NULL,
    version INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    role TEXT,
    summary TEXT,
    path TEXT,
    content TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(root_run_id, key, version)
  );
  CREATE INDEX IF NOT EXISTS idx_artifacts_root_key ON run_artifacts(root_run_id, key, version DESC);
  `,
	`
  ALTER TABLE runs ADD COLUMN parent_iteration INTEGER;
  CREATE INDEX IF NOT EXISTS idx_runs_parent_iteration ON runs(parent_run_id, parent_node, parent_iteration);
  `,
	`
  ALTER TABLE flows ADD COLUMN kind TEXT NOT NULL DEFAULT 'flow';
  CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows(kind);
  `
];
/** 逐级迁移；库版本高于程序支持版本时拒绝启动，避免旧代码写坏新库 */
function migrateSchema(db) {
	const version = db.userVersion();
	if (version > MIGRATIONS.length) throw new Error(`数据库版本 ${version} 高于当前程序支持的 ${MIGRATIONS.length}，请升级 aiworkflow DSH 插件后再试。`);
	for (let v = version; v < MIGRATIONS.length; v++) db.transaction(() => {
		db.exec(MIGRATIONS[v]);
		db.setUserVersion(v + 1);
	})();
}
//#endregion
//#region
var NodeSqliteDb = class {
	raw;
	depth = 0;
	constructor(file) {
		this.raw = new DatabaseSync(file);
	}
	prepare(sql) {
		return this.raw.prepare(sql);
	}
	exec(sql) {
		this.raw.exec(sql);
	}
	userVersion() {
		const row = this.raw.prepare("PRAGMA user_version").get();
		return Number(row?.user_version ?? 0);
	}
	setUserVersion(version) {
		this.raw.exec(`PRAGMA user_version = ${version}`);
	}
	/** transaction 语义：返回可调用函数，嵌套时退化为 SAVEPOINT */
	transaction(fn) {
		return () => {
			const depth = this.depth + 1;
			const savepoint = `aiworkflow_sp_${depth}`;
			this.raw.exec(depth === 1 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
			this.depth = depth;
			try {
				const value = fn();
				this.raw.exec(depth === 1 ? "COMMIT" : `RELEASE ${savepoint}`);
				return value;
			} catch (error) {
				try {
					if (depth === 1) this.raw.exec("ROLLBACK");
					else {
						this.raw.exec(`ROLLBACK TO ${savepoint}`);
						this.raw.exec(`RELEASE ${savepoint}`);
					}
				} catch {}
				throw error;
			} finally {
				this.depth = depth - 1;
			}
		};
	}
	close() {
		this.raw.close();
	}
};
//#endregion
//#region
var opened = null;
function aiworkflowHome() {
	return homeDir();
}
function databasePath() {
	return join(aiworkflowHome(), "aiworkflow.db");
}
function flowsDir() {
	return flowsDir$1();
}
/** 库不存在时创建并建表：插件自己就能开场，不依赖任何外部命令 */
function database() {
	const file = databasePath();
	if (opened !== null && opened.path === file) return opened.db;
	closeDatabase();
	ensureLayout();
	const db = new NodeSqliteDb(file);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		db.exec("PRAGMA foreign_keys = ON");
		migrateSchema(db);
	} catch (error) {
		db.close();
		throw error;
	}
	opened = {
		path: file,
		db
	};
	return db;
}
function closeDatabase() {
	if (opened === null) return;
	try {
		opened.db.close();
	} catch {}
	opened = null;
}
//#endregion
//#region
/** 按键排序的 JSON 序列化，保证同内容同串 */
function stableStringify(value) {
	return JSON.stringify(sortValue(value));
}
function sortValue(value) {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value !== null && typeof value === "object") {
		const obj = value;
		const out = {};
		for (const key of Object.keys(obj).sort()) out[key] = sortValue(obj[key]);
		return out;
	}
	return value;
}
function contentHash(value) {
	return crypto.createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}
//#endregion
//#region
/** 递归解析 flowRef，构建完整快照。引用缺失或跨图循环时抛错。 */
function buildSnapshot(rootFlow, resolver) {
	const flows = {};
	collectFlows(rootFlow, resolver, flows, /* @__PURE__ */ new Set([rootFlow.id]));
	return {
		rootFlowId: rootFlow.id,
		agents: rootFlow.agents,
		flows
	};
}
function collectFlows(flow, resolver, flows, visiting) {
	if (flows[flow.id] !== void 0) return;
	flows[flow.id] = flow;
	collectNodeRefs(flow.nodes, flow.id, resolver, flows, visiting);
}
/** 递归扫描一层画布里的 subagent 节点：flowRef 收进快照，内嵌子图继续往里扫（栈深任意）。 */
function collectNodeRefs(nodes, ownerId, resolver, flows, visiting) {
	for (const node of nodes) {
		if (node.type !== "subagent") continue;
		if (node.mode === "flowRef" && node.flowRef) collectRef(node.flowRef, `${node.id}（图 ${ownerId}）`, resolver, flows, visiting);
		if (node.subflow !== void 0) collectNodeRefs(node.subflow.nodes, ownerId, resolver, flows, visiting);
	}
}
function collectRef(refId, where, resolver, flows, visiting) {
	const target = resolver.get(refId);
	if (target === void 0) throw new Error(`flowRef 引用的图不存在：${refId}（节点 ${where}）`);
	if (visiting.has(refId)) throw new Error(`flowRef 引用成环：${[...visiting, refId].join(" -> ")}`);
	visiting.add(refId);
	collectFlows(target, resolver, flows, visiting);
	visiting.delete(refId);
}
/** 从父快照切出子 run 的快照（阶段 6）：子图作为根，其引用的 flowRef 只从父快照取——
*  不回读当前库，保证 child run 同样跑在主 run 启动时钉死的版本上（copy-on-run 一致性）。 */
function buildSubSnapshot(parent, childFlow) {
	const flows = {};
	collectFlows(childFlow, { get: (id) => parent.flows[id] }, flows, /* @__PURE__ */ new Set([childFlow.id]));
	return {
		rootFlowId: childFlow.id,
		agents: childFlow.agents ?? parent.agents,
		flows
	};
}
/** 快照内容寻址 hash（对完整快照结构做稳定序列化） */
function snapshotHash(snapshot) {
	return contentHash(snapshot);
}
/** 落库（内容寻址去重），并写 cache/ 派生镜像。返回 hash。 */
function persistSnapshot(db, snapshot) {
	const hash = snapshotHash(snapshot);
	const content = JSON.stringify(snapshot);
	db.prepare("INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING").run(hash, content, (/* @__PURE__ */ new Date()).toISOString());
	fs.mkdirSync(cacheDir(), { recursive: true });
	fs.writeFileSync(path.join(cacheDir(), `snapshot-${hash}.json`), content, "utf-8");
	return hash;
}
function loadSnapshot(db, hash) {
	const row = db.prepare("SELECT content FROM flow_snapshots WHERE hash = ?").get(hash);
	return row === void 0 ? void 0 : JSON.parse(row.content);
}
//#endregion
//#region
/** 支持推进的节点类型（阶段 6 起六种全支持） */
var SUPPORTED_TYPES = /* @__PURE__ */ new Set([
	"prompt",
	"tool",
	"end",
	"gate",
	"subagent",
	"join"
]);
/** 服务端下发的循环纪律文本（§6.4：不进 Skill 文件，跟服务端版本走） */
var DISCIPLINE_TEXT = [
	"你正在按一张流程图分步推进任务。图不会一次给你全部内容——每次只给当前这一步，做完回报后才给下一步。",
	"硬的一条：每步做完必须调 complete_step，否则链条断在你这里。",
	"完全放开的：执行某一步时你想多读文件、多跑命令、多查一点，随意，只要最后把结果回报。",
	"不确定自己在哪：调 get_current_step()，它幂等，随时可调。",
	"遇到人工卡点（gate）：把问题原样转达用户，调 await_gate(gateId) 等答复（每轮 60 秒，到点就再调一次）；用户当场答复了就调 answer_gate 代填。",
	"派出子 Agent（subagent）：把每个 child 的 preamble 原样放进对应子任务开头（不许改写或摘要）；等全部子任务返回后再调 get_current_step()，服务端会汇聚结果给出下一步。",
	"你是子 Agent 时：preamble 里的角色章程与同线程摘要要遵守；只做当前这一步，按 reportHint 回报 payload/产物。",
	"有产物交接：调 complete_step 时带 artifacts: [{ key, summary?, path?, content? }]；后续用 {{artifacts.key.path}} 取最新版。",
	"subagent 路由步（callee 全部回报但还有自然语言分支）：按 childResults 的 payload 选 branchId；when 分支服务端已自动走。",
	"干不下去（缺依赖、没权限、分支全不满足且没有默认出口）：调 report_blocked(reason) 如实上报，别硬编。"
].join("\n");
var ExecutionEngine = class {
	db;
	resolveFlow;
	emit;
	constructor(deps) {
		this.db = deps.db;
		this.resolveFlow = deps.resolveFlow;
		this.emit = deps.onEvent ?? (() => {});
	}
	/** 建 run（含 copy-on-run 快照），返回纪律文本 + 第一步 */
	startRun(params) {
		const flow = this.resolveFlow(params.flowName);
		if (flow === void 0) return selfHeal(`没有找到流程「${params.flowName}」（按 id 或展示名都找不到）。`, "先调 list_flows 看有哪些流程，再用它的 id 或名字调 start_run。");
		const result = validateFlow(flow);
		if (!result.ok) {
			const lines = result.errors.map((e) => `${e.code}: ${e.message}`).join("；");
			return selfHeal(`流程「${flow.name}」校验不通过：${lines}。`, "这张图有必然出错的硬伤，需要在面板里修好后再跑。");
		}
		const unsupported = flow.nodes.filter((n) => !SUPPORTED_TYPES.has(n.type));
		if (unsupported.length > 0) {
			const list = unsupported.map((n) => `${n.type}（${n.title ?? n.id}）`).join("、");
			return selfHeal(`流程「${flow.name}」包含当前版本不认识的节点类型：${list}。`, "这张图可能由更新版本的服务创建，请升级 aiworkflow 后再跑。");
		}
		if (params.hostSession !== void 0) {
			const active = this.latestActiveRunByHostSession(params.hostSession);
			if (active !== null) {
				let label = active.flow_id;
				let nodeLabel = active.current_node ?? "—";
				let current = null;
				try {
					const activeSnapshot = this.snapshotOf(active);
					label = activeSnapshot.flows[activeSnapshot.rootFlowId]?.name ?? label;
					nodeLabel = (active.current_node !== null ? findNode(activeSnapshot, active.current_node) : void 0)?.title ?? nodeLabel;
					current = this.currentRef(active);
				} catch {}
				return selfHeal(`当前会话已有进行中的 run：${active.id}（${label} · 当前节点 ${nodeLabel}）。同一会话同时只能有一个活跃 run，否则后续 complete_step 会打到最新的那个。`, "先把它跑完；确实要换流程，请在「执行进度」面板点「放弃」结束当前 run，再 start_run。", current);
			}
		}
		let snapshot;
		try {
			snapshot = buildSnapshot(flow, { get: (id) => this.resolveFlow(id) });
		} catch (e) {
			return selfHeal(`流程「${flow.name}」的快照构建失败：${e.message}`, "通常是 flowRef 引用的图已被删除或引用成环，在面板修好后再跑。");
		}
		const hash = persistSnapshot(this.db, snapshot);
		const runId = `run_${crypto.randomBytes(4).toString("hex")}`;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		this.db.prepare(`INSERT INTO runs (id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node,
           status, cwd, project_name, host_session, inputs, steps_used, last_activity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, 0, ?, ?)`).run(runId, runId, flow.id, hash, flow.entry, flow.entry, params.cwd ?? null, params.projectName ?? null, params.hostSession ?? null, params.inputs !== void 0 ? JSON.stringify(params.inputs) : null, now, now);
		this.emit({
			type: "run_started",
			runId,
			flowId: flow.id,
			at: now
		});
		const entryNode = flow.nodes.find((n) => n.id === flow.entry);
		if (entryNode !== void 0 && entryNode.type === "gate") {
			const gateId = this.enterGate(runId, entryNode, now);
			this.emit({
				type: "gate_pending",
				runId,
				nodeId: entryNode.id,
				gateId: String(gateId),
				question: entryNode.question,
				at: now
			});
		}
		if (entryNode !== void 0 && entryNode.type === "subagent") {
			const spawned = this.enterSubagent(runId, entryNode, now);
			if (spawned !== void 0) {
				this.failRunById(runId);
				return selfHeal(spawned.what, `${spawned.guidance}入口派发失败，run 已判失败；修好后重新 start_run。`, null);
			}
		}
		return this.stepResult(runId);
	}
	/** 幂等。返回"我在哪、要干啥"；上下文压缩后的恢复入口。
	*  例外（§7.5）：主 Agent 在派发步上（waiting_children）调用即触发汇聚——
	*  前提是宿主的 Task 调用已返回，此时 children 该完成的都完成了，没完成的按"未回报"处理。 */
	getCurrentStep(ref) {
		const run = this.resolveRun(ref);
		if (run === null) return selfHeal(ref.childToken !== void 0 ? "这个 childToken 没有对应的 run（可能已过期或写错）。" : "没有找到你正在进行的 run。", "主 Agent 调 start_run 开始一个流程；如果上下文被压缩过、不确定自己在哪，这个结果就是答案的来源——先 start_run 或问用户该跑哪张图。");
		if (run.status === "waiting_children") return this.gatherChildren(run);
		const bootstrapped = this.bootstrapEntry(run);
		if (bootstrapped !== void 0) return bootstrapped;
		return this.resultForRun(run, "get_current_step");
	}
	/** 推进一格：校验 → 落库 → 定位后继（含迭代上限逃生）→ 渲染插值 → 返回下一步 */
	completeStep(params) {
		const run = this.resolveRun(params);
		if (run === null) return selfHeal(params.childToken !== void 0 ? "这个 childToken 没有对应的 run（可能已过期或写错）。" : "没有找到你正在进行的 run，没法提交结果。", "调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。");
		if (run.status === "waiting_gate") return selfHeal("run 正挂在人工卡点上等确认，complete_step 推不动它。", "调 await_gate(gateId) 等用户答复（每轮 60 秒）；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。gateId 和选项见下面这一步。", this.currentRef(run));
		if (run.status === "waiting_children") return this.completeSubagentRoute(run, params);
		if (run.status !== "running") return this.resultForRun(run, "complete_step");
		if (params.summary === void 0 || params.summary.trim() === "") return selfHeal("complete_step 必须带 summary：这一步做了什么，一句话，给人看的。", `重新调 complete_step，带上 summary 和这一步的结果。当前节点是 ${run.current_node}。`, this.currentRef(run));
		const snapshot = this.snapshotOf(run);
		const maxSteps = this.maxStepsOf(snapshot);
		if (run.steps_used >= maxSteps) {
			this.failRun(run);
			return this.finishedResult(run.id, "fail", `已超出全局步数上限（${maxSteps} 步），run 判失败。如任务仍需推进，请用户修图（调大 maxSteps 或拆分流程）后重新 start_run。`);
		}
		const node = snapshot.flows[snapshot.rootFlowId].nodes.find((n) => n.id === run.current_node);
		if (node === void 0) return selfHeal(`快照里找不到节点 ${run.current_node}（run ${run.id} 的数据异常）。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		if (params.nodeId !== void 0 && params.nodeId !== run.current_node) return selfHeal(`节点不匹配：你提交的是 ${params.nodeId}，但当前这一步是 ${run.current_node}（可能是上下文压缩后记串了）。`, `对当前节点 ${run.current_node} 重新调 complete_step；不确定的话先调 get_current_step() 取回最新状态。`, this.currentRef(run));
		if (params.artifacts !== void 0) {
			const bad = this.validateArtifacts(params.artifacts);
			if (bad !== void 0) return selfHeal(bad, "修正 artifacts 后重新调 complete_step；产物 key 只允许字母/数字/下划线。", this.currentRef(run));
		}
		let successorId;
		let branchId = params.branchId ?? null;
		if ((node.branches ?? []).length > 0) {
			const selected = this.resolveBranch(run, node, params.branchId, false, params.payload ?? {});
			if ("error" in selected) return selected.error;
			successorId = selected.branch.to;
			branchId = selected.branch.id;
		} else if (node.next !== void 0) successorId = node.next;
		else successorId = null;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const plan = successorId === null ? {
			kind: "advance",
			targetId: null,
			limitRows: []
		} : this.resolveAdvance(run, snapshot, successorId, node.id);
		this.advanceTransaction(run, snapshot, plan, {
			nodeId: node.id,
			status: "completed",
			summary: params.summary,
			payload: JSON.stringify(params.payload ?? {}),
			branchId,
			artifacts: params.artifacts
		}, now);
		const spawned = this.ensureChildrenSpawned(run.id);
		if (spawned !== void 0) {
			this.failRun(run);
			return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
		}
		return this.resultForPlan(run.id, snapshot, plan);
	}
	/** 干不下去了（§7.8）：落 blocked 轨迹，三级出口 onLimitExceeded → default 分支 → run 判失败。不做自动重试 */
	reportBlocked(params) {
		const run = this.resolveRun(params);
		if (run === null) return selfHeal(params.childToken !== void 0 ? "这个 childToken 没有对应的 run（可能已过期或写错）。" : "没有找到你正在进行的 run，没法上报阻塞。", "调 start_run 开始一个流程；如果你只是想看当前进度，调 get_current_step。");
		if (run.status === "waiting_gate") return selfHeal("run 正挂在人工卡点上等确认，这不是阻塞，不需要 report_blocked。", "调 await_gate(gateId) 等用户答复；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。", this.currentRef(run));
		if (run.status === "waiting_children") return selfHeal("这一步是子 Agent 派发步，不是阻塞点。", "等全部子任务返回后调 get_current_step() 汇聚；确实派不出去（例如 DSH 侧没有可用的子 Agent）就请用户改图，去掉 subagent 节点后重跑。", this.currentRef(run));
		if (run.status !== "running") return this.resultForRun(run, "report_blocked");
		if (params.reason === void 0 || params.reason.trim() === "") return selfHeal("report_blocked 必须带 reason：一句话说清干不下去的原因，给人看的。", `重新调 report_blocked，带上 reason。当前节点是 ${run.current_node}。`, this.currentRef(run));
		const snapshot = this.snapshotOf(run);
		const maxSteps = this.maxStepsOf(snapshot);
		if (run.steps_used >= maxSteps) {
			this.failRun(run);
			return this.finishedResult(run.id, "fail", `已超出全局步数上限（${maxSteps} 步），run 判失败。`);
		}
		const node = run.current_node !== null ? findNode(snapshot, run.current_node) : void 0;
		if (node === void 0) return selfHeal(`快照里找不到节点 ${run.current_node}（run ${run.id} 的数据异常）。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		if (params.nodeId !== void 0 && params.nodeId !== run.current_node) return selfHeal(`节点不匹配：你上报的是 ${params.nodeId}，但当前这一步是 ${run.current_node}（可能是上下文压缩后记串了）。`, `对当前节点 ${run.current_node} 重新调 report_blocked；不确定的话先调 get_current_step() 取回最新状态。`, this.currentRef(run));
		if (run.child_token !== null) {
			const now = (/* @__PURE__ */ new Date()).toISOString();
			this.db.transaction(() => {
				this.db.prepare(`INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
             VALUES (?, ?, ?, 'blocked', ?, '{}', NULL, ?, ?)`).run(run.id, node.id, this.execCount(run.id, node.id) + 1, params.reason, now, now);
				this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`).run(now, now, run.id);
			})();
			this.emit({
				type: "step_completed",
				runId: run.id,
				nodeId: node.id,
				status: "blocked",
				at: now
			});
			this.emit({
				type: "run_finished",
				runId: run.id,
				outcome: "fail",
				at: now
			});
			return this.finishedResult(run.id, "fail", `子任务上报阻塞：${params.reason}。该子任务已置为失败；主流程汇聚时（get_current_step）会自动重派一轮或带部分结果推进。`);
		}
		const defaultTo = node.branches?.find((b) => b.condition === "*")?.to;
		const exitId = node.onLimitExceeded ?? defaultTo;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const blockedRow = {
			nodeId: node.id,
			status: "blocked",
			summary: params.reason,
			payload: "{}",
			branchId: null
		};
		if (exitId === void 0) {
			const reason = `节点 ${node.id} 上报阻塞且没有任何出口（无 onLimitExceeded、无 default 分支），run 判失败。`;
			this.advanceTransaction(run, snapshot, {
				kind: "fail",
				reason
			}, blockedRow, now);
			return this.finishedResult(run.id, "fail", `节点 ${node.id} 上报阻塞：${params.reason}。没有可用出口，run 判失败。`);
		}
		const plan = this.resolveAdvance(run, snapshot, exitId, node.id);
		this.advanceTransaction(run, snapshot, plan, blockedRow, now);
		const spawned = this.ensureChildrenSpawned(run.id);
		if (spawned !== void 0) {
			this.failRun(run);
			return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
		}
		return this.resultForPlan(run.id, snapshot, plan);
	}
	/** 卡点放行（§7.6）：source 记录来源；当前插件走 chat，panel 保留给后续面板点选接入。
	*  决策记 gate_decisions（含来源），并落一条 completed 轨迹（payload 带选项与来源）供插值与回看。 */
	answerGate(params, source) {
		let run = null;
		let row = params.gateId !== void 0 ? this.pendingGateById(params.gateId) : null;
		if (row !== null) run = this.runById(row.run_id);
		if (row === null && params.gateId !== void 0) {
			const decided = this.gateRowById(params.gateId);
			if (decided !== void 0) {
				const r = this.runById(decided.run_id);
				return selfHeal(`卡点 ${params.gateId} 已经被答复或关闭（不能重复作答）。`, "调 get_current_step() 看当前进展；如果流程又走到新的卡点，用新下发的 gateId 作答。", r !== null ? this.currentOf(r) : null);
			}
			return selfHeal(`gateId 无效：「${params.gateId}」不对应任何卡点。`, "gateId 从 gate 步骤的下发内容里取；也可以省略 gateId，按当前 run 的挂起卡点作答。", null);
		}
		if (row === null) {
			run = this.resolveRun(params);
			if (run === null) return selfHeal(params.childToken !== void 0 ? "这个 childToken 没有对应的 run（可能已过期或写错）。" : "没有找到你正在进行的 run，没有可作答的卡点。", "调 start_run 开始一个流程；不确定在哪就先调 get_current_step。");
			if (run.current_node !== null) row = this.pendingDecisionOf(run.id, run.current_node);
			if (row === null) return selfHeal(`run ${run.id} 当前不在人工卡点上（状态 ${run.status}），没有可作答的问题。`, "调 get_current_step() 看当前这一步是什么。", this.currentOf(run));
		}
		if (run === null || row === null) return selfHeal("卡点数据异常：找不到所属 run。", "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		const snapshot = this.snapshotOf(run);
		const node = findNode(snapshot, row.node_id);
		if (node === void 0 || node.type !== "gate") return selfHeal(`卡点数据异常：快照里 ${row.node_id} 不是 gate 节点（run ${run.id}）。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		const option = node.options.find((o) => o.id === params.optionId);
		if (option === void 0) {
			const valid = node.options.map((o) => `${o.id}（${o.label}）`).join("、");
			return selfHeal(`optionId 无效：你给的是「${params.optionId ?? "（缺失）"}」。卡点 ${node.id} 的问题是「${node.question}」，合法选项：${valid}。`, "重新调 answer_gate，optionId 从上面列表里选；或把问题原样转给用户再等答复。", {
				runId: run.id,
				step: this.buildStepView(run, node)
			});
		}
		const maxSteps = this.maxStepsOf(snapshot);
		if (run.steps_used >= maxSteps) {
			const now = (/* @__PURE__ */ new Date()).toISOString();
			this.db.transaction(() => {
				this.decideGateRow(row.id, option.id, params.note ?? null, source, now);
				this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`).run(now, now, run.id);
			})();
			this.emit({
				type: "run_finished",
				runId: run.id,
				outcome: "fail",
				at: now
			});
			return this.finishedResult(run.id, "fail", `已超出全局步数上限（${maxSteps} 步），答复已记录但 run 判失败。`);
		}
		const branches = node.branches ?? [];
		const matched = branches.find((b) => b.outlet === option.id) ?? branches.find((b) => b.id === option.id);
		let successorId;
		let branchId = matched?.id ?? null;
		if (matched !== void 0) successorId = matched.to;
		else if (branches.length === 0 && node.next !== void 0) successorId = node.next;
		else if (branches.length === 0) successorId = null;
		else successorId = null;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const gateRow = {
			nodeId: node.id,
			status: "completed",
			summary: `人工确认：${option.label}（${source === "panel" ? "面板点选" : "聊天代填"}）`,
			payload: JSON.stringify({
				optionId: option.id,
				optionLabel: option.label,
				note: params.note ?? null,
				source
			}),
			branchId
		};
		if (branches.length > 0 && matched === void 0) {
			const reason = `卡点 ${node.id} 的选项「${option.label}」（${option.id}）没有连线，决策已记录但无法推进，run 判失败。`;
			this.advanceTransaction(run, snapshot, {
				kind: "fail",
				reason
			}, gateRow, now, {
				decisionId: row.id,
				optionId: option.id,
				note: params.note ?? null,
				source
			});
			return this.finishedResult(run.id, "fail", `人工选了「${option.label}」，但该选项在图上没有连线，run 判失败。请把选项连上出口后重新 start_run。`);
		}
		const plan = successorId === null ? {
			kind: "advance",
			targetId: null,
			limitRows: []
		} : this.resolveAdvance(run, snapshot, successorId, node.id);
		this.advanceTransaction(run, snapshot, plan, gateRow, now, {
			decisionId: row.id,
			optionId: option.id,
			note: params.note ?? null,
			source
		});
		const spawned = this.ensureChildrenSpawned(run.id);
		if (spawned !== void 0) {
			this.failRun(run);
			return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
		}
		return this.resultForPlan(run.id, snapshot, plan);
	}
	/** 长轮询等卡点答复（§7.6）：上限默认 60 秒，到点返回"仍在等待，请再调一次"；已答复（或已不在卡点）返回当前状态 */
	async awaitGate(params, timeoutMs = 6e4) {
		const deadline = Date.now() + timeoutMs;
		for (;;) {
			let row = params.gateId !== void 0 ? this.pendingGateById(params.gateId) : null;
			let run = row !== null ? this.runById(row.run_id) : this.resolveRun(params);
			if (row !== null && run === null) return selfHeal(`卡点 ${row.id} 所属的 run 不存在（${row.run_id}），数据异常。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
			if (run === null) return selfHeal(params.childToken !== void 0 ? "这个 childToken 没有对应的 run（可能已过期或写错）。" : "没有找到你正在进行的 run，也没有可等待的卡点。", "先调 start_run 开始流程，或 get_current_step 确认状态。");
			if (row === null && run.status === "waiting_gate" && run.current_node !== null) row = this.pendingDecisionOf(run.id, run.current_node);
			if (row === null) return this.resultForRun(run, "await_gate");
			if (Date.now() >= deadline) {
				const step = this.stepResult(run.id);
				return "step" in step ? {
					...step,
					note: `仍在等待人工确认（等待了 ${Math.round(timeoutMs / 1e3)} 秒到点）。请再调一次 await_gate 继续等；用户若已在本对话答复，调 answer_gate(gateId, optionId) 代填。`
				} : step;
			}
			await sleep(Math.min(400, Math.max(1, deadline - Date.now())));
		}
	}
	/** 主动放弃一个 run（面板/用户操作）：root 及其未终结的 child 一起判失败，落一条 blocked 轨迹说明原因。
	*  这是唯一能把僵尸 run 从 running/waiting_* 里清出来的入口（引擎不按时间自动标 stale）。 */
	abandonRun(params) {
		const run = this.resolveRun(params);
		if (run === null) return selfHeal("没有找到要放弃的 run。", "先调 get_current_step 确认当前 run；面板里请刷新后重试。");
		if (isTerminalRun(run)) return selfHeal(`run ${run.id} 已经结束（${run.status}），不需要放弃。`, "调 get_current_step 查看状态；要跑新流程直接 start_run。", this.currentOf(run));
		const root = run.root_run_id ?? run.id;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const reason = params.reason?.trim() || "用户放弃（面板操作）";
		const active = this.db.prepare(`SELECT id, current_node FROM runs
         WHERE (id = ? OR root_run_id = ?) AND status IN ('running', 'waiting_gate', 'waiting_children')
         ORDER BY created_at, rowid`).all(run.id, root);
		this.db.transaction(() => {
			const update = this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`);
			const insert = this.db.prepare(`INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
         VALUES (?, ?, ?, 'blocked', ?, '{}', NULL, ?, ?)`);
			const closeGates = this.db.prepare(`UPDATE gate_decisions SET option_id = NULL, note = ?, source = 'abandoned', decided_at = ?
         WHERE run_id = ? AND decided_at IS NULL`);
			for (const row of active) {
				update.run(now, now, row.id);
				closeGates.run(reason, now, row.id);
				if (row.current_node !== null) insert.run(row.id, row.current_node, this.execCount(row.id, row.current_node) + 1, reason, now, now);
			}
		})();
		for (const row of active) this.emit({
			type: "run_finished",
			runId: row.id,
			outcome: "fail",
			at: now
		});
		return {
			runId: run.id,
			abandoned: active.length
		};
	}
	/** child run 从入口直接开始时（entry 是 gate/subagent），第一次领步补做 startRun 的入口特判 */
	bootstrapEntry(run) {
		if (run.status !== "running" || run.current_node === null || run.steps_used !== 0) return void 0;
		const node = findNode(this.snapshotOf(run), run.current_node);
		if (node === void 0) return void 0;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		if (node.type === "gate") {
			const gateId = this.enterGate(run.id, node, now);
			this.emit({
				type: "gate_pending",
				runId: run.id,
				nodeId: node.id,
				gateId: String(gateId),
				question: node.question,
				at: now
			});
			return this.stepResult(run.id);
		}
		if (node.type === "subagent") {
			const spawned = this.enterSubagent(run.id, node, now);
			if (spawned !== void 0) {
				this.failRunById(run.id);
				return selfHeal(spawned.what, `${spawned.guidance}入口派发失败，run 已判失败。`, null);
			}
			return this.stepResult(run.id);
		}
	}
	/** 入口即派发：start 后直接建 child 并挂 waiting_children（与入口即 gate 对称） */
	enterSubagent(runId, node, now) {
		const run = this.runById(runId);
		if (run === null) return selfHeal(`run ${runId} 不存在（数据异常）。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		const list = this.childItems(run, node);
		if ("error" in list) return list.error;
		const plans = [];
		for (const item of list.items) {
			const planned = this.planChild(run, node, null, item === null ? null : JSON.stringify(item));
			if ("error" in planned) return planned.error;
			plans.push(planned);
		}
		const events = [];
		this.db.transaction(() => {
			this.db.prepare(`UPDATE runs SET status = 'waiting_children', last_activity = ? WHERE id = ?`).run(now, runId);
			this.insertChildRuns(run, node.id, plans, events, now);
			if (list.fanOuted) this.insertDispatchedRow(run, node.id, plans, list.dropped, now);
		})();
		for (const e of events) this.emit(e);
	}
	/** fan-out 条目解析（§7.4）：from 插值（数组，max 截断）/ 固定 count / 无 fanOut（单 child）。
	*  items 元素为 null 表示该 child 没有对应条目（count 模式与非 fan-out）。 */
	childItems(run, node) {
		const fan = node.fanOut;
		if (fan === void 0) return {
			items: [null],
			dropped: [],
			fanOuted: false
		};
		if (fan.count !== void 0) {
			const n = Math.floor(fan.count);
			if (n < 1) return { error: selfHeal(`fanOut.count 必须是正整数（当前 ${fan.count}）。`, "在面板把 count 改成 ≥1，或改用 from 按数据条数派发。", this.currentRef(run)) };
			return {
				items: Array.from({ length: n }, () => null),
				dropped: [],
				fanOuted: true
			};
		}
		const from = fan.from ?? "";
		const m = /^\{\{\s*(.+?)\s*\}\}$/.exec(from.trim());
		if (m === null) return { error: selfHeal(`fanOut.from 应是一个 {{...}} 插值表达式（当前 ${JSON.stringify(from)}）。`, "改成如 \"{{n3.payload.modules}}\"——解析结果必须是数组，每个元素派一个子 Agent。", this.currentRef(run)) };
		const value = this.lookupExpr(m[1], run.id);
		if (value === void 0) return { error: selfHeal(`fanOut.from 引用的数据还不存在：${from}（引用的节点没跑过或字段缺失）。`, "把 fanOut.from 指向一个已完成节点返回的数组字段，或改用 count 固定数量。", this.currentRef(run)) };
		if (!Array.isArray(value)) return { error: selfHeal(`fanOut.from 解析结果不是数组：${from} → ${JSON.stringify(value).slice(0, 80)}。`, "from 必须指向数组字段（每个元素派一个子 Agent），单值请走普通 subagent 节点。", this.currentRef(run)) };
		if (value.length === 0) return { error: selfHeal(`fanOut.from 解析结果是空数组：${from}，没有可派发的条目。`, "确认上游节点会产出非空数组，或改用 count 固定数量。", this.currentRef(run)) };
		const max = fan.max !== void 0 ? fan.max : value.length;
		return {
			items: value.slice(0, max),
			dropped: value.slice(max),
			fanOuted: true
		};
	}
	/** 预构建一个 child run（初始派发与重派共用）：
	*  子图（inline/subflow/flowRef）→ 从父快照切子快照（不回读当前库）→ 持久化 → 落库参数。
	*  fanoutItem：该 child 对应的 fan-out 条目（JSON）；inline 模式下渲染进子任务指令。 */
	planChild(run, node, retryOf, fanoutItem) {
		const snapshot = this.snapshotOf(run);
		try {
			const childFlow = this.childFlowOf(run, node, snapshot, fanoutItem);
			const childSnapshot = buildSubSnapshot(snapshot, childFlow);
			const hash = persistSnapshot(this.db, childSnapshot);
			const parentIteration = (retryOf !== null ? this.runById(retryOf) : null)?.parent_iteration ?? this.execCount(run.id, node.id) + 1;
			return {
				runId: `run_${crypto.randomBytes(4).toString("hex")}`,
				token: `c_${crypto.randomBytes(4).toString("hex")}`,
				flowId: childFlow.id,
				snapshotHash: hash,
				entry: childFlow.entry,
				retryOf,
				fanoutItem,
				role: node.role ?? null,
				threadId: this.threadKeyOf(node),
				parentIteration
			};
		} catch (e) {
			return { error: selfHeal(`子任务图构建失败：${e.message}`, "在面板修好该 subagent 节点后重新 start_run。", this.currentRef(run)) };
		}
	}
	/** 推进事务后补建 child；completeStep / answerGate / reportBlocked / 汇聚推进共用。
	*  只在“当前步是 subagent 且尚无 child”时动手，重复调用安全。 */
	ensureChildrenSpawned(runId) {
		const run = this.runById(runId);
		if (run === null || run.status !== "waiting_children" || run.current_node === null) return void 0;
		const node = findNode(this.snapshotOf(run), run.current_node);
		if (node === void 0 || node.type !== "subagent") return void 0;
		const currentIteration = this.execCount(run.id, node.id) + 1;
		if (this.db.prepare("SELECT 1 AS x FROM runs WHERE parent_run_id = ? AND parent_node = ? AND parent_iteration = ? LIMIT 1").get(run.id, node.id, currentIteration) !== void 0) return void 0;
		const list = this.childItems(run, node);
		if ("error" in list) return list.error;
		const plans = [];
		for (const item of list.items) {
			const planned = this.planChild(run, node, null, item === null ? null : JSON.stringify(item));
			if ("error" in planned) return planned.error;
			plans.push(planned);
		}
		this.spawnChildren(run, node.id, plans, list.fanOuted ? { dropped: list.dropped } : void 0);
	}
	/** 子 Agent 派发步的路由：子任务全部终结后，按 when → branchId → default 选一条边。
	*  只在节点显式声明 branches 时生效；无分支节点仍走 next。 */
	completeSubagentRoute(run, params) {
		const snapshot = this.snapshotOf(run);
		const maxSteps = this.maxStepsOf(snapshot);
		if (run.steps_used >= maxSteps) {
			this.failRun(run);
			return this.finishedResult(run.id, "fail", `已超出全局步数上限（${maxSteps} 步），run 判失败。`);
		}
		const node = run.current_node !== null ? findNode(snapshot, run.current_node) : void 0;
		if (node === void 0 || node.type !== "subagent") return selfHeal(`run ${run.id} 处于 waiting_children 但当前节点不是 subagent（${run.current_node}），数据异常。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		if ((node.branches ?? []).length === 0) return selfHeal("这一步是子 Agent 派发步，完成由子任务回报驱动，不用 complete_step。", "把每个 child 的 preamble 原样放进子任务开头派出；等全部子任务返回后调 get_current_step()，服务端会汇聚结果给出下一步。", this.currentRef(run));
		if (params.summary === void 0 || params.summary.trim() === "") return selfHeal("complete_step 必须带 summary：这一步做了什么，一句话，给人看的。", "重新调 complete_step，带上 summary 和选中的 branchId。", this.currentRef(run));
		if (params.artifacts !== void 0) {
			const bad = this.validateArtifacts(params.artifacts);
			if (bad !== void 0) return selfHeal(bad, "修正 artifacts 后重新调 complete_step。", this.currentRef(run));
		}
		const slots = this.childSlots(run.id, node.id);
		const pending = slots.filter((s) => !isTerminalRun(s.latest));
		if (pending.length > 0) return selfHeal(`还有 ${pending.length} 个子任务没有回报，不能现在选分支。`, "等全部子任务返回后先调 get_current_step() 汇聚（未回报的会被按失败处理），再按返回的分支调 complete_step。", this.currentRef(run));
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const merged = mergeChildPayloads(slots.map((s) => this.childResultOf(s.latest)));
		const selected = this.resolveBranch(run, node, params.branchId, true, merged);
		if ("error" in selected) return selected.error;
		const missing = this.missingLabels(slots);
		const routeSummary = missing.length === 0 ? `子 Agent 全部回报（${slots.length} 个），按分支「${selected.branch.id}」推进` : `子 Agent 汇聚：${slots.length - missing.length} 完成、${missing.length} 失败（缺：${missing.join("、")}），按分支「${selected.branch.id}」推进`;
		const sRow = {
			nodeId: node.id,
			status: "completed",
			summary: `${params.summary.trim()}；${routeSummary}`,
			payload: JSON.stringify(merged),
			branchId: selected.branch.id,
			artifacts: params.artifacts
		};
		const plan = this.resolveAdvance(run, snapshot, selected.branch.to, node.id);
		this.advanceTransaction(run, snapshot, plan, sRow, now);
		const spawned = this.ensureChildrenSpawned(run.id);
		if (spawned !== void 0) {
			this.failRun(run);
			return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
		}
		const r = this.resultForPlan(run.id, snapshot, plan);
		if (missing.length === 0) return r;
		const missingNote = `部分子任务失败（缺：${missing.join("、")}），已按分支推进；失败详情在监控页对应子任务里。`;
		if ("step" in r || "finished" in r) return {
			...r,
			note: r.note !== void 0 ? `${r.note}${missingNote}` : missingNote
		};
		return r;
	}
	/** 分支选择：when 命中优先；其次 Agent 的 branchId；allowDefault 时回落到 "*"。
	*  不返回 StepResult，调用方负责拼自愈文案。 */
	resolveBranch(run, node, requested, allowDefault, payload) {
		const branches = node.branches ?? [];
		const lookup = (expr) => this.lookupExpr(expr, run.id, payload !== void 0 ? {
			nodeId: node.id,
			payload
		} : void 0);
		const auto = matchWhenBranch(branches, lookup);
		const autoBranch = auto.branchId !== null ? branches.find((b) => b.id === auto.branchId) : void 0;
		if (requested !== void 0) {
			const branch = branches.find((b) => b.id === requested);
			if (branch === void 0) {
				const valid = branches.map((b) => `${b.id}（${b.condition === "*" ? "默认" : b.condition}）`).join("、");
				return { error: selfHeal(`branchId 无效：你给的是「${requested}」，节点 ${node.id} 的合法分支是 ${valid}。`, "重新调 complete_step，branchId 从上面列表里选一个最符合你结果的。", this.currentRef(run)) };
			}
			if (branch.when !== void 0 && branch.id !== auto.branchId) return { error: selfHeal(`分支「${branch.id}」由服务端 when 自动判定，当前不命中。`, autoBranch !== void 0 ? `服务端已判定走「${autoBranch.id}」，直接重新调 complete_step（不必带 branchId）。` : "检查 when 是否引用了已完成的节点或产物；不要让 Agent 改判。", this.currentRef(run)) };
			if (autoBranch !== void 0 && branch.id !== autoBranch.id) return { error: selfHeal(`服务端 when 已判定走「${autoBranch.id}」，不能选「${branch.id}」。`, `重新调 complete_step，省略 branchId（或填「${autoBranch.id}」）。`, this.currentRef(run)) };
			return { branch };
		}
		if (autoBranch !== void 0) return { branch: autoBranch };
		if (allowDefault) {
			const fallback = branches.find((b) => b.condition === "*");
			if (fallback !== void 0) return { branch: fallback };
		}
		const valid = branches.map((b) => `${b.id}（${b.condition === "*" ? "默认" : b.condition}）`).join("、");
		return { error: selfHeal(`节点 ${node.id} 需要选一条分支，但没有给 branchId，且没有 when 命中/默认分支。`, `重新调 complete_step，branchId 从这些分支里选：${valid}。`, this.currentRef(run)) };
	}
	validateArtifacts(artifacts) {
		if (!Array.isArray(artifacts)) return "artifacts 必须是数组。";
		const seen = /* @__PURE__ */ new Set();
		for (const artifact of artifacts) {
			if (artifact === null || typeof artifact !== "object") return "artifacts 的每一项必须是对象。";
			if (typeof artifact.key !== "string" || !/^[A-Za-z0-9_]+$/.test(artifact.key)) return `产物 key 不合法：${JSON.stringify(artifact.key)}（只允许字母/数字/下划线）。`;
			if (seen.has(artifact.key)) return `同一次回报里产物 key 重复：${artifact.key}。`;
			seen.add(artifact.key);
		}
	}
	writeArtifacts(run, nodeId, artifacts, now) {
		if (artifacts === void 0 || artifacts.length === 0) return;
		const root = run.root_run_id ?? run.id;
		const versionStmt = this.db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM run_artifacts WHERE root_run_id = ? AND key = ?");
		const insert = this.db.prepare(`INSERT INTO run_artifacts (root_run_id, key, version, run_id, node_id, role, summary, path, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
		for (const artifact of artifacts) {
			const current = versionStmt.get(root, artifact.key).v;
			const content = typeof artifact.content === "string" ? artifact.content.slice(0, 8192) : null;
			insert.run(root, artifact.key, current + 1, run.id, nodeId, run.role, artifact.summary ?? null, artifact.path ?? null, content, now);
		}
	}
	missingLabels(slots) {
		return slots.filter((s) => s.latest.status === "failed").map((s) => {
			if (s.latest.fanout_item === null) return s.latest.id;
			try {
				return formatItem(JSON.parse(s.latest.fanout_item));
			} catch {
				return s.latest.id;
			}
		});
	}
	/** §7.5 汇聚：主 Agent 在派发步上调 get_current_step 触发。
	*  前提是宿主的 Task 调用已全部返回——children 没完成的就是"未回报"，判 failed 后走失败处理。
	*  对稳定的 child 终态收敛（重复调用幂等）：要么推进离开派发步，要么重派后仍在派发步等新一轮回报。 */
	gatherChildren(run) {
		const snapshot = this.snapshotOf(run);
		const maxSteps = this.maxStepsOf(snapshot);
		if (run.steps_used >= maxSteps) {
			this.failRun(run);
			return this.finishedResult(run.id, "fail", `已超出全局步数上限（${maxSteps} 步），run 判失败。`);
		}
		const node = run.current_node !== null ? findNode(snapshot, run.current_node) : void 0;
		if (node === void 0 || node.type !== "subagent") return selfHeal(`run ${run.id} 处于 waiting_children 但当前节点不是 subagent（${run.current_node}），数据异常。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		let slots = this.childSlots(run.id, node.id);
		if (slots.length === 0) {
			const list = this.childItems(run, node);
			if ("error" in list) return list.error;
			const plans = [];
			for (const item of list.items) {
				const planned = this.planChild(run, node, null, item === null ? null : JSON.stringify(item));
				if ("error" in planned) return planned.error;
				plans.push(planned);
			}
			this.spawnChildren(run, node.id, plans, list.fanOuted ? { dropped: list.dropped } : void 0);
			const step = this.stepResult(run.id);
			const note = "派发步的 child 记录缺失（上次推进后进程中断），已按节点配置补建；把下面的 preamble 发给子 Agent，全部返回后再调 get_current_step()。";
			return "step" in step ? {
				...step,
				note
			} : step;
		}
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const stuck = slots.filter((s) => !isTerminalRun(s.latest));
		for (const s of stuck) this.failChild(s.latest, now);
		if (stuck.length > 0) slots = this.childSlots(run.id, node.id);
		const failedSlots = slots.filter((s) => s.latest.status === "failed");
		const retryable = failedSlots.filter((s) => s.latest.id === s.original.id);
		if (retryable.length > 0) {
			const plans = [];
			for (const s of retryable) {
				const plan = this.planChild(run, node, s.original.id, s.original.fanout_item);
				if ("error" in plan) return plan.error;
				plans.push(plan);
			}
			this.spawnChildren(run, node.id, plans, node.fanOut !== void 0 ? { dropped: [] } : void 0);
			const step = this.stepResult(run.id);
			const note = `${failedSlots.length} 个子任务失败（原因见监控页对应子任务），已建新的 child run 重派——只重派这一轮：把新的 preamble 原样发给子 Agent 再跑一次，全部返回后再调 get_current_step()。`;
			return "step" in step ? {
				...step,
				note
			} : step;
		}
		const missing = this.missingLabels(slots);
		const merged = mergeChildPayloads(slots.map((s) => this.childResultOf(s.latest)));
		const summary = missing.length === 0 ? `子 Agent 全部回报（${slots.length} 个）` : `子 Agent 汇聚：${slots.length - missing.length} 完成、${missing.length} 失败（缺：${missing.join("、")}）`;
		if ((node.branches ?? []).length > 0) {
			const auto = matchWhenBranch(node.branches, (expr) => this.lookupExpr(expr, run.id, {
				nodeId: node.id,
				payload: merged
			}));
			const autoBranch = auto.branchId !== null ? node.branches.find((b) => b.id === auto.branchId) : void 0;
			const nonWhen = node.branches.filter((b) => b.when === void 0 && b.condition !== "*");
			const defaultBranch = node.branches.find((b) => b.condition === "*");
			let chosen = autoBranch;
			if (chosen === void 0 && nonWhen.length === 0) chosen = defaultBranch;
			if (chosen === void 0) {
				if (nonWhen.length === 0) return selfHeal(`节点 ${node.id} 的 when 分支全部不命中，且没有默认分支。`, "在图上补一条 default（\"*\"）分支，或检查 when 引用的节点/产物是否存在。", this.currentRef(run));
				const step = this.stepResult(run.id);
				const note = `子任务已全部回报（${slots.length} 个），请在分支里选一条后调 complete_step({ branchId, summary, payload? })。` + (missing.length > 0 ? `缺失：${missing.join("、")}。` : "");
				return "step" in step ? {
					...step,
					note
				} : step;
			}
			const routeRow = {
				nodeId: node.id,
				status: "completed",
				summary: `${summary}，按分支「${chosen.id}」推进`,
				payload: JSON.stringify(merged),
				branchId: chosen.id
			};
			const plan = this.resolveAdvance(run, snapshot, chosen.to, node.id);
			this.advanceTransaction(run, snapshot, plan, routeRow, now);
			const spawned = this.ensureChildrenSpawned(run.id);
			if (spawned !== void 0) {
				this.failRun(run);
				return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
			}
			const routed = this.resultForPlan(run.id, snapshot, plan);
			if (missing.length === 0) return routed;
			const missingNote = `部分子任务失败（缺：${missing.join("、")}），已按分支推进；失败详情在监控页对应子任务里。`;
			if ("step" in routed || "finished" in routed) return {
				...routed,
				note: routed.note !== void 0 ? `${routed.note}${missingNote}` : missingNote
			};
			return routed;
		}
		const sRow = {
			nodeId: node.id,
			status: "completed",
			summary,
			payload: JSON.stringify(merged),
			branchId: null
		};
		const successorId = node.next ?? null;
		const plan = successorId === null ? {
			kind: "advance",
			targetId: null,
			limitRows: []
		} : this.resolveAdvance(run, snapshot, successorId, node.id);
		this.advanceTransaction(run, snapshot, plan, sRow, now);
		const spawned = this.ensureChildrenSpawned(run.id);
		if (spawned !== void 0) {
			this.failRun(run);
			return selfHeal(spawned.what, `${spawned.guidance}主 run 已判失败，修好后请重新 start_run。`, null);
		}
		const r = this.resultForPlan(run.id, snapshot, plan);
		if (missing.length === 0) return r;
		const missingNote = `部分子任务失败（缺：${missing.join("、")}），已带部分结果推进；失败详情在监控页对应子任务里。`;
		if ("step" in r || "finished" in r) return {
			...r,
			note: r.note !== void 0 ? `${r.note}${missingNote}` : missingNote
		};
		return r;
	}
	/** child 批量落库（独立小事务 + child_spawned 事件）；主 run 指针已在先前的推进事务里更新。
	*  fan-out 节点同时落一条 dispatched 轨迹：N 个 child 与被 max 截断丢弃的条目都显性在案（铁律：不静默截断）。 */
	spawnChildren(run, parentNodeId, plans, fanout) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const events = [];
		this.db.transaction(() => {
			this.db.prepare(`UPDATE runs SET last_activity = ? WHERE id = ?`).run(now, run.id);
			this.insertChildRuns(run, parentNodeId, plans, events, now);
			if (fanout !== void 0) this.insertDispatchedRow(run, parentNodeId, plans, fanout.dropped, now);
		})();
		for (const e of events) this.emit(e);
	}
	/** 派发轨迹（dispatched）：N 个 child 与被 max 截断丢弃的条目都显性在案，面板/步骤视图都读它 */
	insertDispatchedRow(run, parentNodeId, plans, dropped, now) {
		const droppedNote = dropped.length > 0 ? `（max 截断，丢弃 ${dropped.length} 个：${dropped.map(formatItem).join("、")}）` : "";
		this.db.prepare(`INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
         VALUES (?, ?, ?, 'dispatched', ?, ?, NULL, ?, ?)`).run(run.id, parentNodeId, this.execCount(run.id, parentNodeId) + 1, `派出 ${plans.length} 个子任务${droppedNote}`, JSON.stringify({
			children: plans.map((p) => p.runId),
			dropped
		}), now, now);
	}
	/** child 落库（在事务内调用）；child_spawned 事件随事务提交后发出 */
	insertChildRuns(run, parentNodeId, plans, events, now) {
		const stmt = this.db.prepare(`INSERT INTO runs (id, parent_run_id, root_run_id, flow_id, flow_snapshot_hash, entry_node, current_node,
           status, cwd, project_name, inputs, role, thread_id, child_token, parent_node, parent_iteration, retry_of, fanout_item, steps_used, last_activity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`);
		for (const c of plans) {
			stmt.run(c.runId, run.id, run.root_run_id, c.flowId, c.snapshotHash, c.entry, c.entry, run.cwd, run.project_name, run.inputs, c.role, c.threadId, c.token, parentNodeId, c.parentIteration, c.retryOf, c.fanoutItem, now, now);
			events.push({
				type: "child_spawned",
				runId: run.id,
				nodeId: parentNodeId,
				childRunId: c.runId,
				at: now
			});
		}
	}
	/** (run, 派发节点) 的 child 槽位：每槽 = 原始 run + 最新替代（重派后的那个，若有）。
	*  只取最近一轮派发（parent_iteration 最大），回路里历史轮次不再参与汇聚。
	*  nodeId 为 null 表示该 run 的全部 child（join 缺省语义，§4 join.waitFor）。 */
	childSlots(runId, nodeId) {
		return (nodeId !== null ? this.db.prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NULL
               AND COALESCE(parent_iteration, 0) = ? ORDER BY created_at, rowid`).all(runId, nodeId, this.latestParentIteration(runId, nodeId)) : this.db.prepare(`SELECT * FROM runs r WHERE r.parent_run_id = ? AND r.retry_of IS NULL
               AND COALESCE(r.parent_iteration, 0) = (
                 SELECT COALESCE(MAX(x.parent_iteration), 0) FROM runs x
                 WHERE x.parent_run_id = r.parent_run_id AND x.parent_node = r.parent_node
               )
               ORDER BY r.created_at, r.rowid`).all(runId)).map((o) => {
			return {
				original: o,
				latest: this.runBy("retry_of = ?", o.id) ?? o
			};
		});
	}
	latestParentIteration(runId, nodeId) {
		return this.db.prepare("SELECT COALESCE(MAX(parent_iteration), 0) AS n FROM runs WHERE parent_run_id = ? AND parent_node = ?").get(runId, nodeId).n;
	}
	/** 派发步当前要派的那一批 child（视图用）：最近一轮，有重派批就只看重派批 */
	currentWave(runId, nodeId) {
		const iteration = this.latestParentIteration(runId, nodeId);
		const retries = this.db.prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NOT NULL
         AND COALESCE(parent_iteration, 0) = ? ORDER BY created_at, rowid`).all(runId, nodeId, iteration);
		if (retries.length > 0) return retries;
		return this.db.prepare(`SELECT * FROM runs WHERE parent_run_id = ? AND parent_node = ? AND retry_of IS NULL
         AND COALESCE(parent_iteration, 0) = ? ORDER BY created_at, rowid`).all(runId, nodeId, iteration);
	}
	/** child 置 failed（§7.5 "未回报"路径）；落一条 blocked 轨迹说明原因，run_finished 事件让面板立即看到 */
	failChild(child, now) {
		this.db.transaction(() => {
			this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`).run(now, now, child.id);
			if (child.current_node !== null) this.db.prepare(`INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
             VALUES (?, ?, ?, 'blocked', ?, '{}', NULL, ?, ?)`).run(child.id, child.current_node, this.execCount(child.id, child.current_node) + 1, "未回报：Task 调用已返回，但子任务没有在结束前 complete_step", now, now);
		})();
		this.emit({
			type: "run_finished",
			runId: child.id,
			outcome: "fail",
			at: now
		});
	}
	/** child 的结果条目（join 视图与汇总 payload 用）；summary 取它最后一条轨迹 */
	childResultOf(child) {
		return {
			childToken: child.child_token ?? "",
			status: child.status,
			summary: this.childSummaryOf(child.id),
			payload: this.childPayloadOf(child.id)
		};
	}
	/** child 最近一次 completed 轨迹的 payload；失败/未回报的 child 返回 undefined */
	childPayloadOf(runId) {
		const row = this.db.prepare("SELECT payload FROM node_executions WHERE run_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1").get(runId);
		if (row === void 0) return void 0;
		try {
			return JSON.parse(row.payload);
		} catch {
			return;
		}
	}
	childSummaryOf(runId) {
		return this.db.prepare("SELECT summary FROM node_executions WHERE run_id = ? ORDER BY id DESC LIMIT 1").get(runId)?.summary ?? "";
	}
	/** fan-out 条目渲染：把 extraPrompt 里的 {{item}} 替换为该 child 的条目（非 fan-out 原样返回） */
	renderItem(text, fanoutItem) {
		if (fanoutItem === null || !text.includes("{{")) return text;
		let value;
		try {
			value = JSON.parse(fanoutItem);
		} catch {
			value = fanoutItem;
		}
		return text.replace(/\{\{\s*item\s*\}\}/g, () => typeof value === "string" ? value : JSON.stringify(value));
	}
	childFlowOf(run, node, snapshot, fanoutItem) {
		const parent = snapshot.flows[snapshot.rootFlowId];
		const name = node.title?.trim() !== "" && node.title !== void 0 ? node.title : node.id;
		if (node.mode === "inline") return {
			id: `${parent.id}::${node.id}`,
			name,
			entry: "task",
			nodes: [{
				id: "task",
				type: "prompt",
				instruction: this.renderItem(this.render(node.extraPrompt, run.id), fanoutItem)
			}]
		};
		if (node.mode === "subflow") {
			const sub = node.subflow;
			if (sub === void 0) throw new Error(`节点 ${node.id} 是 subflow 模式但没有内嵌子图`);
			return {
				id: `${parent.id}::${node.id}`,
				name,
				entry: sub.entry,
				maxSteps: sub.maxSteps,
				nodes: sub.nodes
			};
		}
		const ref = snapshot.flows[node.flowRef ?? ""];
		if (ref === void 0) throw new Error(`flowRef 引用的图不在快照里：${node.flowRef}（节点 ${node.id}）`);
		return ref;
	}
	/** 线程 key：new/缺省 = 一次性；role = 同角色共享；其他字符串 = 自定义线程 */
	threadKeyOf(node) {
		if (node.thread === void 0 || node.thread === "new") return null;
		if (node.thread === "role") return node.role !== void 0 ? `role:${node.role}` : null;
		return node.thread;
	}
	threadTurn(run, key, excludeRunId) {
		const root = run.root_run_id ?? run.id;
		return this.db.prepare("SELECT COUNT(*) AS c FROM runs WHERE root_run_id = ? AND thread_id = ? AND id != ? AND id != ?").get(root, key, run.id, excludeRunId ?? "").c + 1;
	}
	/** 同线程最近几轮的摘要：给新 child 的 preamble 用，跨轮记忆靠它而不是主 Agent 复述 */
	threadDigest(run, key, excludeRunId) {
		const root = run.root_run_id ?? run.id;
		const rows = this.db.prepare(`SELECT id, role, status FROM runs WHERE root_run_id = ? AND thread_id = ? AND id != ? AND id != ?
         ORDER BY created_at DESC, rowid DESC LIMIT 5`).all(root, key, run.id, excludeRunId ?? "");
		if (rows.length === 0) return "";
		const total = this.db.prepare("SELECT COUNT(*) AS c FROM runs WHERE root_run_id = ? AND thread_id = ? AND id != ? AND id != ?").get(root, key, run.id, excludeRunId ?? "").c;
		const text = rows.slice().reverse().map((row, index) => {
			const turn = total - rows.length + index + 1;
			const summary = this.childSummaryOf(row.id).replace(/\s+/g, " ").trim();
			return `- 第 ${turn} 轮（${row.role ?? "未命名角色"}，${row.status}）：${summary === "" ? "（无摘要）" : summary}`;
		}).join("\n");
		return text.length > 1200 ? `…${text.slice(-1200)}` : text;
	}
	roleOf(snapshot, roleId) {
		if (roleId === void 0) return void 0;
		return (snapshot.agents ?? []).find((agent) => agent.id === roleId);
	}
	preambleFor(run, node, token, childRunId) {
		const snapshot = this.snapshotOf(run);
		const role = this.roleOf(snapshot, node.role);
		const threadKey = this.threadKeyOf(node);
		return preambleText(run.id, node.id, token, {
			role,
			roleId: node.role,
			threadKey,
			turn: threadKey !== null ? this.threadTurn(run, threadKey, childRunId) : void 0,
			digest: threadKey !== null ? this.threadDigest(run, threadKey, childRunId) : "",
			reportHint: node.reportHint
		});
	}
	resultForRun(run, via) {
		if (run.status === "completed" || run.status === "failed" || run.status === "stale") {
			const outcome = this.runOutcome(run);
			const note = run.status === "stale" ? `这个 run 已被标记为 stale（服务端重启或长时间无活动）。` : `这个 run 已经结束（${run.status}）。`;
			return this.finishedResult(run.id, outcome, `${note}via ${via} 查询；如需重跑请调 start_run。`);
		}
		return this.stepResult(run.id);
	}
	runOutcome(run) {
		if (run.status === "failed") return "fail";
		const snapshot = this.snapshotOf(run);
		const end = run.current_node !== null ? findNode(snapshot, run.current_node) : void 0;
		if (end !== void 0 && end.type === "end") return end.outcome;
		return "success";
	}
	stepResult(runId) {
		const run = this.runById(runId);
		if (run === null || run.current_node === null) return selfHeal(`run ${runId} 不存在或没有当前节点。`, "调 get_current_step 查最新状态。");
		const node = findNode(this.snapshotOf(run), run.current_node);
		if (node === void 0) return selfHeal(`快照里找不到节点 ${run.current_node}（run ${runId} 的数据异常）。`, "这是服务端数据问题，请把这条错误原样反馈给用户。", null);
		const result = {
			runId: run.id,
			step: this.buildStepView(run, node),
			discipline: DISCIPLINE_TEXT,
			progress: { completed: this.completedCount(run.id) }
		};
		if (node.type === "gate") result.note = "人工卡点：run 已挂起等确认。把问题转达用户后调 await_gate(gateId) 等待（每轮 60 秒）；用户已在聊天里答复就调 answer_gate(gateId, optionId) 代填。";
		if (node.type === "subagent") {
			result.note = "派发步：把每个 child 的 preamble 原样放进对应子任务开头（不许改写或摘要），extraPrompt 一并带上。等全部子任务返回后再调 get_current_step()，服务端会汇聚结果给出下一步。";
			const dRow = this.db.prepare("SELECT payload FROM node_executions WHERE run_id = ? AND node_id = ? AND status = 'dispatched' ORDER BY id DESC LIMIT 1").get(run.id, node.id);
			if (dRow !== void 0) {
				const dropped = JSON.parse(dRow.payload).dropped ?? [];
				if (dropped.length > 0) result.note += `fan-out 已按 max 截断：丢弃了 ${dropped.length} 个条目（${dropped.map(formatItem).join("、")}），监控页轨迹有完整记录。`;
			}
		}
		return result;
	}
	finishedResult(runId, outcome, note) {
		return {
			runId,
			finished: true,
			outcome,
			note,
			progress: { completed: this.completedCount(runId) }
		};
	}
	currentRef(run) {
		const snapshot = this.snapshotOf(run);
		const node = run.current_node !== null ? findNode(snapshot, run.current_node) : void 0;
		if (node === void 0) return null;
		return {
			runId: run.id,
			step: this.buildStepView(run, node)
		};
	}
	/** 下发视图：插值已渲染、branches 已剥离 to、'*' 条件转成人话 */
	buildStepView(run, node) {
		const view = {
			nodeId: node.id,
			kind: node.type,
			title: node.title?.trim() !== "" && node.title !== void 0 ? node.title : node.id,
			instruction: this.render(node.instruction?.trim() !== "" && node.instruction !== void 0 ? node.instruction : node.type === "gate" ? "人工卡点：把问题原样转达用户，等他答复。" : "", run.id)
		};
		if (node.type === "tool") view.tool = {
			name: node.toolName,
			params: renderParams(node.params ?? {}, (text) => this.render(text, run.id))
		};
		if ((node.branches ?? []).length > 0 && node.type !== "gate") {
			const manual = node.branches.filter((b) => b.when === void 0);
			view.branches = (manual.length > 0 ? manual : node.branches).map((b) => {
				const branch = {
					id: b.id,
					condition: b.condition === "*" ? "默认：其他分支都不满足时走这条" : b.condition
				};
				if (b.when !== void 0) branch.auto = true;
				return branch;
			});
		}
		const roleId = node.type === "subagent" ? node.role : run.role ?? void 0;
		if (roleId !== void 0) view.role = roleId;
		const threadKey = node.type === "subagent" ? this.threadKeyOf(node) : run.thread_id;
		if (threadKey !== null && threadKey !== void 0) {
			view.thread = threadKey;
			view.turn = this.threadTurn(run, threadKey);
		}
		if (node.type === "end") view.outcome = node.outcome;
		if (node.type === "gate") {
			const pending = this.pendingDecisionOf(run.id, node.id);
			if (pending !== null) view.gateId = String(pending.id);
			view.question = node.question;
			view.options = node.options.map((o) => ({
				id: o.id,
				label: o.label
			}));
		}
		if (node.type === "subagent") {
			const wave = this.currentWave(run.id, node.id);
			const allReturned = wave.length > 0 && wave.every((child) => isTerminalRun(child));
			if (wave.length > 0 && !allReturned) view.children = wave.map((c) => ({
				childToken: c.child_token ?? "",
				preamble: this.preambleFor(run, node, c.child_token ?? "", c.id),
				extraPrompt: this.renderItem(this.render(node.extraPrompt, run.id), c.fanout_item)
			}));
			else if ((node.branches ?? []).length > 0) {
				const slots = this.childSlots(run.id, node.id);
				if (slots.length > 0) {
					view.childResults = slots.map((s) => this.childResultOf(s.latest));
					const lines = view.childResults.map((r) => `- ${r.status === "completed" ? "✓" : "✗"} ${r.summary}`);
					view.instruction = [
						view.instruction,
						lines.length > 0 ? `\n\n各子任务结果：\n${lines.join("\n")}` : "",
						"\n请根据结果选一条分支，调 complete_step({ branchId, summary, payload? })；when 能判定的分支服务端已自动走。"
					].join("");
				}
			}
		}
		if (node.type === "join") {
			const results = this.childSlots(run.id, node.waitFor ?? null).map((s) => this.childResultOf(s.latest));
			const lines = results.map((r) => `- ${r.status === "completed" ? "✓" : "✗"} ${r.summary}`);
			view.childResults = results;
			view.aggregateInstruction = this.render(node.aggregateInstruction, run.id);
			view.instruction = lines.length > 0 ? `${view.aggregateInstruction}\n\n各子任务结果：\n${lines.join("\n")}` : view.aggregateInstruction;
		}
		return view;
	}
	/** {{nodeId.payload.field}} 插值：用该 run 中该节点最近一次执行的 payload 渲染（§4.4）。
	*  引用的节点没跑过或字段不存在时保留原 token——让 Agent 能看出缺了什么，而不是拿到一段静默错误的文本。 */
	render(text, runId) {
		return text.replace(/\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g, (raw, expr) => {
			const value = this.lookupExpr(expr, runId);
			return value === void 0 ? raw : typeof value === "string" ? value : JSON.stringify(value);
		});
	}
	lookupExpr(expr, runId, override) {
		const run = this.runById(runId);
		if (override !== void 0) {
			const prefix = `${override.nodeId}.payload`;
			if (expr === prefix) return override.payload;
			if (expr.startsWith(`${prefix}.`)) return walkPath(override.payload, expr.slice(prefix.length + 1).split("."));
		}
		if (expr === "inputs") return parseJsonObject(run?.inputs ?? null);
		if (expr.startsWith("inputs.")) return walkPath(parseJsonObject(run?.inputs ?? null), expr.slice(7).split("."));
		if (expr.startsWith("artifacts.")) {
			const [key, ...path] = expr.slice(10).split(".");
			const artifact = this.latestArtifact(run, key ?? "");
			if (artifact === null) return void 0;
			if (path.length === 0) return artifact.path ?? artifact.summary ?? artifact.content ?? void 0;
			return walkPath(artifact, path);
		}
		const [nodeId, payloadSeg, ...path] = expr.split(".");
		if (payloadSeg !== "payload" || nodeId === void 0 || path.length === 0) return void 0;
		const row = this.db.prepare("SELECT payload FROM node_executions WHERE run_id = ? AND node_id = ? AND status = 'completed' ORDER BY iteration DESC, id DESC LIMIT 1").get(runId, nodeId);
		if (row === void 0) return void 0;
		let cur = JSON.parse(row.payload);
		for (const seg of path) {
			if (cur === null || typeof cur !== "object") return void 0;
			cur = cur[seg];
		}
		return cur;
	}
	latestArtifact(run, key) {
		if (run === null) return null;
		const root = run.root_run_id ?? run.id;
		if (key === "") return null;
		const row = this.db.prepare(`SELECT key, version, run_id, node_id, role, summary, path, content, created_at
         FROM run_artifacts WHERE root_run_id = ? AND key = ? ORDER BY version DESC LIMIT 1`).get(root, key);
		if (row === void 0) return null;
		return {
			key: row.key,
			version: row.version,
			runId: row.run_id,
			nodeId: row.node_id,
			role: row.role,
			summary: row.summary,
			path: row.path,
			content: row.content,
			createdAt: row.created_at
		};
	}
	completedCount(runId) {
		return this.db.prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND status = 'completed'").get(runId).c;
	}
	/** run 定位顺序：childToken（子 Agent）→ runId（显式）→ hostSession（DSH 会话绑定） */
	resolveRun(ref) {
		if (ref.childToken !== void 0) return this.runBy("child_token = ?", ref.childToken);
		if (ref.runId !== void 0) return this.runBy("id = ?", ref.runId);
		if (ref.hostSession !== void 0) return this.latestRunByHostSession(ref.hostSession);
		return null;
	}
	/** 按 DSH 会话定位：优先活跃 run；没有时回落到最近的 run（已终结也能答"跑完了"而不是"找不到"）。rowid 决胜同一毫秒的建 run */
	latestRunByHostSession(hostSession) {
		const active = this.latestActiveRunByHostSession(hostSession);
		if (active !== null) return active;
		return this.db.prepare(`SELECT * FROM runs WHERE host_session = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(hostSession) ?? null;
	}
	/** 该会话最新一个未终结的 run（用于 start_run 的"一会话一活跃 run"守卫） */
	latestActiveRunByHostSession(hostSession) {
		return this.db.prepare(`SELECT * FROM runs WHERE host_session = ? AND status IN ('running', 'waiting_gate', 'waiting_children') ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(hostSession) ?? null;
	}
	runBy(where, arg) {
		return this.db.prepare(`SELECT * FROM runs WHERE ${where}`).get(arg) ?? null;
	}
	runById(runId) {
		return this.runBy("id = ?", runId);
	}
	/** gateId → 未决（pending）决策行；不是数字、不存在或已决都返回 null */
	pendingGateById(gateId) {
		const id = Number.parseInt(gateId, 10);
		if (!Number.isInteger(id) || id <= 0) return null;
		return this.db.prepare("SELECT * FROM gate_decisions WHERE id = ? AND decided_at IS NULL").get(id) ?? null;
	}
	/** gateId → 决策行（不论已决与否） */
	gateRowById(gateId) {
		const id = Number.parseInt(gateId, 10);
		if (!Number.isInteger(id) || id <= 0) return void 0;
		return this.db.prepare("SELECT run_id FROM gate_decisions WHERE id = ?").get(id);
	}
	/** run + 节点 → 最近一条未决决策行 */
	pendingDecisionOf(runId, nodeId) {
		return this.db.prepare("SELECT * FROM gate_decisions WHERE run_id = ? AND node_id = ? AND decided_at IS NULL ORDER BY id DESC LIMIT 1").get(runId, nodeId) ?? null;
	}
	/** 写 pending 决策行（在事务内调用）；source 先占位 'pending'，放行时更新为真实通道 */
	insertPendingGate(runId, node) {
		const info = this.db.prepare("INSERT INTO gate_decisions (run_id, node_id, question, option_id, note, source, decided_at) VALUES (?, ?, ?, NULL, NULL, 'pending', NULL)").run(runId, node.id, node.question);
		return Number(info.lastInsertRowid);
	}
	/** run 直接落在卡点上（入口即 gate）：挂起 + 写 pending，独立事务 */
	enterGate(runId, node, now) {
		return this.db.transaction(() => {
			this.db.prepare(`UPDATE runs SET status = 'waiting_gate', last_activity = ? WHERE id = ?`).run(now, runId);
			return this.insertPendingGate(runId, node);
		})();
	}
	/** 放行：决策行落选项、备注、来源与时间（在事务内调用） */
	decideGateRow(decisionId, optionId, note, source, now) {
		this.db.prepare("UPDATE gate_decisions SET option_id = ?, note = ?, source = ?, decided_at = ? WHERE id = ?").run(optionId, note, source, now, decisionId);
	}
	/** 自愈三段式的 current：终结态给 finished 形态，其余给当前步 */
	currentOf(run) {
		if (run.status === "completed" || run.status === "failed" || run.status === "stale") return {
			runId: run.id,
			finished: true,
			outcome: this.runOutcome(run)
		};
		return this.currentRef(run);
	}
	/** 解析最终推进目标（§4.5）：目标撞 iterationLimit / 回路 maxRounds 时不执行它，落 limit_exceeded 轨迹并改走逃生出口；
	*  无逃生出口判失败。校验器已保证逃生边可达终点，逃生链成环只是防御性兜底。 */
	resolveAdvance(run, snapshot, successorId, pendingNodeId) {
		const limitRows = [];
		const seen = /* @__PURE__ */ new Set();
		/**
		* 该节点已经执行过几次（用于上限判定）。
		* 刚完成、还没落库的这一行只在我们“正要再次进入它自己”时补上：
		* - 自环 / 重新进入同一节点：+1（否则会比上限多跑一次）；
		* - 进入回路里的另一个节点：控制器这次完成不影响“还能不能再进一次”的判定，不补。
		*/
		const countFor = (nodeId, targetId) => this.executionCount(run.id, nodeId) + (nodeId === targetId && nodeId === pendingNodeId ? 1 : 0);
		let targetId = successorId;
		while (typeof targetId === "string") {
			const target = findNode(snapshot, targetId);
			if (target === void 0) return {
				kind: "dangling",
				nodeId: targetId
			};
			const loop = target.type === "end" ? void 0 : this.loopLimitOf(snapshot, target);
			if (loop !== void 0 && countFor(loop.controllerId, target.id) >= loop.limit) {
				const escape = target.onLimitExceeded ?? loop.controller.onLimitExceeded ?? target.branches?.find((branch) => branch.condition === "*")?.to;
				if (escape === void 0) return {
					kind: "fail",
					reason: `回路 ${loop.id} 已到 maxRounds（${loop.limit} 轮）且没有配 onLimitExceeded 逃生出口，run 判失败。`
				};
				if (seen.has(`loop:${loop.id}`)) return {
					kind: "fail",
					reason: `回路 ${loop.id} 撞上限后逃生链成环，run 判失败。`
				};
				seen.add(`loop:${loop.id}`);
				limitRows.push({
					nodeId: target.id,
					iteration: this.execCount(run.id, target.id) + 1,
					limit: loop.limit,
					loopId: loop.id
				});
				targetId = escape;
				continue;
			}
			if (target.type !== "end" && target.iterationLimit !== void 0 && countFor(target.id, target.id) >= target.iterationLimit) {
				if (target.onLimitExceeded === void 0) return {
					kind: "fail",
					reason: `节点 ${target.id} 已到迭代上限（${target.iterationLimit} 次）且没有配 onLimitExceeded 逃生出口，run 判失败。`
				};
				if (seen.has(target.id)) return {
					kind: "fail",
					reason: `节点 ${target.id} 撞迭代上限后逃生链成环，run 判失败。`
				};
				seen.add(target.id);
				limitRows.push({
					nodeId: target.id,
					iteration: this.execCount(run.id, target.id) + 1,
					limit: target.iterationLimit
				});
				targetId = target.onLimitExceeded;
				continue;
			}
			return {
				kind: "advance",
				targetId,
				limitRows
			};
		}
		return {
			kind: "advance",
			targetId: null,
			limitRows
		};
	}
	/** 找节点所属回路的控制器：控制器 = 同 loopId 且声明了 maxRounds 的节点 */
	loopLimitOf(snapshot, node) {
		if (node.loopId === void 0 || node.loopId.trim() === "") return void 0;
		if (node.maxRounds !== void 0) return {
			id: node.loopId,
			limit: node.maxRounds,
			controllerId: node.id,
			controller: node
		};
		const controller = snapshot.flows[snapshot.rootFlowId]?.nodes.find((candidate) => candidate.loopId === node.loopId && candidate.maxRounds !== void 0);
		if (controller?.maxRounds === void 0) return void 0;
		return {
			id: node.loopId,
			limit: controller.maxRounds,
			controllerId: controller.id,
			controller
		};
	}
	/** 单事务推进：落本步轨迹（completed / blocked）+ 迭代逃生轨迹 + 卡点决策更新 + 子 run 落库 + 更新 run 指针/状态，任何一步失败整体回滚。
	*  目标是 gate 时置 waiting_gate 并写 pending 卡点决策（§7.6）；目标是 subagent 时置 waiting_children（child 落库由调用方在事务后补，见 completeStep）。
	*  事件在事务提交后才发（事务内只收集），回滚不会产生假事件。 */
	advanceTransaction(run, snapshot, plan, first, now, gate) {
		const events = [{
			type: "step_completed",
			runId: run.id,
			nodeId: first.nodeId,
			status: first.status,
			at: now
		}];
		this.db.transaction(() => {
			if (gate !== void 0) this.decideGateRow(gate.decisionId, gate.optionId, gate.note, gate.source, now);
			const insert = this.db.prepare(`INSERT INTO node_executions (run_id, node_id, iteration, status, summary, payload, branch_id, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
			insert.run(run.id, first.nodeId, this.execCount(run.id, first.nodeId) + 1, first.status, first.summary, first.payload, first.branchId, now, now);
			this.writeArtifacts(run, first.nodeId, first.artifacts, now);
			const limitRows = plan.kind === "advance" ? plan.limitRows : [];
			for (const row of limitRows) {
				insert.run(run.id, row.nodeId, row.iteration, "limit_exceeded", row.loopId !== void 0 ? `回路 ${row.loopId} 已到 maxRounds（${row.limit} 轮），未执行该节点，按逃生出口继续` : `撞迭代上限（${row.limit} 次），未执行该节点，按 onLimitExceeded 逃生`, "{}", null, now, now);
				events.push({
					type: "step_completed",
					runId: run.id,
					nodeId: row.nodeId,
					status: "limit_exceeded",
					at: now
				});
			}
			const stepsUsed = run.steps_used + 1 + limitRows.length;
			if (plan.kind === "fail" || plan.kind === "dangling") {
				this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`).run(stepsUsed, now, now, run.id);
				events.push({
					type: "run_finished",
					runId: run.id,
					outcome: "fail",
					at: now
				});
				return;
			}
			if (plan.targetId === null) {
				this.db.prepare(`UPDATE runs SET current_node = NULL, status = 'completed', outcome = 'success', steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`).run(stepsUsed, now, now, run.id);
				events.push({
					type: "run_finished",
					runId: run.id,
					outcome: "success",
					at: now
				});
				return;
			}
			const target = findNode(snapshot, plan.targetId);
			if (target !== void 0 && target.type === "end") {
				this.db.prepare(`UPDATE runs SET current_node = ?, status = 'completed', outcome = ?, steps_used = ?, last_activity = ?, finished_at = ? WHERE id = ?`).run(target.id, target.outcome, stepsUsed, now, now, run.id);
				events.push({
					type: "run_finished",
					runId: run.id,
					outcome: target.outcome,
					at: now
				});
			} else if (target !== void 0 && target.type === "gate") {
				this.db.prepare(`UPDATE runs SET current_node = ?, status = 'waiting_gate', steps_used = ?, last_activity = ? WHERE id = ?`).run(target.id, stepsUsed, now, run.id);
				const gateId = this.insertPendingGate(run.id, target);
				events.push({
					type: "gate_pending",
					runId: run.id,
					nodeId: target.id,
					gateId: String(gateId),
					question: target.question,
					at: now
				});
			} else if (target !== void 0 && target.type === "subagent") this.db.prepare(`UPDATE runs SET current_node = ?, status = 'waiting_children', steps_used = ?, last_activity = ? WHERE id = ?`).run(target.id, stepsUsed, now, run.id);
			else this.db.prepare(`UPDATE runs SET current_node = ?, status = 'running', steps_used = ?, last_activity = ? WHERE id = ?`).run(plan.targetId, stepsUsed, now, run.id);
		})();
		for (const e of events) this.emit(e);
	}
	/** 推进事务提交后的应答：失败/悬空/隐式 end/显式 end/下一步，与 complete_step / report_blocked 共用 */
	resultForPlan(runId, snapshot, plan) {
		if (plan.kind === "fail") return this.finishedResult(runId, "fail", plan.reason);
		if (plan.kind === "dangling") return this.finishedResult(runId, "fail", `后继节点 ${plan.nodeId} 在快照里不存在，run 判失败。`);
		const escapeNote = plan.limitRows.length > 0 ? `迭代逃生：${plan.limitRows.map((r) => r.loopId !== void 0 ? `回路 ${r.loopId} 已到 maxRounds（${r.limit} 轮），${r.nodeId} 未执行` : `${r.nodeId} 撞迭代上限（${r.limit} 次）未执行，改走 onLimitExceeded。`).join("")}` : void 0;
		if (plan.targetId === null) return this.finishedResult(runId, "success", escapeNote ?? "节点没有后继，按隐式 end 收尾。");
		const target = findNode(snapshot, plan.targetId);
		if (target !== void 0 && target.type === "end") return this.finishedResult(runId, target.outcome, escapeNote);
		const step = this.stepResult(runId);
		if (escapeNote !== void 0 && "step" in step) return {
			...step,
			note: step.note !== void 0 ? `${escapeNote}${step.note}` : escapeNote
		};
		return step;
	}
	/** 该节点真正执行过的次数（completed/blocked 轨迹）；dispatched/limit_exceeded 只是记录，不占迭代配额 */
	executionCount(runId, nodeId) {
		return this.db.prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND node_id = ? AND status IN ('completed','blocked')").get(runId, nodeId).c;
	}
	/** 该节点在本次 run 里的轨迹条数（completed / blocked / limit_exceeded 都算占了一次迭代） */
	execCount(runId, nodeId) {
		return this.db.prepare("SELECT COUNT(*) AS c FROM node_executions WHERE run_id = ? AND node_id = ?").get(runId, nodeId).c;
	}
	/** run 级防绕圈（§4.5）：默认 200 步，撞上判 run 失败 */
	maxStepsOf(snapshot) {
		return snapshot.flows[snapshot.rootFlowId].maxSteps ?? 200;
	}
	failRun(run) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		this.db.prepare(`UPDATE runs SET status = 'failed', outcome = 'fail', last_activity = ?, finished_at = ? WHERE id = ?`).run(now, now, run.id);
		this.emit({
			type: "run_finished",
			runId: run.id,
			outcome: "fail",
			at: now
		});
	}
	/** 按 id 判失败（入口派发失败等只拿得到 runId 的路径） */
	failRunById(runId) {
		const run = this.runById(runId);
		if (run !== null) this.failRun(run);
	}
	snapshotOf(run) {
		const snapshot = loadSnapshot(this.db, run.flow_snapshot_hash);
		if (snapshot === void 0) throw new Error(`快照丢失：${run.flow_snapshot_hash}（run ${run.id}）`);
		return snapshot;
	}
};
function findNode(snapshot, nodeId) {
	return snapshot.flows[snapshot.rootFlowId].nodes.find((n) => n.id === nodeId);
}
/** run 是否已到终态（child 汇聚用：没到终态的就是"未回报"） */
function isTerminalRun(run) {
	return run.status === "completed" || run.status === "failed" || run.status === "stale";
}
function preambleText(runId, nodeId, token, ctx = {}) {
	const lines = ["[以下内容由流程引擎提供，请原样前置，不要改写或摘要]", `你是流程 ${runId} 节点 ${nodeId} 派出的子任务，你的 childToken 是 ${token}。`];
	if (ctx.role !== void 0) {
		lines.push(`你的角色：${ctx.role.name}（role=${ctx.role.id}）。`);
		lines.push(`角色章程：${ctx.role.charter}`);
	} else if (ctx.roleId !== void 0) lines.push(`你的角色：${ctx.roleId}（角色表里没有找到章程，请按任务要求执行）。`);
	if (ctx.threadKey !== null && ctx.threadKey !== void 0) {
		lines.push(`你的线程：${ctx.threadKey}${ctx.turn !== void 0 ? `，这是第 ${ctx.turn} 轮` : ""}。`);
		if (ctx.digest !== void 0 && ctx.digest !== "") lines.push(`同线程最近几轮摘要：\n${ctx.digest}`);
	}
	if (ctx.reportHint !== void 0 && ctx.reportHint.trim() !== "") lines.push(`汇报契约：${ctx.reportHint}`);
	lines.push(`调 get_current_step({childToken:"${token}"}) 取你这一步要做什么。`);
	lines.push(`做完调 complete_step({childToken:"${token}", summary, payload?, branchId?, artifacts?})。`);
	lines.push("[主 Agent 的补充说明写在这行之后]");
	return lines.join("\n");
}
/** 子 payload 平铺：单 child 时父级可直接 {{node.payload.verdict}}；
*  多 child 时按声明顺序覆盖，保留键 children/child 不参与平铺（避免与聚合结构冲突） */
function mergeChildPayloads(results) {
	const merged = {};
	for (const result of results) {
		if (result.payload === null || typeof result.payload !== "object" || Array.isArray(result.payload)) continue;
		for (const [key, value] of Object.entries(result.payload)) {
			if (key === "children" || key === "child") continue;
			merged[key] = value;
		}
	}
	merged.children = results;
	return merged;
}
/** fan-out 条目转可读文本（截断记录、缺失名单用） */
function formatItem(value) {
	if (value === null || value === void 0) return "";
	return typeof value === "string" ? value : JSON.stringify(value);
}
function renderParams(params, render) {
	const out = {};
	for (const [key, value] of Object.entries(params)) out[key] = typeof value === "string" ? render(value) : value;
	return out;
}
function selfHeal(what, guidance, current = null) {
	return {
		error: true,
		what,
		guidance,
		current
	};
}
function parseJsonObject(text) {
	if (text === null || text === "") return null;
	try {
		const value = JSON.parse(text);
		return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
	} catch {
		return null;
	}
}
function walkPath(value, path) {
	let cur = value;
	for (const seg of path) {
		if (cur === null || typeof cur !== "object") return void 0;
		cur = cur[seg];
	}
	return cur;
}
/** await_gate 轮询间隔让出事件循环（SQLite 同步查询本身不阻塞） */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
//#endregion
//#region
var engine = null;
var engineDb = null;
/** 按 id 或展示名解析流程（与面板、aiworkflow_flow 同一套数据） */
function resolveFlow$1(name) {
	const db = database();
	const direct = getFlow(db, name);
	if (direct !== void 0) return direct;
	const byName = listFlows(db).find((flow) => flow.name === name);
	return byName === void 0 ? void 0 : getFlow(db, byName.id);
}
/** 单例：连接被换掉（数据目录变了 / 重载）时自动重建 */
function workflowEngine() {
	const db = database();
	if (engine !== null && engineDb === db) return engine;
	engine = new ExecutionEngine({
		db,
		resolveFlow: resolveFlow$1
	});
	engineDb = db;
	return engine;
}
//#endregion
//#region
var FLOW_ACTIONS = [
	"list",
	"get",
	"validate",
	"create",
	"update"
];
/** 模型可见的 DSL 速查（完整语义以校验器报错为准） */
var DSL_HINT = "完整流程图 DSL：{ id, name, kind?: \"flow\"|\"agent\", entry, maxSteps?, agents?, nodes: [...] }。kind 缺省为 flow（可独立 start_run 的主流程）；kind=\"agent\" 是可复用的子 Agent 配置（自带 agents 角色表 + 子图），主流程用 subagent 节点的 mode=\"flowRef\" + flowRef=<配置 id> 引用它。节点 { id, type: prompt|tool|gate|subagent|join|end, title?, instruction?, toolName?, params?, next?, branches?, iterationLimit?, loopId?, maxRounds?, onLimitExceeded?, outcome? }。subagent 额外支持 { role?, thread?: \"new\"|\"role\"|自定义, produces?, consumes?, reportHint? }；agents: [{ id, name, charter, produces?, consumes? }]。后继二选一：next（唯一后继）或 branches: [{ id, condition, to, when? }]（condition \"*\" 是默认分支，同节点至多一个；when 是服务端可判定的单比较，如 \"{{review.payload.verdict}} == 'pass'\"）。complete_step 可带 artifacts: [{ key, summary?, path?, content? }]，插值用 {{artifacts.key.path}}；run 输入用 {{inputs.字段}}。环必须给环上节点配 iterationLimit，或给同一 loopId 的控制器配 maxRounds。end 节点带 outcome: success|fail。";
function textResult(value) {
	return [{
		type: "text",
		text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
	}];
}
/** 注册 Agent 工具，返回一次性释放句柄 */
function registerTools(ctx) {
	const disposers = [];
	for (const definition of [
		contextTool(ctx),
		flowTool(),
		...runTools(ctx)
	]) disposers.push(ctx.tools.register(definition));
	return () => {
		for (const dispose of disposers.reverse()) try {
			dispose();
		} catch {}
	};
}
function contextTool(ctx) {
	return {
		name: "aiworkflow_context",
		description: "读取当前 DSH 会话与 aiworkflow 的对应关系：会话 id、工作目录、数据库路径，以及库里有多少张流程图、几个进行中/最近的 run。只读，不改任何状态。要在会话里引用某张图或以后的 run 时先调它确认身份。",
		parameters: {
			type: "object",
			properties: {},
			additionalProperties: false
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => textResult(value)
		},
		async execute(_args, exec) {
			const snapshot = {
				sessionId: typeof exec?.agent?.id === "string" ? exec.agent.id : null,
				cwd: await currentDirectory(ctx, exec),
				dbPath: databasePath(),
				flowsDir: flowsDir(),
				flows: null,
				agentConfigs: null,
				activeRuns: null,
				recentRuns: null
			};
			try {
				const db = database();
				const state = readMonitorState(db, null);
				const allFlows = listFlows(db);
				snapshot.flows = allFlows.length;
				snapshot.agentConfigs = allFlows.filter((flow) => flow.kind === "agent").length;
				snapshot.activeRuns = state.active.length;
				snapshot.recentRuns = state.recent.length;
			} catch (error) {
				snapshot.available = false;
				snapshot.reason = describeDatabaseError$1(error);
			}
			return snapshot;
		}
	};
}
function flowTool() {
	return {
		name: "aiworkflow_flow",
		description: "aiworkflow 流程图的读写入口（与 DSH 里的「可视化工作流」面板共用同一份 SQLite）。action=list 列出全部流程与子 Agent 配置；get 按 id 或名字读完整 DSL；validate 干跑校验、不落库；create 新建（id 必须尚不存在）；update 整体覆盖已存在的流程。校验不通过时不落库，原图保持不变。" + DSL_HINT,
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: [...FLOW_ACTIONS],
					description: "要做的事：list / get / validate / create / update"
				},
				flowId: {
					type: "string",
					description: "流程 id 或展示名；get 必填。create/update 一律以 flow.id 为准（flowId 只用于 get 定位）。"
				},
				flow: {
					type: "object",
					description: `完整 DSL 对象；validate / create / update 必填。${DSL_HINT}`,
					additionalProperties: true
				}
			},
			required: ["action"],
			additionalProperties: false
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => textResult(value)
		},
		async execute(args) {
			const action = String(args?.action ?? "");
			const db = openOrExplain();
			if (action === "list") {
				const flows = listFlows(db);
				return {
					ok: true,
					count: flows.length,
					flows
				};
			}
			if (action === "get") {
				const wanted = requiredString(args?.flowId, "flowId", "get 需要 flowId（id 或展示名）。");
				const found = resolveFlow(db, wanted);
				if (found === void 0) throw new Error(`没有找到流程「${wanted}」（按 id 和展示名都找不到）。先调 aiworkflow_flow action=list 看有哪些流程，再用返回的 id 或名字重试。`);
				return {
					ok: true,
					flow: found
				};
			}
			const flow = args?.flow;
			if (flow === void 0 || flow === null || typeof flow !== "object") throw new Error(`action=${action} 需要 flow 对象。传入完整 DSL：{ id, name, entry, nodes: [...] }；不确定结构时先调 action=get 看一张现有的图。`);
			const flowId = requiredString(flow.id, "flow.id", `flow.id 缺失：${action} 必须先有 id。`);
			if (action === "validate") {
				const result = validateFlowOnly(flow);
				return {
					ok: result.ok,
					action,
					flowId,
					errors: result.errors,
					warnings: result.warnings
				};
			}
			if (action === "create") {
				if (getFlow(db, flowId) !== void 0) throw new Error(`流程 id「${flowId}」已存在，不能再用 create。要覆盖它请改用 action=update；要另建一张请换一个 id。`);
			} else if (action === "update") {
				if (getFlow(db, flowId) === void 0) throw new Error(`没有找到 id 为「${flowId}」的流程，没法 update。确认 id 没写错（name 反查可用 action=get）；确实要新建请改用 action=create。`);
			} else throw new Error(`未知 action「${action}」：只支持 ${FLOW_ACTIONS.join(" / ")}。`);
			const saved = saveFlow(db, flow, flowsDir());
			if (!saved.ok) return {
				ok: false,
				action,
				flowId,
				what: `校验不通过，未落库，原图未动（${saved.errors.length} 条错误）。`,
				guidance: "按 errors 逐条修正后重试；改完先调 action=validate 干跑确认全绿。",
				errors: saved.errors,
				warnings: saved.warnings
			};
			return {
				ok: true,
				action,
				flowId,
				saved: true,
				warnings: saved.warnings
			};
		}
	};
}
/** 执行类工具：与引擎方法同名同义，DSH 里加 aiworkflow_ 前缀避免撞名 */
function runTools(ctx) {
	const hostSessionOf = (exec) => typeof exec?.agent?.id === "string" ? `dsh:${exec.agent.id}` : void 0;
	const childTokenOf = (args) => typeof args?.childToken === "string" && args.childToken !== "" ? args.childToken : void 0;
	const refOf = (args, exec) => ({
		childToken: childTokenOf(args),
		hostSession: hostSessionOf(exec)
	});
	return [
		{
			name: "aiworkflow_start_run",
			description: "按流程名开始一个 run（引擎纪律文本里的 start_run）。返回循环纪律 + 第一步。flowName 可以是流程 id 或展示名（先调 aiworkflow_flow action=list 查）；inputs 供图里的 {{inputs.字段}} 插值。之后每步做完必须调 aiworkflow_complete_step 回报。",
			parameters: {
				type: "object",
				properties: {
					flowName: {
						type: "string",
						description: "流程 id 或展示名"
					},
					cwd: {
						type: "string",
						description: "项目目录，随 run 落库供诊断（当前面板不按项目分组）；省略取当前会话工作目录"
					},
					projectName: {
						type: "string",
						description: "项目名，随 run 落库供诊断/展示；当前 UI 未使用"
					},
					inputs: {
						type: "object",
						description: "run 输入：图里用 {{inputs.字段}} 插值；child run 继承",
						additionalProperties: true
					}
				},
				required: ["flowName"],
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			async execute(args, exec) {
				const flowName = requiredString(args?.flowName, "flowName", "start_run 需要 flowName（流程 id 或展示名）。");
				const given = typeof args?.cwd === "string" ? args.cwd.trim() : "";
				const cwd = given !== "" ? given : await currentDirectory(ctx, exec) ?? void 0;
				const rawInputs = args?.inputs;
				const inputs = rawInputs !== null && typeof rawInputs === "object" && !Array.isArray(rawInputs) ? rawInputs : void 0;
				return jsonSafe(workflowEngine().startRun({
					flowName,
					cwd,
					inputs,
					projectName: typeof args?.projectName === "string" && args.projectName.trim() !== "" ? args.projectName.trim() : void 0,
					hostSession: hostSessionOf(exec)
				}));
			}
		},
		{
			name: "aiworkflow_get_current_step",
			description: "幂等：返回\"我在哪、要干啥\"（= get_current_step）。上下文被压缩、不确定自己进度时随时调它找回状态。",
			parameters: {
				type: "object",
				properties: { childToken: {
					type: "string",
					description: "子 Agent 专用身份令牌（派发步骤下发的那一个）"
				} },
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			async execute(args, exec) {
				return jsonSafe(workflowEngine().getCurrentStep(refOf(args, exec)));
			}
		},
		{
			name: "aiworkflow_complete_step",
			description: "回报当前步骤的结果并领取下一步（= complete_step）。summary 必填（一句话，给人看）；节点有 branches 且未由 when 自动判定时必须给 branchId（从步骤下发的 branches 列表里选）；有产物时用 artifacts 声明，供后续 {{artifacts.key.path}} 插值。",
			parameters: {
				type: "object",
				properties: {
					summary: {
						type: "string",
						description: "这一步做了什么，一句话，给人看的"
					},
					payload: {
						type: "object",
						description: "给后续节点插值用的结构化结果，如 { project: \"apps/battle\", verdict: \"pass\" }",
						additionalProperties: true
					},
					branchId: {
						type: "string",
						description: "选中分支的 id；节点有 branches 且未自动判定时必填"
					},
					artifacts: {
						type: "array",
						description: "本轮产物：key 会按版本递增，{{artifacts.key.path}} 永远取最新版",
						items: {
							type: "object",
							properties: {
								key: {
									type: "string",
									description: "产物 key（字母/数字/下划线），如 design"
								},
								summary: {
									type: "string",
									description: "一句话说明这版产物"
								},
								path: {
									type: "string",
									description: "产物文件路径，正文以文件为准"
								},
								content: {
									type: "string",
									description: "可选的小快照（<=8KB），便于面板回看"
								}
							},
							required: ["key"],
							additionalProperties: false
						}
					},
					nodeId: {
						type: "string",
						description: "当前节点 id（复述身份用，省略亦可）"
					},
					childToken: {
						type: "string",
						description: "子 Agent 专用身份令牌"
					}
				},
				required: ["summary"],
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			async execute(args, exec) {
				return jsonSafe(workflowEngine().completeStep({
					...refOf(args, exec),
					summary: requiredString(args?.summary, "summary", "complete_step 需要 summary（一句话说清这一步做了什么）。"),
					payload: isPlainObject(args?.payload) ? args.payload : void 0,
					branchId: optionalString(args?.branchId),
					artifacts: Array.isArray(args?.artifacts) ? args.artifacts : void 0,
					nodeId: optionalString(args?.nodeId)
				}));
			}
		},
		{
			name: "aiworkflow_report_blocked",
			description: "当前这一步干不下去了（缺依赖、没权限、分支全不满足且没有默认出口）时如实上报（= report_blocked）。引擎按节点的逃生出口推进；没有任何出口则 run 判失败。不会自动重试。",
			parameters: {
				type: "object",
				properties: {
					reason: {
						type: "string",
						description: "一句话说清干不下去的原因，给人看的"
					},
					nodeId: {
						type: "string",
						description: "当前节点 id（复述身份用，省略亦可）"
					},
					childToken: {
						type: "string",
						description: "子 Agent 专用身份令牌"
					}
				},
				required: ["reason"],
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			async execute(args, exec) {
				return jsonSafe(workflowEngine().reportBlocked({
					...refOf(args, exec),
					reason: requiredString(args?.reason, "reason", "report_blocked 需要 reason（一句话说清卡在哪）。"),
					nodeId: optionalString(args?.nodeId)
				}));
			}
		},
		{
			name: "aiworkflow_await_gate",
			description: "当前步骤是人工卡点（gate）时，长轮询等用户答复（= await_gate）。每轮最多 60 秒，到点返回\"仍在等待\"就再调一次。用户当场在对话里答复了就别等，直接调 aiworkflow_answer_gate 代填。",
			parameters: {
				type: "object",
				properties: {
					gateId: {
						type: "string",
						description: "卡点 id（gate 步骤下发里的 gateId；省略则等当前 run 的挂起卡点）"
					},
					childToken: {
						type: "string",
						description: "子 Agent 专用身份令牌"
					}
				},
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			timeoutMs: 9e4,
			async execute(args, exec) {
				return jsonSafe(await workflowEngine().awaitGate({
					...refOf(args, exec),
					gateId: optionalString(args?.gateId)
				}));
			}
		},
		{
			name: "aiworkflow_answer_gate",
			description: "用户在对话里答复了人工卡点（gate）的问题时，代填他的选择（= answer_gate）。这里记 source: chat，事后回看轨迹可分辨这是对话代填的决策。",
			parameters: {
				type: "object",
				properties: {
					optionId: {
						type: "string",
						description: "选中的选项 id（从 gate 步骤下发的 options 里选）"
					},
					gateId: {
						type: "string",
						description: "卡点 id（省略则按当前 run 的挂起卡点）"
					},
					note: {
						type: "string",
						description: "用户的原话或补充说明，给人看的"
					},
					childToken: {
						type: "string",
						description: "子 Agent 专用身份令牌"
					}
				},
				required: ["optionId"],
				additionalProperties: false
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => textResult(value)
			},
			async execute(args, exec) {
				return jsonSafe(workflowEngine().answerGate({
					...refOf(args, exec),
					gateId: optionalString(args?.gateId),
					optionId: requiredString(args?.optionId, "optionId", "answer_gate 需要 optionId（从 options 里选一个）。"),
					note: optionalString(args?.note)
				}, "chat"));
			}
		}
	];
}
/**
* 引擎结果里存在 `note: undefined` 这类字段（JSON.stringify 会直接丢掉），
* 宿主工具返回值要求可无损 JSON 化，所以统一过一遍序列化。
*/
function jsonSafe(value) {
	return JSON.parse(JSON.stringify(value));
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalString(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function openOrExplain() {
	try {
		return database();
	} catch (error) {
		throw new Error(describeDatabaseError$1(error));
	}
}
function resolveFlow(db, wanted) {
	const direct = getFlow(db, wanted);
	if (direct !== void 0) return direct;
	const byName = listFlows(db).find((flow) => flow.name === wanted);
	return byName === void 0 ? void 0 : getFlow(db, byName.id);
}
function requiredString(value, field, message) {
	if (typeof value !== "string" || value.trim() === "") throw new Error(message);
	return value.trim();
}
async function currentDirectory(ctx, exec) {
	const workingDirectory = ctx.get("workingDirectory");
	if (workingDirectory?.ensure !== void 0 && exec?.agent !== void 0) try {
		return await workingDirectory.ensure(exec.agent, exec.signal);
	} catch {}
	return process.cwd();
}
function describeDatabaseError$1(error) {
	const code = error?.code;
	if (code === "ENOENT" || code === "SQLITE_CANTOPEN") return `还没有 aiworkflow 数据库（${databasePath()}）。先在 DSH 的「可视化工作流」里新建并保存一张图，插件会自动建库。`;
	return `读取 ${databasePath()} 失败：${error instanceof Error ? error.message : String(error)}`;
}
//#endregion
//#region
/** 路由前缀：不以 `/` 结尾（宿主按 `path === prefix || path.startsWith(prefix + '/')` 匹配） */
var ROUTE_PREFIX = "/aiworkflow";
var STATE_PATHS = /* @__PURE__ */ new Set([
	"/aiworkflow",
	"/aiworkflow/",
	"/aiworkflow/state"
]);
var FLOWS_PATH = "/aiworkflow/flows";
var RUNS_PATH = "/aiworkflow/runs";
var ABANDON_PATH = "/aiworkflow/runs/abandon";
/** apply 时记下的插件上下文，HTTP 处理里要用它拿 agents 服务 */
var pluginCtx = null;
var inject = ["webServer", "tools"];
function apply(ctx) {
	pluginCtx = ctx;
	ctx.effect(() => {
		const disposeRoute = ctx.webServer.register({
			kind: "prefix",
			path: ROUTE_PREFIX,
			handler: handleRequest
		});
		return () => {
			disposeRoute();
			closeDatabase();
		};
	});
	ctx.effect(() => registerTools(ctx));
}
async function handleRequest(req, res) {
	try {
		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		const method = req.method ?? "GET";
		if (method === "OPTIONS") {
			res.statusCode = 204;
			setCorsHeaders(res);
			res.end();
			return;
		}
		if (STATE_PATHS.has(url.pathname)) {
			if (method !== "GET" && method !== "HEAD") return methodNotAllowed(res);
			send(res, 200, buildState(url.searchParams.get("run"), url.searchParams.get("session")));
			return;
		}
		if (url.pathname === ABANDON_PATH) {
			if (method !== "POST") return methodNotAllowed(res);
			const runId = readRunId(await readJson(req));
			if (runId === null) {
				send(res, 400, {
					ok: false,
					error: {
						code: "bad-request",
						message: "需要 runId"
					}
				});
				return;
			}
			try {
				send(res, 200, {
					ok: true,
					result: workflowEngine().abandonRun({ runId })
				});
			} catch (error) {
				send(res, 500, {
					ok: false,
					error: {
						code: "abandon-failed",
						message: errorText(error)
					}
				});
			}
			return;
		}
		if (url.pathname === RUNS_PATH || url.pathname === `${RUNS_PATH}/`) {
			if (method !== "POST") return methodNotAllowed(res);
			const body = await readJson(req);
			const flowId = readFlowId(body);
			if (flowId === null) {
				send(res, 400, {
					ok: false,
					error: {
						code: "bad-request",
						message: "需要 flowId（流程 id 或展示名）"
					}
				});
				return;
			}
			try {
				const explicit = readSessionId(body);
				const roots = explicit === null ? liveRoots() : [];
				const boundSession = explicit ?? (roots.length === 1 ? roots[0].id : null);
				const hostSession = boundSession === null ? void 0 : `dsh:${boundSession}`;
				const result = workflowEngine().startRun({
					flowName: flowId,
					hostSession
				});
				const woke = result.error === true || boundSession === null ? false : wakeAgent(boundSession, flowId, readNote(body));
				send(res, 200, {
					ok: true,
					bound: hostSession ?? null,
					woke,
					result
				});
			} catch (error) {
				send(res, 500, {
					ok: false,
					error: {
						code: "start-failed",
						message: errorText(error)
					}
				});
			}
			return;
		}
		if (url.pathname === FLOWS_PATH || url.pathname === `${FLOWS_PATH}/`) {
			if (method === "GET") {
				const kindParam = url.searchParams.get("kind");
				const kind = kindParam === "agent" ? "agent" : kindParam === "flow" ? "flow" : void 0;
				send(res, 200, {
					ok: true,
					flows: listFlows(database(), kind)
				});
				return;
			}
			return methodNotAllowed(res);
		}
		if (url.pathname === `${FLOWS_PATH}/validate`) {
			if (method !== "POST") return methodNotAllowed(res);
			const body = await readJson(req);
			if (body === void 0 || typeof body !== "object" || body === null) {
				send(res, 400, {
					ok: false,
					error: {
						code: "bad-json",
						message: "请求体不是合法 JSON 对象"
					}
				});
				return;
			}
			send(res, 200, {
				ok: true,
				result: validateFlowOnly(body)
			});
			return;
		}
		if (url.pathname.startsWith(`${FLOWS_PATH}/`)) {
			const rest = decodeURIComponent(url.pathname.slice(18));
			if (rest.endsWith("/payload-fields")) {
				if (method !== "GET" && method !== "HEAD") return methodNotAllowed(res);
				const flowId = rest.slice(0, -15);
				if (flowId === "") return sendNotFound(res, url.pathname);
				send(res, 200, {
					ok: true,
					fields: payloadFieldsOf(flowId)
				});
				return;
			}
			const flowId = rest;
			if (flowId === "") return sendNotFound(res, url.pathname);
			if (method === "GET" || method === "HEAD") {
				const flow = getFlow(database(), flowId);
				if (flow === void 0) return sendNotFound(res, url.pathname);
				send(res, 200, {
					ok: true,
					flow
				});
				return;
			}
			if (method === "PUT") {
				const body = await readJson(req);
				if (body === void 0) {
					send(res, 400, {
						ok: false,
						error: {
							code: "bad-json",
							message: "请求体不是合法 JSON"
						}
					});
					return;
				}
				const flow = body;
				if (typeof flow.id !== "string" || flow.id !== flowId) {
					send(res, 400, {
						ok: false,
						error: {
							code: "id-mismatch",
							message: "图 id 与 URL 不一致"
						}
					});
					return;
				}
				const result = saveFlow(database(), flow, flowsDir());
				if (!result.ok) {
					send(res, 200, {
						ok: false,
						errors: result.errors,
						warnings: result.warnings
					});
					return;
				}
				send(res, 200, {
					ok: true,
					flow: result.flow,
					warnings: result.warnings
				});
				return;
			}
			if (method === "DELETE") {
				send(res, 200, {
					ok: true,
					deleted: deleteFlow(database(), flowId, flowsDir())
				});
				return;
			}
			return methodNotAllowed(res);
		}
		sendNotFound(res, url.pathname);
	} catch (error) {
		send(res, 500, {
			ok: false,
			error: {
				code: "internal",
				message: errorText(error)
			}
		});
	}
}
/** 启动入口没有会话上下文，只有唯一活跃会话时才绑定它 */
function liveRoots() {
	try {
		const roots = pluginCtx?.get?.("agents")?.roots?.();
		if (!Array.isArray(roots)) return [];
		return roots.map((agent) => agent).filter((agent) => typeof agent?.id === "string").map((agent) => ({ id: agent.id }));
	} catch {
		return [];
	}
}
/**
* 唤醒绑定的 Agent（与定时提醒同一套机制：followup 一条用户态消息）。
* 只是尽力而为：拿不到 agents 服务或 Agent 不在线时静默跳过，run 仍会等下一次对话。
*/
function wakeAgent(sessionId, flowRef, note) {
	try {
		const agent = pluginCtx?.get?.("agents")?.get?.(sessionId);
		if (agent === void 0 || typeof agent.followup !== "function") return false;
		let label = flowRef;
		try {
			label = getFlow(database(), flowRef)?.name ?? flowRef;
		} catch {}
		const text = `【aiworkflow】已启动流程「${label}」，run 已创建并绑定当前会话。` + (note === null ? "" : `\n用户随运行一起提交的补充信息：\n"""\n${note}\n"""\n`) + "请调用 aiworkflow_get_current_step 领取第一步并开始执行，之后每步做完调 aiworkflow_complete_step 回报。";
		agent.followup({
			id: randomUUID(),
			role: "user",
			content: [{
				type: "text",
				text
			}],
			source: { kind: "schedule" }
		});
		return true;
	} catch {
		return false;
	}
}
/** 输入框里带过来的补充信息（可空） */
function readNote(body) {
	if (typeof body !== "object" || body === null) return null;
	const value = body.note;
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function readSessionId(body) {
	if (typeof body !== "object" || body === null) return null;
	const value = body.sessionId;
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function readFlowId(body) {
	if (typeof body !== "object" || body === null) return null;
	const record = body;
	for (const key of ["flowId", "flowName"]) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value.trim();
	}
	return null;
}
function readRunId(body) {
	if (typeof body !== "object" || body === null) return null;
	const value = body.runId;
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function methodNotAllowed(res) {
	send(res, 405, {
		ok: false,
		error: {
			code: "method-not-allowed",
			message: "method not allowed"
		}
	});
}
function sendNotFound(res, pathname) {
	send(res, 404, {
		ok: false,
		error: {
			code: "not-found",
			message: `unknown route ${pathname}`
		}
	});
}
function buildState(runId, sessionId) {
	const file = databasePath();
	const base = {
		ok: true,
		available: false,
		reason: null,
		dbPath: file,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		active: [],
		recent: [],
		selectedId: null,
		detail: null
	};
	try {
		const state = readMonitorState(database(), runId, {}, hostSessionOf(sessionId));
		return {
			...base,
			available: true,
			selectedId: state.selectedId,
			active: state.active,
			recent: state.recent,
			detail: state.detail === null ? null : trimDetail(state.detail)
		};
	} catch (error) {
		closeDatabase();
		return {
			...base,
			reason: describeDatabaseError(error, file)
		};
	}
}
/** 从该图历史 run 的 completed payload 学字段名，供编辑器做 {{节点.payload.字段}} 提示 */
function payloadFieldsOf(flowId) {
	const fields = {};
	try {
		const rows = database().prepare(`SELECT ne.node_id, ne.payload FROM node_executions ne
         JOIN runs r ON r.id = ne.run_id
         WHERE r.flow_id = ? AND ne.status = 'completed'
         ORDER BY ne.id DESC LIMIT 200`).all(flowId);
		for (const row of rows) {
			let payload;
			try {
				payload = JSON.parse(row.payload);
			} catch {
				continue;
			}
			if (payload === null || typeof payload !== "object" || Array.isArray(payload)) continue;
			const list = fields[row.node_id] ??= [];
			for (const key of Object.keys(payload)) if (!list.includes(key) && list.length < 20) list.push(key);
		}
	} catch {}
	return fields;
}
/** 界面传原始会话 id；库里存的是 `dsh:<sessionId>`（与 start_run / 面板启动一致） */
function hostSessionOf(sessionId) {
	if (sessionId === null) return null;
	const value = sessionId.trim();
	if (value === "") return null;
	return value.startsWith("dsh:") ? value : `dsh:${value}`;
}
function trimDetail(detail) {
	return {
		...detail,
		executions: detail.executions.map((exec) => ({
			...exec,
			payload: trimPayload(exec.payload)
		}))
	};
}
function describeDatabaseError(error, file) {
	const code = error?.code;
	if (code === "ENOENT" || code === "SQLITE_CANTOPEN") return `未找到 ${file}：先在「可视化工作流」里新建并保存一张图，插件会自动建库。`;
	return `读取 ${file} 失败：${errorText(error)}`;
}
async function readJson(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > 2097152) throw new Error("请求体过大");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text === "") return void 0;
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
function errorText(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
function send(res, status, body) {
	const text = JSON.stringify(body);
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	setCorsHeaders(res);
	res.end(text);
}
/**
* 只读本地数据的跨源放行：页面可能来自 `dsh web`（同源，无需 CORS），
* 也可能来自桌面壳的 file:// 渲染器（源为 null），后者必须显式允许。
*/
function setCorsHeaders(res) {
	res.setHeader("access-control-allow-origin", "*");
	res.setHeader("access-control-allow-methods", "GET, HEAD, PUT, DELETE, OPTIONS");
	res.setHeader("access-control-allow-headers", "accept, content-type");
	res.setHeader("access-control-max-age", "600");
}
//#endregion
export { apply, inject };
