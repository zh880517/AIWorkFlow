# @aiworkflow/dsh-plugin

只提供给 DeepSeek Harness 使用的 aiworkflow 插件，不依赖任何外部服务，也不支持其它 Agent 客户端：
Host 半用 `node:sqlite` 直接打开 `~/.aiworkflow/aiworkflow.db`（缺库会建库并跑公用层同一份迁移），
执行引擎也复用公用层 `shared/src/engine.ts`（构建时内联），因此 DSH 里既能画图、也能真跑流程。

依赖方向：插件源码只 import `@shared/*`（别名指到 `shared/src/`）与自己的 `./*`；
两边都要用的逻辑放 `shared/src/`，插件从这里 import。

## 安装（从 GitHub，不用 clone 或构建）

构建产物 `index.js`、`client.js` 已随仓库提交，装的时候不会被构建。

**DSH 侧栏 Plugins → Add plugin**，把下面这行粘进输入框：

```
git+https://github.com/zh880517/AIWorkFlow.git#main&path:/dsh-plugin
```

`#main` 跟最新提交；要钉版本就换成 commit SHA（`git rev-parse HEAD`）。`&path:/dsh-plugin` 指定包在仓库子目录里。
装完会自动加进 profile 的 bundle 列表并启用，重开 DSH 生效。

也可以让 Agent 代装：`plugin_manager` 的 `install_bundle`，`target` 用同一串 spec。

可选：启用插件市场（Discover）实验 bundle 后，在索引来源里加
`https://raw.githubusercontent.com/zh880517/AIWorkFlow/main/dsh-plugin/market/index.json`，市场里搜 aiworkflow 直接装。

升级没有原地升级：重新安装新的 commit（或先 Remove 再装）。本地开发时 `npm run build:plugin` 后填本机绝对路径
（例如 `D:/path/to/AIWorkFlow/dsh-plugin`），改完重新构建再让条目重新加载。

## 三块界面

1. **可视化工作流页（全局主面板）**：左侧栏的「可视化工作流」图标进入。流程库（列出 / 新建 / 删除）→ 画布编辑器：
   React Flow 直接跑在宿主里；拖拽定位、右侧圆点拖线连边、右键菜单（建节点 / 复制 / 粘贴 / 删除 / 设为入口）、
   撤销重做、右侧属性面板按节点类型编辑（指令 / 工具名与参数 / 子 Agent 模式与 fan-out / 卡点问题与选项 /
   汇聚与 waitFor / 迭代上限与逃生出口 / 结束结果 / 补充说明）、设置入口。
   改动后防抖干跑同一套 `validateFlow`（页头 chip + 问题定位），插值提示从历史 run 学 payload 字段；
   多路出边自动转成 `branches`，第一路填 `*` 表示默认分支，卡点出边可显式绑定选项。`subagent` 的 `subflow` 模式支持内嵌子图：卡片内有只读缩略图，点「打开」下钻到子图画布编辑，返回后随主图一起保存/校验。
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
- **卡点**：未决 gate 的问题与选项（只读提示；在对话里回复选项，Agent 会代填）；
- **已走路径**：横向路径条，连续重复节点合并为 `×n`（环的圈数）；
- **执行轨迹**：最近若干步，点一下展开 payload（大 payload 由 Host 截断）。
- 顶部可切换 run（活跃优先，其后是最近结束的）。

刻意不画整张流程图：窄栏里"当下这一步 + 走过的路"比缩略图更可读，整图由「可视化工作流」里的编辑器负责。

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
- **执行引擎**：直接调用公用层的 `ExecutionEngine`（`shared/src/engine.ts`，构建时内联），所以 run 的推进、快照、卡点、子 Agent 派发语义只有一套实现。快照写 `flow_snapshots` 与 `cache/`。

建图五件套（`list` / `get` / `validate` / `create` / `update`）合并进了 `aiworkflow_flow` 的 `action` 参数：模型侧少背 4 个 schema，行为不变。

**报错一律三段式**（错在哪 + 正确姿势 + 当前这一步）；校验不通过时原图不动。

## 目录

```
shared/src/          公用层（插件 Host/Client 共用）
  types.ts           DSL 类型定义（唯一定义处）
  engine.ts          执行引擎（唯一实现）
  validate.ts        validateFlow（保存前校验）
  snapshot.ts        run 快照（copy-on-run）
  paths.ts           数据目录 ~/.aiworkflow/
  schema.ts          建表与迁移
  runTypes.ts        run 只读 DTO
  sql.ts             只读 SQL：listRuns / getRunDetail / readMonitorState
  progress.ts        进度语义：phase、路径合并、执行色调
  format.ts          相对时间、时长
dsh-plugin/
  src/host.ts        Host 半：ctx.webServer 同源路由（进度读取 + 图读写）
  src/db.ts          数据目录与单条 SQLite 连接（路由与工具共用）
  src/sqlite.ts      node:sqlite → 引擎要的数据库形状（补 BEGIN/SAVEPOINT 事务）
  src/engine.ts      执行引擎接线（复用 shared/src/engine）
  src/tools.ts       Agent 工具：context / flow / 6 个执行类
  src/client.tsx     Client 半入口：注册胶囊 / 浮动面板 / 工作流主面板 / 运行图浮层
  src/editor/        画布编辑器：页面壳 / React Flow / 属性面板 / DSL ⇄ 画布映射
  src/runview/       运行图：只读画布（节点状态着色 + 走过的边）+ 轨迹栏 + 浮层壳
  src/pill.tsx       标题栏胶囊（conversation.session.header.utilities）
  src/panel.tsx      浮动面板（shell.overlay）
  src/picker.tsx     输入框左侧「工作流」选择器
  src/diagnostics.tsx 页面错误边界与诊断面板
  src/endpoint.ts    Client 半的 HTTP 调用
  src/store.ts       轮询 store（打开 2s / 收起 6s，页面隐藏时暂停）
  src/i18n.ts        文案注册（zh / en）
  src/styles.tsx     仅用 --dsw-alias-* 主题 token 的样式
  build.mjs          构建：index.js（Node ESM）+ client.js（宿主 lazy-CJS factory）
  market/            插件市场索引（format 1）+ 生成脚本
```

## 构建 / 发布

```bash
npm run build:plugin        # 生成 index.js 与 client.js（本机构建，提交进仓库）
npm run release:plugin      # 一键：构建 → 提交产物 → 刷新市场索引 → 提交索引 → 打印安装链接
npm run release:plugin -- --dry-run    # 只看会做什么，不动 git 历史
npm run release:plugin -- --no-commit  # 只构建，不提交也不动索引
npm run check:plugin        # 重新构建，与暂存区里的产物比哈希（提交前 / CI 用）
npm run market:plugin       # 只刷新 market/index.json（索引钉在 HEAD 上）
```

`release:plugin` 会提交**两笔**：先提交产物，再用新的 HEAD 生成索引并提交索引——索引必须钉在包含产物的提交上。
两笔提交都只带 `dsh-plugin` 自己的文件，不动你工作区里其它改动。索引已指向当前产物时会自动跳过，不产生空提交。

**`index.js` / `client.js` 是本地构建后提交的**：别人按 GitHub spec 安装时不会在本机构建，装到的就是 git 树里的这两个文件。
不改成「安装时构建」的原因：pnpm 11 默认拦下依赖包的 `prepare` 脚本，装的时候会弹「允许脚本并重试」，
多一步人工确认；仓库里带产物则是零构建、零脚本。

代价是产物可能忘提交/过期，所以有 `check:plugin`：它重建一遍再跟**暂存区**比对，不一致就失败。
本地每次提交前跑一下；要接 CI 的话，在 workflow 里跑 `npm run check:plugin` 即可（构建是确定性的、不含机器路径/时间戳）。

装到本机 profile 后，改 Host 半需要让条目重新加载（`plugin_manager` 先关再开）；只改 Client 半时宿主 HMR 会自己换新模块。

## 边界

- 写 SQLite 的只有三处：图的 create/update（走公用层校验）、`start_run`/`complete_step` 等执行类工具（走公用层 `ExecutionEngine`）、以及建库时的迁移。进度视图本身只读。
- 人工卡点只能由用户放行：`answer_gate` 仅用于**转达用户已经说出口的答复**（`source: chat`）；面板只展示待决卡点，不提供点选，插件不会自己替用户做选择。
- 依赖 DSH 的 `webServer` 与 `tools` 服务（`inject: ['webServer', 'tools']`），缺少任一服务的组合里 Host 半不激活。
- 页面必须与宿主同源（`dsh web` 或桌面版内置的 Web 视图）；`file://` 载入的渲染器拿不到这个路由。
- `better-sqlite3` 不需要：DSH 内核本身就用 `node:sqlite`，插件沿用同一个驱动，避开原生 ABI 问题。
