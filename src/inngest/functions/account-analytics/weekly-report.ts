/**
 * accountAnalyticsWeeklyReport —— 每周生成"上一个完整自然周"账号报告。
 *
 * 触发:scheduler 派发 `scheduled-jobs/account-analytics-weekly-report.run` 事件
 *      (默认配置每周一 SH 07:00,可在 scheduled_jobs 表 / UI 改)
 *
 * 行为:
 *   1. 算上周一 ~ 上周日(Asia/Shanghai)
 *   2. 列出所有 isEnabled = true 且有 outletId 的账号(my + benchmark)
 *   3. 给每个账号派发 `account-analytics/daily-report.requested`(reportType=weekly)
 *   4. 现有 report-generator 会按 weekly 模式跑 LLM 归因 + distill
 *
 * 注:窗口选"上一个完整自然周"而非"过去 7 天滚动"。
 *   - 历史 bug:原来 crawl-cron 每天都派一份 reportType=weekly 的"过去 7 天"报告,
 *     导致每个账号每天产生一份周报,周期 overlapping、ReportsTab 列表混乱。
 *   - 现在跟 monthly-report 对齐:每周固定窗口、每周一次,周报存档清晰可读。
 *   - 07:00 SH 紧接在 daily-snapshot(06:00 SH)之后,确保上周末的 snapshot
 *     已经写完,周报涉及的 collected_items 数据完整。
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";

export const accountAnalyticsWeeklyReport = inngest.createFunction(
  {
    id: "account-analytics-weekly-report",
    name: "Account Analytics · 周报",
    concurrency: { limit: 1 },
    retries: 0,
  },
  { event: "scheduled-jobs/account-analytics-weekly-report.run" },
  async ({ step, logger }) => {
    // Step 1:算上周一 ~ 上周日(Asia/Shanghai)
    const window = await step.run("compute-window", async () => {
      const nowSh = new Date(Date.now() + 8 * 3600 * 1000);
      const todayShStart = new Date(
        Date.UTC(
          nowSh.getUTCFullYear(),
          nowSh.getUTCMonth(),
          nowSh.getUTCDate(),
        ),
      );
      // JS getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat;以周一为周首
      const utcDay = todayShStart.getUTCDay();
      const daysSinceThisMonday = utcDay === 0 ? 6 : utcDay - 1;
      const thisWeekMondayStart = new Date(
        todayShStart.getTime() - daysSinceThisMonday * 24 * 3600 * 1000,
      );
      const lastWeekMondayStart = new Date(
        thisWeekMondayStart.getTime() - 7 * 24 * 3600 * 1000,
      );
      const lastWeekSundayStart = new Date(
        thisWeekMondayStart.getTime() - 24 * 3600 * 1000,
      );
      return {
        periodStart: lastWeekMondayStart.toISOString().slice(0, 10),
        periodEnd: lastWeekSundayStart.toISOString().slice(0, 10),
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
      `[weekly-report] 派发 ${targets.length} 个账号周报(${window.periodStart} ~ ${window.periodEnd})`,
    );

    if (targets.length === 0) {
      return { dispatched: 0, ...window };
    }

    // Step 3:逐个派发(并发由 report-generator 自带 concurrency: 3 控制)
    for (const t of targets) {
      await step.sendEvent(`dispatch-weekly-${t.id}`, {
        name: "account-analytics/daily-report.requested",
        data: {
          organizationId: t.organizationId,
          accountId: t.id,
          accountSource: t.source,
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          reportType: "weekly",
          forceRefresh: true,
        },
      });
    }

    return { dispatched: targets.length, ...window };
  },
);
