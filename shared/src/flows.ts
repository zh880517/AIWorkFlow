// 公用层：flow 图的读写（与 src/core/flowStore.ts 同一套语义）。
// 先落 SQLite，再刷 flows/*.json 派生镜像；校验复用主工程的 validateFlow。
import fs from 'node:fs';
import path from 'node:path';
import type { Flow } from './types.js';
import type { SqlDatabase, SqlStatement } from './sql.js';
import { validateFlow, type ValidationResult } from '../../src/core/validate.js';

export interface FlowMeta {
  id: string;
  name: string;
  updatedAt: string;
}

/** 干跑校验：与落库路径用的是同一个校验器，仅不写库 */
export function validateFlowOnly(flow: Flow): ValidationResult {
  return validateFlow(flow);
}

/** 可写连接需要的最小接口（node:sqlite 的 DatabaseSync 直接满足） */
export interface FlowWriter extends SqlDatabase {
  prepare(sql: string): SqlStatement & { run(...params: Array<string | number | null>): unknown };
  exec(sql: string): void;
}

export interface FlowSaveResult extends ValidationResult {
  flow?: Flow;
}

export function listFlows(db: SqlDatabase): FlowMeta[] {
  const rows = db.prepare('SELECT id, name, updated_at FROM flows ORDER BY updated_at DESC').all() as Array<{
    id: string;
    name: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updated_at }));
}

export function getFlow(db: SqlDatabase, flowId: string): Flow | undefined {
  const row = db.prepare('SELECT content FROM flows WHERE id = ?').get(flowId) as { content: string } | undefined;
  if (row === undefined) return undefined;
  try {
    return JSON.parse(row.content) as Flow;
  } catch {
    return undefined;
  }
}

export function saveFlow(db: FlowWriter, flow: Flow, jsonDir: string): FlowSaveResult {
  const result = validateFlow(flow);
  if (!result.ok) return result;
  const now = new Date().toISOString();
  const content = JSON.stringify(flow, null, 2);
  db.prepare(
    `INSERT INTO flows (id, name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, content = excluded.content, updated_at = excluded.updated_at`,
  ).run(flow.id, flow.name, content, now, now);
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(path.join(jsonDir, `${flow.id}.json`), content, 'utf-8');
  return { ...result, flow };
}

export function deleteFlow(db: FlowWriter, flowId: string, jsonDir: string): boolean {
  const info = db.prepare('DELETE FROM flows WHERE id = ?').run(flowId) as { changes: number };
  const mirror = path.join(jsonDir, `${flowId}.json`);
  if (info.changes > 0 && fs.existsSync(mirror)) fs.rmSync(mirror);
  return info.changes > 0;
}
