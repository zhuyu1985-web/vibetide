# 超级个体门户 Phase 2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现自定义员工创建（GPTs 式）、自定义场景编排、三审三校合规体系（含审核中心页面）。

**Architecture:** 自定义员工复用现有 `ai_employees` 表（`is_preset=0`）+ agent assembly pipeline。审核体系利用已有的 `review_results`/`compliance_checks` 表，新增 `audit_records`/`content_trail_logs` 表。审核中心为新增路由 `/audit-center`。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Drizzle ORM + Supabase + 现有 agent/mission 基础设施

**Spec:** `docs/superpowers/specs/2026-04-17-super-individual-portal-design.md` §5-§7

**关键发现（影响实施）：**
- `ai_employees.is_preset` 字段已存在（integer, 1=预设, 0=自定义）
- `missionTaskStatusEnum` 已有 `in_review`，无需添加 `awaiting_review`
- `review_results` 和 `compliance_checks` 表已存在，可复用
- `employee_config_versions` 提供员工配置审计追踪
- 工作流编排器（WorkflowEditor）已存在于 `/workflows/new`

---

## Phase 2A: 自定义员工 & 场景（Tasks 1-6）
## Phase 2B: 合规体系（Tasks 7-12）

---

## Task 1: 自定义员工创建 — Server Action

**Files:**
- Create: `src/app/actions/custom-employees.ts`
- Read: `src/db/schema/ai-employees.ts`, `src/db/schema/skills.ts`

- [ ] **Step 1: 创建 server action 文件**

```typescript
// src/app/actions/custom-employees.ts
"use server";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema/ai-employees";
import { employeeSkills } from "@/db/schema/skills";
import { employeeKnowledgeBases } from "@/db/schema/knowledge-bases";
import { requireAuth } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface CreateCustomEmployeeInput {
  baseTemplateSlug: string;     // 基础角色模板 slug
  name: string;                 // 自定义名称
  description: string;          // 一句话描述
  instructions: string;         // 自定义指令（Identity prompt）
  skillIds: string[];           // 选中的技能 ID 列表
  knowledgeBaseIds: string[];   // 绑定的知识库 ID 列表
  visibility: "team" | "private"; // 可见性
}

export async function createCustomEmployee(input: CreateCustomEmployeeInput) {
  const { organizationId, userId } = await requireAuth();
  const slug = `custom_${uuid().slice(0, 8)}`;

  // 1. 插入 ai_employees 记录
  const [employee] = await db.insert(aiEmployees).values({
    id: uuid(),
    organizationId,
    slug,
    name: input.name,
    nickname: input.name,
    title: input.name,
    motto: input.description,
    roleType: input.baseTemplateSlug,
    authorityLevel: "executor",
    status: "idle",
    isPreset: 0,
    // 自定义指令存入 autoActions 的 JSON 字段中
    // （或创建专用字段，但 Phase 2 先复用 autoActions）
    autoActions: JSON.stringify({ customInstructions: input.instructions }),
  }).returning({ id: aiEmployees.id });

  // 2. 绑定技能
  if (input.skillIds.length > 0) {
    await db.insert(employeeSkills).values(
      input.skillIds.map(skillId => ({
        id: uuid(),
        employeeId: employee.id,
        skillId,
        bindingType: "manual" as const,
        level: 50,
      }))
    );
  }

  // 3. 绑定知识库
  if (input.knowledgeBaseIds.length > 0) {
    await db.insert(employeeKnowledgeBases).values(
      input.knowledgeBaseIds.map(kbId => ({
        employeeId: employee.id,
        knowledgeBaseId: kbId,
      }))
    );
  }

  revalidatePath("/ai-employees");
  revalidatePath("/home");
  return { id: employee.id, slug };
}

export async function updateCustomEmployee(
  employeeId: string,
  input: Partial<CreateCustomEmployeeInput>
) {
  const { organizationId } = await requireAuth();

  // 确认是自定义员工且属于当前组织
  const [emp] = await db.select()
    .from(aiEmployees)
    .where(and(
      eq(aiEmployees.id, employeeId),
      eq(aiEmployees.organizationId, organizationId),
      eq(aiEmployees.isPreset, 0)
    ));

  if (!emp) throw new Error("员工不存在或无权编辑");

  await db.update(aiEmployees)
    .set({
      name: input.name ?? emp.name,
      nickname: input.name ?? emp.nickname,
      title: input.name ?? emp.title,
      motto: input.description ?? emp.motto,
      autoActions: input.instructions
        ? JSON.stringify({ customInstructions: input.instructions })
        : emp.autoActions,
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/ai-employees");
  return { success: true };
}

export async function deleteCustomEmployee(employeeId: string) {
  const { organizationId } = await requireAuth();

  await db.delete(aiEmployees)
    .where(and(
      eq(aiEmployees.id, employeeId),
      eq(aiEmployees.organizationId, organizationId),
      eq(aiEmployees.isPreset, 0)
    ));

  revalidatePath("/ai-employees");
  return { success: true };
}
```

注意：上述代码是骨架，实施时需要读取实际的 schema 字段确认 `insert/update` 的参数。`requireAuth()` 需要确认导入路径。`employeeSkills` 的 `bindingType` 需检查实际枚举值。

- [ ] **Step 2: 验证类型检查**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git commit -m "feat: add server actions for custom employee CRUD"
```

---

## Task 2: 自定义员工 — 3步创建向导 UI

**Files:**
- Create: `src/app/(dashboard)/ai-employees/create/page.tsx`
- Create: `src/app/(dashboard)/ai-employees/create/create-employee-client.tsx`

- [ ] **Step 1: 创建 server page**

```typescript
// src/app/(dashboard)/ai-employees/create/page.tsx
export const dynamic = "force-dynamic";
// 从 DAL 获取可用技能列表、知识库列表
// 传递给 CreateEmployeeClient
```

- [ ] **Step 2: 创建 3 步向导客户端组件**

`create-employee-client.tsx` — 使用 Tab/Step 模式：

**Step 1: 基础信息**
- 选择基础角色模板（8个预设员工的卡片选择器）
- 自定义名称输入
- 一句话描述输入

**Step 2: 能力配置**
- 指令设定（textarea，根据所选模板预填提示文字）
- 技能选择（checkbox list，基底角色技能默认勾选）
- 知识库绑定（多选 dropdown）

**Step 3: 预览 & 发布**
- 预览卡片（名称、描述、技能列表、知识库）
- 可见性选择（团队 / 仅自己）
- 发布按钮

所有文字中文。无边框按钮。支持亮/暗模式。

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: 提交**

```bash
git commit -m "feat: add 3-step custom employee creation wizard"
```

---

## Task 3: 自定义员工 — 首页集成 & Agent Assembly 适配

**Files:**
- Modify: `src/components/home/employee-quick-panel.tsx` — 末尾加 "+" 按钮
- Modify: `src/lib/agent/assembly.ts` — 读取自定义指令
- Modify: `src/app/(dashboard)/ai-employees/ai-employees-client.tsx` — 显示自定义员工

- [ ] **Step 1: EmployeeQuickPanel 添加 "+" 入口**

在8个员工之后添加一个 "+" 按钮，点击跳转到 `/ai-employees/create`。

- [ ] **Step 2: Agent assembly 适配自定义指令**

在 `assembly.ts` 中，当加载员工数据后，检查 `autoActions` 是否包含 `customInstructions` 字段。如果是，将其注入到 Identity prompt 层。

- [ ] **Step 3: 员工列表页显示自定义员工**

在 `ai-employees-client.tsx` 中，自定义员工（`isPreset === false`）显示在预设员工之后，带"自定义"标签和编辑/删除按钮。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: 提交**

```bash
git commit -m "feat: integrate custom employees into homepage and agent pipeline"
```

---

## Task 4: 自定义场景 — 基于预设调参

**Files:**
- Create: `src/app/(dashboard)/scenarios/customize/page.tsx`
- Create: `src/app/(dashboard)/scenarios/customize/customize-scenario-client.tsx`
- Modify: `src/components/home/scenario-grid.tsx` — "自定义场景" 按钮逻辑

- [ ] **Step 1: 自定义场景页面**

选择一个预设场景 → 修改团队成员（增减）→ 调整步骤（排序/删除）→ 修改输入字段 → 保存为"我的场景"。

数据存入 `employeeScenarios` 表（或新建 `custom_scenarios` 表，取决于实际 schema）。

- [ ] **Step 2: 首页"+ 自定义场景"逻辑**

点击弹出选择：
- "基于现有场景修改" → `/scenarios/customize`
- "从零创建工作流" → `/workflows/new`

- [ ] **Step 3: 验证提交**

Run: `npx tsc --noEmit && npm run build`

```bash
git commit -m "feat: add scenario customization from presets"
```

---

## Task 5: 自定义场景 — 首页展示用户场景

**Files:**
- Modify: `src/app/(dashboard)/home/page.tsx` — 获取用户自定义场景
- Modify: `src/components/home/scenario-grid.tsx` — 预设 + 自定义混合显示

- [ ] **Step 1: page.tsx 查询自定义场景**

从数据库查询当前用户/组织的自定义场景，传递到前端。

- [ ] **Step 2: ScenarioGrid 混合显示**

6个预设场景 + 用户自定义场景（如有），自定义场景带"自定义"角标。

- [ ] **Step 3: 验证提交**

```bash
git commit -m "feat: display custom scenarios alongside presets on homepage"
```

---

## Task 6: Phase 2A 端到端验证

- [ ] **Step 1: 完整构建验证**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 2: 功能检查清单**

1. 可以创建自定义员工（3步向导）
2. 自定义员工出现在首页员工面板
3. 自定义员工可以在对话中使用
4. 可以基于预设场景创建自定义场景
5. "从零创建"跳转到工作流编排器
6. 自定义场景出现在首页场景区域

- [ ] **Step 3: 提交**

```bash
git commit -m "chore: verify Phase 2A custom employee and scenario features"
```

---

## Task 7: 合规体系 — 数据库 Schema

**Files:**
- Create: `src/db/schema/audit.ts`
- Modify: `src/db/schema/enums.ts` — 添加审核相关枚举
- Modify: `src/db/schema/index.ts` — 导出新表

- [ ] **Step 1: 添加审核枚举**

在 `enums.ts` 中添加：
```typescript
export const auditStageEnum = pgEnum("audit_stage", [
  "review_1", "review_2", "review_3"
]);

export const auditResultEnum = pgEnum("audit_result", [
  "pass", "warning", "fail"
]);

export const auditModeEnum = pgEnum("audit_mode", [
  "auto", "human", "hybrid"
]);

export const trailActionEnum = pgEnum("trail_action", [
  "create", "edit", "review", "approve", "reject", "publish"
]);

export const trailStageEnum = pgEnum("trail_stage", [
  "planning", "writing", "review_1", "review_2", "review_3", "publishing"
]);
```

- [ ] **Step 2: 创建审核表**

```typescript
// src/db/schema/audit.ts
// audit_records — 审核记录
// audit_rules — 审核规则配置（组织级、场景级）
// content_trail_logs — 全流程留痕日志
// sensitive_word_lists — 自定义敏感词库
```

每个表包含 `organizationId` 多租户字段。

`audit_records`: id, organizationId, missionId?, articleId?, stage(auditStageEnum), mode(auditModeEnum), reviewerType("ai"|"human"), reviewerId, dimensions(jsonb — 6维评分), overallResult(auditResultEnum), issues(jsonb), comment, contentSnapshot, diff, createdAt

`audit_rules`: id, organizationId, scenarioKey?, name, dimensions(jsonb — 启用的维度及严格度), mode(auditModeEnum per stage), isDefault, createdAt, updatedAt

`content_trail_logs`: id, organizationId, contentId, contentType, operator, operatorType("ai"|"human"), action(trailActionEnum), stage(trailStageEnum), contentSnapshot, diff(jsonb), comment, metadata(jsonb), createdAt

`sensitive_word_lists`: id, organizationId, name, words(jsonb array), category, isActive, createdAt, updatedAt

- [ ] **Step 3: 生成迁移**

Run: `npm run db:generate`

- [ ] **Step 4: 推送到数据库**

Run: `npm run db:push`

- [ ] **Step 5: 提交**

```bash
git commit -m "feat: add audit schema — audit_records, audit_rules, content_trail_logs, sensitive_words"
```

---

## Task 8: 合规体系 — 审核 Server Actions & DAL

**Files:**
- Create: `src/lib/dal/audit.ts`
- Create: `src/app/actions/audit.ts`

- [ ] **Step 1: DAL 查询函数**

```typescript
// src/lib/dal/audit.ts
// - listPendingAudits(orgId, filters?) → 待审列表
// - getAuditRecord(auditId) → 单条审核详情
// - getAuditHistory(orgId, contentId) → 内容的审核历史
// - getAuditStats(orgId) → 审核统计（通过率、平均时长等）
// - getTrailLogs(orgId, contentId) → 全流程留痕日志
// - getAuditRules(orgId, scenarioKey?) → 获取审核规则
// - getSensitiveWords(orgId) → 获取敏感词库
```

- [ ] **Step 2: Server Actions**

```typescript
// src/app/actions/audit.ts
// - createAuditRecord(input) → 创建审核记录
// - approveAudit(auditId, comment?) → 通过审核
// - rejectAudit(auditId, comment, issues) → 退回
// - updateAuditRules(orgId, rules) → 更新审核规则
// - addSensitiveWords(orgId, words) → 添加敏感词
// - logTrailEntry(input) → 记录留痕日志
```

- [ ] **Step 3: 验证提交**

```bash
git commit -m "feat: add audit DAL and server actions"
```

---

## Task 9: 合规体系 — 审核中心页面（列表 + 统计）

**Files:**
- Create: `src/app/(dashboard)/audit-center/page.tsx`
- Create: `src/app/(dashboard)/audit-center/audit-center-client.tsx`

- [ ] **Step 1: 审核中心列表页**

布局：
- 顶部统计卡片（待审数/今日通过/今日退回/平均审核时长）
- 筛选栏（场景/员工/阶段/状态）
- 待审列表（按紧急度排序）
- 每行显示：内容标题、场景、阶段（初审/复审/终审）、审核员工、创建时间、紧急度标签

中文 UI，无边框按钮，亮暗模式兼容。

- [ ] **Step 2: 验证提交**

```bash
git commit -m "feat: add audit center list page with stats and filters"
```

---

## Task 10: 合规体系 — 审核详情页

**Files:**
- Create: `src/app/(dashboard)/audit-center/[id]/page.tsx`
- Create: `src/app/(dashboard)/audit-center/[id]/audit-detail-client.tsx`

- [ ] **Step 1: 审核详情页**

三栏布局：
- **左栏**：内容预览（支持 diff 对比模式，显示修改前后）
- **右栏**：AI 审核报告（6维评分、问题列表、严重等级、修改建议）
- **底部**：审核操作栏（通过/退回按钮 + 审核意见输入）

通过 → 调用 `approveAudit`，退回 → 调用 `rejectAudit`。

- [ ] **Step 2: 全流程时间线视图**

在详情页底部或侧栏显示 `content_trail_logs` 时间线，每个节点可展开查看详情。

- [ ] **Step 3: 验证提交**

```bash
git commit -m "feat: add audit detail page with diff view and timeline"
```

---

## Task 11: 合规体系 — Mission 集成

**Files:**
- Modify: `src/inngest/functions/execute-mission-task.ts`
- Modify: `src/app/actions/missions.ts`

- [ ] **Step 1: Mission task 完成时触发审核**

当 `assignedEmployeeId` 为审核员工（xiaoshen）的 task 完成时：
1. 创建 `audit_record`（stage=review_1, result=auto）
2. 记录 `content_trail_log`
3. 检查该场景的 `audit_rules`：
   - 全自动 → 自动创建 review_2, review_3 记录 → 继续 Mission
   - 需人工 → 设置下一个 task 为 `in_review` → 审核中心可见
   - 快审模式 → 仅 review_1，跳过后续

- [ ] **Step 2: 退回创建修订 task**

审核中心"退回"时，在 Mission 中创建新的修订 task（assignee=内容创作师），`inputContext` 包含审核意见。

- [ ] **Step 3: 验证提交**

```bash
git commit -m "feat: integrate three-tier audit into mission execution pipeline"
```

---

## Task 12: Phase 2B 端到端验证 + 侧边栏入口

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx` — 添加"审核中心"导航项

- [ ] **Step 1: 侧边栏添加审核中心**

在合适的导航组中添加"审核中心"条目，图标使用 `Shield` 或 `ClipboardCheck`，链接到 `/audit-center`。

- [ ] **Step 2: 完整构建验证**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: 功能检查清单**

1. 审核中心页面可访问，显示统计和待审列表
2. 审核详情页显示内容预览、AI 报告、操作栏
3. 通过/退回操作正常写入数据库
4. 全流程时间线显示完整操作记录
5. Mission 中审核 task 完成后自动触发审核流程
6. 退回后创建修订 task

- [ ] **Step 4: 提交**

```bash
git commit -m "chore: complete Phase 2 verification — custom employees + audit system"
```
