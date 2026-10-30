// 类型检查：shared/ 与每个 plugins/<id>/ 各跑一次 tsc。
//
// 每个插件目录有自己的 tsconfig.json（继承 tsconfig.plugin.base.json），
// 这样插件之间不会互相看到对方的源码。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { listPlugins, repo } from './plugins.mjs';

const tsc = path.join(repo, 'node_modules', 'typescript', 'bin', 'tsc');
let failed = false;

function run(tsconfig, label) {
  const result = spawnSync(process.execPath, [tsc, '-p', tsconfig, '--noEmit'], { cwd: repo, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`typecheck 失败：${label}`);
    failed = true;
  }
}

run(path.join(repo, 'shared', 'tsconfig.json'), 'shared/');

for (const plugin of listPlugins()) {
  const tsconfig = path.join(plugin.dir, 'tsconfig.json');
  if (!existsSync(tsconfig)) {
    console.error(`plugins/${plugin.id}/tsconfig.json 缺失：每个插件都要有自己的 tsconfig（继承 tsconfig.plugin.base.json）。`);
    failed = true;
    continue;
  }
  run(tsconfig, `plugins/${plugin.id}/`);
}

if (failed) process.exit(1);
console.log(`typecheck 通过（shared + ${listPlugins().length} 个插件）。`);
