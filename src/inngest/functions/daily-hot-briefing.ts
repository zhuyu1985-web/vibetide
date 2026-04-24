import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { organizations, userProfiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateDailyHotBriefing } from "@/app/actions/hot-topics";

/**
 * 每日热点快讯 cron：每日北京时间 8:00（UTC 0:00）跑一次。
 *
 * 流程：遍历所有 organizations，对每个 org：
 *   1. 检查 settings.dailyHotBriefing.enabled（默认 true）
 *   2. 找一个 admin / owner 用户作为 operatorId
 *   3. 调 generateDailyHotBriefing 生成简报 + 推送 CMS
 *
 * 单 org 失败不影响其他 org（用 step.run 各自隔离 + try/catch 包裹）。
 */
export const dailyHotBriefingCron = inngest.createFunction(
  {
    id: "daily-hot-briefing-cron",
    name: "Daily Hot Briefing - Cron",
    concurrency: { limit: 5 },
  },
  // 北京时间 8:00 = UTC 0:00
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const orgs = await step.run("list-orgs", async () => {
      return db
        .select({ id: organizations.id, settings: organizations.settings })
        .from(organizations);
    });

    if (orgs.length === 0) {
      return { message: "No organizations" };
    }

    const results: Array<{ orgId: string; ok: boolean; error?: string; articleId?: string }> = [];

    for (const org of orgs) {
      // 单 org 隔离 step：失败不影响其他 org
      const result = await step
        .run(`briefing-${org.id}`, async () => {
          const enabled = org.settings?.dailyHotBriefing?.enabled ?? true;
          if (!enabled) {
            return { orgId: org.id, ok: true, skipped: true } as const;
          }

          // 找一个该 org 的 operator（首选 super admin / 最早创建的 user）
          const [op] = await db
            .select({ id: userProfiles.id })
            .from(userProfiles)
            .where(eq(userProfiles.organizationId, org.id))
            .orderBy(sql`${userProfiles.createdAt} ASC`)
            .limit(1);
          if (!op) {
            return {
              orgId: org.id,
              ok: false,
              error: "no operator user in org",
            } as const;
          }

          const r = await generateDailyHotBriefing({
            organizationId: org.id,
            trigger: "scheduled",
            operatorId: op.id,
          });
          return {
            orgId: org.id,
            ok: true,
            articleId: r.articleId,
            cmsState: r.cmsResult?.cmsState,
          } as const;
        })
        .catch((err) => ({
          orgId: org.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      results.push(result);
    }

    return {
      total: orgs.length,
      successCount: results.filter((r) => r.ok).length,
      failureCount: results.filter((r) => !r.ok).length,
      results,
    };
  },
);
