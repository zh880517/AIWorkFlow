// 插件自诊断：注册失败时把错误留在页面上，而不是静默消失。
import * as React from 'react';

let message: string | null = null;
let tone: 'error' | 'info' = 'error';
let infoTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function reportError(label: string, error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  message = `${label}：${text}`;
  tone = 'error';
  for (const listener of listeners) listener();
  // 同时进控制台，便于查看完整栈
  console.error('[aiworkflow]', label, error);
}

/** 短暂信息条：用于确认某个页面到底有没有挂载 */
export function reportInfo(text: string): void {
  message = text;
  tone = 'info';
  for (const listener of listeners) listener();
  if (infoTimer !== null) clearTimeout(infoTimer);
  infoTimer = setTimeout(() => {
    infoTimer = null;
    message = null;
    for (const listener of listeners) listener();
  }, 6000);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): string | null {
  return message;
}

interface BoundaryProps {
  label?: string;
  children: React.ReactNode;
}

interface BoundaryState {
  error: Error | null;
  stack: string | null;
}

/** 渲染兜底：插件页面抛错时显示原因与组件栈，而不是留一块黑屏。 */
export class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[aiworkflow] render error', error, info.componentStack);
    this.setState({ stack: info.componentStack ?? null });
  }

  override render(): React.ReactNode {
    const { error, stack } = this.state;
    if (error === null) return this.props.children;
    return (
      <div
        style={{
          padding: 16,
          overflow: 'auto',
          height: '100%',
          boxSizing: 'border-box',
          color: 'var(--dsw-alias-state-error-primary)',
          font: '12px/1.5 ui-monospace, Menlo, monospace',
          whiteSpace: 'pre-wrap',
        }}
        role="alert"
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>aiworkflow {this.props.label ?? '页面'}渲染失败</div>
        <div>{error.message}</div>
        {stack !== null && <div style={{ opacity: 0.75, marginTop: 8 }}>{stack.slice(0, 1200)}</div>}
      </div>
    );
  }
}

export function Diagnostics(): React.ReactElement | null {
  const text = React.useSyncExternalStore(subscribe, snapshot);
  if (text === null) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        maxWidth: 560,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-overlay)',
        color: tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)',
        border: `1px solid ${tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)'}`,
        font: '12px/1.45 ui-monospace, Menlo, monospace',
        pointerEvents: 'auto',
        zIndex: 80,
        whiteSpace: 'pre-wrap',
      }}
      role="alert"
    >
      aiworkflow 插件：{text}
    </div>
  );
}
