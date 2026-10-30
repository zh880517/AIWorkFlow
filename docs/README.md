# docs 目录说明

本目录分三部分，规则不同：

| 目录 | 性质 | 生命周期 |
|---|---|---|
| `docs/`（根） | **跨插件项目文档**：文档规则、仓库级设计、共享约定 | 长期保留，随代码演进更新 |
| `docs/plugins/<id>/` | **单个插件的文档**：`<id>` 与 `plugins/<id>` 一一对应 | 长期保留，跟插件一起演进 |
| `docs/dev/` | **开发临时文档**：阶段笔记、待处理项、审计记录 | 开发完成且验证通过后**删除**；结论回写正式文档 |

临时文档只服务于开发过程，不承担长期知识沉淀职责——最终有效的设计结论应回写进插件文档或根目录正式文档，
而不是留在 `docs/dev/` 里。2026-10-29 已按此约定删除三份“已实施”的设计笔记；2026-10-30 把编辑器交接
从 `docs/dev/` 吸收进 `docs/plugins/aiworkflow/editor.md`。

## 插件文档

每个插件必须有 `docs/plugins/<id>/`，最小内容：

| 文件 | 必选 | 内容 |
|---|---|---|
| `README.md` | 是 | 定位、安装 spec、功能、边界、数据与权限、开发命令、文档索引 |
| `design.md` | 是 | 架构、数据流、关键决策与取舍 |
| `<topic>.md` | 否 | 单主题深入（如 `editor.md`） |

| 插件 | 文档入口 | 代码目录 | 市场条目 |
|---|---|---|---|
| aiworkflow | [docs/plugins/aiworkflow/README.md](./plugins/aiworkflow/README.md) | `plugins/aiworkflow/` | `@aiworkflow/dsh-plugin` |

## 链接规则（`npm run check:docs` 会校验）

1. 根 `README.md` 的「插件」表必须有一行链到 `docs/plugins/<id>/README.md`；
2. 本文件的「插件文档」表必须有同一链接；
3. `plugins/<id>/README.md`（包内短版）必须链到 `docs/plugins/<id>/`；
4. `docs/plugins/` 下不允许有孤儿目录（没有对应插件包）；
5. `market/index.json` 必须有该插件的条目。

新增插件时按 `npm run check:docs` 的报错补齐即可；模板见 `docs/plugins/aiworkflow/`。

## 其他文档

- 多插件仓库改造与文档布局（已实施）：[2026-10-30-multi-plugin-repo-design.md](./2026-10-30-multi-plugin-repo-design.md)
- 待处理项（临时）：[dev/PENDING.md](./dev/PENDING.md)
- 2026-10-29 审计报告（临时）：[dev/2026-10-29-audit.md](./dev/2026-10-29-audit.md)
  - 审计修复补丁：[dev/2026-10-29-audit-fixes.patch](./dev/2026-10-29-audit-fixes.patch)（已应用到源码，保留作记录）
  - 复现用例：[dev/2026-10-29-audit-repro.test.ts](./dev/2026-10-29-audit-repro.test.ts)（复制到 `tests/` 运行）

> 项目只面向 DeepSeek Harness 插件；不再维护独立 MCP 服务、CLI 或其它 Agent 宿主的接入文档。
