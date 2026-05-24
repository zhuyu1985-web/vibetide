# 账号分析详情页 Tab 化改造 + 数据分析模块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/account-analytics/[accountId]` 详情页引入 Tab 切换，并新增"数据分析"标签页（指标趋势 / 发布活跃度 / 类型占比 / 词云 / 近期 TOP5），同时保持现有"分析报告"标签页不动。

**Architecture:** 三层：顶部账号画像（KPI+趋势）常驻 → 中间一级 Tab 切换（数据分析 / 分析报告）→ 底部 Tab1 含 4 个区块。新数据基于现有 `account_daily_snapshots` + `collected_items`；Phase 2 加 4 个 `aigc_` 前缀字段做 LLM 分类与词云。

**Tech Stack:** Next.js 16 App Router (Server Components 优先 / 'use client' 仅交互层) · React 19 · Drizzle ORM + Postgres · Recharts (面积+柱状) · d3-cloud (词云) · Inngest (LLM 后台任务) · DeepSeek API (分类+关键词) · Vitest (DAL 单测)

**关联 Spec：** `docs/superpowers/specs/2026-05-24-account-analytics-tab1-redesign-design.md`

**分 Phase：**
- **Phase 0** — Pre-flight Audit（验证 §6.1 矩阵和 snapshots 实际数据）
- **Phase 1** — Tab 框架 + 区块 A/B/D（零 LLM 依赖）
- **Phase 2** — 区块 C 类型占比 + 词云（含 LLM 标注 pipeline）
- **Phase 3** — 搁置（地域画像，独立 spec）

---

## Phase 0 · Pre-flight Audit

### Task 0.1: Audit `account_daily_snapshots` 实际指标覆盖

**为什么：** spec §12 未决问题 #4 要求开发前确认现有 snapshots 各平台是否真写入了 likes/comments/shares/favorites/views 五项，避免 §6.1 矩阵把"false 错填成 true"。

**Files:**
- 仅 SQL 查询，不动代码
- Output: 在本 plan 中记录结果

- [ ] **Step 1: 跑 SQL 抽样**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
npx tsx -e "
import { db } from './src/db';
import { accountDailySnapshots } from './src/db/schema/account-analytics';
import { myAccounts } from './src/db/schema/account-analytics';
import { benchmarkAccounts } from './src/db/schema/account-analytics';
import { sql } from 'drizzle-orm';

(async () => {
  const rows = await db.execute(sql\`
    SELECT
      COALESCE(ma.platform, ba.platform) AS platform,
      COUNT(*) AS snapshot_count,
      AVG(CASE WHEN s.total_likes > 0 THEN 1 ELSE 0 END) AS likes_coverage,
      AVG(CASE WHEN s.total_comments > 0 THEN 1 ELSE 0 END) AS comments_coverage,
      AVG(CASE WHEN s.total_shares > 0 THEN 1 ELSE 0 END) AS shares_coverage,
      AVG(CASE WHEN s.total_favorites > 0 THEN 1 ELSE 0 END) AS favorites_coverage,
      AVG(CASE WHEN s.total_views > 0 THEN 1 ELSE 0 END) AS views_coverage
    FROM account_daily_snapshots s
    LEFT JOIN my_accounts ma ON s.account_id = ma.id
    LEFT JOIN benchmark_accounts ba ON s.account_id = ba.id
    WHERE s.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY COALESCE(ma.platform, ba.platform)
    ORDER BY snapshot_count DESC
  \`);
  console.table(rows);
  process.exit(0);
})();
"
```

Expected output: per-platform coverage 0.0~1.0。低于 0.5 视为该平台该指标"无数据"。

- [ ] **Step 2: 记录结果**

把表格粘到本 plan 末尾的"附录 A: Audit 结果"中。若某平台某项指标 coverage < 0.5，对应到 Task 1.1 中把 `PLATFORM_METRIC_MATRIX[platform].<metric>` 标 false。

- [ ] **Step 3: Commit audit script（如有新建脚本）**

```bash
git add scripts/audit-snapshots-coverage.ts 2>/dev/null  # 如果保存了脚本
# 若只是一次性查询，不提交
```

---

## Phase 1 · Tab 框架 + 区块 A/B/D（零 LLM）

### Task 1.1: 扩展 `platform-meta.ts` 增加指标矩阵与数字带映射

**前置依赖：必须先跑完 Task 0.1 audit，把附录 A 表格填完，再来填本任务的 `PLATFORM_METRIC_MATRIX` 各项 boolean。**

**Files:**
- Modify: `src/lib/account-analytics/platform-meta.ts`（在文件末尾追加，不动现有导出）

- [ ] **Step 0: 用 Task 0.1 audit 结果回填 PLATFORM_METRIC_MATRIX 默认值**

打开附录 A 表格，对每个平台每个指标的 coverage：
- `≥ 0.5` → 标 `true`
- `< 0.5` → 标 `false`

下面的 boolean 是开发占位，必须替换为 audit 结果。

- [ ] **Step 1: 在文件末尾追加常量**

```ts
// ─── 指标可用性矩阵（Spec §6.1）─────────────────────────────────────
// 表示"当前 tikhub 采集器 + account_daily_snapshots 实际能拿到的字段"，
// 而非平台理论上是否有该指标。Audit 见 Task 0.1。
export const METRIC_KEYS = ['likes', 'comments', 'shares', 'favorites', 'views', 'compositeScore'] as const
export type MetricKey = typeof METRIC_KEYS[number]

export const METRIC_LABELS: Record<MetricKey, string> = {
  likes: '点赞数',
  comments: '评论数',
  shares: '转发数',
  favorites: '收藏数',
  views: '播放/阅读数',
  compositeScore: '综合得分',
}

export type PlatformMetricMatrix = Record<MetricKey, boolean>

// 默认开发态值——必须用 Phase 0 Audit 结果回填后才能合入 main
export const PLATFORM_METRIC_MATRIX: Partial<Record<Platform, PlatformMetricMatrix>> = {
  douyin:      { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  kuaishou:    { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  bilibili:    { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  weibo:       { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  wechat:      { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  wechat_oa:   { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  wechat_channels: { likes: true, comments: true, shares: false, favorites: false, views: true, compositeScore: true },
  xiaohongshu: { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
}

export const FALLBACK_METRIC_AVAILABILITY: PlatformMetricMatrix = {
  likes: true, comments: true, shares: true, favorites: true, views: true, compositeScore: true,
}

export function getMetricAvailability(platform: string): PlatformMetricMatrix {
  return PLATFORM_METRIC_MATRIX[platform as Platform] ?? FALLBACK_METRIC_AVAILABILITY
}

// ─── 数字带 6 列按平台映射（Spec §6.2）─────────────────────────────
export const SUMMARY_KEYS = [
  'publishCount', 'totalLikes', 'totalComments', 'totalShares', 'totalFavorites', 'totalViews',
  'maxLikes', 'avgLikes', 'maxViews', 'avgViews',
] as const
export type SummaryKey = typeof SUMMARY_KEYS[number]

export const SUMMARY_LABELS: Record<SummaryKey, string> = {
  publishCount: '发布数',
  totalLikes: '总点赞',
  totalComments: '总评论',
  totalShares: '总转发',
  totalFavorites: '总收藏',
  totalViews: '总播放',
  maxLikes: '最高点赞',
  avgLikes: '平均点赞',
  maxViews: '最高播放',
  avgViews: '平均播放',
}

export const PLATFORM_SUMMARY_CARDS: Partial<Record<Platform, SummaryKey[]>> = {
  douyin:      ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalShares'],
  kuaishou:    ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  bilibili:    ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalFavorites', 'totalShares'],
  weibo:       ['publishCount', 'totalLikes',     'maxLikes',       'avgLikes',  'totalComments',  'totalShares'],
  wechat:      ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  wechat_oa:   ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  wechat_channels: ['publishCount', 'totalViews', 'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  xiaohongshu: ['publishCount', 'totalLikes',     'totalFavorites', 'avgLikes',  'totalComments',  'totalShares'],
}

export const FALLBACK_SUMMARY_CARDS: SummaryKey[] =
  ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalComments']

export function getSummaryCards(platform: string): SummaryKey[] {
  return PLATFORM_SUMMARY_CARDS[platform as Platform] ?? FALLBACK_SUMMARY_CARDS
}

// ─── 粒度 → 窗口长度（Spec §7.4）───────────────────────────────────
export const GRANULARITY_WINDOW_DAYS = { day: 7, week: 84, month: 180 } as const
export type Granularity = keyof typeof GRANULARITY_WINDOW_DAYS
export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: '按日', week: '按周', month: '按月',
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误。

- [ ] **Step 3: Commit**

```bash
git add src/lib/account-analytics/platform-meta.ts
git commit -m "feat(account-analytics): 扩展 platform-meta 加指标矩阵 / 数字带 / 粒度常量"
```

---

### Task 1.2: DAL `getMetricSeries` + 测试

**Files:**
- Modify: `src/lib/dal/account-analytics.ts`（在文件末尾追加新 export，不动现有函数）
- Modify: `src/lib/dal/__tests__/account-analytics.test.ts`（不存在则创建）

- [ ] **Step 1: 先写测试**

Create or extend `src/lib/dal/__tests__/account-analytics.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { organizations } from '@/db/schema'
// ⚠️ myAccounts 在 topic-compare-v2.ts，不在 account-analytics.ts
import { myAccounts } from '@/db/schema/topic-compare-v2'
import { accountDailySnapshots } from '@/db/schema/account-analytics'
import { eq, inArray } from 'drizzle-orm'
import { getMetricSeries } from '../account-analytics'

let orgId: string
let accountId: string

beforeAll(async () => {
  const ts = Date.now()
  const [org] = await db.insert(organizations).values({
    name: 'ci-metric-series',
    slug: `ci-metric-${ts}`,
  }).returning()
  orgId = org.id

  const [acc] = await db.insert(myAccounts).values({
    organizationId: orgId,
    platform: 'douyin',
    handle: 'test_handle',
    name: 'Test Account',
  }).returning()
  accountId = acc.id

  // 插 5 天 snapshots
  const today = new Date()
  for (let i = 0; i < 5; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    await db.insert(accountDailySnapshots).values({
      organizationId: orgId,
      accountId,
      snapshotDate: d.toISOString().slice(0, 10),
      postCount: 1,
      totalLikes: 100 * (i + 1),
      totalComments: 10 * (i + 1),
      totalShares: 5 * (i + 1),
      totalViews: 1000 * (i + 1),
      totalFavorites: 3 * (i + 1),
      compositeScoreTotal: '50.0',
      compositeScoreAvg: '50.0',
    })
  }
})

afterAll(async () => {
  await db.delete(accountDailySnapshots).where(eq(accountDailySnapshots.accountId, accountId))
  await db.delete(myAccounts).where(eq(myAccounts.id, accountId))
  await db.delete(organizations).where(eq(organizations.id, orgId))
})

describe('getMetricSeries', () => {
  it('返回按日粒度的 likes 序列', async () => {
    const series = await getMetricSeries({
      orgId, accountId, granularity: 'day', metric: 'likes',
    })
    expect(series.length).toBeGreaterThanOrEqual(5)
    expect(series.every((p) => typeof p.bucket === 'string' && typeof p.value === 'number')).toBe(true)
    // 升序排列
    expect(series[0].bucket <= series[series.length - 1].bucket).toBe(true)
  })

  it('未知 metric 抛 error', async () => {
    await expect(
      getMetricSeries({
        orgId, accountId, granularity: 'day',
        // @ts-expect-error 故意传无效值
        metric: 'invalid',
      }),
    ).rejects.toThrow()
  })

  it('跨 org 无数据返回空数组', async () => {
    const otherOrgId = randomUUID()  // 随机生成（node:crypto），保证查不到任何数据
    const series = await getMetricSeries({
      orgId: otherOrgId, accountId, granularity: 'day', metric: 'likes',
    })
    expect(series).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试看 FAIL**

Run: `npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getMetricSeries"`
Expected: FAIL — "getMetricSeries is not a function"

- [ ] **Step 3: 实现 DAL 函数**

⚠️ **Drizzle SQL 写法约定**：项目用 `sql\`...\`` tagged template（自动参数化）。**不要**用 `db.execute(sql.raw(...), [bindings])`——Drizzle `db.execute()` 只接受单个 `SQL` 对象，没有 bindings 第二参数。identifier（列名、time unit）用 `sql.raw()` 内嵌**前先做白名单校验**避免注入。参考 `src/lib/dal/account-analytics.ts:296,650` 已有写法。

Append to `src/lib/dal/account-analytics.ts`:

```ts
import { sql } from 'drizzle-orm'
import { GRANULARITY_WINDOW_DAYS, type Granularity, type MetricKey } from '@/lib/account-analytics/platform-meta'

// 列名白名单（杜绝注入）；改 sql.raw 前先 lookup
const METRIC_COLUMN_MAP: Record<MetricKey, string> = {
  likes:          'total_likes',
  comments:       'total_comments',
  shares:         'total_shares',
  favorites:      'total_favorites',
  views:          'total_views',
  compositeScore: 'composite_score_total',
}
const TRUNC_UNIT_MAP: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' }

export async function getMetricSeries(opts: {
  orgId: string
  accountId: string
  granularity: Granularity
  metric: MetricKey
}): Promise<Array<{ bucket: string; value: number }>> {
  const { orgId, accountId, granularity, metric } = opts
  const column = METRIC_COLUMN_MAP[metric]
  if (!column) throw new Error(`Unknown metric: ${metric}`)
  const truncUnit = TRUNC_UNIT_MAP[granularity]
  const windowDays = GRANULARITY_WINDOW_DAYS[granularity]

  const rows = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${truncUnit}, snapshot_date), 'YYYY-MM-DD') AS bucket,
      COALESCE(SUM(${sql.raw(column)}), 0)::float AS value
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
    GROUP BY DATE_TRUNC(${truncUnit}, snapshot_date)
    ORDER BY bucket ASC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    bucket: String(r.bucket),
    value: Number(r.value ?? 0),
  }))
}
```

- [ ] **Step 4: 再跑测试看 PASS**

Run: `npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getMetricSeries"`
Expected: 3 passed

- [ ] **Step 5: tsc + lint**

```bash
npx tsc --noEmit
npm run lint -- --max-warnings 0 src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
```
Expected: 零 error

- [ ] **Step 6: Commit**

```bash
git add src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
git commit -m "feat(account-analytics): DAL getMetricSeries 支持按粒度查询单指标序列"
```

---

### Task 1.3: DAL `getPublishActivity` + 测试

**Files:**
- Modify: `src/lib/dal/account-analytics.ts`
- Modify: `src/lib/dal/__tests__/account-analytics.test.ts`

- [ ] **Step 1: 先写测试**

Append to existing test file:

```ts
import { getPublishActivity } from '../account-analytics'

describe('getPublishActivity', () => {
  it('返回 buckets + summary 6 项', async () => {
    const result = await getPublishActivity({
      orgId, accountId, granularity: 'day',
    })
    expect(result.buckets.length).toBeGreaterThan(0)
    expect(result.buckets[0]).toMatchObject({
      bucket: expect.any(String),
      publishCount: expect.any(Number),
    })
    // 平台 douyin 对应 6 列：publishCount/totalViews/maxViews/avgViews/totalLikes/totalShares
    expect(Object.keys(result.summary).sort()).toEqual(
      ['avgViews', 'maxViews', 'publishCount', 'totalLikes', 'totalShares', 'totalViews'].sort(),
    )
  })
})
```

- [ ] **Step 2: 跑测试看 FAIL**

Run: `npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getPublishActivity"`
Expected: FAIL

- [ ] **Step 3: 实现**

Append to `src/lib/dal/account-analytics.ts`:

```ts
import { getSummaryCards, type SummaryKey } from '@/lib/account-analytics/platform-meta'

// 关键决策：不在 DAL 里查 platform。page.tsx 已经加载了 account 对象（含 platform），
// 上层传入更简单，也避免 my_accounts/benchmark_accounts 跨表 JOIN（两表在 topic-compare-v2.ts）。

export async function getPublishActivity(opts: {
  orgId: string
  accountId: string
  platform: string  // 由上层传入
  granularity: Granularity
}): Promise<{
  buckets: Array<{ bucket: string; publishCount: number }>
  summary: Partial<Record<SummaryKey, number>>
}> {
  const { orgId, accountId, platform, granularity } = opts
  const windowDays = GRANULARITY_WINDOW_DAYS[granularity]
  const truncUnit = TRUNC_UNIT_MAP[granularity]
  const cards = getSummaryCards(platform)

  const bucketRows = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${truncUnit}, snapshot_date), 'YYYY-MM-DD') AS bucket,
      COALESCE(SUM(post_count), 0)::int AS publish_count
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
    GROUP BY DATE_TRUNC(${truncUnit}, snapshot_date)
    ORDER BY bucket ASC
  `) as unknown as Array<Record<string, unknown>>

  const sumRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(post_count), 0)::int AS publish_count,
      COALESCE(SUM(total_likes), 0)::bigint AS total_likes,
      COALESCE(SUM(total_comments), 0)::bigint AS total_comments,
      COALESCE(SUM(total_shares), 0)::bigint AS total_shares,
      COALESCE(SUM(total_favorites), 0)::bigint AS total_favorites,
      COALESCE(SUM(total_views), 0)::bigint AS total_views,
      COALESCE(MAX(total_likes), 0)::int AS max_likes,
      COALESCE(MAX(total_views), 0)::int AS max_views,
      COALESCE(AVG(NULLIF(total_likes, 0)), 0)::int AS avg_likes,
      COALESCE(AVG(NULLIF(total_views, 0)), 0)::int AS avg_views
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
  `) as unknown as Array<Record<string, unknown>>
  const sumRow = sumRows[0] ?? {}

  const summary: Partial<Record<SummaryKey, number>> = {}
  for (const key of cards) {
    const sqlKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
    summary[key] = Number(sumRow[sqlKey] ?? 0)
  }

  return {
    buckets: bucketRows.map((r) => ({
      bucket: String(r.bucket),
      publishCount: Number(r.publish_count ?? 0),
    })),
    summary,
  }
}
```

**注**：调用方需要同步更新——Task 1.10 中 `loadPublishActivityAction` 加 `platform` 参数；Task 1.11 上层 page.tsx 已有 `account.platform`，传下来即可。

- [ ] **Step 4: 跑测试看 PASS**

```bash
npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getPublishActivity"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
git commit -m "feat(account-analytics): DAL getPublishActivity 返回发布活跃度 + 数字带"
```

---

### Task 1.4: DAL `getRecentTopPosts` + 测试

**Files:**
- Modify: `src/lib/dal/account-analytics.ts`
- Modify: `src/lib/dal/__tests__/account-analytics.test.ts`

- [ ] **Step 1: 先写测试（含 collected_items fixture）**

⚠️ **collected_items 类型与 NOT NULL 字段速查表**（来自 `src/db/schema/collection.ts:61-160`）：

| 字段 | 类型 | NOT NULL | 默认 |
|---|---|---|---|
| `id` | uuid | ✓ | gen_random_uuid() |
| `organizationId` | uuid | ✓ | — |
| **`accountId`** | **text**（注意不是 uuid！） | optional | NULL |
| `contentFingerprint` | text | ✓ | — （unique 约束 `(org, fp)`）|
| `title` | text | ✓ | — |
| `firstSeenChannel` | text | ✓ | — |
| `firstSeenAt` | timestamptz | ✓ | — |
| `sourceChannels` | jsonb | ✓ | `'[]'` |
| `category` | text[] | ✓ | `ARRAY[]::text[]` |
| `derivedModules` | text[] | ✓ | `ARRAY[]::text[]` |
| `enrichmentStatus` | text | ✓ | `'pending'` |
| `contentType` | text | ✓ | `'image_text'` |
| `likeCount/commentCount/shareCount/viewCount/favoriteCount/replyCount` | int | ✓ | 0 |
| `compositeScore` | real | ✓ | 0 |
| `createdAt/updatedAt` | timestamptz | ✓ | now() |
| `summary/canonicalUrl/coverImageUrl/publishedAt` | nullable | — | NULL |
| ⚠️ 注意：**没有** `thumbnail` 字段 → 用 `coverImageUrl`；**没有** `sourceUrl` 字段 → 用 `canonicalUrl` ||||

```ts
import { collectedItems } from '@/db/schema'
import { getRecentTopPosts } from '../account-analytics'
import { randomUUID } from 'node:crypto'

let itemId1: string, itemId2: string
// myAccount.id 是 uuid，但 collected_items.accountId 是 text。
// 把 uuid 转 string 直接存进去（drizzle 会自动 cast），实际生产数据 accountId 就是 platform-specific 字符串
const accountIdForItems = accountId  // 复用 Task 1.2 fixture 中的 accountId（已是 string）

beforeAll(async () => {
  const now = new Date()
  const fp1 = randomUUID()
  const fp2 = randomUUID()
  const inserted = await db.insert(collectedItems).values([
    {
      organizationId: orgId,
      accountId: accountIdForItems,
      contentFingerprint: fp1,
      title: 'Top1 Highest Score',
      firstSeenChannel: 'test',
      firstSeenAt: now,
      publishedAt: now,
      likeCount: 1000,
      commentCount: 100,
      viewCount: 10000,
      compositeScore: 90.5,
      summary: 'top1 summary',
      canonicalUrl: 'https://example.com/top1',  // ⚠️ collected_items 真实字段名是 canonical_url
      // sourceChannels/category/derivedModules/enrichmentStatus/contentType
      // 全部依赖默认值，无需显式传
    },
    {
      organizationId: orgId,
      accountId: accountIdForItems,
      contentFingerprint: fp2,
      title: 'Top2 Latest',
      firstSeenChannel: 'test',
      firstSeenAt: new Date(now.getTime() - 86_400_000),
      publishedAt: new Date(now.getTime() - 86_400_000),
      likeCount: 500,
      commentCount: 50,
      viewCount: 5000,
      compositeScore: 60.0,
      summary: 'top2 summary',
      canonicalUrl: 'https://example.com/top2',
    },
  ]).returning({ id: collectedItems.id })
  itemId1 = inserted[0].id
  itemId2 = inserted[1].id
})

afterAll(async () => {
  await db.delete(collectedItems).where(inArray(collectedItems.id, [itemId1, itemId2]))
  // ...其他清理...
})

describe('getRecentTopPosts', () => {
  it('mode=hot 按 compositeScore 降序', async () => {
    const rows = await getRecentTopPosts({ orgId, accountId: accountIdForItems, mode: 'hot', limit: 5 })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].score >= (rows[1]?.score ?? 0)).toBe(true)
  })

  it('mode=latest 按 publishedAt 降序', async () => {
    const rows = await getRecentTopPosts({ orgId, accountId: accountIdForItems, mode: 'latest', limit: 5 })
    expect(rows.length).toBeGreaterThan(0)
    expect(new Date(rows[0].publishedAt).getTime()).toBeGreaterThan(
      new Date(rows[1]?.publishedAt ?? 0).getTime() - 1,
    )
  })
})
```

⚠️ **跨表 accountId 类型不一致**（重要！）：
- `account_daily_snapshots.account_id` 是 **uuid** notNull（schema/account-analytics.ts:39）
- `collected_items.account_id` 是 **text** nullable（schema/collection.ts:122）

实际生产数据中，collected_items.account_id 存的是 `my_accounts.id` 或 `benchmark_accounts.id` 的 uuid 字符串形式。所以 fixture 里**两张表用同一个 uuid string**就能跑通：snapshot 表认它是 uuid，items 表认它是 text，PG 自动 cast。

Task 1.2 / 1.3 fixture 已经从 `myAccounts.id`（uuid）拿到 string，直接复用到 collected_items 也对。但写测试时记得 **类型上 collected_items.accountId 是 string** — 如果在 plain object spreads 里写 `accountId: someUuid` 会被 drizzle 当 text，没问题。

- [ ] **Step 2: 跑测试看 FAIL** 

```bash
npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getRecentTopPosts"
```

- [ ] **Step 3: 实现**

```ts
import { desc, asc, and, eq, gte } from 'drizzle-orm'

export async function getRecentTopPosts(opts: {
  orgId: string
  accountId: string
  mode: 'hot' | 'latest'
  limit?: number
}): Promise<Array<{
  id: string
  title: string
  summary: string | null
  thumbnail: string | null
  score: number
  viewCount: number
  commentCount: number
  likeCount: number
  publishedAt: string  // ISO
  sourceUrl: string
}>> {
  const { orgId, accountId, mode, limit = 5 } = opts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const orderClause = mode === 'hot'
    ? desc(collectedItems.compositeScore)
    : desc(collectedItems.publishedAt)

  // ⚠️ 真实 schema 字段：缩图叫 coverImageUrl（不叫 thumbnail），外链叫 canonicalUrl（不叫 sourceUrl）。
  //    DAL 输出层把它们别名为 thumbnail/sourceUrl 给上层组件，保持组件契约稳定。
  const rows = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      summary: collectedItems.summary,
      coverImageUrl: collectedItems.coverImageUrl,
      score: collectedItems.compositeScore,
      viewCount: collectedItems.viewCount,
      commentCount: collectedItems.commentCount,
      likeCount: collectedItems.likeCount,
      publishedAt: collectedItems.publishedAt,
      canonicalUrl: collectedItems.canonicalUrl,
    })
    .from(collectedItems)
    .where(and(
      eq(collectedItems.organizationId, orgId),
      eq(collectedItems.accountId, accountId),
      gte(collectedItems.publishedAt, thirtyDaysAgo),
    ))
    .orderBy(orderClause)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? '(无标题)',
    summary: r.summary,
    thumbnail: r.coverImageUrl,                    // alias: coverImageUrl → thumbnail
    score: Number(r.score ?? 0),
    viewCount: r.viewCount ?? 0,
    commentCount: r.commentCount ?? 0,
    likeCount: r.likeCount ?? 0,
    publishedAt: r.publishedAt?.toISOString() ?? '',
    sourceUrl: r.canonicalUrl ?? '',               // alias: canonicalUrl → sourceUrl
  }))
}
```

- [ ] **Step 4: 跑测试看 PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
git commit -m "feat(account-analytics): DAL getRecentTopPosts 返回近 30 天 TOP5"
```

---

### Task 1.5: URL state hook

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/use-url-state.ts`

⚠️ **Next.js 16 强制要求**：`useSearchParams()` 必须被 `<Suspense>` 包裹，否则 prod build 会 fail（"useSearchParams() should be wrapped in a suspense boundary"）。Task 1.11 改 `account-overview-client.tsx` 时要保证调用 hook 的组件外层在 page.tsx server component 里有 `<Suspense fallback={...}>` 包裹。

- [ ] **Step 1: 实现 hook**

```ts
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Granularity, MetricKey } from '@/lib/account-analytics/platform-meta'

export type AccountAnalyticsTab = 'analytics' | 'reports'
export type TopSort = 'hot' | 'latest'
export type CloudRange = '7d' | '30d'

export interface AccountAnalyticsURLState {
  tab: AccountAnalyticsTab
  granularity: Granularity
  metric: MetricKey
  topSort: TopSort
  cloudRange: CloudRange
  setTab: (v: AccountAnalyticsTab) => void
  setGranularity: (v: Granularity) => void
  setMetric: (v: MetricKey) => void
  setTopSort: (v: TopSort) => void
  setCloudRange: (v: CloudRange) => void
}

const DEFAULTS = {
  tab: 'analytics' as AccountAnalyticsTab,
  granularity: 'day' as Granularity,
  metric: 'likes' as MetricKey,
  topSort: 'hot' as TopSort,
  cloudRange: '7d' as CloudRange,
}

function read<T extends string>(sp: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = sp.get(key) as T | null
  return v && (allowed as readonly string[]).includes(v) ? v : fallback
}

export function useAccountAnalyticsURLState(): AccountAnalyticsURLState {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const tab = read(sp, 'tab', ['analytics', 'reports'] as const, DEFAULTS.tab)
  const granularity = read(sp, 'granularity', ['day', 'week', 'month'] as const, DEFAULTS.granularity)
  const metric = read(sp, 'metric', ['likes', 'comments', 'shares', 'favorites', 'views', 'compositeScore'] as const, DEFAULTS.metric)
  const topSort = read(sp, 'topSort', ['hot', 'latest'] as const, DEFAULTS.topSort)
  const cloudRange = read(sp, 'cloudRange', ['7d', '30d'] as const, DEFAULTS.cloudRange)

  const update = useCallback((patch: Partial<Record<string, string>>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k)
      else next.set(k, v)
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [router, pathname, sp])

  return {
    tab, granularity, metric, topSort, cloudRange,
    setTab: (v) => update({ tab: v }),
    setGranularity: (v) => update({ granularity: v }),
    setMetric: (v) => update({ metric: v }),
    setTopSort: (v) => update({ topSort: v }),
    setCloudRange: (v) => update({ cloudRange: v }),
  }
}
```

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/use-url-state.ts
git commit -m "feat(account-analytics): URL state hook 同步 tab/粒度/指标/排序到 URL"
```

---

### Task 1.6: MetricPillButton 组件（左侧胶囊按钮）

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/metric-pill-button.tsx`

（路径统一：本页私有的展示组件全部放 `[accountId]/components/`，不污染 `src/components/account-analytics/` 的共享层）

- [ ] **Step 1: 实现**

```tsx
'use client'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  active: boolean
  onClick: () => void
}

export function MetricPillButton({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center w-full px-4 py-2.5 rounded-full',
        'text-[13px] font-medium transition-all border-0 cursor-pointer',
        active
          ? 'bg-gradient-to-r from-[#FF8B47] to-[#FF5E37] text-white shadow-md shadow-orange-200/50'
          : 'bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      {label}
    </button>
  )
}
```

注意：spec 项目规则要求"所有按钮无边框"，所以用 `border-0`。颜色对齐参考图的橙色渐变。

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/metric-pill-button.tsx
git commit -m "feat(account-analytics): 新增 MetricPillButton 胶囊按钮组件"
```

---

### Task 1.7: MetricTrendChart 组件（区块 A：左按钮 + 右折线）

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/metric-trend-chart.tsx`

⚠️ **Race condition 必读**（适用于 Task 1.7 / 1.8 / 1.9 三个组件，先看再写）：
组件内 `useEffect` 触发 loader（Server Action）拿数据时，快速切换 prop（粒度/指标/模式）会导致"旧请求晚到、覆盖新请求"。React 19 transition 不自救。下方代码骨架**未实现**这块，请用以下任一模式补：

```tsx
const reqIdRef = useRef(0)
useEffect(() => {
  const id = ++reqIdRef.current
  loader(metric, granularity).then((d) => {
    if (id !== reqIdRef.current) return  // 旧请求已被新请求超越，丢弃
    setData(d)
    setLoading(false)
  })
}, [metric, granularity, loader])
```

- [ ] **Step 1: 实现**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MetricPillButton } from './metric-pill-button'
import {
  METRIC_KEYS, METRIC_LABELS, GRANULARITY_LABELS,
  type MetricKey, type Granularity,
} from '@/lib/account-analytics/platform-meta'

interface Props {
  platform: string
  availability: Record<MetricKey, boolean>
  granularity: Granularity
  metric: MetricKey
  onMetricChange: (m: MetricKey) => void
  loader: (m: MetricKey, g: Granularity) => Promise<Array<{ bucket: string; value: number }>>
}

export function MetricTrendChart({ availability, granularity, metric, onMetricChange, loader }: Props) {
  const [data, setData] = useState<Array<{ bucket: string; value: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loader(metric, granularity).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [metric, granularity, loader])

  const visibleMetrics = METRIC_KEYS.filter((m) => availability[m])

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3 space-y-2">
        {visibleMetrics.map((m) => (
          <MetricPillButton
            key={m}
            label={METRIC_LABELS[m]}
            active={metric === m}
            onClick={() => onMetricChange(m)}
          />
        ))}
      </div>
      <div className="col-span-9">
        <div className="flex items-center justify-between mb-2 px-1">
          <h4 className="text-[14px] font-semibold text-[#1F3864]">数据表现 · {METRIC_LABELS[metric]}</h4>
          <span className="text-[11px] text-gray-500">{GRANULARITY_LABELS[granularity]}</span>
        </div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="metric-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5E37" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF5E37" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(s) => s.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toLocaleString('zh-CN')} />
              <Area type="monotone" dataKey="value" stroke="#FF5E37" fill="url(#metric-gradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + lint**

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/metric-trend-chart.tsx
git commit -m "feat(account-analytics): 区块 A 指标趋势图（左按钮 + 右面积折线）"
```

---

### Task 1.8: PublishActivityCard 组件（区块 B：柱状图 + 数字带）

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/publish-activity-card.tsx`

- [ ] **Step 1: 实现**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  type Granularity, type SummaryKey, SUMMARY_LABELS,
} from '@/lib/account-analytics/platform-meta'

interface Props {
  granularity: Granularity
  summaryKeys: SummaryKey[]
  loader: (g: Granularity) => Promise<{
    buckets: Array<{ bucket: string; publishCount: number }>
    summary: Partial<Record<SummaryKey, number>>
  }>
}

export function PublishActivityCard({ granularity, summaryKeys, loader }: Props) {
  const [data, setData] = useState<{
    buckets: Array<{ bucket: string; publishCount: number }>
    summary: Partial<Record<SummaryKey, number>>
  }>({ buckets: [], summary: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loader(granularity).then((d) => { setData(d); setLoading(false) })
  }, [granularity, loader])

  return (
    <div className="space-y-4">
      <div className="h-[200px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickFormatter={(s) => s.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="publishCount" fill="#FFB070" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {summaryKeys.map((k) => (
          <div key={k} className="rounded-xl bg-white/60 dark:bg-gray-900/40 p-3 text-center">
            <div className="text-[18px] font-semibold text-[#1F3864] dark:text-blue-200 tabular-nums">
              {(data.summary[k] ?? 0).toLocaleString('zh-CN')}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{SUMMARY_LABELS[k]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/publish-activity-card.tsx
git commit -m "feat(account-analytics): 区块 B 发布活跃度（柱状 + 数字带）"
```

---

### Task 1.9: RecentTopPosts 组件（区块 D：TOP5 列表）

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/recent-top-posts.tsx`

- [ ] **Step 1: 实现**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Eye, MessageCircle, Calendar, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TopSort } from './use-url-state'

interface Post {
  id: string
  title: string
  summary: string | null
  thumbnail: string | null
  score: number
  viewCount: number
  commentCount: number
  publishedAt: string
  sourceUrl: string
}

interface Props {
  mode: TopSort
  onModeChange: (m: TopSort) => void
  loader: (m: TopSort) => Promise<Post[]>
}

export function RecentTopPosts({ mode, onModeChange, loader }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loader(mode).then((d) => { setPosts(d); setLoading(false) })
  }, [mode, loader])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
          近期文章 TOP5
        </h3>
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
          {(['hot', 'latest'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={cn(
                'px-3 py-1 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-colors',
                mode === m ? 'bg-white text-[#FF5E37] shadow-sm' : 'text-gray-500',
              )}
            >
              {m === 'hot' ? '最热' : '最新'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">加载中...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">近 30 天暂无发布</p>
      ) : (
        <div className="space-y-2.5">
          {posts.map((p, idx) => (
            <a
              key={p.id}
              href={p.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-3 rounded-xl bg-white/60 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900/60 transition-colors"
            >
              <div className="shrink-0 w-20 h-14 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                {p.thumbnail && (
                  <Image src={p.thumbnail} alt="" fill className="object-cover" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-[#1F3864] dark:text-blue-200 line-clamp-1">
                    {p.title}
                  </p>
                  {mode === 'hot' && (
                    <span className={cn(
                      'shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold',
                      idx === 0 ? 'text-[#FF5E37]' : 'text-orange-400',
                    )}>
                      <Flame size={12} />{p.score.toFixed(2)}
                    </span>
                  )}
                </div>
                {p.summary && (
                  <p className="text-[12px] text-gray-500 line-clamp-1 mt-0.5">{p.summary}</p>
                )}
                <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-0.5"><Eye size={11} />{p.viewCount.toLocaleString('zh-CN')}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} />{p.commentCount}</span>
                  <span className="inline-flex items-center gap-0.5"><Calendar size={11} />{p.publishedAt.slice(0, 10)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/recent-top-posts.tsx
git commit -m "feat(account-analytics): 区块 D 近期 TOP5（最热/最新切换 + 外链跳转）"
```

---

### Task 1.10: DataAnalysisTab 容器组件

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/data-analysis-tab.tsx`
- Create: `src/app/actions/account-analytics-tab1.ts`（Server Actions 给客户端组件调）

⚠️ **Race condition 警示**：区块 A/B/D 组件内 `useEffect` 触发 Server Action 时，快速切换粒度（day → week → day）会有"旧请求晚到、覆盖新请求"的问题。React 19 的 transition 不会自救。**实施时必须**：在每个 loader 调用前生成一个 race id（如 `useRef(0)`），fetch 回来时对比当前 id 是否一致，不一致就 return；或使用 `AbortController` 取消旧请求。下方代码骨架未实现这块——implementer 需在 Task 1.7/1.8/1.9 组件内补上。

- [ ] **Step 1: 实现 Server Actions wrapper**

```ts
// src/app/actions/account-analytics-tab1.ts
'use server'
import { requireAuth } from '@/lib/auth'
import {
  getMetricSeries, getPublishActivity, getRecentTopPosts,
} from '@/lib/dal/account-analytics'
import type { Granularity, MetricKey } from '@/lib/account-analytics/platform-meta'

export async function loadMetricSeriesAction(input: {
  accountId: string
  granularity: Granularity
  metric: MetricKey
}) {
  const user = await requireAuth()
  return getMetricSeries({ orgId: user.organizationId, ...input })
}

export async function loadPublishActivityAction(input: {
  accountId: string
  platform: string  // 上层 page.tsx 已有 account.platform
  granularity: Granularity
}) {
  const user = await requireAuth()
  return getPublishActivity({ orgId: user.organizationId, ...input })
}

export async function loadRecentTopPostsAction(input: {
  accountId: string
  mode: 'hot' | 'latest'
}) {
  const user = await requireAuth()
  return getRecentTopPosts({ orgId: user.organizationId, ...input })
}
```

- [ ] **Step 2: 实现 DataAnalysisTab**

```tsx
'use client'
import { useCallback } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { cn } from '@/lib/utils'
import { useAccountAnalyticsURLState } from './use-url-state'
import { MetricTrendChart } from './metric-trend-chart'
import { PublishActivityCard } from './publish-activity-card'
import { RecentTopPosts } from './recent-top-posts'
import {
  getMetricAvailability, getSummaryCards,
  GRANULARITY_LABELS, type Granularity,
} from '@/lib/account-analytics/platform-meta'
import {
  loadMetricSeriesAction, loadPublishActivityAction, loadRecentTopPostsAction,
} from '@/app/actions/account-analytics-tab1'

interface Props {
  accountId: string
  platform: string
}

export function DataAnalysisTab({ accountId, platform }: Props) {
  const { granularity, metric, topSort, setGranularity, setMetric, setTopSort } = useAccountAnalyticsURLState()
  const availability = getMetricAvailability(platform)
  const summaryKeys = getSummaryCards(platform)

  const metricLoader = useCallback(
    (m: typeof metric, g: typeof granularity) =>
      loadMetricSeriesAction({ accountId, granularity: g, metric: m }),
    [accountId],
  )
  const publishLoader = useCallback(
    (g: typeof granularity) => loadPublishActivityAction({ accountId, platform, granularity: g }),
    [accountId, platform],
  )
  const topLoader = useCallback(
    (m: typeof topSort) => loadRecentTopPostsAction({ accountId, mode: m }),
    [accountId],
  )

  return (
    <div className="space-y-6">
      {/* 工具条 */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-colors',
                granularity === g ? 'bg-white text-[#FF5E37] shadow-sm' : 'text-gray-500',
              )}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 区块 A */}
      <GlassCard padding="lg">
        <MetricTrendChart
          platform={platform}
          availability={availability}
          granularity={granularity}
          metric={metric}
          onMetricChange={setMetric}
          loader={metricLoader}
        />
      </GlassCard>

      {/* 区块 B */}
      <GlassCard padding="lg">
        <PublishActivityCard
          granularity={granularity}
          summaryKeys={summaryKeys}
          loader={publishLoader}
        />
      </GlassCard>

      {/* 区块 C Phase 2 占位 */}
      <GlassCard padding="lg">
        <div className="text-center py-12 text-sm text-gray-400">
          📊 内容分类与热门词云正在分析中，预计 24 小时内可见
        </div>
      </GlassCard>

      {/* 区块 D */}
      <GlassCard padding="lg">
        <RecentTopPosts mode={topSort} onModeChange={setTopSort} loader={topLoader} />
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/account-analytics-tab1.ts \
  src/app/\(dashboard\)/account-analytics/\[accountId\]/components/data-analysis-tab.tsx
git commit -m "feat(account-analytics): DataAnalysisTab 容器组装 4 区块 + Server Actions"
```

---

### Task 1.11: 重构 AccountOverviewClient 加 Tab 切换

**Files:**
- Modify: `src/app/(dashboard)/account-analytics/[accountId]/account-overview-client.tsx`
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/reports-tab.tsx`（把现有报告列表抽出来，UI 不动）

- [ ] **Step 1: 定位真实剪切范围**

先 `wc -l` + `grep -n "历史报告列表\|{\* 历史报告"` 重新确认行号（原 plan 写的范围基于过时认知）。实际 `account-overview-client.tsx` 中：
- 顶部账号 header / 30 天 KPI 卡片 / 30 天趋势图 GlassCard **必须保留在常驻区**
- 只剪「历史报告列表」`<GlassCard>` 那一块（含上方标题 + chip 切换 + 列表条目）到 `ReportsTab`

```bash
# 用更精确的 grep 避免匹到注释和文案
grep -n "{/\* 历史报告\|GlassCard.*历史报告\|REPORT_TYPE_FILTER_ORDER" \
  src/app/\(dashboard\)/account-analytics/\[accountId\]/account-overview-client.tsx
```

确认起止行号后再剪。剪过去到新文件时，把以下状态/常量一并搬：`typeFilter` useState、`filteredReports` derived、`typeCounts` Map、`REPORT_TYPE_LABELS` / `REPORT_TYPE_FILTER_ORDER` / `STATUS_LABELS`（如这些常量没在别处复用）。

UI **必须像素级一致**（spec §10.2 Tab2 视觉回归项）。

- [ ] **Step 2: 改 account-overview-client.tsx 接入 Tabs**

`account-overview-client.tsx` 顶部 `"use client"` 保留不动。在 import 区追加：

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataAnalysisTab } from './components/data-analysis-tab'
import { ReportsTab } from './components/reports-tab'
import { useAccountAnalyticsURLState } from './components/use-url-state'
```

在组件函数体顶部加：
```tsx
const { tab, setTab } = useAccountAnalyticsURLState()
```

把原 `<GlassCard>` 历史报告整块替换为：
```tsx
<Tabs value={tab} onValueChange={(v) => setTab(v as 'analytics' | 'reports')}>
  <TabsList variant="line" className="mb-4">
    <TabsTrigger value="analytics">数据分析</TabsTrigger>
    <TabsTrigger value="reports">分析报告</TabsTrigger>
  </TabsList>
  <TabsContent value="analytics">
    <DataAnalysisTab accountId={account.id} platform={account.platform} />
  </TabsContent>
  <TabsContent value="reports">
    <ReportsTab account={account} reports={reports} />
  </TabsContent>
</Tabs>
```

- [ ] **Step 2.5: page.tsx 加 Suspense 包裹 client component**

Next.js 16 要求使用 `useSearchParams()` 的 client component 必须被 `<Suspense>` 包裹，否则 prod build fail。Modify `src/app/(dashboard)/account-analytics/[accountId]/page.tsx`：

```tsx
import { Suspense } from 'react'

// ...原 server logic 不变...

return (
  <Suspense fallback={<div className="p-8 text-sm text-gray-400">加载中...</div>}>
    <AccountOverviewClient account={account} overview={overview} reports={reports} />
  </Suspense>
)
```

- [ ] **Step 3: 验证 Tabs variant="line" 是否存在**

```bash
grep -n "variant.*line\|line.*variant" src/components/ui/tabs.tsx
```

如果不存在，先看 tabs.tsx 用 default 即可（CLAUDE.md 说"variant default 填充 / line 下划线"）。

- [ ] **Step 4: 验证 Tab2 视觉回归（人工）**

```bash
npm run dev
```

打开 `http://localhost:3000/account-analytics/e6ae6f80-222f-456f-94df-ba1ceb6ec7c4?tab=reports`，对比改造前的报告列表截图（如有），确认：
- 每行 padding / border / hover 状态一致
- 顶部"历史报告"标题 + 4 个 chip 一致
- 空态文案一致

- [ ] **Step 5: tsc + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/account-overview-client.tsx \
  src/app/\(dashboard\)/account-analytics/\[accountId\]/components/reports-tab.tsx
git commit -m "feat(account-analytics): 详情页加 Tabs（数据分析 / 分析报告）+ 抽出 ReportsTab"
```

---

### Task 1.12: 报告详情页返回链接带 `?tab=reports`

**Files:**
- Modify: `src/app/(dashboard)/account-analytics/[accountId]/reports/[reportId]/report-detail-client.tsx`

- [ ] **Step 1: 找到现有"返回"链接**

```bash
grep -n "返回\|ArrowLeft\|account-analytics/\${account.id}" \
  src/app/\(dashboard\)/account-analytics/\[accountId\]/reports/\[reportId\]/report-detail-client.tsx
```

- [ ] **Step 2: 修改返回链接**

例如：
```tsx
// 之前
<Link href={`/account-analytics/${account.id}`}>返回</Link>
// 之后
<Link href={`/account-analytics/${account.id}?tab=reports`}>返回账号</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/reports/\[reportId\]/report-detail-client.tsx
git commit -m "feat(account-analytics): 报告详情页返回链接显式带 ?tab=reports"
```

---

### Task 1.13: Phase 1 E2E 验收

- [ ] **Step 1: 跑完整测试套件**

```bash
npx vitest run src/lib/dal/__tests__/account-analytics.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 2: tsc + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: 三个命令全绿

- [ ] **Step 3: 手工验证 demo 账号**

```bash
npm run dev
```

打开 `http://localhost:3000/account-analytics/e6ae6f80-222f-456f-94df-ba1ceb6ec7c4`，验收清单：

- [ ] 默认进入 `?tab=analytics`
- [ ] 顶部 KPI + 30 天趋势图 不动
- [ ] 切「按日/周/月」URL 同步更新，趋势图 + 柱状图都跟着变
- [ ] 切左侧指标按钮（点赞→评论→...），右侧折线图换数据
- [ ] 数字带 6 项显示正确（抖音账号应看到"发布数 / 总播放 / 最高播放 / 平均播放 / 总点赞 / 总转发"）
- [ ] 区块 C 显示常驻 zero state「📊 内容分类与热门词云正在分析中」
- [ ] 区块 D TOP5：切最热/最新切换有效；点击行打开外链
- [ ] 切到「分析报告」tab，看到原有报告列表，视觉与改造前一致
- [ ] 进入报告详情后点"返回"，回到 `?tab=reports`

如果某项失败：根据失败点找到对应 Task 修复。

- [ ] **Step 4: 截图归档**

```bash
mkdir -p docs/screenshots/account-analytics-tab1
# 用浏览器手工截图，保存到该目录：
# - tab1-analytics-default.png
# - tab1-analytics-week.png
# - tab1-reports.png
```

- [ ] **Step 5: Commit screenshots**

```bash
git add docs/screenshots/account-analytics-tab1/
git commit -m "docs(account-analytics): Phase 1 验收截图归档"
```

---

## Phase 2 · 区块 C 类型占比 + 词云（含 LLM）

### Task 2.1: collected_items 加 4 个 aigc_ 字段 + 索引

**Files:**
- Modify: `src/db/schema/collection.ts`（在 collectedItems 表内追加，不动现有列）

- [ ] **Step 1: 在 collectedItems 表定义中加字段**

找到 `src/db/schema/collection.ts` 中 `collectedItems` 表的字段定义块（约 line 61-160），在合适位置追加：

```ts
  // ─── AIGC 标注字段（Spec §7.1，2026-05-24）─────
  // 注：与 category text[] 行业分类无关，前缀 aigc_ 表示 LLM 二次标注产物
  aigcContentCategory: text("aigc_content_category"),         // 单值，8 选 1
  aigcKeywords: jsonb("aigc_keywords").$type<string[]>().default(sql`'[]'::jsonb`),
  aigcAnnotatedAt: timestamp("aigc_annotated_at", { withTimezone: true }),
  aigcAnnotationModel: text("aigc_annotation_model"),         // e.g. "deepseek-chat:v3"
```

在表的 indexes block（约 line 160-200）追加 3 个索引：

```ts
    aigcCategoryIdx: index("collected_items_aigc_category_idx")
      .on(t.organizationId, t.accountId, t.aigcContentCategory),
    aigcKeywordsGin: index("collected_items_aigc_keywords_gin")
      .using("gin", t.aigcKeywords),
    aigcAnnotatedAtIdx: index("collected_items_aigc_annotated_at_idx")
      .on(t.aigcAnnotatedAt)
      .where(sql`aigc_annotated_at IS NULL`),
```

- [ ] **Step 2: 生成 migration**

```bash
npm run db:generate
```

Expected: 在 `supabase/migrations/` 下生成新文件，含 4 个 ADD COLUMN + 3 个 CREATE INDEX。

- [ ] **Step 3: 检查 migration**

`cat supabase/migrations/<新文件名>.sql`，确认 SQL 符合预期。**特别注意** partial index 是否正确生成 `WHERE aigc_annotated_at IS NULL`；如果 Drizzle 没生成 partial 部分，手工编辑 migration 文件加上。

- [ ] **Step 4: 应用到本地 / 开发库**

```bash
npm run db:push   # 开发环境用 push
# 或正式环境：npm run db:migrate
```

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/collection.ts src/db/types.ts supabase/migrations/
git commit -m "feat(collected-items): 加 aigc_ 标注 4 字段 + 3 个索引"
```

---

### Task 2.2: AIGC 分类常量

**Files:**
- Create: `src/lib/account-analytics/content-category.ts`

- [ ] **Step 1: 实现**

```ts
// AIGC（LLM 标注）维度的内容主题分类，与 collected_items.category text[] 行业分类无关
export const AIGC_CONTENT_CATEGORIES = [
  '时政', '社会', '财经', '科技', '生活', '娱乐', '体育', '其他',
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

// 词云停用词表（约 50 个中文高频虚词）
export const CHINESE_STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '里', '所以', '为', '吧', '什么', '让', '给', '把', '才',
  '与', '于', '对', '从', '及', '或', '但', '而', '及', '其', '之', '于', '此',
])

// Phase 1/2 zero state 文案
export const ZERO_STATE_PHASE1 = '📊 内容分类与热门词云正在分析中，预计 24 小时内可见'
export const zeroStatePhase2 = (annotatedRatio: number) =>
  `分析中（已完成 ${Math.round(annotatedRatio * 100)}%）`
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/account-analytics/content-category.ts
git commit -m "feat(account-analytics): AIGC 分类常量 + 停用词表"
```

---

### Task 2.3: 注册 Inngest 事件类型

**Files:**
- Modify: `src/inngest/events.ts`（如已存在）或对应的 events 定义文件

- [ ] **Step 1: 找到 events 定义文件**

```bash
grep -rn "collection/item.created\|account-analytics/" src/inngest/events*
```

- [ ] **Step 2: 加事件类型**

```ts
'account-analytics/aigc-annotate.requested': {
  data: { orgId: string; accountId?: string; batchSize?: number; chainDepth?: number }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/inngest/events.ts
git commit -m "feat(inngest): 注册 account-analytics/aigc-annotate.requested 事件"
```

---

### Task 2.4: Inngest 函数 `account-analytics-annotate-content`

**Files:**
- Create: `src/inngest/functions/account-analytics/annotate-collected-content.ts`
- Modify: `src/inngest/functions/index.ts` 注册函数

- [ ] **Step 1: 实现核心函数**

```ts
// src/inngest/functions/account-analytics/annotate-collected-content.ts
//
// 注意：项目国内部署，使用自建 DeepSeek 接口（OPENAI_API_BASE_URL 指向 deepseek.com），
// 不走 Vercel AI Gateway。LLM 调用统一通过 src/lib/agent/model-router 封装，
// 与 viral-attributor.ts 保持同一模式（AI SDK v6 generateText + Output.object）。
//
import { inngest } from '@/inngest/client'
import { db } from '@/db'
import { collectedItems, collectedItemContents } from '@/db/schema/collection'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { generateText, Output } from 'ai'
import { z } from 'zod/v4'  // 对齐 viral-attributor.ts 的 import 路径，避免 AI SDK v6 Output.object 类型不一致
import { getLanguageModel, resolveModelConfig } from '@/lib/agent/model-router'
import {
  AIGC_CONTENT_CATEGORIES,
  CHINESE_STOPWORDS,
} from '@/lib/account-analytics/content-category'

const MAX_CHAIN_DEPTH = 20
const DEFAULT_BATCH_SIZE = 50
const FAILURE_RATE_CIRCUIT_BREAKER = 0.5
// 仅作为 aigc_annotation_model 字段值（数据回溯用），与 provider model 解耦
const MODEL_TAG = 'deepseek.chat.v3'

const annotationSchema = z.object({
  category: z.enum(AIGC_CONTENT_CATEGORIES),
  // spec §7.3 要 5-10 个；min(3) 是兼容 LLM 短文偶尔输出少的容错
  keywords: z.array(z.string().min(1).max(20)).min(3).max(10),
})

const ATTRIBUTION_SYSTEM_PROMPT = `你是中文内容分类助手。
必须严格按以下规则输出：
- category：从 [时政, 社会, 财经, 科技, 生活, 娱乐, 体育, 其他] 中**必须选 1 个**；无法判断时选"其他"
- keywords：5-10 个中文关键词（**实词**，禁止虚词「的、了、是、在」等），按重要性排序`

export const annotateCollectedContent = inngest.createFunction(
  {
    id: 'account-analytics-annotate-content',
    // concurrency 与 db pool max:2 对齐（src/db/index.ts:24）——更高会触发
    // ConnectionError（其他 batch 抢不到连接，connect_timeout 30s 后报错）
    concurrency: { limit: 2 },
    // retries: 0 配合下方 Step 3 "失败行兜底写'其他'"机制 —— 单次 step 必须把这批 50 条
    // 全部解决（成功或兜底），不让 Inngest 自动重试。两者同时存在会导致兜底完后整函数
    // 重跑时已无未标注行 → 拉下一批 → 再失败 → 再熔断，链路不收敛。
    retries: 0,
  },
  [
    { event: 'account-analytics/aigc-annotate.requested' },
    { cron: 'TZ=Asia/Shanghai 0 4 * * *' },  // 每天 04:00
  ],
  async ({ event, step }) => {
    const orgId = event?.data?.orgId
    const batchSize = event?.data?.batchSize ?? DEFAULT_BATCH_SIZE
    const chainDepth = event?.data?.chainDepth ?? 0

    // ⚠️ cron 触发（每天 04:00）时 event.data 为 undefined → orgId = undefined
    //    若直接进 Step 1 会跨 org 标注（多租户数据隔离漏洞）。
    //    必须先 fan-out 到每个 org 独立派发事件，避免一次 step 跨 org 写入。
    if (!orgId) {
      await step.run('fan-out-orgs', async () => {
        const orgs = await db
          .selectDistinct({ id: collectedItems.organizationId })
          .from(collectedItems)
          .where(isNull(collectedItems.aigcAnnotatedAt))
        for (const o of orgs) {
          await step.sendEvent(`dispatch-${o.id}`, {
            name: 'account-analytics/aigc-annotate.requested',
            data: { orgId: o.id, batchSize, chainDepth: 0 },
          })
        }
      })
      return { fannedOut: true }
    }

    // 1) 拉一批待标注
    const items = await step.run('load-batch', async () => {
      const conditions = [isNull(collectedItems.aigcAnnotatedAt)]
      if (orgId) conditions.push(eq(collectedItems.organizationId, orgId))
      return db
        .select({
          id: collectedItems.id,
          title: collectedItems.title,
          content: collectedItemContents.content,
        })
        .from(collectedItems)
        .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
        .where(and(...conditions))
        .orderBy(desc(collectedItems.publishedAt))
        .limit(batchSize)
    })

    if (items.length === 0) return { done: true, processed: 0 }

    // 2) 并行 LLM 调用（concurrency=2 由 createFunction 控制，对齐 db pool max:2）
    //    AI SDK v6：generateText + Output.object（generateObject 已移除）
    //    model 通过 model-router 选用项目统一配置的 LLM，不直接绑定 provider
    const modelConfig = resolveModelConfig(['content_analysis'], { temperature: 0, maxTokens: 256 })
    const results = await step.run('llm-annotate-batch', async () => {
      const rs = await Promise.all(items.map(async (it) => {
        const text = `${it.title ?? ''}\n\n${(it.content ?? '').slice(0, 500)}`
        try {
          const { output } = await generateText({
            model: getLanguageModel(modelConfig),
            system: ATTRIBUTION_SYSTEM_PROMPT,
            prompt: `请对以下内容分类并提取关键词：\n\n${text}`,
            output: Output.object({ schema: annotationSchema }),
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
          })
          // 过滤停用词
          const filtered = output.keywords.filter((kw) => !CHINESE_STOPWORDS.has(kw) && kw.length > 1)
          return { id: it.id, ok: true as const, category: output.category, keywords: filtered }
        } catch (err) {
          return { id: it.id, ok: false as const, error: String(err) }
        }
      }))
      return rs
    })

    const failureCount = results.filter((r) => !r.ok).length
    const failureRate = failureCount / results.length

    // 3) 批量 UPDATE（失败行也兜底写入'其他'防无限重选）
    //
    //    重要：postgres-js driver + prepare:false（pgbouncer transaction mode）+ max:2 pool
    //    下，单一事务内**只能串行执行 query**——同事务连接已 busy 时另一个 query 立即 throw
    //    "another query is already running"。所以 for-loop 串行，不能 Promise.all。
    //    项目里已有 12 处 db.transaction（如 missions.ts:391）都是串行模式，照搬。
    //
    //    50 条串行 UPDATE 在已建立连接上约 50-200ms，远低于 Inngest step timeout。
    //    Inngest 函数 concurrency:2 与 db pool max:2 对齐，避免抢连接。
    await step.run('persist', async () => {
      const now = new Date()
      await db.transaction(async (tx) => {
        for (const r of results) {
          if (r.ok) {
            await tx.update(collectedItems)
              .set({
                aigcContentCategory: r.category,
                aigcKeywords: r.keywords,
                aigcAnnotatedAt: now,
                aigcAnnotationModel: MODEL_TAG,
              })
              .where(eq(collectedItems.id, r.id))
          } else {
            // 失败兜底
            await tx.update(collectedItems)
              .set({
                aigcContentCategory: '其他',
                aigcKeywords: [],
                aigcAnnotatedAt: now,
                aigcAnnotationModel: `${MODEL_TAG}.failed`,
              })
              .where(eq(collectedItems.id, r.id))
          }
        }
      })
    })

    // 4) 熔断
    if (failureRate > FAILURE_RATE_CIRCUIT_BREAKER) {
      throw new Error(`Failure rate ${(failureRate * 100).toFixed(1)}% exceeds 50% threshold, halt`)
    }

    // 5) 递归链式派发
    if (items.length === batchSize && chainDepth < MAX_CHAIN_DEPTH) {
      await step.sendEvent('chain-next-batch', {
        name: 'account-analytics/aigc-annotate.requested',
        data: { orgId, batchSize, chainDepth: chainDepth + 1 },
      })
    }

    return {
      done: items.length < batchSize,
      processed: items.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: failureCount,
      chainDepth,
    }
  },
)
```

- [ ] **Step 2: 注册到 functions index**

Modify `src/inngest/functions/index.ts`:

```ts
import { annotateCollectedContent } from './account-analytics/annotate-collected-content'

export const functions = [
  // ...existing,
  annotateCollectedContent,
]
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/inngest/functions/account-analytics/annotate-collected-content.ts \
  src/inngest/functions/index.ts
git commit -m "feat(account-analytics): Inngest 函数批量 LLM 标注 collected_items（含熔断+兜底）"
```

---

### Task 2.5: DAL `getCategoryDistribution`

**Files:**
- Modify: `src/lib/dal/account-analytics.ts`
- Modify: `src/lib/dal/__tests__/account-analytics.test.ts`

- [ ] **Step 1: 写测试**

```ts
import { getCategoryDistribution } from '../account-analytics'

describe('getCategoryDistribution', () => {
  it('返回 buckets + annotatedRatio', async () => {
    // 假设 fixture 中已有 collected_items 部分标注、部分未标注
    const result = await getCategoryDistribution({ orgId, accountId })
    expect(result).toMatchObject({
      buckets: expect.any(Array),
      annotatedRatio: expect.any(Number),
    })
    expect(result.annotatedRatio).toBeGreaterThanOrEqual(0)
    expect(result.annotatedRatio).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 实现**

```ts
import type { AigcContentCategory } from '@/lib/account-analytics/content-category'

export async function getCategoryDistribution(opts: {
  orgId: string
  accountId: string
}): Promise<{
  buckets: Array<{ category: AigcContentCategory; count: number }>
  annotatedRatio: number
}> {
  const { orgId, accountId } = opts
  const rows = await db.execute(sql`
    SELECT
      aigc_content_category AS category,
      COUNT(*)::int AS count
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - INTERVAL '30 days'
      AND aigc_content_category IS NOT NULL
    GROUP BY aigc_content_category
    ORDER BY count DESC
  `) as unknown as Array<Record<string, unknown>>

  const ratioRows = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(CASE WHEN aigc_annotated_at IS NOT NULL THEN 1 ELSE 0 END)::float
        / NULLIF(COUNT(*), 0),
        0
      ) AS ratio
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - INTERVAL '30 days'
  `) as unknown as Array<Record<string, unknown>>
  const ratioRow = ratioRows[0] ?? {}

  return {
    buckets: rows.map((r) => ({
      category: r.category as AigcContentCategory,
      count: Number(r.count ?? 0),
    })),
    annotatedRatio: Number(ratioRow.ratio ?? 0),
  }
}
```

- [ ] **Step 3: 跑测试**

- [ ] **Step 4: Commit**

```bash
git add src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
git commit -m "feat(account-analytics): DAL getCategoryDistribution"
```

---

### Task 2.6: DAL `getKeywordCloud`

**Files:**
- Modify: `src/lib/dal/account-analytics.ts`
- Modify: `src/lib/dal/__tests__/account-analytics.test.ts`

- [ ] **Step 1: 写测试**

```ts
import { getKeywordCloud } from '../account-analytics'

describe('getKeywordCloud', () => {
  it('返回词云 + annotatedRatio', async () => {
    const result = await getKeywordCloud({ orgId, accountId, range: '7d' })
    expect(result).toMatchObject({
      words: expect.any(Array),
      annotatedRatio: expect.any(Number),
    })
  })
})
```

- [ ] **Step 2: 实现**

```ts
export async function getKeywordCloud(opts: {
  orgId: string
  accountId: string
  range: '7d' | '30d'
}): Promise<{
  words: Array<{ keyword: string; weight: number }>
  annotatedRatio: number
}> {
  const { orgId, accountId, range } = opts
  const days = range === '7d' ? 7 : 30

  const rows = await db.execute(sql`
    SELECT
      kw AS keyword,
      COUNT(*)::int AS weight
    FROM collected_items,
         LATERAL jsonb_array_elements_text(aigc_keywords) AS kw
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - (${days}::int * INTERVAL '1 day')
      AND aigc_keywords IS NOT NULL
    GROUP BY kw
    ORDER BY weight DESC
    LIMIT 30
  `) as unknown as Array<Record<string, unknown>>

  const ratioRows = await db.execute(sql`
    SELECT COALESCE(
      SUM(CASE WHEN aigc_annotated_at IS NOT NULL THEN 1 ELSE 0 END)::float
      / NULLIF(COUNT(*), 0),
      0
    ) AS ratio
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - (${days}::int * INTERVAL '1 day')
  `) as unknown as Array<Record<string, unknown>>
  const ratioRow = ratioRows[0] ?? {}

  return {
    words: rows.map((r) => ({
      keyword: String(r.keyword),
      weight: Number(r.weight ?? 0),
    })),
    annotatedRatio: Number(ratioRow.ratio ?? 0),
  }
}
```

- [ ] **Step 3: 测试 + Commit**

```bash
npx vitest run src/lib/dal/__tests__/account-analytics.test.ts -t "getKeywordCloud"
git add src/lib/dal/account-analytics.ts src/lib/dal/__tests__/account-analytics.test.ts
git commit -m "feat(account-analytics): DAL getKeywordCloud"
```

---

### Task 2.7: CategoryDistribution 组件

**Files:**
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/category-distribution.tsx`

- [ ] **Step 1: 实现**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import {
  AIGC_CATEGORY_COLORS, type AigcContentCategory,
  ZERO_STATE_PHASE1, zeroStatePhase2,
} from '@/lib/account-analytics/content-category'

interface Props {
  loader: () => Promise<{
    buckets: Array<{ category: AigcContentCategory; count: number }>
    annotatedRatio: number
  }>
}

export function CategoryDistribution({ loader }: Props) {
  const [data, setData] = useState<{
    buckets: Array<{ category: AigcContentCategory; count: number }>
    annotatedRatio: number
  }>({ buckets: [], annotatedRatio: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loader().then((d) => { setData(d); setLoading(false) })
  }, [loader])

  if (loading) {
    return <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">加载中...</div>
  }

  if (data.annotatedRatio < 0.7) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
        {data.annotatedRatio === 0 ? ZERO_STATE_PHASE1 : zeroStatePhase2(data.annotatedRatio)}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200 mb-3">
        发文类型占比
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data.buckets} layout="vertical" margin={{ left: 30 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={60} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.buckets.map((entry) => (
              <Cell key={entry.category} fill={AIGC_CATEGORY_COLORS[entry.category]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/category-distribution.tsx
git commit -m "feat(account-analytics): 区块 C-左 CategoryDistribution（含 zero state 阈值）"
```

---

### Task 2.8: 安装 d3-cloud + KeywordCloud 组件

**Files:**
- Modify: `package.json`（添加 d3-cloud）
- Create: `src/app/(dashboard)/account-analytics/[accountId]/components/keyword-cloud.tsx`

- [ ] **Step 1: 安装依赖**

```bash
npm install d3-cloud
npm install -D @types/d3-cloud
```

- [ ] **Step 2: 验证安装无破坏性**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: 实现 KeywordCloud**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import cloud from 'd3-cloud'
import { zeroStatePhase2, ZERO_STATE_PHASE1 } from '@/lib/account-analytics/content-category'
import type { CloudRange } from './use-url-state'

interface LayoutWord {
  text: string
  size: number
  x?: number
  y?: number
  rotate?: number
}

interface Props {
  range: CloudRange
  onRangeChange: (r: CloudRange) => void
  loader: (r: CloudRange) => Promise<{
    words: Array<{ keyword: string; weight: number }>
    annotatedRatio: number
  }>
}

const COLOR_PALETTE = [
  '#FF5E37', '#FFB070', '#2E75B6', '#00B5A8', '#9B59B6',
  '#F39C12', '#16A085', '#E74C3C', '#3498DB', '#34495E',
]

export function KeywordCloud({ range, onRangeChange, loader }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<LayoutWord[]>([])
  const [annotatedRatio, setAnnotatedRatio] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loader(range).then((d) => {
      setAnnotatedRatio(d.annotatedRatio)
      if (d.annotatedRatio < 0.7 || d.words.length === 0) {
        setLayout([])
        setLoading(false)
        return
      }
      const width = containerRef.current?.clientWidth ?? 400
      const height = 240
      const maxWeight = Math.max(...d.words.map((w) => w.weight))
      cloud<LayoutWord>()
        .size([width, height])
        .words(d.words.map((w) => ({ text: w.keyword, size: 12 + (w.weight / maxWeight) * 32 })))
        .padding(4)
        .rotate(0)
        .font('Inter, system-ui, sans-serif')
        .fontSize((d) => d.size)
        .on('end', (rendered) => {
          setLayout(rendered)
          setLoading(false)
        })
        .start()
    })
  }, [range, loader])

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
          热门词云
        </h3>
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border-0 cursor-pointer transition-colors ${
                range === r ? 'bg-white text-[#FF5E37] shadow-sm' : 'text-gray-500'
              }`}
            >
              {r === '7d' ? '近一周' : '近一月'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[240px] flex items-center justify-center">
        {loading ? (
          <span className="text-sm text-gray-400">加载中...</span>
        ) : annotatedRatio < 0.7 ? (
          <span className="text-sm text-gray-400 text-center px-4">
            {annotatedRatio === 0 ? ZERO_STATE_PHASE1 : zeroStatePhase2(annotatedRatio)}
          </span>
        ) : layout.length === 0 ? (
          <span className="text-sm text-gray-400">暂无关键词</span>
        ) : (
          <svg width="100%" height="240" viewBox={`-200 -120 400 240`}>
            {layout.map((w, idx) => (
              <text
                key={`${w.text}-${idx}`}
                textAnchor="middle"
                transform={`translate(${w.x ?? 0},${w.y ?? 0})`}
                fontSize={w.size}
                fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                style={{ fontWeight: 600 }}
              >
                {w.text}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json \
  src/app/\(dashboard\)/account-analytics/\[accountId\]/components/keyword-cloud.tsx
git commit -m "feat(account-analytics): 区块 C-右 KeywordCloud（基于 d3-cloud）"
```

---

### Task 2.9: 接入 DataAnalysisTab 替换占位

**Files:**
- Modify: `src/app/(dashboard)/account-analytics/[accountId]/components/data-analysis-tab.tsx`
- Modify: `src/app/actions/account-analytics-tab1.ts`

- [ ] **Step 1: 加 Server Action**

Append to `src/app/actions/account-analytics-tab1.ts`:

```ts
import { getCategoryDistribution, getKeywordCloud } from '@/lib/dal/account-analytics'

export async function loadCategoryDistributionAction(input: { accountId: string }) {
  const user = await requireAuth()
  return getCategoryDistribution({ orgId: user.organizationId, ...input })
}

export async function loadKeywordCloudAction(input: {
  accountId: string
  range: '7d' | '30d'
}) {
  const user = await requireAuth()
  return getKeywordCloud({ orgId: user.organizationId, ...input })
}
```

- [ ] **Step 2: 替换 DataAnalysisTab 中区块 C 占位**

把原 `data-analysis-tab.tsx` 中的"区块 C Phase 2 占位"那段 GlassCard 替换为：

```tsx
{/* 区块 C 类型占比 + 词云 */}
<GlassCard padding="lg">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <CategoryDistribution loader={categoryLoader} />
    <KeywordCloud range={cloudRange} onRangeChange={setCloudRange} loader={cloudLoader} />
  </div>
</GlassCard>
```

并在组件顶部添加 loader：

```tsx
const { ..., cloudRange, setCloudRange } = useAccountAnalyticsURLState()

const categoryLoader = useCallback(
  () => loadCategoryDistributionAction({ accountId }),
  [accountId],
)
const cloudLoader = useCallback(
  (r: typeof cloudRange) => loadKeywordCloudAction({ accountId, range: r }),
  [accountId],
)
```

import 也补全。

- [ ] **Step 3: tsc + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/account-analytics/\[accountId\]/components/data-analysis-tab.tsx \
  src/app/actions/account-analytics-tab1.ts
git commit -m "feat(account-analytics): DataAnalysisTab 接入区块 C 类型占比 + 词云"
```

---

### Task 2.10: 历史数据回填脚本

**Files:**
- Create: `scripts/backfill-aigc-annotations.ts`

- [ ] **Step 1: 实现**

```ts
// scripts/backfill-aigc-annotations.ts
// 一次性派发全量 aigc 标注事件
import { inngest } from '../src/inngest/client'
import { db } from '../src/db'
import { organizations } from '../src/db/schema'

(async () => {
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
  console.log(`Found ${orgs.length} organizations`)

  for (const org of orgs) {
    await inngest.send({
      name: 'account-analytics/aigc-annotate.requested',
      data: { orgId: org.id, batchSize: 100, chainDepth: 0 },
    })
    console.log(`  → Dispatched for org ${org.name} (${org.id})`)
  }

  console.log('All dispatched. Monitor at Inngest dashboard.')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 加 package.json scripts**

Modify `package.json`:
```json
"db:backfill-aigc": "tsx scripts/backfill-aigc-annotations.ts"
```

- [ ] **Step 3: 干跑（不真派发，先看输出）**

```bash
# 注释掉 inngest.send 后跑一次确认逻辑
npx tsx scripts/backfill-aigc-annotations.ts
```

Expected: 列出所有 org 名字。

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-aigc-annotations.ts package.json
git commit -m "feat(account-analytics): 历史数据回填脚本 backfill-aigc-annotations"
```

---

### Task 2.11: Phase 2 E2E 验收

- [ ] **Step 1: 跑全套测试 + build**

```bash
npx vitest run src/lib/dal/__tests__/account-analytics.test.ts
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 2: Dry-run Inngest function（10 条样本）**

```bash
# 启动 dev
npm run dev
# 另一个 terminal 派发 1 个事件（指定一个 org + 小 batchSize）
npx tsx -e "
import { inngest } from './src/inngest/client';
inngest.send({
  name: 'account-analytics/aigc-annotate.requested',
  data: { orgId: '<your-org-id>', batchSize: 10 }
}).then(() => process.exit(0));
"
```

打开 `http://localhost:8288`（Inngest dev dashboard）观察事件执行。

- [ ] **Step 3: SQL 抽样检查标注质量**

```sql
SELECT title, aigc_content_category, aigc_keywords
FROM collected_items
WHERE aigc_annotated_at IS NOT NULL
ORDER BY aigc_annotated_at DESC
LIMIT 30;
```

人工肉眼审 30 条，正确率应 ≥ 85%。停用词不应出现。

- [ ] **Step 4: 手工验证 UI**

打开 demo 账号详情页 → 数据分析 tab：
- [ ] 区块 C 左侧：发文类型占比条形图，颜色按 AIGC_CATEGORY_COLORS 渲染
- [ ] 区块 C 右侧：词云，字号按权重缩放，颜色多彩
- [ ] 切「近一周/近一月」词云内容变化
- [ ] annotatedRatio < 70% 时显示"分析中（X%）"
- [ ] annotatedRatio = 0 时显示"📊 内容分类与热门词云正在分析中"

- [ ] **Step 5: 截图归档 + Commit**

```bash
# 浏览器截图保存到 docs/screenshots/account-analytics-tab1/
git add docs/screenshots/account-analytics-tab1/
git commit -m "docs(account-analytics): Phase 2 验收截图归档"
```

---

## 附录 A: Phase 0 Audit 结果

**待 implementer 填入** Task 0.1 跑出的实际结果。模板：

| platform | snapshot_count | likes | comments | shares | favorites | views |
|----------|---------------|-------|----------|--------|-----------|-------|
| douyin   | xxxx          | 1.00  | 1.00     | 1.00   | 1.00      | 1.00  |
| ...      |               |       |          |        |           |       |

若 < 0.5 视为该平台该指标无数据 → 调整 Task 1.1 中 `PLATFORM_METRIC_MATRIX[platform].<metric> = false`。

---

## 附录 B: 回滚预案

每个 Phase 都用独立 commit 链，可逐 commit revert。

**Phase 2 紧急回滚（保留 schema 但隐藏 UI）：**
1. 在 `DataAnalysisTab` 中把区块 C 替换回 Phase 1 的占位文案
2. 暂停 Inngest 函数 `account-analytics-annotate-content`（dashboard 操作）
3. 不需 drop schema 字段（保留即可，下次启用时数据已在）

**Phase 1 紧急回滚：**
1. `git revert <commit-sha>...<commit-sha>` 把 Phase 1 所有 commit 回滚
2. 详情页恢复到改造前状态
3. URL `?tab=...` 会被忽略（无影响）

---

## 附录 C: 关联文档

- Spec: `docs/superpowers/specs/2026-05-24-account-analytics-tab1-redesign-design.md`
- ADR: `docs/adr/2026-05-01-platform-supabase-strategy.md`
- 现有 DAL: `src/lib/dal/account-analytics.ts`
- 现有 Inngest: `src/inngest/functions/research/annotate-collected-item.ts`（参照命名空间隔离原则）
