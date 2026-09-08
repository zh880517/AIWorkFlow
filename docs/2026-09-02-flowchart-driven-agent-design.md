# 流程图驱动的 AI Agent 执行引擎 — 设计文档

日期：2026-09-02
状态：已评审，待生成实现计划

---

## 1. 定位

一个通过 npm 启动的本地服务，向 AI 编码 Agent 提供**逐步披露式**的任务流程引导。用户在 Web 面板上画流程图，Agent 通过 HTTP MCP 一次只领取当前一步的指令，做完回报结果后才领到下一步。

**核心价值不是约束 Agent，而是管理它的注意力预算。**

这个区分决定了整个设计的走向：

- **约束视角**（已否决）：假设 Agent 不听话，需要笼子。产品价值取决于笼子有多牢；而笼子永远不够牢，因为 Agent 有文件工具，能直接读流程定义。这条路是死路。
- **引导视角**（采纳）：Agent 的注意力是有限预算，一次性灌入几千字的完整流程会稀释它对当前任务的专注度。流程图是描述"何时披露什么"的最直观载体。这个价值主张不需要防住任何人就能成立。

因此：**Agent 能不能看到全图，是次要问题。默认不给它看是为了降噪，不是为了保密。**

## 2. 设计原则

1. **逐步披露** — 每次只下发当前节点的指令、当前岔路口的条件，不下发图结构。
2. **引导而非约束** — 唯一硬性要求是"每步做完必须回报"（否则链条断裂，是机制必需）。节点执行过程中 Agent 想多读文件、多跑命令，完全放开。
3. **SQLite 是唯一事实源** — JSON 文件全部是派生的、可删的、能从 SQLite 重建。任何写入先落 SQLite 再刷 JSON，永不只写 JSON。
4. **报错必须自愈** — 所有拒绝路径都返回"错在哪 + 正确姿势 + 当前这一步是什么"，让一次往返就能修好，而不是卡死。
5. **不依赖宿主特定机制** — 纯 HTTP MCP + 一份入场文件。Claude Code 与 Codex 是首批验证目标，不是耦合对象；任何 MCP 客户端都应可用。
6. **不静默截断** — 任何被丢弃的工作（fan-out 超出 max、子 Agent 失败后放弃）都必须在面板上显性列出。

## 3. 架构总览

单进程，`npx aiworkflow` 启动，同时提供两个端点：

| 端点 | 用途 |
|---|---|
| `http://127.0.0.1:4123/mcp?k=<token>` | Streamable HTTP MCP，宿主按 URL 配置接入 |
| `http://127.0.0.1:4123/?k=<token>` | Web 面板（编辑器 + 监控） |

`<token>` 为进程启动时生成的随机串，仅绑 `127.0.0.1`。否则本机任意进程都能驱动用户的 Agent。

选择 HTTP 传输而非 stdio 的后果：

- **收益**：单进程独占 SQLite，无多进程 WAL 争用、无端口抢占、无守护进程接管问题；人工卡点可用进程内 promise + SSE 实现，无需轮询数据库；面板天然是跨会话全局视图。
- **收益（关键）**：MCP Streamable HTTP 协议中服务端可在 `initialize` 响应下发 `Mcp-Session-Id`，客户端后续每个请求必须携带。**这是传输层字段，模型看不到，因此模型不可能丢失它。** 但它只能作兜底锚点：Codex 侧会话过期后重新握手会更换 id（源码 `reinitialize_after_session_expiry`，2026-09-08 证实）。主 Agent 身份的首要锚点由宿主 hook 注入的会话 id 承担（§8.1）。
- **代价**：服务端不再知道 Agent 的工作目录。`start_run` 必须显式传入 `cwd` 与 `projectName`，这不是可选项。

### 身份模型

| 角色 | 身份来源 | 丢失风险 |
|---|---|---|
| 主 Agent | 宿主会话 id `_sid`（PreToolUse hook 注入，§8.1）；未装 hook 时退回 `Mcp-Session-Id` | 无（模型不接触） |
| 子 Agent | `childToken`（服务端签发，写在 preamble 里） | 低（子 Agent 上下文短、生命周期短） |

run 定位顺序：**childToken → runId → hostSession（hook 注入的 `"<host>:<sid>"`）→ `Mcp-Session-Id`（兜底）**。`Mcp-Session-Id` 在客户端重连时可能更换（Codex 会话过期重握手即换），因此不作为唯一锚点：run 记录同时绑定 `cwd`，且 `get_current_step` 幂等可随时取回状态。

## 4. 流程 DSL 与数据模型

### 4.1 六种节点类型

| type | 作用 | 专有字段 |
|---|---|---|
| `prompt` | 描述干什么、怎么判断 | `instruction` |
| `tool` | 指定工具与参数 | `toolName`, `params` |
| `subagent` | 派子 Agent | `extraPrompt`, `mode`, `fanOut?` |
| `gate` | 人工卡点，挂起等确认 | `question`, `options[]` |
| `join` | 等并行子 Agent 全部回报后汇总 | `waitFor`, `aggregateInstruction` |
| `end` | 出口 | `outcome: success \| fail` |

`subagent.mode` 三态：

- `inline` — 只提供额外提示词，子 Agent 执行单个节点，其余上下文由主 Agent 补充
- `subflow` — 子 Agent 走一张内嵌子图
- `flowRef` — 子 Agent 走另一张已保存的工作流图

### 4.2 节点通用结构

```jsonc
{
  "id": "flow_mlbb_cl",
  "name": "配表需求改动",
  "entry": "n1",
  "maxSteps": 200,
  "nodes": [{
    "id": "n5",
    "type": "tool",
    "title": "跑测试",
    "toolName": "Bash",
    "params": { "command": "dotnet test {{n3.payload.project}}" },
    "iterationLimit": 3,
    "onLimitExceeded": "n_fail",
    "branches": [
      { "id": "b1", "condition": "全部测试通过", "to": "n6" },
      { "id": "b2", "condition": "有测试失败",   "to": "n4" },
      { "id": "b_default", "condition": "*",     "to": "n_fail" }
    ]
  }]
}
```

### 4.3 分支

- 条件是**自然语言**，由 Agent 自己判断。代价是非确定性，收益是无需为每个节点定 schema、无需服务端另起一次 LLM 判定。
- **下发给 Agent 时剥离 `to` 字段**，只给 `{ id, condition }`。Agent 回一个 `branchId`。理由是降噪：图的拓扑结构对 Agent 完成当前节点毫无用处，给了只是污染注意力。
- `condition: "*"` 表示 default 分支。

### 4.4 节点间数据传递

`complete_step` 提交 `{ summary, payload? }`：

- `summary`（必填，字符串）— 给人看的，面板显示，也是 `join` 汇总时喂给主 Agent 的内容
- `payload`（可选，对象）— 给机器用的，供后续节点插值取字段。**不强制 schema**，与自然语言路线一致

后续节点的 `instruction` / `params` 中可写 `{{nodeId.payload.field}}`，**由服务端渲染完成后再下发**，Agent 收到的是最终文本。

### 4.5 环与迭代

环是一等公民（"测试没过 → 回到改代码"是必需场景），通过两层限制兜底：

1. **节点级** — `iterationLimit` 计数挂在 `(run_id, node_id)` 上。撞到上限时**不执行该节点**，直接走 `onLimitExceeded` 指向的逃生节点。
2. **run 级** — `maxSteps` 全局兜底（默认 200）。理由：`iterationLimit` 只防单点打转，防不住"A→B→C→A 三节点各自未超限但整体绕圈"这类病态图，也防不住引擎自身 bug。撞上判 run 失败，面板明确写"超出全局步数上限"。

## 5. 存储

### 5.1 布局

```
~/.aiworkflow/
  flows/
    flow_mlbb_cl.json          # 图定义，用户级、跨项目共用
  aiworkflow.db                # SQLite，唯一事实源
  cache/
    run-<id>.snapshot.json     # 面板快速加载用的派生快照
```

图放用户目录的取舍：跨项目复用方便，但**无法随项目提交进 git、无法与同事共享**。v1 接受此限制，但架构上不堵路——后续可增加"额外从项目 `.aiworkflow/flows` 加载"。

### 5.2 运行时快照（copy-on-run）

**启动 run 时把图定义钉死一份快照，run 全程只对着快照执行。**

三个收益：

1. 原图可随时修改甚至删除，不影响正在跑的 run
2. 历史 run 永久可回看，面板渲染的是**当时那张图**，节点永远对得上
3. 同一张图的多个 run 互不干扰

两条实现要求：

- 快照存进 SQLite（`runs.flow_snapshot`，按内容 hash 去重），`cache/` 里那份是派生镜像。否则清缓存会把历史 run 看废。
- **`flowRef` 引用的子图必须递归一起快照**。只钉主图的话，别人改了被引用的图，问题原样复现。

### 5.3 表结构（概要）

| 表 | 关键列 |
|---|---|
| `runs` | `id`, `parent_run_id`, `root_run_id`, `flow_id`, `flow_snapshot_hash`, `entry_node`, `current_node`, `status`, `cwd`, `project_name`, `mcp_session_id`, `child_token`, `steps_used`, `last_activity`, `created_at`, `finished_at` |
| `flow_snapshots` | `hash`, `content`（内容寻址去重） |
| `node_executions` | `run_id`, `node_id`, `iteration`, `status`, `summary`, `payload`, `branch_id`, `started_at`, `finished_at` |
| `gate_decisions` | `id`, `run_id`, `node_id`, `question`, `option_id`, `note`, `source`（`panel` \| `chat`）, `decided_at` |

`runs.status`：`running` │ `waiting_gate` │ `waiting_children` │ `completed` │ `failed` │ `stale`

## 6. MCP 接口契约

### 6.1 工具清单

**执行类**

| tool | 签名 | 说明 |
|---|---|---|
| `start_run` | `{ flowName, cwd, projectName, inputs? }` | 建 run（含快照），返回纪律文本 + 第一步 |
| `get_current_step` | `{ childToken? }` | **幂等**。返回"我在哪、要干啥"。上下文压缩后的恢复入口 |
| `complete_step` | `{ summary, payload?, branchId, childToken? }` | 推进一格，返回下一步 |
| `report_blocked` | `{ reason, childToken? }` | 干不下去，见 7.8 的处理规则 |
| `await_gate` | `{ gateId }` | 长轮询上限 60 秒，超时返回"仍在等待，请再调一次" |
| `answer_gate` | `{ gateId, optionId, note? }` | 代填用户在聊天中的答复，记 `source: 'chat'` |

**建图类**：`list_flows`、`get_flow`、`create_flow`、`update_flow`、`validate_flow`

**建图类不做任何模式隔离，run 期间也可自由调用。** 运行时快照已保证 `update_flow` 不会打乱正在跑的 run；而阻止 `get_flow` 读图既拦不住有意为之的人（Agent 有文件工具），也与"引导而非约束"的定位矛盾。

### 6.2 单步返回结构

```jsonc
{
  "runId": "run_a1b2",
  "step": {
    "nodeId": "n5",
    "kind": "tool",
    "title": "跑测试",
    "instruction": "对 apps/battle 跑单测……",
    "tool": { "name": "Bash", "params": { "command": "dotnet test ..." } },
    "branches": [
      { "id": "b1", "condition": "全部测试通过" },
      { "id": "b2", "condition": "有测试失败" }
    ]
  },
  "discipline": "做完必须调 complete_step 并给出 branchId。",
  "progress": { "completed": 4 }
}
```

两处刻意的省略：`branches` 不含 `to`，`progress` 不含总数。都是降噪，不是保密。

每个响应都复述 `runId` + `nodeId`，使上下文中最近一条 tool result 永远携带完整身份。

不同 `kind` 的 `step` 各自附带专有字段：

| `kind` | 专有字段 |
|---|---|
| `prompt` | 无（仅 `instruction`） |
| `tool` | `tool: { name, params }` |
| `subagent` | `children: [{ childToken, preamble, extraPrompt }]`（非 fan-out 时长度为 1） |
| `gate` | `gateId`, `question`, `options: [{ id, label }]` —— `gateId` 由此处取得，用于后续 `await_gate` / `answer_gate` |
| `join` | `childResults: [{ childToken, status, summary }]`, `aggregateInstruction` |
| `end` | `outcome` |

### 6.3 自愈式报错

所有拒绝路径均返回三段式：**错在哪 + 正确姿势 + 当前这一步是什么**。适用于 `branchId` 非法、`childToken` 过期、节点不匹配、跳步等情况。目标是一次往返修复，而非返回裸 error 导致卡死。

### 6.4 纪律文本由服务端下发

完整的循环纪律**不写在 Skill 文件里**，而由 `start_run` 返回值下发。理由：Skill 文件装到宿主目录后不会跟随服务端升级，版本一漂就失配（服务端改了 tool 签名，Skill 仍在教旧用法）。

下发文本要点（引导语气）：

> 你正在按一张流程图分步推进任务。图不会一次给你全部内容——每次只给当前这一步，做完回报后才给下一步。
> **硬的一条**：每步做完必须调 `complete_step`，否则链条断在你这里。
> **完全放开的**：执行某一步时你想多读文件、多跑命令、多查一点，随意——只要最后把结果回报。
> 不确定自己在哪：调 `get_current_step()`。

代价：纪律语气不在用户可读的文件里，想调整须改服务端。已接受。

## 7. 执行引擎

### 7.1 run 树

一次执行是一棵树。`parent_run_id` / `root_run_id` 描述层级：主 Agent 为根，每个子 Agent 一个 child run（`inline` 模式只含一个节点，`subflow` / `flowRef` 模式走自己的子图）。

### 7.2 推进语义

`complete_step` 在单个事务内完成：校验 run 与节点匹配 → 落 `node_executions` → 按 `branchId` 查快照定位后继 → 检查后继迭代上限 → 渲染 `instruction` 插值 → 返回。中途任何失败都不推进，走自愈返回。

### 7.3 分支求值的五种边界情况

| 情况 | 处理 |
|---|---|
| 节点无分支 | 走唯一后继；无后继 = 隐式 end |
| `branchId` 非法或缺失 | 不推进，自愈返回（附合法 id 列表） |
| 多个条件都满足 | Agent 只回一个 id，服务端不裁决 |
| 都不满足 | 走 `condition: "*"` 的 default 分支 |
| 无 default 且都不满足 | run 判失败，面板标红 |

### 7.4 并行 fan-out

节点配置 `fanOut: { from: "{{n3.payload.modules}}", max: 5 }`（也支持固定 N）。

**派发时服务端先把 N 个 child run 建好，再把 `children[]` 返回给主 Agent。** 三个理由：

1. 面板立刻能显示"已排 5 个子任务 / 完成 0"，不必等子 Agent 自行注册
2. `childToken` 校验退化为白名单查表
3. `max` 截断时能明确记录**被丢掉了哪几个**，并在面板显性标出

### 7.5 join 汇聚

主 Agent 的 Task 调用全部返回后调一次 `get_current_step`（宿主的子 Agent 调用本身会阻塞到子 Agent 结束，因此主 Agent 无需轮询）。服务端按 child run 状态分三路：

| child 状态 | 处理 |
|---|---|
| 全部 `completed` | 返回 join 步，`instruction` 含 `aggregateInstruction` + 所有子结果 `summary` |
| 有 child 仍 `running` | 说明该子 Agent 挂了或未回报。服务端将其置为 `failed`（原因记"未回报"），转入下一行的失败处理 |
| 有 child `failed` | 对每个失败的 child **新建一个 child run 并签发新 `childToken`**（旧 run 保留为失败记录，便于回看），返回一个新的 `subagent` 步让主 Agent 重派。**重试只做一轮**；仍失败则带着已有结果推进到 join，面板标黄并记明缺了谁 |

重派使用新 child run 而非复用旧 run，是为了让面板能同时看到"第一次失败了"和"重试的结果"，而不是被覆盖掉。

### 7.6 人工卡点

`gate` 节点将 run 置为 `waiting_gate` 并写一条 pending `gate_decisions`。两个通道均可解决：

- 面板直接点选（`source: 'panel'`）
- Agent 调 `answer_gate` 代填用户在聊天中的答复（`source: 'chat'`）

两者都必须记录 `source`，否则事后回看轨迹无法分辨该卡点是在什么场景下放过的。

### 7.7 崩溃与孤儿 run

服务端重启后，库中 `status=running` 的 run 均为孤儿。**不自动清理**：标 `stale`，面板列出，用户可恢复（状态全在 SQLite，直接 `get_current_step` 即可续）或手动废弃。

"会话结束"没有可靠信号，因此追加一条：**24 小时无活动自动标 `stale`**。

### 7.8 `report_blocked` 的处理规则

落一条 `node_executions`（`status = blocked`，`summary = reason`），然后按优先级顺序取第一个可用出口：

1. 该节点配了 `onLimitExceeded` → 走它（逃生出口复用）
2. 该节点有 `condition: "*"` 的 default 分支 → 走 default
3. 都没有 → run 判 `failed`，面板标红并显示 `reason`

**不做自动重试。** 重试语义已由 `iterationLimit` + 回指边表达；在这里再加一层会与之打架，且 Agent 报 blocked 通常意味着重试也没用。

child run 调 `report_blocked` 时，该 child 置为 `failed`，随后由 7.5 的失败处理接管。

## 8. Skill 引导层与宿主集成

**hook 只允许一种用途：身份注入**（2026-09-08 修订；原"不使用任何 hook"收窄，见 §8.1）。曾设计过的另两类 hook 仍然禁止：

- 拦截层（PreToolUse deny / 审批）与"引导而非约束"矛盾，且收益为负（Agent 在节点执行中顺手多读一个文件本是好事，拦下来纯属妨碍）
- 状态注入层（往上下文塞提醒）仍然不做：注入层被砍后，业务语义不依赖任何宿主特定机制，可在任意 MCP 客户端运行

**代价与缓解**：上下文压缩后无人提醒，Agent 可能悄然脱离流程、按自己的方式完成任务。三层缓解——每个 tool 返回值复述状态、`get_current_step` 幂等可随时取回、纪律文本明确写"不记得就调它"。真正的兜底是面板的停滞检测。按"引导"定位，脱离流程本身不算灾难，只是失去逐步披露的收益。

### 8.1 宿主身份注入 hook（唯一允许的 hook 用途）

宿主配置 PreToolUse hook 匹配 `mcp__aiworkflow__.*`，执行 `aiworkflow hook <host>`（`node <安装路径>/dist/cli.js hook claude-code|codex`）。它读 stdin 的事件 JSON，输出：

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow",
  "updatedInput": { "…原 tool_input 原样回显…", "_host": "claude-code", "_sid": "<宿主会话id>", "_aid": "<agent_id，子 Agent 时才有>" } } }
```

- **两端都支持**：Claude Code（settings.json hooks，command 型）与 Codex（hooks.json，command 型）的 PreToolUse 都支持 `allow + updatedInput` 整体替换工具入参，载荷公共字段都带稳定的会话级 `session_id`（Claude Code 为对话 UUID，Codex 为 thread id）。
- **为什么它比 `Mcp-Session-Id` 可靠**：宿主会话 id 由 hook 注入、模型不书写也就不可能丢失；整场对话稳定，而传输层 id 在 Codex 上会因会话过期重握手而更换。服务端把 `_host:_sid` 组成 hostSession 绑定 run（§3 身份模型）。
- **约束**：纯本地 stdin→stdout，不访问网络、不依赖服务进程；永不 deny（拦截层禁令适用）；任何解析失败静默放行（exit 0 无输出）。`allow` 顺带免确认本服务工具（本机 127.0.0.1 + token 鉴权，可接受；Codex 也不支持 ask）。`updatedInput` 必须完整回显原 tool_input（宿主语义是整体替换），hook 对已存在的 `_sid` 一律覆盖——注入的唯一权威。
- **信任级别**：`_sid` 与 runId / childToken 同级，是身份提示而非安全边界（模型理论上可伪造，但 hook 每次调用都覆盖）。
- **`_aid`**：子 Agent 的 agent_id（仅 Claude Code 携带）。阶段 6 前服务端不消费，仅透传剥离，为子 Agent 流量区分预留。
- **未装 hook 时零破坏**：定位顺序里 hostSession 缺位自动落到 `Mcp-Session-Id`，行为与旧版一致。
- **安装**：手动配置片段如下；`npx aiworkflow install` 自动写入是阶段 9 的任务。

```jsonc
// Claude Code — ~/.claude/settings.json
{ "hooks": { "PreToolUse": [ { "matcher": "mcp__aiworkflow__.*",
  "hooks": [ { "type": "command", "command": "node <安装路径>/dist/cli.js hook claude-code", "timeout": 15 } ] } ] } }

// Codex — ~/.codex/hooks.json（command 型 handler，stdin 收 JSON）
{ "PreToolUse": [ { "matcher": "mcp__aiworkflow__.*",
  "hooks": [ { "type": "command", "command": "node <安装路径>/dist/cli.js hook codex", "timeout": 15 } ] } ] }
```

### 8.2 薄 Skill

Skill 只管入场：列出可用流程、确认用哪个、调 `start_run`。几十行，很少变动。

`npx aiworkflow install` 检测已安装的宿主并写入对应位置：

| 宿主 | 入场文件位置 | hook 配置（§8.1） |
|---|---|---|
| Claude Code | Skill 目录 | `~/.claude/settings.json` 的 hooks 段 |
| Codex | `~/.codex/prompts/` 自定义 prompt + AGENTS.md 片段 | `~/.codex/hooks.json` |

### 8.3 子 Agent preamble

`subagent` 节点下发时给出一段**必须原样前置、不许改写或摘要**的文本：

```
[以下三行由流程引擎提供，请原样前置，不要改写或摘要]
你是流程 run_a1b2 节点 7 派出的子任务，你的 childToken 是 c_7x2f。
调 get_current_step({childToken:"c_7x2f"}) 取你这一步要做什么。
做完调 complete_step({childToken:"c_7x2f", summary, payload?, branchId})。
[主 Agent 的补充说明写在这行之后]
```

由主 Agent 补充上下文，preamble 原样携带。子 Agent 首次调用时服务端校验 token 在白名单内，不在则自愈返回。

## 9. 编辑器与监控面板

### 9.1 编辑器

- 画布拖拽建节点、连线即分支；选中连线编辑 `condition`。六种节点以颜色 / 图标区分，右侧按 `type` 显示对应字段表单
- **技术选型：React Flow**。自定义节点、连线交互、缩放定位均现成
- **插值提示的固有限制**：输入 `{{` 时能提示的只有前序**节点 id**，`payload` 字段名运行时才知道。补法是从历史 run 中学习该节点曾出现过的字段名作候选。首次画图无提示，用过几次后有

**保存时校验分两档**，严格度对应"必然出错"与"可能出错"：

| 硬拒（不许保存） | 警告（允许保存） |
|---|---|
| 环无逃生出口 | 缺 default 分支 |
| 孤立节点（从 `entry` 不可达） / 无 `entry` | `join` 找不到对应 `fanOut` |
| 存在无法终止的路径 | 环上节点缺 `iterationLimit` |

第三条"无法终止的路径"指从 `entry` 出发存在一条走不到任何终点的路径。**注意终点有两种**：显式 `end` 节点，或按 4.3 的隐式 end（节点无分支且无后继）。两者都算合法终止，校验不得只认显式 `end`。

### 9.2 监控

**run 列表**：按项目（`cwd`）分组，进行中 / 已完成 / 失败 / 停滞分栏，显示流程名、开始时间、当前节点。

**run 详情**用快照那张图渲染：

- 节点着色：已过 / 正在跑（脉动）/ 失败 / 未走到 / 未选中的分支（虚线）
- 走过的路径高亮，**环要能看出绕了几圈**——同一节点多次执行时，侧栏按迭代次序列出每一次结果
- 点节点 → 侧栏显示该次的 `summary`、`payload`、耗时、迭代序号
- 子 Agent 按 run 树折叠展示；fan-out 的 N 个并排；**被 `max` 截断丢掉的显性列出**
- 人工卡点可直接在此回答（按钮即 `options`）
- **停滞检测**：`last_activity` 超过 **15 分钟标黄提示**（不自动做任何处理），**24 小时自动标 `stale`**。这是唯一的异常发现渠道（§8.1 的身份注入 hook 不上报任何事件），必须显眼

### 9.3 实时通道

**SSE，不用 WebSocket。** 推送是单向的（服务端 → 面板），面板的写操作（回答卡点、废弃 run）走普通 POST。少一个依赖、少一套重连逻辑。

事件：`run_started` / `step_completed` / `gate_pending` / `child_spawned` / `run_finished`

## 10. 待实测的前提

三个前提均已有一手答案（2026-09-08，官方文档 + Codex 源码 + 用户实机确认），剩余动作只是实机复核、与阶段验收合并做：

1. ~~Claude Code / Codex 的 HTTP MCP 客户端是否遵循 `Mcp-Session-Id`？~~ **两端均按 Streamable HTTP 规范携带；Codex 会话过期后重新握手会更换 id**（源码 `reinitialize_after_session_expiry`）。该风险已被 §8.1 宿主会话注入消解：身份不再依赖传输层 id 的稳定性。
2. ~~子 Agent 的调用是否复用父会话的同一 `Mcp-Session-Id`？~~ **是。** 两端子 Agent 的工具调用触发 hook 时都沿用父会话 id（Claude Code 另带 `agent_id` 区分，Codex 内部共享 `Arc<McpManager>`）。`childToken` 设计维持；hook 注入的 `_aid` 为阶段 6 提供额外区分手段。
3. ~~Codex 是否具备子 Agent 派发能力、能否并行？~~ **已确认（2026-09-08，用户实机确认）：Claude CLI 与 Codex CLI 都支持子 Agent 并行。** `subagent` 节点与 fan-out 在两个宿主上都可用，原"不能并行则降级串行"的预案不再需要。

## 11. v1 范围外

明确不做，但架构上不堵路：

- **服务端直连执行 MCP 工具节点** — 若 `tool` 节点的目标本身是 MCP 工具，服务端可作为 MCP 客户端直接执行，使该节点成为真确定性。v1 不做，`tool` 节点仍由 Agent 执行并回报
- **从项目目录加载图** — 使流程可随项目提交进 git、与同事共享
- **图的版本管理与 diff**
- **拦截类与状态注入类 hook**（身份注入除外——那是 §8.1 唯一放行的用途；deny / 审批 / 往上下文塞提醒仍然不做）

## 12. 已知局限

1. **流程是建议性的。** MCP 是拉取式协议，服务端无中断能力。Agent 跳步或脱离流程只能事后发现并自愈返回，无法阻止。这是机制层面的性质，不是待修的缺陷——设计已按此前提展开。
2. **"Agent 看不到图"是默认行为，不是安全边界。** Agent 有文件工具，可直接读 `~/.aiworkflow/flows/*.json`。该机制挡住的是"顺手读图"这一真实且高频的失效模式，而非有意为之的行为。
3. **分支判断非确定性。** 条件是自然语言、由 Agent 判断。同样输入可能选不同分支。
4. **图无法随项目共享。** 见 5.1。
5. **Codex 并行能力。** 已确认 Claude CLI 与 Codex CLI 都支持子 Agent 并行（2026-09-08，见第 10 节第 3 项），fan-out 无需按宿主降级。

## 13. 建议实现顺序

本文档覆盖的范围偏大，实现计划应分阶段推进，每阶段结束时应有可实际运行、可验证的产物：

| 阶段 | 内容 | 阶段末可验证的事 |
|---|---|---|
| 0 | 第 10 节的探针 | `Mcp-Session-Id` 行为、子 Agent 共享连接、Codex 并行能力三个前提有明确答案 |
| 1 | SQLite 层 + 图 DSL 校验 + 快照机制 | 能手写一张图 JSON、存取、校验硬拒/警告正确 |
| 2 | 执行引擎（串行：`prompt` / `tool` / `end`）+ MCP 执行类工具 + 薄 Skill | 能在 Claude Code 里真跑通一条无分支直线流程 |
| 2.5 | 宿主身份注入 hook（§8.1：PreToolUse `updatedInput` 注入 `_host`/`_sid`） | 宿主装上 hook 后，MCP 会话失效（重连换 id）也不影响盲调 get_current_step 定位 |
| 3 | 分支求值 + 环与迭代上限 + `report_blocked` | 能跑通含分支、含"测试失败回退重试"的环 |
| 4 | 监控面板（run 列表 + 详情 + SSE） | 能在浏览器里看到第 2、3 阶段的执行轨迹 |
| 5 | `gate` 节点 + 双通道回答 | 流程能挂起等人工确认，面板和聊天两条路都能放行 |
| 6 | `subagent` 节点（`inline` / `subflow` / `flowRef`）+ `join` | 能跑通单个子 Agent 的派发与汇聚 |
| 7 | fan-out 并行 + 部分失败重试 | 能跑通"按模块数派 N 个子 Agent"并正确汇聚，失败重试与标黄可见 |
| 8 | 图编辑器（React Flow） | 不写 JSON 也能建图 |
| 9 | 建图类 MCP 工具 + `npx aiworkflow install` | AI 能自己建图；安装命令能装到两个宿主 |

阶段 8 刻意排在很后面：编辑器是最耗工时但风险最低的部分，而前 7 个阶段可以靠手写图 JSON 完成验证。把不确定性高的引擎语义先跑通，避免编辑器围着一个还在变的 DSL 反复改。
