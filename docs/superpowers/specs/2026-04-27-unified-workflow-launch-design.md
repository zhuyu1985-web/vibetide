# 统一工作流启动设计 — Spec

**日期：** 2026-04-27
**作者：** zhuyu + Claude
**状态：** Draft（等待 review）
**涉及模块：** workflow_templates / employee / home / chat / missions

---

## 1. 背景与问题

### 1.1 触发场景
用户在 `/employee/xiaolei` 页选择"日常工作流"卡片，**直接启动了 mission**——没有参数输入、没有确认弹框。同一个工作流在 `/home`（场景网格）需要填表单，在 `/chat`（聊天中心）也要填表单，**三处行为完全不一致**。

### 1.2 根因分析（B.1 之后的遗留问题）

数据源已统一（B.1 完成）：三处入口都读 `workflow_templates`。但**启动行为各搞各的**：

| 入口 | 是否弹参数表单 | 启动后去向 | 决策依据 |
|---|---|---|---|
| `/employee/[id]` 日常工作流 | ❌ 无脑直启 | `/missions/[id]` | 硬编码忽略 `inputFields` 与 `launchMode` |
| `/home` 场景网格 | 看 `template.launchMode` | `/missions/[id]` | `launchMode === 'direct'` 跳过表单 |
| `/chat` 选场景 | 看 `inputFields.length` | 留对话流（不建 mission） | `inputFields.length === 0` 直接执行 |

**衍生痛点：**
- 同一个模板，三处行为不同 → 用户心智混乱
- chat 入口"不建 mission"意味着同一模板在不同入口产出在不同地方（任务中心 vs 对话历史）
- "数字员工预设场景在哪里改"成了黑盒——配置入口在 `/workflows/[id]`，但 employee/home/chat 卡片上没有任何指向链接

### 1.3 设计目标

1. **三入口启动行为完全一致**：是否弹表单、何时建 mission，由模板自身决定，与入口无关
2. **chat 入口的"在对话内执行"**：本质是把 mission 进度投影到对话流，**真实建 mission**（不再有"绕过 mission 的轻量执行"路径）
3. **配置入口可见化**：每个工作流卡片能直接跳到编辑页

---

## 2. 设计原则

1. **workflow_templates 是单一真相源**——B.1 已完成，本次进一步消除 `launchMode` 字段冗余
2. **Mission 是唯一执行容器**——任何 workflow_template 启动 = 必建 mission；普通对话（不选模板）走现有 chat stream，不建 mission
3. **Chat 是 Mission 的视图之一**——chat 入口启动模板时，对话流里的"任务卡片消息"是 mission 的实时投影，**不双写**步骤数据到 chat 表
4. **统一启动组件**——三入口共用 `WorkflowLaunchDialog`，`ScenarioFormSheet` 退役

---

## 3. 数据模型变更

### 3.1 `workflow_templates` schema 变更

```sql
ALTER TABLE workflow_templates DROP COLUMN launch_mode;
```

**为什么删 `launchMode`：**
- "是否弹表单"完全由 `inputFields.length` 决定，无需冗余字段
- 没有"无脑直启"这种合法行为——哪怕 `inputFields=[]`，也要一次"启动"确认

**不新增 `executionMode` 字段：**
- 所有 workflow_template 启动 = 必建 mission（规则一致）
- "在对话里看进度" vs "去 mission console 看进度" 由**入口**决定，不是模板属性

**保留字段不变：**
- `inputFields: InputFieldDef[]` — 唯一决定"是否显示表单"
- `promptTemplate` / `defaultTeam` / `ownerEmployeeId` / `category` 等

### 3.2 对话消息扩展（重要：不存在独立 `chat_messages` 表）

**现状调研：** vibetide 没有独立的 `chat_messages` 表。会话和消息都存在 `saved_conversations.messages` 这个 jsonb 数组里（见 `src/db/schema/saved-conversations.ts`）。每条消息现有形态：

```ts
{
  role: "user" | "assistant",
  content: string,
  durationMs?: number,
  thinkingSteps?: { tool: string; label: string; skillName?: string }[],
  skillsUsed?: { tool: string; skillName: string }[],
  sources?: string[],
  referenceCount?: number,
}
```

**变更方案（仅扩展 TypeScript 类型，无 schema 迁移）：**

```ts
// 在 saved_conversations.messages 的元素类型上扩展两个可选字段
{
  role: "user" | "assistant" | "system",      // 新增 'system' 用于任务卡片
  content: string,
  // 新增 — 当且仅当 kind === 'mission_card' 时填
  kind?: "text" | "mission_card",             // 缺省视为 "text"
  missionId?: string,                         // 卡片绑定的 mission
  templateId?: string,                        // 冗余存便于卡片显示模板名
  templateName?: string,                      // 同上
  // ...其它现有可选字段保持不变
}
```

`kind` 缺省 / 等于 `"text"` → 走现有 `MessageBubble` 渲染逻辑；`kind === "mission_card"` → 走新组件 `<MissionCardMessage>`。

**对未保存的临时会话（in-memory）：** 同样的消息类型扩展，无需变更存储。

### 3.3 代码层删除清单（已核实）

- [x] ~~`EMPLOYEE_SCENARIOS` 常量~~ — **已不在 src 内**（grep 验证），无需删除，文档/spec 中可能还有残留
- [ ] `ScenarioFormSheet` 组件（`src/app/(dashboard)/chat/scenario-form-sheet.tsx`）— 已是 orphan dead code（grep 确认无 importer），直接 `rm`
- [ ] `chat-panel.tsx` 内联 scenario 表单（`inlineScenario` 渲染块，`src/app/(dashboard)/chat/chat-panel.tsx:974-1075`）— **这才是 chat 真实在用的表单**，Phase 1 用 `WorkflowLaunchDialog` 替换它
- [ ] `workflow_templates.launchMode` 字段（`src/db/schema/workflows.ts:88`）及所有引用
- [ ] DAL `WorkflowTemplateRow` 类型中的 `launchMode`（自 InferSelectModel 推导，删 schema 字段后自动消失）
- [ ] `seed-builtin-workflows.ts` 中所有 `launchMode: 'form'/'direct'`
- [ ] `scenario-grid.tsx` 中 `tpl.launchMode === 'direct'` 的分支

---

## 4. 统一启动组件 `WorkflowLaunchDialog`

### 4.1 当前签名（`src/components/workflows/workflow-launch-dialog.tsx:293`）

```ts
interface WorkflowLaunchDialogProps {
  template: WorkflowTemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

提交逻辑当前**硬编码** `router.push('/missions/' + missionId)`（line 353），这是 chat 入口必须改的痛点——chat 不能跳转，要插消息。

### 4.2 重构后签名

```ts
interface WorkflowLaunchDialogProps {
  template: WorkflowTemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 启动成功回调。如果未传，沿用旧行为（router.push 到 mission console）。
   * Chat 入口必须传这个：拿到 missionId 后向对话流插入 mission_card 消息。
   */
  onLaunched?: (result: { missionId: string; template: WorkflowTemplateRow }) => void;
}
```

**为什么用 optional `onLaunched` 而不是 `entry: 'home'|'employee'|'chat'` 枚举：**
- 不耦合 dialog 与具体页面，外部完全控制成功后行为
- 默认行为（`router.push`）保持向后兼容，home/employee 不传该 prop 即可
- chat 传回调，自己决定怎么把 missionId 接入对话流

### 4.3 内部行为

**渲染：**
- `template.inputFields.length > 0` → 渲染表单（保持现状）
- `template.inputFields.length === 0` → 极简模式：仅显示标题 + 描述 + 大"启动"按钮（**新增分支**）

**提交：**
1. 校验 `inputFields` 必填
2. 调 `startMissionFromTemplate(template.id, formValues)`（已有 action）
3. 拿到 `missionId`：
   - 如果传了 `onLaunched` → 调用回调，dialog 关闭
   - 如果没传 → 默认 `router.push('/missions/' + missionId)`，dialog 关闭

**错误处理：**
- 启动失败显示在 dialog 内部错误条（保持现状）
- mission 创建后的运行失败属于 mission 系统的事，dialog 不负责

### 4.4 三入口替换路径

| 入口 | 当前组件 | 改为 |
|---|---|---|
| `/employee/[id]` `EmployeeWorkflowsSection` | 直接调 `startMission()` | 弹 `WorkflowLaunchDialog`，**不传** `onLaunched`（默认 push 到 mission console） |
| `/home` `ScenarioGrid.handleCardClick` | `launchMode==='direct'` 直启 / 否则弹 `WorkflowLaunchDialog` | **统一**弹 `WorkflowLaunchDialog`，**不传** `onLaunched`（删除 launchMode 分支） |
| `/chat` 内联 scenario 表单（`chat-panel.tsx:974-1075`） | 内联 form + `onScenarioFormSubmit` | 弹 `WorkflowLaunchDialog`，**传** `onLaunched`：拿 missionId 在对话流插入 mission_card 消息 |

---

## 5. Chat-Mission 投影机制（核心新增）

### 5.1 用户视角流程

1. 用户在 chat 选场景 → 弹 `WorkflowLaunchDialog` 填参数（如有）
2. 提交 → 后台真实建 mission；对话流**立即**插入一条 `mission_card` 消息（状态：`pending`）
3. 卡片订阅 mission 进度，每完成一步追加子条目（"📋 选题策划 已完成"、"✍️ 内容创作 进行中…"）
4. mission 终态 → 卡片定格显示"✅ 完成 / ❌ 失败"，附"查看完整任务"链接 → `/missions/[id]`
5. 用户可继续在 chat 发新消息，不阻塞

### 5.2 持久化策略

**chat_messages 表存什么：**
- 一条 `mission_card` 消息：`{ kind, missionId, templateId, templateName }`
- **不存**步骤进度、不存 mission 状态

**为什么不双写：**
- mission 表本身就有完整状态（`status` / `steps` / `artifacts`）
- 双写会带来一致性风险（mission 改了状态但 chat 表没刷新）
- 单一真相源原则

**步骤进度从哪来：**
- 卡片组件挂载时订阅 mission 实时通道
- 同时拉一次 mission 当前状态做初始渲染（处理"reload chat 时 mission 已完成"场景）

### 5.3 实时通道（已确认存在）

**复用现有 SSE：** `src/app/api/missions/[id]/progress/route.ts` 已经是 SSE 端点（每 2s 轮询 mission/tasks 状态字段，发增量；终态自关闭）。

**Phase 2 直接复用，不新建。** mission console 也用同一端点（如不一致，Phase 2 顺手对齐）。

**重入支持：**
- reload chat → mission_card 消息照常渲染 → `MissionCardMessage` 挂载时按 missionId 订阅 `/api/missions/[id]/progress` + 同时拉一次 `/api/missions/[id]` 取当前状态做初始渲染
- 已完成的 mission：SSE 端点自关闭后停止订阅，仅展示终态
- 进行中的 mission：继续订阅看实时进度
- mission **已被删除**的 fallback：拉初始状态返回 404 时显示"任务已被删除"灰态卡片，不订阅 SSE

### 5.4 卡片组件 `MissionCardMessage`

```ts
<MissionCardMessage
  missionId={string}
  templateName={string}    // 来自 chat_message metadata，避免初次渲染等查询
/>
```

UI 结构：
- 顶部：模板名 + 状态徽章（pending / running / completed / failed）
- 中部：步骤时间线（每步显示 employee + 状态 + 简短产出预览）
- 底部："查看完整任务" → `/missions/[id]`；如果有最终产出物，显示"打开产出物" → 对应详情页

---

## 6. 配置入口可见化

### 6.1 卡片"⋯"菜单

**位置：** Employee 页 / Home 页 / Chat 场景列表的每个工作流卡片右上角
**可见性：** 仅 `admin` / `owner` / 超级管理员

**菜单项（Phase 3 范围）：**
- **编辑工作流** → `/workflows/[id]`（已有页面）
- **复制为我的工作流** → `/scenarios/customize?from=[id]`（已有页面）
- **置顶 / 取消置顶** — home 页已有，归并到此菜单复用现有 `pin_homepage_template` action

**"隐藏"功能不在 Phase 3 范围（开放问题）：**
- 现状：没有 `homepage_template_visibility` 这类表；现有 `workflow_template_tab_order` 只管 pin + sort
- 实施"隐藏"需要先建表或加字段，属于独立设计点
- Phase 3 只做 编辑 / 复制 / 置顶 三项，"隐藏"留作 follow-up spec

### 6.2 唯一编辑入口

- `/workflows/[id]` 是工作流的**唯一编辑页**
- Employee / Home / Chat 入口都不内嵌编辑 UI
- 这条规则需在 PR 描述里强调，避免后续添加内嵌编辑而再次打破单一真相源

---

## 7. Phase 划分

### Phase 1 — 统一启动（本 spec 核心）

**因为 Phase 1 后 chat 入口"暂时跳到 /missions/[id]"会显著降级 chat 体验（用户被踢出对话流），所以 Phase 1 + Phase 2 必须在同一个 PR / 同一天内完成上线，不允许 Phase 1 单独发布留过夜。** Phase 3 可以延后。

- Schema 迁移：`ALTER TABLE workflow_templates DROP COLUMN launch_mode;`（破坏性变更，单 PR 内同时改 schema + seed + 所有消费者）
- Seed 同步：删 `seed-builtin-workflows.ts` 中所有 `launchMode` 字段（保留 `launchMode: 'form'` 作 default 的不再需要）
- `WorkflowLaunchDialog` 升级（新增 `onLaunched` 可选回调、空 `inputFields` 极简模式）
- 三入口替换：
  - `/employee/[id]` `EmployeeWorkflowsSection` → 弹 `WorkflowLaunchDialog`，不传 `onLaunched`（默认 push）
  - `/home` `ScenarioGrid.handleCardClick` → 弹 `WorkflowLaunchDialog`，删 `launchMode==='direct'` 分支
  - `/chat` 把 `chat-panel.tsx:974-1075` 内联表单换成 `WorkflowLaunchDialog`，**Phase 1 暂传 `onLaunched: ({missionId}) => router.push('/missions/' + missionId)`**（与 Phase 2 同 PR 上线后立即换成插消息）
- 删 `ScenarioFormSheet` 组件文件（orphan）
- DAL `WorkflowTemplateRow` 类型自动同步（InferSelectModel）
- 现有运行中 mission 行的 `launch_mode` 列被 DROP 后不影响 mission 自身字段，但要确认 DAL 查询没有 select launchMode

**验收：**
- 三入口选同一模板，行为一致（同样弹表单或同样不弹）
- 所有启动都建 mission；home/employee 入口跳 `/missions/[id]`；chat 入口跳 `/missions/[id]`（Phase 2 改为插消息）
- `npx tsc --noEmit` 零错误，`npm run build` 通过

### Phase 2 — Chat-Mission 投影
- chat_messages metadata 支持 `kind: 'mission_card'`
- `MissionCardMessage` 组件实现（含 SSE 订阅 + 初始状态拉取 + 重入支持）
- chat 入口启动 `WorkflowLaunchDialog` 后不跳转，改为插入 mission_card 消息
- mission console 的 SSE 端点确认存在；不存在则新建（或抽出共用）

**验收：**
- chat 选场景 → 对话流出现任务卡片，实时显示步骤进度
- 刷新页面 → 卡片自动 rehydrate，运行中的继续看进度
- 任务终态 → 卡片显示结果 + "查看完整任务"链接
- mission console 仍正常工作

### Phase 3 — 配置入口可见化
- 卡片"⋯"菜单组件实现
- 三入口卡片接入菜单（仅 admin/owner 可见）
- 接入既有的 编辑 / 复制 / 置顶 三个 actions（"隐藏"留作独立 follow-up，见 §6.1）

**验收：**
- admin 在 employee/home/chat 卡片上能直接跳到编辑页
- 普通用户看不到菜单，行为与现状一致

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Phase 1 删 `launchMode` 是 breaking schema 变更 | 单分支单人开发（CLAUDE.md 约定），同 PR 改 schema + seed + 所有消费者；Phase 1 与 Phase 2 必须同 PR 上线避免 chat 体验过夜降级 |
| `DROP COLUMN launch_mode` 时是否阻塞 in-flight 写入 | mission 创建路径 `startMissionFromTemplate` 不读 launchMode（只读 inputFields/promptTemplate），DROP 不影响进行中的 mission 执行；schema push 需在低峰期跑 |
| Phase 2 SSE 端点不存在 | **已确认存在** `src/app/api/missions/[id]/progress/route.ts`，直接复用 |
| chat 投影后 mission console 是否冗余 | 不冗余——mission console 是"任务管理/历史"视图（批量、过滤、删除），chat 卡片是"实时观察"视图，两者并存 |
| chat 历史里 mission 已被删除，mission_card 怎么显示 | `MissionCardMessage` 拉初始状态返回 404 时显示"任务已被删除"灰态卡片，不订阅 SSE，仍保留 templateName 让用户知道当时启动的是什么 |
| 用户已有的 in-flight mission 在 Phase 2 上线后能否被 chat 重新接管 | 不能也不需要——Phase 2 上线后**新启动**的 chat mission 才插卡片消息；已有的仍走 mission console |
| Employee 页用户习惯"一点就启动"的快捷感 | 空 `inputFields` 极简模式：dialog 只有标题+描述+大"启动"按钮，单击成本可控；不会显著降低使用频率 |
| chat 内一次启动多个 mission 会刷屏 | 卡片可折叠（默认展开当前最新一个，历史卡片折叠）；不在 Phase 2 强制做，看用户反馈 |
| 回滚方案 | Phase 1 落库后无法直接 ALTER ADD COLUMN 回滚（数据已丢）；备份 = git revert + 重新 push schema（恢复字段为 default 'form'），可接受。chat 入口可以临时切回 inline form（git revert 单文件）|

---

## 9. 不在本次范围

- mission 引擎本身的优化（步骤并行、重试、超时）
- chat 入口"轻量纯对话模板"（即 `executionMode='chat'` 概念，已被本设计明确拒绝）
- workflow_templates 的版本化 / 历史回滚
- `/workflows` 模块本身的 UX 重构

---

## 10. 开放问题（不阻塞 spec，实施时再定）

1. **`mission_card` 消息的 `templateName` 是否冗余存**：存了避免初次渲染等查询，但模板改名后旧消息会显示旧名——可接受
2. **"隐藏"功能（Phase 3 follow-up）**：需要新表或新字段（现有 `workflow_template_tab_order` 不含 hidden 字段）。语义 hide-from-this-tab vs disable-globally？倾向 hide-from-this-tab。本 spec 不覆盖，独立 follow-up
3. **未保存对话（in-memory）的 mission_card**：用户启动 mission 后没保存会话直接关页，下次进入还能看到这个 mission 吗？倾向"不能"——临时会话不持久 mission_card；用户要持久化必须保存会话。Phase 2 实施时确认
