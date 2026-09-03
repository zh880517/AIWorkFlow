// flow 存储：SQLite 是唯一事实源，~/.aiworkflow/flows/*.json 是派生镜像（设计文档 §2.3 / §5.1）
// 写入顺序固定：先落 SQLite，再刷 JSON；JSON 可删，可从 SQLite 全量重建。
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { Flow } from './types.js';
import { flowsDir } from './paths.js';
import { validateFlow, type ValidationResult } from './validate.js';

interface FlowRow {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export class FlowStore {
  private readonly db: Database.Database;
  private readonly jsonDir: string;

  constructor(db: Database.Database, jsonDir?: string) {
    this.db = db;
    this.jsonDir = jsonDir ?? flowsDir();
    fs.mkdirSync(this.jsonDir, { recursive: true });
  }

  /** 保存（新建或覆盖）。硬拒时不落库；警告允许保存并随结果返回 */
  save(flow: Flow): ValidationResult {
    const result = validateFlow(flow);
    if (!result.ok) return result;
    const now = new Date().toISOString();
    const content = JSON.stringify(flow, null, 2);
    this.db
      .prepare(
        `INSERT INTO flows (id, name, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(flow.id, flow.name, content, now, now);
    this.writeMirror(flow.id, content);
    return result;
  }

  list(): Array<{ id: string; name: string; updatedAt: string }> {
    const rows = this.db
      .prepare('SELECT id, name, updated_at FROM flows ORDER BY updated_at DESC')
      .all() as Array<{ id: string; name: string; updated_at: string }>;
    return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
  }

  get(flowId: string): Flow | undefined {
    const row = this.db.prepare('SELECT content FROM flows WHERE id = ?').get(flowId) as
      | { content: string }
      | undefined;
    if (row === undefined) return undefined;
    return JSON.parse(row.content) as Flow;
  }

  /** 按 id 或展示名解析（start_run 的 flowName 入参用） */
  resolve(flowName: string): Flow | undefined {
    return this.get(flowName) ?? this.findByName(flowName);
  }

  private findByName(name: string): Flow | undefined {
    const row = this.db.prepare('SELECT content FROM flows WHERE name = ?').get(name) as
      | { content: string }
      | undefined;
    return row === undefined ? undefined : (JSON.parse(row.content) as Flow);
  }

  delete(flowId: string): boolean {
    const info = this.db.prepare('DELETE FROM flows WHERE id = ?').run(flowId);
    const mirror = this.mirrorPath(flowId);
    if (info.changes > 0 && fs.existsSync(mirror)) fs.rmSync(mirror);
    return info.changes > 0;
  }

  /** 从手写 JSON 文件导入（Phase 1 验收路径） */
  importJsonFile(file: string): { flowId: string; result: ValidationResult } {
    const flow = JSON.parse(fs.readFileSync(file, 'utf-8')) as Flow;
    return { flowId: flow.id, result: this.save(flow) };
  }

  /** 全量重建 JSON 镜像目录（SQLite → JSON） */
  rebuildMirrors(): number {
    const rows = this.db.prepare('SELECT id, content FROM flows').all() as Array<{
      id: string;
      content: string;
    }>;
    for (const row of rows) this.writeMirror(row.id, row.content);
    return rows.length;
  }

  private writeMirror(flowId: string, content: string): void {
    fs.mkdirSync(this.jsonDir, { recursive: true });
    fs.writeFileSync(this.mirrorPath(flowId), content, 'utf-8');
  }

  private mirrorPath(flowId: string): string {
    return path.join(this.jsonDir, `${flowId}.json`);
  }
}

export type { FlowRow };
