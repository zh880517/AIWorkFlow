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
.wf-body{flex:1;display:flex;min-height:0;position:relative}
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
.wf-inspector{flex:none;min-width:0;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
/* 面板三段式：页签固定、内容滚动、底部动作固定；头部在滚动区里吸顶 */
.wf-insp-root{display:flex;flex-direction:column;height:100%;min-height:0;container-type:inline-size}
.wf-insp-tabs{flex:none;display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-tab{height:30px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.wf-tab:hover{color:var(--dsw-alias-label-primary)}
.wf-tab[data-active="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.wf-insp-scroll{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.wf-insp-head{flex:none;padding:10px 12px 8px;
  background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);
  display:flex;flex-direction:column;gap:6px}
.wf-insp-head-row{display:flex;align-items:center;gap:8px;min-width:0}
.wf-insp-title{flex:1;min-width:0;height:26px;padding:0 2px;border:0;border-bottom:1px solid transparent;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:700;
  outline:none;border-radius:0}
.wf-insp-title:focus{border-bottom-color:var(--dsw-alias-brand-primary)}
.wf-insp-title::placeholder{color:var(--dsw-alias-label-secondary);font-weight:600}
.wf-icon-btn{flex:none;width:22px;height:22px;padding:0;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;
  line-height:1;cursor:pointer}
.wf-icon-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
/* 概览 chip：头部一眼看到角色/线程/产物/子图/回路/分支；单行横滚，避免多行把头部撑高 */
.wf-chips{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;scrollbar-width:none}
.wf-chips::-webkit-scrollbar{display:none}
.wf-sum-chip{flex:none;max-width:100%;padding:2px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;
  line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button.wf-sum-chip{cursor:pointer}
button.wf-sum-chip:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.wf-sum-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 高级字段的说明收进 label 右侧的小 i */
.wf-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:5px;
  border-radius:50%;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);
  font-size:9px;font-weight:700;font-style:normal;cursor:help;vertical-align:1px}
/* 分段控件：执行方式 / 结束结果 */
.wf-seg{display:flex;gap:2px;padding:2px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base)}
.wf-seg button{flex:1;height:22px;padding:0 6px;border:0;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.wf-seg button:hover:not([data-active="true"]){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wf-seg button[data-active="true"]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.wf-mode-row{display:flex;align-items:center;gap:8px;justify-content:space-between}
.wf-mode-row .wf-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 高级设置：一行一个折叠组，折叠头显示当前值摘要 */
.wf-adv{display:flex;flex-direction:column}
.wf-acc{border-top:1px solid var(--dsw-alias-border-l1)}
.wf-adv .wf-acc:last-child{border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-acc-head{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 2px;border:0;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.wf-acc-head:hover .wf-acc-title{color:var(--dsw-alias-brand-primary)}
.wf-acc-caret{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary);transition:transform .12s}
.wf-acc-caret[data-open="true"]{transform:rotate(90deg)}
.wf-acc-title{flex:none;font-weight:600}
.wf-acc-summary{flex:1;min-width:0;text-align:right;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-acc-body{display:flex;flex-direction:column;gap:10px;padding:2px 0 10px}
/* 窄面板下高级两列退化成单列 */
.wf-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@container (max-width:280px){.wf-grid2{grid-template-columns:1fr}}
/* 卡点选项行：label + 目标 + 删除 */
.wf-opt-row{display:flex;align-items:center;gap:6px}
.wf-opt-row .wf-input{flex:1;min-width:0}
.wf-opt-target{flex:none;max-width:84px;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-opt-target[data-empty="true"]{color:var(--dsw-alias-state-warn-primary)}
/* 当前节点的校验问题 */
.wf-issues{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;
  border:1px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}
.wf-issues[data-has-error="true"]{border-color:var(--dsw-alias-state-error-primary);
  background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}
.wf-issues-head{font-size:11px;font-weight:700;color:var(--dsw-alias-state-warn-primary)}
.wf-issues[data-has-error="true"] .wf-issues-head{color:var(--dsw-alias-state-error-primary)}
.wf-issue{display:flex;gap:6px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.wf-issue code{flex:none;font-size:10px;color:var(--dsw-alias-state-error-primary)}
.wf-issue[data-kind="warning"] code{color:var(--dsw-alias-state-warn-primary)}
/* 图页签里的角色卡 */
.wf-agent{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wf-insp-empty{display:flex;flex-direction:column;gap:8px;padding:4px 2px}
.wf-insp-empty-title{font-size:12px;font-weight:700}
.wf-insp-foot{flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;
  border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
/* 画布 / 属性面板之间的分隔条：拖动改宽度，双击复位 */
.wf-splitter{flex:none;width:7px;cursor:col-resize;position:relative;background:transparent;
  touch-action:none;user-select:none;outline:none}
.wf-splitter::after{content:'';position:absolute;left:3px;top:0;bottom:0;width:1px;
  background:var(--dsw-alias-border-l1);transition:background .12s,width .12s,left .12s}
.wf-splitter:hover::after,.wf-splitter:focus-visible::after,
.wf-splitter[data-dragging="true"]::after{left:2px;width:2px;background:var(--dsw-alias-brand-primary)}
.wf-field{display:flex;flex-direction:column;gap:5px}
/* 字段名加粗、用主文字色；说明文字单独一行（.wf-hint），不再和 label 混在一句里 */
.wf-label{font-size:12px;font-weight:700;color:var(--dsw-alias-label-primary);letter-spacing:.01em;line-height:1.3}
.wf-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.wf-hint-warn{color:var(--dsw-alias-state-warn-primary)}
.wf-section{display:flex;flex-direction:column;gap:10px}
/* 核心字段：类型已经在头部标了，不再套一层同名区块标题 */
.wf-core{display:flex;flex-direction:column;gap:10px}
.wf-section-title{font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-secondary);letter-spacing:.08em;
  text-transform:uppercase;padding-bottom:5px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-kind{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.wf-id{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wf-chip{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-bg-base);
  background:var(--dsw-alias-brand-primary)}
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
.wf-menu-caret{flex:none;font-size:13px;line-height:1;color:var(--dsw-alias-label-secondary);opacity:.75}
.wf-menu-group{position:relative}
/* 子菜单：贴父项右侧（重叠 2px，避免斜着移过去时中间漏 hover），靠右边缘时翻到左侧 */
.wf-menu.wf-submenu{position:absolute;top:-5px;left:calc(100% - 2px);margin:0}
.wf-menu.wf-submenu[data-side="left"]{left:auto;right:calc(100% - 2px)}
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
.wf-node{position:relative;min-width:132px;max-width:188px;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);
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
.wf-node[data-subflow="true"]{min-width:208px;max-width:252px}
.wf-subflow{margin-top:6px;padding-top:5px;border-top:1px dashed var(--dsw-alias-border-l2)}
.wf-subflow-head{display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--dsw-alias-label-secondary)}
.wf-subflow-open{margin-left:auto;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:9.5px;line-height:15px;cursor:pointer}
.wf-subflow-open:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.wf-subflow-map{display:block;width:100%;height:76px;margin-top:3px;color:var(--dsw-alias-label-secondary)}
.wf-crumb{display:flex;align-items:center;gap:5px;max-width:46vw;overflow:hidden;white-space:nowrap;
  font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-crumb b{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis}
.react-flow__attribution{background:transparent;color:var(--dsw-alias-label-secondary);font-size:9px;opacity:.6}
/* 卡点：没连线的出口名字挂在卡片右侧外面，点它开始连线 */
.wf-outlet-tag{position:absolute;left:calc(100% + 12px);transform:translateY(-50%);max-width:160px;
  padding:1px 7px;border-radius:999px;border:1px dashed var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:16px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none;
  box-shadow:0 1px 4px rgba(15,23,42,.10)}
.wf-outlet-tag:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary);
  border-style:solid;background:var(--dsw-alias-bg-overlay)}
.wf-connect-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;
  display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:999px;
  border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-overlay);
  color:var(--dsw-alias-label-primary);font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.22)}
.wf-outlet-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:3px 0}
.wf-outlet-name{font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary);word-break:break-word}
`;
