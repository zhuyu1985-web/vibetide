# Collection Hub · Phase 1 后台源管理页 + 灵感池迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让运营/编辑能在 `/data-collection/sources` 后台自助添加、编辑、手工触发采集源（V1 支持 TopHub / Tavily / Jina URL 三种类型）；并把现有灵感池 SSE 抓取路径切换到新的 `collection/source.run-requested` 事件管道，零停机。

**Architecture:** 沿用项目既有的 **Server page → Client component + DAL 读取 + Server Action 写入** 模式。UI 走 shadcn/ui。Zod schema 从 Phase 0 的 Adapter 读取,后台表单根据 `configFields` 声明式渲染。手工触发通过 `inngest.send({name: "collection/source.run-requested"})` 派发到 Phase 0 的 `runCollectionSource` 函数。

**Tech Stack:** Next.js 16 App Router、Drizzle 0.45.1、Inngest v3、shadcn/ui、Zod 4、Tailwind CSS v4。

**Phase 1 验收标准：**
- 运营能在 `/data-collection/sources` 看到所有源（空时显示空状态），筛选、搜索
- 能走 4 步向导创建一个 TopHub 源，提交后出现在列表里
- 能在源详情页查看最近运行 / 手工立即触发一次
- 能暂停 / 恢复 / 软删除源
- 灵感池点击"抓取"后端走新框架（`collection/source.run-requested` 事件），不再直接调 `crawlSinglePlatform`
- `npm run test` 通过,`npm run build` 通过,`npx tsc --noEmit` 通过

**依赖前置：** Phase 0 完成（2026-04-18 `6415aa1`）。已确认：
- 4 张 collection 表在 DB（collection_sources / collected_items / collection_runs / collection_logs）
- Adapter Registry + 3 Adapters（tophub / tavily / jina_url）已注册
- Writer + Inngest `runCollectionSource` + smoke consumer 工作
- 113/113 tests passing

**关联文档：**
- Spec: `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`
- Phase 0 Plan: `docs/superpowers/plans/2026-04-18-collection-hub-phase0-foundation.md`

---

## 文件结构总览

### 新建 — DAL
- `src/lib/dal/collection.ts` — 多租户读取：list/get sources, list runs by source, list logs by run, list recent items by source, summary stats

### 新建 — Server Actions
- `src/app/actions/collection.ts` — createCollectionSource / updateCollectionSource / deleteCollectionSource（soft）/ toggleCollectionSourceEnabled / triggerCollectionSource

### 新建 — 路由
- `src/app/(dashboard)/data-collection/layout.tsx` — 顶部 tab nav（源管理 / 内容浏览预留 / 监控预留）
- `src/app/(dashboard)/data-collection/page.tsx` — 重定向到 `/data-collection/sources`
- `src/app/(dashboard)/data-collection/sources/page.tsx` — server: 拉列表
- `src/app/(dashboard)/data-collection/sources/sources-client.tsx` — client: 表格 + 筛选 + 操作
- `src/app/(dashboard)/data-collection/sources/new/page.tsx` — server: 拉可用 Adapter 元数据
- `src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx` — client: 4 步向导
- `src/app/(dashboard)/data-collection/sources/[id]/page.tsx` — server: 拉详情 + 最近 runs + 最近 items
- `src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx` — client: overview + 手工触发按钮 + tabs

### 新建 — 辅助库
- `src/lib/collection/adapter-meta.ts` — 导出 Adapter 元数据（displayName / description / category / configFields）供 UI 使用,Server 端安全（不导出 execute）

### 修改
- `src/components/layout/app-sidebar.tsx` — 在"设置"区块新增"数据采集"入口
- `src/app/api/inspiration/crawl/route.ts` — 替换内部 `crawlSinglePlatform` 调用为 `inngest.send`

### 新建 — 测试
- `src/lib/dal/__tests__/collection.test.ts` — 集成测: list/get 多租户隔离
- `src/app/actions/__tests__/collection.test.ts` — 集成测: create/update/delete/trigger（subset）

---

## Task 1: DAL `src/lib/dal/collection.ts`

**Files:**
- Create: `src/lib/dal/collection.ts`
- Test: `src/lib/dal/__tests__/collection.test.ts`

- [ ] **Step 1.1** Create `src/lib/dal/collection.ts`:

```ts
import { db } from "@/db";
import {
  collectionSources,
  collectionRuns,
  collectionLogs,
  collectedItems,
} from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type CollectionSourceRow = InferSelectModel<typeof collectionSources>;
export type CollectionRunRow = InferSelectModel<typeof collectionRuns>;
export type CollectionLogRow = InferSelectModel<typeof collectionLogs>;
export type CollectedItemRow = InferSelectModel<typeof collectedItems>;

export interface SourceListFilters {
  sourceType?: string;
  enabled?: boolean;
  targetModule?: string;
  searchName?: string;
}

/** 列出本组织的所有源(未软删除),按名称排序。 */
export async function listCollectionSources(
  organizationId: string,
  filters: SourceListFilters = {},
): Promise<CollectionSourceRow[]> {
  const conditions = [
    eq(collectionSources.organizationId, organizationId),
    isNull(collectionSources.deletedAt),
  ];
  if (filters.sourceType) {
    conditions.push(eq(collectionSources.sourceType, filters.sourceType));
  }
  if (typeof filters.enabled === "boolean") {
    conditions.push(eq(collectionSources.enabled, filters.enabled));
  }
  if (filters.searchName) {
    conditions.push(sql`${collectionSources.name} ILIKE ${"%" + filters.searchName + "%"}`);
  }
  const rows = await db
    .select()
    .from(collectionSources)
    .where(and(...conditions))
    .orderBy(collectionSources.name);

  if (filters.targetModule) {
    return rows.filter((r) => r.targetModules.includes(filters.targetModule!));
  }
  return rows;
}

/** 读取单个源,确保归属本组织(否则返回 null)。 */
export async function getCollectionSourceById(
  sourceId: string,
  organizationId: string,
): Promise<CollectionSourceRow | null> {
  const [row] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.id, sourceId),
        eq(collectionSources.organizationId, organizationId),
        isNull(collectionSources.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 断言源归属本组织,不满足抛出。写操作前调用。 */
export async function assertSourceOwnership(
  sourceId: string,
  organizationId: string,
): Promise<CollectionSourceRow> {
  const row = await getCollectionSourceById(sourceId, organizationId);
  if (!row) throw new Error(`Source ${sourceId} not found or not in organization`);
  return row;
}

/** 列出某源最近的 N 次运行。 */
export async function listRecentRunsBySource(
  sourceId: string,
  organizationId: string,
  limit = 20,
): Promise<CollectionRunRow[]> {
  return db
    .select()
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.sourceId, sourceId),
        eq(collectionRuns.organizationId, organizationId),
      ),
    )
    .orderBy(desc(collectionRuns.startedAt))
    .limit(limit);
}

/** 列出某运行的日志。 */
export async function listLogsByRun(
  runId: string,
  limit = 200,
): Promise<CollectionLogRow[]> {
  return db
    .select()
    .from(collectionLogs)
    .where(eq(collectionLogs.runId, runId))
    .orderBy(desc(collectionLogs.loggedAt))
    .limit(limit);
}

/** 列出某源最近采集到的 items(仅首抓自该源的)。 */
export async function listRecentItemsBySource(
  sourceId: string,
  organizationId: string,
  limit = 20,
): Promise<CollectedItemRow[]> {
  return db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        eq(collectedItems.firstSeenSourceId, sourceId),
      ),
    )
    .orderBy(desc(collectedItems.firstSeenAt))
    .limit(limit);
}

/** 查询组织级的源统计概况。 */
export async function getOrgCollectionSummary(
  organizationId: string,
): Promise<{
  totalSources: number;
  enabledSources: number;
  totalItemsLast24h: number;
  failedRunsLast24h: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [sources] = await db
    .select({
      total: sql<number>`count(*)::int`,
      enabled: sql<number>`count(*) FILTER (WHERE ${collectionSources.enabled} = true)::int`,
    })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        isNull(collectionSources.deletedAt),
      ),
    );
  const [items] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        sql`${collectedItems.firstSeenAt} >= ${since}`,
      ),
    );
  const [runs] = await db
    .select({ failed: sql<number>`count(*)::int` })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        eq(collectionRuns.status, "failed"),
        sql`${collectionRuns.startedAt} >= ${since}`,
      ),
    );
  return {
    totalSources: sources?.total ?? 0,
    enabledSources: sources?.enabled ?? 0,
    totalItemsLast24h: items?.count ?? 0,
    failedRunsLast24h: runs?.failed ?? 0,
  };
}
```

- [ ] **Step 1.2** Create integration test `src/lib/dal/__tests__/collection.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/db";
import { collectionSources, collectedItems, collectionRuns, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listCollectionSources,
  getCollectionSourceById,
  assertSourceOwnership,
  listRecentRunsBySource,
  listRecentItemsBySource,
  getOrgCollectionSummary,
} from "../collection";

let orgA: string;
let orgB: string;
let sourceA1: string;

beforeAll(async () => {
  const now = Date.now();
  const [a] = await db.insert(organizations).values({ name: "dal-test-A", slug: `dal-test-a-${now}` }).returning();
  const [b] = await db.insert(organizations).values({ name: "dal-test-B", slug: `dal-test-b-${now}` }).returning();
  orgA = a.id;
  orgB = b.id;
  const [s1] = await db.insert(collectionSources).values({
    organizationId: orgA,
    name: "dal-source-1",
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: ["hot_topics"],
  }).returning();
  sourceA1 = s1.id;
  await db.insert(collectionSources).values({
    organizationId: orgA,
    name: "dal-source-2",
    sourceType: "tavily",
    config: { keywords: ["x"], timeRange: "7d", maxResults: 8 },
    targetModules: ["news"],
  });
  await db.insert(collectionSources).values({
    organizationId: orgB,
    name: "dal-source-B",
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: [],
  });
});

afterAll(async () => {
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgA));
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgB));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgA));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgB));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgA));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgB));
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

describe("listCollectionSources", () => {
  it("returns only sources for given org", async () => {
    const rowsA = await listCollectionSources(orgA);
    expect(rowsA.length).toBeGreaterThanOrEqual(2);
    expect(rowsA.every((r) => r.organizationId === orgA)).toBe(true);
  });

  it("filters by sourceType", async () => {
    const rows = await listCollectionSources(orgA, { sourceType: "tavily" });
    expect(rows.every((r) => r.sourceType === "tavily")).toBe(true);
  });

  it("filters by targetModule via jsonb array contains", async () => {
    const rows = await listCollectionSources(orgA, { targetModule: "hot_topics" });
    expect(rows.every((r) => r.targetModules.includes("hot_topics"))).toBe(true);
  });
});

describe("getCollectionSourceById / assertSourceOwnership", () => {
  it("returns the source when in same org", async () => {
    const row = await getCollectionSourceById(sourceA1, orgA);
    expect(row?.name).toBe("dal-source-1");
  });

  it("returns null when in different org", async () => {
    const row = await getCollectionSourceById(sourceA1, orgB);
    expect(row).toBeNull();
  });

  it("assertSourceOwnership throws across orgs", async () => {
    await expect(assertSourceOwnership(sourceA1, orgB)).rejects.toThrow();
  });
});

describe("listRecentRunsBySource + listRecentItemsBySource", () => {
  it("return empty arrays when nothing exists", async () => {
    expect(await listRecentRunsBySource(sourceA1, orgA)).toEqual([]);
    expect(await listRecentItemsBySource(sourceA1, orgA)).toEqual([]);
  });
});

describe("getOrgCollectionSummary", () => {
  it("counts only this org", async () => {
    const summary = await getOrgCollectionSummary(orgA);
    expect(summary.totalSources).toBeGreaterThanOrEqual(2);
    expect(summary.enabledSources).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 1.3** Run tests: `npm run test -- src/lib/dal/__tests__/collection.test.ts`  — all should pass.

- [ ] **Step 1.4** Commit:
```bash
git add src/lib/dal/collection.ts src/lib/dal/__tests__/collection.test.ts
git commit -m "feat(collection-hub/phase1): add DAL for collection sources/runs/items"
```

---

## Task 2: Server Actions `src/app/actions/collection.ts`

**Files:**
- Create: `src/app/actions/collection.ts`

- [ ] **Step 2.1** Create `src/app/actions/collection.ts`:

```ts
"use server";

import { db } from "@/db";
import { collectionSources, collectionRuns } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg, getCurrentUserProfile } from "@/lib/dal/auth";
import { getAdapter } from "@/lib/collection/registry";
import { inngest } from "@/inngest/client";
import { assertSourceOwnership } from "@/lib/dal/collection";
import { z } from "zod";
import "@/lib/collection/adapters"; // ensure adapters are registered

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireOrg(): Promise<string> {
  await requireUser();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

// ──────────────────────────────────────────────────────
// createCollectionSource
// ──────────────────────────────────────────────────────

const createPayloadSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  sourceType: z.string().min(1),
  config: z.unknown(),
  scheduleCron: z.string().nullable().optional(),
  scheduleMinIntervalSeconds: z.number().int().positive().nullable().optional(),
  targetModules: z.array(z.string()),
  defaultCategory: z.string().nullable().optional(),
  defaultTags: z.array(z.string()).nullable().optional(),
});

export async function createCollectionSource(payload: z.infer<typeof createPayloadSchema>) {
  const orgId = await requireOrg();
  const profile = await getCurrentUserProfile();

  const parsed = createPayloadSchema.parse(payload);

  // Validate type-specific config against adapter's zod schema
  const adapter = getAdapter(parsed.sourceType);
  const configResult = adapter.configSchema.safeParse(parsed.config);
  if (!configResult.success) {
    throw new Error(`配置校验失败: ${configResult.error.message}`);
  }

  const [row] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: parsed.name,
      sourceType: parsed.sourceType,
      config: configResult.data as Record<string, unknown>,
      scheduleCron: parsed.scheduleCron ?? null,
      scheduleMinIntervalSeconds: parsed.scheduleMinIntervalSeconds ?? null,
      targetModules: parsed.targetModules,
      defaultCategory: parsed.defaultCategory ?? null,
      defaultTags: parsed.defaultTags ?? null,
      enabled: true,
      createdBy: profile?.id ?? null,
    })
    .returning({ id: collectionSources.id });

  revalidatePath("/data-collection/sources");
  return { sourceId: row.id };
}

// ──────────────────────────────────────────────────────
// updateCollectionSource
// ──────────────────────────────────────────────────────

const updatePayloadSchema = createPayloadSchema.partial().extend({
  sourceId: z.string().uuid(),
});

export async function updateCollectionSource(payload: z.infer<typeof updatePayloadSchema>) {
  const orgId = await requireOrg();
  const { sourceId, ...rest } = updatePayloadSchema.parse(payload);
  const source = await assertSourceOwnership(sourceId, orgId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.scheduleCron !== undefined) patch.scheduleCron = rest.scheduleCron;
  if (rest.scheduleMinIntervalSeconds !== undefined) {
    patch.scheduleMinIntervalSeconds = rest.scheduleMinIntervalSeconds;
  }
  if (rest.targetModules !== undefined) patch.targetModules = rest.targetModules;
  if (rest.defaultCategory !== undefined) patch.defaultCategory = rest.defaultCategory;
  if (rest.defaultTags !== undefined) patch.defaultTags = rest.defaultTags;

  if (rest.config !== undefined) {
    // Validate config against adapter
    const adapter = getAdapter(source.sourceType);
    const configResult = adapter.configSchema.safeParse(rest.config);
    if (!configResult.success) {
      throw new Error(`配置校验失败: ${configResult.error.message}`);
    }
    patch.config = configResult.data;
  }

  await db
    .update(collectionSources)
    .set(patch)
    .where(eq(collectionSources.id, sourceId));

  revalidatePath("/data-collection/sources");
  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────
// toggleCollectionSourceEnabled
// ──────────────────────────────────────────────────────

export async function toggleCollectionSourceEnabled(sourceId: string, enabled: boolean) {
  const orgId = await requireOrg();
  await assertSourceOwnership(sourceId, orgId);
  await db
    .update(collectionSources)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(collectionSources.id, sourceId));
  revalidatePath("/data-collection/sources");
  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────
// deleteCollectionSource (soft delete)
// ──────────────────────────────────────────────────────

export async function deleteCollectionSource(sourceId: string) {
  const orgId = await requireOrg();
  await assertSourceOwnership(sourceId, orgId);
  await db
    .update(collectionSources)
    .set({ deletedAt: new Date(), enabled: false })
    .where(eq(collectionSources.id, sourceId));
  revalidatePath("/data-collection/sources");
  return { success: true };
}

// ──────────────────────────────────────────────────────
// triggerCollectionSource: manually dispatch a run
// ──────────────────────────────────────────────────────

export async function triggerCollectionSource(sourceId: string) {
  const orgId = await requireOrg();
  const source = await assertSourceOwnership(sourceId, orgId);
  if (!source.enabled) throw new Error("源已暂停,无法触发");

  await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId,
      organizationId: orgId,
      trigger: "manual",
    },
  });

  revalidatePath(`/data-collection/sources/${sourceId}`);
  return { success: true };
}
```

- [ ] **Step 2.2** Verify types compile:
```bash
npx tsc --noEmit
```

- [ ] **Step 2.3** Commit:
```bash
git add src/app/actions/collection.ts
git commit -m "feat(collection-hub/phase1): add server actions for source CRUD + manual trigger"
```

---

## Task 3: Adapter metadata export + module routing skeleton

**Files:**
- Create: `src/lib/collection/adapter-meta.ts` (server-safe metadata, no execute fn)
- Create: `src/app/(dashboard)/data-collection/layout.tsx`
- Create: `src/app/(dashboard)/data-collection/page.tsx` (redirect)
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 3.1** Create `src/lib/collection/adapter-meta.ts`. This exports Adapter metadata in a shape that can be serialized and sent to client components (without the `execute` function or Zod schema object):

```ts
import "@/lib/collection/adapters"; // ensure registered
import { listAdapters } from "./registry";
import type { AdapterCategory, ConfigField } from "./types";

export interface AdapterMeta {
  type: string;
  displayName: string;
  description: string;
  category: AdapterCategory;
  configFields: ConfigField[];
}

export function listAdapterMetas(): AdapterMeta[] {
  return listAdapters().map((a) => ({
    type: a.type,
    displayName: a.displayName,
    description: a.description,
    category: a.category,
    configFields: a.configFields,
  }));
}

export function getAdapterMeta(type: string): AdapterMeta | null {
  return listAdapterMetas().find((m) => m.type === type) ?? null;
}
```

- [ ] **Step 3.2** Create `src/app/(dashboard)/data-collection/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function DataCollectionIndexPage() {
  redirect("/data-collection/sources");
}
```

- [ ] **Step 3.3** Create `src/app/(dashboard)/data-collection/layout.tsx`:

```tsx
import { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const tabs = [
  { href: "/data-collection/sources", label: "源管理" },
  // 预留,Phase 4 启用
  // { href: "/data-collection/content", label: "内容浏览" },
  // { href: "/data-collection/monitoring", label: "监控面板" },
];

export default function DataCollectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="px-8 pt-6 pb-4 border-b border-border/30">
        <h1 className="text-xl font-semibold tracking-tight">数据采集</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一管理所有采集源。在此添加/编辑站点、订阅、关键词搜索,查看采集状态。
        </p>
        <nav className="mt-4 flex gap-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3.4** Modify `src/components/layout/app-sidebar.tsx`. Read the file and find the sidebar items list. Insert a new item in the "设置" section (or wherever settings-like items live — look for `/settings` entries or similar). Add:

```ts
{ label: "数据采集", href: "/data-collection", icon: Database },
```

Make sure to import `Database` from `lucide-react` at the top of the file.

If the sidebar uses nested sections with "创作" / "设置" groups, put it under "设置". If it's a flat list, put it near "热点发现" or at the end before Settings.

- [ ] **Step 3.5** Type check + build:
```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3.6** Commit:
```bash
git add src/lib/collection/adapter-meta.ts src/app/\(dashboard\)/data-collection/layout.tsx src/app/\(dashboard\)/data-collection/page.tsx src/components/layout/app-sidebar.tsx
git commit -m "feat(collection-hub/phase1): add /data-collection route scaffolding + sidebar entry"
```

---

## Task 4: Sources list page

**Files:**
- Create: `src/app/(dashboard)/data-collection/sources/page.tsx` (server)
- Create: `src/app/(dashboard)/data-collection/sources/sources-client.tsx` (client)

- [ ] **Step 4.1** Create `src/app/(dashboard)/data-collection/sources/page.tsx`:

```tsx
import { listCollectionSources } from "@/lib/dal/collection";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { redirect } from "next/navigation";
import { SourcesClient } from "./sources-client";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [sources, adapterMetas] = await Promise.all([
    listCollectionSources(orgId),
    Promise.resolve(listAdapterMetas()),
  ]);

  return (
    <SourcesClient
      initialSources={sources.map((s) => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        enabled: s.enabled,
        scheduleCron: s.scheduleCron,
        targetModules: s.targetModules,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        totalItemsCollected: s.totalItemsCollected,
      }))}
      adapterMetas={adapterMetas}
    />
  );
}
```

- [ ] **Step 4.2** Create `src/app/(dashboard)/data-collection/sources/sources-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Pause, Trash2, RefreshCw } from "lucide-react";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  triggerCollectionSource,
} from "@/app/actions/collection";

export interface SourceListItem {
  id: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  scheduleCron: string | null;
  targetModules: string[];
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalItemsCollected: number;
}

export function SourcesClient({
  initialSources,
  adapterMetas,
}: {
  initialSources: SourceListItem[];
  adapterMetas: AdapterMeta[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = initialSources.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && s.sourceType !== typeFilter) return false;
    if (statusFilter === "enabled" && !s.enabled) return false;
    if (statusFilter === "disabled" && s.enabled) return false;
    return true;
  });

  const handleToggle = async (id: string, enabled: boolean) => {
    setBusyId(id);
    try {
      await toggleCollectionSourceEnabled(id, !enabled);
      toast.success(!enabled ? "已启用" : "已暂停");
      router.refresh();
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTrigger = async (id: string) => {
    setBusyId(id);
    try {
      await triggerCollectionSource(id);
      toast.success("已触发一次采集,请稍后刷新查看结果");
    } catch (err) {
      toast.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除源「${name}」?此操作不可撤销(已采集的数据保留)。`)) return;
    setBusyId(id);
    try {
      await deleteCollectionSource(id);
      toast.success("已删除");
      router.refresh();
    } catch (err) {
      toast.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const typeLabel = (type: string) =>
    adapterMetas.find((m) => m.type === type)?.displayName ?? type;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="按名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="源类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              {adapterMetas.map((m) => (
                <SelectItem key={m.type} value={m.type}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              <SelectItem value="enabled">启用</SelectItem>
              <SelectItem value="disabled">暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/data-collection/sources/new">
            <Plus className="mr-2 h-4 w-4" />
            新建源
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>调度</TableHead>
              <TableHead>归属模块</TableHead>
              <TableHead>最近运行</TableHead>
              <TableHead className="text-right">已采集</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {initialSources.length === 0 ? "还没有采集源。点击右上角「新建源」开始。" : "没有匹配的记录"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/data-collection/sources/${s.id}`} className="text-primary hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>{typeLabel(s.sourceType)}</TableCell>
                <TableCell className="font-mono text-xs">{s.scheduleCron ?? "手工"}</TableCell>
                <TableCell>{s.targetModules.join(", ") || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("zh-CN") : "未运行"}
                </TableCell>
                <TableCell className="text-right">{s.totalItemsCollected}</TableCell>
                <TableCell>
                  {s.enabled ? (
                    s.lastRunStatus === "failed" ? (
                      <Badge variant="destructive">失败</Badge>
                    ) : s.lastRunStatus === "partial" ? (
                      <Badge variant="secondary">部分失败</Badge>
                    ) : (
                      <Badge variant="default">启用</Badge>
                    )
                  ) : (
                    <Badge variant="outline">暂停</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id || !s.enabled}
                      onClick={() => handleTrigger(s.id)}
                      title="立即触发"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id}
                      onClick={() => handleToggle(s.id, s.enabled)}
                      title={s.enabled ? "暂停" : "启用"}
                    >
                      {s.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === s.id}
                      onClick={() => handleDelete(s.id, s.name)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.3** Build check: `npm run build`

- [ ] **Step 4.4** Commit:
```bash
git add src/app/\(dashboard\)/data-collection/sources/
git commit -m "feat(collection-hub/phase1): add sources list page with filters + row actions"
```

---

## Task 5: New source wizard (4-step form)

**Files:**
- Create: `src/app/(dashboard)/data-collection/sources/new/page.tsx` (server)
- Create: `src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx` (client)

- [ ] **Step 5.1** Create `src/app/(dashboard)/data-collection/sources/new/page.tsx`:

```tsx
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { NewSourceWizardClient } from "./new-source-wizard-client";

export const dynamic = "force-dynamic";

export default function NewSourcePage() {
  const adapterMetas = listAdapterMetas();
  return <NewSourceWizardClient adapterMetas={adapterMetas} />;
}
```

- [ ] **Step 5.2** Create `src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx`.

The wizard has 4 steps:
1. **Step 1 — 选择源类型**: render cards for each adapter with name + description + category
2. **Step 2 — 配置**: render form fields from `configFields` dynamically
3. **Step 3 — 调度与分类**: scheduleCron (dropdown of presets: 手工 / 15min / 1h / 6h / 1d + custom), targetModules (checkboxes: hot_topics/news/benchmarking/knowledge), defaultCategory (text), defaultTags (comma-separated)
4. **Step 4 — 确认**: name (text) + preview of all config + submit

Full component:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import type { ConfigField } from "@/lib/collection/types";
import { createCollectionSource } from "@/app/actions/collection";

const CRON_PRESETS = [
  { value: "", label: "手工触发" },
  { value: "*/15 * * * *", label: "每 15 分钟" },
  { value: "0 * * * *", label: "每小时" },
  { value: "0 */6 * * *", label: "每 6 小时" },
  { value: "0 8 * * *", label: "每日 8:00" },
  { value: "0 0 * * 0", label: "每周日 0:00" },
];

const TARGET_MODULES = [
  { value: "hot_topics", label: "热点 (hot_topics)" },
  { value: "news", label: "研究 (news)" },
  { value: "benchmarking", label: "对标 (benchmarking)" },
  { value: "knowledge", label: "知识库 (knowledge)" },
];

export function NewSourceWizardClient({ adapterMetas }: { adapterMetas: AdapterMeta[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [sourceType, setSourceType] = useState<string>("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [scheduleCron, setScheduleCron] = useState<string>("");
  const [targetModules, setTargetModules] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>("");
  const [defaultTagsRaw, setDefaultTagsRaw] = useState<string>("");
  const [name, setName] = useState<string>("");

  const selectedMeta = adapterMetas.find((m) => m.type === sourceType);

  const canAdvance = () => {
    if (step === 1) return Boolean(sourceType);
    if (step === 2) return selectedMeta?.configFields.every((f) => {
      if (!f.required) return true;
      const v = config[f.key];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== "";
    });
    if (step === 3) return true;
    if (step === 4) return name.trim().length > 0;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const tags = defaultTagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const { sourceId } = await createCollectionSource({
        name: name.trim(),
        sourceType,
        config,
        scheduleCron: scheduleCron || null,
        targetModules,
        defaultCategory: defaultCategory.trim() || null,
        defaultTags: tags.length > 0 ? tags : null,
      });
      toast.success("源创建成功");
      router.push(`/data-collection/sources/${sourceId}`);
    } catch (err) {
      toast.error(`创建失败: ${err instanceof Error ? err.message : String(err)}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/data-collection/sources" className="text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="inline h-4 w-4" />返回
        </Link>
      </div>
      <h2 className="text-2xl font-semibold">新建采集源</h2>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`flex-1 h-1 rounded ${n <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 1: Type selection */}
      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">1. 选择源类型</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adapterMetas.map((m) => (
              <button
                key={m.type}
                type="button"
                onClick={() => { setSourceType(m.type); setConfig({}); }}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  sourceType === m.type ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <div className="font-medium">{m.displayName}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
                <div className="text-xs text-muted-foreground mt-2">类型: {m.category}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Config */}
      {step === 2 && selectedMeta && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">2. 配置 {selectedMeta.displayName}</h3>
          {selectedMeta.configFields.map((f) => (
            <ConfigFieldInput
              key={f.key}
              field={f}
              value={config[f.key]}
              onChange={(v) => setConfig({ ...config, [f.key]: v })}
            />
          ))}
        </section>
      )}

      {/* Step 3: Schedule + target modules + category */}
      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">3. 调度与分类</h3>
          <div>
            <Label>调度频率</Label>
            <Select value={scheduleCron} onValueChange={setScheduleCron}>
              <SelectTrigger><SelectValue placeholder="选择频率" /></SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value || "__manual__"}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">选择"手工触发"后源只能手动运行。</p>
          </div>
          <div>
            <Label>归属模块(采集到的内容会派生到这些模块)</Label>
            <div className="flex flex-col gap-2 mt-2">
              {TARGET_MODULES.map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={targetModules.includes(m.value)}
                    onCheckedChange={(checked) => {
                      if (checked) setTargetModules([...targetModules, m.value]);
                      else setTargetModules(targetModules.filter((v) => v !== m.value));
                    }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="defaultCategory">默认分类(可选)</Label>
            <Input
              id="defaultCategory"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="如:要闻/科技/体育"
            />
          </div>
          <div>
            <Label htmlFor="defaultTags">默认标签(可选,逗号分隔)</Label>
            <Input
              id="defaultTags"
              value={defaultTagsRaw}
              onChange={(e) => setDefaultTagsRaw(e.target.value)}
              placeholder="如:热榜,每日"
            />
          </div>
        </section>
      )}

      {/* Step 4: Name + confirm */}
      {step === 4 && selectedMeta && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">4. 命名 & 确认</h3>
          <div>
            <Label htmlFor="name">源名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:微博抖音小红书热榜"
              autoFocus
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <div><span className="text-muted-foreground">类型: </span>{selectedMeta.displayName}</div>
            <div><span className="text-muted-foreground">调度: </span>{CRON_PRESETS.find((p) => p.value === scheduleCron)?.label ?? "自定义"}</div>
            <div><span className="text-muted-foreground">归属模块: </span>{targetModules.join(", ") || "无"}</div>
            <div><span className="text-muted-foreground">配置: </span><code className="text-xs">{JSON.stringify(config)}</code></div>
          </div>
        </section>
      )}

      {/* Nav buttons */}
      <div className="flex justify-between pt-4 border-t border-border/30">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />上一步
        </Button>
        {step < 4 ? (
          <Button disabled={!canAdvance()} onClick={() => setStep(step + 1)}>
            下一步<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!canAdvance() || submitting} onClick={handleSubmit}>
            {submitting ? "创建中..." : "确认创建"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// Declarative form field renderer
// ───────────────────────────────────────────

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div>
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput(field, value, onChange)}
      {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
    </div>
  );
}

function renderInput(field: ConfigField, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <Input
          id={field.key}
          type={field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          id={field.key}
          type="number"
          value={(value as number) ?? ""}
          min={field.validation?.min}
          max={field.validation?.max}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.key}
            checked={Boolean(value)}
            onCheckedChange={(c) => onChange(Boolean(c))}
          />
        </div>
      );
    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.help ?? "请选择"} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return <MultiSelectInput field={field} value={value} onChange={onChange} />;
    case "kv":
      // Simple key-value JSON editor (single textarea)
      return (
        <Textarea
          id={field.key}
          value={value ? JSON.stringify(value, null, 2) : ""}
          rows={4}
          placeholder='{"key": "value"}'
          onChange={(e) => {
            try {
              onChange(e.target.value ? JSON.parse(e.target.value) : {});
            } catch {
              // keep invalid text,let user fix
            }
          }}
        />
      );
  }
}

function MultiSelectInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const opts = field.options;

  if (opts) {
    // Render as checkbox group
    return (
      <div className="flex flex-wrap gap-3 mt-2">
        {opts.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={arr.includes(o.value)}
              onCheckedChange={(c) => {
                if (c) onChange([...arr, o.value]);
                else onChange(arr.filter((v) => v !== o.value));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  // Free-form: comma-separated input
  return (
    <Input
      id={field.key}
      value={arr.join(", ")}
      placeholder="逗号分隔多个值"
      onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
```

- [ ] **Step 5.3** Handle the `scheduleCron: "__manual__"` placeholder — Select can't have an empty `value`. In the submit handler, map `__manual__` back to `""` before passing to server action (the logic is already there via `scheduleCron: scheduleCron || null` — verify this works; if not, add: `scheduleCron: scheduleCron === "__manual__" ? null : scheduleCron`).

- [ ] **Step 5.4** Build check: `npm run build` — fix any shadcn component import paths if they differ.

- [ ] **Step 5.5** Commit:
```bash
git add src/app/\(dashboard\)/data-collection/sources/new/
git commit -m "feat(collection-hub/phase1): add new source wizard (4-step form)"
```

---

## Task 6: Source detail page

**Files:**
- Create: `src/app/(dashboard)/data-collection/sources/[id]/page.tsx` (server)
- Create: `src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx` (client)

- [ ] **Step 6.1** Create `src/app/(dashboard)/data-collection/sources/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import {
  getCollectionSourceById,
  listRecentRunsBySource,
  listRecentItemsBySource,
} from "@/lib/dal/collection";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAdapterMeta } from "@/lib/collection/adapter-meta";
import { SourceDetailClient } from "./source-detail-client";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const source = await getCollectionSourceById(id, orgId);
  if (!source) notFound();

  const [runs, items] = await Promise.all([
    listRecentRunsBySource(id, orgId, 20),
    listRecentItemsBySource(id, orgId, 20),
  ]);
  const meta = getAdapterMeta(source.sourceType);

  return (
    <SourceDetailClient
      source={{
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        sourceTypeLabel: meta?.displayName ?? source.sourceType,
        config: source.config,
        scheduleCron: source.scheduleCron,
        targetModules: source.targetModules,
        defaultCategory: source.defaultCategory,
        defaultTags: source.defaultTags,
        enabled: source.enabled,
        createdAt: source.createdAt.toISOString(),
        lastRunAt: source.lastRunAt?.toISOString() ?? null,
        lastRunStatus: source.lastRunStatus,
        totalItemsCollected: source.totalItemsCollected,
        totalRuns: source.totalRuns,
      }}
      runs={runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        status: r.status,
        itemsAttempted: r.itemsAttempted,
        itemsInserted: r.itemsInserted,
        itemsMerged: r.itemsMerged,
        itemsFailed: r.itemsFailed,
        errorSummary: r.errorSummary,
      }))}
      items={items.map((i) => ({
        id: i.id,
        title: i.title,
        canonicalUrl: i.canonicalUrl,
        firstSeenChannel: i.firstSeenChannel,
        firstSeenAt: i.firstSeenAt.toISOString(),
        category: i.category,
        tags: i.tags,
      }))}
    />
  );
}
```

- [ ] **Step 6.2** Create `src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx` with 3 tabs (Overview / Recent Runs / Recent Items):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  triggerCollectionSource,
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
} from "@/app/actions/collection";

export interface SourceDetail {
  id: string;
  name: string;
  sourceType: string;
  sourceTypeLabel: string;
  config: unknown;
  scheduleCron: string | null;
  targetModules: string[];
  defaultCategory: string | null;
  defaultTags: string[] | null;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalItemsCollected: number;
  totalRuns: number;
}

export interface RunSummary {
  id: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  itemsAttempted: number;
  itemsInserted: number;
  itemsMerged: number;
  itemsFailed: number;
  errorSummary: string | null;
}

export interface ItemSummary {
  id: string;
  title: string;
  canonicalUrl: string | null;
  firstSeenChannel: string;
  firstSeenAt: string;
  category: string | null;
  tags: string[] | null;
}

export function SourceDetailClient({
  source,
  runs,
  items,
}: {
  source: SourceDetail;
  runs: RunSummary[];
  items: ItemSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleTrigger = async () => {
    setBusy(true);
    try {
      await triggerCollectionSource(source.id);
      toast.success("已触发一次采集,约 10-30 秒后刷新查看结果");
      // Auto-refresh after 15s
      setTimeout(() => router.refresh(), 15_000);
    } catch (err) {
      toast.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    try {
      await toggleCollectionSourceEnabled(source.id, !source.enabled);
      toast.success(!source.enabled ? "已启用" : "已暂停");
      router.refresh();
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确认删除源「${source.name}」?`)) return;
    setBusy(true);
    try {
      await deleteCollectionSource(source.id);
      toast.success("已删除");
      router.push("/data-collection/sources");
    } catch (err) {
      toast.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/data-collection/sources" className="text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="inline h-4 w-4" />返回列表
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{source.name}</h2>
            <Badge variant={source.enabled ? "default" : "outline"}>
              {source.enabled ? "启用" : "暂停"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleTrigger} disabled={busy || !source.enabled}>
            <RefreshCw className="mr-2 h-4 w-4" />立即触发
          </Button>
          <Button variant="outline" onClick={handleToggle} disabled={busy}>
            {source.enabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {source.enabled ? "暂停" : "启用"}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />删除
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="runs">最近运行 ({runs.length})</TabsTrigger>
          <TabsTrigger value="items">最近内容 ({items.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground">基础信息</h3>
              <KV label="类型" value={source.sourceTypeLabel} />
              <KV label="调度" value={source.scheduleCron ?? "手工触发"} />
              <KV label="归属模块" value={source.targetModules.join(", ") || "—"} />
              <KV label="默认分类" value={source.defaultCategory ?? "—"} />
              <KV label="默认标签" value={source.defaultTags?.join(", ") ?? "—"} />
              <KV label="创建于" value={new Date(source.createdAt).toLocaleString("zh-CN")} />
            </div>
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground">统计</h3>
              <KV label="累计采集" value={String(source.totalItemsCollected)} />
              <KV label="累计运行" value={String(source.totalRuns)} />
              <KV label="最近运行" value={source.lastRunAt ? new Date(source.lastRunAt).toLocaleString("zh-CN") : "未运行"} />
              <KV label="最近状态" value={source.lastRunStatus ?? "—"} />
            </div>
            <div className="md:col-span-2 rounded-lg border bg-muted/20 p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">配置</h3>
              <pre className="text-xs overflow-x-auto">{JSON.stringify(source.config, null, 2)}</pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>开始</TableHead>
                  <TableHead>触发</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">新增</TableHead>
                  <TableHead className="text-right">合并</TableHead>
                  <TableHead className="text-right">失败</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无运行记录</TableCell></TableRow>
                )}
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{new Date(r.startedAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell>{r.trigger}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "success" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.itemsInserted}</TableCell>
                    <TableCell className="text-right">{r.itemsMerged}</TableCell>
                    <TableCell className="text-right">{r.itemsFailed}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.errorSummary ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>采集时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">暂无内容</TableCell></TableRow>
                )}
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.canonicalUrl ? (
                        <a href={i.canonicalUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{i.title}</a>
                      ) : i.title}
                    </TableCell>
                    <TableCell className="text-sm">{i.firstSeenChannel}</TableCell>
                    <TableCell>{i.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(i.firstSeenAt).toLocaleString("zh-CN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-muted-foreground min-w-[80px]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
```

- [ ] **Step 6.3** Build check: `npm run build`. If `@/components/ui/tabs` path differs (some shadcn configs use `tabs` plural singular), adjust.

- [ ] **Step 6.4** Commit:
```bash
git add src/app/\(dashboard\)/data-collection/sources/\[id\]/
git commit -m "feat(collection-hub/phase1): add source detail page with runs/items tabs"
```

---

## Task 7: Inspiration pool SSE migration

**Files:**
- Modify: `src/app/api/inspiration/crawl/route.ts`

Currently the SSE route imports `crawlSinglePlatform` and `persistCrawledTopics` from `@/app/actions/hot-topics` and calls them directly per platform. We change it to:
1. Ensure there's a "default" tophub source (create if missing, per-org)
2. Dispatch `collection/source.run-requested` event for that source
3. Stream progress by polling the latest `collection_run` for that source

- [ ] **Step 7.1** Read the existing `src/app/api/inspiration/crawl/route.ts` fully to understand:
  - Authentication pattern
  - Platform list hardcoded vs from env
  - SSE message shape that the frontend consumes

- [ ] **Step 7.2** Identify frontend SSE message shape. Find `src/app/(dashboard)/inspiration/inspiration-client.tsx` or similar and see what fields it expects (`type: "progress" | "complete"`, `current/total/platform/itemsFound/error`).

- [ ] **Step 7.3** Rewrite `src/app/api/inspiration/crawl/route.ts` to:

```ts
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { collectionSources, collectionRuns, userProfiles } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

const DEFAULT_INSPIRATION_SOURCE_NAME = "__inspiration_default__";
const DEFAULT_PLATFORMS = [
  "weibo", "zhihu", "baidu", "douyin",
  "toutiao", "36kr", "bilibili", "xiaohongshu",
  "thepaper", "weixin",
];

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) return new Response("No org", { status: 400 });
  const orgId = profile.organizationId;

  // Find or create default inspiration tophub source
  const [existing] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, DEFAULT_INSPIRATION_SOURCE_NAME),
        isNull(collectionSources.deletedAt),
      ),
    )
    .limit(1);

  let sourceId: string;
  if (existing) {
    sourceId = existing.id;
  } else {
    const [created] = await db.insert(collectionSources).values({
      organizationId: orgId,
      name: DEFAULT_INSPIRATION_SOURCE_NAME,
      sourceType: "tophub",
      config: { platforms: DEFAULT_PLATFORMS },
      targetModules: ["hot_topics"],
      defaultCategory: null,
      defaultTags: ["灵感池"],
      enabled: true,
      createdBy: user.id,
    }).returning({ id: collectionSources.id });
    sourceId = created.id;
  }

  // Dispatch event
  await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId,
      organizationId: orgId,
      trigger: "manual",
    },
  });

  // Stream progress via polling collection_runs
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const maxAttempts = 30; // 30 * 2s = 60s max
      let attempts = 0;
      let lastStatus: string | null = null;

      controller.enqueue(encoder.encode(sseEvent({
        type: "progress",
        current: 0,
        total: DEFAULT_PLATFORMS.length,
        platform: "启动中",
      })));

      while (attempts++ < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));

        const [latestRun] = await db
          .select()
          .from(collectionRuns)
          .where(eq(collectionRuns.sourceId, sourceId))
          .orderBy(desc(collectionRuns.startedAt))
          .limit(1);

        if (!latestRun) continue;

        if (latestRun.status !== lastStatus) {
          lastStatus = latestRun.status;
          if (latestRun.status === "running") {
            controller.enqueue(encoder.encode(sseEvent({
              type: "progress",
              current: Math.min(attempts, DEFAULT_PLATFORMS.length),
              total: DEFAULT_PLATFORMS.length,
              platform: "处理中",
            })));
          } else {
            controller.enqueue(encoder.encode(sseEvent({
              type: "complete",
              newTopics: latestRun.itemsInserted,
              updatedTopics: latestRun.itemsMerged,
              total: latestRun.itemsAttempted,
            })));
            controller.close();
            return;
          }
        }
      }

      controller.enqueue(encoder.encode(sseEvent({
        type: "complete",
        newTopics: 0,
        updatedTopics: 0,
        total: 0,
        timeout: true,
      })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 7.4** **Important caveat:** This change removes the fine-grained per-platform progress the old SSE had. The new route just shows "处理中" and "完成", because `fetchTrendingFromApi("platforms", ...)` internally uses Promise.allSettled and doesn't expose per-platform events. This is an acceptable Phase 1 tradeoff (product-wise the user just needs to see progress + completion); Phase 3 can add per-platform hook-ins to the TopHub adapter if needed.

Document this in the commit message.

- [ ] **Step 7.5** **Downstream concern:** The existing inspiration page UI may read from the old `hot_topics` table via its existing DAL. The new pipeline writes to `collected_items` but the heavy enrichment of `hot_topics` happens in Phase 2 (via the subscriber). **So after Phase 1 migration, the inspiration page will show LESS data** until Phase 2 wires up the hot_topics enricher.

This is a known temporary regression. Document clearly in the commit message:

> ⚠️ After this change, the inspiration page `hot_topics` data stops being populated until Phase 2 wires up the enricher subscriber. Manual fallback: keep the old code path behind a flag, OR schedule Phase 2 immediately.

**Option:** to avoid regression, keep both writes temporarily. Update your `inngest/functions/index.ts` to temporarily keep the OLD `hotTopicCrawler` cron running in parallel. This way hot_topics keeps being populated from the old path while the new path starts accumulating `collected_items`. Phase 2 will then flip the switch cleanly.

**Recommended: take the parallel-write approach.** Modify the SSE route to dispatch BOTH the new Inngest event AND still run the old direct crawler (temporarily). Frontend unchanged.

Actually simpler: just do the Inngest dispatch, and keep the OLD cron (`hotTopicCrawlScheduler`) running on its 1h schedule. The inspiration page still gets populated from that cron. The SSE "manual" trigger just goes through new pipeline for now.

So revise Step 7.3: Dispatch new Inngest event as shown, BUT don't remove/disable `hotTopicCrawlScheduler` — it keeps running and keeping hot_topics fresh. The user-triggered SSE now uses the new path but gets less frontend feedback (acceptable for "manual refresh").

- [ ] **Step 7.6** Build check: `npm run build`

- [ ] **Step 7.7** Commit:
```bash
git add src/app/api/inspiration/crawl/route.ts
git commit -m "$(cat <<'EOF'
feat(collection-hub/phase1): migrate inspiration SSE to new collection pipeline

User-triggered inspiration refresh now dispatches collection/source.run-requested
for the default tophub source (auto-created per-org), then streams progress via
polling collection_runs. Coarser progress granularity than old path but acceptable
for Phase 1.

NOTE: hotTopicCrawlScheduler cron continues running unchanged — the inspiration
page still gets fresh hot_topics data via that path. Phase 2 will wire up the
hot_topics enricher subscriber and then the old cron can be decommissioned.
EOF
)"
```

---

## Task 8: Phase 1 acceptance

- [ ] **Step 8.1** Full test run:
```bash
npm run test
```

Expected: all tests pass (Phase 0 tests + 5-ish new DAL tests from Task 1 = ~118 tests).

- [ ] **Step 8.2** Type check:
```bash
npx tsc --noEmit
```

- [ ] **Step 8.3** Build:
```bash
npm run build
```

- [ ] **Step 8.4** Visual verify (requires dev server, user-interactive):
  - Open `/data-collection/sources` → see empty state if no sources
  - Click "新建源" → wizard appears
  - Walk through 4 steps for a `tophub` source with platforms=["weibo"], schedule=手工, targetModules=["hot_topics"], name="微博热搜测试"
  - Submit → redirects to detail page
  - Click "立即触发" → wait 15s → refresh → see a run in "最近运行" tab with status=success, itemsInserted > 0
  - Click "最近内容" tab → see the collected items

  (If dev server is blocked by proxy etc., skip this step and document it as deferred.)

- [ ] **Step 8.5** Update spec Phase 1 entry:

In `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`, find "### Phase 1:" and append " ✅ 完成 2026-04-18" to the heading.

- [ ] **Step 8.6** Final commit:
```bash
git add docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
git commit -m "docs(collection-hub): mark Phase 1 complete"
```

---

## After Phase 1

Next is Phase 2: **热榜 & 对标迁移** (1 week)
- Migrate existing `hotTopicCrawler` Inngest function to use new pipeline
- Refactor `hotTopicEnrichmentPipeline` to subscribe to `collection/item.created`
- Migrate `benchmarkingPlatformCrawler` to use `tavily` adapter + `site:` filter config
- Phase 2 plan will be written when Phase 1 is verified in production
