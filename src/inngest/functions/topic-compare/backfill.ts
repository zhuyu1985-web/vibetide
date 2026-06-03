/**
 * topicCompareBackfill
 *
 * 监听 `topic-compare/backfill.requested`，一次性回填指定账号的最近 30 条帖子
 * 到 my_posts / benchmark_posts 表。
 *
 * 触发场景：在 `/topic-compare/[id]` 点击"更新"或切换 enabled 开关时，
 * 立即 backfill 一次历史数据，而不用等下次 cron。
 */

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { backfillAccount } from "@/lib/topic-compare/backfill";

export const topicCompareBackfill = inngest.createFunction(
  {
    id: "topic-compare/backfill",
    name: "Topic Compare · Backfill on toggle",
    concurrency: 2,
    retries: 2,
  },
  { event: "topic-compare/backfill.requested" },
  async ({ event, step, logger }) => {
    const { organizationId, accountKind, accountId } = event.data;

    const account = await step.run("load-account", async () => {
      if (accountKind === "my") {
        const [a] = await db
          .select()
          .from(myAccounts)
          .where(eq(myAccounts.id, accountId))
          .limit(1);
        return a;
      }
      const [a] = await db
        .select()
        .from(benchmarkAccounts)
        .where(eq(benchmarkAccounts.id, accountId))
        .limit(1);
      return a;
    });

    if (!account) {
      logger.error("[backfill] account not found", { accountKind, accountId });
      return { error: "account-not-found" };
    }

    const result = await step.run("backfill", async () => {
      return backfillAccount({
        organizationId,
        kind: accountKind,
        accountId,
        platform: account.platform,
        handle: account.handle,
      });
    });

    return result;
  },
);
