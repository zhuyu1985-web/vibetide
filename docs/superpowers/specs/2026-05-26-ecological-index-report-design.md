# 生态文明传播指数报告模块 — Design Spec

**Date:** 2026-05-26
**Status:** Spec drafted, awaiting review
**Module path:** `/data-collection/reports`（在现有研究报告模块下新增 sourceType）
**Belongs to:** 「采集」-「研究报告」模块扩展

---

## 1. Background

### 1.1 起源

2026-05 期间，团队为西南政法大学新闻学院项目交付了《2025 年度重庆市生态文明传播指数排行榜及解读》报告。期间已落地：

- **媒体名单收敛**：基于客户提供的《副本媒体站点名单-2.xlsx》，将统计范围严格收敛为 **94 家媒体单位**（中央 4 + 行业 2 + 市级 6 + 区县融媒 41 + 区县政务 41）
- **公众活动数据**：基于客户《副本2025年线下生态宣传活动统计表(1).xlsx》解析 39 区县 × 5 主题真实数据
- **指标体系**：基于《2025年度重庆市生态文明传播指数体系.docx》明确 5 维度 × 3 子指标 = 15 个二级指标 + AHP 权重 + min-max 区间化 [65, 95]
- **3 个产出文件**：
  - `ranking-v5-2025-scope.xlsx`（19-sheet 可验证）
  - `0526-scope-2025年度...排行榜及解读.docx`（排行榜 + 39 区县评语 + 3 张图表）
  - `scope-content-2025.xlsx`（302 MB 内容池数据源）

### 1.2 当前问题

目前生成报告的工作全部用本地脚本（混合 Python + TypeScript）跑：

```
scripts/parse-activity-xlsx.py
scripts/compute-ranking-scope.ts
scripts/export-scope-xlsx.py
scripts/export-scope-content-xlsx.ts
/tmp/regen_scope_docx.py
```

这套流程：

- ❌ **不可复用**：明年（2026）或其他 org 想跑，要手工改 5 个脚本
- ❌ **不可追溯**：媒体名单和活动表的版本没沉淀到 DB，报告生成时引用的版本号无快照
- ❌ **不可协作**：客户/产品没法自助上传新名单和活动表
- ❌ **不可分享**：3 个文件只在本地，团队成员要拿要靠 IM 传

### 1.3 现有架构

`/data-collection/reports` 路径下已有完整研究报告模块（A5 spec shipped）：

- **schema**：`research_reports`（sourceType / status / aggregatesJson / wordFileUrl / excelFileUrl / parentReportId）
- **Inngest 流水线**：`research-report-generate` 7 步（concurrency=3, retries=3）
- **Storage**：`SUPABASE_STORAGE_BUCKET_REPORTS=research-reports`
- **UI**：列表（搜索 + 状态筛选）+ 详情（4 tab）

但现有仅支持 `sourceType='advanced_search'`（用户高级检索 ≤ 500 命中项 → 4 维聚合）。**指数体系报告**与之差异巨大：

| 维度 | advanced_search | ecological_index（本 spec） |
|---|---|---|
| 输入 | hitItemIds ≤ 500 | 全量稿件 + 媒体名单 + 活动表 |
| 范围 | 任意筛选 | 严格 94 家媒体 + 39 区县 |
| 算法 | COUNT + group | F = 1/Σ\|p−1/N\| + min-max + AHP |
| 维度 | 4 维聚合 | 5 一级 × 3 二级 = 15 指标 |
| 产出 | docx + xlsx + AI 解读 | 19-sheet xlsx + docx + 数据源 xlsx |
| 周期 | 一次性 | 年度（可季度/月度） |

## 2. Goals & Non-Goals

### 2.1 Goals

- ✅ 把 5 个本地脚本的完整产出能力**服务化**到 `/data-collection/reports` 模块
- ✅ 沉淀**媒体名单 + 活动数据集**两类资源为 DB 表，支持多版本管理
- ✅ 报告生成走 **Inngest 异步流水线**，与现有 `research-report-generate` 同源
- ✅ 在现有 reports 列表加 sourceType tab 区分，**最小侵入**现有 advanced_search 流程
- ✅ 详情页提供 3 个独立下载（19-sheet xlsx / 排行榜 docx / 内容池数据源 xlsx）
- ✅ 算法、解析、生成 **100% TypeScript 化**，跑 Inngest 而非依赖 Python

### 2.2 Non-Goals

- ❌ **不替换** Python 脚本即时使命（脚本继续保留在 `scripts/` 作为本地探索手段）
- ❌ **不引入** Python runtime 到服务端（避免 Vercel/serverless 不友好）
- ❌ **不做** Tableau / Power BI 风格的交互式图表（详情页用 Recharts 静态图即可）
- ❌ **不做** 历年报告自动对比（用户可手工对比，未来 Phase 5）
- ❌ **不做** 跨 org 共享名单（本 spec 限定 multi-tenant 隔离）
- ❌ **不做** 实时增量更新（每次"生成"=完整重算，不做 delta）

## 3. Architecture Overview

```
                  ┌──────────────────────────────────────┐
                  │  /data-collection/reports            │
                  │  ┌─ Tab 检索报告 (advanced_search)   │
                  │  └─ Tab 指数体系报告 (ecological_index) ← 新增
                  └────────────┬─────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
       ┌─ /reports/resources ─┐    ┌─ /reports/[id] ─┐
       │  媒体名单管理         │    │  概览/排名表/下载 │
       │  活动数据集管理        │    │  3 个独立下载    │
       └──────────────────────┘    └──────────────────┘
                    │                     ▲
                    ▼                     │
               ┌──────────────────────────┴───┐
               │  Server Actions               │
               │  - createOrUpdateScope        │
               │  - createOrUpdateActivityDS   │
               │  - createIndexReport          │
               └─────────────┬─────────────────┘
                             ▼
               ┌──────────────────────────┐
               │  Inngest                 │
               │  ecological-index-generate │
               │  (7 step pipeline)        │
               └─────────────┬─────────────┘
                             ▼
       ┌────────────┬────────────┬────────────┬────────────┐
       │ computeScope│ xlsxBuilder│ docxBuilder│ contentSrc │
       │  TS         │  @e965/xlsx│ docxtemplater│ 流式      │
       └────────────┴────────────┴────────────┴────────────┘
                             ▼
               ┌──────────────────────────┐
               │  Supabase Storage         │
               │  bucket: research-reports │
               │  - {id}/19sheet.xlsx     │
               │  - {id}/ranking.docx     │
               │  - {id}/content-source.xlsx │
               └──────────────────────────┘
```

### 3.1 模块边界

- **输入侧**（资源管理）和**输出侧**（报告生成）解耦
- 资源管理是独立子页（`/data-collection/reports/resources`），不污染报告列表
- 媒体名单可多版本、活动数据集可多版本，报告引用具体版本号 → 保证可追溯
- 计算 / 生成 100% TS 化，跑在 Inngest（与现有 `research-report-generate` 同源）

## 4. Data Model

### 4.1 新增 3 张表

#### 4.1.1 `research_media_scopes`（媒体名单版本表）

```ts
export const researchMediaScopes = pgTable(
  "research_media_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),                  // "2025 年度生态文明传播媒体名单"
    description: text("description"),
    sourceFileName: text("source_file_name"),      // "副本媒体站点名单-2(1).xlsx"
    sourceFileUrl: text("source_file_url"),        // Supabase Storage 路径
    totalUnits: integer("total_units").notNull(),  // 94
    centralCount: integer("central_count").notNull().default(0),
    industryCount: integer("industry_count").notNull().default(0),
    municipalCount: integer("municipal_count").notNull().default(0),
    districtRmtCount: integer("district_rmt_count").notNull().default(0),
    districtGovCount: integer("district_gov_count").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),  // 每 org 当前默认名单
    createdBy: uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("research_media_scopes_org_idx").on(t.organizationId, t.isDefault),
    orgNameUnique: uniqueIndex("research_media_scopes_org_name_uniq").on(t.organizationId, t.name),
  }),
);
```

**约束**：
- `(organizationId, name)` 唯一 → 同 org 不允许重名名单
- 每 org 仅允许 1 个 `isDefault=true`（业务层强制：新置默认时先 reset 其他）

#### 4.1.2 `research_media_scope_units`（名单单位明细）

```ts
export const researchMediaScopeUnits = pgTable(
  "research_media_scope_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeId: uuid("scope_id")
      .references(() => researchMediaScopes.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),                  // "央视新闻（中央广播电视总台）"
    displayName: text("display_name"),             // "中央电视台"(用户口径)
    tier: scopeUnitTierEnum("tier").notNull(),     // central|industry|municipal|district_rmt|district_gov
    districtNormalized: text("district_normalized"), // 标准 39 区县名(已合并 江北/渝北→两江)
    districtOrig: text("district_orig"),           // xlsx 原始 district 字段
    websites: text("websites").array().notNull().default(sql`'{}'::text[]`),
    wechatNames: text("wechat_names").array().notNull().default(sql`'{}'::text[]`),
    wechatGhid: text("wechat_ghid"),
    weiboUid: text("weibo_uid"),
    weiboHandle: text("weibo_handle"),
    douyinUrl: text("douyin_url"),
    kuaishouUrl: text("kuaishou_url"),
    xlsxRow: integer("xlsx_row").notNull(),        // 原 xlsx 行号(可追溯)
    resolvedOutletIds: uuid("resolved_outlet_ids").array().notNull().default(sql`'{}'::uuid[]`),
    matchedItemCount2025: integer("matched_item_count_2025").default(0),
    notes: text("notes"),                          // "江北→两江""数据全缺"等备注
  },
  (t) => ({
    scopeIdx: index("research_media_scope_units_scope_idx").on(t.scopeId, t.tier),
    scopeRowUnique: uniqueIndex("research_media_scope_units_scope_row_uniq").on(t.scopeId, t.xlsxRow),
  }),
);

export const scopeUnitTierEnum = pgEnum("scope_unit_tier", [
  "central", "industry", "municipal", "district_rmt", "district_gov",
]);
```

#### 4.1.3 `research_activity_datasets`（线下活动数据集）

```ts
export const researchActivityDatasets = pgTable(
  "research_activity_datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),                  // "2025 年线下生态宣传活动统计表"
    year: integer("year").notNull(),               // 2025
    sourceFileName: text("source_file_name"),
    sourceFileUrl: text("source_file_url"),
    districtCount: integer("district_count").notNull(),  // 39
    totalActivities: integer("total_activities").notNull(),
    activityThemes: text("activity_themes").array().notNull(),  // ['六五环境日','815全国生态日',...] 5 个
    data: jsonb("data").notNull(),                 // [{ district, themes, total, firstDate, lastDate, spanDays, freq }]
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgYearIdx: index("research_activity_datasets_org_year_idx").on(t.organizationId, t.year, t.isDefault),
    orgNameUnique: uniqueIndex("research_activity_datasets_org_name_uniq").on(t.organizationId, t.name),
  }),
);

export type ActivityDataPoint = {
  district: string;        // 区县名(标准 39)
  themes: Record<string, number>;  // { '六五环境日': 5, '815全国生态日': 1, ... }
  total: number;           // 总场数
  firstDate: string;       // ISO YYYY-MM-DD
  lastDate: string;
  spanDays: number;        // lastDate - firstDate + 1
  freq: number;            // total / spanDays
};
```

### 4.2 扩展现有 `research_reports`

```ts
// 仅新增 1 个枚举值,其余字段全部复用
sourceType: text("source_type").notNull().default("advanced_search"),
// 取值: 'advanced_search' | 'ecological_index'  ← 新

// searchSnapshot 字段做 discriminated union 扩展:
export type ReportSearchSnapshot =
  | { kind: "advanced_search"; conditions; sidebarFilter; hitItemIds; capturedAt }
  | {                          // ← 新增 kind
      kind: "ecological_index";
      scopeId: string;         // 引用某个 research_media_scopes
      activityDatasetId: string; // 引用某个 research_activity_datasets
      year: number;            // 2025
      windowStart: string;     // '2025-01-01'
      windowEnd: string;       // '2026-01-01'
      includeContentSource: boolean; // 是否同时生成 302MB 数据源
      capturedAt: string;
    };

// aggregatesJson 做 union 扩展,存计算结果:
export type AggregatesJson =
  | AdvancedSearchAggregatesJson  // 原有
  | EcologicalIndexAggregatesJson; // ← 新增

export type EcologicalIndexAggregatesJson = {
  kind: "ecological_index";
  ranked: Array<{
    rank: number;
    name: string;
    central: number;     // 已区间化得分
    industry: number;
    municipal: number;
    district: number;
    public: number;
    composite: number;   // 综合分
  }>;
  rawMedia: Record<string, Record<"central"|"industry"|"municipal"|"district", {
    count: number;
    richness: number;
    freq: number;
    topicCounts: number[];   // 16 主题各命中数
    days: number;
  }>>;
  rawPublic: Record<string, {
    count: number;
    richness: number;
    freq: number;
    themes: Record<string, number>;
    firstDate: string | null;
    lastDate: string | null;
    spanDays: number | null;
  }>;
  scaledMedia: Record<string, Record<"central"|"industry"|"municipal"|"district", {
    count: number;
    richness: number;
    freq: number;
  }>>;
  scaledPublic: Record<string, { count: number; richness: number; freq: number }>;
  stats: {
    max: number; min: number; span: number;
    mean: number; median: number; stdev: number;
    tier_high: number; tier_mid: number; tier_low: number;
  };
  generatedAt: string;
};

// 3 个独立的产出文件 URL(复用现有 + 新增 1 个):
wordFileUrl: text("word_file_url"),         // 排行榜 docx
excelFileUrl: text("excel_file_url"),       // 19-sheet 可验证 xlsx
contentSourceFileUrl: text("content_source_file_url"), // ← 新增列: 内容池数据源 xlsx
```

### 4.3 字段关系

```
research_media_scopes (1) ──┬─ (N) research_media_scope_units
                            │
                            └─ (N) research_reports (searchSnapshot.scopeId)
                                            │
research_activity_datasets ─────────────────┘ (searchSnapshot.activityDatasetId)
```

### 4.4 索引设计

- `research_media_scopes(organizationId, isDefault)` — 找 org 默认名单（hot path）
- `research_media_scope_units(scopeId, tier)` — 按 tier 拉
- `research_activity_datasets(organizationId, year, isDefault)` — 找 org 某年默认活动集
- `research_reports(organizationId, sourceType, createdAt DESC)` — 列表分类分页

### 4.5 删除策略

```sql
research_media_scopes ON DELETE CASCADE
  → research_media_scope_units ON DELETE CASCADE

-- searchSnapshot 是 jsonb 无 FK 引用,所以 server action 删除前先检查:
DELETE FROM research_media_scopes WHERE id = ?
  ↓
PRE-CHECK: SELECT COUNT(*) FROM research_reports
            WHERE searchSnapshot->>'scopeId' = '?'
              AND status IN ('pending', 'generating', 'ready')
  ↓ if > 0: 提示"已被 N 个报告引用,确认强制删除?"
```

`research_activity_datasets` 同理。

## 5. Algorithm

### 5.1 算法模块（与 Python 脚本 1:1 对齐）

新建 `src/lib/research/ecological-index/`：

```
ecological-index/
├── compute.ts           # 核心算法
├── matcher.ts           # unit → outlet_id 反查
├── xlsx-builder.ts      # 19-sheet 可验证 xlsx
├── docx-builder.ts      # 排行榜 docx
├── chart-generator.ts   # 3 张可视化图(用 chartjs-node-canvas)
├── content-exporter.ts  # 302MB 数据源 xlsx 流式导出
├── activity-parser.ts   # 活动 xlsx 解析
├── scope-parser.ts      # 媒体名单 xlsx 解析
├── types.ts             # 共享类型
└── __tests__/...
```

### 5.2 核心公式

```ts
// 权重(摘自 体系 docx P34, AHP 经一致性检验)
const TIER_WEIGHT = {
  central: 0.45,   // 中央媒体
  industry: 0.25,  // 行业媒体
  municipal: 0.15, // 市级媒体
  district: 0.08,  // 区县媒体
  public: 0.07,    // 公众行为引导
};
const SUB_WEIGHT = {
  count: 0.40,     // 报道/活动 数量
  richness: 0.30,  // 主题丰富度
  freq: 0.30,      // 传播速度
};
const SCALE_RANGE = [65, 95] as const;
const TOPIC_N = 16;   // 媒体类主题数
const ACTIVITY_N = 5; // 公众类主题数

// 主题丰富度 F = 1 / Σ |p_t − 1/N|
function richnessF(counts: number[], N: number): number {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let sumDev = 0;
  for (let i = 0; i < N; i += 1) {
    const p = (counts[i] ?? 0) / total;
    sumDev += Math.abs(p - 1 / N);
  }
  if (sumDev === 0) return N; // 完全均匀 → 上限 N
  return 1 / sumDev;
}

// min-max 区间化到 [65, 95]
function scaleToRange(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => (65 + 95) / 2); // 全等 → 80
  return values.map((v) => 65 + ((v - lo) / (hi - lo)) * 30);
}

// 加权得一级分
tierScore = scaledCount * 0.40 + scaledRichness * 0.30 + scaledFreq * 0.30;

// 综合分
composite = central * 0.45 + industry * 0.25 + municipal * 0.15
          + district * 0.08 + public * 0.07;
```

### 5.3 区县合并口径（固化）

```ts
function normalizeDistrict(name: string): string {
  if (name === "江北区" || name === "渝北区") return "两江新区";
  return name;
}
```

`research_collected_item_districts` 命中"江北区"或"渝北区"统一归到"两江新区"。

### 5.4 数据流

```
              ┌─ Step 1: load-resources ──────────────────────────┐
              │ - 读 scope (research_media_scopes + units)        │
              │ - 读 activityDataset                              │
              │ - 用 matcher.ts 反查 outlet_id 白名单             │
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 2: compute-indicators ──────────────────────┐
              │ SQL: collected_items × _districts × _topics       │
              │ WHERE outlet_id ∈ 白名单                          │
              │      AND published_at ∈ [windowStart, windowEnd)  │
              │ GROUP BY (normalizedDistrict, tier)               │
              │ → 5 一级 × 3 子 = 15 个二级原始值                 │
              │ → 区间化 + AHP 加权 → 综合分                      │
              │ → 写 aggregatesJson                               │
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 3: build-xlsx-19sheet ──────────────────────┐
              │ 用 @e965/xlsx 生成 19 sheet                       │
              │ 上传 storage → excelFileUrl                       │
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 4: build-charts ────────────────────────────┐
              │ chartjs-node-canvas 渲染 3 张 PNG                 │
              │ - 综合得分柱状图 (1920×1024)                      │
              │ - 梯队分布饼图 (1024×1024)                        │
              │ - Top 15 五类对比 (1920×1024)                     │
              │ 字体 Noto Sans CJK SC                             │
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 5: build-docx ──────────────────────────────┐
              │ docxtemplater 渲染排行榜及解读 docx               │
              │ - 39 行表格循环                                   │
              │ - 段落数字插值                                    │
              │ - 3 张图片占位                                    │
              │ - 39 个区县评语自动生成                           │
              │ 上传 storage → wordFileUrl                        │
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 6: build-content-source-xlsx ──────────────┐
              │ (仅在 includeContentSource=true 时执行)           │
              │ SELECT * FROM collected_items                     │
              │ WHERE outlet_id ∈ 白名单 AND published_at ∈ ...   │
              │ ORDER BY firstSeenAt DESC                         │
              │ → 用现有 EXPORT_COLUMN_ORDER + exportRowToOpinionRecord
              │ → 流式写入 + 分块上传 storage → contentSourceFileUrl
              └────────────────────┬──────────────────────────────┘
                                   ▼
              ┌─ Step 7: finalize ────────────────────────────────┐
              │ status='ready', completedAt=NOW()                 │
              │ event 'research/ecological-index.completed'       │
              └───────────────────────────────────────────────────┘
```

## 6. User Flows

### 6.1 资源准备

1. 用户进入 `/data-collection/reports/resources`
2. Tab A "媒体名单"：点"上传新名单" → 选 xlsx → 解析预览（94 单位/5 tier 分布）→ 确认 → 写 DB
3. Tab B "活动数据集"：同上 → 解析 39 行 × 5 主题 → 写 DB
4. 用户可标记某个为"默认"

### 6.2 生成报告

1. 用户进入 `/data-collection/reports`
2. 切到 Tab "指数体系报告" → 点"新建报告"
3. Dialog 弹出：
   - 标题（默认带年份）
   - 年份选择（默认当前年）
   - 媒体名单（下拉默认 isDefault=true）
   - 活动数据集（同上）
   - 实时显示 dry-run 预估：可匹配 outlet / 覆盖 items / 保留率
   - "同时生成数据源 xlsx" 复选框（默认勾选）
4. 点"生成报告" → 创建 `research_reports` 行 + 发送 Inngest event → 跳转详情页
5. 详情页轮询 status，5 秒一次刷新 `currentStep`

### 6.3 查看报告

1. 详情页 4 个 tab：
   - **概览**：榜首/末位 + 关键统计 + 梯队饼图 + Top 10 横条 + 3 个下载按钮
   - **综合排行**：39 行完整表（排名 / 区县 / 5 维分 / 综合）
   - **指标明细**：15 个二级指标 Collapse 折叠展示（Top 2 + 区间化得分）
   - **资源快照**：引用的 scope / dataset 版本号 + 时间窗 + 耗时

## 7. UI Design

### 7.1 列表页改造

在现有 `/data-collection/reports/page.tsx` 加 `<Tabs variant="line">`：

```tsx
<Tabs value={type} onValueChange={(v) => router.push(`?type=${v}`)}>
  <TabsList>
    <TabsTrigger value="advanced_search">检索报告 ({advCount})</TabsTrigger>
    <TabsTrigger value="ecological_index">指数体系报告 ({ecoCount})</TabsTrigger>
  </TabsList>
</Tabs>
```

新建按钮根据当前 tab 弹不同 Dialog（共用一个 `<NewReportDialog>` 组件，内部根据 sourceType 分支）。

### 7.2 资源管理页（`/data-collection/reports/resources/page.tsx`）

新建路由 + client 组件。两个 tab：媒体名单 / 活动数据集。

每个 tab 一个表格（用现有 `<DataTable>`）+ 上传 Dialog + 详情 Drawer。

### 7.3 新建指数报告 Dialog（`ecological-index-new-dialog.tsx`）

复用现有 shadcn `<Dialog>`。表单字段：标题 / 年份 / 名单 / 数据集 / 是否生成数据源。

**实时 dry-run 预估**：选完名单后，前端发起 server action `previewScopeCoverage(scopeId)`，返回：
- 匹配 outlet 数
- 2025 年覆盖 items 数
- 保留率

### 7.4 详情页（`ecological-index-detail.tsx`）

按 sourceType 在 `[id]/page.tsx` 内分支渲染：

```tsx
if (report.sourceType === "ecological_index") {
  return <EcologicalIndexDetail report={report} />;
}
// 否则沿用现有 advanced_search 详情
```

4 个 tab 用 shadcn `<Tabs variant="line">`，下载按钮用 shadcn `<Button>` + 现有 `getSignedUrl` 工具。

## 8. API Surface

### 8.1 Server Actions（`src/app/actions/research/`）

#### `media-scopes.ts`

```ts
// 上传并解析名单 xlsx,写 DB
export async function createMediaScopeFromXlsx(input: {
  name: string;
  description?: string;
  fileBase64: string;
  fileName: string;
}): Promise<{ scopeId: string; warnings: string[] }>;

// 列表 + 详情
export async function listMediaScopes(): Promise<MediaScopeSummary[]>;
export async function getMediaScopeDetail(scopeId: string): Promise<MediaScopeDetail>;

// 设默认 / 删除
export async function setMediaScopeDefault(scopeId: string): Promise<void>;
export async function deleteMediaScope(scopeId: string, force?: boolean): Promise<void>;
```

#### `activity-datasets.ts`

```ts
export async function createActivityDatasetFromXlsx(input: {
  name: string;
  year: number;
  fileBase64: string;
  fileName: string;
}): Promise<{ datasetId: string; warnings: string[] }>;
export async function listActivityDatasets(): Promise<ActivityDatasetSummary[]>;
export async function getActivityDatasetDetail(datasetId: string): Promise<ActivityDatasetDetail>;
export async function setActivityDatasetDefault(datasetId: string): Promise<void>;
export async function deleteActivityDataset(datasetId: string, force?: boolean): Promise<void>;
```

#### `ecological-index-reports.ts`

```ts
// 预估覆盖率(创建报告前调用)
export async function previewScopeCoverage(scopeId: string, year: number): Promise<{
  matchedOutletCount: number;
  itemsInScope: number;
  itemsTotal: number;
  retentionPct: number;
  byTier: { central: number; industry: number; municipal: number; district: number };
}>;

// 创建报告 + send Inngest event
export async function createEcologicalIndexReport(input: {
  title: string;
  year: number;
  scopeId: string;
  activityDatasetId: string;
  includeContentSource: boolean;
}): Promise<{ reportId: string }>;
```

### 8.2 Inngest Events

```ts
"research/ecological-index.generate": { reportId: string; organizationId: string };
"research/ecological-index.completed": { reportId: string; organizationId: string };
"research/ecological-index.failed": { reportId: string; organizationId: string; error: string };
```

### 8.3 Inngest Function

```ts
// src/inngest/functions/research/ecological-index-generate.ts
export const ecologicalIndexGenerate = inngest.createFunction(
  {
    id: "research-ecological-index-generate",
    concurrency: { limit: 2, key: "event.data.organizationId" },
    retries: 3,
  },
  { event: "research/ecological-index.generate" },
  async ({ event, step, logger }) => {
    // 7 steps (Section 5.4)
  },
);
```

## 9. Error Handling

### 9.1 错误矩阵

| 阶段 | 错误 | 策略 | 用户感知 |
|---|---|---|---|
| 名单上传 | 文件 > 5MB | 前端 reject | "文件过大,限 5MB" |
| | 列头不匹配 | ParseError + 行号 | "第 N 行缺『分级』列" |
| | 区县未命中归并 | 警告 + 标 notes | "5 个未知区县,已记 notes" |
| | DB 写入失败 | 事务回滚 | "保存失败,请重试" |
| 活动表上传 | 39 区县不全 | 拒绝 | "缺 X 个区县" |
| | 日期序号异常 | 警告但保留 | "L43 日期为 2026,可能录入错误" |
| | 主题列名不符 | 拒绝 | "主题列名不符,要求: ..." |
| 报告创建 | scopeId 不存在 | 400 | "选中的资源已删除" |
| | 同参数重复 | 允许 | 无 |
| Inngest Step 1 | 资源被并发删 | status='failed' | 详情页错误 + 重试按钮 |
| Step 2 计算 | 白名单空 | status='failed' | "未匹配到任何媒体" |
| | 39 区县 0 items | warning, 继续 | "无稿件,排名可能不准确" |
| Step 3-5 | 渲染失败 | retry 3 → 'failed' | "生成失败" |
| Step 6 | OOM | 流式预案 | 用户无感 |
| | Storage 上限 | contentSourceFileUrl=null + warning | "数据源未生成,可单独触发" |

### 9.2 状态过渡

```
pending ──Inngest start──> generating ──success──> ready
                              │
                              └──fail(retry exhausted)──> failed
```

详情页 generating 状态显示 `currentStep` 文字（如 "生成 docx 中…"），5 秒轮询。

## 10. Testing Strategy

### 10.1 单元测试（Vitest）

```
src/lib/research/ecological-index/__tests__/
├── compute.test.ts
│   - F 公式: 16 主题均匀 → F=16
│   - F 公式: 集中 1 主题 → F≈1.07
│   - min-max: 39 区县同分 → 全 80
│   - min-max: max=min 边界
│   - AHP: 权重和=1.00 sanity
│   - 综合分: 端到端 fixture
├── matcher.test.ts
│   - 公众号名精确匹配
│   - 公众号名模糊匹配
│   - 网站域名匹配
│   - outlet_name 模糊匹配
│   - 重复 ghid 冲突(西部科学城 vs 重庆日报)
│   - 同微博 UID(美丽重庆 vs 重庆市生态环境局)
├── activity-parser.test.ts
│   - Excel 日期序号 → ISO (45995 → 2025-12-15)
│   - 异常 2026 日期告警但保留
│   - 5 主题数据完整
│   - 39 区县覆盖检查
└── scope-parser.test.ts
    - 5 个 tier 分组正确
    - 江北/渝北 → 两江新区归并
    - 忠州=忠县 / 巫溪发布=巫溪县 补全
    - 公众号别名 | 分隔解析
    - 微博 URL 提取 UID
```

### 10.2 集成测试

```
src/inngest/functions/research/__tests__/
└── ecological-index-generate.test.ts
    - mock storage upload
    - 端到端 fixture: 上传 → 生成 → 验证 7 步输出
```

### 10.3 E2E（手动 + 后续 Playwright）

- 上传名单 → 看到 94 单位
- 上传活动表 → 看到 39 区县
- 生成报告 → status 流转 → 3 个下载

## 11. Migration & Deployment

### 11.1 DB Migration

```bash
npm run db:generate  # 自动生成 supabase/migrations/NNNN_ecological_index_tables.sql
npm run db:migrate
```

迁移包括：
- 3 张新表
- `research_reports.contentSourceFileUrl` 新列
- `scope_unit_tier` 新枚举

### 11.2 字体引入

- `Noto Sans CJK SC`（30MB）放 `public/fonts/`
- `chartjs-node-canvas` 用 `registerFont` 加载
- Vercel 部署需确保字体打包到 Lambda（可通过 `vercel.json` includeFiles）

### 11.3 Storage 配额

需管理员将 `research-reports` bucket 单文件上限从 50MB 调到 1GB（用 Supabase Admin API 或 dashboard）。

### 11.4 环境变量

无新增（复用现有 `SUPABASE_STORAGE_BUCKET_REPORTS`）。

### 11.5 Inngest 注册

```ts
// src/inngest/functions/research/index.ts
export { ecologicalIndexGenerate } from "./ecological-index-generate";
```

## 12. Risk & Mitigations

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Supabase Storage 50MB 限制 | 高 | 数据源 xlsx 无法上传 | P1 调高 bucket 配额至 1GB；P2 分块上传 |
| TS 端 docx 模板复杂度 | 中 | 排行榜 docx 不及 Python 完整 | 把现有 0526 docx 改 docxtemplater 模板，先做核心 |
| 图表中文字体 | 低 | 中文乱码 | 引入 `Noto Sans CJK SC` 字体 |
| Inngest 单步 30s 超时 | 中 | 302MB 生成超时 | Step 6 拆多步（拉数→分块写→上传） |
| 57k 行内存压力 | 低 | OOM | 现有脚本 1s 跑完已验证 |
| 删除被引用资源 | 中 | 报告快照失效 | 删除前 SQL 检查 + 强制确认 |
| 多人同时上传同名 | 低 | 数据冲突 | `(orgId, name)` 唯一索引 |
| 多人同年并发生成 | 低 | 算力浪费 | `concurrency: { limit: 2, key: orgId }` |

## 13. Phased Rollout

| Phase | 内容 | 估时 | 可独立部署 |
|---|---|---|---|
| **P1** | 3 张表 schema + migration + Drizzle types + `contentSourceFileUrl` 列 | 1 天 | ✓ |
| **P2** | 资源管理 UI（媒体名单 / 活动数据集 CRUD + 上传解析）+ Server Actions + DAL | 2 天 | ✓ |
| **P3** | 计算引擎 + Inngest 7 步 + 单元测试 + 字体打包 | 3 天 | ✓（后端可通过 Inngest UI 触发） |
| **P4** | Reports 列表 tab 改造 + 新建 Dialog + 详情页 4 tab + 实时预估 | 2 天 | ✓ |

**总计：8 天**（含测试 + 文档）

每个 Phase 结束需满足：
- `npx tsc --noEmit` 零错误
- `npm run build` 通过
- 已有测试通过
- 写 phase summary doc

## 14. Out of Scope（明确不做）

- Tableau 风格交互图表（用 Recharts 静态图）
- 历年报告自动对比（Phase 5 留作 future work）
- 跨 org 共享名单
- 实时增量更新（每次"生成"=完整重算）
- 替换/废弃 Python 脚本（保留作本地探索）
- Email / 站内信通知报告完成（暂不做，用户在列表页看 status）
- 报告对外公开链接 / 分享（暂不做）

## 15. ADR References

需新增 ADR：`docs/adr/2026-05-26-ecological-index-report.md`，记录：
- 嵌入现有 `/data-collection/reports` 而非独立模块
- 媒体名单做主子表，活动数据集纯 jsonb
- 算法 100% TS 化，不引 Python runtime
- 每次生成新报告，不覆盖

## 16. Open Questions

- [ ] Q1: docxtemplater 是否需要付费版（pro 支持图片占位）？开源版可能不够用，需 spike
- [ ] Q2: `chartjs-node-canvas` 在 Vercel Edge / Node Lambda 跑性能验证（local 5s 一图）
- [ ] Q3: 详情页"指标明细" tab 是否要展示完整 15 sheet 数据（数据量大），还是仅 Top 2？当前 design 选 Top 2
- [ ] Q4: 内容源 xlsx 302MB 是否可以拆为 4 个文件（中央/行业/市级/区县各一）？用户已确认默认勾选生成

## 17. Acceptance Criteria

完成本 spec 实施后，验收标准：

- ✅ 用户能在 `/data-collection/reports/resources` 上传并管理媒体名单（94 单位 + 5 tier 分布）
- ✅ 用户能在同页上传并管理活动数据集（39 区县 × 5 主题）
- ✅ 用户能在 `/data-collection/reports?type=ecological_index` 列表看到指数报告 tab
- ✅ 用户能在新建 Dialog 实时看到 outlet 匹配预估 + 保留率
- ✅ 报告生成后能在详情页看到：
  - 概览（榜首/末位 + 关键统计 + Top 10 横条 + 梯队饼图）
  - 39 行综合排名表
  - 15 个二级指标明细
  - 资源快照
  - 3 个下载按钮（19-sheet xlsx / 排行榜 docx / 数据源 xlsx）
- ✅ 单元测试覆盖：算法 / 匹配 / 解析 三大块共 ~20 个测试
- ✅ Inngest 流水线 7 步可独立触发 + 失败重试 + 失败状态正确显示

---

**Design ready for review.**
