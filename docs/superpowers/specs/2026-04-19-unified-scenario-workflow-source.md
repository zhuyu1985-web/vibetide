# 统一场景来源：workflow_templates 作为唯一真相源

> **为什么做这个：** 当前 VibeTide 存在 3 套独立的"场景"系统（首页 employeeScenarios 表 / 任务中心硬编码常量 / workflow_templates 表），数据源互不联动、UI 入口对不上、工作流表未被激活。本 spec 把 `workflow_templates` 升级为所有场景的唯一来源，彻底消除重复。

**日期：** 2026-04-19
**作者：** PM (zhuyu) + Claude
**状态：** 待实现

---

## 1. 设计原则

> **除 AI 员工是固定的（8 个 preset）外，所有"场景"都从工作流派生；因此工作流需要具备分类能力。**

**推论：**

1. `workflow_templates` 表是场景的**唯一真相源**（single source of truth）
2. 首页"场景快捷启动"和任务中心"发起新任务"都从同一个 DAL 读
3. `workflow_templates` 必须有 `category` 分类字段（enum）
4. 员工是固定的，workflow_templates 通过 `defaultTeam` (jsonb EmployeeId[]) 绑定推荐员工
5. 组织可自定义工作流（`isBuiltin=false`），每个 org 创建时自动 copy 一份系统预置（`isBuiltin=true`）

---

## 2. 当前状态快照

| 系统 | 数据源 | 场景数 | 关联工作流表？ | UI 修改路径 |
|------|-------|-------|-------------|-----------|
| 首页场景快捷启动 | `employee_scenarios` 表 (DB) | ~4/员工 | ❌ | `scenario-grid.tsx` |
| 任务中心发起新任务 | `SCENARIO_CONFIG` + `ADVANCED_SCENARIO_CONFIG` (常量) | 10+ | ❌ | `missions-client.tsx` |
| workflow_templates | DB，有 `category` 列但 enum 只 `custom` | 18 seed | — | 无 UI |

**具体字段现状：**

`workflow_templates` ([src/db/schema/workflows.ts:48](src/db/schema/workflows.ts:48))
- id / organizationId / name / description
- `steps` (jsonb: WorkflowStepDef[])
- `category` (workflowCategoryEnum) —— **只有 `custom` 一个值**
- triggerType / isBuiltin / isEnabled
- createdBy / createdAt / updatedAt / lastRunAt / runCount

`employee_scenarios` ([src/db/schema/employee-scenarios.ts](src/db/schema/employee-scenarios.ts))
- id / organizationId / employeeSlug / name / description / icon
- systemInstruction / inputFields (jsonb) / toolsHint (jsonb)
- sortOrder / enabled

`SCENARIO_CONFIG` ([src/lib/constants.ts](src/lib/constants.ts))
- 10 个预置：breaking_news / flash_report / press_conference / deep_report / series_content / social_cyber / viral_interpretation / daily_brief / topic_tracking / custom
- 每个含 key / name / category (news/deep/social/custom) / defaultTeam (EmployeeId[])

`ADVANCED_SCENARIO_CONFIG`（同文件）
- ~5 个：lianghui_coverage / marathon_live / variety_show / daily_brief_all / livelihood_zhongcao
- 含 workflowSteps（WorkflowStepDef[]）

---

## 3. 目标架构

### 3.1 数据流（重构后）

```
                       workflow_templates 表
                       (单一真相源 / 多租户 / builtin+custom)
                              │
               ┌──────────────┼──────────────┐
               ↓              ↓              ↓
         首页 scenario-grid   任务中心     /workflows 列表（可选 P2）
         listWorkflowTemplatesByOrg(orgId, {isBuiltin: true | undefined, category?})
                              │
                              ↓
         用户选择 → 启动 Mission
         mission.scenario = template.id (uuid, 变更: 从 slug 改为 uuid)
         mission.teamSlugs = template.defaultTeam
```

### 3.2 数据模型变更

**A. 扩展 `workflow_templates` 字段**

```sql
ALTER TABLE workflow_templates
  ADD COLUMN icon text,
  ADD COLUMN input_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN default_team jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN app_channel_slug text,
  ADD COLUMN system_instruction text;
```

对应 Drizzle schema 字段：
```ts
icon: text("icon"),
inputFields: jsonb("input_fields").$type<InputFieldDef[]>().default([]),
defaultTeam: jsonb("default_team").$type<EmployeeId[]>().default([]),
appChannelSlug: text("app_channel_slug"),    // nullable；指向 Phase 1 的 9 个 APP 栏目 slug
systemInstruction: text("system_instruction"),  // 从 employee_scenarios 搬过来
```

**注：**
- `isBuiltin` 字段已存在，继续使用
- `organizationId` 必填（不用系统全局 null）—— 每 org 自己一份 builtin 副本，支持后续裁剪
- `appChannelSlug` 可空 —— 内容类场景（新闻/时政/体育/...）可绑，配置类（如 cms_catalog_sync 场景）不绑

**B. 扩展 `workflow_category` enum**

```sql
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'news';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'deep';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'livelihood';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'drama';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'daily_brief';
-- custom 已存在
```

Drizzle：
```ts
export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news", "deep", "social", "advanced",
  "livelihood", "podcast", "drama", "daily_brief",
  "custom",
]);
```

**C. 删除 `employee_scenarios` 表**

```sql
DROP TABLE IF EXISTS employee_scenarios CASCADE;
```

同时删除：
- `src/db/schema/employee-scenarios.ts`
- `src/lib/dal/employee-scenarios.ts`（如存在）
- `src/db/seed.ts` 中 employeeScenarios seed 块（~4 条 xiaolei 数据）

### 3.3 InputFieldDef 类型约束

保留现有类型（从 `src/lib/types.ts:322-338` 搬到 `src/db/types.ts` 或 `src/lib/types.ts` 保留）：

```ts
export interface InputFieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}
```

### 3.4 新 DAL：`src/lib/dal/workflow-templates.ts`

```ts
import { db } from "@/db";
import { workflowTemplates, type WorkflowTemplateRow } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type WorkflowTemplateCategory =
  | "news" | "deep" | "social" | "advanced"
  | "livelihood" | "podcast" | "drama" | "daily_brief" | "custom";

export interface ListFilter {
  category?: WorkflowTemplateCategory;
  isBuiltin?: boolean;
  isEnabled?: boolean;       // default true
}

export async function listWorkflowTemplatesByOrg(
  organizationId: string,
  filter: ListFilter = {},
): Promise<WorkflowTemplateRow[]> { /* ... */ }

export async function getWorkflowTemplateById(
  id: string,
): Promise<WorkflowTemplateRow | null> { /* ... */ }

export async function createWorkflowTemplate(
  organizationId: string,
  input: CreateWorkflowTemplateInput,
): Promise<WorkflowTemplateRow> { /* ... */ }

export async function updateWorkflowTemplate(
  id: string,
  patch: UpdateWorkflowTemplateInput,
): Promise<void> { /* ... */ }

export async function softDeleteWorkflowTemplate(id: string): Promise<void> {
  // set isEnabled=false instead of hard delete
}

/** Org 创建时 copy 一份 builtin 副本 */
export async function seedBuiltinTemplatesForOrg(organizationId: string): Promise<void> { /* ... */ }
```

---

## 4. 数据迁移

### 4.1 Seed 迁移映射

**来源 1：`SCENARIO_CONFIG`**（10 个，`src/lib/constants.ts`）

| Constants key | 迁入 category | defaultTeam (保持) | 映射到 appChannelSlug |
|--------------|--------------|------------------|--------------------|
| breaking_news | news | xiaolei/xiaowen/xiaoshen/xiaofa | app_news |
| flash_report | news | xiaolei/xiaowen | app_news |
| press_conference | news | xiaolei/xiaoce/xiaowen/xiaoshen | app_news |
| deep_report | deep | 6人协同 | app_news |
| series_content | deep | 6人协同 | app_news |
| social_cyber | social | 3人 | app_livelihood_tandian |
| viral_interpretation | social | 3人 | app_livelihood_zhongcao |
| daily_brief | daily_brief | 全员 | app_home |
| topic_tracking | deep | 3人 | app_news |
| custom | custom | 动态 | (null) |

**来源 2：`ADVANCED_SCENARIO_CONFIG`**（~5 个）

| key | category | appChannelSlug |
|-----|---------|--------------|
| lianghui_coverage | advanced | app_politics |
| marathon_live | advanced | app_sports |
| variety_show | advanced | app_variety |
| daily_brief_all | daily_brief | app_home |
| livelihood_zhongcao | livelihood | app_livelihood_zhongcao |

**来源 3：`employee_scenarios` 现有 seed**（xiaolei 4 个）

→ 作为 `category=news, defaultTeam=[xiaolei], isBuiltin=true, systemInstruction` 保留的工作流；与 SCENARIO_CONFIG 里的"话题追踪""热点分析"去重（若名字重复，合并字段）。

**来源 4：`workflow_templates` 当前 18 条 seed**

→ 保留。审查每条：
- 若它与某个 SCENARIO_CONFIG key 同义 → 补 `category / icon / inputFields / defaultTeam / appChannelSlug` 5 个字段
- 若是独立的后台编排 → 标 `category=custom, isBuiltin=true, appChannelSlug=null`

### 4.2 Seed 实施步骤

1. 在 `src/db/seed.ts` 新增 `WORKFLOW_TEMPLATES_BUILTIN_SEED` 数组（合并上述 4 个来源的**去重**清单）
2. 删除旧的 `EMPLOYEE_SCENARIOS_SEED` 块
3. 在 `seedForOrganization(orgId)` 函数中调用 `seedBuiltinTemplatesForOrg(orgId)` —— 对每个组织 upsert 一份 builtin 副本（`onConflictDoUpdate` on `[organizationId, name]`）

### 4.3 在途数据处理

**现有 org 怎么办？** 对已存在的 org，运行 `npm run db:seed` 时：
- 新的 `workflow_templates` builtin 行会被 `onConflictDoNothing` 插入
- `employee_scenarios` 表被 DROP 前需先 export 现有自定义行（只有 seed 数据，无用户创建，可直接 DROP）

---

## 5. UI 改造

### 5.1 首页场景网格 — [src/components/home/scenario-grid.tsx](src/components/home/scenario-grid.tsx)

**Before:**
```tsx
// 从 SCENARIO_CONFIG 常量读取
import { SCENARIO_CONFIG, ADVANCED_SCENARIO_KEYS } from "@/lib/constants";
```

**After:**
```tsx
// 从 props 接收（page.tsx server 组件查 DAL 传入）
interface Props {
  workflows: WorkflowTemplateRow[];  // listWorkflowTemplatesByOrg(orgId, { isBuiltin: true })
  currentEmployeeSlug?: EmployeeId;
}

// 按 defaultTeam 过滤（若指定了员工）
const filtered = currentEmployeeSlug
  ? workflows.filter(w => w.defaultTeam.includes(currentEmployeeSlug))
  : workflows;
```

### 5.2 首页 server 组件 — [src/app/(dashboard)/home/page.tsx](src/app/(dashboard)/home/page.tsx)

**Before:** `getAllScenariosByOrg()` 读 employee_scenarios
**After:** `listWorkflowTemplatesByOrg(orgId, { isBuiltin: true, isEnabled: true })`

### 5.3 任务中心发起新任务 — [src/app/(dashboard)/missions/missions-client.tsx](src/app/(dashboard)/missions/missions-client.tsx:225)

**Before:**
```tsx
import { SCENARIO_CONFIG, SCENARIO_CATEGORIES } from "@/lib/constants";

// Tab 按硬编码 category
{SCENARIO_CATEGORIES.map(cat => (
  <TabsTrigger value={cat.key}>{cat.name}</TabsTrigger>
))}
```

**After:**
```tsx
// 从 props 接收 workflows，按 category 分组
interface Props {
  workflows: WorkflowTemplateRow[];   // 同一个 DAL
}

const byCategory = groupBy(workflows, w => w.category);
const tabs = Object.keys(byCategory).sort(CATEGORY_ORDER);
```

### 5.4 场景详情 Sheet — [src/components/home/scenario-detail-sheet.tsx](src/components/home/scenario-detail-sheet.tsx)

- `inputFields` 从 workflow.inputFields 读
- `systemInstruction` 从 workflow.systemInstruction 读
- `defaultTeam` 显示为头像列表
- "启动任务" 按钮 → 创建 mission 时传 `scenario: workflow.id`（uuid）、`teamSlugs: workflow.defaultTeam`

### 5.5 Mission schema 微调

检查 `src/db/schema/missions.ts`：
- 若 `mission.scenario` 是 text (slug) → 需要同时支持传 uuid（workflow template id）
- 新增字段 `workflowTemplateId: uuid references workflowTemplates.id nullable` 更明确
- **推荐方案：** 新增 `workflowTemplateId` 可空 FK，旧 `scenario` 字段保留（作为 display label 缓存）

---

## 6. 代码删除清单

执行后删除（`git grep` 确认零引用后）：

1. **常量：** `src/lib/constants.ts` 中
   - `SCENARIO_CONFIG`
   - `ADVANCED_SCENARIO_CONFIG`
   - `SCENARIO_CATEGORIES`
   - `ADVANCED_SCENARIO_KEYS`
2. **Schema：** `src/db/schema/employee-scenarios.ts`（整文件）
3. **DAL：** `src/lib/dal/employee-scenarios.ts`（如存在）
4. **类型：** `ScenarioCardData` in `src/lib/types.ts:322-338`（替换为 `WorkflowTemplateRow`）
5. **Seed：** `src/db/seed.ts` 的 `EMPLOYEE_SCENARIOS_SEED` 块
6. **SQL migration：** 生成 `DROP TABLE employee_scenarios`

---

## 7. 测试策略

1. **DAL 单元测试：** `src/lib/dal/__tests__/workflow-templates.test.ts`
   - listWorkflowTemplatesByOrg with filter combinations
   - seedBuiltinTemplatesForOrg 幂等
   - createWorkflowTemplate / update / softDelete
2. **Seed 冒烟：** 跑 `npm run db:seed`，断言：
   - workflow_templates.count(isBuiltin=true) ≥ 14（10 + 5 - dedup）
   - 每行 category 非 null
   - employee_scenarios 表已不存在
3. **UI 冒烟（手动）：**
   - `/home` 首页：场景网格显示 builtin workflows
   - `/missions` 发起新任务：Tab 按 category 分，每 Tab 有对应工作流
   - 两个入口显示的**总数一致**（可互相对照）
4. **类型编译：** `npx tsc --noEmit` zero error
5. **全量回归：** `npm run test` 所有测试绿

---

## 8. 迁移风险 & rollout

| 风险 | 缓解 |
|------|------|
| 已有 mission 的 `scenario` 字段是旧 slug，引用删除的常量 | 保留 mission.scenario text 字段做 display cache；不做回溯迁移（影响低） |
| 现网 org 未执行 db:seed 时首页会空 | seed 脚本在 updateSession 中懒触发；或给每个 org 加 backfill 脚本 |
| employee_scenarios DROP 会丢数据 | 当前 seed 数据只 4 条，无用户创建；DROP 前执行 `pg_dump employee_scenarios` 备份到 `docs/migration-backup/` |
| 旧常量删除后文档/注释里引用失效 | grep 检查：除代码外 .md 里有提到也要改 |

**Rollout 顺序：**
1. Schema migration（扩字段 + 扩 enum）
2. Seed 数据迁移 + DAL 实现
3. UI 改造（两个入口）
4. 常量 + DAL + schema 文件删除
5. employee_scenarios DROP migration

---

## 9. Out of scope（本 spec 不做）

- `/workflows` 列表/详情/编辑 UI —— Phase 2 再做
- 工作流多对多员工关联表 —— 当前用 jsonb `defaultTeam` 已足够
- 工作流版本管理 —— Phase 2
- 跨 org 共享工作流模板市场 —— Phase 3+
- **Track B：Skill MD 按 baoyu-skills 规范重写** —— 本 spec 完成后单独 spec

---

## 10. Acceptance Criteria

- [ ] `workflow_templates` 有 `icon / inputFields / defaultTeam / appChannelSlug / systemInstruction` 5 个新列
- [ ] `workflowCategoryEnum` 有 9 个值
- [ ] `employee_scenarios` 表已 DROP
- [ ] `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` / `SCENARIO_CATEGORIES` / `ADVANCED_SCENARIO_KEYS` 4 个常量已删
- [ ] `npm run db:seed` 后，test org 的 `workflow_templates` 行数 ≥ 14 且每行 category 非 null
- [ ] 首页场景网格从 workflow_templates 读取
- [ ] 任务中心发起新任务 Sheet 从 workflow_templates 读取
- [ ] 两个入口显示的场景数据**同源**（point to same DAL call）
- [ ] `npx tsc --noEmit` zero error
- [ ] `npm run test` 全绿
