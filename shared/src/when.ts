// 服务端可判定的分支条件（设计文档 §4.2.3）。
//
// 语法刻意保持单比较，不做布尔组合：
//   {{review.payload.verdict}} == 'pass'
//   {{review.payload.verdict}} in 'design,dev'
//   {{artifacts.design.version}} >= 2
//   {{review.payload.issues}} truthy
// 复杂条件请拆成多条分支，或继续用自然语言 condition 交给 Agent 判断。
import type { Branch } from './types.js';

export type WhenOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'in' | 'truthy' | 'empty';

export interface WhenExpr {
  /** 左侧插值表达式（不含 {{ }}） */
  left: string;
  op: WhenOp;
  /** 右侧字面量；rightExpr 存在时忽略 */
  right?: string | number | boolean | null;
  /** 右侧也是插值表达式 */
  rightExpr?: string;
}

export type WhenParseResult = { ok: true; expr: WhenExpr } | { ok: false; error: string };

const OPS: WhenOp[] = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'in', 'truthy', 'empty'];
const EXPR_RE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

/** 解析一条 when；校验器与引擎共用，避免两套语法 */
export function parseWhen(text: string): WhenParseResult {
  const raw = text.trim();
  if (raw === '') return { ok: false, error: 'when 为空' };
  const match = /^\{\{\s*([^{}]+?)\s*\}\}\s*(==|!=|>=|<=|>|<|contains|in|truthy|empty)\s*(.*)$/.exec(raw);
  if (match === null) {
    return {
      ok: false,
      error: `when 语法应为 "{{表达式}} 运算符 值"（运算符：${OPS.join(' / ')}）`,
    };
  }
  const left = match[1]!.trim();
  const op = match[2] as WhenOp;
  const rest = match[3]!.trim();
  if (!EXPR_RE.test(left)) {
    return { ok: false, error: `when 左侧不是合法插值表达式：{{${left}}}` };
  }
  if (op === 'truthy' || op === 'empty') {
    if (rest !== '') return { ok: false, error: `${op} 不接受右侧值` };
    return { ok: true, expr: { left, op } };
  }
  if (rest === '') return { ok: false, error: `${op} 缺少右侧值` };

  const rhs = parseRight(rest);
  if (rhs === null) {
    return {
      ok: false,
      error: `when 右侧值不合法：${rest}。字符串要加引号，数字/布尔/null 直接写，或写成 {{表达式}}`,
    };
  }
  if (rhs.expr !== undefined) return { ok: true, expr: { left, op, rightExpr: rhs.expr } };
  return { ok: true, expr: { left, op, right: rhs.value } };
}

function parseRight(text: string): { value?: string | number | boolean | null; expr?: string } | null {
  if (text.startsWith('{{') && text.endsWith('}}')) {
    const expr = text.slice(2, -2).trim();
    return EXPR_RE.test(expr) ? { expr } : null;
  }
  if (
    (text.startsWith("'") && text.endsWith("'") && text.length >= 2) ||
    (text.startsWith('"') && text.endsWith('"') && text.length >= 2)
  ) {
    return { value: text.slice(1, -1).replace(/\\(['"\\])/g, '$1') };
  }
  if (text === 'true') return { value: true };
  if (text === 'false') return { value: false };
  if (text === 'null') return { value: null };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { value: Number(text) };
  return null;
}

/** 判定一条 when；lookup 由引擎提供（节点 payload / artifacts / inputs） */
export function evaluateWhen(
  text: string,
  lookup: (expr: string) => unknown,
): { value: boolean; error?: string } {
  const parsed = parseWhen(text);
  if (!parsed.ok) return { value: false, error: parsed.error };
  const { left, op, right, rightExpr } = parsed.expr;
  const lhs = lookup(left);
  const rhs = rightExpr !== undefined ? lookup(rightExpr) : right;

  if (op === 'truthy') return { value: truthy(lhs) };
  if (op === 'empty') return { value: !truthy(lhs) };
  if (lhs === undefined || rhs === undefined) return { value: false };

  switch (op) {
    case '==':
      return { value: looseEqual(lhs, rhs) };
    case '!=':
      return { value: !looseEqual(lhs, rhs) };
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const a = toNumber(lhs);
      const b = toNumber(rhs);
      if (a === null || b === null) return { value: false };
      if (op === '>') return { value: a > b };
      if (op === '>=') return { value: a >= b };
      if (op === '<') return { value: a < b };
      return { value: a <= b };
    }
    case 'contains':
      return { value: contains(lhs, rhs) };
    case 'in':
      return { value: oneOf(lhs, rhs) };
    default:
      return { value: false };
  }
}

/** 按分支声明顺序选第一条命中的 when；返回命中的分支 id 与未命中原因 */
export function matchWhenBranch(
  branches: Branch[],
  lookup: (expr: string) => unknown,
): { branchId: string | null; error?: string } {
  for (const branch of branches) {
    if (branch.when === undefined) continue;
    const evaluated = evaluateWhen(branch.when, lookup);
    if (!evaluated.value) continue;
    // 只允许一个 when 分支命中；后续命中的分支是配置歧义，交给校验器 warning，运行时取第一条
    return { branchId: branch.id };
  }
  return { branchId: null };
}

function truthy(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looseEqual(a: unknown, b: unknown): boolean {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a) === String(b);
}

function contains(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(haystack)) return haystack.some((item) => looseEqual(item, needle));
  if (typeof haystack === 'string') return haystack.includes(String(needle));
  if (haystack !== null && typeof haystack === 'object') {
    return JSON.stringify(haystack).includes(String(needle));
  }
  return false;
}

function oneOf(value: unknown, candidates: unknown): boolean {
  if (Array.isArray(candidates)) return candidates.some((item) => looseEqual(item, value));
  if (typeof candidates === 'string') {
    return candidates
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .some((item) => looseEqual(item, value));
  }
  return looseEqual(value, candidates);
}
