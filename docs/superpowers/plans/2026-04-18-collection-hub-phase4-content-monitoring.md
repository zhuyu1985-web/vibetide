# Collection Hub · Phase 4 内容浏览 + 监控面板 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 让运营在 `/data-collection/content` **一个地方看到所有采集到的内容**（卡片 + 表格双视图,多维度筛选,全文搜索,点开看完整 source_channels 轨迹 + 派生模块链接）,在 `/data-collection/monitoring` 看到**采集健康度**（24h KPI,7d 采集趋势,来源分布,最差源 Top-N,最近错误详情）。这是整个项目最关键的"用户价值兑现"阶段。

**Architecture:** 沿用 Phase 1 的 Server page → Client component 模式。DAL 扩展 `collected_items` 的多维筛选 + trigram 全文搜索（`pg_trgm` 的 `ILIKE` 加速,Phase 0 已建索引）。内容详情走右侧 drawer（`Sheet`）展示 `source_channels[]` 时间轴 + 派生表跳转链接。监控面板从 `collection_runs` / `collection_logs` 聚合,`Recharts`（已 deps）画趋势。

**Tech Stack:** Next.js 16、Drizzle、shadcn/ui（Sheet、Tabs、Card、Table、Chart 容器）、Recharts 3.7、Tailwind v4。

**Phase 4 范围说明：**
- ✅ 含：内容浏览页 + 监控面板 + DAL 扩展
- ⏸️ **Phase 5**：研究任务 3 分支迁移 + benchmarking 迁移(它们让内容池变得更"厚",但纯基础设施工作,与内容浏览页解耦)

**依赖前置：**
- Phase 0-3 完成
- `collected_items` / `collection_runs` / `collection_logs` 表有数据
- `pg_trgm` GIN 索引在 `title` + `content` 上（Phase 0 已建）

**Phase 4 验收标准：**
- `/data-collection/content` 能看到所有 `collected_items`,支持卡片/表格切换
- 筛选器支持：源类型 / 平台（source_channels 派生）/ 时间窗(1h/24h/7d/30d/自定义) / 归属模块 / 富化状态
- 顶部搜索框能做全文搜索(title+content ILIKE),响应在 1s 内
- 点击一条记录在右侧 drawer 显示详情(原始 raw_metadata + source_channels 时间轴 + 派生到哪些领域表带跳转链接)
- `/data-collection/monitoring` 显示 4 个 KPI + 7d 趋势折线 + 来源饼图 + 最近错误列表
- `npm run test` + `build` + `tsc` 全绿
- sidebar 两个页面 tab nav 都能点击

**关联文档：**
- Spec: `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md` (Section 9 后台 UI)
- Phase 1 plan: `docs/superpowers/plans/2026-04-18-collection-hub-phase1-sources-ui.md`

---

## 文件结构总览

### 新建 — DAL 扩展
- `src/lib/dal/collected-items.ts` — 分页查询 + 筛选 + 全文搜索 + 详情读取

### 新建 — 路由
- `src/app/(dashboard)/data-collection/content/page.tsx`（server）
- `src/app/(dashboard)/data-collection/content/content-client.tsx`（client）
- `src/app/(dashboard)/data-collection/content/item-detail-drawer.tsx`（client）
- `src/app/(dashboard)/data-collection/monitoring/page.tsx`（server）
- `src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx`（client）

### 修改
- `src/app/(dashboard)/data-collection/layout.tsx` — 取消预留注释,启用 `内容浏览` + `监控面板` 两个 tab

### 不动
- Phase 1-3 已存在的 source 相关页面

---

## Task 1: DAL 扩展 — 内容池查询

**Files:**
- Create: `src/lib/dal/collected-items.ts`
- Test: `src/lib/dal/__tests__/collected-items.test.ts`

### 功能

- `listCollectedItems(orgId, filters, pagination)` — 多维筛选 + trigram 全文搜索
- `getCollectedItemDetail(itemId, orgId)` — 详情 + 反查派生记录（hot_topics.collected_item_id 等）
- `getDerivedRecordsForItem(itemId, orgId)` — 单独返回派生记录供详情页用（避免一次查询太复杂）
- `getMonitoringSummary(orgId, windowMs)` — 监控面板 KPI
- `getCollectionTrend(orgId, days)` — 7d/30d 趋势数据（按天聚合）
- `getSourceErrorList(orgId, days)` — 最差源列表（按错误次数倒序）
- `getRecentErrors(orgId, limit)` — 最近错误日志条目

### Step 1.1 — 创建 `src/lib/dal/collected-items.ts`

```ts
import { db } from "@/db";
import {
  collectedItems,
  collectionSources,
  collectionRuns,
  collectionLogs,
  hotTopics,
} from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

export type CollectedItemRow = InferSelectModel<typeof collectedItems>;

// ────────────────────────────────────────────────
// 筛选 + 分页
// ────────────────────────────────────────────────

export interface ContentFilters {
  sourceType?: string;
  targetModule?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  sinceMs?: number; // 时间窗起始 epoch ms
  untilMs?: number; // 可选结束
  platformAlias?: string; // 从 first_seen_channel / source_channels 匹配 "tophub/weibo" -> "weibo"
  searchText?: string; // title + content ILIKE
}

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

export interface ListCollectedItemsResult {
  items: CollectedItemRow[];
  total: number;
}

export async function listCollectedItems(
  organizationId: string,
  filters: ContentFilters = {},
  pagination: PaginationOpts = {},
): Promise<ListCollectedItemsResult> {
  const limit = pagination.limit ?? 50;
  const offset = pagination.offset ?? 0;

  const conditions = [eq(collectedItems.organizationId, organizationId)];

  if (filters.sourceType) {
    // 需要 join collection_sources.sourceType
    const sourceIds = await db
      .select({ id: collectionSources.id })
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, organizationId),
          eq(collectionSources.sourceType, filters.sourceType),
        ),
      );
    if (sourceIds.length === 0) {
      return { items: [], total: 0 };
    }
    conditions.push(inArray(collectedItems.firstSeenSourceId, sourceIds.map((r) => r.id)));
  }

  if (filters.targetModule) {
    // derived_modules 是 text[],用 array contains
    conditions.push(sql`${collectedItems.derivedModules} @> ARRAY[${filters.targetModule}]::text[]`);
  }

  if (filters.enrichmentStatus) {
    conditions.push(eq(collectedItems.enrichmentStatus, filters.enrichmentStatus));
  }

  if (filters.sinceMs !== undefined) {
    conditions.push(gte(collectedItems.firstSeenAt, new Date(filters.sinceMs)));
  }
  if (filters.untilMs !== undefined) {
    conditions.push(sql`${collectedItems.firstSeenAt} <= ${new Date(filters.untilMs)}`);
  }

  if (filters.platformAlias) {
    // 匹配 first_seen_channel 或 source_channels[*].channel 里包含 "tophub/{alias}" 等
    conditions.push(
      sql`(${collectedItems.firstSeenChannel} ILIKE ${`%/${filters.platformAlias}`} OR ${collectedItems.sourceChannels} @> ${JSON.stringify([{ channel: `tophub/${filters.platformAlias}` }])}::jsonb)`,
    );
  }

  if (filters.searchText) {
    const q = `%${filters.searchText}%`;
    conditions.push(
      sql`(${collectedItems.title} ILIKE ${q} OR ${collectedItems.content} ILIKE ${q})`,
    );
  }

  const rows = await db
    .select()
    .from(collectedItems)
    .where(and(...conditions))
    .orderBy(desc(collectedItems.firstSeenAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(and(...conditions));

  return { items: rows, total: count };
}

// ────────────────────────────────────────────────
// 详情 + 派生反查
// ────────────────────────────────────────────────

export interface DerivedRecordSummary {
  module: "hot_topics" | "news" | "benchmarking" | "knowledge";
  recordId: string;
  title?: string;
  linkHref: string;
}

export async function getDerivedRecordsForItem(
  itemId: string,
  organizationId: string,
): Promise<DerivedRecordSummary[]> {
  const results: DerivedRecordSummary[] = [];

  // hot_topics (Phase 2 已建 FK)
  const ht = await db
    .select({ id: hotTopics.id, title: hotTopics.title })
    .from(hotTopics)
    .where(
      and(
        eq(hotTopics.organizationId, organizationId),
        eq(hotTopics.collectedItemId, itemId),
      ),
    );
  for (const r of ht) {
    results.push({
      module: "hot_topics",
      recordId: r.id,
      title: r.title,
      linkHref: `/inspiration?topicId=${r.id}`, // V1 跳转路径,如不对路径改为 `/hot-topics/${r.id}` 或最合适的现有页
    });
  }

  // news_articles / platform_content / knowledge_items 的 FK 要到 Phase 5 才加,此处先空

  return results;
}

export async function getCollectedItemDetail(
  itemId: string,
  organizationId: string,
): Promise<CollectedItemRow | null> {
  const [row] = await db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.id, itemId),
        eq(collectedItems.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ────────────────────────────────────────────────
// 监控面板查询
// ────────────────────────────────────────────────

export interface MonitoringSummary {
  itemsLast24h: number;
  itemsLast7d: number;
  totalRunsLast24h: number;
  failedRunsLast24h: number;
  successRate24h: number; // 0..1
  activeSources: number;
  totalSources: number;
}

export async function getMonitoringSummary(
  organizationId: string,
): Promise<MonitoringSummary> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [items24] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        gte(collectedItems.firstSeenAt, since24h),
      ),
    );
  const [items7d] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        gte(collectedItems.firstSeenAt, since7d),
      ),
    );

  const [runs] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed')::int`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since24h),
      ),
    );

  const [sources] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${collectionSources.enabled} = true)::int`,
    })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        sql`${collectionSources.deletedAt} IS NULL`,
      ),
    );

  const total24 = runs?.total ?? 0;
  const failed24 = runs?.failed ?? 0;
  return {
    itemsLast24h: items24?.c ?? 0,
    itemsLast7d: items7d?.c ?? 0,
    totalRunsLast24h: total24,
    failedRunsLast24h: failed24,
    successRate24h: total24 > 0 ? (total24 - failed24) / total24 : 1,
    activeSources: sources?.active ?? 0,
    totalSources: sources?.total ?? 0,
  };
}

export interface CollectionTrendPoint {
  date: string; // YYYY-MM-DD
  inserted: number;
  merged: number;
  failed: number;
}

export async function getCollectionTrend(
  organizationId: string,
  days = 7,
): Promise<CollectionTrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      date: sql<string>`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`,
      inserted: sql<number>`sum(${collectionRuns.itemsInserted})::int`,
      merged: sql<number>`sum(${collectionRuns.itemsMerged})::int`,
      failed: sql<number>`sum(${collectionRuns.itemsFailed})::int`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since),
      ),
    )
    .groupBy(sql`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`);

  return rows.map((r) => ({
    date: r.date,
    inserted: r.inserted ?? 0,
    merged: r.merged ?? 0,
    failed: r.failed ?? 0,
  }));
}

export interface SourceErrorSummary {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  failedCount: number;
  partialCount: number;
  lastFailedAt: Date | null;
  lastErrorMessage: string | null;
}

export async function getSourceErrorList(
  organizationId: string,
  days = 7,
  limit = 10,
): Promise<SourceErrorSummary[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      sourceId: collectionRuns.sourceId,
      failed: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed')::int`,
      partial: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'partial')::int`,
      lastFailedAt: sql<Date | null>`max(${collectionRuns.finishedAt}) FILTER (WHERE ${collectionRuns.status} = 'failed')`,
      lastErrorMessage: sql<string | null>`(array_agg(${collectionRuns.errorSummary} ORDER BY ${collectionRuns.finishedAt} DESC) FILTER (WHERE ${collectionRuns.status} = 'failed'))[1]`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since),
      ),
    )
    .groupBy(collectionRuns.sourceId)
    .orderBy(sql`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed') DESC`)
    .limit(limit);

  // Get source names in a second query
  const sourceIds = rows.map((r) => r.sourceId);
  const sourceRows = sourceIds.length > 0
    ? await db
        .select({
          id: collectionSources.id,
          name: collectionSources.name,
          sourceType: collectionSources.sourceType,
        })
        .from(collectionSources)
        .where(inArray(collectionSources.id, sourceIds))
    : [];
  const nameMap = new Map(sourceRows.map((s) => [s.id, s]));

  return rows
    .filter((r) => (r.failed ?? 0) + (r.partial ?? 0) > 0)
    .map((r) => ({
      sourceId: r.sourceId,
      sourceName: nameMap.get(r.sourceId)?.name ?? "(已删除)",
      sourceType: nameMap.get(r.sourceId)?.sourceType ?? "?",
      failedCount: r.failed ?? 0,
      partialCount: r.partial ?? 0,
      lastFailedAt: r.lastFailedAt,
      lastErrorMessage: r.lastErrorMessage,
    }));
}

export interface RecentErrorRow {
  logId: number;
  loggedAt: Date;
  sourceId: string;
  sourceName: string;
  level: "info" | "warn" | "error";
  message: string;
}

export async function getRecentErrors(
  organizationId: string,
  limit = 30,
): Promise<RecentErrorRow[]> {
  const rows = await db
    .select({
      logId: collectionLogs.id,
      loggedAt: collectionLogs.loggedAt,
      sourceId: collectionLogs.sourceId,
      sourceName: collectionSources.name,
      level: collectionLogs.level,
      message: collectionLogs.message,
    })
    .from(collectionLogs)
    .innerJoin(collectionSources, eq(collectionLogs.sourceId, collectionSources.id))
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        eq(collectionLogs.level, "error"),
      ),
    )
    .orderBy(desc(collectionLogs.loggedAt))
    .limit(limit);

  return rows.map((r) => ({
    logId: r.logId,
    loggedAt: r.loggedAt,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    level: r.level as "info" | "warn" | "error",
    message: r.message,
  }));
}
```

### Step 1.2 — 测试 `src/lib/dal/__tests__/collected-items.test.ts`

写一个集成测,覆盖多租户隔离 + 基本筛选 + 搜索。遵循 Phase 1 T1 的测试结构,创建 2 个临时 org 并在各自下创建少量 sources + items + runs + logs,验证每个函数的 org 隔离。

关键测试用例（至少 8 个）：
- `listCollectedItems` 返回本 org 的所有
- `listCollectedItems` 按 `sourceType` 过滤（需要 join）
- `listCollectedItems` 按 `targetModule` 过滤
- `listCollectedItems` 按 `sinceMs` 时间窗过滤
- `listCollectedItems` 按 `searchText` ILIKE 过滤 title 与 content
- `listCollectedItems` 返回正确的分页 total 值
- `getMonitoringSummary` 返回正确的 KPI
- `getCollectionTrend` 返回正确的日期分组
- `getSourceErrorList` 按 failed 降序
- `getDerivedRecordsForItem` 返回 hot_topics 派生记录

建议参考 `src/lib/dal/__tests__/collection.test.ts`（Phase 1 T1 已有）的 `beforeAll`/`afterAll` org 清理模式,做好清理。

### Step 1.3 — 跑测试 + commit

```bash
npm run test -- src/lib/dal/__tests__/collected-items.test.ts
```

全绿后：
```bash
git add src/lib/dal/collected-items.ts src/lib/dal/__tests__/collected-items.test.ts
git commit -m "feat(collection-hub/phase4): add DAL for content browser + monitoring"
```

---

## Task 2: 内容浏览页 — layout + 数据加载

**Files:**
- Create: `src/app/(dashboard)/data-collection/content/page.tsx`
- Create: `src/app/(dashboard)/data-collection/content/content-client.tsx`

### Step 2.1 — 更新 layout 启用 tabs

打开 `src/app/(dashboard)/data-collection/layout.tsx`,把 `tabs` 数组里被注释掉的两行取消注释：

```ts
const tabs = [
  { href: "/data-collection/sources", label: "源管理" },
  { href: "/data-collection/content", label: "内容浏览" },
  { href: "/data-collection/monitoring", label: "监控面板" },
];
```

### Step 2.2 — 创建 `src/app/(dashboard)/data-collection/content/page.tsx`（server）

Server component:
- `searchParams` 读取筛选参数(如 `?sourceType=tophub&module=hot_topics&time=24h&q=keyword&view=card`)
- 调用 `listCollectedItems(orgId, filters, {limit: 50})` + `listAdapterMetas()` 获取 adapter 元数据
- 解析 `time` 参数 → `sinceMs`(例如 `24h` → `Date.now() - 24*60*60*1000`)
- 把结果传给 `ContentClient`

### Step 2.3 — 创建 `src/app/(dashboard)/data-collection/content/content-client.tsx`

Client:
- 顶部搜索框（binding 到 URL `?q=...`,debounce 300ms）
- 顶部右侧：视图切换（卡片/表格 toggle）+ 筛选抽屉按钮（Sheet 打开）
- 左侧筛选抽屉（`Sheet` from shadcn）：
  - 源类型 checkbox 组（5 个 Adapter）
  - 平台文本框（输入 weibo/zhihu/douyin 等别名）
  - 时间窗单选（24h / 7d / 30d / 全部）
  - 归属模块 checkbox 组
  - 富化状态（pending / enriched）
  - 提交应用、重置
- 主区：卡片视图 或 表格视图（Task 3 细化）
- 每点击一条记录,打开右侧 detail drawer（Task 3）

用 URL 参数驱动所有筛选器,便于分享链接和浏览器前进后退。

### Step 2.4 — commit

```bash
git add "src/app/(dashboard)/data-collection/content/" "src/app/(dashboard)/data-collection/layout.tsx"
git commit -m "feat(collection-hub/phase4): add content browser layout + data load"
```

---

## Task 3: 内容浏览 — 卡片/表格双视图 + 详情 drawer

**Files:**
- Modify: `src/app/(dashboard)/data-collection/content/content-client.tsx`
- Create: `src/app/(dashboard)/data-collection/content/item-detail-drawer.tsx`

### Step 3.1 — 卡片视图 (默认)

每张卡片显示：
- 顶部：标题（最多 2 行,ellipsis）
- 来源徽章（`first_seen_channel` 或 `source_channels.length` 个平台）
- 第一抓取时间 + published_at（如有）
- 摘要（2 行,ellipsis）
- 底部：派生模块图标 + 分类徽章

使用 shadcn `Card` 组件。网格 2 列（md:3 列）。

### Step 3.2 — 表格视图

表头：标题 / 首抓源 / 首抓时间 / 平台数 / 分类 / 富化状态 / 操作

行可点击打开 detail drawer。

用 shadcn `Table`,与 `/data-collection/sources` 风格一致。

### Step 3.3 — 详情 drawer (`item-detail-drawer.tsx`)

右侧抽屉（`Sheet`）:

- 顶部：标题 + `published_at` + 复制链接按钮
- Section 1 - 基础信息：分类 / 标签 / 语言
- Section 2 - source_channels 时间轴：按 capturedAt 倒序,每行一个 channel + url + 时间 + run 链接
- Section 3 - 派生模块链接：从 `getDerivedRecordsForItem()` 查到的 hot_topics 记录,带跳转按钮
- Section 4 - 内容预览:summary + 展开"查看正文"折叠面板
- Section 5 - raw_metadata JSON（monospace 字体,可折叠）

从 server 端 prefetch detail(通过点击卡片时再 fetch server action `getItemDetailAction(itemId)`,避免列表页一次拉取所有详情)。

### Step 3.4 — commit

```bash
git add "src/app/(dashboard)/data-collection/content/"
git commit -m "feat(collection-hub/phase4): add content card/table views + detail drawer"
```

---

## Task 4: 监控面板

**Files:**
- Create: `src/app/(dashboard)/data-collection/monitoring/page.tsx`
- Create: `src/app/(dashboard)/data-collection/monitoring/monitoring-client.tsx`

### Step 4.1 — Server page

从 DAL 拉：
- `getMonitoringSummary(orgId)` → KPI
- `getCollectionTrend(orgId, 7)` → 7d 趋势
- `getSourceErrorList(orgId, 7, 10)` → Top 10 错误源
- `getRecentErrors(orgId, 30)` → 最近 30 条错误日志
- `listCollectionSources(orgId)` → 来源分布饼图

传给 `MonitoringClient`。

### Step 4.2 — Client component

四个区块：

1. **顶部 KPI 卡**（4 张）：
   - 24h 采集量
   - 24h 成功率（percent,颜色按 >95=绿 >80=黄 else=红）
   - 活跃源 / 总源
   - 24h 错误数

2. **中部左 - 7d 采集趋势折线**（Recharts `LineChart`）：
   - X 轴：日期
   - Y 轴：数量
   - 三条线：inserted（蓝）/ merged（灰）/ failed（红）

3. **中部右 - 来源分布饼图**（Recharts `PieChart`）：
   - 按源类型聚合
   - 标签：源名 + 数量

4. **底部 - 错误源列表 + 错误日志**（左右两栏或上下两块）：
   - 左：`SourceErrorSummary` 表格,按 failedCount 倒序
   - 右：`RecentErrorRow` 滚动列表

用 shadcn `Card` 做容器。

### Step 4.3 — commit

```bash
git add "src/app/(dashboard)/data-collection/monitoring/"
git commit -m "feat(collection-hub/phase4): add monitoring dashboard"
```

---

## Task 5: Phase 4 验收 + 文档

- [ ] **Step 5.1** 全量测试 + build:
```bash
npm run test  # expect ~140+ tests pass (上一 phase 132 + Task 1 新增 10)
npx tsc --noEmit
npm run build
```

全绿。`/data-collection/content` 和 `/data-collection/monitoring` 都应出现在路由列表里。

- [ ] **Step 5.2** 更新 spec Phase 4 标题加 `✅ UI 部分完成 2026-04-18 (迁移留给 Phase 5)`

- [ ] **Step 5.3** commit:
```bash
git add docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
git commit -m "$(cat <<'EOF'
docs(collection-hub): mark Phase 4 complete (UI pages only)

Phase 4 delivered:
- DAL: listCollectedItems + filters (type/module/time/platform/search)
  + getCollectedItemDetail + getDerivedRecordsForItem
- Monitoring DAL: KPI summary + 7d trend + source error list + recent errors
- /data-collection/content: card + table dual view, filter sheet,
  trigram search, detail drawer with source_channels timeline + derived
  records links
- /data-collection/monitoring: 4 KPIs + 7d trend line chart + source
  distribution pie + error source table + recent errors stream

Phase 5 covers the remaining migrations (research tasks x3 + benchmarking)
which feed more data into the content pool.
EOF
)"
```

---

## Phase 4 后手工验收

1. 打开 `/data-collection/content`,应看到本组织所有 collected_items
2. 切换卡片/表格视图
3. 搜索关键词(如 "科技"),应只显示 title 或 content 包含该词的记录
4. 左侧筛选抽屉勾"归属模块: 热点",应只看到 derived_modules 包含 hot_topics 的
5. 点击一条记录,右侧 drawer 显示详情,可看 source_channels 时间轴
6. 打开 `/data-collection/monitoring`,4 个 KPI 有数据,7d 折线图显示

---

## Phase 5 预告

- 研究任务 Tavily 分支迁移 → tavily adapter
- 研究任务 白名单 → list_scraper adapter
- 研究任务 手工 URL → jina_url adapter
- benchmarking 迁移（per-platform scheduler 抽象化）
- news_articles / platform_content 加 `collected_item_id` FK,bridge 订阅者
- 清理 hot_topic_crawl_logs 旧代码
- 预估 1.5 周

等 Phase 4 跑稳后启动。
