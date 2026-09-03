---
name: aiworkflow
description: 按流程图分步执行任务。当用户提到 aiworkflow、流程图，或让你"按图干活/按流程执行"时使用。入场：list_flows 看有哪些图，再 start_run 开始。
---

# aiworkflow 流程执行

本机若在跑 aiworkflow 服务（默认 `http://127.0.0.1:4123/mcp`），通过它的 MCP 工具按流程图分步干活：

1. `list_flows` — 看有哪些流程图（返回 id 与展示名）。
2. `start_run({ flowName })` — 按图开始一个 run；**返回值里带完整的循环纪律文本和第一步**。
3. 之后的节奏完全以 `start_run` 返回的纪律文本为准：每步做完调 `complete_step` 回报（有分支的节点带上 `branchId`）；不知道自己在哪就调 `get_current_step`（幂等，随时可调）。

纪律与工具用法**以服务端下发的文本为准，本文刻意不重复**——服务端升级后话术不会和这里漂移。用户没在跑该服务时，提示用户 `npx aiworkflow` 启动并把打印的 MCP 地址配进来。
