// 运行图浮层：默认关闭，由浮动进度面板的「运行图」按钮打开，右上角 × 关闭。
// 不走左侧栏的全局面板——这是会话内的一个只读预览层。
import * as React from 'react';
import type { ProgressStore } from '../store.js';
import { RunGraphPage } from './page.js';
import { runCss } from './styles.js';

let open = false;
const listeners = new Set<() => void>();

export const runOverlay = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): boolean {
    return open;
  },
  set(next: boolean): void {
    if (open === next) return;
    open = next;
    for (const listener of listeners) listener();
  },
  toggle(): void {
    runOverlay.set(!open);
  },
};

export function RunGraphOverlay({ store }: { store: ProgressStore }): React.ReactElement | null {
  const visible = React.useSyncExternalStore(runOverlay.subscribe, runOverlay.getSnapshot);
  // 浮层挂在 root 上，拿不到会话 prop；会话范围由标题栏胶囊写进 store
  const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot);

  const close = React.useCallback((): void => runOverlay.set(false), []);

  React.useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, close]);

  if (!visible) return null;

  return (
    <div className="awr-backdrop" onClick={close} role="presentation">
      <style>{runCss}</style>
      <div
        className="awr-dialog"
        role="dialog"
        aria-label="运行图"
        onClick={(event) => event.stopPropagation()}
      >
        <RunGraphPage sessionId={snap.sessionId ?? undefined} onExit={close} />
        <button type="button" className="awr-dialog-close" onClick={close} title="关闭">
          ✕
        </button>
      </div>
    </div>
  );
}
