// 运行图样式：只用宿主主题 token（--dsw-alias-*），明暗主题自动跟随。
export const runCss = `
.awr-page{display:flex;flex-direction:column;height:100%;min-height:420px;min-width:0;
  color:var(--dsw-alias-label-primary);font-size:13px;background:var(--dsw-alias-bg-base)}
.awr-head{display:flex;align-items:center;gap:8px;padding:10px 14px;flex:none;flex-wrap:wrap;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.awr-title{font-weight:600;font-size:13px}
.awr-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.awr-spacer{flex:1}
.awr-btn{height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.awr-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awr-btn[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2)}
.awr-runs{display:flex;align-items:center;gap:6px;padding:8px 14px;flex:none;overflow-x:auto;
  border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.awr-run{display:flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:999px;flex:none;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:11.5px;cursor:pointer;max-width:220px}
.awr-run:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awr-run[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2)}
.awr-run-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary,var(--dsw-alias-border-l2))}
.awr-dot[data-phase="running"]{background:var(--dsw-alias-brand-primary)}
.awr-dot[data-phase="gate"]{background:var(--dsw-alias-state-warn-primary)}
.awr-dot[data-phase="children"]{background:var(--dsw-alias-state-warn-primary)}
.awr-dot[data-phase="finished"]{background:var(--dsw-alias-state-success-primary)}
.awr-dot[data-phase="failed"]{background:var(--dsw-alias-state-error-primary)}
.awr-body{flex:1;display:flex;min-height:0}
.awr-canvas{flex:1;min-width:0;min-height:0;position:relative;background:var(--dsw-alias-bg-base);
  --xy-background-color:var(--dsw-alias-bg-base);
  --xy-background-pattern-color:var(--dsw-alias-border-l2);
  --xy-edge-stroke:var(--dsw-alias-border-l2);
  --xy-edge-stroke-selected:var(--dsw-alias-brand-primary);
  --xy-edge-label-background-color:var(--dsw-alias-bg-layer-2);
  --xy-edge-label-color:var(--dsw-alias-label-secondary);
  --xy-handle-background-color:var(--dsw-alias-border-l2);
  --xy-handle-border-color:var(--dsw-alias-bg-base);
  --xy-controls-button-background-color:var(--dsw-alias-bg-layer-2);
  --xy-controls-button-background-color-hover:var(--dsw-alias-bg-layer-1);
  --xy-controls-button-color:var(--dsw-alias-label-primary);
  --xy-controls-button-border-color:var(--dsw-alias-border-l1);
  --xy-controls-box-shadow:0 0 0 1px var(--dsw-alias-border-l1);
  --xy-attribution-background-color:transparent}
.awr-rail{width:320px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);overflow-y:auto;
  padding:10px 12px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px}
.awr-meta{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word}
.awr-meta code{font-size:10.5px}
.awr-node{min-width:140px;max-width:196px;padding:8px 10px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2);border-left-width:3px;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 2px 8px rgba(15,23,42,.12)}
.awr-node[data-state="idle"]{opacity:.72;border-left-color:var(--dsw-alias-border-l2)}
.awr-node[data-state="done"]{border-left-color:var(--dsw-alias-state-success-primary)}
.awr-node[data-state="current"]{border-left-color:var(--dsw-alias-brand-primary);
  box-shadow:0 0 0 1px var(--dsw-alias-brand-primary),0 2px 10px rgba(15,23,42,.16)}
.awr-node[data-state="waiting"]{border-left-color:var(--dsw-alias-state-warn-primary)}
.awr-node[data-state="blocked"]{border-left-color:var(--dsw-alias-state-error-primary)}
.awr-node[data-selected="true"]{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.awr-node-top{display:flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.04em;font-weight:700;
  color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.awr-node-kind{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-node-count{color:var(--dsw-alias-brand-primary);text-transform:none;font-size:10px}
.awr-node-state{margin-left:auto;text-transform:none;font-weight:600;letter-spacing:0}
.awr-node[data-state="done"] .awr-node-state{color:var(--dsw-alias-state-success-primary)}
.awr-node[data-state="current"] .awr-node-state{color:var(--dsw-alias-brand-primary)}
.awr-node[data-state="waiting"] .awr-node-state{color:var(--dsw-alias-state-warn-primary)}
.awr-node[data-state="blocked"] .awr-node-state{color:var(--dsw-alias-state-error-primary)}
.awr-node-title{font-size:12.5px;font-weight:600;margin-top:2px;word-break:break-word}
.awr-node-detail{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;word-break:break-word}
.awr-empty{margin:auto;padding:32px 18px;text-align:center;color:var(--dsw-alias-label-secondary);
  display:flex;flex-direction:column;gap:8px;align-items:center}
.awr-empty code{font-size:11px}
.awr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 10px;
  background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:6px}
.awr-card-title{font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:6px}
.awr-card-q{font-size:12px;line-height:1.5}
.awr-card-opts{display:flex;flex-wrap:wrap;gap:6px}
.awr-opt{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-secondary)}
.awr-card-hint{font-size:10.5px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.awr-trace{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.awr-trace-item{display:flex;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;
  border:1px solid transparent;font-size:12px}
.awr-trace-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awr-trace-item[data-sel="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.awr-trace-seq{width:16px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:right;padding-top:1px}
.awr-trace-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.awr-trace-node{display:flex;align-items:center;gap:6px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-trace-iter{font-style:normal;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.awr-chip{font-size:9.5px;padding:0 6px;border-radius:999px;border:1px solid currentColor;line-height:15px;flex:none}
.awr-chip[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}
.awr-chip[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}
.awr-chip[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}
.awr-trace-summary{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.awr-trace-sub{font-size:10px;color:var(--dsw-alias-label-secondary);opacity:.85}
.awr-payload{margin:0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-base);
  border:1px solid var(--dsw-alias-border-l1);font-size:10.5px;line-height:1.5;overflow:auto;max-height:220px;
  white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.react-flow__attribution{background:transparent;color:var(--dsw-alias-label-secondary);font-size:9px;opacity:.6}
.awr-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent)}
.awr-dialog{position:relative;display:flex;flex-direction:column;width:min(1080px,100%);height:min(740px,100%);
  border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base);
  box-shadow:0 24px 64px rgba(15,23,42,.32)}
.awr-dialog .awr-page{height:100%}
.awr-dialog-close{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;cursor:pointer}
.awr-dialog-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
`;
