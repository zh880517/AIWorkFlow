// 层次约束守门：公用层（shared/）是最底层，各插件（plugins/<id>/）只能单向依赖它。
// 任何反向 import 或跨插件 import 都会在打包时把不该进包的东西拖进来。
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const sharedSrc = path.join(root, 'shared', 'src');
const pluginsRoot = path.join(root, 'plugins');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.build') continue;
      out.push(...walk(full));
      continue;
    }
    if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 取出一个文件里所有 import/export/require 的模块说明符 */
function specifiers(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) found.push(specifier);
    }
  }
  return found;
}

/** 相对说明符必须解析到指定目录内，挡住 `../../../shared` / `../aiworkflow` 这类越界 */
function escapes(file: string, specifier: string, allowedDir: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  const rel = path.relative(allowedDir, resolved);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel);
}

/** plugins/ 下每个插件目录（只看有 package.json 的） */
function pluginDirs(): Array<{ id: string; src: string }> {
  return fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter((entry) => fs.existsSync(path.join(pluginsRoot, entry.name, 'package.json')))
    .map((entry) => ({ id: entry.name, src: path.join(pluginsRoot, entry.name, 'src') }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

describe('层次约束：插件只依赖 shared/', () => {
  it('plugins/*/src 只引用 @shared/*、自身目录内的相对路径与 node: 内建', () => {
    const bad: string[] = [];
    for (const plugin of pluginDirs()) {
      for (const file of walk(plugin.src)) {
        for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
          if (specifier.startsWith('.')) {
            if (escapes(file, specifier, plugin.src)) bad.push(`${path.relative(root, file)} → ${specifier}`);
            continue;
          }
          if (specifier.startsWith('@shared/') || specifier.startsWith('node:')) continue;
          // 构建期第三方依赖（React / React Flow）允许
          if (specifier === 'react' || specifier === 'react-dom' || specifier.startsWith('react/')) continue;
          if (specifier.startsWith('@xyflow/')) continue;
          bad.push(`${path.relative(root, file)} → ${specifier}`);
        }
      }
    }
    expect(bad, '插件里出现了 shared/ 之外的依赖，把共用逻辑挪到 shared/src/').toEqual([]);
  });

  it('插件之间不互相 import', () => {
    const bad: string[] = [];
    const candidates = pluginDirs();
    for (const plugin of candidates) {
      for (const file of walk(plugin.src)) {
        for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
          if (!specifier.startsWith('.')) continue;
          const resolved = path.resolve(path.dirname(file), specifier);
          for (const other of candidates) {
            if (other.id === plugin.id) continue;
            const rel = path.relative(other.src, resolved);
            if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
              bad.push(`${path.relative(root, file)} → ${other.id}`);
            }
          }
        }
      }
    }
    expect(bad, '插件之间不能互相 import：共用逻辑放 shared/src/，或各自内联').toEqual([]);
  });

  it('shared/src 只引用自身目录内的相对路径与 node: 内建', () => {
    const bad: string[] = [];
    for (const file of walk(sharedSrc)) {
      for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('.') && !escapes(file, specifier, sharedSrc)) continue;
        bad.push(`${path.relative(root, file)} → ${specifier}`);
      }
    }
    expect(bad, '公用层不能依赖插件：把被依赖的逻辑也挪进 shared/src/').toEqual([]);
  });
});
