# aiworkflow

**把「这件事该怎么做」画成流程图，Agent 一次只领一步。**

它解决的不是「Agent 不听话」，而是「一次把几千字流程灌进去，它就不专注了」。流程图在这里的作用是描述
**何时披露什么**，而不是当笼子。Agent 每领一步 → 做完回报 `summary`/`payload` → 再领下一步。

这是一个 **DeepSeek Harness（DSH）插件**：不依赖独立服务，也不支持其它 Agent 客户端。
插件 Host 半直接用 `node:sqlite` 打开 `~/.aiworkflow/aiworkflow.db`，执行引擎复用 `shared/` 里的同一份实现；
Client 半在 DSH 里提供画布编辑器、进度面板和只读运行图。

---

## 能做什么

### 画：可视化流程编辑器

- React Flow 画布：拖拽定位、从节点出口拖线连边、右键菜单、复制粘贴、撤销重做；
- 六种节点：`prompt` 指令、`tool` 工具、`subagent` 子 Agent、`gate` 人工卡点、`join` 汇聚、`end` 结束；
- 卡点**一个选项一个出口**：没连线的出口名字挂在节点右侧，可以从它拖线（或点名字再点目标节点）；
- 属性面板按「头部概览 → 核心字段 → 折叠的高级设置」分层，角色/线程/产物/回路等在头部 chip 直接可读；
- 流程库分「流程 / 子 Agent 配置」：子 Agent 配置可保存自己的角色表和子图，用同一画布创建/编辑，供主流程引用；
- 改动后实时校验：页头显示「校验通过 / 几条警告 / 几处硬拒」，点条目直接定位到节点；
- 保存前跑与 Agent 工具完全相同的 `validateFlow`，不通过不会写库，原图保持不变。

### 跑：把流程交给 Agent 执行

- **逐步披露**：每次只下发当前节点的指令和当前岔路口的条件，图结构不下发；
- **分支用自然语言**：Agent 自己判断该走哪条；`*` 表示默认分支；
- **数据传递**：`complete_step` 回报 `summary`（给人看）+ `payload`（给机器用），后续节点可用 `{{节点.payload.字段}}` 插值；
- **子 Agent**：`inline` / `subflow` / `flowRef` 三种模式；`flowRef` 可以引用一张主流程，也可以引用「子 Agent 配置」（带自己的角色表和子图）；支持 `fanOut`（按数组或固定数量并行）与 `join` 汇总；
- **人工卡点**：run 挂起等人；用户在对话里答复，Agent 用 `answer_gate` 代填（`source: chat`）后继续；
- **循环可控**：节点级 `iterationLimit` + 回路级 `maxRounds`，撞上限可跳到逃生节点，也可以直接判失败。

### 看：进度与运行图

- 标题栏状态胶囊 + 浮动面板（当前步、卡点、已走路径、执行轨迹、payload）；
- 只读运行图：节点按状态着色、走过的边高亮、点节点看这一步的记录；
- 所有 run 落 SQLite，切换会话/重开面板都能按 `dsh:<sessionId>` 找回当时的快照与轨迹。

---

## 设计思想

1. **管理注意力预算，而不是约束 Agent**
   唯一硬性要求是「每步做完必须回报」，否则链条断裂。节点执行中 Agent 想多读文件、多跑命令，完全放开。

2. **图结构对 Agent 隐藏，是降噪而不是保密**
   拓扑对完成当前这步没有用，给了只会稀释注意力。默认不下发；Agent 能不能看到全图是次要问题。

3. **SQLite 是唯一事实源**
   `~/.aiworkflow/flows/*.json`、`cache/` 都是派生镜像，可删、可从库重建。任何写入先落库，永不只写 JSON。

4. **run 对着快照跑（copy-on-run）**
   启动 run 时把图序列化成快照，`flowRef` 递归解析；之后再改图不影响进行中的 run。

5. **报错必须自愈**
   所有拒绝路径都是「错在哪 + 正确姿势 + 当前这一步是什么」三段式，一次往返就能修好，不让人卡死。

6. **人类卡点只能人类放行**
   插件不会替用户做选择；`answer_gate` 只用于转达用户已经说出口的答复。

7. **不静默截断**
   fan-out 超出 `max`、子 Agent 失败后放弃，都会在面板上显性列出，不偷偷丢弃。

---

## 安装

仓库里已经带了构建好的产物，安装时不需要 clone、不需要在本机构建。DSH 侧栏
**Plugins → Add plugin**，粘贴：

```
git+https://github.com/zh880517/AIWorkFlow.git#main&path:/dsh-plugin
```

- `#main` 跟随主分支；要固定版本就换成 commit（只能钉在包含构建产物的提交上，用 `git log --oneline -- dsh-plugin/index.js` 查）；
- `&path:/dsh-plugin` 指定插件在仓库子目录里；
- 装完自动加入 profile 的 bundle 列表并启用，重开 DSH 生效。

也可以让 Agent 代装：`plugin_manager` 的 `install_bundle`，`target` 填同一串。

如果你启用了插件市场（Discover）实验 bundle，还可以加索引来源，然后在市场里点安装：

```
https://raw.githubusercontent.com/zh880517/AIWorkFlow/main/dsh-plugin/market/index.json
```

装好之后：

- 侧栏出现「可视化工作流」，进去是流程库 + 画布编辑器；
- 对话输入框左侧的「工作流」按钮列出所有图，选一张就直接建 run（不发聊天消息）；
- 跑起来后标题栏出现胶囊，点开是进度面板；面板里可以打开「运行图」。

---

## 一次 run 的样子

1. 在「可视化工作流」里画好图，设好入口；
2. 在输入框左侧点「工作流」选一张图（或让 Agent 调 `aiworkflow_start_run`）建 run；
3. Agent 拿到纪律文本 + 第一步，干活后 `aiworkflow_complete_step` 回报 `{ summary, payload? }`；有分支时给 `branchId`；
4. 撞到 `gate` 节点就挂起：人在对话里答复，Agent 调 `answer_gate` 后继续；
5. 走到 `end` 节点结束（`success` / `fail`），面板里能回看整条轨迹。

---

## 流程图长什么样

```jsonc
{
  "id": "f_release",
  "name": "发版检查",
  "entry": "n1",
  "nodes": [
    { "id": "n1", "type": "prompt", "title": "看 diff", "instruction": "列出这次改动的风险点", "next": "n2" },
    { "id": "n2", "type": "tool", "title": "跑测试", "toolName": "Bash",
      "params": { "command": "npm test" },
      "iterationLimit": 3, "onLimitExceeded": "n_fail",
      "branches": [
        { "id": "b1", "condition": "全部通过", "to": "n3" },
        { "id": "b2", "condition": "有失败", "to": "n_fail" }
      ] },
    { "id": "n3", "type": "gate", "title": "能发吗",
      "question": "这次改动可以发版吗？",
      "options": [{ "id": "o1", "label": "发" }, { "id": "o2", "label": "不发" }],
      "branches": [
        { "id": "g1", "condition": "发", "outlet": "o1", "to": "n_ok" },
        { "id": "g2", "condition": "不发", "outlet": "o2", "to": "n_fail" }
      ] },
    { "id": "n_ok", "type": "end", "outcome": "success" },
    { "id": "n_fail", "type": "end", "outcome": "fail" }
  ]
}
```

画布编辑器和 JSON 是同一份数据的两个视图：连线就是 `next` / `branches`，卡点的出口就是 `outlet`。

---

## 目录

```
shared/src/  公用层：DSL 类型、校验、执行引擎、快照、SQLite 表结构、只读查询
dsh-plugin/  DeepSeek Harness 插件（Host 半 + Client 半，构建成 index.js / client.js）
tests/       vitest（内存 node:sqlite）
docs/        设计文档与开发笔记
```

依赖方向固定：`dsh-plugin/ → shared/`。有测试守着，插件或公用层里出现反向依赖会直接失败。

---

## 开发

```bash
npm install
npm run typecheck        # shared + 插件
npm test                 # vitest
npm run build:plugin     # 生成 index.js / client.js（产物要提交）
npm run check:plugin     # 重建并与暂存区比对，防止产物和源码脱节
npm run release:plugin   # 一键：构建 → 提交产物 → 刷新市场索引 → 提交索引 → 打印安装链接
npm run release:plugin -- --dry-run   # 只看会做什么，不动 git 历史
```

> 为什么产物要提交：pnpm 11 默认拦下 git 依赖的 `prepare` 脚本，安装时会多一步「允许脚本并重试」；
> 把产物放进仓库就是零构建、零脚本，粘一行链接就能装。构建是确定性的（同源码两次构建哈希一致、不含机器路径/时间戳）。

## 文档

- 设计文档：[docs/2026-09-02-flowchart-driven-agent-design.md](docs/2026-09-02-flowchart-driven-agent-design.md)
- 插件细节（界面、工具、边界）：[dsh-plugin/README.md](dsh-plugin/README.md)
