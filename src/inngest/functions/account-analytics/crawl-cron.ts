/**
 * accountAnalyticsCrawlCron —— 每天 05:00 SH（UTC 21:00 前一日）跑。
 *
 * 流程：
 *   1. 查所有 crawl_cron_enabled = true 且 outlet_id IS NOT NULL 的 my/benchmark 账号
 *   2. 对每个账号：ensureTikHubAccountSource → 派发 collection/source.run-requested
 *   3. 更新 account.last_crawled_at
 *
 * 说明：
 *   - 本函数只负责"拉数据"。日报由 account-analytics-daily-snapshot(06:00)
 *     处理,周报由 account-analytics-weekly-report(每周一 07:00)处理,
 *     月报由 account-analytics-monthly-report(每月 1 号 05:00)处理。
 *   - 历史 bug 修正(2026-05-31):之前这里每天都派一份 reportType=weekly 的
 *     "过去 7 天"报告,导致每个账号每天产生一份周报,周期 overlapping。
 *     现已拆分到独立 weekly-report.ts,按"上一个完整自然周"窗口跑。
 *   - 用户用 toggleAccountCrawlCron Server Action 在 UI 上勾选要自动抓的账号
 *   - 未配置 outlet/secUid 的账号会被跳过并记录 warn 日志
 */

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { ensureTikHubAccountSource } from "@/lib/account-analytics/ensure-source";
import { isTikhubAccountSupported } from "@/lib/topic-compare/constants";

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

    return {
      dispatched,
      skipped,
      skippedDetails,
    };
  },
);
