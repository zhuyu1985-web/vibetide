# A1 — Collection Hub 升级 sub-spec

- **版本**：v1.0
- **日期**：2026-05-05
- **作者**：Zhuyu（产品） + Claude（技术方案）
- **关联 main spec**：`/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.1
- **状态**：Brainstorming 完成，待 plan
- **工期估算**：5-7 天（含 Path C 清理 + Day 0 数据调研 + reviewer 工期校准）

---

## 1. 范围与目标

### 1.1 一句话定义

> 给 Collection Hub 增加**多类型内容承载**（图文/视频/短视频/图集/音频）+ **媒体身份识别**（4-5 级分级 + 区域 + 区县）+ **媒体字典维护后台**，让所有 Layer 3 消费者（研究 / 同题漏题 / 灵感池 / 知识库）共享统一的"采集 + 媒体识别"基础设施。

### 1.2 范围（4-6 天工期内必交付）

- **清理 v1 遗留 outlet 系统**（Path C 决策）：删除 `research_media_outlets` + `research_media_outlet_aliases` + `research_media_outlet_crawl_configs` 三张表 + 167 条 demo seed + `src/lib/research/outlet-matcher.ts`（137 行）+ 9 处旧引用
- 新表 `media_outlet_dictionary`（org-scoped 媒体字典，归属 Collection Hub 全局基础设施）
- `collected_items` 加 5 个字段：`content_type` / `attachments` / `outlet_id` / `outlet_tier` / `outlet_region`
- `collection_sources` 加 3 个字段：`outlet_id` / `default_outlet_tier` / `default_outlet_region`
- Outlet Recognizer 算法集成进 Collection Hub Writer（入库时同事务自动识别）
- 媒体字典 V1 灌入 113 条（标准版 = 央 12 + 行业 12 + 重庆省市级 8 + 重庆 40 区县融媒 40 + 重庆生态环境系统 41）
- 新 tab `/data-collection/outlets`（媒体字典 CRUD 后台）
- `/data-collection/content` 加 3 个筛选项（媒体分级 / 媒体名 / 区域）
- `/data-collection/sources` 详情页加 outlet 配置字段
- 采集项详情 drawer 加"修正 outlet"单条操作

### 1.3 非目标（YAGNI / 推迟到 V2 或其他 spec）

- ❌ "未分类"采集项的批量打标 UI（A1-Q3 选择 ii）
- ❌ 同名 outlet（如多个"教育发布"公众号）的 disambiguation UI（V1 用"先到先得 + 人工修正"）
- ❌ 媒体字典的导入/导出 Excel 能力（V2 客户提需求时再做）
- ❌ outlet 自动建议（基于 ML 模型）—— V1 仅规则匹配
- ❌ 跨 org 共享字典（V1 每 org 独立维护）
- ❌ 字典版本控制 / 审计日志（V2）
- ❌ 视频/音频/图集**文件下载**（main spec 已确定走 attachments 外链，本 sub-spec 不重申）
- ❌ 保留 v1 outlet 系统的 alias 正则匹配能力（v1 设计但 demo 未使用过；新 outlet 字典只用 domains[] 精确 + publicAccountNames[] 精确两种匹配，足够覆盖 113 条 V1 字典场景）
- ❌ 保留 `research_media_outlet_crawl_configs` 子表（爬虫配置已被 Collection Hub `list_scraper` Adapter 取代，list_url_template / article_url_pattern / scheduleCron 都在 `collection_sources.config` jsonb 里）

### 1.4 与 main spec §4.1 的对应关系

main spec §4.1 给了 Schema 草稿和大致 UI 描述；本 sub-spec 在此基础上：
1. 字典 V1 数量从"~90-100 条"敲定为 **113 条**（解决 reviewer 提的 §12 与 §4.1 总数对账冲突）
2. UI 位置从"`/data-collection/content` 还是 `/admin/media-outlets`"敲定为 **`/data-collection/outlets` 顶层 tab**
3. "未分类批量打标"敲定为 **YAGNI 推迟**
4. 字段细节、recognizer 算法、UI 元素、seed 结构、工期切分都补到位

---

## 2. 已确认决策（来自 A1 brainstorming）

| ID | 问题 | 决策 |
|---|---|---|
| A1-Q1 | 媒体字典 V1 数量 | 标准版 ~113 条（央 12 + 行业 12 + 重庆省市级 8 + 区县融媒 40 + 生态环境系统 41）|
| A1-Q2 | 字典维护 UI 位置 | `/data-collection/outlets` 独立 tab（与 sources/content/monitoring 平级）|
| A1-Q3 | "未分类"批量打标 UI | YAGNI 推迟；V1 只在采集项详情 drawer 提供单条修正 |
| A1-Q4 | 已有 `research_media_outlets` 系统的处理 | **Path C 推倒重建**：删除 3 张表 + 167 条 demo seed + `outlet-matcher.ts` + 9 处旧引用，新建 `media_outlet_dictionary` + `outlet-recognizer.ts` + 113 条新 seed。理由：用户确认现有数据是 demo 可丢；Path C 一次到位，命名干净，A3 Research 模块迁移阶段不再有 outlet 相关清理工作 |

---

## 3. Schema 变更

### 3.0 清理 v1 outlet 系统（Path C 前置步骤）

在新建 `media_outlet_dictionary` 之前，**必须**清理以下 v1 遗产：

**删除的 schema 文件**：
- `src/db/schema/research/media-outlets.ts`（72 行，含 3 张表定义 + relations）

**删除的 enum**（在 `src/db/schema/research/enums.ts` 中）：
- `mediaTierEnum`（与新设计的 `OUTLET_TIER_VALUES` text 枚举重叠，且少 `government_self_media`）
- `mediaOutletStatusEnum`（与新设计的 `isActive` boolean 重叠）
- 注意：删除 enum 前确认它们不被其它 schema 文件引用

**删除的代码**：
- `src/lib/research/outlet-matcher.ts`（137 行）
- `src/db/seed/research/media-outlets.ts`（167 行 demo seed）
- 9 处旧引用（plan 阶段逐文件梳理；预估在 DAL `src/lib/dal/research/*` + actions `src/app/actions/research/*` + inngest 函数 + `news-articles` schema FK + 研究模块相关页面）

**删除的 DB 表**（migration 内执行）：
- `research_media_outlet_crawl_configs`（先删，因 FK to research_media_outlets）
- `research_media_outlet_aliases`（同上）
- `research_media_outlets`（最后删）

**FK 处理**：
- 如果 `news_articles` 表（research 模块的稿件表）有 FK 引用 `research_media_outlets.id`，先 ALTER 删 FK，再删表
- 该 FK 在 A3（Research 模块迁移）阶段会随 `research_news_articles` 表一并删除，所以不需要保留

**回归验证**：
- `tsc --noEmit` 零错（删除 schema/matcher 后所有 import 路径要更新或删除）
- `npm run build` 通过
- 现有研究模块功能（`/research/admin/*` 页面）暂时不可用是预期内的（A3 阶段才会重新接通）

### 3.1 新增表 `media_outlet_dictionary`

文件位置：`src/db/schema/media-outlet-dictionary.ts`

```ts
import { sql } from "drizzle-orm";
import {
  boolean, index, jsonb, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const mediaOutletDictionary = pgTable(
  "media_outlet_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outletName: text("outlet_name").notNull(),                  // "新华社" / "重庆日报" / "涪陵发布"
    outletTier: text("outlet_tier").notNull(),                  // 5 级枚举（见 §3.4）
    outletRegion: text("outlet_region"),                        // "重庆" / "全国" / "江苏" 等
    outletDistrict: text("outlet_district"),                    // 区县级才填
    industryTag: text("industry_tag"),                          // 行业媒体专用：环境/经济/健康/法治...
    domains: text("domains").array(),                           // ["xinhuanet.com", "news.cn"]
    publicAccountNames: text("public_account_names").array(),   // ["新华社", "新华视点"]
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueOrgName: unique("media_outlet_dictionary_org_name_unique").on(t.organizationId, t.outletName),
    tierIdx: index("media_outlet_dictionary_tier_idx").on(t.organizationId, t.outletTier, t.isActive),
    regionIdx: index("media_outlet_dictionary_region_idx").on(t.organizationId, t.outletRegion),
    domainsGin: index("media_outlet_dictionary_domains_gin").using("gin", t.domains),
    publicAccountsGin: index("media_outlet_dictionary_pa_gin").using("gin", t.publicAccountNames),
  }),
);
```

### 3.2 `collected_items` 字段增量

文件位置：`src/db/schema/collection.ts`（修改）

新增 5 个字段（追加在现有字段末尾，不改字段顺序）：

```ts
contentType: text("content_type").notNull().default("image_text"),
// "image_text" | "video" | "short_video" | "image_set" | "audio" | "live"

attachments: jsonb("attachments")
  .$type<Array<{
    kind: "video" | "image" | "audio" | "thumbnail";
    url: string;                          // 原平台 URL（V1 不下载到 COS）
    thumbnailUrl?: string;
    mimeType?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    fileSizeBytes?: number;
    extra?: Record<string, unknown>;     // 平台特定字段（点赞数/评论数等）
  }>>()
  .notNull()
  .default(sql`'[]'::jsonb`),

// content_type 与 attachments[].kind 对应关系：
//   image_text   → attachments 通常为空，或少量 kind=image（正文配图，仅当客户要求时）
//   video        → 1 条 kind=video + 1 条 kind=thumbnail（封面）
//   short_video  → 同 video（区分仅在 content_type 字段，attachments 结构一致）
//   image_set    → N 条 kind=image（图集多张图）
//   audio        → 1 条 kind=audio + 0~1 条 kind=thumbnail（封面）
//   live         → 通常空数组，或 1 条 kind=thumbnail
// Writer 入库时按 content_type 校验 attachments 结构（zod schema），不符合时仍允许写入但记 warn 日志。

outletId: uuid("outlet_id")
  .references(() => mediaOutletDictionary.id, { onDelete: "set null" }),

outletTier: text("outlet_tier"),                // 冗余字段，便于检索
outletRegion: text("outlet_region"),            // 冗余字段，便于检索
```

新增 2 个索引：

```ts
contentTypeIdx: index("collected_items_content_type_idx").on(t.organizationId, t.contentType),
outletTierIdx: index("collected_items_outlet_tier_idx").on(t.organizationId, t.outletTier),
```

### 3.3 `collection_sources` 字段增量

文件位置：`src/db/schema/collection.ts`（修改同文件）

新增 3 个字段：

```ts
outletId: uuid("outlet_id")
  .references(() => mediaOutletDictionary.id, { onDelete: "set null" }),
// 该采集源默认归属哪个 outlet（手工配置；如该源是单一媒体的官网或公众号）

defaultOutletTier: text("default_outlet_tier"),
defaultOutletRegion: text("default_outlet_region"),
// 当采集源**不是**单一媒体（如 Tavily 全网搜索、TopHub 聚合榜）时，
// 用 default_* 字段做兜底（实际 outlet 由 recognizer 按 URL host / 公众号名识别）
```

### 3.4 枚举常量统一

文件位置：`src/lib/collection-hub/constants.ts`（新建或追加）

```ts
export const OUTLET_TIER_VALUES = [
  "central",                  // 央媒：人民日报 / 新华社 / CCTV / 光明日报 ...
  "provincial_municipal",     // 省/直辖市级：重庆日报 / 华龙网 / 上游新闻 ...
  "industry",                 // 行业媒体：中国环境报 / 中国能源报 ...
  "district_media",           // 区县融媒：涪陵发布 / 北碚发布 ...
  "government_self_media",    // 政务新媒体：重庆市生态环境局 / 各区县生态局 ...
] as const;
export type OutletTier = (typeof OUTLET_TIER_VALUES)[number];

export const CONTENT_TYPE_VALUES = [
  "image_text",   // 图文
  "video",        // 长视频（B 站 / YouTube）
  "short_video",  // 短视频（抖音 / 快手 / 视频号）
  "image_set",    // 图集（小红书 / 微博图集）
  "audio",        // 音频（播客）
  "live",         // 直播回放
] as const;
export type ContentType = (typeof CONTENT_TYPE_VALUES)[number];
```

不用 PostgreSQL enum，用 text + Zod 校验，便于后续扩展（添加新 tier 不需要 ALTER TYPE）。

### 3.5 迁移文件

新增 1 个 migration（在 `supabase/migrations/` 下）：

```
00XX_a1_collection_hub_upgrade.sql
  - CREATE TABLE media_outlet_dictionary
  - CREATE INDEX (5 个)
  - ALTER TABLE collected_items ADD COLUMN content_type / attachments / outlet_id / outlet_tier / outlet_region
  - CREATE INDEX (2 个)
  - ALTER TABLE collection_sources ADD COLUMN outlet_id / default_outlet_tier / default_outlet_region
```

迁移**不**回填历史数据；现有 `collected_items` 的 `content_type` 默认为 `"image_text"`，`outlet_id/tier/region` 默认 NULL（即"未分类"），客户可在后续灌入字典后跑一次"全量 recognize"批处理（独立 Inngest 函数 `collection/outlet-batch-recognize`）。

---

## 4. 媒体字典 V1 灌入清单（标准版 113 条）

种子文件结构：

```
src/db/seed/media-outlet-dictionary/
  ├─ index.ts              （barrel export + 主 seed 函数）
  ├─ central.ts            （12 条央媒）
  ├─ industry.ts           （12 条行业典型）
  ├─ chongqing-municipal.ts（8 条重庆省市级）
  ├─ chongqing-district.ts （40 条区县融媒）
  └─ chongqing-eco-gov.ts  （41 条重庆生态环境系统）
```

主 seed 函数：

```ts
// src/db/seed/media-outlet-dictionary/index.ts
export async function seedMediaOutletDictionary(orgId: string) {
  // 按 outletName 做 upsert（已存在则跳过）
  const allOutlets = [
    ...CENTRAL_OUTLETS,
    ...INDUSTRY_OUTLETS,
    ...CHONGQING_MUNICIPAL,
    ...CHONGQING_DISTRICT_FUSION_MEDIA,
    ...CHONGQING_ECO_GOV_OUTLETS,
  ];
  // ...
}
```

### 4.1 央级（12 条）— `central.ts`

| outlet_name | tier | region | domains | public_account_names |
|---|---|---|---|---|
| 新华社 | central | 全国 | xinhuanet.com, news.cn | 新华社, 新华视点 |
| 人民日报 | central | 全国 | people.com.cn, peopledaily.com.cn, paper.people.com.cn | 人民日报, 人民日报评论 |
| 中央广播电视总台 | central | 全国 | cctv.com, cnr.cn, cri.cn, ce.cn | 央视新闻, 央视财经 |
| 光明日报 | central | 全国 | gmw.cn, guangmingdaily.com.cn | 光明日报 |
| 经济日报 | central | 全国 | ce.cn, jingjiribao.cn | 经济日报 |
| 法治日报 | central | 全国 | legaldaily.com.cn | 法治日报 |
| 科技日报 | central | 全国 | stdaily.com | 科技日报 |
| 中国日报 | central | 全国 | chinadaily.com.cn | 中国日报 |
| 工人日报 | central | 全国 | workercn.cn | 工人日报 |
| 中国青年报 | central | 全国 | cyol.com, zqb.cyol.com | 中国青年报 |
| 农民日报 | central | 全国 | farmer.com.cn | 农民日报 |
| 求是网 | central | 全国 | qstheory.cn | 求是 |

### 4.2 行业典型（12 条）— `industry.ts`

| outlet_name | tier | industry_tag | domains | public_account_names |
|---|---|---|---|---|
| 中国环境报 | industry | 环境 | cenews.com.cn | 中国环境, 中国环境报 |
| 中国能源报 | industry | 能源 | cnenergynews.cn | 中国能源报 |
| 中国绿色时报 | industry | 林草/生态 | greentimes.com | 中国绿色时报 |
| 中国自然资源报 | industry | 自然资源 | iziran.net, mnr.gov.cn | i 自然 |
| 中国水利报 | industry | 水利 | slb.com.cn | 中国水利报 |
| 中国应急管理报 | industry | 应急 | mem.gov.cn/yjglb | 中国应急管理报 |
| 中国旅游报 | industry | 文旅 | ctnews.com.cn | 中国旅游报 |
| 经济参考报 | industry | 经济 | jjckb.cn | 经济参考报 |
| 健康报 | industry | 卫生健康 | jkb.com.cn | 健康报 |
| 中国教育报 | industry | 教育 | jyb.cn | 中国教育报 |
| 中国消费者报 | industry | 消费 | ccn.com.cn | 中国消费者报 |
| 中国建设报 | industry | 住建 | chinajsb.cn | 中国建设报 |

### 4.3 重庆省市级（8 条）— `chongqing-municipal.ts`

| outlet_name | tier | region | domains | public_account_names |
|---|---|---|---|---|
| 重庆日报 | provincial_municipal | 重庆 | cqrb.cn, cqdsw.cn | 重庆日报 |
| 华龙网 | provincial_municipal | 重庆 | cqnews.net, hualongw.com | 华龙网 |
| 上游新闻 | provincial_municipal | 重庆 | cqcb.com | 上游新闻 |
| 重庆广电 | provincial_municipal | 重庆 | cbg.cn | 重庆广电, 第 1 眼新闻 |
| 重庆晚报 | provincial_municipal | 重庆 | cqwb.com.cn | 重庆晚报 |
| 重庆发布 | provincial_municipal | 重庆 | （政务，无独立官网） | 重庆发布 |
| 美丽重庆 | provincial_municipal | 重庆 | （行业 + 政务）| 美丽重庆 |
| 第 1 眼新闻 | provincial_municipal | 重庆 | 1tv.com.cn | 第 1 眼新闻 |

### 4.4 重庆 40 区县融媒（40 条）— `chongqing-district.ts`

按 `research_cq_districts` 表的 40 个区县 1:1 配置 `{区县名}发布` 公众号 + 区县融媒中心官网域名（域名由实施时调研填入；V1 允许 domains 为空数组，仅靠 public_account_names 识别）。

| 序号 | outlet_name | tier | region | district | public_account_names |
|---|---|---|---|---|---|
| 1 | 北碚发布 | district_media | 重庆 | 北碚区 | 北碚发布, 北碚融媒 |
| 2 | 重庆两江新区 | district_media | 重庆 | 两江新区 | 重庆两江新区, 两江新区发布 |
| 3 | 渝北发布 | district_media | 重庆 | 渝北区 | 渝北发布, 渝北融媒 |
| 4 | 九龙坡发布 | district_media | 重庆 | 九龙坡区 | 九龙坡发布 |
| 5 | 云阳融媒 | district_media | 重庆 | 云阳县 | 云阳融媒, 云阳报 |
| 6 | 巴南发布 | district_media | 重庆 | 巴南区 | 巴南发布 |
| 7 | 巫山发布 | district_media | 重庆 | 巫山县 | 巫山发布, 神女天下 |
| 8 | 涪陵发布 | district_media | 重庆 | 涪陵区 | 涪陵发布 |
| 9 | 奉节发布 | district_media | 重庆 | 奉节县 | 奉节发布 |
| 10 | 江津融媒 | district_media | 重庆 | 江津区 | 江津融媒, 几江发布 |
| 11 | 梁平融媒 | district_media | 重庆 | 梁平区 | 梁平发布, 梁平融媒 |
| 12 | 忠州新闻 | district_media | 重庆 | 忠县 | 忠州新闻, 忠县发布 |
| 13 | 渝中报 | district_media | 重庆 | 渝中区 | 渝中报, 渝中发布 |
| 14 | 长寿发布 | district_media | 重庆 | 长寿区 | 长寿发布, 长寿日报 |
| 15 | 开州融媒 | district_media | 重庆 | 开州区 | 开州融媒, 开州日报 |
| 16 | 黔江发布 | district_media | 重庆 | 黔江区 | 黔江发布, 黔江日报 |
| 17 | 南岸时报 | district_media | 重庆 | 南岸区 | 南岸发布, 南岸时报 |
| 18 | 南川报 | district_media | 重庆 | 南川区 | 南川发布, 南川报 |
| 19 | 大渡口发布 | district_media | 重庆 | 大渡口区 | 大渡口发布 |
| 20 | 永川发布 | district_media | 重庆 | 永川区 | 永川发布 |
| 21 | 沙坪坝发布 | district_media | 重庆 | 沙坪坝区 | 沙坪坝发布, 沙磁汇 |
| 22 | 璧山报 | district_media | 重庆 | 璧山区 | 璧山报, 璧山发布 |
| 23 | 万州发布 | district_media | 重庆 | 万州区 | 万州发布, 平湖万州 |
| 24 | 秀山发布 | district_media | 重庆 | 秀山县 | 秀山发布 |
| 25 | 江北发布 | district_media | 重庆 | 江北区 | 江北发布, 时尚江北 |
| 26 | 丰都发布 | district_media | 重庆 | 丰都县 | 丰都发布 |
| 27 | 铜梁报 | district_media | 重庆 | 铜梁区 | 铜梁报, 铜梁发布 |
| 28 | 万盛发布 | district_media | 重庆 | 万盛经开区 | 万盛发布 |
| 29 | 合川发布 | district_media | 重庆 | 合川区 | 合川发布 |
| 30 | 潼南发布 | district_media | 重庆 | 潼南区 | 潼南发布 |
| 31 | 西部科学城 | district_media | 重庆 | 科学城重庆高新区 | 西部科学城重庆高新区, 重庆高新区 |
| 32 | 城口发布 | district_media | 重庆 | 城口县 | 城口发布 |
| 33 | 彭水报 | district_media | 重庆 | 彭水县 | 彭水报, 彭水发布 |
| 34 | 武隆发布 | district_media | 重庆 | 武隆区 | 武隆发布, 仙女武隆 |
| 35 | 垫江发布 | district_media | 重庆 | 垫江县 | 垫江发布 |
| 36 | 綦江发布 | district_media | 重庆 | 綦江区 | 綦江发布, 渝南文旅 |
| 37 | 荣昌发布 | district_media | 重庆 | 荣昌区 | 荣昌发布 |
| 38 | 酉阳报 | district_media | 重庆 | 酉阳县 | 酉阳报, 酉阳发布 |
| 39 | 大足发布 | district_media | 重庆 | 大足区 | 大足发布 |
| 40 | 石柱发布 | district_media | 重庆 | 石柱县 | 石柱发布 |

实施时由实施者补全 `domains` 字段（各区县融媒中心官网，需调研，部分区县可能没有独立官网，可留空）。

### 4.5 重庆生态环境系统（41 条）— `chongqing-eco-gov.ts`

市级 1 条 + 40 区县环保局 40 条：

| 序号 | outlet_name | tier | region | district | industry_tag |
|---|---|---|---|---|---|
| 1 | 重庆市生态环境局 | government_self_media | 重庆 | （市级）| 环境 |
| 2-41 | {区县名}生态环境局 | government_self_media | 重庆 | 各区县 | 环境 |

公众号命名规则：`重庆{区县名}生态环境` 或 `{区县名}生态环境`（实施时调研每个区县实际公众号名）。

**生成规则**：seed 文件中**不硬编码 41 条**，而是用代码遍历 `research_cq_districts` 表的 40 个区县 + 1 个市级，按统一模板生成 outlet 记录（每条 outlet_name = `{区县名}生态环境局`，public_account_names 留空数组让 Day 1-2 调研填）。这样未来区县字典变化时（如再合并/拆分）能跟随更新。

V1 接受公众号名为空（部分区县可能没有独立公众号），仅按 outlet_name 入库。

### 4.6 灌入触发

- 新组织创建时（在现有 `seedDefaultDataForOrg` 函数追加）
- 已存在组织手工触发：在新 tab `/data-collection/outlets` 加 "重新初始化字典" 按钮（受 admin 权限保护，按 outletName upsert，不删现有自定义条目）

---

## 5. Outlet Recognizer 算法

### 5.1 识别优先级链

文件位置：`src/lib/collection-hub/outlet-recognizer.ts`（新建）

```
recognizeOutlet(item: NormalizedItem, source: CollectionSource, dict: MediaOutletDictionary[]):
  → { outletId, outletTier, outletRegion } | null

优先级（从高到低）：
  1. source.outlet_id 已配置 → 直接用 source 上的 outlet
  2. URL host 匹配 dict.domains（任一）→ 命中后返回
  3. raw_metadata.author / public_account_name 匹配 dict.publicAccountNames → 命中
  4. source.default_outlet_tier / region 兜底（没绑具体 outlet 但配了默认分级）→ 仅填 tier/region，outlet_id=null
  5. 全部不命中 → 返回 null（前端显示"未分类"）
```

### 5.2 实现位置

集成进现有 `src/lib/collection-hub/writer.ts` 的 `writeCollectedItem()` 函数，**同事务**执行：

```ts
async function writeCollectedItem(input, source, tx) {
  // ... 现有去重 + 写入 collected_items 逻辑

  // 新增：识别 outlet
  const outletDict = await loadOutletDictionary(input.organizationId, tx);
  const outletInfo = recognizeOutlet(input, source, outletDict);

  // 写入时填充 outlet_id / tier / region
  await tx.insert(collectedItems).values({
    // ... 原有字段
    outletId: outletInfo?.outletId ?? null,
    outletTier: outletInfo?.outletTier ?? source.defaultOutletTier ?? null,
    outletRegion: outletInfo?.outletRegion ?? source.defaultOutletRegion ?? null,
  });
}
```

字典加载用 in-memory cache，但**不用纯 TTL**（避免 outlet CRUD 后 5 分钟内的采集项识别不到新字典）。改用 **version-stamp 失效**：

- `organizations` 表加一列 `media_outlet_dictionary_version`（int，初始 0）
- 任何 outlet 的 create / update / delete server action 完成时 `bumpVersion(orgId)`（事务内 +1）
- Writer 入库前读当前 org 的 version；若与内存缓存的 version 不一致则重新 load 字典
- 内存缓存键：`(orgId, version)`；多 worker 进程下各自维护各自的缓存（不需要共享）

这样既避免每条入库都查 DB（同 version 内只查 1 次），又保证 outlet 修改后下一条采集项立即用上新字典。

### 5.3 兜底策略

- **未识别**采集项：`outlet_id=null`，`outlet_tier=null`，`outlet_region=null` → 内容浏览页显示"未分类"
- 客户在采集项详情 drawer 可手工修正（V1 单条修正）
- "未分类"占比监控加进 `/data-collection/monitoring` 监控页（提示客户"这些 outlet 不在字典里，要不要补"）

### 5.4 同名 outlet 处理

简化策略（V1）：
- `media_outlet_dictionary` 的 unique 约束是 `(organizationId, outletName)`，所以一个 org 内不允许重名
- 实施时如客户提到"两个不同的'教育发布'公众号"，要求改名加区分（如"教育发布·重庆"和"教育发布·成都"）
- V2 再加 disambiguation 能力（按地区+主体二级匹配）

---

## 6. UI 改动

### 6.1 新 tab `/data-collection/outlets`

**入口**：在 `src/app/(dashboard)/data-collection/data-collection-tabs.tsx` 加第 4 个 tab。

**列表页**（`src/app/(dashboard)/data-collection/outlets/page.tsx` 服务端 + `outlets-client.tsx` 客户端）：

- 顶部操作行：
  - `<SearchInput />` 搜索框（按 outletName / publicAccountName / domain 模糊匹配）
  - 媒体分级 chip 多选（5 个 tier）
  - 区域下拉（重庆 / 全国 / 其他省份动态枚举）
  - 是否启用 toggle
  - 右侧「+ 新增媒体」`<Button>`、「重新初始化字典」`<Button variant="outline">`
- 主区域 `<DataTable>`：
  - 列：媒体名 / 分级（chip）/ 区域 / 区县 / 行业标签 / 域名（最多展示 2 个 + "..."）/ 公众号（最多 2 个 + "..."）/ 启用状态 / 操作
  - 操作列：编辑 / 停用 / 删除（带确认弹窗）
  - 支持按媒体名 / 分级 排序
- 底部分页（page size 50）

**编辑/新增 dialog**（`outlet-edit-dialog.tsx`）：

- 字段：
  - 媒体名 `<Input>`（必填，唯一约束）
  - 分级 `<Select>`（5 选项 + 帮助文字）
  - 区域 `<Input>`（自由文本，建议常见值下拉）
  - 区县 `<Input>`（仅 tier=district_media / government_self_media 时显示）
  - 行业标签 `<Input>`（仅 tier=industry 时显示）
  - 域名列表 `<Input>` + 加减按钮（动态行）
  - 公众号列表 `<Input>` + 加减按钮（动态行）
  - 描述 `<Textarea>`
- 用 React Hook Form + Zod 校验
- 提交走 server action `createOutlet` / `updateOutlet`

**所有按钮、输入、下拉一律走 vibetide design system 共享组件**（`<Button>` / `<Input>` / `<Select>` / `<DataTable>` / `<SearchInput>` / `<Textarea>`），不写裸 HTML 元素，遵守 CLAUDE.md "no border on clickable" 约定。

### 6.2 `/data-collection/content` 加分级筛选

文件：`src/app/(dashboard)/data-collection/content/content-client.tsx`（修改）

在现有筛选 Sheet 里追加 3 项：

- **媒体分级**：5 个 chip 多选 + "未分类" chip
- **媒体名**：`<SearchInput>` 下拉单选（按 outletName 联想搜索 mediaOutletDictionary）
- **区域**：`<Select>` 下拉单选

筛选 query 参数加 `outlet_tier` / `outlet_id` / `outlet_region`，DAL `listCollectedItems` 加对应 where 条件。

表格列加 1 列：「媒体」展示媒体名 + 分级 chip（如未识别显示灰色"未分类"）。

### 6.3 `/data-collection/sources` 详情页加 outlet 配置

文件：`src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx`（修改）

在现有"基本信息"区块加 3 个字段：

- **绑定媒体（可选）**：`<SearchInput>` 下拉选 outlet（如 source 是单一媒体的官网/公众号）
- **默认分级（兜底，当未绑媒体时用）**：`<Select>` 5 选项
- **默认区域**：`<Input>`

新建源向导 `/data-collection/sources/new` 也同步加这 3 个字段。

### 6.4 采集项详情 drawer 加"修正 outlet"

文件：`src/app/(dashboard)/data-collection/content/item-detail-drawer.tsx`（修改）

在现有内容展示下方加"识别信息"区块：

- 当前识别结果：媒体名 / 分级 / 区域（chip 形式展示）
- 「修正 outlet」按钮 → 弹出 `<SearchInput>` 下拉选 outlet → 提交走 server action `correctItemOutlet`
- 修正后该采集项的 outlet_id / tier / region 直接更新（不影响 fingerprint）

---

## 7. DAL / Server Actions

### 7.1 媒体字典 DAL

文件：`src/lib/dal/media-outlet-dictionary.ts`（新建）

```ts
listOutletsByOrg(orgId, filter): Promise<MediaOutletWithStats[]>
getOutletById(id, orgId): Promise<MediaOutlet | null>
searchOutletsByName(orgId, query): Promise<MediaOutlet[]>      // 用于下拉联想
loadOutletDictionaryCached(orgId): Promise<MediaOutlet[]>      // recognizer 用，5 分钟内存缓存
```

### 7.2 Server Actions

文件：`src/app/actions/media-outlet-dictionary.ts`（新建）

```ts
createOutlet(input)          // requireAuth + admin 权限
updateOutlet(id, input)      // 同上
deleteOutlet(id)             // 软删（is_active=false）
reseedDictionary()           // 调 seedMediaOutletDictionary，幂等 upsert
correctItemOutlet(itemId, outletId)  // 修正单条采集项的 outlet
batchRecognizeOutlets()      // 触发 Inngest 批量回填（对历史 collected_items）；requireAuth + admin 权限
```

### 7.3 Inngest 函数

文件：`src/inngest/functions/collection/outlet-batch-recognize.ts`（新建）

- 触发事件：`collection/outlet-batch-recognize.requested`
- 行为：分批扫描 `collected_items WHERE outlet_id IS NULL` 跑 recognizer 回填
- batch size：500
- 进度反馈：`collection_runs` 复用，metadata 加 `outlet_batch_recognize: true`

---

## 8. 测试范围

### 8.1 单测

新增测试文件：

- `src/lib/collection-hub/__tests__/outlet-recognizer.test.ts`
  - 优先级链 5 个分支各覆盖一个
  - URL host 匹配（含子域名 `paper.people.com.cn` 匹配 `people.com.cn`）
  - 公众号名匹配（精确匹配，不做模糊）
  - 同字典多 outlet 都命中时取首个（按 outletName 排序）
- `src/lib/dal/__tests__/media-outlet-dictionary.test.ts`
  - CRUD + 唯一约束 + 跨 org 隔离

### 8.2 集成测试

- `src/lib/dal/__tests__/collected-items.test.ts` 现有测试增强
  - 新增 case：写入采集项时 recognizer 自动填 outlet_tier
  - 新增 case：source 配了 outletId 时优先用 source.outletId
  - 新增 case：URL host 命中字典 → 填 outlet
  - 新增 case：都不命中 → outlet_id=null

### 8.3 不做（YAGNI）

- 不做 E2E 测试（4-6 天工期不够）
- 不做 UI 组件测试（手工浏览器走通即可）

---

## 9. 工期分解（4-6 天）

**总工期：5-7 工作日**（Path C 比原 Path A 改良版多 0.5 天清理 v1 outlet 系统；reviewer 反馈 Phase 1 / Phase 2 工期偏低也额外加 0.5-1 天调研 + 测试编写时间）

| Day | 任务 | 产出 |
|---|---|---|
| Day 0（半天） | 调研 40 区县融媒 + 41 区县生态环境局公众号名 + 域名 | 数据准备好 Day 2 直接灌 |
| Day 1（前半） | 清理 v1 outlet 系统（Path C）：删 3 张表 + 167 条 seed + 137 行 matcher + 9 处引用 | tsc/build 通过；研究页面暂不可用是预期 |
| Day 1（后半）-Day 2 | Schema + migration + DAL + 单测 | media_outlet_dictionary 表落地 + collected_items/sources 字段加完 + DAL 通过 |
| Day 3 | seed 文件（113 条）+ outlet_recognizer 算法 + 单测 | 字典灌入 + recognizer 通过单测 |
| Day 4（前半）| recognizer 集成 writer + writer 集成测试增强 | 入库时自动识别 + 集成测试通过 |
| Day 4（后半）-Day 5 | 新 tab `/data-collection/outlets` 列表页 + 编辑 dialog + server actions（含 version bump） | 字典维护 UI 跑通 |
| Day 6 | `/data-collection/content` 加分级筛选 + DAL join + sources 详情/新建加 outlet 字段 | 内容浏览 UI + 源配置 UI 跑通 |
| Day 7 | drawer 加修正 outlet + Inngest 批量 recognize 函数 + 浏览器人工验收 + tsc/build + 修 review issues | Wave 1 第一块完工 |

---

## 10. 验收标准

### 10.1 功能验收

- [ ] 字典 V1 灌入 113 条成功（运行 seed → DB 行数 == 113，按 5 个 tier 分组数符合预期）
- [ ] 现有 Tavily Adapter 抓取重庆日报文章 → collected_items 写入时 outlet_tier=provincial_municipal、outlet_region=重庆
- [ ] 现有 white_list Adapter 抓取人民日报文章 → outlet_tier=central
- [ ] 客户在 `/data-collection/outlets` 可新增/编辑/停用 outlet，所有按钮无边框（符合 CLAUDE.md 约定）
- [ ] 客户在 `/data-collection/content` 按"媒体分级=央级"筛选 → 仅返回 outlet_tier=central 的采集项
- [ ] 客户在采集项详情 drawer 可单条修正 outlet（修正后 outlet_id/tier/region 立即更新）
- [ ] 触发 Inngest "批量识别" → 历史 outlet_id=NULL 的采集项被回填

### 10.2 性能验收

- [ ] outlet_recognizer 单次调用 ≤ 5 ms（字典缓存命中时）
- [ ] 批量 recognize 1 万条 collected_items ≤ 10 分钟
- [ ] `/data-collection/content` 加分级筛选后查询响应 ≤ 500 ms（10 万级数据规模）

### 10.3 数据正确性验收

- [ ] 现有 `collected_items` 数据未被破坏（迁移前后行数一致，已有字段值不变）
- [ ] 字典 unique 约束生效（同 org 重名 outlet 报错）
- [ ] 跨 org 字典隔离（org A 看不到 org B 的 outlet）
- [ ] tsc --noEmit 零错
- [ ] npm run build 通过
- [ ] 新增单测全部通过

### 10.3.1 v1 outlet 系统清理验收（Path C 专属）

- [ ] `research_media_outlets` / `research_media_outlet_aliases` / `research_media_outlet_crawl_configs` 三张表已 DROP
- [ ] `mediaTierEnum` / `mediaOutletStatusEnum` 两个 enum 已 DROP
- [ ] `src/lib/research/outlet-matcher.ts` + `src/db/seed/research/media-outlets.ts` + `src/db/schema/research/media-outlets.ts` 文件已删
- [ ] 全代码库 `grep -r "researchMediaOutlets\|outletMatcher\|mediaOutlets\b" src/` 仅剩 plan 阶段未处理引用（预期 0 条）
- [ ] tsc --noEmit 零错（重点：研究模块的旧 DAL/actions 引用旧表要么删要么 stub）

### 10.4 UI 验收

- [ ] `/data-collection/outlets` 页面在浏览器手工走一遍：列表 / 搜索 / 筛选 / 新增 / 编辑 / 停用 / 删除
- [ ] 所有交互组件（按钮 / 输入 / 下拉 / chip）无边框（按 CLAUDE.md 约定）
- [ ] 移动端 viewport（375 × 667）下表格能正常滚动

---

## 11. 留待 plan 阶段细化的开放问题

| # | 问题 | 解决方式 |
|---|---|---|
| 1 | 各区县融媒域名调研 | plan 阶段安排"字典数据调研"任务（半天工时），实施时填入 |
| 2 | 各区县生态环境局公众号实际名调研 | 同上，调研后填入 chongqing-eco-gov.ts |
| 3 | 现有 `collected_items` 是否需要立刻批量 recognize | 看现有数据量；< 1 万条立刻跑，> 1 万条按 chunk 跑 |
| 4 | UI 的"重新初始化字典"按钮权限控制 | 需要检查现有 RBAC 是否有 "media_dictionary:admin" 权限项；若无则新增 |
| 5 | 字典缓存失效策略 | 5 分钟 TTL vs 修改时主动 invalidate？plan 阶段实测决定 |
| 6 | Inngest 批量识别函数的并发控制 | 默认 concurrency=1，避免和 writer 抢字典缓存锁；视情况调 |

---

## 12. 进入下一步

A1 sub-spec 通过 → spec review → 用户最终 review → 进入 A1 implementation plan（用 `superpowers:writing-plans`）→ subagent-driven 实施 → review 4 角度 → 提交 → 进 A2 sub-brainstorm。
