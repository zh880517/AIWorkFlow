// 一键生成发布物料：构建 → 提交插件（源码+产物）→ 刷新市场索引 → 提交索引 → 打印安装方式。
//
//   npm run release:plugin                  全部插件
//   npm run release:plugin -- --only aiworkflow
//   npm run release:plugin -- --dry-run     只构建并打印步骤（会改写工作区产物），不提交、不生成索引
//   npm run release:plugin -- --no-commit   只构建，不提交也不生成索引
//
// 为什么提交两笔：市场索引必须钉在一个「已包含构建产物」的 commit 上，
// 所以先把源码与产物一起提交，再用新的 HEAD 生成索引并提交索引。
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildPlugin } from './build-plugin.mjs';
import { MARKET_INDEX, repo, selectPlugins } from './plugins.mjs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((argument) => argument.startsWith('--')));
const dryRun = flags.has('--dry-run');
const noCommit = flags.has('--no-commit') || dryRun;
const plugins = selectPlugins(argv);

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function dirty(paths) {
  return git('status', '--porcelain', '--', ...paths) !== '';
}

function runScript(script, step) {
  const result = spawnSync(process.execPath, [script], { cwd: repo, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n[${step}] ${path.relative(repo, script)} 执行失败。`);
    console.error('注意：本脚本此前的提交不会自动回滚；请用 git status / git log 检查，必要时手动 revert。');
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

/** HEAD 里这个插件的版本号；新插件还没进版本库时返回 undefined */
function headVersion(id) {
  try {
    return JSON.parse(git('show', `HEAD:plugins/${id}/package.json`)).version;
  } catch {
    return undefined;
  }
}

// 0) 防呆：shared/ 与依赖清单会被内联/影响产物，必须先进版本库，否则产物对不上任何提交
if (!noCommit && dirty(['shared/src', 'package.json', 'package-lock.json'])) {
  console.error('shared/src 或 package.json / package-lock.json 有未提交改动：先提交它们（插件产物由这些输入决定），再跑一键生成。');
  process.exit(1);
}

// 0.5) 版本规则：插件内容变了但版本号没变，索引里就会出现同版本不同内容
if (!noCommit) {
  const unbumped = [];
  for (const plugin of plugins) {
    if (!dirty([`plugins/${plugin.id}`])) continue;
    const before = headVersion(plugin.id);
    if (before !== undefined && before === plugin.pkg.version) unbumped.push(`${plugin.id}@${before}`);
  }
  if (unbumped.length > 0) {
    console.error(`插件内容有改动但版本号没变：${unbumped.join('、')}`);
    console.error('改代码要 bump plugins/<id>/package.json 的 version，市场索引里同一版本只能对应一个 commit。');
    process.exit(1);
  }
}

// 1) 构建
console.log(`\n[1/4] 构建插件产物（${plugins.map((plugin) => plugin.id).join('、')}）…`);
for (const plugin of plugins) {
  const result = await buildPlugin(plugin);
  console.log(`  ${result.id}: index.js ${result.hostKiB} KiB, client.js ${result.clientKiB} KiB`);
}

// 2) 提交源码 + 产物（同一笔，保证这个提交里产物和源码一致）
const nonArtifactChanged = dirty([
  'plugins',
  ':(exclude)plugins/*/index.js',
  ':(exclude)plugins/*/client.js',
]);
console.log('[2/4] 提交源码与构建产物…');
const artifactsCommitted = noCommit
  ? false
  : commit(['plugins'], nonArtifactChanged ? 'chore(plugins): 更新插件文件与构建产物' : 'build(plugins): 更新构建产物');
if (noCommit && nonArtifactChanged) console.log('  （未提交模式，改动留在工作区）');

// 3) 生成市场索引（钉在刚提交的 HEAD 上；现有索引仍然有效就跳过，避免无谓提交）
console.log('[3/4] 生成市场索引…');
if (noCommit) {
  console.log('  跳过（--dry-run / --no-commit）');
} else {
  runScript(path.join(repo, 'scripts', 'market.mjs'), '3/4');
}

// 4) 提交索引
let indexCommitted = false;
if (!noCommit) {
  indexCommitted = commit(
    ['market/index.json', 'market/meta.json'],
    `chore(market): 索引指向 ${git('rev-parse', '--short', 'HEAD')}`,
  );
  console.log(indexCommitted ? '[4/4] 已提交市场索引' : '[4/4] 索引无变化');
}

// 汇总：从刚生成的索引里读每个插件的安装 spec
const index = JSON.parse(readFileSync(MARKET_INDEX, 'utf8'));
const url = index.plugins[0]?.repository?.url ?? 'https://github.com/zh880517/dsh_plugins';
const slug = url.replace(/^https?:\/\/[^/]+\//, '');

console.log('\n—— 生成结果 ——');
console.log(`提交      ${noCommit ? '仅工作区（未提交）' : artifactsCommitted ? '已提交源码与产物' : '无变化'}`);
console.log(`索引      ${noCommit ? '未生成' : indexCommitted ? '已提交' : '无变化'}`);
console.log(`索引 URL  https://raw.githubusercontent.com/${slug}/main/market/index.json`);
for (const plugin of plugins) {
  const entry = index.plugins.find((candidate) => candidate.name === plugin.pkg.name);
  if (entry === undefined) continue;
  const latest = entry.versions[0];
  const commitSha = latest.source.commit;
  console.log(`\n${entry.name}@${latest.version}`);
  console.log(`  钉版本: git+${url}.git#${commitSha}&path:/${latest.source.path}`);
  console.log(`  跟主线: git+${url}.git#main&path:/${latest.source.path}`);
  if (dryRun) console.log('  （dry-run：索引未重新生成，上面的 spec 可能指向上一次索引）');
}

if (noCommit) {
  console.log('\n未提交模式：产物已在工作区，索引没动。提交后重跑本脚本生成索引。');
} else {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  let ahead = '';
  try {
    ahead = git('rev-list', '--count', `origin/${branch}..HEAD`);
  } catch {
    ahead = '';
  }
  if (ahead !== '' && ahead !== '0') console.log(`\n还有 ${ahead} 个提交没推送：git push origin ${branch}`);
  if (dirty(['plugins'])) console.log('\n提醒：plugins/ 里还有未提交改动，装之前先确认提交完整。');
}
