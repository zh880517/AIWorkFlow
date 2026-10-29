// 流程 DSL 类型定义（设计文档 §4）

export type NodeType = 'prompt' | 'tool' | 'subagent' | 'gate' | 'join' | 'end';

export type SubagentMode = 'inline' | 'subflow' | 'flowRef';

export type EndOutcome = 'success' | 'fail';

export interface Branch {
  id: string;
  /** 自然语言条件；"*" 表示 default 分支 */
  condition: string;
  /** 目标节点 id；由服务端在下发给 Agent 时剥离 */
  to: string;
  /** 该分支的连线起点出口 id（面板编辑器多出口用）；缺省 = 默认出口。引擎忽略 */
  outlet?: string;
  /**
   * 可选：服务端可判定的条件（如 "{{review.payload.verdict}} == 'pass'"）。
   * 命中时不再依赖 Agent 选 branchId；语法见 validate.ts / 设计文档 §4.2.3。
   */
  when?: string;
}

/** 角色定义（Flow 级，一次编写、每轮注入） */
export interface AgentDef {
  id: string;
  name: string;
  /** 角色章程：职责、边界、完成标准。拼进 child preamble */
  charter: string;
  /** 声明产物 key；只用于校验与面板，运行时不强制 */
  produces?: string[];
  consumes?: string[];
}

/** complete_step 提交的产物条目 */
export interface ArtifactInput {
  key: string;
  summary?: string;
  /** 产物文件路径；正文以文件为准 */
  path?: string;
  /** 可选的小快照（<=8KB），便于面板回看 */
  content?: string;
}

/** 产物只读视图（最新版本） */
export interface ArtifactRef {
  key: string;
  version: number;
  runId: string;
  nodeId: string;
  role: string | null;
  summary: string | null;
  path: string | null;
  content: string | null;
  createdAt: string;
}

export interface GateOption {
  id: string;
  label: string;
}

/** fan-out 来源：from 为插值表达式（如 "{{n3.payload.modules}}"），count 为固定数量；二者给一 */
export interface FanOutConfig {
  from?: string;
  count?: number;
  max?: number;
}

export interface FlowNodeBase {
  id: string;
  type: NodeType;
  title?: string;
  /** 指令文本，可含 {{nodeId.payload.field}} 插值；prompt 节点必填，其余可选 */
  instruction?: string;
  /** 节点级迭代上限，挂在 (run_id, node_id) 上 */
  iterationLimit?: number;
  /** 回路标识：同一回路的节点共用一个 loopId；引擎按回路计数 */
  loopId?: string;
  /** 回路最大轮次：配在 loopId 的控制器节点上；控制器每执行一次算一轮 */
  maxRounds?: number;
  /** 撞上限后的逃生节点 id */
  onLimitExceeded?: string;
  /** 无 branches 时的唯一后继；与 branches 互斥。两者皆无 = 隐式 end */
  next?: string;
  branches?: Branch[];
  /** 自定义出口（面板编辑器用）：id + 出口上编辑的条件文本；引擎忽略，连线时同步到分支 */
  outlets?: OutletDef[];
}

export interface PromptNode extends FlowNodeBase {
  type: 'prompt';
  instruction: string;
}

export interface ToolNode extends FlowNodeBase {
  type: 'tool';
  toolName: string;
  params?: Record<string, unknown>;
}

export interface SubagentNode extends FlowNodeBase {
  type: 'subagent';
  extraPrompt: string;
  mode: SubagentMode;
  /** mode = subflow 时的内嵌子图 */
  subflow?: SubflowDef;
  /** mode = flowRef 时引用的图 id；启动 run 时递归解析进快照 */
  flowRef?: string;
  fanOut?: FanOutConfig;
  /** 角色 id，引用 flow.agents；省略 = 无角色（兼容老图） */
  role?: string;
  /** new（默认，一次性）| role（同角色共享线程）| 自定义线程 key */
  thread?: 'new' | 'role' | string;
  /** 声明本轮产出/消费的产物 key；校验与面板用，运行时不强制 */
  produces?: string[];
  consumes?: string[];
  /** 给子 Agent 的汇报契约（自然语言），拼进 preamble */
  reportHint?: string;
}

/** 内嵌子图（subflow 模式） */
export interface SubflowDef {
  /** 展示名；只是面板元数据，引擎不读 */
  name?: string;
  entry: string;
  maxSteps?: number;
  nodes: FlowNode[];
  /** 面板编辑器专用布局元数据；不属于 DSL 语义，校验与引擎忽略 */
  _ui?: {
    positions?: Record<string, { x: number; y: number }>;
  };
}

/** 自定义出口（面板编辑器用，引擎忽略）：id + 出口上编辑的条件文本 */
export interface OutletDef {
  id: string;
  condition?: string;
}

export interface GateNode extends FlowNodeBase {
  type: 'gate';
  question: string;
  options: GateOption[];
}

export interface JoinNode extends FlowNodeBase {
  type: 'join';
  /** 要等待的 fan-out 节点 id；缺省等待该 run 的全部 child run */
  waitFor?: string;
  aggregateInstruction: string;
}

export interface EndNode extends FlowNodeBase {
  type: 'end';
  outcome: EndOutcome;
}

export type FlowNode =
  | PromptNode
  | ToolNode
  | SubagentNode
  | GateNode
  | JoinNode
  | EndNode;

export interface Flow {
  /** 图 id，同时是 flows/<id>.json 的文件名 */
  id: string;
  /** 展示名 */
  name: string;
  description?: string;
  entry: string;
  /** run 级全局步数上限，默认 200 */
  maxSteps?: number;
  /** 角色表：subagent.role 引用；一次编写、每轮注入 */
  agents?: AgentDef[];
  nodes: FlowNode[];
  /** 面板编辑器专用布局元数据；不属于 DSL 语义，校验与引擎忽略 */
  _ui?: {
    positions?: Record<string, { x: number; y: number }>;
  };
}

export const DEFAULT_MAX_STEPS = 200;

/** 运行时快照（copy-on-run）：主图 + 递归解析后的 flowRef 子图，内容寻址去重 */
export interface FlowSnapshot {
  rootFlowId: string;
  /** 角色表随快照钉死；子快照从父快照继承，保证 child 也能查到角色章程 */
  agents?: AgentDef[];
  /** key 为 flow id；rootFlowId 对应主图 */
  flows: Record<string, Flow>;
}

export function getNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}
