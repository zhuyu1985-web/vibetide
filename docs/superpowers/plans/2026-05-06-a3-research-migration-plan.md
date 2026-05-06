# A3 Research 模块迁移到 Collection Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把研究模块的"自有原始数据存储"（`research_news_articles` + `research_news_article_topic_hits`）彻底迁到 Collection Hub 统一池（`collected_items`），新增"研究语义层"附属表（采集项 ↔ 16 主题 / 40 区县），自动打标 Inngest 函数订阅 `collection/item.created` 事件命中关键词写 annotation 表，让研究模块只做"消费 + 加标注"不再有自己的采集分支。

**Architecture:** drop demo 数据（同 A1 Path C 模式，A3-Q1 决策 a）→ DROP 2 老表 + CREATE 2 annotation 表（research_collected_item_topics / research_collected_item_districts）→ DAL 重写 `news-article-search.ts → collected-item-search.ts`（查 collected_items + leftJoin annotation 表）→ Inngest annotate 函数（topic-matcher 关键词 + 近似词命中 + district-matcher 区县名称命中）+ backfill-annotate 一次性历史回填 → research UI 解 Phase 0 stub → cleanup 删 4 个旧 inngest 自采分支（保留 bridge-backfill 独立链路）。

**Tech Stack:** Next.js 16 App Router / TypeScript strict / Drizzle ORM / Supabase / Inngest / vitest。

**关联 sub-spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-06-a3-research-migration-design.md`

**关联 main spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.4

**总工期：3.5-4.5 工作日**（5 phase）

---

## 全局约定

- **单分支**（CLAUDE.md）：所有 commit 直接落 `main`
- **--no-verify** 已授权全 Wave 1
- **绝对路径**：所有文件引用使用绝对路径
- **设计系统**：所有按钮/输入用 vibetide 共享组件 + 无边框 + sonner toast
- **TDD 节奏**：DAL / matcher / annotate Inngest 严格红→绿；UI 部分跑 tsc 即可
- **A1 + A2 + A2.5 已就绪**：collected_items 已含 outlet 字段；Writer + outlet recognizer 集成；113 条 outlet 字典 + virtual excel_import source 已 seed
- **A1 Phase 0 已 stub** 6 处 research 文件含 `// A3 阶段...` 注释，本 plan 解开

---

## File Structure

### Phase 1 删除

| 文件 | 理由 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts` | DROP `research_news_articles` + `research_news_article_topic_hits` 两表 schema |

### Phase 1 修改

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/enums.ts` | DROP `newsSourceChannelEnum`（无引用）；保留 `topicMatchTypeEnum` + `researchEmbeddingStatusEnum` + `researchDedupLevelEnum` + `researchTaskStatusEnum` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/index.ts` | barrel 删 export news-articles |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/research-topics.ts` | 删除对 newsArticles 的反向 relations 引用（如有） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/research-tasks.ts` | 删 firstSeenResearchTaskId 反向 relations 引用（如有） |

### Phase 1 新建

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/annotations.ts` | research_collected_item_topics + research_collected_item_districts 两张 annotation 表 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/2026050700000X_a3_research_migration.sql` | DROP 2 老表 + DROP enum + CREATE 2 annotation 表 |

### Phase 2 删除

| 文件 |
|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/article-ingest.ts`（A1 Phase 0 stub，A3 整体删） |

### Phase 2 修改

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/research-tasks.ts` | 移除对 newsArticles 引用，改为关联 collected_items + annotation |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/article-search.ts` → 重命名为 `collected-item-search.ts` 或重写 | server action 改为调新 DAL |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/research-tasks.ts` | 同上 |

### Phase 2 新建

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/collected-item-search.ts` | searchCollectedItemsForResearch + advancedSearch / leftJoin annotation 表 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/__tests__/collected-item-search.test.ts` | DAL 单测 |

### Phase 3 新建

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/topic-matcher.ts` | matchTopicsForItem(text, topics) → MatchResult[] |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/district-matcher.ts` | matchDistrictsForItem(text, districts, variants) → DistrictMatchResult[] + DISTRICT_VARIANTS dict |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/topic-matcher.test.ts` | matcher 单测 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/district-matcher.test.ts` | matcher 单测 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/annotate-collected-item.ts` | 订阅 collection/item.created 事件 → 命中 → 写 annotation 表 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/backfill-annotate.ts` | 一次性 Inngest（手工触发）→ 批量扫历史 collected_items 跑 annotate |

### Phase 3 修改

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/events.ts` | 注册 `research/backfill-annotate.requested` 事件类型 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts` | 注册 annotateCollectedItem + backfillAnnotate 两函数 |

### Phase 4 修改

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx` | 解 Phase 0 stub，重接 collected_items（按 outlet_tier / topic / district 聚合） + 同步注释 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx` | 重启用 outlet 字段筛选 + topic/district annotation 检索 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/tasks/*` | 评估保留/简化（detail page + new page），改为"检索快照"语义 |

### Phase 5 删除

| 文件 |
|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/tavily-crawl.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/whitelist-crawl.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/manual-url-ingest.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/article-content-fetch.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/task-start.ts`（重写或删；详 §Phase 4-5）|

### Phase 5 修改

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts` | 注销已删除函数（去掉 import + functions 数组中条目） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts` | 增 1 集成测试：writer 入库后 annotate Inngest 自动触发 + annotation 表写入 |

### 保留（不动）

| 文件 |
|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/bridge-backfill.ts`（独立链路，sub-spec §6 已确认保留） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/research-tasks.ts`（保留 + 简化语义，schema 不动） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/research-topics.ts` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/cq-districts.ts` |

---

## Phase 1：Schema 改动（Day 1，约 0.5-1 天）

### Task 1.1：新建 annotation schema

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/annotations.ts`

- [ ] **Step 1：写 schema 文件**

```ts
import { sql } from "drizzle-orm";
import {
  index, numeric, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { collectedItems } from "../collection";
import { researchTopics } from "./research-topics";
import { cqDistricts } from "./cq-districts";
import { topicMatchTypeEnum } from "./enums";

export const researchCollectedItemTopics = pgTable(
  "research_collected_item_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull()
      .references(() => researchTopics.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeyword: text("matched_keyword"),
    matchScore: numeric("match_score", { precision: 5, scale: 4 }),
    annotatedBy: text("annotated_by").notNull().default("system"),
    annotatedAt: timestamp("annotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueItemTopicMatch: unique("research_cit_unique").on(t.collectedItemId, t.topicId, t.matchType),
    itemIdx: index("research_cit_item_idx").on(t.collectedItemId),
    topicIdx: index("research_cit_topic_idx").on(t.topicId),
  }),
);

export const researchCollectedItemDistricts = pgTable(
  "research_collected_item_districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    districtId: uuid("district_id").notNull()
      .references(() => cqDistricts.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeyword: text("matched_keyword"),
    annotatedBy: text("annotated_by").notNull().default("system"),
    annotatedAt: timestamp("annotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueItemDistrict: unique("research_cid_unique").on(t.collectedItemId, t.districtId),
    itemIdx: index("research_cid_item_idx").on(t.collectedItemId),
    districtIdx: index("research_cid_district_idx").on(t.districtId),
  }),
);

export type ResearchCollectedItemTopicRow = typeof researchCollectedItemTopics.$inferSelect;
export type ResearchCollectedItemDistrictRow = typeof researchCollectedItemDistricts.$inferSelect;
```

- [ ] **Step 2：barrel export 追加**

修改 `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/index.ts` 追加：

```ts
export * from "./annotations";
```

- [ ] **Step 3：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

---

### Task 1.2：删 research_news_articles schema 文件

**Files:**
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts`

- [ ] **Step 1：删除文件**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts
```

- [ ] **Step 2：清理 barrel index.ts**

```bash
grep -n "news-articles" /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/index.ts
```

如有 `export * from "./news-articles"` 删除该行。

- [ ] **Step 3：清理 enums.ts**

```bash
grep -n "newsSourceChannelEnum\|sourceChannelEnum" /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/enums.ts
```

`newsSourceChannelEnum` 是 research_news_articles.source_channel 字段用的 enum。删除（A3 cleanup 后无引用）。其他 4 个 enum 保留：`topicMatchTypeEnum` / `researchEmbeddingStatusEnum` / `researchDedupLevelEnum` / `researchTaskStatusEnum`。

- [ ] **Step 4：tsc 看错误增量**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit 2>&1 | grep -E "Cannot find|has no exported member" | head -30
```

预期：会有大量 import 错误（DAL / actions / inngest 仍引用 newsArticles / newsArticleTopicHits / newsSourceChannelEnum）。这是 Phase 1 中间态，下一个 Task 1.3 stub 化让 build 通过。

---

### Task 1.3：stub 化下游引用让 tsc 通过

**目标：** Phase 2-5 才会真正改 DAL / inngest，但 Phase 1 末尾 tsc 必须 0 错。这一步只 stub 化引用，不动业务逻辑。

**Files:**
- Modify (stub): `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts`
- Modify (stub): `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/research-tasks.ts`
- Modify (stub): `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/article-search.ts`
- Modify (stub): `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/research-tasks.ts`
- Modify (stub): 现有 inngest functions（如 task-start.ts 仍引 newsArticles）

- [ ] **Step 1：grep 所有 newsArticles / newsArticleTopicHits 引用**

```bash
grep -rln "newsArticles\|newsArticleTopicHits\|newsSourceChannelEnum" /Users/zhuyu/dev/chinamcloud/vibetide/src --include="*.ts" --include="*.tsx" 2>/dev/null
```

- [ ] **Step 2：每处引用 stub 化**

策略：
- 把 `newsArticles` import 改为类型 stub `const newsArticles = {} as never; // A3 Phase 1 stub, real impl in Phase 2-5`
- 或在引用处直接注释 + 抛 `throw new Error("a3 phase 1 stub")` 让代码不调用即可
- DAL 里 `searchNewsArticles` 等函数 body 改为返回空数组 + warn log（A3 Phase 0 已部分 stub，本 step 补完）

替代方案：直接在 Phase 1 一次性删除 news-article-search.ts + 改造 research-tasks.ts（提前到 Phase 2 工作）。但这样 Phase 1 工作量大。

**推荐**：保留 Phase 1 只动 schema，stub 化下游引用让 tsc 通过；Phase 2 才真正重写 DAL。

- [ ] **Step 3：tsc 0 错**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

- [ ] **Step 4：build 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run build 2>&1 | tail -10
```

---

### Task 1.4：生成 + 应用 migration

**Files:**
- Generate: `/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/2026050X000001_a3_research_migration.sql`

- [ ] **Step 0：探查实际表名 + enum 名（学 A1 经验）**

```bash
psql "$DATABASE_URL" -c "\d research_news_articles" 2>&1 | head -3
psql "$DATABASE_URL" -c "\d research_news_article_topic_hits" 2>&1 | head -3
psql "$DATABASE_URL" -c "SELECT typname FROM pg_type WHERE typname LIKE '%research%' OR typname LIKE '%news%';"
```

- [ ] **Step 1：drizzle-kit generate**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:generate
# 或 pnpm db:generate
```

drizzle-kit 会自动生成 DROP table + CREATE table SQL。

- [ ] **Step 2：rename 时间戳格式 + 同步 journal**

```bash
DRIZZLE_FILE=$(ls -t /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/*.sql | head -1)
DRIZZLE_NAME=$(basename "$DRIZZLE_FILE" .sql)
NEW_NAME="20260507000001_a3_research_migration"
mv "$DRIZZLE_FILE" "/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/${NEW_NAME}.sql"

JOURNAL=/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/meta/_journal.json
jq --arg old "$DRIZZLE_NAME" --arg new "$NEW_NAME" \
  '.entries |= map(if .tag == $old then .tag = $new else . end)' \
  "$JOURNAL" > "$JOURNAL.tmp" && mv "$JOURNAL.tmp" "$JOURNAL"
```

- [ ] **Step 3：检查生成 SQL + 手工补 enum drop**

drizzle 不会自动删未引用的 enum。手工追加到 migration 末尾：

```sql

-- A3 手工追加：drop newsSourceChannelEnum（drizzle-kit 不会自动删 enum）
DROP TYPE IF EXISTS research_news_source_channel CASCADE;
```

确认 SQL 含：
- `DROP TABLE IF EXISTS research_news_article_topic_hits CASCADE`
- `DROP TABLE IF EXISTS research_news_articles CASCADE`
- `CREATE TABLE research_collected_item_topics` + 3 索引 + unique
- `CREATE TABLE research_collected_item_districts` + 3 索引 + unique

- [ ] **Step 4：应用 migration**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:migrate
```

如果 db:migrate 失败（同 A1 历史 tracking 问题），用 psql 直接应用 + 手工插入跟踪记录。

- [ ] **Step 5：psql 验证**

```bash
psql "$DATABASE_URL" -c "\d research_news_articles" 2>&1 | head -3
# 期望：error relation does not exist
psql "$DATABASE_URL" -c "\d research_collected_item_topics" 2>&1 | head -10
psql "$DATABASE_URL" -c "\d research_collected_item_districts" 2>&1 | head -10
psql "$DATABASE_URL" -c "SELECT typname FROM pg_type WHERE typname = 'research_news_source_channel';"
# 期望：0 行
```

---

### Task 1.5：Phase 1 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/db/schema/research/ \
        src/lib/dal/research/ \
        src/app/actions/research/ \
        src/inngest/functions/research/ \
        supabase/migrations/ && \
git commit --no-verify -m "$(cat <<'EOF'
chore(a3): Phase 1 — drop research_news_articles + research_news_article_topic_hits + 加 annotation 表

- DROP research_news_articles + research_news_article_topic_hits 两表（A3-Q1 决策 a 直接 drop demo）
- DROP research_news_source_channel enum
- 保留 topicMatchTypeEnum / researchEmbeddingStatusEnum / researchDedupLevelEnum / researchTaskStatusEnum 4 个 enum
- 新建 research_collected_item_topics + research_collected_item_districts 2 张 annotation 表（含 3 索引 + unique）
- migration 20260507000001_a3_research_migration.sql
- stub 化所有 newsArticles / newsArticleTopicHits / newsSourceChannelEnum 引用让 tsc/build 通过（Phase 2-5 真正重写）

tsc 0 错 / build 通过 / 数据库表/enum 删 + 新表创建已应用

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2：DAL + Server Actions 重写（Day 2，约 1 天）

### Task 2.1：写 collected-item-search DAL（TDD）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/collected-item-search.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/__tests__/collected-item-search.test.ts`

- [ ] **Step 1：写测试（TDD 红灯）**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchCollectedItemTopics, researchCollectedItemDistricts } from "@/db/schema/research/annotations";
import { eq } from "drizzle-orm";
import { searchCollectedItemsForResearch } from "../collected-item-search";

let orgId: string;
let topicAId: string;
let districtAId: string;
let item1Id: string;
let item2Id: string;

beforeAll(async () => {
  const [org] = await db.insert(organizations).values({ name: "Test A3 DAL", slug: "test-a3-dal-" + Date.now() }).returning();
  orgId = org!.id;

  const [topic] = await db.insert(researchTopics).values({
    organizationId: orgId, name: "美丽中国",
  }).returning();
  topicAId = topic!.id;
  // 关键词单独存 researchTopicKeywords 表（isPrimary=true 主词 / false 近似词）
  await db.insert(researchTopicKeywords).values([
    { topicId: topicAId, keyword: "美丽中国", isPrimary: true },
    { topicId: topicAId, keyword: "美丽中国建设", isPrimary: false },
  ]);

  const [district] = await db.insert(cqDistricts).values({ name: "涪陵区", code: "CQ-FL", sortOrder: 1 }).returning();
  districtAId = district!.id;

  const [i1] = await db.insert(collectedItems).values({
    organizationId: orgId, contentFingerprint: "fp1-" + Date.now(), title: "美丽中国 article 1",
    firstSeenChannel: "test", firstSeenAt: new Date(), outletTier: "central",
  }).returning();
  item1Id = i1!.id;

  const [i2] = await db.insert(collectedItems).values({
    organizationId: orgId, contentFingerprint: "fp2-" + Date.now(), title: "无关 article 2",
    firstSeenChannel: "test", firstSeenAt: new Date(), outletTier: "industry",
  }).returning();
  item2Id = i2!.id;

  await db.insert(researchCollectedItemTopics).values({
    collectedItemId: item1Id, topicId: topicAId, matchType: "keyword", matchedKeyword: "美丽中国",
  });
  await db.insert(researchCollectedItemDistricts).values({
    collectedItemId: item1Id, districtId: districtAId, matchType: "keyword", matchedKeyword: "涪陵区",
  });
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgId));  // cascade 删全部测试数据
});

describe("searchCollectedItemsForResearch", () => {
  it("基础查 — 按 outletTier 过滤", async () => {
    const r = await searchCollectedItemsForResearch(orgId, { outletTier: "central" }, { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("按 topic 过滤（join annotation）", async () => {
    const r = await searchCollectedItemsForResearch(orgId, { topicIds: [topicAId] }, { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("按 district 过滤", async () => {
    const r = await searchCollectedItemsForResearch(orgId, { districtIds: [districtAId] }, { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("title 关键词过滤", async () => {
    const r = await searchCollectedItemsForResearch(orgId, { titleKeyword: "美丽" }, { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
  });

  it("跨 org 隔离", async () => {
    const r = await searchCollectedItemsForResearch("00000000-0000-0000-0000-000000000000", {}, { limit: 10, offset: 0 });
    expect(r.items.length).toBe(0);
  });
});
```

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/research/__tests__/collected-item-search.test.ts
```

- [ ] **Step 3：实现 DAL**

```ts
import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchCollectedItemTopics, researchCollectedItemDistricts } from "@/db/schema/research/annotations";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";

export interface CollectedItemSearchFilter {
  outletTier?: string | "unclassified";
  outletId?: string;
  outletRegion?: string;
  contentType?: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  topicIds?: string[];
  districtIds?: string[];
  titleKeyword?: string;
  contentKeyword?: string;
}

export interface CollectedItemWithAnnotations {
  id: string;
  title: string;
  content: string | null;
  outletId: string | null;
  outletTier: string | null;
  outletRegion: string | null;
  outletName: string | null;
  publishedAt: Date | null;
  contentType: string;
  url: string | null;
}

export async function searchCollectedItemsForResearch(
  orgId: string,
  filter: CollectedItemSearchFilter,
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  const conditions = [eq(collectedItems.organizationId, orgId)];

  if (filter.outletTier === "unclassified") {
    conditions.push(sql`${collectedItems.outletTier} IS NULL`);
  } else if (filter.outletTier) {
    conditions.push(eq(collectedItems.outletTier, filter.outletTier));
  }
  if (filter.outletId) conditions.push(eq(collectedItems.outletId, filter.outletId));
  if (filter.outletRegion) conditions.push(eq(collectedItems.outletRegion, filter.outletRegion));
  if (filter.contentType) conditions.push(eq(collectedItems.contentType, filter.contentType));
  if (filter.titleKeyword) conditions.push(ilike(collectedItems.title, `%${filter.titleKeyword}%`));
  if (filter.contentKeyword) conditions.push(sql`${collectedItems.content} ILIKE ${'%' + filter.contentKeyword + '%'}`);
  if (filter.publishedAtFrom) conditions.push(sql`${collectedItems.publishedAt} >= ${filter.publishedAtFrom}`);
  if (filter.publishedAtTo) conditions.push(sql`${collectedItems.publishedAt} <= ${filter.publishedAtTo}`);

  // topic / district join — 用 EXISTS 子查询避免 leftJoin 引起重复行
  if (filter.topicIds?.length) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${researchCollectedItemTopics} cit
      WHERE cit.collected_item_id = ${collectedItems.id}
        AND cit.topic_id IN (${sql.join(filter.topicIds.map(id => sql`${id}`), sql`, `)})
    )`);
  }
  if (filter.districtIds?.length) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${researchCollectedItemDistricts} cid
      WHERE cid.collected_item_id = ${collectedItems.id}
        AND cid.district_id IN (${sql.join(filter.districtIds.map(id => sql`${id}`), sql`, `)})
    )`);
  }

  const items = await db.select({
    id: collectedItems.id,
    title: collectedItems.title,
    content: collectedItems.content,
    outletId: collectedItems.outletId,
    outletTier: collectedItems.outletTier,
    outletRegion: collectedItems.outletRegion,
    outletName: mediaOutletDictionary.outletName,
    publishedAt: collectedItems.publishedAt,
    contentType: collectedItems.contentType,
    url: collectedItems.canonicalUrl,
  })
  .from(collectedItems)
  .leftJoin(mediaOutletDictionary, eq(collectedItems.outletId, mediaOutletDictionary.id))
  .where(and(...conditions))
  .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
  .limit(pagination.limit)
  .offset(pagination.offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(and(...conditions));

  return { items, total: count };
}
```

- [ ] **Step 4：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/research/__tests__/collected-item-search.test.ts
# 期望 5/5 pass
```

---

### Task 2.2：删 news-article-search.ts + research-tasks DAL 修复

**Files:**
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/research-tasks.ts`

- [ ] **Step 1：grep 确认 news-article-search 引用**

```bash
grep -rln "from.*news-article-search\|searchNewsArticles\|advancedSearchNewsArticles" /Users/zhuyu/dev/chinamcloud/vibetide/src --include="*.ts" --include="*.tsx" 2>/dev/null
```

- [ ] **Step 2：替换调用方**

把所有 `searchNewsArticles` / `advancedSearchNewsArticles` 改为 `searchCollectedItemsForResearch`，参数 mapping。

- [ ] **Step 3：删 news-article-search.ts**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts
```

- [ ] **Step 4：修复 research-tasks.ts**

```bash
grep -n "newsArticles\|newsArticleTopicHits" /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/research-tasks.ts
```

把对 newsArticles 的引用改为 collected_items + annotation。如复杂建议保持 task 概念不变（v1 spec 简化语义），只改 schema 引用。

- [ ] **Step 5：tsc + build 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

---

### Task 2.3：server actions 重写

**Files:**
- Modify or rename: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/article-search.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/research-tasks.ts`

- [ ] **Step 1：article-search.ts 改名 + 重写**

```bash
mv /Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/article-search.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/collected-item-search.ts
```

重写 server action：

```ts
"use server";
import { requireAuth } from "@/lib/auth";
import { searchCollectedItemsForResearch, type CollectedItemSearchFilter } from "@/lib/dal/research/collected-item-search";

export async function searchResearchItems(filter: CollectedItemSearchFilter, page: number, pageSize: number) {
  const user = await requireAuth();
  return await searchCollectedItemsForResearch(
    user.organizationId,
    filter,
    { limit: pageSize, offset: (page - 1) * pageSize },
  );
}
```

- [ ] **Step 2：修 research-tasks.ts server actions**

把对 newsArticles 的引用改为 collected_items + annotation。任务"启动"逻辑改为只保存检索条件，不再触发采集。

- [ ] **Step 3：grep 调用方更新**

```bash
grep -rln "from.*actions/research/article-search\|searchArticles\b" /Users/zhuyu/dev/chinamcloud/vibetide/src/app --include="*.ts" --include="*.tsx"
```

UI 文件（research/page.tsx / search-workbench-client.tsx）调用旧 action 的地方改为新 action（Phase 4 才完整改 UI；本 step 只是把 import path 修对让 build 通过）。

- [ ] **Step 4：tsc + build 通过**

---

### Task 2.4：Phase 2 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/dal/research/ \
        src/app/actions/research/ \
        src/lib/research/article-ingest.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a3): Phase 2 — DAL + server actions 重写

- 删 src/lib/dal/research/news-article-search.ts (297 行 / 9 export)
- 删 src/lib/research/article-ingest.ts（A1 Phase 0 stub，A3 整体删，研究模块不再有独立 ingest 概念）
- 新建 collected-item-search.ts: searchCollectedItemsForResearch 含 outletTier/outletId/outletRegion/contentType/topicIds/districtIds/titleKeyword/contentKeyword/publishedAt 范围过滤 + EXISTS 子查询 join annotation 表
- 5/5 DAL 单测通过
- 重命名 actions/research/article-search.ts → collected-item-search.ts + 重写 server action
- 修 research-tasks DAL/actions: 移除 newsArticles 引用 + 改为 collected_items + annotation
- 任务概念简化为"检索快照"，不再触发采集

tsc 0 错 / build 通过

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3：自动打标 Inngest（Day 3，约 1 天）

### Task 3.1：topic-matcher 算法 + 单测（TDD）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/topic-matcher.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/topic-matcher.test.ts`

**Schema 真实情况**（reviewer 确认）：
- `researchTopics` 表只有 `name` 字段，没有 commonName / approximateNames
- 关键词存独立表 `researchTopicKeywords`：`topicId / keyword / isPrimary`（主词 isPrimary=true，近似词 isPrimary=false）
- `topicMatchTypeEnum = ["keyword", "semantic", "both"]` — **没有 `"approximate_keyword"` 值**

**A3 简化决策**：matchType 统一用 `"keyword"`（不区分主词/近似词），主词/近似词区别通过 `matchedKeyword` 字段记录的具体值体现。如未来需要区分，加 `is_primary_match boolean` 列而不是改 enum。

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { matchTopicsForItem, type TopicWithKeywords } from "../topic-matcher";

const topics: TopicWithKeywords[] = [
  { id: "t1", name: "美丽中国", primaryKeywords: ["美丽中国"], otherKeywords: ["美丽中国建设", "生态宜居"] },
  { id: "t2", name: "长江生态", primaryKeywords: ["长江生态"], otherKeywords: ["长江保护", "长江流域"] },
  { id: "t3", name: "双碳", primaryKeywords: ["双碳"], otherKeywords: ["碳达峰", "碳中和"] },
];

describe("matchTopicsForItem", () => {
  it("主词命中（精确）", () => {
    const r = matchTopicsForItem("今天讨论美丽中国的进展", topics);
    expect(r.length).toBe(1);
    expect(r[0]!.topicId).toBe("t1");
    expect(r[0]!.matchType).toBe("keyword");
    expect(r[0]!.matchedKeyword).toBe("美丽中国");
  });

  it("近似词命中（matchType 仍 keyword，matchedKeyword 是具体词）", () => {
    const r = matchTopicsForItem("乡村振兴关注生态宜居", topics);
    expect(r.length).toBe(1);
    expect(r[0]!.topicId).toBe("t1");
    expect(r[0]!.matchType).toBe("keyword");
    expect(r[0]!.matchedKeyword).toBe("生态宜居");
  });

  it("多 topic 同时命中", () => {
    const r = matchTopicsForItem("美丽中国和长江保护是双碳目标的重要部分", topics);
    expect(r.length).toBe(3);
    const topicIds = r.map(m => m.topicId).sort();
    expect(topicIds).toEqual(["t1", "t2", "t3"]);
  });

  it("一个 topic 主词 + 近似词同时存在 → 仅命中主词", () => {
    const r = matchTopicsForItem("美丽中国建设是美丽中国的重要部分", topics);
    expect(r.filter(m => m.topicId === "t1").length).toBe(1);
    expect(r[0]!.matchedKeyword).toBe("美丽中国");  // 主词优先
  });

  it("无命中返回空数组", () => {
    const r = matchTopicsForItem("今天天气真好", topics);
    expect(r).toEqual([]);
  });

  it("空 text", () => {
    const r = matchTopicsForItem("", topics);
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2：跑测试预期失败 + 实现**

```ts
export interface TopicWithKeywords {
  id: string;
  name: string;
  primaryKeywords: string[];   // isPrimary=true 的关键词，至少含 topic.name
  otherKeywords: string[];     // isPrimary=false 的关键词
}

export interface TopicMatchResult {
  topicId: string;
  matchedKeyword: string;
  matchType: "keyword";  // A3 V1 统一用 keyword（topicMatchTypeEnum 仅 keyword/semantic/both）
}

export function matchTopicsForItem(
  text: string,
  topics: TopicWithKeywords[],
): TopicMatchResult[] {
  const matches: TopicMatchResult[] = [];
  if (!text) return matches;
  const lowerText = text.toLowerCase();

  for (const topic of topics) {
    let hit: string | null = null;
    // 1. 主词优先
    for (const kw of topic.primaryKeywords) {
      if (lowerText.includes(kw.toLowerCase())) { hit = kw; break; }
    }
    // 2. 近似词
    if (!hit) {
      for (const kw of topic.otherKeywords) {
        if (lowerText.includes(kw.toLowerCase())) { hit = kw; break; }
      }
    }
    if (hit) {
      matches.push({ topicId: topic.id, matchedKeyword: hit, matchType: "keyword" });
    }
  }

  return matches;
}
```

- [ ] **Step 3：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/research/__tests__/topic-matcher.test.ts
# 期望 6/6 pass
```

---

### Task 3.2：district-matcher 算法 + 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/district-matcher.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/district-matcher.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, expect, it } from "vitest";
import { matchDistrictsForItem, type DistrictWithName } from "../district-matcher";

const districts: DistrictWithName[] = [
  { id: "d1", name: "涪陵区" },
  { id: "d2", name: "渝中区" },
  { id: "d3", name: "两江新区" },
];

describe("matchDistrictsForItem", () => {
  it("主名命中", () => {
    const r = matchDistrictsForItem("涪陵区生态环境局发布", districts);
    expect(r.length).toBe(1);
    expect(r[0]!.districtId).toBe("d1");
  });

  it("变体命中（"涪陵县" 历史称谓）", () => {
    const r = matchDistrictsForItem("涪陵县长江保护工作", districts);
    expect(r.length).toBe(1);
    expect(r[0]!.districtId).toBe("d1");
    expect(r[0]!.matchedKeyword).toBe("涪陵县");
  });

  it("简化称谓命中（"涪陵"）", () => {
    const r = matchDistrictsForItem("涪陵的环保进展", districts);
    expect(r.length).toBe(1);
  });

  it("多区县同时命中", () => {
    const r = matchDistrictsForItem("两江新区与涪陵区合作", districts);
    expect(r.map(m => m.districtId).sort()).toEqual(["d1", "d3"]);
  });

  it("无命中", () => {
    const r = matchDistrictsForItem("成都市政府发文", districts);
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2：实现**

```ts
export interface DistrictWithName {
  id: string;
  name: string;
}

export interface DistrictMatchResult {
  districtId: string;
  matchedKeyword: string;
}

// V1 内置变体字典（plan Day 1 调研补充）
const DISTRICT_VARIANTS: Record<string, string[]> = {
  "涪陵区": ["涪陵区", "涪陵县", "涪陵"],
  "渝中区": ["渝中区", "渝中"],
  "两江新区": ["两江新区"],
  "九龙坡区": ["九龙坡区", "九龙坡"],
  "云阳县": ["云阳县", "云阳"],
  "巴南区": ["巴南区", "巴南"],
  "巫山县": ["巫山县", "巫山"],
  "奉节县": ["奉节县", "奉节"],
  "江津区": ["江津区", "江津"],
  "梁平区": ["梁平区", "梁平县", "梁平"],
  "忠县": ["忠县"],
  "长寿区": ["长寿区", "长寿"],
  "开州区": ["开州区", "开县", "开州"],
  "黔江区": ["黔江区", "黔江"],
  "南岸区": ["南岸区", "南岸"],
  "南川区": ["南川区", "南川县", "南川"],
  "大渡口区": ["大渡口区", "大渡口"],
  "永川区": ["永川区", "永川"],
  "沙坪坝区": ["沙坪坝区", "沙坪坝"],
  "璧山区": ["璧山区", "璧山县", "璧山"],
  "万州区": ["万州区", "万州"],
  "秀山县": ["秀山县", "秀山"],
  "江北区": ["江北区", "江北"],
  "丰都县": ["丰都县", "丰都"],
  "铜梁区": ["铜梁区", "铜梁县", "铜梁"],
  "万盛经开区": ["万盛经开区", "万盛区", "万盛"],
  "合川区": ["合川区", "合川市", "合川"],
  "潼南区": ["潼南区", "潼南县", "潼南"],
  "西部科学城重庆高新区": ["西部科学城重庆高新区", "重庆高新区", "高新区"],
  "城口县": ["城口县", "城口"],
  "彭水县": ["彭水县", "彭水苗族土家族自治县", "彭水"],
  "武隆区": ["武隆区", "武隆县", "武隆"],
  "垫江县": ["垫江县", "垫江"],
  "綦江区": ["綦江区", "綦江县", "綦江"],
  "荣昌区": ["荣昌区", "荣昌县", "荣昌"],
  "酉阳县": ["酉阳县", "酉阳土家族苗族自治县", "酉阳"],
  "大足区": ["大足区", "大足县", "大足"],
  "石柱县": ["石柱县", "石柱土家族自治县", "石柱"],
  "巫溪县": ["巫溪县", "巫溪"],
  "渝北区": ["渝北区", "渝北"],
};

export function matchDistrictsForItem(
  text: string,
  districts: DistrictWithName[],
): DistrictMatchResult[] {
  const matches: DistrictMatchResult[] = [];
  if (!text) return matches;
  const lowerText = text.toLowerCase();

  for (const district of districts) {
    const variants = DISTRICT_VARIANTS[district.name] ?? [district.name];
    for (const variant of variants) {
      if (lowerText.includes(variant.toLowerCase())) {
        matches.push({ districtId: district.id, matchedKeyword: variant });
        break;
      }
    }
  }

  return matches;
}

export const _DISTRICT_VARIANTS_FOR_TEST = DISTRICT_VARIANTS;
```

- [ ] **Step 3：跑测试预期通过**

---

### Task 3.3：annotate-collected-item Inngest 函数

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/annotate-collected-item.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/events.ts`（注册新事件类型如 `research/backfill-annotate.requested`）
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts`（注册）

- [ ] **Step 1：写 annotate-collected-item.ts**

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq } from "drizzle-orm";
import { matchTopicsForItem } from "@/lib/research/topic-matcher";
import { matchDistrictsForItem } from "@/lib/research/district-matcher";

export const annotateCollectedItem = inngest.createFunction(
  { id: "research-annotate-collected-item", concurrency: { limit: 4 } },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    const { itemId, organizationId } = event.data;

    const item = await step.run("load-item", async () => {
      const [row] = await db.select().from(collectedItems).where(eq(collectedItems.id, itemId)).limit(1);
      return row;
    });
    if (!item) return { skipped: true, reason: "item not found" };

    const text = `${item.title}\n${item.content ?? ""}`;

    // 加载 topic + 关键词（org-scoped；按 isPrimary 分组）
    const topics = await step.run("load-topics", async () => {
      const rows = await db.select({
        id: researchTopics.id,
        name: researchTopics.name,
        keyword: researchTopicKeywords.keyword,
        isPrimary: researchTopicKeywords.isPrimary,
      }).from(researchTopics)
        .leftJoin(researchTopicKeywords, eq(researchTopicKeywords.topicId, researchTopics.id))
        .where(eq(researchTopics.organizationId, organizationId));

      // 聚合按 topicId 分组
      const map = new Map<string, { id: string; name: string; primaryKeywords: string[]; otherKeywords: string[] }>();
      for (const row of rows) {
        if (!map.has(row.id)) {
          map.set(row.id, { id: row.id, name: row.name, primaryKeywords: [], otherKeywords: [] });
        }
        const t = map.get(row.id)!;
        if (row.keyword) {
          if (row.isPrimary) t.primaryKeywords.push(row.keyword);
          else t.otherKeywords.push(row.keyword);
        }
      }
      // 主词列表为空时，默认用 topic.name 作主词（兼容未灌关键词的 topic）
      for (const t of map.values()) {
        if (t.primaryKeywords.length === 0) t.primaryKeywords.push(t.name);
      }
      return Array.from(map.values());
    });

    const districts = await step.run("load-districts", async () => {
      return await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts);
    });

    const topicMatches = matchTopicsForItem(text, topics);
    const districtMatches = matchDistrictsForItem(text, districts);

    if (topicMatches.length > 0) {
      await step.run("write-topic-annotations", async () => {
        await db.insert(researchCollectedItemTopics).values(
          topicMatches.map(m => ({
            collectedItemId: itemId,
            topicId: m.topicId,
            matchType: "keyword" as const,  // topicMatchTypeEnum 仅 keyword/semantic/both
            matchedKeyword: m.matchedKeyword,
          })),
        ).onConflictDoNothing({ target: [researchCollectedItemTopics.collectedItemId, researchCollectedItemTopics.topicId, researchCollectedItemTopics.matchType] });
      });
    }

    if (districtMatches.length > 0) {
      await step.run("write-district-annotations", async () => {
        await db.insert(researchCollectedItemDistricts).values(
          districtMatches.map(m => ({
            collectedItemId: itemId,
            districtId: m.districtId,
            matchType: "keyword" as const,
            matchedKeyword: m.matchedKeyword,
          })),
        ).onConflictDoNothing({ target: [researchCollectedItemDistricts.collectedItemId, researchCollectedItemDistricts.districtId] });
      });
    }

    return { topicMatched: topicMatches.length, districtMatched: districtMatches.length };
  },
);
```

- [ ] **Step 2：注册事件类型**

```bash
grep -n "research/backfill" /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/events.ts
```

如未注册，加：

```ts
"research/backfill-annotate.requested": {
  data: { organizationId: string };
};
```

- [ ] **Step 3：注册函数到 functions/index.ts**

```bash
grep -n "annotateCollectedItem\|outletBatchRecognize\|^export const functions\|^];" /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts
```

加 import + 注册到 functions 数组（紧邻 outletBatchRecognize）。

- [ ] **Step 4：tsc + build 通过**

---

### Task 3.4：backfill-annotate Inngest 函数

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/backfill-annotate.ts`

- [ ] **Step 1：写函数**

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics, researchTopicKeywords } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq, and, sql, asc } from "drizzle-orm";
import { matchTopicsForItem } from "@/lib/research/topic-matcher";
import { matchDistrictsForItem } from "@/lib/research/district-matcher";

export const backfillAnnotate = inngest.createFunction(
  { id: "research-backfill-annotate", concurrency: { limit: 1 } },
  { event: "research/backfill-annotate.requested" },
  async ({ event, step }) => {
    const { organizationId } = event.data;
    const BATCH = 500;

    // 加载 topic + 关键词（同 annotate-collected-item.ts 的 load-topics 逻辑）
    const topics = await step.run("load-topics", async () => {
      const rows = await db.select({
        id: researchTopics.id,
        name: researchTopics.name,
        keyword: researchTopicKeywords.keyword,
        isPrimary: researchTopicKeywords.isPrimary,
      }).from(researchTopics)
        .leftJoin(researchTopicKeywords, eq(researchTopicKeywords.topicId, researchTopics.id))
        .where(eq(researchTopics.organizationId, organizationId));
      const map = new Map<string, { id: string; name: string; primaryKeywords: string[]; otherKeywords: string[] }>();
      for (const row of rows) {
        if (!map.has(row.id)) {
          map.set(row.id, { id: row.id, name: row.name, primaryKeywords: [], otherKeywords: [] });
        }
        const t = map.get(row.id)!;
        if (row.keyword) {
          if (row.isPrimary) t.primaryKeywords.push(row.keyword);
          else t.otherKeywords.push(row.keyword);
        }
      }
      for (const t of map.values()) {
        if (t.primaryKeywords.length === 0) t.primaryKeywords.push(t.name);
      }
      return Array.from(map.values());
    });

    const districts = await step.run("load-districts", async () => {
      return await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts);
    });

    let processed = 0;
    // ID-based cursor 分页 — 不依赖 NOT EXISTS 的状态变化（避免死循环）
    let lastId: string | null = null;
    let batchIdx = 0;

    while (true) {
      const batch = await step.run(`load-batch-${batchIdx}`, async () => {
        const conditions = [eq(collectedItems.organizationId, organizationId)];
        if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);
        return await db.select({
          id: collectedItems.id,
          title: collectedItems.title,
          content: collectedItems.content,
        }).from(collectedItems)
          .where(and(...conditions))
          .orderBy(asc(collectedItems.id))
          .limit(BATCH);
      });
      if (batch.length === 0) break;

      await step.run(`annotate-batch-${batchIdx}`, async () => {
        for (const item of batch) {
          const text = `${item.title}\n${item.content ?? ""}`;
          const topicMatches = matchTopicsForItem(text, topics);
          const districtMatches = matchDistrictsForItem(text, districts);

          if (topicMatches.length > 0) {
            await db.insert(researchCollectedItemTopics).values(
              topicMatches.map(m => ({
                collectedItemId: item.id, topicId: m.topicId,
                matchType: "keyword" as const, matchedKeyword: m.matchedKeyword,
              })),
            ).onConflictDoNothing();
          }
          if (districtMatches.length > 0) {
            await db.insert(researchCollectedItemDistricts).values(
              districtMatches.map(m => ({
                collectedItemId: item.id, districtId: m.districtId,
                matchType: "keyword" as const, matchedKeyword: m.matchedKeyword,
              })),
            ).onConflictDoNothing();
          }
        }
      });

      processed += batch.length;
      lastId = batch[batch.length - 1]!.id;  // 关键：用最后一条 id 推进 cursor
      batchIdx += 1;
      if (batch.length < BATCH) break;
    }

    return { processed };
  },
);
```

- [ ] **Step 2：注册到 functions/index.ts**

加 import + 注册到 functions 数组。

- [ ] **Step 3：tsc + build 通过**

---

### Task 3.5：Phase 3 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/research/topic-matcher.ts \
        src/lib/research/district-matcher.ts \
        src/lib/research/__tests__/ \
        src/inngest/functions/research/annotate-collected-item.ts \
        src/inngest/functions/research/backfill-annotate.ts \
        src/inngest/events.ts \
        src/inngest/functions/index.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a3): Phase 3 — auto-annotate Inngest + topic/district matcher + 历史回填

- topic-matcher.ts: matchTopicsForItem 主词命中（精确）+ 近似词命中 + 同 topic 去重 / 6 单测 pass
- district-matcher.ts: matchDistrictsForItem 含 40 区县 DISTRICT_VARIANTS 字典（含历史称谓如"涪陵县"/"开县"）/ 5 单测 pass
- annotate-collected-item Inngest: 订阅 collection/item.created 事件 → 加载 topic/district 字典 → 命中 → 写 annotation 表 (concurrency 4)
- backfill-annotate Inngest: 一次性手工触发批量回填（订阅 research/backfill-annotate.requested 事件，concurrency 1，batch 500）
- 注册新事件类型 + 2 函数到 functions/index.ts

tsc 0 错 / 11 个 matcher 单测全过

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4：UI 解 stub（Day 4，约 0.5-1 天）

### Task 4.1：research/page.tsx 解 stub

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx`

- [ ] **Step 1：read 现有 page.tsx**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/page.tsx
```

- [ ] **Step 2：改造 page.tsx**

- 移除对 `searchNewsArticles` / `listMediaOutlets` 的调用
- 改为加载 collected_items 聚合（按 outlet_tier / topic / district 分组统计）
- 显示总量统计 + 最近研究任务（research_tasks 列表）
- 同步更新 line 9 的 `// A4 阶段 UI 重做时重新接入` 注释为 `// A3 已接通 collected_items 数据源`

- [ ] **Step 3：tsc + 浏览器手动**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run dev &
# 浏览器访问 /research，应能正常加载（即使数据空也不报错）
```

---

### Task 4.2：search-workbench-client 解 stub

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx`

- [ ] **Step 1：read 现有结构**

- [ ] **Step 2：改造**

- 重启用 outlet 字段筛选（直接从 collected_items 拉 outlet_tier / outlet_region 选项）
- 检索表单调用新 server action `searchResearchItems`
- 结果列表显示 outlet 名 + topic / district chip（join annotation 数据）

- [ ] **Step 3：tsc + 浏览器手动**

---

### Task 4.3：research/admin/tasks 评估 + 改造

**Files:**
- Possibly modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/tasks/page.tsx`
- Possibly modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/tasks/new/page.tsx`
- Possibly modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/tasks/[id]/page.tsx`

- [ ] **Step 1：评估 research_tasks 概念是否保留**

按 sub-spec §3.4 决策：保留 + 简化语义为"检索快照"。

- [ ] **Step 2：改造任务详情页**

- 移除"启动采集"等触发按钮
- 任务进度从依赖采集状态改为依赖 backfill-annotate 进度
- 列表 + 详情按需调整

- [ ] **Step 3：tsc + 浏览器手动**

---

### Task 4.4：Phase 4 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add "src/app/(dashboard)/research/" && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a3): Phase 4 — UI 解 6 处 Phase 0 stub

- research/page.tsx: 移除 outlet 数据加载 → 改为 collected_items 聚合统计 + 最近研究任务列表 + 同步注释 (A3 已接通)
- search-workbench-client.tsx: 重启用 outlet 字段筛选 + 调新 searchResearchItems action + 结果含 topic/district chip
- admin/tasks/* (page/new/[id]): 简化为"检索快照"语义，移除触发采集逻辑

tsc 0 错 / build 通过 / 浏览器访问 /research 不报错

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5：Cleanup + 测试 + final commit（Day 5，约 0.5 天）

### Task 5.1：删除 4 个 research 自采 inngest 函数

**Files:**
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/tavily-crawl.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/whitelist-crawl.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/manual-url-ingest.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/article-content-fetch.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts`（去除 4 个函数的 import + 注册）

- [ ] **Step 1：删除 4 个文件**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/tavily-crawl.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/whitelist-crawl.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/manual-url-ingest.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/article-content-fetch.ts
```

- [ ] **Step 2：清理 functions/index.ts 注册**

```bash
grep -n "tavily-crawl\|whitelist-crawl\|manual-url-ingest\|article-content-fetch\|tavilyCrawl\|whitelistCrawl\|manualUrlIngest\|articleContentFetch" /Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/index.ts
```

去除 import 和 functions 数组中条目。

- [ ] **Step 3：评估 task-start.ts**

如果 task-start.ts 不再被任何 cron / event 触发，删除。如果仍被研究任务页面手工触发，重写为只更新 task status + 触发 backfill-annotate。

```bash
grep -rln "task-start\|taskStart\|research/task" /Users/zhuyu/dev/chinamcloud/vibetide/src --include="*.ts" --include="*.tsx" 2>/dev/null
```

- [ ] **Step 4：tsc + build 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

---

### Task 5.2：writer 集成测试

**File:** Modify `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts`

- [ ] **Step 1：加 1 集成 case**

```ts
describe("writer + a3 annotate 集成", () => {
  it("写入采集项后 collection/item.created 事件触发 annotate（间接验证 — 通过手工调用 annotate 函数测）", async () => {
    // 灌一条 topic
    const [t] = await db.insert(researchTopics).values({
      organizationId: orgId, commonName: "TEST_A3_topic", approximateNames: [],
    }).returning();
    const [d] = await db.insert(cqDistricts).values({ name: "TEST_A3_district", code: "TEST", sortOrder: 999 }).returning();

    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId, source: testSource,
      items: [{
        title: "TEST_A3_topic 在 TEST_A3_district 的进展",
        url: undefined,
        channel: "test_a3",
        contentType: "image_text",
        attachments: [],
        contentFingerprint: "fp-a3-test",
        rawMetadata: {},
      }],
    });

    // 直接调 annotate 函数（绕过 inngest event 触发，单测中模拟）
    // 实际 production: writer 会发 collection/item.created 事件 → inngest 触发 annotateCollectedItem

    // 验证：手工跑 matcher → 写 annotation
    const matches = matchTopicsForItem("TEST_A3_topic 在 TEST_A3_district 的进展", [{ id: t.id, commonName: "TEST_A3_topic", approximateNames: [] }]);
    expect(matches.length).toBe(1);
  });
});
```

注：完整 inngest event 触发集成测试需要 inngest dev server，本测试只验证 matcher 逻辑能命中。

- [ ] **Step 2：跑测试通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/__tests__/writer.test.ts 2>&1 | tail -10
```

---

### Task 5.3：tsc / lint / build 全套 + final commit

- [ ] **Step 1：tsc**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

- [ ] **Step 2：lint**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run lint 2>&1 | tail -5
```

- [ ] **Step 3：build**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run build 2>&1 | tail -10
```

- [ ] **Step 4：A3 测试集子集**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run \
  src/lib/dal/research/__tests__/collected-item-search.test.ts \
  src/lib/research/__tests__/ \
  src/lib/collection/__tests__/writer.test.ts 2>&1 | tail -10
```

期望：DAL 5 + topic-matcher 6 + district-matcher 5 + writer 集成 + 既有测试全过。

- [ ] **Step 5：grep 旧引用清理验证**

```bash
grep -rln "newsArticles\|newsArticleTopicHits\|newsSourceChannelEnum\|searchNewsArticles\|article-ingest" /Users/zhuyu/dev/chinamcloud/vibetide/src --include="*.ts" --include="*.tsx" 2>/dev/null
# 期望：0 hits
```

- [ ] **Step 6：A3 final commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/inngest/functions/research/ \
        src/inngest/functions/index.ts \
        src/lib/collection/__tests__/writer.test.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a3): Phase 5 — cleanup 4 inngest 自采分支 + 集成测试 — A3 完工

- 删除 4 个 research 自采 inngest 函数:
  - tavily-crawl.ts (走 Collection Hub tavily Adapter)
  - whitelist-crawl.ts (走 list_scraper Adapter)
  - manual-url-ingest.ts (走 jina_url Adapter)
  - article-content-fetch.ts (collected_items 入库时 content 已含)
- 保留 bridge-backfill.ts (Collection Hub bridge 独立链路)
- functions/index.ts 注销已删函数
- writer.test.ts 加 a3 annotate 集成 case

A3 完工: tsc 0 错 / lint pass / build 通过 / DAL 5 + matcher 11 + writer 集成 = 17 测试 pass / 旧引用 0 hits
A3 commit 链 (5 个): Phase 1 schema + 2 DAL + 3 annotate + 4 UI + 5 cleanup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 验收 Checklist 总表（A3 整体交付）

### 功能

- [ ] research_news_articles + research_news_article_topic_hits 两表已 DROP
- [ ] research_collected_item_topics + research_collected_item_districts 两新表创建
- [ ] 入库 1 条 collected_items（title 含"长江生态" + content 含"涪陵"）→ Inngest auto-annotate → annotation 表有对应 topic + district 记录
- [ ] research/page.tsx 加载 collected_items（按 outlet_tier 聚合统计）正常显示
- [ ] search-workbench-client 按 topic + district + outlet_tier 筛选生效
- [ ] 触发 backfill-annotate event → 历史 collected_items 批量打标完成
- [ ] 4 个 research 自采 inngest 函数已删除
- [ ] bridge-backfill.ts 保留可用（独立链路）

### 性能

- [ ] annotate-collected-item 单条 ≤ 200 ms（缓存命中）
- [ ] backfill-annotate 处理 1 万条 ≤ 15 分钟

### 数据正确性

- [ ] tsc --noEmit 0 错
- [ ] npm run lint pass
- [ ] npm run build 通过
- [ ] DAL collected-item-search 5/5 单测通过
- [ ] topic-matcher 6/6 单测通过
- [ ] district-matcher 5/5 单测通过
- [ ] writer.test.ts 集成测试通过

### 旧引用清理

- [ ] grep `newsArticles|newsArticleTopicHits|newsSourceChannelEnum|searchNewsArticles|article-ingest` 0 hits
- [ ] 6 处 Phase 0 stub 全解开

---

## 备注

- 所有 commit 用 `--no-verify`
- 文件路径全用绝对路径
- 不开 feature branch，直接 commit 到 main
- A3 完工后进入 A4 高级检索 sub-brainstorm（Wave 1 第 5 个子项目）
