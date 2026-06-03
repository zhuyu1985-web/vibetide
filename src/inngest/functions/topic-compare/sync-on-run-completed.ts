/**
 * topicCompareSyncFromCollection
 *
 * 监听 `collection/run.completed`，把本次 run 采集到的 collected_items
 * 同步到 my_posts / benchmark_posts。
 *
 * 绑定解析策略（DONE_WITH_CONCERNS 注释见末尾）：
 *   1. 通过 sourceId 拿到 collection_source
 *   2. defaultTags[] 内有 "account-analytics:my" → 我方账号分支
 *      defaultTags[] 内有 "account-analytics:benchmark" → 对标账号分支
 *   3. source.outletId → 查 my_accounts / benchmark_accounts 找到具体账号
 *   4. 构造 SyncSourceBinding，调用 syncCollectedItems 纯函数
 *
 * 采集项查询策略：
 *   collected_items 无直接 run_id FK 列；items 通过 firstSeenSourceId 关联。
 *   账号分析场景下每个账号有一条专属 source，所以用 firstSeenSourceId=sourceId 查
 *   近期（run 开始时间前后 5 分钟窗口）写入的 items。精确度足够，且不需要 jsonb 全表扫。
 */

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectionSources, myAccounts, benchmarkAccounts } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { syncCollectedItems, type SyncSourceBinding } from "@/lib/topic-compare/sync-collected";

export const topicCompareSyncFromCollection = inngest.createFunction(
  {
    id: "topic-compare/sync-on-run-completed",
    name: "Topic Compare · 从 Collection Run 同步到 my/benchmark posts",
    concurrency: 8,
    retries: 2,
  },
  { event: "collection/run.completed" },
  async ({ event, step, logger }) => {
    const { runId, sourceId, organizationId, status } = event.data;

    // 仅处理成功或部分成功的 run；完全失败的 run 没有可用 items
    if (status === "failed") {
      logger.info("[sync-on-run-completed] skipped: run failed", { runId });
      return { skipped: true, reason: "run-failed" };
    }

    if (!organizationId) {
      logger.info("[sync-on-run-completed] skipped: no organizationId", { runId, sourceId });
      return { skipped: true, reason: "no-org" };
    }

    // Step 1: 解析 source binding
    const binding = await step.run("resolve-binding", async () => {
      const src = await db.query.collectionSources.findFirst({
        where: and(
          eq(collectionSources.id, sourceId),
          eq(collectionSources.organizationId, organizationId),
        ),
        columns: {
          id: true,
          defaultTags: true,
          outletId: true,
        },
      });

      if (!src) {
        logger.warn("[sync-on-run-completed] source not found", { sourceId });
        return null;
      }

      const tags = src.defaultTags ?? [];
      const isMyAccount = tags.includes("account-analytics:my");
      const isBenchmark = tags.includes("account-analytics:benchmark");

      if (!isMyAccount && !isBenchmark) {
        // 非账号分析 source（如热榜采集），不处理
        logger.info("[sync-on-run-completed] not an account-analytics source, skip", {
          sourceId,
          tags,
        });
        return null;
      }

      if (!src.outletId) {
        logger.warn("[sync-on-run-completed] source missing outletId", { sourceId });
        return null;
      }

      if (isMyAccount) {
        const acc = await db.query.myAccounts.findFirst({
          where: and(
            eq(myAccounts.outletId, src.outletId),
            eq(myAccounts.organizationId, organizationId),
          ),
          columns: { id: true, platform: true },
        });
        if (!acc) {
          logger.warn("[sync-on-run-completed] no my_account for outletId", {
            outletId: src.outletId,
          });
          return null;
        }
        return {
          kind: "my" as const,
          platform: acc.platform,
          myAccountId: acc.id,
        } satisfies SyncSourceBinding;
      }

      // benchmark 分支
      const acc = await db.query.benchmarkAccounts.findFirst({
        where: and(
          eq(benchmarkAccounts.outletId, src.outletId),
          eq(benchmarkAccounts.organizationId, organizationId),
        ),
        columns: { id: true, platform: true },
      });
      if (!acc) {
        logger.warn("[sync-on-run-completed] no benchmark_account for outletId", {
          outletId: src.outletId,
        });
        return null;
      }
      return {
        kind: "benchmark" as const,
        platform: acc.platform,
        benchmarkAccountId: acc.id,
      } satisfies SyncSourceBinding;
    });

    if (!binding) {
      return { skipped: true, reason: "no-binding" };
    }

    // Step 2: 加载本次 run 写入的 items
    // collected_items 无直接 run_id FK；用 firstSeenSourceId + 近 2 小时窗口过滤
    // 足够覆盖 run 耗时（TikHub 单次 run ≤ 30 分钟）
    const items = await step.run("load-items", async () => {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 小时
      return db
        .select({
          id: collectedItems.id,
          externalId: collectedItems.externalId,
          title: collectedItems.title,
          summary: collectedItems.summary,
          canonicalUrl: collectedItems.canonicalUrl,
          publishedAt: collectedItems.publishedAt,
          viewCount: collectedItems.viewCount,
          likeCount: collectedItems.likeCount,
          shareCount: collectedItems.shareCount,
          commentCount: collectedItems.commentCount,
          contentFingerprint: collectedItems.contentFingerprint,
          rawMetadata: collectedItems.rawMetadata,
          firstSeenAt: collectedItems.firstSeenAt,
        })
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.firstSeenSourceId, sourceId),
            eq(collectedItems.organizationId, organizationId),
            gte(collectedItems.firstSeenAt, since),
          ),
        );
    });

    logger.info(`[sync-on-run-completed] loaded ${items.length} items`, {
      runId,
      sourceId,
      bindingKind: binding.kind,
    });

    if (items.length === 0) {
      return { skipped: false, processed: 0, message: "no-items-in-window" };
    }

    // Step 3: 调用纯函数 syncCollectedItems
    const result = await step.run("sync", async () => {
      return syncCollectedItems({
        organizationId,
        binding,
        items: items.map((i) => ({
          externalId: i.externalId ?? `ci-${i.id}`,
          title: i.title,
          summary: i.summary ?? null,
          body: null, // collected_items 正文在副表 collected_item_contents，此场景不需要
          sourceUrl: i.canonicalUrl ?? null,
          publishedAt: i.publishedAt
            ? typeof i.publishedAt === "string"
              ? new Date(i.publishedAt)
              : i.publishedAt
            : null,
          views: i.viewCount ?? 0,
          likes: i.likeCount ?? 0,
          shares: i.shareCount ?? 0,
          comments: i.commentCount ?? 0,
          contentFingerprint: i.contentFingerprint ?? null,
          rawMetadata: i.rawMetadata ?? null,
        })),
      });
    });

    logger.info("[sync-on-run-completed] sync result", { runId, ...result });

    // Step 4: 对每个新入库的 my_post 派 topic-compare/my-post.created
    if (result.newMyPostIds.length > 0) {
      await step.sendEvent(
        "emit-my-post-created",
        result.newMyPostIds.map((id) => ({
          name: "topic-compare/my-post.created" as const,
          data: {
            organizationId,
            myPostId: id,
            contentFingerprint: "", // 简化：DAL 只需 myPostId 即可查到原 fingerprint
            source: "sync" as const,
          },
        })),
      );
    }

    return {
      runId,
      sourceId,
      bindingKind: binding.kind,
      ...result,
    };
  },
);

/*
 * DONE_WITH_CONCERNS:
 *
 * 1. 绑定解析通过 source.outletId → my_accounts/benchmark_accounts 反查。
 *    假设同一 outletId 在同一 org 下只绑一个账号（account-analytics 架构保证了 unique
 *    source name，但 outletId 唯一性并无 DB 约束）。如果同一 outlet 绑了多个账号，
 *    findFirst 只会取到第一个，可能导致遗漏。Task 5.2 手工联调时注意验证。
 *
 * 2. items 查询用 firstSeenSourceId + 2 小时时间窗。如果 run 执行时间超过 2 小时
 *    或服务器时钟有明显偏差，会遗漏部分 items。当前 TikHub 单次 run ≤ 30 分钟，
 *    窗口 2 小时留有 4 倍余量，实际风险极低。
 *
 * 3. collected_items 无 run_id 直接 FK，更精确的做法是通过 sourceChannels jsonb
 *    检索（WHERE sourceChannels @> '[{"runId":"<runId>"}]'），但需要 GIN 索引且
 *    当前 schema 没有建该索引。时间窗方案是合理的近似实现，满足当前需求。
 */
