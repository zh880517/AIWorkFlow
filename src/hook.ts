// 宿主身份注入 hook（设计文档 §8.1）：PreToolUse 事件里把宿主会话 id 写进工具入参。
// 两个宿主（Claude Code / Codex）的 PreToolUse 都支持 permissionDecision: "allow" + updatedInput
// 整体替换工具入参，且载荷公共字段都带稳定的 session_id（Claude Code 为对话 UUID，Codex 为 thread id）。
// 约束：纯本地 stdin→stdout，不访问网络、永不 deny/block、任何解析失败静默放行（exit 0 无输出）。
// _aid（agent_id，仅 Claude Code 子 Agent 调用携带）注入但暂不消费，为阶段 6 子 Agent 流量区分预留。

interface PreToolUsePayload {
  hook_event_name?: unknown;
  session_id?: unknown;
  agent_id?: unknown;
  tool_input?: unknown;
}

/**
 * 由宿主事件载荷构造 hook 输出。返回要打印的 JSON（含换行），无需改写时返回 null。
 * updatedInput 必须完整回显原 tool_input（宿主语义是整体替换，不是合并）。
 */
export function buildHookOutput(host: string, payload: unknown): string | null {
  if (host === '' || payload === null || typeof payload !== 'object') return null;
  const event = payload as PreToolUsePayload;
  if (event.hook_event_name !== 'PreToolUse') return null;
  if (typeof event.session_id !== 'string' || event.session_id === '') return null;
  if (event.tool_input === null || typeof event.tool_input !== 'object') return null;
  const input: Record<string, unknown> = { ...(event.tool_input as Record<string, unknown>) };
  input._host = host;
  input._sid = event.session_id;
  if (typeof event.agent_id === 'string' && event.agent_id !== '') input._aid = event.agent_id;
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: input,
    },
  })}\n`;
}

/** CLI 入口：读 stdin、写 stdout。任何失败都静默（不输出、不非零退出），绝不阻塞工具调用。 */
export async function runHook(host: string): Promise<void> {
  const raw = await readStdin();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const out = buildHookOutput(host, payload);
  if (out !== null) process.stdout.write(out);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
  });
}
