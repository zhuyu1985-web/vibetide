# 场景 / 工作流架构纠偏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 B.1 之后的场景/工作流架构一次性收敛到 "workflow_templates 单一真相源 + 按员工 tab + schema 驱动参数 + 25+ 下游消费者统一走 workflowTemplateId"；一并做 B.2 legacy 清理（常量 + employee_scenarios + 空模板）。

**Architecture:** 扩展 B.1 已有的 `workflow_templates.input_fields`（不新增列），workflow_templates 增 4 列（is_public / owner_employee_id / launch_mode / prompt_template），missions 增 input_params。前端新增 `WorkflowLaunchDialog` schema-driven 收参；首页 scenario-grid 重构为按员工 tab。Legacy 常量 / employee_scenarios 表 / `/scenarios/customize` 页全删；下游 25+ 处 `mission.scenario` slug 硬分支改走 `mission.workflowTemplateId`。SKILL.md 补齐（Phase 5）由另一 subagent 并行处理，本 plan 跳过。

**Tech Stack:** Next.js 16.1.6 App Router / Drizzle 0.45 / Supabase PG / shadcn-ui / Vitest / AI SDK v6 / Inngest。

**Spec 参考：** `docs/superpowers/specs/2026-04-20-scenario-workflow-realignment-design.md`

**跳过：** Phase 5（SKILL.md 补齐）由另一子 agent 并行完成。本 plan 不包含该阶段任务。

---

## 文件结构（先锁定再拆任务）

### 新增文件

| 路径 | 职责 |
|------|------|
| `supabase/migrations/0053_workflow_realignment.sql` | 4 新列 + missions.input_params + DROP employee_scenarios |
| `src/lib/dal/workflow-templates-listing.ts` | 新 DAL：`listTemplatesForHomepageByEmployee` / `getDefaultHotTopicTemplate` |
| `src/lib/dal/__tests__/workflow-templates-listing.test.ts` | 单测：默认模板选取规则 |
| `src/lib/input-fields-validation.ts` | `validateInputs(schema, values)`，server-side 校验 |
| `src/lib/input-fields-validation.test.ts` | 9 种 type 校验单测 |
| `src/components/workflows/workflow-launch-dialog.tsx` | Schema 驱动的统一启动对话框 |
| `src/components/workflows/input-fields-editor.tsx` | 工作流编辑页的字段编辑器 |
| `src/app/actions/workflow-launch.ts` | `startMissionFromTemplate(id, inputs)` server action |
| `src/db/seed-builtin-workflows.ts` | **重写**（保留文件名）：26 条新 seed |
| `src/db/seed-demo.ts` | 可选 demo seed（样例 missions / custom workflows） |
| `scripts/capture-golden-mission-baseline.ts` | Phase 4 前基线捕获脚本 |
| `docs/golden-missions/2026-04-20-baseline.json` | 6 条场景 Leader 分解 snapshot |

### 修改文件

| 路径 | 改动摘要 |
|------|---------|
| `src/db/schema/workflows.ts` | +4 列（is_public/owner_employee_id/launch_mode/prompt_template） |
| `src/db/schema/missions.ts` | +input_params jsonb |
| `src/db/schema/employee-scenarios.ts` | **删除** |
| `src/lib/types.ts` | `InputFieldDef` 扩展 9 种 type + 可选字段 |
| `src/components/home/scenario-grid.tsx` | 重构为按员工 tab |
| `src/components/home/home-client.tsx` | 接 `WorkflowLaunchDialog`，删 `ScenarioDetailSheet` 引用 |
| `src/components/home/scenario-detail-sheet.tsx` | **删除** |
| `src/app/(dashboard)/scenarios/customize/` | **整目录删除** |
| `src/app/(dashboard)/workflows/[id]/edit/page.tsx` | 加 `InputFieldsEditor` |
| `src/lib/constants.ts` | 删 SCENARIO_CONFIG / ADVANCED_SCENARIO_CONFIG / SCENARIO_CATEGORIES / ADVANCED_SCENARIO_KEYS |
| `src/lib/dal/workflow-templates.ts` | 查询条件补 `is_public` / `owner_employee_id` |
| `src/app/actions/missions.ts` | `startMission` 读取 `input_params` 写入 mission |
| `src/app/actions/hot-topics.ts` | 改用 `getDefaultHotTopicTemplate` |
| `src/inngest/functions/leader-plan.ts` | 读 `mission.input_params` + template 信息 |
| `src/inngest/functions/leader-consolidate.ts` | 改走 `workflowTemplateId` |
| `src/inngest/functions/execute-mission-task.ts` | 移除 scenario slug 分支 |
| `src/lib/mission-core.ts` | LLM prompt 拼接改走 template.name |
| `src/lib/mission-executor.ts` | 步骤派发改读 `template.steps[]` |
| `src/lib/channels/gateway.ts` | DB 查替代常量 map |
| `src/lib/dal/asset-revive.ts` | scenario label map 改读 template.name |
| `src/app/(dashboard)/missions/missions-client.tsx` | 所有 SCENARIO_CONFIG 引用改为 template 查询 |
| `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` | 同上 |
| `src/app/(dashboard)/asset-revive/asset-revive-client.tsx` | scenarioBadge 本地 map 改走 template |
| `CLAUDE.md` | 更新 B.1+B.2 合并完成标注 |

### 归档文件

- `docs/superpowers/specs/2026-04-19-scenario-legacy-cleanup-spec.md` → `docs/superpowers/archive/`

---

## Phase 0: Schema & Audit

### Task 0.1: 扩展 `InputFieldDef` 类型

**Files:**
- Modify: `src/lib/types.ts`（`InputFieldDef` 定义处，约 332 行）

- [ ] **Step 1: 打开文件，定位现有定义**

```bash
grep -n "export interface InputFieldDef" src/lib/types.ts
```
Expected: 打印一行 `332:export interface InputFieldDef {`

- [ ] **Step 2: 替换定义为扩展版（保留 `options: string[]` 兼容性）**

当前 `InputFieldDef.options` 是 `string[]`（行 338）。B.1 seed 和消费方都按 string 数组用。扩展时接受联合类型 `string | { value: string; label: string }`，validateInputs 和 FieldRenderer 内部归一化。这样 B.1 已有 seed 不需改。

```ts
export type InputFieldOption = string | { value: string; label: string };

export interface InputFieldDef {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "multiselect"
    | "date"
    | "daterange"
    | "url"
    | "number"
    | "toggle";
  required?: boolean;           // 改为 optional（原为 required: boolean，B.1 seed 大多填 true）
  placeholder?: string;
  defaultValue?: unknown;       // NEW
  options?: InputFieldOption[]; // 联合类型，兼容 B.1 string[]
  helpText?: string;            // NEW
  validation?: {                // NEW
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// Helper（在 validation / renderer 复用）
export function normalizeFieldOption(opt: InputFieldOption): { value: string; label: string } {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}
```

**注意**：B.1 seed 中 `required: true/false` 都是必填字段。把 `required` 改为 optional 不会破坏这些赋值（多余的 true/false 仍被接受）。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: Zero errors。若某处 `options!.map(o => ...)` 假设 o 是 string，会报 `Property 'length' does not exist on type '...'`——那处改为先 `normalizeFieldOption(o)`。

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): extend InputFieldDef with 9 field types and validation"
```

---

### Task 0.2: Migration —— workflow_templates 加 4 列 + missions 加 input_params + DROP employee_scenarios

**Files:**
- Create: `supabase/migrations/20260420000001_workflow_realignment.sql`

- [ ] **Step 1: 确认 migration 命名规范**

Run: `ls supabase/migrations/ | tail -5`
Expected: 看到 `20260419000001_*`、`20260419023435_*` 等 timestamp 命名。本 migration 用 `20260420000001_workflow_realignment.sql`（字典序排在最后）。

- [ ] **Step 2: 写 migration SQL**

PostgreSQL **不支持** `ADD CONSTRAINT IF NOT EXISTS`，要用 DO block 或直接 ADD（Drizzle push 会先 drop 后加）。此处用幂等 DO block。

```sql
-- supabase/migrations/20260420000001_workflow_realignment.sql
BEGIN;

-- workflow_templates: 4 new cols (ADD COLUMN IF NOT EXISTS is supported)
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_employee_id text,
  ADD COLUMN IF NOT EXISTS launch_mode text NOT NULL DEFAULT 'form',
  ADD COLUMN IF NOT EXISTS prompt_template text;

-- CHECK constraint (no IF NOT EXISTS support → wrap in DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_templates_launch_mode_check'
  ) THEN
    ALTER TABLE workflow_templates
      ADD CONSTRAINT workflow_templates_launch_mode_check
      CHECK (launch_mode IN ('form', 'direct'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_templates_owner_employee
  ON workflow_templates(organization_id, owner_employee_id)
  WHERE owner_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_templates_public_builtin
  ON workflow_templates(organization_id, is_public, is_builtin);

-- missions: input_params
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS input_params jsonb NOT NULL DEFAULT '{}'::jsonb;

-- DROP employee_scenarios (B.1 stopped writing; no runtime dependency)
DROP TABLE IF EXISTS employee_scenarios CASCADE;

COMMIT;
```

- [ ] **Step 3: 同步 Drizzle schema（两文件）**

Modify `src/db/schema/workflows.ts`，在现有 `workflowTemplates` 定义（约行 83 前）加入：

```ts
  // 2026-04-20 realignment
  isPublic: boolean("is_public").notNull().default(true),
  ownerEmployeeId: text("owner_employee_id"),
  launchMode: text("launch_mode").notNull().default("form"),
  promptTemplate: text("prompt_template"),
```

Modify `src/db/schema/missions.ts`（约行 61 `workflowTemplateId` 之后）加入：

```ts
  inputParams: jsonb("input_params").$type<Record<string, unknown>>().default({}).notNull(),
```

- [ ] **Step 4: 删除 `employee-scenarios.ts` schema 文件 + 注册 missions ↔ workflow_templates relation**

```bash
rm src/db/schema/employee-scenarios.ts
```

从 `src/db/schema/index.ts` 删除对该文件的 `export * from ...`（用 grep 定位）。

**同时在 `src/db/schema/missions.ts` 末尾补 relation**（`missionsRelations` 中加一项，用于 Phase 4 `findMany with: { workflowTemplate: true }`）：

```ts
// src/db/schema/missions.ts - missionsRelations 中补
import { workflowTemplates } from "./workflows";

export const missionsRelations = relations(missions, ({ one, many }) => ({
  // ... 原有 relations
  workflowTemplate: one(workflowTemplates, {
    fields: [missions.workflowTemplateId],
    references: [workflowTemplates.id],
  }),
}));
```

对称地在 `src/db/schema/workflows.ts` 的 `workflowTemplatesRelations` 中加：
```ts
missions: many(missions),
```

**注意**：由于 B.1 注释提到"deferred reference to avoid circular import"，实际只需要单向 `missions.workflowTemplate` relation 即可满足 Phase 4 查询需要；对称的 `workflowTemplate.missions` 若会引循环，可暂时不加。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 报错点来自引用 `employee_scenarios` 的代码（seed.ts / DAL / API）。记下所有报错点作为后续任务输入；**本步允许报错，由后续 task 清理**。

- [ ] **Step 6: Drizzle push + 验证列存在**

Run: `npm run db:push`
Expected: 成功应用 migration

Verify: 用 `npm run db:studio` 或 `psql` 查
```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='workflow_templates' AND column_name IN ('is_public','owner_employee_id','launch_mode','prompt_template');
```
Expected: 4 行

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0053_workflow_realignment.sql src/db/schema/workflows.ts src/db/schema/missions.ts
git rm src/db/schema/employee-scenarios.ts
git commit -m "feat(schema): workflow_templates +4 cols, missions.input_params, drop employee_scenarios"
```

---

### Task 0.3: 清理 employee_scenarios 引用

**Files:** 任何 Task 0.2 Step 5 报出的文件（典型位置列于下）

- [ ] **Step 1: 找出所有引用**

Run: `grep -rn "employee_scenarios\|employeeScenarios\|employee-scenarios" src/ scripts/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: 逐文件删除 import/export/用法**

对每个报错文件：
- 若是 seed 代码（如 `src/db/seed.ts` 1330-1470）：整段删除 `employeeScenarios` 写入逻辑，保留 employees 本体
- 若是 DAL / API：删除对应函数（这些函数已无调用者）

- [ ] **Step 3: 类型检查归零**

Run: `npx tsc --noEmit`
Expected: Zero errors（若报 SCENARIO_CONFIG 相关错误，是 Phase 3 任务，此刻可忽略并记录）

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: remove all employee_scenarios references"
```

---

### Task 0.4: 新 DAL —— `listTemplatesForHomepageByEmployee` + `getDefaultHotTopicTemplate` + 单测

**Files:**
- Create: `src/lib/dal/workflow-templates-listing.ts`
- Create: `src/lib/dal/__tests__/workflow-templates-listing.test.ts`

- [ ] **Step 1: 先写单测（TDD）**

`src/lib/dal/__tests__/workflow-templates-listing.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { pickDefaultHotTopicTemplate } from "@/lib/dal/workflow-templates-listing";
import type { WorkflowTemplate } from "@/lib/types";

const mk = (p: Partial<WorkflowTemplate>): WorkflowTemplate =>
  ({
    id: p.id ?? "t1",
    organizationId: "org1",
    name: p.name ?? "x",
    description: null,
    steps: [],
    category: p.category ?? "custom",
    isBuiltin: p.isBuiltin ?? true,
    isPublic: true,
    isEnabled: true,
    ownerEmployeeId: p.ownerEmployeeId ?? null,
    legacyScenarioKey: p.legacyScenarioKey ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    launchMode: "form",
    promptTemplate: null,
    inputFields: [],
  }) as WorkflowTemplate;

describe("pickDefaultHotTopicTemplate", () => {
  it("prefers xiaolei + legacy_scenario_key=breaking_news", () => {
    const candidates = [
      mk({ id: "a", ownerEmployeeId: "xiaolei", category: "news" }),
      mk({ id: "b", ownerEmployeeId: "xiaolei", legacyScenarioKey: "breaking_news", category: "news" }),
      mk({ id: "c", ownerEmployeeId: "xiaoce", category: "news" }),
    ];
    expect(pickDefaultHotTopicTemplate(candidates)?.id).toBe("b");
  });

  it("falls back to xiaolei + category=news when breaking_news absent", () => {
    const candidates = [
      mk({ id: "a", ownerEmployeeId: "xiaoce", category: "news" }),
      mk({ id: "b", ownerEmployeeId: "xiaolei", category: "news" }),
    ];
    expect(pickDefaultHotTopicTemplate(candidates)?.id).toBe("b");
  });

  it("returns null when neither rule matches", () => {
    const candidates = [mk({ ownerEmployeeId: "xiaoce", category: "social" })];
    expect(pickDefaultHotTopicTemplate(candidates)).toBeNull();
  });

  it("returns earliest by createdAt when multiple match priority 1", () => {
    const old = mk({ id: "old", ownerEmployeeId: "xiaolei", legacyScenarioKey: "breaking_news" });
    old.createdAt = new Date("2026-01-01");
    const newer = mk({ id: "new", ownerEmployeeId: "xiaolei", legacyScenarioKey: "breaking_news" });
    newer.createdAt = new Date("2026-04-01");
    expect(pickDefaultHotTopicTemplate([newer, old])?.id).toBe("old");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- workflow-templates-listing`
Expected: FAIL（函数不存在）

- [ ] **Step 3: 实现 pure picker + DAL**

`src/lib/dal/workflow-templates-listing.ts`：

```ts
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema/workflows";
import { and, eq } from "drizzle-orm";
import type { WorkflowTemplate } from "@/lib/types";
import { EMPLOYEE_IDS } from "@/lib/constants";

export function pickDefaultHotTopicTemplate(
  candidates: WorkflowTemplate[]
): WorkflowTemplate | null {
  const byCreatedAtAsc = (a: WorkflowTemplate, b: WorkflowTemplate) =>
    a.createdAt.getTime() - b.createdAt.getTime();

  const p1 = candidates
    .filter(
      (t) =>
        t.ownerEmployeeId === "xiaolei" &&
        t.legacyScenarioKey === "breaking_news" &&
        t.isBuiltin
    )
    .sort(byCreatedAtAsc);
  if (p1.length > 0) return p1[0];

  const p2 = candidates
    .filter(
      (t) =>
        t.ownerEmployeeId === "xiaolei" &&
        t.category === "news" &&
        t.isBuiltin
    )
    .sort(byCreatedAtAsc);
  if (p2.length > 0) return p2[0];

  return null;
}

export async function getDefaultHotTopicTemplate(
  orgId: string
): Promise<WorkflowTemplate> {
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.organizationId, orgId),
        eq(workflowTemplates.isBuiltin, true)
      )
    );
  const picked = pickDefaultHotTopicTemplate(rows as unknown as WorkflowTemplate[]);
  if (!picked) {
    throw new Error(
      "default hot topic template missing for org " +
        orgId +
        "; please reseed builtin templates"
    );
  }
  return picked;
}

export async function listTemplatesForHomepageByEmployee(
  orgId: string,
  employeeId: (typeof EMPLOYEE_IDS)[number] | null
) {
  const conditions = [
    eq(workflowTemplates.organizationId, orgId),
    eq(workflowTemplates.isPublic, true),
  ];
  if (employeeId) {
    conditions.push(eq(workflowTemplates.ownerEmployeeId, employeeId));
  } else {
    conditions.push(eq(workflowTemplates.isBuiltin, false));
  }
  return db
    .select()
    .from(workflowTemplates)
    .where(and(...conditions));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- workflow-templates-listing`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/workflow-templates-listing.ts src/lib/dal/__tests__/workflow-templates-listing.test.ts
git commit -m "feat(dal): add pickDefaultHotTopicTemplate + listTemplatesForHomepageByEmployee"
```

---

### Task 0.5: input_fields 校验工具 + 单测

**Files:**
- Create: `src/lib/input-fields-validation.ts`
- Create: `src/lib/input-fields-validation.test.ts`

- [ ] **Step 1: 先写测试**

```ts
// src/lib/input-fields-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateInputs } from "@/lib/input-fields-validation";
import type { InputFieldDef } from "@/lib/types";

describe("validateInputs", () => {
  it("text: required fails on empty", () => {
    const fields: InputFieldDef[] = [{ name: "a", label: "A", type: "text", required: true }];
    expect(validateInputs(fields, { a: "" }).errors).toEqual({ a: "必填" });
  });

  it("text: passes with validation.minLength", () => {
    const fields: InputFieldDef[] = [
      { name: "a", label: "A", type: "text", required: true, validation: { minLength: 3 } },
    ];
    expect(validateInputs(fields, { a: "ab" }).errors).toHaveProperty("a");
    expect(validateInputs(fields, { a: "abcd" }).errors).not.toHaveProperty("a");
  });

  it("number: validation.min/max", () => {
    const fields: InputFieldDef[] = [
      { name: "n", label: "N", type: "number", required: true, validation: { min: 1, max: 10 } },
    ];
    expect(validateInputs(fields, { n: 0 }).errors).toHaveProperty("n");
    expect(validateInputs(fields, { n: 11 }).errors).toHaveProperty("n");
    expect(validateInputs(fields, { n: 5 }).errors).not.toHaveProperty("n");
  });

  it("select: value must match an option", () => {
    const fields: InputFieldDef[] = [
      {
        name: "s",
        label: "S",
        type: "select",
        required: true,
        options: [{ value: "x", label: "X" }],
      },
    ];
    expect(validateInputs(fields, { s: "y" }).errors).toHaveProperty("s");
    expect(validateInputs(fields, { s: "x" }).errors).not.toHaveProperty("s");
  });

  it("daterange: must be {start, end}", () => {
    const fields: InputFieldDef[] = [
      { name: "r", label: "R", type: "daterange", required: true },
    ];
    expect(validateInputs(fields, { r: null }).errors).toHaveProperty("r");
    expect(
      validateInputs(fields, { r: { start: "2026-04-01", end: "2026-04-20" } }).errors
    ).not.toHaveProperty("r");
  });

  it("optional field with empty value passes", () => {
    const fields: InputFieldDef[] = [{ name: "a", label: "A", type: "text" }];
    expect(validateInputs(fields, {}).errors).toEqual({});
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- input-fields-validation`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/input-fields-validation.ts
import type { InputFieldDef } from "@/lib/types";

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  cleaned: Record<string, unknown>;
}

export function validateInputs(
  fields: InputFieldDef[],
  values: Record<string, unknown>
): ValidationResult {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.length === 0) ||
      (Array.isArray(raw) && raw.length === 0);

    if (isEmpty) {
      if (field.required) errors[field.name] = "必填";
      continue;
    }

    switch (field.type) {
      case "text":
      case "textarea":
      case "url": {
        if (typeof raw !== "string") {
          errors[field.name] = "必须是文本";
          break;
        }
        const v = field.validation;
        if (v?.minLength !== undefined && raw.length < v.minLength) {
          errors[field.name] = `至少 ${v.minLength} 字`;
          break;
        }
        if (v?.maxLength !== undefined && raw.length > v.maxLength) {
          errors[field.name] = `最多 ${v.maxLength} 字`;
          break;
        }
        if (v?.pattern && !new RegExp(v.pattern).test(raw)) {
          errors[field.name] = "格式不符";
          break;
        }
        if (field.type === "url") {
          try {
            new URL(raw);
          } catch {
            errors[field.name] = "URL 格式无效";
            break;
          }
        }
        cleaned[field.name] = raw;
        break;
      }
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isNaN(n)) {
          errors[field.name] = "必须是数字";
          break;
        }
        const v = field.validation;
        if (v?.min !== undefined && n < v.min) {
          errors[field.name] = `最小 ${v.min}`;
          break;
        }
        if (v?.max !== undefined && n > v.max) {
          errors[field.name] = `最大 ${v.max}`;
          break;
        }
        cleaned[field.name] = n;
        break;
      }
      case "toggle": {
        cleaned[field.name] = Boolean(raw);
        break;
      }
      case "select": {
        const valid = field.options?.some((o) => o.value === raw) ?? false;
        if (!valid) {
          errors[field.name] = "选项无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "multiselect": {
        if (!Array.isArray(raw)) {
          errors[field.name] = "必须是数组";
          break;
        }
        const allValid = raw.every((x) =>
          field.options?.some((o) => o.value === x)
        );
        if (!allValid) {
          errors[field.name] = "包含无效选项";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "date": {
        if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
          errors[field.name] = "日期格式无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
      case "daterange": {
        if (
          typeof raw !== "object" ||
          raw === null ||
          !("start" in raw) ||
          !("end" in raw)
        ) {
          errors[field.name] = "日期范围格式无效";
          break;
        }
        cleaned[field.name] = raw;
        break;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}
```

- [ ] **Step 4: 测试通过**

Run: `npm test -- input-fields-validation`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/input-fields-validation.ts src/lib/input-fields-validation.test.ts
git commit -m "feat: add input_fields server-side validation with 9 field types"
```

---

### Task 0.6: Golden Mission 基线捕获脚本 + 运行

**Files:**
- Create: `scripts/capture-golden-mission-baseline.ts`
- Create: `docs/golden-missions/2026-04-20-baseline.json`

- [ ] **Step 1: 写捕获脚本**

```ts
// scripts/capture-golden-mission-baseline.ts
import "dotenv/config";
import { buildLeaderDecomposePrompt } from "@/lib/mission-core";
// NOTE: actual import path 以实际代码为准；若 mission-core 不直接 export，则通过内部 composer function
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { eq } from "drizzle-orm";
import fs from "node:fs";

const SCENARIOS = [
  "breaking_news",
  "press_conference",
  "daily_brief",
  "video_content",
  "deep_report",
  "custom",
] as const;

async function main() {
  const baseline: Record<string, unknown> = {};
  for (const scenario of SCENARIOS) {
    const mission = await db.query.missions.findFirst({
      where: eq(missions.scenario, scenario),
    });
    if (!mission) {
      baseline[scenario] = { note: "no demo mission, skipped" };
      continue;
    }
    baseline[scenario] = {
      missionId: mission.id,
      scenario: mission.scenario,
      prompt: buildLeaderDecomposePrompt(mission, []),
      capturedAt: new Date().toISOString(),
    };
  }
  fs.writeFileSync(
    "docs/golden-missions/2026-04-20-baseline.json",
    JSON.stringify(baseline, null, 2)
  );
  console.log("captured", Object.keys(baseline).length, "scenarios");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 运行捕获**

Run: `npx tsx scripts/capture-golden-mission-baseline.ts`
Expected: 打印 `captured 6 scenarios`（若 demo mission 缺失部分场景，对应 entry 带 `note`）

- [ ] **Step 3: 检查产物**

Run: `cat docs/golden-missions/2026-04-20-baseline.json | head -40`
Expected: JSON 格式，至少 2 个场景有 `prompt` 字段

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-golden-mission-baseline.ts docs/golden-missions/2026-04-20-baseline.json
git commit -m "chore: capture Leader prompt baseline for 6 golden scenarios"
```

---

## Phase 1: Seed 重写

### Task 1.1: Seed 模板结构（26 条脚手架）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（完整重写）

- [ ] **Step 1: 备份当前文件内容（记录老的 skill slug 引用清单）**

Run: `grep -oE "skillSlug: ['\"][a-z_]+['\"]" src/db/seed-builtin-workflows.ts | sort -u`
Expected: 打印去重的 skill slug 列表（用于后续验证新 seed 不引用不存在的 skill）

- [ ] **Step 2: 完整重写文件**

按 spec §5.3 分布（xiaolei 3 / xiaoce 3 / xiaozi 3 / xiaowen 2 / xiaojian 3 / xiaoshen 2 / xiaofa 2 / xiaoshu 3 / null×5）。文件结构：

```ts
// src/db/seed-builtin-workflows.ts
import type { EmployeeId } from "@/lib/types";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";

export interface BuiltinWorkflowSeed {
  slug: string; // legacy_scenario_key 位
  name: string;
  description: string;
  icon: string;
  category: string;
  ownerEmployeeId: EmployeeId | null;
  defaultTeam: EmployeeId[];
  appChannelSlug: string | null;
  launchMode: "form" | "direct";
  inputFields: InputFieldDef[];
  steps: WorkflowStepDef[];
  systemInstruction?: string;
  promptTemplate?: string;
}

export const BUILTIN_WORKFLOWS: BuiltinWorkflowSeed[] = [
  // --- xiaolei (3) ---
  { /* xiaolei.breaking_news —— 见 Task 1.2 */ } as any,
  // ... 其余 25 条占位
];
```

**此任务只写脚手架**（26 个占位 object + 类型定义），具体字段在 Task 1.2-1.9 按员工分批填。

- [ ] **Step 3: tsc 通过（脚手架阶段允许 `as any` 占位）**

Run: `npx tsc --noEmit`
Expected: Zero errors（占位用 `as any` 暂时规避，下个任务替换）

- [ ] **Step 4: Commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "refactor(seed): scaffold 26 builtin workflow slots"
```

---

### Task 1.2: 填充 xiaolei 3 条（breaking_news / hot_radar / press_conference）

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`

- [ ] **Step 1: 为每条定义完整字段**

示例（breaking_news）：

```ts
{
  slug: "breaking_news",
  name: "突发新闻追踪",
  description: "热点突发 → 多方信源核实 → 快讯生成 → 多渠道分发",
  icon: "zap",
  category: "news",
  ownerEmployeeId: "xiaolei",
  defaultTeam: ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
  appChannelSlug: "app_news",
  launchMode: "form",
  inputFields: [
    {
      name: "topic_title",
      label: "事件主题",
      type: "text",
      required: true,
      placeholder: "例：XX 地震",
      validation: { minLength: 4, maxLength: 60 },
    },
    {
      name: "topic_context",
      label: "背景与已知信息",
      type: "textarea",
      required: false,
      placeholder: "已了解到的信息……",
    },
    {
      name: "distribution",
      label: "分发渠道",
      type: "multiselect",
      required: true,
      options: [
        { value: "app", label: "APP 端" },
        { value: "wechat", label: "微信" },
        { value: "weibo", label: "微博" },
      ],
      defaultValue: ["app"],
    },
  ],
  steps: [
    {
      id: "s1", order: 1, dependsOn: [],
      name: "热点核实", type: "skill",
      config: { skillSlug: "web_search", skillCategory: "research", parameters: {} },
    },
    {
      id: "s2", order: 2, dependsOn: ["s1"],
      name: "快讯撰写", type: "skill",
      config: { skillSlug: "content_generate", skillCategory: "writing", parameters: { tone: "factual", length: "brief" } },
    },
    {
      id: "s3", order: 3, dependsOn: ["s2"],
      name: "事实核查", type: "skill",
      config: { skillSlug: "fact_check", skillCategory: "review", parameters: {} },
    },
    {
      id: "s4", order: 4, dependsOn: ["s3"],
      name: "多渠道适配", type: "skill",
      config: { skillSlug: "style_rewrite", skillCategory: "writing", parameters: { platform: "multi" } },
    },
  ],
  promptTemplate: "快速追踪突发事件「{{topic_title}}」。已知背景：{{topic_context}}。请按「核实 → 撰写 → 核查 → 分发」流程执行。",
},
```

其他两条（`hot_radar` / `press_conference`）参考该结构。`press_conference` 的 `inputFields` 必须含 `conference_name`（text required）+ `conference_date`（date required）。

- [ ] **Step 2: tsc 通过，无 any**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "feat(seed): xiaolei 3 workflows (breaking_news / hot_radar / press_conference)"
```

---

### Tasks 1.3 - 1.9: 按员工批量填充

每个员工一个 task，模式同 Task 1.2。每个 commit 独立。

- [ ] **Task 1.3: xiaoce 3 条**（topic_package / series_planning / livelihood_brief）
- [ ] **Task 1.4: xiaozi 3 条**（news_write / deep_report / social_post）
- [ ] **Task 1.5: xiaowen 2 条**（analysis / data_journalism）
- [ ] **Task 1.6: xiaojian 3 条**（vlog_edit / short_video / doc_video）
- [ ] **Task 1.7: xiaoshen 2 条**（fact_check / compliance_review）
- [ ] **Task 1.8: xiaofa 2 条**（multi_platform / channel_adapt），
  - `multi_platform` 用 `launchMode: "direct"`（自动按热稿分发，无参数）
- [ ] **Task 1.9: xiaoshu 3 条**（daily_brief / weekly_report / benchmark_analysis）
  - `daily_brief` 用 `launchMode: "direct"`

每个 task 结束后跑 `npx tsc --noEmit` + commit。

---

### Task 1.10: 公共协作 5 条 + 更新 `seedBuiltinTemplatesForOrg`

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（5 条 `ownerEmployeeId: null`）
- Modify: `src/lib/dal/workflow-templates.ts`（`seedBuiltinTemplatesForOrg` 写入新列）

- [ ] **Step 1: 填充 5 条公共**

`pub.daily_news_push` / `pub.press_conf_relay` / `pub.viral_video_kit` / `pub.feature_story_pipeline` / `pub.incident_rapid_response`，`ownerEmployeeId: null`，`defaultTeam` 跨员工。

- [ ] **Step 2: 更新 seedBuiltinTemplatesForOrg**

定位 `src/lib/dal/workflow-templates.ts` 的 `seedBuiltinTemplatesForOrg`，在 `onConflictDoUpdate` 的 `set` 中加：
```ts
inputFields: sql`excluded.input_fields`,
isPublic: sql`excluded.is_public`,
ownerEmployeeId: sql`excluded.owner_employee_id`,
launchMode: sql`excluded.launch_mode`,
promptTemplate: sql`excluded.prompt_template`,
```

在 insert values 中加：
```ts
isPublic: true,
ownerEmployeeId: seed.ownerEmployeeId,
launchMode: seed.launchMode,
promptTemplate: seed.promptTemplate ?? null,
```

- [ ] **Step 3: 运行 seed**

Run: `npm run db:seed`
Expected: 无错误

- [ ] **Step 4: 验证 DB（per-org 查询）**

先取 demo org id：
```sql
SELECT id FROM organizations WHERE name ILIKE 'demo%' LIMIT 1;  -- 记作 $ORG
```

然后：
```sql
SELECT COUNT(*), owner_employee_id FROM workflow_templates
 WHERE is_builtin=true AND organization_id = '$ORG'
 GROUP BY owner_employee_id ORDER BY owner_employee_id NULLS LAST;
```
Expected: 9 行合计 26（xiaolei=3, xiaoce=3, xiaozi=3, xiaowen=2, xiaojian=3, xiaoshen=2, xiaofa=2, xiaoshu=3, null=5）

若本地库有多 org，每 org 各自 26，不影响正确性。

**额外**：验证 `seedBuiltinTemplatesForOrg` 的 `onConflictDoUpdate` target 索引存在：
```sql
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'workflow_templates' AND indexdef ILIKE '%legacy_scenario_key%';
```
Expected: 至少返回 1 行唯一索引（B.1 应已创建；若缺失，本任务加入该 migration）。

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(seed): 5 public workflows + seedBuiltinTemplatesForOrg writes new cols"
```

---

## Phase 2: UI

### Task 2.1: `startMissionFromTemplate` server action

**Files:**
- Create: `src/app/actions/workflow-launch.ts`

**关键约束**（先读 `src/app/actions/missions.ts:28` 和 `:65` 现有 `startMission` 实现再动手）：
- `requireAuth` 不是共享 helper，各 actions 文件 inline 复制。本任务沿用同一模式（`createClient()` → `supabase.auth.getUser()`）。
- Org 从 `getCurrentUserOrg()`（`@/lib/dal/auth`）查。
- `missions` 表有三个 NOT NULL 列：`title / userInstruction / leaderEmployeeId`，必须填。
- `inngest.send({ name: "mission/created", data })` 的 `data` 要求 `{ missionId, organizationId }`（见 `src/inngest/events.ts:4`）。

- [ ] **Step 1: 实现**

```ts
// src/app/actions/workflow-launch.ts
"use server";

import { db } from "@/db";
import { workflowTemplates } from "@/db/schema/workflows";
import { missions } from "@/db/schema/missions";
import { aiEmployees } from "@/db/schema/ai-employees";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { validateInputs } from "@/lib/input-fields-validation";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");
  return user;
}

/**
 * Render Mustache-style template: {{field_name}} → value
 */
function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

function buildUserInstruction(templateName: string, cleaned: Record<string, unknown>, promptTemplate: string | null): string {
  if (promptTemplate) return renderTemplate(promptTemplate, cleaned);
  const paramLines = Object.entries(cleaned)
    .map(([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("\n");
  return `启动场景：${templateName}\n参数：\n${paramLines}`;
}

export async function startMissionFromTemplate(
  templateId: string,
  inputs: Record<string, unknown>
): Promise<{ ok: true; missionId: string } | { ok: false; errors: Record<string, string> }> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const template = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.id, templateId),
      eq(workflowTemplates.organizationId, orgId)
    ),
  });
  if (!template) return { ok: false, errors: { _global: "模板不存在或无权访问" } };

  const { ok, errors, cleaned } = validateInputs(
    (template.inputFields ?? []) as any,
    inputs
  );
  if (!ok) return { ok: false, errors };

  // Pick leader: prefer owner_employee_id; else first of default_team; else org's first xiaolei.
  let leaderSlug: string | null = template.ownerEmployeeId;
  if (!leaderSlug && Array.isArray(template.defaultTeam) && template.defaultTeam.length > 0) {
    leaderSlug = template.defaultTeam[0] as string;
  }
  leaderSlug = leaderSlug ?? "xiaolei";

  const leader = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.organizationId, orgId),
      eq(aiEmployees.employeeId, leaderSlug as any)
    ),
  });
  if (!leader) return { ok: false, errors: { _global: `找不到员工 ${leaderSlug}` } };

  const userInstruction = buildUserInstruction(template.name, cleaned, template.promptTemplate);

  const [created] = await db
    .insert(missions)
    .values({
      organizationId: orgId,
      title: template.name,
      scenario: template.name,       // denormalized label cache (spec §3.3 选 A: template.name)
      userInstruction,
      leaderEmployeeId: leader.id,
      workflowTemplateId: template.id,
      inputParams: cleaned,
      status: "queued",
      teamMembers: (template.defaultTeam ?? []) as string[],
    })
    .returning({ id: missions.id });

  await inngest.send({
    name: "mission/created",
    data: { missionId: created.id, organizationId: orgId },
  });

  revalidatePath("/missions");
  return { ok: true, missionId: created.id };
}
```

**核对**：
- `aiEmployees.employeeId` 列名与类型 —— 执行前 `grep "employeeId:" src/db/schema/ai-employees.ts` 确认
- `defaultTeam` 字段在 B.1 schema 中为 `jsonb('default_team').$type<string[]>()` —— 列存在

- [ ] **Step 2: tsc 通过**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/workflow-launch.ts
git commit -m "feat: startMissionFromTemplate server action"
```

---

### Task 2.2: `WorkflowLaunchDialog` 组件

**Files:**
- Create: `src/components/workflows/workflow-launch-dialog.tsx`

- [ ] **Step 1: 实现**

基本结构：`<Dialog>` 包裹 form；按 `template.inputFields` 渲染对应控件（复用 `<Input>/<Textarea>/<Select>/<DatePicker>/<DateRangePicker>/<Switch>`）。提交时调 `startMissionFromTemplate`，成功 router.push `/missions/{id}`，失败把 errors map 到字段下。

关键片段：

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DatePicker, DateRangePicker } from "@/components/shared/date-picker";
import { Switch } from "@/components/ui/switch";
import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import type { WorkflowTemplate } from "@/lib/types";

export function WorkflowLaunchDialog({
  template,
  open,
  onOpenChange,
}: {
  template: WorkflowTemplate;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of template.inputFields ?? []) {
      if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
    }
    return init;
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await startMissionFromTemplate(template.id, values);
    setSubmitting(false);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    onOpenChange(false);
    router.push(`/missions/${res.missionId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {(template.inputFields ?? []).map((f) => (
            <FieldRenderer
              key={f.name}
              field={f}
              value={values[f.name]}
              error={errors[f.name]}
              onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
            />
          ))}
          {errors._global && <p className="text-sm text-red-600">{errors._global}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "启动中…" : "启动"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRenderer({ field, value, error, onChange }: {
  field: InputFieldDef; value: unknown; error?: string; onChange: (v: unknown) => void;
}) {
  // switch field.type -> render proper control; show error under control.
  // ... (9 种 type 全支持)
}
```

**重要**：严格遵守 CLAUDE.md 的"设计系统规则"——不写原生 `<input>`、不覆盖共享原语的 color class、不手写 search box。

- [ ] **Step 2: tsc 通过**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/workflows/workflow-launch-dialog.tsx
git commit -m "feat(ui): WorkflowLaunchDialog with schema-driven rendering"
```

---

### Task 2.3: 首页 `scenario-grid` 重构为按员工 tab

**Files:**
- Modify: `src/components/home/scenario-grid.tsx`（重构）
- Modify: `src/components/home/home-client.tsx`（更新 props 消费）
- Modify: `src/app/(dashboard)/home/page.tsx`（DAL 调用更新）

- [ ] **Step 1: 更新 `page.tsx` 拉数据**

在 server page 里按 9 tab 并行拉：

```ts
const employeeIds: EmployeeId[] = ["xiaolei","xiaoce","xiaozi","xiaowen","xiaojian","xiaoshen","xiaofa","xiaoshu"];
const [byEmployee, custom] = await Promise.all([
  Promise.all(employeeIds.map((eid) => listTemplatesForHomepageByEmployee(orgId, eid))),
  listTemplatesForHomepageByEmployee(orgId, null),
]);
const templatesByTab: Record<string, WorkflowTemplate[]> = {
  xiaolei: byEmployee[0], xiaoce: byEmployee[1], xiaozi: byEmployee[2],
  xiaowen: byEmployee[3], xiaojian: byEmployee[4], xiaoshen: byEmployee[5],
  xiaofa: byEmployee[6], xiaoshu: byEmployee[7],
  custom: custom,
};
```

- [ ] **Step 2: `scenario-grid.tsx` 重构**

接收 `templatesByTab` prop；顶部 `<Tabs variant="default">`，9 个 `<TabsTrigger>`；每个 tab 内渲染该员工的 template 卡片网格。卡片点击逻辑：
- `launchMode === "form"` → `setLaunching(template)` 显示 `WorkflowLaunchDialog`
- `launchMode === "direct"` → 直接调 `startMissionFromTemplate(template.id, {})` → router.push

**空态 UI**：若某 tab 下无模板，渲染空态：

```tsx
{templates.length === 0 ? (
  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
    <p>该员工暂无预设工作流</p>
    <Button variant="link" asChild className="mt-2">
      <Link href="/workflows">前往工作流模块查看全部</Link>
    </Button>
  </div>
) : (
  <Grid>...</Grid>
)}
```

- [ ] **Step 3: 删除旧逻辑中的 ADVANCED_SCENARIO_CONFIG 查询**

`home-client.tsx` 里 line 144-164 的 legacy 分支（`ScenarioDetailSheet`）整块删除，统一由 `WorkflowLaunchDialog` 接管。

- [ ] **Step 4: tsc + 浏览器冒烟**

Run: `npx tsc --noEmit`
Expected: Zero errors

Run: `npm run dev`（已启动则跳过）
Visit: `http://localhost:3000/home`
Expected: 9 tab 显示正确，点击卡片弹对话框，提交后跳 `/missions/{id}`。

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(home): scenario-grid per-employee tabs with WorkflowLaunchDialog"
```

---

### Task 2.4: `InputFieldsEditor` 区块

**Files:**
- Create: `src/components/workflows/input-fields-editor.tsx`
- Modify: `src/app/(dashboard)/workflows/[id]/edit/page.tsx`

- [ ] **Step 1: 组件**

单列表格：每行一个 `InputFieldDef`，含 type 切换 / label / required switch / placeholder / 按 type 显示子控件（select→options / number→min/max / text→minLength/pattern）。支持增/删/拖拽排序（用 `@dnd-kit` 若已装，否则上下按钮）。最上方一个预览按钮，点击用 mock values 渲染 `WorkflowLaunchDialog`（只读）。

- [ ] **Step 2: 接入编辑页**

在 `workflows/[id]/edit/page.tsx` 的 server action `updateTemplate` 允许 patch 以下字段：`name / description / icon / category / inputFields / steps / launchMode / promptTemplate / isPublic / ownerEmployeeId`。

- [ ] **Step 3: tsc + 手工冒烟**

Run: `npx tsc --noEmit`
Visit: `/workflows/<some-builtin-id>/edit`
Expected: 可编辑字段并保存

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(workflows/edit): InputFieldsEditor for input_fields config"
```

---

## Phase 3: Legacy 删除

### Task 3.1: 删除 4 个 @deprecated 常量

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: 删除 4 块**

删除：
- `SCENARIO_CATEGORIES`（:437）
- `SCENARIO_CONFIG`（:478-...）
- `ADVANCED_SCENARIO_CONFIG`（:636-...）
- `ADVANCED_SCENARIO_KEYS`（:753）

同时删除相关 `type` export（`ScenarioKey` / `AdvancedScenarioKey` 等，若不再被 non-deleted 代码引用）。

- [ ] **Step 2: tsc 核爆（预期）**

Run: `npx tsc --noEmit`
Expected: **大量报错**。这是故意的；报错位置即 Phase 4 所有要改的下游消费者。

把报错输出存为 `phase3-errors.txt` 供 Phase 4 做 checklist：
```bash
npx tsc --noEmit 2>&1 | grep "error TS" > phase3-errors.txt
wc -l phase3-errors.txt
```
Expected: ≥ 20 行

- [ ] **Step 3: Commit（允许 tsc 失败，本 commit 是"引爆点"）**

```bash
git add src/lib/constants.ts phase3-errors.txt
git commit -m "refactor: delete 4 deprecated scenario constants (expect downstream breakage for Phase 4)"
```

---

### Task 3.2: 删除 `ScenarioDetailSheet` + `/scenarios/customize`

**Files:**
- Delete: `src/components/home/scenario-detail-sheet.tsx`
- Delete: `src/app/(dashboard)/scenarios/customize/` 整目录

- [ ] **Step 1: 删**

```bash
git rm src/components/home/scenario-detail-sheet.tsx
git rm -rf src/app/\(dashboard\)/scenarios/customize
```

- [ ] **Step 2: `home-client.tsx` 清 import 残留**

Run: `grep -n "ScenarioDetailSheet\|scenario-detail-sheet" src/components/home/home-client.tsx`
Expected: 0 行（若有，删掉 import + 使用）

- [ ] **Step 3: 加 redirect**

在 `next.config.ts` 的 `redirects()` 中添加：

```ts
async redirects() {
  return [
    { source: "/scenarios/customize", destination: "/workflows", permanent: true },
    { source: "/scenarios/customize/:path*", destination: "/workflows", permanent: true },
  ];
}
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: 与 Task 3.1 后错误差不多（没新增报错；减少几个）

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: remove ScenarioDetailSheet and /scenarios/customize page"
```

---

## Phase 4: 下游消费者迁移（25+ 处）

> **节奏**：以 TypeScript 报错为 checklist。每个子任务改完一组后 tsc 报错数必须下降。

### Task 4.1: Leader prompt 链（`leader-plan` / `leader-consolidate` / `mission-core`）

**Files:**
- Modify: `src/inngest/functions/leader-plan.ts:65`
- Modify: `src/inngest/functions/leader-consolidate.ts:110`
- Modify: `src/lib/mission-core.ts:93/115/345/381`

- [ ] **Step 1: 重构 prompt builder 接口**

在 `mission-core.ts` 中 `buildLeaderDecomposePrompt` 当前签名假设读 `mission.scenario` → 查常量。改为接收已解析的 template：

```ts
export function buildLeaderDecomposePrompt(
  mission: Mission,
  template: WorkflowTemplate,     // NEW required param
  employees: Employee[]
): string {
  const inputsBlock = Object.entries(mission.inputParams ?? {})
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join("\n");
  const stepsBlock = template.steps
    .map((s) => `${s.order}. ${s.name}（${s.config.skillSlug ?? "output"}）`)
    .join("\n");
  const hint = template.promptTemplate
    ? `\n【模板提示】\n${renderMustache(template.promptTemplate, mission.inputParams)}`
    : "";
  return `【场景】${template.name}
【描述】${template.description}
【参数】
${inputsBlock}
【预设步骤】
${stepsBlock}${hint}
...`;
}
```

其中 `renderMustache` 用最小实现：`str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ""))`。

- [ ] **Step 2: 调用方改造**

`leader-plan.ts:65`：之前 `buildLeaderDecomposePrompt(mission, employees)`。改为：
```ts
const template = await db.query.workflowTemplates.findFirst({
  where: eq(workflowTemplates.id, mission.workflowTemplateId),
});
if (!template) throw new Error(`mission ${mission.id} missing workflow template`);
const prompt = buildLeaderDecomposePrompt(mission, template, employees);
```

`leader-consolidate.ts:110` 同模式。`mission-core.ts:93/115/345/381` 对每处 `mission.scenario` label 插值，改为接收 `template.name`。

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | wc -l`
Expected: 报错数从 Phase 3 的基线下降

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(leader): prompt builder takes WorkflowTemplate not scenario slug"
```

---

### Task 4.2: `mission-executor` 移除 scenario slug 分支

**Files:**
- Modify: `src/lib/mission-executor.ts:66/220/291/344/546`

- [ ] **Step 1: 定位所有分支**

```bash
grep -n "mission\.scenario\|switch.*scenario\|if.*scenario ===" src/lib/mission-executor.ts
```

- [ ] **Step 2: 逐处改为读 template.steps**

每处 scenario slug 分支改为：
- 读 `mission.workflowTemplateId` → template
- 按 `template.steps[]` 派任务（不再 hardcode step 列表）

- [ ] **Step 3: tsc 下降**

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor(executor): drive by template.steps, drop scenario switch"
```

---

### Task 4.3: `channels/gateway.ts` DB 查替代常量 map

**Files:**
- Modify: `src/lib/channels/gateway.ts:56/133`

- [ ] **Step 1: 新增 DAL**

在 `workflow-templates-listing.ts` 加 `findTemplateByNameOrSlug(orgId, keyword)`：
```ts
export async function findTemplateByNameOrSlug(orgId: string, kw: string) {
  const patt = `%${kw}%`;
  return db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, orgId),
      or(
        ilike(workflowTemplates.name, patt),
        ilike(workflowTemplates.legacyScenarioKey, patt)
      )
    ),
  });
}
```

- [ ] **Step 2: 重写 gateway parse**

```ts
// channels/gateway.ts:56/133
const template = await findTemplateByNameOrSlug(orgId, command.scenarioKey);
if (!template) {
  return { ok: false, message: `未找到场景「${command.scenarioKey}」，请到 /workflows 查看可用模板` };
}
await startMissionFromTemplate(template.id, command.inputs ?? {});
```

- [ ] **Step 3: tsc + commit**

```bash
git commit -am "refactor(channels): gateway scenario match via DB"
```

---

### Task 4.4: `hot-topics.ts` 用默认模板

**Files:**
- Modify: `src/app/actions/hot-topics.ts:89-150`

- [ ] **Step 1: 替换硬编码 scenario**

```ts
const template = await getDefaultHotTopicTemplate(orgId);
const inputs = {
  topic_title: topic.title,
  topic_context: [
    topic.heatScore ? `热度：${topic.heatScore}` : "",
    topic.platforms?.length ? `平台：${topic.platforms.join(",")}` : "",
    selectedAngle ? `角度：${selectedAngle.title}\n${selectedAngle.summary}` : "",
  ].filter(Boolean).join("\n"),
  distribution: ["app"],
};
const res = await startMissionFromTemplate(template.id, inputs);
```

- [ ] **Step 2: tsc + commit**

```bash
git commit -am "refactor(hot-topics): startTopicMission uses default template"
```

---

### Task 4.5: UI 层 16 处 SCENARIO_CONFIG 查询

**Files:**
- Modify: `missions-client.tsx`（7 处）+ `mission-console-client.tsx`（2 处）+ `home-client.tsx`（2 处，扫尾）+ `scenario-grid.tsx`（若还有残留）+ `asset-revive-client.tsx`（2 处）

- [ ] **Step 1: 以 tsc 报错清单逐个处理**

每个报错：
- 若是显示 scenario label：改 `template.name`（从 mission.workflow_template_id 关联查）
- 若是 scenario filter select：改为读所有 builtin templates，以 `template.id` 为选项 value
- 若是 icon/color 映射：改 `template.icon` 字段

- [ ] **Step 2: 所有 mission row 组件接收 template 对象**

在 server page 组件中 `db.query.missions.findMany` 加 `with: { workflowTemplate: true }`（需 drizzle relations 支持，若无则手工 LEFT JOIN）。

- [ ] **Step 3: tsc 归零**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | wc -l`
Expected: **0**

- [ ] **Step 4: 冒烟**

Visit `/missions` / `/missions/<id>` / `/asset-revive`
Expected: 页面正常渲染，scenario label 显示 template.name

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(ui): mission UI reads workflow_template instead of SCENARIO_CONFIG"
```

---

### Task 4.6: `asset-revive.ts` DAL 清理 + 剩余 grep 扫尾

**Files:**
- Modify: `src/lib/dal/asset-revive.ts:130`
- Anywhere else

- [ ] **Step 1: 清扫残留**

```bash
grep -rn "SCENARIO_CONFIG\|ADVANCED_SCENARIO_CONFIG\|SCENARIO_CATEGORIES\|ADVANCED_SCENARIO_KEYS" src/ --include="*.ts" --include="*.tsx"
```
Expected: 0 行

- [ ] **Step 2: `mission.scenario` 硬分支扫尾**

```bash
grep -rn 'mission\.scenario\s*===' src/ --include="*.ts" --include="*.tsx"
```
Expected: 0 行（保留的 `mission.scenario` 只能用于 label 显示或写入）

- [ ] **Step 3: 若有命中，改走 template**

- [ ] **Step 4: tsc + build 通过**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: 皆 Zero errors

- [ ] **Step 5: Commit**

```bash
git commit -am "chore: final sweep of legacy scenario references"
```

---

### Task 4.7: Golden Mission diff

**Files:**
- Create: `scripts/diff-golden-mission.ts`

- [ ] **Step 1: 写 diff 脚本**

读 baseline JSON，对每个 scenario 重新跑 `buildLeaderDecomposePrompt` 并对比，输出到 stderr；不相同的打 diff。

- [ ] **Step 2: 运行**

Run: `npx tsx scripts/diff-golden-mission.ts`
Expected: 对比结果打印；**内容差异允许**（结构化 prompt 必然变），**语义覆盖对齐**即可（步骤数、涉及 skill 集合、核心参数均一致）。由人审阅。

- [ ] **Step 3: Commit 结果**

```bash
git add scripts/diff-golden-mission.ts docs/golden-missions/2026-04-20-post-phase4.md
git commit -m "chore: golden mission diff after Phase 4 migration"
```

---

## Phase 6: Demo 种子 + 验收

### Task 6.1: `src/db/seed-demo.ts` 样例 missions + custom workflows

**Files:**
- Create: `src/db/seed-demo.ts`
- Modify: `package.json`（加 script）

- [ ] **Step 1: 脚本**

```ts
// src/db/seed-demo.ts
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { workflowTemplates } from "@/db/schema/workflows";
import { organizations } from "@/db/schema/users";
// ...

async function main() {
  const demoOrg = await db.query.organizations.findFirst({
    where: eq(organizations.name, "Demo Org"),
  });
  if (!demoOrg) throw new Error("demo org missing; run db:seed first");

  const tplBreakingNews = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, demoOrg.id),
      eq(workflowTemplates.legacyScenarioKey, "breaking_news"),
    ),
  });
  // ... 其他 5 条 demo mission seed

  // 2 条 custom workflow
  await db.insert(workflowTemplates).values([
    { /* custom 1 with rich input_fields */ },
    { /* custom 2 launchMode=direct */ },
  ]).onConflictDoNothing();
}
```

用固定 UUID（`crypto.randomUUID()` 前转 deterministic seed）保证幂等。

- [ ] **Step 2: package.json 加 script**

```json
"db:seed:demo": "npx tsx src/db/seed-demo.ts"
```

- [ ] **Step 3: 运行并验证**

Run: `npm run db:seed:demo`
Verify：`/missions` 页面显示 6 条 demo mission，`/workflows` 显示 2 条 custom workflow。

- [ ] **Step 4: Commit**

```bash
git add src/db/seed-demo.ts package.json
git commit -m "feat(seed): demo missions + custom workflows for development"
```

---

### Task 6.2: `CLAUDE.md` 更新 + B.2 spec 归档

**Files:**
- Modify: `CLAUDE.md`（"Scenario/Workflow 统一架构（B.1）" 章节）
- Move: `docs/superpowers/specs/2026-04-19-scenario-legacy-cleanup-spec.md` → `docs/superpowers/archive/`

- [ ] **Step 1: 更新章节标题 + 内容**

把 "Scenario/Workflow 统一架构（B.1）" 改为 "Scenario/Workflow 统一架构（B.1 + B.2 合并完成，2026-04-20）"，移除 "B.2 Pending" 段落，更新数据流描述（workflowTemplateId + input_params 为主）。

- [ ] **Step 2: 归档 B.2 spec**

```bash
mkdir -p docs/superpowers/archive
git mv docs/superpowers/specs/2026-04-19-scenario-legacy-cleanup-spec.md docs/superpowers/archive/
```

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "docs: update CLAUDE.md for B.1+B.2 merge; archive B.2 spec"
```

---

### Task 6.3: 全链路验收

- [ ] **Step 1: Build**
Run: `npm run build` → 通过

- [ ] **Step 2: Lint**
Run: `npm run lint` → 通过

- [ ] **Step 3: Test**
Run: `npm test` → 通过（至少 Task 0.4 / 0.5 的单测 + 任何既有测试）

- [ ] **Step 4: Inngest 端到端冒烟**

起两个终端：
```bash
# 终端 1
npm run dev
# 终端 2
npx inngest-cli@latest dev
```

然后从 `/home` 启动一个 `launchMode=form` 预设（如 `xiaolei.breaking_news`），填字段提交。在 Inngest dashboard（`http://localhost:8288`）观察：
- [ ] `mission/created` event 触发成功
- [ ] `leader-plan` function 接到并分解出 ≥ 1 个 task
- [ ] mission 状态从 `queued` 流转至少到 `planning` 或 `executing`

若 Leader 分解空任务或报错，查日志排查（通常是 template.inputFields vs input_params 字段名不一致）。

- [ ] **Step 5: 冒烟 checklist**

访问并验证：
- [ ] `/home` 9 tab 切换正常；某员工 tab 若无模板显示空态 UI
- [ ] 点击任一员工卡片（launchMode=form）弹 WorkflowLaunchDialog，提交后跳 `/missions/{id}`
- [ ] 点击 `小数/日报生成`（launchMode=direct）直接跳 mission 页
- [ ] `/workflows` 列表正常；进入任一编辑页 InputFieldsEditor 可增删字段
- [ ] `/scenarios/customize` → 308 redirect 到 `/workflows`
- [ ] `/inspiration` 点击热点卡片 `追热点` 不弹场景选择器，直接走 default template
- [ ] `/missions` 行显示 template.name 作为场景列
- [ ] `rg "SCENARIO_CONFIG|ADVANCED_SCENARIO_CONFIG"` 0 命中

- [ ] **Step 5: Commit**（如有文档小改）

```bash
git commit --allow-empty -m "chore: Phase 6 verification complete"
```

---

## 汇总风险点回顾

- **Phase 3 引爆 tsc**：这是故意设计。Phase 4 各 task 期间允许 tsc red；Phase 4 结束时必须归零。Phase 0 的 `phase3-errors.txt` 是 Phase 4 的 done-checklist。
- **LLM 行为漂移**：Task 0.6 捕获 baseline，Task 4.7 对比 diff。人工审阅，差异不匹配则修 prompt template。
- **Seed 引用不存在的 skill**：Task 1.1 Step 1 捕获老 skill 列表；新 seed 写入后跑 `rg "skillSlug:" src/db/seed-builtin-workflows.ts | sort -u` 对照 `skills/*/` 目录存在性。缺失者等 SKILL.md subagent 补齐（本 plan 不阻塞）。
- **demo seed 污染**：严格用 fixed UUID + onConflictDoNothing；`db:seed` 默认不跑 demo。

---

## Plan 使用提示

- 每个 Task 的 Step 都必须按顺序执行；**不要跳过 tsc/test 步骤**。
- **在 feature branch 做全部 Phase 0-6**：本 plan 的 Phase 3 故意让 `tsc` 大面积报错以引 Phase 4 清理，在 main 上会让其他人踩坑。建议：
  ```bash
  git checkout -b feature/scenario-workflow-realignment
  # 全部 phase 完成并 tsc/build 归零后再合
  ```
- Phase 0 / 1 / 2 可并行在不同子 PR 推进（互不依赖）；Phase 3 必须在 Phase 2 完成后做（否则 UI 会 red）；Phase 4 顺 Phase 3；Phase 6 最后。
- **Task 依赖**：
  - Task 2.1 依赖 Task 0.5（validateInputs）
  - Task 2.3 依赖 Task 2.1 + Task 2.2 + Task 1.10（首页要有 seed 才能看出效果）
  - Phase 4 所有 Task 依赖 Task 3.1（常量删除引爆 tsc，构成 Phase 4 checklist）
- 每个 Task 一个 commit（TDD 任务可多 commit：test fail / test pass 各一）。
- commit message 风格对齐仓库既有：中文前缀式（`feat(xxx): ...` / `refactor: ...`），本 plan 中的英文示例仅作结构参考，实际写 commit 时按中文 convention。
- Golden Mission 对比发现的 Leader 分解语义 drift 若无法接受，回滚 Phase 4 相关 commits 到 Phase 3 状态再评估。
