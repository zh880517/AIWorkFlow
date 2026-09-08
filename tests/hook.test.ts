// 宿主身份注入 hook 测试（设计文档 §8.1）：两宿主载荷形态、注入字段、失败静默、原样回显
import { describe, expect, it } from 'vitest';
import { buildHookOutput } from '../src/hook.js';

interface HookOut {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: string;
    updatedInput: Record<string, unknown>;
  };
}

function parse(out: string | null): HookOut {
  if (out === null) throw new Error('期望有输出，实际为 null');
  return JSON.parse(out) as HookOut;
}

// Claude Code PreToolUse 载荷形态（官方文档公共字段 + 工具事件字段）
const claudePayload = {
  session_id: '00893aaf-1f2e-4c5d-9a6b-2f3e5d6a7b8c',
  transcript_path: '/Users/u/.claude/projects/-Users-u-proj/00893aaf.jsonl',
  cwd: '/Users/u/proj',
  permission_mode: 'default',
  hook_event_name: 'PreToolUse',
  tool_name: 'mcp__aiworkflow__start_run',
  tool_input: { flowName: '直线图', cwd: '/Users/u/proj' },
};

// Codex PreToolUse 载荷形态（session_id 为 thread id，另有 turn_id / model 等字段）
const codexPayload = {
  session_id: 'thr_b5f6c1c2-1111-4a2b',
  transcript_path: '~/.codex/sessions/2026/09/08/rollout-2026-09-08T10-00-00-thr_b5f6c1c2.jsonl',
  cwd: '/home/u/proj',
  hook_event_name: 'PreToolUse',
  model: 'gpt-5.3-codex',
  turn_id: 'turn_01',
  tool_name: 'mcp__aiworkflow__complete_step',
  tool_input: { summary: '改完了' },
};

describe('buildHookOutput', () => {
  it('Claude Code 载荷：allow + 注入 _host/_sid，原 tool_input 完整回显', () => {
    const out = parse(buildHookOutput('claude-code', claudePayload));
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(out.hookSpecificOutput.updatedInput).toEqual({
      flowName: '直线图',
      cwd: '/Users/u/proj',
      _host: 'claude-code',
      _sid: '00893aaf-1f2e-4c5d-9a6b-2f3e5d6a7b8c',
    });
    expect('_aid' in out.hookSpecificOutput.updatedInput).toBe(false);
  });

  it('Codex 载荷：thread id 注入 _sid', () => {
    const out = parse(buildHookOutput('codex', codexPayload));
    expect(out.hookSpecificOutput.updatedInput).toEqual({
      summary: '改完了',
      _host: 'codex',
      _sid: 'thr_b5f6c1c2-1111-4a2b',
    });
  });

  it('子 Agent 调用（带 agent_id）注入 _aid；主线程调用无该键', () => {
    const child = parse(buildHookOutput('claude-code', { ...claudePayload, agent_id: 'agent-def456' }));
    expect(child.hookSpecificOutput.updatedInput._aid).toBe('agent-def456');
    const main = parse(buildHookOutput('claude-code', claudePayload));
    expect('_aid' in main.hookSpecificOutput.updatedInput).toBe(false);
  });

  it('tool_input 里伪造的 _sid / _host 被覆盖（hook 是唯一权威）', () => {
    const spoofed = parse(
      buildHookOutput('codex', {
        ...codexPayload,
        tool_input: { summary: 'x', _host: 'evil', _sid: 'spoofed' },
      }),
    );
    expect(spoofed.hookSpecificOutput.updatedInput._host).toBe('codex');
    expect(spoofed.hookSpecificOutput.updatedInput._sid).toBe('thr_b5f6c1c2-1111-4a2b');
  });

  it('非 PreToolUse 事件不改写（返回 null）', () => {
    expect(buildHookOutput('claude-code', { ...claudePayload, hook_event_name: 'PostToolUse' })).toBeNull();
    expect(buildHookOutput('codex', { ...codexPayload, hook_event_name: 'SessionStart' })).toBeNull();
  });

  it('载荷异常一律静默放行（null）：非对象 / 缺 session_id / tool_input 非对象 / host 为空', () => {
    expect(buildHookOutput('claude-code', null)).toBeNull();
    expect(buildHookOutput('claude-code', 'json-string')).toBeNull();
    expect(buildHookOutput('claude-code', { ...claudePayload, session_id: undefined })).toBeNull();
    expect(buildHookOutput('claude-code', { ...claudePayload, session_id: '' })).toBeNull();
    expect(buildHookOutput('codex', { ...codexPayload, tool_input: 'not-object' })).toBeNull();
    expect(buildHookOutput('', claudePayload)).toBeNull();
  });
});
