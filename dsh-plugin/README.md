# @aiworkflow/dsh-plugin

只提供给 DeepSeek Harness 使用的 aiworkflow 界面。**不接入**仓库里已有的 `src/web` 面板，也不要求先起 `npx aiworkflow` 服务：
Host 半用 `node:sqlite` 直接打开 `~/.aiworkflow/aiworkflow.db`（缺库会建库并跑主工程同一份迁移），
执行引擎也复用主工程 `core/engine`（构建时内联），因此 DSH 里既能画图、也能真跑流程。

## 三块界面

1. **可视化工作流页（全局主面板）**：左侧栏的「可视化工作流」图标进入。流程库（列出 / 新建 / 删除）→ 画布编辑器：
   React Flow 直接跑在宿主里；拖拽定位、右侧圆点拖线连边、右侧属性面板按节点类型编辑
   （指令 / 工具名 / 子 Agent 模式 / 卡点问题与选项 / 汇聚指令 / 结束结果）、设置入口、保存前跑主工程同一套 `validateFlow`。
   多路出边自动转成 `branches`，第一路填 `*` 表示默认分支。
2. **运行图浮层（会话内，只读）**：默认不打开；在浮动进度面板（浮窗）里点「运行图」打开，右上角 × 或 Esc 关闭。
   顶部切 run，中间是这次 run 的快照图：
   节点按执行状态着色（已完成 / 进行中 / 等子 Agent / 阻塞 / 未走到），走过的边高亮、没走的虚线；
   点节点只看它的执行记录，右侧栏是轨迹（序号、`#迭代`、分支条件、时间、summary）与 payload。
   与编辑器共用 `canvasOf` 的布局语义，但拖拽/连线/删除全部关闭——这里只预览，不改图。
3. **进度视图（会话内）**：标题栏胶囊 + 右侧浮动面板，见下。

## 发起一次运行

不用记流程图名字，也不用发聊天消息：输入框左侧有一个「工作流」按钮，点开列出全部图，选一张即可。

- 选中即调 Host 的 `POST /aiworkflow/runs` **直接建 run**（不产生聊天消息，避免误触发）；
- run 绑到当前会话（`dsh:<sessionId>`），Agent 的 `complete_step` 才能定位到它；
- Host 用与定时提醒相同的 `followup` 机制唤醒 Agent，让它在对话里开始执行第一步；
- 建 run 之前，标题栏不出现状态胶囊、会话里也没有「运行图」页签；建好之后两者才出现。

## 进度视图的交互设计

标题栏一颗胶囊（`[●] 订单流程 · 校验库存 · 3 步`），点开是右侧浮动面板：

- **当前步骤**：节点标题、节点类型、指令/问题、已走步数、用时、开始时间；
- **卡点**：未决 gate 的问题与选项（只读提示，确认仍在 aiworkflow 面板里做）；
- **已走路径**：横向路径条，连续重复节点合并为 `×n`（环的圈数）；
- **执行轨迹**：最近若干步，点一下展开 payload（大 payload 由 Host 截断）。
- 顶部可切换 run（活跃优先，其后是最近结束的）。

刻意不画整张流程图：窄栏里"当下这一步 + 走过的路"比缩略图更可读，整图仍由 aiworkflow 自己的面板负责。

## Agent 工具（替代原 MCP 端点）

Host 半在 `ctx.tools` 上注册 8 个工具，和面板改的是同一份 SQLite，不需要另起 `npx aiworkflow` 服务。
名字比原 MCP 多了 `aiworkflow_` 前缀，语义一一对应：

| 工具 | 对应 MCP | 作用 |
|---|---|---|
| `aiworkflow_context` | —（新增） | 当前 DSH 会话 id、工作目录、数据库路径、流程数、进行中/最近 run 数。只读 |
| `aiworkflow_flow` | 建图五件套 | `action` = `list` / `get` / `validate` / `create` / `update` |
| `aiworkflow_start_run` | `start_run` | 按流程名建 run，返回纪律文本 + 第一步 |
| `aiworkflow_get_current_step` | `get_current_step` | 幂等取"我在哪、要干啥" |
| `aiworkflow_complete_step` | `complete_step` | 回报本步 + 领取下一步（有分支必须给 `branchId`） |
| `aiworkflow_report_blocked` | `report_blocked` | 如实上报卡住，按画好的逃生出口推进 |
| `aiworkflow_await_gate` | `await_gate` | 长轮询等人工卡点（每轮 60 秒） |
| `aiworkflow_answer_gate` | `answer_gate` | 用户在对话里答复后代填（记 `source: chat`） |

两个差异值得注意：

- **会话身份**：原 MCP 靠宿主 hook 往入参注入 `_host`/`_sid`；这里直接取工具执行上下文里的 `exec.agent.id`，写成 `dsh:<sessionId>` 存进 `runs.host_session`，`get_current_step` / `complete_step` 不需要再传 `runId`。
- **执行引擎**：`aiworkflow_run` 直接调用主工程 `ExecutionEngine`（`src/core/engine.ts`，构建时内联），所以 run 的推进、快照、卡点、子 Agent 派发语义与 CLI 完全一致，没有第二套实现。快照仍写 `flow_snapshots` 与 `cache/`。

原先“建图五件套”（`list_flows` / `get_flow` / `validate_flow` / `create_flow` / `update_flow`）合并进了 `aiworkflow_flow` 的 `action` 参数：模型侧少背 4 个 schema，行为不变。

**报错一律三段式**（错在哪 + 正确姿势 + 当前这一步），与 CLI 端一致；校验不通过时原图不动。

## 目录

```
shared/src/          公用层（主工程与插件共享的契约与纯逻辑）
  types.ts           DSL 类型的只读视图（type-only 再导出 src/core/types.ts）
  runTypes.ts        run 只读 DTO
  sql.ts             只读 SQL：listRuns / getRunDetail / readMonitorState
  progress.ts        进度语义：phase、路径合并、执行色调
  format.ts          相对时间、时长
dsh-plugin/
  src/host.ts        Host 半：ctx.webServer 同源路由（进度读取 + 图读写）
  src/db.ts          数据目录与单条 SQLite 连接（路由与工具共用）
  src/sqlite.ts      node:sqlite → 引擎要的数据库形状（补 BEGIN/SAVEPOINT 事务）
  src/engine.ts      执行引擎接线（复用主工程 core/engine）
  src/tools.ts       Agent 工具：context / flow / 6 个执行类
  src/client.tsx     Client 半入口：注册胶囊 / 浮动面板 / 工作流主面板 / 运行图浮层
  src/runview/       运行图：只读画布（节点状态着色 + 走过的边）+ 轨迹栏 + 浮层壳
  src/pill.tsx       标题栏胶囊（conversation.session.header.utilities）
  src/panel.tsx      浮动面板（shell.overlay）
  src/store.ts       轮询 store（打开 2s / 收起 6s，页面隐藏时暂停）
  src/i18n.ts        文案注册（zh / en）
  src/styles.tsx     仅用 --dsw-alias-* 主题 token 的样式
  build.mjs          构建：index.js（Node ESM）+ client.js（宿主 lazy-CJS factory）
```

## 构建 / 安装

```bash
node dsh-plugin/build.mjs        # 或 npm run build:plugin
```

然后用 `plugin_manager` 的 `install_bundle` 指向本目录绝对路径安装；安装是 profile 级的，对所有 session 生效。
修改 Host 半（`index.js`）后需要让该条目重新加载：`plugin_manager` 先 `set_plugin` 关掉再打开即可；
只改 Client 半（`client.js`）时，宿主 HMR 会自己换新模块。

## 边界

- 写 SQLite 的只有三处：图的 create/update（走主工程同款校验）、`start_run`/`complete_step` 等执行类工具（走主工程 `ExecutionEngine`）、以及建库时的迁移。进度视图本身只读。
- 人工卡点只能由用户放行：`answer_gate` 仅用于**转达用户已经说出口的答复**（`source: chat`），面板点选仍是 `source: panel`；插件不会自己替用户做选择。
- 依赖 DSH 的 `webServer` 与 `tools` 服务（`inject: ['webServer', 'tools']`），缺少任一服务的组合里 Host 半不激活。
- 页面必须与宿主同源（`dsh web` 或桌面版内置的 Web 视图）；`file://` 载入的渲染器拿不到这个路由。
- `better-sqlite3` 不需要：DSH 内核本身就用 `node:sqlite`，插件沿用同一个驱动，避开原生 ABI 问题。
