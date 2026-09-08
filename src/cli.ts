// CLI 入口：`aiworkflow` 启动本地服务（面板 + API + MCP 端点）；`aiworkflow hook <host>` 跑宿主身份注入 hook
import crypto from 'node:crypto';
import { openDb } from './core/db.js';
import { FlowStore } from './core/flowStore.js';
import { ExecutionEngine } from './core/engine.js';
import { createApp, startServer } from './server/http.js';
import { createEventBus } from './server/events.js';
import { runHook } from './hook.js';

const argv = process.argv.slice(2);

if (argv[0] === 'hook') {
  // 宿主 PreToolUse hook：node <pkg>/dist/cli.js hook <claude-code|codex>
  // 必须在 openDb 等任何服务副作用之前分派——hook 不依赖也不启动服务
  const host = argv[1] ?? '';
  if (host === '') {
    console.error('用法：aiworkflow hook <claude-code|codex>');
  } else {
    await runHook(host);
  }
} else {
  const port = Number(process.env.PORT ?? 4123);
  const token = process.env.AIWORKFLOW_TOKEN ?? crypto.randomBytes(12).toString('hex');

  const db = openDb();
  const store = new FlowStore(db);
  const bus = createEventBus();
  const engine = new ExecutionEngine({ db, resolveFlow: (name) => store.resolve(name), onEvent: bus.broadcast });
  const app = createApp({ store, token, engine, db, events: bus });
  startServer(app, port);

  console.log(`aiworkflow 服务已启动（仅本机）：`);
  console.log(`  面板:    http://127.0.0.1:${port}/?k=${token}`);
  console.log(`  MCP:     http://127.0.0.1:${port}/mcp?k=${token}`);
  console.log(`  建图MCP: http://127.0.0.1:${port}/mcp-build?k=${token}`);
  console.log(`  API:     http://127.0.0.1:${port}/api/flows?k=${token}`);
}
