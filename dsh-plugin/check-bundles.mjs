// 校验仓库里的构建产物是否跟源码一致：重新构建一遍，再跟**暂存区**（即将提交的内容）里的同名文件比哈希。
//
// 用法：npm run check:plugin
// - 提交前跑：暂存区里的 index.js / client.js 必须等于一次全新构建的结果；
// - CI 里跑：暂存区就是 HEAD，能抓到「改了源码但没提交产物」。
// 别人按 GitHub spec 安装时不会在本机构建，所以这两个文件必须与源码同步。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

execFileSync(process.execPath, [path.join(here, 'build.mjs')], { cwd: repo, stdio: 'inherit' });

// 产物是用**工作区源码**构建的，但下面比较的是**暂存区产物**。
// 如果源码还有未暂存/未跟踪的改动，就会出现"提交里是旧源码 + 新产物"的假通过。
const SOURCE = [
  'shared/src',
  'dsh-plugin/src',
  'dsh-plugin/package.json',
  'dsh-plugin/cordis.patch.yml',
  'dsh-plugin/locale',
  'dsh-plugin/icon.svg',
  'package.json',
  'package-lock.json',
];
const unstaged = execFileSync('git', ['diff', '--name-only', '--', ...SOURCE], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...SOURCE], {
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
for (const file of ['index.js', 'client.js']) {
  const relative = `dsh-plugin/${file}`;
  const built = hash(readFileSync(path.join(here, file)));
  let staged = 'missing';
  try {
    // `:path` 读暂存区版本（未暂存改动不算）
    staged = hash(execFileSync('git', ['show', `:${relative}`], { cwd: repo }));
  } catch {
    // 暂存区里没有这个文件（还没 git add 过产物）
  }
  if (built !== staged) stale.push(relative);
}

if (stale.length > 0) {
  console.error(`构建产物与暂存区不一致：${stale.join('、')}`);
  console.error('先 npm run build:plugin，再把产物和源码一起 git add。');
  process.exit(1);
}
console.log('构建产物与暂存区一致。');
