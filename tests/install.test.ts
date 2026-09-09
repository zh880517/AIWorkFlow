// install 命令测试（阶段 9）：宿主集成文件写入、幂等、用户配置保留
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookCommand, installClaudeCode, installCodex, type InstallPaths } from '../src/install.js';

let tmp: string;
let paths: InstallPaths;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiworkflow-install-'));
  // 假包结构：install 从 pkgRoot/assets 拷 Skill
  fs.mkdirSync(path.join(tmp, 'pkg', 'assets', 'skills', 'aiworkflow'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'pkg', 'assets', 'skills', 'aiworkflow', 'SKILL.md'), '---\nname: aiworkflow\n---\n薄 Skill', 'utf8');
  fs.mkdirSync(path.join(tmp, 'pkg', 'dist'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'pkg', 'dist', 'cli.js'), '', 'utf8');
  paths = { claudeHome: path.join(tmp, 'claude'), codexHome: path.join(tmp, 'codex'), pkgRoot: path.join(tmp, 'pkg') };
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const readJson = (p: string): Record<string, unknown> => JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;

describe('install — Claude Code', () => {
  it('写 Skill + settings.json hooks；重复执行幂等，用户其他配置保留', () => {
    // 预置：用户已有自己的 hook 条目与配置
    fs.mkdirSync(paths.claudeHome, { recursive: true });
    fs.writeFileSync(
      path.join(paths.claudeHome, 'settings.json'),
      JSON.stringify({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'mcp__other__.*', hooks: [{ type: 'command', command: 'keep-me' }] }] } }),
      'utf8',
    );
    const r1 = installClaudeCode(paths);
    expect(r1.files.some((f) => f.endsWith(path.join('skills', 'aiworkflow', 'SKILL.md')))).toBe(true);
    expect(fs.readFileSync(path.join(paths.claudeHome, 'skills', 'aiworkflow', 'SKILL.md'), 'utf8')).toContain('aiworkflow');
    const s1 = readJson(path.join(paths.claudeHome, 'settings.json'));
    expect(s1.model).toBe('opus'); // 用户配置保留
    const pre = (s1.hooks as { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> }).PreToolUse;
    expect(pre.some((e) => e.matcher === 'mcp__other__.*')).toBe(true);
    const ours = pre.filter((e) => e.matcher === 'mcp__aiworkflow__.*');
    expect(ours).toHaveLength(1);
    expect(ours[0]!.hooks[0]!.command).toBe(hookCommand(paths.pkgRoot, 'claude-code'));
    expect(ours[0]!.hooks[0]!.command).toContain('hook claude-code');
    // 幂等：重跑不重复
    installClaudeCode(paths);
    const s2 = readJson(path.join(paths.claudeHome, 'settings.json'));
    const pre2 = (s2.hooks as { PreToolUse: unknown[] }).PreToolUse;
    expect(pre2.filter((e) => (e as { matcher: string }).matcher === 'mcp__aiworkflow__.*')).toHaveLength(1);
  });

  it('settings.json 已存在但非法 → 跳过 hook 写入并提示，不覆盖用户的文件', () => {
    const bad = path.join(paths.claudeHome, 'settings.json');
    fs.writeFileSync(bad, '{not json', 'utf8');
    const r = installClaudeCode(paths);
    expect(r.notes.length).toBe(1);
    expect(fs.readFileSync(bad, 'utf8')).toBe('{not json'); // 原样
  });
});

describe('install — Codex', () => {
  it('写 prompts / AGENTS.md 标记片段 / hooks.json；AGENTS.md 重跑只替换片段', () => {
    fs.mkdirSync(paths.codexHome, { recursive: true });
    fs.writeFileSync(path.join(paths.codexHome, 'AGENTS.md'), '# 我的全局约定\n\n不要乱删文件。\n', 'utf8');
    const r = installCodex(paths);
    expect(r.files.some((f) => f.endsWith(path.join('prompts', 'aiworkflow.md')))).toBe(true);
    expect(fs.readFileSync(path.join(paths.codexHome, 'prompts', 'aiworkflow.md'), 'utf8')).toContain('list_flows');
    const agents = fs.readFileSync(path.join(paths.codexHome, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('不要乱删文件。'); // 用户原有内容保留
    expect(agents).toContain('aiworkflow:start');
    const hooks = readJson(path.join(paths.codexHome, 'hooks.json'));
    const pre = (hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ command: string }> }>)[0]!;
    expect(pre.matcher).toBe('mcp__aiworkflow__.*');
    expect(pre.hooks[0]!.command).toContain('hook codex');
    // 重跑：AGENTS.md 片段替换不叠加，正文仍保留
    installCodex(paths);
    const agents2 = fs.readFileSync(path.join(paths.codexHome, 'AGENTS.md'), 'utf8');
    expect(agents2.match(/aiworkflow:start/g)).toHaveLength(1);
    expect(agents2).toContain('不要乱删文件。');
  });

  it('AGENTS.md 不存在 → 创建只含片段的文件', () => {
    fs.rmSync(paths.codexHome, { recursive: true, force: true });
    installCodex(paths);
    const agents = fs.readFileSync(path.join(paths.codexHome, 'AGENTS.md'), 'utf8');
    expect(agents.trim().startsWith('<!-- aiworkflow:start -->')).toBe(true);
  });
});
