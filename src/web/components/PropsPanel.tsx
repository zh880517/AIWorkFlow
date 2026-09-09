import { useRef, type ReactNode, type RefObject } from 'react';
import type { Flow, FlowNode } from '../../core/types.js';
import { NODE_META, nodeTitle, removeNodes, setEntry, updateNode } from '../dsl.js';
import type { FlowMeta } from '../api.js';

export interface PropsPanelProps {
  flow: Flow;
  nodeId: string;
  flowList: FlowMeta[];
  /** 该图历史 run 学到的各节点 payload 字段名（插值提示用） */
  payloadFields: Record<string, string[]>;
  onChange: (updater: (flow: Flow) => Flow, group?: string) => void;
}

export function PropsPanel({ flow, nodeId, flowList, payloadFields, onChange }: PropsPanelProps) {
  const node = flow.nodes.find((n) => n.id === nodeId);
  const instrRef = useRef<HTMLTextAreaElement | null>(null);
  const extraRef = useRef<HTMLTextAreaElement | null>(null);
  const aggRef = useRef<HTMLTextAreaElement | null>(null);
  if (node === undefined) return <div className="panel-empty">节点不存在</div>;
  const meta = NODE_META[node.type];
  const patch = (p: Record<string, unknown>, group?: string) => onChange((f) => updateNode(f, nodeId, p), group);

  return (
    <div className="props-panel">
      <div className="prop-head" style={{ background: meta.color }}>
        {meta.icon} {meta.label}节点
      </div>

      <Field label="标题">
        <input className="input" value={node.title ?? ''} placeholder="画布上显示的名字" onChange={(e) => patch({ title: e.target.value }, `title:${node.id}`)} />
      </Field>

      {node.type !== 'end' && (
        <Field label={node.type === 'prompt' ? '指令（必填）' : '补充说明（可选）'}>
          <textarea
            ref={instrRef}
            className="input mono"
            rows={4}
            value={node.instruction ?? ''}
            placeholder={node.type === 'prompt' ? '描述干什么、怎么判断。可用 {{节点.字段}} 引用之前的结果' : '可选补充说明'}
            onChange={(e) => patch({ instruction: e.target.value }, `instr:${node.id}`)}
          />
          <InterpHints flow={flow} selfId={node.id} payloadFields={payloadFields} areaRef={instrRef} />
        </Field>
      )}

      {node.type === 'tool' && (
        <>
          <Field label="工具（必填）">
            <input className="input mono" value={node.toolName} placeholder="如 Bash、Read" onChange={(e) => patch({ toolName: e.target.value }, `tool:${node.id}`)} />
          </Field>
          <Field label="参数">
            <ParamsEditor value={node.params} onChange={(params) => patch({ params }, `params:${node.id}`)} />
          </Field>
        </>
      )}

      {node.type === 'subagent' && (
        <>
          <Field label="模式">
            <select className="input" value={node.mode} onChange={(e) => patch({ mode: e.target.value })}>
              <option value="inline">inline（单节点提示）</option>
              <option value="subflow">subflow（内嵌子图）</option>
              <option value="flowRef">flowRef（引用别的图）</option>
            </select>
          </Field>
          <Field label="给子代理的提示（必填）">
            <textarea ref={extraRef} className="input mono" rows={3} value={node.extraPrompt} onChange={(e) => patch({ extraPrompt: e.target.value }, `extra:${node.id}`)} />
            <InterpHints flow={flow} selfId={node.id} payloadFields={payloadFields} areaRef={extraRef} note="fan-out 时可用 {{item}} 引用各自条目" />
          </Field>
          {node.mode === 'flowRef' && (
            <Field label="引用的流程（必填）">
              <select className="input" value={node.flowRef ?? ''} onChange={(e) => patch({ flowRef: e.target.value === '' ? undefined : e.target.value })}>
                <option value="">（请选择）</option>
                {flowList
                  .filter((f) => f.id !== flow.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {node.mode === 'subflow' && (
            <details className="advanced">
              <summary>子图定义（高级）</summary>
              <textarea
                className="input mono"
                rows={8}
                defaultValue={JSON.stringify(node.subflow ?? { entry: '', nodes: [] }, null, 2)}
                onBlur={(e) => {
                  try {
                    patch({ subflow: JSON.parse(e.target.value === '' ? '{"entry":"","nodes":[]}' : e.target.value) });
                    e.target.classList.remove('invalid');
                  } catch {
                    e.target.classList.add('invalid');
                  }
                }}
              />
            </details>
          )}
          <Field label="并行派发（可选）">
            <div className="fanout-row">
              <input className="input mono" placeholder="来源，如 {{节点.字段}}" value={node.fanOut?.from ?? ''} onChange={(e) => patchFanOut(patch, node, { from: e.target.value, count: undefined }, `fanout:${node.id}`)} />
              <input className="input" type="number" min={1} placeholder="固定数量" value={node.fanOut?.count ?? ''} onChange={(e) => patchFanOut(patch, node, { count: e.target.value === '' ? undefined : Number(e.target.value), from: undefined }, `fanout:${node.id}`)} />
              <input className="input" type="number" min={1} placeholder="数量上限" value={node.fanOut?.max ?? ''} onChange={(e) => patchFanOut(patch, node, { max: e.target.value === '' ? undefined : Number(e.target.value) }, `fanout:${node.id}`)} />
            </div>
          </Field>
        </>
      )}

      {node.type === 'gate' && (
        <Field label="卡点问题（必填）">
          <textarea className="input" rows={2} value={node.question} onChange={(e) => patch({ question: e.target.value }, `question:${node.id}`)} />
        </Field>
      )}

      {node.type === 'join' && (
        <>
          <Field label="等待的并行节点（可选）">
            <select className="input" value={node.waitFor ?? ''} onChange={(e) => patch({ waitFor: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">（等待全部子任务）</option>
              {flow.nodes
                .filter((n) => n.id !== node.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {nodeTitle(flow, n.id)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="汇总指令（必填）">
            <textarea ref={aggRef} className="input mono" rows={3} value={node.aggregateInstruction} onChange={(e) => patch({ aggregateInstruction: e.target.value }, `agg:${node.id}`)} />
            <InterpHints flow={flow} selfId={node.id} payloadFields={payloadFields} areaRef={aggRef} />
          </Field>
        </>
      )}

      {node.type === 'end' && (
        <Field label="结局">
          <select className="input" value={node.outcome} onChange={(e) => patch({ outcome: e.target.value })}>
            <option value="success">成功</option>
            <option value="fail">失败</option>
          </select>
        </Field>
      )}

      {node.type !== 'end' && (
        <>
          <div className="prop-sep" />
          <Field label="迭代上限（环上建议设置）">
            <input className="input" type="number" min={1} value={node.iterationLimit ?? ''} onChange={(e) => patch({ iterationLimit: e.target.value === '' ? undefined : Number(e.target.value) }, `limit:${node.id}`)} />
          </Field>
          <Field label="撞上限后跳转到">
            <select className="input" value={node.onLimitExceeded ?? ''} onChange={(e) => patch({ onLimitExceeded: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">（不设，撞上限判失败）</option>
              {flow.nodes
                .filter((n) => n.id !== node.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {nodeTitle(flow, n.id)}
                  </option>
                ))}
            </select>
          </Field>
        </>
      )}

      <div className="prop-sep" />
      {node.type !== 'end' && (
        <button className="btn" disabled={node.id === flow.entry} onClick={() => onChange((f) => setEntry(f, node.id))}>
          {node.id === flow.entry ? '当前为开始节点' : '设为开始'}
        </button>
      )}
      <button className="btn danger" onClick={() => onChange((f) => removeNodes(f, [node.id]))}>删除此节点</button>
    </div>
  );
}

// ---- 局部操作（统一走 dsl.ts 变更） ----

/** 参数编辑器：键值对行（值按 JSON 解析，失败按字符串），不暴露原始 JSON */
function ParamsEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown> | undefined;
  onChange: (params: Record<string, unknown> | undefined) => void;
}) {
  const entries = Object.entries(value ?? {});
  const toText = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));
  const parseVal = (s: string): unknown => {
    try {
      const parsed = JSON.parse(s);
      return parsed !== null && typeof parsed === 'object' ? s : parsed;
    } catch {
      return s;
    }
  };
  const write = (next: Array<[string, unknown]>) => {
    const filtered = next.filter(([k]) => k.trim() !== '');
    onChange(filtered.length === 0 ? undefined : Object.fromEntries(filtered));
  };

  return (
    <div className="params-list">
      {entries.map(([key, val], i) => (
        <div className="param-row" key={i}>
          <input
            className="input mono"
            value={key}
            placeholder="名称"
            onChange={(e) => write(entries.map(([k, v], j) => (j === i ? [e.target.value, v] : [k, v])))}
          />
          <input
            className="input mono"
            value={toText(val)}
            placeholder="值"
            onChange={(e) => write(entries.map(([k, v], j) => (j === i ? [k, parseVal(e.target.value)] : [k, v])))}
          />
          <button className="btn small danger" onClick={() => write(entries.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => write([...entries, [`参数${entries.length + 1}`, '']])}>
        + 加参数
      </button>
    </div>
  );
}

function patchFanOut(
  patch: (p: Record<string, unknown>, group?: string) => void,
  node: FlowNode & { fanOut?: { from?: string; count?: number; max?: number } },
  change: { from?: string; count?: number; max?: number },
  group?: string,
): void {
  const current = node.fanOut ?? {};
  const next = { ...current, ...change };
  if (next.from === '') next.from = undefined;
  if (next.count !== undefined && !Number.isFinite(next.count)) next.count = undefined;
  if (next.max !== undefined && !Number.isFinite(next.max)) next.max = undefined;
  if (next.from === undefined && next.count === undefined && next.max === undefined) {
    patch({ fanOut: undefined }, group);
  } else {
    patch({ fanOut: next }, group);
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <div className="field-body">{children}</div>
    </label>
  );
}

/** 插值提示（阶段 8）：前序节点 + 历史 run 学到的 payload 字段名；点 chip 在光标处插入 token */
function InterpHints({
  flow,
  selfId,
  payloadFields,
  areaRef,
  note,
}: {
  flow: Flow;
  selfId: string;
  payloadFields: Record<string, string[]>;
  areaRef: RefObject<HTMLTextAreaElement | null>;
  note?: string;
}) {
  const others = flow.nodes.filter((n) => n.id !== selfId);
  if (others.length === 0) return null;
  const insert = (token: string): void => {
    const el = areaRef.current;
    if (el === null) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    // React 受控组件：走原生 setter + 派发 input 事件才能触发 onChange
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter !== undefined) setter.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const caret = start + token.length;
    el.focus();
    el.setSelectionRange(caret, caret);
  };
  return (
    <details className="interp-hints">
      <summary>插值提示（引用之前节点的结果）</summary>
      {note !== undefined && <div className="interp-note">{note}</div>}
      {others.map((n) => {
        const fields = payloadFields[n.id] ?? [];
        return (
          <div className="interp-node" key={n.id}>
            <span className="interp-node-name">
              {nodeTitle(flow, n.id)} <code>{n.id}</code>
            </span>
            {fields.length > 0 ? (
              <span className="interp-chips">
                {fields.map((f) => (
                  <button
                    type="button"
                    className="interp-chip"
                    key={f}
                    title="点击插入到光标处"
                    onClick={() => insert(`{{${n.id}.payload.${f}}}`)}
                  >
                    {`{{${n.id}.payload.${f}}}`}
                  </button>
                ))}
              </span>
            ) : (
              <span className="interp-empty">{'这张图跑过一次后，这里会提示该节点 payload 的具体字段'}</span>
            )}
          </div>
        );
      })}
    </details>
  );
}
