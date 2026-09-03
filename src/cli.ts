// CLI 入口：启动本地服务（面板 + API + MCP 端点）
import crypto from 'node:crypto';
import { openDb } from './core/db.js';
import { FlowStore } from './core/flowStore.js';
import { ExecutionEngine } from './core/engine.js';
import { createApp, startServer } from './server/http.js';

const port = Number(process.env.PORT ?? 4123);
const token = process.env.AIWORKFLOW_TOKEN ?? crypto.randomBytes(12).toString('hex');

const db = openDb();
const store = new FlowStore(db);
const engine = new ExecutionEngine({ db, resolveFlow: (name) => store.resolve(name) });
const app = createApp({ store, token, engine });
startServer(app, port);

console.log(`aiworkflow 服务已启动（仅本机）：`);
console.log(`  面板:  http://127.0.0.1:${port}/?k=${token}`);
console.log(`  MCP:   http://127.0.0.1:${port}/mcp?k=${token}`);
console.log(`  API:   http://127.0.0.1:${port}/api/flows?k=${token}`);
