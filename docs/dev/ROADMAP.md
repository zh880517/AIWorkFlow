# 开发路线图（临时文档）

> 依据：[设计文档](../2026-09-02-flowchart-driven-agent-design.md) 第 13 节
> 性质：开发过程临时文档，全部阶段完成并验收后删除，结论回写正式文档。

## 技术栈与关键选型

| 项 | 选型 | 理由 |
|---|---|---|
| 运行时 | Node.js ≥ 20，TypeScript | `npx aiworkflow` 分发方式决定 |
| SQLite | `better-sqlite3` | 单进程独占、同步 API，与"SQLite 唯一事实源"原则匹配 |
| MCP 服务端 | `@modelcontextprotocol/sdk` Streamable HTTP 传输 | 官方 SDK，协议行为（含 `Mcp-Session-Id`）有保证 |
| HTTP 服务 | `hono` + `@hono/node-server` | 轻量、TS 原生，挂 MCP 路由 + 静态面板 + SSE 足够 |
| Web 面板 | React + **React Flow（@xyflow/react）** + Vite | 设计文档 9.1 指定；编辑器不自己造轮子 |
| 实时通道 | SSE（服务端单向推送） | 设计文档 9.3，不用 WebSocket |
| 测试 | `vitest` | — |

工程结构（随阶段演进）：

```
src/
  core/      # 纯逻辑：DSL 类型、校验、快照、存储、执行引擎（不依赖 HTTP）
  server/    # HTTP 服务：MCP 端点、面板静态资源、SSE
  cli/       # npx 入口与 install 命令
  web/       # React 面板源码（Vite 构建，产物进 dist-web/）
tests/       # core 层单测 + 端到端 API 测试
```

数据布局（运行时）：`~/.aiworkflow/`（`flows/`、`aiworkflow.db`、`cache/`），测试用 `AIWORKFLOW_HOME` 环境变量重定向。

## 阶段 0 — 前提探针（手动验证，代码不留）

设计文档第 10 节的三个前提，需要在 Phase 2 末尾用真实宿主验证（服务端起来之后才能测）：

- [x] P0-1 Claude Code 的 HTTP MCP 客户端是否携带 `Mcp-Session-Id`；同会话是否稳定；重连是否更换 → **文档级答案（2026-09-08）**：两端均按 Streamable HTTP 规范携带；**Codex 会话过期后重新握手会换 id**（源码 `reinitialize_after_session_expiry`）。已被阶段 2.5 的宿主会话注入消解为非阻塞项——身份不再依赖传输层 id 稳定性。实机观察留验收
- [x] P0-2 子 Agent（Task 调用）是否复用父会话的同一 `Mcp-Session-Id` → **文档级答案：是**。两端子 Agent 的工具调用触发 hook 时都沿用父会话 id（Claude Code 另带 `agent_id` 区分；Codex 内部共享 `Arc<McpManager>`）。childToken 设计维持；hook 的 `_aid` 为阶段 6 提供额外区分手段。实机观察留验收
- [x] P0-3 Codex 是否具备子 Agent 派发/并行能力 → **是**（2026-09-08 用户实机确认：Claude CLI 与 Codex CLI 都支持子 Agent 并行；fan-out 无需降级，文档 §10.3 / §12.5 已同步更新）

方法：临时在 MCP 端点打请求日志，宿主里跑最小流程观察。结论记入本文件，验证代码删除。
影响：三项均有答案且均不改变现设计；剩余动作只是实机复核（与阶段 2/2.5 验收合并做）。

## 阶段 1 — SQLite 层 + 图 DSL 校验 + 快照机制 ✅

| 任务 | 状态 |
|---|---|
| npm 工程初始化（TS、vitest、目录结构） | ✅ |
| `core/types.ts`：六种节点 DSL 类型定义 | ✅ |
| `core/validate.ts`：硬拒/警告两档校验（含环、可达性、终止性分析） | ✅ |
| `core/db.ts`：SQLite 建表（runs / flow_snapshots / node_executions / gate_decisions） | ✅ |
| `core/flowStore.ts`：flow JSON 存取（SQLite 事实源 + ~/.aiworkflow/flows 派生镜像） | ✅ |
| `core/snapshot.ts`：copy-on-run 快照（含 flowRef 递归解析、内容 hash 去重） | ✅ |
| 单测覆盖：校验规则、存取、快照去重 | ✅ |

**验收**：手写一张图 JSON → 存取往返一致；校验器对设计文档 9.1 的硬拒/警告清单逐条正确判定。

## 阶段 2 — 执行引擎（串行）+ MCP 执行类工具 + 薄 Skill ✅

| 任务 | 状态 |
|---|---|
| `core/engine.ts`：start_run / get_current_step / complete_step（单事务推进） | ✅ |
| 插值渲染 `{{nodeId.payload.field}}`（服务端渲染后下发；引用缺失保留原 token） | ✅ |
| `{{…}}` 下发时剥离 `to`、progress 不含总数、响应复述 runId+nodeId | ✅ |
| 自愈式报错（三段式：错在哪 + 正确姿势 + 当前这一步） | ✅ |
| HTTP 服务：MCP Streamable HTTP 端点（token 鉴权、绑 127.0.0.1、Mcp-Session-Id 会话绑定 run） | ✅ |
| CLI 入口 `npx aiworkflow`（生成 token、打印面板/MCP/API 三个 URL） | ✅ |
| 薄 Skill 文件（入场：list_flows → start_run；纪律文本由服务端下发，Skill 刻意不重复） | ✅ |
| 执行阶段 0 探针 | ⬜（需真实宿主 Claude Code / Codex，与验收一并做） |

**验收**：✅（2026-09-03）SDK MCP 客户端对真实服务走 Streamable HTTP 全链路：initialize 建会话 → list_flows → start_run（纪律文本 + 第一步）→ complete_step（payload 插值服务端渲染）→ get_current_step 幂等且靠 Mcp-Session-Id 会话绑定定位 → 终结 + 结束后查询返回终结态。直线流程 prompt → tool → end 跑通；非法 branchId 三段式自愈且不落库（事务回滚）。Claude Code 宿主内的实机复验并入阶段 0 探针一起做。

## 阶段 2.5 — 宿主身份注入 hook ✅

> 背景：Codex 源码证实 `Mcp-Session-Id` 在会话过期重握手后会更换，传输层 id 不可作唯一锚点（P0-1 风险坐实）。两端宿主的 PreToolUse hook 都支持 `allow + updatedInput` 改写 MCP 工具入参，且载荷公共字段带稳定的会话级 `session_id`。设计文档 §8.1 已同步修订（原"不使用任何 hook"收窄为"仅允许身份注入"）。

| 任务 | 状态 |
|---|---|
| `src/hook.ts`：buildHookOutput / runHook（纯 stdin→stdout，永不 deny，失败静默 exit 0） | ✅ |
| CLI 子命令 `aiworkflow hook <claude-code\|codex>`（在服务副作用之前分派） | ✅ |
| db migration v2：`runs.host_session` + 索引（真实 v1 库升级实测通过） | ✅ |
| 引擎定位顺序：childToken → runId → **hostSession（"<host>:<sid>"）** → mcpSessionId 兜底 | ✅ |
| MCP 工具 schema：`_host/_sid/_aid` 注入字段（剥离后组装 hostSession；_aid 阶段 6 前不消费） | ✅ |
| 测试：hook 6 条（两宿主载荷形态/伪造覆盖/静默）+ 引擎 6 条（持久化/定位/优先级/回落/终结态/跨 MCP 会话推进）+ MCP 端到端 1 条（新客户端新 Mcp-Session-Id 仅靠注入身份盲调） | ✅ |

**验收**：✅（2026-09-08，自动化层面）typecheck + 118 测试全绿；`aiworkflow hook` 子命令真机冒烟（注入/坏 JSON 静默/非 PreToolUse 静默/缺参用法）；v1→v2 迁移在真实旧库上验证（user_version 1→2、数据完好、host_session 可查）。**实机确认**（真装 hook 到两宿主里盲调）并入阶段 0 实机验证。手动配置片段见设计文档 §8.1；`install` 自动写入留阶段 9。

## 阶段 3 — 分支求值 + 环与迭代上限 + report_blocked ✅

| 任务 | 状态 |
|---|---|
| 分支求值五种边界（设计文档 7.3）：非法 branchId 自愈、default、无 default 判失败 | ✅（"多条件都满足"是协议性质——Agent 只回一个 id、服务端不裁决，无代码量；其余四边全落地） |
| `iterationLimit`（挂在 run_id+node_id）+ `onLimitExceeded` 逃生 | ✅（撞上限不执行该节点，落 `limit_exceeded` 轨迹，逃生链成环防御性判败；逃生发生时响应带 note 解释跳变） |
| `maxSteps` 全局兜底 | ✅（默认 200，第 N+1 步不再执行、run 判失败；complete_step 与 report_blocked 共用此守卫） |
| `report_blocked` 三级出口规则（7.8） | ✅（onLimitExceeded → default 分支 → 判失败；落 `blocked` 轨迹；不做自动重试） |
| 插值只取 `completed` 轨迹 | ✅（blocked / limit_exceeded 不带产物，不得遮蔽此前真实执行的 payload） |

**验收**：✅（2026-09-08）129 测试全绿；真实 HTTP MCP 服务上 11 项断言全过——回退环两轮失败且环内插值用最新 payload、第三次进"跑测试"撞 iterationLimit 落 limit_exceeded 轨迹并经 onLimitExceeded 终结为 fail（note 解释逃生）、report_blocked 无出口判失败且 note 带原因、全过分支正常终结、终结后再提交返回终结态。

## 阶段 4 — 监控面板（React Flow 只读渲染 + SSE）✅

| 任务 | 状态 |
|---|---|
| 面板脚手架（Vite + React + React Flow） | ✅（阶段 8 编辑器时已就位） |
| run 列表：按 cwd 分组分栏（进行中/已完成/失败/停滞） | ✅（completed 按终点 outcome 分入已完成/失败栏；outcome 落库 db v3，旧数据读取时从快照终点推导） |
| run 详情：快照图渲染、节点着色、路径高亮、迭代次序列表 | ✅（`#/runs/:id`；只读画布 RunFlowCanvas：已过/正在跑脉动/失败/未走对着色、走过实线未走虚线、×N 迭代角标、逃生边；侧栏逐次列出每次执行含分支选择与 payload） |
| SSE：run_started / step_completed / gate_pending / child_spawned / run_finished | ✅（`/api/events`；引擎 onEvent 回调 → 事件总线 → streamSSE，事件当"该刷新了"信号，面板重拉；gate_pending/child_spawned 留待阶段 5/6 产生事件时验证通道已就绪） |
| 停滞检测 | ❌（2026-09-08 用户决定移除：AI 执行中长时间暂停是常态，不按超时判异常；曾实现 15 分钟标黄 + 24h sweepStale 后撤销，设计文档 §9.2 已记） |
| 列表分页与排序（2026-09-08 用户补充） | ✅（每目录默认显示最近活动的 10 条，可切换按最近活动/开始时间排序，可展开全部） |

**验收**：✅（2026-09-08，144 测试 + 真实服务实测 + 浏览器 GUI 验证）SSE 实测收到 hello → run_started → step_completed(completed/blocked) → run_finished(fail) 全序列；浏览器验证：列表页 cwd 分组×4 栏、15 分钟标黄角标、SSE 新 run 实时出现；详情页 9 步环回退 run 轨迹逐次列出（含第 4 次超限逃生），画布 5 节点着色（跑测试节点红、×4 角标）、走过 4 边高亮（含逃生边）、未走分支虚线。修过两个真 bug：自定义节点缺 Handle 边不渲染、受控模式需回灌 measured。

**2026-09-08 修正（commit 580984a，应用户要求）**：详情画布改用**编辑器同款节点卡**（FlowNodeCard 含出口/条件完整视觉），运行状态作为外圈叠加层（状态环/脉动/×N 角标），只读但**节点可拖动摆放**（位置存内存）。顺带修掉一个波及预览页的真 bug：normalizeOutlets 把 API/手写图的第一个普通分支错当默认兜底显示。画布改完全非受控（defaultNodes + key 重挂）消除边渲染竞态。**环境注意**：IAB 长时间使用的标签页会进入"div 照画、SVG 边不渲染"的降级态（编辑器预览页同样复现），换新标签页即恢复——排查 React Flow 边消失先换标签页再怀疑代码。

## 阶段 5 — gate 节点 + 双通道回答 ✅

| 任务 | 状态 |
|---|---|
| gate 挂起（waiting_gate + pending gate_decisions）+ await_gate 长轮询（60s） | ✅（进入 gate 即挂起并写 pending 决策行；入口即 gate 同样处理；await_gate 轮询 400ms、60 秒到点返回"仍在等待，请再调一次"，已放行/已不在卡点直接返回当前状态） |
| 面板点选（source: panel）+ answer_gate 代填（source: chat） | ✅（决策记 gate_decisions 含来源，同时落一条 completed 轨迹（payload 带选项/来源）供插值与回看；gate 步只发 gateId/question/options，不下发 branches——选项即出口，降噪） |
| 面板写操作走普通 POST | ✅（`POST /api/runs/:id/gate`，token 鉴权同 /api/*；详情 API 带 pendingGate（问题+选项）与 gates 历史；SSE 加 gate_pending 事件） |

**验收**：✅（2026-09-09，161 测试 + 真实服务实测 + 浏览器 GUI 验证）引擎 18 条 gate 用例（挂起/双通道/非法选项自愈/重复作答自愈/await 超时与唤醒/入口卡点/未连线选项判失败/裸卡点隐式收尾/事件序列）；MCP 端到端：推进到卡点 → await_gate 挂起 → 面板 HTTP 放行 → await 醒来拿到下一步；面板 GUI：等确认卡片（问题+备注+选项）点选放行，状态切回进行中，轨迹显示"人工确认：发布（面板点选）· 走了「发布」"。实测抓到一个真 bug：放行推进到普通节点时没把 status 从 waiting_gate 拨回 running（run 卡死在挂起态），已修并加回归用例。

## 阶段 6 — subagent 节点 + join ✅

| 任务 | 状态 |
|---|---|
| run 树（parent_run_id / root_run_id）、childToken 签发与白名单校验 | ✅（child run 落库带 parent_run_id/root_run_id/parent_node（db v4）/child_token（`c_` 前缀，UNIQUE 即白名单）；resolveRun 以 childToken 为第一优先级；事件 child_spawned） |
| preamble 下发（必须原样前置的三行块） | ✅（§8.3 原文；派发步 children[] = { childToken, preamble, extraPrompt }，extraPrompt 用主 run 产物插值渲染后下发） |
| inline / subflow / flowRef 三种 mode（flowRef 递归快照已在 Phase 1 预留） | ✅（inline 合成单节点图、subflow 走内嵌子图、flowRef 从父快照切子快照——buildSubSnapshot 不回读当前库，child 与主 run 钉同一版本；快照收集器补了下钻 subflow 内嵌套 flowRef） |
| join 汇聚语义（7.5）：全部完成 / 有 running 置 failed / 失败重派一轮 | ✅（主 Agent 在派发步（waiting_children）调 get_current_step 触发汇聚：未终结 child 判"未回报"置 failed；失败的原始 child 重派一轮（新 child run + retry_of 指向旧 run，旧 run 留档）；再失败带部分结果推进 join 并在 note/汇总里记明缺了谁；join 步 childResults + aggregateInstruction + 各子结果摘要） |

**验收**：✅（2026-09-09，174 测试 + 真实服务双 MCP 会话实测 + 面板验证）单测覆盖三种 mode、未回报重派、重派再失败部分推进、child report_blocked 置 failed、派发步自愈守卫、入口即派发；真实服务：主/子两个独立 MCP 会话（不同 Mcp-Session-Id）凭 childToken 走完 派发→子任务→汇聚 join→终结，及"子任务未回报→判 failed→自动重派→重派成功→join 采用新结果"全链路；面板任务列表子 run 带 ↳ 标记、run 树状态（waiting_children / running / failed）正确。实测抓到一个真 bug：child 的 extraPrompt 插值在主 run 轨迹提交前渲染导致取不到产物——改为"先推进提交、再建 child"，并把崩溃窗口（推进已提交但 child 未落库）做成汇聚时惰性补建。

## 阶段 7 — fan-out 并行 + 部分失败重试

| 任务 | 状态 |
|---|---|
| fanOut（from 插值 / 固定 N）+ max 截断显性记录被丢弃项 | ⬜ |
| 派发时先建 N 个 child run 再返回 children[] | ⬜ |
| 重试一轮后仍失败 → 带部分结果推进 join，面板标黄 | ⬜ |

**验收**："按模块数派 N 个子 Agent"正确汇聚；截断与失败在面板显性可见。

## 阶段 8 — 图编辑器（React Flow）

> **注：应用户要求提前实现**（原计划排在阶段 2–7 之后）。核心编辑/预览能力已完成并通过浏览器 GUI 实测（2026-09-02）；剩余的插值提示依赖历史 run 数据，仍留在原阶段位次。

| 任务 | 状态 |
|---|---|
| 面板脚手架（Vite + React + React Flow + hono API + token） | ✅ |
| 画布建节点（点击/拖入）、连线即分支、选中连线编辑 condition | ✅ |
| 节点自定义出口：出口增删直接在节点卡片上操作（行式布局，参考 VisualBridge），一个出口一条线；UI 不暴露内部 id 与原始 JSON（参数键值对编辑、下拉显示标题） | ✅ |
| 六种节点自定义渲染（颜色/图标）+ 右侧按 type 的字段表单 | ✅ |
| 保存时两档校验（复用 Phase 1 校验器，硬拒阻止保存；面板实时校验 + 问题定位跳转） | ✅ |
| 预览模式（只读渲染 + 单步下发视图，含 branches 剥离 `to` 的降噪形态） | ✅ |
| `{{` 插值提示：前序节点 id + 历史 run 学到的 payload 字段名 | ⬜（依赖阶段 2 的 run 数据） |

**验收**：✅ 不写 JSON 建出含双分支的测试图并保存成功（服务端数据、列表加载回显均验证通过）。

实测中发现并修复的问题：
- 目标侧 Handle 被 `.fn-header/.fn-body` 覆盖导致连线无法落到目标点 → Handle 加 `z-index: 10`
- 新节点全部落在画布中心互相叠压 → 按网格错开 + 添加后自动 fitView

## 阶段 9 — 建图类 MCP 工具 + npx aiworkflow install

| 任务 | 状态 |
|---|---|
| list_flows / get_flow / create_flow / update_flow / validate_flow | ✅（2026-09-08 应用户要求提前实现，挂独立端点 `/mcp-build`，与执行端点 `/mcp` 工具集互不可见；create/update 幂等指引、validate 干跑不落库、硬拒不落库，137 测试 + 真实服务实测） |
| install 命令：检测宿主（Claude Code Skill 目录 / Codex prompts+AGENTS.md + hook 配置） | ⬜ |

**验收**：建图五件套 ✅（SDK 客户端建图/改图/干跑/坏图自愈全链路实测）；install 待做。

## 通用规约

- 每阶段结束跑全量测试 + 用真实流程验收，通过后在本文件勾选并提交。
- 面板一律用 React Flow，不自研画布；服务端不引第二个 HTTP 框架。
- 所有写入先 SQLite 后派生文件（JSON/缓存），永不只写 JSON。
- 阶段 0 探针代码不留仓库，结论写在本文件。
