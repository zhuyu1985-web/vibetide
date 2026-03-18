# AI 数字员工架构优化设计

> 日期：2026-03-07
> 状态：已批准，待实施
> 涉及问题：用户意图拆解、技能学习、内置技能定义、员工间协同、结果判断与修正、记忆系统、员工-技能关系、安全权限

## 概述

基于 10 个核心架构问题，对 AI 数字员工系统进行轻量化增量优化。采用"核心优先"策略：先夯实技能体系和记忆基础，再构建上层能力。

保持现有架构不变（Inngest 编排 + Vercel AI SDK 执行），不引入新框架。

## 改动总览

- 新增文件：2 个
- 改动文件：14 个
- 新增数据库表：2 个（`employee_memories`、`workflow_artifacts`）
- 新增枚举：3 个（`skill_binding_type`、`memory_type`、`artifact_type`）

---

## 第一部分：技能体系重构（问题 3、4、8）

### 问题

- `skills` 表中技能名（中文）与 `tool-registry.ts` 工具名（英文）不对应
- `employee_skills` 无绑定类型区分（核心/扩展/知识）
- 无完整的内置技能定义

### 设计

#### 1.1 新增枚举 `skill_binding_type`

```typescript
// src/db/schema/enums.ts
export const skillBindingTypeEnum = pgEnum("skill_binding_type", [
  "core",       // 角色自带，不可解绑
  "extended",   // 手动绑定，可解绑
  "knowledge",  // 来自知识库绑定
]);
```

#### 1.2 `employee_skills` 表增加字段

```typescript
// src/db/schema/skills.ts
bindingType: skillBindingTypeEnum("binding_type").notNull().default("extended"),
```

#### 1.3 完整内置技能常量

在 `src/lib/constants.ts` 新增 `BUILTIN_SKILLS`（28 个技能，6 个类别）和 `EMPLOYEE_CORE_SKILLS`（8 个员工的核心技能映射）。

技能 slug 直接对应 `tool-registry.ts` 的工具名，消除中英文不一致问题。

| 类别 | 技能数 | 代表技能 |
|------|--------|---------|
| perception | 4 | web_search, trend_monitor, social_listening, news_aggregation |
| analysis | 6 | sentiment_analysis, topic_extraction, competitor_analysis, audience_analysis, fact_check, heat_scoring |
| generation | 7 | content_generate, headline_generate, summary_generate, script_generate, style_rewrite, translation, angle_design |
| production | 4 | video_edit_plan, thumbnail_generate, layout_design, audio_plan |
| management | 4 | quality_review, compliance_check, task_planning, publish_strategy |
| knowledge | 4 | knowledge_retrieval, media_search, case_reference, data_report |

#### 1.4 员工核心技能映射

| 员工 | 核心技能 |
|------|---------|
| xiaolei | web_search, trend_monitor, social_listening, heat_scoring |
| xiaoce | topic_extraction, angle_design, audience_analysis, task_planning |
| xiaozi | media_search, knowledge_retrieval, news_aggregation, case_reference |
| xiaowen | content_generate, headline_generate, style_rewrite, script_generate |
| xiaojian | video_edit_plan, thumbnail_generate, layout_design, audio_plan |
| xiaoshen | quality_review, compliance_check, fact_check, sentiment_analysis |
| xiaofa | publish_strategy, style_rewrite, translation, audience_analysis |
| xiaoshu | data_report, competitor_analysis, audience_analysis, heat_scoring |

#### 1.5 约束

- `unbindSkillFromEmployee` action 中 `binding_type === "core"` 时拒绝解绑
- Seed 脚本使用新常量生成数据

---

## 第二部分：记忆系统（问题 7）

### 问题

- `ai_employees.learnedPatterns` 是 `string[]`，未使用
- 无独立记忆存储
- 无记忆隔离机制

### 设计

#### 2.1 新增 `employee_memories` 表

```
文件：src/db/schema/employee-memories.ts（新文件）

字段：
- id: uuid PK
- employee_id: uuid FK -> ai_employees
- organization_id: uuid FK -> organizations
- memory_type: enum (feedback, pattern, preference)
- content: text（自然语言描述）
- source: text（来源标识）
- importance: real 0-1（权重）
- access_count: integer
- last_accessed_at: timestamptz
- created_at: timestamptz
```

暂不加 embedding 字段，先用 importance 权重 + 最近访问时间做检索。

#### 2.2 `learnedPatterns` 类型升级

从 `string[]` 改为：

```typescript
Record<string, {
  source: "human_feedback" | "quality_review" | "self_reflection";
  count: number;
  lastSeen: string; // ISO date
}>
```

#### 2.3 记忆隔离

| 维度 | 隔离方式 |
|------|---------|
| 组织间 | `organization_id` 强制过滤 |
| 员工间 | 情景记忆按 `employee_id` 隔离 |
| 知识库 | 组织内共享（现有机制） |

#### 2.4 记忆注入

`assembly.ts` 加载 top 10 高权重记忆，`prompt-templates.ts` Layer 6 注入。

#### 2.5 写入时机

| 触发 | 写入目标 |
|------|---------|
| 审批驳回 + 反馈 | employee_memories (feedback) + learnedPatterns 计数 |
| 审批通过 | learnedPatterns 正向模式权重 |
| 工作流完成 | employee_memories (pattern) |

---

## 第三部分：工件系统（问题 5）

### 问题

- 步骤间只传递纯文本，丢失结构
- 工件不持久化，驳回重做或工作流恢复时无法回溯

### 设计

#### 3.1 新增 `workflow_artifacts` 表

```
文件：src/db/schema/workflows.ts 中新增

字段：
- id: uuid PK
- workflow_instance_id: uuid FK -> workflow_instances
- artifact_type: enum (topic_brief, angle_list, material_pack, article_draft, video_plan, review_report, publish_plan, analytics_report, generic)
- title: text
- content: jsonb（结构化内容）
- text_content: text（纯文本版本，给 prompt 用）
- producer_employee_id: uuid FK -> ai_employees
- producer_step_key: text
- version: integer default 1
- created_at: timestamptz
```

#### 3.2 工作流引擎改动

- 每步执行后：保存工件到 DB
- 下游步骤：从 DB 加载上游工件
- 新增 `formatArtifactContext()` 用于 prompt 构建

#### 3.3 传递策略

| 场景 | 方式 |
|------|------|
| 同一工作流连续步骤 | 内存 + DB 双写 |
| 驳回重做 | 从 DB 重新加载 |
| 工作流恢复 | 从 DB 加载 |

---

## 第四部分：执行结果判断与修正（问题 6）

### 问题

- `qualityScore` 从未被 Agent 产出
- 质量判断完全依赖人工
- 无中途干预机制

### 设计

#### 4.1 Agent 自检

`prompt-templates.ts` Layer 7 加入自检指令，要求 Agent 在输出末尾附带质量自评分数（0-100）。

#### 4.2 质量分数提取

`step-io.ts` 新增 `extractQualityScore()`，通过正则从 Agent 输出中提取自评分数。

#### 4.3 三层质量保障

```
score >= 80  -> 正常流程
60 <= score < 80 -> 自动重试一次（注入改进建议）
score < 60  -> 强制人工审批
```

#### 4.4 中途干预

步骤循环开头检查 `team_messages` 中是否有 `senderType: "human", type: "alert"` 的新消息，有则注入 `userInstructions`。

---

## 第五部分：用户意图拆解（问题 1）

### 问题

- 工作流步骤固定 8 步，不管用户意图
- 无任务分解能力

### 设计

#### 5.1 新增 `intent-parser.ts`

```
文件：src/lib/agent/intent-parser.ts（新文件）

函数：parseUserIntent(topicTitle, scenario, availableEmployees) -> ParsedIntent

ParsedIntent 结构：
- intentType: breaking_news | deep_report | social_campaign | series | event_coverage | routine
- scale: single | batch | series
- timeConstraint: urgent | normal | flexible
- requiredCapabilities: string[]
- suggestedSteps: { key, label, employeeSlug, parallel? }[]
- reasoning: string
```

通过一次 LLM 调用（claude-sonnet, temperature 0.3）分析用户输入，生成动态步骤列表。

#### 5.2 可选调用

`startWorkflow` action 新增 `autoPlanning` 参数。开启时跳过手动选步骤，由 AI 规划后展示给用户确认。

#### 5.3 不做的事

- 不做并行步骤执行（`parallel` 字段预留）
- 不做动态分支/条件跳转

---

## 第六部分：安全/权限保障（问题 9）

### 问题

- `authority_level` 仅在 prompt 中提及，不影响实际执行
- 部分 DAL 无 orgId 过滤
- 无 token 预算和工具调用限制

### 设计

#### 6.1 权限等级约束工具

`assembly.ts` 中按 `authorityLevel` 过滤可用工具：

| 权限 | 可用工具 |
|------|---------|
| observer | 无（仅分析建议） |
| advisor | 只读工具（search, retrieval, report） |
| executor | 绑定的全部工具 |
| coordinator | 绑定的全部工具 |

#### 6.2 Token 预算

`workflow_instances` 新增 `token_budget`（默认 100000）和 `tokens_used` 字段。每步执行后累加并检查，超预算则抛错取消工作流。

#### 6.3 DAL 组织隔离

利用 `getCurrentUserOrg()` + `withOrgScope` 辅助函数，在所有 DAL 查询中强制带 `organization_id` 过滤。

#### 6.4 工具调用限制

`execution.ts` 中硬上限 20 次工具调用/步骤。

---

## 第七部分：技能学习与进阶（问题 2）

### 问题

- `employee_skills.level` 从不更新
- 无学习机制

### 设计

#### 7.1 技能熟练度自动更新

步骤完成后根据 qualityScore 微调 level：

| 质量分数 | level 变化 |
|---------|-----------|
| >= 90 | +2 |
| >= 80 | +1 |
| 60-80 | 不变 |
| < 60 | -1 |

增长幅度小，确保进阶是渐进过程。

#### 7.2 审批反馈驱动

驳回时：反馈写入 `employee_memories` + `learnedPatterns` 计数递增。

#### 7.3 熟练度影响 prompt

`assembly.ts` 计算平均熟练度，`prompt-templates.ts` Layer 2 根据等级调整约束松紧：

| 熟练度 | prompt 指导风格 |
|--------|---------------|
| 0-30 | 严格按步骤执行，每步自检 |
| 31-70 | 适当发挥，关键判断需说明依据 |
| 71-100 | 自由发挥，鼓励创新 |

---

## 改动文件清单

### 新增文件（2）

| 文件 | 用途 |
|------|------|
| `src/db/schema/employee-memories.ts` | 员工记忆表 |
| `src/lib/agent/intent-parser.ts` | 用户意图解析 |

### Schema 改动（5）

| 文件 | 改动 |
|------|------|
| `src/db/schema/enums.ts` | +3 枚举 |
| `src/db/schema/skills.ts` | employee_skills +binding_type |
| `src/db/schema/workflows.ts` | +workflow_artifacts 表, workflow_instances +token_budget/tokens_used |
| `src/db/schema/ai-employees.ts` | learnedPatterns 类型变更 |
| `src/db/schema/index.ts` | 导出 employee-memories |

### Agent 基础设施改动（5）

| 文件 | 改动 |
|------|------|
| `src/lib/agent/types.ts` | AssembledAgent +memories/proficiencyLevel |
| `src/lib/agent/assembly.ts` | 加载记忆、计算熟练度、权限过滤工具 |
| `src/lib/agent/prompt-templates.ts` | Layer 2/6/7 改进, +formatArtifactContext |
| `src/lib/agent/step-io.ts` | +extractQualityScore |
| `src/lib/agent/execution.ts` | 工具调用次数限制 |

### 工作流引擎（1）

| 文件 | 改动 |
|------|------|
| `src/inngest/functions/execute-workflow.ts` | 工件持久化、质量重试、token 预算、干预检查、技能更新、驳回学习 |

### 常量与 Seed（2）

| 文件 | 改动 |
|------|------|
| `src/lib/constants.ts` | +BUILTIN_SKILLS, +EMPLOYEE_CORE_SKILLS |
| `src/db/seed.ts` | 使用新常量 |

### Server Actions（1）

| 文件 | 改动 |
|------|------|
| `src/app/actions/workflow-engine.ts` | startWorkflow +autoPlanning |

---

## 实施优先级

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P0 | 技能体系重构（第一部分） | 无 |
| P0 | 记忆系统（第二部分） | 无 |
| P1 | 工件系统（第三部分） | 第一部分（工件类型对齐技能产出） |
| P1 | 结果判断与修正（第四部分） | 无 |
| P1 | 安全权限（第六部分） | 第一部分（工具过滤依赖技能绑定） |
| P1 | 技能学习（第七部分） | 第一部分 + 第二部分 |
| P2 | 意图拆解（第五部分） | 第一部分（需要知道员工技能以做规划） |
