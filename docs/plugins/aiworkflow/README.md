# AI 工作流（aiworkflow）

**把「这件事该怎么做」画成流程图，Agent 一次只领一步。**

它解决的不是「Agent 不听话」，而是「一次把几千字流程灌进去，它就不专注了」。流程图在这里的作用是描述
**何时披露什么**，而不是当笼子。Agent 每领一步 → 做完回报 `summary`/`payload` → 再领下一步。

这是本仓库的第一个 DSH 插件，包目录 [`plugins/aiworkflow/`](../../../plugins/aiworkflow/)。
不依赖独立服务，也不支持其它 Agent 客户端：Host 半用 `node:sqlite` 直接打开 `~/.aiworkflow/aiworkflow.db`，
执行引擎复用 `shared/src/` 的同一份实现（构建时内联）。

---

## 安装

构建产物 `index.js`、`client.js` 已随仓库提交，安装时不需要 clone、不需要在本机构建。

**DSH 侧栏 Plugins → Add plugin**，粘贴：

```
git+https://github.com/zh880517/dsh_plugins.git#main&path:/plugins/aiworkflow
```

- `#main` 跟随主分支；要固定版本就换成 commit（只能钉在包含构建产物的提交上，用 `git log --oneline -- plugins/aiworkflow/index.js` 查）；
- `&path:/plugins/aiworkflow` 指定包在仓库子目录里（一个仓库可以有多个插件，每个一条 spec）；
- 装完自动加入 profile 的 bundle 列表并启用，重开 DSH 生效。

也可以让 Agent 代装：`plugin_manager` 的 `install_bundle`，`target` 填同一串。

启用了插件市场（Discover）实验 bundle 后，可以加索引来源，然后在市场里搜 aiworkflow 直接装：

```
https://raw.githubusercontent.com/zh880517/dsh_plugins/main/market/index.json
```

升级没有原地升级：重新安装新的 commit（或先 Remove 再装）。本地开发时 `npm run build` 后填本机绝对路径
（例如 `D:/path/to/dsh_plugins/plugins/aiworkflow`），改完重新构建再让条目重新加载。

装好之后：

- 侧栏出现「可视化工作流」，进去是流程库 + 画布编辑器；
- 对话输入框左侧的「工作流」按钮列出可启动的主流程（`kind=flow`；子 Agent 配置不出现，它只能被主流程引用），
  选一张就直接建 run（不经过输入框、不产生用户消息；Host 会用 `followup` 注入一条唤醒 Agent 的系统消息）；
- 跑起来后标题栏出现胶囊，点开是进度面板；面板里可以打开「运行图」或「放弃」当前 run。

---

## 能做什么

### 画：可视化流程编辑器

- React Flow 画布：拖拽定位、从节点出口拖线连边、右键菜单、复制粘贴、撤销重做；
- 六种节点：`prompt` 指令、`tool` 工具、`subagent` 子 Agent、`gate` 人工卡点、`join` 汇聚、`end` 结束；
- 卡点**一个选项一个出口**：没连线的出口名字挂在节点右侧，可以从它拖线（或点名字再点目标节点）；
- 属性面板按「头部概览 → 核心字段 → 折叠的高级设置」分层，角色/线程/产物/回路等在头部 chip 直接可读；
- 流程库分「流程 / 子 Agent 配置」：子 Agent 配置可保存自己的角色表和子图，用同一画布创建/编辑，供主流程引用；
- 改动后实时校验：页头显示「校验通过 / 几条警告 / 几处硬拒」，点条目直接定位到节点；
- 保存前跑与 Agent 工具完全相同的 `validateFlow`，不通过不会写库，原图保持不变。

### 跑：把流程交给 Agent 执行

- **逐步披露**：每次只下发当前节点的指令和当前岔路口的条件，图结构不下发；
- **分支用自然语言**：Agent 自己判断该走哪条；`*` 表示默认分支；
- **数据传递**：`complete_step` 回报 `summary`（给人看）+ `payload`（给机器用），后续节点可用 `{{节点.payload.字段}}` 插值；
- **子 Agent**：`inline` / `subflow` / `flowRef` 三种模式；`flowRef` 可以引用一张主流程，也可以引用「子 Agent 配置」（带自己的角色表和子图）；支持 `fanOut`（按数组或固定数量并行）与 `join` 汇总；
- **人工卡点**：run 挂起等人；用户在对话里答复，Agent 用 `answer_gate` 代填（`source: chat`）后继续；
- **循环可控**：节点级 `iterationLimit` + 回路级 `maxRounds`，撞上限可跳到逃生节点，也可以直接判失败。

### 看：进度与运行图

- 标题栏状态胶囊 + 浮动面板（当前步、卡点、已走路径、执行轨迹、payload）；
- 只读运行图：节点按状态着色、走过的边高亮、点节点看这一步的记录；
- 所有 run 落 SQLite，切换会话/重开面板都能按 `dsh:<sessionId>` 找回当时的快照与轨迹。

---

## 设计思想

1. **管理注意力预算，而不是约束 Agent**：唯一硬性要求是「每步做完必须回报」，否则链条断裂；节点执行中 Agent 想多读文件、多跑命令，完全放开。
2. **图结构对 Agent 隐藏，是降噪而不是保密**：拓扑对完成当前这步没有用，给了只会稀释注意力。
3. **SQLite 是唯一事实源**：`~/.aiworkflow/flows/*.json`、`cache/` 都是派生镜像，删掉不影响运行；任何写入先落库。
4. **run 对着快照跑（copy-on-run）**：启动时序列化快照，`flowRef` 递归解析；之后再改图不影响进行中的 run。
5. **报错必须自愈**：执行类工具与校验拒绝都返回「错在哪 + 正确姿势 + 当前这一步」三段式，一次往返就能修好。
6. **人类卡点只能人类放行**：插件不会替用户做选择；`answer_gate` 只用于转达用户已经说出口的答复。
7. **不静默截断**：fan-out 超出 `max`、子 Agent 失败后放弃，都会在面板上显性列出。

完整架构、数据流与关键流程图见 [design.md](./design.md)。

---

## 三块界面

1. **可视化工作流页（全局主面板）**：左侧栏的「可视化工作流」图标进入。流程库（列出 / 新建 / 删除）→ 画布编辑器：
   React Flow 直接跑在宿主里；拖拽定位、右侧圆点拖线连边、右键菜单（建节点 / 复制 / 粘贴 / 删除 / 设为入口）、
   撤销重做、右侧属性面板按节点类型编辑（指令 / 工具名与参数 / 子 Agent 模式与 fan-out / 卡点问题与选项 /
   汇聚与 waitFor / 迭代上限与逃生出口 / 结束结果 / 补充说明）、设置入口。
   改动后防抖干跑同一套 `validateFlow`（页头 chip + 问题定位），插值提示从历史 run 学 payload 字段；
   多路出边自动转成 `branches`，第一路填 `*` 表示默认分支，卡点出边可显式绑定选项。
2. **运行图（会话内，只读）**：浮动进度面板里点「运行图」打开浮层；本会话有 run 时对话区还会出现「运行图」页签。
   顶部切 run，中间是这次 run 的快照图：节点按执行状态着色，走过的边高亮、没走的虚线；点节点看它的执行记录，
   右侧栏是轨迹（序号、`#迭代`、分支条件、时间、summary）与 payload；子 Agent 的 child run 收在「子运行」卡片里。
3. **进度视图（会话内）**：标题栏胶囊 + 右侧浮动面板；进行中的 run 可在面板头部点「放弃」
   （`POST /aiworkflow/runs/abandon`），把 root 与未终结的 child 一起置为 failed。

界面实现细节与踩过的坑见 [editor.md](./editor.md)。

---

## 发起一次运行

输入框左侧的「工作流」按钮列出**可启动的主流程**，选一张即可。子 Agent 配置（`kind = 'agent'`）不会出现在这个列表里——它没有独立启动的语义，只能被主流程的 `subagent` 节点按 id 引用（见设计文档 §4.6）。

- 选中即调 Host 的 `POST /aiworkflow/runs` **直接建 run**（不经过输入框发送用户消息，避免误触发）；
- run 绑到当前会话（`dsh:<sessionId>`），Agent 的 `complete_step` 才能定位到它；
- Host 用与定时提醒相同的 `followup` 机制注入一条唤醒消息，让 Agent 在对话里开始执行第一步；
- 同一会话同时只允许一个活跃 run：已有 `running/waiting_*` 的 run 时，再启动会被自愈拒绝；
- 建 run 之前，标题栏不出现状态胶囊、会话里也没有「运行图」页签；建好之后两者才出现。

---

## 进度视图的交互设计

标题栏一颗胶囊（`[●] 订单流程 · 校验库存 · 3 步`），点开是右侧浮动面板：

- **当前步骤**：节点标题、节点类型、指令/问题、已走步数、用时、开始时间；
- **卡点**：未决 gate 的问题与选项（只读提示；在对话里回复选项，Agent 会代填）；
- **已走路径**：横向路径条，连续重复节点合并为 `×n`（环的圈数）；
- **执行轨迹**：最近若干步，点一下展开 payload（大 payload 由 Host 截断）；
- 顶部可切换 run（活跃优先，其后是最近结束的）。

刻意不画整张流程图：窄栏里「当下这一步 + 走过的路」比缩略图更可读，整图由「可视化工作流」里的编辑器负责。

---

## Agent 工具

Host 半在 `ctx.tools` 上注册 8 个工具，和面板改的是同一份 SQLite：

| 工具 | 作用 |
|---|---|
| `aiworkflow_context` | 当前 DSH 会话 id、工作目录、数据库路径、流程数、进行中/最近 run 数。只读 |
| `aiworkflow_flow` | 建图：`action` = `list` / `get` / `validate` / `create` / `update` |
| `aiworkflow_start_run` | 按流程名建 run，返回纪律文本 + 第一步 |
| `aiworkflow_get_current_step` | 幂等取"我在哪、要干啥" |
| `aiworkflow_complete_step` | 回报本步 + 领取下一步（有分支必须给 `branchId`） |
| `aiworkflow_report_blocked` | 如实上报卡住，按画好的逃生出口推进 |
| `aiworkflow_await_gate` | 长轮询等人工卡点（每轮 60 秒） |
| `aiworkflow_answer_gate` | 用户在对话里答复后代填（记 `source: chat`） |

两个关键点：

- **会话身份**：直接取工具执行上下文里的 `exec.agent.id`，写成 `dsh:<sessionId>` 存进 `runs.host_session`，`get_current_step` / `complete_step` 不需要再传 `runId`。
- **执行引擎**：直接调用公用层的 `ExecutionEngine`（`shared/src/engine.ts`，构建时内联），run 的推进、快照、卡点、子 Agent 派发语义只有一套实现。

建图五件套（`list` / `get` / `validate` / `create` / `update`）合并进了 `aiworkflow_flow` 的 `action` 参数：模型侧少背 4 个 schema，行为不变。
**报错一律三段式**（错在哪 + 正确姿势 + 当前这一步）；校验不通过时原图不动。

---

## 数据与权限

- 数据目录固定 `~/.aiworkflow/`，数据库 `~/.aiworkflow/aiworkflow.db`；首次使用自动建库并跑迁移。测试用环境变量 `AIWORKFLOW_HOME` 重定向到临时目录。
- Host 半注册 `ctx.webServer` 的 `/aiworkflow` 前缀路由，与宿主同源；不另起端口、不要 token。
- 写 SQLite 的只有三处：图的 create/update（走公用层校验）、`start_run`/`complete_step` 等执行类工具（走 `ExecutionEngine`）、以及建库时的迁移。进度视图本身只读。
- 人工卡点只能由用户放行：`answer_gate` 仅用于**转达用户已经说出口的答复**（`source: chat`）；面板只展示待决卡点，不提供点选。

---

## 开发

```bash
npm install
npm run typecheck                 # shared + 所有插件
npm test                          # vitest（tests/aiworkflow/）
npm run build                     # 生成 plugins/*/index.js 与 client.js（产物要提交）
npm run build -- --only aiworkflow
npm run check:plugin              # 重建并与暂存区比对（源码需先 git add）
npm run release:plugin -- --only aiworkflow   # 构建 → 提交 → 刷新市场索引 → 打印安装链接
```

产物必须提交：pnpm 11 默认拦下 git 依赖的 `prepare` 脚本，仓库里带产物才是零构建、零脚本；代价是可能忘提交/过期，`check:plugin` 负责抓。

装到本机 profile 后，改 Host 半需要让条目重新加载（`plugin_manager` 先关再开）；改 Client 半需要重新 `npm run build` 并重载条目——只有 `pnpm run dev:web` 在跑时才有无刷新热更。

---

## 边界

- 只面向 DeepSeek Harness：不提供独立 MCP 服务、CLI、Skill 安装器或 hook，也不适配其它 Agent 宿主。
- 依赖 DSH 的 `webServer` 与 `tools` 服务（`inject: ['webServer', 'tools']`），缺少任一服务的组合里 Host 半不激活。
- 页面优先与宿主同源（`dsh web` 或桌面版内置的 Web 视图）；桌面壳用 `file://` 载入渲染器时，Client 用 `__DSH_TRANSPORT__.streamBaseUrl` 找到 Host 的 HTTP 源，Host 通过 CORS 放行 null origin（见 `src/endpoint.ts` / `src/host.ts`）。
- 不需要 `better-sqlite3`：DSH 内核本身就用 `node:sqlite`，插件沿用同一个驱动，避开原生 ABI 问题。

---

## 文档

- 架构与关键决策：[design.md](./design.md)
- 编辑器实现交接：[editor.md](./editor.md)
- 仓库文档规则与索引：[docs/README.md](../../README.md)
- 插件源码与开发说明：[plugins/aiworkflow/README.md](../../../plugins/aiworkflow/README.md)
