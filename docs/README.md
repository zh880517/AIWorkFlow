# docs 目录说明

本目录分两部分，规则不同：

| 子目录 | 性质 | 生命周期 |
|---|---|---|
| `docs/`（根） | **项目文档**：设计文档、架构决策等长期有效的正式文档 | 长期保留，随代码演进更新 |
| `docs/dev/` | **开发临时文档**：阶段笔记、待处理项、审计记录、编辑器交接 | 开发完成且验证通过后**删除**；结论回写正式文档 |

临时文档只服务于开发过程，不承担长期知识沉淀职责——最终有效的设计结论应回写进根目录的正式文档，
而不是留在 `docs/dev/` 里。2026-10-29 已按此约定删除三份“已实施”的子 Agent 配置 / 属性面板 /
多 Agent 设计笔记（内容已吸收进正式设计文档，历史见 git）。

- 正式设计文档：[2026-09-02-flowchart-driven-agent-design.md](./2026-09-02-flowchart-driven-agent-design.md)
- 架构与关键流程图：[2026-10-29-architecture-flows.md](./2026-10-29-architecture-flows.md)（PNG 导出于 [diagrams/](./diagrams/)）
- 待处理项（临时）：[dev/PENDING.md](./dev/PENDING.md)
- 编辑器交接（临时）：[dev/EDITOR-HANDOFF.md](./dev/EDITOR-HANDOFF.md)
- 2026-10-29 审计报告（临时）：[dev/2026-10-29-audit.md](./dev/2026-10-29-audit.md)
  - 审计修复补丁：[dev/2026-10-29-audit-fixes.patch](./dev/2026-10-29-audit-fixes.patch)（已应用到源码，保留作记录）
  - 复现用例：[dev/2026-10-29-audit-repro.test.ts](./dev/2026-10-29-audit-repro.test.ts)（复制到 `tests/` 运行）

> 项目只面向 DeepSeek Harness 插件；不再维护独立 MCP 服务、CLI 或其它 Agent 宿主的接入文档。
