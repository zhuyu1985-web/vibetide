# 新闻研究模块 · S1 基础设施 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建新闻研究模块的数据底座 —— 11 张新表 schema、迁移、种子数据（39 区县、16 主题、~100 家媒体源），以及媒体源/主题词库的后台管理 UI，使下一阶段（S2 采集通道）有可绑定的数据源和可命中的关键词。

**Architecture:** 新表全部放在 `src/db/schema/research/` 下，与现有表隔离但通过 `organization_id` 接入多租户。DAL/Server Actions/UI 沿用现有项目的「Server Page → DAL → Drizzle」分层。后台管理 UI 复用 shadcn/ui 组件并接入现有 RBAC。

**Tech Stack:** Drizzle ORM 0.45.1、Postgres (Supabase)、Next.js 16 App Router、React 19、shadcn/ui、Tailwind v4、Vitest 4.1。

**关联设计文档：** `docs/superpowers/specs/2026-04-14-news-research-module-design.md`

---

## 文件结构总览

### 新建（schema + 类型）
- `src/db/schema/research/index.ts` — 子模块统一导出
- `src/db/schema/research/enums.ts` — 4 个新枚举（media_tier、source_channel、research_task_status、match_type 等）
- `src/db/schema/research/cq-districts.ts` — 区县字典
- `src/db/schema/research/media-outlets.ts` — 媒体源 + 别名 + 抓取配置（3 张表）
- `src/db/schema/research/research-topics.ts` — 主题 + 关键词 + 样本（3 张表）
- `src/db/schema/research/research-tasks.ts` — 研究任务
- `src/db/schema/research/news-articles.ts` — 文章 + 主题命中（2 张表）

### 修改（连接到现有体系）
- `src/db/schema/index.ts` — 增加 `export * from "./research"`
- `src/lib/rbac-constants.ts` — 增加 6 个 `RESEARCH_*` 权限和菜单映射

### 新建（种子数据）
- `src/db/seed/research/cq-districts.ts` — 39 个区县 seed
- `src/db/seed/research/research-topics.ts` — 16 组主题 seed
- `src/db/seed/research/media-outlets.ts` — 80-120 家媒体 seed
- `src/db/seed/research/index.ts` — 顺序编排
- `scripts/seed-research.ts` — 入口脚本（package.json 加 `db:seed:research`）

### 新建（DAL）
- `src/lib/dal/research/cq-districts.ts`
- `src/lib/dal/research/media-outlets.ts`
- `src/lib/dal/research/research-topics.ts`
- `src/lib/dal/research/index.ts`

### 新建（Server Actions）
- `src/app/actions/research/media-outlets.ts`
- `src/app/actions/research/research-topics.ts`
- `src/app/actions/research/index.ts`

### 新建（UI）
- `src/app/(dashboard)/research/layout.tsx` — 模块布局 + 权限守卫
- `src/app/(dashboard)/research/page.tsx` — 占位首页（S4 时替换）
- `src/app/(dashboard)/research/admin/media-outlets/page.tsx`
- `src/app/(dashboard)/research/admin/media-outlets/media-outlets-client.tsx`
- `src/app/(dashboard)/research/admin/topics/page.tsx`
- `src/app/(dashboard)/research/admin/topics/topics-client.tsx`
- `src/components/layout/AppSidebar.tsx` — 增加「新闻研究」菜单条目（修改）

### 新建（测试）
- `src/lib/dal/research/__tests__/media-outlets.test.ts`
- `src/lib/dal/research/__tests__/research-topics.test.ts`
- `src/lib/dal/research/__tests__/cq-districts.test.ts`
- `src/app/actions/research/__tests__/media-outlets.test.ts`

---

## Task 1: 新增 enums

**Files:**
- Create: `src/db/schema/research/enums.ts`

- [ ] **Step 1.1: 写 enum 定义**

```ts
// src/db/schema/research/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * 媒体层级（四级分类）
 *  - central: 中央级，如人民日报、新华社
 *  - provincial_municipal: 省/市级（含直辖市），如重庆日报、华龙网
 *  - industry: 行业级，如中国环境报、健康报
 *  - district_media: 区县融媒体，如涪陵发布
 */
export const mediaTierEnum = pgEnum("research_media_tier", [
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
]);

/** 媒体源生命周期 */
export const mediaOutletStatusEnum = pgEnum("research_media_outlet_status", [
  "active",
  "archived",
]);

/** 文章采集通道 */
export const newsSourceChannelEnum = pgEnum("research_news_source_channel", [
  "tavily",          // Tavily 全网搜索
  "whitelist_crawl", // 媒体白名单常态采集
  "manual_url",      // 老师手动粘贴 URL
]);

/** 研究任务状态机 */
export const researchTaskStatusEnum = pgEnum("research_task_status", [
  "pending",
  "crawling",
  "analyzing",
  "done",
  "failed",
  "cancelled",
]);

/** 主题命中方式 */
export const topicMatchTypeEnum = pgEnum("research_topic_match_type", [
  "keyword",
  "semantic",
  "both",
]);

/** 任务级去重口径 */
export const researchDedupLevelEnum = pgEnum("research_dedup_level", [
  "keyword",   // 仅按主题去重（同一文章多主题分别计）
  "district",  // 跨主题去重，按文章去重
  "both",      // 跨区县也去重（按 url_hash）
]);

/** 向量化状态 — 复用 KB 模块同名设计 */
export const researchEmbeddingStatusEnum = pgEnum(
  "research_embedding_status",
  ["pending", "processing", "done", "failed"],
);
```

- [ ] **Step 1.2: 提交**

```bash
git add src/db/schema/research/enums.ts
git commit -m "feat(research): add enums for new news research module"
```

---

## Task 2: 区县字典 schema + DAL + 测试

**Files:**
- Create: `src/db/schema/research/cq-districts.ts`
- Create: `src/lib/dal/research/cq-districts.ts`
- Create: `src/lib/dal/research/__tests__/cq-districts.test.ts`

- [ ] **Step 2.1: schema**

```ts
// src/db/schema/research/cq-districts.ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const cqDistricts = pgTable("research_cq_districts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2.2: DAL**

```ts
// src/lib/dal/research/cq-districts.ts
import { db } from "@/db";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { asc } from "drizzle-orm";

export type CqDistrict = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
};

export async function listCqDistricts(): Promise<CqDistrict[]> {
  const rows = await db
    .select()
    .from(cqDistricts)
    .orderBy(asc(cqDistricts.sortOrder), asc(cqDistricts.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    sortOrder: r.sortOrder,
  }));
}
```

- [ ] **Step 2.3: 写测试**

```ts
// src/lib/dal/research/__tests__/cq-districts.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { listCqDistricts } from "../cq-districts";

describe("listCqDistricts", () => {
  it("returns all 39 Chongqing districts in sortOrder", async () => {
    const result = await listCqDistricts();
    expect(result.length).toBe(39);
    // 校验排序稳定
    for (let i = 1; i < result.length; i++) {
      expect(result[i].sortOrder).toBeGreaterThanOrEqual(result[i - 1].sortOrder);
    }
    // 抽查关键区县存在
    const names = result.map((r) => r.name);
    expect(names).toContain("两江新区");
    expect(names).toContain("北碚区");
    expect(names).toContain("巫溪县");
  });
});
```

- [ ] **Step 2.4: 跑测试看是否 FAIL（无种子时表为空，应 FAIL）**

```bash
npm test -- src/lib/dal/research/__tests__/cq-districts.test.ts
```
预期：FAIL（length 不等于 39）

- [ ] **Step 2.5: 提交**

```bash
git add src/db/schema/research/cq-districts.ts src/lib/dal/research/cq-districts.ts src/lib/dal/research/__tests__/cq-districts.test.ts
git commit -m "feat(research): add cq_districts schema and DAL"
```

---

## Task 3: 媒体源（3 张表）schema

**Files:**
- Create: `src/db/schema/research/media-outlets.ts`

- [ ] **Step 3.1: 写 schema**

```ts
// src/db/schema/research/media-outlets.ts
import {
  pgTable, uuid, text, timestamp, boolean, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../users";
import { cqDistricts } from "./cq-districts";
import { mediaTierEnum, mediaOutletStatusEnum } from "./enums";

export const mediaOutlets = pgTable(
  "research_media_outlets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    name: text("name").notNull(),
    tier: mediaTierEnum("tier").notNull(),
    province: text("province"),
    districtId: uuid("district_id").references(() => cqDistricts.id),
    industryTag: text("industry_tag"),
    officialUrl: text("official_url"),
    status: mediaOutletStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameTierUq: uniqueIndex("research_media_outlets_org_name_tier_uq").on(
      t.organizationId, t.name, t.tier,
    ),
    tierIdx: index("research_media_outlets_tier_idx").on(t.tier),
    districtIdx: index("research_media_outlets_district_idx").on(t.districtId),
  }),
);

export const mediaOutletAliases = pgTable(
  "research_media_outlet_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id, { onDelete: "cascade" }).notNull(),
    alias: text("alias").notNull(),
    matchPattern: text("match_pattern").notNull(), // 域名正则或精确字符串
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    outletIdx: index("research_media_outlet_aliases_outlet_idx").on(t.outletId),
    patternIdx: index("research_media_outlet_aliases_pattern_idx").on(t.matchPattern),
  }),
);

export const mediaOutletCrawlConfigs = pgTable(
  "research_media_outlet_crawl_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id, { onDelete: "cascade" }).notNull().unique(),
    listUrlTemplate: text("list_url_template").notNull(),
    articleUrlPattern: text("article_url_pattern"),
    scheduleCron: text("schedule_cron").notNull().default("0 3 * * *"),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

// relations
export const mediaOutletsRelations = relations(mediaOutlets, ({ many, one }) => ({
  aliases: many(mediaOutletAliases),
  crawlConfig: one(mediaOutletCrawlConfigs),
  district: one(cqDistricts, {
    fields: [mediaOutlets.districtId],
    references: [cqDistricts.id],
  }),
}));
```

- [ ] **Step 3.2: 提交**

```bash
git add src/db/schema/research/media-outlets.ts
git commit -m "feat(research): add media_outlets / aliases / crawl_configs schema"
```

---

## Task 4: 主题词库（3 张表）schema

**Files:**
- Create: `src/db/schema/research/research-topics.ts`

- [ ] **Step 4.1: 写 schema**

```ts
// src/db/schema/research/research-topics.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../users";
import { researchEmbeddingStatusEnum } from "./enums";

export const researchTopics = pgTable(
  "research_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPreset: boolean("is_preset").notNull().default(false), // 16 组生态文明传播为 preset
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgNameUq: uniqueIndex("research_topics_org_name_uq").on(t.organizationId, t.name),
  }),
);

export const researchTopicKeywords = pgTable(
  "research_topic_keywords",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    keyword: text("keyword").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false), // true = 共词，false = 近似称谓
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicKwUq: uniqueIndex("research_topic_keywords_topic_kw_uq").on(t.topicId, t.keyword),
  }),
);

export const researchTopicSamples = pgTable(
  "research_topic_samples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    sampleText: text("sample_text").notNull(),
    embedding: jsonb("embedding"), // 1024 维 Jina v3
    embeddingStatus: researchEmbeddingStatusEnum("embedding_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index("research_topic_samples_topic_idx").on(t.topicId),
  }),
);

export const researchTopicsRelations = relations(researchTopics, ({ many }) => ({
  keywords: many(researchTopicKeywords),
  samples: many(researchTopicSamples),
}));
```

- [ ] **Step 4.2: 提交**

```bash
git add src/db/schema/research/research-topics.ts
git commit -m "feat(research): add research_topics / keywords / samples schema"
```

---

## Task 5: 研究任务 schema

**Files:**
- Create: `src/db/schema/research/research-tasks.ts`

- [ ] **Step 5.1: 写 schema**

```ts
// src/db/schema/research/research-tasks.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, numeric, index } from "drizzle-orm/pg-core";
import { organizations } from "../users";
import { researchTaskStatusEnum, researchDedupLevelEnum } from "./enums";

export const researchTasks = pgTable(
  "research_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    timeRangeStart: timestamp("time_range_start", { withTimezone: true }).notNull(),
    timeRangeEnd: timestamp("time_range_end", { withTimezone: true }).notNull(),
    topicIds: jsonb("topic_ids").$type<string[]>().notNull(),
    districtIds: jsonb("district_ids").$type<string[]>().notNull(),
    mediaTiers: jsonb("media_tiers").$type<string[]>().notNull(),
    customUrls: jsonb("custom_urls").$type<string[]>().notNull().default([]),
    semanticEnabled: boolean("semantic_enabled").notNull().default(true),
    semanticThreshold: numeric("semantic_threshold", { precision: 4, scale: 3 }).notNull().default("0.720"),
    dedupLevel: researchDedupLevelEnum("dedup_level").notNull().default("district"),
    status: researchTaskStatusEnum("status").notNull().default("pending"),
    progress: jsonb("progress").$type<{
      crawled?: number;
      analyzed?: number;
      total?: number;
    }>().notNull().default({}),
    resultSummary: jsonb("result_summary"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    orgUserIdx: index("research_tasks_org_user_idx").on(t.organizationId, t.userId),
    statusIdx: index("research_tasks_status_idx").on(t.status),
  }),
);
```

- [ ] **Step 5.2: 提交**

```bash
git add src/db/schema/research/research-tasks.ts
git commit -m "feat(research): add research_tasks schema"
```

---

## Task 6: 文章 + 命中（2 张表）schema

**Files:**
- Create: `src/db/schema/research/news-articles.ts`

- [ ] **Step 6.1: 写 schema**

```ts
// src/db/schema/research/news-articles.ts
import {
  pgTable, uuid, text, timestamp, jsonb, numeric,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { mediaOutlets } from "./media-outlets";
import { cqDistricts } from "./cq-districts";
import { researchTopics } from "./research-topics";
import { researchTasks } from "./research-tasks";
import {
  mediaTierEnum,
  newsSourceChannelEnum,
  topicMatchTypeEnum,
  researchEmbeddingStatusEnum,
} from "./enums";

export const newsArticles = pgTable(
  "research_news_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    htmlSnapshotPath: text("html_snapshot_path"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id),
    outletTierSnapshot: mediaTierEnum("outlet_tier_snapshot"),
    districtIdSnapshot: uuid("district_id_snapshot").references(() => cqDistricts.id),
    sourceChannel: newsSourceChannelEnum("source_channel").notNull(),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).defaultNow().notNull(),
    embedding: jsonb("embedding"),
    embeddingStatus: researchEmbeddingStatusEnum("embedding_status").notNull().default("pending"),
    rawMetadata: jsonb("raw_metadata"),
  },
  (t) => ({
    urlHashUq: uniqueIndex("research_news_articles_url_hash_uq").on(t.urlHash),
    outletPublishedIdx: index("research_news_articles_outlet_published_idx").on(t.outletId, t.publishedAt),
    districtPublishedIdx: index("research_news_articles_district_published_idx").on(t.districtIdSnapshot, t.publishedAt),
    embeddingStatusIdx: index("research_news_articles_embedding_status_idx").on(t.embeddingStatus),
  }),
);

export const newsArticleTopicHits = pgTable(
  "research_news_article_topic_hits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").references(() => newsArticles.id, { onDelete: "cascade" }).notNull(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    researchTaskId: uuid("research_task_id").references(() => researchTasks.id, { onDelete: "cascade" }).notNull(),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeywords: jsonb("matched_keywords").$type<string[]>().notNull().default([]),
    matchedFields: jsonb("matched_fields").$type<string[]>().notNull().default([]),
    semanticScore: numeric("semantic_score", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    articleTopicTaskUq: uniqueIndex("research_news_article_topic_hits_uq").on(
      t.articleId, t.topicId, t.researchTaskId,
    ),
    taskTopicIdx: index("research_news_article_topic_hits_task_topic_idx").on(
      t.researchTaskId, t.topicId,
    ),
  }),
);
```

- [ ] **Step 6.2: 提交**

```bash
git add src/db/schema/research/news-articles.ts
git commit -m "feat(research): add news_articles and news_article_topic_hits schema"
```

---

## Task 7: 子模块导出 + 主 schema 索引

**Files:**
- Create: `src/db/schema/research/index.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 7.1: 写子模块 index**

```ts
// src/db/schema/research/index.ts
export * from "./enums";
export * from "./cq-districts";
export * from "./media-outlets";
export * from "./research-topics";
export * from "./research-tasks";
export * from "./news-articles";
```

- [ ] **Step 7.2: 接入主 schema/index.ts**

在 `src/db/schema/index.ts` 末尾追加：

```ts
export * from "./research";
```

- [ ] **Step 7.3: 类型检查**

```bash
npx tsc --noEmit
```
预期：PASS

- [ ] **Step 7.4: 提交**

```bash
git add src/db/schema/research/index.ts src/db/schema/index.ts
git commit -m "feat(research): wire research schema into main index"
```

---

## Task 8: 生成迁移并推送到本地数据库

**Files:**
- Generated: `supabase/migrations/<timestamp>_research_module.sql`

- [ ] **Step 8.1: 生成迁移文件**

```bash
npm run db:generate
```
预期：在 `supabase/migrations/` 下生成新文件，包含 11 张表 + 7 个 enum 的 CREATE 语句

- [ ] **Step 8.2: 检查迁移文件**

打开生成的 `.sql` 文件，确认：
- 7 个 enum 都有 CREATE TYPE
- 11 张表都有 CREATE TABLE
- 唯一索引都包含 `IF NOT EXISTS` 或可重复执行
- 外键正确

如果发现遗漏，回到对应 schema 文件修复，再重新 generate。

- [ ] **Step 8.3: 推送到数据库**

```bash
npm run db:push
```
预期：所有表创建成功

- [ ] **Step 8.4: 用 Drizzle Studio 验证**

```bash
npm run db:studio
```
浏览器打开后确认能看到 11 张以 `research_` 开头的新表。

- [ ] **Step 8.5: 提交**

```bash
git add supabase/migrations/
git commit -m "chore(research): add migration for research module schema"
```

---

## Task 9: 区县种子数据

**Files:**
- Create: `src/db/seed/research/cq-districts.ts`
- Create: `src/db/seed/research/index.ts`
- Create: `scripts/seed-research.ts`
- Modify: `package.json`

- [ ] **Step 9.1: 区县 seed**

```ts
// src/db/seed/research/cq-districts.ts
import { db } from "@/db";
import { cqDistricts } from "@/db/schema/research/cq-districts";

const DISTRICTS = [
  "北碚区","两江新区","九龙坡区","云阳县","巴南区","巫山县","涪陵区","奉节县",
  "江津区","梁平区","忠县","渝中区","长寿区","开州区","黔江区","南岸区",
  "南川区","大渡口区","永川区","沙坪坝区","璧山区","万州区","秀山县","丰都县",
  "铜梁区","万盛经开区","合川区","潼南区","科学城重庆高新区","城口县","彭水县","武隆区",
  "垫江县","綦江区","荣昌区","酉阳县","大足区","石柱县","巫溪县",
];

export async function seedCqDistricts() {
  const rows = DISTRICTS.map((name, i) => ({ name, sortOrder: i }));
  await db.insert(cqDistricts).values(rows).onConflictDoNothing();
  console.log(`✓ Seeded ${DISTRICTS.length} 重庆区县`);
}
```

- [ ] **Step 9.2: seed 编排**

```ts
// src/db/seed/research/index.ts
import { seedCqDistricts } from "./cq-districts";
import { seedResearchTopics } from "./research-topics";
import { seedMediaOutlets } from "./media-outlets";

export async function seedResearchModule() {
  console.log("→ Seeding research module...");
  await seedCqDistricts();
  await seedResearchTopics();
  await seedMediaOutlets();
  console.log("✓ Research module seed complete");
}
```

- [ ] **Step 9.3: 入口脚本**

```ts
// scripts/seed-research.ts
import { seedResearchModule } from "@/db/seed/research";

seedResearchModule()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 9.4: package.json 加脚本**

修改 `package.json` 的 `scripts` 节，加：
```json
"db:seed:research": "tsx scripts/seed-research.ts"
```

> 注：Step 10 和 Step 11 的 seed 函数会跟着写出来，先建空文件占位避免 import 报错：
>
> ```ts
> // src/db/seed/research/research-topics.ts
> export async function seedResearchTopics() { /* TODO Task 10 */ }
> // src/db/seed/research/media-outlets.ts
> export async function seedMediaOutlets() { /* TODO Task 11 */ }
> ```

- [ ] **Step 9.5: 跑区县 seed**

```bash
npm run db:seed:research
```
预期输出包含：`✓ Seeded 39 重庆区县`

- [ ] **Step 9.6: 跑 Task 2 的测试**

```bash
npm test -- src/lib/dal/research/__tests__/cq-districts.test.ts
```
预期：PASS（拿到 39 条记录）

- [ ] **Step 9.7: 提交**

```bash
git add src/db/seed/research/ scripts/seed-research.ts package.json
git commit -m "feat(research): seed 39 Chongqing districts"
```

---

## Task 10: 16 组主题种子（生态文明传播）

**Files:**
- Modify: `src/db/seed/research/research-topics.ts`

- [ ] **Step 10.1: 写完整 seed**

```ts
// src/db/seed/research/research-topics.ts
import { db } from "@/db";
import {
  researchTopics,
  researchTopicKeywords,
} from "@/db/schema/research/research-topics";
import { eq, and } from "drizzle-orm";

// 16 组主题：[共词, [近似称谓...]]
const TOPICS: Array<[string, string[]]> = [
  ["美丽中国", ["美丽中国建设", "生态宜居"]],
  ["综合治理", ["生态保护", "生态修复", "生态环境综合治理", "系统治理", "环境治理"]],
  ["绿色发展", ["绿色低碳", "低碳发展", "绿色转型", "零碳蓝碳"]],
  ["双碳", ["碳达峰碳中和", "降污减碳", "碳交易"]],
  ["和谐共生", ["地球生命共同体", "绿色丝绸之路"]],
  ["长江生态", ["长江经济带生态保护", "长江经济带", "长江大保护", "长江共抓大保护"]],
  ["绿水青山", ["绿水青山就是金山银山", "两山"]],
  ["制度建设", ["生态文明制度", "生态文明建设", "生态文明体制改革"]],
  ["资源节约", ["资源节约集约利用", "资源可循环"]],
  ["污染防治攻坚战", ["蓝天", "碧水", "净土保卫战"]],
  ["清洁能源", ["能源消费革命", "新型能源体系", "无废城市"]],
  ["国家公园", ["国家森林公园"]],
  ["环保督察", ["中央生态环境保护督察"]],
  ["生物多样性", ["生物多样性保护"]],
  ["生态红线", ["生态保护红线"]],
  ["低碳经济", ["绿色生活", "低碳消费"]],
];

const PRESET_ORG_ID = "00000000-0000-0000-0000-000000000000"; // TODO: 替换为种子组织 ID 或从 .env.local 读取

export async function seedResearchTopics() {
  for (let i = 0; i < TOPICS.length; i++) {
    const [name, aliases] = TOPICS[i];
    const orgId = process.env.SEED_ORG_ID ?? PRESET_ORG_ID;

    // upsert topic
    const existing = await db.select().from(researchTopics)
      .where(and(eq(researchTopics.organizationId, orgId), eq(researchTopics.name, name)))
      .limit(1);

    let topicId: string;
    if (existing.length > 0) {
      topicId = existing[0].id;
    } else {
      const inserted = await db.insert(researchTopics).values({
        organizationId: orgId,
        name,
        sortOrder: i,
        isPreset: true,
      }).returning({ id: researchTopics.id });
      topicId = inserted[0].id;
    }

    // 共词 + 近似称谓
    const allKw = [
      { keyword: name, isPrimary: true },
      ...aliases.map((a) => ({ keyword: a, isPrimary: false })),
    ];
    await db.insert(researchTopicKeywords)
      .values(allKw.map((k) => ({ topicId, ...k })))
      .onConflictDoNothing();
  }
  console.log(`✓ Seeded ${TOPICS.length} research topics`);
}
```

> 注：`SEED_ORG_ID` 环境变量需要在 `.env.local` 中设置为目标组织 ID。如果种子组织尚未就位，跑 seed 前先用 Drizzle Studio 查一个 organization id。

- [ ] **Step 10.2: 跑 seed**

```bash
SEED_ORG_ID=<你的 org id> npm run db:seed:research
```
预期：`✓ Seeded 16 research topics`

- [ ] **Step 10.3: 在 Drizzle Studio 验证**

打开 `research_topics`，确认 16 行；打开 `research_topic_keywords`，确认每个 topic 至少 1 条 primary 关键词。

- [ ] **Step 10.4: 提交**

```bash
git add src/db/seed/research/research-topics.ts
git commit -m "feat(research): seed 16 ecology civilization research topics"
```

---

## Task 11: 媒体源种子（重庆四级，约 100 家）

**Files:**
- Modify: `src/db/seed/research/media-outlets.ts`

- [ ] **Step 11.1: 整理种子数据清单**

按四级整理，每级至少：
- **central**（约 8 家）：人民日报、新华社、光明日报、央视总台、经济日报、中国日报、求是、中央广电总台
- **provincial_municipal**（约 12 家，重庆为主）：重庆日报、华龙网、上游新闻、第1眼新闻、视界网、都市热报、华龙智库 …
- **industry**（约 12 家）：中国环境报、中国能源报、健康报、农民日报、科技日报 …
- **district_media**（每个区县至少 1-2 家融媒体，约 60 家）：涪陵发布、渝中发布、江北融媒、北碚融媒 …

- [ ] **Step 11.2: 写 seed**

```ts
// src/db/seed/research/media-outlets.ts
import { db } from "@/db";
import { mediaOutlets, mediaOutletAliases } from "@/db/schema/research/media-outlets";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { eq } from "drizzle-orm";

type Seed = {
  name: string;
  tier: "central" | "provincial_municipal" | "industry" | "district_media";
  province?: string;
  districtName?: string;
  industryTag?: string;
  officialUrl?: string;
  aliases?: { alias: string; matchPattern: string }[];
};

const OUTLETS: Seed[] = [
  // ─── 中央级 ───
  { name: "人民日报", tier: "central", officialUrl: "https://www.people.com.cn",
    aliases: [{ alias: "人民网", matchPattern: "people.com.cn" }] },
  { name: "新华社", tier: "central", officialUrl: "https://www.xinhuanet.com",
    aliases: [
      { alias: "新华网", matchPattern: "xinhuanet.com" },
      { alias: "新华社客户端", matchPattern: "news.cn" },
    ]},
  { name: "中央广播电视总台", tier: "central", officialUrl: "https://www.cctv.com",
    aliases: [{ alias: "央视网", matchPattern: "cctv.com" }] },
  { name: "光明日报", tier: "central", officialUrl: "https://www.gmw.cn",
    aliases: [{ alias: "光明网", matchPattern: "gmw.cn" }] },
  // ... 其余中央级

  // ─── 省/市级（重庆） ───
  { name: "重庆日报", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cqrb.cn" },
  { name: "华龙网", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cqnews.net",
    aliases: [{ alias: "华龙智库", matchPattern: "cqnews.net" }] },
  // ... 其余市级

  // ─── 行业级 ───
  { name: "中国环境报", tier: "industry", industryTag: "环境",
    officialUrl: "https://www.cenews.com.cn" },
  // ... 其余行业级

  // ─── 区县融媒体（按区县逐个补） ───
  { name: "涪陵发布", tier: "district_media", districtName: "涪陵区" },
  { name: "渝中发布", tier: "district_media", districtName: "渝中区" },
  // ... 其余区县融媒体
];

export async function seedMediaOutlets() {
  const orgId = process.env.SEED_ORG_ID;
  if (!orgId) throw new Error("SEED_ORG_ID env required");

  // 预取区县映射
  const districts = await db.select().from(cqDistricts);
  const districtByName = new Map(districts.map((d) => [d.name, d.id]));

  for (const seed of OUTLETS) {
    const existing = await db.select().from(mediaOutlets)
      .where(eq(mediaOutlets.name, seed.name)).limit(1);
    if (existing.length > 0) continue;

    const [outlet] = await db.insert(mediaOutlets).values({
      organizationId: orgId,
      name: seed.name,
      tier: seed.tier,
      province: seed.province,
      districtId: seed.districtName ? districtByName.get(seed.districtName) : undefined,
      industryTag: seed.industryTag,
      officialUrl: seed.officialUrl,
    }).returning();

    if (seed.aliases?.length) {
      await db.insert(mediaOutletAliases).values(
        seed.aliases.map((a) => ({ outletId: outlet.id, ...a })),
      );
    }
  }
  console.log(`✓ Seeded media outlets`);
}
```

> 注：完整 100 家清单需要老师/产品方提供，第一次 PR 时种子可以只放 30-40 家关键媒体，后续在 admin UI 完成后由老师持续录入。

- [ ] **Step 11.3: 跑 seed**

```bash
SEED_ORG_ID=<your org id> npm run db:seed:research
```

- [ ] **Step 11.4: Drizzle Studio 验证**

确认各 tier 都有数据，特别是 `district_media` 的 `districtId` 外键正确解析。

- [ ] **Step 11.5: 提交**

```bash
git add src/db/seed/research/media-outlets.ts
git commit -m "feat(research): seed initial media outlets across 4 tiers"
```

---

## Task 12: DAL — 媒体源 CRUD

**Files:**
- Create: `src/lib/dal/research/media-outlets.ts`
- Create: `src/lib/dal/research/__tests__/media-outlets.test.ts`

- [ ] **Step 12.1: 类型 + 列表查询**

```ts
// src/lib/dal/research/media-outlets.ts
import { db } from "@/db";
import { mediaOutlets, mediaOutletAliases } from "@/db/schema/research/media-outlets";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { eq, and, desc } from "drizzle-orm";

export type MediaTier = "central" | "provincial_municipal" | "industry" | "district_media";

export type MediaOutletSummary = {
  id: string;
  name: string;
  tier: MediaTier;
  province: string | null;
  districtName: string | null;
  industryTag: string | null;
  officialUrl: string | null;
  status: "active" | "archived";
  aliasCount: number;
};

export async function listMediaOutlets(opts: {
  organizationId: string;
  tier?: MediaTier;
  search?: string;
}): Promise<MediaOutletSummary[]> {
  const conds = [eq(mediaOutlets.organizationId, opts.organizationId)];
  if (opts.tier) conds.push(eq(mediaOutlets.tier, opts.tier));

  const rows = await db
    .select({
      id: mediaOutlets.id,
      name: mediaOutlets.name,
      tier: mediaOutlets.tier,
      province: mediaOutlets.province,
      districtName: cqDistricts.name,
      industryTag: mediaOutlets.industryTag,
      officialUrl: mediaOutlets.officialUrl,
      status: mediaOutlets.status,
    })
    .from(mediaOutlets)
    .leftJoin(cqDistricts, eq(mediaOutlets.districtId, cqDistricts.id))
    .where(and(...conds))
    .orderBy(desc(mediaOutlets.createdAt));

  // alias count（独立 group-by 以避免一对多放大）
  const aliasCounts = await db
    .select({
      outletId: mediaOutletAliases.outletId,
      count: db.$count(mediaOutletAliases.id).as("count"),
    })
    .from(mediaOutletAliases)
    .groupBy(mediaOutletAliases.outletId);
  const aliasMap = new Map(aliasCounts.map((a) => [a.outletId, Number(a.count)]));

  let result = rows.map((r) => ({ ...r, aliasCount: aliasMap.get(r.id) ?? 0 }));
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter((r) => r.name.toLowerCase().includes(q));
  }
  return result;
}

export async function getMediaOutletById(id: string, organizationId: string) {
  const [outlet] = await db.select().from(mediaOutlets)
    .where(and(eq(mediaOutlets.id, id), eq(mediaOutlets.organizationId, organizationId)));
  if (!outlet) return null;
  const aliases = await db.select().from(mediaOutletAliases).where(eq(mediaOutletAliases.outletId, id));
  return { outlet, aliases };
}
```

- [ ] **Step 12.2: 写测试**

```ts
// src/lib/dal/research/__tests__/media-outlets.test.ts
import { describe, it, expect } from "vitest";
import { listMediaOutlets } from "../media-outlets";

describe("listMediaOutlets", () => {
  const ORG = process.env.SEED_ORG_ID!;
  it("returns outlets filtered by tier", async () => {
    const central = await listMediaOutlets({ organizationId: ORG, tier: "central" });
    expect(central.length).toBeGreaterThan(0);
    expect(central.every((o) => o.tier === "central")).toBe(true);
  });

  it("supports search filter", async () => {
    const result = await listMediaOutlets({ organizationId: ORG, search: "新华" });
    expect(result.some((o) => o.name.includes("新华"))).toBe(true);
  });
});
```

- [ ] **Step 12.3: 跑测试**

```bash
SEED_ORG_ID=<id> npm test -- src/lib/dal/research/__tests__/media-outlets.test.ts
```
预期：PASS

- [ ] **Step 12.4: 提交**

```bash
git add src/lib/dal/research/media-outlets.ts src/lib/dal/research/__tests__/media-outlets.test.ts
git commit -m "feat(research): DAL for media outlets list / get"
```

---

## Task 13: DAL — 主题词库

**Files:**
- Create: `src/lib/dal/research/research-topics.ts`
- Create: `src/lib/dal/research/__tests__/research-topics.test.ts`

- [ ] **Step 13.1: 实现**

```ts
// src/lib/dal/research/research-topics.ts
import { db } from "@/db";
import {
  researchTopics, researchTopicKeywords, researchTopicSamples,
} from "@/db/schema/research/research-topics";
import { eq, and, asc } from "drizzle-orm";

export type TopicSummary = {
  id: string;
  name: string;
  description: string | null;
  isPreset: boolean;
  primaryKeyword: string | null;
  aliasCount: number;
  sampleCount: number;
};

export async function listResearchTopics(orgId: string): Promise<TopicSummary[]> {
  const topics = await db.select().from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId))
    .orderBy(asc(researchTopics.sortOrder));

  const result: TopicSummary[] = [];
  for (const t of topics) {
    const kws = await db.select().from(researchTopicKeywords).where(eq(researchTopicKeywords.topicId, t.id));
    const samples = await db.select().from(researchTopicSamples).where(eq(researchTopicSamples.topicId, t.id));
    const primary = kws.find((k) => k.isPrimary);
    result.push({
      id: t.id,
      name: t.name,
      description: t.description,
      isPreset: t.isPreset,
      primaryKeyword: primary?.keyword ?? null,
      aliasCount: kws.filter((k) => !k.isPrimary).length,
      sampleCount: samples.length,
    });
  }
  return result;
}

export async function getResearchTopicById(id: string, orgId: string) {
  const [topic] = await db.select().from(researchTopics)
    .where(and(eq(researchTopics.id, id), eq(researchTopics.organizationId, orgId)));
  if (!topic) return null;
  const keywords = await db.select().from(researchTopicKeywords).where(eq(researchTopicKeywords.topicId, id));
  const samples = await db.select().from(researchTopicSamples).where(eq(researchTopicSamples.topicId, id));
  return { topic, keywords, samples };
}
```

- [ ] **Step 13.2: 写测试**

```ts
// src/lib/dal/research/__tests__/research-topics.test.ts
import { describe, it, expect } from "vitest";
import { listResearchTopics } from "../research-topics";

describe("listResearchTopics", () => {
  it("returns 16 preset topics for seeded org", async () => {
    const orgId = process.env.SEED_ORG_ID!;
    const result = await listResearchTopics(orgId);
    expect(result.length).toBeGreaterThanOrEqual(16);
    const names = result.map((r) => r.name);
    expect(names).toContain("环保督察");
    expect(names).toContain("绿水青山");
  });
});
```

- [ ] **Step 13.3: 跑测试 + 提交**

```bash
SEED_ORG_ID=<id> npm test -- src/lib/dal/research/__tests__/research-topics.test.ts
git add src/lib/dal/research/research-topics.ts src/lib/dal/research/__tests__/research-topics.test.ts
git commit -m "feat(research): DAL for research topics"
```

---

## Task 14: Server Actions — 媒体源 CRUD

**Files:**
- Create: `src/app/actions/research/media-outlets.ts`
- Create: `src/app/actions/research/__tests__/media-outlets.test.ts`（mock DAL）

- [ ] **Step 14.1: 实现**

```ts
// src/app/actions/research/media-outlets.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { mediaOutlets, mediaOutletAliases } from "@/db/schema/research/media-outlets";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth"; // 沿用现有 helper
import { hasPermission, PERMISSIONS } from "@/lib/rbac-constants";

const tierEnum = z.enum(["central","provincial_municipal","industry","district_media"]);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  tier: tierEnum,
  province: z.string().optional(),
  districtId: z.string().uuid().optional(),
  industryTag: z.string().optional(),
  officialUrl: z.string().url().optional(),
  aliases: z.array(z.object({
    alias: z.string().min(1),
    matchPattern: z.string().min(1),
  })).optional(),
});

export async function createMediaOutlet(input: z.infer<typeof createSchema>) {
  const { user, organizationId, permissions } = await requireAuth();
  if (!hasPermission(permissions, PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE))
    throw new Error("无权管理媒体源");

  const data = createSchema.parse(input);

  const [outlet] = await db.insert(mediaOutlets).values({
    organizationId,
    createdBy: user.id,
    name: data.name,
    tier: data.tier,
    province: data.province,
    districtId: data.districtId,
    industryTag: data.industryTag,
    officialUrl: data.officialUrl,
  }).returning();

  if (data.aliases?.length) {
    await db.insert(mediaOutletAliases).values(
      data.aliases.map((a) => ({ outletId: outlet.id, ...a })),
    );
  }

  revalidatePath("/research/admin/media-outlets");
  return { ok: true, id: outlet.id };
}

export async function archiveMediaOutlet(id: string) {
  const { organizationId, permissions } = await requireAuth();
  if (!hasPermission(permissions, PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE))
    throw new Error("无权管理媒体源");

  await db.update(mediaOutlets).set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(mediaOutlets.id, id), eq(mediaOutlets.organizationId, organizationId)));
  revalidatePath("/research/admin/media-outlets");
  return { ok: true };
}
```

- [ ] **Step 14.2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/app/actions/research/media-outlets.ts
git commit -m "feat(research): server actions for media outlet CRUD"
```

---

## Task 15: Server Actions — 主题词库 CRUD

**Files:**
- Create: `src/app/actions/research/research-topics.ts`

- [ ] **Step 15.1: 实现** —— 类比 Task 14 写 `createTopic` / `updateTopic` / `addKeyword` / `removeKeyword` / `addSample` / `removeSample`，限制 `RESEARCH_TOPIC_MANAGE` 权限

- [ ] **Step 15.2: 注意：当样本被新增/修改后，要发送 Inngest 事件 `research/topic.sample.changed`，让 S3 阶段的向量化作业将其拉去向量化。**

```ts
import { inngest } from "@/inngest/client";
// ...在 addSample / updateSample 末尾：
await inngest.send({ name: "research/topic.sample.changed", data: { sampleId: created.id } });
```

注：S3 才会真正实现 listener；S1 阶段先把事件发出，listener 后续接。

- [ ] **Step 15.3: 提交**

```bash
git add src/app/actions/research/research-topics.ts
git commit -m "feat(research): server actions for research topic CRUD"
```

---

## Task 16: RBAC 接入

**Files:**
- Modify: `src/lib/rbac-constants.ts`

- [ ] **Step 16.1: 增加常量**

定位 `PERMISSIONS` 对象，追加：

```ts
RESEARCH_TASK_CREATE: "research.task.create",
RESEARCH_TASK_VIEW_OWN: "research.task.view_own",
RESEARCH_TASK_VIEW_ORG: "research.task.view_org",
RESEARCH_TASK_EXPORT: "research.task.export",
RESEARCH_MEDIA_OUTLET_MANAGE: "research.media_outlet.manage",
RESEARCH_TOPIC_MANAGE: "research.topic.manage",
MENU_RESEARCH: "menu.research",
```

- [ ] **Step 16.2: 接入菜单映射**

```ts
"/research": PERMISSIONS.MENU_RESEARCH,
"/research/admin/media-outlets": PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
"/research/admin/topics": PERMISSIONS.RESEARCH_TOPIC_MANAGE,
```

- [ ] **Step 16.3: 默认角色映射**

定位现有「角色 → 权限」初始化数据（如 `src/db/seed/rbac.ts` 或类似）：
- 普通研究者：`MENU_RESEARCH` + `RESEARCH_TASK_CREATE` + `RESEARCH_TASK_VIEW_OWN` + `RESEARCH_TASK_EXPORT`
- 学院管理员：以上 + `RESEARCH_TASK_VIEW_ORG`
- 平台管理员：以上 + `RESEARCH_MEDIA_OUTLET_MANAGE` + `RESEARCH_TOPIC_MANAGE`

> 如 RBAC 角色是数据库内动态配置，则改为 admin 后台手动开权限。

- [ ] **Step 16.4: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/lib/rbac-constants.ts
git commit -m "feat(research): wire RBAC permissions for research module"
```

---

## Task 17: 模块布局 + 占位首页

**Files:**
- Create: `src/app/(dashboard)/research/layout.tsx`
- Create: `src/app/(dashboard)/research/page.tsx`

- [ ] **Step 17.1: layout — 权限守卫**

```tsx
// src/app/(dashboard)/research/layout.tsx
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac-constants";
import { redirect } from "next/navigation";

export default async function ResearchLayout({ children }: { children: React.ReactNode }) {
  const { permissions } = await requireAuth();
  if (!hasPermission(permissions, PERMISSIONS.MENU_RESEARCH)) {
    redirect("/home");
  }
  return <div className="min-h-screen">{children}</div>;
}
```

- [ ] **Step 17.2: 占位首页**

```tsx
// src/app/(dashboard)/research/page.tsx
export const dynamic = "force-dynamic";

export default function ResearchHomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">新闻研究</h1>
      <p className="text-muted-foreground">
        本模块用于学术研究场景下的新闻检索与报告生成。S4 阶段将在此提供研究任务中心。
      </p>
      <div className="mt-6 flex gap-3">
        <a href="/research/admin/media-outlets" className="text-sm text-primary hover:underline">媒体源管理 →</a>
        <a href="/research/admin/topics" className="text-sm text-primary hover:underline">主题词库管理 →</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 17.3: 提交**

```bash
git add src/app/\(dashboard\)/research/layout.tsx src/app/\(dashboard\)/research/page.tsx
git commit -m "feat(research): module layout with permission guard + placeholder home"
```

---

## Task 18: 媒体源管理 UI

**Files:**
- Create: `src/app/(dashboard)/research/admin/media-outlets/page.tsx`
- Create: `src/app/(dashboard)/research/admin/media-outlets/media-outlets-client.tsx`

- [ ] **Step 18.1: Server page**

```tsx
// page.tsx
import { listMediaOutlets } from "@/lib/dal/research/media-outlets";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { requireAuth } from "@/lib/auth/require-auth";
import { MediaOutletsClient } from "./media-outlets-client";

export const dynamic = "force-dynamic";

export default async function MediaOutletsAdminPage() {
  const { organizationId } = await requireAuth();
  const [outlets, districts] = await Promise.all([
    listMediaOutlets({ organizationId }),
    listCqDistricts(),
  ]);
  return <MediaOutletsClient outlets={outlets} districts={districts} />;
}
```

- [ ] **Step 18.2: Client 组件**

实现：
- shadcn `Table` + 顶部 `Input`（搜索）+ `Select`（按 tier 筛选）+ `Button`「新增媒体」
- 「新增媒体」打开 shadcn `Dialog` 表单：name / tier / 选区县 / 行业标签 / 官网 / 别名（动态行）
- 表单 submit 调 `createMediaOutlet` action
- 行操作：「编辑」「归档」（`archiveMediaOutlet`）

> **样式约束**：按项目 `CLAUDE.md` 要求，所有可点击触发事件的按钮**不带边框**（用 `variant="ghost"` 或自定义 `className` 去除 border）。

- [ ] **Step 18.3: 类型检查 + dev 跑通 + 提交**

```bash
npx tsc --noEmit
npm run dev
# 浏览器访问 http://localhost:3000/research/admin/media-outlets 验证
```

```bash
git add src/app/\(dashboard\)/research/admin/media-outlets/
git commit -m "feat(research): media outlets admin page"
```

---

## Task 19: 主题词库管理 UI

**Files:**
- Create: `src/app/(dashboard)/research/admin/topics/page.tsx`
- Create: `src/app/(dashboard)/research/admin/topics/topics-client.tsx`

- [ ] **Step 19.1: 类比 Task 18 实现**

特点：
- 主视图：16 个主题卡片网格（可滚动）
- 卡片右上角「编辑」→ 弹窗显示三个 Tab：基础信息 / 关键词（共词+近似称谓两组列表）/ 样本（textarea 列表 + 向量化状态徽标）
- 关键词增删：本地表单 → submit 调 `addKeyword`/`removeKeyword`
- 样本增删：调 `addSample`/`removeSample`，新增后状态显示"待向量化"

- [ ] **Step 19.2: 提交**

```bash
git add src/app/\(dashboard\)/research/admin/topics/
git commit -m "feat(research): research topics admin page"
```

---

## Task 20: 侧边栏菜单 + 最终验收

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 20.1: 菜单条目**

在 AppSidebar 现有菜单分组的合适位置加：

```tsx
{
  label: "新闻研究",
  href: "/research",
  icon: BookSearch, // lucide
  permission: PERMISSIONS.MENU_RESEARCH,
}
```

如有「管理后台」分组，再加两条子项指向 `/research/admin/media-outlets` 和 `/research/admin/topics`。

- [ ] **Step 20.2: 全量回归**

```bash
npx tsc --noEmit          # 期望 0 errors
npm run lint              # 期望 0 errors
npm test                  # 期望 全部通过
npm run build             # 期望 build 成功
```

- [ ] **Step 20.3: 端到端冒烟**

```bash
npm run dev
```
浏览器走一遍：
1. 登录 → 侧边栏看到「新闻研究」
2. 进 `/research` 看到占位首页
3. 进 `/research/admin/media-outlets` 看到种子的媒体列表，能筛选、能新增、能归档
4. 进 `/research/admin/topics` 看到 16 个主题卡片，能编辑关键词和样本

- [ ] **Step 20.4: 终结提交**

```bash
git add -A
git commit -m "feat(research): S1 foundation complete — schema, seeds, admin UIs"
```

---

## S1 完成验收清单

- [x] 11 张表 schema 上线，迁移文件已生成并入 git
- [x] 39 区县、16 主题（含共词+近似称谓）、≥30 家媒体已 seed 入库
- [x] DAL：`listMediaOutlets`、`getMediaOutletById`、`listResearchTopics`、`getResearchTopicById`、`listCqDistricts`
- [x] Server Actions：`createMediaOutlet` / `archiveMediaOutlet` / 主题词库 CRUD（含 sample 变更事件发送）
- [x] RBAC 6+1 个新 permission 已注册
- [x] 后台 UI：媒体源管理、主题词库管理（响应式，按钮无边框）
- [x] 侧边栏菜单条目已加，权限守卫有效
- [x] `npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build` 全部通过

**S1 完成后**：S2「采集通道」依赖本阶段产出的 `media_outlets`、`media_outlet_aliases`、`media_outlet_crawl_configs`、`research_topics`、`research_topic_keywords`、`news_articles` 表与对应 DAL，可无缝衔接。

---

## 后续阶段索引（不属于本计划）

| 阶段 | 计划文档（待写） | 主要内容 |
|---|---|---|
| **S2 采集通道** | `2026-04-21-news-research-s2-crawl.md`（待） | 三路采集 + Inngest + URL hash 去重 |
| **S3 命中分析** | `2026-04-28-news-research-s3-matching.md`（待） | 关键词命中 + 语义命中 + 向量化 listener |
| **S4 检索 UI** | `2026-05-05-news-research-s4-search-ui.md`（待） | 任务中心 + 4 步表单 + 知网式高级检索 |
| **S5 聚合 + 图表** | `2026-05-12-news-research-s5-aggregation.md`（待） | 数据简报文本 + 三张核心图 + 透视表 |
| **S6 导出** | `2026-05-19-news-research-s6-export.md`（待） | Excel 7 Sheet + Word 报告模板 |

每完成一个阶段、回归测试通过后，再起草下一阶段的 plan，避免一次性输出过长且因前一阶段实施反馈失效。
