# docs 目录说明

本目录分两部分，规则不同：

| 子目录 | 性质 | 生命周期 |
|---|---|---|
| `docs/`（根） | **项目文档**：设计文档、架构决策等长期有效的正式文档 | 长期保留，随代码演进更新 |
| `docs/dev/` | **开发临时文档**：阶段笔记、待处理项、编辑器交接 | 开发完成且验证通过后**整体删除** |

临时文档只服务于开发过程，不承担长期知识沉淀职责——最终有效的设计结论应回写进根目录的正式文档，而不是留在 `docs/dev/` 里。

- 正式设计文档：[2026-09-02-flowchart-driven-agent-design.md](./2026-09-02-flowchart-driven-agent-design.md)
- 待处理项（临时）：[dev/PENDING.md](./dev/PENDING.md)
- 编辑器交接（临时）：[dev/EDITOR-HANDOFF.md](./dev/EDITOR-HANDOFF.md)

> 项目只面向 DeepSeek Harness 插件；不再维护独立 MCP 服务、CLI 或其它 Agent 宿主的接入文档。
