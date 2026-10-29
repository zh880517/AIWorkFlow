# AGENTS.md — aiworkflow 工作区说明

## 项目定位

**只面向 DeepSeek Harness 的流程图插件**：在 DSH 里画流程图、发起 run、看进度与运行图；Agent 每领一步指令 → 做完回报 `summary`/`payload` → 再领下一步。核心理念是**管理 Agent 的注意力预算（逐步披露），引导而非约束**。

不提供独立 MCP 服务，不提供 CLI，也不适配其它 Agent 宿主。
Host 半用 `node:sqlite` 直接打开 `~/.aiworkflow/aiworkflow.db`，不依赖任何外部服务。

必读文档：改动核心逻辑前先读 [docs/2026-09-02-flowchart-driven-agent-design.md](docs/2026-09-02-flowchart-driven-agent-design.md)（已评审的设计文档，是所有实现的依据）。

## 目录结构

```
shared/src/  # 公用层（依赖最底层）：DSL 类型、校验、快照、执行引擎、SQLite 表结构、只读查询、进度/格式化。
             # 插件的 Host/Client 两半都从这里 import；这里**不得** import dsh-plugin/
dsh-plugin/  # DeepSeek Harness 插件（Host + Client 两半，构建成 index.js / client.js）
  src/host.ts      # ctx.webServer 同源路由（进度读取 + 图读写）、工具注册
  src/tools.ts     # Agent 工具：context + flow（建图五件套）+ 6 个执行类
  src/client.tsx   # Client 半入口（胶囊 / 浮层 / 工作流主面板 / 运行图）
tests/       # vitest（内存 node:sqlite）
docs/        # 项目正式文档（长期保留）
docs/dev/    # 开发临时文档：阶段验收后删除，结论回写正式文档
```

## 常用命令

```bash
npm run typecheck    # shared + 插件（提交前必过）
npm test             # vitest
npm run build:plugin # 生成 index.js / client.js（产物要提交）
npm run check:plugin # 重建并与暂存区比对，防止产物与源码脱节
```

可选：本机装了 CodeGraph 时，用 `codegraph status` / `codegraph query <符号>` / `codegraph callers <符号>`
查调用关系；索引在 `.codegraph/`（本地重建，已 gitignore），改动后用 `codegraph sync` 增量更新。

## 架构红线（来自设计文档，不可绕过）

- **SQLite 是唯一事实源**：任何写入先落 SQLite（`~/.aiworkflow/aiworkflow.db`）再刷派生 JSON（`flows/*.json`、`cache/`），永不只写 JSON。JSON 是保存时刷新的派生镜像，删掉不影响运行（没有单独的全量重建命令）。
- **数据目录**：`~/.aiworkflow/`；测试中用环境变量 `AIWORKFLOW_HOME` 重定向到临时目录，不要污染真实 home。
- **下发给 Agent 的单步数据必须降噪**：剥离分支的 `to` 字段、`progress` 不含总数、不下发图拓扑。这是刻意设计，不是遗漏。
- **报错自愈**：执行类工具与校验拒绝返回“错在哪 + 正确姿势 + 当前这一步是什么”三段式；建图类工具（`aiworkflow_flow`）是“错在哪 + 正确姿势”两段。
- **run 一律对启动时的快照执行**（copy-on-run，flowRef 递归解析），原图修改不影响进行中的 run。
- **会话身份只来自 DSH**：取工具执行上下文里的 `exec.agent.id`，写成 `dsh:<sessionId>` 存进 `runs.host_session`；不要再引入 hook / MCP 会话 id / 其它宿主的身份锚点。
- **只支持 DSH 插件**：不要恢复独立服务、HTTP MCP 端点、install / hook / Skill 宿主集成或其它 Agent 客户端适配。
- **插件构建产物必须提交**：`dsh-plugin/index.js` 与 `client.js` 是别人从 GitHub 安装时直接取的产物，改完源码必须 `npm run build:plugin` 一起提交。

## 编码约定

- TypeScript strict + ESM：相对导入**必须带 `.js` 扩展名**。
- **依赖方向只能是 `dsh-plugin/` → `shared/`**：插件里不准出现反向或 `src/` 引用；需要共用的逻辑放 `shared/src/`。
- `shared/src/` 不得 import `dsh-plugin/`；不要引入 HTTP 框架或原生 SQLite 绑定（`better-sqlite3` 等）。数据库访问只通过最小 `SqlDatabase` / `SqlWriter` 接口，Host 半用 `node:sqlite` 适配。
- `shared/src/index.ts` 只导出浏览器半也能用的纯逻辑；依赖 `node:fs` 的模块（`flows.ts`）走显式子路径 `@shared/flows.js`，不进 client bundle。`node:sqlite` 的适配在 `dsh-plugin/src/sqlite.ts`（Host 半专用）。
- 测试使用 `tests/support/db.ts` 的内存 `node:sqlite` 库，不要退回 `better-sqlite3`。
- 阶段开发流程：实现 → 测试跑通 → 在阶段记录里勾选并 git commit。

## 已知注意点

- `docs/dev/` 是临时文档，生命周期结束整体删除；正式结论回写根目录设计文档。
- 数据库迁移只追加，不改历史迁移；当前 `MIGRATIONS` 已到 v10（v6 删除旧 MCP 会话列；v7 角色/线程/inputs；v8 产物表；v9 父节点执行轮次；v10 `flows.kind` 区分主流程与子 Agent 配置）。旧库升级要保证数据不丢。
- 插件的 Host 半依赖 DSH 的 `webServer` 与 `tools` 服务（`inject: ['webServer', 'tools']`），缺少任一服务的组合里不激活。
- 页面优先与宿主同源（`dsh web` 或桌面版内置 Web 视图）；桌面壳用 `file://` 载入渲染器时，Client 用 `__DSH_TRANSPORT__.streamBaseUrl` 解析 Host 源，Host 的 CORS 头放行 null origin（见 `endpoint.ts` / `host.ts`）。
- 插件 Client 半只从宿主拿 `react` / `react-dom`；不要 `import 'react/jsx-runtime'`（详见 `docs/dev/EDITOR-HANDOFF.md`）。
