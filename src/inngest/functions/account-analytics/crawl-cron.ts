/**
 * accountAnalyticsCrawlCron —— 每天 05:00 SH（UTC 21:00 前一日）跑。
 *
 * 流程：
 *   1. 查所有 crawl_cron_enabled = true 且 outlet_id IS NOT NULL 的 my/benchmark 账号
 *   2. 对每个账号：ensureTikHubAccountSource → 派发 collection/source.run-requested
 *   3. 更新 account.last_crawled_at
 *   4. 派发 account-analytics/daily-report.requested（区间 = 过去 7 天）
 *
 * 设计：
 *   - 默认 7 天窗口，覆盖大多数账号 daily 节奏
 *   - 用户用 toggleAccountCrawlCron Server Action 在 UI 上勾选要自动抓的账号
 *   - 未配置 outlet/secUid 的账号会被跳过并记录 warn 日志
 */

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { ensureTikHubAccountSource } from "@/lib/account-analytics/ensure-source";
import { isTikhubAccountSupported } from "@/lib/topic-compare/constants";

const HISTORY_DAYS = 7;

interface AccountTarget {
  id: string;
  name: string;
  platform: string;
  source: "my" | "benchmark";
  organizationId: string;
  outletId: string;
}

export const accountAnalyticsCrawlCron = inngest.createFunction(
  {
    id: "account-analytics-crawl-cron",
    name: "Account Analytics · 每天自动抓取",
    concurrency: { limit: 1 }, // 串行跑避免 TikHub 额度爆炸
    retries: 0,
  },
  // 触发时机由 scheduled_jobs.account-analytics-crawl 表配置(默认 SH 05:00)
  { event: "scheduled-jobs/account-analytics-crawl.run" },
  async ({ step, logger }) => {
    // Step 1：取所有要自动抓的账号（两表 union）
    const targets = await step.run("load-enabled-accounts", async () => {
      const my = await db
        .select({
          id: myAccounts.id,
          name: myAccounts.name,
          platform: myAccounts.platform,
          organizationId: myAccounts.organizationId,
          outletId: myAccounts.outletId,
        })
        .from(myAccounts)
        .where(
          and(
            eq(myAccounts.crawlCronEnabled, true),
            eq(myAccounts.isEnabled, true),
            isNotNull(myAccounts.outletId),
          ),
        );
      const bench = await db
        .select({
          id: benchmarkAccounts.id,
          name: benchmarkAccounts.name,
          platform: benchmarkAccounts.platform,
          organizationId: benchmarkAccounts.organizationId,
          outletId: benchmarkAccounts.outletId,
        })
        .from(benchmarkAccounts)
        .where(
          and(
            eq(benchmarkAccounts.crawlCronEnabled, true),
            eq(benchmarkAccounts.isEnabled, true),
            isNotNull(benchmarkAccounts.outletId),
          ),
        );
      const allRaw: AccountTarget[] = [
        ...my.map((r) => ({ ...r, source: "my" as const, outletId: r.outletId! })),
        ...bench
          .filter((r): r is typeof r & { organizationId: string } => r.organizationId !== null)
          .map((r) => ({
            ...r,
            source: "benchmark" as const,
            outletId: r.outletId!,
          })),
      ];
      const all = allRaw.filter((r) => isTikhubAccountSupported(r.platform));
      const skippedPlatformCount = allRaw.length - all.length;
      if (skippedPlatformCount > 0) {
        const skippedNames = allRaw
          .filter((r) => !isTikhubAccountSupported(r.platform))
          .map((r) => `${r.name}(${r.platform})`);
        console.log(
          `[crawl-cron] skipped ${skippedPlatformCount} accounts: platform not in TikHub account whitelist —— ${skippedNames.join(", ")}`,
        );
      }
      return all;
    });

    logger.info(`account-analytics cron: ${targets.length} 个账号待抓取`);
    if (targets.length === 0) {
      return { dispatched: 0, skipped: 0 };
    }

    // Step 2：循环 ensure source + 触发抓取
    let dispatched = 0;
    let skipped = 0;
    const skippedDetails: Array<{ accountId: string; reason: string }> = [];

    for (const t of targets) {
      const stepResult = await step.run(`crawl-${t.id}`, async () => {
        const ensured = await ensureTikHubAccountSource({
          organizationId: t.organizationId,
          accountId: t.id,
          accountName: t.name,
          accountSource: t.source,
          platform: t.platform,
          outletId: t.outletId,
          maxPagesPerRun: 3,
          resultsPerPage: 20,
          monthlyBudgetUsd: 3,
        });
        if (!ensured.ok) {
          return { skip: true as const, reason: ensured.skipReason };
        }
        return { skip: false as const, sourceId: ensured.sourceId, created: ensured.created };
      });

      if (stepResult.skip) {
        skipped++;
        skippedDetails.push({ accountId: t.id, reason: stepResult.reason });
        logger.warn(`account-analytics cron skip ${t.name}/${t.platform}: ${stepResult.reason}`);
        continue;
      }

      // 派发 collection 抓取事件
      await step.sendEvent(`dispatch-${t.id}`, {
        name: "collection/source.run-requested",
        data: {
          sourceId: stepResult.sourceId,
          organizationId: t.organizationId,
          trigger: "cron",
        },
      });

      // 更新账号 last_crawled_at
      await step.run(`update-last-crawled-${t.id}`, async () => {
        if (t.source === "my") {
          await db
            .update(myAccounts)
            .set({ lastCrawledAt: new Date(), updatedAt: new Date() })
            .where(eq(myAccounts.id, t.id));
        } else {
          await db
            .update(benchmarkAccounts)
            .set({ lastCrawledAt: new Date(), updatedAt: new Date() })
            .where(eq(benchmarkAccounts.id, t.id));
        }
      });

      dispatched++;
    }

    // Step 3：等待 5 分钟让 TikHub 抓取 + writeItems 完成，然后派发报告生成事件
    // （注意：collection-run-source 是另一条独立 Inngest 函数，不能 await，只能等估计时间）
    await step.sleep("wait-for-crawl", "5m");

    // Step 4：派发日报生成事件（默认窗口 = 过去 7 天，但 report-generator 内部会自动收敛）
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - HISTORY_DAYS * 24 * 3600 * 1000);
    const periodStart = sevenDaysAgo.toISOString().slice(0, 10);
    const periodEnd = today.toISOString().slice(0, 10);

    for (const t of targets) {
      // 只对成功抓取的派
      const skippedIds = new Set(skippedDetails.map((s) => s.accountId));
      if (skippedIds.has(t.id)) continue;

      await step.sendEvent(`gen-report-${t.id}`, {
        name: "account-analytics/daily-report.requested",
        data: {
          organizationId: t.organizationId,
          accountId: t.id,
          accountSource: t.source,
          periodStart,
          periodEnd,
          reportType: "weekly", // 7 天默认 = 周报；report-generator 内部会按实际数据跨度回收
          forceRefresh: true,
        },
      });
    }

    return {
      dispatched,
      skipped,
      skippedDetails,
      periodStart,
      periodEnd,
    };
  },
);
