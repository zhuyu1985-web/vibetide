import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { benchmarkAccounts, myAccounts } from "@/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { detectMissedTopicsForOrg } from "@/lib/topic-matching/missed-topic-finder";

/**
 * 漏题日检测 cron：每日 06:00 Shanghai 时间跑一次。
 *
 * 流程：
 *   1. 收集所有启用了 crawl cron 的组织 ID
 *      - 从 benchmark_accounts 表取组织
 *      - 从 my_accounts 表取组织
 *      - 去重后得到 org 列表
 *   2. 对每个 org，并发运行 detectMissedTopicsForOrg（sinceDays=14）
 *   3. 单 org 失败不影响其他（try/catch + 记录日志）
 *   4. 返回汇总结果（处理了多少 org + 各 org 检测结果）
 */
export const missedTopicDetectionDaily = inngest.createFunction(
  {
    id: "topic-compare/missed-topic-daily",
    name: "Topic Compare · 漏题日检测",
    concurrency: { limit: 2 },
  },
  // 06:00 Shanghai 每天
  { cron: "TZ=Asia/Shanghai 0 6 * * *" },
  async ({ step, logger }) => {
    const orgIds = await step.run("collect-org-ids", async () => {
      const benchOrgs = await db
        .selectDistinct({ orgId: benchmarkAccounts.organizationId })
        .from(benchmarkAccounts)
        .where(
          and(
            eq(benchmarkAccounts.crawlCronEnabled, true),
            isNotNull(benchmarkAccounts.organizationId),
          ),
        );
      const myOrgs = await db
        .selectDistinct({ orgId: myAccounts.organizationId })
        .from(myAccounts)
        .where(eq(myAccounts.crawlCronEnabled, true));
      const set = new Set<string>();
      for (const r of benchOrgs) if (r.orgId) set.add(r.orgId);
      for (const r of myOrgs) if (r.orgId) set.add(r.orgId);
      return [...set];
    });

    const results: Array<{ orgId: string; result: unknown }> = [];
    for (const orgId of orgIds) {
      const result = await step
        .run(`detect-${orgId}`, async () => {
          return detectMissedTopicsForOrg({ orgId, sinceDays: 14 });
        })
        .catch((err) => {
          logger.error(`[missed-topic-cron] org=${orgId} failed`, err);
          return { error: err instanceof Error ? err.message : String(err) };
        });
      results.push({ orgId, result });
    }

    return { orgsProcessed: results.length, results };
  },
);
