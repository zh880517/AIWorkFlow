// 文档完整性守门：每个插件必须有文档目录，根 README 与 docs/README.md 必须链接到它。
//
// 用法：npm run check:docs
// 规则见 docs/README.md；新增插件时按报错提示补齐即可。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { MARKET_INDEX, listPlugins, repo } from './plugins.mjs';

const problems = [];

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

const rootReadme = read(path.join(repo, 'README.md'));
const docsReadme = read(path.join(repo, 'docs', 'README.md'));
const index = (() => {
  try {
    return JSON.parse(readFileSync(MARKET_INDEX, 'utf8'));
  } catch {
    return undefined;
  }
})();

if (rootReadme === undefined) problems.push('README.md 不存在。');
if (docsReadme === undefined) problems.push('docs/README.md 不存在。');
if (index === undefined) problems.push('market/index.json 不存在或不是 JSON：先跑 npm run market:plugin。');

const plugins = listPlugins();
if (plugins.length === 0) problems.push('plugins/ 下没有任何插件包。');

const docsRoot = path.join(repo, 'docs', 'plugins');

for (const plugin of plugins) {
  const { id } = plugin;
  const docsDir = path.join(docsRoot, id);
  const docsReadmePath = path.join(docsDir, 'README.md');
  const docsDesignPath = path.join(docsDir, 'design.md');
  const relativeReadme = `docs/plugins/${id}/README.md`;

  if (!existsSync(docsReadmePath)) {
    problems.push(
      `${relativeReadme} 缺失。\n` +
        `  新增插件 ${id} 时要同时建 docs/plugins/${id}/README.md 与 design.md，\n` +
        `  并在根 README「插件」表加一行（模板：docs/plugins/aiworkflow/README.md）。`,
    );
  }
  if (!existsSync(docsDesignPath)) {
    problems.push(
      `docs/plugins/${id}/design.md 缺失。\n` +
        `  每个插件的架构与关键决策写在 design.md（模板：docs/plugins/aiworkflow/design.md）。`,
    );
  }
  if (rootReadme !== undefined && !rootReadme.includes(relativeReadme)) {
    problems.push(
      `根 README 没有链接 ${relativeReadme}。\n` +
        `  在「## 插件」表里给 ${id} 加一行，文档列写成 [docs/plugins/${id}](docs/plugins/${id}/README.md)。`,
    );
  }
  if (docsReadme !== undefined && !docsReadme.includes(relativeReadme)) {
    problems.push(
      `docs/README.md 没有链接 ${relativeReadme}。\n` +
        `  在「插件文档」索引里加一行，规则与入口写在一起。`,
    );
  }
  if (index !== undefined && !index.plugins.some((entry) => entry.name === plugin.pkg.name)) {
    problems.push(
      `market/index.json 里没有 ${plugin.pkg.name}。\n` +
        `  跑 npm run release:plugin -- --only ${id} 生成索引条目（索引未提交时 check:docs 会失败）。`,
    );
  }

  const bundlePatch = plugin.pkg?.dsh?.bundle?.patch;
  if (typeof bundlePatch !== 'string') {
    problems.push(`plugins/${id}/package.json 没有声明 dsh.bundle.patch，DSH 不会把它当成插件。`);
  } else if (!existsSync(path.join(plugin.dir, bundlePatch))) {
    problems.push(`plugins/${id}/package.json 的 dsh.bundle.patch 指向 ${bundlePatch}，但文件不存在。`);
  }

  const packageReadme = path.join(plugin.dir, 'README.md');
  if (!existsSync(packageReadme)) {
    problems.push(`plugins/${id}/README.md 缺失（包内短版说明，随包分发）。`);
  } else if (!readFileSync(packageReadme, 'utf8').includes(`docs/plugins/${id}/`)) {
    problems.push(
      `plugins/${id}/README.md 没有链到完整文档。\n` +
        `  加一行：[完整文档](../../docs/plugins/${id}/README.md)。`,
    );
  }
}

// 反向检查：docs/plugins 下不允许有孤儿文档目录
if (existsSync(docsRoot)) {
  const ids = new Set(plugins.map((plugin) => plugin.id));
  for (const entry of readdirSync(docsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !ids.has(entry.name)) {
      problems.push(
        `docs/plugins/${entry.name}/ 没有对应的插件包（plugins/${entry.name}/）。\n` +
          `  要么补插件，要么删掉这个文档目录。`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`文档检查未通过（${problems.length} 项）：\n`);
  for (const problem of problems) console.error(`- ${problem}\n`);
  process.exit(1);
}

console.log(`文档检查通过（${plugins.length} 个插件，每个都有 docs/plugins/<id>/ 与 README 链接）。`);
