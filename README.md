# DSH 插件集合

DeepSeek Harness 插件集合：**每个插件是一个独立包，装哪个装哪个**。一个仓库可以放多个插件，
DSH 侧就是 Plugins 里的多张卡片，各自安装、开关、卸载、升级。

## 插件

| 插件 | 一句话 | 安装 | 文档 |
|---|---|---|---|
| aiworkflow | 把流程画成图，Agent 一次只领一步 | `git+https://github.com/zh880517/AIWorkFlow.git#main&path:/plugins/aiworkflow` | [docs/plugins/aiworkflow](docs/plugins/aiworkflow/README.md) |

## 安装

在 DSH 侧栏 **Plugins → Add plugin** 里粘一条 spec（也可以让 Agent 调 `plugin_manager` 的 `install_bundle`）：

```
git+<仓库地址>.git#<ref>&path:/plugins/<插件 id>
```

- `#<ref>`：分支名（如 `main`）或 40 位 commit；钉版本用包含构建产物的 commit。
- `&path:/plugins/<id>`：插件包在仓库里的目录。**一次安装只装一个插件**，装第二个再加一条 spec。
- 构建产物已提交，安装时不在本机构建；装完自动加入 profile 的 bundle 列表并启用，重开 DSH 生效。
- 升级 = Remove 后按新 commit 重装（DSH 目前没有原地升级）。

启用了插件市场（Discover）实验 bundle 后，也可以添加索引来源，在市场里逐个安装：

```
https://raw.githubusercontent.com/zh880517/AIWorkFlow/main/market/index.json
```

## 仓库结构

```
plugins/<id>/        每个插件一个独立的 npm 包（Host + Client，构建成 index.js / client.js）
  package.json       dsh.bundle.patch 声明它是插件；dsh.client 声明浏览器半
  src/               源码
  index.js client.js 构建产物（要提交）
  market.json        市场展示元数据（标题/描述/关键词）
shared/src/          构建期内联层：DSL、校验、执行引擎、SQLite 表结构、只读查询
tests/<id>/          与插件目录同名的测试
market/index.json    一个索引列全部插件（format 1）
scripts/             构建 / 检查 / 发布 / 索引 / 文档检查，全部按 plugins/* 循环
docs/plugins/<id>/   每个插件一个文档目录（入口 README.md + design.md）
docs/dev/            开发临时文档，验收后删除
```

依赖方向固定：`plugins/*/ → shared/`，插件之间不互相 import（有测试守着）。所有插件共用一份 `shared/`，
构建时各自内联，不做运行期跨包依赖。

## 开发

```bash
npm install
npm run typecheck        # shared + 每个插件
npm test                 # vitest
npm run build            # 构建全部插件；`-- --only <id>` 只构建一个
npm run check:plugin     # 重建并与暂存区比对，防止产物与源码脱节
npm run check:docs       # 每个插件必须有 docs/plugins/<id>/ 且 README 链接到它
npm run check            # typecheck + test + check:plugin + check:docs
npm run release:plugin   # 构建 → 提交 → 刷新市场索引 → 提交索引 → 打印安装链接
npm run release:plugin -- --only aiworkflow
npm run release:plugin -- --dry-run    # 只看会做什么，不动 git 历史
```

新增一个插件：

1. 建 `plugins/<id>/`（复制现有插件的 package.json / cordis.patch.yml / tsconfig.json 与 src 骨架，改包名、row id 前缀、路由前缀）；
2. 建 `docs/plugins/<id>/README.md` 与 `design.md`；
3. 在本文的「插件」表加一行，在 `docs/README.md` 的插件索引加一行；
4. 跑 `npm run build -- --only <id>` 与 `npm run check:docs`；
5. 跑 `npm run release:plugin -- --only <id>` 生成索引条目。

> 为什么产物要提交：pnpm 11 默认拦下 git 依赖的 `prepare` 脚本，安装时会多一步「允许脚本并重试」；
> 把产物放进仓库就是零构建、零脚本。构建是确定性的（同源码两次构建哈希一致、不含机器路径/时间戳）。

## 文档

- 文档索引与规则：[docs/README.md](docs/README.md)
- 每个插件一个文档目录：`docs/plugins/<id>/`（入口 + 架构）；代码目录里的 README 只留短版并链到它。
- aiworkflow 设计文档（架构与关键流程图）：[docs/plugins/aiworkflow/design.md](docs/plugins/aiworkflow/design.md)
- 多插件改造方案（已实施）：[docs/2026-10-30-multi-plugin-repo-design.md](docs/2026-10-30-multi-plugin-repo-design.md)
