// node:sqlite → 执行引擎需要的数据库形状（better-sqlite3 的同步 API 是主工程的契约）。
// 差异只有一处：better-sqlite3 有 db.transaction(fn)，node:sqlite 没有，这里用 BEGIN/SAVEPOINT 补齐。
import { DatabaseSync } from 'node:sqlite';
import type { SchemaDb } from '@shared/schema.js';

export class NodeSqliteDb implements SchemaDb {
  readonly raw: DatabaseSync;

  private depth = 0;

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
  }

  prepare(sql: string): ReturnType<DatabaseSync['prepare']> {
    return this.raw.prepare(sql);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  userVersion(): number {
    const row = this.raw.prepare('PRAGMA user_version').get() as { user_version?: number | bigint } | undefined;
    return Number(row?.user_version ?? 0);
  }

  setUserVersion(version: number): void {
    this.raw.exec(`PRAGMA user_version = ${version}`);
  }

  /** 与 better-sqlite3 的 transaction 语义一致：返回可调用函数，嵌套时退化为 SAVEPOINT */
  transaction<T>(fn: () => T): () => T {
    return () => {
      const depth = this.depth + 1;
      const savepoint = `aiworkflow_sp_${depth}`;
      this.raw.exec(depth === 1 ? 'BEGIN' : `SAVEPOINT ${savepoint}`);
      this.depth = depth;
      try {
        const value = fn();
        this.raw.exec(depth === 1 ? 'COMMIT' : `RELEASE ${savepoint}`);
        return value;
      } catch (error) {
        try {
          if (depth === 1) {
            this.raw.exec('ROLLBACK');
          } else {
            this.raw.exec(`ROLLBACK TO ${savepoint}`);
            this.raw.exec(`RELEASE ${savepoint}`);
          }
        } catch {
          // 回滚失败时保留原始错误，不掩盖
        }
        throw error;
      } finally {
        this.depth = depth - 1;
      }
    };
  }

  close(): void {
    this.raw.close();
  }
}
