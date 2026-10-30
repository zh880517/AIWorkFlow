# AGENTS.md — DSH 插件集合工作区说明

## 项目定位

**DeepSeek Harness 插件集合仓库**：`plugins/<id>/` 下每个目录是一个独立安装的插件包，一个仓库可以放多个插件。
装哪个装哪个——DSH 里每个插件是 Plugins 页面上的一张卡片，独立开关、卸载、升级、版本号。

当前插件：

| 插件 | 定位 |
|---|---|
| `aiworkflow` | 流程图驱动的分步执行：在 DSH 里画流程图、发起 run、看进度与运行图；Agent 每领一步指令 → 做完回报 `summary`/`payload` → 再领下一步。核心理念是**管理 Agent 的注意力预算（逐步披露），引导而非约束**。 |

不提供独立 MCP 服务，不提供 CLI，也不适配其它 Agent 宿主。
aiworkflow 的 Host 半用 `node:sqlite` 直接打开 `~/.aiworkflow/aiworkflow.db`，不依赖任何外部服务。

必读文档：

- aiworkflow 设计文档（已评审，是所有实现的依据）：[docs/plugins/aiworkflow/design.md](docs/plugins/aiworkflow/design.md)
- 文档规则与插件索引：[docs/README.md](docs/README.md)
- 多插件仓库结构（已实施）：[docs/2026-10-30-multi-plugin-repo-design.md](docs/2026-10-30-multi-plugin-repo-design.md)

## 目录结构

```
plugins/<id>/   # 一个插件 = 一个 npm 包；Host + Client 两半，构建成 index.js / client.js
  package.json  # dsh.bundle.patch + dsh.client；包名全局唯一
  cordis.patch.yml
  src/host.ts   # aiworkflow：ctx.webServer 同源路由、工具注册
  src/tools.ts  # aiworkflow：Agent 工具（context / flow / 6 个执行类）
  src/client.tsx# aiworkflow：Client 半入口（胶囊 / 浮层 / 主面板 / 运行图）
  market.json   # 市场展示元数据（标题/描述/关键词）
shared/src/     # 公用层（依赖最底层）：DSL 类型、校验、快照、执行引擎、SQLite 表结构、只读查询。
                # 插件的 Host/Client 两半都从这里 import；这里**不得** import 任何 plugins/*
market/         # 插件市场索引（format 1，一个索引列全部插件）
scripts/        # 构建 / 检查 / 发布 / 索引 / 文档检查，全部按 plugins/* 循环
tests/<id>/     # 与插件目录同名的 vitest（内存 node:sqlite），共用 tests/support/
docs/           # 跨插件正式文档（文档规则、仓库级设计）
docs/plugins/<id>/  # 每个插件一个文档目录：README.md（入口）+ design.md（架构）
docs/dev/       # 开发临时文档：阶段验收后删除，结论回写正式文档
```

## 常用命令

```bash
npm run typecheck    # shared + 每个插件（提交前必过）
npm test             # vitest
npm run build        # 构建全部插件；`-- --only <id>` 只构建一个
npm run check:plugin # 重建并与暂存区比对，防止产物与源码脱节
npm run check:docs   # 文档目录 / README 链接 / 市场索引完整性
npm run check        # 上面四项串起来
npm run release:plugin [-- --only <id>]   # 构建 → 提交 → 刷新索引 → 提交索引 → 打印安装链接
```

可选：本机装了 CodeGraph 时，用 `codegraph status` / `codegraph query <符号>` / `codegraph callers <符号>`
查调用关系；索引在 `.codegraph/`（本地重建，已 gitignore），改动后用 `codegraph sync` 增量更新。

## 架构红线（不可绕过）

- **安装单位是插件包，不是仓库**：每个插件一条 spec（`git+…#<ref>&path:/plugins/<id>`），各自独立开关、卸载、版本；没有“一键装全部”。
- **依赖方向只能是 `plugins/*/` → `shared/`**：插件之间**不准互相 import**；共享逻辑放 `shared/src/`，构建时内联。
- **插件构建产物必须提交**：`plugins/<id>/index.js` 与 `client.js` 是别人从 GitHub 安装时直接取的产物，改完源码必须 `npm run build` 一起提交。
- **改代码必须 bump 版本**：每个插件独立 semver；`release:plugin` 会拒绝「内容变了、版本号没变」，否则市场索引里同一版本会对应多个 commit。
- **命名空间自带前缀**：bundle 包名全局唯一；loader row id（如 `aiworkflow-progress`）、Host 路由前缀（如 `/aiworkflow`）、Client slot / 面板 id 都要按插件加前缀，避免同 profile 多插件冲突。
- **文档与插件一一对应**：新增 `plugins/<id>/` 必须同时建 `docs/plugins/<id>/{README,design}.md`，并在根 README 与 `docs/README.md` 各加一行链接；`npm run check:docs` 会拦。
- **只支持 DSH 插件**：不要恢复独立服务、HTTP MCP 端点、install / hook / Skill 宿主集成或其它 Agent 客户端适配。

### aiworkflow 专属红线（来自其设计文档）

- **SQLite 是唯一事实源**：任何写入先落 SQLite（`~/.aiworkflow/aiworkflow.db`）再刷派生 JSON（`flows/*.json`、`cache/`），永不只写 JSON。JSON 是保存时刷新的派生镜像，删掉不影响运行（没有单独的全量重建命令）。
- **数据目录**：`~/.aiworkflow/`；测试中用环境变量 `AIWORKFLOW_HOME` 重定向到临时目录，不要污染真实 home。
- **下发给 Agent 的单步数据必须降噪**：剥离分支的 `to` 字段、`progress` 不含总数、不下发图拓扑。这是刻意设计，不是遗漏。
- **报错自愈**：执行类工具与校验拒绝返回“错在哪 + 正确姿势 + 当前这一步是什么”三段式；建图类工具（`aiworkflow_flow`）是“错在哪 + 正确姿势”两段。
- **run 一律对启动时的快照执行**（copy-on-run，flowRef 递归解析），原图修改不影响进行中的 run。
- **会话身份只来自 DSH**：取工具执行上下文里的 `exec.agent.id`，写成 `dsh:<sessionId>` 存进 `runs.host_session`；不要再引入 hook / MCP 会话 id / 其它宿主的身份锚点。

## 编码约定

- TypeScript strict + ESM：相对导入**必须带 `.js` 扩展名**。
- 插件里只准引用 `@shared/*`、自身目录内的相对路径、`node:` 内建与构建期第三方依赖（React / React Flow）；越界会被 `tests/<id>/layering.test.ts` 拦下。
- `shared/src/` 不得 import 任何 `plugins/*`；不要引入 HTTP 框架或原生 SQLite 绑定（`better-sqlite3` 等）。数据库访问只通过最小 `SqlDatabase` / `SqlWriter` 接口，Host 半用 `node:sqlite` 适配。
- `shared/src/index.ts` 只导出浏览器半也能用的纯逻辑；依赖 `node:fs` 的模块（`flows.ts`）走显式子路径 `@shared/flows.js`，不进 client bundle。`node:sqlite` 的适配在各插件 `src/sqlite.ts`（Host 半专用）。
- 测试按插件分组（`tests/<id>/`），共用 `tests/support/` 的内存 `node:sqlite` 库，不要退回 `better-sqlite3`。
- 构建/发布脚本只写 `scripts/`，插件目录里不放构建脚本；新增插件不改脚本分支逻辑。
- 阶段开发流程：实现 → 测试跑通 → 在阶段记录里勾选并 git commit。

## 已知注意点

- `docs/dev/` 是临时文档，生命周期结束整体删除；正式结论回写 `docs/plugins/<id>/` 或根目录正式文档。
- aiworkflow 数据库迁移只追加，不改历史迁移；当前 `MIGRATIONS` 已到 v10（v6 删除旧 MCP 会话列；v7 角色/线程/inputs；v8 产物表；v9 父节点执行轮次；v10 `flows.kind` 区分主流程与子 Agent 配置）。旧库升级要保证数据不丢。
- aiworkflow 的 Host 半依赖 DSH 的 `webServer` 与 `tools` 服务（`inject: ['webServer', 'tools']`），缺少任一服务的组合里不激活。
- 页面优先与宿主同源（`dsh web` 或桌面版内置 Web 视图）；桌面壳用 `file://` 载入渲染器时，Client 用 `__DSH_TRANSPORT__.streamBaseUrl` 解析 Host 源，Host 的 CORS 头放行 null origin（见 `endpoint.ts` / `host.ts`）。
- 插件 Client 半只从宿主拿 `react` / `react-dom`；不要 `import 'react/jsx-runtime'`（详见 `docs/plugins/aiworkflow/editor.md`）。
- 本机 profile 的插件依赖是 `link:` 指向 `plugins/aiworkflow`；目录再迁移时必须同步改 `~/.dsh/profiles/<profile>/package.json` 或重新安装。
