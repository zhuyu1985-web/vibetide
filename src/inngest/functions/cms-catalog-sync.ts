import { inngest } from "@/inngest/client";
import { syncCmsCatalogs, type SyncResult } from "@/lib/cms";
import { db } from "@/db";

/**
 * 每日栏目同步 —— 为所有 organization 跑一次。
 *
 * Cron: 02:00 Asia/Shanghai daily
 * Concurrency: 1 —— 所有 org 串行，避免共享 CMS 侧限流。
 *
 * 设计文档：docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md §11.5
 */
export const cmsCatalogSyncDaily = inngest.createFunction(
  {
    id: "cms-catalog-sync-daily",
    name: "[CMS P1] 每日栏目同步",
    concurrency: { limit: 1 },
  },
  { cron: "TZ=Asia/Shanghai 0 2 * * *" },
  async ({ step, logger }) => {
    const orgs = await step.run("fetch-orgs", async () =>
      db.query.organizations.findMany(),
    );
    logger.info(`catalog-sync-daily: 准备同步 ${orgs.length} 个组织`);

    const results: Array<{
      orgId: string;
      ok: boolean;
      stats?: SyncResult["stats"];
    }> = [];

    for (const org of orgs) {
      const result = await step.run(`sync-${org.id}`, async () =>
        syncCmsCatalogs(org.id, {
          triggerSource: "scheduled",
          deleteMissing: true,
        }),
      );
      results.push({ orgId: org.id, ok: result.success, stats: result.stats });
      if (!result.success) {
        logger.warn(
          `catalog-sync: org=${org.id} failed: ${result.error?.message ?? "unknown error"}`,
        );
      }
    }

    return { totalOrgs: orgs.length, results };
  },
);

/**
 * 按需触发（event='cms/catalog-sync.trigger'）。
 *
 * 使用场景：
 *   1. cms_publish 遇到 catalog_not_found 时自我修复（triggerSource='auto_repair'）
 *   2. 管理员在 UI 手动触发（triggerSource='manual'）
 *   3. 首次接入 CMS 时初始化（triggerSource='first_time_setup'）
 *
 * Concurrency: { limit: 3, key: organizationId } —— 同 org 不并发，不同 org 最多 3 并发。
 */
export const cmsCatalogSyncOnDemand = inngest.createFunction(
  {
    id: "cms-catalog-sync-on-demand",
    name: "[CMS P1] 栏目同步按需触发",
    concurrency: { limit: 3, key: "event.data.organizationId" },
  },
  { event: "cms/catalog-sync.trigger" },
  async ({ event, step }) => {
    return step.run("sync", async () =>
      syncCmsCatalogs(event.data.organizationId, {
        triggerSource: event.data.triggerSource ?? "auto_repair",
        operatorId: event.data.operatorId,
        deleteMissing: event.data.deleteMissing ?? true,
      }),
    );
  },
);
