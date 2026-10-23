// 执行引擎接线：直接用公用层的 engine（构建时内联进 Host bundle），
// 因此 DSH 里不需要另起 `npx aiworkflow`，run 照样写同一个 SQLite。
import { ExecutionEngine, type EngineDeps } from '@shared/engine.js';
import type { Flow } from '@shared/index.js';
import { getFlow, listFlows } from '@shared/flows.js';
import { database } from './db.js';

let engine: ExecutionEngine | null = null;
let engineDb: unknown = null;

/** 按 id 或展示名解析流程（与面板、aiworkflow_flow 同一套数据） */
export function resolveFlow(name: string): Flow | undefined {
  const db = database();
  const direct = getFlow(db, name);
  if (direct !== undefined) return direct;
  const byName = listFlows(db).find((flow) => flow.name === name);
  return byName === undefined ? undefined : getFlow(db, byName.id);
}

/** 单例：连接被换掉（数据目录变了 / 重载）时自动重建 */
export function workflowEngine(): ExecutionEngine {
  const db = database();
  if (engine !== null && engineDb === db) return engine;
  engine = new ExecutionEngine({
    db: db as unknown as EngineDeps['db'],
    resolveFlow,
  });
  engineDb = db;
  return engine;
}
