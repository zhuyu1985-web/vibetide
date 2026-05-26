/**
 * accountAnalyticsMonthlyReport —— 每月生成"上月完整自然月"报告。
 *
 * 触发:scheduler 派发 `scheduled-jobs/account-analytics-monthly-report.run` 事件
 *      (默认配置每月 1 号 SH 05:00,可在 scheduled_jobs 表 / UI 改)
 *
 * 行为:
 *   1. 算上月 1 日 ~ 上月末日(Asia/Shanghai)
 *   2. 列出所有 isEnabled = true 且有 outletId 的账号(my + benchmark)
 *   3. 给每个账号派发 `account-analytics/daily-report.requested`(reportType=monthly)
 *   4. 现有 report-generator 会处理 monthly 类型与 weekly/daily 一致(LLM 归因 + distill)
 *
 * 注:窗口选"上月完整自然月"而非"过去 30 天"是行业惯例(媒体行业月度复盘标准做法),
 *      跨月数据不利于复盘归因。
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";

export const accountAnalyticsMonthlyReport = inngest.createFunction(
  {
    id: "account-analytics-monthly-report",
    name: "Account Analytics · 月报",
    concurrency: { limit: 1 },
    retries: 0,
  },
  { event: "scheduled-jobs/account-analytics-monthly-report.run" },
  async ({ step, logger }) => {
    // Step 1:算上月 1 日 ~ 上月末日(Asia/Shanghai)
    const window = await step.run("compute-window", async () => {
      const nowSh = new Date(Date.now() + 8 * 3600 * 1000);
      // 本月 1 日(SH 0 点),再回退 1 毫秒拿上月末
      const thisMonthFirst = new Date(
        Date.UTC(nowSh.getUTCFullYear(), nowSh.getUTCMonth(), 1),
      );
      const lastMonthLast = new Date(thisMonthFirst.getTime() - 1);
      const lastMonthFirst = new Date(
        Date.UTC(lastMonthLast.getUTCFullYear(), lastMonthLast.getUTCMonth(), 1),
      );
      return {
        periodStart: lastMonthFirst.toISOString().slice(0, 10),
        periodEnd: lastMonthLast.toISOString().slice(0, 10),
      };
    });

    // Step 2:列出所有"开启 + 已绑定 outlet"的账号
    const targets = await step.run("list-accounts", async () => {
      const myRows = await db
        .select({
          id: myAccounts.id,
          organizationId: myAccounts.organizationId,
        })
        .from(myAccounts)
        .where(
          and(eq(myAccounts.isEnabled, true), isNotNull(myAccounts.outletId)),
        );
      const benchRows = await db
        .select({
          id: benchmarkAccounts.id,
          organizationId: benchmarkAccounts.organizationId,
        })
        .from(benchmarkAccounts)
        .where(
          and(
            eq(benchmarkAccounts.isEnabled, true),
            isNotNull(benchmarkAccounts.outletId),
            isNotNull(benchmarkAccounts.organizationId),
          ),
        );
      return [
        ...myRows.map((r) => ({
          id: r.id,
          organizationId: r.organizationId!,
          source: "my" as const,
        })),
        ...benchRows.map((r) => ({
          id: r.id,
          organizationId: r.organizationId!,
          source: "benchmark" as const,
        })),
      ];
    });

    logger.info(
      `[monthly-report] 派发 ${targets.length} 个账号月报(${window.periodStart} ~ ${window.periodEnd})`,
    );

    if (targets.length === 0) {
      return { dispatched: 0, ...window };
    }

    // Step 3:逐个派发(并发由 report-generator 自带 concurrency: 3 控制)
    for (const t of targets) {
      await step.sendEvent(`dispatch-monthly-${t.id}`, {
        name: "account-analytics/daily-report.requested",
        data: {
          organizationId: t.organizationId,
          accountId: t.id,
          accountSource: t.source,
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          reportType: "monthly",
          forceRefresh: true,
        },
      });
    }

    return { dispatched: targets.length, ...window };
  },
);
