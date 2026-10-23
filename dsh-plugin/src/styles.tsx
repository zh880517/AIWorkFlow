// 插件样式：只使用宿主主题 token（--dsw-alias-*），明暗主题自动跟随。
// 以 <style> 元素随组件渲染，卸载即移除，不向 document 追加节点。
import * as React from 'react';

export const css = `
.awp-pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 10px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font-size:12px;font-family:inherit;cursor:pointer;max-width:300px;min-width:0;
  transition:background .12s ease,border-color .12s ease,color .12s ease}
.awp-pill:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-pill[data-open="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-pill-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-pill-sep{width:1px;height:11px;background:var(--dsw-alias-border-l2);flex:none}
.awp-pill-sub{font-size:11.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-pill-count{font-size:11px;font-variant-numeric:tabular-nums;opacity:.85;flex:none}

.awp-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.awp-dot[data-phase="running"]{background:var(--dsw-alias-brand-primary);animation:awp-pulse 1.7s ease-out infinite}
.awp-dot[data-phase="gate"]{background:var(--dsw-alias-state-warn-primary)}
.awp-dot[data-phase="children"]{background:var(--dsw-alias-state-idle-primary)}
.awp-dot[data-phase="finished"]{background:var(--dsw-alias-state-success-primary)}
.awp-dot[data-phase="failed"]{background:var(--dsw-alias-state-error-primary)}
.awp-dot[data-phase="stale"]{background:var(--dsw-alias-state-warn-primary);opacity:.6}
@keyframes awp-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
  70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}

.awp-panel{position:fixed;top:54px;right:18px;width:404px;max-height:min(74vh,760px);display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-family:inherit;
  border:1px solid var(--dsw-alias-border-l1);border-radius:16px;overflow:hidden;z-index:60;
  font-size:13px;line-height:1.5;box-shadow:0 24px 60px rgba(15,23,42,.22),0 2px 10px rgba(15,23,42,.10);
  /* 全帧浮层本身是 click-through，占用者必须主动收回指针事件 */
  pointer-events:auto}
.awp-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}
.awp-title{font-weight:600;font-size:13px;letter-spacing:.01em}
.awp-spacer{flex:1}
.awp-iconbtn{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;border:1px solid transparent;
  background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;line-height:1;font-family:inherit}
.awp-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-textbtn{height:22px;padding:0 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.awp-textbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:999px;font-size:11px;
  font-weight:600;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.awp-chip[data-phase="running"],.awp-chip[data-phase="gate"]{color:var(--dsw-alias-brand-primary)}
.awp-chip[data-phase="gate"]{color:var(--dsw-alias-state-warn-primary)}
.awp-chip[data-phase="finished"]{color:var(--dsw-alias-state-success-primary)}
.awp-chip[data-phase="failed"]{color:var(--dsw-alias-state-error-primary)}

.awp-runs{display:flex;gap:6px;padding:0 14px 10px;overflow-x:auto;scrollbar-width:none}
.awp-runs::-webkit-scrollbar{display:none}
.awp-run{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:9px;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;flex:none;font-family:inherit}
.awp-run:hover{color:var(--dsw-alias-label-primary)}
.awp-run[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-run-name{max-width:150px;overflow:hidden;text-overflow:ellipsis}

.awp-body{padding:0 14px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.awp-body::-webkit-scrollbar{width:8px}
.awp-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px}

.awp-hero{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px;background:var(--dsw-alias-bg-layer-1);
  display:flex;flex-direction:column;gap:7px}
.awp-kicker{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:600}
.awp-node{font-size:16px;font-weight:650;line-height:1.3;display:flex;align-items:center;gap:8px;flex-wrap:wrap;word-break:break-word}
.awp-type{font-size:10px;font-weight:600;padding:3px 6px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1)}
.awp-instr{color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;
  overflow:hidden;white-space:pre-wrap;word-break:break-word}
.awp-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.awp-meta b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}

.awp-section{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.awp-path{display:flex;align-items:center;overflow-x:auto;padding:1px 0 3px;scrollbar-width:none}
.awp-path::-webkit-scrollbar{display:none}
.awp-step{display:flex;align-items:center;flex:none}
.awp-step-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);max-width:170px}
.awp-step-pill em{font-style:normal;font-size:10px;opacity:.75}
.awp-step-pill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-step[data-current="true"] .awp-step-pill{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-link{width:12px;height:1px;background:var(--dsw-alias-border-l2);flex:none}

.awp-trace{display:flex;flex-direction:column;gap:1px}
.awp-row{display:flex;gap:8px;padding:6px;border-radius:8px;cursor:pointer;border:1px solid transparent;align-items:flex-start}
.awp-row:hover{background:var(--dsw-alias-bg-layer-2)}
.awp-row[data-open="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awp-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.awp-row-top{display:flex;align-items:center;gap:6px;min-width:0}
.awp-row-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-row-sub{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-seq{font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);width:18px;text-align:right;flex:none;padding-top:3px}
.awp-tag{font-size:9.5px;font-weight:600;padding:2px 5px;border-radius:5px;flex:none;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1)}
.awp-tag[data-tone="ok"],.awp-tag[data-tone="done"]{color:var(--dsw-alias-state-success-primary)}
.awp-tag[data-tone="bad"],.awp-tag[data-tone="blocked"]{color:var(--dsw-alias-state-error-primary)}
.awp-tag[data-tone="warn"],.awp-tag[data-tone="partial"],.awp-tag[data-tone="limit"],.awp-tag[data-tone="dispatched"]{color:var(--dsw-alias-state-warn-primary)}
.awp-pre{margin:5px 0 0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;max-height:180px;overflow:auto;
  white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-secondary)}

.awp-gate{border:1px solid var(--dsw-alias-state-warn-primary);border-radius:12px;padding:10px 12px;
  background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:6px}
.awp-gate-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--dsw-alias-state-warn-primary)}
.awp-gate-q{font-weight:600;word-break:break-word}
.awp-gate-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.awp-opts{display:flex;gap:6px;flex-wrap:wrap}
.awp-opt{padding:4px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary);font-size:11.5px;font-family:inherit;cursor:default}

.awp-empty{padding:26px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;
  color:var(--dsw-alias-label-secondary)}
.awp-empty b{color:var(--dsw-alias-label-primary);font-weight:600;font-size:13px}
.awp-empty p{margin:0;font-size:12px;max-width:300px}
.awp-empty code{font-family:ui-monospace,Menlo,monospace;font-size:11px;word-break:break-all;
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px 8px;max-width:100%}

.awp-foot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1);
  font-size:10.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
.awp-mono{font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 输入框左侧：工作流选择入口 */
.awp-pickerbtn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.awp-pickerbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  border-color:var(--dsw-alias-border-l2)}

/* 选择弹层 */
.awp-modal-backdrop{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent);pointer-events:auto}
.awp-modal{width:min(560px,100%);max-height:min(70vh,560px);display:flex;flex-direction:column;overflow:hidden;
  border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);
  color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;
  box-shadow:0 24px 60px rgba(15,23,42,.3)}
.awp-modal-head{display:flex;align-items:baseline;gap:8px;padding:12px 14px;font-weight:600;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.awp-modal-sub{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.awp-modal-body{overflow-y:auto;padding:8px}
.awp-pick-list{display:flex;flex-direction:column;gap:2px}
.awp-pick-item{display:flex;flex-direction:column;gap:2px;align-items:flex-start;width:100%;padding:8px 10px;
  border-radius:9px;border:1px solid transparent;background:transparent;color:inherit;font:inherit;
  text-align:left;cursor:pointer}
.awp-pick-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awp-pick-name{font-weight:550;font-size:13px}
.awp-pick-meta{font-size:11px;color:var(--dsw-alias-label-secondary)}
`;

export function Styles(): React.ReactElement {
  return <style>{css}</style>;
}

export function Dot({ phase }: { phase: string | null }): React.ReactElement {
  return <span className="awp-dot" data-phase={phase ?? 'idle'} />;
}
