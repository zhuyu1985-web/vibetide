# 账号分析详情页 Tab 化改造 + 数据分析模块设计

- **日期**：2026-05-24
- **状态**：Draft（待评审）
- **作者**：Zhuyu / Claude
- **目标版本**：VibeTide v0.x（含 OpenClaw 媒资分析能力）
- **关联模块**：`/account-analytics/[accountId]`
- **关联代码**：`src/app/(dashboard)/account-analytics/`、`src/lib/dal/account-analytics.ts`、`src/db/schema/{account-analytics,collection}.ts`、`src/inngest/functions/account-analytics/`

---

## 1. 背景

VibeTide 的"账号分析"模块当前已具备完整的报告生成能力（Inngest 异步流水线 + LLM 双轮归因 + 5 章 HTML 样张展示）。账号详情页 `/account-analytics/[accountId]` 目前展示：

- 账号头部（avatar + handle + 地区 + 近 30 天天数）
- 6 项 KPI 卡片
- 30 天复合得分趋势折线图
- 历史报告列表（支持按 daily/weekly/monthly/custom 筛选）

但用户在使用时反馈：详情页只能"看到报告"，无法直观看到账号自身长时间维度上的指标演化、内容类型偏好、热门话题分布、近期代表作。这些信息散落在 collected_items 表里、报告中或完全缺失，需要在详情页一站式呈现。

本次改造的目标：**在详情页上引入 Tab 切换，把"数据分析详情"与"分析报告"并列为两个一级视图**，并新建一套"数据分析" Tab，对标参考图（用户提供 5 张公众号工具图）的呈现密度，让运营能从单个账号详情页直接读懂"发什么 / 发了多少 / 哪些火 / 受众反馈"。

## 2. 目标 / 非目标

### 2.1 目标

1. 详情页常驻"账号画像区"（头部 + KPI + 30 天趋势）不变
2. 新增 Tab 切换：`数据分析` ↔ `分析报告`
3. `数据分析` Tab 内提供：
   - 按日 / 按周 / 按月统计粒度切换
   - 指标 × 时间趋势图（左指标按钮列 + 右面积折线图）
   - 发布活跃度柱状图 + 周期数字带
   - 发文类型占比（横向条形图）
   - 热门词云
   - 近期文章 TOP5（最热 / 最新切换）
4. `分析报告` Tab 内：保留现有报告列表 + 详情页路由，无任何功能性改动
5. 多平台差异化：抖音 / 小红书 / 公众号 / 微博 / B 站 / 快手 / TikTok 的可用指标按矩阵动态隐藏 UI 元素
6. 后台异步任务：用 LLM 给 collected_items 打"AIGC 内容主题分类 + 关键词"两个字段，作为类型占比和词云的底盘（与现有 `category text[]` 行业分类、与现有 research annotator 写的 topic/district 副表并存且互不覆盖）

### 2.2 非目标（Out of Scope）

- ❌ **粉丝地域画像（参考图最后一张：地图 + 城市榜）** —— 依赖 tikhub.io TikTok 粉丝画像 API，未验证是否可用。本期跳过，后期独立 spec 调研
- ❌ **"重点关注企业"列表** —— 这是垂直媒体（房产）领域专有，与 VibeTide 多领域定位不符
- ❌ **现有报告列表的视觉重构** —— Tab2 只是"把现有 UI 放进 tab 容器里"，不动样式
- ❌ **跨账号对比 / 矩阵看板** —— 本次只动详情页，列表/概览页不动
- ❌ **租户自定义分类体系** —— 本期分类枚举固定 8 项；后续如需细分，单独 spec 加二级分类
- ❌ **词云的 PNG 导出 / 截图** —— 不实现下载/分享
- ❌ **粒度切换时的历史回溯到 90+ 天** —— 本期仅 7d / 30d / 90d 三档，不开放任意区间

## 3. 用户场景

**主场景：账号运营 / 内容主理人**

1. 进入"账号分析"列表，点击某账号卡片，进入详情页
2. 顶部立即看到该账号最新 KPI 数字带和 30 天复合得分曲线
3. 切到 `数据分析` Tab：
   - 默认看"按日 + 平均阅读数"的 7 天趋势
   - 切换"按月" + "点赞数"看长周期表现
   - 滚到下方看"发文类型占比" → 知道这账号主要做时政内容
   - 看"热门词云" → 知道近期高频提到的关键词
   - 看"近期 TOP5" → 找出代表作
4. 切到 `分析报告` Tab，点开任意历史报告查看完整归因与建议（与现状一致）
5. 关闭页面前刷新，URL `?tab=analytics` 保证 tab 状态可恢复

**次场景：报告详情页返回**

报告详情页 `[accountId]/reports/[reportId]` 的"返回"按钮回到 `?tab=reports`，避免回到 Tab1 让用户重新切。

## 4. 整体架构

### 4.1 页面结构

```
┌─────────────────────────────────────────────────┐
│  常驻区（始终可见，与 tab 解耦）                    │
│  - 账号头部                                        │
│  - 6 项 KPI 卡片                                  │
│  - 30 天复合得分趋势折线图                          │
├─────────────────────────────────────────────────┤
│  Tab 切换条：[ 数据分析 ]  [ 分析报告 ]              │
├─────────────────────────────────────────────────┤
│  Tab 内容区                                        │
│  - Tab1 = data-analysis-tab.tsx（全新）            │
│  - Tab2 = 现有报告列表（移入 tab 容器，不改样式）     │
└─────────────────────────────────────────────────┘
```

### 4.2 Tab 状态管理 + URL state 边界

**URL state（刷新可恢复）**：
- `?tab=analytics` / `?tab=reports`——一级 tab，默认 `analytics`
- `?granularity=day` / `week` / `month`——区块 A/B 的粒度
- `?metric=likes` / `comments` / `shares` / `views` / `favorites` / `compositeScore`——区块 A 的指标
- `?topSort=hot` / `latest`——区块 D 的排序模式
- `?cloudRange=7d` / `30d`——词云时间窗口

**组件 state（不入 URL，组件内部 useState）**：
- 类型占比的 hover tooltip
- TOP5 列表的展开/折叠（如有）

**实现**：统一封装 `useAccountAnalyticsURLState()` hook，使用 `useSearchParams()` + `useRouter().replace()` 不刷新切换。

**报告详情页返回**：报告详情页 `[accountId]/reports/[reportId]` 的"返回"按钮显式拼 `?tab=reports`，确保返回到正确 tab。其他状态（粒度/指标）只在 tab=analytics 时存在，切到 tab=reports 时清掉避免污染。

### 4.3 数据流

```
用户切粒度 / 切指标
  ↓
client component 调用 Server Action
  ↓ getMetricSeries / getPublishActivity / getCategoryDistribution / getKeywordCloud / getRecentTopPosts
DAL 层（src/lib/dal/account-analytics.ts）
  ↓
Drizzle ORM
  ↓
PostgreSQL
  - account_daily_snapshots（已有，复用）
  - collected_items（加 4 字段：aigcContentCategory / aigcKeywords / aigcAnnotatedAt / aigcAnnotationModel；详见 §7.1）

后台并行：
Inngest cron 04:00 → annotate-collected-content → LLM 分类+词提取 → 写回 collected_items
```

## 5. Tab1「数据分析」详细布局

按效果图自上而下 4 个区块。

### 5.1 工具条（顶部）

```
┌────────────────────────────────────────────────────────────┐
│ [按日 | 按周 | 按月]         数据统计时间：05.17 - 05.24       │
└────────────────────────────────────────────────────────────┘
```

- 粒度切换器：使用 `<ToggleGroup>` / `<SegmentedControl>`（不用 `<Tabs>`，避免与 §4.1 的页面级 Tabs 嵌套）
- 时间窗口固定映射：按日 = 最近 7 天，按周 = 最近 12 周（84 天），按月 = 最近 6 个月（约 180 天）
- 右上角显示当前时间范围（只读，纯文本）
- 切换粒度时同步更新 `?granularity=` URL 参数

### 5.2 区块 A · 数据表现（指标 × 时间趋势图）

```
┌──────────┐  ┌────────────────────────────────────────┐
│ 平均阅读 │ │                                          │
│  ████    │ │            面积折线图                     │
│ 最高阅读 │ │   ╱─╲                                    │
│ 总在看数 │ │  ╱   ╲___                                │
│ 平均在看 │ │ ╱        ╲___                            │
│ 总评论数 │ │                ╲___                      │
│ 转化率   │ │   05-17  05-18  05-19  05-20  05-21      │
└──────────┘  └────────────────────────────────────────┘
```

- 左侧 6 个胶囊按钮（选中态：橙色径向渐变填充）
- 按平台动态过滤可见按钮（见 §6 矩阵）
- 默认选第一个 true 的指标
- 右侧 Recharts AreaChart：
  - X 轴：按粒度的 bucket label
  - Y 轴：自动 scale
  - 单条面积线，颜色随选中按钮的强调色（默认 `--primary` 橙）

### 5.3 区块 B · 发布活跃度 + 周期数字带

```
┌────────────────────────────────────────────────────┐
│ 每日发布量柱状图（与「按日/周/月」联动）              │
│  ▌  ▌  ▌  ▌  ▌  ▌  ▌                              │
│ 05-17 05-18 05-19 ...                              │
└────────────────────────────────────────────────────┘
┌──────┬──────┬──────┬──────┬──────┬──────┐
│  1   │  4   │  0   │ 283  │ 686  │ 172  │
│发布次数│发布篇数│10W+ │最高阅读│阅读总数│均阅读│
└──────┴──────┴──────┴──────┴──────┴──────┘
```

- 柱状图：与区块 A 同粒度同时间范围
- 数字带：6 项指标，按平台映射不同列（见 §6 PLATFORM_SUMMARY_CARDS）

### 5.4 区块 C · 发文类型占比 + 热门词云（双栏）

```
┌──────────────────────┐  ┌──────────────────────────┐
│ 横向条形图              │  │     词云（spiral 布局）    │
│ 时政 ▌▌▌▌▌  220     │  │       房产                 │
│ 社会 ▌▌▌▌    180     │  │    城市      政策          │
│ 财经 ▌▌▌      120     │  │       楼市                 │
│ 生活 ▌▌        70     │  │    房价   申请             │
│ 娱乐 ▌          35     │  │                            │
│ 其他 ▌▌        45     │  │  (近一周 | 近一月切换)      │
└──────────────────────┘  └──────────────────────────┘
```

- 类型占比：基于 `collected_items.aigc_content_category`（新字段，详见 §7.1），使用近 30 天数据
- 词云：基于 `collected_items.aigc_keywords`（新字段，unnest），近 7d 或 30d 切换；切换同步 `?cloudRange=` URL 参数
- 词云组件实现：使用 [d3-cloud](https://github.com/jasondavies/d3-cloud) 算法（约 50 行 React 包装），不引入已停更的 `react-tagcloud`。d3-cloud 是经过验证的 spiral 布局算法，npm 下载量稳定
- Phase 1 上线时（Phase 2 未启动）整个区块 C 显示常驻 zero state：「正在分析该账号内容主题，预计 24 小时内可见」+ 骨架图。Phase 2 部署后，未标注比例 > 30% 时显示「分析中（已完成 X%）」；< 30% 直接显示数据
- 两边 zero state 文案统一管理在 `src/lib/account-analytics/content-category.ts`

### 5.5 区块 D · 近期文章 TOP5（满宽）

```
[ 最热 | 最新 ]
┌────────────────────────────────────────────────────┐
│ [缩图] 标题........................ 🔥 29.87       │
│        摘要 (2 行截断)                               │
│        作者 · 👁 2953 · 💬 0 · 📅 2026-05-22       │
└────────────────────────────────────────────────────┘
```

- 顶部 segmented control（`<ToggleGroup>`，不用 `<Tabs>`）：最热（默认，按 compositeScore 降序）/ 最新（按 publishedAt 降序）；切换同步 `?topSort=` URL 参数
- 数据范围：近 30 天 collected_items
- 缩图缺失时显示占位图（与 ranking-card.tsx 已有逻辑一致）
- 点击行为（本期决策）：当前 collected_items 没有公开详情页路由，所以**本期直接外链跳转到 `sourceUrl`（target=_blank, rel=noopener noreferrer），右键菜单提供"复制链接"快捷项**。后续如果建了内容详情页（独立 spec），再改为内部跳转。

## 6. 平台差异化矩阵

### 6.1 指标可用性矩阵

矩阵反映的是**"当前 tikhub 采集器 + 现有 schema 实际能拿到的字段"**，不是平台理论上是否有这个指标。若某指标平台有但采集器没拉，按 `false` 处理，UI 不显示；后续采集器补齐字段后再翻 `true`。

矩阵的"真实来源"是 `account_daily_snapshots` 表中各平台已写入的列 + collected_items 上各 platform 实际有数据的列。spec 把矩阵作为"配置中心"明文管理：

`src/lib/account-analytics/platform-meta.ts` 扩展：

```ts
// 注：以下数值需在开发时对照 account_daily_snapshots 实际写入情况 audit 后定稿
export const PLATFORM_METRIC_MATRIX = {
  douyin:     { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  kuaishou:   { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  bilibili:   { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  weibo:      { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  wechat:     { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  xiaohongshu:{ likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  tiktok:     { likes: true,  comments: true,  shares: true,  favorites: false, views: true,  compositeScore: true },
} as const

// 未知平台 fallback：显示所有 5 项基础指标 + compositeScore
export const FALLBACK_METRIC_AVAILABILITY = {
  likes: true, comments: true, shares: true, favorites: true, views: true, compositeScore: true,
} as const
```

### 6.2 数字带 6 列按平台映射

```ts
export const PLATFORM_SUMMARY_CARDS: Record<Platform, SummaryCardSpec[]> = {
  douyin:   ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'avgEngagement'],
  kuaishou: ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalComments'],
  bilibili: ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalFavorites', 'totalShares'],
  weibo:    ['publishCount', 'totalLikes', 'maxLikes', 'avgLikes', 'totalComments', 'totalShares'],
  wechat:   ['publishCount', 'tenWPlus', 'maxReads', 'totalReads', 'avgReads', 'avgWowConversion'],
  xiaohongshu: ['publishCount', 'totalLikes', 'totalFavorites', 'avgLikes', 'totalComments', 'totalShares'],
  tiktok:   ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalShares'],
}
```

### 6.3 词云 / 类型占比与平台无关

所有平台都展示，因为分类和关键词来自内容本身（标题 + 摘要）。

## 7. 数据底盘改动

### 7.0 与现有 annotator 的关系（必读）

仓库已经存在 1 个 annotator 写 collected_items 相关数据：

- **`research/annotate-collected-item.ts`**（id: `research-annotate-collected-item`，concurrency=4）：订阅 `collection/item.created` 事件 → 调用 `matchTopicsForItem` / `matchDistrictsForItem` → 写副表 `research_collected_item_topics` 和 `research_collected_item_districts`。**不写 collected_items 主表的任何列**。
- **`research/backfill-annotate.ts`**（id: `research-backfill-annotate`，concurrency=1）：批量回填历史 collected_items 的同套副表 annotation。
- 现有 `collected_items.category text[]` 字段是行业/业务分类（来自舆情数据"公安/政务"等），由 collection adapter 写入（非 LLM），带 GIN 索引。

本次新增的 `account-analytics-annotate-content` annotator：
- **写主表的新字段**（`aigc_content_category` / `aigc_keywords` 等，详见 §7.1），不动 research 写的副表
- **不订阅** `collection/item.created`（避免与 research annotator 并发触发，且 LLM 调用成本高需要受控）
- 仅由 **cron 04:00 Asia/Shanghai 触发** + **可选手动批量回填命令**触发
- 由于和 research annotator 写的是**不同字段集合**，二者不会发生主键冲突；但理论上同一行可能被 research 的 UPDATE（如有）和本 annotator UPDATE 同时改动 —— research 当前只写副表，所以本期实际无并发竞争风险，但 §11 风险表已记录

### 7.1 Schema：collected_items 加 4 个字段

写入位置：`src/db/schema/collection.ts`（**注**：collected_items 表在 `collection.ts` 不在 `collected-items.ts`）

```ts
// src/db/schema/collection.ts — 在 collectedItems 表内追加：
aigcContentCategory: text('aigc_content_category'),                            // 单值，8 选 1 来自 §7.2 枚举
aigcKeywords:        jsonb('aigc_keywords').$type<string[]>().default([]),     // 5-10 个，LLM 提取
aigcAnnotatedAt:     timestamp('aigc_annotated_at', { withTimezone: true }),   // 增量回填基准
aigcAnnotationModel: text('aigc_annotation_model'),                            // e.g. "deepseek-chat:v3"
```

**关键命名说明**：
- 不用 `contentCategory`，而是 `aigcContentCategory`，因为表里已有 `category text[]`（行业分类），二者语义独立、含义不同，前缀 `aigc_` 明确表明这是 LLM 二次标注产物
- 不用 `keywords`，而是 `aigcKeywords`，理由同上（避免与未来某个 `keywords` 字段冲突）
- 删除原先设计的 `contentCategoryConfidence` 字段：在 prompt 中要求 LLM 必须从 8 项里选 1（包括兜底「其他」），不再依赖运行时阈值

**索引**：
```sql
CREATE INDEX collected_items_aigc_category_idx ON collected_items(organization_id, account_id, aigc_content_category);
CREATE INDEX collected_items_aigc_keywords_gin ON collected_items USING gin (aigc_keywords);
CREATE INDEX collected_items_aigc_annotated_at_idx ON collected_items(aigc_annotated_at) WHERE aigc_annotated_at IS NULL;
-- 第三个 partial index 加速"待标注"扫描
```

**为什么不新建表**：分类和关键词都是"每个 collected_item 一对一"的属性，聚合到主表上避免 JOIN，且 GIN 索引下查询性能足够。

### 7.2 分类体系（固定 8 项）

```ts
// src/lib/account-analytics/content-category.ts
// 注：这里的 "Content Category" 是 AIGC（LLM 标注）维度的内容主题分类，
// 与 collected_items.category text[] 行业分类无关。命名前缀 Aigc 明确语义。

export const AIGC_CONTENT_CATEGORIES = [
  '时政',  // 政策、政府、官方动态
  '社会',  // 民生、突发、社会事件
  '财经',  // 商业、金融、经济
  '科技',  // 互联网、AI、产品
  '生活',  // 美食、家居、母婴、宠物
  '娱乐',  // 影视、综艺、明星、追星
  '体育',  // 赛事、运动员、健身
  '其他',  // 兜底（LLM 不确定时必须选此项）
] as const
export type AigcContentCategory = typeof AIGC_CONTENT_CATEGORIES[number]

export const AIGC_CATEGORY_COLORS: Record<AigcContentCategory, string> = {
  '时政': 'hsl(0, 75%, 60%)',
  '社会': 'hsl(30, 85%, 60%)',
  '财经': 'hsl(45, 85%, 55%)',
  '科技': 'hsl(200, 80%, 55%)',
  '生活': 'hsl(150, 60%, 50%)',
  '娱乐': 'hsl(280, 70%, 60%)',
  '体育': 'hsl(180, 70%, 50%)',
  '其他': 'hsl(0, 0%, 60%)',
}
```

### 7.3 Inngest 后台任务

```
src/inngest/functions/account-analytics/annotate-collected-content.ts

Function id: account-analytics-annotate-content
  (与现有 research-annotate-collected-item / research-backfill-annotate 命名空间隔离)

事件触发：account-analytics/aigc-annotate.requested
  (使用独立事件名，不复用 collection/item.created；避免每条新内容都触发 LLM 调用)

Cron 触发：每天 04:00 Asia/Shanghai（在 daily-snapshot 06:00 前完成）
Concurrency 上限：{ limit: 5 } （与 research-annotate 的 4 错开，避免 LLM 上游过载）

输入：{ orgId, accountId?, batchSize: 50 }
逻辑：
  1. 查 collected_items WHERE org_id = ? AND aigc_annotated_at IS NULL
     ORDER BY published_at DESC LIMIT 50
  2. 并行（concurrency=5）调 deepseek-chat 给每条产出：
     { aigcCategory: <8选1>, aigcKeywords: string[5..10] }
     prompt 显式要求"必须从 8 项里选 1，无法判断时选'其他'"
  3. 批量 UPDATE collected_items SET aigc_content_category=..., aigc_keywords=...,
     aigc_annotated_at=NOW(), aigc_annotation_model='deepseek-chat:v3'
  4. 若还有未标注行，自递归派发下一批事件（链式调用，避免单次 step 超时）

成本估算：
  - 单条 ≈ 600 tokens 输入 + 50 tokens 输出
  - deepseek-chat：¥0.001 / 千 tokens 输入，¥0.002 / 千 tokens 输出
  - 单条 ≈ ¥0.0007
  - 1 万条历史 ≈ ¥7
  - 每日增量数百条 ≈ ¥0.1 / 天

复用模式：
  参照 src/lib/account-analytics/viral-attributor.ts 的 analyzeViralContent，
  相同的 generateObject + z.object() schema 验证模式。
```

### 7.4 DAL 新函数

在 `src/lib/dal/account-analytics.ts` 新增：

```ts
// 时间窗口由 granularity 决定，统一映射常量：
// day → 7 天, week → 84 天 (12 周), month → 180 天 (~6 个月)
export const GRANULARITY_WINDOW_DAYS = { day: 7, week: 84, month: 180 } as const

// 1. 指标 × 时间趋势
export async function getMetricSeries(opts: {
  orgId: string
  accountId: string
  granularity: 'day' | 'week' | 'month'
  metric: 'likes' | 'comments' | 'shares' | 'views' | 'favorites' | 'compositeScore'
}): Promise<Array<{ bucket: string; value: number }>>
  // 窗口长度由 granularity 决定，不再接受 rangeDays 参数

// 2. 发布活跃度 + 数字带（窗口同样由 granularity 决定）
export async function getPublishActivity(opts: {
  orgId: string
  accountId: string
  granularity: 'day' | 'week' | 'month'
}): Promise<{
  buckets: Array<{ bucket: string; publishCount: number }>
  summary: Record<string, number>  // 6 项，对应 PLATFORM_SUMMARY_CARDS
}>

// 3. 发文类型占比（固定近 30 天）
export async function getCategoryDistribution(opts: {
  orgId: string
  accountId: string
}): Promise<{
  buckets: Array<{ category: AigcContentCategory; count: number }>
  annotatedRatio: number  // 0~1，用于判断是否显示 zero state（< 0.7 显示"分析中"）
}>

// 4. 热门词云
export async function getKeywordCloud(opts: {
  orgId: string
  accountId: string
  range: '7d' | '30d'
}): Promise<{
  words: Array<{ keyword: string; weight: number }>
  annotatedRatio: number
}>

// 5. 近期 TOP5
export async function getRecentTopPosts(opts: {
  orgId: string
  accountId: string
  mode: 'hot' | 'latest'
  limit: 5
}): Promise<Array<{
  id: string
  title: string
  summary: string | null
  thumbnail: string | null
  score: number
  viewCount: number
  commentCount: number
  publishedAt: Date
  sourceUrl: string
}>>
```

所有函数都加 `organizationId` scope + `assertAccountAccess()` 检查，与现有 DAL 保持一致。

## 8. 组件结构 + 文件清单

```
src/app/(dashboard)/account-analytics/[accountId]/
├── page.tsx                         # 微调：并行加载 + 注入 tab 默认值
├── account-overview-client.tsx      # 重构：包 <Tabs>，把现有报告列表归入 Tab2
└── components/                       # 新
    ├── account-tabs.tsx             # Tab 状态 + URL 同步
    ├── data-analysis-tab.tsx        # Tab1 主容器
    ├── metric-trend-chart.tsx       # 区块 A: 左按钮 + 右折线
    ├── publish-activity-card.tsx    # 区块 B: 柱状 + 数字带
    ├── category-distribution.tsx    # 区块 C-左: 横向条形
    ├── keyword-cloud.tsx            # 区块 C-右: 词云
    └── recent-top-posts.tsx         # 区块 D: TOP5 列表

src/components/account-analytics/    # 共享原子组件
└── metric-pill-button.tsx           # 新: 圆角胶囊按钮

src/lib/account-analytics/
├── platform-meta.ts                  # 扩展矩阵
└── content-category.ts              # 新: 8 项分类常量 + UI 颜色映射

src/lib/dal/account-analytics.ts     # 新增 5 个 DAL 函数

src/db/schema/collection.ts          # 在已存在的 collectedItems 表内追加 4 个字段（不是新建文件）
src/db/types.ts                      # 自动派生，无需手改

src/inngest/functions/account-analytics/
└── annotate-collected-content.ts    # 新: LLM 批量分类+词提取

src/inngest/client.ts                 # 注册新函数
```

### 8.1 词云组件选型

使用 `d3-cloud`（jasondavies/d3-cloud，npm 包名 `d3-cloud`，约 5KB）作为底层 spiral 布局算法 + 自实现约 50 行 React 包装（state-driven，避免 d3 直接 mutate DOM）。

不选 `react-tagcloud` 的原因：
- 上一次发版 2021 年，React 19 兼容性未验证
- 已有 npm typing 缺失问题，需要自己写 .d.ts

`d3-cloud` 的优点：
- 经过 d3 社区长期验证
- 仅做"布局算法"，不直接操作 DOM，可以纯函数式调用
- 我们用 React 包装层 render 计算结果到 `<text>` 元素

实现伪代码（约 50 行）：
```tsx
import cloud from 'd3-cloud'
function KeywordCloud({ words }: { words: Array<{ keyword: string; weight: number }> }) {
  const [layout, setLayout] = useState<LayoutWord[]>([])
  useEffect(() => {
    cloud()
      .size([width, height])
      .words(words.map(w => ({ text: w.keyword, size: 10 + w.weight * 30 })))
      .rotate(0).font('Inter').fontSize(d => d.size)
      .on('end', setLayout).start()
  }, [words])
  return <svg width={width} height={height}>{layout.map(w => <text ...>{w.text}</text>)}</svg>
}
```

## 9. 实现节奏（分 3 个 Phase）

### Phase 1：Tab 框架 + 区块 A + 区块 B + 区块 D（无 LLM 依赖）

- [ ] 详情页 `<Tabs>` 包裹，URL 同步
- [ ] 顶部 KPI + 趋势图保留为常驻区
- [ ] 区块 A：MetricTrendChart 组件 + `getMetricSeries` DAL
- [ ] 区块 B：PublishActivityCard + `getPublishActivity` DAL
- [ ] 区块 D：RecentTopPosts + `getRecentTopPosts` DAL
- [ ] 平台矩阵扩展 + UI 动态隐藏
- [ ] Tab2「分析报告」无改动（仅把现有 reports 列表挪到 tab 容器内）

**前置数据**：完全基于现有 `account_daily_snapshots` + `collected_items`，零迁移，零 LLM 调用

**验收**：demo 账号 + 真实账号都能看到趋势图、发布活跃、TOP5

### Phase 2：区块 C 类型占比 + 词云（含 LLM 后台任务）

- [ ] `collected_items` 加 4 个字段（Drizzle schema + 迁移）：aigcContentCategory / aigcKeywords / aigcAnnotatedAt / aigcAnnotationModel
- [ ] 3 个新索引（partial index on null + GIN on keywords + 复合 index）
- [ ] `content-category.ts` AIGC_CONTENT_CATEGORIES 常量
- [ ] Inngest `account-analytics-annotate-content` 函数 + cron 04:00（独立事件 `account-analytics/aigc-annotate.requested`）
- [ ] DAL `getCategoryDistribution` + `getKeywordCloud`（返回 annotatedRatio 用于 zero state）
- [ ] CategoryDistribution + KeywordCloud 组件（d3-cloud + 50 行 React 包装）
- [ ] 历史数据回填脚本：`scripts/backfill-aigc-annotations.ts`（一次性派发全量事件，按 100 条/批）

**前置数据**：跑完批量标注 + 至少 1 个账号有 100+ collected_items 后才有意义

**验收**：在已有数据的账号上能看到类型占比和词云

### Phase 3（搁置 / 后续 spec）：地域画像

- 不在本次范围
- 独立 spec：`docs/superpowers/specs/YYYY-MM-DD-account-analytics-geo-design.md`
- 先验 tikhub.io TikTok 粉丝 API 是否真支持

## 10. 验收 / 测试计划

### 10.1 每个 Phase 完成后必跑

1. `npx tsc --noEmit` —— 类型零错误
2. `npm run build` —— 生产构建通过
3. `npm run lint` —— ESLint 零 error
4. `npm run test` —— 单测（DAL 函数 + 平台矩阵过滤逻辑）

### 10.2 手工验证

- 默认 demo 账号 `e6ae6f80-222f-456f-94df-ba1ceb6ec7c4`
- 切按日 / 周 / 月、切指标、切「最新 / 最热」均正常
- URL `?tab=` / `?granularity=` / `?metric=` / `?topSort=` / `?cloudRange=` 同步可刷新保留
- 报告详情页"返回"回到 `?tab=reports`
- **Tab2 视觉回归**：Tab2 内的报告列表必须与改造前像素级一致（人眼对比 + 关键截图 diff）。Tab 切换是"容器包裹"，不动现有 UI

### 10.3 Phase 2 额外验证

- Inngest 后台任务 dry-run（10 条 collected_items）
- 抽样检查 LLM 分类合理性（人工肉眼审 30 条，准确率 ≥ 85%）
- 词云无停用词污染（"的"、"了"、"是" 等不应出现）—— prompt 显式排除
- annotatedRatio < 70% 时区块 C 显示"分析中"骨架而非空白

## 11. 风险与依赖

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| LLM 分类结果飘移（同一文本多次跑出不同分类） | 中 | 固定枚举 + temperature=0；prompt 强制要求从 8 项中选 1，无法判断时选"其他" |
| 历史 collected_items 数据量大导致回填时间长 | 低 | 批次 50 条 + 自递归派发；监控 Inngest 队列 |
| `d3-cloud` + React 19 + Next.js 16 兼容性 | 低 | d3-cloud 是纯算法库，不依赖 DOM，React 包装层我们自己写；最坏情况退到静态布局列表（非词云） |
| 平台矩阵漏列某平台 | 中 | 增加 `unknown platform` fallback：显示所有 6 项指标 |
| 词云 `unnest jsonb_array_elements_text(aigc_keywords)` 在大数据量上性能差 | 低 | 加 GIN 索引：`CREATE INDEX collected_items_aigc_keywords_gin ON collected_items USING gin (aigc_keywords)`；查询时 LIMIT 30 |
| Tab2 路由跳转后丢失 tab 状态 | 中 | 报告详情页"返回"显式 append `?tab=reports` |
| URL `?tab=` 与现有 query 参数冲突 | 低 | 使用 `useSearchParams` 的 `URLSearchParams` API 合并写入 |
| **与现有 research annotator 并发写同一行** | 低 | 二者写不同字段集合（research 写副表，本 annotator 写主表新字段），实际无冲突；但若 research 后续扩展写主表则需要重新审视。监控：Drizzle UPDATE 时仅 SET 所需列，避免覆盖 |
| **`category text[]` 已存在导致命名混淆** | 中 | 强制命名前缀 `aigc_`；在 schema 注释中互相指向；spec §7.0 显式说明 |
| **新增 4 个字段不向后兼容** | 低 | 字段允许 NULL，分类/词云模块在 NULL 时显示 zero state；不破坏现有 SELECT * |

## 12. 未决问题

1. ❓ **每条内容的"内容文本"应该送给 LLM 多少？** —— 当前 `collected_items` 有 `title`，正文在副表 `collected_item_contents.content`，OCR/ASR 在同副表。建议先用 title + content 前 500 字 + matched_keywords，准确率不够再升级到全文 + OCR/ASR
2. ❓ **词云的频率算法**：纯计数还是 TF-IDF？建议先纯计数 + 全局停用词表（约 50 个高频中文停用词），简单可控；后续可升级
3. ❓ **粒度切换的"按周/按月"窗口长度**：本 spec 定 84 天 / 180 天，开发时可微调
4. ❓ **`account_daily_snapshots` 实际是否真的写入了所有 5 项指标**？需要在 Phase 1 开发前 audit 抽查 3 个平台账号的 snapshot 行，确认 likes/comments/shares/favorites/views 都有数据；若有缺失则更新 §6.1 矩阵
5. ❓ **报告详情页返回逻辑是否需要历史栈**？目前是显式 `?tab=reports`，是否要 `router.back()` 自动？建议保守用显式，避免浏览器历史栈干扰

## 13. 后续工作

- 独立 spec：账号粉丝地域画像（TikTok 优先）
- 跨账号对比看板（基于本期的统一 DAL）
- 报告 PDF 导出（含 Tab1 数据）
- 类型占比的"二级分类"（如时政可细分为政策/会议/外事）

---

**附录 A：参考图说明**

用户提供 5 张参考图（公众号工具截图）：

1. 顶部 KPI 数字带 + 数据表现（左指标按钮 + 右折线图）→ 对应 §5.1 + §5.2
2. 榜单排行（日榜柱状图 + 概览数字带）→ 对应 §5.3
3. 发文类型占比（条形图）+ 热门词云 → 对应 §5.4
4. 近期文章 TOP5 + 重点关注企业 → 对应 §5.5（企业列表跳过）
5. 重点关注城市（地图 + 城市榜）→ 跳过，§2.2 已说明
