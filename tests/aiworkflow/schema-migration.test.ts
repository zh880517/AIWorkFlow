// 迁移守门：fresh DB 不再有 MCP 会话列；旧库（v5）升级时删除该列且数据保留。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS, migrateSchema } from '../../shared/src/schema.js';
import { NodeSqliteDb } from '../../plugins/aiworkflow/src/sqlite.js';
import { openMemoryDb } from '../support/db.js';

let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-migrate-'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function columns(db: { prepare(sql: string): { all(): unknown[] } }): string[] {
  return (db.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>).map((row) => row.name);
}

describe('schema 迁移', () => {
  it('fresh DB：从 v0 迁到最新，runs 不再有 mcp_session_id', () => {
    const db = openMemoryDb();
    expect(columns(db)).toContain('host_session');
    expect(columns(db)).not.toContain('mcp_session_id');
    db.close();
  });

  it('旧 v5 库升级到 v6：删掉 mcp_session_id，run 数据保留', () => {
    const file = path.join(tmp, 'v5.db');
    const raw = new DatabaseSync(file);
    raw.exec(MIGRATIONS.slice(0, 5).join('\n'));
    raw.exec('PRAGMA user_version = 5');
    raw.exec(
      `INSERT INTO flow_snapshots (hash, content, created_at) VALUES ('h', '{}', '2026-10-01T00:00:00.000Z');
       INSERT INTO runs (id, root_run_id, flow_id, flow_snapshot_hash, entry_node, status, created_at, host_session, mcp_session_id)
       VALUES ('run_old', 'run_old', 'f', 'h', 'n1', 'completed', '2026-10-01T00:00:00.000Z', 'dsh:s1', 'mcp_old');`,
    );
    raw.close();

    const db = new NodeSqliteDb(file);
    migrateSchema(db);
    expect(columns(db)).not.toContain('mcp_session_id');
    const row = db.prepare('SELECT id, host_session FROM runs WHERE id = ?').get('run_old') as {
      id: string;
      host_session: string;
    };
    expect(row).toEqual({ id: 'run_old', host_session: 'dsh:s1' });
    expect(db.userVersion()).toBe(MIGRATIONS.length);
    db.close();
  });
});
