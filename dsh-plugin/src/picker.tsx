// 工作流启动器：输入框左侧一个「工作流」按钮，点开列出可启动的图，选中即直接创建 run。
// 刻意不发聊天消息——避免在对话里误触发；run 建好后由 Agent 接手执行。
import * as React from 'react';
import { relTime } from '@shared/index.js';
import { resolveEndpoint } from './endpoint.js';
import { Styles } from './styles.js';

interface FlowItem {
  id: string;
  name: string;
  /** flow（缺省）/ agent；agent 是子 Agent 配置，只能被主流程引用，不能单独启动 */
  kind?: 'flow' | 'agent';
  updatedAt: string;
}

/** 启动列表只留主流程：子 Agent 配置没有「独立跑一遍」的语义，混进来会建出无意义的 run */
export function startableFlows(flows: FlowItem[]): FlowItem[] {
  return flows.filter((flow) => flow.kind !== 'agent');
}

interface InputActions {
  setDraft?: (text: string) => void;
}

interface Connection {
  sessionId: string;
  /** 输入框里已有的内容，会随运行一起交给 Agent */
  draft: string;
  actions: InputActions | null;
}

let open = false;
let connection: Connection | null = null;
const listeners = new Set<() => void>();

export const pickerStore = {
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
};

/** 输入框左侧的入口按钮（conversation.input.left） */
export function WorkflowPickerButton(props: any): React.ReactElement {
  const draft =
    typeof props?.useInput === 'function'
      ? props.useInput((state: { draft?: string } | undefined) => state?.draft ?? '')
      : '';
  const onClick = (): void => {
    // 记住当前会话（run 才能绑到它）和输入框内容（随运行一起交给 Agent）
    connection = {
      sessionId: typeof props?.sessionId === 'string' ? props.sessionId : '',
      draft: typeof draft === 'string' ? draft : '',
      actions: (props?.inputActions as InputActions | undefined) ?? null,
    };
    pickerStore.set(true);
  };
  return (
    <React.Fragment>
      {/* 胶囊/面板没跑过流程时不渲染（各自也不渲染 <Styles />），这里自己带一份，避免按钮和弹层裸样式 */}
      <Styles />
      <button type="button" className="awp-pickerbtn" onClick={onClick} title="启动一个工作流">
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7h5m4 0h5M7.5 9v6m9-6v6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="3" y="4" width="5" height="5" rx="1.4" fill="currentColor" />
          <rect x="16" y="4" width="5" height="5" rx="1.4" fill="currentColor" opacity="0.55" />
          <rect x="9.5" y="15" width="5" height="5" rx="1.4" fill="currentColor" opacity="0.9" />
        </svg>
        <span>工作流</span>
      </button>
    </React.Fragment>
  );
}

export interface WorkflowPickerDialogProps {
  /** run 建好之后通知外层刷新（让胶囊/页签立刻出现） */
  onStarted?: () => void;
}

/** 选择弹层（shell.overlay） */
export function WorkflowPickerDialog({ onStarted }: WorkflowPickerDialogProps): React.ReactElement | null {
  const visible = React.useSyncExternalStore(pickerStore.subscribe, pickerStore.getSnapshot);
  const [flows, setFlows] = React.useState<FlowItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    let alive = true;
    setFlows(null);
    setError(null);
    setBusy(null);
    // Host 侧按 kind 过滤，客户端再兜一层（老 Host / 缓存返回全量时也不会漏出配置）
    fetch(resolveEndpoint('aiworkflow/flows?kind=flow'), { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { ok?: boolean; flows?: FlowItem[]; error?: { message?: string } }) => {
        if (!alive) return;
        if (body.ok !== true) {
          setError(body.error?.message ?? '读取流程图列表失败');
          return;
        }
        setFlows(startableFlows(Array.isArray(body.flows) ? body.flows : []));
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      alive = false;
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') pickerStore.set(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  const start = async (flow: FlowItem): Promise<void> => {
    setBusy(flow.id);
    setError(null);
    try {
      const response = await fetch(resolveEndpoint('aiworkflow/runs'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          flowId: flow.id,
          sessionId: connection?.sessionId ?? '',
          note: connection?.draft ?? '',
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: { message?: string }; result?: { error?: boolean; what?: string } };
      if (body.ok !== true) {
        setError(body.error?.message ?? '启动失败');
        setBusy(null);
        return;
      }
      if (body.result?.error === true) {
        setError(body.result.what ?? '启动失败');
        setBusy(null);
        return;
      }
      // 输入框里的补充说明已经随 run 交给 Agent，清空避免重复发送
      if (connection !== null && connection.draft.trim() !== '') {
        try {
          connection.actions?.setDraft?.('');
        } catch {
          // 清空失败不影响已创建的 run
        }
      }
      pickerStore.set(false);
      onStarted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  };

  return (
    <React.Fragment>
      <Styles />
      <div className="awp-modal-backdrop" onClick={() => pickerStore.set(false)} role="presentation">
        <div className="awp-modal" role="dialog" aria-label="启动工作流" onClick={(event) => event.stopPropagation()}>
          <header className="awp-modal-head">
            <span>启动工作流</span>
            <span className="awp-modal-sub">选中即创建 run；输入框里的内容会一并带给 Agent</span>
            <span className="awp-spacer" />
            <button type="button" className="awp-iconbtn" onClick={() => pickerStore.set(false)}>
              ✕
            </button>
          </header>
          <div className="awp-modal-body">
            {error !== null && (
              <div className="awp-banner" data-kind="error">
                {error}
              </div>
            )}
            {flows === null ? (
              <div className="awp-empty">
                <b>读取中…</b>
              </div>
            ) : flows.length === 0 ? (
              <div className="awp-empty">
                <b>还没有可启动的流程</b>
                <p>子 Agent 配置只能被主流程引用，不能单独启动；先去左侧「可视化工作流」建一张主流程。</p>
              </div>
            ) : (
              <div className="awp-pick-list">
                {flows.map((flow) => (
                  <button
                    type="button"
                    key={flow.id}
                    className="awp-pick-item"
                    disabled={busy !== null}
                    onClick={() => void start(flow)}
                  >
                    <span className="awp-pick-name">{flow.name}</span>
                    <span className="awp-pick-meta">
                      {busy === flow.id ? '启动中…' : `${flow.id} · ${relTime(flow.updatedAt)}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
