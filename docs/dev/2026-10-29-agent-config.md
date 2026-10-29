# 子 Agent 配置：可复用的角色表 + 子图

状态：已实施（2026-10-29）
范围：`shared/src/{types,schema,flows,snapshot,validate}.ts`、`dsh-plugin/src/{host,editor/*}`、测试与文档

## 1. 需求与取舍

需求原话：**添加一类子 Agent 配置，可以配置子 Agent 以及子图，然后由主工作流引用，和主工作流一样，可以在主界面创建和编辑。**

拆成三条硬要求：

1. 配置是**独立实体**，在流程库里能像主流程一样新建 / 打开 / 删除 / 保存。
2. 配置内部能同时维护**角色表**（agents）和**子图**（nodes/entry）。
3. 主流程能引用一个配置，运行时把它当成一个 child run 执行。

没有新造 DSL 概念：把配置实现为 `Flow.kind = 'agent'` 的保存图，复用现有画布、校验、快照和 `subagent.mode = 'flowRef'` 引用通道。这样：

- 编辑体验与主流程完全一致（同一套 `Editor` / `Inspector` / 画布）；
- `flowRef` 本来就会把被引用的图递归收进快照，配置天然获得 copy-on-run；
- 历史 run、运行图、产物、线程等机制不需要第二套。

真正的语义缺口只有一个：**`buildSubSnapshot` 原来永远继承父图角色表**，导致配置自己的 `agents` 在 child 里取不到。本次修复为 `childFlow.agents ?? parent.agents`。

## 2. 数据模型

```ts
type FlowKind = 'flow' | 'agent';

interface Flow {
  id: string;
  name: string;
  kind?: FlowKind;        // 缺省 flow，兼容老图
  entry: string;
  agents?: AgentDef[];    // kind=agent 时是配置自己的角色表
  nodes: FlowNode[];
  maxSteps?: number;
  _ui?: { positions?: Record<string, { x: number; y: number }> };
}
```

- `flow`：可独立 `start_run` 的主流程。
- `agent`：子 Agent 配置，通常由主流程引用；也允许单独启动（用于调试配置本身），不加硬限制。
- `primaryRole` 没有引入：配置可能包含多个角色，哪个角色在 child 上生效由引用节点自己的 `role` 决定；配置内部节点直接用 `role` 引用配置的 `agents`。

## 3. 存储

迁移 **v10**（只追加）：

```sql
ALTER TABLE flows ADD COLUMN kind TEXT NOT NULL DEFAULT 'flow';
CREATE INDEX IF NOT EXISTS idx_flows_kind ON flows(kind);
```

- `saveFlow` 把 `kind` 同时写列与 JSON content，返回规范化的 flow。
- `getFlow` 以列为准补 `kind`，v10 之前落库、JSON 里没有 `kind` 的老图读出来仍是 `flow`。
- `listFlows(db, kind?)` 支持按类型过滤；面板用一次全量列表在客户端分页签，Agent 工具 `flow` 的 `list` 也带 `kind`。
- `flows/*.json` 镜像包含 `kind`，可从 SQLite 重建。

## 4. 运行时

1. 主流程里放一个 `subagent` 节点，`mode = 'flowRef'`，`flowRef = <配置 id>`。
2. 启动 run 时 `buildSnapshot` 沿 `flowRef` 递归把配置收进快照。
3. 派发时 `childFlowOf` 返回配置本身，child run 的 `flow_id` 就是配置 id，`entry` 是配置的入口。
4. `buildSubSnapshot(parent, childFlow)` 用 `childFlow.agents ?? parent.agents`：

   - 配置有自己的角色表 → child 内部节点 `role` 能查到章程；
   - 普通内嵌子图 / 老图没有 `agents` → 继续继承父图，行为不变。

5. 配置内部可以继续放 `subagent` 节点（inline / subflow / flowRef），嵌套引用同样递归快照；引用成环由快照的 `visiting` 检测，直接引用自身由校验 `E_FLOW_REF_SELF` 拦下。
6. **入口特判**：child run 从 `subagent` / `gate` 直接开始时，第一次 `get_current_step` 会补做 `startRun` 的入口派发/挂起（`bootstrapEntry`）。否则配置入口直接是 subagent 会永远停在 running，等不到派发。
7. `subagent` 节点只有 `inline` 模式要求 `extraPrompt`；`subflow` / `flowRef` 的任务来自被引用图的第一步，`extraPrompt` 引擎不读，校验放宽为可选。

## 5. 界面

### 流程库

- 页头新增分段页签：**「流程 N」/「子 Agent 配置 M」**。
- 新建按钮随页签切换为「新建流程」/「新建子 Agent」。
- 新建子 Agent 的默认图：`开始(prompt) → 结束(end)`，并预置一个合法角色 `agent_1`，保证建完即可保存（填上指令即可）。
- 删除确认文案按类型区分。
- 新建主流程也顺手补了 `start.next = end`，不再默认生成孤立的 end 节点。

### 编辑器

- 页头在名称旁显示「子 Agent 配置」标签，其余编辑体验与主流程一致。
- 画布、节点属性面板、`图` 页签（角色表）完全复用；配置的角色表就是它自己的 `agents`。
- 保存时 `buildFlow` 原样展开 `base`，`kind` 不会丢。

### 引用

- `subagent` 节点的「执行方式」第三项从「引用图」改名为「引用」。
- 下拉按 `optgroup` 分组：**子 Agent 配置** / **流程**；选项显示名称 + id。
- 已删除目标的兜底项保留。
- 提示文案说明：配置会连同它自己的角色表进入快照。

## 6. 改动文件

- `shared/src/types.ts`：`FlowKind`、`Flow.kind`
- `shared/src/schema.ts`：v10 迁移
- `shared/src/flows.ts`：`FlowMeta.kind`、列表过滤、读写规范化
- `shared/src/snapshot.ts`：子快照角色表继承规则
- `shared/src/validate.ts`：`E_FLOW_KIND`、`E_FLOW_REF_SELF`、`W_AGENT_CONFIG_NO_ROLE`
- `dsh-plugin/src/host.ts`：`GET /flows?kind=agent|flow`
- `dsh-plugin/src/editor/api.ts`：`FlowMeta.kind`、`listFlows(kind?)`
- `dsh-plugin/src/editor/page.tsx`：流程库页签、新建、编辑器标签
- `dsh-plugin/src/editor/inspector.tsx`：引用目标分组
- `dsh-plugin/src/editor/styles.ts`：流程库页签样式
- `tests/*`：迁移、存储、快照、校验、引擎、Host 路由

## 7. 测试

- `tests/store.test.ts`
  - `kind` 落库、JSON 镜像、按类型过滤、老 JSON 缺 `kind` 的读取兜底。
  - `buildSubSnapshot` 对配置用自己的 agents，对普通子图继承父图。
- `tests/validate.test.ts`
  - `kind` 非法硬拒、`flowRef` 引用自身硬拒、配置无角色给警告。
- `tests/p1-multi-agent.test.ts`
  - 主流程引用配置 → child 的 `flow_id` 是配置 id → 配置内部 `subagent` 节点的 preamble 带配置自己的角色章程。
  - 配置入口直接是 `subagent` 时，child 第一次领步自动派发（`bootstrapEntry`），不会卡在 running。
- `tests/host-routes.test.ts`
  - `GET /aiworkflow/flows?kind=agent|flow` 过滤正确。

## 8. 已知边界 / 后续

- 配置不强制 `agents` 非空（只给警告）；纯子图配置也能跑，但内部节点不能用角色。
- 引用节点自己的 `role` 仍然要在**主流程**的 `agents` 里存在；配置里的角色只对配置内部节点生效。若后续需要「配置本身有主身份」，可加 `Flow.primaryRole` 并把引用节点的默认 role 指过去。
- 配置列表里暂不显示「被哪些流程引用」，删除前只能靠人工确认。
- 配置仍然存在 `flows` 表：`flow action=list` 会同时返回两类；工具侧要区分时看 `kind`。
