# aiworkflow

流程图驱动的 AI Agent 执行引擎：`npx aiworkflow` 起一个本地服务，Agent 按流程图逐步领取指令、做完回报后领取下一步（逐步披露、管理注意力预算）。同一套引擎也以 **DeepSeek Harness 插件**的形式装在 DSH 里，可以直接在对话里发起 run、看运行图、画流程图。

- 设计文档：[docs/2026-09-02-flowchart-driven-agent-design.md](docs/2026-09-02-flowchart-driven-agent-design.md)
- 插件说明与界面截图：[dsh-plugin/README.md](dsh-plugin/README.md)

## 安装 DSH 插件（从 GitHub 装，不用先 clone 构建）

仓库里已经提交了构建好的 `dsh-plugin/index.js` 与 `client.js`，所以安装时不需要在本机装依赖、跑构建。

**方式一：粘一行 spec（推荐）**

打开 DSH 侧栏 **Plugins → Add plugin**，把这个链接粘进去：

```
git+https://github.com/zh880517/AIWorkFlow.git#main&path:/dsh-plugin
```

- `#main` 是跟随主分支最新提交；想要固定版本就把它换成某个 commit（`git rev-parse HEAD`）。**注意**：只能钉在包含构建产物的提交上（f57374a 及其之后都可以），早期提交里没有 `index.js`；
- `&path:/dsh-plugin` 告诉包管理器「插件在这个子目录里」；
- 装完插件会自动进入 profile 的 bundle 列表并启用，重开 DSH 即可看到侧栏的「可视化工作流」。

也可以让 Agent 代装：

```
用 plugin_manager 的 install_bundle 安装 git+https://github.com/zh880517/AIWorkFlow.git#main&path:/dsh-plugin
```

**方式二：加一个插件市场索引**

如果你启用了插件市场（Discover）实验 bundle，在插件市场的索引来源里加：

```
https://raw.githubusercontent.com/zh880517/AIWorkFlow/main/dsh-plugin/market/index.json
```

之后在市场里搜 `aiworkflow` 点安装即可。索引由 `npm run market:plugin` 生成，条目钉在某个 commit 上，内容与方式一相同。

**方式三：本地开发**

```bash
npm install
npm run build:plugin          # 生成 dsh-plugin/index.js 与 client.js
```

然后在 Plugins → Add plugin 里填本机绝对路径，例如 `D:/GitHub/AIWorkFlow/dsh-plugin`；改完代码重新 `npm run build:plugin` 后重载插件。

**升级**：插件目前没有原地升级，重新安装一次新 commit（或先 Remove 再装）。`npm run release:plugin` 会构建、暂存产物并校验；`npm run check:plugin` 可随时确认「仓库里的产物 == 一次全新构建」。

## 主工程（不装 DSH 也能用）

```bash
npm install
npm run build                 # tsc → dist/，vite → dist-web/
npm start                     # 或 node dist/src/cli.js，打印面板 / MCP / 建图 MCP 三个地址
```

- 面板：`http://127.0.0.1:<PORT>/?k=<token>`
- MCP：`http://127.0.0.1:<PORT>/mcp?k=<token>`
- 开发：`npm run dev:web`（Vite 热更）、`npm test`、`npm run typecheck`

## 目录

```
shared/src/   # 公用层：DSL 类型、校验、引擎、快照、SQLite 表结构（插件与主工程共用）
src/          # 主工程：HTTP 服务、CLI、Web 面板
dsh-plugin/   # DeepSeek Harness 插件（Host + Client 两半）
tests/        # vitest
docs/         # 设计文档与开发笔记
```
