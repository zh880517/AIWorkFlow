# 流程图编辑器：交接说明（临时文档）

> 给接手「修复画布编辑交互」的新会话看。只写事实与坑，不写猜测。

## 目标

修 `dsh-plugin/src/editor/` 下的编辑交互问题（拖拽 / 连线 / 属性面板 / 分支条件 / 保存校验等）。
插件已 profile 级安装，**不用重装**；改完构建 + 重载即可看到效果。

## 文件地图

| 文件 | 职责 |
|---|---|
| `dsh-plugin/src/editor/page.tsx` | 页面壳：流程库（列出/新建/删除）→ 画布编辑器；保存、错误横幅、返回会话；撤销/重做历史、复制粘贴、右键菜单接线、快捷键 |
| `dsh-plugin/src/editor/canvas.tsx` | React Flow 画布（provider / fitView / Background / Controls）；节点类型 `wf`；右键与拖动回调；视口中心 API |
| `dsh-plugin/src/editor/menu.tsx` | 画布右键菜单（创建节点 / 复制 / 粘贴 / 删除 / 设为入口），视口坐标 + 贴边翻转 |
| `dsh-plugin/src/editor/model.ts` | DSL ⇄ 画布映射：`canvasOf` / `buildFlow` / `makeNode` / `localIssues` / `typeLabel` |
| `dsh-plugin/src/editor/inspector.tsx` | 右侧属性面板：分区标题 + 加粗字段名 + 独立灰色说明；按节点类型给字段、多出边时编辑分支条件、设入口、删除节点 |
| `dsh-plugin/src/editor/api.ts` | 前端 HTTP：`GET/PUT/DELETE /aiworkflow/flows[/:id]` |
| `dsh-plugin/src/editor/styles.ts` | `.wf-*` 样式，只用 `--dsw-alias-*` token |
| `dsh-plugin/src/client.tsx` | 注册侧栏页签 `aiworkflow` + 主面板 `main.key='aiworkflow'` |

## 构建 / 重载 / 验证

```bash
npm run typecheck:plugin && npm run build:plugin
```

然后 `plugin_manager`：`set_plugin target="include:aiworkflow-progress" enabled=false`，再 `enabled=true`（两次调用都必须同时给 target 和 enabled）。

验证限制：本环境**没有浏览器控制/截图**，界面效果只能让用户看截图；能自动验证的是 `npm run typecheck:plugin`、`build:plugin`、主工程 `npm test`，以及 `Invoke-WebRequest http://127.0.0.1:6102/aiworkflow/flows` 这类接口冒烟。

## 硬约束（都踩过）

1. **不要 `import 'react/jsx-runtime'`**。宿主只提供 `react` / `react-dom`；混入第二份 jsx-runtime 会让 React Flow 报 **#31**（object with keys `$$typeof/type/key/ref/props`）。`build.mjs` 已把 `react/jsx-runtime` 别名到 `src/jsx-runtime-shim.ts`，自己新写的模块别绕开它。
2. **JSX 用经典转换**（`React.createElement`），tsconfig 里 `jsx: "react"`；不要开 automatic。
3. **颜色只能来自 `--dsw-alias-*`**。品牌色填充的按钮文字用 `var(--dsw-alias-bg-base)`（写死 `#fff` 会在深色主题下白底白字——这个 bug 修过一次）。
4. **Client 半不能 require Harness 客户端包**（`@deepseek-ai/dsh-client-*`）；React Flow 是唯一允许的第三方依赖，已在 bundle 里。
5. **主面板注册要 try/catch**：`main` 是 keyed 槽，注册失败曾导致主区域黑屏。当前顺序是：先注册 `sidebar.panellist`，再注册 `main`，都包在 `ctx.effect` 里。
6. **保存走主工程同一套 `validateFlow`**（`shared/flows.ts`）。硬拒不落库、原图不变；错误码 + nodeId 原样展示。别在前端另写一套校验结论。

## 已修过的问题（别回退）

| 现象 | 原因 | 修法 |
|---|---|---|
| 画布整块报 React #31 | 打包带进了第二份 `react/jsx-runtime` | `build.mjs` 别名到 `jsx-runtime-shim.ts` |
| 「新建流程」按钮空白 | 主按钮文字写死 `#fff`，深色主题下白底白字 | 文字改 `var(--dsw-alias-bg-base)` |
| 主面板黑屏 | `main` 注册抛错 | 先注册侧栏项 + try/catch + `reportError` |
| 画布浅色残留 | React Flow 默认样式 | `.wf-canvas` 里把 `--xy-*` 变量接到 `--dsw-alias-*` |
| 右键没有菜单 | 只接了左键回调，`onPaneContextMenu` / `onNodeContextMenu` / `onEdgeContextMenu` 都没接 | 新增 `menu.tsx`；`canvas.tsx` 接线，菜单用 fixed 视口坐标并贴边翻转 |
| 没有撤销 / 重做 | 节点、边、节点本体、入口是四份独立 state，没有统一快照 | `page.tsx` 里存 snapshot 历史（nodes/edges/bodies/entry/name）+ Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + 工具栏按钮 |
| 只点选连线也显示「未保存」 | `handleEdgesChange` 对**所有** edge change 置 dirty | 只有 add/remove/replace 置 dirty |
| 加第二条出边后保存被拒「多个 default」 | `buildFlow` 把空条件一律补成 `*` | 只有第一路补 `*`；其余保持空，交给校验器报 `E_EMPTY_CONDITION`（错误信息才指向真问题） |
| 键盘删除节点后，属性面板还在编辑已删节点 | React Flow 自带 `deleteKeyCode` 绕过 `deleteNode`，bodies/入口/选中都没清 | `deleteKeyCode={null}`，删除统一走 `deleteSelected`（清 bodies、修入口、清选中，并压一次历史） |
| 新增节点落在视口外 / 叠在一起 | 位置写死 `y=320` 起 | 加节点前取画布视口中心（`CanvasApi.center()`），每 6 个再错开偏移 |
| 卡点保存后每个选项都警告「没有连线」 | 分支没有 `outlet`，校验器/引擎按 outlet 或分支 id 匹配选项 | `buildFlow` 给 gate 节点补 `outlet`；属性面板「出口分支」改成按选项一行，给选项挑目标节点就等于连/删一条出边（`bindGateTarget()`） |
| 加了选项，「出口分支」行数不变 | 出口分支原先按**出边**渲染（选项只是边上的标签），加选项不会凭空长出一条边 | 卡点改成**选项驱动**：每个选项一行下拉选目标节点；画布上先拉的线可被认领；删选项连带删它的出边 |

## 当前实现的事实（改之前先确认，别按记忆）

- 画布节点/边的唯一数据源是 `canvasOf(flow)`：位置优先取 `flow._ui.positions`，缺省按 `autoPosition(index)` 网格铺开。
- **连线即后继**：`buildFlow` 从边重建 DSL——单出边写 `next`，多出边写 `branches`；索引 0 的空条件补 `*`，其余空条件**保持空**（交给校验器报 `E_EMPTY_CONDITION`；补成 `*` 会变成多个 default）。
- **卡点出口**：多出边时每条边绑定一个选项（`edge.data.outlet`），优先于按顺序兜底；`condition` 引擎不用但校验器要求非空，所以用选项文案补齐。只有一条出边且**没绑定选项**时才写 `next`（引擎对 gate 的 next 兜底 = 所有选项走同一节点）；绑定过选项就写 `branches`，否则校验器会对每个选项报 `W_GATE_OPTION_UNWIRED`。
- **卡点「出口分支」是选项驱动的**（`bindGateTarget(edges, gateId, optionId, label, targetId)` in `model.ts`）：一行一个选项，下拉选目标节点 = 建一条 `gate→目标` 的出边（自动顺延 `bN`，边 id 用 `e-<gateId>-out-<optionId>`，标签写选项文案）；选「（未连线）」= 删掉这条边。已有绑定边只改 `target`；画布上先拉了线还没归属选项的，会被**认领**而不是再连一条；同卡点已有边指向同一目标时拒绝并 `reportInfo`。删选项 / 改选项文案由 `patchNode` 同步（删边 / 改边标签）。
- 节点本体（instruction/options/params/fanOut/iterationLimit/onLimitExceeded/subflow 等）不在画布节点里，存在 `bodies` map（`page.tsx`），保存时按边重建，其余字段原样保留。**subflow 目前只保留不可编辑**：模式选项被禁用，已有 subflow 节点会显示警告。
- 属性面板分区：基本信息 / 类型参数 / 补充说明（非 prompt、非 end 的 instruction）/ 循环与逃生（iterationLimit、onLimitExceeded）/ 出口分支；工具参数是键值对行，fan-out 是 from 与 count 互斥 + max。
- 撤销/重做是快照栈（`page.tsx` 的 `record()` / `undo()` / `redo()`）：任何会改图的新交互都必须**先 `record()` 再改 state**，否则撤销漏步；同一个输入框连续输入用 `record('patch:<nodeId>:<field>')` 在 900ms 内合并；拖拽在 `onNodeDragStart` 压一次，整段只算一步。
- 快捷键只在页面内生效（window keydown + `pageRef` 包含判断）：Ctrl+S 保存（焦点在输入框里也拦，防浏览器「保存网页」）、Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y、Ctrl+C / Ctrl+V、Delete/Backspace。除 Ctrl+S 外，焦点在 input/textarea/select 时都让给浏览器原生行为。
- 未保存保护：`← 流程库` / `返回会话` 会先 confirm；dirty 时挂 `beforeunload`。删除流程库里的图也有 confirm。
- 入口标记：`data.isEntry` 由 `withEntryFlags()` 统一维护——`setEntryId`、删除节点、撤销、保存成功后都要刷一遍；入口不渲染 target handle，`onConnect` / `onReconnect` 里再兜底拒一次「连进入口」。
- 连线重连：`onReconnect` 只改 source/target，保留 `edge.data`（条件 / 出口绑定）；连进入口、重复边会被拒绝并 `reportInfo`。
- 删除节点仍不会自动清其他节点里的 `waitFor` / `onLimitExceeded` 引用；这两个字段现在都有下拉可改（悬空值会显示「节点 X 已不存在」），保存被校验器拦下后可以就地修。
- 右键菜单：画布用 `onPaneContextMenu`（React Flow 内部 `wrapHandler` 只在 `event.target === pane` 时触发，节点/边右键盘不会误开画布菜单）；节点和边各自有独立菜单。菜单定位是 fixed 视口坐标，`ContextMenu` 自己贴边翻转；画布菜单的「新建节点」是一层子菜单（`MenuItem.children`，悬停/点击展开，靠右翻左、贴底上移）。
- **分支出口排布**：`spreadSourceHandles()` 在渲染层把同一节点的出边按数组顺序挂到 `out-0` / `out-1` …，节点卡按出边数量渲染多个右侧 handle（从上到下均分）。state 里的边不保存 handle 绑定，`buildFlow` 仍按边顺序生成 branches。
- **属性面板宽度可拖**：画布与面板之间是 `.wf-splitter`（pointer capture 拖动，键盘 ←/→ 调 16px、Shift 48px、Home 复位、双击复位），宽度 240–640 且保证画布至少 280px；宽度写进 localStorage `aiworkflow.editor.inspectorWidth`。`.wf-inspector` 不再写死 `width:312px`，宽度由内联 style 给。
- **运行图轮询去抖**：`runview/page.tsx` 用业务数据指纹（active/recent/selectedId/detail）判断是否 `setData`；`generatedAt` 每轮都变，不能参与比较。否则每 2 秒一次的空刷新会让边标签闪动。
- `localIssues()` 仍是死代码；实时校验走 Host 的 `POST /flows/validate`（与保存同一个 `validateFlow`），页头 chip + 浮层定位；保存结果仍以服务端返回为准。
- 编辑器与运行图是两套东西：`runview/` 只读，别把编辑能力加进去。

## 排查顺序建议

1. 先 `cordis_inspect_query`（client / Slots）确认 `sidebar.panellist` 里的 `aiworkflow`、`main` 的 `key='aiworkflow'` 都 active——不在就说明注册失败。
2. 再看浏览器控制台/右下角「诊断」浮层（插件自带 `reportError` / `reportInfo`），错误边界会把组件栈打出来。
3. 交互问题优先复现：新建图 → 加节点 → 连线 → 改属性 → 保存 → 重新打开，看哪一步丢数据。
4. 改完必须重新构建 + 重载，否则看到的还是旧 bundle（client.js 由宿主加载，不会自动热更，除非 `pnpm run dev:web` 在跑）。

## 本轮修的范围（2026-10-23）

用户点名的三块：① 画布右键菜单（创建节点 / 复制 / 粘贴 / 删除 / 设为入口）② 撤销、重做（工具栏按钮 + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）③ 属性面板排版（区块标题、字段名加粗、说明独立成行）。

顺带修了上表里的 5 个交互/保存问题：点选连线误报未保存、第二条出边保存被拒「多个 default」、键盘删节点后编辑已删节点、新增节点落在视口外、卡点每个选项都警告未连线。

验证过：`npm run typecheck:plugin`、`npm run build:plugin`、`npm test`（184 passed）；另外用一次性脚本跑过 `buildFlow` 的关键行为（单边写 next、双边只有一个 default、gate 按选项补 outlet、`canvasOf` 往返不丢条件/outlet）。界面效果仍需用户看截图——本环境没有浏览器控制。

## 第二轮：P0 + P1（2026-10-23）

用户同意按「P0 + P1」补，`subflow` 暂时禁用。已做：

**P0（会卡住 / 丢数据）**
- 卡点选项 id 去重（`nextOptionId()`，删掉 o1 后再加不会撞 o2）。
- 卡点出边可显式绑定选项（属性面板「出口分支」下拉 → `edge.data.outlet`），不再只靠连线顺序猜；`condition` 用选项文案补齐（引擎不用它，校验器要求非空）。
- 离开拦截：`← 流程库` / `返回会话` confirm + dirty 时 `beforeunload`；删除流程 confirm。
- 入口：画布卡片「入口」徽标、入口不渲染 target handle、连入被拒。
- 连线重连：接上 `onReconnect`（原先是死交互），保留条件/出口数据，拦连入入口与重复边。
- 删除目标后被悬空的 `onLimitExceeded`：字段现在可见可改，不再死锁。

**P1（DSL 字段入口）**
- `iterationLimit`、`onLimitExceeded`（节点下拉，含「已不存在」提示）。
- `tool.params` 键值对编辑（值按 JSON 解析，失败按字符串）。
- `subagent.fanOut`：from 与 count 互斥 + max。
- 非 prompt / 非 end 节点的 `instruction`（引擎对所有类型都会下发）。
- `flowRef` / `waitFor` 改成下拉（flowRef 排除当前图；waitFor 排除自己；当前值不在列表时保留「已不存在」项）。
- `subflow` 模式选项禁用 + 警告文案（面板不编辑内嵌子图）。

**本轮没做（下一批）**
- 预览（Agent 视角）、流程复制/导入导出、多选复制、调色板拖入。
- 自定义出口（outlets）在卡片上增删/排序/指定默认分支——画布结构改造，最大的一块。
- Flow 级 `description` / `maxSteps` 无入口。

## 第三轮：实时校验 + 插值提示（2026-10-23）

- Host 新增两条只读路由：`POST /aiworkflow/flows/validate`（干跑，复用 `validateFlowOnly`，不落库）、`GET /aiworkflow/flows/:id/payload-fields`（从该图历史 run 的 completed payload 学字段名）。
- 编辑器实时校验：改动后防抖 350ms 调 validate，页头显示「✓ 校验通过 / ⚠ N 条警告 / ✕ N 处硬拒」；点开浮层列出错误与警告，点条目选中并 `fitView` 定位节点。保存仍以服务端结果为准（两处共用同一个校验器）。
- 插值提示：指令 / 子 Agent 附加指令 / 汇聚指令三个文本域下方有可折叠的「插值提示」，列出其他节点 + 历史 run 学到的 payload 字段；点 chip 在光标处插入 `{{节点.payload.字段}}`（受控 textarea 走原生 setter + input 事件，和主编辑器同一套做法）。
- Escape 现在会依次收起校验浮层、右键菜单并取消选中。

## 第四轮：卡点出口改成选项驱动（2026-10-23）

用户反馈：在卡点上加了第三个选项，「出口分支」还是只有两行。原因是那一段按**出边**渲染，选项只是边上的标签——加选项不会凭空长出一条边，缺口在“选项与出口是两套东西”这件事上完全不可见。

- 卡点「出口分支」改成**一行一个选项**，下拉直接挑目标节点：选中即在画布上建一条出边（`bindGateTarget()`，边 id `e-<gateId>-out-<optionId>`、分支号顺延 `bN`、标签写选项文案）；选「（未连线）」即删掉这条边。所以加选项立刻多一行。
- 画布上先拉的、还没归属选项的线会被**认领**（只补 `outlet`，不重复连）；同一卡点已有边指向同一目标时拒绝并提示。认领后剩下的无主出边会在段落底部黄色提示里列出。
- 改选项文案同步改边标签；删选项连带删它的出边（都在 `patchNode` 里做），不留无主的线。
- 非卡点节点仍是「第 N 路 + 条件输入」；卡点单出边也不再走 `next` 兜底提示（每个选项各有出口）。
- 另外：画布右键菜单的「新建节点」合并成一层子菜单（`MenuItem.children`，靠右翻左、贴底上移）。
- 单测新增 `bindGateTarget` 一组 7 条（建边 / 认领 / 改指向 / 断开 / 冲突 / 自连 / 存盘后 outlet+condition），总计 199 passed。
