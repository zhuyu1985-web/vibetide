# 账号分析详情页 Tab 化改造 + 数据分析模块设计

- **日期**：2026-05-24
- **状态**：Draft（待评审）
- **作者**：Zhuyu / Claude
- **目标版本**：VibeTide v0.x（含 OpenClaw 媒资分析能力）
- **关联模块**：`/account-analytics/[accountId]`
- **关联代码**：`src/app/(dashboard)/account-analytics/`、`src/lib/dal/account-analytics.ts`、`src/db/schema/{account-analytics,collected-items}.ts`、`src/inngest/functions/account-analytics/`

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
6. 后台异步任务：用 LLM 给 collected_items 打"内容分类 + 关键词"两个字段，作为类型占比和词云的底盘

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

### 4.2 Tab 状态管理

- 通过 URL `?tab=analytics` / `?tab=reports` 同步
- 默认 `analytics`
- 使用 `useSearchParams()` + `useRouter().replace()` 切换，不全量刷新
- 报告详情页"返回"按钮带 `?tab=reports`

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
  - collected_items（加 5 字段：contentCategory / categoryConfidence / keywords / annotatedAt / annotationModel）

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

- 粒度切换器：使用 `<Tabs variant="line">`，3 个选项
- 时间窗口：按日 = 7 天，按周 = 12 周，按月 = 6 个月（固定，不开放自定义）
- 右上角显示当前时间范围（只读，纯文本）

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

- 类型占比：基于 `collected_items.contentCategory`，使用近 30 天数据
- 词云：基于 `collected_items.keywords`（unnest），近 7d 或 30d 切换
- 两边 zero state：若 collected_items 还没标注，显示"内容分类中，请稍后..."

### 5.5 区块 D · 近期文章 TOP5（满宽）

```
[ 最热 | 最新 ]
┌────────────────────────────────────────────────────┐
│ [缩图] 标题........................ 🔥 29.87       │
│        摘要 (2 行截断)                               │
│        作者 · 👁 2953 · 💬 0 · 📅 2026-05-22       │
└────────────────────────────────────────────────────┘
```

- 顶部 segmented control：最热（默认，按 compositeScore 降序）/ 最新（按 publishedAt 降序）
- 数据范围：近 30 天 collected_items
- 缩图缺失时显示占位图（与 ranking-card.tsx 已有逻辑一致）
- 点击行：跳转到内容详情（如果已有路由）或弹层显示原始 sourceUrl

## 6. 平台差异化矩阵

### 6.1 指标可用性

`src/lib/account-analytics/platform-meta.ts` 扩展：

```ts
export const PLATFORM_METRIC_MATRIX = {
  douyin:     { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  kuaishou:   { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  bilibili:   { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  weibo:      { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  wechat:     { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  xiaohongshu:{ likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  tiktok:     { likes: true,  comments: true,  shares: true,  favorites: false, views: true,  compositeScore: true },
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

### 7.1 Schema：collected_items 加 5 个字段

```ts
// src/db/schema/collected-items.ts
contentCategory:           text('content_category'),                          // 8 选 1
contentCategoryConfidence: numeric('content_category_confidence', { precision: 3, scale: 2 }),  // 0~1
keywords:                  jsonb('keywords').$type<string[]>().default([]),    // 5-10 个
annotatedAt:               timestamp('annotated_at', { withTimezone: true }),
annotationModel:           text('annotation_model'),                           // e.g. "deepseek-chat"
```

- 不新建表：分类和词云聚合到 `collected_items` 上，符合"按账号聚合"的查询路径
- `annotatedAt` 用于增量回填判断：`annotated_at IS NULL OR annotated_at < content_updated_at`
- `contentCategoryConfidence < 0.5` 的分类在 UI 归到「其他」

### 7.2 分类体系（固定 8 项）

```ts
// src/lib/account-analytics/content-category.ts
export const CONTENT_CATEGORIES = [
  '时政',  // 政策、政府、官方动态
  '社会',  // 民生、突发、社会事件
  '财经',  // 商业、金融、经济
  '科技',  // 互联网、AI、产品
  '生活',  // 美食、家居、母婴、宠物
  '娱乐',  // 影视、综艺、明星、追星
  '体育',  // 赛事、运动员、健身
  '其他',  // 兜底
] as const
export type ContentCategory = typeof CONTENT_CATEGORIES[number]

export const CATEGORY_COLORS: Record<ContentCategory, string> = {
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

事件触发：collected-items/annotate.requested
Cron 触发：每天 04:00 Asia/Shanghai（在 daily-snapshot 06:00 前完成）

输入：{ orgId, accountId?, batchSize: 50 }
逻辑：
  1. 查 collected_items WHERE org_id = ? AND (annotated_at IS NULL OR annotated_at < content_updated_at)
     ORDER BY published_at DESC LIMIT 50
  2. 并行（concurrency=5）调 deepseek-chat 给每条产出：
     { category: <8选1>, categoryConfidence: 0~1, keywords: string[5..10] }
  3. 批量写回 collected_items
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
// 1. 指标 × 时间趋势
export async function getMetricSeries(opts: {
  orgId: string
  accountId: string
  granularity: 'day' | 'week' | 'month'
  metric: 'likes' | 'comments' | 'shares' | 'views' | 'favorites' | 'compositeScore'
  rangeDays: 7 | 30 | 90  // 注：实际用 7/84(12周)/180(6个月)
}): Promise<Array<{ bucket: string; value: number }>>

// 2. 发布活跃度 + 数字带
export async function getPublishActivity(opts: {
  orgId: string
  accountId: string
  granularity: 'day' | 'week' | 'month'
  rangeDays: number
}): Promise<{
  buckets: Array<{ bucket: string; publishCount: number }>
  summary: Record<string, number>  // 6 项，对应 PLATFORM_SUMMARY_CARDS
}>

// 3. 发文类型占比
export async function getCategoryDistribution(opts: {
  orgId: string
  accountId: string
  rangeDays: number
}): Promise<Array<{ category: ContentCategory; count: number }>>

// 4. 热门词云
export async function getKeywordCloud(opts: {
  orgId: string
  accountId: string
  range: '7d' | '30d'
}): Promise<Array<{ keyword: string; weight: number }>>

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

src/db/schema/collected-items.ts     # 加 5 个字段
src/db/types.ts                      # 自动派生，无需手改

src/inngest/functions/account-analytics/
└── annotate-collected-content.ts    # 新: LLM 批量分类+词提取

src/inngest/client.ts                 # 注册新函数
```

### 8.1 词云组件选型

推荐使用 `react-tagcloud`（轻量，约 10KB，npm 已稳定）。若引入失败再退到自实现（约 200 行 React，spiral 布局算法）。

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

- [ ] `collected_items` 加 5 个字段（Drizzle schema + 迁移）
- [ ] `content-category.ts` 常量
- [ ] Inngest `annotate-collected-content` 函数 + cron 04:00
- [ ] DAL `getCategoryDistribution` + `getKeywordCloud`
- [ ] CategoryDistribution + KeywordCloud 组件
- [ ] 历史数据回填脚本：`npm run db:annotate-collected-items`（一次性派发全量事件）

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
- URL `?tab=` 同步可刷新保留
- 报告详情页"返回"回到 `?tab=reports`

### 10.3 Phase 2 额外验证

- Inngest 后台任务 dry-run（10 条 collected_items）
- 抽样检查 LLM 分类合理性（人工肉眼审 30 条，准确率 ≥ 85%）
- 词云无停用词污染（"的"、"了"、"是" 等不应出现）

## 11. 风险与依赖

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| LLM 分类结果飘移（同一文本多次跑出不同分类） | 中 | 固定枚举 + temperature=0；置信度 < 0.5 归"其他" |
| 历史 collected_items 数据量大导致回填时间长 | 低 | 批次 50 条 + 自递归派发；监控 Inngest 队列 |
| `react-tagcloud` 与 Tailwind / Next.js 16 兼容性 | 低 | 先用最小示例验证；不行回退自实现 |
| 平台矩阵漏列某平台 | 中 | 增加 `unknown platform` fallback：显示所有可用指标 |
| 词云 unnest 在大数据量上性能差 | 低 | 加 GIN 索引：`CREATE INDEX ON collected_items USING gin (keywords jsonb_ops)` |
| Tab2 路由跳转后丢失 tab 状态 | 中 | 报告详情页"返回"显式 append `?tab=reports` |
| URL `?tab=` 与现有 query 参数冲突 | 低 | 使用 `useSearchParams` 的 `URLSearchParams` API 合并写入 |

## 12. 未决问题

1. ❓ **每条内容的"内容文本"应该送给 LLM 多少？** —— 当前 `collected_items` 有 `title` + `summary` 字段，是否需要拉原始正文（`content_html`）？建议先用 title + summary，准确率不够再升级
2. ❓ **词云的频率算法**：纯计数还是 TF-IDF？建议先纯计数，简单可控；后续可升级
3. ❓ **粒度切换的"按周/按月"时间窗口具体多长？** 本 spec 定 12 周 / 6 个月，开发时可微调

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
