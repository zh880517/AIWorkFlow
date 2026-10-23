// CLI 入口：`aiworkflow` 启动本地服务（面板 + API + MCP 端点）；
// `aiworkflow hook <host>` 跑宿主身份注入 hook；`aiworkflow install [host]` 写宿主集成文件
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from './core/db.js';
import { FlowStore } from './core/flowStore.js';
import { ExecutionEngine } from './core/engine.js';
import { createApp, startServer } from './server/http.js';
import { createEventBus } from './server/events.js';
import { runHook } from './hook.js';
import { installClaudeCode, installCodex, type InstallPaths } from './install.js';

const argv = process.argv.slice(2);

if (argv[0] === 'hook') {
  // 宿主 PreToolUse hook：node <pkg>/dist/src/cli.js hook <claude-code|codex>
  // 必须在 openDb 等任何服务副作用之前分派——hook 不依赖也不启动服务
  const host = argv[1] ?? '';
  if (host === '') {
    console.error('用法：aiworkflow hook <claude-code|codex>');
  } else {
    await runHook(host);
  }
} else if (argv[0] === 'install') {
  // 宿主集成（§8）：Skill / prompts / hooks 配置。幂等，可重复执行
  // dist/src/cli.js → 两级上到包根（assets/、dist/ 都在这下面）
  const pkgRoot = path.resolve(import.meta.dirname, '..', '..');
  const paths: InstallPaths = {
    claudeHome: path.join(os.homedir(), '.claude'),
    codexHome: path.join(os.homedir(), '.codex'),
    pkgRoot,
  };
  const which = argv[1] ?? 'auto';
  const targets =
    which === 'claude-code'
      ? ['claude-code']
      : which === 'codex'
        ? ['codex']
        : ['claude-code', 'codex'].filter((h) =>
            h === 'claude-code' ? fs.existsSync(paths.claudeHome) : fs.existsSync(paths.codexHome),
          );
  if (targets.length === 0) {
    console.error('没检测到已安装的宿主（~/.claude 或 ~/.codex 都不存在）。');
    console.error('用法：aiworkflow install <claude-code|codex>（显式指定会自动创建对应目录）');
    process.exitCode = 1;
  } else {
    for (const host of targets) {
      const result = host === 'claude-code' ? installClaudeCode(paths) : installCodex(paths);
      console.log(`[${result.host}]`);
      for (const f of result.files) console.log(`  已写入/更新：${f}`);
      for (const n of result.notes) console.log(`  注意：${n}`);
    }
    console.log('');
    console.log('最后一步（MCP 注册，需手动，token 每次启动都会变）：');
    console.log('  1. 启动服务：aiworkflow（或 npx aiworkflow），记下打印的 MCP 地址');
    console.log('  2. Claude Code: claude mcp add aiworkflow --transport http "<MCP 地址>"');
    console.log('     Codex:       ~/.codex/config.toml 加 [mcp_servers.aiworkflow] url = "<MCP 地址>"');
    console.log('  3. 想固定 token：启动时带 AIWORKFLOW_TOKEN 环境变量，地址就不变了');
    console.log('  4. 重启宿主会话生效（hook 与 Skill 都是新写入的）');
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
