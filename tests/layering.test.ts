// 层次约束守门：公用层（shared/）是最底层，插件（dsh-plugin/）只能单向依赖它。
// 任何反向 import 都会在打包时把不该进包的东西拖进来。
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

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

/** 相对说明符必须解析到指定目录内，挡住 `../../src` / `../../dsh-plugin` 这类越界 */
function escapes(file: string, specifier: string, allowedDir: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  const rel = path.relative(allowedDir, resolved);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel);
}

describe('层次约束：插件只依赖 shared/', () => {
  const sharedSrc = path.join(root, 'shared', 'src');
  const pluginSrc = path.join(root, 'dsh-plugin', 'src');

  it('dsh-plugin/src 只引用 @shared/*、自身目录内的相对路径与 node: 内建', () => {
    const bad: string[] = [];
    for (const file of walk(pluginSrc)) {
      for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('.')) {
          if (escapes(file, specifier, pluginSrc)) bad.push(`${path.relative(root, file)} → ${specifier}`);
          continue;
        }
        if (specifier.startsWith('@shared/') || specifier.startsWith('node:')) continue;
        // 构建期第三方依赖（React / React Flow）允许
        if (specifier === 'react' || specifier === 'react-dom' || specifier.startsWith('react/')) continue;
        if (specifier.startsWith('@xyflow/')) continue;
        bad.push(`${path.relative(root, file)} → ${specifier}`);
      }
    }
    expect(bad, '插件里出现了 shared/ 之外的依赖，把共用逻辑挪到 shared/src/').toEqual([]);
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
