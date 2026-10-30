// 生成 DSH 插件市场索引（format 1）：把当前 HEAD 里每个 plugins/<id>/ 登记成一个可安装版本。
//
// 用法：npm run market:plugin
// 顺序很重要：先 npm run build → 提交源码与产物 → 再跑本脚本 → 提交 market/index.json，
// 这样索引里的 commit 一定包含构建产物，别人安装时不需要在本机构建。
//
// 版本规则：每个插件独立 semver；同一版本号只对应一个 commit。改代码要 bump 版本
// （release:plugin 会检查），否则索引里会出现「版本号没变、内容变了」的条目。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MARKET_INDEX, listPlugins, repo } from './plugins.mjs';

/** 单插件最多保留多少个历史版本（防止索引无限膨胀） */
const MAX_VERSIONS = 10;

/** 装到别人机器上的文件；索引必须钉在一个这些文件都已提交的 commit 上 */
const SHIPPED = [
  'index.js',
  'client.js',
  'package.json',
  'cordis.patch.yml',
  'locale/en.json',
  'locale/zh.json',
  'icon.svg',
  'README.md',
];

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const head = git('rev-parse', 'HEAD');
const headTime = Number(git('show', '-s', '--format=%ct', 'HEAD'));

/** 索引必须钉在"目录内容与工作区一致"的提交上，否则市场会装到旧文件 */
function assertShippedCommitted(plugin) {
  for (const relative of SHIPPED) {
    const repoRelative = `plugins/${plugin.id}/${relative}`;
    let at;
    try {
      at = execFileSync('git', ['show', `${head}:${repoRelative}`], { cwd: repo });
    } catch {
      throw new Error(`${repoRelative} 不在 HEAD（${head.slice(0, 7)}）里：先把插件文件提交，再生成市场索引。`);
    }
    const working = readFileSync(path.join(plugin.dir, relative));
    if (sha256(at) !== sha256(working)) {
      throw new Error(
        `${repoRelative} 与 HEAD（${head.slice(0, 7)}）不一致：先把这次改动提交，再生成市场索引（否则市场装到的是旧文件）。`,
      );
    }
  }
}

/** origin 可能是 git@github.com:user/repo.git、https://github.com/user/repo.git，或本地路径 */
function repositoryUrl() {
  const override = process.env.PLUGIN_REPO_URL ?? process.env.AIWORKFLOW_REPO_URL;
  if (override !== undefined && override !== '') return override.replace(/\.git$/, '');
  const remote = git('remote', 'get-url', 'origin');
  const https = remote.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
  if (!/^https?:\/\//.test(https)) {
    throw new Error(
      `origin 不是 http(s) 地址（${https}）。克隆自本地目录时，设置 PLUGIN_REPO_URL=https://github.com/<用户>/<仓库> 再跑。`,
    );
  }
  return https;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const url = repositoryUrl();
const meta = readJson(path.join(repo, 'market', 'meta.json'));
let previous;
try {
  previous = readJson(MARKET_INDEX);
} catch {
  previous = undefined;
}

const plugins = listPlugins();
if (plugins.length === 0) {
  console.error('plugins/ 下没有插件，索引未生成。');
  process.exit(1);
}

const entries = [];
for (const plugin of plugins) {
  assertShippedCommitted(plugin);
  const manifest = existsSync(path.join(plugin.dir, 'market.json'))
    ? readJson(path.join(plugin.dir, 'market.json'))
    : {};

  const source = { type: 'git', url, commit: head, path: `plugins/${plugin.id}` };
  const oldVersions = previous?.plugins?.find((entry) => entry.name === plugin.pkg.name)?.versions ?? [];
  const latest = oldVersions[0];
  const unchanged =
    latest !== undefined && latest.version === plugin.pkg.version && latest.source?.commit === head;

  const versions = unchanged
    ? oldVersions
    : [
        { version: plugin.pkg.version, publishTimestamp: headTime, source },
        ...oldVersions.filter((version) => version.version !== plugin.pkg.version),
      ].slice(0, MAX_VERSIONS);

  entries.push({
    name: plugin.pkg.name,
    ...(manifest.title === undefined ? {} : { title: manifest.title }),
    ...(manifest.description === undefined ? {} : { description: manifest.description }),
    icon: `../plugins/${plugin.id}/icon.svg`,
    author: manifest.author ?? meta.author,
    homepage: manifest.homepage ?? url,
    repository: { url, directory: `plugins/${plugin.id}` },
    metadata: { keywords: manifest.keywords ?? [] },
    versions,
  });
}

const names = new Set();
for (const entry of entries) {
  if (names.has(entry.name)) throw new Error(`索引里包名重复：${entry.name}（每个插件的 package.json.name 必须唯一）`);
  names.add(entry.name);
}

const index = {
  format: 1,
  title: meta.title,
  ...(meta.description === undefined ? {} : { description: meta.description }),
  plugins: entries,
};

writeFileSync(MARKET_INDEX, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

console.log(`已写入 ${path.relative(repo, MARKET_INDEX)}`);
for (const entry of entries) {
  const latest = entry.versions[0];
  console.log(`  ${entry.name}@${latest.version} @ ${latest.source.commit.slice(0, 7)}`);
  console.log(`  安装 spec: git+${url}.git#${latest.source.commit}&path:/${latest.source.path}`);
}
