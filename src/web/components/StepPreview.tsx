import type { ReactNode } from 'react';
import type { Flow } from '../../core/types.js';
import { NODE_META } from '../dsl.js';

export interface StepPreviewProps {
  flow: Flow;
  nodeId: string;
}

/**
 * 预览模式：模拟服务端单步下发视图（设计文档 §6.2）。
 * 注意两处刻意省略：branches 不含 to、progress 不含总数——降噪是设计决策。
 */
export function StepPreview({ flow, nodeId }: StepPreviewProps) {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return <div className="panel-empty">节点不存在</div>;
  const meta = NODE_META[node.type];

  const branches = (node.branches ?? []).map((b) => ({
    id: b.id,
    condition: b.condition === '*' ? '（默认）' : b.condition,
  }));

  return (
    <div className="props-panel step-preview">
      <div className="prop-head" style={{ background: meta.color }}>
        {meta.icon} 单步下发预览 · kind: {node.type}
      </div>
      <p className="hint">这是该节点执行时 Agent 实际收到的内容（插值在运行时才渲染）。</p>

      <Field label="nodeId">
        <code>{node.id}</code>
      </Field>
      <Field label="title">
        <code>{node.title ?? '—'}</code>
      </Field>
      <Field label="instruction">
        <pre className="pre">{node.instruction?.trim() !== '' ? node.instruction : '（无）'}</pre>
      </Field>

      {node.type === 'tool' && (
        <Field label="tool">
          <pre className="pre">{JSON.stringify({ name: node.toolName, params: node.params ?? {} }, null, 2)}</pre>
        </Field>
      )}
      {node.type === 'subagent' && (
        <Field label="children">
          <pre className="pre">{JSON.stringify({ mode: node.mode, extraPrompt: node.extraPrompt, fanOut: node.fanOut }, null, 2)}</pre>
        </Field>
      )}
      {node.type === 'gate' && (
        <Field label="gate">
          <pre className="pre">{JSON.stringify({ question: node.question, options: node.options }, null, 2)}</pre>
        </Field>
      )}
      {node.type === 'join' && (
        <Field label="aggregateInstruction">
          <pre className="pre">{node.aggregateInstruction || '（无）'}</pre>
        </Field>
      )}
      {node.type === 'end' && (
        <Field label="outcome">
          <code>{node.outcome}</code>
        </Field>
      )}

      {branches.length > 0 && (
        <Field label="branches（注意：不含 to）">
          <pre className="pre">{JSON.stringify(branches, null, 2)}</pre>
        </Field>
      )}
      <Field label="discipline">
        <pre className="pre">做完必须调 complete_step 并给出 branchId。</pre>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="field-body">{children}</div>
    </div>
  );
}
