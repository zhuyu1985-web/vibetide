import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  collectionSources,
  collectionRuns,
  collectionLogs,
  userProfiles,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { TOPHUB_DEFAULT_NODES, PLATFORM_ALIASES } from "@/lib/trending-api";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import { bridgeCollectedItemToHotTopic } from "@/lib/collection/bridge-hot-topic";
import "@/lib/collection/adapters"; // ensure adapters are registered

export const dynamic = "force-dynamic";

const DEFAULT_INSPIRATION_SOURCE_NAME = "__inspiration_default__";

function buildDefaultPlatforms(): string[] {
  return Object.keys(TOPHUB_DEFAULT_NODES).map((chineseName) => {
    const aliases = PLATFORM_ALIASES[chineseName];
    return aliases?.[0] ?? chineseName.toLowerCase();
  });
}
const DEFAULT_PLATFORMS = buildDefaultPlatforms();

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * 灵感池"刷新数据"——同步执行采集 + 桥接到 hot_topics。
 *
 * 历史实现派发 Inngest 事件后轮询 collection_runs，依赖 Inngest dev server
 * 在跑（本地 dev 没启 inngest-cli 或 .env 配了 prod EVENT_KEY 都会让事件丢失），
 * 用户体验是"抓取中"持续 60s 后超时、看不到数据。
 *
 * 现在：route 自己 inline 等价 runCollectionSource handler 的步骤，
 * 写入 collected_items 后立即同步桥接到 hot_topics（共用 bridge-hot-topic 核心
 * 逻辑），最后 SSE 一次性返回 complete。Cron 路径仍走 Inngest（带重试 + 异步）。
 *
 * Enrichment 事件 (`hot-topics/enrich-requested`) 仍 fire-and-forget 派发——
 * 没 Inngest 时只是 enrich 不跑，hot_topics 行已经存在，UI 能看到新数据。
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return new Response("No organization found", { status: 400 });
  }

  const orgId = profile.organizationId;

  // 找/建默认 inspiration tophub source
  const [existing] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, DEFAULT_INSPIRATION_SOURCE_NAME),
        isNull(collectionSources.deletedAt),
      ),
    )
    .limit(1);

  let source: typeof collectionSources.$inferSelect;
  if (existing) {
    source = existing;
  } else {
    const [created] = await db
      .insert(collectionSources)
      .values({
        organizationId: orgId,
        name: DEFAULT_INSPIRATION_SOURCE_NAME,
        sourceType: "tophub",
        config: { platforms: DEFAULT_PLATFORMS },
        targetModules: ["hot_topics"],
        defaultCategory: null,
        defaultTags: ["灵感池"],
        enabled: true,
        createdBy: user.id,
      })
      .returning();
    source = created;
  }

  if (!source.enabled) {
    return new Response(
      JSON.stringify({ error: "采集源已禁用" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const total = DEFAULT_PLATFORMS.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const enqueue = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // controller 已关闭
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      enqueue({ type: "progress", current: 0, total, platform: "启动中" });

      // 1. 创建 run 行
      const [run] = await db
        .insert(collectionRuns)
        .values({
          sourceId: source.id,
          organizationId: orgId,
          trigger: "manual",
          startedAt: new Date(),
          status: "running",
        })
        .returning({ id: collectionRuns.id });
      const runId = run.id;

      try {
        // 2. 解析 adapter + 校验 config
        const adapter = getAdapter(source.sourceType);
        const parsed = adapter.configSchema.safeParse(source.config);
        if (!parsed.success) {
          throw new Error(`config validation failed: ${parsed.error.message}`);
        }

        enqueue({ type: "progress", current: 1, total, platform: "采集中" });

        // 3. 执行 adapter
        const adapterResult = await adapter.execute({
          config: parsed.data,
          sourceId: source.id,
          organizationId: orgId,
          runId,
          log: (level, message, meta) => {
            db.insert(collectionLogs)
              .values({
                runId,
                sourceId: source.id,
                level,
                message,
                metadata: meta ?? null,
              })
              .then(() => {})
              .catch(() => {});
          },
        });

        enqueue({
          type: "progress",
          current: Math.floor(total * 0.6),
          total,
          platform: `采集到 ${adapterResult.items.length} 条`,
        });

        // 4. 写入 collected_items（writeItems 仍会 fire-and-forget Inngest fanout，
        //    无 Inngest 时事件丢失无影响——下面一步同步桥接）
        const writeResult = await writeItems({
          runId,
          sourceId: source.id,
          organizationId: orgId,
          items: adapterResult.items,
          source: {
            targetModules: source.targetModules,
            defaultCategory: source.defaultCategory,
            defaultTags: source.defaultTags,
          },
        });

        enqueue({
          type: "progress",
          current: Math.floor(total * 0.8),
          total,
          platform: `桥接 ${writeResult.insertedItemIds.length} 条到 hot_topics`,
        });

        // 5. 同步桥接每条新增 collected_item 到 hot_topics
        let bridgedCount = 0;
        const enrichTopicIds: string[] = [];
        if (source.targetModules.includes("hot_topics")) {
          for (const itemId of writeResult.insertedItemIds) {
            try {
              const bridged = await bridgeCollectedItemToHotTopic(itemId, orgId);
              bridgedCount++;
              if (bridged.shouldEnrich) enrichTopicIds.push(bridged.hotTopicId);
            } catch (err) {
              console.error("[inspiration-crawl] bridge failed", {
                itemId,
                err: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        // 6. fire-and-forget enrichment（有 Inngest 就跑；没有就跳过，不影响列表展示）
        if (enrichTopicIds.length > 0) {
          inngest
            .send({
              name: "hot-topics/enrich-requested",
              data: { organizationId: orgId, topicIds: enrichTopicIds },
            })
            .catch((err) => {
              console.warn("[inspiration-crawl] enrich dispatch failed:", err);
            });
        }

        // 7. finalize run + source
        const partialFailures = adapterResult.partialFailures ?? [];
        const hasFailures = writeResult.failed > 0 || partialFailures.length > 0;
        const finalStatus = hasFailures ? "partial" : "success";
        const errorSummary =
          partialFailures.map((f) => f.message).join("; ") || null;

        await db
          .update(collectionRuns)
          .set({
            finishedAt: new Date(),
            status: finalStatus,
            errorSummary,
          })
          .where(eq(collectionRuns.id, runId));

        await db
          .update(collectionSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: finalStatus,
            totalItemsCollected: sql`${collectionSources.totalItemsCollected} + ${writeResult.inserted}`,
            totalRuns: sql`${collectionSources.totalRuns} + 1`,
          })
          .where(eq(collectionSources.id, source.id));

        enqueue({
          type: "complete",
          newTopics: bridgedCount,
          updatedTopics: writeResult.merged,
          total: writeResult.inserted + writeResult.merged,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[inspiration-crawl] failed:", err);

        await db
          .update(collectionRuns)
          .set({
            finishedAt: new Date(),
            status: "failed",
            errorSummary: message,
          })
          .where(eq(collectionRuns.id, runId))
          .catch(() => {});

        await db
          .update(collectionSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: "failed",
            totalRuns: sql`${collectionSources.totalRuns} + 1`,
          })
          .where(eq(collectionSources.id, source.id))
          .catch(() => {});

        enqueue({
          type: "complete",
          newTopics: 0,
          updatedTopics: 0,
          total: 0,
          error: message,
        });
      } finally {
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
