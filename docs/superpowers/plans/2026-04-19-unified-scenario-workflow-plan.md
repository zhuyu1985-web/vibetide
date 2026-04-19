# B.1 实施 Plan：统一场景来源（workflow_templates as SSOT）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `workflow_templates` 升级为 VibeTide 所有"场景"的唯一真相源，让首页"场景快捷启动"和任务中心"发起新任务"两个入口**数据同源**，为 B.2 的 20+ 下游消费者迁移打下基础。

**Architecture:** 扩 `workflow_templates` schema + enum；新 DAL `listWorkflowTemplatesByOrg`；seed 迁移 SCENARIO_CONFIG(10) / ADVANCED_SCENARIO_CONFIG(6) / employeeScenarios.xiaolei(5)；首页 + 任务中心两个 UI 入口一次性切换；`mission.scenario` slug **保持不变**（零侵入 20+ 下游），新增 `workflowTemplateId` FK 做双写。

**Tech Stack:** Next.js 16 + React 19 + TypeScript strict / Drizzle ORM 0.45 + Supabase PostgreSQL / Vitest / subagent-driven-development execution

**Spec reference:** [docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md](docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md) §1-§12

---

## 任务一览

### Section A — Schema & Migrations (Tasks 1-3)
- [ ] Task 1: workflow_category enum 扩展（非事务 migration）
- [ ] Task 2: workflow_templates 新增 6 列 + 2 partial unique indexes + missions.workflowTemplateId FK
- [ ] Task 3: Drizzle schema 同步 + types 重生成

### Section B — DAL 基础设施 (Tasks 4-7)
- [ ] Task 4: workflow-templates.ts 脚手架 + `listWorkflowTemplatesByOrg`
- [ ] Task 5: `getWorkflowTemplateById` + `getWorkflowTemplateByLegacyKey`
- [ ] Task 6: `createWorkflowTemplate` / `updateWorkflowTemplate` / `softDisableWorkflowTemplate`
- [ ] Task 7: `seedBuiltinTemplatesForOrg` 双分支 upsert

### Section C — Slug 工具 & 常量 (Tasks 8-9)
- [ ] Task 8: `templateToScenarioSlug` 纯函数 + 单测
- [ ] Task 9: 新增 `ORDERED_CATEGORIES` + 标记老常量 @deprecated

### Section D — Seed 迁移 (Tasks 10-12)
- [ ] Task 10: SCENARIO_CONFIG(10) + ADVANCED_SCENARIO_CONFIG(6) → workflow_templates seed
- [ ] Task 11: employeeScenarios.xiaolei(5) → seed + 停写 employee_scenarios
- [ ] Task 12: 补齐现有 templatesData 6 条字段 + `npm run db:seed` 冒烟 ≥27

### Section E — Mission 双写 (Tasks 13-14)
- [ ] Task 13: startMission action/core 接受 `workflowTemplateId` + 双写
- [ ] Task 14: 下游 `SCENARIO_CONFIG[mission.scenario]` 兜底补丁（~5 处）

### Section F — UI 改造 (Tasks 15-18)
- [ ] Task 15: /home/page.tsx server 组件 → listWorkflowTemplatesByOrg
- [ ] Task 16: scenario-grid.tsx 受控组件化
- [ ] Task 17: /missions/page.tsx server 组件 → listWorkflowTemplatesByOrg
- [ ] Task 18: missions-client.tsx "发起新任务" Sheet 改造

### Section G — 验收 (Tasks 19-21)
- [ ] Task 19: DAL 两入口同源断言单测
- [ ] Task 20: 手动 UI 冒烟 + 修任何问题
- [ ] Task 21: 全量回归（tsc + tests + build）+ CLAUDE.md 更新 + grep 验收

---

# Section A — Schema & Migrations

## Task 1: workflow_category enum 扩展（非事务 migration）

**目的：** 给 `workflow_category` enum 加 7 个新值（deep / social / advanced / livelihood / podcast / drama / daily_brief）。PG `ALTER TYPE ... ADD VALUE` 不能跑在事务块里，必须手写 migration。

**Files:**
- Create: `supabase/migrations/20260419000001_workflow_category_add_values.sql`

- [ ] **Step 1.1: 创建非事务 migration 文件**

```sql
-- supabase: no-transaction
-- 原因：PG `ALTER TYPE ... ADD VALUE` 不能在事务内执行。

ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'deep';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'livelihood';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'drama';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'daily_brief';
```

- [ ] **Step 1.2: 应用 migration**

```bash
# 推荐：直接执行 SQL（避免 drizzle-kit 自动包事务）
psql $DATABASE_URL -f supabase/migrations/20260419000001_workflow_category_add_values.sql
```

**预期：** 7 次 `ALTER TYPE` 无错；若某值已存在则 `IF NOT EXISTS` 静默跳过。

- [ ] **Step 1.3: 验证 enum 12 值**

```bash
psql $DATABASE_URL -c "SELECT unnest(enum_range(NULL::workflow_category))"
# 预期 12 行：news/video/analytics/distribution/custom + 新 7 值
```

- [ ] **Step 1.4: 提交**

```bash
git add supabase/migrations/20260419000001_workflow_category_add_values.sql
git commit -m "feat(workflow-unify/p1): add 7 new workflow_category enum values"
```

---

## Task 2: workflow_templates 新增 6 列 + 2 partial unique indexes + missions FK

**Files:**
- Create: `supabase/migrations/20260419000002_workflow_templates_unify_scenario.sql`

- [ ] **Step 2.1: 创建 migration 文件**

```sql
-- workflow_templates 扩列
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS input_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_team jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS app_channel_slug text,
  ADD COLUMN IF NOT EXISTS system_instruction text,
  ADD COLUMN IF NOT EXISTS legacy_scenario_key text;

-- 两个互补的 partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_legacy_key_uidx
  ON workflow_templates (organization_id, legacy_scenario_key)
  WHERE legacy_scenario_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_builtin_name_uidx
  ON workflow_templates (organization_id, name)
  WHERE is_builtin = true AND legacy_scenario_key IS NULL;

-- missions 扩 FK
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS workflow_template_id uuid
    REFERENCES workflow_templates(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS missions_workflow_template_id_idx
  ON missions (workflow_template_id)
  WHERE workflow_template_id IS NOT NULL;
```

- [ ] **Step 2.2: 应用 migration**

```bash
psql $DATABASE_URL -f supabase/migrations/20260419000002_workflow_templates_unify_scenario.sql
```

- [ ] **Step 2.3: 验证 schema**

```bash
psql $DATABASE_URL -c "\d workflow_templates" | grep -E "icon|input_fields|default_team|app_channel_slug|system_instruction|legacy_scenario_key"
# 预期 6 行匹配

psql $DATABASE_URL -c "\d missions" | grep workflow_template_id
# 预期 1 行匹配

psql $DATABASE_URL -c "\di workflow_templates*"
# 预期看到两个新 unique index
```

- [ ] **Step 2.4: 提交**

```bash
git add supabase/migrations/20260419000002_workflow_templates_unify_scenario.sql
git commit -m "feat(workflow-unify/p1): workflow_templates add 6 cols + 2 partial uniqs + missions FK"
```

---

## Task 3: Drizzle schema 同步

**Files:**
- Modify: `src/db/schema/enums.ts`（扩 workflowCategoryEnum）
- Modify: `src/db/schema/workflows.ts`（扩 workflow_templates 6 字段 + unique index 声明）
- Modify: `src/db/schema/missions.ts`（加 workflowTemplateId FK）

- [ ] **Step 3.1: 更新 enum**

在 [src/db/schema/enums.ts:523](src/db/schema/enums.ts:523) 的 `workflowCategoryEnum` 改为：

```ts
export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news",
  "video",
  "analytics",
  "distribution",
  "deep",
  "social",
  "advanced",
  "livelihood",
  "podcast",
  "drama",
  "daily_brief",
  "custom",
]);
```

- [ ] **Step 3.2: 更新 workflow_templates schema**

在 [src/db/schema/workflows.ts:48-74](src/db/schema/workflows.ts:48) 的 `workflowTemplates` 表定义中追加字段：

```ts
icon: text("icon"),
inputFields: jsonb("input_fields").$type<InputFieldDef[]>().default([]),
defaultTeam: jsonb("default_team").$type<string[]>().default([]),
appChannelSlug: text("app_channel_slug"),
systemInstruction: text("system_instruction"),
legacyScenarioKey: text("legacy_scenario_key"),
```

同时在 table 定义的 third-arg unique index 块（若存在）或 table builder callback 里声明两个 partial unique index（Drizzle 0.45 支持）。具体查看文件现有风格；若不便声明 partial index，可以仅在 SQL migration 维护索引，Drizzle schema 里省略声明（migration 已在 Task 2 建好）。

顶部 import：
```ts
import type { InputFieldDef } from "@/lib/types";
```

- [ ] **Step 3.3: 更新 missions schema**

在 [src/db/schema/missions.ts](src/db/schema/missions.ts) 的 `missions` 表加字段：

```ts
workflowTemplateId: uuid("workflow_template_id")
  .references(() => workflowTemplates.id, { onDelete: "restrict" }),
```

顶部加必要的 import（若未存在）：
```ts
import { workflowTemplates } from "./workflows";
```

- [ ] **Step 3.4: 类型编译 + 提交**

```bash
npx tsc --noEmit
# 预期 0 错误
git add src/db/schema/enums.ts src/db/schema/workflows.ts src/db/schema/missions.ts
git commit -m "feat(workflow-unify/p1): sync Drizzle schema for workflow_templates + missions FK"
```

---

# Section B — DAL 基础设施

## Task 4: workflow-templates DAL 脚手架 + listWorkflowTemplatesByOrg

**Files:**
- Create: `src/lib/dal/workflow-templates.ts`
- Create: `src/lib/dal/__tests__/workflow-templates.test.ts`

- [ ] **Step 4.1: 写 listWorkflowTemplatesByOrg 失败测试**

Create [src/lib/dal/__tests__/workflow-templates.test.ts](src/lib/dal/__tests__/workflow-templates.test.ts)：

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { organizations, workflowTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listWorkflowTemplatesByOrg } from "../workflow-templates";

describe("DAL workflow-templates", () => {
  const orgId = randomUUID();

  beforeAll(async () => {
    const stamp = Date.now();
    await db.insert(organizations)
      .values({ id: orgId, name: "test-org-wf", slug: `test-wf-${stamp}` })
      .onConflictDoNothing();

    // 3 rows：2 builtin (news + deep) + 1 custom
    await db.insert(workflowTemplates).values([
      { organizationId: orgId, name: "builtin-news-1", category: "news", isBuiltin: true, isEnabled: true, defaultTeam: ["xiaolei"], steps: [] },
      { organizationId: orgId, name: "builtin-deep-1", category: "deep", isBuiltin: true, isEnabled: true, defaultTeam: ["xiaoce", "xiaowen"], steps: [] },
      { organizationId: orgId, name: "custom-1", category: "custom", isBuiltin: false, isEnabled: true, defaultTeam: [], steps: [] },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  describe("listWorkflowTemplatesByOrg", () => {
    it("returns all enabled templates when no filter", async () => {
      const rows = await listWorkflowTemplatesByOrg(orgId);
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it("filters by category", async () => {
      const rows = await listWorkflowTemplatesByOrg(orgId, { category: "news" });
      expect(rows.every(r => r.category === "news")).toBe(true);
    });

    it("filters by isBuiltin", async () => {
      const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
      expect(rows.every(r => r.isBuiltin === true)).toBe(true);
    });

    it("filters by employeeSlug (defaultTeam contains)", async () => {
      const rows = await listWorkflowTemplatesByOrg(orgId, { employeeSlug: "xiaolei" });
      expect(rows.every(r => r.defaultTeam?.includes("xiaolei"))).toBe(true);
    });

    it("combined filter: isBuiltin + category", async () => {
      const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true, category: "deep" });
      expect(rows.every(r => r.isBuiltin && r.category === "deep")).toBe(true);
    });
  });
});
```

- [ ] **Step 4.2: 运行 FAIL**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
```

预期：FAIL with "Cannot find module '../workflow-templates'"

- [ ] **Step 4.3: 实现 listWorkflowTemplatesByOrg**

Create [src/lib/dal/workflow-templates.ts](src/lib/dal/workflow-templates.ts)：

```ts
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { and, eq, sql, type SQL } from "drizzle-orm";

export type WorkflowTemplateCategory =
  | "news" | "video" | "analytics" | "distribution"
  | "deep" | "social" | "advanced"
  | "livelihood" | "podcast" | "drama" | "daily_brief" | "custom";

export interface ListFilter {
  category?: WorkflowTemplateCategory;
  isBuiltin?: boolean;
  isEnabled?: boolean;        // default true
  appChannelSlug?: string;
  employeeSlug?: string;      // defaultTeam 含此 slug
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export async function listWorkflowTemplatesByOrg(
  organizationId: string,
  filter: ListFilter = {},
  options: ListOptions = {},
) {
  const conds: SQL[] = [eq(workflowTemplates.organizationId, organizationId)];

  conds.push(eq(workflowTemplates.isEnabled, filter.isEnabled ?? true));

  if (filter.category !== undefined) {
    conds.push(eq(workflowTemplates.category, filter.category));
  }
  if (filter.isBuiltin !== undefined) {
    conds.push(eq(workflowTemplates.isBuiltin, filter.isBuiltin));
  }
  if (filter.appChannelSlug !== undefined) {
    conds.push(eq(workflowTemplates.appChannelSlug, filter.appChannelSlug));
  }
  if (filter.employeeSlug !== undefined) {
    conds.push(sql`${workflowTemplates.defaultTeam} @> ${JSON.stringify([filter.employeeSlug])}::jsonb`);
  }

  let q = db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(workflowTemplates.createdAt);

  if (options.limit !== undefined) q = q.limit(options.limit);
  if (options.offset !== undefined) q = q.offset(options.offset);

  return await q;
}
```

- [ ] **Step 4.4: 运行 PASS**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
# 预期 5 test 通过
```

- [ ] **Step 4.5: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/lib/dal/workflow-templates.ts src/lib/dal/__tests__/workflow-templates.test.ts
git commit -m "feat(workflow-unify/p1): DAL listWorkflowTemplatesByOrg with 5 filter combos"
```

---

## Task 5: getWorkflowTemplateById + getWorkflowTemplateByLegacyKey

**Files:**
- Modify: `src/lib/dal/workflow-templates.ts`
- Modify: `src/lib/dal/__tests__/workflow-templates.test.ts`

- [ ] **Step 5.1: 追加测试（FAIL）**

在测试文件末尾（`afterAll` 之前）追加：

```ts
describe("getWorkflowTemplateById", () => {
  it("returns row by id", async () => {
    const [row] = await db
      .select()
      .from(workflowTemplates)
      .where(and(
        eq(workflowTemplates.organizationId, orgId),
        eq(workflowTemplates.name, "builtin-news-1"),
      ))
      .limit(1);
    const result = await getWorkflowTemplateById(row.id);
    expect(result?.name).toBe("builtin-news-1");
  });

  it("returns null for unknown id", async () => {
    const result = await getWorkflowTemplateById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

describe("getWorkflowTemplateByLegacyKey", () => {
  it("returns row matching legacy_scenario_key for org", async () => {
    await db.update(workflowTemplates)
      .set({ legacyScenarioKey: "breaking_news" })
      .where(eq(workflowTemplates.name, "builtin-news-1"));

    const result = await getWorkflowTemplateByLegacyKey(orgId, "breaking_news");
    expect(result?.name).toBe("builtin-news-1");
  });

  it("returns null when legacy key not found", async () => {
    const result = await getWorkflowTemplateByLegacyKey(orgId, "nonexistent_key");
    expect(result).toBeNull();
  });
});
```

顶部加 import：
```ts
import { getWorkflowTemplateById, getWorkflowTemplateByLegacyKey } from "../workflow-templates";
```

- [ ] **Step 5.2: 实现**

在 `src/lib/dal/workflow-templates.ts` 追加：

```ts
export async function getWorkflowTemplateById(id: string) {
  const [row] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, id))
    .limit(1);
  return row ?? null;
}

export async function getWorkflowTemplateByLegacyKey(
  organizationId: string,
  legacyKey: string,
) {
  const [row] = await db
    .select()
    .from(workflowTemplates)
    .where(and(
      eq(workflowTemplates.organizationId, organizationId),
      eq(workflowTemplates.legacyScenarioKey, legacyKey),
    ))
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 5.3: PASS + 提交**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
npx tsc --noEmit
git add src/lib/dal/workflow-templates.ts src/lib/dal/__tests__/workflow-templates.test.ts
git commit -m "feat(workflow-unify/p1): DAL getWorkflowTemplateById + getByLegacyKey"
```

---

## Task 6: createWorkflowTemplate / updateWorkflowTemplate / softDisableWorkflowTemplate

**Files:**
- Modify: `src/lib/dal/workflow-templates.ts`
- Modify: `src/lib/dal/__tests__/workflow-templates.test.ts`

- [ ] **Step 6.1: 追加测试**

```ts
describe("createWorkflowTemplate", () => {
  it("inserts a custom template", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-create-1",
      description: "test",
      category: "custom",
      steps: [],
      defaultTeam: ["xiaoshu"],
    });
    expect(created.id).toBeTruthy();
    expect(created.isBuiltin).toBe(false);
  });
});

describe("updateWorkflowTemplate", () => {
  it("updates fields on existing row", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-update-1", category: "custom", steps: [],
    });
    await updateWorkflowTemplate(created.id, { description: "updated-desc" });
    const fetched = await getWorkflowTemplateById(created.id);
    expect(fetched?.description).toBe("updated-desc");
  });
});

describe("softDisableWorkflowTemplate", () => {
  it("sets isEnabled=false", async () => {
    const created = await createWorkflowTemplate(orgId, {
      name: "test-soft-1", category: "custom", steps: [],
    });
    await softDisableWorkflowTemplate(created.id);
    const fetched = await getWorkflowTemplateById(created.id);
    expect(fetched?.isEnabled).toBe(false);
  });
});
```

顶部 import：
```ts
import { createWorkflowTemplate, updateWorkflowTemplate, softDisableWorkflowTemplate } from "../workflow-templates";
```

- [ ] **Step 6.2: 实现**

```ts
export interface CreateWorkflowTemplateInput {
  name: string;
  description?: string;
  category: WorkflowTemplateCategory;
  steps: unknown[];   // WorkflowStepDef[]（保持与现有 schema 一致）
  isBuiltin?: boolean;   // default false
  icon?: string;
  inputFields?: unknown[];
  defaultTeam?: string[];
  appChannelSlug?: string;
  systemInstruction?: string;
  legacyScenarioKey?: string;
  triggerType?: "manual" | "scheduled";
  triggerConfig?: Record<string, unknown>;
  createdBy?: string;
}

export async function createWorkflowTemplate(
  organizationId: string,
  input: CreateWorkflowTemplateInput,
) {
  const [row] = await db
    .insert(workflowTemplates)
    .values({
      organizationId,
      name: input.name,
      description: input.description,
      category: input.category,
      steps: input.steps as never,
      isBuiltin: input.isBuiltin ?? false,
      isEnabled: true,
      icon: input.icon,
      inputFields: (input.inputFields ?? []) as never,
      defaultTeam: (input.defaultTeam ?? []) as never,
      appChannelSlug: input.appChannelSlug,
      systemInstruction: input.systemInstruction,
      legacyScenarioKey: input.legacyScenarioKey,
      triggerType: input.triggerType ?? "manual",
      triggerConfig: input.triggerConfig ?? {},
      createdBy: input.createdBy,
    })
    .returning();
  return row;
}

export interface UpdateWorkflowTemplateInput {
  name?: string;
  description?: string;
  category?: WorkflowTemplateCategory;
  icon?: string;
  inputFields?: unknown[];
  defaultTeam?: string[];
  appChannelSlug?: string | null;
  systemInstruction?: string | null;
  isEnabled?: boolean;
  steps?: unknown[];
}

export async function updateWorkflowTemplate(
  id: string,
  patch: UpdateWorkflowTemplateInput,
) {
  await db
    .update(workflowTemplates)
    .set({ ...patch, updatedAt: new Date() } as never)
    .where(eq(workflowTemplates.id, id));
}

export async function softDisableWorkflowTemplate(id: string) {
  await updateWorkflowTemplate(id, { isEnabled: false });
}
```

- [ ] **Step 6.3: PASS + 提交**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
npx tsc --noEmit
git add src/lib/dal/workflow-templates.ts src/lib/dal/__tests__/workflow-templates.test.ts
git commit -m "feat(workflow-unify/p1): DAL create/update/softDisable workflowTemplate"
```

---

## Task 7: seedBuiltinTemplatesForOrg 双分支 upsert

**目的：** 幂等 upsert builtin templates。对有 legacyScenarioKey 的用 `(org_id, legacy_key)` partial index 冲突；对无 legacyScenarioKey 的（旧 templatesData）用 `(org_id, name) WHERE is_builtin` partial index 冲突。

**Files:**
- Modify: `src/lib/dal/workflow-templates.ts`
- Modify: `src/lib/dal/__tests__/workflow-templates.test.ts`

- [ ] **Step 7.1: 追加幂等性测试**

```ts
describe("seedBuiltinTemplatesForOrg", () => {
  const seedList = [
    { name: "seed-news-1", category: "news" as const, legacyScenarioKey: "seed_news_key", defaultTeam: ["xiaolei"], steps: [] },
    { name: "seed-news-2", category: "news" as const, legacyScenarioKey: null, defaultTeam: [], steps: [] },   // 无 legacy key，走 name 索引
  ];

  it("inserts new rows on first run", async () => {
    await seedBuiltinTemplatesForOrg(orgId, seedList);
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    expect(rows.filter(r => r.name.startsWith("seed-news-")).length).toBe(2);
  });

  it("is idempotent on second run (no duplicates)", async () => {
    await seedBuiltinTemplatesForOrg(orgId, seedList);
    const rows = await listWorkflowTemplatesByOrg(orgId, { isBuiltin: true });
    expect(rows.filter(r => r.name.startsWith("seed-news-")).length).toBe(2);
  });

  it("updates fields on re-seed with same key", async () => {
    const updated = [...seedList];
    updated[0] = { ...updated[0], description: "updated-via-seed" };
    await seedBuiltinTemplatesForOrg(orgId, updated);
    const row = await getWorkflowTemplateByLegacyKey(orgId, "seed_news_key");
    expect(row?.description).toBe("updated-via-seed");
  });
});
```

顶部 import：
```ts
import { seedBuiltinTemplatesForOrg } from "../workflow-templates";
```

- [ ] **Step 7.2: 实现**

```ts
export interface BuiltinSeedInput {
  name: string;
  description?: string;
  category: WorkflowTemplateCategory;
  icon?: string;
  inputFields?: unknown[];
  defaultTeam?: string[];
  appChannelSlug?: string;
  systemInstruction?: string;
  legacyScenarioKey: string | null;
  steps: unknown[];
  triggerType?: "manual" | "scheduled";
  triggerConfig?: Record<string, unknown>;
}

export async function seedBuiltinTemplatesForOrg(
  organizationId: string,
  seeds: BuiltinSeedInput[],
): Promise<void> {
  for (const seed of seeds) {
    const baseValues = {
      organizationId,
      name: seed.name,
      description: seed.description ?? null,
      category: seed.category,
      isBuiltin: true,
      isEnabled: true,
      icon: seed.icon ?? null,
      inputFields: (seed.inputFields ?? []) as never,
      defaultTeam: (seed.defaultTeam ?? []) as never,
      appChannelSlug: seed.appChannelSlug ?? null,
      systemInstruction: seed.systemInstruction ?? null,
      legacyScenarioKey: seed.legacyScenarioKey,
      steps: seed.steps as never,
      triggerType: seed.triggerType ?? "manual",
      triggerConfig: (seed.triggerConfig ?? {}) as never,
    };

    const setOnConflict = {
      description: baseValues.description,
      category: baseValues.category,
      icon: baseValues.icon,
      inputFields: baseValues.inputFields,
      defaultTeam: baseValues.defaultTeam,
      appChannelSlug: baseValues.appChannelSlug,
      systemInstruction: baseValues.systemInstruction,
      steps: baseValues.steps,
      triggerType: baseValues.triggerType,
      triggerConfig: baseValues.triggerConfig,
      updatedAt: new Date(),
    };

    if (seed.legacyScenarioKey) {
      // 走 (org_id, legacy_scenario_key) partial index
      await db
        .insert(workflowTemplates)
        .values(baseValues)
        .onConflictDoUpdate({
          target: [workflowTemplates.organizationId, workflowTemplates.legacyScenarioKey],
          targetWhere: sql`${workflowTemplates.legacyScenarioKey} IS NOT NULL`,
          set: setOnConflict,
        });
    } else {
      // 走 (org_id, name) WHERE is_builtin AND legacy_key IS NULL partial index
      await db
        .insert(workflowTemplates)
        .values(baseValues)
        .onConflictDoUpdate({
          target: [workflowTemplates.organizationId, workflowTemplates.name],
          targetWhere: sql`${workflowTemplates.isBuiltin} = true AND ${workflowTemplates.legacyScenarioKey} IS NULL`,
          set: setOnConflict,
        });
    }
  }
}
```

**Note：** Drizzle 0.45 的 `onConflictDoUpdate` 是否支持 `targetWhere` 取决于版本。若不支持，fallback 方案：先 `SELECT` 判断是否存在再 `INSERT` 或 `UPDATE`（两条 SQL）。实施时若 Drizzle API 不支持 targetWhere，切换到 fallback 实现。

- [ ] **Step 7.3: PASS + 提交**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
npx tsc --noEmit
git add src/lib/dal/workflow-templates.ts src/lib/dal/__tests__/workflow-templates.test.ts
git commit -m "feat(workflow-unify/p1): seedBuiltinTemplatesForOrg with dual-partial-index upsert"
```

---

# Section B 完成检查

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
# 预期 13+ tests 全绿（list 5 + getById 2 + byLegacyKey 2 + create 1 + update 1 + softDisable 1 + seed 3 = 15）

npx tsc --noEmit
```

---

# Section C — Slug 工具 & 常量

## Task 8: templateToScenarioSlug 纯函数

**Files:**
- Create: `src/lib/workflow-templates/slug.ts`
- Create: `src/lib/workflow-templates/__tests__/slug.test.ts`

- [ ] **Step 8.1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { templateToScenarioSlug } from "../slug";

describe("templateToScenarioSlug", () => {
  it("returns legacyScenarioKey when set", () => {
    const slug = templateToScenarioSlug({ legacyScenarioKey: "breaking_news", name: "突发新闻" });
    expect(slug).toBe("breaking_news");
  });

  it("generates custom_${nanoid} when legacyScenarioKey null", () => {
    const slug = templateToScenarioSlug({ legacyScenarioKey: null, name: "快讯工作流" });
    expect(slug).toMatch(/^custom_[A-Za-z0-9_-]{6}$/);
  });

  it("returns different slugs on repeated calls for same custom template", () => {
    const a = templateToScenarioSlug({ legacyScenarioKey: null, name: "x" });
    const b = templateToScenarioSlug({ legacyScenarioKey: null, name: "x" });
    expect(a).not.toBe(b);   // nanoid 随机
  });
});
```

- [ ] **Step 8.2: 实现**

```ts
import { nanoid } from "nanoid";

export interface TemplateForSlug {
  legacyScenarioKey: string | null;
  name: string;
}

export function templateToScenarioSlug(template: TemplateForSlug): string {
  if (template.legacyScenarioKey) return template.legacyScenarioKey;
  return `custom_${nanoid(6)}`;
}
```

- [ ] **Step 8.3: PASS + 提交**

```bash
npm run test -- src/lib/workflow-templates/__tests__/slug.test.ts
git add src/lib/workflow-templates/
git commit -m "feat(workflow-unify/p1): templateToScenarioSlug (builtin→legacy, custom→nanoid)"
```

---

## Task 9: 新增 ORDERED_CATEGORIES + 标记老常量 @deprecated

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 9.1: 追加 ORDERED_CATEGORIES**

在 `src/lib/constants.ts` 文件末尾追加：

```ts
/**
 * 场景/工作流 category 在 UI tab 的展示顺序。
 * 顺序=阅读优先级，与 workflowCategoryEnum 的 12 个值一一对应。
 */
export const ORDERED_CATEGORIES = [
  "news",
  "deep",
  "social",
  "advanced",
  "livelihood",
  "podcast",
  "drama",
  "daily_brief",
  "video",
  "analytics",
  "distribution",
  "custom",
] as const;

export type OrderedCategory = (typeof ORDERED_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<OrderedCategory, string> = {
  news: "新闻",
  deep: "深度",
  social: "社交",
  advanced: "专项",
  livelihood: "民生",
  podcast: "播客",
  drama: "短剧",
  daily_brief: "日报",
  video: "视频",
  analytics: "分析",
  distribution: "分发",
  custom: "自定义",
};
```

- [ ] **Step 9.2: 给老常量加 @deprecated**

在 `SCENARIO_CONFIG` / `ADVANCED_SCENARIO_CONFIG` / `SCENARIO_CATEGORIES`（若存在）/ `ADVANCED_SCENARIO_KEYS` 这 4 个 `export const` 之前加 JSDoc：

```ts
/**
 * @deprecated 使用 workflow_templates 表。此常量仅为 B.1 期间的 seed 源和 legacy 兜底，B.2 将删除。
 *             请调用 listWorkflowTemplatesByOrg() 代替。
 */
export const SCENARIO_CONFIG: Record<string, ScenarioConfig> = { ... };
```

- [ ] **Step 9.3: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/lib/constants.ts
git commit -m "feat(workflow-unify/p1): add ORDERED_CATEGORIES + @deprecated old scenario constants"
```

---

# Section D — Seed 迁移

## Task 10: SCENARIO_CONFIG(10) + ADVANCED_SCENARIO_CONFIG(6) → workflow_templates seed

**Files:**
- Create: `src/db/seed-builtin-workflows.ts`（新文件，汇总所有 builtin seed 数据）
- Modify: `src/db/seed.ts`（引用新 seed 文件）

- [ ] **Step 10.1: 创建 builtin seed 数据文件**

Create [src/db/seed-builtin-workflows.ts](src/db/seed-builtin-workflows.ts)：

```ts
import {
  SCENARIO_CONFIG,
  ADVANCED_SCENARIO_CONFIG,
} from "@/lib/constants";
import type { BuiltinSeedInput } from "@/lib/dal/workflow-templates";

/**
 * 从 SCENARIO_CONFIG（10 项）转出 builtin workflow_templates 行。
 * legacyScenarioKey 与 SCENARIO_CONFIG 的 key 对齐（breaking_news / flash_report / ...）
 */
function scenarioConfigToSeeds(): BuiltinSeedInput[] {
  // SCENARIO_CONFIG.category 是 news/deep/social/custom；与 workflow_category enum 对齐
  const CATEGORY_MAP: Record<string, BuiltinSeedInput["category"]> = {
    news: "news",
    deep: "deep",
    social: "social",
    custom: "custom",
  };

  // 建议的 appChannelSlug 映射（见 spec §2.2）
  const APP_CHANNEL_MAP: Record<string, string | undefined> = {
    breaking_news: "app_news",
    flash_report: "app_news",
    press_conference: "app_news",
    deep_report: "app_news",
    series_content: "app_news",
    data_journalism: "app_news",
    video_content: "app_variety",
    // social_media / multi_platform / custom → undefined
  };

  const seeds: BuiltinSeedInput[] = [];
  for (const [key, cfg] of Object.entries(SCENARIO_CONFIG)) {
    seeds.push({
      name: cfg.label,
      description: cfg.description,
      category: CATEGORY_MAP[cfg.category] ?? "custom",
      icon: extractIconName(cfg.icon),
      defaultTeam: cfg.defaultTeam,
      appChannelSlug: APP_CHANNEL_MAP[key],
      systemInstruction: cfg.templateInstruction ?? undefined,
      legacyScenarioKey: key,
      steps: [],   // B.1 不迁移 workflowSteps；B.2 或后续 PR 补
    });
  }
  return seeds;
}

/**
 * 从 ADVANCED_SCENARIO_CONFIG（6 项）转出 builtin。
 */
function advancedScenarioConfigToSeeds(): BuiltinSeedInput[] {
  const CATEGORY_MAP: Record<string, BuiltinSeedInput["category"]> = {
    lianghui_coverage: "advanced",
    marathon_live: "advanced",
    emergency_response: "advanced",
    theme_promotion: "advanced",
    livelihood_service: "livelihood",
    quick_publish: "advanced",
  };
  const APP_CHANNEL_MAP: Record<string, string | undefined> = {
    lianghui_coverage: "app_politics",
    marathon_live: "app_sports",
    emergency_response: "app_news",
    theme_promotion: "app_variety",
    livelihood_service: "app_livelihood_zhongcao",
    // quick_publish → dynamic
  };

  const seeds: BuiltinSeedInput[] = [];
  for (const [key, cfg] of Object.entries(ADVANCED_SCENARIO_CONFIG)) {
    seeds.push({
      name: cfg.name ?? cfg.label ?? key,
      description: cfg.description,
      category: CATEGORY_MAP[key] ?? "advanced",
      icon: extractIconName(cfg.icon),
      defaultTeam: cfg.defaultTeam ?? [],
      appChannelSlug: APP_CHANNEL_MAP[key],
      systemInstruction: cfg.templateInstruction ?? undefined,
      legacyScenarioKey: key,
      steps: cfg.workflowSteps ?? [],
    });
  }
  return seeds;
}

/** 提取 Lucide icon component name（React component → string） */
function extractIconName(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;
  if (typeof icon === "function") {
    const fn = icon as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  return undefined;
}

export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return [
    ...scenarioConfigToSeeds(),
    ...advancedScenarioConfigToSeeds(),
  ];
}
```

- [ ] **Step 10.2: 单元验证（可选：脚本跑一下输出）**

```bash
npx tsx -e "import('./src/db/seed-builtin-workflows').then(m => console.log(JSON.stringify(m.buildBuiltinScenarioSeeds(), null, 2)))"
# 此时仅 16 条（10 SCENARIO_CONFIG + 6 ADVANCED），Task 11 追加 xiaolei 5 条 → 21，Task 12 + 6 → 27+ 达到 spec §11 AC
# 每条 legacyScenarioKey 应非空
```

- [ ] **Step 10.3: 提交**

```bash
npx tsc --noEmit
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(workflow-unify/p1): builtin seed mapper for SCENARIO_CONFIG + ADVANCED_SCENARIO_CONFIG"
```

---

## Task 11: employeeScenarios.xiaolei(5) → seed + 停写 employee_scenarios

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（追加 xiaolei 5 条）
- Modify: `src/db/seed.ts`（删除 employee_scenarios seed 块 + 清表）

- [ ] **Step 11.1: 追加 xiaolei scenarios 函数**

**🚨 强制动作（不可跳过）：** 先 `Read src/db/seed.ts` 第 1300-1478 行，找到 `xiaoleiScenarios = [...]` 数组，把 5 条记录的 `name / description / icon / systemInstruction / inputFields` **逐字完整复制**。**不要使用下方示例里的 "..." 占位符**——示例只示意结构，实际 systemInstruction 是中文详细指令（约 200-500 字），必须原样保留。

在 `src/db/seed-builtin-workflows.ts` 追加：

```ts
interface XiaoleiScenarioData {
  name: string;
  description: string;
  icon: string;
  systemInstruction: string;
  inputFields: unknown[];
  sortOrder: number;
}

// 原 src/db/seed.ts 里的 xiaoleiScenarios 5 条直接搬过来
const XIAOLEI_SCENARIOS: XiaoleiScenarioData[] = [
  {
    name: "全网热点扫描",
    description: "扫描全网热点事件并筛选值得关注的内容",
    icon: "Radar",
    systemInstruction: "...",   // 从原 seed 里 copy 完整 systemInstruction
    inputFields: [
      { name: "domain", label: "关注领域", type: "select", required: true, placeholder: "选择领域", options: ["科技", "财经", "文娱", "体育", "社会"] },
    ],
    sortOrder: 1,
  },
  {
    name: "话题深度追踪",
    description: "针对特定话题深度追踪相关讨论与动态",
    icon: "Search",
    systemInstruction: "...",
    inputFields: [
      { name: "topic", label: "追踪话题", type: "text", required: true, placeholder: "输入话题关键词" },
    ],
    sortOrder: 2,
  },
  {
    name: "平台热榜查看",
    description: "查看指定平台的实时热榜",
    icon: "BarChart3",
    systemInstruction: "...",
    inputFields: [
      { name: "platform", label: "平台", type: "select", required: true, placeholder: "选择平台", options: ["微博", "抖音", "小红书", "知乎", "B站", "今日头条"] },
    ],
    sortOrder: 3,
  },
  {
    name: "热点分析报告",
    description: "生成深度热点分析报告",
    icon: "FileText",
    systemInstruction: "...",
    inputFields: [
      { name: "topic", label: "分析话题", type: "text", required: true, placeholder: "输入要分析的话题" },
      { name: "depth", label: "报告深度", type: "select", required: true, placeholder: "选择深度", options: ["快速摘要", "标准报告", "深度研报"] },
    ],
    sortOrder: 4,
  },
  {
    name: "关键词热度监测",
    description: "监测关键词在各平台的热度变化",
    icon: "Activity",
    systemInstruction: "...",
    inputFields: [
      { name: "keyword", label: "监测关键词", type: "text", required: true, placeholder: "输入关键词" },
      { name: "timeRange", label: "时间范围", type: "select", required: true, placeholder: "选择时间范围", options: ["最近1小时", "最近24小时", "最近7天", "最近30天"] },
    ],
    sortOrder: 5,
  },
];

function xiaoleiScenariosToSeeds(): BuiltinSeedInput[] {
  return XIAOLEI_SCENARIOS.map(s => ({
    name: s.name,
    description: s.description,
    category: "news",
    icon: s.icon,
    inputFields: s.inputFields,
    defaultTeam: ["xiaolei"],
    systemInstruction: s.systemInstruction,
    legacyScenarioKey: `employee_scenario_xiaolei_${slugify(s.name)}`,
    steps: [],
  }));
}

function slugify(name: string): string {
  // 拼音化或简化：取 sortOrder 的简化 slug
  return name.replace(/[^\w]/g, "_").toLowerCase();
}

// 更新 buildBuiltinScenarioSeeds：
export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return [
    ...scenarioConfigToSeeds(),
    ...advancedScenarioConfigToSeeds(),
    ...xiaoleiScenariosToSeeds(),
  ];
}
```

**重要重复：** 示例里的 `"..."` 是占位符。实施时 5 条 systemInstruction 必须是完整中文（从 seed.ts 复制）。提交前 grep `systemInstruction: "\\.\\.\\."` 预期 0 匹配。

- [ ] **Step 11.2: 从 seed.ts 删除 employee_scenarios seed 块**

在 `src/db/seed.ts` 找到 xiaolei scenarios 那个块（约第 1300-1478 行），**整块删除**。

在 `seedForOrganization(org)` 函数开头（在开始插 workflow_templates 之前）追加清表动作：

```ts
// B.1：employee_scenarios 表 seed 停写，数据迁到 workflow_templates
// 清理 org 级历史数据（若之前 seed 过）
await db.delete(schema.employeeScenarios)
  .where(eq(schema.employeeScenarios.organizationId, org.id));
```

- [ ] **Step 11.3: 提交**

```bash
npx tsc --noEmit
git add src/db/seed.ts src/db/seed-builtin-workflows.ts
git commit -m "feat(workflow-unify/p1): migrate xiaolei scenarios to workflow_templates seed + stop writing employee_scenarios"
```

---

## Task 12: 补齐现有 templatesData 6 条字段 + 跑 db:seed 验证

**Files:**
- Modify: `src/db/seed.ts`（现有 `templatesData` 数组 + 调用 seedBuiltinTemplatesForOrg）

- [ ] **Step 12.1: 现有 templatesData 6 条补字段**

找到 `src/db/seed.ts:571-655` 的 `templatesData = [...]` 数组，每一条补齐新字段：

```ts
{
  name: "快讯工作流",
  description: "突发新闻快速响应，15分钟内完成从监控到发布的全流程",
  steps: [...],
  category: "news",           // 补：之前可能是 custom
  icon: "Zap",                // 新
  defaultTeam: ["xiaolei", "xiaowen"],   // 新：推荐团队
  appChannelSlug: "app_news", // 新
  systemInstruction: null,    // 新
  legacyScenarioKey: null,    // 新：旧 templatesData 无 key
  isBuiltin: true,            // 已有字段，保证 true
},
// 其他 5 条类似...
```

6 条建议映射：
- 快讯工作流 → category=news, icon=Zap, defaultTeam=[xiaolei, xiaowen], appChannelSlug=app_news
- 深度报道工作流 → category=deep, icon=FileSearch, defaultTeam=[xiaolei, xiaoce, xiaowen, xiaoshen, xiaofa, xiaoshu], appChannelSlug=app_news
- 每日热点新闻推荐 → category=daily_brief, icon=BarChart3, defaultTeam=[xiaolei], appChannelSlug=app_home
- 金融科技监管日报 → category=news, icon=FileText, defaultTeam=[xiaoce, xiaoshen], appChannelSlug=app_news
- 每周竞争对手情报报告 → category=analytics, icon=BarChart3, defaultTeam=[xiaozi, xiaoshu], appChannelSlug=app_home
- 客户投诉邮件分类 → category=distribution, icon=Mail, defaultTeam=[xiaofa], appChannelSlug=null

- [ ] **Step 12.2: seed.ts 调用 seedBuiltinTemplatesForOrg 导入新 builtin**

找到 `templatesData` 插入循环（`src/db/seed.ts:657-` ），在它**之后**调用：

```ts
import { buildBuiltinScenarioSeeds } from "./seed-builtin-workflows";
import { seedBuiltinTemplatesForOrg } from "@/lib/dal/workflow-templates";

// ... 现有 templatesData 循环完毕 ...

console.log("   Inserting builtin scenarios to workflow_templates...");
const builtinSeeds = buildBuiltinScenarioSeeds();
await seedBuiltinTemplatesForOrg(org.id, builtinSeeds);
console.log(`   Seeded ${builtinSeeds.length} builtin scenarios as workflow_templates`);
```

- [ ] **Step 12.3: 运行 seed + 验证**

```bash
npm run db:seed

# 验证 1：builtin 数量
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;"
# 预期 >= 27

# 验证 2：category 覆盖
psql $DATABASE_URL -c "SELECT category, COUNT(*) FROM workflow_templates WHERE is_builtin=true GROUP BY category ORDER BY category;"
# 预期至少见到：news/deep/social/advanced/livelihood/daily_brief/custom/analytics/distribution

# 验证 3：employee_scenarios 已空（对 test org）
psql $DATABASE_URL -c "SELECT COUNT(*) FROM employee_scenarios;"
# 预期 0

# 验证 4：幂等（跑第二次）
npm run db:seed
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;"
# 预期数量不变
```

- [ ] **Step 12.4: 提交**

```bash
git add src/db/seed.ts
git commit -m "feat(workflow-unify/p1): enrich 6 templatesData rows + call seedBuiltinTemplatesForOrg"
```

---

# Section D 完成检查

```bash
# 1. Seed 冒烟
npm run db:seed
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;" # >= 27

# 2. 类型编译
npx tsc --noEmit

# 3. 单测
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts src/lib/workflow-templates/
```

---

# Section E — Mission 双写

## Task 13: startMission 接受 workflowTemplateId + 双写

**Files:**
- Modify: `src/app/actions/missions.ts:26`（已 grep 确认：这是唯一 startMission export）
- Modify: 对应单测文件（若已存在）

- [ ] **Step 13.1: 读取 startMission 当前签名**

```bash
sed -n '20,60p' src/app/actions/missions.ts
# 查看现有 startMission 签名和 insert values 结构
```

**注意：** `mission-core.ts` / `mission-executor.ts` 本 task **不改**。

- [ ] **Step 13.2: 扩 API 签名**

给 `startMission` input 新增可选字段：

```ts
export interface StartMissionInput {
  // ... 现有字段 ...
  scenario: string;               // slug 保持
  workflowTemplateId?: string;    // 新：可选 FK
  // ...
}
```

实现中：
- 若传了 `workflowTemplateId`，INSERT 时一并写入 `missions.workflow_template_id`
- 若未传但 scenario 能在 `workflow_templates.legacyScenarioKey` 找到，后端自动补 workflowTemplateId
- 若两者都无（纯 custom），workflow_template_id = null

```ts
let wfTemplateId = input.workflowTemplateId;
if (!wfTemplateId && input.scenario) {
  const tmpl = await getWorkflowTemplateByLegacyKey(input.organizationId, input.scenario);
  wfTemplateId = tmpl?.id;
}

const [mission] = await db.insert(missions).values({
  // ... 现有字段 ...
  scenario: input.scenario,
  workflowTemplateId: wfTemplateId ?? null,
}).returning();
```

- [ ] **Step 13.3: 补单测**

Create 或 modify `src/app/actions/__tests__/missions.test.ts`（若项目约定为 inline 测试则调整位置）：

```ts
describe("startMission", () => {
  it("writes workflowTemplateId when provided explicitly", async () => {
    const m = await startMission({ scenario: "breaking_news", workflowTemplateId: tmplId, /*...*/ });
    expect(m.workflowTemplateId).toBe(tmplId);
  });

  it("auto-resolves workflowTemplateId from legacy scenario slug", async () => {
    const m = await startMission({ scenario: "breaking_news", /* no wfTemplateId */ });
    expect(m.workflowTemplateId).toBeTruthy();  // seed 后应找到
  });

  it("leaves workflowTemplateId null when scenario has no template", async () => {
    const m = await startMission({ scenario: "custom_xyz", /*...*/ });
    expect(m.workflowTemplateId).toBeNull();
  });
});
```

- [ ] **Step 13.4: 测试通过 + 提交**

```bash
npm run test -- src/app/actions
npx tsc --noEmit
git add src/app/actions/missions.ts src/app/actions/__tests__/
git commit -m "feat(workflow-unify/p1): startMission dual-write scenario slug + workflowTemplateId"
```

---

## Task 14: 下游 SCENARIO_CONFIG lookup 兜底补丁（~5 处）

**目的：** 避免 B.1 新生成的 `custom_${nanoid}` slug 在下游 `SCENARIO_CONFIG[slug]` lookup 返回 undefined 后 UI 挂掉。

**Files（约 5 处，按 grep 确认）：**
- Modify: `src/app/(dashboard)/missions/missions-client.tsx:259/263/403`
- Modify: `src/app/(dashboard)/missions/[id]/mission-console-client.tsx:187/887/921`

- [ ] **Step 14.1: Grep 扫盲点**

```bash
grep -rn "SCENARIO_CONFIG\[" src/ | grep -v "??\|default" | head -20
# 列出所有"裸" lookup
```

- [ ] **Step 14.2: 逐个加兜底**

对每个 `SCENARIO_CONFIG[scenario]` 或 `SCENARIO_CONFIG[m.scenario]`，改写为：

```ts
import { FileText } from "lucide-react";
import type { ScenarioConfig } from "@/lib/constants";

function makeFallback(m: { scenario: string; title?: string | null }): ScenarioConfig {
  return {
    label: m.title ?? m.scenario ?? "任务",
    category: "custom",
    icon: FileText,
    color: "#6b7280",
    bgColor: "rgba(107,114,128,0.12)",
    description: "",
    defaultPriority: 2,
    defaultTeam: [],
    templateInstruction: "",
  };
}

const scCfg = SCENARIO_CONFIG[m.scenario]
  ?? ADVANCED_SCENARIO_CONFIG[m.scenario as keyof typeof ADVANCED_SCENARIO_CONFIG]
  ?? makeFallback(m);
```

若 `ScenarioConfig` 类型有其他必填字段（如 `name` / `workflowSteps`），按当前 type 定义补齐以确保 tsc 过。

把 fallback 抽成一个 helper（`src/lib/scenario-fallback.ts`）避免重复：

```ts
export function resolveScenarioConfig(mission: { scenario: string; title?: string | null }) {
  return SCENARIO_CONFIG[mission.scenario]
    ?? ADVANCED_SCENARIO_CONFIG[mission.scenario as keyof typeof ADVANCED_SCENARIO_CONFIG]
    ?? makeFallback(mission);
}
```

消费方改为 `resolveScenarioConfig(m)`。

- [ ] **Step 14.3: 验证无裸 lookup**

```bash
grep -rn "SCENARIO_CONFIG\[" src/ | grep -v "??\|fallback\|resolveScenarioConfig"
# 预期 0 条（或仅剩定义处）
```

- [ ] **Step 14.4: 提交**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/missions/ src/lib/scenario-fallback.ts
git commit -m "fix(workflow-unify/p1): add fallback for SCENARIO_CONFIG[mission.scenario] lookups (5 spots)"
```

---

# Section F — UI 改造

## Task 15: /home/page.tsx server 组件改接 DAL

**Files:**
- Modify: `src/app/(dashboard)/home/page.tsx`

- [ ] **Step 15.1: 加 DAL 调用**

找到 `src/app/(dashboard)/home/page.tsx` 中 `getAllScenariosByOrg` 或 `employeeScenarios` 相关读取。替换为：

```ts
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";

// ... 在 server component body ...
const workflows = await listWorkflowTemplatesByOrg(org.id, {
  isBuiltin: true,
  isEnabled: true,
});

return (
  <HomeClient
    // ... 现有 props ...
    workflows={workflows}
  />
);
```

若 page.tsx 此前调用 `getAllScenariosByOrg` 还会读 employeeScenarios：保留该调用但将返回值设为 `[]`（employee_scenarios 现在为空），或直接删除该调用。

- [ ] **Step 15.2: 类型编译**

```bash
npx tsc --noEmit
# 如果 HomeClient 类型不匹配，Task 16 修 client 侧
```

- [ ] **Step 15.3: 提交**

```bash
git add src/app/(dashboard)/home/page.tsx
git commit -m "feat(workflow-unify/p1): /home/page.tsx reads listWorkflowTemplatesByOrg"
```

---

## Task 16: scenario-grid.tsx 受控组件化

**Files:**
- Modify: `src/components/home/scenario-grid.tsx`
- Modify: `src/app/(dashboard)/home/home-client.tsx`（传 workflows prop）

- [ ] **Step 16.1: 修改 home-client.tsx 传 workflows 下去**

在 `HomeClient` 的 props 扩展：

```ts
interface Props {
  // ... 现有 ...
  workflows: WorkflowTemplateRow[];
}
```

在渲染 `<ScenarioGrid />` 处：
```tsx
<ScenarioGrid workflows={workflows} currentEmployeeSlug={selectedEmployee} />
```

- [ ] **Step 16.2: 重写 scenario-grid.tsx**

把 `ADVANCED_SCENARIO_CONFIG` 的硬编码读取移除。改为 props 驱动：

```tsx
"use client";

import { templateToScenarioSlug } from "@/lib/workflow-templates/slug";
// 保留 icon 动态查找工具
import * as Icons from "lucide-react";
import { FileText } from "lucide-react";

interface Props {
  workflows: WorkflowTemplateRow[];
  currentEmployeeSlug?: EmployeeId;
  onStart?: (wf: WorkflowTemplateRow) => void;
}

export function ScenarioGrid({ workflows, currentEmployeeSlug, onStart }: Props) {
  const filtered = currentEmployeeSlug
    ? workflows.filter(w => w.defaultTeam?.includes(currentEmployeeSlug))
    : workflows;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {filtered.map(wf => {
        const Icon = wf.icon ? (Icons[wf.icon as keyof typeof Icons] as any) : FileText;
        return (
          <button
            key={wf.id}
            type="button"
            onClick={() => onStart?.(wf)}
            className="/* 保持原样式或使用 GlassCard */"
          >
            <Icon />
            <div>{wf.name}</div>
            <div className="text-xs text-muted-foreground">{wf.description}</div>
          </button>
        );
      })}
    </div>
  );
}
```

**注意 CLAUDE.md 设计系统约束：** 若原组件用 `<Button>` / `<GlassCard>`，保持使用。`<button>` 是原生且在 `src/components/home/` 是容许的（检查 eslint rule 区域），但推荐继续用 `<Button variant="ghost">`。

Sheet 触发保留原逻辑，把新的 WorkflowTemplateRow 转换成 Sheet 期望的形状（或扩 Sheet props）。

- [ ] **Step 16.3: 启动 mission 双写**

在 scenario-grid 或 scenario-detail-sheet 的 `startMission` 调用处：

```ts
startMission({
  scenario: templateToScenarioSlug(wf),
  workflowTemplateId: wf.id,
  teamSlugs: wf.defaultTeam ?? [],
  title: wf.name,
  // ... 其他 ...
});
```

- [ ] **Step 16.4: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/components/home/ src/app/(dashboard)/home/home-client.tsx
git commit -m "feat(workflow-unify/p1): scenario-grid driven by workflows prop + dual-write startMission"
```

---

## Task 17: /missions/page.tsx server 组件改接 DAL

**Files:**
- Modify: `src/app/(dashboard)/missions/page.tsx`

- [ ] **Step 17.1: 加 DAL 调用**

```ts
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";

// 在 server component：
const workflows = await listWorkflowTemplatesByOrg(org.id, {
  isBuiltin: true,
  isEnabled: true,
});

return (
  <MissionsClient
    // ... 现有 ...
    workflows={workflows}
  />
);
```

- [ ] **Step 17.2: 提交**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/missions/page.tsx
git commit -m "feat(workflow-unify/p1): /missions/page.tsx reads listWorkflowTemplatesByOrg"
```

---

## Task 18: missions-client.tsx "发起新任务" Sheet 改造

**Files:**
- Modify: `src/app/(dashboard)/missions/missions-client.tsx`

- [ ] **Step 18.1: 把 SCENARIO_CATEGORIES / SCENARIO_CONFIG 读取替换为 workflows prop**

找到 Sheet 组件（约 225 行起），改为读 workflows：

```ts
interface Props {
  // ... 现有 ...
  workflows: WorkflowTemplateRow[];
}

// Sheet 内：
import { ORDERED_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import { groupBy } from "lodash-es";  // 或手写 groupBy

const byCategory = workflows.reduce((acc, wf) => {
  const c = wf.category;
  (acc[c] ??= []).push(wf);
  return acc;
}, {} as Record<string, WorkflowTemplateRow[]>);

const activeTabs = ORDERED_CATEGORIES.filter(c => byCategory[c]?.length > 0);

// Tabs 渲染：
<TabsList variant="line">
  {activeTabs.map(c => (
    <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>
  ))}
</TabsList>

{activeTabs.map(c => (
  <TabsContent key={c} value={c}>
    {byCategory[c].map(wf => (
      <button key={wf.id} onClick={() => handleSelectWorkflow(wf)}>
        {/* icon / name / description / defaultTeam avatars */}
      </button>
    ))}
  </TabsContent>
))}
```

- [ ] **Step 18.2: 选中后创建 mission 双写**

```ts
const handleSelectWorkflow = (wf: WorkflowTemplateRow) => {
  // ... 校验输入字段（wf.inputFields） ...
  await startMission({
    scenario: templateToScenarioSlug(wf),
    workflowTemplateId: wf.id,
    teamSlugs: wf.defaultTeam ?? [],
    title: inputTitle || wf.name,
    // ...
  });
};
```

- [ ] **Step 18.3: 保留原有 list 行展示（用 resolveScenarioConfig 兜底）**

Task 14 已经给 `SCENARIO_CONFIG[m.scenario]` 加了兜底，这里确认 `missions-client.tsx:403` 已切换到 `resolveScenarioConfig(m)`。

- [ ] **Step 18.4: 提交**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/missions/missions-client.tsx
git commit -m "feat(workflow-unify/p1): missions-client 发起新任务 Sheet reads workflows prop"
```

---

# Section F 完成检查

```bash
npx tsc --noEmit
npm run build
# 预期 build 成功

# 手动冒烟：
npm run dev
# 浏览器：/home 看场景网格；/missions 点"发起新任务"看 Sheet
# 两个入口的场景/工作流数量一致
```

---

# Section G — 验收

## Task 19: DAL 两入口同源断言单测

**Files:**
- Modify: `src/lib/dal/__tests__/workflow-templates.test.ts`

- [ ] **Step 19.1: 追加断言测试**

```ts
describe("两入口同源断言（AC）", () => {
  it("首页 filter 和任务中心 filter 返回相同的 workflow id 集合", async () => {
    const homeFilter = { isBuiltin: true, isEnabled: true };
    const missionsFilter = { isBuiltin: true, isEnabled: true };

    const home = await listWorkflowTemplatesByOrg(orgId, homeFilter);
    const missions = await listWorkflowTemplatesByOrg(orgId, missionsFilter);

    expect(new Set(home.map(w => w.id))).toEqual(new Set(missions.map(w => w.id)));
    expect(home.length).toBeGreaterThanOrEqual(2);   // test org 至少 2 条（beforeAll seed）
  });
});
```

- [ ] **Step 19.2: 跑测试 + 提交**

```bash
npm run test -- src/lib/dal/__tests__/workflow-templates.test.ts
git add src/lib/dal/__tests__/workflow-templates.test.ts
git commit -m "test(workflow-unify/p1): two-entry id-set equality assertion"
```

---

## Task 20: 手动 UI 冒烟

**Files:** 无（手动步骤）

- [ ] **Step 20.1: 启动 dev + 打开页面**

```bash
npm run dev
```

浏览器访问 `http://localhost:3000/home`：
- [ ] 场景网格有卡片（>= 几条）
- [ ] 按员工切换 tab，卡片过滤生效（`defaultTeam` 含该员工的显示）
- [ ] 点击卡片启动 mission，能进 mission 详情

浏览器访问 `http://localhost:3000/missions`：
- [ ] 列表行 label 能正常展示（包括 mission.scenario 为 custom_xxx 的也不挂）
- [ ] "发起新任务" Sheet：
  - [ ] Tabs 按 category 分
  - [ ] 每 tab 至少有 1 条
  - [ ] 点选 + 启动 → mission 成功创建

浏览器 DB 断言：
- [ ] 任何新 mission 的 `workflow_template_id` 非空
- [ ] 新 mission 的 `scenario` 字段是合法 slug（builtin key 或 `custom_xxx`）

- [ ] **Step 20.2: 修任何发现的问题**（迭代）

---

## Task 21: 全量回归 + CLAUDE.md 更新 + AC grep

**Files:**
- Modify: `CLAUDE.md`（追加 Workflow/Scenario 段）

- [ ] **Step 21.1: 跑全量测试 + 编译 + 构建**

```bash
npx tsc --noEmit     # 0 error
npm run test          # 全绿
npm run build         # 成功
npm run lint          # 0 warning
```

若任一失败，修复到绿。

- [ ] **Step 21.2: AC grep 验收**

```bash
# AC #7：两入口 DAL 调用
grep -l "listWorkflowTemplatesByOrg" src/app/\(dashboard\)/home/ src/app/\(dashboard\)/missions/ | wc -l
# 预期 >= 2

# AC #10：所有 SCENARIO_CONFIG[...] 都有兜底
grep -rn "SCENARIO_CONFIG\[" src/ | grep -v "??\|resolveScenarioConfig\|fallback\|\.*//\s*def" | wc -l
# 预期 0（或只剩定义点）
```

- [ ] **Step 21.3: CLAUDE.md 追加说明**

在 `CLAUDE.md` 的 Architecture 章节，在 `### CMS Integration Layer` 之前或之后追加：

```markdown
### Scenario/Workflow 统一架构（B.1）

**单一真相源：** `workflow_templates` 表是 VibeTide 所有"场景"的唯一来源。

**数据流：**
- 首页场景网格、任务中心"发起新任务" 都调用 `listWorkflowTemplatesByOrg(orgId, filter)`
- 启动 mission 时双写 `scenario` (slug) + `workflowTemplateId` (uuid FK)
- `mission.scenario` 继续是 slug（builtin → legacy_scenario_key；custom → `custom_${nanoid}`）
- 下游消费者（mission-executor / leader-plan / inngest）仍按 `mission.scenario` slug 分发（B.2 才迁到 workflowTemplateId）

**Category 12 值：** news / deep / social / advanced / livelihood / podcast / drama / daily_brief / video / analytics / distribution / custom

**Seed 来源（27+ builtin rows / org）：**
- SCENARIO_CONFIG (10)：`src/lib/constants.ts:456`（@deprecated，B.2 删）
- ADVANCED_SCENARIO_CONFIG (6)：`:610`（@deprecated）
- employeeScenarios.xiaolei (5)：迁到 workflow_templates
- 现有 workflow_templates (6)：补齐 icon/defaultTeam/appChannelSlug

**关键文件：**
- DAL: `src/lib/dal/workflow-templates.ts`
- Slug 工具: `src/lib/workflow-templates/slug.ts`
- Seed 映射: `src/db/seed-builtin-workflows.ts`
- Spec: `docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md`

**B.2 Pending：** `/scenarios/customize` 重写、`channels/gateway.ts` 改读 DB、删除 SCENARIO_CONFIG 常量、DROP employee_scenarios 表。
```

- [ ] **Step 21.4: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(workflow-unify/p1): update CLAUDE.md with unified scenario/workflow architecture"
```

---

# Section G 完成检查（Acceptance Criteria）

对照 spec §11 逐条核对：

- [ ] `workflow_templates` 有 6 个新列
- [ ] `workflowCategoryEnum` 12 值
- [ ] `missions.workflowTemplateId` 有 FK (on delete restrict)
- [ ] 2 个 partial unique index 存在
- [ ] 8 个 DAL 导出 + 单测全绿
- [ ] builtin workflow_templates ≥ 27 行 / test org
- [ ] `listWorkflowTemplatesByOrg` 出现在 home + missions 两处
- [ ] 两入口 id 集合断言绿
- [ ] 新 mission 的 workflowTemplateId 非空
- [ ] 原 Inngest 流程零改动运行
- [ ] 下游 lookup 都有兜底（grep 0 裸 lookup）
- [ ] `npx tsc --noEmit` 0 error
- [ ] `npm run test` 全绿
- [ ] `npm run build` 成功

全部勾选 → **B.1 完成，可 merge + deploy**。

---

## 备注：与 CMS Phase 1 的关系

- 本 plan 的 `appChannelSlug` 列指向 Phase 1 引入的 9 个 app_channels slug（app_news / app_politics / ...），实现"场景 → 产出 → 入库栏目"的串联
- mission 创建后若走 CMS 入库，`publishArticleToCms({ appChannelSlug: template.appChannelSlug })` 可直接消费
- 本 plan **不改** `src/lib/cms/*` 模块，Phase 1 代码零影响

## 备注：B.2 Preview

B.2 独立 plan 做：
- 迁移 20+ 下游消费者到 workflowTemplateId
- 删除 @deprecated 常量 / API routes / scenarios.ts
- DROP employee_scenarios 表
- 重写 /scenarios/customize 页面
- channels/gateway.ts #场景名 改读 DB
