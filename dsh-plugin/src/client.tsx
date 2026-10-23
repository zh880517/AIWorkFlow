// Client 半入口：注册两个插槽条目 —— 标题栏进度胶囊 + 全帧浮动面板。
// 由 build.mjs 打包成宿主约定的懒加载 CJS factory。
import * as React from 'react';
import { Boundary, Diagnostics, reportError } from './diagnostics.js';
import { WorkflowPage } from './editor/page.js';
import { bindTranslate, registerTexts } from './i18n.js';
import { ProgressPanel } from './panel.js';
import { ProgressPill } from './pill.js';
import { WorkflowPickerButton, WorkflowPickerDialog } from './picker.js';
import { RunGraphPage } from './runview/page.js';
import { RunGraphOverlay } from './runview/overlay.js';
import { createProgressStore } from './store.js';

export const inject = ['slots', 'locale'];

const HEADER_SLOT = 'conversation.session.header.utilities';
const OVERLAY_SLOT = 'shell.overlay';
const MAIN_SLOT = 'main';
const SIDEBAR_LIST_SLOT = 'sidebar.panellist';
const INPUT_LEFT_SLOT = 'conversation.input.left';
const CONVERSATION_VIEW_SLOT = 'conversation.view';
const ENTRY_ID = 'aiworkflow-progress';
const PANEL_ID = 'aiworkflow';

function WorkflowIcon({ size = 18, active = false }: { size?: number; active?: boolean }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <path
        d="M5 7h5m4 0h5M7.5 9v6m9-6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.85}
      />
      <rect x="3.2" y="4.2" width="4.6" height="4.6" rx="1.4" fill="currentColor" opacity={active ? 1 : 0.7} />
      <rect x="16.2" y="4.2" width="4.6" height="4.6" rx="1.4" fill="currentColor" opacity={active ? 1 : 0.4} />
      <rect x="9.7" y="15.2" width="4.6" height="4.6" rx="1.4" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function apply(ctx: any): void {
  const disposeTexts = registerTexts(ctx);
  const t = bindTranslate(ctx);
  const store = createProgressStore();
  // selectPanel(null) 回到会话；用可选取值，避免和布局服务硬绑定
  const layout = ctx.get('layout') as { selectPanel?: (panelId: string | null) => void } | undefined;
  const exitToConversation = (): void => layout?.selectPanel?.(null);

  ctx.effect(() => () => {
    store.dispose();
    disposeTexts();
  });

  // 运行图页签：只在本会话有 run 时注册；启动工作流之前（或切到没跑过的会话）不出现
  let runTabDispose: (() => void) | null = null;
  const syncRunTab = (): void => {
    const snap = store.getSnapshot();
    // sessionId 由标题栏胶囊写入；没拿到会话前不注册，避免把上一个会话的 run 当成"本会话有 run"
    const hasRuns = snap.sessionId !== null && (snap.active.length > 0 || snap.recent.length > 0);
    try {
      if (hasRuns && runTabDispose === null) {
        runTabDispose = ctx.slots.inject(CONVERSATION_VIEW_SLOT, () =>
          ctx.slots.register(
            { name: CONVERSATION_VIEW_SLOT, id: 'aiworkflow-runs', order: 20, label: () => t('panel.runs') },
            (props: Record<string, unknown>) => (
              <Boundary label="运行图">
                <RunGraphPage
                  sessionId={typeof props.sessionId === 'string' ? props.sessionId : undefined}
                />
              </Boundary>
            ),
          ),
        );
      } else if (!hasRuns && runTabDispose !== null) {
        const dispose = runTabDispose;
        runTabDispose = null;
        dispose();
      }
    } catch (error) {
      reportError('运行图页签注册失败', error);
    }
  };
  ctx.effect(() => {
    const off = store.subscribe(syncRunTab);
    syncRunTab();
    return () => {
      off();
      if (runTabDispose !== null) {
        const dispose = runTabDispose;
        runTabDispose = null;
        dispose();
      }
    };
  });

  ctx.effect(() =>
    ctx.slots.inject(HEADER_SLOT, () =>
      ctx.slots.register({ name: HEADER_SLOT, id: ENTRY_ID, order: 20 }, (props: Record<string, unknown>) => (
        <ProgressPill
          {...props}
          sessionId={typeof props.sessionId === 'string' ? props.sessionId : undefined}
          store={store}
          t={t}
        />
      )),
    ),
  );

  ctx.effect(() =>
    ctx.slots.inject(OVERLAY_SLOT, () =>
      ctx.slots.register({ name: OVERLAY_SLOT, id: ENTRY_ID, order: 20 }, (props: Record<string, unknown>) => (
        <ProgressPanel {...props} store={store} t={t} />
      )),
    ),
  );

  // 全局主面板：流程库 + 画布编辑器；侧边栏图标按同 id 切到这块面板
  ctx.effect(() =>
    ctx.slots.inject(SIDEBAR_LIST_SLOT, () =>
      ctx.slots.register({ name: SIDEBAR_LIST_SLOT, id: PANEL_ID, order: 40, label: () => t('panel.label') }, (props: { size?: number; active?: boolean }) => (
        <WorkflowIcon size={props.size} active={props.active} />
      )),
    ),
  );
  ctx.effect(() =>
    ctx.slots.inject(MAIN_SLOT, () => {
      try {
        return ctx.slots.register({ name: MAIN_SLOT, key: PANEL_ID }, (props: Record<string, unknown>) => (
          <Boundary label="工作流页">
            <WorkflowPage {...props} onExit={exitToConversation} />
          </Boundary>
        ));
      } catch (error) {
        reportError('主面板注册失败', error);
        return () => {};
      }
    }),
  );

  // 运行图：会话内的只读浮层，默认关闭；由浮动进度面板的按钮打开，右上角 × 关闭
  ctx.effect(() =>
    ctx.slots.inject(OVERLAY_SLOT, () =>
      ctx.slots.register({ name: OVERLAY_SLOT, id: 'aiworkflow-runs', order: 30 }, () => <RunGraphOverlay store={store} />),
    ),
  );

  // 输入框左侧的「工作流」按钮：选一张图，直接把运行指令发到对话里（不用记流程名）
  ctx.effect(() =>
    ctx.slots.inject(INPUT_LEFT_SLOT, () =>
      ctx.slots.register({ name: INPUT_LEFT_SLOT, id: 'aiworkflow-picker', order: 30 }, (props: Record<string, unknown>) => (
        <WorkflowPickerButton {...props} />
      )),
    ),
  );
  ctx.effect(() =>
    ctx.slots.inject(OVERLAY_SLOT, () =>
      ctx.slots.register({ name: OVERLAY_SLOT, id: 'aiworkflow-picker', order: 40 }, () => (
        <WorkflowPickerDialog onStarted={() => store.refresh()} />
      )),
    ),
  );

  ctx.effect(() =>
    ctx.slots.inject(OVERLAY_SLOT, () =>
      ctx.slots.register({ name: OVERLAY_SLOT, id: 'aiworkflow-diagnostics', order: 999 }, () => <Diagnostics />),
    ),
  );
}
