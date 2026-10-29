// 运行图页：只读预览某个 run 的快照图 —— 节点按执行状态着色、走过的边高亮，
// 右侧轨迹列表可按节点筛选（点节点 = 只看它的执行记录）。
import * as React from 'react';
import {
  clockTime,
  nodeLabel,
  phaseOf,
  relTime,
  type Flow,
  type RunDetail,
  type RunListItem,
} from '@shared/index.js';
import { resolveEndpoint } from '../endpoint.js';
import { RunCanvas } from './canvas.js';
import { buildRunGraph, isActiveRun } from './model.js';
import { runCss } from './styles.js';

interface StatePayload {
  ok: boolean;
  available: boolean;
  reason: string | null;
  dbPath: string;
  active: RunListItem[];
  recent: RunListItem[];
  selectedId: string | null;
  detail: RunDetail | null;
}

const PHASE_TEXT: Record<string, string> = {
  running: '进行中',
  gate: '等人工确认',
  children: '等子 Agent',
  finished: '已完成',
  failed: '失败',
  stale: '停滞',
};

const EXEC_TEXT: Record<string, { text: string; tone: 'ok' | 'warn' | 'bad' }> = {
  completed: { text: '完成', tone: 'ok' },
  blocked: { text: '阻塞', tone: 'bad' },
  limit_exceeded: { text: '超限逃生', tone: 'warn' },
  dispatched: { text: '派发', tone: 'warn' },
};

const PAGE_STYLE: React.CSSProperties = {
  background: 'var(--dsw-alias-bg-base, Canvas)',
  color: 'var(--dsw-alias-label-primary, CanvasText)',
  minHeight: 420,
};

export interface RunGraphPageProps {
  onExit?: () => void;
  /** 只读本会话的 run；缺省时退回全部（浮层/调试用） */
  sessionId?: string;
}

export function RunGraphPage({ onExit, sessionId }: RunGraphPageProps): React.ReactElement {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [data, setData] = React.useState<StatePayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [focusNode, setFocusNode] = React.useState<string | null>(null);
  const [openExec, setOpenExec] = React.useState<number | null>(null);
  const [tick, setTick] = React.useState(0);

  const selectedRef = React.useRef<string | null>(null);
  selectedRef.current = selected;
  /** 上一轮的数据指纹：轮询没变化就不 setState，避免每 2 秒重渲染一次导致边标签抖动 */
  const lastKeyRef = React.useRef<string>('');

  // 切会话时清掉选中：上一个会话的 run id 在新会话里不存在，留着会一直请求一个无效详情
  React.useEffect(() => {
    setSelected(null);
    setFocusNode(null);
    setOpenExec(null);
  }, [sessionId]);

  React.useEffect(() => {
    let cancelled = false;
    let inflight: AbortController | null = null;

    const load = async (): Promise<void> => {
      inflight?.abort();
      const controller = new AbortController();
      inflight = controller;
      const url = resolveEndpoint('aiworkflow/');
      if (sessionId !== undefined && sessionId !== '') url.searchParams.set('session', sessionId);
      if (selectedRef.current !== null) url.searchParams.set('run', selectedRef.current);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        const body = (await response.json()) as StatePayload;
        if (cancelled) return;
        if (body.ok === false) {
          setError(`读取失败（HTTP ${response.status}）`);
          return;
        }
        setError(null);
        // generatedAt 每轮都变，不能拿来比较；只用业务数据做指纹
        const key = JSON.stringify({
          active: body.active,
          recent: body.recent,
          selectedId: body.selectedId,
          detail: body.detail,
        });
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;
        setData(body);
        if (selectedRef.current === null && typeof body.selectedId === 'string') setSelected(body.selectedId);
      } catch (cause) {
        if (!cancelled && !controller.signal.aborted) setError(`无法连接插件 Host 半：${errorText(cause)}`);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      inflight?.abort();
    };
  }, [selected, tick, sessionId]);

  const detail = data?.detail ?? null;
  const graph = React.useMemo(() => (detail === null ? null : buildRunGraph(detail)), [detail]);
  const allRuns = data === null ? [] : dedupe([...data.active, ...data.recent]);
  // 顶部只列根 run；child run 从父 run 的“子运行”卡片进入，避免列表被每轮派发刷屏
  const runs = allRuns.filter((run) => run.parentRunId === null);
  const phase = detail === null ? null : phaseOf(detail);
  const executions = detail === null ? [] : detail.executions;
  const visible = focusNode === null ? executions : executions.filter((exec) => exec.nodeId === focusNode);
  const focused = openExec === null ? undefined : executions.find((exec) => exec.id === openExec);
  const childRuns = detail === null ? [] : detail.children;
  const shownChildren = focusNode === null ? childRuns : childRuns.filter((child) => child.parentNode === focusNode);
  const rootFlow = detail?.snapshot === null || detail?.snapshot === undefined
    ? undefined
    : detail.snapshot.flows[detail.snapshot.rootFlowId];

  const pickNode = (nodeId: string | null): void => {
    setFocusNode((current) => (current === nodeId ? null : nodeId));
    setOpenExec(null);
  };

  return (
    <div className="awr-page" style={PAGE_STYLE}>
      <style>{runCss}</style>
      <header className="awr-head">
        <span className="awr-title">运行图</span>
        {detail !== null && detail.parentRunId !== null && (
          <button
            type="button"
            className="awr-btn"
            onClick={() => {
              setSelected(detail.parentRunId);
              setFocusNode(null);
              setOpenExec(null);
            }}
            title="回到派发这个 child 的父 run"
          >
            ← 父 run
          </button>
        )}
        <span className="awr-sub">
          {detail === null ? '只读预览' : `${detail.flowName ?? detail.flowId} · ${detail.stepsUsed} 步`}
        </span>
        {phase !== null && (
          <span className="awr-run" data-sel="true" style={{ cursor: 'default' }}>
            <span className="awr-dot" data-phase={phase} />
            {PHASE_TEXT[phase] ?? phase}
          </span>
        )}
        <span className="awr-spacer" />
        <button type="button" className="awr-btn" onClick={() => setTick((value) => value + 1)}>
          刷新
        </button>
        {onExit !== undefined && (
          <button type="button" className="awr-btn" onClick={onExit}>
            返回会话
          </button>
        )}
      </header>

      {runs.length > 0 && (
        <div className="awr-runs">
          {runs.map((run) => (
            <button
              type="button"
              key={run.id}
              className="awr-run"
              data-sel={run.id === (data?.selectedId ?? selected) ? 'true' : 'false'}
              title={`${run.flowName ?? run.flowId} · ${relTime(run.createdAt)}`}
              onClick={() => {
                setSelected(run.id);
                setFocusNode(null);
                setOpenExec(null);
              }}
            >
              <span className="awr-dot" data-phase={phaseOf(run)} />
              <span className="awr-run-name">{run.flowName ?? run.flowId}</span>
              <span>{relTime(run.createdAt)}</span>
            </button>
          ))}
        </div>
      )}

      {data === null && error === null ? (
        <div className="awr-empty">
          <b>读取中…</b>
        </div>
      ) : error !== null && data === null ? (
        <div className="awr-empty">
          <b>读取失败</b>
          <span>{error}</span>
        </div>
      ) : data !== null && !data.available ? (
        <div className="awr-empty">
          <b>还没有 aiworkflow 数据</b>
          <span>{data.reason ?? '先建一张流程图并在会话里跑一次，这里就会出现运行图。'}</span>
          <code>{data.dbPath}</code>
        </div>
      ) : runs.length === 0 ? (
        <div className="awr-empty">
          <b>{sessionId === undefined ? '还没有 run' : '本会话还没有 run'}</b>
          <span>
            {sessionId === undefined
              ? '在会话里让 Agent 跑一张流程图，运行状态会实时出现在这里。'
              : '在输入框左侧点「工作流」启动一张图，这里就会出现本会话的运行图。'}
          </span>
          <code>{data?.dbPath ?? ''}</code>
        </div>
      ) : (
        <div className="awr-body">
          {graph === null ? (
            <div className="awr-empty">
              <b>快照丢失</b>
              <span>这次 run 的快照不在库里（{detail?.snapshotHash ?? ''}），右侧轨迹仍可查看。</span>
            </div>
          ) : (
            <RunCanvas nodes={graph.nodes} edges={graph.edges} selectedId={focusNode} onSelect={pickNode} />
          )}

          <aside className="awr-rail">
            {detail !== null && (
              <div className="awr-meta">
                {detail.flowName ?? detail.flowId}
                {detail.outcome !== null && !isActiveRun(detail) ? ` · ${detail.outcome === 'fail' ? '未达成' : '达成'}` : ''}
                <br />
                开始 {relTime(detail.createdAt)}（{clockTime(detail.createdAt)}）
                {detail.finishedAt !== null ? ` · 结束 ${clockTime(detail.finishedAt)}` : ''}
                <br />
                当前步 {nodeLabel(rootFlow, detail.currentNode)}
                {detail.role !== null && (
                  <>
                    <br />
                    角色 {detail.role}
                    {detail.threadId !== null ? ` · 线程 ${detail.threadId}` : ''}
                    {detail.parentIteration !== null ? ` · 第 ${detail.parentIteration} 轮` : ''}
                  </>
                )}
              </div>
            )}

            {detail !== null && childRuns.length > 0 && (
              <div className="awr-card">
                <div className="awr-card-title">
                  子运行（{shownChildren.length}/{childRuns.length}）
                  {focusNode !== null ? ` · ${nodeLabel(rootFlow, focusNode)}` : ''}
                </div>
                {shownChildren.length === 0 ? (
                  <div className="awr-card-hint">该节点没有子运行；点上面的父节点可筛选。</div>
                ) : (
                  shownChildren.map((child) => (
                    <button
                      type="button"
                      key={child.id}
                      className="awr-child"
                      data-sel={child.id === (data?.selectedId ?? selected) ? 'true' : 'false'}
                      onClick={() => {
                        setSelected(child.id);
                        setFocusNode(null);
                        setOpenExec(null);
                      }}
                      title={`${child.flowName ?? child.flowId} · ${child.parentNode ?? ''}`}
                    >
                      <span className="awr-dot" data-phase={phaseOf(child)} />
                      <span className="awr-run-name">{child.flowName ?? child.flowId}</span>
                      {child.parentNode !== null && <span className="awr-child-node">{child.parentNode}</span>}
                      <span>{child.role ?? ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {detail !== null && (detail.artifacts ?? []).length > 0 && (
              <div className="awr-card">
                <div className="awr-card-title">产物（{(detail.artifacts ?? []).length}）</div>
                {(detail.artifacts ?? []).map((artifact) => (
                  <div key={`${artifact.key}@${artifact.version}`} className="awr-card-hint">
                    <b>{artifact.key}</b> v{artifact.version}
                    {artifact.path !== null ? ` · ${artifact.path}` : ''}
                    {artifact.summary !== null ? ` · ${artifact.summary}` : ''}
                  </div>
                ))}
              </div>
            )}

            {detail?.pendingGate !== null && detail?.pendingGate !== undefined && (
              <div className="awr-card">
                <div className="awr-card-title">
                  <span className="awr-dot" data-phase="gate" />
                  等人工确认
                </div>
                <div className="awr-card-q">{detail.pendingGate.question}</div>
                <div className="awr-card-opts">
                  {detail.pendingGate.options.map((option) => (
                    <span key={option.id} className="awr-opt">
                      {option.label}
                    </span>
                  ))}
                </div>
                <div className="awr-card-hint">在对话里直接答复即可（Agent 会代填），这块只读。</div>
              </div>
            )}

            <div className="awr-card-title">
              执行轨迹
              {focusNode !== null && (
                <button type="button" className="awr-btn" onClick={() => pickNode(null)}>
                  只看 {nodeLabel(rootFlow, focusNode)} · 清除
                </button>
              )}
            </div>

            <ol className="awr-trace">
              {[...visible].reverse().map((exec, index) => {
                const chip = EXEC_TEXT[exec.status] ?? { text: exec.status, tone: 'warn' as const };
                const branch = branchOf(rootFlow, exec.nodeId, exec.branchId);
                return (
                  <li
                    key={exec.id}
                    className="awr-trace-item"
                    data-sel={openExec === exec.id ? 'true' : 'false'}
                    onClick={() => {
                      setOpenExec(exec.id);
                      setFocusNode(exec.nodeId);
                    }}
                  >
                    <span className="awr-trace-seq">{visible.length - index}</span>
                    <span className="awr-trace-body">
                      <span className="awr-trace-node">
                        {nodeLabel(rootFlow, exec.nodeId)}
                        <em className="awr-trace-iter">#{exec.iteration}</em>
                        <span className="awr-chip" data-tone={chip.tone}>
                          {chip.text}
                        </span>
                      </span>
                      <span className="awr-trace-summary">{exec.summary ?? ''}</span>
                      <span className="awr-trace-sub">
                        {branch !== null && <>走了「{branch}」 · </>}
                        {clockTime(exec.finishedAt ?? exec.startedAt)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            {focused !== undefined && (
              <pre className="awr-payload">{JSON.stringify(focused.payload, null, 2)}</pre>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function branchOf(flow: Flow | undefined, nodeId: string, branchId: string | null): string | null {
  if (branchId === null || flow === undefined) return null;
  const node = flow.nodes.find((candidate) => candidate.id === nodeId);
  const branch = node?.branches?.find((candidate) => candidate.id === branchId);
  if (branch === undefined) return branchId;
  return branch.condition === '*' ? '默认' : branch.condition;
}

function dedupe(runs: RunListItem[]): RunListItem[] {
  const seen = new Set<string>();
  const out: RunListItem[] = [];
  for (const run of runs) {
    if (seen.has(run.id)) continue;
    seen.add(run.id);
    out.push(run);
  }
  return out;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
