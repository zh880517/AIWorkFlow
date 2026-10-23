// 层次约束守门：公用层（shared/）是最底层，主工程（src/）与插件（dsh-plugin/）都只能单向依赖它。
// 任何一边反向 import 都会在打包时把不该进包的东西拖进来（插件以前直接 import ../../src/core/engine）。
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

/** 相对主工程源码的引用（src/core、src/server、src/web …） */
function pointsAtMainSrc(specifier: string): boolean {
  return /(^|\/)src\/(core|server|web|cli|install|hook)(\/|$)/.test(specifier);
}

describe('层次约束：插件与公用层不反向引用主工程 src/', () => {
  it('dsh-plugin/src 只引用 @shared/* 与自身相对路径', () => {
    const bad: string[] = [];
    for (const file of walk(path.join(root, 'dsh-plugin', 'src'))) {
      for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
        if (pointsAtMainSrc(specifier)) bad.push(`${path.relative(root, file)} → ${specifier}`);
      }
    }
    expect(bad, '插件里出现了 src/ 引用，把逻辑挪到 shared/src/ 并从 @shared/* import').toEqual([]);
  });

  it('shared/src 只引用自身相对路径与 node: 内建', () => {
    const bad: string[] = [];
    for (const file of walk(path.join(root, 'shared', 'src'))) {
      for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
        if (pointsAtMainSrc(specifier)) bad.push(`${path.relative(root, file)} → ${specifier}`);
      }
    }
    expect(bad, '公用层不能依赖主工程：把被依赖的逻辑也挪进 shared/src/').toEqual([]);
  });

  it('主工程 src/ 不引用插件实现（插件是消费方，不是依赖）', () => {
    const bad: string[] = [];
    for (const file of walk(path.join(root, 'src'))) {
      for (const specifier of specifiers(fs.readFileSync(file, 'utf8'))) {
        if (/(^|\/)dsh-plugin(\/|$)/.test(specifier)) bad.push(`${path.relative(root, file)} → ${specifier}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
