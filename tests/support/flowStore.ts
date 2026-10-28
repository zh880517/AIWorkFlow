// 测试用 flow 存储：直接包 shared/flows 的读写函数，保持老测试的 store.* 调用形状。
import fs from 'node:fs';
import path from 'node:path';
import { deleteFlow, getFlow, listFlows, saveFlow } from '../../shared/src/flows.js';
import type { Flow } from '../../shared/src/types.js';
import type { ValidationResult } from '../../shared/src/validate.js';
import type { TestDb } from './db.js';

export class FlowStore {
  private readonly jsonDir: string;

  constructor(
    private readonly db: TestDb,
    jsonDir: string,
  ) {
    this.jsonDir = jsonDir;
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  save(flow: Flow): ValidationResult {
    return saveFlow(this.db, flow, this.jsonDir);
  }

  list(): Array<{ id: string; name: string; updatedAt: string }> {
    return listFlows(this.db);
  }

  get(flowId: string): Flow | undefined {
    return getFlow(this.db, flowId);
  }

  resolve(flowName: string): Flow | undefined {
    const direct = this.get(flowName);
    if (direct !== undefined) return direct;
    const byName = this.list().find((flow) => flow.name === flowName);
    return byName === undefined ? undefined : this.get(byName.id);
  }

  delete(flowId: string): boolean {
    return deleteFlow(this.db, flowId, this.jsonDir);
  }

  /** SQLite → JSON 镜像全量重建 */
  rebuildMirrors(): number {
    const rows = this.db.prepare('SELECT id, content FROM flows').all() as Array<{ id: string; content: string }>;
    fs.mkdirSync(this.jsonDir, { recursive: true });
    for (const row of rows) fs.writeFileSync(path.join(this.jsonDir, `${row.id}.json`), row.content, 'utf-8');
    return rows.length;
  }

  importJsonFile(file: string): { flowId: string; result: ValidationResult } {
    const flow = JSON.parse(fs.readFileSync(file, 'utf-8')) as Flow;
    return { flowId: flow.id, result: this.save(flow) };
  }
}
