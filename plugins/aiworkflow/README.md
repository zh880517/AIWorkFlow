# @aiworkflow/dsh-plugin

DeepSeek Harness 插件：把流程画成图，Agent 一次只领一步。
包目录 `plugins/aiworkflow/`，Host 半用 `node:sqlite` 打开 `~/.aiworkflow/aiworkflow.db`，执行引擎复用
`shared/src/`（构建时内联）。

## 安装

```
git+https://github.com/zh880517/AIWorkFlow.git#main&path:/plugins/aiworkflow
```

`#main` 跟主分支；钉版本换成 commit。`&path:/plugins/aiworkflow` 是该包在仓库里的位置。
装完自动加入 profile 的 bundle 列表并启用，重开 DSH 生效。

## 文档

完整文档（功能、界面、工具、数据、开发、边界）在仓库里：

- [docs/plugins/aiworkflow/README.md](../../docs/plugins/aiworkflow/README.md)
- 架构与决策：[design.md](../../docs/plugins/aiworkflow/design.md)
- 编辑器交接：[editor.md](../../docs/plugins/aiworkflow/editor.md)

## 开发

```bash
npm run build -- --only aiworkflow    # 生成 index.js / client.js（产物要提交）
npm run typecheck
npm test
```

产物必须提交：别人按 GitHub spec 安装时不会在本机构建，装到的就是 git 树里的 `index.js` / `client.js`。
改完源码不提交产物，`npm run check:plugin` 会失败。
