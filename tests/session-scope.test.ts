// 会话隔离：面板/运行图只能看到本会话的 run（runs.host_session = 'dsh:<sessionId>'）。
// 这条语义由 shared/sql.ts 的 readMonitorState 第四个参数承载，不带 session 参数即看全部。
import { describe, expect, it } from 'vitest';
import { openMemoryDb } from './support/db.js';
import { readMonitorState } from '../shared/src/sql.js';

const NOW = '2026-10-23T10:00:00.000Z';

function seed(): ReturnType<typeof openMemoryDb> {
  const db = openMemoryDb();
  const snapshot = JSON.stringify({
    rootFlowId: 'f',
    flows: {
      f: {
        id: 'f',
        name: 'f',
        entry: 'n1',
        nodes: [
          { id: 'n1', type: 'prompt', instruction: 'x', next: 'n2' },
          { id: 'n2', type: 'end', outcome: 'success' },
        ],
      },
    },
  });
  db.prepare('INSERT INTO flow_snapshots (hash, content, created_at) VALUES (?, ?, ?)').run('h', snapshot, NOW);
  const insert = db.prepare(
    `INSERT INTO runs (id, flow_id, flow_snapshot_hash, entry_node, current_node, status, steps_used, created_at, last_activity, host_session)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run('run_a', 'f', 'h', 'n1', 'n2', 'completed', 2, '2026-10-23T09:00:00.000Z', NOW, 'dsh:session-a');
  insert.run('run_b', 'f', 'h', 'n1', 'n2', 'completed', 2, '2026-10-23T09:05:00.000Z', NOW, 'dsh:session-b');
  insert.run('run_legacy', 'f', 'h', 'n1', 'n1', 'running', 0, '2026-10-23T09:10:00.000Z', NOW, null);
  return db;
}

describe('会话隔离：readMonitorState 的 hostSession 过滤', () => {
  it('只返回本会话的 run，旧数据（host_session 为空）不计入', () => {
    const db = seed();
    const state = readMonitorState(db, null, {}, 'dsh:session-a');
    expect(state.active).toHaveLength(0);
    expect(state.recent.map((run) => run.id)).toEqual(['run_a']);
    // 默认选中本会话的 run，不串到别的会话
    expect(state.selectedId).toBe('run_a');
    expect(state.detail?.id).toBe('run_a');
    db.close();
  });

  it('显式指定别的会话的 run 时不会把它的详情漏出来', () => {
    const db = seed();
    const state = readMonitorState(db, 'run_b', {}, 'dsh:session-a');
    expect(state.selectedId).toBe('run_a');
    expect(state.detail?.id).toBe('run_a');
    db.close();
  });

  it('不传 hostSession 时保持原行为（全部会话）', () => {
    const db = seed();
    const state = readMonitorState(db, null);
    expect(state.active.map((run) => run.id)).toEqual(['run_legacy']);
    expect(state.recent.map((run) => run.id)).toEqual(['run_b', 'run_a']);
    expect(state.recent).toHaveLength(2);
    db.close();
  });
});
