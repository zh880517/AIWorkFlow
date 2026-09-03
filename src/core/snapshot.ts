// 运行时快照（copy-on-run，设计文档 §5.2）：
// - 启动 run 时把图定义钉死一份，run 全程只对快照执行，原图改动不影响进行中的 run
// - flowRef 引用的子图递归一起快照
// - 内容 hash 去重，存 SQLite（flow_snapshots），cache/ 里的 JSON 是派生镜像
import type Database from 'better-sqlite3';
import type { Flow, FlowSnapshot } from './types.js';
import { contentHash } from './canonical.js';
import { cacheDir } from './paths.js';
import fs from 'node:fs';
import path from 'node:path';

export interface FlowResolver {
  get(flowId: string): Flow | undefined;
}

/** 递归解析 flowRef，构建完整快照。引用缺失或跨图循环时抛错。 */
export function buildSnapshot(rootFlow: Flow, resolver: FlowResolver): FlowSnapshot {
  const flows: Record<string, Flow> = {};
  collectFlows(rootFlow, resolver, flows, new Set([rootFlow.id]));
  return { rootFlowId: rootFlow.id, flows };
}

function collectFlows(
  flow: Flow,
  resolver: FlowResolver,
  flows: Record<string, Flow>,
  visiting: Set<string>,
): void {
  if (flows[flow.id] !== undefined) return; // 同图被引用多次只收一份
  flows[flow.id] = flow;
  for (const node of flow.nodes) {
    if (node.type === 'subagent' && node.mode === 'flowRef' && node.flowRef) {
      const refId = node.flowRef;
      const target = resolver.get(refId);
      if (target === undefined) {
        throw new Error(`flowRef 引用的图不存在：${refId}（节点 ${node.id}，图 ${flow.id}）`);
      }
      if (visiting.has(refId)) {
        throw new Error(`flowRef 引用成环：${[...visiting, refId].join(' -> ')}`);
      }
      visiting.add(refId);
      collectFlows(target, resolver, flows, visiting);
      visiting.delete(refId);
    }
  }
}

/** 快照内容寻址 hash（对完整快照结构做稳定序列化） */
export function snapshotHash(snapshot: FlowSnapshot): string {
  return contentHash(snapshot);
}

/** 落库（内容寻址去重），并写 cache/ 派生镜像。返回 hash。 */
export function persistSnapshot(
  db: Database.Database,
  snapshot: FlowSnapshot,
): string {
  const hash = snapshotHash(snapshot);
  const content = JSON.stringify(snapshot);
  db.prepare(
    'INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING',
  ).run(hash, content, new Date().toISOString());
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(path.join(cacheDir(), `snapshot-${hash}.json`), content, 'utf-8');
  return hash;
}

export function loadSnapshot(db: Database.Database, hash: string): FlowSnapshot | undefined {
  const row = db
    .prepare('SELECT content FROM flow_snapshots WHERE hash = ?')
    .get(hash) as { content: string } | undefined;
  return row === undefined ? undefined : (JSON.parse(row.content) as FlowSnapshot);
}
