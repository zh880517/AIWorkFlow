import type { ValidationResult } from '../../core/validate.js';

export interface ValidationPanelProps {
  validation: ValidationResult | null;
  onSelectNode: (nodeId: string) => void;
}

/** 校验结果：硬拒（红）阻止保存；警告（黄）允许保存。点问题跳转节点。 */
export function ValidationPanel({ validation, onSelectNode }: ValidationPanelProps) {
  if (validation === null) {
    return <div className="panel-empty">没有加载流程</div>;
  }
  const { errors, warnings, ok } = validation;
  return (
    <div className="validation-panel">
      {ok && warnings.length === 0 && <div className="val-banner ok">✓ 校验通过，无警告</div>}
      {ok && warnings.length > 0 && <div className="val-banner warn">⚠ 校验通过，有 {warnings.length} 条警告</div>}
      {!ok && <div className="val-banner err">✕ 存在 {errors.length} 处硬拒，保存将被拒绝</div>}
      <div className="val-list">
        {errors.map((issue, i) => (
          <IssueRow key={`e${i}`} issue={issue} onSelectNode={onSelectNode} />
        ))}
        {warnings.map((issue, i) => (
          <IssueRow key={`w${i}`} issue={issue} onSelectNode={onSelectNode} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  onSelectNode,
}: {
  issue: ValidationResult['errors'][number];
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <button
      className={`val-item ${issue.severity === 'error' ? 'err' : 'warn'}`}
      onClick={() => issue.nodeId !== undefined && onSelectNode(issue.nodeId)}
      title={issue.nodeId !== undefined ? `定位到 ${issue.nodeId}` : undefined}
    >
      <span className="val-code">{issue.code}</span>
      <span className="val-msg">{issue.message}</span>
    </button>
  );
}
