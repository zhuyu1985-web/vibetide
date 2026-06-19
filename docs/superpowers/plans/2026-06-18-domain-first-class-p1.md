# 领域一等维度（P1 后端）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「领域」成为参与派单的一等维度，并让领域口径包（promptGuidance + authoritySources）在执行时差异化产出——纯后端，UI 留 P2。

**Architecture:** 新增 `domains` 受控字典（含口径包）→ `ai_employees.domain_id` 外键 → `pickEmployeeForStep` 在「工种」之上加「领域」第二因子、返回 `{ employee, domainFallback }` → `assembleAgent` join `domains` 把 `promptGuidance` 注入 Layer 4.5、把 `authoritySources` 经扩展的 `ToolContext` 注入 `web_search` 新增的 `includeDomains` 入参。

**Tech Stack:** Drizzle ORM + postgres-js、AI SDK v6、zod、vitest。

**关键纪律：**
- 本地库用 `npm run db:push`（127.0.0.1 journal 为空，**不要**跑 `db:migrate`）；生产迁移另走 `db:generate`+`db:migrate`。见 [[local-db-push-prod-migrate]]。
- 每个 task 的 commit **只 add 本 task 改的文件**（工作区有大量他人未提交改动，绝不 `git add -A`）。
- pickEmployeeForStep 返回 shape 改动会同时 break 3 个 caller + 1 个测试——**Task 4 必须在同一 commit 里改完全部 4 处**，保证每个 commit 都能 `tsc --noEmit` + `build` 通过。

---

## File Structure

| 动作 | 文件 | 职责 |
|---|---|---|
| Create | `src/db/schema/domains.ts` | `domains` 受控字典表（slug/name + 口径包 promptGuidance/authoritySources） |
| Create | `src/lib/dal/domains.ts` | 读 domains：`getDomainById`（取口径包，agent 装配用）/ `listDomainsByOrg` |
| Create | `scripts/migration-domain-001.ts` | 把历史 `instanceConfig.domainTags[0]` 回填成 `domains` 行 + `ai_employees.domain_id` |
| Create | `src/lib/__tests__/pick-employee-domain.test.ts` | 派单领域因子 + fallback 的单测 |
| Modify | `src/db/schema/ai-employees.ts` | 加 `domainId` 外键 |
| Modify | `src/db/schema/missions.ts` | `missionTasks` 加 `domainFallback` |
| Modify | `src/db/schema/index.ts` | export domains |
| Modify | `src/lib/mission-core.ts` | `EmployeeWithSkills` 加 `domainId`；`pickEmployeeForStep` 双因子 + 返回 `{ employee, domainFallback }` |
| Modify | `src/lib/mission-executor.ts:202` · `src/inngest/functions/leader-plan.ts:92` · `src/app/api/workflows/test-run/route.ts:207` | 3 caller 改解构 `.employee` + 落 `domainFallback` |
| Modify | `src/lib/__tests__/pick-employee-craft.test.ts` | 适配新返回 shape |
| Modify | `src/lib/agent/types.ts` | `AssembledAgent` 加 `domainGuidance`/`domainAuthoritySources`；`ToolContext` 加 `authorityDomains` |
| Modify | `src/lib/agent/assembly.ts` | join `domains` → 填 `domainGuidance`/`domainAuthoritySources` |
| Modify | `src/lib/agent/prompt-templates.ts:187` | Layer 4.5 改 `promptGuidance ?? 现有通用模板` |
| Modify | `src/lib/agent/tool-registry.ts` | web_search inputSchema 加 `includeDomains`；execute 合并；`wrapToolExecuteWithContext` 加 `authorityDomains` 分支 |

---

## Task 1: `domains` 受控字典表（含口径包）

**Files:**
- Create: `src/db/schema/domains.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: 写 domains schema**

`src/db/schema/domains.ts`：
```typescript
import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations"; // ⚠ 确认路径：ai-employees.ts 实际从 "./users" 引 organizations(re-export)，以现有 import 路径为准

export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  slug: text("slug").notNull(),                 // "finance" / "sports" / "politics"
  name: text("name").notNull(),                 // 财经 / 体育 / 时政
  description: text("description"),
  // 领域口径包 —— 执行时差异化的真正载体
  promptGuidance: text("prompt_guidance"),                       // 注入 Layer 4.5（口径/术语/禁忌）
  authoritySources: jsonb("authority_sources").$type<string[]>().default([]), // 权威源域名白名单 → web_search includeDomains
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgSlugUidx: uniqueIndex("domains_org_slug_uidx").on(t.organizationId, t.slug),
}));
```

- [ ] **Step 2: 注册到 schema index**

`src/db/schema/index.ts` 加一行（按字母序靠近其他 export）：
```typescript
export * from "./domains";
```

- [ ] **Step 3: 应用到本地库**

Run: `npm run db:push`
Expected: drizzle-kit 提示 create table `domains`，确认应用，无报错。

- [ ] **Step 4: 验证表存在**

Run: `npm run db:push`（再跑一次）
Expected: `No changes detected`（幂等，证明已建表）。

- [ ] **Step 5: Commit**
```bash
git add src/db/schema/domains.ts src/db/schema/index.ts
git commit -m "feat(domain): 新增 domains 受控字典表（含口径包字段）"
```

---

## Task 2: `ai_employees.domain_id` + `mission_tasks.domain_fallback`

**Files:**
- Modify: `src/db/schema/ai-employees.ts`
- Modify: `src/db/schema/missions.ts`

- [ ] **Step 1: ai_employees 加 domainId**

`src/db/schema/ai-employees.ts` —— 在 `instanceConfig` 字段后加（import `domains` 见下）：
```typescript
  // 领域一等维度（P1）：实例的主领域外键。null = 通用（不限领域）。
  domainId: uuid("domain_id").references(() => domains.id),
```
文件顶部 import：
```typescript
import { domains } from "./domains";
```

- [ ] **Step 2: mission_tasks 加 domainFallback**

`src/db/schema/missions.ts` —— `missionTasks` 表在 `assignedRole` 附近加：
```typescript
  // 领域一等维度（P1）：派单时领域未精确命中、回退通用实例 → true，供 UI 提示「领域未精确匹配」。
  domainFallback: integer("domain_fallback").notNull().default(0),
```
（用 `integer` 0/1 与表内 `errorRecoverable`/`isPreset` 等布尔列风格一致；`integer` 已 import。）

- [ ] **Step 3: 应用 + 验证**

Run: `npm run db:push` → 确认 alter `ai_employees` add `domain_id`、alter `mission_tasks` add `domain_fallback`。
Run: `npx tsc --noEmit`
Expected: 零错误（外键类型对齐）。

- [ ] **Step 4: Commit**
```bash
git add src/db/schema/ai-employees.ts src/db/schema/missions.ts
git commit -m "feat(domain): ai_employees.domain_id + mission_tasks.domain_fallback"
```

---

## Task 3: 迁移脚本（domainTags → domains 回填）

**Files:**
- Create: `scripts/migration-domain-001.ts`（仿 `scripts/migration-craft-001.ts` 结构）

- [ ] **Step 1: 写迁移脚本（dry-run 默认，--apply 才落库）**

`scripts/migration-domain-001.ts`：
```typescript
// 把历史 ai_employees.instanceConfig.domainTags[0] 回填成 domains 行 + 设 domain_id。
// 用法：先 `tsx scripts/migration-domain-001.ts`（dry-run 预览），确认后 `... --apply`。
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { config } from "dotenv";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
const APPLY = process.argv.includes("--apply");

function slugify(name: string): string {
  // 中文领域名 → 稳定 slug：用固定映射，未知的回退拼音/hash 兜底
  const MAP: Record<string, string> = {
    财经: "finance", 时政: "politics", 体育: "sports", 社会: "society",
    民生: "livelihood", 法治: "law", 科技: "tech", 文娱: "entertainment",
  };
  return MAP[name] ?? `domain-${Buffer.from(name).toString("hex").slice(0, 8)}`;
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });
  const emps = await db.select().from(schema.aiEmployees);
  let created = 0, linked = 0;
  for (const e of emps) {
    const tags = (e.instanceConfig as { domainTags?: string[] } | null)?.domainTags;
    if (!tags || tags.length === 0 || e.domainId) continue;
    const name = tags[0];
    const slug = slugify(name);
    // upsert domain（org 内按 slug 唯一）
    let [dom] = await db.select().from(schema.domains)
      .where(and(eq(schema.domains.organizationId, e.organizationId), eq(schema.domains.slug, slug)));
    if (!dom) {
      console.log(`[domain] + ${name}(${slug}) for org ${e.organizationId}`);
      if (APPLY) {
        [dom] = await db.insert(schema.domains)
          .values({ organizationId: e.organizationId, slug, name }).returning();
      }
      created++;
    }
    console.log(`[link] ${e.slug} → ${name}`);
    if (APPLY && dom) {
      await db.update(schema.aiEmployees).set({ domainId: dom.id }).where(eq(schema.aiEmployees.id, e.id));
    }
    linked++;
  }
  console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"}: ${created} domains, ${linked} employees linked`);
  await client.end();
}
main();
```

- [ ] **Step 2: dry-run 预览**

Run: `npx tsx scripts/migration-domain-001.ts`
Expected: 打印将创建的 domains + 将关联的 employees，结尾 `DRY-RUN`，无写库。

- [ ] **Step 3: 应用**

Run: `npx tsx scripts/migration-domain-001.ts --apply`
Expected: 结尾 `APPLIED: N domains, M employees linked`，无报错。

- [ ] **Step 4: Commit**
```bash
git add scripts/migration-domain-001.ts
git commit -m "feat(domain): 迁移脚本回填 domainTags → domains + domain_id"
```

---

## Task 4: `pickEmployeeForStep` 双因子 + 返回 shape（TDD）

> ⚠ 本 task 一次改完 mission-core + 3 caller + 2 测试，保证 commit 可 build。

**Files:**
- Modify: `src/lib/mission-core.ts`
- Create: `src/lib/__tests__/pick-employee-domain.test.ts`
- Modify: `src/lib/__tests__/pick-employee-craft.test.ts`
- Modify: `src/lib/mission-executor.ts` · `src/inngest/functions/leader-plan.ts` · `src/app/api/workflows/test-run/route.ts`

- [ ] **Step 1: 写失败测试（领域因子 + fallback）**

`src/lib/__tests__/pick-employee-domain.test.ts`：
```typescript
import { describe, it, expect } from "vitest";
import { pickEmployeeForStep, type EmployeeWithSkills } from "../mission-core";

const reporter = (slug: string, domainId?: string, isPreset = 1): EmployeeWithSkills => ({
  id: slug, slug, name: slug, title: "记者", nickname: slug, skills: [],
  roleType: "reporter", isPreset, domainId,
});

describe("pickEmployeeForStep × 领域", () => {
  const finance = reporter("fin", "dom-finance");
  const sports = reporter("spo", "dom-sports");
  const generic = reporter("gen", undefined);

  it("领域精确命中：requiredCraft=reporter + domainId=finance → 选财经记者", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter", domainId: "dom-finance" } },
      [], [finance, sports, generic],
    );
    expect(r.employee?.slug).toBe("fin");
    expect(r.domainFallback).toBe(false);
  });

  it("领域无匹配实例 → fallback 通用实例 + domainFallback=true", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter", domainId: "dom-tech" } },
      [], [finance, sports, generic],
    );
    expect(r.employee?.slug).toBe("gen");
    expect(r.domainFallback).toBe(true);
  });

  it("不指定 domainId → 走现状逻辑，domainFallback=false", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter" } },
      [], [finance, sports],
    );
    expect(r.employee?.roleType).toBe("reporter");
    expect(r.domainFallback).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/__tests__/pick-employee-domain.test.ts`
Expected: FAIL（`r.employee` undefined —— 当前返回的是裸 employee）。

- [ ] **Step 3: 改 EmployeeWithSkills + pickEmployeeForStep**

`src/lib/mission-core.ts`：
1. `EmployeeWithSkills` 接口加：
```typescript
  /** 领域一等维度：实例主领域 = ai_employees.domain_id。null/undefined = 通用。 */
  domainId?: string | null;
```
2. `step.config` 类型加 `domainId?: string | null;`
3. 返回类型改 `{ employee: EmployeeWithSkills | null; domainFallback: boolean }`。在「1.5 确定性技能→工种派单」里，`candidates` 算出后、排序前插入领域过滤：
```typescript
      if (candidates.length > 0) {
        const inTeam = candidates.filter((e) => defaultTeamSlugs.includes(e.slug));
        let pool = inTeam.length > 0 ? inTeam : candidates;
        // 领域第二因子：指定 domainId 时缩小到该领域实例；无则 fallback 通用实例并标注。
        let domainFallback = false;
        const wantDomain = step.config?.domainId;
        if (wantDomain) {
          const matched = pool.filter((e) => e.domainId === wantDomain);
          if (matched.length > 0) {
            pool = matched;
          } else {
            const generic = pool.filter((e) => !e.domainId);
            pool = generic.length > 0 ? generic : pool;
            domainFallback = true;
          }
        }
        pool.sort((a, b) => {
          const ia = craftSet.indexOf(a.roleType!);
          const ib = craftSet.indexOf(b.roleType!);
          if (ia !== ib) return ia - ib;
          return (b.isPreset ?? 0) - (a.isPreset ?? 0);
        });
        return { employee: pool[0], domainFallback };
      }
```
4. **其余所有 return 改包成 shape**（共 6 个 return statement）：`return e`（explicit，~:156）、`return null`（无 defaultTeam，~:188）、`return null`（teamMembers 空，~:192）、`return skilled`（skillName，~:200）、`return teamMembers[...] ?? null`（round-robin，~:206）——非 null 包 `{ employee: X, domainFallback: false }`，null 包 `{ employee: null, domainFallback: false }`。tsc 会抓任何漏改的分支（返回类型不符）。

- [ ] **Step 4: 改现有 craft 测试适配新 shape**

`src/lib/__tests__/pick-employee-craft.test.ts`：返回值从裸 employee 变 `{ employee, domainFallback }`，逐处适配：① `expect(picked?.slug)` / `expect(picked?.roleType)` → `expect(picked.employee?.slug)` / `expect(picked.employee?.roleType)`（两种访问都有）；② **`expect(picked).toBeNull()`（:108）→ `expect(picked.employee).toBeNull()`**（改后返回对象是 truthy，旧断言会失败）。

- [ ] **Step 5: 改 3 个 caller**

三处均把 `const matched = pickEmployeeForStep(...)` 后续的 `matched?.id` 改为 `matched.employee?.id`，并落 fallback 标记：
- `src/lib/mission-executor.ts:202`：
```typescript
const picked = pickEmployeeForStep(s, defaultTeamSlugs, employeesWithSkills);
const assignedEmployeeId = picked.employee?.id ?? mission.leaderEmployeeId;
// 落 domainFallback：在该 step 物化成 missionTask 的 insert values 里加 domainFallback: picked.domainFallback ? 1 : 0
```
- `src/inngest/functions/leader-plan.ts:92`：同样改 `picked.employee?.id`，物化 missionTask 时写 `domainFallback`。
- `src/app/api/workflows/test-run/route.ts:207`：改 `picked.employee?.id ?? leader.id`（test-run 不落库，忽略 domainFallback）。

> ⚠ 关键（否则领域因子静默失效）：3 个 caller 都经**共享 helper `loadAvailableEmployees()`**（`src/lib/mission-core.ts:55`）加载员工，**不是**各自 select。须在这一处补 `domainId`：① select（`mission-core.ts:60-70` 附近）加 `domainId: aiEmployees.domainId`；② `empMap` row-mapping（`:89-99` 附近）把 `domainId` 拷进返回对象。漏这步 → `e.domainId` 恒 undefined、领域因子永不触发，而 Task 4 新测试（手构造 employee）仍过 → 生产静默无效。

- [ ] **Step 6: 跑全部相关测试 + 类型检查**

Run: `npx vitest run src/lib/__tests__/pick-employee-domain.test.ts src/lib/__tests__/pick-employee-craft.test.ts`
Expected: 全 PASS。
Run: `npx tsc --noEmit`
Expected: 零错误（3 caller 解构已对齐）。

- [ ] **Step 7: Commit**
```bash
git add src/lib/mission-core.ts src/lib/__tests__/pick-employee-domain.test.ts src/lib/__tests__/pick-employee-craft.test.ts src/lib/mission-executor.ts src/inngest/functions/leader-plan.ts src/app/api/workflows/test-run/route.ts
git commit -m "feat(domain): pickEmployeeForStep 工种+领域双因子 + domainFallback 返回 shape"
```

---

## Task 5: domains DAL + 装配 join + AssembledAgent 字段

**Files:**
- Create: `src/lib/dal/domains.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/assembly.ts`

- [ ] **Step 1: 写 domains DAL**

`src/lib/dal/domains.ts`：
```typescript
import { db } from "@/db";
import { domains } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getDomainById(domainId: string) {
  const [d] = await db.select({
    id: domains.id, name: domains.name,
    promptGuidance: domains.promptGuidance,
    authoritySources: domains.authoritySources,
  }).from(domains).where(eq(domains.id, domainId));
  return d ?? null;
}
```

- [ ] **Step 2: AssembledAgent + ToolContext 加字段**

`src/lib/agent/types.ts`：
- `AssembledAgent` 在 `domainTags` 附近加：
```typescript
  /** 领域口径包：专属提示词 → Layer 4.5（有则替代通用模板）。来自 domains.prompt_guidance。 */
  domainGuidance?: string;
  /** 领域权威源域名白名单 → web_search includeDomains。来自 domains.authority_sources。 */
  domainAuthoritySources?: string[];
```
- `ToolContext` 加：
```typescript
  /** 领域权威源 → 注入 web_search 的 includeDomains（仅对有该入参的工具生效）。 */
  authorityDomains?: string[];
```

- [ ] **Step 3: assembly join domains**

`src/lib/agent/assembly.ts` —— 读 `instanceConfig` 后、构建 `agent` 前加：
```typescript
  // 领域一等维度：实例绑 domain_id → 取口径包（promptGuidance / authoritySources）。
  let domainGuidance: string | undefined;
  let domainAuthoritySources: string[] | undefined;
  if (employee.domainId) {
    const dom = await getDomainById(employee.domainId);
    domainGuidance = dom?.promptGuidance ?? undefined;
    domainAuthoritySources = dom?.authoritySources?.length ? dom.authoritySources : undefined;
  }
```
（顶部 import `getDomainById`；`employee` 的 select 需含 `domainId`——确认 assembly 加载 employee 的 query 带上 `domainId` 列。）
然后在 `agent` 对象里加：
```typescript
    domainGuidance,
    domainAuthoritySources,
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误。

- [ ] **Step 5: Commit**
```bash
git add src/lib/dal/domains.ts src/lib/agent/types.ts src/lib/agent/assembly.ts
git commit -m "feat(domain): domains DAL + 装配 join 取口径包注入 AssembledAgent"
```

---

## Task 6: Layer 4.5 注入升级（promptGuidance ?? 通用模板）（TDD）

**Files:**
- Modify: `src/lib/agent/prompt-templates.ts:187`
- Create: `src/lib/agent/__tests__/prompt-domain-guidance.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/agent/__tests__/prompt-domain-guidance.test.ts`：
```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt-templates";

const base = { name: "小刚", nickname: "小刚", title: "记者", authorityLevel: "advisor",
  tools: [], skillCategories: [], memories: [], proficiencyLevel: 50 } as never;

describe("Layer 4.5 领域口径包", () => {
  it("有 domainGuidance → 用专属口径", () => {
    const p = buildSystemPrompt({ ...base, domainGuidance: "不荐股；数据以证监会披露为准。" });
    expect(p).toContain("不荐股");
    expect(p).not.toContain("不说外行话"); // 通用模板被替代
  });

  it("无 domainGuidance 但有 domainTags → 回退现有通用模板", () => {
    const p = buildSystemPrompt({ ...base, domainTags: ["财经"] });
    expect(p).toContain("你专注于以下领域：财经");
    expect(p).toContain("不说外行话");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/agent/__tests__/prompt-domain-guidance.test.ts`
Expected: FAIL（第一个 case：domainGuidance 未被消费）。

- [ ] **Step 3: 改 Layer 4.5**

`src/lib/agent/prompt-templates.ts:187` —— 替换 Layer 4.5 块：
```typescript
  // Layer 4.5: 领域专精（领域维度）。口径包优先：有 domainGuidance 用专属口径，否则回退通用模板。
  if (agent.domainGuidance) {
    layers.push(`# 领域专精\n${agent.domainGuidance}`);
  } else if (agent.domainTags && agent.domainTags.length > 0) {
    layers.push(`# 领域专精
你专注于以下领域：${agent.domainTags.join("、")}。
- 使用该领域的专业术语与表达习惯，不说外行话。
- 遵循该领域的报道口径与禁忌（如财经不作投资建议、时政遵守称谓与排序规范）。
- 优先引用该领域的权威来源与你绑定知识库中的事实。`);
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/agent/__tests__/prompt-domain-guidance.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**
```bash
git add src/lib/agent/prompt-templates.ts src/lib/agent/__tests__/prompt-domain-guidance.test.ts
git commit -m "feat(domain): Layer 4.5 口径包注入（promptGuidance 优先，回退通用模板）"
```

---

## Task 7: web_search `includeDomains` 入参 + 领域权威源注入

> reviewer 重点：当前 web_search **无** includeDomains 入参，`wrapToolExecuteWithContext` 只注 4 个硬编码字段。须三处配合。

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`（inputSchema + execute 合并 + wrapper 分支）
- Modify: `src/lib/agent/execution.ts`（把 `domainAuthoritySources` 放进 toVercelTools 的 context）

- [ ] **Step 1: web_search inputSchema 加 includeDomains**

`src/lib/agent/tool-registry.ts:411` 的 `inputSchema` z.object 里加：
```typescript
        includeDomains: z.array(z.string()).optional()
          .describe("白名单域名（领域权威源）；与默认源合并，优先返回这些域名的结果"),
```

- [ ] **Step 2: execute 合并 includeDomains 与默认**

`src/lib/agent/tool-registry.ts:456` 的 `searchWeb(trimmedQuery, {...})` 里，把 `includeDomains: DEFAULT_INCLUDE_DOMAINS` 改为合并（union 去重）：
```typescript
              includeDomains: Array.from(new Set([
                ...DEFAULT_INCLUDE_DOMAINS,
                ...((args.includeDomains as string[] | undefined) ?? []),
              ])),
```
（execute 的入参签名确认能拿到 `includeDomains`——它现在是 inputSchema 字段，会出现在 execute 的 args 里。若 execute 解构了具名参数，把 `includeDomains` 加进解构。）

- [ ] **Step 3: wrapToolExecuteWithContext 注入 authorityDomains**

`src/lib/agent/tool-registry.ts:2781` —— `ToolContext` 判空条件加 `authorityDomains`，并在 merge 块加：
```typescript
      if (context.authorityDomains?.length && merged.includeDomains === undefined) {
        merged.includeDomains = context.authorityDomains;
      }
```
（判空守卫 `!context.organizationId && ...` 那行末尾加 `&& !context.authorityDomains?.length`。）

- [ ] **Step 4: execution 在 toVercelTools 调用处 merge 领域权威源**

`src/lib/agent/execution.ts` 的 `toVercelTools(...)` 调用（`:244` 附近）——`context` 是**传入参数**，execution.ts 内没有 context 字面量可改；在调用处 merge（`agent` 与 `context` 均在 scope）：
```typescript
  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs, missionTools, kbTools, {
    ...context,
    authorityDomains: agent.domainAuthoritySources,
  });
```

- [ ] **Step 5: 类型检查 + 全量测试**

Run: `npx tsc --noEmit`
Expected: 零错误。
Run: `npm run test`
Expected: 全 PASS（含已有 1073 + 新增）。

- [ ] **Step 6: Commit**
```bash
git add src/lib/agent/tool-registry.ts src/lib/agent/execution.ts
git commit -m "feat(domain): web_search 加 includeDomains 入参 + 领域权威源经 context 注入合并"
```

---

## 收尾验证

- [ ] **Step 1: 全量类型 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 均通过。

- [ ] **Step 2: schema 同步自检**

Run: `bash scripts/verify-schema-sync.sh`（若脚本含 domains/domain_id fingerprint 则确认 PASS；否则人工确认 `domains` 表 + `ai_employees.domain_id` + `mission_tasks.domain_fallback` 存在）。

- [ ] **Step 3: 端到端手验（可选）**

给一个 reporter 实例配 `domainId`（指向带 promptGuidance/authoritySources 的 domain），起一个 requiredCraft=reporter + 该 domain 的 mission step，确认：① 派到该领域实例；② 其 system prompt 含专属口径；③ web_search 调用带上领域权威源。

---

## P1 完成定义（DoD）

- `domains` 表 + `ai_employees.domain_id` + `mission_tasks.domain_fallback` 落库，历史 `domainTags` 已回填。
- `pickEmployeeForStep` 工种+领域双因子，无匹配 fallback 通用 + `domainFallback` 标注，3 caller + 测试全绿。
- 领域口径包经 assembly 注入 Layer 4.5（promptGuidance 优先、回退通用模板）。
- `web_search` 暴露 `includeDomains` 入参，领域 `authoritySources` 经扩展的 `ToolContext` 注入并与默认源合并。
- `tsc --noEmit` + `build` + 全量测试通过。

**后续（独立 plan）：** P2 选员工/编排 UI · P3 形态任务化 · P4 能力与集成中心 · P5 MCP 消费 · P6 CLI。
