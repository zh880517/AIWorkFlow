// 右侧属性面板：只编辑当前节点/当前层的字段，其余图结构由画布上的连线表达。
// 排版约定：区块标题 > 加粗字段名 > 控件 > 灰色说明，说明文字单独一行，不塞进 label。
import * as React from 'react';
import type { AgentDef, FlowNode, GateOption, SubagentMode, SubagentNode } from '@shared/index.js';
import type { FlowMeta } from './api.js';
import { typeLabel, makeSubflow, type CanvasEdge, type CanvasNode } from './model.js';

export interface InspectorProps {
  body: FlowNode | undefined;
  canvasNode: CanvasNode | undefined;
  /** 画布上的全部节点：waitFor / onLimitExceeded 下拉用 */
  nodes: CanvasNode[];
  /** 流程库列表（已排除当前图）：flowRef 下拉用 */
  flows: FlowMeta[];
  /** 全图角色表：subagent.role 下拉与角色编辑用 */
  agents: AgentDef[];
  /** 历史 run 学到的 payload 字段名（插值提示用） */
  payloadFields: Record<string, string[]>;
  edges: CanvasEdge[];
  isEntry: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onCondition: (edgeId: string, value: string) => void;
  onWhen: (edgeId: string, value: string) => void;
  onAgentsChange: (agents: AgentDef[]) => void;
  /** 打开当前 subagent 节点的内嵌子图画布 */
  onOpenSubflow: (nodeId: string) => void;
  onSetEntry: () => void;
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps): React.ReactElement {
  return (
    <div className="wf-field">
      <span className="wf-label">{label}</span>
      {children}
      {hint !== undefined && <span className="wf-hint">{hint}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="wf-section">
      <div className="wf-section-title">{title}</div>
      {children}
    </section>
  );
}

const MODE_HINTS: Record<SubagentMode, string> = {
  inline: '在同一个会话里派子 Agent 执行一个子任务',
  subflow: '子图直接嵌在主图里，点「打开子图」编辑；运行时 child 跑这段子图',
  flowRef: '引用另一张已存在的图，启动 run 时递归解析进快照',
};

/** 空串 / 非正整数都按「不设」处理，避免把 NaN 写进 DSL */
function positiveInt(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

function nodeLabel(node: CanvasNode): string {
  return `${node.data.title} · ${typeLabel(node.data.kind)}`;
}

/** 逗号/空白分隔的产物 key 列表 ↔ 输入框文本 */
function keysText(keys: string[] | undefined): string {
  return (keys ?? []).join(', ');
}

function splitKeys(text: string): string[] | undefined {
  const keys = text
    .split(/[,，\s]+/)
    .map((key) => key.trim())
    .filter((key) => key !== '');
  return keys.length === 0 ? undefined : keys;
}

export function Inspector(props: InspectorProps): React.ReactElement {
  const { body } = props;
  // 插值提示要往光标处插 token，必须拿到三个文本域实例（Hooks 不能放在条件 return 之后）
  const instrRef = React.useRef<HTMLTextAreaElement | null>(null);
  const extraRef = React.useRef<HTMLTextAreaElement | null>(null);
  const aggRef = React.useRef<HTMLTextAreaElement | null>(null);
  if (body === undefined) {
    return (
      <div className="wf-insp-empty">
        <div className="wf-insp-empty-title">未选中节点</div>
        <div className="wf-hint">点选画布上的节点编辑属性；从节点右侧圆点拖线到另一个节点即可连边。</div>
        <div className="wf-hint">右键画布：在指针处新建 / 粘贴；右键节点：复制、设为入口、删除。</div>
        <div className="wf-hint">快捷键：Ctrl+Z 撤销、Ctrl+Shift+Z 重做、Ctrl+S 保存、Delete 删除选中。</div>
      </div>
    );
  }
  const patch = (value: Record<string, unknown>): void => props.onPatch(value);
  const multi = props.edges.length > 1;
  const options = body.type === 'gate' ? (body.options ?? []) : [];
  /** 画布上先拉了线、还没归属任何选项的出边（提示用户去认领或删掉） */
  const loose = body.type === 'gate' ? props.edges.filter((edge) => edge.data?.outlet === undefined) : [];
  const others = props.nodes.filter((node) => node.id !== body.id);
  const danglingRef = (id: string | undefined): string | undefined =>
    id !== undefined && id !== '' && !props.nodes.some((node) => node.id === id) ? id : undefined;

  return (
    <React.Fragment>
      <div className="wf-insp-head">
        <span className="wf-kind" data-kind={body.type}>
          {typeLabel(body.type)}
        </span>
        <code className="wf-id">{body.id}</code>
        {props.isEntry && <span className="wf-chip">入口</span>}
      </div>

      <Section title="基本信息">
        <Field label="标题" hint="显示在画布节点上；留空则显示节点 id">
          <input className="wf-input" value={body.title ?? ''} onChange={(event) => patch({ title: event.target.value })} />
        </Field>
      </Section>

      {body.type === 'prompt' && (
        <Section title="指令内容">
          <Field label="指令" hint="这一步要 Agent 做什么；可用 {{nodeId.payload.field}} 插值">
            <textarea
              ref={instrRef}
              className="wf-area"
              value={body.instruction ?? ''}
              onChange={(event) => patch({ instruction: event.target.value })}
              placeholder="例如：读 docs/README.md，列出必读文档"
            />
            <InterpHints
              nodes={others}
              payloadFields={props.payloadFields}
              areaRef={instrRef}
            />
          </Field>
        </Section>
      )}

      {body.type === 'tool' && (
        <Section title="工具调用">
          <Field label="工具名" hint="Agent 可调用的工具名，例如 web_search、read">
            <input className="wf-input" value={body.toolName ?? ''} onChange={(event) => patch({ toolName: event.target.value })} />
          </Field>
          <Field label="参数" hint="键值对；值能按 JSON 解析就当 JSON，否则按字符串。会作为 view.tool.params 下发给 Agent">
            <ParamsEditor value={body.params} onChange={(params) => patch({ params })} />
          </Field>
        </Section>
      )}

      {body.type === 'subagent' && (
        <Section title="子 Agent">
          <Field label="附加指令" hint="追加给子 Agent 的上下文；主指令来自上游节点">
            <textarea
              ref={extraRef}
              className="wf-area"
              value={body.extraPrompt ?? ''}
              onChange={(event) => patch({ extraPrompt: event.target.value })}
              placeholder="例如：只读不写，产出不超过 20 行的结论"
            />
            <InterpHints
              nodes={others}
              payloadFields={props.payloadFields}
              areaRef={extraRef}
            />
          </Field>
          <Field label="执行模式" hint={MODE_HINTS[body.mode] ?? ''}>
            <select
              className="wf-input"
              value={body.mode}
              onChange={(event) => {
                const mode = event.target.value as SubagentMode;
                if (mode === 'subflow' && body.subflow === undefined) {
                  // 切到内嵌子图时先给一张最小合法的「开始 → 结束」，否则保存必被拒
                  patch({ mode, subflow: makeSubflow(`${body.title?.trim() || body.id} 子图`) });
                  return;
                }
                patch({ mode });
              }}
            >
              <option value="inline">inline — 同一会话内执行</option>
              <option value="flowRef">flowRef — 引用另一张图</option>
              <option value="subflow">subflow — 内嵌子图</option>
            </select>
          </Field>
          {body.mode === 'subflow' && (
            <Field
              label="内嵌子图"
              hint="子图随主图一起保存；点「打开子图」在主画布里编辑它，返回后保存主图即可"
            >
              <div className="wf-row">
                <span className="wf-hint">
                  {body.subflow === undefined
                    ? '尚未创建'
                    : `${body.subflow.nodes.length} 个节点 · 入口 ${body.subflow.entry}`}
                </span>
                <button
                  type="button"
                  className="wf-btn"
                  onClick={() => props.onOpenSubflow(body.id)}
                >
                  打开子图
                </button>
              </div>
            </Field>
          )}
          <Field label="角色" hint="引用全图角色表；角色章程与线程摘要会拼进 child preamble">
            <select
              className="wf-input"
              value={body.role ?? ''}
              onChange={(event) => patch({ role: event.target.value === '' ? undefined : event.target.value })}
            >
              <option value="">（无角色）</option>
              {props.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.id}
                </option>
              ))}
              {body.role !== undefined && !props.agents.some((agent) => agent.id === body.role) && (
                <option value={body.role}>（角色 {body.role} 不存在）</option>
              )}
            </select>
          </Field>
          <Field label="线程" hint="留空或 new = 一次性；role = 同角色跨轮共享；也可以填自定义线程 key">
            <input
              className="wf-input"
              value={body.thread ?? ''}
              placeholder="new / role / 自定义"
              onChange={(event) => {
                const value = event.target.value.trim();
                patch({ thread: value === '' ? undefined : value });
              }}
            />
          </Field>
          <Field label="产出 / 消费产物" hint="逗号分隔的 key；只用于校验与面板，运行时以 complete_step.artifacts 为准">
            <div className="wf-row">
              <input
                className="wf-input"
                value={keysText(body.produces)}
                placeholder="produces: design"
                onChange={(event) => patch({ produces: splitKeys(event.target.value) })}
              />
              <input
                className="wf-input"
                value={keysText(body.consumes)}
                placeholder="consumes: design"
                onChange={(event) => patch({ consumes: splitKeys(event.target.value) })}
              />
            </div>
          </Field>
          <Field label="汇报契约" hint="告诉子 Agent 的 payload/产物格式，会拼进 preamble">
            <textarea
              className="wf-area"
              value={body.reportHint ?? ''}
              onChange={(event) => patch({ reportHint: event.target.value })}
              placeholder="例如：payload 带 verdict（pass/fail）、issues[]；产物 key=design"
            />
          </Field>
          {body.mode === 'flowRef' && (
            <Field label="引用的图" hint="目标图必须已保存；run 启动时按 id 递归解析">
              <select
                className="wf-input"
                value={body.flowRef ?? ''}
                onChange={(event) => patch({ flowRef: event.target.value === '' ? undefined : event.target.value })}
              >
                <option value="">（选择一张图）</option>
                {props.flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name} · {flow.id}
                  </option>
                ))}
                {body.flowRef !== undefined &&
                  body.flowRef !== '' &&
                  !props.flows.some((flow) => flow.id === body.flowRef) && (
                    <option value={body.flowRef}>（当前值 {body.flowRef}，不在列表）</option>
                  )}
              </select>
            </Field>
          )}
          <Field label="并行派发来源" hint="插值表达式（解析成数组）；与下面的固定数量二选一。用 {{item}} 引用各条目">
            <input
              className="wf-input"
              value={body.fanOut?.from ?? ''}
              placeholder="{{n2.payload.modules}}"
              onChange={(event) => patchFanOut(patch, body, { from: event.target.value })}
            />
          </Field>
          <Field label="或固定数量 / 上限" hint="max 截断超出项；被丢弃的条目会在派发轨迹里显式记录">
            <div className="wf-row">
              <input
                className="wf-input"
                type="number"
                min={1}
                placeholder="数量"
                value={body.fanOut?.count ?? ''}
                onChange={(event) => patchFanOut(patch, body, { count: positiveInt(event.target.value) })}
              />
              <input
                className="wf-input"
                type="number"
                min={1}
                placeholder="max 上限"
                value={body.fanOut?.max ?? ''}
                onChange={(event) => patchFanOut(patch, body, { max: positiveInt(event.target.value) })}
              />
            </div>
          </Field>
        </Section>
      )}

      {body.type === 'gate' && (
        <Section title="人工卡点">
          <Field label="问题" hint="卡点会挂起 run，等人工答复后才继续">
            <textarea
              className="wf-area"
              value={body.question ?? ''}
              onChange={(event) => patch({ question: event.target.value })}
              placeholder="例如：这次改动可以合并吗？"
            />
          </Field>
          <Field
            label="选项"
            hint="加一个选项，下面「出口分支」就会多一行；删选项会连带删掉它的出边"
          >
            {options.map((option: GateOption, index: number) => (
              <div className="wf-row" key={option.id}>
                <input
                  className="wf-input"
                  value={option.label}
                  onChange={(event) => {
                    const next = options.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry));
                    patch({ options: next });
                  }}
                />
                <button
                  type="button"
                  className="wf-btn"
                  onClick={() => patch({ options: options.filter((_, i) => i !== index) })}
                >
                  删
                </button>
              </div>
            ))}
            <button
              type="button"
              className="wf-btn"
              onClick={() =>
                patch({ options: [...options, { id: nextOptionId(options), label: '新选项' }] })
              }
            >
              + 加选项
            </button>
          </Field>
        </Section>
      )}

      {body.type === 'join' && (
        <Section title="汇聚">
          <Field label="汇聚指令" hint="所有上游完成后追加给 Agent 的汇总指令">
            <textarea
              ref={aggRef}
              className="wf-area"
              value={body.aggregateInstruction ?? ''}
              onChange={(event) => patch({ aggregateInstruction: event.target.value })}
            />
            <InterpHints
              nodes={others}
              payloadFields={props.payloadFields}
              areaRef={aggRef}
            />
          </Field>
          <Field label="等待的节点" hint="留空 = 等待本次 run 的全部子 run">
            <select
              className="wf-input"
              value={body.waitFor ?? ''}
              onChange={(event) => patch({ waitFor: event.target.value === '' ? undefined : event.target.value })}
            >
              <option value="">（等待全部子 run）</option>
              {others.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node)}
                </option>
              ))}
              {danglingRef(body.waitFor) !== undefined && (
                <option value={body.waitFor}>（节点 {body.waitFor} 已不存在）</option>
              )}
            </select>
          </Field>
        </Section>
      )}

      {body.type === 'end' && (
        <Section title="结束">
          <Field label="结果" hint="success 正常结束；fail 判 run 失败但仍记录轨迹">
            <select className="wf-input" value={body.outcome} onChange={(event) => patch({ outcome: event.target.value })}>
              <option value="success">success</option>
              <option value="fail">fail</option>
            </select>
          </Field>
        </Section>
      )}

      {body.type !== 'prompt' && body.type !== 'end' && (
        <Section title="补充说明">
          <Field label="instruction（可选）" hint="会作为这一步的 instruction 下发给 Agent；不填则用该类型的默认说明">
            <textarea
              className="wf-area"
              value={body.instruction ?? ''}
              onChange={(event) => patch({ instruction: event.target.value })}
            />
          </Field>
        </Section>
      )}

      {body.type !== 'end' && (
        <Section title="循环与逃生">
          <Field label="迭代上限" hint="环上节点建议设置；不设时只在全局步数上限处兜底">
            <input
              className="wf-input"
              type="number"
              min={1}
              value={body.iterationLimit ?? ''}
              onChange={(event) => patch({ iterationLimit: positiveInt(event.target.value) })}
            />
          </Field>
          <Field label="撞上限后跳转到" hint="不设则撞上限直接判 run 失败">
            <select
              className="wf-input"
              value={body.onLimitExceeded ?? ''}
              onChange={(event) => patch({ onLimitExceeded: event.target.value === '' ? undefined : event.target.value })}
            >
              <option value="">（不设，判失败）</option>
              {others.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node)}
                </option>
              ))}
              {danglingRef(body.onLimitExceeded) !== undefined && (
                <option value={body.onLimitExceeded}>（节点 {body.onLimitExceeded} 已不存在）</option>
              )}
            </select>
          </Field>
        </Section>
      )}

      {body.type === 'gate' && options.length > 0 && (
        <Section title="出口分支">
          <div className="wf-hint">
            一个选项一个出口：没有连线的出口名字显示在节点右侧，从它的圆点拖线（或点名字再点目标节点）就能连上。
          </div>
          {options.map((option) => {
            const bound = props.edges.filter((edge) => edge.data?.outlet === option.id);
            return (
              <div className="wf-outlet-row" key={option.id}>
                <span className="wf-outlet-name">{option.label}</span>
                <span className="wf-hint">
                  {bound.length === 0 ? '未连接' : `→ ${bound.map((edge) => edge.target).join('、')}`}
                </span>
              </div>
            );
          })}
          {loose.length > 0 && (
            <div className="wf-hint wf-hint-warn">
              还有 {loose.length} 条出边没有绑定选项（{loose.map((edge) => `→ ${edge.target}`).join('、')}
              ）：在画布上删掉重连，从对应的出口拖线即可；保存时会按选项顺序兜底。
            </div>
          )}
        </Section>
      )}

      {body.type === 'gate' && options.length === 0 && props.edges.length > 0 && (
        <div className="wf-hint wf-hint-warn">这个卡点还没有选项：先在「人工卡点」里加选项，出口会出现在卡片右侧。</div>
      )}

      {body.type !== 'gate' && multi && (
        <Section title="出口分支">
          <div className="wf-hint">第一路填 * 表示默认分支；其余填自然语言条件，由 Agent 自行判断。</div>
          {props.edges.map((edge, index) => (
            <Field key={edge.id} label={`第 ${index + 1} 路`} hint={`→ ${edge.target}`}>
              <input
                className="wf-input"
                value={String(edge.data?.condition ?? (index === 0 ? '*' : ''))}
                onChange={(event) => props.onCondition(edge.id, event.target.value)}
                placeholder={index === 0 ? '默认分支一般填 *' : '例如：上一步结论为通过'}
              />
              <input
                className="wf-input"
                value={String(edge.data?.when ?? '')}
                onChange={(event) => props.onWhen(edge.id, event.target.value)}
                placeholder="when（可选）：{{review.payload.verdict}} == 'pass'"
              />
            </Field>
          ))}
        </Section>
      )}

      <details className="wf-section">
        <summary className="wf-section-title">角色表（{props.agents.length}）</summary>
        <div className="wf-hint">全图共享；subagent 节点用「角色」下拉引用。章程会随每轮 preamble 注入。</div>
        {props.agents.map((agent, index) => (
          <div key={`${agent.id}-${index}`} className="wf-field">
            <div className="wf-row">
              <input
                className="wf-input"
                value={agent.id}
                placeholder="id（字母/数字/下划线）"
                onChange={(event) =>
                  props.onAgentsChange(
                    props.agents.map((item, i) => (i === index ? { ...item, id: event.target.value } : item)),
                  )
                }
              />
              <input
                className="wf-input"
                value={agent.name}
                placeholder="显示名"
                onChange={(event) =>
                  props.onAgentsChange(
                    props.agents.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                  )
                }
              />
              <button
                type="button"
                className="wf-btn"
                onClick={() => props.onAgentsChange(props.agents.filter((_, i) => i !== index))}
              >
                删
              </button>
            </div>
            <textarea
              className="wf-area"
              value={agent.charter}
              placeholder="角色章程：职责、边界、完成标准"
              onChange={(event) =>
                props.onAgentsChange(
                  props.agents.map((item, i) => (i === index ? { ...item, charter: event.target.value } : item)),
                )
              }
            />
            <div className="wf-row">
              <input
                className="wf-input"
                value={keysText(agent.produces)}
                placeholder="produces: design"
                onChange={(event) =>
                  props.onAgentsChange(
                    props.agents.map((item, i) => (i === index ? { ...item, produces: splitKeys(event.target.value) } : item)),
                  )
                }
              />
              <input
                className="wf-input"
                value={keysText(agent.consumes)}
                placeholder="consumes: design"
                onChange={(event) =>
                  props.onAgentsChange(
                    props.agents.map((item, i) => (i === index ? { ...item, consumes: splitKeys(event.target.value) } : item)),
                  )
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="wf-btn"
          onClick={() => {
            let index = props.agents.length + 1;
            const used = new Set(props.agents.map((agent) => agent.id));
            while (used.has(`agent_${index}`)) index += 1;
            props.onAgentsChange([...props.agents, { id: `agent_${index}`, name: '新角色', charter: '' }]);
          }}
        >
          + 添加角色
        </button>
      </details>

      <div className="wf-insp-foot">
        <button type="button" className="wf-btn" onClick={props.onSetEntry} disabled={props.isEntry}>
          {props.isEntry ? '当前入口' : '设为入口'}
        </button>
        <button type="button" className="wf-btn" data-danger="true" onClick={props.onDelete}>
          删除节点
        </button>
      </div>
    </React.Fragment>
  );
}

/** 选项 id 要唯一：复用最小可用的 oN（删掉 o1 后再加不会撞 o2） */
function nextOptionId(options: GateOption[]): string {
  const used = new Set(options.map((option) => option.id));
  for (let index = 1; index < 1000; index += 1) {
    const id = `o${index}`;
    if (!used.has(id)) return id;
  }
  return `o${Date.now().toString(36)}`;
}

/** fan-out 三字段互斥合并：改 from 就清 count，改 count 就清 from（校验器要求二选一） */
function patchFanOut(
  patch: (value: Record<string, unknown>) => void,
  body: SubagentNode,
  change: { from?: string; count?: number; max?: number },
): void {
  const next: Record<string, unknown> = { ...(body.fanOut ?? {}) };
  if (change.from !== undefined) delete next.count;
  if (change.count !== undefined) delete next.from;
  for (const [key, value] of Object.entries(change)) {
    if (value === undefined || value === '') delete next[key];
    else next[key] = value;
  }
  patch({ fanOut: Object.keys(next).length === 0 ? undefined : next });
}

/** 工具参数键值对编辑：不暴露整段 JSON；值能按 JSON 解析就用解析结果 */
function ParamsEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown> | undefined;
  onChange: (params: Record<string, unknown> | undefined) => void;
}): React.ReactElement {
  const entries = Object.entries(value ?? {});
  const toText = (val: unknown): string => (typeof val === 'string' ? val : JSON.stringify(val) ?? '');
  const parse = (text: string): unknown => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  };
  const write = (rows: Array<[string, unknown]>): void => {
    const kept = rows.filter(([key]) => key.trim() !== '');
    onChange(kept.length === 0 ? undefined : Object.fromEntries(kept));
  };

  return (
    <React.Fragment>
      {entries.map(([key, val], index) => (
        <div className="wf-row" key={index}>
          <input
            className="wf-input"
            value={key}
            placeholder="名称"
            onChange={(event) => write(entries.map(([k, v], i) => (i === index ? [event.target.value, v] : [k, v])))}
          />
          <input
            className="wf-input"
            value={toText(val)}
            placeholder="值"
            onChange={(event) => {
              const text = event.target.value;
              write(entries.map(([k, v], i) => (i === index ? [k, parse(text)] : [k, v])));
            }}
          />
          <button type="button" className="wf-btn" onClick={() => write(entries.filter((_, i) => i !== index))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="wf-btn" onClick={() => write([...entries, [`param${entries.length + 1}`, '']])}>
        + 加参数
      </button>
    </React.Fragment>
  );
}

/** 插值提示：其他节点 + 历史 run 学到的 payload 字段，点 chip 插到光标处 */
function InterpHints({
  nodes,
  payloadFields,
  areaRef,
}: {
  nodes: CanvasNode[];
  payloadFields: Record<string, string[]>;
  areaRef: React.RefObject<HTMLTextAreaElement | null>;
}): React.ReactElement | null {
  if (nodes.length === 0) return null;
  return (
    <details className="wf-hints">
      <summary>插值提示（引用之前节点的结果）</summary>
      {nodes.map((node) => {
        const fields = payloadFields[node.id] ?? [];
        return (
          <div className="wf-hints-node" key={node.id}>
            <span className="wf-hints-name">
              {node.data.title} <code>{node.id}</code>
            </span>
            {fields.length > 0 ? (
              <span className="wf-hints-chips">
                {fields.map((field) => (
                  <button
                    type="button"
                    className="wf-hints-chip"
                    key={field}
                    title="插入到光标处"
                    onClick={() => insertToken(areaRef.current, `{{${node.id}.payload.${field}}}`)}
                  >
                    {`{{${node.id}.payload.${field}}}`}
                  </button>
                ))}
              </span>
            ) : (
              <span className="wf-hint">这张图跑过一次后，这里会提示该节点 payload 的字段</span>
            )}
          </div>
        );
      })}
    </details>
  );
}

/** 往受控 textarea 的光标处插 token 后把光标放到 token 后面 */
function insertToken(area: HTMLTextAreaElement | null, token: string): void {
  if (area === null) return;
  const start = area.selectionStart ?? area.value.length;
  const end = area.selectionEnd ?? start;
  const next = area.value.slice(0, start) + token + area.value.slice(end);
  // React 受控组件：走原生 setter + 派发 input 事件才能触发 onChange
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter !== undefined) setter.call(area, next);
  area.dispatchEvent(new Event('input', { bubbles: true }));
  const caret = start + token.length;
  area.focus();
  area.setSelectionRange(caret, caret);
}
