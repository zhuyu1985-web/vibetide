import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  myAccounts,
  benchmarkAccounts,
  accountDailySnapshots,
  collectedItems,
} from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  calculateCompositeScore,
  DEFAULT_COMPOSITE_SCORE_WEIGHTS,
} from "@/lib/account-analytics/composite-score";

/**
 * 每天 06:00 Asia/Shanghai：
 *   1. 遍历所有 enabled my_accounts + benchmark_accounts（带 organizationId）
 *   2. 对每个账号：把昨日（业务日 = Asia/Shanghai 0~24 时）的 collected_items
 *      按 (organization_id, account_id) 聚合为 1 行 snapshot
 *   3. upsert account_daily_snapshots
 *   4. 派发 account-analytics/daily-report.requested 触发 LLM 归因
 *
 * Cron 表达式：Inngest 默认 UTC。Asia/Shanghai 06:00 = UTC 22:00（前一天）
 */
export const accountAnalyticsDailySnapshot = inngest.createFunction(
  {
    id: "account-analytics-daily-snapshot",
    name: "Account Analytics · 日报快照",
    concurrency: { limit: 1 }, // 串行，避免重复扫表
    retries: 2,
  },
  { cron: "0 22 * * *" }, // 22:00 UTC = 06:00 Asia/Shanghai（次日）
  async ({ step }) => {
    // Step 1：算昨日业务日窗口（Asia/Shanghai）
    const { yesterdayDate, windowStart, windowEnd } = await step.run(
      "compute-window",
      async () => {
        // 当前 UTC + 8h = Asia/Shanghai 时间
        const nowSh = new Date(Date.now() + 8 * 3600 * 1000);
        // 昨日 0 点（Asia/Shanghai）= 今日 0 点 - 24h
        const todayShStart = new Date(
          Date.UTC(
            nowSh.getUTCFullYear(),
            nowSh.getUTCMonth(),
            nowSh.getUTCDate(),
          ),
        );
        const yesterdayShStart = new Date(
          todayShStart.getTime() - 24 * 3600 * 1000,
        );
        // 转回 UTC（Asia/Shanghai 0 点 = UTC 前一天 16 点）
        const startUtc = new Date(yesterdayShStart.getTime() - 8 * 3600 * 1000);
        const endUtc = new Date(todayShStart.getTime() - 8 * 3600 * 1000);
        const dateStr = yesterdayShStart.toISOString().slice(0, 10);
        return {
          yesterdayDate: dateStr,
          windowStart: startUtc.toISOString(),
          windowEnd: endUtc.toISOString(),
        };
      },
    );

    // Step 2：列出所有需要快照的账号（我方 + 对标）
    const targets = await step.run("list-accounts", async () => {
      const myRows = await db
        .select({
          id: myAccounts.id,
          organizationId: myAccounts.organizationId,
          platform: myAccounts.platform,
          handle: myAccounts.handle,
          name: myAccounts.name,
          outletId: myAccounts.outletId,
        })
        .from(myAccounts)
        .where(eq(myAccounts.isEnabled, true));

      const benchRows = await db
        .select({
          id: benchmarkAccounts.id,
          organizationId: benchmarkAccounts.organizationId,
          platform: benchmarkAccounts.platform,
          handle: benchmarkAccounts.handle,
          name: benchmarkAccounts.name,
          outletId: benchmarkAccounts.outletId,
        })
        .from(benchmarkAccounts)
        .where(eq(benchmarkAccounts.isEnabled, true));

      const list: Array<{
        id: string;
        organizationId: string | null;
        platform: string;
        handle: string;
        name: string;
        outletId: string | null;
        source: "my" | "benchmark";
      }> = [];
      for (const r of myRows) {
        list.push({ ...r, source: "my" });
      }
      for (const r of benchRows) {
        // benchmark 全局预设账号（organizationId = null）跳过 —— 没有 org scope 就没法落 snapshot
        if (!r.organizationId) continue;
        list.push({
          id: r.id,
          organizationId: r.organizationId,
          platform: r.platform,
          handle: r.handle,
          name: r.name,
          outletId: r.outletId,
          source: "benchmark",
        });
      }
      return list;
    });

    if (targets.length === 0) {
      return { snapshotsCreated: 0, reportsDispatched: 0, yesterdayDate };
    }

    // Step 3：对每个账号聚合 + upsert snapshot + 派发报告事件
    let snapshotsCreated = 0;
    let reportsDispatched = 0;

    for (const target of targets) {
      if (!target.organizationId) continue;

      const aggregated = await step.run(
        `aggregate-${target.id}`,
        async () => {
          // 匹配规则（OR）：
          //   1. collected_items.account_handle = my_accounts.handle (自定义短 ID)
          //   2. collected_items.account_id = my_accounts.id (UUID)
          //   3. collected_items.outlet_id = my_accounts.outlet_id (账号模式下唯一稳定的桥)
          //      ← weibo/douyin adapter 把 uid 写到 account_id，跟 my_accounts.id UUID 对不上,
          //         必须靠 outlet_id 桥接才能聚合到正确的账号
          const rows = await db
            .select({
              id: collectedItems.id,
              likeCount: collectedItems.likeCount,
              commentCount: collectedItems.commentCount,
              shareCount: collectedItems.shareCount,
              viewCount: collectedItems.viewCount,
              favoriteCount: collectedItems.favoriteCount,
              compositeScore: collectedItems.compositeScore,
              publishedAt: collectedItems.publishedAt,
            })
            .from(collectedItems)
            .where(
              and(
                eq(collectedItems.organizationId, target.organizationId!),
                eq(collectedItems.platform, target.platform),
                target.outletId
                  ? sql`(
                      ${collectedItems.accountHandle} = ${target.handle}
                      OR ${collectedItems.accountId} = ${target.id}
                      OR ${collectedItems.outletId} = ${target.outletId}
                    )`
                  : sql`(
                      ${collectedItems.accountHandle} = ${target.handle}
                      OR ${collectedItems.accountId} = ${target.id}
                    )`,
                gte(collectedItems.publishedAt, new Date(windowStart)),
                lt(collectedItems.publishedAt, new Date(windowEnd)),
              ),
            );

          if (rows.length === 0) {
            return {
              postCount: 0,
              totalLikes: 0,
              totalComments: 0,
              totalShares: 0,
              totalViews: 0,
              totalFavorites: 0,
              compositeScoreTotal: 0,
              compositeScoreAvg: 0,
              topPostId: null as string | null,
            };
          }

          let totalLikes = 0,
            totalComments = 0,
            totalShares = 0,
            totalViews = 0,
            totalFavorites = 0,
            compositeScoreTotal = 0;
          let topPostId: string | null = null;
          let topScore = -Infinity;

          for (const r of rows) {
            totalLikes += r.likeCount;
            totalComments += r.commentCount;
            totalShares += r.shareCount;
            totalViews += r.viewCount;
            totalFavorites += r.favoriteCount;
            const score =
              r.compositeScore > 0
                ? r.compositeScore
                : calculateCompositeScore(
                    {
                      likes: r.likeCount,
                      comments: r.commentCount,
                      shares: r.shareCount,
                      favorites: r.favoriteCount,
                      views: r.viewCount,
                    },
                    DEFAULT_COMPOSITE_SCORE_WEIGHTS,
                  );
            compositeScoreTotal += score;
            if (score > topScore) {
              topScore = score;
              topPostId = r.id;
            }
          }

          return {
            postCount: rows.length,
            totalLikes,
            totalComments,
            totalShares,
            totalViews,
            totalFavorites,
            compositeScoreTotal,
            compositeScoreAvg: compositeScoreTotal / rows.length,
            topPostId,
          };
        },
      );

      if (aggregated.postCount === 0) continue;

      await step.run(`upsert-snapshot-${target.id}`, async () => {
        await db
          .insert(accountDailySnapshots)
          .values({
            organizationId: target.organizationId!,
            accountId: target.id,
            accountSource: target.source,
            platform: target.platform,
            snapshotDate: yesterdayDate,
            postCount: aggregated.postCount,
            totalLikes: aggregated.totalLikes,
            totalComments: aggregated.totalComments,
            totalShares: aggregated.totalShares,
            totalViews: aggregated.totalViews,
            totalFavorites: aggregated.totalFavorites,
            compositeScoreTotal: aggregated.compositeScoreTotal,
            compositeScoreAvg: aggregated.compositeScoreAvg,
            topPostId: aggregated.topPostId,
            rawMetrics: aggregated as unknown as Record<string, unknown>,
          })
          .onConflictDoUpdate({
            target: [
              accountDailySnapshots.organizationId,
              accountDailySnapshots.accountId,
              accountDailySnapshots.snapshotDate,
            ],
            set: {
              postCount: aggregated.postCount,
              totalLikes: aggregated.totalLikes,
              totalComments: aggregated.totalComments,
              totalShares: aggregated.totalShares,
              totalViews: aggregated.totalViews,
              totalFavorites: aggregated.totalFavorites,
              compositeScoreTotal: aggregated.compositeScoreTotal,
              compositeScoreAvg: aggregated.compositeScoreAvg,
              topPostId: aggregated.topPostId,
              computedAt: new Date(),
            },
          });
        snapshotsCreated++;
      });

      // 派发日报生成事件（异步处理，不阻塞下一个账号）
      await step.sendEvent(`dispatch-report-${target.id}`, {
        name: "account-analytics/daily-report.requested",
        data: {
          organizationId: target.organizationId!,
          accountId: target.id,
          accountSource: target.source,
          periodStart: yesterdayDate,
          periodEnd: yesterdayDate,
          reportType: "daily" as const,
        },
      });
      reportsDispatched++;
    }

    return { snapshotsCreated, reportsDispatched, yesterdayDate };
  },
);
