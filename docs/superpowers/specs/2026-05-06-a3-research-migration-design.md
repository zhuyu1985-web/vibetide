# A3 — Research 模块迁移到 Collection Hub sub-spec

- **版本**：v1.0
- **日期**：2026-05-06
- **作者**：Zhuyu（产品） + Claude（技术方案）
- **关联 main spec**：`/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.4
- **状态**：Brainstorming 完成，待 implementation plan
- **工期估算**：3.5-4.5 天（5 phase）

---

## 1. 范围与目标

### 1.1 一句话定义

> 把研究模块的"自有原始数据存储"（`research_news_articles` + `research_news_article_topic_hits`）彻底迁到 Collection Hub 统一池（`collected_items`），并新增"研究语义层"附属表（采集项 ↔ 16 主题、采集项 ↔ 40 区县）+ Inngest 自动打标（订阅 `collection/item.created` 事件 → 关键词命中 → 写 annotation 表），让研究模块只做"消费 collected_items + 加研究标注"，不再有自己的采集分支。

### 1.2 范围（3.5-4.5 天工期内必交付，5 phase）

#### Phase 1 Schema 改动（0.5-1 天）

- DROP 老表：`research_news_articles` + `research_news_article_topic_hits` + 相关 enum（`newsSourceChannelEnum` 看是否还被其他模块引用，独立判断）
- CREATE 新表：
  - `research_collected_item_topics`（采集项 ↔ 主题归类，多对多）
  - `research_collected_item_districts`（采集项 ↔ 区县归属，多对多）
- 保留 `topicMatchTypeEnum`（"keyword" / "approximate_keyword" / "semantic" / "manual"）— 新表也用
- 保留 `researchEmbeddingStatusEnum`（V2 语义打标会用）
- migration 文件 + 手工应用（同 A1 模式）

#### Phase 2 DAL + Server Actions 重写（1 天）

- 删 `src/lib/dal/research/news-article-search.ts` → 新建 `collected-item-search.ts`（查 `collected_items` + join `research_collected_item_topics/districts` 过滤）
- 修 `src/lib/dal/research/research-tasks.ts`（引用从 newsArticles 改为 collectedItems）
- 修 `src/app/actions/research/article-search.ts` → 新建 `collected-item-search.ts`（同名重写）
- 修 `src/app/actions/research/research-tasks.ts`

#### Phase 3 自动打标 Inngest（1 天）

- 创建 `src/inngest/functions/research/annotate-collected-item.ts`：订阅 `collection/item.created` 事件 → 加载 16 topic 关键词列表（含近似词）+ 40 区县名称 → 对采集项 title + content 做命中 → 写 annotation 表
- 创建 `src/inngest/functions/research/backfill-annotate.ts`：一次性 Inngest 函数（手工触发）→ 批量扫历史 `collected_items` 跑同样逻辑回填 annotation
- 注册到 inngest functions index

#### Phase 4 UI 解 stub（0.5-1 天）

- `src/app/(dashboard)/research/page.tsx`：解 Phase 0 stub，重新接 collected_items 数据加载（按 outlet_tier / topic / district 聚合统计）
- `src/app/(dashboard)/research/search-workbench-client.tsx`：重新启用 outlet 字段筛选 + 接通 annotation 检索
- `src/app/(dashboard)/research/admin/tasks/*`：评估"研究任务（mission）"概念在新架构下的存在价值（保留 / 简化 / 删除，详见 §3.4）

#### Phase 5 Cleanup + 测试（0.5 天）

- 删除 6 个 research 自采 inngest 函数：
  - `tavily-crawl.ts` / `whitelist-crawl.ts` / `manual-url-ingest.ts`（A1 Phase 0 已 stub，本 Phase 整体删）
  - `article-content-fetch.ts`（research 专用正文异步拉取，collected_items 入库时已含 content，不需要）
  - `bridge-backfill.ts`（看是否仍在 collection-bridge 框架引用，独立判断）
  - `task-start.ts`（看研究任务概念决策决定是否删）
- 修 `src/lib/research/article-ingest.ts`：A1 Phase 0 已 stub，A3 评估是否整体删（如果研究模块不再有"独立 ingest"概念）
- 集成测试（writer + annotate 链路）+ tsc / lint / build / final commit

### 1.3 非目标（YAGNI / 推迟到 V2）

- ❌ 双写过渡（A3-Q1 决策 a：直接 drop demo 数据，同 A1 Path C 模式）
- ❌ 数据迁移脚本（demo 数据丢，不迁移）
- ❌ 主题词向量化语义打标（V2，main spec W2.5）— V1 仅关键词命中（精确 + 近似词）
- ❌ 区县名称的智能消歧义（如"江北区"在重庆和宁波都有；V1 默认重庆区县）
- ❌ 研究任务（mission）级别的批量"启动追踪"工作流（V2 evaluate）
- ❌ 研究模块的 Inngest 任务进度可视化（V2）
- ❌ outlet recognizer 在研究模块的"跨平台一致性"测试（A1 已覆盖）

### 1.4 与 main spec §4.4 对应关系

main spec §4.4 给了 schema 草稿（research_collected_item_topics + districts）+ 自动打标流程描述 + DAL 重构方向。本 sub-spec：

1. **数据迁移决策敲定**：a 直接 drop（同 A1 Path C），不双写
2. **5 phase 切分**：明确每 phase 边界与产出
3. **自动打标算法**：V1 用关键词命中（精确 + 近似词），V2 加向量
4. **6 个 inngest 函数 cleanup 清单**：明确删除哪些、保留哪些
5. **研究任务概念决策**：详见 §3.4

---

## 2. 已确认决策（来自 A3 brainstorming）

| ID | 问题 | 决策 |
|---|---|---|
| A3-Q1 | research_news_articles 数据迁移策略 | **a 直接 drop demo 数据**（同 A1 Path C v1 outlet 系统决策一致；现存数据是 dev 测试 demo 可丢；客户 2025 历史数据走 A2.5 Excel 导入） |
| A3-Q2 | A3 phase 切分 | **5 phase**：Schema / DAL / Annotate / UI / Cleanup（节奏同 A1/A2/A2.5；每 phase 1 天左右；commit 边界清晰） |

---

## 3. Schema 设计

### 3.0 删除清单

```
DROP TABLE research_news_article_topic_hits CASCADE  -- FK to research_news_articles
DROP TABLE research_news_articles CASCADE
```

**Enum 删除（看引用情况）**：
- `newsSourceChannelEnum`（"tavily/whitelist/manual_url/hot_topic_crawler" 等 — A3 cleanup 后无人引用 → DROP）
- `researchEmbeddingStatusEnum` — 暂保留（V2 语义打标会用）
- `topicMatchTypeEnum` — 保留（新 annotation 表 match_type 字段用）

**FK 影响**：
- `research_topics` 表 — 不动（V1 主题词库保留）
- `cqDistricts` 表 — 不动
- `research_tasks` 表 — 看是否被 articles FK 引用（researchTasks → newsArticles 是单向，删 articles 不影响 tasks）

### 3.1 新增表 `research_collected_item_topics`

文件：`src/db/schema/research/annotations.ts`（新建）

```ts
import { sql } from "drizzle-orm";
import {
  index, numeric, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { collectedItems } from "../collection";
import { researchTopics } from "./research-topics";
import { topicMatchTypeEnum } from "./enums";

export const researchCollectedItemTopics = pgTable(
  "research_collected_item_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull()
      .references(() => researchTopics.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),  // keyword / approximate_keyword / semantic / manual
    matchedKeyword: text("matched_keyword"),  // 命中的具体关键词
    matchScore: numeric("match_score", { precision: 5, scale: 4 }),  // 0-1，语义匹配时填
    annotatedBy: text("annotated_by").notNull().default("system"),  // "system" | userId
    annotatedAt: timestamp("annotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueItemTopic: unique("research_cit_unique").on(t.collectedItemId, t.topicId, t.matchType),
    itemIdx: index("research_cit_item_idx").on(t.collectedItemId),
    topicIdx: index("research_cit_topic_idx").on(t.topicId),
  }),
);

export type ResearchCollectedItemTopicRow = typeof researchCollectedItemTopics.$inferSelect;
```

### 3.2 新增表 `research_collected_item_districts`

```ts
export const researchCollectedItemDistricts = pgTable(
  "research_collected_item_districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    districtId: uuid("district_id").notNull()
      .references(() => cqDistricts.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),  // 复用 topic 的 enum
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

export type ResearchCollectedItemDistrictRow = typeof researchCollectedItemDistricts.$inferSelect;
```

注：district annotation 不像 topic 一样允许多 match_type 共存（一个采集项要么命中区县要么不命中，没必要分多种 type）。unique 仅按 `(item, district)`。

### 3.3 Migration

新建 migration：`supabase/migrations/2026050700000X_a3_research_migration.sql`

```sql
-- A3: 废 research_news_articles 系统 + 加 annotation 表

-- 删除 老表（CASCADE 同时删 topic_hits / FK / 索引）
DROP TABLE IF EXISTS research_news_article_topic_hits CASCADE;
DROP TABLE IF EXISTS research_news_articles CASCADE;

-- 删除已无引用的 enum
DROP TYPE IF EXISTS research_news_source_channel CASCADE;

-- 创建 annotation 表
CREATE TABLE research_collected_item_topics ( /* ... */ );
CREATE TABLE research_collected_item_districts ( /* ... */ );
-- 加索引 + unique 约束
```

drizzle-kit 会自动生成大部分。手工补 enum drop（drizzle 不会自动删未引用的 enum）。

### 3.4 研究任务（mission/research_task）的存在价值

`research_tasks` 表是 v1 spec F12 设计的"长时任务异步执行 + 历史归档"。在 A3 新架构下：

**当前 v1 用途**：
- `research_tasks.id` 关联到 `newsArticles.firstSeenResearchTaskId`（第一次抓回是哪个任务的）
- 任务管理 UI `/research/admin/tasks/*` 让客户启动 / 查看 / 归档研究任务

**新架构下的价值评估**：

- **方案 A（推荐）：保留 research_tasks，但改语义为"研究检索快照 + 报告归档"**：
  - 客户在搜索工作台保存检索条件 → 创建 research_task（含检索条件 + 命中数据 ID 列表 + 报告状态）
  - A5（报告导出）会用到这个表挂报告输出
  - 不再有"任务驱动采集"概念（采集已统一在 Collection Hub）
  - `research_tasks.firstSeenResearchTaskId` 引用迁到新表（research_collected_item_research_task_origin? 或者直接干掉这个字段）

- **方案 B：完全删除 research_tasks**：
  - 让 research 检索完全无状态
  - 报告生成（A5）单独建 research_reports 表
  - 简化但失去"任务驱动追踪"的灵活性

V1 决定：**方案 A 保留 + 简化**。`firstSeenResearchTaskId` 字段在 collected_items 上不存在（A1 没加），所以不需要迁移；现有 `research_tasks` 表不动 + DAL 改成"任务存档"概念，不再触发采集。

---

## 4. 自动打标算法（Inngest）

### 4.1 触发与数据流

```
collection/item.created 事件（writer 入库时触发）
    ↓
src/inngest/functions/research/annotate-collected-item.ts
    ↓
1. 加载该 org 的 active topics + 关键词列表（含近似词）
2. 加载 40 区县名称
3. 对采集项 title + content 做关键词命中：
   - 精确匹配（"美丽中国" in title or content）→ matchType = "keyword"
   - 近似词匹配（"生态宜居" → 美丽中国）→ matchType = "approximate_keyword"
4. 命中的 topic 写 research_collected_item_topics（onConflictDoNothing）
5. 区县命中：title + content 中出现"涪陵区/涪陵县/涪陵"等 → matchType = "keyword"
6. 命中的区县写 research_collected_item_districts
```

### 4.2 关键词命中算法（V1 简版）

文件：`src/lib/research/topic-matcher.ts`（新建）

```ts
import type { ResearchTopicWithKeywords } from "@/lib/dal/research/research-topics";

interface MatchResult {
  topicId: string;
  matchedKeyword: string;
  matchType: "keyword" | "approximate_keyword";
}

export function matchTopicsForItem(
  text: string,  // title + content 合并
  topics: ResearchTopicWithKeywords[],  // 含 commonName / approximateNames
): MatchResult[] {
  const matches: MatchResult[] = [];
  const lowerText = text.toLowerCase();

  for (const topic of topics) {
    // 1. 主词命中
    if (lowerText.includes(topic.commonName.toLowerCase())) {
      matches.push({ topicId: topic.id, matchedKeyword: topic.commonName, matchType: "keyword" });
      continue;  // 命中主词后跳过近似词检查（避免重复命中同一 topic）
    }
    // 2. 近似词命中
    for (const approx of topic.approximateNames ?? []) {
      if (lowerText.includes(approx.toLowerCase())) {
        matches.push({ topicId: topic.id, matchedKeyword: approx, matchType: "approximate_keyword" });
        break;  // 一个 topic 命中第一个近似词即可
      }
    }
  }

  return matches;
}
```

### 4.3 区县命中算法

文件：`src/lib/research/district-matcher.ts`（新建）

```ts
interface DistrictMatchResult {
  districtId: string;
  matchedKeyword: string;
}

const DISTRICT_VARIANTS: Record<string, string[]> = {
  "涪陵区": ["涪陵区", "涪陵县", "涪陵"],
  "渝中区": ["渝中区", "渝中"],
  "两江新区": ["两江新区"],
  // ... 40 区县字典
};

export function matchDistrictsForItem(
  text: string,
  districts: { id: string; name: string }[],
): DistrictMatchResult[] {
  const matches: DistrictMatchResult[] = [];
  const lowerText = text.toLowerCase();

  for (const district of districts) {
    const variants = DISTRICT_VARIANTS[district.name] ?? [district.name];
    for (const variant of variants) {
      if (lowerText.includes(variant.toLowerCase())) {
        matches.push({ districtId: district.id, matchedKeyword: variant });
        break;  // 一个区县命中第一个变体即可
      }
    }
  }

  return matches;
}
```

注：DISTRICT_VARIANTS 字典 plan 阶段从 cq-districts seed 数据 + 常见变体（"涪陵县" 等历史称谓）推导。

### 4.4 历史回填

`src/inngest/functions/research/backfill-annotate.ts`：

- 触发事件：`research/backfill-annotate.requested`
- 行为：
  1. 加载 topic + district 字典
  2. 分批扫描 `collected_items WHERE organization_id = ? AND id NOT IN (SELECT collected_item_id FROM research_collected_item_topics)`（即未打过 topic 标的）
  3. 每批 500 条 → 跑 matcher → 批量插入 annotation
  4. 进度反馈到 `collection_runs.metadata` 或 `research_tasks` 上挂载

---

## 5. UI 解 Phase 0 stub

6 处 stub（A1 Phase 0 标 `// A3 阶段...`）：

第 6 处 `src/lib/dal/research/news-article-search.ts` 含 `outletName: null / outletTier: null` stub —— Phase 2 整体删除该文件，等效消除 stub。Phase 4 不再单独处理该文件。

### 5.1 `src/app/(dashboard)/research/page.tsx`

A1 Phase 0 注释（line 9）写 "A4 阶段 UI 重做时重新接入"。⚠️ **该注释与本 A3 §5.1 任务有冲突**：A3 阶段的工作是"接通 collected_items 数据加载"，**不是** A4 完整 UI 重做。

**A3 改造**：
- 移除 outlet 数据加载（已迁到 collected_items.outlet_tier，监控页用聚合 SQL 查）
- 改为"研究工作台首页"：显示总量统计（按主题/区县/媒体分级聚合）+ 最近研究任务列表
- **同步更新代码注释**：把 "A4 阶段..." 改为说明 A3 已接通 collected_items；A4 范围另文说明（A4 sub-brainstorm 时再决策完整 UI 重做边界）

### 5.2 `src/app/(dashboard)/research/search-workbench-client.tsx`

A1 Phase 0 stub 了 outlet 字段相关 UI。

**A3 改造**：
- 重新启用按 outlet_tier / outlet_region 筛选（直接 collected_items.outlet_tier 字段）
- 新增按 topic / district 筛选（join annotation 表）
- 检索结果列表显示 outlet + topic + district chip

### 5.3 `src/inngest/functions/research/task-start.ts`

A1 Phase 0 stub 了 outlet 引用。

**A3 改造**：
- 评估是否整体删除（A3-Q3 决策：研究任务概念保留为"检索快照"，task-start 改语义）
- 新逻辑：task 启动时不再触发采集（采集已统一），仅保存检索条件 + 触发 annotation 回填确保历史数据已打标

### 5.4 `src/inngest/functions/research/whitelist-crawl.ts`

A1 Phase 0 完整 stub 化。

**A3 改造**：**直接删除**（白名单爬取已迁到 Collection Hub list_scraper Adapter）。

### 5.5 `src/lib/research/article-ingest.ts`

A1 Phase 0 stub 了 outlet matcher 调用。

**A3 改造**：评估是否整体删除（研究模块不再有独立 ingest 概念，所有入库走 Collection Hub Writer）。

---

## 6. Inngest 函数清理清单

| # | 文件 | A3 决策 | 理由 |
|---|---|---|---|
| 1 | `src/inngest/functions/research/tavily-crawl.ts` | **删除** | A1 Phase 0 已 stub，A3 整体清理 — Tavily 走 Collection Hub tavily Adapter |
| 2 | `src/inngest/functions/research/whitelist-crawl.ts` | **删除** | 同上 — 走 list_scraper Adapter |
| 3 | `src/inngest/functions/research/manual-url-ingest.ts` | **删除** | 同上 — 走 jina_url Adapter |
| 4 | `src/inngest/functions/research/article-content-fetch.ts` | **删除** | research 专用正文异步拉取，collected_items 入库时 content 已含；不需要 |
| 5 | `src/inngest/functions/research/bridge-backfill.ts` | **保留** | 经 sub-spec reviewer 确认：触发事件 `research/bridge.backfill.trigger`，是 Collection Hub bridge 回填（把已有 collected_items 反向桥接为 research 数据视图），与 A3 新的 annotation 回填（`research/backfill-annotate.requested`）是两个独立链路，功能不冲突 |
| 6 | `src/inngest/functions/research/task-start.ts` | **重写** | 研究任务概念保留为"检索快照"，task-start 改语义不再触发采集 |
| 7 | `src/inngest/functions/research/annotate-collected-item.ts` | **新增** | 订阅 collection/item.created 自动打标 |
| 8 | `src/inngest/functions/research/backfill-annotate.ts` | **新增** | 一次性批量回填历史数据 |

最终：`src/inngest/functions/research/` 从 7 个文件 → 3-4 个文件（task-start + annotate + backfill + index）

---

## 7. DAL / Server Actions 重构

### 7.1 删除文件

- `src/lib/dal/research/news-article-search.ts` （现在已 stub，A3 完整删）
- `src/app/actions/research/article-search.ts`（看是否被 UI 调用，删除前先改导出名）

### 7.2 新建文件

- `src/lib/dal/research/collected-item-search.ts`：基础检索查 collected_items + join annotation
- `src/app/actions/research/collected-item-search.ts`（如还需要 server action 形式）

### 7.3 修改文件

- `src/lib/dal/research/research-tasks.ts`：移除对 newsArticles 的引用；改为关联 collected_items + annotation
- `src/app/actions/research/research-tasks.ts`：同上

### 7.4 collected-item-search 接口

```ts
export interface CollectedItemSearchFilter {
  // 基础字段（A1 加的）
  outletTier?: string | "unclassified";
  outletId?: string;
  outletRegion?: string;
  contentType?: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  // research 专属（join annotation 表）
  topicIds?: string[];
  districtIds?: string[];
  // 字段限定 + 关键词（A4 高级检索的简版）
  titleKeyword?: string;
  contentKeyword?: string;
}

export async function searchCollectedItemsForResearch(
  orgId: string,
  filter: CollectedItemSearchFilter,
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  // ...
}
```

---

## 8. 工期分解（5 phase）

| Phase | 工期 | 关键产出 |
|---|---|---|
| Phase 1 Schema | 0.5-1 天 | DROP 2 老表 + CREATE 2 annotation 表 + migration |
| Phase 2 DAL + Actions | 1 天 | collected-item-search DAL + 重写 server actions |
| Phase 3 Annotate Inngest | 1 天 | annotate-collected-item + backfill-annotate Inngest 函数 + topic/district matcher 单测 |
| Phase 4 UI 解 stub | 0.5-1 天 | research/page.tsx + search-workbench + admin/tasks 重新接通 |
| Phase 5 Cleanup + 测试 | 0.5 天 | 删 6 个旧 inngest 函数 + 集成测试 + tsc/lint/build + final commit |
| **合计** | **3.5-4.5 天** | A3 完工 |

---

## 9. 验收标准

### 9.1 功能验收

- [ ] research_news_articles + research_news_article_topic_hits 两张表已 DROP
- [ ] research_collected_item_topics + research_collected_item_districts 两张新表创建
- [ ] 写入一条 collected_items（含 title 含"长江生态" + content 含"涪陵"）→ Inngest 自动打标 → annotation 表有对应 topic + district 记录
- [ ] research/page.tsx 能加载 collected_items 数据（按 outlet_tier 聚合）
- [ ] search-workbench-client 能按 topic + district + outlet_tier 筛选
- [ ] 触发 backfill-annotate → 历史 collected_items 被批量打标
- [ ] 6 个 research 自采 inngest 函数已删除（grep 验证）

### 9.2 性能验收

- [ ] annotate-collected-item 单条命中 ≤ 200 ms（含字典加载缓存）
- [ ] backfill-annotate 处理 1 万条 ≤ 15 分钟

### 9.3 数据正确性

- [ ] tsc --noEmit 0 错
- [ ] npm run build 通过
- [ ] DAL 单测通过（collected-item-search）
- [ ] matcher 单测通过（topic-matcher + district-matcher）
- [ ] writer 集成测试增强（写入采集项 → 自动触发 annotate → annotation 表有记录）

### 9.4 Phase 0 stub 解开验收

- [ ] research/page.tsx 不再返回空数据 / 占位
- [ ] search-workbench-client outlet 字段筛选 UI 启用
- [ ] task-start.ts 不再 stub（重写或删除）
- [ ] whitelist-crawl.ts 已删
- [ ] article-ingest.ts 已删或重写

---

## 10. 留待 plan 阶段细化的开放问题

| # | 问题 | 解决时机 |
|---|---|---|
| 1 | DISTRICT_VARIANTS 字典覆盖（"涪陵区" / "涪陵县" / "涪陵" 等历史称谓） | Phase 3 Day 1 调研 |
| 2 | research_tasks 表的 schema 改造（移除 firstSeenResearchTaskId 引用 / 加 search_snapshot 字段挂检索快照） | Phase 2 Day 1 |
| 3 | bridge-backfill.ts 是否被 collection-bridge 调用（需确认引用） | Phase 5 Day 1 |
| 4 | research-tasks 现有 server action / UI 是否需要保留管理页 | Phase 4 Day 1 |
| 5 | Inngest collection/item.created 事件 payload 现有结构（要不要扩展含 organizationId） | Phase 3 Day 1 |
| 6 | `newsSourceChannelEnum` / `topicMatchTypeEnum` / `researchEmbeddingStatusEnum` 哪些可以 DROP | Phase 1 Day 1 |
| 7 | annotate Inngest 函数的 concurrency 限制（避免 collected_items 高峰时打标排队） | Phase 3 Day 1 |
| 8 | 历史回填的进度可视化（V1 写日志即可，V2 加监控页面） | Phase 3 Day 1 |

---

## 11. 进入下一步

本 sub-spec 通过后：

1. **本 sub-spec → spec-document-reviewer 审查**
2. **审查通过 → 用户最终 approve**
3. **进入 A3 implementation plan**（用 `superpowers:writing-plans`）
4. **plan 通过 review → subagent-driven-development 执行**（5 phase）
5. **commit + 整 A3 final review → 进 A4 高级检索 sub-brainstorm**
