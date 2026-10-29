// ~/.aiworkflow 数据布局（设计文档 §5.1）；测试用 AIWORKFLOW_HOME 重定向
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export function homeDir(): string {
  return process.env.AIWORKFLOW_HOME ?? path.join(os.homedir(), '.aiworkflow');
}

export function flowsDir(): string {
  return path.join(homeDir(), 'flows');
}

export function cacheDir(): string {
  return path.join(homeDir(), 'cache');
}

export function dbPath(): string {
  return path.join(homeDir(), 'aiworkflow.db');
}

/** 确保目录布局存在（幂等） */
export function ensureLayout(): void {
  fs.mkdirSync(flowsDir(), { recursive: true });
  fs.mkdirSync(cacheDir(), { recursive: true });
}
