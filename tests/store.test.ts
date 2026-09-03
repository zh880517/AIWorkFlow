import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMemoryDb } from '../src/core/db.js';
import { FlowStore } from '../src/core/flowStore.js';
import {
  buildSnapshot,
  loadSnapshot,
  persistSnapshot,
  snapshotHash,
} from '../src/core/snapshot.js';
import type { Flow } from '../src/core/types.js';

let tmpHome: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-test-'));
  process.env.AIWORKFLOW_HOME = tmpHome;
});

afterAll(() => {
  delete process.env.AIWORKFLOW_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function linearFlow(id = 'f_linear'): Flow {
  return {
    id,
    name: '直线图',
    entry: 'n1',
    nodes: [
      { id: 'n1', type: 'prompt', instruction: '第一步', next: 'n2' },
      { id: 'n2', type: 'end', outcome: 'success' },
    ],
  };
}

describe('FlowStore：SQLite 事实源 + JSON 派生镜像', () => {
  it('保存 → 读取往返一致，JSON 镜像已写出', () => {
    const db = openMemoryDb();
    const jsonDir = path.join(tmpHome, 'flows-a');
    const store = new FlowStore(db, jsonDir);
    const flow = linearFlow();

    const saveResult = store.save(flow);
    expect(saveResult.ok).toBe(true);

    expect(store.get('f_linear')).toEqual(flow);
    expect(fs.existsSync(path.join(jsonDir, 'f_linear.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(jsonDir, 'f_linear.json'), 'utf-8'))).toEqual(flow);
  });

  it('硬拒时不落库也不写镜像', () => {
    const db = openMemoryDb();
    const jsonDir = path.join(tmpHome, 'flows-b');
    const store = new FlowStore(db, jsonDir);
    const bad = {
      ...linearFlow('f_bad'),
      nodes: [{ id: 'n1', type: 'prompt' }], // 缺 instruction + entry 不存在
    } as Flow;

    const result = store.save(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(store.get('f_bad')).toBeUndefined();
    expect(fs.existsSync(path.join(jsonDir, 'f_bad.json'))).toBe(false);
  });

  it('警告允许保存并随结果返回', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-c'));
    const warnFlow: Flow = {
      id: 'f_warn',
      name: '缺 default',
      entry: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'prompt',
          instruction: 'x',
          branches: [{ id: 'b1', condition: '通过', to: 'n2' }],
        },
        { id: 'n2', type: 'end', outcome: 'success' },
      ],
    };
    const result = store.save(warnFlow);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('W_NO_DEFAULT');
    expect(store.get('f_warn')).toBeDefined();
  });

  it('按展示名 resolve；list 按更新时间排序；delete 同步删镜像', () => {
    const db = openMemoryDb();
    const jsonDir = path.join(tmpHome, 'flows-d');
    const store = new FlowStore(db, jsonDir);
    store.save(linearFlow('f_a'));
    const named: Flow = { ...linearFlow('f_b'), name: '特殊名字' };
    store.save(named);

    expect(store.resolve('特殊名字')?.id).toBe('f_b');
    expect(store.resolve('f_a')?.id).toBe('f_a');
    expect(store.resolve('不存在')).toBeUndefined();
    expect(store.list().map((f) => f.id).sort()).toEqual(['f_a', 'f_b']);

    expect(store.delete('f_a')).toBe(true);
    expect(store.get('f_a')).toBeUndefined();
    expect(fs.existsSync(path.join(jsonDir, 'f_a.json'))).toBe(false);
    expect(store.delete('f_a')).toBe(false);
  });

  it('镜像目录删光后可从 SQLite 全量重建', () => {
    const db = openMemoryDb();
    const jsonDir = path.join(tmpHome, 'flows-e');
    const store = new FlowStore(db, jsonDir);
    store.save(linearFlow('f_x'));
    store.save(linearFlow('f_y'));

    fs.rmSync(jsonDir, { recursive: true, force: true });
    expect(fs.existsSync(jsonDir)).toBe(false);

    const count = store.rebuildMirrors();
    expect(count).toBe(2);
    expect(JSON.parse(fs.readFileSync(path.join(jsonDir, 'f_x.json'), 'utf-8')).id).toBe('f_x');
    expect(JSON.parse(fs.readFileSync(path.join(jsonDir, 'f_y.json'), 'utf-8')).id).toBe('f_y');
  });

  it('手写 JSON 文件导入', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-f'));
    const file = path.join(tmpHome, 'handwritten.json');
    fs.writeFileSync(file, JSON.stringify(linearFlow('f_hand'), null, 2));

    const { flowId, result } = store.importJsonFile(file);
    expect(flowId).toBe('f_hand');
    expect(result.ok).toBe(true);
    expect(store.get('f_hand')).toBeDefined();
  });
});

describe('快照：copy-on-run 与内容寻址去重', () => {
  it('flowRef 递归收进快照', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-g'));
    const child: Flow = {
      id: 'f_child',
      name: '子图',
      entry: 'c1',
      nodes: [{ id: 'c1', type: 'prompt', instruction: '子任务' }], // 隐式 end
    };
    const parent: Flow = {
      id: 'f_parent',
      name: '主图',
      entry: 'p1',
      nodes: [
        {
          id: 'p1',
          type: 'subagent',
          extraPrompt: '去做',
          mode: 'flowRef',
          flowRef: 'f_child',
          next: 'p2',
        },
        { id: 'p2', type: 'end', outcome: 'success' },
      ],
    };
    store.save(child);
    store.save(parent);

    const snapshot = buildSnapshot(parent, store);
    expect(snapshot.rootFlowId).toBe('f_parent');
    expect(Object.keys(snapshot.flows).sort()).toEqual(['f_child', 'f_parent']);

    const hash = persistSnapshot(db, snapshot);
    const loaded = loadSnapshot(db, hash);
    expect(loaded).toEqual(snapshot);
  });

  it('同一快照重复持久化去重（同 hash 单行）', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-h'));
    const flow = linearFlow('f_dedup');
    store.save(flow);
    const snapshot = buildSnapshot(flow, store);

    const h1 = persistSnapshot(db, snapshot);
    const h2 = persistSnapshot(db, snapshot);
    expect(h1).toBe(h2);
    const rows = db.prepare('SELECT COUNT(*) AS c FROM flow_snapshots').get() as { c: number };
    expect(rows.c).toBe(1);
  });

  it('原图修改后，已持久化的快照不变（钉死语义）', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-i'));
    store.save(linearFlow('f_pin'));
    const before = buildSnapshot(store.get('f_pin')!, store);
    const hash = persistSnapshot(db, before);

    const changed = store.get('f_pin')!;
    changed.nodes[0]!.instruction = '被改过的指令';
    store.save(changed);

    expect(loadSnapshot(db, hash)).toEqual(before);
    expect(snapshotHash(buildSnapshot(store.get('f_pin')!, store))).not.toBe(hash);
  });

  it('flowRef 引用缺失时抛错', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-j'));
    const dangling: Flow = {
      id: 'f_dangling',
      name: '悬空引用',
      entry: 'p1',
      nodes: [
        { id: 'p1', type: 'subagent', extraPrompt: 'x', mode: 'flowRef', flowRef: 'f_missing' },
      ],
    };
    expect(() => buildSnapshot(dangling, store)).toThrow(/f_missing/);
  });

  it('flowRef 引用成环时抛错', () => {
    const db = openMemoryDb();
    const store = new FlowStore(db, path.join(tmpHome, 'flows-k'));
    const a: Flow = {
      id: 'f_a',
      name: 'A',
      entry: 'a1',
      nodes: [{ id: 'a1', type: 'subagent', extraPrompt: 'x', mode: 'flowRef', flowRef: 'f_b' }],
    };
    const b: Flow = {
      id: 'f_b',
      name: 'B',
      entry: 'b1',
      nodes: [{ id: 'b1', type: 'subagent', extraPrompt: 'x', mode: 'flowRef', flowRef: 'f_a' }],
    };
    store.save(a);
    store.save(b);
    expect(() => buildSnapshot(a, store)).toThrow(/成环/);
  });
});
