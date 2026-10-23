# AGENTS.md — aiworkflow 工作区说明

## 项目定位

流程图驱动的 AI Agent 执行引擎：`npx aiworkflow` 启动本地服务（HTTP MCP 端点 + Web 面板），Agent 逐步领取流程图节点指令、做完回报后领取下一步。核心理念是**管理 Agent 的注意力预算（逐步披露），引导而非约束**。

必读文档：改动核心逻辑前先读 [docs/2026-09-02-flowchart-driven-agent-design.md](docs/2026-09-02-flowchart-driven-agent-design.md)（已评审的设计文档，是所有实现的依据）。开发进度与阶段验收标准见 [docs/dev/ROADMAP.md](docs/dev/ROADMAP.md)。

## 目录结构

```
shared/src/  # 公用层（依赖最底层）：DSL 类型、校验、快照、执行引擎、路径/建表、SQL/进度/格式化。
             # 主工程 src/ 与 DSH 插件 dsh-plugin/ 都从这里 import；这里**不得**反向 import src/
src/core/    # 主工程自己的胶水：better-sqlite3 连接、flow 存储、run 查询；其余模块是从 shared/ 再导出的老路径
src/server/  # HTTP 服务：MCP 端点、面板静态资源、SSE（Phase 2 起）
src/cli/     # npx 入口（src/cli.ts，Phase 2 实现）
src/web/     # React 面板源码，Vite 构建，产物进 dist-web/（Phase 4 起）
dsh-plugin/  # DeepSeek Harness 插件（Host + Client 两半，构建成 index.js / client.js）
tests/       # vitest 测试
docs/        # 项目正式文档（长期保留）
docs/dev/    # 开发临时文档：阶段验收后删除，结论回写正式文档
```

## 常用命令

```bash
npm run typecheck   # tsc --noEmit（提交前必过）
npm test            # vitest run
npm run build       # tsc → dist/
```

## 架构红线（来自设计文档，不可绕过）

- **SQLite 是唯一事实源**：任何写入先落 SQLite（`~/.aiworkflow/aiworkflow.db`）再刷派生 JSON（`flows/*.json`、`cache/`），永不只写 JSON。JSON 可删、可从 SQLite 重建。
- **数据目录**：`~/.aiworkflow/`；测试中用环境变量 `AIWORKFLOW_HOME` 重定向到临时目录，不要污染真实 home。
- **下发给 Agent 的单步数据必须降噪**：剥离分支的 `to` 字段、`progress` 不含总数、不下发图拓扑。这是刻意设计，不是遗漏。
- **报错自愈**：所有拒绝路径返回“错在哪 + 正确姿势 + 当前这一步是什么”三段式。
- **服务绑 127.0.0.1 + token**（`http://127.0.0.1:4123/mcp?k=<token>`），token 进程启动时生成。
- **Web 面板画布必须用 React Flow（@xyflow/react）**，不自研画布；实时通道用 SSE，不用 WebSocket；不引入第二个 HTTP 框架（用 hono）。
- **run 一律对启动时的快照执行**（copy-on-run，flowRef 递归解析），原图修改不影响进行中的 run。
- MCP 传输用 Streamable HTTP（非 stdio），`Mcp-Session-Id` 是主 Agent 的身份锚点。

## 编码约定

- TypeScript strict + ESM（`"type": "module"`，`module: Node16`）：相对导入**必须带 `.js` 扩展名**。
- **依赖方向只能是 `src/` → `shared/`、`dsh-plugin/` → `shared/`**：插件（和 shared）里不准出现 `../../src/...` 引用；需要共用的逻辑放 `shared/src/`。`src/core/` 里被迁走的模块只剩一行再导出，别在上面加逻辑。
- `shared/src/` 不得 import `src/server/` 或任何 HTTP 依赖；它要能同时给浏览器半（类型/纯函数）和 Host 半（用 `node:` 内建）用。
- `src/core/` 不得 import `src/server/` 或任何 HTTP 依赖；core 层保持可单测（内存库 `openMemoryDb()`）。
- 阶段开发流程：看 ROADMAP 对应阶段 → 实现 → 测试 + 阶段验收项跑通 → 在 ROADMAP 勾选并 git commit（每阶段一提交）。

## 已知注意点

- 设计文档 §10 有三个待实测前提（宿主 `Mcp-Session-Id` 行为、子 Agent 连接共享、Codex 并行能力），Phase 2 末用真实宿主验证，探针代码不留仓库。
- 阶段 8（图编辑器）刻意排在引擎语义（阶段 2–7）之后：编辑器别抢跑，DSL 稳定前不动画布。
- docs 两类文档生命周期不同：`docs/dev/` 全部完成后整体删除。
