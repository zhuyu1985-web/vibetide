# 热榜采集 → 新闻研究工作台桥接设计

- Date: 2026-04-21
- Author: zhuyu
- Status: Draft (pending review)
- Related: `docs/superpowers/specs/2026-04-14-news-research-module-design.md`, `docs/superpowers/plans/2026-04-21-news-research-s2-crawl.md`

## 背景

Vibetide 当前有两条**完全独立**的采集链路，写入不同的表：

| 链路 | 数据源 | 目标表 | 消费者 |
|---|---|---|---|
| **热榜采集** | `__system_hot_topic_crawler__`、微博等 collection-hub 源 | `collected_items` → `hot_topics`（经 `bridge-hot-topic.ts`） | 首页、灵感池 |
| **研究采集** | Tavily 全网搜索 / 白名单爬取 / 手工 URL | `research_news_articles`（经 `src/lib/research/article-ingest.ts`） | 新闻研究工作台 |

**问题**：新闻研究工作台 (`/research`) 的 DAL (`src/lib/dal/research/news-article-search.ts`) 只查 `research_news_articles`。用户已经在 collection-hub 里配置了 `__system_hot_topic_crawler__` 和微博数据源，采集到的数据进了 `collected_items` / `hot_topics`，但**研究工作台查不到**——因为两个表之间没有桥接。

## 目标

让已经配置的 collection-hub 源（按源级别的 flag 控制）采集到的数据，自动桥接到 `research_news_articles`，供新闻研究工作台的关键字检索和媒体层级分析使用。

## 非目标

- ❌ 语义检索 / embedding 回填（S3 之后的范围，当前维持 `embedding_status='pending'` 不影响关键字检索）
- ❌ 热榜数据的 AI 分析 / 标注
- ❌ UI 把"热榜"数据标成次级结果样式
- ❌ 正文清洗（广告剥离等，依赖 Jina Reader 自身清洗能力）

## 总体架构

```
collected_items (采集暂存，已存在)
      │
      ├─▶ hot-topic-bridge  ─────────▶ hot_topics            (已有链路)
      │
      └─▶ research-bridge   ─────────▶ research_news_articles (新, content=null)
                                              │
                                              ▼
                                   research/article.content-fetch 事件
                                              │
                                              ▼
                                    content-fetch function
                                    （Jina Reader 拉正文回填）
                                              │
                                              ▼
                                    research_news_articles.content ← 填充
```

**三步解耦**：
1. `research-bridge.ts`（新）— 订阅已有的 `collection/item.ingested` 事件；flag 开启的源才桥接；写入 `research_news_articles` 后发下一步事件
2. `research-article-content-fetch.ts`（新）— 消费 content-fetch 事件，调 Jina Reader 拉正文，带并发限速 + 失败重试
3. `research-bridge-backfill.ts`（新）— 一次性扫描存量 `collected_items`，分批重发 `collection/item.ingested` 复用 bridge 函数

**错误边界**：bridge 步骤失败不影响 hot-topic-bridge；content-fetch 失败只影响单条；backfill 失败可重跑（upsert 幂等）。

## 设计决策（已和 PM 对齐）

| # | 决策点 | 方案 | 理由 |
|---|---|---|---|
| 1 | 正文获取 | **异步**（Inngest `research/article.content-fetch`） | 同步拉正文会拖慢采集；"不拉正文"则全文检索对热榜无效 |
| 2 | sourceChannel | `newsSourceChannelEnum` 扩展 `hot_topic_crawler` | 语义清晰；UI 筛选器可按渠道区分 |
| 3 | outlet/tier | `mediaTierEnum` 扩展 `self_media` + URL 匹配不上时回落 | 让媒体层级筛选器对热榜数据可用，而非全 null |
| 4 | 触发时机 | 独立 Inngest 函数挂到现有 `collection/item.ingested` 事件 | 跟现有模式一致；两条桥接彼此解耦 |
| 5 | 数据范围 | `collection_sources` 加 `research_bridge_enabled` flag | 避免低质量源污染研究库；未来扩展源零代码 |
| 6 | 历史回溯 | 部署后一次性 backfill（分批 50/批） | 用户历史采集投入不浪费 |

## Schema 变更

四条 SQL 一次迁移完成（注意 enum ADD VALUE 不能在同一 transaction 执行多个，Drizzle 可能要拆文件）：

### A. `newsSourceChannelEnum` 新增 `hot_topic_crawler`
```sql
ALTER TYPE research_news_source_channel ADD VALUE 'hot_topic_crawler';
```

### B. `mediaTierEnum` 新增 `self_media`
```sql
ALTER TYPE research_media_tier ADD VALUE 'self_media';
```

### C. `collection_sources` 加 flag
```sql
ALTER TABLE collection_sources
  ADD COLUMN research_bridge_enabled boolean NOT NULL DEFAULT false;
```

### D. `research_news_articles` 加 `content_fetch_status`
```sql
ALTER TABLE research_news_articles
  ADD COLUMN content_fetch_status text NOT NULL DEFAULT 'pending';

-- 已有 content 的行直接标 done（Tavily/whitelist/manual 采集的）
UPDATE research_news_articles SET content_fetch_status = 'done' WHERE content IS NOT NULL;
```

`content_fetch_status` 取值：`pending | fetching | done | failed | skipped`。

## 字段映射：`collected_items` → `research_news_articles`

| 目标字段 | 来源 / 规则 |
|---|---|
| `url` | `collected_items.url` |
| `url_hash` | `hashUrl(url)` — 复用 `src/lib/research/url-hash.ts` |
| `title` | `collected_items.title` |
| `content` | **null** — 由 content-fetch 异步填充 |
| `published_at` | `collected_items.publishedAt` ?? `collected_items.capturedAt` |
| `outlet_id` | `matchOutletForUrl()`；热榜大概率 null |
| `outlet_tier_snapshot` | outlet 匹配上 → 真实 tier；否则 **`self_media`** |
| `district_id_snapshot` | 随 outlet 匹配；不匹配则 null |
| `source_channel` | **`hot_topic_crawler`** |
| `crawled_at` | `collected_items.capturedAt` |
| `embedding` / `embedding_status` | null / `pending`（不在本 spec 范围） |
| `raw_metadata` | `{ collectedItemId, sourceChannels, platforms, bridgeVersion: 'v1' }` |
| `first_seen_research_task_id` | null |
| `content_fetch_status` | `pending` |

**去重**：`url_hash` unique index + `onConflictDoNothing`（复用现有 `ingestArticle`）。同一 URL 即使被 Tavily 研究任务和热榜桥接双重触达，第二次 insert 什么都不做——保留最早的 `source_channel`（"首次入库来源"语义）。

## Inngest 函数规格

### ① `research-bridge.ts`
- **事件**：`collection/item.ingested`（已有）
- **步骤**：
  1. `step.run("load-item")` — 查 `collected_items` + `collection_sources`
  2. `step.run("check-flag")` — `research_bridge_enabled !== true` → return `{ skipped: true }`
  3. `step.run("ingest")` — 走 `ingestArticle()`，拿到 `{ articleId, inserted }`
  4. `step.run("fire-content-fetch")` — 仅当 `inserted === true` 时发 `research/article.content-fetch`

### ② `research-article-content-fetch.ts`
- **事件**：`research/article.content-fetch`（新增）
- **并发**：`concurrency: { limit: 3 }`
- **重试**：`retries: 3`，全部失败走 `onFailure`
- **步骤**：
  1. `step.run("mark-fetching")` — `content_fetch_status = 'fetching'`
  2. `step.run("fetch-via-jina")` — 调 `src/lib/web-fetch.ts` Jina Reader；失败 throw 让 Inngest retry
  3. `step.run("update-article")` — 写 `content` + `content_fetch_status='done'`
- **onFailure**：标 `content_fetch_status='failed'` + `raw_metadata.contentFetchError`

### ③ `research-bridge-backfill.ts`
- **事件**：`research/bridge.backfill.trigger`（新增）
- **步骤**：
  1. 扫描 `collected_items`（JOIN `collection_sources` 过滤 `research_bridge_enabled=true`），筛选未桥接的（`raw_metadata.researchArticleId` 未设置）
  2. 分批 50 条/批，每批 `step.sendEvent` 发一组 `collection/item.ingested` 事件
  3. Inngest 自动队列限速

### `inngestEvents.ts` 新增事件类型
```ts
"research/article.content-fetch": { articleId: string; url: string };
"research/bridge.backfill.trigger": { organizationId?: string; limit?: number };
```

## UI 改动

### 1. `/research` 工作台搜索筛选器
文件：`src/app/(dashboard)/research/search-workbench-client.tsx`
- `CHANNEL_OPTIONS` 加 `{ value: "hot_topic_crawler", label: "热榜采集" }`
- `CHANNEL_LABELS` 同步加条
- `TIER_OPTIONS` 加 `{ value: "self_media", label: "自媒体/热榜" }`
- `TIER_BADGE_CLASS[self_media]`：`bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400`

### 2. 列表空字段兜底
DAL `searchNewsArticles` 返回值增加 `platformFallback`（从 `raw_metadata.platforms[0]` 取）；列表"媒体名"列 outletName 为 null 时显示 platformFallback。

### 3. `/collection-hub/settings` 源编辑表单
加一个 Checkbox：
- Label：「同步到研究工作台」
- 描述：「勾选后，该源采集到的数据会自动进入新闻研究工作台，供全文检索和媒体层级分析使用」
- 绑定 `researchBridgeEnabled`

### 4. 其他页面 tier label 同步
`task-detail-client.tsx` / `media-outlets-client.tsx` 的 `TIER_LABELS` + `TIER_BADGE_CLASS` 一并加 `self_media`，避免新 tier 出现时 UI 崩坏。

**注意**：`new-task-client.tsx` 的 `TIERS` 常量**不加** `self_media`，因为研究任务创建时不会主动采集自媒体（自媒体由热榜链路进来），避免用户勾选后产生歧义。

## 测试

### 单元测试（vitest）
- `research-bridge.test.ts` — mock collected_item + flag 开/关两种情形，断言 insert / skip
- `content-fetch.test.ts` — mock Jina Reader 返回成功 / 超时 / 429，断言状态转移
- `url-hash.test.ts` — 已有
- `outlet-matcher.test.ts` — 增加"URL 匹配不到时回落 null"断言

### 集成测试
- `backfill.test.ts` — 插入 10 条 collected_items，触发 backfill，断言全部进入 `research_news_articles` 且 `content_fetch_status='pending'`

### 手测清单
1. 跑 seed 或手工 UPDATE，把 `__system_hot_topic_crawler__` + 微博源的 flag 设为 true
2. 触发一次热榜采集，进 DB 验 `research_news_articles` 多了 N 行、`content_fetch_status=pending`
3. 等 content-fetch Inngest 函数跑完，验 `content` 非空、`content_fetch_status=done`
4. 到 `/research`，筛选"采集来源=热榜采集"、"媒体层级=自媒体/热榜"，能看到数据
5. 到 `/collection-hub/settings` 建一个新源，不勾选 flag，跑采集，验 `research_news_articles` 没多行

## 上线顺序

1. **DB migration**（`npm run db:generate` + 手工校验 enum ADD VALUE 拆文件）
2. 部署代码（bridge + content-fetch + backfill 函数，但 backfill 不自动触发）
3. 把 `__system_hot_topic_crawler__` + 已有微博源的 flag 手动打开（UPDATE SQL）
4. 触发一次 backfill：
   ```ts
   await inngest.send({
     name: "research/bridge.backfill.trigger",
     data: { organizationId: "<org>" },
   });
   ```
5. 监控 Inngest dashboard 观察 content-fetch 队列进度和失败率
6. 首屏看到数据后确认问题解决

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Jina Reader 配额耗尽 | content-fetch 并发限制 3；backfill 分批 50/批；失败状态可追查重跑 |
| enum ADD VALUE 迁移失败 | Drizzle migration 拆文件；先在本地 `db:push` 验证 |
| 热榜 URL 过期失效 | content-fetch 失败归类 `failed`，不阻塞其它；UI 展示时对失败记录可选过滤 |
| 同 URL 多源触达 | `urlHash` unique + `onConflictDoNothing`，保留首次来源 |
| backfill 量过大 | 分批发 event；Inngest 自身队列限流；极端情况下可手工只跑指定 orgId |

## 影响面清单

**新增文件**
- `src/inngest/functions/collection/research-bridge.ts`
- `src/inngest/functions/research/article-content-fetch.ts`
- `src/inngest/functions/research/bridge-backfill.ts`
- `src/lib/collection/__tests__/research-bridge.test.ts`
- `src/lib/research/__tests__/content-fetch.test.ts`
- Drizzle migration 文件（enum ADD VALUE + column ADD）

**修改文件**
- `src/db/schema/research/enums.ts`（enum 扩值）
- `src/db/schema/research/news-articles.ts`（加 `contentFetchStatus`）
- `src/db/schema/collection.ts`（加 `researchBridgeEnabled`）
- `src/lib/dal/research/news-article-search.ts`（返回 `platformFallback`）
- `src/app/(dashboard)/research/search-workbench-client.tsx`（新 CHANNEL / TIER 选项、空字段兜底）
- `src/app/(dashboard)/research/admin/tasks/[id]/task-detail-client.tsx`（tier label/badge 同步）
- `src/app/(dashboard)/research/admin/media-outlets/media-outlets-client.tsx`（tier label/badge 同步）
- `src/lib/collection/seed-system-sources.ts`（seed 时 flag=true）
- `/collection-hub/settings` 源编辑表单组件（Checkbox）
- `src/inngest/client.ts` 或对应事件类型定义（新增事件类型）
- `src/inngest/index.ts`（注册新函数）
