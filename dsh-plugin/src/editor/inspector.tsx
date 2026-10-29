// 右侧属性面板：只编辑当前节点/当前层的字段，其余图结构由画布上的连线表达。
// 信息分层：头部（类型/标题/id/概览 chip）→ 核心字段 → 折叠的高级设置 → 分支 → 底部动作。
// 说明文字按需出现：核心字段一行 hint，高级字段收进 label 右侧的 i 提示。
import * as React from 'react';
import type { AgentDef, FlowNode, GateOption, SubagentMode, SubagentNode } from '@shared/index.js';
import type { FlowMeta, ValidationIssue } from './api.js';
import {
  typeLabel,
  makeSubflow,
  summarizeNode,
  type CanvasEdge,
  type CanvasNode,
  type InspectorGroupId,
  type NodeSummaryChip,
} from './model.js';

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
  /** 当前节点的校验问题（P2：面板内汇总，不必再开页头浮层） */
  issues?: ValidationIssue[];
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
  /** 高级字段的说明：收进 label 右侧的 i，不占常驻行高 */
  tip?: string;
  children: React.ReactNode;
}

function Field({ label, hint, tip, children }: FieldProps): React.ReactElement {
  return (
    <div className="wf-field">
      <span className="wf-label">
        {label}
        {tip !== undefined && (
          <span className="wf-tip" title={tip} aria-label={tip}>
            i
          </span>
        )}
      </span>
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

const MODE_OPTIONS: Array<{ value: SubagentMode; label: string; title: string }> = [
  { value: 'inline', label: 'inline', title: '在同一个会话里派子 Agent 执行一个子任务' },
  { value: 'subflow', label: '子图', title: '子图直接嵌在主图里，运行时 child 跑这段子图' },
  { value: 'flowRef', label: '引用图', title: '引用另一张已存在的图，启动 run 时递归解析进快照' },
];

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

/** 折叠头摘要只显示第一行，避免一段长文本把整行撑开 */
function firstLine(text: string, max = 18): string {
  const line = text.trim().split('\n')[0]?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function orUndefined(text: string | undefined): string | undefined {
  return text === undefined || text === '' ? undefined : text;
}

export function Inspector(props: InspectorProps): React.ReactElement {
  const [tab, setTab] = React.useState<'node' | 'flow'>('node');
  // 折叠状态放在面板根部：切节点、切页签都不丢
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
  const { body } = props;

  const toggleGroup = (id: string): void => {
    setOpenGroups((prev) => ({ ...prev, [id]: prev[id] !== true }));
  };
  const openGroup = (id: string): void => {
    setOpenGroups((prev) => ({ ...prev, [id]: true }));
  };

  // 在「图」页签时点选画布节点，直接回到节点页签
  React.useEffect(() => {
    if (props.body !== undefined) setTab('node');
  }, [props.body?.id]);

  return (
    <div className="wf-insp-root">
      <div className="wf-insp-tabs" role="tablist" aria-label="属性面板">
        <button
          type="button"
          role="tab"
          className="wf-tab"
          data-active={tab === 'node'}
          aria-selected={tab === 'node'}
          onClick={() => setTab('node')}
        >
          节点
        </button>
        <button
          type="button"
          role="tab"
          className="wf-tab"
          data-active={tab === 'flow'}
          aria-selected={tab === 'flow'}
          onClick={() => setTab('flow')}
        >
          图{props.agents.length > 0 ? ` · 角色 ${props.agents.length}` : ''}
        </button>
      </div>

      {tab === 'flow' ? (
        <div className="wf-insp-scroll">
          <FlowTab agents={props.agents} onAgentsChange={props.onAgentsChange} />
        </div>
      ) : body === undefined ? (
        <div className="wf-insp-scroll">
          <EmptyInspector />
        </div>
      ) : (
        <NodePanel
          {...props}
          body={body}
          issues={props.issues ?? []}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
          onOpenGroup={openGroup}
        />
      )}
    </div>
  );
}

function EmptyInspector(): React.ReactElement {
  return (
    <div className="wf-insp-empty">
      <div className="wf-insp-empty-title">未选中节点</div>
      <div className="wf-hint">点选画布上的节点编辑属性；从节点右侧圆点拖线到另一个节点即可连边。</div>
      <div className="wf-hint">右键画布：在指针处新建 / 粘贴；右键节点：复制、设为入口、删除。</div>
      <div className="wf-hint">快捷键：Ctrl+Z 撤销、Ctrl+Shift+Z 重做、Ctrl+S 保存、Delete 删除。</div>
    </div>
  );
}

function NodePanel(
  props: InspectorProps & {
    body: FlowNode;
    issues: ValidationIssue[];
    openGroups: Record<string, boolean>;
    onToggleGroup: (id: string) => void;
    onOpenGroup: (id: string) => void;
  },
): React.ReactElement {
  const { body } = props;
  const [copied, setCopied] = React.useState(false);
  // 三个核心文本域的插值提示要往光标处插 token
  const instrRef = React.useRef<HTMLTextAreaElement | null>(null);
  const extraRef = React.useRef<HTMLTextAreaElement | null>(null);
  const aggRef = React.useRef<HTMLTextAreaElement | null>(null);
  const branchRef = React.useRef<HTMLDivElement | null>(null);

  const patch = (value: Record<string, unknown>): void => props.onPatch(value);
  const multi = props.edges.length > 1;
  const options = body.type === 'gate' ? body.options : [];
  /** 画布上先拉了线、还没归属任何选项的出边 */
  const loose = body.type === 'gate' ? props.edges.filter((edge) => edge.data?.outlet === undefined) : [];
  const others = props.nodes.filter((node) => node.id !== body.id);
  const danglingRef = (id: string | undefined): string | undefined =>
    id !== undefined && id !== '' && !props.nodes.some((node) => node.id === id) ? id : undefined;

  const chips = summarizeNode(body, { edgeCount: props.edges.length });
  const chipLabel = (key: NodeSummaryChip['key']): string | undefined =>
    chips.find((chip) => chip.key === key)?.label;

  const groupOpen = (id: string): boolean => props.openGroups[id] === true;
  const toggleGroup = (id: string): void => props.onToggleGroup(id);
  const openGroup = (group: InspectorGroupId): void => {
    props.onOpenGroup(group);
    window.requestAnimationFrame(() => {
      document.getElementById(`wf-grp-${group}`)?.scrollIntoView({ block: 'nearest' });
    });
  };
  const onChip = (chip: NodeSummaryChip): void => {
    if (chip.action === 'open-subflow') {
      props.onOpenSubflow(body.id);
      return;
    }
    if (chip.group !== undefined) {
      openGroup(chip.group);
      return;
    }
    if (chip.key === 'branches') branchRef.current?.scrollIntoView({ block: 'nearest' });
  };

  const copyId = (): void => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) return;
    void clipboard
      .writeText(body.id)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => undefined);
  };

  const targetTitle = (id: string): string => {
    const title = props.nodes.find((node) => node.id === id)?.data.title;
    return title === undefined || title === '' ? id : title;
  };

  const reportSummary =
    body.type === 'subagent' && body.reportHint !== undefined && body.reportHint.trim() !== ''
      ? `汇报 ${firstLine(body.reportHint)}`
      : undefined;
  const contractSummary = orUndefined([chipLabel('artifacts'), reportSummary].filter(Boolean).join(' · '));

  return (
    <React.Fragment>
      <div className="wf-insp-head">
        <div className="wf-insp-head-row">
            <span className="wf-kind" data-kind={body.type}>
              {typeLabel(body.type)}
            </span>
            <input
              className="wf-insp-title"
              value={body.title ?? ''}
              placeholder={body.id}
              aria-label="节点标题"
              onChange={(event) => patch({ title: event.target.value })}
            />
            {props.isEntry && <span className="wf-chip">入口</span>}
          </div>
          <div className="wf-insp-head-row">
            <code className="wf-id" title={body.id}>
              {body.id}
            </code>
            <button
              type="button"
              className="wf-icon-btn"
              title={copied ? '已复制' : '复制节点 id'}
              aria-label={copied ? '已复制' : '复制节点 id'}
              onClick={copyId}
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>
          {chips.length > 0 && (
            <div className="wf-chips">
              {chips.map((chip) => {
                const interactive =
                  chip.action !== undefined ||
                  chip.group !== undefined ||
                  (chip.key === 'branches' && body.type !== 'gate');
                const content = (
                  <span className="wf-sum-label" title={chip.label}>
                    {chip.label}
                  </span>
                );
                if (!interactive) {
                  return (
                    <span className="wf-sum-chip" key={chip.key}>
                      {content}
                    </span>
                  );
                }
                return (
                  <button
                    type="button"
                    className="wf-sum-chip"
                    data-interactive="true"
                    key={chip.key}
                    title={chip.action === 'open-subflow' ? '打开子图' : '展开对应设置'}
                    onClick={() => onChip(chip)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
      </div>

      <div className="wf-insp-scroll">
        {props.issues.length > 0 && <IssueList issues={props.issues} />}

        {body.type === 'prompt' && (
          <Section title="指令">
            <Field label="指令" hint="这一步要 Agent 做什么；支持 {{节点.payload.字段}} 插值">
              <textarea
                ref={instrRef}
                className="wf-area"
                value={body.instruction ?? ''}
                onChange={(event) => patch({ instruction: event.target.value })}
                placeholder="例如：读 docs/README.md，列出必读文档"
              />
              <InterpHints nodes={others} payloadFields={props.payloadFields} areaRef={instrRef} />
            </Field>
          </Section>
        )}

        {body.type === 'tool' && (
          <Section title="工具调用">
            <Field label="工具名" hint="例如 web_search、read">
              <input
                className="wf-input"
                value={body.toolName ?? ''}
                onChange={(event) => patch({ toolName: event.target.value })}
              />
            </Field>
            <Field label="参数" hint="键值对；会作为 view.tool.params 下发给 Agent">
              <ParamsEditor value={body.params} onChange={(params) => patch({ params })} />
            </Field>
          </Section>
        )}

        {body.type === 'subagent' && (
          <Section title="任务">
            <Field label="附加指令" hint="追加给子 Agent 的上下文；主指令来自上游节点">
              <textarea
                ref={extraRef}
                className="wf-area"
                value={body.extraPrompt ?? ''}
                onChange={(event) => patch({ extraPrompt: event.target.value })}
                placeholder="例如：只读不写，产出不超过 20 行的结论"
              />
              <InterpHints nodes={others} payloadFields={props.payloadFields} areaRef={extraRef} />
            </Field>
            <Field
              label="执行方式"
              tip="inline 同一会话执行；子图 内嵌可编辑子流程；引用图 复用另一张已保存的图"
            >
              <Segmented
                ariaLabel="子 Agent 执行方式"
                value={body.mode}
                options={MODE_OPTIONS}
                onChange={(mode) => {
                  if (mode === body.mode) return;
                  if (mode === 'subflow' && body.subflow === undefined) {
                    // 切到内嵌子图时先给一张最小合法的「开始 → 结束」，否则保存必被拒
                    patch({ mode, subflow: makeSubflow(`${body.title?.trim() || body.id} 子图`) });
                    return;
                  }
                  patch({ mode });
                }}
              />
              {body.mode === 'subflow' && (
                <div className="wf-mode-row">
                  <span className="wf-hint" title={body.subflow === undefined ? '尚未创建' : undefined}>
                    {body.subflow === undefined
                      ? '尚未创建'
                      : `${body.subflow.nodes.length} 个节点 · 入口 ${body.subflow.entry}`}
                  </span>
                  <button type="button" className="wf-btn" onClick={() => props.onOpenSubflow(body.id)}>
                    {body.subflow === undefined ? '创建子图并打开' : '打开子图'}
                  </button>
                </div>
              )}
              {body.mode === 'flowRef' && (
                <div className="wf-field">
                  <select
                    className="wf-input"
                    aria-label="引用的图"
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
                  <span className="wf-hint">目标图必须已保存；run 启动时按 id 递归解析。</span>
                </div>
              )}
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
            <Field label="选项" hint="每个选项就是一个出口；从卡片右侧的圆点拖线连接目标">
              {options.map((option, index) => {
                const targets = props.edges
                  .filter((edge) => edge.data?.outlet === option.id)
                  .map((edge) => edge.target);
                return (
                  <div className="wf-opt-row" key={option.id}>
                    <input
                      className="wf-input"
                      value={option.label}
                      onChange={(event) => {
                        const next = options.map((entry, i) =>
                          i === index ? { ...entry, label: event.target.value } : entry,
                        );
                        patch({ options: next });
                      }}
                    />
                    <span
                      className="wf-opt-target"
                      data-empty={targets.length === 0}
                      title={targets.length === 0 ? '还没有连线' : targets.map((id) => `${targetTitle(id)} · ${id}`).join('\n')}
                    >
                      {targets.length === 0 ? '未连接' : `→ ${targets.map(targetTitle).join('、')}`}
                    </span>
                    <button
                      type="button"
                      className="wf-btn"
                      onClick={() => patch({ options: options.filter((_, i) => i !== index) })}
                    >
                      删
                    </button>
                  </div>
                );
              })}
              {loose.length > 0 && (
                <div className="wf-hint wf-hint-warn">
                  还有 {loose.length} 条出边没有绑定选项（{loose.map((edge) => `→ ${edge.target}`).join('、')}
                  ）：从对应出口重连，保存时会按选项顺序兜底。
                </div>
              )}
              <button
                type="button"
                className="wf-btn"
                onClick={() => patch({ options: [...options, { id: nextOptionId(options), label: '新选项' }] })}
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
              <InterpHints nodes={others} payloadFields={props.payloadFields} areaRef={aggRef} />
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
              <Segmented
                ariaLabel="结束结果"
                value={body.outcome}
                options={[
                  { value: 'success', label: 'success' },
                  { value: 'fail', label: 'fail' },
                ]}
                onChange={(outcome) => patch({ outcome })}
              />
            </Field>
          </Section>
        )}

        <div className="wf-adv">
          {body.type === 'subagent' && (
            <React.Fragment>
              <Accordion
                id="runtime"
                title="角色与线程"
                summary={chipLabel('runtime')}
                open={groupOpen('runtime')}
                onToggle={() => toggleGroup('runtime')}
              >
                <Field label="角色" tip="引用全图角色表；角色章程与线程摘要会拼进 child preamble">
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
                <Field
                  label="线程"
                  tip="留空或 new = 一次性；role = 同角色跨轮共享；也可以填自定义线程 key"
                >
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
              </Accordion>

              <Accordion
                id="contract"
                title="产物与汇报"
                summary={contractSummary}
                open={groupOpen('contract')}
                onToggle={() => toggleGroup('contract')}
              >
                <Field
                  label="产出 / 消费产物"
                  tip="逗号分隔的 key；只用于校验与面板，运行时以 complete_step.artifacts 为准"
                >
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
                <Field label="汇报格式" tip="告诉子 Agent 的 payload/产物格式，会拼进 preamble">
                  <textarea
                    className="wf-area"
                    value={body.reportHint ?? ''}
                    onChange={(event) => patch({ reportHint: event.target.value })}
                    placeholder="例如：payload 带 verdict（pass/fail）、issues[]；产物 key=design"
                  />
                </Field>
              </Accordion>

              <Accordion
                id="fanout"
                title="并行派发"
                summary={chipLabel('fanout')}
                open={groupOpen('fanout')}
                onToggle={() => toggleGroup('fanout')}
              >
                <Field
                  label="派发来源"
                  tip="插值表达式（解析成数组）；与下面的固定数量二选一。用 {{item}} 引用各条目"
                >
                  <input
                    className="wf-input"
                    value={body.fanOut?.from ?? ''}
                    placeholder="{{n2.payload.modules}}"
                    onChange={(event) => patchFanOut(patch, body, { from: event.target.value })}
                  />
                </Field>
                <Field label="或固定数量 / 上限" tip="max 截断超出项；被丢弃的条目会在派发轨迹里显式记录">
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
              </Accordion>
            </React.Fragment>
          )}

          {body.type !== 'end' && (
            <Accordion
              id="loop"
              title="循环与逃生"
              summary={chipLabel('loop')}
              open={groupOpen('loop')}
              onToggle={() => toggleGroup('loop')}
            >
              <div className="wf-grid2">
                <Field label="回路 id" tip="同一回路的节点共用一个 loopId；至少有一个节点配最大轮次当控制器">
                  <input
                    className="wf-input"
                    value={body.loopId ?? ''}
                    placeholder="review-loop"
                    onChange={(event) =>
                      patch({ loopId: event.target.value.trim() === '' ? undefined : event.target.value.trim() })
                    }
                  />
                </Field>
                <Field label="最大轮次" tip="配在控制器节点上；控制器每执行一次算一轮，超限走 onLimitExceeded">
                  <input
                    className="wf-input"
                    type="number"
                    min={1}
                    value={body.maxRounds ?? ''}
                    onChange={(event) => patch({ maxRounds: positiveInt(event.target.value) })}
                  />
                </Field>
                <Field label="迭代上限" tip="节点级兜底；环上节点建议设置，不设时只在全局步数上限处兜底">
                  <input
                    className="wf-input"
                    type="number"
                    min={1}
                    value={body.iterationLimit ?? ''}
                    onChange={(event) => patch({ iterationLimit: positiveInt(event.target.value) })}
                  />
                </Field>
                <Field label="撞上限后跳转" tip="不设则撞上限直接判 run 失败；回路级上限优先用控制器上的出口">
                  <select
                    className="wf-input"
                    value={body.onLimitExceeded ?? ''}
                    onChange={(event) =>
                      patch({ onLimitExceeded: event.target.value === '' ? undefined : event.target.value })
                    }
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
              </div>
            </Accordion>
          )}

          {body.type !== 'prompt' && body.type !== 'end' && (
            <Accordion
              id="instruction"
              title="本步指令"
              summary={orUndefined(body.instruction?.trim() === '' ? undefined : firstLine(body.instruction ?? ''))}
              open={groupOpen('instruction')}
              onToggle={() => toggleGroup('instruction')}
            >
              <Field
                label="instruction（可选）"
                hint={body.type === 'join' ? '汇聚步会用「汇聚指令」覆盖这里的值，通常不用填。' : undefined}
                tip="会作为这一步的 instruction 下发给 Agent；不填则用该类型的默认说明"
              >
                <textarea
                  className="wf-area"
                  value={body.instruction ?? ''}
                  onChange={(event) => patch({ instruction: event.target.value })}
                />
              </Field>
            </Accordion>
          )}
        </div>

        {body.type !== 'gate' && multi && (
          <div ref={branchRef}>
            <Section title="分支">
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
          </div>
        )}
      </div>

      <div className="wf-insp-foot">
        {props.isEntry ? (
          <span className="wf-chip">当前入口</span>
        ) : (
          <button type="button" className="wf-btn" onClick={props.onSetEntry}>
            设为入口
          </button>
        )}
        <span className="wf-spacer" />
        <button type="button" className="wf-btn" data-danger="true" onClick={props.onDelete}>
          删除节点
        </button>
      </div>
    </React.Fragment>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }): React.ReactElement {
  const hasError = issues.some((issue) => issue.severity === 'error');
  return (
    <div className="wf-issues" data-has-error={hasError}>
      <div className="wf-issues-head">
        {hasError ? '✕' : '⚠'} {issues.length} 个问题
      </div>
      {issues.map((issue, index) => (
        <div className="wf-issue" data-kind={issue.severity} key={`${issue.code}-${index}`}>
          <code>{issue.code}</code>
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
}): React.ReactElement {
  return (
    <div className="wf-seg" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={option.value === value}
          title={option.title}
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Accordion({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="wf-acc" id={`wf-grp-${id}`}>
      <button
        type="button"
        className="wf-acc-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="wf-acc-caret" data-open={open}>
          ▸
        </span>
        <span className="wf-acc-title">{title}</span>
        {summary !== undefined && (
          <span className="wf-acc-summary" title={summary}>
            {summary}
          </span>
        )}
      </button>
      {open && <div className="wf-acc-body">{children}</div>}
    </section>
  );
}

function FlowTab({
  agents,
  onAgentsChange,
}: {
  agents: AgentDef[];
  onAgentsChange: (agents: AgentDef[]) => void;
}): React.ReactElement {
  return (
    <Section title={`角色表（${agents.length}）`}>
      <div className="wf-hint">全图共享；子 Agent 节点用「角色」下拉引用。章程会随每轮 preamble 注入。</div>
      {agents.length === 0 && <div className="wf-hint">还没有角色。先加一个，节点里就能选它。</div>}
      {agents.map((agent, index) => (
        <div className="wf-agent" key={index}>
          <div className="wf-row">
            <input
              className="wf-input"
              value={agent.id}
              placeholder="id（字母/数字/下划线）"
              onChange={(event) =>
                onAgentsChange(agents.map((item, i) => (i === index ? { ...item, id: event.target.value } : item)))
              }
            />
            <input
              className="wf-input"
              value={agent.name}
              placeholder="显示名"
              onChange={(event) =>
                onAgentsChange(agents.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
              }
            />
            <button
              type="button"
              className="wf-btn"
              onClick={() => onAgentsChange(agents.filter((_, i) => i !== index))}
            >
              删
            </button>
          </div>
          <textarea
            className="wf-area"
            value={agent.charter}
            placeholder="角色章程：职责、边界、完成标准"
            onChange={(event) =>
              onAgentsChange(agents.map((item, i) => (i === index ? { ...item, charter: event.target.value } : item)))
            }
          />
          <div className="wf-row">
            <input
              className="wf-input"
              value={keysText(agent.produces)}
              placeholder="produces: design"
              onChange={(event) =>
                onAgentsChange(
                  agents.map((item, i) =>
                    i === index ? { ...item, produces: splitKeys(event.target.value) } : item,
                  ),
                )
              }
            />
            <input
              className="wf-input"
              value={keysText(agent.consumes)}
              placeholder="consumes: design"
              onChange={(event) =>
                onAgentsChange(
                  agents.map((item, i) =>
                    i === index ? { ...item, consumes: splitKeys(event.target.value) } : item,
                  ),
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
          let index = agents.length + 1;
          const used = new Set(agents.map((agent) => agent.id));
          while (used.has(`agent_${index}`)) index += 1;
          onAgentsChange([...agents, { id: `agent_${index}`, name: '新角色', charter: '' }]);
        }}
      >
        + 添加角色
      </button>
    </Section>
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
  const toText = (val: unknown): string => (typeof val === 'string' ? val : (JSON.stringify(val) ?? ''));
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
