// 公用层：流程图 DSL 的只读类型视图。
//
// 这里用 `export type ... from` 复用主工程的定义，保证插件和主工程永远看到同一份契约；
// 类型在编译期被擦除，运行时不会把 src/ 打进插件 bundle。
// 后续若把 DSL 类型整体迁到 shared/，只需把这里的再导出改成定义本身，使用方无需改动。
export type {
  NodeType,
  SubagentMode,
  EndOutcome,
  Branch,
  GateOption,
  FanOutConfig,
  FlowNodeBase,
  PromptNode,
  ToolNode,
  SubagentNode,
  SubflowDef,
  OutletDef,
  GateNode,
  JoinNode,
  EndNode,
  FlowNode,
  Flow,
  FlowSnapshot,
} from '../../src/core/types.js';
