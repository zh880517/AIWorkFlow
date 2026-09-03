import { createContext } from 'react';

/** 节点卡片上的操作回调（由 FlowCanvas 提供，避免 node data 携带函数） */
export interface NodeActions {
  /** 添加出口（插入到 anchor 之后，缺省追加末尾），返回新出口 id */
  addOutlet: (nodeId: string, afterOutlet?: string) => string | null;
  removeOutlet: (nodeId: string, outlet: string) => void;
  /** 出口列表重排（id 稳定，连线绑定不变） */
  moveOutlet: (nodeId: string, outlet: string, toIndex: number) => void;
  /** 编辑出口上的条件（未连接也可编辑，连线时同步到分支） */
  setOutletCondition: (nodeId: string, outlet: string, condition: string) => void;
  /** 节点显示名：标题优先，缺省用类型名 */
  titleOf: (nodeId: string) => string;
  /** 只读（预览页）：出口行禁用编辑与排序 */
  readOnly?: boolean;
}

export const NodeActionsContext = createContext<NodeActions | null>(null);
