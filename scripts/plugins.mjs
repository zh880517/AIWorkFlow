// 插件目录枚举：plugins/*/package.json 是唯一来源。
// 目录名即插件 id，也是文档目录名（docs/plugins/<id>/）与市场索引里的 <id> 段。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pluginsRoot = path.join(repo, 'plugins');
export const MARKET_INDEX = path.join(repo, 'market', 'index.json');

/** 读一个插件目录的清单；目录里没有 package.json 就当作不是插件 */
function readPlugin(id) {
  const dir = path.join(pluginsRoot, id);
  const pkgPath = path.join(dir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return undefined;
  }
  return { id, dir, pkg, pkgPath };
}

/** 全部插件，按 id 排序 */
export function listPlugins() {
  let entries;
  try {
    entries = readdirSync(pluginsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => readPlugin(entry.name))
    .filter((plugin) => plugin !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * 解析插件参数：`--only <id>`、`--all` 或直接给一个 id。
 * 不带参数时返回全部（--all 是显式写法）。
 */
export function selectPlugins(argv = process.argv.slice(2)) {
  const all = listPlugins();
  let only;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--only') {
      index += 1;
      only = argv[index];
      continue;
    }
    if (argument === '--all' || argument.startsWith('-')) continue;
    if (only === undefined) only = argument;
  }
  if (only === undefined) return all;
  const found = all.filter((plugin) => plugin.id === only);
  if (found.length === 0) {
    throw new Error(
      `没有插件 ${JSON.stringify(only)}：plugins/ 下只有 ${all.map((plugin) => plugin.id).join('、') || '（空）'}。`,
    );
  }
  return found;
}
