# 待处理项（临时文档）

> 记录未决事项与前置条件；条目处理完即删除，结论回写 README / 正式文档。

## P-1 运行图做成会话页签（「对话 / 轨迹」旁边）

**状态：已按"启动后才出现"实现，并已按会话隔离（2026-10-23）**——`conversation.view` 页签 `aiworkflow-runs` 只在**本会话**有 run 之后才注册（客户端订阅进度 store；标题栏胶囊把宿主给的 `sessionId` 写进 store，`/aiworkflow/?session=<sid>` 按 `runs.host_session = 'dsh:<sid>'` 过滤；本会话没有 run 时 store 为空、页签销毁）。运行图页/浮层都带 session 参数，切会话会清空列表重拉，不会再把上一个会话的 run 显示成当前会话的。`host_session` 为空的历史 run 在会话内不可见（全局面板/不带 session 参数时仍可见）。

**仍差一步**：页签出现后不会自动选中（宿主不暴露外部切换 view 的 API，见下）。当前选中的仍是「对话」，需要手动点「运行图」。

**已完成的样子**：运行图目前是会话内的浮层（`dsh-plugin/src/runview/overlay.tsx`），默认关闭；从浮动进度面板的「运行图」按钮打开，`✕` / `Esc` / 点遮罩 / 页内「返回会话」关闭。内容是只读画布（节点按执行状态着色、走过的边高亮、点节点筛轨迹），另带 run 切换与 payload 查看。左侧栏页签与全局主面板注册已经移除。

**为什么还不是 tab**（核对宿主实现：从 `app.asar` 解出 `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 读的）：

- 那排 tab 来自 `conversation.view` 列表槽，插件可以注册第三个条目；
- 但"选中哪个 view"存在宿主内部的 `conversationStore`（持久化键 `dsh.conversation.<sessionId>`，字段 `view`）；
- 切换动作只有两个入口：`conversation.session.header` 的 `inject` 里的 `selectView`，以及传给「当前已选中的那个 view 自己」的 `openView(view, focus)`；
- 插件从浮层或侧栏都拿不到这两个句柄，所以**浮窗按钮无法把会话切到新 tab**。

**三条候选路径**：

| 路径 | 做法 | 代价 |
|---|---|---|
| A（最小） | 注册 `conversation.view` tab（id `aiworkflow-runs`，order 20）；浮窗按钮只负责把它注册出来，用户点一下 tab 打开；页内 `openView('chat','')` 关闭 | 多一次点击，不是"按钮直接打开" |
| B（点击即开） | 打开时用 id `chat` 覆盖 Chat 视图（同 id 替换是槽支持的语义），关闭即 dispose 恢复原 Chat | 打开期间"对话"tab 变成运行图，语义混；若用户当时停在"轨迹"则可能不生效 |
| C（理想） | 等宿主暴露"外部切换 view"的 API（或 `uiConversation.binding(id).activate` 能驱动 React store） | 依赖宿主升级 |

## P-2 如何调用工作流（P-1 的前置条件）

**状态：已实现选择式入口（2026-10-23）**——输入框左侧「工作流」→ 选图 → `POST /aiworkflow/runs` 直接建 run（不再发聊天消息，避免误触发）。run 绑当前会话，Host 用 `followup`（与定时提醒同机制）唤醒 Agent 开始执行。

**仍待定**：卡点由谁放行（面板只读）、运行图默认跟随哪个 run、`followup` 那条系统消息的呈现形式是否要换成更中性的 source。

**现状**：Agent 侧已有 6 个执行类工具（`aiworkflow_start_run` / `get_current_step` / `complete_step` / `report_blocked` / `await_gate` / `answer_gate`），在对话里说一句就能跑完整条流程；但**没有任何 UI 入口**——编辑器、运行图都只能看，不能发起。

**待定的事**：

- **入口形态**：对话里自然语言发起 / 编辑器里的「运行」按钮 / 运行图浮层里的「重跑」/ 三者都要；
- **参数来源**：`cwd`、`projectName` 直接取当前会话工作目录，还是让用户填；
- **卡点放行**：跑起来之后 gate 由谁放行（面板点选仍是只读提示，还是补上点选入口）；
- **默认跟随哪个 run**：当前会话最近一个 / 手动选 / 跟随 `host_session`。

P-1 的默认态（打开时展示哪个 run、tab 是否跟随、要不要"重跑"按钮）依赖这些答案，所以先定 P-2 再决定 A/B/C。
