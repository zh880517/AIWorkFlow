import { useContext, useState, type DragEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_META, type FlowRFNode } from '../dsl.js';
import { NodeActionsContext, type NodeActions } from './nodeActions.js';
import type { FlowNode } from '../../core/types.js';

export function FlowNodeCard({ data, selected }: NodeProps<FlowRFNode>) {
  const node = data.flowNode;
  const meta = NODE_META[node.type];
  const actions = useContext(NodeActionsContext);
  const branches = node.branches ?? [];
  const defaultBranch = branches.find((b) => b.outlet === undefined);
  const defaultOccupied = node.next !== undefined || defaultBranch !== undefined;
  const defaultTarget = node.next ?? defaultBranch?.to;
  // 列表编辑状态（参考 VisualBridge DynamicPortRow）：选中行 + 拖动排序
  const [selectedOutlet, setSelectedOutlet] = useState<string | null>(null);
  const [dragArmed, setDragArmed] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ outlet: string; overIndex: number; before: boolean } | null>(null);

  const outlets = node.outlets ?? [];
  const readOnly = actions?.readOnly === true;

  const handleAdd = () => {
    const id = actions?.addOutlet(node.id, selectedOutlet ?? undefined);
    if (id !== null && id !== undefined) setSelectedOutlet(id);
  };
  const handleRemoveSelected = () => {
    if (selectedOutlet === null) return;
    actions?.removeOutlet(node.id, selectedOutlet);
    setSelectedOutlet(null);
  };

  const onRowDragStart = (e: DragEvent<HTMLDivElement>, outlet: string) => {
    e.dataTransfer.setData('text/plain', outlet);
    e.dataTransfer.effectAllowed = 'move';
    setDrag({ outlet, overIndex: -1, before: false });
  };
  const onRowDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (drag === null || drag.outlet === outlets[index]?.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({ ...drag, overIndex: index, before: e.clientY < rect.top + rect.height / 2 });
  };
  const onRowDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (drag === null) return;
    // toIndex = 移除拖动项之后的插入位置
    const from = outlets.findIndex((o) => o.id === drag.outlet);
    let to = drag.overIndex + (drag.before ? 0 : 1);
    if (from !== -1 && from < to) to -= 1;
    actions?.moveOutlet(node.id, drag.outlet, to);
    setDrag(null);
    setDragArmed(null);
  };

  return (
    <div className={`flow-node type-${node.type} ${selected ? 'selected' : ''} ${data.isEntry ? 'is-entry' : ''}`}>
      {/* 开始节点没有入线 */}
      {!data.isEntry && <Handle type="target" position={Position.Left} isConnectableStart={false} />}
      <div className="fn-header" style={{ background: meta.color }}>
        <span className="fn-icon">{meta.icon}</span>
        <span className="fn-type">{meta.label}</span>
        {node.iterationLimit !== undefined && (
          <span className="fn-limit" title={`迭代上限 ${node.iterationLimit}`}>↻{node.iterationLimit}</span>
        )}
      </div>
      <div className="fn-body">
        <div className="fn-title">{node.title?.trim() || meta.label}</div>
        <div className="fn-sub">{subtitle(node)}</div>
        {data.isEntry && <div className="fn-entry-badge">▶ 开始</div>}
      </div>
      {node.type !== 'end' && (
        <div className="fn-outlets">
          {/* 统一的增删图标按钮：＋ 插入到选中项之后；✕ 删除选中项（选中才显示） */}
          <div className="fn-outlet-header">
            <span className="fn-outlet-title">{node.type === 'gate' ? '选项' : '出口'}</span>
            <button className="fn-icon-btn nodrag" title="添加出口（插入到选中项之后）" onClick={handleAdd} disabled={readOnly}>
              ＋
            </button>
            {selectedOutlet !== null && (
              <button
                className="fn-icon-btn danger nodrag"
                title="删除选中的出口（其上的连线一并删除）"
                onClick={handleRemoveSelected}
                disabled={readOnly}
              >
                ✕
              </button>
            )}
          </div>
          {(node.type === 'gate'
            ? (node.options ?? []).map((o) => ({ id: o.id, condition: o.label }))
            : outlets
          ).map((outlet, i) => {
            const branch = branches.find((b) => b.outlet === outlet.id);
            const isSelected = selectedOutlet === outlet.id;
            const dropBefore = drag !== null && drag.overIndex === i && drag.before && drag.outlet !== outlet.id;
            const dropAfter = drag !== null && drag.overIndex === i && !drag.before && drag.outlet !== outlet.id;
            return (
              <div
                key={outlet.id}
                className={`fn-outlet-row${branch !== undefined ? ' occupied' : ''}${isSelected ? ' selected' : ''}${dropBefore ? ' drop-before' : ''}${dropAfter ? ' drop-after' : ''}`}
                draggable={dragArmed === outlet.id && !readOnly}
                onDragStart={(e) => onRowDragStart(e, outlet.id)}
                onDragOver={(e) => onRowDragOver(e, i)}
                onDrop={onRowDrop}
                onDragEnd={() => {
                  setDrag(null);
                  setDragArmed(null);
                }}
                onClick={() => setSelectedOutlet(isSelected ? null : outlet.id)}
              >
                <span
                  className="fn-outlet-grip nodrag"
                  title={readOnly ? undefined : '拖动调整顺序'}
                  onPointerDown={() => {
                    if (!readOnly) setDragArmed(outlet.id);
                  }}
                  onPointerUp={() => setDragArmed(null)}
                >
                  ⠿
                </span>
                <span className="fn-outlet-name">{node.type === 'gate' ? '选项' : '出口'} {i + 1}</span>
                <input
                  className="fn-outlet-cond nodrag"
                  value={outlet.condition ?? ''}
                  placeholder={node.type === 'gate' ? '选项文案（展示给用户）' : '满足什么条件走这条（AI 判断）'}
                  title={branch !== undefined ? `→ ${actions?.titleOf(branch.to) ?? branch.to}` : '未连接：先写好条件，连线时自动带上'}
                  onChange={(e) => actions?.setOutletCondition(node.id, outlet.id, e.target.value)}
                  disabled={readOnly}
                />
                <Handle type="source" position={Position.Right} id={outlet.id} className="handle-outlet" />
              </div>
            );
          })}
          {/* 默认出口：兜底出口，不填条件（顺序边=无条件；分支=默认 * ）。卡点没有默认出口（选项即出口） */}
          {node.type !== 'gate' && (
          <div className={`fn-outlet-row default${defaultOccupied ? ' occupied' : ''}`}>
            <span className="fn-outlet-grip placeholder">⠿</span>
            <span className="fn-outlet-name">默认</span>
            {defaultOccupied && defaultTarget !== undefined ? (
              <span className="fn-outlet-hint">
                {node.next !== undefined ? '无条件' : '其他条件都不满足时'} → {actions?.titleOf(defaultTarget) ?? defaultTarget}
              </span>
            ) : (
              <span className="fn-outlet-hint">未连接</span>
            )}
            <Handle type="source" position={Position.Right} />
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function subtitle(node: FlowNode): string {
  switch (node.type) {
    case 'tool':
      return node.toolName || '未指定工具';
    case 'subagent':
      return node.mode;
    case 'gate':
      return `选项 ${node.options?.length ?? 0} 个`;
    case 'end':
      return node.outcome === 'success' ? '成功出口' : '失败出口';
    default:
      return '';
  }
}
