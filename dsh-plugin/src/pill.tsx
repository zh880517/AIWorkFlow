// 标题栏胶囊：一眼看到"哪个流程、走到哪、第几步"，点击展开浮动面板。
import * as React from 'react';
import { isLive, nodeLabel, phaseOf, rootFlowOf, type RunListItem } from '@shared/index.js';
import { phaseKey, type Translate } from './i18n.js';
import type { ProgressStore } from './store.js';
import { Dot, Styles } from './styles.js';

export interface PillProps {
  store: ProgressStore;
  t: Translate;
  /** 当前会话 id（宿主注入）：胶囊只显示本会话的 run，避免串到上一个会话 */
  sessionId?: string;
}

export function ProgressPill({ store, t, sessionId }: PillProps): React.ReactElement | null {
  const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  // 标题栏是每个会话都会挂的组件：把「当前会话」告诉全局 store，由它按会话重拉
  React.useEffect(() => {
    if (typeof sessionId === 'string' && sessionId !== '') store.setSession(sessionId);
  }, [store, sessionId]);
  const detail = snap.detail;
  const run: RunListItem | null = detail ?? snap.active[0] ?? snap.recent[0] ?? null;

  // 还没跑过任何流程时不占标题栏；启动工作流后胶囊才出现
  if (run === null) return null;
  const flow = rootFlowOf(detail?.snapshot ?? null);
  const phase = run === null ? null : phaseOf(run);
  const nodeId = run?.currentNode ?? null;
  const nodeName = nodeId === null ? '' : nodeLabel(flow, nodeId);
  const live = phase !== null && isLive(phase);

  return (
    <React.Fragment>
      <Styles />
      <button
        type="button"
        className="awp-pill"
        data-open={snap.open ? 'true' : 'false'}
        onClick={() => store.toggle()}
        title={t('btn.open')}
        aria-expanded={snap.open}
      >
        <Dot phase={phase} />
        {run === null ? (
          <span className="awp-pill-name">{t('idle')}</span>
        ) : live ? (
          <React.Fragment>
            <span className="awp-pill-name">{run.flowName ?? run.flowId}</span>
            <span className="awp-pill-sep" />
            <span className="awp-pill-sub">{nodeName === '' ? t(phaseKey(phase!)) : nodeName}</span>
            <span className="awp-pill-count">
              {run.stepsUsed} {t('steps')}
            </span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span className="awp-pill-name">{run.flowName ?? run.flowId}</span>
            <span className="awp-pill-sep" />
            <span className="awp-pill-sub">{t(phaseKey(phase!))}</span>
          </React.Fragment>
        )}
      </button>
    </React.Fragment>
  );
}
