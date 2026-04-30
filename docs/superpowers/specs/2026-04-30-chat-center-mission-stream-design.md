# 对话中心 · 场景任务流式对话化设计

- **日期**: 2026-04-30
- **作者**: zhuyu / claude
- **范围**: `src/app/(dashboard)/chat`、`src/components/chat`、`src/app/api/missions/[id]/progress`
- **不改**: mission 执行引擎（mission-executor、leader-plan、Inngest 函数）、`/missions/[id]` 详情页、自由对话路径

## 1. 问题与目标

### 1.1 现状

对话中心选定员工 → 点击场景 → 弹出参数表单（`WorkflowLaunchDialog`）→ 提交后后端 `startMissionFromTemplate` 创建 mission → 在对话流里插入一条 `kind: "mission_card"` 的系统消息，由 `MissionCardMessage` 渲染。

`MissionCardMessage` 通过 `/api/missions/[id]/progress` SSE 拉进度，**只渲染一张静态卡**：

- 任务名 + 总进度%
- 一行一个任务：`emoji + title + status`（✅ 已完成 / 🔄 运行 / ❌ 失败 / ⏭️ 跳过 / ⏳ 等待）

### 1.2 用户痛点

> "对话框只有任务执行的步骤，没有过程中的输出，我希望在对话中心这块每一步还是有对话输出的。执行前还是要进行思考，分析语义理解，每个步骤会用到哪个员工，哪个技能等。"

具体三点：

1. **执行前没有"语义理解"陈述** — 用户不清楚系统是否真的领会了诉求、接下来打算怎么干。
2. **每步没有人话输出** — 只有 emoji + 标题，看不到该步骤实际产出了什么。
3. **没有员工/技能归属感** — 不知道是哪个 AI 员工在干、用什么技能。

### 1.3 目标

把"场景启动路径"在对话框里的体验，从"静态进度卡"升级为**逐步骤气泡流**，对齐自由对话路径已有的"thinking + skills + sources"质感，并补上场景路径专属的"计划总览"开场陈述。

`/missions/[id]` 详情页不改 —— 保留它作为看板视图。

## 2. 信息架构

场景启动后，对话流里依次出现：

```
[用户消息：启动场景 + 参数摘要]
   ↓
[② 计划总览气泡] —— pre-execution，开场陈述
   ↓
[③ 步骤气泡 1] running → completed (with outputSummary)
[③ 步骤气泡 2] running → completed
[③ 步骤气泡 3] running → failed (含「重试本步」按钮)
[④ 等待依赖的步骤气泡，淡灰预览]
   ↓
[⑤ 收尾气泡] —— mission completed/failed 总结
```

右上角浮一个 **sticky 进度 chip**：`N/M 步 · 进行中`，点击可锚跳到当前 running 那条气泡。

**完全替换** 原来的 `MissionCardMessage` 静态卡。`/missions/[id]` 详情页不变。

## 3. 组件设计

### 3.1 新增组件

#### `src/components/chat/mission-stream.tsx`

替换 `MissionCardMessage` 在对话流里的渲染入口。Props：

```ts
{
  missionId: string;
  templateName: string;   // 场景名，从 mission_card 系统消息透传
}
```

内部职责：

1. 调用 `useMissionProgress(missionId)`（已有 hook）拿状态。
2. 渲染 sticky 进度 chip（`fixed top-20 right-6`，z-40）。
3. 渲染计划总览气泡（一次性、不依赖 SSE，直接从初始事件里取 template steps 即可）。
4. 渲染 step 气泡列表（按 `phase`/`order` 排序）。
5. 渲染收尾气泡（`mission-completed` 后出现）。

#### `src/components/chat/mission-step-bubble.tsx`

单步气泡。Props：

```ts
{
  task: MissionTask;       // 来自 SSE
  stepNumber: number;      // 1-based
  totalSteps: number;
  skillName?: string;      // 来自 template steps[i].config.skillName
  employeeMeta?: {         // 通过 task.assignedEmployeeId 反查 EMPLOYEE_META
    name: string;
    avatarUrl?: string;
    color: string;
  };
  onRetry?: () => void;    // 失败状态下挂载
  onSkip?: () => void;
}
```

**头像/名字**：必须按 `task.assignedEmployeeId` 反查（不是对话框顶上选定的员工 —— 那是入口员工，未必是当前执行步骤的员工）。反查路径：`employees` prop（已传给 `chat-center-client`）→ 找到对应 employee → 取 `EMPLOYEE_META[id]`。如果 `assignedEmployeeId` 为空（执行引擎尚未指派），fallback 到 mission owner（即对话框顶上选定的员工）。

**状态机**：

| 状态 | 头部样式 | 正文 |
|------|---------|------|
| `pending` | `text-gray-500`，⏰ 图标，opacity-50 | （无正文） |
| `running` | `text-blue-600`，旋转 Loader2，"进行中…" | 跳动三点骨架 + 可选实时元信息 |
| `completed` | `text-blue-600`，✅，耗时，"引用 N 篇资料" | `outputSummary` markdown + "查看完整结果"链接 |
| `failed` | `text-red-600`，⚠️ "执行失败"，"已重试 X/3" | 红卡：`error_message` + 「重试本步」「跳过此步」「查看错误日志」三按钮 |
| `skipped` | `text-gray-500`，⏭️ "已跳过（依赖失败）"，opacity-50 | （无正文） |
| `cancelled` | `text-gray-500`，⏹️ "已取消"，opacity-50 | （无正文） |

**打字机渲染**：`completed` 状态下 `outputSummary` 通过 `useTypewriter(text, 30 chars/sec)` 自定义 hook 输出，完成后停在末态。**只在状态首次切换到 completed 那次播放打字机**；后续重渲染（如父组件其他原因更新）直接显示完整文本，避免回放骚扰。

**技能徽章**：`skillName` 存在时显示紫色 chip；不存在时不渲染。

### 3.2 计划总览气泡

`mission-stream.tsx` 内嵌的子结构。**不抽组件**，直接 inline。

**内容生成**：纯字符串模板拼接，**不调 LLM**：

```
理解了。本次「{templateName}」共 {N} 步，由 {员工去重列表} 协作完成：
1. {step1.name} — {emp1.shortName} · 使用「{skill1.name}」
2. {step2.name} — {emp2.shortName} · 使用「{skill2.name}」
…
现在开始执行 →
```

**触发时机**：mission 启动后，`useMissionProgress` 首次回调（`isLoading: false`）就立即渲染。气泡上方挂"小策已规划任务 · 耗时 0.2s"伪元信息（"耗时"取 0.1-0.3s 之间随机数即可，避免显得太假；这是对话化设计的小道具，不是真实时间）。

> **注**：故意不调 LLM。诉求里"分析语义理解"在场景启动这条路径上是 fake thinking —— 用户已经点过场景、填过表单，再"分析"一遍是多此一举。这条气泡本质是把"执行计划"用人话讲一遍，给用户接下来要发生什么的预期。

### 3.3 收尾气泡

`mission-completed`（status=completed）时出现，由场景的 owner / leader 头像（即顶上选定员工）发出，正文：

```
任务「{templateName}」已完成 · 总耗时 {duration}
共完成 {N} 步，引用 {totalRefs} 篇资料。
```

底部挂 `MessageActionBar`（已有：查热点 / 数据分析 / 去创作 / 总结要点）—— 之前每条 assistant 消息都挂一行，现在改为只挂在收尾气泡上，避免步骤气泡里堆满按钮。

**失败收尾**：status=failed 时正文换为：

```
任务「{templateName}」执行失败。{N} 步中 {M} 步失败。
点击对应失败步骤的「重试本步」可恢复执行。
```

不挂动作按钮。

### 3.4 Sticky 进度 chip

`fixed top-20 right-6 z-40`。组件内部消费 `useMissionProgress` 的 `tasksById` 计算 `completed / total / running`。

视觉：

- 左侧脉冲点（蓝色 + ping 动画）— mission 还在跑时显示；完成时换 ✅ 静态点，失败时换 ⚠️ 静态点。
- 中间文字：`{completed}/{total} 步 · {状态文本}`
- 右侧 N 个圆点对应 N 个步骤：完成蓝实心、当前运行蓝色脉冲、待执行灰色。

点击：滚动到 DOM 中第一个 `data-status="running"` 的步骤气泡。

### 3.5 删除/废弃

- `src/components/chat/mission-card-message.tsx` —— 删除（仅在 `chat-panel.tsx:670` 一处用，替换为新组件）。
- `chat-panel.tsx` 里 `mission_card` 分支改为渲染 `<MissionStream>`。

## 4. 后端最小改动

### 4.1 SSE 路由扩展

文件：`src/app/api/missions/[id]/progress/route.ts`

**新增字段**（`task-update` 事件 payload）：

- `outputSummary: string | null` —— 完成后立刻推送；运行/等待时推 null
- `errorMessage: string | null` —— 失败时推送
- `errorRecoverable: 0 | 1` —— 失败时推送，决定"重试本步"按钮是否启用
- `retryCount: number` —— 已重试次数
- `phase: number | null` —— 用于步骤排序与 `skillName` 对位

**新增事件类型** `mission-init`：连接建立后，**一次性**推送 mission 的：

- `templateName: string`
- `templateId: string`
- `steps: Array<{ phase: number; name: string; skillName?: string; assignedEmployeeIdHint?: string }>` —— 从 `workflow_templates.steps` 直接读

之所以用 init 事件而非每条 task-update 都带 step 信息，是因为 step 元信息（name / skillName）在 mission 创建后是不变的，没必要每次都推。

### 4.2 `parse-mission-event.ts` 扩展

新增：

```ts
export interface MissionInitData {
  templateId: string;
  templateName: string;
  steps: Array<{
    phase: number;
    name: string;
    skillName?: string;
  }>;
}

export interface MissionTask {
  // 已有字段...
  outputSummary?: string | null;
  errorMessage?: string | null;
  errorRecoverable?: boolean;
  retryCount?: number;
  phase?: number | null;
}

export interface MissionProgressData {
  // 已有字段...
  init: MissionInitData | null;  // 来自 mission-init 事件
}
```

`applyMissionEvent` 加 `mission-init` 分支。`emptyMissionProgress` 初始化 `init: null`。

### 4.3 `useMissionProgress` hook

无需结构性改动 —— 把 init 也作为 setState 的一部分；type 透出 `init`。

## 5. 数据流

```
点击场景 → WorkflowLaunchDialog → startMissionFromTemplate (server action)
  → 创建 mission + tasks + workflow snapshot
  → 返回 missionId
  → 前端往对话流插 { kind: "mission_card", missionId, templateName }
  → ChatPanel 渲染该消息时分流到 <MissionStream>
  → MissionStream 内挂 useMissionProgress(missionId)
    → SSE 连接 /api/missions/[id]/progress
    → 收到 mission-init：拿到 steps + skillNames
    → 收到 task-update：合并到 tasksById
    → 收到 mission-progress / mission-completed：更新总状态
  → MissionStream 按 phase 排序渲染：
    ① 计划总览气泡（基于 init.steps + 员工反查）
    ② 步骤气泡列表（每步一个 MissionStepBubble）
    ③ 收尾气泡（status=completed/failed 后）
  → 右上角 StickyProgressChip 同步消费同一份 state
```

## 6. 失败/取消处理

### 6.1 失败

- 单步失败 → 该步气泡变红 + 「重试本步 / 跳过此步 / 查看错误日志」三按钮
- 重试调用现有 `retryMissionTask(taskId)` server action（`/missions/[id]` 详情页已在用）—— 复用，不新增
- 跳过调用 `skipMissionTask(taskId)` server action —— 如果尚不存在，本设计文档不引入；按钮在 server action 不存在时直接隐藏，留作 follow-up

### 6.2 取消

- mission `status=cancelled` 时：
  - 所有 `running` 状态步骤气泡变灰 + ⏹️ "已取消"
  - 所有 `pending` 状态步骤完全不渲染（折叠掉，避免空气泡列表）
  - 收尾气泡显示"任务已取消"

## 7. 视觉样式

参考已确认的 mockup（`.superpowers/brainstorm/<session>/chat-mission-stream.html`）。关键：

- 每条助手气泡沿用 `bg-gradient-to-br from-white/90 to-gray-50/70 backdrop-blur-sm rounded-2xl ring-1 ring-gray-200/30 shadow-[0_1px_6px_rgba(0,0,0,0.06)]`
- 用户消息：`bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm`，启动场景的用户消息加一行小字标记 `启动场景：{name}`
- 技能徽章：`bg-violet-50 text-violet-600` chip
- 来源标签：`bg-blue-50 text-blue-600` chip
- 失败卡：`bg-red-50/70 ring-1 ring-red-200/60`
- sticky chip：`fixed top-20 right-6 bg-white/90 backdrop-blur-md ring-1 ring-gray-200/60 shadow-md`

按钮一律 `border-0`（CLAUDE.md 强制：所有可点击元素不带边框）。

## 8. 主动不做（YAGNI）

- **token 级流式**：mission 执行在 Inngest 跑、step 不原生支持流；接 Redis pub/sub 的工程量与"每步等几秒一次性出"的体验差距不成比例。outputSummary 一次性配打字机渲染就够。
- **mission_messages 渲染**：把员工间 P2P 消息当真团队对话铺出来很有味道，但要先调研执行引擎对该表的覆盖率，留作 follow-up。
- **顶部紧凑总览卡**：跟左侧任务列表/`/missions/[id]` 详情页信息重叠。sticky chip 已经是浮动总览。
- **/missions/[id] 详情页同款改造**：详情页是看板视图，定位本来就跟对话化分开。
- **每步独立的 MessageActionBar**：动作按钮只挂在收尾气泡，避免气泡列表全是按钮。
- **自由对话路径改造**：本设计只解决场景启动路径，自由对话路径已有的 `IntentAnalyzing → IntentResultBubble → currentThinking + currentSkillsUsed` 体验不动。

## 9. 边界与取舍

### 9.1 `mission_tasks.assigned_employee_id` 可能为 null

leader-plan 把任务派下去之前的窗口期，`task.status=pending` 且 `assignedEmployeeId=null`。此时步骤气泡的头像 fallback 到 mission owner（顶上选定员工）；当 SSE 推送来 `assignedEmployeeId` 后再切换。

### 9.2 `skillName` 反查可能失败

`mission_tasks` 没有 skillSlug 列。本设计通过 `mission-init` 事件一次性带下来 template 的 `steps[i].config.skillName`，按 `phase` 对位。

边界：

- mission 跑到一半 template 被改 → 用 mission 创建时的 snapshot（`workflow_templates` 里的 `steps` 是创建那一刻读取的，但 mission 不再持有 snapshot）。本设计接受"读取最新 template"的轻微不准确，因为 skillName 一般不会变；如果未来要严格快照，需要加一个 `mission_template_snapshot` 字段，留作 follow-up。
- 老的 mission（dependencies 用 task ID 而非 phase 排序）→ 按 `phase` 排不了的退到按 `createdAt` 排。

### 9.3 SSE 轮询频率

现在是 2 秒一次。`outputSummary` 不一定能在 task 完成的 2 秒窗口内推到前端（可能滞后 2-4 秒）。可接受，因为 LLM 本身耗时 5-30 秒，2 秒延迟相对感知不强。如果将来要更紧，改用 LISTEN/NOTIFY，留作 follow-up。

### 9.4 长 outputSummary

如果 outputSummary 超过 ~500 字符，气泡会很长。本设计**不做折叠**：因为 `outputSummary` 本来就是 LLM 生成的人话短摘要（mission executor 端约束在 200-300 字），如果 fence 失效产出了超长文本，那是 executor 侧的问题，不在本设计范围内修复。

## 10. 实施切片

为了 main 单分支安全，建议 plan 阶段切成 3 个独立可发的 commit：

1. **后端 SSE 扩展**（独立可发）：进度路由加 init 事件 + task-update 新字段；parse-mission-event 加字段；useMissionProgress 类型扩展；老的 `MissionCardMessage` 仍能继续工作（多余字段不读即可）。
2. **新组件 + 删旧组件**（一次性切换）：写 `mission-stream.tsx` + `mission-step-bubble.tsx`，`chat-panel.tsx` 切到新组件，删 `mission-card-message.tsx`。
3. **打磨**（可选）：失败时的 skip 按钮接入（如果 `skipMissionTask` action 存在）；sticky chip 滚动锚跳；打字机交互节奏微调。

## 11. 不动清单（再次声明）

- mission-executor.ts、leader-plan、check-task-dependencies 等执行引擎
- `/missions/[id]` 详情页及其子组件
- `mission_tasks` / `missions` schema
- 自由对话路径（intent-recognition、IntentAnalyzing、IntentResultBubble）
- `WorkflowLaunchDialog` 表单（参数填写体验不变）

---

**附**：高保真预览截图位置 `.superpowers/brainstorm/88592-1777529341/chat-mission-stream.html`。

---

## 12. 验收清单

- [ ] 启动任意场景后，对话流出现"计划总览气泡"，按场景名 + 步骤数 + 员工列表正确陈述执行计划
- [ ] 每步气泡的头像/名字按 `task.assignedEmployeeId` 显示（不是顶上选定员工）；assignedEmployeeId 为 null 时 fallback 到 owner
- [ ] running 状态显示骨架；completed 状态显示 outputSummary（首次播放打字机）；failed 状态显示红卡 + 重试按钮
- [ ] 技能徽章按 `mission-init.steps[].skillName` 对位显示
- [ ] sticky chip 跟随滚动浮在右上；显示 `N/M 步 · 状态`；点击锚跳到当前 running 步骤
- [ ] mission 全部完成后，对话流末尾出现收尾气泡 + MessageActionBar
- [ ] 失败步骤的"重试本步"调用 `retryMissionTask`，触发后该步骤气泡回到 running 状态
- [ ] mission 取消后，running 步骤变 ⏹️，pending 步骤折叠
- [ ] 静态 MissionCard 完全消失；`mission-card-message.tsx` 文件删除
- [ ] tsc --noEmit 与 next build 通过
