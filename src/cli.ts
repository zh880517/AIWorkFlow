// CLI 入口：启动本地服务（面板 + API；MCP 端点在 Phase 2 加入）
import crypto from 'node:crypto';
import { openDb } from './core/db.js';
import { FlowStore } from './core/flowStore.js';
import { createApp, startServer } from './server/http.js';

const port = Number(process.env.PORT ?? 4123);
const token = process.env.AIWORKFLOW_TOKEN ?? crypto.randomBytes(12).toString('hex');

const db = openDb();
const store = new FlowStore(db);
const app = createApp({ store, token });
startServer(app, port);

console.log(`aiworkflow 服务已启动（仅本机）：`);
console.log(`  面板:  http://127.0.0.1:${port}/?k=${token}`);
console.log(`  API:   http://127.0.0.1:${port}/api/flows?k=${token}`);
