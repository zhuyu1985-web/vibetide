# 领域一等维度 · P2 前端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 P1 已落地的「领域一等维度」后端能力接上 UI 数据来源——员工配置页/花名册/创建流改用 `domains` 字典写 `ai_employees.domain_id`，新增领域字典管理（口径包编辑），并让工作流编排器配置领域（场景默认+节点覆盖）真正驱动 P1 的双因子派单。

**Architecture:** 四个独立可交付的 commit，每个 `npx tsc --noEmit` + `npm run build` 通过。① 接断层（types + DAL + seed + 配置页下拉 + action 写 domain_id）；② 领域字典管理 UI（`/settings/domains` CRUD + 口径包）；③ 花名册工种→领域两级（筛选/徽章 + 创建流领域下拉）；④ 编排领域徽章 + 派单接通（`workflow_templates.defaultDomainId` 列 + `step.config.domainId` + 解析 `节点>场景>空` 传给已就绪的 `pickEmployeeForStep`）。

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Drizzle ORM + Supabase Postgres, React 19, shadcn/ui + Tailwind v4, Vitest。本地库用 `npm run db:push`（不 `db:migrate`）。

**Spec（设计依据，不重复）:** [`docs/superpowers/specs/2026-06-18-domain-form-first-class-and-capability-center-design.md`](../specs/2026-06-18-domain-form-first-class-and-capability-center-design.md)（§6.1 选员工两级 / §6.2 编排徽章 / §6.4 领域字典 / §9 P2 范围）。Handoff：[`2026-06-19-domain-p2-frontend-handoff.md`](2026-06-19-domain-p2-frontend-handoff.md)。

**P1 边界（已完成，别重做）:** `domains` 表（含 `prompt_guidance`/`authority_sources`）、`ai_employees.domain_id`（[schema:91](../../../src/db/schema/ai-employees.ts:91)，nullable）、`mission_tasks.domain_fallback`（[schema:122](../../../src/db/schema/missions.ts:122)）、`pickEmployeeForStep` 双因子+fallback（[mission-core.ts:179-191](../../../src/lib/mission-core.ts:179)，**param 类型已声明 `config.domainId`**）、`domainFallback` 已落表（[leader-plan.ts:118](../../../src/inngest/functions/leader-plan.ts:118) / [mission-executor.ts:258](../../../src/lib/mission-executor.ts:258)）、`getDomainById` 口径包注入 Layer 4.5、`web_search` `includeDomains`。

---

## 关键洞察（决定本计划的形状）

1. **`pickEmployeeForStep` 已完整实现领域第二因子**——包括 `config.domainId` 参数、领域缩池、fallback 标注、`domainFallback` 返回，且 caller 已把 `domainFallback` 写进 `mission_tasks`。**Commit 4 唯一缺的是「往 `step.config.domainId` 填入解析后的值」**——加字段 + 加列 + 解析 `节点>场景>空` + 编排器 UI。改动集中、风险低。
2. **`domain_id` 列已存在**，配置页只是从没写过它（一直写 `instanceConfig.domainTags`）。接断层 = 改 action 写列 + 配置页换下拉。
3. **测试哲学**（项目现状）：DAL/DB 查询函数**不**做 mock 单测，只对**纯函数**用内存 fixture 单测（见 [workflow-templates-listing.test.ts](../../../src/lib/dal/__tests__/workflow-templates-listing.test.ts)）。故本计划 TDD 聚焦纯函数 `resolveStepDomainId`，DAL/UI 走 tsc + build + 手动验证。
4. **编排器真实保存路径是 `saveWorkflow`/`updateWorkflow`**（[workflow-engine.ts:273](../../../src/app/actions/workflow-engine.ts:273)/[:341](../../../src/app/actions/workflow-engine.ts:341)），**不是** `createWorkflowTemplate`/`updateWorkflowTemplate`（legacy CRUD）。

---

## Pre-flight：工作区卫生（开工前必做）

工作区有大量未提交改动（cowork-client / skills-client / globals.css / 删除的 png 与 shared 组件等，属另一桩 UI/动画重构 WIP）。其中**两个文件与 P2 重叠**，必须先决定怎么处理（`git add` 是文件级，提交我的改动会连带暂存这两处既有 hunk）：

- `src/lib/types.ts` —— 既有改动：给 `Skill` 接口加 `kind?`/`compatibleRoles?`（4 行）。P2 要给**另一个**接口 `AIEmployee` 加 `domainId?`（不同行，无文本冲突）。
- `src/app/(dashboard)/employee/[id]/page.tsx` —— 既有改动：`listTemplatesForHomepageByTab` → `listTemplatesByOwnerEmployee`（import 替换）。P2 要加 `listDomainsByOrg` 取数 + 传 prop。

- [ ] **决定策略**（owner 拍板，三选一）：
  - (A) **吸收**：让这两处微小既有 hunk 随 commit 1 一起进（最简单，但 domain commit 多带 2 行无关改动）。
  - (B) **先单独提交**：把这两个文件的既有改动作为一个 `chore` 预备 commit 落 main，再在其上做 P2（历史最干净，但提交了别人的 WIP 片段）。
  - (C) **暂存隔离**：`git stash push -- src/lib/types.ts "src/app/(dashboard)/employee/[id]/page.tsx"`，P2 完成后 `git stash pop`（需手动解决 P2 已改这两文件的冲突）。
  - **推荐 (A)**：两处都是同一员工/技能域的良性小改，吸收进 commit 1 最省事、风险最低。
- [ ] **每次 commit 用精确 `git add <file列表>`**，绝不 `git add -A`（避免扫入无关 WIP）。
- [ ] 工作分支：单线程顺序开发，**直接落 `main`**（符合 CLAUDE.md「常规改动直接落 main」）。

---

## File Structure（创建 / 修改 总览）

**Create:**
- `src/lib/domains-defaults.ts` — `DEFAULT_DOMAINS` 常量（8 个领域，财经/体育/时政带初始口径包）+ `DomainSeed` 类型
- `src/lib/dal/__tests__/domains-defaults.test.ts` — `DEFAULT_DOMAINS` 形状纯测（slug 唯一/必填）
- `src/lib/__tests__/resolve-step-domain.test.ts` — `resolveStepDomainId` 纯函数 TDD
- `src/app/actions/domains.ts` — `"use server"` 领域 CRUD + seed actions
- `src/app/(dashboard)/settings/domains/page.tsx` — server page
- `src/app/(dashboard)/settings/domains/domains-client.tsx` — 字典管理 client（DataTable + 编辑 Dialog）

**Modify:**
- `src/lib/dal/domains.ts` — 加 `listDomainsByOrg` + CRUD + `seedDefaultDomainsForOrg`
- `src/lib/types.ts` — `AIEmployee.domainId?`；新增 `DomainOption` / `DomainRecord` 类型
- `src/lib/dal/employees.ts` — 三个查询的字段映射加 `domainId`
- `src/app/actions/employees.ts` — `updateEmployeeInstanceConfig` 写 `domainId`（停写 domainTags）
- `src/app/actions/custom-employees.ts` — `createCustomEmployee`（[:46](../../../src/app/actions/custom-employees.ts:46)）接 `domainId`
- `src/app/(dashboard)/employee/[id]/page.tsx` — 取 `listDomainsByOrg` 传 client
- `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx` — 领域 Tab 换 `<Select>`
- `src/app/(dashboard)/ai-employees/page.tsx` + `ai-employees-client.tsx` — 领域筛选 + 卡片徽章
- `src/app/(dashboard)/ai-employees/create/page.tsx` + `create-employee-client.tsx` — step0 领域 `<Select>`
- `src/db/schema/workflows.ts` — `WorkflowStepDef.config.domainId?` + `workflowTemplates.defaultDomainId` 列
- `src/lib/mission-core.ts` — 新增导出纯函数 `resolveStepDomainId`
- `src/app/actions/workflow-engine.ts` — `saveWorkflow`/`updateWorkflow` 接 `defaultDomainId`
- `src/components/workflows/workflow-editor.tsx` — 场景默认领域 `<Select>` + state + 入 save payload
- `src/components/workflows/step-card.tsx` — 节点领域徽章
- `src/components/workflows/step-detail-panel.tsx` — 节点领域覆盖 `<Select>`
- `src/app/(dashboard)/workflows/[id]/edit/page.tsx` — 取 domains 传编辑器
- `src/lib/mission-executor.ts` — 解析 `defaultDomainId` → effective step
- `src/inngest/functions/leader-plan.ts` — `templateInfo` 带 `defaultDomainId` → effective step
- `src/app/api/workflows/test-run/route.ts` — 可选 `defaultDomainId`（lower priority）
- `src/components/layout/app-sidebar.tsx` + `topbar.tsx` — `/settings/domains` 导航

---

# Commit 1 — 接断层（最高优先）

**目标**：配置页领域从「domainTags 自由标签」硬切到「domains 字典单选下拉，写 `domain_id`」；DAL 出 `listDomainsByOrg`；seed 一批默认领域让下拉立即有数据。完成后 P1 的领域派单/口径包**第一次有了 UI 数据来源**。

### Task 1.1：`DEFAULT_DOMAINS` 常量 + 纯测

**Files:** Create `src/lib/domains-defaults.ts`, `src/lib/dal/__tests__/domains-defaults.test.ts`

- [ ] **Step 1：写失败测试** `src/lib/dal/__tests__/domains-defaults.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_DOMAINS } from "@/lib/domains-defaults";

describe("DEFAULT_DOMAINS", () => {
  it("slug 全局唯一", () => {
    const slugs = DEFAULT_DOMAINS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("每条都有 slug + name", () => {
    for (const d of DEFAULT_DOMAINS) {
      expect(d.slug).toBeTruthy();
      expect(d.name).toBeTruthy();
    }
  });
  it("财经带口径包（promptGuidance + 权威源）", () => {
    const fin = DEFAULT_DOMAINS.find((d) => d.slug === "finance");
    expect(fin?.promptGuidance).toBeTruthy();
    expect((fin?.authoritySources ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2：跑测试确认失败** — `npx vitest run src/lib/dal/__tests__/domains-defaults.test.ts`，预期 FAIL（模块不存在）。

- [ ] **Step 3：实现** `src/lib/domains-defaults.ts`

```ts
/**
 * 领域一等维度 · 默认领域字典（P2）。
 * seedDefaultDomainsForOrg 用它幂等播种到 org。财经/体育/时政带初始口径包
 * （promptGuidance 注入 Layer 4.5；authoritySources 喂 web_search includeDomains），
 * 其余先给名称，运营在 /settings/domains 补口径包。
 */
export interface DomainSeed {
  slug: string;
  name: string;
  description?: string;
  promptGuidance?: string;
  authoritySources?: string[];
  sortOrder: number;
}

export const DEFAULT_DOMAINS: DomainSeed[] = [
  {
    slug: "finance",
    name: "财经",
    description: "财经/金融/产业经济报道",
    promptGuidance:
      "不作任何投资建议、不荐股；财务与市场数据以证监会、交易所、央行等官方披露为准；严格区分「预测/观点」与「已发生的事实」，引用数据须标来源与时点。",
    authoritySources: ["csrc.gov.cn", "sse.com.cn", "szse.cn", "pbc.gov.cn", "stats.gov.cn"],
    sortOrder: 10,
  },
  {
    slug: "sports",
    name: "体育",
    description: "赛事/体育产业报道",
    promptGuidance:
      "比分、赛程、转会以赛事官方/俱乐部官方发布为准；不传播未经证实的转会与伤病传闻；运动员称谓规范、不带主观贬损。",
    authoritySources: ["fifa.com", "olympics.com", "the-afc.com"],
    sortOrder: 20,
  },
  {
    slug: "politics",
    name: "时政",
    description: "时政/政务报道",
    promptGuidance:
      "严守称谓与职务排序规范；政策表述以权威发布原文为准，不演绎、不简化关键定性；涉敏感议题保持中性、不臆测。",
    authoritySources: ["gov.cn", "xinhuanet.com", "people.com.cn"],
    sortOrder: 30,
  },
  { slug: "society", name: "社会", description: "社会民生新闻", sortOrder: 40 },
  { slug: "livelihood", name: "民生", description: "民生服务/消费", sortOrder: 50 },
  { slug: "law", name: "法治", description: "法治/司法报道", sortOrder: 60 },
  { slug: "tech", name: "科技", description: "科技/互联网/AI", sortOrder: 70 },
  { slug: "entertainment", name: "文娱", description: "文化/娱乐/影视", sortOrder: 80 },
];
```

- [ ] **Step 4：跑测试确认通过** — `npx vitest run src/lib/dal/__tests__/domains-defaults.test.ts`，预期 PASS。

### Task 1.2：DAL `listDomainsByOrg` + CRUD + `seedDefaultDomainsForOrg`

**Files:** Modify `src/lib/dal/domains.ts`

- [ ] **Step 1：扩展 DAL**——在 `getDomainById` 之外追加（保持现有 import 风格，新增 `and`/`asc`/`onConflictDoNothing` 所需）：

```ts
import { db } from "@/db";
import { domains } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { DEFAULT_DOMAINS } from "@/lib/domains-defaults";
import type { DomainRecord } from "@/lib/types";

// ... 既有 getDomainById 保留 ...

/** 列出 org 下所有领域（按 sortOrder, name）。供配置页下拉 / 字典管理 / 编排器。 */
export async function listDomainsByOrg(orgId: string): Promise<DomainRecord[]> {
  if (!orgId) return [];
  const rows = await db
    .select({
      id: domains.id,
      slug: domains.slug,
      name: domains.name,
      description: domains.description,
      promptGuidance: domains.promptGuidance,
      authoritySources: domains.authoritySources,
      sortOrder: domains.sortOrder,
    })
    .from(domains)
    .where(eq(domains.organizationId, orgId))
    .orderBy(asc(domains.sortOrder), asc(domains.name));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    promptGuidance: r.promptGuidance,
    authoritySources: (r.authoritySources as string[] | null) ?? [],
    sortOrder: r.sortOrder ?? 0,
  }));
}

/** 幂等播种默认领域（org+slug 唯一索引 domains_org_slug_uidx → onConflictDoNothing）。返回新插入条数。 */
export async function seedDefaultDomainsForOrg(orgId: string): Promise<number> {
  if (!orgId) return 0;
  const res = await db
    .insert(domains)
    .values(
      DEFAULT_DOMAINS.map((d) => ({
        organizationId: orgId,
        slug: d.slug,
        name: d.name,
        description: d.description ?? null,
        promptGuidance: d.promptGuidance ?? null,
        authoritySources: d.authoritySources ?? [],
        sortOrder: d.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: [domains.organizationId, domains.slug] })
    .returning({ id: domains.id });
  return res.length;
}

export async function createDomain(orgId: string, input: {
  slug: string; name: string; description?: string | null;
  promptGuidance?: string | null; authoritySources?: string[]; sortOrder?: number;
}): Promise<DomainRecord> {
  const [row] = await db.insert(domains).values({
    organizationId: orgId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    promptGuidance: input.promptGuidance ?? null,
    authoritySources: input.authoritySources ?? [],
    sortOrder: input.sortOrder ?? 0,
  }).returning();
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    promptGuidance: row.promptGuidance,
    authoritySources: (row.authoritySources as string[] | null) ?? [],
    sortOrder: row.sortOrder ?? 0,
  };
}

export async function updateDomain(orgId: string, domainId: string, patch: {
  name?: string; description?: string | null;
  promptGuidance?: string | null; authoritySources?: string[]; sortOrder?: number;
}): Promise<void> {
  await db.update(domains).set(patch)
    .where(and(eq(domains.id, domainId), eq(domains.organizationId, orgId)));
}

export async function deleteDomain(orgId: string, domainId: string): Promise<void> {
  await db.delete(domains)
    .where(and(eq(domains.id, domainId), eq(domains.organizationId, orgId)));
}
```

> 注：`createDomain`/`updateDomain`/`deleteDomain` 是 DB 写操作，按项目惯例不做 mock 单测，由 server action 的 auth/org 校验包裹（Task 2.x）+ build + 手动验证。slug 仅在 `createDomain` 设；`updateDomain` 不改 slug（避免破坏历史引用）。

- [ ] **Step 2：类型补充** `src/lib/types.ts`——在 `EmployeeInstanceConfig`（[:474](../../../src/lib/types.ts:474)）附近新增：

```ts
/** 领域字典记录（P2，供下拉/管理/编排器）。 */
export interface DomainRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  promptGuidance: string | null;
  authoritySources: string[];
  sortOrder: number;
}
/** 下拉用精简形态。 */
export type DomainOption = Pick<DomainRecord, "id" | "name">;
```

- [ ] **Step 3：tsc** — `npx tsc --noEmit`，预期 0 error。

### Task 1.3：`AIEmployee.domainId` + employees DAL 取 `domainId`

**Files:** Modify `src/lib/types.ts`, `src/lib/dal/employees.ts`

- [ ] **Step 1：类型**——`AIEmployee` 接口（[:18](../../../src/lib/types.ts:18) `instanceConfig` 附近）加：

```ts
  /** 领域一等维度（P2）：ai_employees.domain_id。null = 通用/不限领域。 */
  domainId?: string | null;
```

（`EmployeeFullProfile extends AIEmployee` 自动继承，无需另改。）

- [ ] **Step 2：DAL 三处映射加 `domainId`**——`getEmployees`（[:70](../../../src/lib/dal/employees.ts:70) `instanceConfig` 行旁）、`getEmployee`（[:121](../../../src/lib/dal/employees.ts:121) 返回对象）、`getEmployeeFullProfile`（[:203](../../../src/lib/dal/employees.ts:203) `instanceConfig` 行旁）的返回对象各加：

```ts
      domainId: emp.domainId ?? null,
```

（三处都用 `db.query.aiEmployees.findMany/findFirst` 取整行，`emp.domainId` 列已存在，直接映射即可。）

- [ ] **Step 3：tsc** — `npx tsc --noEmit`，预期 0 error。

### Task 1.4：`updateEmployeeInstanceConfig` 写 `domain_id`（硬切 domainTags）

**Files:** Modify `src/app/actions/employees.ts`

- [ ] **Step 1：改 action**（[:208](../../../src/app/actions/employees.ts:208)）——签名加 `domainId`，写入时**同时**写 `domainId` 列 + `instanceConfig`（不再含 `domainTags`）：

```ts
export async function updateEmployeeInstanceConfig(
  employeeId: string,
  config: {
    domainId?: string | null;
    mediaForm?: "news" | "newmedia" | "convergence";
    platformSpecs?: { channels?: string[]; formatRules?: Record<string, unknown> };
  }
) {
  await requireAuth();
  await requireOwnedEmployee(employeeId);

  await db
    .update(aiEmployees)
    .set({
      domainId: config.domainId ?? null,
      // 硬切：instanceConfig 不再写 domainTags（列保留向后兼容，P3 清）。
      instanceConfig: {
        mediaForm: config.mediaForm,
        platformSpecs: config.platformSpecs,
      },
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  import("@/app/actions/employee-advanced")
    .then((m) =>
      m.saveEmployeeConfigVersion(employeeId, ["domainId", "instanceConfig"], "领域/形态配置更新"),
    )
    .catch(() => {});
  revalidatePath("/employee");
}
```

- [ ] **Step 2：tsc** — `npx tsc --noEmit`，预期 0 error（此时配置页 client 仍传 `domainTags`，类型已不接受 → 故意 break，由 Task 1.5 修；或先放 client 不动会报错——按下面顺序：本步只确认 action 本身类型对，client 在 1.5 同 commit 内改完再整体 tsc）。

### Task 1.5：配置页领域 Tab 换 `<Select>` 下拉

**Files:** Modify `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`, `src/app/(dashboard)/employee/[id]/page.tsx`

- [ ] **Step 1：server page 取 domains 传 client**——`page.tsx` 加 import `listDomainsByOrg`，在已有 `orgId` 解析后取 `domains`，传给 `<EmployeeProfileClient domains={domains} ... />`：

```ts
import { listDomainsByOrg } from "@/lib/dal/domains";
// ... orgId 已解析后：
const domains = orgId ? await withTimeout(listDomainsByOrg(orgId), []) : [];
// ... <EmployeeProfileClient ... domains={domains} />
```

- [ ] **Step 2：client props + state**——`EmployeeProfileClientProps` 加 `domains?: DomainRecord[]`（import 类型）；解构默认 `domains = []`。删除 `PRESET_DOMAINS`（[:152](../../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:152)）、`domainTags`/`newDomainTag` state（[:213-216](../../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:213)），新增：

```ts
  const [domainId, setDomainId] = useState<string | null>(employee.domainId ?? null);
```

- [ ] **Step 3：换 UI**——领域专精 GlassCard 内（[:1097-1140](../../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:1097) 的标签云 + 自定义输入整块）替换为单选下拉（沿用文件内既有 `<Select>` 用法，**不加边框/不覆盖颜色**）：

```tsx
<Select
  value={domainId ?? "none"}
  onValueChange={(v) => setDomainId(v === "none" ? null : v)}
>
  <SelectTrigger className="glass-input max-w-xs">
    <SelectValue placeholder="选择领域" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">不限领域（通用）</SelectItem>
    {domains.map((d) => (
      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
{domains.length === 0 && (
  <p className="text-[11px] text-amber-500 mt-2">
    尚无领域字典，去 <a className="underline" href="/settings/domains">领域管理</a> 创建或导入默认领域。
  </p>
)}
```

- [ ] **Step 4：改 save handler**（[:275](../../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:275)）——`updateEmployeeInstanceConfig(employee.dbId, { domainId, mediaForm, platformSpecs })`，去掉 `domainTags`。

- [ ] **Step 5：tsc + build** — `npx tsc --noEmit` 0 error；`npm run build` 通过。

### Task 1.6：本地播种 + 手动验证 + commit

- [ ] **Step 1：本地 db:push**（domains 表 P1 已建，无新列；此步确保 schema 同步）——`npm run db:push`。
- [ ] **Step 2：给 dev org 播种默认领域**——临时脚本或在 `db:seed` 流程调用 `seedDefaultDomainsForOrg(orgId)`；或直接进下一步用字典管理页（commit 2）的「导入默认领域」。本 commit 验证可临时跑：`npx tsx -e "..."` 调 `seedDefaultDomainsForOrg`（dev org id）。
- [ ] **Step 3：手动验证**——`npm run dev`，进某员工配置页「领域·媒体形态」Tab，下拉出现 8 个领域，选「财经」保存，刷新后仍选中；DB 查 `ai_employees.domain_id` 已写。
- [ ] **Step 4：commit**（精确 add；按 Pre-flight 策略 A 会带上 types.ts/page.tsx 既有微改）：

```bash
git add src/lib/domains-defaults.ts \
        src/lib/dal/__tests__/domains-defaults.test.ts \
        src/lib/dal/domains.ts \
        src/lib/types.ts \
        src/lib/dal/employees.ts \
        src/app/actions/employees.ts \
        "src/app/(dashboard)/employee/[id]/page.tsx" \
        "src/app/(dashboard)/employee/[id]/employee-profile-client.tsx"
git commit -m "$(cat <<'EOF'
feat(domain): P2 接断层 — 配置页领域改 domains 字典下拉写 domain_id

- domains DAL 加 listDomainsByOrg / createDomain / updateDomain / deleteDomain / seedDefaultDomainsForOrg
- DEFAULT_DOMAINS 默认领域（财经/体育/时政带初始口径包）
- AIEmployee.domainId + employees DAL 三查询取 domainId
- updateEmployeeInstanceConfig 写 domain_id 列（硬切 domainTags，列保留）
- 员工配置页领域 Tab：自由标签 → domains 字典单选下拉

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

# Commit 2 — 领域字典管理 UI（口径包编辑）

**目标**：`/settings/domains` 提供 domains CRUD + 口径包编辑（`promptGuidance` 多行 / `authoritySources` 域名标签）+ 空态「导入默认领域」。这是运营调领域差异化的主抓手，也让 P1 的口径包有了可编辑数据源。

### Task 2.1：server actions

**Files:** Create `src/app/actions/domains.ts`

- [ ] **Step 1：实现**（第一行 `"use server"`；auth + org 校验，复用 `getCurrentUserOrg`；DAL 在 Task 1.2 已就绪）：

```ts
"use server";

import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createDomain, updateDomain, deleteDomain, seedDefaultDomainsForOrg } from "@/lib/dal/domains";
import { revalidatePath } from "next/cache";

async function orgOrThrow() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

function slugify(name: string): string {
  const ascii = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii || `domain-${Date.now().toString(36)}`;
}

export async function createDomainAction(input: {
  name: string; slug?: string; description?: string;
  promptGuidance?: string; authoritySources?: string[]; sortOrder?: number;
}) {
  const orgId = await orgOrThrow();
  if (!input.name?.trim()) throw new Error("领域名称必填");
  const d = await createDomain(orgId, {
    slug: input.slug?.trim() || slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    promptGuidance: input.promptGuidance?.trim() || null,
    authoritySources: input.authoritySources ?? [],
    sortOrder: input.sortOrder ?? 0,
  });
  revalidatePath("/settings/domains");
  return d;
}

export async function updateDomainAction(domainId: string, patch: {
  name?: string; description?: string;
  promptGuidance?: string; authoritySources?: string[]; sortOrder?: number;
}) {
  const orgId = await orgOrThrow();
  await updateDomain(orgId, domainId, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
    ...(patch.promptGuidance !== undefined ? { promptGuidance: patch.promptGuidance.trim() || null } : {}),
    ...(patch.authoritySources !== undefined ? { authoritySources: patch.authoritySources } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  });
  revalidatePath("/settings/domains");
}

export async function deleteDomainAction(domainId: string) {
  const orgId = await orgOrThrow();
  await deleteDomain(orgId, domainId);
  revalidatePath("/settings/domains");
}

export async function seedDefaultDomainsAction() {
  const orgId = await orgOrThrow();
  const n = await seedDefaultDomainsForOrg(orgId);
  revalidatePath("/settings/domains");
  return { inserted: n };
}
```

> 删除领域注意：`ai_employees.domain_id` / `workflow_templates.default_domain_id` 是 `references(domains.id)` **无 onDelete cascade**，被引用时 DB 抛外键约束错。`deleteDomainAction` 暂依赖 DB 报错（捕获后 UI 提示「该领域仍被员工/场景引用，无法删除」）。

- [ ] **Step 2：tsc** — `npx tsc --noEmit`，预期 0 error。

### Task 2.2：字典管理页

**Files:** Create `src/app/(dashboard)/settings/domains/page.tsx`, `domains-client.tsx`

- [ ] **Step 1：server page**（org 级访问，非 super-admin-only；`force-dynamic`）：

```tsx
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { requireAuth } from "@/lib/auth";
import { listDomainsByOrg } from "@/lib/dal/domains";
import { DomainsClient } from "./domains-client";

export const dynamic = "force-dynamic";

export default async function DomainsSettingsPage() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  const domains = orgId ? await listDomainsByOrg(orgId) : [];
  return <DomainsClient domains={domains} />;
}
```

- [ ] **Step 2：client**——`"use client"`。用 `<PageHeader>` + `<DataTable>`（列：名称/slug/口径包是否配置/权威源数/排序）+ 新建/编辑 `<Dialog>`（`<Input>` 名称、`<Textarea>` promptGuidance、域名标签输入 authoritySources、`<Input type=number>` sortOrder）+ 空态「导入默认领域」按钮调 `seedDefaultDomainsAction`。

  关键约束（CLAUDE.md 设计系统）：
  - 用共享 `Button`/`Input`/`Textarea`/`DataTable`/`PageHeader`/`GlassCard`/`Dialog`，**不手搓**；可点击元素**不带边框**；**不**用 `className` 覆盖共享组件颜色。
  - Dialog 内若有 `overflow-y-auto` 列表用**固定高度** `h-[...]`，不用 `max-h-`。
  - 域名标签输入：复用配置页既有「Badge + X 删除 + Input 回车添加」模式（参考 [employee-profile-client.tsx:1171-1204](../../../src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:1171) 的 platformChannels 实现）。
  - authoritySources 录入做轻校验：strip `https://`/`http://`/路径，只留域名（如 `csrc.gov.cn`）。

- [ ] **Step 3：导航入口**——`src/components/layout/app-sidebar.tsx`（[:79](../../../src/components/layout/app-sidebar.tsx:79) scheduled-jobs 项旁）加 `{ label: "领域", href: "/settings/domains", icon: <合适的 lucide icon，如 Tag/Layers> }`；`src/components/layout/topbar.tsx`（[:37](../../../src/components/layout/topbar.tsx:37) 和 [:67](../../../src/components/layout/topbar.tsx:67) 两处标题 map）加 `"/settings/domains": "领域"`。

- [ ] **Step 4：tsc + build** — `npx tsc --noEmit` 0 error；`npm run build` 通过。

- [ ] **Step 5：手动验证**——进 `/settings/domains`，空态点「导入默认领域」→ 8 条出现；新建一个领域填口径包；编辑财经的 promptGuidance；删除一个**被引用**的领域应提示无法删除。

- [ ] **Step 6：commit**

```bash
git add src/app/actions/domains.ts \
        "src/app/(dashboard)/settings/domains/page.tsx" \
        "src/app/(dashboard)/settings/domains/domains-client.tsx" \
        src/components/layout/app-sidebar.tsx \
        src/components/layout/topbar.tsx
git commit -m "$(cat <<'EOF'
feat(domain): P2 领域字典管理 UI（/settings/domains + 口径包编辑）

- domains CRUD server actions（auth+org 校验，slug 自动派生，删除外键保护提示）
- /settings/domains：DataTable + 编辑 Dialog（promptGuidance 多行 / authoritySources 域名标签 / sortOrder）
- 空态「导入默认领域」一键 seed
- 侧栏 + 顶栏导航入口

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

# Commit 3 — 花名册工种→领域两级

**目标**：`/ai-employees`（已按工种分组）加领域筛选 + 卡片领域徽章；`/ai-employees/create` step0 选完工种后选领域（写 domain_id）。范围限花名册+配置页+创建流（对话中心/节点 picker 顺延 P2.1，spec §9）。

### Task 3.1：花名册领域筛选 + 卡片徽章

**Files:** Modify `src/app/(dashboard)/ai-employees/page.tsx`, `ai-employees-client.tsx`

- [ ] **Step 1：page 传 domains**——`page.tsx` 已取 `employees` + `orgId`；加 `listDomainsByOrg(orgId)` 并入 `Promise.all`，`<AiEmployeesClient ... domains={domains} />`。
- [ ] **Step 2：client 领域筛选**——props 加 `domains: DomainRecord[]`；在现有状态筛选（[:45-52](../../../src/app/(dashboard)/ai-employees/ai-employees-client.tsx:45) 一带）旁加 `domainFilter` state + 一个领域 `<Select>`（「全部领域」+ 各领域 + 「不限领域」），`result.filter` 增加 `e.domainId === domainFilter`（"none" → `!e.domainId`）。工种分组逻辑不变（领域筛选先于分组）。
- [ ] **Step 3：卡片领域徽章**——`employee-agent-card.tsx`（或 client 内卡片渲染处）在工种徽章旁加领域徽章：用 `domainsById.get(e.domainId)?.name`，无则不渲染（通用）。需把 `domainsById: Map<string,string>` 或 domain 名传入卡片。徽章样式复用现有 `Badge variant="secondary"`，**不带边框**。
- [ ] **Step 4：tsc + build** — 0 error + 通过。

### Task 3.2：创建流 step0 领域下拉

**Files:** Modify `src/app/(dashboard)/ai-employees/create/page.tsx`, `create-employee-client.tsx`, `src/app/actions/custom-employees.ts`（`createCustomEmployee`，[:46](../../../src/app/actions/custom-employees.ts:46)）

- [ ] **Step 1：确认 `createCustomEmployee`**——在 `src/app/actions/custom-employees.ts:46`（client 经 [create-employee-client.tsx:11](../../../src/app/(dashboard)/ai-employees/create/create-employee-client.tsx:11) `import ... from "@/app/actions/custom-employees"`），当前接 `instanceConfig:{domainTags,...}`（[调用处 :190-204](../../../src/app/(dashboard)/ai-employees/create/create-employee-client.tsx:190)）。
- [ ] **Step 2：action 接 `domainId`**——`createCustomEmployee` 入参加 `domainId?: string | null`，insert `aiEmployees` 时写 `domainId` 列；`instanceConfig` 去掉 `domainTags`（硬切，与 commit 1 一致）。
- [ ] **Step 3：page 传 domains**——`create/page.tsx` 取 `listDomainsByOrg(orgId)` 传 client。
- [ ] **Step 4：client step0 领域 Select**——`create-employee-client.tsx` 加 `domainId` state；step0「工种与定位」选完 craft 后加领域 `<Select>`（选项来自 domains prop + 「不限领域」）；`handlePublish`（[:190](../../../src/app/(dashboard)/ai-employees/create/create-employee-client.tsx:190)）传 `domainId`，instanceConfig 去掉 `domainTags`。
  > ⚠ `domainTags` 不是单个 state——它是一条 prop 链：`useState`（:134）→ 传两个子步骤组件（:249 / :277，prop 类型 :364 / :749，渲染 :456-484）→ 确认页摘要展示（:796）。硬切时要把**整条链**一起删（state + 2 子 prop + 摘要渲染），否则 tsc 会连环报错。本期 create 流领域用单选 `domainId` 取代它。
- [ ] **Step 5：tsc + build + 手动验证**——创建一个「财经记者」（工种=记者 + 领域=财经），落库 `domain_id` 正确；花名册按领域筛选能筛出它，卡片显示财经徽章。
- [ ] **Step 6：commit**

```bash
git add "src/app/(dashboard)/ai-employees/page.tsx" \
        "src/app/(dashboard)/ai-employees/ai-employees-client.tsx" \
        "src/app/(dashboard)/ai-employees/create/page.tsx" \
        "src/app/(dashboard)/ai-employees/create/create-employee-client.tsx" \
        src/app/actions/custom-employees.ts
# 若卡片徽章改了 employee-agent-card.tsx 也一并 add
git commit -m "$(cat <<'EOF'
feat(domain): P2 花名册工种→领域两级（筛选/徽章 + 创建流领域下拉）

- /ai-employees 加领域筛选 Select + 卡片领域徽章
- 创建工种实例 step0 选完工种后选领域（写 domain_id，硬切 domainTags）
- createCustomEmployee 接 domainId

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

# Commit 4 — 编排领域徽章 + 派单接通

**目标**：`workflow_templates.defaultDomainId` 列 + `step.config.domainId`；编排器场景头部默认领域下拉 + 节点领域徽章（继承/覆盖）；解析 `节点>场景>空` 填进 `step.config.domainId` 传给已就绪的 `pickEmployeeForStep` → **P1 双因子派单 + domainFallback 落表第一次真正按编排领域生效**。

### Task 4.1：`resolveStepDomainId` 纯函数（TDD）

**Files:** Modify `src/lib/mission-core.ts`; Create `src/lib/__tests__/resolve-step-domain.test.ts`

- [ ] **Step 1：写失败测试** `src/lib/__tests__/resolve-step-domain.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveStepDomainId } from "@/lib/mission-core";

describe("resolveStepDomainId — 节点>场景>空", () => {
  it("节点 domainId 覆盖场景默认", () => {
    expect(resolveStepDomainId({ config: { domainId: "tech" } }, "finance")).toBe("tech");
  });
  it("节点无 → 回退场景默认", () => {
    expect(resolveStepDomainId({ config: {} }, "finance")).toBe("finance");
  });
  it("节点 config 整体缺失 → 场景默认", () => {
    expect(resolveStepDomainId({}, "finance")).toBe("finance");
  });
  it("都无 → null", () => {
    expect(resolveStepDomainId({ config: {} }, null)).toBeNull();
    expect(resolveStepDomainId({}, undefined)).toBeNull();
  });
  it("节点 domainId 为 null 视作未设 → 场景默认", () => {
    expect(resolveStepDomainId({ config: { domainId: null } }, "finance")).toBe("finance");
  });
});
```

- [ ] **Step 2：跑测试确认失败** — `npx vitest run src/lib/__tests__/resolve-step-domain.test.ts`，预期 FAIL（未导出）。

- [ ] **Step 3：实现**——`src/lib/mission-core.ts` 在 `pickEmployeeForStep` 上方/下方导出：

```ts
/**
 * 解析某 step 的有效领域：节点级 domainId > 场景默认 defaultDomainId > 空。
 * P1 的 pickEmployeeForStep 已消费 step.config.domainId；调用方用本函数算出有效值
 * 后填进 effective step 再派单。null 视作"未指定 → 派单不缩领域"。
 */
export function resolveStepDomainId(
  step: { config?: { domainId?: string | null } | null },
  templateDefaultDomainId?: string | null,
): string | null {
  return step.config?.domainId ?? templateDefaultDomainId ?? null;
}
```

- [ ] **Step 4：跑测试确认通过** — `npx vitest run src/lib/__tests__/resolve-step-domain.test.ts`，预期 PASS。

### Task 4.2：schema 加列/字段 + db:push

**Files:** Modify `src/db/schema/workflows.ts`

- [ ] **Step 1：`WorkflowStepDef.config` 加字段**（[:31-52](../../../src/db/schema/workflows.ts:31)）：

```ts
    /** 领域一等维度（P2）：节点级领域覆盖。空 = 继承场景默认 defaultDomainId。 */
    domainId?: string | null;
```

- [ ] **Step 2：`workflowTemplates` 加列**（[:62](../../../src/db/schema/workflows.ts:62) 表内，import `domains`）：

```ts
import { domains } from "./domains";
// ... 表字段内（如 legacyScenarioKey 附近）：
  defaultDomainId: uuid("default_domain_id").references(() => domains.id),
```

- [ ] **Step 3：db:push** — `npm run db:push`（本地加列）；跑 `bash scripts/verify-schema-sync.sh` 确认无 drift（若该脚本含 fingerprint 校验）。
- [ ] **Step 4：tsc** — `npx tsc --noEmit`（`WorkflowTemplateRow` 由 InferSelectModel 自动带 `defaultDomainId`；[workflow-templates-listing.test.ts](../../../src/lib/dal/__tests__/workflow-templates-listing.test.ts) 的 `mk()` fixture 已 `as unknown as` 不受影响）。

### Task 4.3：派单接通三个 call site

**Files:** Modify `src/lib/mission-executor.ts`, `src/inngest/functions/leader-plan.ts`, `src/app/api/workflows/test-run/route.ts`

- [ ] **Step 1：mission-executor**（[:184-202](../../../src/lib/mission-executor.ts:184)）——`tpl` 已加载；在 `defaultTeamSlugs`（[:188](../../../src/lib/mission-executor.ts:188)）后加 `const templateDefaultDomainId = (tpl.defaultDomainId as string | null) ?? null;`，import `resolveStepDomainId`，把循环里（[:202](../../../src/lib/mission-executor.ts:202)）改为传 effective step：

```ts
        const effectiveStep = {
          ...s,
          config: { ...(s.config ?? {}), domainId: resolveStepDomainId(s, templateDefaultDomainId) },
        };
        const picked = pickEmployeeForStep(effectiveStep, defaultTeamSlugs, employeesWithSkills);
```

（`picked.domainFallback` → task 写库已在 [:258](../../../src/lib/mission-executor.ts:258) 就绪，无需改。）

- [ ] **Step 2：leader-plan**（[:62-92](../../../src/inngest/functions/leader-plan.ts:62)）——`templateInfo` 的 return（[:73](../../../src/inngest/functions/leader-plan.ts:73)）加 `defaultDomainId: tpl.defaultDomainId ?? null`；在 `templateDefaultTeam`（[:77](../../../src/inngest/functions/leader-plan.ts:77)）后加 `const templateDefaultDomainId = templateInfo?.defaultDomainId ?? null;`；循环里（[:92](../../../src/inngest/functions/leader-plan.ts:92)）同样传 effective step（import `resolveStepDomainId`）。`domainFallback` 写库已在 [:118](../../../src/inngest/functions/leader-plan.ts:118)。

- [ ] **Step 3：test-run（lower priority）**（[:207](../../../src/app/api/workflows/test-run/route.ts:207)）——request body 可选 `defaultDomainId`；调用处传 `resolveStepDomainId(step, body.defaultDomainId ?? null)` 入 effective step。无 template 概念，仅支持 body 显式传入。

- [ ] **Step 4：tsc** — `npx tsc --noEmit` 0 error。

### Task 4.4：编排器场景默认领域 + 持久化

**Files:** Modify `src/app/actions/workflow-engine.ts`, `src/components/workflows/workflow-editor.tsx`, `src/app/(dashboard)/workflows/[id]/edit/page.tsx`

- [ ] **Step 1：save/update action 接 `defaultDomainId`**——`saveWorkflow`（[:273-282](../../../src/app/actions/workflow-engine.ts:273) data 类型）加 `defaultDomainId?: string | null`，insert values（[:291](../../../src/app/actions/workflow-engine.ts:291)）加 `...(data.defaultDomainId !== undefined ? { defaultDomainId: data.defaultDomainId } : {})`；`updateWorkflow`（[:343-352](../../../src/app/actions/workflow-engine.ts:341) data 类型）加 `defaultDomainId?: string | null`（`patch = {...data}` [:361](../../../src/app/actions/workflow-engine.ts:361) 自动带入 `.set`，确认 fork 分支也透传）。
- [ ] **Step 2：edit page 取 domains 传编辑器**——`workflows/[id]/edit/page.tsx` 取 `listDomainsByOrg(orgId)` 传 `<WorkflowEditor domains={domains} />`。
- [ ] **Step 3：编辑器场景默认领域 Select**——`workflow-editor.tsx` props 加 `domains: DomainRecord[]`；state `const [defaultDomainId, setDefaultDomainId] = useState<string|null>(initialData?.defaultDomainId ?? null)`；在头部 category Select 旁（[:390-408](../../../src/components/workflows/workflow-editor.tsx:390)）加「默认领域」`<Select>`（含「不限」）；`handleSave`（[:228](../../../src/components/workflows/workflow-editor.tsx:228) 和 [:253](../../../src/components/workflows/workflow-editor.tsx:253) 两个 payload）都加 `defaultDomainId`。
- [ ] **Step 4：tsc + build** — 0 error + 通过。

### Task 4.5：节点领域徽章 + 覆盖编辑

**Files:** Modify `src/components/workflows/step-card.tsx`, `src/components/workflows/step-detail-panel.tsx`, `src/components/workflows/workflow-editor.tsx`（传 domains + defaultDomainId 给画布/卡片）

- [ ] **Step 1：节点卡领域徽章**——`step-card.tsx`（工种徽章区 [:184-225](../../../src/components/workflows/step-card.tsx:184)）旁加领域徽章：值 = `step.config?.domainId ?? defaultDomainId`；显示领域名（需 `domainsById` 名称查找，从 editor 经 canvas 传入）；**继承态**（节点未设、用场景默认）灰色 + 「·继承」，**覆盖态**（节点显式设）高亮 + 「·覆盖」。徽章用现有 `Badge`/小 chip，**不带边框**。
- [ ] **Step 2：节点详情面板覆盖 Select**——`step-detail-panel.tsx`（技能区下方 [:156-263](../../../src/components/workflows/step-detail-panel.tsx:156)）加「领域」`<Select>`：选项 = 「继承场景默认」(value=`__inherit__` → 写 `domainId: null`) + 各领域 + 「不限」。`onChange` 改 `step.config.domainId`（走文件内既有 step 更新回调，如 `onSaveStep`/`updateStep`）。
- [ ] **Step 3：editor 把 domains + defaultDomainId 透传**——`workflow-editor.tsx` 把 `domains`、当前 `defaultDomainId` 传给 `WorkflowCanvas`→`StepCard`/`StepDetailPanel`（按文件现有 prop 链路）。
- [ ] **Step 4：tsc + build + 手动验证**——编辑某场景设默认领域=财经，节点显示「财经·继承」；把一个节点覆盖为科技显示「科技·覆盖」；保存后刷新仍在；DB `default_domain_id` 列 + `steps[].config.domainId` 已写。
- [ ] **Step 5：端到端验证派单接通**——用一个带工种+领域实例的 org：启动该模板 mission，确认按「节点/场景领域」选到对应领域实例；无对应领域实例时回退通用并 `mission_tasks.domain_fallback=1`（查库）。
- [ ] **Step 6：commit**

```bash
git add src/lib/mission-core.ts \
        src/lib/__tests__/resolve-step-domain.test.ts \
        src/db/schema/workflows.ts \
        src/lib/mission-executor.ts \
        src/inngest/functions/leader-plan.ts \
        src/app/api/workflows/test-run/route.ts \
        src/app/actions/workflow-engine.ts \
        "src/app/(dashboard)/workflows/[id]/edit/page.tsx" \
        src/components/workflows/workflow-editor.tsx \
        src/components/workflows/step-card.tsx \
        src/components/workflows/step-detail-panel.tsx
git commit -m "$(cat <<'EOF'
feat(domain): P2 编排领域徽章 + 派单接通

- workflow_templates.defaultDomainId 列 + WorkflowStepDef.config.domainId 字段
- resolveStepDomainId 纯函数（节点>场景>空）+ 单测
- mission-executor / leader-plan / test-run 解析有效领域填 step.config.domainId
  → P1 pickEmployeeForStep 双因子 + domainFallback 落表真正生效
- 编排器场景默认领域下拉 + 节点领域徽章（继承/覆盖）+ 详情面板覆盖 Select
- saveWorkflow / updateWorkflow 持久化 defaultDomainId

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 全量验证（4 commit 完成后）

- [ ] `npx tsc --noEmit` — 0 error
- [ ] `npm run build` — 通过
- [ ] `npm run test` — 全绿（新增 `domains-defaults` / `resolve-step-domain` + 既有 `pick-employee-domain` 不回归）
- [ ] `bash scripts/verify-schema-sync.sh` — 无 drift（含新 `default_domain_id` 列；若脚本 fingerprint 需更新则同步）
- [ ] 端到端：配置「财经记者」实例 → 编排器场景默认=财经 → 启动 mission → 派到财经记者；删财经记者后重跑 → 回退通用 + `domain_fallback=1`

## 风险与回退

| 风险 | 缓解 |
|---|---|
| types.ts/page.tsx 既有 WIP 被卷入 commit | Pre-flight 明确策略；精确 `git add` |
| 删除被引用领域报外键错 | `deleteDomainAction` 捕获错误 → UI 提示「仍被引用」；不做 cascade |
| 旧模板无 defaultDomainId / 旧 step 无 domainId | `resolveStepDomainId` 返回 null → 派单走现状（不缩领域），不破 |
| db:push 加列影响远程 | 本地仅 push；远程部署前按 CLAUDE.md 走标准 migrate |
| 编排器 prop 链路深（editor→canvas→card） | 按文件现有 prop 传递链路加 domains/domainsById，不新造 context |

## 顺延（不在 P2）

- 对话中心选员工 picker、模板节点指派人 picker 的两级选择器（P2.1，spec §9）
- 媒体形态 mediaForm 任务级 UI（P3）
- domainTags 列物理删除（P3）
- `/skills` 能力与集成中心四区、MCP、CLI（P4-P6）
