// install 命令（设计文档 §8）：把宿主集成文件写到本机——
// Claude Code（Skill 目录 + ~/.claude/settings.json 的 hooks 段）与
// Codex（~/.codex/prompts 自定义 prompt + ~/.codex/AGENTS.md 片段 + ~/.codex/hooks.json）。
// 纯文件操作、不依赖服务进程；幂等：重跑只替换本工具写入的条目，用户其他配置原样保留。
import fs from 'node:fs';
import path from 'node:path';

export type Host = 'claude-code' | 'codex';

export interface InstallPaths {
  claudeHome: string;
  codexHome: string;
  /** 包根（dist/cli.js 与 assets/ 在这下面） */
  pkgRoot: string;
}

export interface InstallResult {
  host: Host;
  /** 写入/更新的文件 */
  files: string[];
  /** 需要用户注意的提示（如 MCP 注册指引） */
  notes: string[];
}

/** 匹配本服务执行类工具的 hook matcher（§8.1） */
const MATCHER = 'mcp__aiworkflow__.*';
const MARK_START = '<!-- aiworkflow:start -->';
const MARK_END = '<!-- aiworkflow:end -->';

export function hookCommand(pkgRoot: string, host: Host): string {
  return `node ${JSON.stringify(path.join(pkgRoot, 'dist', 'cli.js'))} hook ${host}`;
}

export function installClaudeCode(p: InstallPaths): InstallResult {
  const files: string[] = [];
  // 1) Skill：入场引导文件，服务端下发纪律文本，这里刻意薄
  const skillSrc = path.join(p.pkgRoot, 'assets', 'skills', 'aiworkflow', 'SKILL.md');
  const skillDir = path.join(p.claudeHome, 'skills', 'aiworkflow');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(skillSrc, path.join(skillDir, 'SKILL.md'));
  files.push(path.join(skillDir, 'SKILL.md'));
  // 2) settings.json：hooks.PreToolUse 里替换我们的 matcher 条目
  const settingsPath = path.join(p.claudeHome, 'settings.json');
  const settings = readJsonOrInit(settingsPath);
  if (settings === null) {
    return { host: 'claude-code', files, notes: [`${settingsPath} 已存在但不是合法 JSON，跳过 hook 写入——请手工按设计文档 §8.1 片段合并。`] };
  }
  settings.hooks ??= {};
  const hooks = settings.hooks as Record<string, unknown>;
  hooks.PreToolUse = upsertHookEntry(hooks.PreToolUse, hookCommand(p.pkgRoot, 'claude-code'));
  writeJson(settingsPath, settings);
  files.push(settingsPath);
  return { host: 'claude-code', files, notes: [] };
}

export function installCodex(p: InstallPaths): InstallResult {
  const files: string[] = [];
  // 1) 自定义 prompt
  const promptsDir = path.join(p.codexHome, 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });
  const promptPath = path.join(promptsDir, 'aiworkflow.md');
  fs.writeFileSync(promptPath, CODEX_PROMPT, 'utf8');
  files.push(promptPath);
  // 2) AGENTS.md 片段（标记区间整体替换，幂等）
  const agentsPath = path.join(p.codexHome, 'AGENTS.md');
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  fs.writeFileSync(agentsPath, replaceMarked(agents, CODEX_AGENTS_SECTION), 'utf8');
  files.push(agentsPath);
  // 3) hooks.json：顶层 PreToolUse
  const hooksPath = path.join(p.codexHome, 'hooks.json');
  const hooks = readJsonOrInit(hooksPath);
  if (hooks === null) {
    return { host: 'codex', files, notes: [`${hooksPath} 已存在但不是合法 JSON，跳过 hook 写入——请手工按设计文档 §8.1 片段合并。`] };
  }
  hooks.PreToolUse = upsertHookEntry(hooks.PreToolUse, hookCommand(p.pkgRoot, 'codex'));
  writeJson(hooksPath, hooks);
  files.push(hooksPath);
  return { host: 'codex', files, notes: [] };
}

/** hooks 列表里替换本工具的 matcher 条目（用户其他条目保留） */
function upsertHookEntry(list: unknown, command: string): Array<Record<string, unknown>> {
  const entries = Array.isArray(list) ? (list.filter((e) => (e as { matcher?: string })?.matcher !== MATCHER) as Array<Record<string, unknown>>) : [];
  entries.push({
    matcher: MATCHER,
    hooks: [{ type: 'command', command, timeout: 15 }],
  });
  return entries;
}

/** 读 JSON；文件不存在给 {}；存在但解析失败返回 null（调用方决定跳过而不是覆盖用户的文件） */
function readJsonOrInit(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** 标记区间替换：无标记则追加（带空行分隔）；替换时标记本身保留，保证再次重跑仍幂等 */
function replaceMarked(content: string, section: string): string {
  const marked = `${MARK_START}\n${section}\n${MARK_END}\n`;
  const start = content.indexOf(MARK_START);
  const end = content.indexOf(MARK_END);
  if (start !== -1 && end !== -1 && end > start) {
    return content.slice(0, start) + marked + content.slice(end + MARK_END.length);
  }
  return content.trim() === '' ? marked : `${content.trimEnd()}\n\n${marked}`;
}

const CODEX_PROMPT = `按 aiworkflow 流程图分步干活：

1. 调 aiworkflow MCP 的 list_flows 看有哪些流程图。
2. start_run({ flowName }) 开始；返回值里带完整的循环纪律文本和第一步。
3. 之后完全以服务端下发的纪律文本为准：每步做完 complete_step 回报；不知道在哪就 get_current_step（幂等）。

服务没在跑时，提示用户 npx aiworkflow 启动并把打印的 MCP 地址配进来。
`;

const CODEX_AGENTS_SECTION = `## aiworkflow（流程图驱动执行）

用户提到 aiworkflow / 流程图 / "按图干活"时，用 aiworkflow MCP 工具分步执行：
list_flows 看图 → start_run 开始，之后按服务端返回的纪律文本推进
（complete_step 回报 / get_current_step 找回状态）。
详见 ~/.codex/prompts/aiworkflow.md。`;
