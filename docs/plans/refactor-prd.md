# VibeTide 核心模块重构 PRD

> **版本：** v1.0 | **日期：** 2026-03-22
> **产品负责人：** VibeTide PM
> **技术参考文档：** `vibetide-unified-technical-spec.md` · `core-modules-function-list.md` · `refactor-implementation-plan.md`
> **范围：** 任务中心（Missions）· AI员工市场（Employee Marketplace）· 技能管理（Skills Management）

---

## 一、重构背景与目标

### 1.1 当前状态

VibeTide 核心三大模块共计 **97 个功能点**，当前完成率 **87.6%**：

| 模块 | 已实现 | 部分实现 | 未实现 | 总计 | 完成率 |
|------|--------|----------|--------|------|--------|
| 任务中心 | 29 | 1 | 3 | 33 | 87.9% |
| AI员工市场 | 35 | 1 | 2 | 38 | 92.1% |
| 技能管理 | 21 | 0 | 5 | 26 | 80.8% |
| **合计** | **85** | **2** | **10** | **97** | **87.6%** |

### 1.2 存在的风险

经技术分析，现有代码存在以下关键风险：

| 风险等级 | 风险项 | 影响 |
|----------|--------|------|
| **P0 高危** | 进程保活缺失 — `executeMissionDirect()` 通过 `.then()` 异步执行，Next.js 可能提前终止响应 | 任务执行中断、数据不一致 |
| **P0 高危** | Leader JSON 解析脆弱 — 正则提取 JSON，解析失败 fallback 为单任务 | 任务拆解质量不可控 |
| **P0 高危** | DAG 循环依赖未校验 — 依赖关系无图论验证 | 死循环、任务永久挂起 |
| **P0 高危** | 跨组织校验缺失 — 多个 Server Action 未校验资源归属 | 数据安全漏洞 |
| **P1 中危** | Token 预算仅记录不检查 — 超预算仍执行 | 成本失控 |
| **P1 中危** | 代码重复 — Inngest 函数和直连执行器约 150 行重复 | 维护成本高、一处改两处漏 |
| **P1 中危** | 技能重复绑定 — 无唯一约束 | 数据一致性问题 |
| **P2 低危** | 插件 authKey 明文存储 | 安全隐患 |

### 1.3 重构目标

1. **对齐技术方案**：数据库 Schema 完全匹配统一技术方案设计，支持五阶段生命周期、产出物管理、结构化消息通道
2. **修复已知风险**：消除全部 P0/P1 级风险，确保系统安全和稳定运行
3. **补齐缺失功能**：将 12 个未实现/部分实现功能点补齐，完成率提升至 **100%**
4. **安全加固**：全面实施组织隔离校验、插件安全策略、数据库约束

### 1.4 重构策略

分 4 个 Phase 递进实施，每个 Phase 有明确的前置依赖和验收标准：

```
Phase 1 (数据层对齐) → Phase 2 (核心引擎重构) → Phase 3 (缺失功能补齐) → Phase 4 (安全加固)
      2-3 天                  3-4 天                   4-5 天                  2-3 天
```

总预估工期：**11-15 个工作日**

---

## 二、Phase 1：数据层对齐需求

### 2.1 需求概述

让数据库 Schema 完全匹配统一技术方案中的表设计，同时保持向后兼容（所有变更为增量式，不影响现有数据）。

### 2.2 枚举值扩展

#### 2.2.1 missionStatusEnum 新增值

| 新增枚举值 | 业务含义 | 使用场景 |
|-----------|---------|---------|
| `queued` | 排队等待 | Mission 创建后尚未开始规划时的初始状态 |
| `coordinating` | Phase 4 协调收口 | 子任务失败需要 Leader 介入协调时 |

**对现有数据的影响：** 无。pgEnum 的 `ALTER TYPE ... ADD VALUE` 为非破坏性操作，现有记录保持原枚举值不变。

#### 2.2.2 missionTaskStatusEnum 新增值

| 新增枚举值 | 业务含义 | 使用场景 |
|-----------|---------|---------|
| `in_review` | Leader 审核中 | 子任务完成后可选的 Leader 审核阶段 |
| `cancelled` | 已取消 | Mission 取消时级联取消所有子任务 |
| `blocked` | 已阻塞 | 上游任务失败且不可恢复时，下游任务被标记为阻塞 |

**对现有数据的影响：** 无。仅追加新枚举值，不修改现有逻辑。

#### 2.2.3 missionMessageTypeEnum 新增值

| 新增枚举值 | 分类 | 业务含义 |
|-----------|------|---------|
| `chat` | 对话类 | 普通对话消息 |
| `data_handoff` | 协作类 | 结构化数据交接（含 structured_data 字段） |
| `progress_update` | 汇报类 | 进度更新通知 |
| `task_completed` | 汇报类 | 子任务完成通知 |
| `task_failed` | 汇报类 | 子任务失败通知 |
| `help_request` | 汇报类 | Worker 请求 Leader 协助 |

**对现有数据的影响：** 无。现有 `question`、`answer`、`status_update`、`result`、`coordination` 保持不变。

#### 2.2.4 新增 missionPhaseEnum

| 枚举值 | 对应阶段 | 业务含义 |
|--------|---------|---------|
| `assembling` | Phase 1 | 组建团队 |
| `decomposing` | Phase 2 | Leader 拆解任务 |
| `executing` | Phase 3 | Worker 并行执行 |
| `coordinating` | Phase 4 | 协调收口 |
| `delivering` | Phase 5 | 汇总交付 |

**业务价值：** 让前端 PhaseBar 能够精确展示当前生命周期阶段，用户可直观了解任务进展所在环节。

### 2.3 missions 表新增字段

| 字段名 | 类型 | 默认值 | 是否必填 | 业务含义 |
|--------|------|--------|---------|---------|
| `description` | text | NULL | 否 | 用户需求的详细描述（可选，对标 user_instruction 的补充） |
| `phase` | mission_phase | NULL | 否 | 当前生命周期阶段（assembling/decomposing/executing/coordinating/delivering） |
| `progress` | integer | 0 | 是 | 综合进度 0-100，基于子任务加权进度计算 |
| `config` | jsonb | `{max_retries:3, task_timeout:300, max_agents:8}` | 是 | 运行配置，控制重试次数、单任务超时、最大参与 Agent 数 |
| `started_at` | timestamptz | NULL | 否 | 执行实际开始时间（区别于 created_at 的创建时间） |

**对现有数据的影响：** 全部为 nullable 或有 default 值，现有记录自动获得默认值，无需数据迁移。

**业务价值：**
- `phase` + `progress` 使前端能展示精确的五阶段进度条和百分比进度
- `config` 实现任务级别的可配置化，不同场景可定制不同超时和重试策略
- `started_at` 支持精确的执行耗时统计

### 2.4 mission_tasks 表新增字段

| 字段名 | 类型 | 默认值 | 是否必填 | 业务含义 |
|--------|------|--------|---------|---------|
| `acceptance_criteria` | text | NULL | 否 | 验收标准，Leader 拆解时生成，用于 Leader 审核子任务输出质量 |
| `assigned_role` | text | NULL | 否 | 期望角色类型（employee slug），记录 Leader 分配意图 |
| `output_summary` | text | NULL | 否 | 完成摘要，Worker 执行完成后生成的可读摘要（区别于 output_data 的完整 JSON） |
| `error_recoverable` | integer | 1 | 是 | 错误是否可恢复：1=可重试，0=不可恢复（影响 Phase 4 协调策略） |
| `phase` | integer | NULL | 否 | 所属 DAG 阶段号，用于分层展示和关键路径计算 |
| `progress` | integer | 0 | 是 | 单个子任务的执行进度 0-100 |
| `created_at` | timestamptz | now() | 是 | 创建时间（当前表缺少此字段） |

**对现有数据的影响：** 全部为 nullable 或有 default 值，无需迁移。

**设计说明：** `priority` 字段当前为 `integer` 类型，目标方案要求为 `text`（P0/P1/P2/P3）。为避免数据迁移风险，**保持 integer 不变**，在应用层做映射（0→P3, 1→P2, 2→P1, 3→P0）。

### 2.5 mission_messages 表新增字段

| 字段名 | 类型 | 默认值 | 是否必填 | 业务含义 |
|--------|------|--------|---------|---------|
| `channel` | text | `"direct"` | 是 | 消息通道：direct（点对点）/broadcast（广播）/system（系统日志） |
| `structured_data` | jsonb | NULL | 否 | 结构化数据附件，用于 data_handoff 类型消息携带表格、大纲、审核意见等 |
| `priority` | text | `"normal"` | 是 | 消息优先级：normal/urgent。urgent 消息冒泡到用户界面通知 |
| `reply_to` | uuid | NULL | 否 | 回复目标消息 ID，支持消息线程对话 |

**对现有数据的影响：** 全部有默认值，现有消息自动获得 `channel="direct"` 和 `priority="normal"`。

**业务价值：** 实现三通道消息路由（点对点/广播/系统），支持结构化数据交接和紧急消息通知。

### 2.6 新增 mission_artifacts 表

**业务含义：** 产出物表，记录每个子任务和最终汇总的交付产出物，支持版本管理和按类型分类。

| 字段名 | 类型 | 约束 | 业务含义 |
|--------|------|------|---------|
| `id` | uuid | PK, defaultRandom | 主键 |
| `mission_id` | uuid | FK→missions(CASCADE), NOT NULL | 所属任务 |
| `task_id` | uuid | FK→mission_tasks(SET NULL), nullable | 产出的子任务（NULL=汇总产出） |
| `produced_by` | uuid | FK→ai_employees, NOT NULL | 产出的员工 |
| `type` | text | NOT NULL | 产出物类型：text/data_table/chart/image/video_script/report/publish_plan |
| `title` | text | NOT NULL | 标题 |
| `content` | text | nullable | 文本内容 |
| `file_url` | text | nullable | 文件存储路径 |
| `metadata` | jsonb | default {} | 额外元数据 |
| `version` | integer | default 1 | 版本号 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

**业务价值：** 统一管理任务产出物，支持前端按任务分组展示、预览和下载。解决当前 output_data 作为 JSON 字段难以独立管理和展示的问题。

### 2.7 Phase 1 验收标准

| 编号 | 验收项 | 验收方法 |
|------|--------|---------|
| P1-AC1 | `npx tsc --noEmit` 类型检查通过 | 命令行执行 |
| P1-AC2 | `npm run build` 生产构建通过 | 命令行执行 |
| P1-AC3 | Migration SQL 仅包含 `ALTER TYPE...ADD VALUE`、`ALTER TABLE...ADD COLUMN`、`CREATE TABLE`，无 `DROP` 语句 | 人工审查生成的 SQL |
| P1-AC4 | Drizzle Studio 中可见 `mission_artifacts` 新表及所有新字段 | 浏览器验证 |
| P1-AC5 | 现有 Mission 数据完好，新字段获得正确默认值 | 数据库查询验证 |
| P1-AC6 | DAL 返回的类型包含全部新字段 | TypeScript 类型检查 |

---

## 三、Phase 2：核心引擎重构需求

### 3.1 代码重复消除

**需求描述：** Inngest 函数（leader-plan.ts, execute-mission-task.ts 等）与直连执行器（mission-executor.ts）存在约 150 行重复代码，包括员工加载、Leader Prompt 构建、JSON 解析、任务记录创建、依赖输出加载等逻辑。需提取为共享纯函数模块 `src/lib/mission-core.ts`。

**业务价值：** 消除一处改两处漏的维护风险，确保 Inngest 模式和直连模式行为一致。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-1-AC1 | 新增 `src/lib/mission-core.ts` 包含不少于 8 个共享函数 |
| P2-1-AC2 | `leader-plan.ts` 和 `mission-executor.ts` 的核心逻辑均改为调用 `mission-core.ts` 中的函数 |
| P2-1-AC3 | 删除两端的重复代码后，`npx tsc --noEmit` 通过 |
| P2-1-AC4 | 创建 Mission 全流程（planning→executing→consolidating→completed）正常执行，输出不变 |

### 3.2 结构化输出

**需求描述：** Leader 拆解输出当前通过正则 `match(/```(?:json)?\s*([\s\S]*?)```/)` 提取 JSON，解析失败时 fallback 到单任务。需使用 AI SDK v6 的 `Output.object()` + Zod Schema 确保输出格式可靠，从源头杜绝格式错误。

**业务价值：** 提升任务拆解可靠性，避免因 JSON 解析失败导致复杂任务被退化为单任务执行。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-2-AC1 | Leader 拆解调用使用 `Output.object({ schema: LeaderPlanSchema })` |
| P2-2-AC2 | LeaderPlanSchema 为 Zod schema，定义 tasks 数组中每个 task 的 title、description、assignedEmployeeSlug、dependsOn 等字段 |
| P2-2-AC3 | 解析结果为强类型 TypeScript 对象，无需正则或 JSON.parse |
| P2-2-AC4 | Worker 执行仍使用自由文本输出（仅 Leader 拆解使用结构化输出） |
| P2-2-AC5 | 创建 5 个不同场景的 Mission，Leader 输出均通过 schema 验证 |

### 3.3 DAG 循环依赖校验

**需求描述：** 子任务依赖关系当前无图论验证，LLM 可能生成含循环的依赖图导致任务永久挂起。需在任务创建前进行拓扑排序校验，拒绝含环 DAG。

**业务价值：** 防止死循环和任务永久挂起，提升系统可靠性。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-3-AC1 | `validateDAG(tasks)` 函数使用 Kahn 算法（入度法）拓扑排序，检测环路 |
| P2-3-AC2 | 正常 DAG（无环）校验通过，返回 `{valid: true, sortedIndices: [...]}` |
| P2-3-AC3 | 含环 DAG 校验失败，返回 `{valid: false, error: "任务依赖存在循环"}` |
| P2-3-AC4 | 引用无效依赖索引（越界）时校验失败，返回具体错误信息 |
| P2-3-AC5 | 校验失败时自动降级为线性无依赖的任务列表（移除所有 dependsOn），并记录警告消息到 mission_messages |

### 3.4 Token 预算强校验

**需求描述：** 当前 Token 预算（默认 200K tokens）仅记录使用量，不在执行前检查。需在每个子任务执行前检查剩余预算，超预算时阻止执行并触发降级交付。

**业务价值：** 防止成本失控，确保 Token 消耗在可控范围内。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-4-AC1 | 每个子任务执行前调用 `checkTokenBudget(missionId)`，返回 `{withinBudget, remaining}` |
| P2-4-AC2 | 当 `withinBudget=false` 时，子任务被标记为 `cancelled`，error_message 记录"Token 预算耗尽" |
| P2-4-AC3 | 预算耗尽后触发 Phase 5 汇总流程，使用已有产出物进行降级交付 |
| P2-4-AC4 | 验证：创建 `tokenBudget=1000` 的 Mission，执行时在第一个子任务后被拦截 |

### 3.5 降级交付策略

**需求描述：** 当 Mission 无法完全正常完成时，系统应按 4 级优先级降级，而非直接标记失败。确保用户尽可能获得有价值的输出。

**4 级降级策略：**

| 级别 | 名称 | 触发条件 | 交付方式 |
|------|------|---------|---------|
| Level 1 | 正常交付 | 所有任务完成 | Leader 汇总后交付完整产出物 |
| Level 2 | 部分交付 | 核心任务完成，非核心失败/跳过 | Leader 汇总已有产出物，标注缺失部分 |
| Level 3 | 原始交付 | Leader 汇总失败，或仅少量任务完成 | 直接将各子任务 Artifact 打包交付 |
| Level 4 | 失败报告 | 所有核心任务均失败 | 生成错误报告说明哪些步骤失败及原因 |

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-5-AC1 | `determineDegradationLevel(tasks)` 正确判定 4 个级别 |
| P2-5-AC2 | Level 1：所有任务 completed → 正常调用 Leader Agent 汇总 |
| P2-5-AC3 | Level 2：超过半数任务完成 → Leader 汇总 + 标注缺失 |
| P2-5-AC4 | Level 3：少于半数任务完成 → 跳过 Leader，直接打包 Artifact |
| P2-5-AC5 | Level 4：全部失败 → 生成失败报告，Mission 标记为 failed |
| P2-5-AC6 | Level 2/3 场景下 Mission 状态为 completed（而非 failed） |

### 3.6 进程保活

**需求描述：** 当前 `executeMissionDirect()` 通过 `.then()` 异步执行，Next.js 可能在 HTTP 响应返回后终止进程，导致后台任务中断。需使用 Next.js 的 `after()` API 确保后台任务在响应返回后继续执行。

**业务价值：** 确保 Mission 执行不因 HTTP 响应超时而中断，是系统可靠运行的基础保障。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-6-AC1 | `startMission` Server Action 中使用 `after()` 替代 `.then()` |
| P2-6-AC2 | `after()` 从 `next/server` 导入，编译通过 |
| P2-6-AC3 | 创建 Mission 后立即返回响应，后台执行不被中断 |
| P2-6-AC4 | 后台执行失败时，Mission 状态被正确更新为 `failed` |

### 3.7 跨组织校验

**需求描述：** `cancelMission` 等 Server Action 未校验 missionId 是否属于当前用户的组织，存在跨组织操作的安全风险。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-7-AC1 | `cancelMission` 在执行前校验 `WHERE id = missionId AND organization_id = orgId` |
| P2-7-AC2 | 资源不属于当前组织时抛出 "任务不存在或无权操作" 错误 |
| P2-7-AC3 | 手动测试：使用 A 组织用户尝试取消 B 组织的 Mission，被拒绝 |

### 3.8 技能绑定去重

**需求描述：** `bindSkillToEmployee` 没有检查是否已绑定，重复调用会在 `employee_skills` 表中创建重复记录。

**验收标准：**

| 编号 | AC |
|------|-----|
| P2-8-AC1 | `bindSkillToEmployee` 在 insert 前检查 `WHERE employee_id AND skill_id` 是否已存在 |
| P2-8-AC2 | 已绑定时执行 update（更新 level 和 bindingType）而非重复 insert |
| P2-8-AC3 | 连续调用 2 次绑定同一技能，`employee_skills` 表中仅有 1 条记录 |

---

## 四、Phase 3：缺失功能需求

### 4.1 任务归档/删除（P1）

**功能描述：** 用户可以归档已终止的任务（软删除，从默认列表隐藏）或永久删除任务（级联删除所有关联数据）。

**用户故事：** 作为媒体运营主管，我希望能够归档或删除已完成的历史任务，以保持任务列表的整洁和可管理性。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 一个状态为 completed/failed/cancelled 的 Mission | 用户点击"归档"按钮 | Mission 的 config 字段标记 `archived: true`，从默认任务列表中隐藏 |
| 一个状态为 completed/failed/cancelled 的 Mission | 用户点击"删除"按钮并确认 | Mission 及其关联的 tasks、messages、artifacts 被永久删除（CASCADE） |
| 一个状态为 executing/planning 的运行中 Mission | 用户尝试删除 | 系统拒绝，提示"不能删除运行中的任务，请先取消" |
| 任务列表页 | 默认视图 | 被归档的任务不显示；可通过筛选条件查看已归档任务 |

**优先级：P1**

### 4.2 任务重新执行（P1）

**功能描述：** 用户可以对已终止（completed/failed/cancelled）的任务一键重新执行，系统复制原始参数（标题、场景、指令）创建新 Mission。

**用户故事：** 作为内容编辑，当一个任务执行失败或结果不满意时，我希望能一键重新发起，无需重新填写所有参数。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 一个状态为 completed/failed/cancelled 的 Mission | 用户在任务详情页点击"重新执行"按钮 | 系统创建新 Mission，标题为 "原标题（重新执行）"，场景和指令完全复制 |
| 新创建的 Mission | 创建后 | 自动进入 planning→executing 全流程，与正常创建任务行为一致 |
| 一个状态为 executing 的运行中 Mission | 用户查看详情页 | "重新执行"按钮不可见 |

**优先级：P1**

### 4.3 子任务输出详情查看（P1）

**功能描述：** 在任务详情页的看板视图中，用户可以点击子任务卡片，展开查看完整的执行输出（output_data），而非仅看到摘要。

**用户故事：** 作为内容主管，我希望在任务控制台中查看每个子任务的完整输出结果，以评估各环节的质量。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 任务详情页看板中有已完成的子任务卡片 | 用户点击卡片 | 右侧弹出 Sheet，显示完整的任务描述、期望输出、执行结果（Markdown 渲染）、错误信息 |
| Sheet 中显示完整执行结果 | 内容为 Markdown 格式 | 使用 CollapsibleMarkdown 组件渲染，支持折叠/展开 |
| 子任务执行失败 | 用户点击失败卡片 | Sheet 中以红色高亮显示 error_message |
| Sheet 打开状态 | 用户点击关闭或 Sheet 外区域 | Sheet 关闭 |

**优先级：P1**

### 4.4 员工搜索（P2）

**功能描述：** 在 AI 员工市场页面新增文本搜索框，支持按员工名称、昵称、职位进行模糊搜索。

**用户故事：** 作为平台管理员，当员工数量较多时，我希望能通过关键字快速定位目标员工。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 员工市场页面展示 10+ 个 AI 员工 | 用户在搜索框输入"小文" | 仅显示名称/昵称/职位包含"小文"的员工卡片 |
| 搜索框有内容 | 用户清空搜索框 | 恢复显示全部员工 |
| 搜索与状态筛选同时生效 | 用户选择"空闲"状态 + 输入"内容" | 仅显示状态为 idle 且名称/昵称/职位包含"内容"的员工 |

**优先级：P2**

### 4.5 员工排序（P2）

**功能描述：** 在 AI 员工市场页面新增排序选择器，支持按绩效（任务完成数）、名称（中文拼音）、状态分组排序。

**用户故事：** 作为平台管理员，我希望能按不同维度排列员工卡片，快速发现高绩效或空闲的员工。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 员工市场页面 | 用户选择"按绩效"排序 | 员工按任务完成数降序排列 |
| 员工市场页面 | 用户选择"按名称"排序 | 员工按中文拼音升序排列 |
| 员工市场页面 | 用户选择"按状态"排序 | 员工按 working→learning→reviewing→idle 顺序分组排列 |
| 员工市场页面 | 用户选择"默认排序" | 恢复创建时间排序 |

**优先级：P2**

### 4.6 员工基本信息编辑 UI（P2）

**功能描述：** 在员工详情页头部区域，为自定义员工添加"编辑"按钮入口，点击弹出 Dialog 可修改名称、昵称、职位、座右铭。

**用户故事：** 作为平台管理员，我创建了自定义 AI 员工后，希望能随时修改其基本信息（名称、昵称等），而不需要删除重建。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 自定义员工（非预置）的详情页 | 用户点击头部编辑按钮 | 弹出 Dialog，包含名称、昵称、职位、座右铭四个可编辑字段，预填当前值 |
| Dialog 打开 | 用户修改字段后点击"保存" | 调用 `updateEmployeeProfile` Server Action，保存成功后 Dialog 关闭，页面刷新展示新数据 |
| 预置员工的详情页 | 用户查看头部 | 编辑按钮不显示（预置员工信息不可修改） |
| Dialog 打开 | 用户点击"取消" | Dialog 关闭，不做任何修改 |

**优先级：P2**

### 4.7 技能库浏览页 /skills（P1）

**功能描述：** 新建独立的技能库浏览页面，以卡片网格展示所有技能，支持按分类（6 个类别）、类型（内置/自定义/插件）筛选和关键字搜索。

**用户故事：** 作为平台管理员，我希望能在一个独立页面浏览和管理所有 AI 技能，而不仅仅在员工档案中看到已绑定的技能。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 用户访问 `/skills` | 页面加载 | 展示当前组织可见的所有技能（含全局内置+组织自定义），卡片显示名称、分类 Badge、类型 Badge、描述、版本号 |
| 技能列表页 | 用户选择分类筛选"感知" | 仅显示 category=perception 的技能 |
| 技能列表页 | 用户选择类型筛选"插件" | 仅显示 type=plugin 的技能 |
| 技能列表页 | 用户输入搜索关键字"搜索" | 仅显示名称或描述包含"搜索"的技能 |
| 技能卡片 | 用户点击某技能卡片 | 跳转到 `/skills/{id}` 详情页 |
| 侧栏导航 | 任何页面 | 侧栏包含"技能库"菜单项，指向 `/skills` |

**优先级：P1**

### 4.8 技能详情页 /skills/[id]（P1）

**功能描述：** 新建技能详情页面，多 Tab 面板展示技能完整信息，包括概览、文档、Schema、绑定员工、版本历史、使用统计。

**用户故事：** 作为平台管理员，我希望查看某个技能的详细信息，包括它被哪些员工绑定、版本历史、使用频率等，以便做出配置决策。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 用户访问 `/skills/{id}` | 页面加载 | 展示技能概览：名称、分类、类型、版本号、描述、兼容角色列表 |
| 详情页 | 用户切换到"技能文档"Tab | 展示 SKILL.md 内容，Markdown 渲染 |
| 详情页 | 用户切换到"Schema"Tab | 展示 inputSchema 和 outputSchema 的 JSON 格式化内容 |
| 详情页 | 用户切换到"绑定员工"Tab | 展示已绑定此技能的员工列表，含昵称、熟练度、绑定类型 |
| 详情页 | 用户切换到"版本历史"Tab | 展示版本列表，含版本号、变更时间、回滚按钮 |
| 详情页 | 用户点击回滚按钮 | 调用 `rollbackSkillVersion`，回滚到目标版本 |
| 技能 ID 不存在 | 用户访问 `/skills/invalid-id` | 显示 404 页面 |

**优先级：P1**

### 4.9 使用统计可视化（P2）

**功能描述：** 在技能详情页的"使用统计"Tab 中，以图表形式展示技能使用数据，包括指标卡片、趋势折线图、员工使用分布饼图。

**用户故事：** 作为平台管理员，我希望直观地了解每个技能的使用频率、成功率和使用分布，以便评估技能价值和优化配置。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 技能详情页"使用统计"Tab | 页面加载 | 展示 4 个指标卡片：总调用次数、成功率、平均质量分、平均耗时 |
| 使用统计 Tab | 页面加载 | 展示近 30 天使用趋势折线图（AreaChart），X 轴为日期，Y 轴为调用次数 |
| 使用统计 Tab | 页面加载 | 展示员工使用分布饼图（DonutChart），按员工维度展示调用量占比 |
| 技能无使用记录 | 页面加载 | 显示"暂无使用数据"空状态 |

**优先级：P2**

### 4.10 技能执行自动记录（P1）

**功能描述：** Mission 子任务执行完成后，系统自动为执行员工绑定的技能记录使用数据（成功/失败、执行时间、Token 用量），无需依赖用户 session。

**用户故事：** 作为平台管理员，我希望技能使用数据能够在 Mission 执行时自动积累，而不依赖手动操作或用户 session。

**验收标准：**

| Given | When | Then |
|-------|------|------|
| 一个 Mission 的子任务成功执行完成 | 执行引擎完成任务后 | `skill_usage_records` 表中为该员工绑定的每个技能新增一条使用记录，包含 success=1、executionTimeMs、tokenUsage |
| 子任务执行失败 | 失败处理后 | `skill_usage_records` 表中记录 success=0 和 errorMessage |
| 内部记录函数 `recordSkillUsageInternal` | 被调用时 | 不依赖 `requireAuth()`，直接写入数据库 |
| 一个 Mission 完成 | 查看技能使用统计 | 统计数据包含本次 Mission 的使用记录 |

**优先级：P1**

---

## 五、Phase 4：安全加固需求

### 5.1 组织隔离校验规则

**需求描述：** 所有涉及资源写操作的 Server Action 必须校验目标资源的 `organization_id` 与当前用户所属组织一致。

**覆盖范围：**

| 文件 | 需加固函数 | 当前状态 |
|------|-----------|---------|
| `actions/missions.ts` | `cancelMission` | 无 orgId 校验（Phase 2 步骤 2.7 修复） |
| `actions/employees.ts` | `updateEmployeeStatus` | 无 orgId 校验 |
| `actions/employees.ts` | `bindSkillToEmployee` | 无 orgId 校验 |
| `actions/employees.ts` | `unbindSkillFromEmployee` | 无 orgId 校验 |
| `actions/employees.ts` | `updateSkillLevel` | 无 orgId 校验 |
| `actions/employees.ts` | `updateEmployeeProfile` | 无 orgId 校验 |
| `actions/employees.ts` | `updateWorkPreferences` | 无 orgId 校验 |
| `actions/employees.ts` | `updateAuthorityLevel` | 无 orgId 校验 |
| `actions/employees.ts` | `toggleEmployeeDisabled` | 无 orgId 校验 |
| `actions/employees.ts` | `deleteEmployee` | 无 orgId 校验 |
| `actions/employees.ts` | `cloneEmployee` | 无 orgId 校验 |
| `api/scenarios/execute/route.ts` | POST handler | 无 employeeDbId 归属校验 |

**实施策略：** 提取公用函数 `requireOwnedEmployee(employeeId)` 和 `requireOwnedMission(missionId)`，在每个写操作函数开头调用。

**验收标准：**

| 编号 | AC |
|------|-----|
| P4-1-AC1 | 所有上述 12 个函数/路由均包含 orgId 校验 |
| P4-1-AC2 | 使用 A 组织用户操作 B 组织的资源时，返回 "不存在或无权操作" 错误 |
| P4-1-AC3 | Scenario API Route 对不属于当前组织的 employeeDbId 返回 403 |

### 5.2 插件安全策略

**需求描述：** 插件技能的 `pluginConfig.authKey` 当前明文存储在数据库中，且无 URL 访问限制，存在安全隐患。

**加固措施：**

| 措施 | 实现 |
|------|------|
| authKey 加密存储 | 使用 AES-256-CBC 加密，新增 `src/lib/crypto.ts` 提供 encrypt/decrypt |
| URL 白名单 | 阻止内网地址（localhost、127.0.0.1、10.x、192.168.x、172.16.x），仅允许 HTTPS |
| 注册时校验 | `registerPluginSkill` 和 `updatePluginConfig` 写入前执行加密和 URL 校验 |
| 使用时解密 | `createPluginTool` 运行时解密 authKey |

**验收标准：**

| 编号 | AC |
|------|-----|
| P4-2-AC1 | 注册插件时 authKey 在 skills 表中以加密形式存储（格式 `iv:encrypted`） |
| P4-2-AC2 | 注册指向 localhost/127.0.0.1/内网地址的插件被拒绝 |
| P4-2-AC3 | 注册使用 HTTP（非 HTTPS）协议的插件被拒绝 |
| P4-2-AC4 | 已注册插件在 Agent 执行时能正确解密 authKey 并调用 API |

### 5.3 员工状态守护

**需求描述：** 当 Mission 执行异常中断时，参与的 AI 员工可能永久卡在 `working` 状态，导致后续任务无法分配。需定时扫描并重置长时间滞留在 working 状态的员工。

**实施方案：** 新建 Inngest cron 函数 `employee-status-guard`，每 30 分钟扫描一次，将超过 30 分钟仍为 working 状态的员工重置为 idle。

**验收标准：**

| 编号 | AC |
|------|-----|
| P4-3-AC1 | Inngest cron 函数 `employee-status-guard` 注册成功，每 30 分钟触发 |
| P4-3-AC2 | 超过 30 分钟处于 working 状态的员工被重置为 idle，currentTask 清空 |
| P4-3-AC3 | 正在正常执行的员工（updatedAt 在 30 分钟以内）不受影响 |
| P4-3-AC4 | 执行日志记录被重置的员工 slug 和数量 |

### 5.4 数据库约束

**需求描述：** 当前部分表缺少唯一约束和查询索引，需通过 Migration 补齐。

**约束清单：**

| 表 | 约束类型 | 字段 | 目的 |
|---|---------|------|------|
| `ai_employees` | UNIQUE INDEX | `(organization_id, slug)` | 防止同组织内重复 slug |
| `employee_skills` | UNIQUE INDEX | `(employee_id, skill_id)` | 防止重复绑定（配合技能去重需求） |
| `employee_knowledge_bases` | UNIQUE INDEX | `(employee_id, knowledge_base_id)` | 防止重复绑定知识库 |
| `missions` | INDEX | `(organization_id, status)` | 加速任务列表查询 |
| `mission_tasks` | INDEX | `(mission_id, status)` | 加速子任务查询 |
| `skill_usage_records` | INDEX | `(skill_id, created_at)` | 加速使用统计聚合查询 |

**验收标准：**

| 编号 | AC |
|------|-----|
| P4-4-AC1 | 所有 6 个约束/索引通过 Migration 成功创建 |
| P4-4-AC2 | 尝试向 employee_skills 插入重复 (employee_id, skill_id) 记录时，数据库报唯一约束错误 |
| P4-4-AC3 | 尝试向 ai_employees 插入同组织重复 slug 时，数据库报唯一约束错误 |
| P4-4-AC4 | 现有数据无重复记录（若有需先清理再创建约束） |

---

## 六、验收总览

### 6.1 各 Phase 关键验收标准汇总

| Phase | 编号 | 验收标准 | 验证方法 |
|-------|------|---------|---------|
| **Phase 1** | P1-AC1 | TypeScript 编译通过 | `npx tsc --noEmit` |
| | P1-AC2 | 生产构建通过 | `npm run build` |
| | P1-AC3 | Migration SQL 无 DROP 语句 | 人工审查 |
| | P1-AC4 | 新表和新字段在 DB Studio 可见 | Drizzle Studio |
| | P1-AC5 | 现有数据完好 | 数据库查询 |
| | P1-AC6 | DAL 返回类型含新字段 | TypeScript 检查 |
| **Phase 2** | P2-1-AC4 | Mission 端到端全流程正常 | 创建并执行任务 |
| | P2-2-AC5 | 5 个场景 Leader 输出通过 Schema 验证 | 手动测试 |
| | P2-3-AC3 | 含环 DAG 被拒绝 | 单元测试 |
| | P2-4-AC4 | 低预算 Mission 被拦截 | 集成测试 |
| | P2-5-AC3 | Level 2 部分交付正确 | 模拟失败场景 |
| | P2-6-AC3 | 后台执行不被中断 | 创建任务观察 |
| | P2-7-AC2 | 跨组织操作被拒绝 | 手动测试 |
| | P2-8-AC3 | 重复绑定无重复记录 | 数据库查询 |
| **Phase 3** | P3-AC1 | 任务归档/删除正常 | 功能测试 |
| | P3-AC2 | 任务重新执行正常 | 功能测试 |
| | P3-AC3 | 子任务输出 Sheet 弹出且内容完整 | UI 测试 |
| | P3-AC4 | 员工搜索和排序正常 | UI 测试 |
| | P3-AC5 | `/skills` 页面正常浏览 | 浏览器访问 |
| | P3-AC6 | `/skills/[id]` 页面显示详情和统计 | 浏览器访问 |
| | P3-AC7 | Mission 执行后 skill_usage_records 有记录 | 数据库查询 |
| **Phase 4** | P4-AC1 | 全部 12 个函数跨组织操作被拒绝 | 安全测试 |
| | P4-AC2 | 插件内网 URL 和 HTTP 被拒绝 | 功能测试 |
| | P4-AC3 | authKey 加密存储 | 数据库查询 |
| | P4-AC4 | 唯一约束生效 | 数据库操作 |
| | P4-AC5 | 员工状态守护 cron 注册且运行 | Inngest 控制台 |

### 6.2 最终交付物

| 交付物 | 说明 |
|--------|------|
| 数据库 Migration 文件 | 枚举扩展、字段新增、新表创建、索引和约束 |
| `src/lib/mission-core.ts` | 共享核心逻辑模块 |
| `src/lib/crypto.ts` | 插件 authKey 加解密工具 |
| `src/app/(dashboard)/skills/` | 技能库浏览页和详情页 |
| `src/inngest/functions/employee-status-guard.ts` | 员工状态守护 cron 函数 |
| 更新的 Server Action 文件 | 安全校验、新功能函数 |
| 更新的 Client 组件 | 搜索/排序/编辑/Sheet 详情 |

### 6.3 完成后指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 功能完成率 | 87.6%（85/97） | **100%**（107/107，含 10 个新功能点） |
| P0 风险数 | 4 | **0** |
| P1 风险数 | 3 | **0** |
| 组织隔离覆盖率 | 约 50% | **100%**（所有写操作） |
| 数据库唯一约束 | 0 个 | **3 个关键唯一约束** |
| 查询索引 | 0 个专用索引 | **3 个高频查询索引** |

---

*文档结束*
