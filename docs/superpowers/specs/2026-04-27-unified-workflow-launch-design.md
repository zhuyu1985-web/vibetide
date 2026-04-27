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

### 3.2 `chat_messages` 扩展

新增"任务卡片"消息类型：

**方案：在 `metadata` jsonb 中存 kind**（无需 schema 变更）
```ts
{
  // existing fields...
  metadata: {
    kind: 'mission_card',
    missionId: 'uuid',
    templateId: 'uuid',     // 冗余，便于不查 mission 表就能展示模板名
    templateName: string,
  }
}
```

普通对话消息 `metadata.kind` 缺省 → 走现有渲染逻辑。

### 3.3 代码层删除清单

- [ ] `EMPLOYEE_SCENARIOS` 常量（`src/lib/constants.ts`，B.1 之后已无消费者）
- [ ] `ScenarioFormSheet` 组件（`src/app/(dashboard)/chat/scenario-form-sheet.tsx`）
- [ ] `workflow_templates.launchMode` 字段及所有引用
- [ ] DAL `WorkflowTemplateRow` 类型中的 `launchMode`
- [ ] `seed-builtin-workflows.ts` 中所有 `launchMode: 'form'/'direct'`

---

## 4. 统一启动组件 `WorkflowLaunchDialog`

### 4.1 签名

```ts
<WorkflowLaunchDialog
  template={tpl}                  // workflow_templates 一行
  open={open}
  onOpenChange={setOpen}
  entry={'home' | 'employee' | 'chat'}   // 入口 hint，决定启动后跳转/回调
  onLaunched?={(result: { missionId: string }) => void}  // chat 入口用
/>
```

### 4.2 内部行为

**渲染：**
- `template.inputFields.length > 0` → 渲染表单
- `template.inputFields.length === 0` → 极简模式：仅显示标题 + 描述 + 大"启动"按钮

**提交：**
1. 校验 `inputFields` 必填
2. 调 `startMissionFromTemplate(template.id, formValues)`
3. 拿到 `missionId`，根据 `entry`：
   - `home` / `employee` → `router.push('/missions/' + missionId)`
   - `chat` → 调 `onLaunched({ missionId })` 回调（chat 用它在对话流插入 mission_card 消息）
4. 关闭 dialog

**错误处理：**
- 启动失败显示在 dialog 内部错误条
- mission 创建后失败属于 mission 系统的事，dialog 不再负责

### 4.3 三入口替换路径

| 入口 | 当前组件 | 改为 |
|---|---|---|
| `/employee/[id]` `EmployeeWorkflowsSection` | 直接调 `startMission()` | 弹 `WorkflowLaunchDialog`，`entry='employee'` |
| `/home` `ScenarioGrid.handleCardClick` | `launchMode==='direct'` 直启 / 否则弹 `WorkflowLaunchDialog` | **统一**弹 `WorkflowLaunchDialog`，`entry='home'`（删除 launchMode 分支） |
| `/chat` `ChatCenterClient.handleSelectScenario` | 弹 `ScenarioFormSheet` 或直接发消息 | 弹 `WorkflowLaunchDialog`，`entry='chat'`，`onLaunched` 回调插入 mission_card 消息 |

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

### 5.3 实时通道选型

**Phase 2 实施时再选：** 候选方案——
- 复用现有 mission console 的 SSE 端点（如 `/api/missions/[id]/stream`）— 优先
- 如果不存在，新建一个 SSE 端点，同时 mission console 也迁过来用
- Supabase Realtime / Inngest Realtime 留作后期扩展（不在 Phase 2 范围）

**重入支持：**
- reload chat → mission_card 消息照常渲染 → 组件挂载时按 missionId 重新订阅 + 拉初始状态
- 已完成的 mission：拉到终态后停止订阅，仅展示结果
- 进行中的 mission：继续订阅，看实时进度

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

**菜单项：**
- **编辑工作流** → `/workflows/[id]`
- **复制为我的工作流** → `/scenarios/customize?from=[id]`
- **置顶 / 取消置顶**（home 页已有，归并到此菜单）
- **隐藏**（不在此入口展示，受 `homepage_template_visibility` 等表控制）

### 6.2 唯一编辑入口

- `/workflows/[id]` 是工作流的**唯一编辑页**
- Employee / Home / Chat 入口都不内嵌编辑 UI
- 这条规则需在 PR 描述里强调，避免后续添加内嵌编辑而再次打破单一真相源

---

## 7. Phase 划分

### Phase 1 — 统一启动（本 spec 核心）
- Schema 迁移：删 `launchMode` 字段
- Seed 同步：删 `seed-builtin-workflows.ts` 中所有 `launchMode`
- `WorkflowLaunchDialog` 升级（签名扩展、空 `inputFields` 极简模式）
- 三入口替换：employee / home / chat 都改为弹 `WorkflowLaunchDialog`
- 删 `ScenarioFormSheet` 组件
- 删 `EMPLOYEE_SCENARIOS` 常量
- DAL/types 同步去 `launchMode`

**验收：**
- 三入口选同一模板，行为一致（同样弹表单或同样不弹）
- 所有启动都建 mission，跳 `/missions/[id]`（chat 入口暂时也跳，Phase 2 改）
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
- 接入既有的 编辑 / 复制 / 置顶 / 隐藏 actions

**验收：**
- admin 在 employee/home/chat 卡片上能直接跳到编辑页
- 普通用户看不到菜单，行为与现状一致

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Phase 1 删 `launchMode` 是 breaking schema 变更 | 单分支单人开发（CLAUDE.md 约定），同 PR 改 schema + seed + 所有消费者 |
| Phase 2 SSE 端点不存在 | Phase 2 第一步先确认/新建 SSE 端点，再做卡片组件 |
| chat 投影后 mission console 是否冗余 | 不冗余——mission console 是"任务管理/历史"视图（批量、过滤、删除），chat 卡片是"实时观察"视图，两者并存 |
| 用户已有的 in-flight mission 在 Phase 2 上线后能否被 chat 重新接管 | 不能也不需要——Phase 2 上线后**新启动**的 chat mission 才插卡片消息；已有的仍走 mission console |
| Employee 页用户习惯"一点就启动"的快捷感 | 空 `inputFields` 极简模式：dialog 只有标题+描述+大"启动"按钮，单击成本可控；不会显著降低使用频率 |
| chat 内一次启动多个 mission 会刷屏 | 卡片可折叠（默认展开当前最新一个，历史卡片折叠）；不在 Phase 2 强制做，看用户反馈 |

---

## 9. 不在本次范围

- mission 引擎本身的优化（步骤并行、重试、超时）
- chat 入口"轻量纯对话模板"（即 `executionMode='chat'` 概念，已被本设计明确拒绝）
- workflow_templates 的版本化 / 历史回滚
- `/workflows` 模块本身的 UX 重构

---

## 10. 开放问题（不阻塞 spec，实施时再定）

1. **Phase 2 SSE 端点的选型**：复用 mission console 现有的还是新建？需要在 Phase 2 开工前先做 5 分钟的代码调研确认
2. **`mission_card` 消息的 `templateName` 是否冗余存**：存了避免初次渲染等查询，但模板改名后旧消息会显示旧名——可接受
3. **卡片"⋯"菜单的"隐藏"操作语义**：是 hide-from-this-tab 还是 disable-globally？倾向 hide-from-this-tab（receiver 是 `homepage_template_visibility` 这类已有表）
