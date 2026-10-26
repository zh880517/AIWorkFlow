// 一键生成发布物料：构建插件 → 提交源码+产物 → 刷新市场索引 → 提交索引 → 打印安装方式。
//
//   npm run release:plugin               构建 + 提交 + 索引 + 提交
//   npm run release:plugin -- --dry-run  只构建和暂存，打印会做什么，不动 git 历史
//   npm run release:plugin -- --no-commit 只构建，不提交也不生成索引
//
// 为什么提交两笔：市场索引必须钉在一个「已包含构建产物」的 commit 上，
// 所以先把源码与产物一起提交，再用新的 HEAD 生成索引并提交索引。
// 两笔都只带 dsh-plugin/ 里的文件（索引单独一笔），工作区其它改动不动。
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const flags = new Set(process.argv.slice(2));
const dryRun = flags.has('--dry-run');
const noCommit = flags.has('--no-commit') || dryRun;

const ARTIFACTS = ['dsh-plugin/index.js', 'dsh-plugin/client.js'];
const INDEX = 'dsh-plugin/market/index.json';
// 第一笔提交的范围：插件目录里的源码与产物，索引留到第二笔
const PLUGIN = ['dsh-plugin', ':(exclude)dsh-plugin/market/index.json'];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function dirty(paths) {
  return git('status', '--porcelain', '--', ...paths) !== '';
}

function runScript(script) {
  const result = spawnSync(process.execPath, [script], { cwd: repo, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n${path.relative(repo, script)} 执行失败，什么都没提交。`);
    process.exit(result.status ?? 1);
  }
}

/** 只提交给定路径；有改动才提交，返回是否真的提交了 */
function commit(paths, message) {
  git('add', '--', ...paths);
  let staged = true;
  try {
    // 有暂存改动时退出码是 1，execFileSync 会抛错
    git('diff', '--cached', '--quiet', '--', ...paths);
    staged = false;
  } catch {
    staged = true;
  }
  if (!staged) return false;
  try {
    git('commit', '-m', message, '--', ...paths);
  } catch (error) {
    console.error(`\n提交失败：${error instanceof Error ? error.message : String(error)}`);
    console.error('产物已生成，可手动 git add / git commit。');
    process.exit(1);
  }
  return true;
}

function readIndex() {
  try {
    return JSON.parse(readFileSync(path.join(repo, INDEX), 'utf8'));
  } catch {
    return undefined;
  }
}

/** 某个提交里这个文件的内容；不存在返回 null */
function fileAt(commitSha, relative) {
  try {
    return execFileSync('git', ['show', `${commitSha}:${relative}`], { cwd: repo });
  } catch {
    return null;
  }
}

/** 现有索引指向的提交里，产物是否和当前工作区刚构建出来的一致 */
function indexStillValid(current) {
  const sha = current?.plugins?.[0]?.versions?.[0]?.source?.commit;
  if (typeof sha !== 'string') return false;
  for (const relative of ARTIFACTS) {
    const at = fileAt(sha, relative);
    if (at === null || sha256(at) !== sha256(readFileSync(path.join(repo, relative)))) return false;
  }
  return true;
}

// 0) 防呆：shared/ 同时影响主工程，必须先进版本库，否则产物对不上任何提交
if (!noCommit && dirty(['shared/src'])) {
  console.error('shared/src/ 有未提交改动：先提交它（主工程也用这份代码），再跑一键生成。');
  process.exit(1);
}

// 1) 构建（build.mjs 自己会断言 Host 产物只依赖 node: 内建）
console.log('\n[1/4] 构建插件产物…');
runScript(path.join(here, 'build.mjs'));

// 2) 提交源码 + 产物（同一笔，保证这个提交里产物和源码一致）
const nonArtifactChanged = dirty([
  'dsh-plugin',
  ':(exclude)dsh-plugin/index.js',
  ':(exclude)dsh-plugin/client.js',
  ':(exclude)dsh-plugin/market/index.json',
]);
console.log('[2/4] 提交源码与构建产物…');
const artifactsCommitted = noCommit
  ? false
  : commit(PLUGIN, nonArtifactChanged ? 'chore(plugin): 更新插件文件与构建产物' : 'build(plugin): 更新构建产物');

// 3) 生成市场索引（钉在刚提交的 HEAD 上；现有索引仍然有效就跳过，避免无谓提交）
let indexSkipped = false;
if (noCommit) {
  console.log('[3/4] 跳过索引生成（--dry-run / --no-commit）');
} else if (indexStillValid(readIndex())) {
  console.log('[3/4] 现有索引已指向包含当前产物的提交，跳过');
  indexSkipped = true;
} else {
  console.log('[3/4] 生成市场索引…');
  runScript(path.join(here, 'market', 'build.mjs'));
}

// 4) 提交索引
let indexCommitted = false;
if (!noCommit && !indexSkipped) {
  const head = git('rev-parse', '--short', 'HEAD');
  indexCommitted = commit([INDEX], `chore(plugin): 市场索引指向 ${head}`);
}

// 汇总
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));
const index = readIndex() ?? {};
const entry = index.plugins?.[0];
const version = entry?.versions?.[0];
const commitSha = version?.source?.commit ?? git('rev-parse', 'HEAD');
const repoUrl = entry?.repository?.url ?? 'https://github.com/zh880517/AIWorkFlow';
const slug = repoUrl.replace(/^https?:\/\/[^/]+\//, '');

console.log('\n—— 生成结果 ——');
console.log(`包        ${pkg.name}@${version?.version ?? pkg.version}`);
console.log(`提交      ${noCommit ? '仅工作区（未提交）' : artifactsCommitted ? '已提交源码与产物' : '无变化'}`);
console.log(
  `索引      ${
    noCommit ? '未生成' : indexCommitted ? '已提交' : indexSkipped ? '无变化（已指向当前产物）' : '无变化'
  }`,
);
console.log(`索引指向  ${commitSha.slice(0, 7)}${noCommit ? '（旧提交，未包含本次产物）' : ''}`);
console.log('\n安装（DSH 侧栏 Plugins → Add plugin，或 plugin_manager 的 install_bundle）：');
console.log(`  git+${repoUrl}.git#${commitSha}&path:/dsh-plugin`);
console.log('\n跟随主分支：');
console.log(`  git+${repoUrl}.git#main&path:/dsh-plugin`);
console.log('\n市场索引（启用 Discover 后添加）：');
console.log(`  https://raw.githubusercontent.com/${slug}/main/${INDEX}`);

if (noCommit) {
  console.log('\n未提交模式：产物已在工作区，索引没动。提交后重跑本脚本生成索引，或手动 npm run market:plugin。');
} else {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  let ahead = '';
  try {
    ahead = git('rev-list', '--count', `origin/${branch}..HEAD`);
  } catch {
    ahead = '';
  }
  if (ahead !== '' && ahead !== '0') console.log(`\n还有 ${ahead} 个提交没推送：git push origin ${branch}`);
  if (dirty(PLUGIN)) {
    console.log('\n提醒：dsh-plugin/ 里还有未提交改动，装之前先确认提交完整。');
  }
}
