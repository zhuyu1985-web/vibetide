# Collection Hub · Phase 2 热榜迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 把热榜抓取从旧的 `hotTopicCrawler`（直接写 `hot_topics`）完全切换到新的 Collection Hub 管道：新 cron 派发 `collection/source.run-requested` → `runCollectionSource` → TopHub Adapter → `collected_items` → 新 bridge 订阅者桥接到 `hot_topics`（复用现有 `hotTopicEnrichmentPipeline` 做 LLM 富化）。

**Architecture:** 用 **bridge 订阅者** 模式替代重写：Phase 0/1 的 Writer 产出 `collection/item.created` 事件,新 bridge 函数监听该事件、过滤出 `targetModules.includes("hot_topics")` 的 item、把 `collected_items` 行映射成 `hot_topics` 行（聚合 `source_channels[]` 得 `platforms[]` / `heatCurve` / `priority`）、upsert 后派发**原有的** `hot-topics/enrich-requested` 事件让旧 enrichment 继续工作。这样能**保留现有 enrichment 管道（340 行 LLM + 分类 + topic_angles/comment_insights/calendar_events 写入逻辑）原封不动**，把风险控制在"新→桥接→旧"三段里最小化。

**Tech Stack:** Next.js 16、Drizzle 0.45.1、Inngest v3。

**Phase 2 范围说明（与 spec 原文的偏差）：**
- ✅ 含：热榜 cron 迁移 + 富化订阅新事件
- ⏸️ **延迟到 Phase 3**：对标（benchmarking）迁移 —— 因为它是 per-monitored-platform 结构（每个 `monitored_platform` 有独立 `crawlFrequencyMinutes`）,会导致 N 个 collection_source 的设计问题,应与 Phase 3 的"调度器抽象化"一起做。本阶段保留 `benchmarkingCrawlScheduler` / `benchmarkingPlatformCrawler` 不动。

**依赖前置：**
- Phase 0 + Phase 1 完成（最新 commit `e87be52`）
- `collection_sources` / `collected_items` 表已在 DB
- Inngest 事件 `collection/source.run-requested` + `collection/item.created` 已注册
- `runCollectionSource` 编排器工作,TopHub Adapter 已注册

**Phase 2 验收标准：**
- 新 cron `collectionHotTopicCron` 每小时触发,每个组织派发一次 run
- 一次 run 之后,`collected_items` 出现新数据,`hot_topics` 里出现对应 `collected_item_id` 外键的行,对应 `topic_angles`/`comment_insights` 也产生
- 旧 `hotTopicCrawlScheduler` / `hotTopicCrawler` 代码已删除,`src/inngest/functions/index.ts` 仅引用新函数
- 旧 `hot-topics/crawl-triggered` 事件不再被发出（但定义保留在 `events.ts` 里,Phase 3 清理）
- `/inspiration` 页面 hot_topics 数据持续流入（无断档）
- `npm run test` + `npm run build` + `tsc --noEmit` 全绿

**关联文档：**
- Spec: `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md` (Section 10 Phase 2)
- Phase 0 plan: `docs/superpowers/plans/2026-04-18-collection-hub-phase0-foundation.md`
- Phase 1 plan: `docs/superpowers/plans/2026-04-18-collection-hub-phase1-sources-ui.md`

---

## 文件结构总览

### 新建
- `src/lib/collection/seed-system-sources.ts` — `ensureHotTopicSystemSource(orgId)` 幂等创建/更新"系统热榜采集源"
- `src/inngest/functions/collection/hot-topic-cron.ts` — 每小时 cron,对每个 org 派发 run
- `src/inngest/functions/collection/hot-topic-bridge.ts` — 订阅 `collection/item.created`,桥接到 `hot_topics`

### 修改
- `src/db/schema/hot-topics.ts` — 新增 `collectedItemId` 字段
- `supabase/migrations/XXXX_*.sql` — drizzle-kit 生成
- `src/inngest/functions/collection/index.ts` — 导出新函数
- `src/inngest/functions/index.ts` — 注册新函数,**移除** `hotTopicCrawlScheduler` 与 `hotTopicCrawler`

### 删除
- `src/inngest/functions/hot-topic-crawl.ts` — 完全删除

### 保留（不动）
- `src/inngest/functions/hot-topic-enrichment.ts` — 现有 `hotTopicEnrichmentPipeline`,监听 `hot-topics/enrich-requested`,这是 bridge 的下游
- `src/inngest/events.ts` — 事件定义全部保留,包括 `hot-topics/crawl-triggered`（Phase 3 清理）
- 所有 benchmarking 代码

---

## Task 1: Schema 迁移 — `hot_topics.collectedItemId` FK

**Files:**
- Modify: `src/db/schema/hot-topics.ts`
- Generated: `supabase/migrations/XXXX_*.sql`

- [ ] **Step 1.1** 在 `src/db/schema/hot-topics.ts` 中打开 `hotTopics` 表定义。
  - 首部追加 import：`import { collectedItems } from "./collection";` （如果不存在）
  - 在字段区域新增一列（位置放在其他业务字段之后、索引定义之前）：

```ts
collectedItemId: uuid("collected_item_id").references(() => collectedItems.id, {
  onDelete: "set null",
}),
```

  - 在 index 定义（`(t) => ({ ... })`）中新增：

```ts
collectedItemIdx: index("hot_topics_collected_item_idx").on(t.collectedItemId),
```

- [ ] **Step 1.2** 生成迁移：

```bash
npm run db:generate
```

Expected: 新增一个 `XXXX_*.sql`,内容仅为 `ALTER TABLE "hot_topics" ADD COLUMN ...` + `CREATE INDEX ...`。**不应该 drop 或 recreate 任何表**。

检查生成的 SQL：

```bash
cat supabase/migrations/$(ls supabase/migrations/ | grep -vE "meta|pg_trgm" | tail -1)
```

若 drizzle 试图 drop/recreate 表,STOP 升级。

- [ ] **Step 1.3** 应用迁移：

```bash
npm run db:migrate
```

- [ ] **Step 1.4** 验证：

```bash
DATABASE_URL=$(grep "DATABASE_URL=" .env.local | grep -v "^\s*#" | head -1 | awk -F= '{for(i=2;i<=NF;i++)printf "%s",($i)(i<NF?"=":"")}') && psql "$DATABASE_URL" -c "\\d hot_topics" | grep -E "collected_item|hot_topics_collected_item_idx"
```

Expected: 看到 `collected_item_id | uuid` 列与 `hot_topics_collected_item_idx` 索引。

- [ ] **Step 1.5** Type check：

```bash
npx tsc --noEmit
```

- [ ] **Step 1.6** Commit：

```bash
git add src/db/schema/hot-topics.ts supabase/migrations/
git commit -m "feat(collection-hub/phase2): add collected_item_id FK to hot_topics"
```

---

## Task 2: 系统源种子函数

**Files:**
- Create: `src/lib/collection/seed-system-sources.ts`

系统源指运营**不能通过 UI 创建**的"内置"采集源（通过命名约定隐藏）。用于取代旧 cron 里硬编码的抓取行为。

- [ ] **Step 2.1** 创建 `src/lib/collection/seed-system-sources.ts`：

```ts
import { db } from "@/db";
import { collectionSources } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { TOPHUB_DEFAULT_NODES, PLATFORM_ALIASES } from "@/lib/trending-api";

/**
 * 系统源命名约定: 带 __system__ 前缀,UI 过滤时隐藏(Phase 2 暂不过滤,留给 Phase 3)
 */
export const SYSTEM_HOT_TOPIC_SOURCE_NAME = "__system_hot_topic_crawler__";

/**
 * 把 TopHub 默认节点名(中文)映射为 tophub Adapter 接受的英文别名。
 * 与 src/app/api/inspiration/crawl/route.ts 的 buildDefaultPlatforms 保持一致。
 */
function buildHotTopicPlatforms(): string[] {
  return Object.keys(TOPHUB_DEFAULT_NODES).map((chineseName) => {
    const aliases = PLATFORM_ALIASES[chineseName];
    return aliases?.[0] ?? chineseName.toLowerCase();
  });
}

/**
 * 幂等:为指定组织确保存在一个启用的系统热榜采集源。
 * - 不存在时创建
 * - 存在但被软删除时重新启用并清除 deletedAt
 * - 已存在时仅刷新 config.platforms（保证始终与最新 TOPHUB_DEFAULT_NODES 同步）
 */
export async function ensureHotTopicSystemSource(organizationId: string): Promise<string> {
  const platforms = buildHotTopicPlatforms();

  const [existing] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        eq(collectionSources.name, SYSTEM_HOT_TOPIC_SOURCE_NAME),
      ),
    )
    .limit(1);

  if (existing) {
    // Refresh config + ensure enabled + not soft-deleted
    await db
      .update(collectionSources)
      .set({
        config: { platforms },
        enabled: true,
        deletedAt: null,
        updatedAt: new Date(),
        targetModules: ["hot_topics"],
      })
      .where(eq(collectionSources.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(collectionSources)
    .values({
      organizationId,
      name: SYSTEM_HOT_TOPIC_SOURCE_NAME,
      sourceType: "tophub",
      config: { platforms },
      targetModules: ["hot_topics"],
      enabled: true,
      scheduleCron: "0 * * * *", // Informational; actual schedule is driven by collectionHotTopicCron below
    })
    .returning({ id: collectionSources.id });

  return created.id;
}
```

- [ ] **Step 2.2** Type check：`npx tsc --noEmit`

- [ ] **Step 2.3** Commit：

```bash
git add src/lib/collection/seed-system-sources.ts
git commit -m "feat(collection-hub/phase2): add ensureHotTopicSystemSource seeder"
```

---

## Task 3: 新热榜 cron 函数

**Files:**
- Create: `src/inngest/functions/collection/hot-topic-cron.ts`

- [ ] **Step 3.1** 创建 `src/inngest/functions/collection/hot-topic-cron.ts`：

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { ensureHotTopicSystemSource } from "@/lib/collection/seed-system-sources";

/**
 * 每小时 cron: 遍历所有组织,确保各自的系统热榜源存在并派发一次采集。
 * 取代旧的 hotTopicCrawlScheduler + hotTopicCrawler。
 */
export const collectionHotTopicCron = inngest.createFunction(
  { id: "collection-hot-topic-cron", name: "Collection Hub - Hot Topic Cron" },
  { cron: "0 * * * *" }, // hourly on the hour
  async ({ step }) => {
    const orgs = await step.run("find-organizations", async () => {
      return db.select({ id: organizations.id }).from(organizations);
    });

    if (orgs.length === 0) return { message: "No organizations found" };

    const dispatched = await step.run("seed-and-dispatch", async () => {
      let count = 0;
      for (const org of orgs) {
        const sourceId = await ensureHotTopicSystemSource(org.id);
        await inngest.send({
          name: "collection/source.run-requested",
          data: {
            sourceId,
            organizationId: org.id,
            trigger: "cron",
          },
        });
        count++;
      }
      return count;
    });

    return { dispatched };
  },
);
```

- [ ] **Step 3.2** Commit：

```bash
git add src/inngest/functions/collection/hot-topic-cron.ts
git commit -m "feat(collection-hub/phase2): add collectionHotTopicCron (replaces old hotTopicCrawlScheduler)"
```

---

## Task 4: Bridge 订阅者 — `collected_items` → `hot_topics`

**Files:**
- Create: `src/inngest/functions/collection/hot-topic-bridge.ts`

这是 Phase 2 最核心的代码。它在 `collection/item.created` 事件触达时,把新采集到的 collected_item 桥接为 hot_topic 行,然后派发 **原有的** `hot-topics/enrich-requested` 事件让现有 LLM 管道接手。

- [ ] **Step 4.1** 先复习旧 `hotTopicCrawler` 的聚合逻辑（`src/inngest/functions/hot-topic-crawl.ts` 100-280 行）：理解 `platforms[]` / `heatCurve[]` / `priority` / `heatScore` / `titleHash` 是如何从 TrendingItem 聚合出来的。bridge 里需要把这套逻辑从 `TrendingItem[]` 改造成从 `collected_items.source_channels[]` 读取。

关键聚合字段映射：
- 旧 `platforms[]` ← 新 `source_channels[].channel` 的 `tophub/{platform}` 提取 `{platform}`
- 旧 `heatCurve[]` ← 暂时用空数组 `[]`,Phase 3 再补（需要时序采集支持）
- 旧 `titleHash` ← **`MD5(normalizeTitleKey(item.title))`**（旧逻辑的哈希方案,与 `collected_items.content_fingerprint` **不同**！这是关键修正：旧哈希没有 date bucket,只截断到 20 字符；新哈希带 date bucket。**必须用旧公式生成 titleHash** 才能与已有的 hot_topics 行去重匹配,避免 dual-operation 期间产生重复行。）
- 旧 `heatScore` ← 从 `raw_metadata.heat` 读取（如果存在）并用 `normalizeHeatScore` 归一化
- 旧 `priority` ← 同旧逻辑：`sourceChannels.length >= 3 → P0`,`>= 2 → P1`,`else → P2`(可随后 heatScore re-rank)
- 新 `collectedItemId` ← `event.data.itemId`

- [ ] **Step 4.2** 创建 `src/inngest/functions/collection/hot-topic-bridge.ts`：

```ts
import crypto from "node:crypto";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, hotTopics } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  normalizeHeatScore,
  classifyByKeywords,
  normalizeTitleKey,
} from "@/lib/trending-api";

interface SourceChannelEntry {
  channel: string;
  url?: string;
  sourceId: string;
  runId: string;
  capturedAt: string;
}

/**
 * Recompute hot_topics.titleHash using the LEGACY formula (not the collection-hub
 * content_fingerprint). This ensures the bridge's upsert can dedup against
 * existing rows inserted by the old hotTopicCrawler during parallel operation.
 *
 * OLD formula (see src/lib/trending-api.ts normalizeTitleKey):
 *   MD5(normalizeTitleKey(title))  // lowercase, strip punct, truncate to 20 chars
 *
 * NEW collected_items.content_fingerprint formula (see normalize.ts):
 *   MD5(normalizeTitle(title) + ":" + date_bucket)  // different stripping + date bucket
 *
 * These hash different inputs -- incompatible.
 */
function computeLegacyTitleHash(title: string): string {
  return crypto.createHash("md5").update(normalizeTitleKey(title)).digest("hex");
}

/**
 * Subscriber: 新 collected_item 到达时,如果 targetModules 包含 "hot_topics",
 * 就把它桥接到 hot_topics 表,然后派发旧的 hot-topics/enrich-requested 事件
 * 让 hotTopicEnrichmentPipeline 继续做 LLM 富化。
 */
export const collectionHotTopicBridge = inngest.createFunction(
  {
    id: "collection-hot-topic-bridge",
    name: "Collection Hub - Hot Topic Bridge",
    concurrency: { limit: 4 },
    retries: 2,
  },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    if (!event.data.targetModules.includes("hot_topics")) {
      return { skipped: true, reason: "targetModules missing hot_topics" };
    }

    const itemId = event.data.itemId;
    const organizationId = event.data.organizationId;

    // Step 1: Load collected_item
    const item = await step.run("load-item", async () => {
      const [row] = await db
        .select()
        .from(collectedItems)
        .where(eq(collectedItems.id, itemId))
        .limit(1);
      if (!row) throw new Error(`collected_item ${itemId} not found`);
      return row;
    });

    // Step 2: Aggregate channels → platforms list
    const aggregated = await step.run("aggregate", async () => {
      const channels = (item.sourceChannels as SourceChannelEntry[]) ?? [];
      const platforms = Array.from(
        new Set(
          channels
            .map((c) => c.channel.startsWith("tophub/") ? c.channel.slice(7) : null)
            .filter((p): p is string => Boolean(p)),
        ),
      );

      // Heat score from rawMetadata (first heat value seen; TopHub gives per-node heat)
      const rawHeat = (item.rawMetadata as { heat?: number | string })?.heat;
      const heatScore = rawHeat !== undefined ? normalizeHeatScore(rawHeat) : 50;

      // Priority: based on cross-platform coverage
      const priority =
        platforms.length >= 3 ? "P0"
        : platforms.length >= 2 ? "P1"
        : heatScore >= 75 ? "P1"
        : "P2";

      // Category via keyword classification (same as old crawler)
      const category = classifyByKeywords(item.title);

      return { platforms, heatScore, priority, category };
    });

    // Step 3: Upsert hot_topics
    const hotTopicId = await step.run("upsert-hot-topic", async () => {
      // CRITICAL: titleHash uses the LEGACY formula (no date bucket, 20-char truncate)
      // so the dedup lookup can match rows previously inserted by hotTopicCrawler.
      // See computeLegacyTitleHash above for rationale.
      const legacyTitleHash = computeLegacyTitleHash(item.title);

      const [existing] = await db
        .select({ id: hotTopics.id })
        .from(hotTopics)
        .where(
          and(
            eq(hotTopics.organizationId, organizationId),
            eq(hotTopics.titleHash, legacyTitleHash),
          ),
        )
        .limit(1);

      if (existing) {
        // Already bridged (or previously inserted by old crawler); update aggregates + FK
        await db
          .update(hotTopics)
          .set({
            platforms: aggregated.platforms,
            heatScore: aggregated.heatScore,
            priority: aggregated.priority,
            collectedItemId: itemId,
            updatedAt: new Date(),
          })
          .where(eq(hotTopics.id, existing.id));
        return existing.id;
      }

      const [inserted] = await db
        .insert(hotTopics)
        .values({
          organizationId,
          title: item.title,
          titleHash: legacyTitleHash, // legacy formula, not collected_items.content_fingerprint
          sourceUrl: item.canonicalUrl,
          priority: aggregated.priority,
          heatScore: aggregated.heatScore,
          trend: "plateau", // will be refined by enrichment
          source: aggregated.platforms[0] ?? item.firstSeenChannel,
          category: aggregated.category,
          platforms: aggregated.platforms,
          heatCurve: [], // populated over time; Phase 3 will track via event timestamps
          discoveredAt: item.firstSeenAt,
          collectedItemId: itemId,
        })
        .returning({ id: hotTopics.id });

      return inserted.id;
    });

    // Step 4: Decide whether to dispatch enrichment.
    // Mirror the old crawler's gate: P0/P1 or high heat (>=30).
    const shouldEnrich =
      aggregated.priority === "P0" ||
      aggregated.priority === "P1" ||
      aggregated.heatScore >= 30;

    if (shouldEnrich) {
      await step.run("dispatch-enrichment", async () => {
        await inngest.send({
          name: "hot-topics/enrich-requested",
          data: {
            organizationId,
            topicIds: [hotTopicId],
          },
        });
      });
    }

    return {
      itemId,
      hotTopicId,
      platforms: aggregated.platforms.length,
      enriched: shouldEnrich,
    };
  },
);
```

**关于 `classifyByKeywords`、`normalizeHeatScore`、`normalizeTitleKey`**: 这三个帮助函数都已经从 `@/lib/trending-api` 导出（已确认 export 在 src/lib/trending-api.ts 行 349/384/394）。

**关于 `hot-topics/enrich-requested` 事件的 data 形状**: 查看 `src/inngest/events.ts`,确认字段为 `{ organizationId, topicIds: string[] }`。若不一致,按实际定义调整。

**关于与 `__inspiration_default__` 源的共存**: Phase 1 里的灵感池 SSE 已经建立了一个 per-org 的 `__inspiration_default__` 源,其 `targetModules: ["hot_topics"]` 也会触发本 bridge。这是**有意的**——两个源（系统 cron + 手工灵感池）都写同一个 `hot_topics` 表,因为 bridge 是幂等的（按 legacy titleHash 去重）。手工触发的最新数据会被自动纳入 hot_topics。这不是 bug。

- [ ] **Step 4.3** Type check：`npx tsc --noEmit`

如果 `classifyByKeywords` 或 `normalizeHeatScore` 不在 `@/lib/trending-api` 的 export 里,打开该文件给它们加 `export` 关键字并 commit separately。

- [ ] **Step 4.4** Commit：

```bash
git add src/inngest/functions/collection/hot-topic-bridge.ts
git commit -m "feat(collection-hub/phase2): add collectionHotTopicBridge subscriber

Bridges new collection/item.created events to legacy hot_topics table,
preserving existing hotTopicEnrichmentPipeline (LLM enrichment + derived
tables) via re-dispatch of hot-topics/enrich-requested."
```

---

## Task 5: 注册新函数,移除旧函数

**Files:**
- Modify: `src/inngest/functions/collection/index.ts`
- Modify: `src/inngest/functions/index.ts`
- Delete: `src/inngest/functions/hot-topic-crawl.ts`

- [ ] **Step 5.1** 更新 `src/inngest/functions/collection/index.ts`：

```ts
export { runCollectionSource } from "./run-source";
export { collectionSmokeConsumer } from "./smoke-consumer";
export { collectionHotTopicCron } from "./hot-topic-cron";
export { collectionHotTopicBridge } from "./hot-topic-bridge";
```

- [ ] **Step 5.2** 更新 `src/inngest/functions/index.ts`：

找到旧导入块：
```ts
import {
  hotTopicCrawlScheduler,
  hotTopicCrawler,
} from "./hot-topic-crawl";
```

**删除这段整个 import**。

找到 collection 的 import 块（T13 of Phase 0 added）：
```ts
import {
  runCollectionSource,
  collectionSmokeConsumer,
} from "./collection";
```

**扩展为**：
```ts
import {
  runCollectionSource,
  collectionSmokeConsumer,
  collectionHotTopicCron,
  collectionHotTopicBridge,
} from "./collection";
```

找到 `functions` 数组。删除其中 `hotTopicCrawlScheduler` 和 `hotTopicCrawler` 这两行。保留 `hotTopicEnrichmentPipeline`（它是新 bridge 的下游）。

在 collection 的两个旧 entries（`runCollectionSource`, `collectionSmokeConsumer`）**后面追加**：
```ts
  collectionHotTopicCron,
  collectionHotTopicBridge,
```

- [ ] **Step 5.3** 删除旧文件：

```bash
git rm src/inngest/functions/hot-topic-crawl.ts
```

- [ ] **Step 5.4** Type check + build：

```bash
npx tsc --noEmit
npm run build
```

期望全绿。如果有 import 到 `hot-topic-crawl` 的地方（除了 functions/index.ts）,report as BLOCKED with the file paths.

**敏感点：** 旧的 `hot-topics/crawl-triggered` 事件定义在 `src/inngest/events.ts` 仍然存在（未清理）。这没关系——事件类型仍可以被定义,只是没人发也没人订。Phase 3 清理。

- [ ] **Step 5.5** Commit：

```bash
git add src/inngest/functions/collection/index.ts src/inngest/functions/index.ts
git commit -m "feat(collection-hub/phase2): register new cron+bridge, remove hotTopicCrawlScheduler/hotTopicCrawler

Old hot-topic-crawl.ts deleted. hotTopicEnrichmentPipeline (LLM
enrichment) remains — it's now fed by collectionHotTopicBridge via the
unchanged 'hot-topics/enrich-requested' event."
```

---

## Task 6: Phase 2 验收 + 文档

- [ ] **Step 6.1** 全量测试：`npm run test`  — 应与 Phase 1 末相同（121/121 pass）+ 不应有失败。

- [ ] **Step 6.2** Type check + build：

```bash
npx tsc --noEmit
npm run build
```

全绿。build 应不再列出 `/api/hot-topic-crawl`（不是路由,略过）但 `/inspiration` 等依赖 hot_topics DAL 的页面仍应构建成功。

- [ ] **Step 6.3** DB sanity check：

```bash
DATABASE_URL=$(grep "DATABASE_URL=" .env.local | grep -v "^\s*#" | head -1 | awk -F= '{for(i=2;i<=NF;i++)printf "%s",($i)(i<NF?"=":"")}') && psql "$DATABASE_URL" -c "\\d hot_topics" | head -25
```

确认 `collected_item_id` 列存在。

- [ ] **Step 6.4** 更新 spec 标记 Phase 2 完成。打开 `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`,找到 Phase 2 标题,追加 `✅ 完成 2026-04-18`,并在备注里说明 "仅热榜部分,benchmarking 推到 Phase 3"。

- [ ] **Step 6.5** Commit spec 更新：

```bash
git add docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
git commit -m "docs(collection-hub): mark Phase 2 complete (hot-topic migration only)

Phase 2 delivered:
- collected_item_id FK on hot_topics
- ensureHotTopicSystemSource seeder
- collectionHotTopicCron (hourly, per-org)
- collectionHotTopicBridge: collected_items → hot_topics, dispatches existing
  hot-topics/enrich-requested to preserve LLM enrichment pipeline
- Removed old hot-topic-crawl.ts + its 2 Inngest functions

Benchmarking migration deferred to Phase 3 (per-platform architecture
needs dedicated scheduler work that's out of scope here).

Manual soak verification (requires working dev + proxy config):
- Cron hits at the next :00, dispatches run for each org
- Check new runs in collection_runs for __system_hot_topic_crawler__ source
- Check hot_topics gets rows with collected_item_id populated
- Check /inspiration continues to show topics (no data gap)"
```

---

## 手工验收步骤（用户需要在本地执行）

1. 启动 Inngest dev + Next dev + 设 NO_PROXY（同 Phase 0/1）
2. 访问 `/data-collection/sources` 看看是否出现 `__system_hot_topic_crawler__` 源（等 cron 跑一次后会被种子出来）
3. **强制触发一次**: 到该源详情页点"立即触发",10-30 秒后看"最近运行" + "最近内容" tab
4. SQL 核验:
   ```sql
   SELECT id, title, collected_item_id, platforms, priority, heat_score
     FROM hot_topics
     WHERE collected_item_id IS NOT NULL
     ORDER BY discovered_at DESC
     LIMIT 10;
   ```
   应看到近几分钟内被 bridge 写入的热榜条目,`collected_item_id` 非空。
5. 访问 `/inspiration` 确认页面仍正常显示热点列表（无数据断档）

---

## Phase 3 预告

Phase 3 范围：
- `list_scraper` Adapter 开发（融合白名单列表 + CSS 选择器）
- `rss` Adapter 开发
- benchmarking 迁移（含 per-platform scheduler 抽象）
- 研究任务 3 分支（Tavily / 白名单 / 手工 URL）迁移
- 预估 1.5 周

要等 Phase 2 手工验收通过 + 至少一周生产观察（无数据断档）后再启动。
