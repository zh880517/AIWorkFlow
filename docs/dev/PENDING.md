# 待处理项（临时文档）

> 记录未决事项与前置条件；条目处理完即删除，结论回写 README / 正式文档。
> 2026-10-29 审计后已清理：运行图页签、会话隔离、卡点放行方式、默认跟随哪个 run 均已落地。

## P-1 运行图页签不会自动选中

**状态**：页签 `aiworkflow-runs` 已按"本会话有 run 才出现"实现（`client.tsx` 订阅进度 store；
`/aiworkflow/?session=<sid>` 用 `runs.host_session` 过滤）。运行图页 / 浮层都带 session 参数，
切会话会清空重拉。child run 也能从父 run 的「子运行」卡片点进去了（2026-10-29 修复了
`readMonitorState` 把 child 当成"不在会话里"的问题）。

**仍差一步**：页签出现后不会自动切过去。宿主不暴露"外部切换 view"的 API（能拿到 `selectView` 的
只有 `conversation.session.header` 的 inject 与当前选中 view 自己的 `openView`），用户需要手动点一下。

## P-2 `followup` 唤醒消息的 source 呈现

**状态**：输入框左侧的「工作流」选中即 `POST /aiworkflow/runs` 建 run（不经过输入框），
Host 用 `followup` 注入一条 `role: 'user'`、`source: { kind: 'schedule' }` 的消息唤醒 Agent。

**待定**：`schedule` 这个 source 原本是给定时提醒用的，工作流启动复用它可能让 UI 显示成"定时任务"；
是否换成更中性的 source（或宿主提供 `workflow` 类型）需要确认。

## P-3 运行图默认跟随哪个 run

**已定（2026-10-29）**：`readMonitorState` 的顺序是
显式 `selectedId` → 本会话活跃根 run → 最近根 run → 活跃 run → 最近 run。
child run 只有被显式选中时才进入（`selectedId` 可指向本会话 root 名下的 child）。

## P-4 面板卡点放行

**已定**：卡点只走对话代填（`source: chat`），面板只读展示；`source: panel` 保留给未来 UI。
