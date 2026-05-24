import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { organizations } from '@/db/schema'
// myAccounts 在 topic-compare-v2.ts,不在 account-analytics.ts
import { myAccounts } from '@/db/schema/topic-compare-v2'
import { accountDailySnapshots } from '@/db/schema/account-analytics'
import { collectedItems } from '@/db/schema/collection'
import { eq, inArray } from 'drizzle-orm'
import {
  getMetricSeries,
  getPublishActivity,
  getRecentTopPosts,
} from '../account-analytics'

let orgId: string
let accountId: string

beforeAll(async () => {
  const ts = Date.now()
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'ci-metric-series',
      slug: `ci-metric-${ts}`,
    })
    .returning()
  orgId = org.id

  const [acc] = await db
    .insert(myAccounts)
    .values({
      organizationId: orgId,
      platform: 'douyin',
      handle: `test_handle_${ts}`,
      name: 'Test Account',
    })
    .returning()
  accountId = acc.id

  // 插 5 天 snapshots
  const today = new Date()
  for (let i = 0; i < 5; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    await db.insert(accountDailySnapshots).values({
      organizationId: orgId,
      accountId,
      accountSource: 'my',
      platform: 'douyin',
      snapshotDate: d.toISOString().slice(0, 10),
      postCount: 1,
      totalLikes: 100 * (i + 1),
      totalComments: 10 * (i + 1),
      totalShares: 5 * (i + 1),
      totalViews: 1000 * (i + 1),
      totalFavorites: 3 * (i + 1),
      compositeScoreTotal: 50,
      compositeScoreAvg: 50,
    })
  }
})

afterAll(async () => {
  await db
    .delete(accountDailySnapshots)
    .where(eq(accountDailySnapshots.accountId, accountId))
  await db.delete(myAccounts).where(eq(myAccounts.id, accountId))
  await db.delete(organizations).where(eq(organizations.id, orgId))
})

describe('getMetricSeries', () => {
  it('返回按日粒度的 likes 序列', async () => {
    const series = await getMetricSeries({
      orgId,
      accountId,
      granularity: 'day',
      metric: 'likes',
    })
    expect(series.length).toBeGreaterThanOrEqual(5)
    expect(
      series.every(
        (p) => typeof p.bucket === 'string' && typeof p.value === 'number',
      ),
    ).toBe(true)
    // 升序排列
    expect(series[0].bucket <= series[series.length - 1].bucket).toBe(true)
  })

  it('未知 metric 抛 error', async () => {
    await expect(
      getMetricSeries({
        orgId,
        accountId,
        granularity: 'day',
        // @ts-expect-error 故意传无效值
        metric: 'invalid',
      }),
    ).rejects.toThrow()
  })

  it('跨 org 无数据返回空数组', async () => {
    const otherOrgId = randomUUID() // 随机生成（node:crypto），保证查不到任何数据
    const series = await getMetricSeries({
      orgId: otherOrgId,
      accountId,
      granularity: 'day',
      metric: 'likes',
    })
    expect(series).toEqual([])
  })
})

describe('getPublishActivity', () => {
  it('返回 buckets + summary 6 项', async () => {
    const result = await getPublishActivity({
      orgId,
      accountId,
      platform: 'douyin',
      granularity: 'day',
    })
    expect(result.buckets.length).toBeGreaterThan(0)
    expect(result.buckets[0]).toMatchObject({
      bucket: expect.any(String),
      publishCount: expect.any(Number),
    })
    // 抖音平台 PLATFORM_SUMMARY_CARDS.douyin = ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalShares']
    expect(Object.keys(result.summary).sort()).toEqual(
      ['avgViews', 'maxViews', 'publishCount', 'totalLikes', 'totalShares', 'totalViews'].sort(),
    )
  })

  it('未知 platform 走 fallback 6 项', async () => {
    const result = await getPublishActivity({
      orgId,
      accountId,
      platform: 'unknown-platform',
      granularity: 'day',
    })
    // FALLBACK_SUMMARY_CARDS = ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalComments']
    expect(Object.keys(result.summary).sort()).toEqual(
      ['avgViews', 'maxViews', 'publishCount', 'totalComments', 'totalLikes', 'totalViews'].sort(),
    )
  })
})

// ---------------------------------------------------------------------------
// Task 1.4 · getRecentTopPosts —— 近 30 天 TOP N（hot/latest）
// ---------------------------------------------------------------------------
// 复用 orgId / accountId（Task 1.2 fixture）。collected_items.accountId 是 text
// 列，my_accounts.id 是 uuid，PG 自动 cast，跨表用同一 string 即可。

let itemId1: string
let itemId2: string

beforeAll(async () => {
  const now = new Date()
  const fp1 = randomUUID()
  const fp2 = randomUUID()
  const inserted = await db
    .insert(collectedItems)
    .values([
      {
        organizationId: orgId,
        accountId,
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
        canonicalUrl: 'https://example.com/top1',
        coverImageUrl: 'https://example.com/top1-cover.jpg',
      },
      {
        organizationId: orgId,
        accountId,
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
    ])
    .returning({ id: collectedItems.id })
  itemId1 = inserted[0].id
  itemId2 = inserted[1].id
})

afterAll(async () => {
  await db
    .delete(collectedItems)
    .where(inArray(collectedItems.id, [itemId1, itemId2]))
})

describe('getRecentTopPosts', () => {
  it('mode=hot 按 compositeScore 降序', async () => {
    const rows = await getRecentTopPosts({
      orgId,
      accountId,
      mode: 'hot',
      limit: 5,
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].score >= (rows[1]?.score ?? 0)).toBe(true)
    // 验证 alias 输出
    expect(rows[0].sourceUrl).toContain('example.com')
    // thumbnail 可能 null（item2 没设 coverImageUrl）
    expect(
      typeof rows[0].thumbnail === 'string' || rows[0].thumbnail === null,
    ).toBe(true)
  })

  it('mode=latest 按 publishedAt 降序', async () => {
    const rows = await getRecentTopPosts({
      orgId,
      accountId,
      mode: 'latest',
      limit: 5,
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(new Date(rows[0].publishedAt).getTime()).toBeGreaterThan(
      new Date(rows[1]?.publishedAt ?? 0).getTime() - 1,
    )
  })
})
