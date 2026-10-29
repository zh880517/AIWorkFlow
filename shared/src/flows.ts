// 公用层：flow 图的读写（面板与 Agent 工具共用同一套语义）。
// 先落 SQLite，再刷 flows/*.json 派生镜像；校验走同目录的 validateFlow。
import fs from 'node:fs';
import path from 'node:path';
import type { Flow, FlowKind } from './types.js';
import type { SqlDatabase, SqlWriter } from './sql.js';
import { validateFlow, type ValidationResult } from './validate.js';

export interface FlowMeta {
  id: string;
  name: string;
  /** flow（缺省）= 主流程；agent = 子 Agent 配置 */
  kind: FlowKind;
  updatedAt: string;
}

interface FlowRow {
  id: string;
  name: string;
  kind: string;
  updated_at: string;
  content?: string;
}

function kindOf(value: unknown): FlowKind {
  return value === 'agent' ? 'agent' : 'flow';
}

/** 干跑校验：与落库路径用的是同一个校验器，仅不写库 */
export function validateFlowOnly(flow: Flow): ValidationResult {
  return validateFlow(flow);
}

export interface FlowSaveResult extends ValidationResult {
  flow?: Flow;
}

export function listFlows(db: SqlDatabase, kind?: FlowKind): FlowMeta[] {
  const sql = 'SELECT id, name, kind, updated_at FROM flows';
  const rows = (
    kind === undefined
      ? db.prepare(`${sql} ORDER BY updated_at DESC`).all()
      : db.prepare(`${sql} WHERE kind = ? ORDER BY updated_at DESC`).all(kind)
  ) as FlowRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: kindOf(row.kind),
    updatedAt: row.updated_at,
  }));
}

export function getFlow(db: SqlDatabase, flowId: string): Flow | undefined {
  const row = db.prepare('SELECT kind, content FROM flows WHERE id = ?').get(flowId) as
    | { kind: string; content: string }
    | undefined;
  if (row === undefined) return undefined;
  try {
    const flow = JSON.parse(row.content) as Flow;
    // 老图的 JSON 里没有 kind；以列为准补上，调用方拿到的永远是完整形态
    return { ...flow, kind: kindOf(row.kind) };
  } catch {
    return undefined;
  }
}

export function saveFlow(db: SqlWriter, flow: Flow, jsonDir: string): FlowSaveResult {
  // 更新已有图时，调用方没带 kind 就沿用原类型，避免 Agent 用 flow update 把配置降级成主流程
  const existing = db.prepare('SELECT kind FROM flows WHERE id = ?').get(flow.id) as
    | { kind: string }
    | undefined;
  const inherited = flow.kind ?? (existing?.kind as FlowKind | undefined);
  const candidate: Flow = inherited === undefined ? flow : { ...flow, kind: inherited };
  const result = validateFlow(candidate);
  if (!result.ok) return result;
  const kind = kindOf(candidate.kind);
  const stored: Flow = { ...candidate, kind };
  const now = new Date().toISOString();
  const content = JSON.stringify(stored, null, 2);
  db.prepare(
    `INSERT INTO flows (id, name, kind, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
       content = excluded.content, updated_at = excluded.updated_at`,
  ).run(stored.id, stored.name, kind, content, now, now);
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(path.join(jsonDir, `${stored.id}.json`), content, 'utf-8');
  return { ...result, flow: stored };
}

export function deleteFlow(db: SqlWriter, flowId: string, jsonDir: string): boolean {
  const info = db.prepare('DELETE FROM flows WHERE id = ?').run(flowId);
  const mirror = path.join(jsonDir, `${flowId}.json`);
  const changes = Number(info.changes);
  if (changes > 0 && fs.existsSync(mirror)) fs.rmSync(mirror);
  return changes > 0;
}
