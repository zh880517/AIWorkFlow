// 编辑器样式：只使用宿主主题 token；画布本体沿用 React Flow 自带样式。
export const editorCss = `
.wf-page{display:flex;flex-direction:column;height:100%;min-height:420px;min-width:0;position:relative;color:var(--dsw-alias-label-primary);font-size:13px}
.wf-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.wf-title{font-weight:600;font-size:13px}
.wf-sub{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.wf-spacer{flex:1}
.wf-btn{height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.wf-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
/* 品牌色填充时用背景色当反色文字：浅色主题(蓝底)与深色主题(白底)都能读 */
.wf-btn[data-primary="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.wf-btn[data-primary="true"]:hover{filter:brightness(1.06)}
.wf-btn:disabled{opacity:.5;cursor:default}
.wf-input{height:26px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;min-width:0}
.wf-input:focus{border-color:var(--dsw-alias-brand-primary)}
.wf-palette{display:flex;align-items:center;gap:6px;padding:8px 14px;flex:none;flex-wrap:wrap;
  border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wf-body{flex:1;display:flex;min-height:0}
.wf-canvas{flex:1;min-width:0;min-height:0;position:relative;background:var(--dsw-alias-bg-base);
  /* React Flow 的主题变量改接到 DSH token，明暗主题一起跟随 */
  --xy-background-color:var(--dsw-alias-bg-base);
  --xy-background-pattern-color:var(--dsw-alias-border-l2);
  --xy-edge-stroke:var(--dsw-alias-border-l2);
  --xy-edge-stroke-selected:var(--dsw-alias-brand-primary);
  --xy-edge-stroke-width:1.4;
  --xy-edge-label-background-color:var(--dsw-alias-bg-layer-2);
  --xy-edge-label-color:var(--dsw-alias-label-secondary);
  --xy-connectionline-stroke:var(--dsw-alias-brand-primary);
  --xy-handle-background-color:var(--dsw-alias-brand-primary);
  --xy-handle-border-color:var(--dsw-alias-bg-layer-1);
  --xy-selection-background-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);
  --xy-selection-border:1px dashed var(--dsw-alias-brand-primary);
  --xy-controls-button-background-color:var(--dsw-alias-bg-layer-2);
  --xy-controls-button-background-color-hover:var(--dsw-alias-bg-layer-1);
  --xy-controls-button-color:var(--dsw-alias-label-primary);
  --xy-controls-button-border-color:var(--dsw-alias-border-l1);
  --xy-controls-box-shadow:0 0 0 1px var(--dsw-alias-border-l1);
  --xy-attribution-background-color:transparent}
.wf-flow{width:100%;height:100%}
.wf-inspector{width:312px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);overflow-y:auto;
  padding:12px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:12px}
.wf-field{display:flex;flex-direction:column;gap:5px}
/* 字段名加粗、用主文字色；说明文字单独一行（.wf-hint），不再和 label 混在一句里 */
.wf-label{font-size:12px;font-weight:700;color:var(--dsw-alias-label-primary);letter-spacing:.01em;line-height:1.3}
.wf-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.wf-hint-warn{color:var(--dsw-alias-state-warn-primary)}
.wf-section{display:flex;flex-direction:column;gap:10px}
.wf-section-title{font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-secondary);letter-spacing:.08em;
  text-transform:uppercase;padding-bottom:5px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-insp-head{display:flex;align-items:center;gap:8px;padding-bottom:9px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-kind{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.wf-id{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wf-chip{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-bg-base);
  background:var(--dsw-alias-brand-primary)}
.wf-insp-empty{display:flex;flex-direction:column;gap:8px;padding:4px 2px}
.wf-insp-empty-title{font-size:12px;font-weight:700}
.wf-insp-foot{display:flex;gap:8px;margin-top:auto;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1)}
.wf-area{min-height:76px;padding:6px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  resize:vertical;outline:none;width:100%;box-sizing:border-box}
.wf-area:focus{border-color:var(--dsw-alias-brand-primary)}
.wf-row{display:flex;align-items:center;gap:6px}
.wf-row .wf-input{flex:1}
.wf-note{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}
/* 右键菜单：视口坐标 fixed，贴边时由组件翻进视口 */
.wf-menu{position:fixed;z-index:90;min-width:196px;max-width:280px;padding:5px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgba(15,23,42,.24);
  display:flex;flex-direction:column;gap:1px}
.wf-menu-head{padding:4px 8px 5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dsw-alias-label-secondary)}
.wf-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border:0;border-radius:7px;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.wf-menu-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wf-menu-item:disabled{opacity:.45;cursor:default}
.wf-menu-item[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.wf-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-menu-hint{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.wf-btn[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-danger="true"]:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-tone="error"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.wf-btn[data-tone="ok"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
/* 实时校验浮层：贴在页头下方，点条目定位节点 */
.wf-val-pop{position:absolute;top:46px;left:14px;z-index:95;width:min(560px,calc(100% - 28px));
  max-height:min(420px,60vh);overflow:auto;padding:10px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);
  box-shadow:0 12px 32px rgba(15,23,42,.24);display:flex;flex-direction:column;gap:4px}
.wf-val-head{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;padding:0 2px 4px}
.wf-val-item{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;padding:6px 8px;
  border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;cursor:pointer}
.wf-val-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wf-val-item:disabled{cursor:default;opacity:.75}
.wf-val-item[data-kind="error"] .wf-val-code{color:var(--dsw-alias-state-error-primary)}
.wf-val-item[data-kind="warning"] .wf-val-code{color:var(--dsw-alias-state-warn-primary)}
.wf-val-code{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;padding-top:1px}
.wf-val-msg{flex:1;line-height:1.45}
/* 插值提示 */
.wf-hints{margin-top:2px}
.wf-hints summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-secondary);outline:none}
.wf-hints-node{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.wf-hints-name{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-hints-name code{font-size:10.5px}
.wf-hints-chips{display:flex;flex-wrap:wrap;gap:4px}
.wf-hints-chip{max-width:100%;padding:2px 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-hints-chip:hover{border-color:var(--dsw-alias-brand-primary)}
.wf-list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;padding:8px;flex:1}
.wf-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:1px solid transparent;cursor:pointer}
.wf-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.wf-item-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-item-meta{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-empty{padding:32px 18px;text-align:center;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:8px;align-items:center}
.wf-banner{margin:8px 14px 0;padding:8px 10px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.wf-banner[data-kind="error"]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.wf-banner[data-kind="ok"]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.wf-banner ul{margin:4px 0 0;padding-left:16px}
.wf-node{min-width:132px;max-width:188px;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 2px 8px rgba(15,23,42,.12)}
.wf-node[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.wf-node[data-kind="gate"]{border-left:3px solid var(--dsw-alias-state-warn-primary)}
.wf-node[data-kind="end"]{border-left:3px solid var(--dsw-alias-state-success-primary)}
.wf-node[data-kind="subagent"]{border-left:3px solid var(--dsw-alias-brand-primary)}
.wf-node-kind{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);font-weight:700}
.wf-entry-badge{margin-left:6px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-bg-base);font-size:9px;letter-spacing:.02em;vertical-align:1px}
.wf-node-title{font-size:12.5px;font-weight:600;margin-top:1px;word-break:break-word}
.wf-node-detail{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.react-flow__attribution{background:transparent;color:var(--dsw-alias-label-secondary);font-size:9px;opacity:.6}
`;
