import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { externalPublications } from "@/db/schema";
import { rollupArticleStatus } from "@/lib/ayrshare";

/**
 * `external/publication.completed` 消费者：
 *
 *   1. 收到 webhook 路由派发的事件（articleId + ayrsharePostId + status）
 *   2. 再次确认该 ayrsharePostId 对应的 external_publications 行状态分布
 *   3. 调 `rollupArticleStatus(articleId)` 重算 articles.externalPublishStatus
 *      值域：null | "pending" | "partial" | "published" | "failed"
 *
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.3
 */
export const ayrshareWebhookHandler = inngest.createFunction(
  {
    id: "ayrshare-webhook-handler",
    name: "[Ayrshare] Webhook 完成后汇总 article 外发状态",
    concurrency: { limit: 20 },
    retries: 2,
  },
  { event: "external/publication.completed" },
  async ({ event, step, logger }) => {
    const { articleId, ayrsharePostId, status } = event.data;

    if (!articleId) {
      logger.warn(
        `ayrshareWebhookHandler: 缺少 articleId（ayrsharePostId=${ayrsharePostId}）`,
      );
      return { skipped: true };
    }

    const breakdown = await step.run("load-publications", async () => {
      const rows = await db
        .select({
          id: externalPublications.id,
          platform: externalPublications.platform,
          status: externalPublications.status,
        })
        .from(externalPublications)
        .where(eq(externalPublications.ayrsharePostId, ayrsharePostId));
      return rows;
    });

    logger.info(
      `ayrshareWebhookHandler: articleId=${articleId} status=${status} rows=${breakdown.length}`,
    );

    await step.run("rollup-article-status", async () => {
      await rollupArticleStatus(articleId);
    });

    return {
      articleId,
      ayrsharePostId,
      rowsAffected: breakdown.length,
      status,
    };
  },
);
