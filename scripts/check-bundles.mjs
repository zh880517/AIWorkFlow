// 校验仓库里的构建产物是否跟源码一致：先重建一遍，再跟**暂存区**（即将提交的内容）里的同名文件比哈希。
//
// 用法：npm run check:plugin [-- --only <id>]
// - 提交前跑：暂存区里的 index.js / client.js 必须等于一次全新构建的结果；
// - CI 里跑：暂存区就是 HEAD，能抓到「改了源码但没提交产物」。
// 别人按 GitHub spec 安装时不会在本机构建，所以产物必须与源码同步。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildPlugin } from './build-plugin.mjs';
import { repo, selectPlugins } from './plugins.mjs';

const plugins = selectPlugins();
if (plugins.length === 0) {
  console.error('plugins/ 下没有插件可校验。');
  process.exit(1);
}

for (const plugin of plugins) await buildPlugin(plugin);

/** 影响产物的全部路径；任何一个有未暂存/未跟踪改动，check 都可能假通过 */
function sourcePaths(plugin) {
  return [
    'shared/src',
    `${path.relative(repo, plugin.dir)}/src`.replaceAll('\\', '/'),
    `${path.relative(repo, plugin.dir)}/package.json`.replaceAll('\\', '/'),
    `${path.relative(repo, plugin.dir)}/cordis.patch.yml`.replaceAll('\\', '/'),
    `${path.relative(repo, plugin.dir)}/locale`.replaceAll('\\', '/'),
    `${path.relative(repo, plugin.dir)}/icon.svg`.replaceAll('\\', '/'),
    'package.json',
    'package-lock.json',
  ];
}

const sources = plugins.flatMap(sourcePaths);
const unstaged = execFileSync('git', ['diff', '--name-only', '--', ...sources], { cwd: repo, encoding: 'utf8' }).trim();
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...sources], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
if (unstaged !== '' || untracked !== '') {
  console.error('源码/清单还有未暂存或未跟踪的改动，check:plugin 无法代表提交内容：');
  if (unstaged !== '') console.error(unstaged);
  if (untracked !== '') console.error(untracked);
  console.error('先把源码和产物一起 git add，再跑 npm run check:plugin。');
  process.exit(1);
}

const hash = (data) => createHash('sha256').update(data).digest('hex');
const stale = [];
for (const plugin of plugins) {
  for (const file of ['index.js', 'client.js']) {
    const relative = `plugins/${plugin.id}/${file}`;
    const built = hash(readFileSync(path.join(plugin.dir, file)));
    let staged = 'missing';
    try {
      // `:path` 读暂存区版本（未暂存改动不算）
      staged = hash(execFileSync('git', ['show', `:${relative}`], { cwd: repo }));
    } catch {
      // 暂存区里没有这个文件（还没 git add 过产物）
    }
    if (built !== staged) stale.push(relative);
  }
}

if (stale.length > 0) {
  console.error(`构建产物与暂存区不一致：${stale.join('、')}`);
  console.error('先 npm run build，再把产物和源码一起 git add。');
  process.exit(1);
}
console.log(`构建产物与暂存区一致（${plugins.map((plugin) => plugin.id).join('、')}）。`);
