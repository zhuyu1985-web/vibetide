# 统一数据采集模块（Collection Hub）设计文档

**状态**：Brainstorming 完成，待生成实施计划
**日期**：2026-04-18
**分支**：`feature/genspark-redesign-phase1`（新模块将在此基础上开分支）
**作者**：Zhuyu（产品） + Claude（技术方案）

---

## 1. 背景

Vibetide 代码库扫描发现 **9 个数据采集/检索入口**散落在各模块：

1. 热榜 cron（`hot-topic-crawl`，TopHub 聚合）
2. 对标抓取 cron（`benchmarking-crawl`，Tavily + `site:` 过滤）
3. 研究任务 Tavily 分支（`research/tavily-crawl`）
4. 研究任务 白名单列表（`research/whitelist-crawl`，Jina + 正则）
5. 研究任务 手工 URL（`research/manual-url-ingest`，Jina 单 URL）
6. 灵感池 SSE 触发（`api/inspiration/crawl`，包装 TopHub）
7. 知识库 URL 入库（`knowledge-bases` action，Jina 单 URL）
8. 热榜富化（`hot-topic-enrichment`，LLM 下游消费者，不是采集器）
9. Agent 工具搜索（对话态临时 Tavily 调用，不落盘）

其中 **第 1-7 是真正的采集器**（共 7 个），**第 8 是下游消费者**，**第 9 因是对话态临时查询不落盘**。

每个采集入口各自实现抓取、重试、去重、日志——导致：

- **3 套不同的去重哈希方案**共存（标题 MD5 / URL MD5 / title+url MD5）
- **重试策略各写各的**（热榜无重试，研究任务 2 次线性退避，对标完全没有）
- **4 张领域表各自存储**（`hot_topics` / `news_articles` / `platform_content` / `knowledge_items`），字段不互通
- **只有热榜有抓取日志表**，其他入口错误静默吞掉
- **无统一限流 / 熔断 / 告警**
- **运营 / 编辑无法自助添加新源**——任何新站点监控都要改代码

同时，随着"同题漏题"、"新闻研究（39 地市 × 16 主题）"、"知识库"等模块在持续扩充，重复劳动会越来越严重。

## 2. 目标

本模块要同时解决 **技术架构问题** 和 **产品能力问题**。

### 2.1 技术目标（架构去重）
- 所有采集入口收敛到统一的 `SourceAdapter` 接口 + `FetchLayer` + `Writer` 管道
- 统一的去重、重试、限流、日志基础设施
- 事件驱动的下游派生，新模块零侵入接入

### 2.2 产品目标（运营自助）
- 运营 / 编辑可以在管理后台自助完成：
  - 添加任意来源（站点 / RSS / 聚合榜单 / 关键词搜索）
  - 配置采集频率、目标分类、归属业务模块
  - 在**一个地方**看到所有采集到的内容
  - 多维度筛选、搜索、跳转到下游模块
  - 查看采集成功率、错误明细、趋势

## 3. 范围与非目标

### V1 范围
- 5 种源类型（Adapter）：TopHub 聚合榜单、Tavily 关键词搜索、Jina 单 URL 深读、列表页抓取（正则+CSS 选择器二选一）、RSS/Atom 订阅
- 新 `collected_items` 原始池 + `collection_sources` / `collection_runs` / `collection_logs`
- **7 个采集器全部改造成 Adapter**（灵感池 / 热榜 cron / 对标 / 研究任务 3 分支 / 知识库 URL）
- **热榜富化（第 8 个入口）改造为订阅 `collection/item.created` 事件**（不是采集器但需要适配）
- 运营后台 3 个页面：源管理、内容浏览、监控面板
- Trigram 全文搜索（启用 PostgreSQL 内置的 `pg_trgm` 扩展，Supabase 原生支持；相比 `pg_jieba` / `pgroonga` 等中文分词扩展，`pg_trgm` 无需申请、迁移脚本直接 `CREATE EXTENSION` 即可）
- 内容浏览卡片 + 表格双视图

### 非目标（V2 及以后）
- **原生平台深抓**（微信公众号 / 微博账号 / 抖音 / 小红书的账号级内容）—— Phase B，需单独立项
- 新建源向导的"试运行预览"（`preview()`）
- 分类/标签的自助管理后台（V1 分类编码预置）
- "我的订阅"式个性化推送
- 跨租户共享源库
- **Agent 对话工具里的 Tavily 搜索（第 9 个入口）** —— 对话态临时查询，不落盘无运营价值，不接入此模块
- 中文分词全文搜索（V1 用 trigram，效果一般；V2 评估 `pgroonga` 或应用层倒排）

## 4. 已确认决策

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 项目目标 | 架构去重 + 运营自助后台 | 用户明确两个目标并重 |
| 2 | 数据模型 | 原始池 `collected_items` + 领域派生表通过 FK 引用 | 兼顾解耦和平滑迁移，领域业务逻辑零重写 |
| 3 | V1 源类型 | TopHub / Tavily / Jina URL / list_scraper / RSS | 覆盖 80% 运营自助添加源的场景 |
| 4 | V1 后台页面 | 源管理 + 内容浏览 + 监控面板 | 去掉 taxonomy 管理（V2 再做） |
| 5 | 写入时机 | 混合：轻派生同事务，重加工事件驱动 | 简单场景保持原子性，LLM/向量化异步解耦 |
| 6 | 迁移策略 | 绞杀者模式，V1 内全部迁完 | 风险可控，阶段性验证 |
| 7 | 去重策略 | 内容指纹（标题归一化+24h 桶） + URL 归一化辅助，区分首抓源 | 真正"一条新闻显示一次"，并保留来源轨迹 |
| 8 | Adapter 契约 | 插件式（Zod config schema + 声明式表单字段） | V2 接原生平台时零框架改动 |
| 9 | 事件总线 | 复用现有 Inngest | 避免新依赖 |
| 10 | 列表抓取 | `list_scraper` 合并正则/CSS 选择器两种模式 | 减少 Adapter 数量 |
| 11 | 预览 `preview()` | V2 | 节省 3-4 天工期 |
| 12 | 内容浏览视图 | V1 卡片 + 表格双视图 | 运营两种使用场景都有 |
| 13 | 全文搜索 | Trigram（`pg_trgm`） | 避免 `zhparser` 扩展依赖 |

## 5. 架构总览

```
┌────────────────────────────────────────────────────────────────────┐
│                      数据采集统一模块（Collection Hub）               │
│                                                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  源注册表     │──▶│ 调度器        │──▶│  Collector 执行器      │  │
│  │ collection_  │   │ (Inngest     │   │   ┌──────────────┐   │  │
│  │ sources      │   │  cron+event) │   │   │ Adapter      │   │  │
│  └──────────────┘   └──────────────┘   │   │  Registry    │   │  │
│                                         │   └──────────────┘   │  │
│  ┌──────────────┐                       │        ↓            │  │
│  │  配置 UI      │                       │   ┌──────────────┐   │  │
│  │ /data-       │                       │   │ FetchLayer   │   │  │
│  │ collection/* │                       │   │ (retry/rate/ │   │  │
│  └──────────────┘                       │   │  timeout)    │   │  │
│                                         │   └──────────────┘   │  │
│                                         └──────────┬───────────┘  │
│                                                    ▼              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Normalizer → Deduper → Writer                              │  │
│  │  (归一化→指纹→合并/插入)                                        │  │
│  └────────────────────┬────────────────────────────────────────┘  │
│                       ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │   collected_items  (原始采集池)                                │ │
│  │   + collection_runs (每次抓取运行日志)                          │ │
│  │   + collection_logs (细粒度错误/告警)                           │ │
│  └────────────────────┬─────────────────────────────────────────┘ │
└──────────────────────│─────────────────────────────────────────────┘
                       │ emit 'collection/item.created' 事件
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  下游领域消费方                                                     │
│                                                                  │
│  轻派生（同事务双写，Writer 直接调）：                                │
│    └─→ news_articles (研究 / 白名单 / 手工 URL)                    │
│    └─→ platform_content (对标)                                   │
│                                                                  │
│  重加工（订阅事件，异步派生）：                                       │
│    └─→ hot_topics (热点，LLM 富化)                                │
│    └─→ knowledge_items (KB，分块+向量化)                          │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 核心组件职责

- **源注册表 `collection_sources`**：所有采集源配置的 SSOT，多租户隔离
- **调度器**：Inngest cron 定时触发；手工触发走 Server Action；支持事件触发（研究任务式）
- **Adapter Registry**：5 种源类型各实现统一接口；新增源类型只需写一个 Adapter + 注册
- **FetchLayer**：抽出重试 / 超时 / 限流 / UA 轮转，所有 Adapter 共享
- **Normalizer → Deduper → Writer**：采集结果→归一化字段→指纹合并→入池
- **事件总线**：重派生模块通过 Inngest 订阅 `collection/item.created` 异步消费

### 5.2 关键设计原则
- 一条内容合并到既有 item 时，新源 append 到 `source_channels[]`，**不重复发事件**（避免下游重复富化）
- `collection_runs` 每次运行写一条，记录首抓计数 / 合并计数 / 失败计数分别的
- 旧的领域表写入逻辑尽量保留（通过 `collected_item_id` 外键桥接）

## 6. 数据模型

### 6.1 表结构（Drizzle schema 形态）

```ts
// src/db/schema/collection.ts

export const collectionSources = pgTable("collection_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),   // "tophub" | "tavily" | "jina_url" | "list_scraper" | "rss"
  config: jsonb("config").notNull(),             // type-specific, Zod-validated
  scheduleCron: text("schedule_cron"),           // null = 仅手工触发
  scheduleMinIntervalSeconds: integer("schedule_min_interval_seconds"),
  targetModules: text("target_modules").array().notNull().default([]),
  defaultCategory: text("default_category"),
  defaultTags: text("default_tags").array(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // 统计冗余字段（由 Writer 事务更新）
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunStatus: text("last_run_status"),       // "success" | "partial" | "failed"
  totalItemsCollected: bigint("total_items_collected", { mode: "number" }).notNull().default(0),
  totalRuns: bigint("total_runs", { mode: "number" }).notNull().default(0),
}, (t) => ({
  uniqueOrgName: unique().on(t.organizationId, t.name),
  enabledIdx: index("idx_sources_org_enabled").on(t.organizationId, t.enabled),
  cronIdx: index("idx_sources_cron").on(t.scheduleCron).where(sql`enabled = true`),
}));

export const collectedItems = pgTable("collected_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),

  // 去重键
  contentFingerprint: text("content_fingerprint").notNull(),   // MD5(titleNorm + date_bucket_24h)
  canonicalUrl: text("canonical_url"),
  canonicalUrlHash: text("canonical_url_hash"),

  // 内容字段
  title: text("title").notNull(),
  content: text("content"),
  summary: text("summary"),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  // 源轨迹
  firstSeenSourceId: uuid("first_seen_source_id").references(() => collectionSources.id),
  firstSeenChannel: text("first_seen_channel").notNull(),       // "tophub/weibo" | "rss/36kr"
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  sourceChannels: jsonb("source_channels").notNull().default([]), // [{channel, url, capturedAt, sourceId, runId}]

  // 分类
  category: text("category"),
  tags: text("tags").array(),
  language: text("language"),

  // 归属模块
  derivedModules: text("derived_modules").array().notNull().default([]),

  // 长尾元数据
  rawMetadata: jsonb("raw_metadata"),

  // 状态
  enrichmentStatus: text("enrichment_status").notNull().default("pending"), // pending | enriched | failed

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueFingerprint: unique().on(t.organizationId, t.contentFingerprint),
  pubIdx: index("idx_items_org_pub").on(t.organizationId, t.publishedAt.desc()),
  urlHashIdx: index("idx_items_url_hash").on(t.canonicalUrlHash).where(sql`canonical_url_hash IS NOT NULL`),
  categoryIdx: index("idx_items_category").on(t.organizationId, t.category),
  tagsIdx: index("idx_items_tags").using("gin", t.tags),
  derivedIdx: index("idx_items_derived").using("gin", t.derivedModules),
  // 全文搜索走 pg_trgm GIN 索引,直接在 title/content 列上(无需 tsvector 生成列)
  trigramTitleIdx: index("idx_items_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
  trigramContentIdx: index("idx_items_content_trgm").using("gin", sql`${t.content} gin_trgm_ops`),
}));

// 必须的 migration 前置步骤(单独一条 migration,先于 collected_items 表创建):
//   CREATE EXTENSION IF NOT EXISTS pg_trgm;
// Supabase 原生支持该扩展,无需申请;本地开发环境同样内置。

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => collectionSources.id),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  trigger: text("trigger").notNull(),           // "cron" | "manual" | "event"
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),              // "running" | "success" | "partial" | "failed"
  itemsAttempted: integer("items_attempted").notNull().default(0),
  itemsInserted: integer("items_inserted").notNull().default(0),
  itemsMerged: integer("items_merged").notNull().default(0),
  itemsFailed: integer("items_failed").notNull().default(0),
  errorSummary: text("error_summary"),
  metadata: jsonb("metadata"),
}, (t) => ({
  sourceStartedIdx: index("idx_runs_source_started").on(t.sourceId, t.startedAt.desc()),
}));

export const collectionLogs = pgTable("collection_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: uuid("run_id").notNull().references(() => collectionRuns.id),
  sourceId: uuid("source_id").notNull().references(() => collectionSources.id),
  level: text("level").notNull(),                // "info" | "warn" | "error"
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  runLoggedIdx: index("idx_logs_run_logged").on(t.runId, t.loggedAt.desc()),
}));
```

### 6.2 领域派生表改造
既有 4 张领域表各加一列：
```sql
ALTER TABLE hot_topics ADD COLUMN collected_item_id UUID REFERENCES collected_items(id);
ALTER TABLE news_articles ADD COLUMN collected_item_id UUID REFERENCES collected_items(id);
ALTER TABLE platform_content ADD COLUMN collected_item_id UUID REFERENCES collected_items(id);
ALTER TABLE knowledge_items ADD COLUMN collected_item_id UUID REFERENCES collected_items(id);
CREATE INDEX idx_hot_topics_ci ON hot_topics(collected_item_id);
-- 同样给其他 3 张加索引
```

迁移期间，旧入口已写入的历史数据回填 `collected_item_id`（Phase 5 完成）。

### 6.3 去重策略

- **辅助指纹**：`canonical_url_hash = MD5(normalize_url(url))` — 当 `url` 存在时
  - `normalize_url` = 去掉 `utm_*` / `fbclid` 等常见跟踪参数、去 fragment、统一 http→https、去尾部斜杠
- **主指纹**：`content_fingerprint = MD5(normalize_title(title) + date_bucket)`
  - `normalize_title` = 去标点、繁简转简体、去空白、小写
  - `date_bucket` 取值规则：
    - 若 `publishedAt` 非空 → `date_bucket = UTC 当天 0 点 epoch`（24h 桶）
    - **若 `publishedAt` 为空 → `date_bucket = 以 captured_at 为中心的 7d 桶**（`floor(captured_at_epoch / 7d) * 7d`）**，缓解跨日边界和缺省发布时间场景下的误分裂**
- **合并逻辑**（Writer 内按顺序）：
  1. 若 `canonical_url_hash` 非空 → 按 URL 哈希查找，有 → 合并并 return
  2. 否则按 `content_fingerprint` 查找，有 → 合并并 return
  3. 都无 → 插入新记录，标记 `first_seen_*`
- **事务内用 `FOR UPDATE`** 防并发冲突
- **安全阀**：若单个 `content_fingerprint` 被合并次数 > 50（7 天内），触发告警 — 归一化规则过激的早期信号

## 7. Adapter 契约

### 7.1 接口定义
```ts
// src/lib/collection/adapters/types.ts

export interface SourceAdapter<TConfig = unknown> {
  readonly type: string;                    // "tophub" | "rss" | ...
  readonly displayName: string;
  readonly description: string;
  readonly category: "aggregator"|"search"|"url"|"list"|"feed";
  readonly configSchema: z.ZodType<TConfig>;
  readonly configFields: ConfigField[];     // 后台表单声明

  execute(ctx: AdapterContext<TConfig>): Promise<AdapterResult>;
  preview?(config: TConfig): Promise<RawItem[]>;   // V2
}

export interface AdapterContext<TConfig> {
  config: TConfig;
  sourceId: string;
  organizationId: string;
  runId: string;
  log: (level: "info"|"warn"|"error", msg: string, meta?: Record<string, unknown>) => void;
}

export interface AdapterResult {
  items: RawItem[];
  partialFailures?: { message: string; meta?: Record<string, unknown> }[];
}

export interface RawItem {
  title: string;
  url?: string;
  content?: string;
  summary?: string;
  publishedAt?: Date;
  channel: string;
  rawMetadata?: Record<string, unknown>;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text"|"url"|"textarea"|"select"|"multiselect"|"number"|"boolean"|"kv";
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  validation?: { pattern?: string; min?: number; max?: number };
}
```

### 7.2 V1 五个 Adapter
| type | config 关键字段 | 典型调度 | channel 格式 |
|------|--------------|--------|-----------|
| `tophub` | `{ platforms: string[] }` | `0 * * * *` | `tophub/{platform}` |
| `tavily` | `{ keywords[], timeRange, includeDomains?[], maxResults }` | cron 或事件 | `tavily` |
| `jina_url` | `{ url }` | 手工 | `jina/{hostname}` |
| `list_scraper` | `{ listUrl, extractMode: "regex"\|"css", pattern?, selectors? }` | cron | `list/{hostname}` |
| `rss` | `{ feedUrl, fetchFullContent }` | cron 默认 30m | `rss/{hostname}` |

### 7.3 FetchLayer
```ts
// src/lib/collection/fetch-layer.ts
export async function fetchWithPolicy<T>(
  fn: () => Promise<T>,
  policy: {
    timeoutMs: number;      // 默认 10s
    maxAttempts: number;    // 默认 3
    backoff: "exponential"; // 默认指数退避
    baseDelayMs: number;    // 默认 500ms
    jitter: boolean;        // 默认 true
  },
  onAttempt?: (n: number, err?: Error) => void
): Promise<T>;
```
- 所有 Adapter 的外部调用必须通过 `fetchWithPolicy`
- `429` / `5xx` 重试；非 429 的 `4xx` 不重试
- 每次尝试记进 `collection_logs`

## 8. 写入流程

### 8.1 Writer 管道（核心伪代码）

> 注：以下是说明性伪代码，真实实现参考 Phase 0 的 `src/lib/collection/writer.ts`。

```ts
// src/lib/collection/writer.ts

type WriteOutcome = { itemId: string; isNew: boolean; merged: boolean };

async function writeItems({ runId, sourceId, organizationId, source, items }: WriteArgs) {
  let inserted = 0, merged = 0, failed = 0;

  for (const raw of items) {
    try {
      const { titleNorm, urlCanon } = normalize(raw);
      const urlHash = urlCanon ? md5(urlCanon) : null;
      const fingerprint = computeFingerprint(titleNorm, raw.publishedAt, /*capturedAt*/ new Date());

      const outcome: WriteOutcome = await db.transaction(async (tx) => {
        // 1. 先按 URL 查
        if (urlHash) {
          const byUrl = await tx.select().from(collectedItems)
            .where(and(eq(orgId, organizationId), eq(canonicalUrlHash, urlHash)))
            .forUpdate();
          if (byUrl) {
            await appendSourceChannel(tx, byUrl.id, { channel: raw.channel, url: raw.url, sourceId, runId });
            return { itemId: byUrl.id, isNew: false, merged: true };
          }
        }

        // 2. 再按指纹查
        const byFp = await tx.select().from(collectedItems)
          .where(and(eq(orgId, organizationId), eq(contentFingerprint, fingerprint)))
          .forUpdate();
        if (byFp) {
          await appendSourceChannel(tx, byFp.id, { channel: raw.channel, url: raw.url, sourceId, runId });
          return { itemId: byFp.id, isNew: false, merged: true };
        }

        // 3. 都无,插入新记录
        const newItem = await tx.insert(collectedItems).values({
          organizationId,
          title: raw.title,
          content: raw.content,
          summary: raw.summary,
          publishedAt: raw.publishedAt,
          contentFingerprint: fingerprint,
          canonicalUrl: urlCanon,
          canonicalUrlHash: urlHash,
          firstSeenSourceId: sourceId,
          firstSeenChannel: raw.channel,
          firstSeenAt: new Date(),
          sourceChannels: [{ channel: raw.channel, url: raw.url, sourceId, runId, capturedAt: new Date() }],
          category: source.defaultCategory,
          tags: source.defaultTags,
          rawMetadata: raw.rawMetadata,
        }).returning({ id: collectedItems.id });

        // 轻派生(同事务)
        for (const mod of source.targetModules) {
          if (mod === "news") await lightDeriveToNewsArticles(tx, newItem.id, raw);
          if (mod === "benchmarking") await lightDeriveToPlatformContent(tx, newItem.id, raw);
          // 注意:"hot_topics" 和 "knowledge" 是重加工,走事件
        }

        return { itemId: newItem.id, isNew: true, merged: false };
      });

      if (outcome.isNew) inserted++;
      if (outcome.merged) merged++;

      // 事务外发事件(只给新 item 发)
      if (outcome.isNew) {
        await inngest.send({
          name: "collection/item.created",
          data: { itemId: outcome.itemId, sourceId, organizationId, targetModules: source.targetModules },
        });
      }
    } catch (err) {
      failed++;
      await logError(runId, err, raw);
    }
  }

  return { inserted, merged, failed };
}
```

### 8.2 事件消费方

```ts
// src/inngest/functions/collection-subscribers/hot-topics.ts
export const enrichHotTopic = inngest.createFunction(
  { id: "collection-enrich-hot-topic", concurrency: { limit: 2 } },
  { event: "collection/item.created" },
  async ({ event }) => {
    if (!event.data.targetModules.includes("hot_topics")) return;
    // 1. 读 collected_items
    // 2. 调用 LLM 做富化(摘要/分类/aiScore/outlines/angles/sentiment)
    // 3. upsert hot_topics, 回填 collected_item_id
    // 4. 更新 collected_items.enrichment_status = "enriched"
  }
);

// src/inngest/functions/collection-subscribers/knowledge.ts
// 订阅相同事件,做分块 + Jina 向量化,写 knowledge_items
```

### 8.3 手工触发路径
运营在源管理页点"立即运行" → Server Action → 创建一条 `collection_runs` → Inngest 立即调用 Adapter.execute → Writer 入库。

## 9. 运营后台（`/data-collection/*`）

### 9.1 页面 1：源管理
- 列表：名称 / 类型 / 频率 / 归属模块 / 最近运行 / 状态 / 操作
- 筛选：源类型、状态、归属模块、分类
- 搜索：按名称
- 新建向导 4 步：类型 → 配置（`configFields` 自动渲染） → 调度+目标 → 保存
- 操作：手工触发、编辑、暂停/启用、删除、查看运行历史

### 9.2 页面 2：内容浏览
- 左侧筛选抽屉：源类型 / 平台 / 主题分类 / 时间（24h/7d/30d/自定义）/ 归属模块 / 富化状态
- 主区双视图切换：
  - **卡片视图**：标题、来源徽标、时间、标签、派生模块图标链接
  - **表格视图**：标题 / 首抓源 / 首抓时间 / 已派生到 / 分类 / 标签
- 顶部搜索框：trigram 全文（`title` + `content`）
- 点开详情右抽屉：
  - 原始 `raw_metadata`
  - `source_channels[]` 时间轴
  - 已派生到哪些领域表（带跳转链接到热点详情 / 研究详情 / 对标详情 / 知识库文档）
- 批量：导出 CSV、推送到模块

### 9.3 页面 3：监控面板
- 顶部 KPI：24h 采集量、成功率、活跃源 / 总源、错误数
- 采集量趋势（7d 折线）
- 来源分布（饼图）
- 源列表按错误数倒序（快速定位最差的源）
- 最近错误明细滚动列表

## 10. 迁移计划

### Phase 0：地基（1 周）✅ 完成 2026-04-18
- **独立 migration 脚本** 启用 `pg_trgm` 扩展（必须先于表创建）：`CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- 4 张新表 schema（含 trigram GIN 索引） + Drizzle 迁移
- `SourceAdapter` 接口 + Registry + 3 个基础 Adapter（TopHub / Tavily / Jina URL）
- `FetchLayer`（从 `src/lib/web-fetch.ts` 提取共享逻辑）
- `Writer` 管道 + 去重 + 事件发送
- Inngest 事件 `collection/item.created` 骨架 + smoke consumer

### Phase 1：源管理页 + 灵感池迁移（1 周）✅ 完成 2026-04-18
- 源管理页（列表 + 新建向导 + 基础筛选）
- 迁移 **灵感池 SSE** → `tophub` adapter 手工触发
- 验收：运营能在后台建一个 TopHub 源并触发
- 实际交付：`/data-collection/sources` 列表 + 4 步向导 + 详情页(3 tabs) + 暂停/删除/立即触发操作;灵感池 SSE 改为派发 `collection/source.run-requested` 事件(旧 hotTopicCrawlScheduler cron 保留避免回退,Phase 2 再完全切换)

### Phase 2：热榜 & 对标迁移（1 周）✅ 热榜部分完成 2026-04-18;**对标迁移推迟到 Phase 3**
- 迁移 **热榜 cron** → `tophub` adapter cron 调度 ✅ (`collectionHotTopicCron` 小时级 cron)
- 迁移 **对标抓取 cron** → `tavily` adapter + `site:` 过滤配置 ⏸️ (per-monitored-platform 架构复杂,留给 Phase 3 与调度器抽象一起做)
- 改造 **热榜富化** → 订阅 `collection/item.created` ✅ (`collectionHotTopicBridge` 桥接到 hot_topics 并重派发现有 `hot-topics/enrich-requested` 事件,保留 `hotTopicEnrichmentPipeline` 无改动)
- 验收：老的 `hot-topic-crawl.ts` 已移除 ✅;热榜页面数据不中断需手工验收（hot_topics.titleHash 走旧 `normalizeTitleKey` 公式保留去重兼容）

### Phase 3：list_scraper + RSS + 研究任务 3 分支（1.5 周）
- `list_scraper` Adapter（融合白名单列表 + CSS 选择器两种提取模式）
- `rss` Adapter
- 迁移研究任务 3 个分支（Tavily / 白名单 / 手工 URL）
- 验收：老的 `research/*-crawl.ts` 全部替换

### Phase 4：知识库 + 内容浏览/监控页（2 周）
- 迁移 **知识库 URL 入库** → `jina_url` adapter + `derived_modules=["knowledge"]`
- 改造 **KB 分块/向量化** → 订阅 `collection/item.created`
- 内容浏览页（双视图、筛选抽屉、详情抽屉、trigram 全文搜索）
- 监控面板（KPI / 趋势图 / 错误明细）

### Phase 5：清理 + 观察期（0.5-1 周）
- 删除已迁移的旧采集代码
- 新老并行数据流观察 1 周，对比记录数 ±5%
- 性能调优（索引、事件幂等性）
- 开发文档（Adapter 开发指南 + 配置示例）

**总计：6-7 周（1 人全职）**

### 里程碑验收
| Phase | 验收 |
|-------|------|
| 0 | 代码调用直接跑通一次 TopHub 采集，事件触达空消费者 |
| 1 | 运营能在后台建 TopHub 源并手工触发 |
| 2 | 老热榜 cron 移除，热榜页面数据不中断 |
| 3 | 老对标/研究任务代码移除 |
| 4 | `/data-collection/content` 能搜出任一被采集过的内容 |
| 5 | 代码无 dead code，监控指标与 Inngest Dashboard 一致 |

## 11. 错误处理与监控

### 11.1 错误分级
```
请求层（FetchLayer）：
  - 网络超时 / 5xx / 429 → 指数退避重试（默认 3 次）
  - 4xx 非 429 → 不重试，直接记录为采集失败
  - 达到重试上限 → 写 collection_logs level=error，run 标记为 partial/failed

解析层（Adapter 内部）：
  - 正文过短 / 关键字段缺失 → 单条跳过，不影响整批
  - Zod 校验失败 → 整个源 run 标记 failed（配置错误应该被运营立刻看到）

写入层（Writer）：
  - 并发合并冲突 → FOR UPDATE 行级锁解决
  - DB 约束违反 → run 标记 failed，触发告警

熔断（每个源独立）：
  - 连续 3 次 run failed → 监控页高亮 + 发告警事件
  - 连续 10 次 run failed → 自动 enabled=false（要运营手工恢复）
```

### 11.2 监控信号
- **每次 run**：attempted / inserted / merged / failed / 耗时 / trigger 类型
- **每个源滚动 7d**：成功率、平均耗时、首抓占比、最近连续失败数
- **全局 24h**：总采集量、错误率、活跃源数、最慢源 Top 5

## 12. 测试策略

- **Adapter 单测**：fixture 样本（HTML/JSON）→ Adapter → 断言 RawItem 形状；每个 Adapter ≥3 样本（happy / 部分失败 / 完全失败）
- **FetchLayer 单测**：mock fetch → 断言重试、退避、超时
- **Normalizer 单测**：各种标题归一化、URL 归一化边界情况
- **Writer 集成测**：真实 PG（测试库），验证合并/插入/事件发送、并发 `FOR UPDATE`
- **E2E**：本地 HTTP mock 服务模拟源 → 完整 cron→adapter→writer→event→领域表 链路断言
- **迁移安全网**：Phase 1-4 每次迁移新老并行 48h，对比 `collected_items` vs 老领域表记录数 ±5%

## 13. 风险与缓解

| 风险 | 级别 | 缓解 |
|------|------|------|
| 标题归一化误合并（例如"每周总结"多周内容） | 中 | 24h 时间桶 + 正文相似度兜底（Phase 4 加） |
| Trigram 全文搜索中文效果一般 | 中 | V1 接受，文档说明；V2 评估 pgroonga 或自建倒排 |
| 大规模 `source_channels[]` jsonb 查询慢 | 低 | 添加 GIN 索引；极端场景改为独立 `source_channels` 表 |
| Inngest 事件重复投递导致重复富化 | 中 | 消费方用 `enrichment_status != 'enriched'` 做幂等 |
| 迁移期间新老双写数据不一致 | 高 | 每 Phase 结束观察 48h + 对账脚本 |
| 运营误删源导致历史 run 数据级联丢失 | 中 | 删除改为 soft delete（`deleted_at` 字段），后台增加恢复入口 |
| 老数据回填 `collected_item_id` 性能卡顿 | 中 | 分批后台任务，单次 1000 条，间隔 10s |

## 14. 未来扩展（非本次范围）

- **Phase B 原生平台深抓**（微信公众号、微博账号、抖音、小红书）—— 每个平台一个新 Adapter 即可接入
- **试运行预览 `preview()`**
- **分类/标签自助管理后台**（taxonomy 管理页面）
- **"我的订阅"个性化推送**（编辑订阅某主题，新内容推送）
- **`pgroonga` / `pg_jieba` 中文分词**（若 Supabase 支持）
- **跨租户共享源库**（平台级精选源模板）

## 15. 成功判据

V1 上线 4 周后：
- 所有 7 个采集入口都在新框架下运行
- 旧的 `hot-topic-crawl.ts` / `benchmarking-crawl.ts` / `research/*-crawl.ts` / 知识库旧抓取代码被移除
- 运营后台能新建至少 3 种不同源类型，看到采集结果出现在内容浏览页
- 采集成功率 ≥ 95%（通过监控面板可见）
- 运营团队能独立添加/调整源，无需开发介入
