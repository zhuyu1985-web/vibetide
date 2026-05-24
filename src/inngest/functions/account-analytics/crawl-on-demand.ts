import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureTikHubAccountSource } from "@/lib/account-analytics/ensure-source";

/**
 * 即时抓取请求 —— 给一个账号触发 Collection Hub TikHub Account 模式。
 *
 * 与 cron 行为对齐：调 ensureTikHubAccountSource 自动建/更新 collection_source。
 * 仅当账号无 outlet 或 outlet.channels 缺识别符时才 skip。
 */
export const accountAnalyticsCrawlOnDemand = inngest.createFunction(
  {
    id: "account-analytics-crawl-on-demand",
    name: "Account Analytics · 即时抓取",
    concurrency: { limit: 5 },
    retries: 1,
  },
  { event: "account-analytics/crawl.requested" },
  async ({ event, step }) => {
    const { organizationId, accountId, accountSource } = event.data;

    // Step 1：解析账号 → 拿 outletId / handle / platform / name
    const account = await step.run("load-account", async () => {
      const row =
        accountSource === "my"
          ? await db.query.myAccounts.findFirst({
              where: eq(myAccounts.id, accountId),
            })
          : await db.query.benchmarkAccounts.findFirst({
              where: eq(benchmarkAccounts.id, accountId),
            });
      if (!row) throw new Error(`account ${accountId} not found`);
      return {
        name: row.name,
        handle: row.handle,
        platform: row.platform,
        outletId: row.outletId,
      };
    });

    if (!account.outletId) {
      return {
        dispatched: false,
        reason: "account_missing_outlet",
        accountId,
      };
    }

    // Step 2：ensure source（自动建/更新 + enable）
    const ensured = await step.run("ensure-source", async () =>
      ensureTikHubAccountSource({
        organizationId,
        accountId,
        accountName: account.name,
        accountSource,
        platform: account.platform,
        outletId: account.outletId!,
        maxPagesPerRun: 3,
        resultsPerPage: 20,
        monthlyBudgetUsd: 3,
      }),
    );

    if (!ensured.ok) {
      console.warn("[account-analytics/crawl] ensureTikHubAccountSource skip", {
        organizationId,
        accountId,
        platform: account.platform,
        reason: ensured.skipReason,
      });
      return {
        dispatched: false,
        reason: ensured.skipReason,
        platform: account.platform,
        handle: account.handle,
      };
    }

    // Step 3：派发 collection 标准事件
    await step.sendEvent("dispatch-collection-run", {
      name: "collection/source.run-requested",
      data: {
        sourceId: ensured.sourceId,
        organizationId,
        trigger: "event",
      },
    });

    // Step 4：更新 account.last_crawled_at
    await step.run("update-last-crawled", async () => {
      if (accountSource === "my") {
        await db
          .update(myAccounts)
          .set({ lastCrawledAt: new Date(), updatedAt: new Date() })
          .where(eq(myAccounts.id, accountId));
      } else {
        await db
          .update(benchmarkAccounts)
          .set({ lastCrawledAt: new Date(), updatedAt: new Date() })
          .where(eq(benchmarkAccounts.id, accountId));
      }
    });

    // Step 5：等 TikHub 抓取 + writeItems 完成（与 cron 同款 3 分钟，比 cron 短因为单账号量小）
    await step.sleep("wait-for-crawl", "3m");

    // Step 6：派发日报生成（区间 = 过去 7 天）
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
    const periodStart = sevenDaysAgo.toISOString().slice(0, 10);
    const periodEnd = today.toISOString().slice(0, 10);

    await step.sendEvent("dispatch-report-generation", {
      name: "account-analytics/daily-report.requested",
      data: {
        organizationId,
        accountId,
        accountSource,
        periodStart,
        periodEnd,
        reportType: "weekly",
        forceRefresh: true,
      },
    });

    return {
      dispatched: true,
      sourceId: ensured.sourceId,
      created: ensured.created,
      reportPeriod: { start: periodStart, end: periodEnd },
    };
  },
);
