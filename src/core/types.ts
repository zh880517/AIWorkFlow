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
}

/** 内嵌子图（subflow 模式） */
export interface SubflowDef {
  entry: string;
  maxSteps?: number;
  nodes: FlowNode[];
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
  /** key 为 flow id；rootFlowId 对应主图 */
  flows: Record<string, Flow>;
}

export function getNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}
