# 新闻研究模块 Overhaul — Wave 1 主设计

- **文档版本**：v1.0
- **日期**：2026-05-04
- **作者**：Zhuyu（产品） + Claude（技术方案）
- **目标用户**：西南政法大学新闻传播学院老师及研究生团队（同时为后续学术/政府/品牌舆情研究客户铺基础设施）
- **目标交付**：Wave 1 串行 6-8 周（29-41 工作日）

---

## 1. 概述

### 1.1 背景与触发

`2026-04-14` v1 设计的研究模块已交付约 80%：40 区县字典、16 主题词库 + 近似称谓 + 样本框架、5 级媒体分类 schema、`/research/admin/*` 后台、4 种采集通道（Tavily / 白名单 / 手工 URL / 热榜桥接）、8 字段 AND/OR 高级检索 schema 都已就位。

但落地试用后客户暴露 6 个核心问题：

1. **数据时效**：tikhub.io 等社媒数据源没接，社媒数据完全缺失
2. **数据完整度**：Tavily 只搜全文，搜出来一堆"某学院公众号"杂讯，权威媒体无法独立分析
3. **检索粒度**：标题/正文不能分字段限定，6+ 关键词 AND/OR 的 UI 没落地
4. **报告输出**：Excel/Word 导出能力 Spec 写了但代码没动，客户拿不到成品
5. **历史数据**：tikhub 等 API 实测拉不到 2025 全年（最长仅"半年内"），客户已有的 Excel 历史数据没有导入通道
6. **架构重复**：研究模块自有 `research_news_articles` 表，与 Collection Hub `collected_items` 重复存储，违反 Collection Hub 「统一原始池」的设计目标

### 1.2 本次 Overhaul 的范围

本次 Wave 1 范围 = **完成研究模块"高度商业化"所需的最短路径**：从客户提需求 → 收到一份学术风格报告，全链路打通。

```
Wave 1（本 spec）：6-8 周
  ├─ Collection Hub 升级（加 2 个 Adapter + 多类型 + 媒体分级）
  ├─ Research 模块迁移（废本地表，统一吃 collected_items）
  ├─ 高级检索（字段限定 + 6+ AND/OR + 主题命中）
  ├─ 报告导出 Phase A（互动 HTML + Word/Excel 一键导出）
  └─ 第 9 位 AI 员工"小研"（学术研究员）

Wave 2（独立立项，本 spec 仅留接口）：
  ├─ 视频/音频文件下载 + 腾讯 COS 落地
  ├─ 媒资库接采集池（让采集进来的视频可流入稿件库发布）
  ├─ 报告交互钻取增强（D 方案 Phase B）
  └─ 全国其他省/市权威媒体源建库
```

### 1.3 业务目标

| 目标 | 衡量标准 |
|---|---|
| **报告可商业交付** | 客户提"40 区县 × 16 主题 × 4 级媒体"需求 → 1 小时内拿到一份带数据 + 图表 + 自然语言段落的 Word/Excel/HTML |
| **数据可信** | 每条采集项可点击原链核查；媒体层级 + 区县归属在采集源头打标，检索时一键过滤 |
| **历史数据可补齐** | 客户提供 2025 全年 Excel → 系统去重灌入 collected_items，与 tikhub 增量数据并存 |
| **架构去重** | 研究模块不再有独立采集表，Collection Hub 是唯一原始池 |
| **可演进** | 媒体清单、主题词库、Adapter 配置均后台自助；新增省份 / 主题 / 平台 不需改代码 |

### 1.4 非目标（Wave 1 不做）

- ❌ 视频/音频/图集**文件下载**：仅存 URL + 缩略图 + 元数据，点详情跳原平台
- ❌ 抓取数据 → 媒资库自动同步：媒资库维持「本地上传」定位
- ❌ 抓取数据 → 稿件库自动同步：稿件库维持「自产 + 发布」定位
- ❌ 全国其他省市媒体清单：第一版只覆盖重庆 + 央级 + 行业典型
- ❌ 报告 PDF 导出：Word 已可手动转 PDF
- ❌ 报告交互钻取深度可视化：Phase A 先静态图表 + 一键导出，Phase B 留 Wave 2
- ❌ 跨研究任务协作 / 共享、舆情情感分析、跨语种检索（同 v1 spec 第 1.3 条）

---

## 2. 与前序 spec 的关系

| 前序 spec | 本 spec 与之关系 |
|---|---|
| `2026-04-14-news-research-module-design.md`（v1） | **修订**（不 supersede）。保留所有已交付内容（40 区县字典、16 主题词库、5 级媒体分类、`/research/admin/*` 后台）；废弃 v1 的 F1（媒体源管理独立模块）合并到 Collection Hub；废弃 v1 的 `research_news_articles` 数据存储设计；F4 采集通道扩展（加 tikhub + Excel 导入）；F7-F11 检索/报告升级到本 spec 的 A4/A5 设计 |
| `2026-04-18-unified-collection-module-design.md`（Collection Hub V1） | **扩展**。本 spec 的 A1+A2+A2.5 是 Collection Hub 的增量升级：加 2 个 Adapter（tikhub / excel_import）+ `collected_items` 加 `content_type` + `attachments` 字段 + `collection_sources` 加 `outlet_tier` / `outlet_region` 字段；同时完成 Collection Hub 一直未做的 Phase 5「研究 3 分支迁移」 |
| `2026-04-21-hot-topic-research-bridge-design.md` | **已 supersede (2026-05-11, commit 123b623)**。原 spec 的"桥接到 research_news_articles"方案已废弃,新架构改为采集池单一真相源 + `/research` 侧栏采集源多选过滤。 |

---

## 3. 三层架构

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1：Collection Hub（数据采集统一池）                │
│   collection_sources（源配置）                           │
│   collected_items（统一采集池，N 入 1 出，加多类型 +     │
│                    媒体分级 + 区县/主题打标）            │
│   Adapters：tophub / tavily / jina_url / list_scraper / │
│             rss / [新] tikhub / [新] excel_import        │
│   UI：/data-collection/{sources, content, monitoring}    │
└─────────────────────────────────────────────────────────┘
                  │ collected_item_id (FK 引用)
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2：媒资库 Media Assets（本 Wave 不动）              │
│   定位：本地上传素材，COS 物理存储后端                   │
│   范围：稿件库的发布素材；不接收抓取数据                 │
└─────────────────────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┐
       ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│ Layer 3a：       │  │ Layer 3b：稿件库 Articles         │
│ Research 学术层   │  │（本 Wave 不动）                   │
│                  │  │                                  │
│ 消费 collected_  │  │ 用户/AI 自产稿件 + 渠道元数据     │
│ items + 加研究    │  │ → 推抖音/小红书/视频号           │
│ 标注（采集项↔    │  │                                  │
│ 主题、采集项↔    │  │ 不与 Research 互通                │
│ 媒体）           │  │                                  │
│                  │  │                                  │
│ 报告生成：互动    │  │                                  │
│ HTML + Word/     │  │                                  │
│ Excel 一键导出    │  │                                  │
│                  │  │                                  │
│ 员工：xiaoyan    │  │                                  │
│ （小研，第 9 位） │  │                                  │
│ UI：/research/*  │  │                                  │
└──────────────────┘  └──────────────────────────────────┘
```

### 3.1 各层职责

**Layer 1（Collection Hub）**：
- 唯一的"互联网原材料入口"，所有采集都走它
- 负责去重（fingerprint）、限流、重试、日志、运营自助管理
- 负责"采集源 → 媒体身份"的识别（domain/公众号名 → outlet name + tier）

**Layer 2（媒资库）**：
- 本 Wave 不动。维持现有定位：本地上传素材，服务稿件库发布
- 抓取数据**不**自动同步进来；视频/音频文件**不**下载存 COS

**Layer 3a（Research）**：
- 不存原始采集数据；只存"研究语义层"附属表（采集项 ↔ 主题归类、采集项 ↔ 媒体识别 supplementary annotations）
- 提供学术风格的检索 + 报告生成
- 配置专属 AI 员工"小研"（xiaoyan）做全链路编排

**Layer 3b（稿件库）**：
- 本 Wave 不动。和 Research 是 Layer 3 的并列消费者，互不依赖

### 3.2 修正了什么

相比 v1 spec：

1. **删 `research_news_articles` 表** → 研究模块改读 `collected_items` + `research_*_annotation` 附属表
2. **删 v1 的 F1（研究模块自有媒体源管理）** → 媒体身份识别下沉到 Collection Hub 的 `collection_sources.outlet_tier/outlet_region` + 全局 `media_outlet_dictionary` 映射
3. **`collected_items` schema 升级**：加 `content_type`（image_text/video/short_video/image_set/audio）+ `attachments`（外链 URL/缩略图/平台元数据 JSON）
4. **新增 2 个 Adapter**：`tikhub`（覆盖 8 个社媒平台）+ `excel_import`（客户 Excel 历史数据灌库）
5. **新增第 9 位 AI 员工"小研"** → 区分于 xiaolei（产品向爆款舆情分析师），定位"学术中性 + 权威性 + 报告写作"
6. **报告输出升级**：从 v1 的"Excel + Word"扩展为"互动 HTML + Word/Excel 一键导出"（Phase A 静态版进 Wave 1，Phase B 钻取版进 Wave 2）

---

## 4. Wave 1 子项目分解

7 个子项目串行（2-A 用户决策选择串行而非并行，求稳）：

```
A1 → A2 → A2.5 → A3 → A4 → A5(Phase A) → A6
```

每个子项目都会有自己的 sub-spec（在本 spec 通过后逐个 brainstorm 细化）。本 spec 只定义子项目**范围、依赖、产出**。

### 4.1 A1 — Collection Hub 升级（4-6 天）

**范围**：Collection Hub 底层 schema + UI 升级，让它能承载多类型内容 + 媒体分级。

**Schema 改动**（`src/db/schema/collection.ts`）：

```ts
// collected_items 加字段
content_type: text("content_type")   // "image_text" | "video" | "short_video" | "image_set" | "audio"
                .notNull().default("image_text"),
attachments: jsonb("attachments")    // [{ kind, url, thumbnail_url, duration_ms, width, height, file_size, mime_type }, ...]
                .notNull().default(sql`'[]'::jsonb`),
outlet_id: uuid("outlet_id")          // 关联到 media_outlet_dictionary 的某条
                .references(() => mediaOutletDictionary.id, { onDelete: "set null" }),
outlet_tier: text("outlet_tier"),    // 冗余字段，便于检索时直接用（central/provincial_municipal/industry/district_media/government_self_media）
outlet_region: text("outlet_region"),// 冗余字段（重庆/江苏/北京/...）

// collection_sources 加字段
outlet_id: uuid("outlet_id")          // 这个采集源默认归属哪个 outlet（手工配置）
                .references(() => mediaOutletDictionary.id, { onDelete: "set null" }),
default_outlet_tier: text("default_outlet_tier"),
default_outlet_region: text("default_outlet_region"),
```

**新表**（`src/db/schema/media-outlet-dictionary.ts`）：

```ts
export const mediaOutletDictionary = pgTable("media_outlet_dictionary", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  outletName: text("outlet_name").notNull(),       // "新华社" / "重庆日报" / "涪陵发布"
  outletTier: text("outlet_tier").notNull(),       // 5 级枚举
  outletRegion: text("outlet_region"),             // "重庆" / "全国" / "江苏" 等
  outletDistrict: text("outlet_district"),         // 区县级才填，如"涪陵区"
  industryTag: text("industry_tag"),               // 行业媒体的领域标签，如"环境/经济/健康"
  domains: text("domains").array(),                // 识别用：["xinhuanet.com", "news.cn"]
  publicAccountNames: text("public_account_names").array(),  // 公众号名: ["新华社", "新华视点"]
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueOrgName: unique("media_outlet_dictionary_org_name_unique").on(t.organizationId, t.outletName),
  tierIdx: index("media_outlet_dictionary_tier_idx").on(t.organizationId, t.outletTier),
  domainsIdx: index("media_outlet_dictionary_domains_gin").using("gin", t.domains),
}));
```

**入库识别逻辑**（在 `src/lib/collection-hub/writer.ts` 或新建 `outlet-recognizer.ts`）：

```
collected_item 入库时：
  1. 优先：source 配置了 outlet_id → 直接用
  2. 次选：URL host 匹配 mediaOutletDictionary.domains → 命中后填 outlet_id/tier/region
  3. 兜底：raw_metadata.public_account_name 匹配 publicAccountNames → 命中后填
  4. 都没命中：tier=null（前端筛选时显示"未分类"）
```

**UI 改动**（`/data-collection/content`）：
- 内容浏览页加筛选项：媒体分级（5 级 chip 单选 + "未分类"）+ 媒体名（搜索下拉，从 mediaOutletDictionary 读）+ 区域（重庆/全国/...）
- 表格视图加列：媒体分级 + 媒体名（chip 形式）

**配套 seed**（`src/db/seed/media-outlet-dictionary/`）：
- 第一版灌入：央媒 ~10 家、行业典型 ~10 家、重庆主流 ~8 家、重庆 40 区县融媒 ~40 家、重庆政务新媒体（生态/教育/卫健等）~20-30 家。**总计 ≈ 90-100 条**
- 字典 V1 初稿在本 spec 第 12 章附录给出

**A1 留待 sub-spec 细化**：
- 公众号名匹配的精确度（同名公众号不同主体）
- "未分类"采集项的事后批量打标 UI
- 媒体字典的运营自助维护页面（在 `/data-collection` 还是单独 `/admin/media-outlets`）

---

### 4.2 A2 — tikhub Adapter（5-7 天）

**范围**：Collection Hub 第 6 个 Adapter，对接 tikhub.io，定位"近期半年内增量数据通道"。

**支持平台 V1（按优先级）**：

| 优先级 | 平台 | 主要 endpoint |
|---|---|---|
| P0 | 抖音（Douyin Web） | 综合搜索 / 视频搜索 / 用户主页 |
| P0 | 微博（Weibo） | 关键词搜索 / 用户微博列表 |
| P0 | 小红书（Xiaohongshu） | 笔记搜索（含 noteTime 过滤"半年内"）|
| P1 | 微信公众号 | 文章搜索 / 公众号文章列表 |
| P1 | 知乎 | 问答搜索 / 文章搜索 |
| P2 | B 站 | 视频搜索 |
| P2 | 快手 | 视频搜索 |
| P2 | 今日头条 | 文章搜索 |

**V1 工期切分**（A2 总 5-7 天）：

- **P0**（抖音 + 微博 + 小红书）：必出，3-4 天 — Adapter 框架 + 3 平台 endpoint 接入 + 入库适配
- **P1**（微信公众号 + 知乎）：同 sprint 出，1-2 天 — 复用 P0 框架加配置
- **P2**（B 站 + 快手 + 今日头条）：fallback to backlog，工期不足时不出 Wave 1，移到 Wave 1 完成后小迭代

**Adapter 配置 schema**（`src/lib/collection-hub/adapters/tikhub/config.ts`）：

```ts
{
  platform: "douyin" | "weibo" | "xiaohongshu" | "wechat_mp" | "zhihu" | "bilibili" | "kuaishou" | "toutiao",
  searchType: "keyword" | "user_profile" | "hashtag",
  query: string,                     // 关键词 / 账号 ID / hashtag
  timeWindow?: "day" | "week" | "halfYear" | "all",  // 平台支持的预设时间窗
  contentTypes?: Array<"video" | "image_text" | "short_video">,
  maxPagesPerRun: number,            // 默认 5
  resultsPerPage?: number,           // 默认 20
}
```

**计费控制**（A2 必须实现）：

- 进入正式抓取前，先调 tikhub `calculate_price` API 估算本次成本
- `collection_sources` 加 `monthly_budget_usd` 字段（每个源可独立设预算）
- 单次 run 超出 `maxPagesPerRun` 强制中止
- 每月累计调用费记录到 `collection_runs.metadata.tikhub_cost_usd`，达阈值 80% 邮件告警，100% 暂停所有 tikhub 源
- 后台监控页加"tikhub 月度费用"卡片

**入库适配**：
- 抖音视频 / 短视频笔记 → `content_type = "short_video"`，`attachments = [{ kind: "video", url, thumbnail_url, duration_ms, ... }]`
- 微博/小红书图集 → `content_type = "image_set"`，`attachments = [{kind: "image", url, ...}, ...]`
- 微信公众号文章 → `content_type = "image_text"`，`attachments = []`（文中图片不下载，存原文 URL 即可）
- `raw_metadata` 保留 tikhub 返回的原始 JSON 全文（点赞数 / 评论数 / 转发数 / 作者主页 URL 等）

**A2 留待 sub-spec 细化**：
- 8 个平台的具体 endpoint 选型（部分有"已弃用"标记）
- 不同平台 publishedAt 字段抽取规则（微博是字符串"5 分钟前"需要解析）
- 限流策略（tikhub 文档说 RPS=10）

---

### 4.3 A2.5 — Excel 导入 Adapter（2-3 天）

**范围**：Collection Hub 第 7 个 Adapter，让客户上传 Excel/CSV 文件 → 字段映射 → 灌入 `collected_items`，主要用途是补齐 2025 全年历史数据。

**Adapter 配置 schema**：

```ts
{
  fileUrl: string,                   // 已上传到对象存储的 Excel/CSV
  fieldMapping: {
    title: string,                   // Excel 列名 → collected_items.title
    content: string,
    publishedAt: string,
    canonicalUrl?: string,
    outletName?: string,             // 用于匹配 mediaOutletDictionary
    outletTier?: string,             // 客户 Excel 已分类的话直接用
    region?: string,
    customFields?: Record<string, string>,  // 灌入 raw_metadata
  },
  defaultOutletTier?: string,        // Excel 全是央媒就这里设
  defaultRegion?: string,
  importMode: "upsert_by_url" | "upsert_by_fingerprint" | "always_insert",
  contentType?: "image_text" | "video" | "short_video" | "image_set",
}
```

**UI 流程**（`/data-collection/sources/new` 加分支）：

```
Step 1: 上传 Excel/CSV (.xlsx / .xls / .csv)
   ↓
Step 2: 解析前 5 行预览 → 客户拖拽配置字段映射（拖列名 → 系统字段）
   ↓
Step 3: 默认值配置（媒体分级 / 区域 / 内容类型）
   ↓
Step 4: 试运行（前 10 行 dry-run，展示去重情况、命中字典情况）
   ↓
Step 5: 全量执行（异步 Inngest 任务，进度通过 collection_runs 暴露）
```

**去重**：复用 Collection Hub 现有 fingerprint 逻辑（`MD5(normalize(title) + date_bucket)`），客户多次上传同一份 Excel 不会重复入库。

**A2.5 留待 sub-spec 细化**：
- 字段映射 UI 的具体交互（drag-drop vs 下拉）
- 大文件分批解析策略（>10000 行 Excel）
- 客户 Excel 字段不规范时的兜底（如"发布时间"列混了多种格式）

---

### 4.4 A3 — Research 模块迁移（3-4 天）

**范围**：废弃 `research_news_articles` 表，研究模块改成读 `collected_items` + 加研究专用标注附属表。

**新表**（`src/db/schema/research/annotations.ts`）：

```ts
// 采集项 ↔ 主题归类（一对多）
export const researchCollectedItemTopics = pgTable("research_collected_item_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectedItemId: uuid("collected_item_id").notNull().references(() => collectedItems.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => researchTopics.id, { onDelete: "cascade" }),
  matchType: text("match_type").notNull(),  // "keyword" | "approximate_keyword" | "semantic" | "manual"
  matchedKeyword: text("matched_keyword"),  // 命中的具体关键词
  matchScore: numeric("match_score", { precision: 5, scale: 4 }),  // 0-1，语义匹配时填
  annotatedBy: text("annotated_by").notNull().default("system"),  // "system" | userId
  annotatedAt: timestamp("annotated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueItemTopic: unique("research_cit_unique").on(t.collectedItemId, t.topicId, t.matchType),
  itemIdx: index("research_cit_item_idx").on(t.collectedItemId),
  topicIdx: index("research_cit_topic_idx").on(t.topicId),
}));

// 采集项 ↔ 区县归属（一对多，一篇文章可提多个区县）
export const researchCollectedItemDistricts = pgTable("research_collected_item_districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectedItemId: uuid("collected_item_id").notNull().references(() => collectedItems.id, { onDelete: "cascade" }),
  districtId: uuid("district_id").notNull().references(() => researchCqDistricts.id, { onDelete: "cascade" }),
  matchType: text("match_type").notNull(),
  matchedKeyword: text("matched_keyword"),
  annotatedAt: timestamp("annotated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueItemDistrict: unique("research_cid_unique").on(t.collectedItemId, t.districtId),
}));
```

**注意**：媒体识别（采集项 ↔ 媒体）已经下沉到 Collection Hub 的 `collected_items.outlet_id/outlet_tier`，不需要再起一张研究专用表。

**自动打标 Inngest 函数**（`src/inngest/functions/research/annotate-collected-item.ts`）：

```
触发：collection/item.created 事件
处理：
  1. 加载该 org 的所有 active topics + 关键词列表
  2. 对采集项 title + content 做关键词命中（精确匹配 + 近似词匹配）
  3. 命中的 topic 写入 research_collected_item_topics（match_type = "keyword" | "approximate_keyword"）
  4. 加载 40 区县字典，做名称命中（注意"两江新区""科学城重庆高新区"这种特殊名）
  5. 命中区县写入 research_collected_item_districts
  6. 后续 V1.1 加语义匹配（topic samples 向量化）
```

**Research 模块代码迁移**（`src/lib/dal/research/` 重构）：

- `news-article-search.ts` → 改名 `collected-item-search.ts`，所有查询基于 `collectedItems` + 通过 join `research_collected_item_topics/districts` 过滤
- `tavily-crawler.ts` / `whitelist-crawler.ts` / `manual-url-ingest.ts` → 删除（这些是 Collection Hub Phase 5 一直没做的"研究 3 分支迁移"，本 A3 一并完成）
- `research_news_articles` 表 → drop（数据迁移分阶段执行：先双写 1 周观察 → 切换查询源 → drop 老表，详见 §8 R5；现有数据按 fingerprint 灌进 `collected_items` + 自动打标）
- 现有 `research/admin/tasks` 的"任务"概念保留，但任务的"数据来源"指向 `collection_sources`

**A3 留待 sub-spec 细化**：
- 数据迁移脚本（现有 research_news_articles 表里有数据吗？预计有多少条？）
- 自动打标任务的批量回填策略（对历史 collected_items 一次性打标）
- "研究任务"概念在新架构下是否还需要（可能可以简化为"检索 + 报告"的存档）

---

### 4.5 A4 — 高级检索（4-5 天）

**范围**：知网/图书馆风格的高级检索，字段限定 + 6+ 关键词 AND/OR 组合 + 主题/区县/媒体多维过滤。

**检索字段（V1 必出）**：

| 字段 | 类型 | 操作符 |
|---|---|---|
| 标题 (title) | text | 包含/不包含/精确等于 |
| 正文 (content) | text | 包含/不包含 |
| 作者 (author，从 raw_metadata 提取) | text | 包含/不包含 |
| 媒体名 (outletName) | enum (从 dictionary 选) | 等于/不等于 |
| 媒体分级 (outletTier) | enum 5 级 | 等于/不等于（多选 OR）|
| 区域 (outletRegion) | enum | 等于/不等于 |
| 区县（research-only，from annotations） | enum 40 选 | 包含任一/包含全部/不包含 |
| 主题（research-only，from annotations） | enum 16 选 | 包含任一/包含全部/不包含 |
| 内容类型 (contentType) | enum 5 类 | 等于（多选 OR）|
| 发布时间 (publishedAt) | datetime range | 在范围内 |
| 平台 (firstSeenChannel) | enum | 等于（多选 OR）|

**检索 UI**（`/research/search` 重构）：

```
[检索行组]（动态加减，最少 1 行最多 10 行，默认 3 行）
  [字段 ▾] [操作符 ▾] [值输入框]   [AND/OR ▾]   [+] [×]
  [字段 ▾] [操作符 ▾] [值输入框]   [AND/OR ▾]   [+] [×]
  [字段 ▾] [操作符 ▾] [值输入框]                [+] [×]

[侧栏过滤器]（始终生效的全局过滤）
  时间范围 [DateRangePicker]
  媒体分级 [多选 chip]
  区县 [多选 + 全选/反选]
  主题 [多选 + 全选/反选]
  内容类型 [多选 chip]

[检索按钮] [重置] [保存为我的检索方案]
```

**结果展示**：

- 上方 KPI 条：命中数（去重前）/ 关键词去重后 / 区县去重后
- 中部三张概览图（直接复用 v1 spec 的 F8）：分主题报道量柱状图、分区县报道量柱状图、分媒体层级饼图
- 下方 DataTable：标题 / 媒体（chip：tier+name） / 区县（chip） / 主题（chip） / 发布时间 / 来源 URL（点击跳原文）

**性能要求**：
- 单次检索结果 ≤ 1000 条直接返回；> 1000 走分页（page size 50）
- 命中统计走聚合查询，结果集 < 100k 时秒级返回；> 100k 异步出报告

**A4 留待 sub-spec 细化**：
- 检索行组的 UI 细节（字段切换时操作符联动）
- "我的检索方案"持久化存哪个表
- 检索结果的导出（直接走 A5 报告通道，还是单独导 CSV）

---

### 4.6 A5 — 报告导出 Phase A（7-10 天）

**范围**：Phase A 静态版互动 HTML 报告 + Word/Excel 一键导出。Phase B（钻取增强）留 Wave 2。

**报告类型**：

```
研究任务（Mission） - 1
  ├─ 检索快照（保存检索条件 + 命中数据 ID 列表）
  ├─ 报告 HTML（在线查看）- 1
  │   ├─ 摘要段（AI 生成）
  │   ├─ 数据简报段（含统计语句，模板插值 + AI 改写）
  │   ├─ 数据表（多组：分主题、分区县、分媒体层级、交叉透视）
  │   ├─ 图表（柱状图、堆叠柱图、饼图、折线图，Recharts）
  │   └─ 结论段（AI 生成）
  ├─ Word 导出 - 1（用 docx-templater 模板填充）
  └─ Excel 导出 - 1（用 ExcelJS，多 sheet：明细/分主题透视/分区县透视/分媒体透视/图表数据）
```

**Word 模板**（仿 v1 spec 给的样例报告样式）：

```
封面
  研究主题
  时间窗
  数据来源说明
  研究者署名

第一章 研究背景
  （AI 生成 1-2 段，根据主题/时间/区域写背景介绍）

第二章 数据来源与统计
  2.1 数据简报
    （模板插值：在 [时间窗] 内，[源] 共发布 [区域] 相关报道 X 条，
     从中挑选符合 [主题] 共 Y 条，分主题平均 Z 条。
     报道量最高的三个主题是 ...，最低的三个是 ...）
  2.2 媒体层级分布
    [数据表 + 柱状图]
  2.3 区县分布
    [数据表 + 横条图]
  2.4 主题分布
    [数据表 + 饼图]
  2.5 时间趋势
    [折线图]

第三章 研究发现（AI 生成 3-5 段，根据数据特征写结论）

附录：数据来源详细列表
```

**HTML 报告页面**（`/research/reports/[id]`）：

- 左栏目录树（章节锚点）
- 右栏正文（Markdown + 嵌入 Recharts 图表组件）
- 顶栏操作：导出 Word / 导出 Excel / 分享链接 / 重新生成
- 数据表支持复制到剪贴板
- 图表支持下载 PNG（Recharts 内置）

**生成流程**（Inngest `research-report-generate`）：

```
1. 读检索快照 → 加载命中数据
2. 算各维度聚合（按主题/区县/媒体 group by count）
3. 用模板插值生成"数据简报"段（确定性，不让 AI 算数）
4. 调 LLM 让"小研"员工生成：背景段、改写后的数据简报段、研究发现段
5. 渲染 HTML 入库（research_reports 表）
6. 异步生成 Word（docx-templater + 模板）+ Excel（ExcelJS）
7. 完成后通知用户（站内通知 + 可选邮件）
```

**新表**（`src/db/schema/research/reports.ts`）：

```ts
export const researchReports = pgTable("research_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  missionId: uuid("mission_id"),  // 研究任务 ID
  searchSnapshot: jsonb("search_snapshot").notNull(),  // 检索条件 + 数据 ID 列表
  reportTitle: text("report_title").notNull(),
  reportHtml: text("report_html"),
  wordFileUrl: text("word_file_url"),
  excelFileUrl: text("excel_file_url"),
  aggregatesJson: jsonb("aggregates_json"),  // 聚合统计结果
  generatedBy: uuid("generated_by"),  // 用户 ID
  status: text("status").notNull().default("pending"),  // pending/generating/ready/failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

**A5 留待 sub-spec 细化**：
- Word 模板的具体字数 / 段落结构 / 表格样式
- Excel 各 sheet 的 column / 透视方式
- AI 生成段落的 prompt 与防错机制（数据描述错误的容忍度）
- 大文件下载的存储位置（Supabase Storage / 临时签名 URL）

---

### 4.7 A6 — 研究 AI 员工"小研"（4-6 天）

**范围**：新增第 9 位 AI 员工 `xiaoyan`（小研，学术研究员），配 5 个研究专用 skill。

**员工定位**：
- 中文名：小研
- 拼音 ID：`xiaoyan`
- 头衔：学术研究员
- 风格：学术中性、严谨、看重数据来源权威性、报告写作偏论文体
- 区分点（与 xiaolei）：xiaolei 偏产品/爆款/时效，xiaoyan 偏学术/严谨/权威

**注册方式**：
- 加入 `EMPLOYEE_META`（`src/lib/constants.ts`）作为第 9 位
- 创建头像资源、个人简介、技能列表
- 数据库 seed 添加 `ai_employees` 行（每 org 自动 seed）

**5 个 skill（新增到 `src/lib/agent/skills/`）**：

| Skill ID | 名称 | 功能 |
|---|---|---|
| `research_query_builder` | 研究检索方案构造 | 接收用户口语需求 → 输出标准化的高级检索 JSON（字段 + AND/OR + 时间窗）|
| `outlet_classifier` | 媒体身份识别 | 输入采集项 → 推断/校验 outlet_tier；可批量处理"未分类"采集项 |
| `topic_classifier` | 主题智能归类 | 输入采集项 → 命中 16 主题之一或多个；用于关键词命中之外的语义补充 |
| `report_drafter` | 研究报告初稿 | 接 A5 的报告生成流程；按学术体例写背景 / 数据简报 / 结论段 |
| `data_pivoter` | 数据透视器 | 用户口头要"按 X × Y 透视"→ 输出 Excel 透视表配置 + 图表参数 |

**对话入口**：
- 主页面 `/employees/xiaoyan` 展示员工卡 + 技能列表
- Chat 入口：用户在 chat-center 选择 xiaoyan → 自动激活上述 skill 集
- 研究任务发起：从研究模块入口可一键"@小研"，进入对话态把"我要做 X 报告"自然语言转成检索 + 报告生成流水

**A6 留待 sub-spec 细化**：
- 5 个 skill 的具体 prompt（按 baoyu skill md 标准）
- xiaoyan 的人设描述、头像设计
- 与 xiaolei 的协作场景（用户说"先让 xiaolei 找热点再让 xiaoyan 写学术分析"）

---

## 5. Wave 2 路线图

| # | 项目 | 触发条件 | 预估工期 |
|---|---|---|---|
| W2.1 | 视频/音频文件下载 + 腾讯 COS 落地 | 客户提"在 vibetide 内播放视频"诉求时 | 7-10 天 |
| W2.2 | 媒资库接 collected_items（采集 → 发布通道） | 客户提"把抓的视频发自己的抖音" | 5-7 天 |
| W2.3 | 报告交互钻取（D 方案 Phase B）| Phase A 用了一段时间客户给具体反馈后 | 5-7 天 |
| W2.4 | 全国其他省/市权威媒体源建库 | 客户业务扩到外省 | 持续迭代 |
| W2.5 | 主题词向量化（语义匹配 vs 关键词匹配） | A4 关键词命中率明显不足时 | 4-5 天 |
| W2.6 | tikhub 平台扩展（P2 优先级以下） | 见客户实际数据使用情况 | 视情况 |

Wave 2 各项独立立项，本 spec 不展开。

---

## 6. 数据流（端到端）

```
[1] 抓取层（Layer 1 - Collection Hub）
   ┌──────────────────────────────────────────────────┐
   │ Tavily 全网搜索 ───┐                              │
   │ 白名单爬虫 ────────┼──→ FetchLayer ─→ Adapter    │
   │ tikhub Adapter ────┤    （限流+重试）   规范化输出 │
   │ Excel Import ──────┤                             │
   │ TopHub / RSS / ... ┘                             │
   └─────────────────────────────────────────────────┘
                       │
                       ▼
   ┌──────────────────────────────────────────────────┐
   │ Writer（去重 + 入库）                              │
   │  • fingerprint = MD5(normalize(title)+date)       │
   │  • URL hash 辅助                                   │
   │  • 多源同条 → source_channels 累加                 │
   └──────────────────────────────────────────────────┘
                       │
                       ▼ 写入 collected_items
   ┌──────────────────────────────────────────────────┐
   │ outlet-recognizer（同事务）                       │
   │  source.outlet_id → URL host → 公众号名 → 兜底    │
   │  填充 outlet_id / outlet_tier / outlet_region     │
   └──────────────────────────────────────────────────┘
                       │
                       ▼ 触发 collection/item.created 事件
[2] 研究语义层（Layer 3a - Research）
   ┌──────────────────────────────────────────────────┐
   │ research-annotate-collected-item                 │
   │  • 16 主题关键词命中（含近似词）                  │
   │  • 40 区县名称命中                                │
   │  • 写入 research_collected_item_topics/districts │
   └──────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼                             ▼
[3] 检索层                       [4] 报告层
   /research/search          研究任务（mission）
        │                             │
   高级检索条件                    检索快照 + 数据
        │                             │
        ▼                             ▼
   命中结果列表 + 概览图          [小研 xiaoyan 编排]
        │                             │
   导 CSV / 直接转报告        ┌─────────────┐
                              ▼              ▼
                        模板插值数据     LLM 写自然段落
                              ↓              ↓
                              └──────┬───────┘
                                     ▼
                            HTML 报告 + Word + Excel
                                     │
                                     ▼
                            存档 research_reports
                            通知用户 / 提供下载
```

---

## 7. 关键决策记录

### 7.1 为什么不进媒资库

**决策**：抓取的视频/音频/图集**不**自动同步进媒资库；媒资库维持"本地上传"定位。

**理由**：
- 媒资库的价值定位是"我自己的素材，可拿来组合发布"，不是"我看过的别人的内容"
- 抓取的视频如果都进媒资库，会让"我的素材"概念被稀释
- 客户当前没有"把抓的视频发自己渠道"的需求；如有，单独走 W2.2

**对应**：抓取的视频/音频只存 URL + 缩略图 + 平台元数据在 `collected_items.attachments`；点击详情跳原平台。

### 7.2 为什么 tikhub 定位"近期增量"

**决策**：tikhub 不用作 2025 全年历史回溯，只用作上线后的近期半年内增量数据通道。

**理由**：
- tikhub 各搜索 endpoint 时间窗最长仅"半年内"（实测小红书 `noteTime` 参数枚举）
- 强行尝试拉 2025 全年会大量空跑（搜索结果根本不返回 12 个月前的内容），成本浪费
- 历史数据从客户 Excel 灌入更稳更省（A2.5）

### 7.3 为什么报告分 Phase A / Phase B

**决策**：Wave 1 的 A5 只做静态报告（Phase A），交互钻取（Phase B）留 Wave 2。

**理由**：
- 静态报告 + 一键导出 Word/Excel 已能覆盖客户 90% 学术写作场景
- 交互钻取增强需要先看用户实际使用习惯（哪些字段最常钻取、什么粒度、什么样的图表交互），缺反馈做出来容易过设计
- Phase A 工期 7-10 天，加 Phase B 会膨胀到 12-17 天，单一子项目工期太长不利风险控制

### 7.4 为什么新增 xiaoyan 而不扩展 xiaolei

**决策**：新增第 9 位员工 `xiaoyan`，不让 xiaolei 兼任研究角色。

**理由**：
- 客户群完全不同：xiaolei 服务媒体运营（看时效/爆款），xiaoyan 服务学术教授（看权威/严谨）
- 输出风格冲突：xiaolei 写产品向爆款描述，xiaoyan 写学术中性论文段落
- 一个员工同时背两类容易"人设撕裂"，prompt 工程也更复杂
- 多一位员工对系统也是个差异化展示，符合 vibetide "AI 团队" 产品定位

### 7.5 为什么废 research_news_articles 而不是保留双写

**决策**：彻底删除 research_news_articles，研究模块改读 collected_items + 研究标注附属表。

**理由**：
- 双写 = 两份事实 = 长期数据漂移
- Collection Hub 的设计初衷就是「统一原始池」，研究模块自有表是历史负债
- Phase 5 的"研究 3 分支迁移"一直在 spec 里挂着没做，此次正好一并完成

---

## 8. 风险与对策

| # | 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|---|
| R1 | tikhub 部分 endpoint 单价高于 $0.001（具体未公开定价） | 中 | 月成本超预算 5-10 倍 | A2 第一步实测 `calculate_price`；在 `collection_sources` 设月度预算硬阈值；超 80% 邮件告警，超 100% 自动暂停 |
| R2 | 客户 Excel 字段不规范、混编 | 高 | A2.5 数据脏 | 字段映射 UI 强制确认；试运行前 10 行 dry-run；解析失败行单独输出错误报告供客户修正 |
| R3 | 主题命中精度低（同一篇文章不出现关键词原文但内容相关）| 中 | 报告漏数 | V1 用 16 主题 + 全部近似词 OR 命中（已在 v1 spec 设计中）；V2（W2.5）加向量化语义命中 |
| R4 | 报告 AI 写作中数据描述出错（如把"4539 条"写成"4593 条"）| 中 | 学术报告失真 | 关键数据描述强制用模板插值（确定性），AI 只负责改写措辞（创造性）；Word 模板内打 `{{stats.topic_max}}` 这类占位 |
| R5 | A3 数据迁移破坏现有研究任务的查询能力 | 中 | 前端报错 | 迁移分两步：先双写（collected_items + research_news_articles），跑 1 周观察 → 切换查询源 → drop 老表；保留 30 天 backup |
| R6 | tikhub 部分平台抓取不稳定（被风控） | 中 | 抓取失败率高 | tikhub 自带重试机制；本侧记录失败率到 collection_logs；失败率 > 30% 暂停该源 |
| R7 | xiaoyan 与 xiaolei 边界模糊导致用户误用 | 低 | 用户体验差 | 员工卡明确角色定位；chat-center 推荐时按场景路由（"分析重庆 Q4 网信办热点"→ xiaolei；"40 区县媒体报道分析"→ xiaoyan）|

---

## 9. 工期估算

| 子项目 | 估计工期 | 累计 |
|---|---|---|
| A1 Collection Hub 升级 | 4-6 天 | 4-6 |
| A2 tikhub Adapter | 5-7 天 | 9-13 |
| A2.5 Excel 导入 Adapter | 2-3 天 | 11-16 |
| A3 Research 模块迁移 | 3-4 天 | 14-20 |
| A4 高级检索 | 4-5 天 | 18-25 |
| A5 报告导出 Phase A | 7-10 天 | 25-35 |
| A6 研究 AI 员工小研 | 4-6 天 | **29-41 天（6-8 周）** |

每个子项目交付包含：sub-spec → 实施 plan → 实现 → tsc 零错 → build pass → 手工验收。

---

## 10. 留待 sub-spec 细化的开放问题

| 子项目 | 待澄清 |
|---|---|
| A1 | media_outlet_dictionary V1 实际灌入清单（本 spec 第 12 章给初稿） / "未分类"采集项的批量打标 UI / 媒体字典是否在 `/data-collection` 维护还是 `/admin/media-outlets` 单独入口 |
| A2 | 8 平台具体 endpoint 选型（部分有 deprecated 标记） / publishedAt 字段抽取规则（微博"5 分钟前"如何解析） / 限流策略（RPS=10 实测） |
| A2.5 | 字段映射 UI 交互（drag-drop vs 下拉） / 大文件分批解析阈值 / 失败行错误报告导出格式 |
| A3 | 现有 research_news_articles 表数据量 + 迁移脚本 / 自动打标的批量回填策略 / 研究任务概念在新架构下是否简化 |
| A4 | 检索行组的字段-操作符联动 / 我的检索方案存哪里 / 检索结果导出走 A5 还是单独 CSV |
| A5 | Word 模板字数和段落结构 / Excel sheet column / AI prompt 防错 / 大文件下载存储 |
| A6 | 5 skill 的 prompt（按 baoyu 标准）/ xiaoyan 人设和头像 / 与 xiaolei 协作场景 |

---

## 11. 验收标准（Wave 1 整体交付）

### 11.1 功能验收

- [ ] 客户上传一份 2025 全年 Excel 历史数据 → 系统去重灌入 collected_items 并自动打标
- [ ] tikhub Adapter 能在小红书/抖音/微博抓出"半年内"主题相关内容，入库带正确 outlet_tier
- [ ] 研究模块检索页能按"标题包含'长江生态' AND 区县=涪陵区 AND 媒体分级=央级"组合检索
- [ ] 检索结果可一键生成报告：HTML 在线查看 + Word 下载 + Excel 下载
- [ ] Word 报告含数据简报段（仿样例），数字描述准确，结论段无明显事实错误
- [ ] xiaoyan 在 chat-center 可被选中，能用自然语言把客户口头需求转成检索 + 报告生成流水

### 11.2 性能验收

- [ ] 检索结果 ≤ 1000 条直接秒级返回
- [ ] 报告生成（含 Word 渲染）≤ 5 分钟
- [ ] 自动打标延迟 ≤ 5 秒（从 collected_items 写入到 annotation 写入）
- [ ] tikhub 月度费用阈值告警工作正常

### 11.3 数据正确性验收

- [ ] research_news_articles 表已 drop，所有研究查询路径切到 collected_items
- [ ] 同一篇文章重复抓取（多源）只产生一条 collected_items
- [ ] 16 主题命中（关键词 + 近似词 OR）命中率 vs 客户 v1 老报告对照差异 < 5%
- [ ] outlet_tier 自动识别准确率 ≥ 95%（人工抽检 100 条）

### 11.4 架构验收

- [ ] Collection Hub Phase 5 的"研究 3 分支迁移"完成（Inngest 旧函数删除）
- [ ] `tsc --noEmit` 零错
- [ ] `npm run build` 通过
- [ ] 单测覆盖：Adapter（tikhub + excel_import）+ outlet-recognizer + auto-annotate

---

## 12. 附录：媒体源字典 V1 灌入清单初稿

A1 的 media_outlet_dictionary V1 计划灌入以下条目，sub-spec 阶段最终确认：

### 12.1 央级媒体（约 12 条）

| outlet_name | domains 示例 | 公众号 |
|---|---|---|
| 新华社 | xinhuanet.com, news.cn | 新华社 / 新华视点 |
| 人民日报 | people.com.cn, peopledaily.com.cn | 人民日报 |
| 中央广播电视总台 | cctv.com, cnr.cn, cri.cn | 央视新闻 |
| 光明日报 | gmw.cn, guangmingdaily.com.cn | 光明日报 |
| 经济日报 | ce.cn, jingjiribao.cn | 经济日报 |
| 法治日报 | legaldaily.com.cn | 法治日报 |
| 科技日报 | stdaily.com | 科技日报 |
| 中国日报 | chinadaily.com.cn | 中国日报 |
| 工人日报 | workercn.cn | 工人日报 |
| 中国青年报 | cyol.com | 中国青年报 |
| 农民日报 | farmer.com.cn | 农民日报 |
| 求是网 | qstheory.cn | 求是 |

### 12.2 行业媒体（约 12 条，覆盖 16 主题相关行业）

| outlet_name | 主要主题领域 |
|---|---|
| 中国环境报 | 环保督察/污染防治/生态红线/双碳 |
| 中国能源报 | 清洁能源/低碳经济 |
| 中国绿色时报 | 国家公园/生物多样性/绿水青山 |
| 健康报 | 健康/卫生 |
| 中国旅游报 | 美丽中国/绿色发展 |
| 经济参考报 | 绿色发展/双碳/低碳经济 |
| 中国自然资源报 | 资源节约/生态红线 |
| 中国水利报 | 长江生态/综合治理 |
| 中国应急管理报 | 环保督察 |
| 中国消费者报 | 资源节约/和谐共生 |
| 法治日报（已在央级） | 制度建设 |
| 中国教育报 | （备选）|

### 12.3 重庆省市级（约 8 条）

| outlet_name | domains | 公众号 |
|---|---|---|
| 重庆日报 | cqrb.cn | 重庆日报 |
| 华龙网 | cqnews.net, hualongw.com | 华龙网 |
| 上游新闻 | cqcb.com | 上游新闻 |
| 重庆电视台 | cbg.cn | 重庆广电 |
| 重庆发布 | （政务） | 重庆发布 |
| 美丽重庆 | （行业 + 政务） | 美丽重庆 |
| 第 1 眼新闻 | 1tv.com.cn | 第 1 眼新闻 |
| 重庆晚报 | cqwb.com.cn | 重庆晚报 |

### 12.4 重庆 40 区县融媒体（约 40 条）

按区县字典 1:1 配置「{区县名}发布」+「{区县名}融媒」公众号 + 各区县融媒中心官网。例：

```
北碚区 → 北碚发布 / 北碚融媒
两江新区 → 重庆两江新区 / 两江新区发布
渝北区 → 渝北发布
九龙坡区 → 九龙坡发布
... (40 个区县逐一配置)
```

### 12.5 重庆政务新媒体（约 20-30 条）

按业务相关度（生态文明研究主题驱动）：

- 重庆市生态环境局（市级）+ 40 个区县生态环境局（共 41 条）
- 重庆市林业局
- 重庆市规划和自然资源局
- 重庆市水利局
- 重庆市住建委
- ...

V1 收齐重庆生态环境系统，其他系统（教育/卫健/文旅）Wave 2 按需扩展。

---

## 13. 进入下一步

本 spec 通过后，按以下顺序推进：

1. **本 spec → spec review**（spec-document-reviewer subagent，最多 3 轮）
2. **review 通过 → 用户最终 approve**
3. **进入 A1 sub-brainstorm** → 生成 A1 sub-spec → A1 implementation plan → 实施 → 验收
4. **A1 完成 → 进入 A2 sub-brainstorm** → ... 依次推进 A2.5 / A3 / A4 / A5 / A6
5. **Wave 1 全部完成 → 启动 Wave 2 立项**

每个子项目独立 spec → plan → 实施 → 验收，单 commit 直接落 main 分支（按 CLAUDE.md 单分支约定）。
