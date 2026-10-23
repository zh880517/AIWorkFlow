// 浮动进度面板：窄栏里讲清"当下这一步 + 走过的路 + 最近几步"，
// 不画整图（整图留给 aiworkflow 自己的面板），因此信息密度和可读性优先。
import * as React from 'react';
import {
  branchLabel,
  buildPath,
  clockTime,
  duration,
  elapsedOf,
  executionTone,
  isLive,
  nodeLabel,
  oneLine,
  phaseOf,
  relTime,
  rootFlowOf,
  type FlowNode,
  type RunListItem,
} from '@shared/index.js';
import { phaseKey, type Translate } from './i18n.js';
import { runOverlay } from './runview/overlay.js';
import type { ProgressStore } from './store.js';
import { Dot, Styles } from './styles.js';

export interface PanelProps {
  store: ProgressStore;
  t: Translate;
}

export function ProgressPanel({ store, t }: PanelProps): React.ReactElement | null {
  const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [openExec, setOpenExec] = React.useState<number | null>(null);

  if (!snap.open) return null;

  const detail = snap.detail;
  const flow = rootFlowOf(detail?.snapshot ?? null);
  const phase = detail === null ? null : phaseOf(detail);
  const path = detail === null ? [] : buildPath(detail);
  const live = phase !== null && isLive(phase);
  const currentNodeId = detail?.currentNode ?? null;
  const currentNode = currentNodeId === null ? undefined : flow?.nodes.find((n) => n.id === currentNodeId);
  const heroTitle =
    detail === null
      ? ''
      : currentNodeId === null
        ? (detail.flowName ?? detail.flowId)
        : nodeLabel(flow, currentNodeId);
  const executions = detail === null ? [] : detail.executions;
  const rows = [...executions].reverse();
  const runs = dedupeRuns([...snap.active, ...snap.recent]);

  return (
    <React.Fragment>
      <Styles />
      <aside className="awp-panel" role="dialog" aria-label={t('title')}>
        <header className="awp-head">
          <span className="awp-title">{t('title')}</span>
          {phase !== null && (
            <span className="awp-chip" data-phase={phase}>
              <Dot phase={phase} />
              {t(phaseKey(phase))}
            </span>
          )}
          <span className="awp-spacer" />
          <button type="button" className="awp-textbtn" onClick={() => runOverlay.set(true)} title={t('panel.runs')}>
            {t('panel.runs')}
          </button>
          <button type="button" className="awp-iconbtn" onClick={() => store.setOpen(false)} title={t('title')}>
            ✕
          </button>
        </header>

        {runs.length > 0 && (
          <div className="awp-runs" aria-label={t('run.select')}>
            {runs.map((run) => (
              <button
                type="button"
                key={run.id}
                className="awp-run"
                data-sel={snap.selectedId === run.id ? 'true' : 'false'}
                onClick={() => store.select(run.id)}
                title={`${run.flowName ?? run.flowId} · ${relTime(run.createdAt)}`}
              >
                <Dot phase={phaseOf(run)} />
                <span className="awp-run-name">{run.flowName ?? run.flowId}</span>
                <span>{relTime(run.createdAt)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="awp-body">
          {snap.updatedAt === null && snap.error === null ? (
            <div className="awp-empty">
              <b>{t('loading')}</b>
            </div>
          ) : !snap.available ? (
            <EmptyState
              title={snap.error !== null ? t('empty.error') : t('empty.noDb')}
              hint={snap.error ?? snap.reason ?? t('empty.noDbHint')}
              dbPath={snap.dbPath}
              label={t('empty.dbPath')}
              endpoint={snap.endpoint}
            />
          ) : detail === null ? (
            <EmptyState title={t('empty.noRuns')} hint={t('empty.noRunsHint')} dbPath={snap.dbPath} label={t('empty.dbPath')} />
          ) : (
            <React.Fragment>
              <section className="awp-hero">
                <div className="awp-kicker">{live ? t('hero.current') : t('hero.last')}</div>
                <div className="awp-node">
                  <span>{heroTitle}</span>
                  {currentNode !== undefined && <span className="awp-type">{currentNode.type}</span>}
                </div>
                {currentNode !== undefined && <NodeDetail node={currentNode} />}
                <div className="awp-meta">
                  <span>
                    {t('hero.steps')} <b>{detail.stepsUsed}</b>
                  </span>
                  <span>
                    {t('hero.elapsed')} <b>{duration(elapsedOf(detail))}</b>
                  </span>
                  <span>
                    {t('hero.started')} <b>{clockTime(detail.createdAt)}</b>
                  </span>
                </div>
              </section>

              {detail.pendingGate !== null && (
                <section className="awp-gate">
                  <div className="awp-gate-head">
                    <Dot phase="gate" />
                    {t('gate.title')}
                  </div>
                  <div className="awp-gate-q">{detail.pendingGate.question || nodeLabel(flow, detail.pendingGate.nodeId)}</div>
                  <div className="awp-opts">
                    {detail.pendingGate.options.map((option) => (
                      <span className="awp-opt" key={option.id}>
                        {option.label}
                      </span>
                    ))}
                  </div>
                  <div className="awp-gate-hint">{t('gate.hint')}</div>
                </section>
              )}

              {path.length > 0 && (
                <section>
                  <div className="awp-section">{t('path')}</div>
                  <div className="awp-path">
                    {path.map((step, index) => (
                      <div className="awp-step" key={`${step.nodeId}-${String(index)}`} data-current={index === path.length - 1 ? 'true' : 'false'}>
                        {index > 0 && <span className="awp-link" />}
                        <span className="awp-step-pill">
                          <Dot phase={stepTone(step.statuses)} />
                          <span>{step.label}</span>
                          {step.count > 1 && <em>×{step.count}</em>}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="awp-section">{t('trace')}</div>
                {rows.length === 0 ? (
                  <div className="awp-gate-hint">{t('trace.empty')}</div>
                ) : (
                  <div className="awp-trace">
                    {rows.map((exec, rowIndex) => {
                      const tone = executionTone(exec).key;
                      const branch = branchLabel(flow, exec.nodeId, exec.branchId);
                      const summary = oneLine(exec.summary, 120);
                      return (
                        <div
                          className="awp-row"
                          key={exec.id}
                          data-open={openExec === exec.id ? 'true' : 'false'}
                          onClick={() => setOpenExec(openExec === exec.id ? null : exec.id)}
                          title={t('payload.hint')}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setOpenExec(openExec === exec.id ? null : exec.id);
                            }
                          }}
                        >
                          <span className="awp-seq">{executions.length - rowIndex}</span>
                          <span className="awp-row-main">
                            <span className="awp-row-top">
                              <span className="awp-row-name">{nodeLabel(flow, exec.nodeId)}</span>
                              <span className="awp-tag">#{exec.iteration}</span>
                              {branch !== null && <span className="awp-tag">{branch}</span>}
                            </span>
                            <span className="awp-row-sub">
                              {summary !== '' ? summary : clockTime(exec.finishedAt ?? exec.startedAt)}
                            </span>
                            {openExec === exec.id && (
                              <pre className="awp-pre">{JSON.stringify(exec.payload, null, 2)}</pre>
                            )}
                          </span>
                          <span className="awp-tag" data-tone={tone}>
                            {exec.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </React.Fragment>
          )}
        </div>

        {detail !== null && <footer className="awp-foot">
          <span className="awp-mono">{detail.id}</span>
          <span className="awp-spacer" />
          {snap.updatedAt !== null && (
            <span>
              {t('foot.updated')} {clockTime(new Date(snap.updatedAt).toISOString())}
            </span>
          )}
        </footer>}
      </aside>
    </React.Fragment>
  );
}

function NodeDetail({ node }: { node: FlowNode }): React.ReactElement | null {
  const text = nodeText(node);
  if (text === null) return null;
  return <div className="awp-instr">{text}</div>;
}

/** 各节点类型只展示对"当下在干什么"最有信息量的那一行 */
function nodeText(node: FlowNode): string | null {
  switch (node.type) {
    case 'prompt':
      return oneLine(node.instruction, 260);
    case 'gate':
      return oneLine(node.question, 260);
    case 'tool':
      return `工具 · ${node.toolName}`;
    case 'subagent':
      return oneLine(node.extraPrompt, 220) || `子 Agent · ${node.mode}`;
    case 'join':
      return oneLine(node.aggregateInstruction, 220);
    case 'end':
      return node.outcome === 'fail' ? '以失败结束' : '以成功结束';
    default:
      return null;
  }
}

function stepTone(statuses: string[]): 'finished' | 'failed' | 'running' {
  if (statuses.includes('blocked')) return 'failed';
  if (statuses.every((status) => status === 'completed')) return 'finished';
  return 'running';
}

function dedupeRuns(runs: RunListItem[]): RunListItem[] {
  const seen = new Set<string>();
  const unique: RunListItem[] = [];
  for (const run of runs) {
    if (seen.has(run.id)) continue;
    seen.add(run.id);
    unique.push(run);
  }
  return unique.slice(0, 8);
}

function EmptyState({
  title,
  hint,
  dbPath,
  label,
  endpoint,
}: {
  title: string;
  hint: string;
  dbPath: string;
  label: string;
  endpoint?: string;
}): React.ReactElement {
  return (
    <div className="awp-empty">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="20" cy="44" r="5" fill="currentColor" opacity="0.35" />
        <circle cx="44" cy="20" r="5" fill="currentColor" opacity="0.35" />
        <path d="M24 41 L40 23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" fill="none" />
      </svg>
      <b>{title}</b>
      <p>{hint}</p>
      {dbPath !== '' && <code>{label}: {dbPath}</code>}
      {endpoint !== undefined && endpoint !== '' && dbPath === '' && <code>{endpoint}</code>}
    </div>
  );
}


