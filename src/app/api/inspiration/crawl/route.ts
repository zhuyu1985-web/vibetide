import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  collectionSources,
  collectionRuns,
  collectionLogs,
  hotTopicCrawlLogs,
  userProfiles,
} from "@/db/schema";
import { and, eq, isNull, sql, desc, gt } from "drizzle-orm";
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
 * 写 legacy per-platform crawl log。
 * getPlatformMonitors 只读 hot_topic_crawl_logs（右侧"编辑简报"的 generatedAt /
 * activePlatforms / aiSummary 全靠它）。新 collection_runs 是 run 级、没有
 * 按 tophub 平台聚合，所以这里主动补写一组 per-platform 行。
 *
 * - 成功路径：按 adapter 结果聚合每个平台的 count
 * - 失败路径（items=null）：全部标 status=error，fallbackError 作为 errorMessage
 * 无论哪条路径都会落盘，保证用户点"刷新数据"后 briefing 的时间戳会更新。
 */
async function writeLegacyCrawlLogs(
  orgId: string,
  items: { channel?: string }[] | null,
  fallbackError?: string,
): Promise<void> {
  try {
    const perPlatformCounts = new Map<string, number>();
    for (const item of items ?? []) {
      const ch = item.channel ?? "";
      if (!ch.startsWith("tophub/")) continue;
      const name = ch.slice("tophub/".length);
      perPlatformCounts.set(name, (perPlatformCounts.get(name) ?? 0) + 1);
    }
    const crawledAt = new Date();
    const logRows: (typeof hotTopicCrawlLogs.$inferInsert)[] = [];
    for (const [platformName, nodeId] of Object.entries(TOPHUB_DEFAULT_NODES)) {
      const count = perPlatformCounts.get(platformName) ?? 0;
      logRows.push({
        organizationId: orgId,
        platformName,
        platformNodeId: nodeId,
        status: count > 0 ? "success" : "error",
        topicsFound: count,
        errorMessage:
          count > 0
            ? null
            : fallbackError ?? "抓取返回 0 条或平台失败",
        crawledAt,
      });
    }
    if (logRows.length > 0) {
      await db.insert(hotTopicCrawlLogs).values(logRows);
    }
  } catch (logErr) {
    console.warn("[inspiration-crawl] legacy crawl log write failed:", logErr);
  }
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

  // 进行中互斥锁：同一 source 同时只允许一个 manual run。
  // 避免重复点击 / 多 tab / 浏览器刷新触发并行采集（浪费 tophub API 配额、堆 collection_runs 日志）。
  // 数据层 dedup 已经够（writeItems 用 url/fingerprint，bridge 用 onConflictDoUpdate），但
  // 并行 run 仍会 sourceChannels 里多塞一条无意义的 entry，且整体 IO 浪费。
  // STALE_RUN_THRESHOLD_MS：超过 10 分钟还停在 running 的视为 stuck（dev server crash 留下的孤儿），
  // 不阻塞新 run。
  const STALE_RUN_THRESHOLD_MS = 10 * 60 * 1000;
  const staleCutoff = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);
  const [activeRun] = await db
    .select({ id: collectionRuns.id, startedAt: collectionRuns.startedAt })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.sourceId, source.id),
        eq(collectionRuns.status, "running"),
        gt(collectionRuns.startedAt, staleCutoff),
      ),
    )
    .orderBy(desc(collectionRuns.startedAt))
    .limit(1);

  if (activeRun) {
    const elapsedSec = Math.floor(
      (Date.now() - activeRun.startedAt.getTime()) / 1000,
    );
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "complete",
              alreadyRunning: true,
              newTopics: 0,
              updatedTopics: 0,
              total: 0,
              message: `已有抓取正在进行中（${elapsedSec}s），请稍候`,
            }),
          ),
        );
        controller.close();
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
          current: Math.floor(total * 0.4),
          total,
          platform: `已采集 ${adapterResult.items.length} 条原材料，开始去重写入...`,
        });

        await writeLegacyCrawlLogs(orgId, adapterResult.items);

        // 4. 写入 collected_items（writeItems 内部对每条做 dedup/insert，单次
        //    调用最多 30-50s）。期间用心跳 setInterval 持续 emit 进度，避免
        //    SSE 长连接出现 60s+ 空窗让前端误判为卡死。
        let writeHeartbeatTick = 0;
        const writeHeartbeat = setInterval(() => {
          writeHeartbeatTick++;
          enqueue({
            type: "progress",
            current: Math.floor(total * 0.5),
            total,
            platform: `去重写入中 (${adapterResult.items.length} 条原材料处理中, ${writeHeartbeatTick * 3}s)`,
          });
        }, 3000);
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
        }).finally(() => clearInterval(writeHeartbeat));

        const totalToBridge = writeResult.insertedItemIds.length;
        enqueue({
          type: "progress",
          current: Math.floor(total * 0.6),
          total,
          platform: `已写入 ${writeResult.inserted} 新 / ${writeResult.merged} 合并，开始生成热点...`,
        });

        // 5. 同步桥接每条新增 collected_item 到 hot_topics（分批并行）
        //    bridge 内部已用 onConflictDoUpdate 原子 upsert，并行安全。
        //    每批 BRIDGE_BATCH_SIZE 条 Promise.allSettled 并发，单批失败不影响其他。
        //    每批结束后 emit progress，让前端实时看到桥接进度。
        const BRIDGE_BATCH_SIZE = 20;
        let bridgedCount = 0;
        const enrichTopicIds: string[] = [];
        if (source.targetModules.includes("hot_topics") && totalToBridge > 0) {
          for (let i = 0; i < totalToBridge; i += BRIDGE_BATCH_SIZE) {
            const batch = writeResult.insertedItemIds.slice(
              i,
              i + BRIDGE_BATCH_SIZE,
            );
            const results = await Promise.allSettled(
              batch.map((itemId) =>
                bridgeCollectedItemToHotTopic(itemId, orgId),
              ),
            );
            for (let j = 0; j < results.length; j++) {
              const r = results[j];
              if (r.status === "fulfilled") {
                bridgedCount++;
                if (r.value.shouldEnrich) enrichTopicIds.push(r.value.hotTopicId);
              } else {
                console.error("[inspiration-crawl] bridge failed", {
                  itemId: batch[j],
                  err:
                    r.reason instanceof Error
                      ? r.reason.message
                      : String(r.reason),
                });
              }
            }
            // current 在 0.6→0.95 之间线性映射 bridge 进度
            const ratio = bridgedCount / totalToBridge;
            enqueue({
              type: "progress",
              current: Math.floor(total * (0.6 + 0.35 * ratio)),
              total,
              platform: `生成热点中 ${bridgedCount}/${totalToBridge}`,
            });
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

        // 失败路径也写一组 error 日志，保证 briefing 时间戳会随每次刷新动起来。
        // 否则 adapter 在 safeParse 或 execute 抛异常时，hot_topic_crawl_logs
        // 会一直停在历史时刻，editorial briefing 就会一直显示"最后扫描：X天前"。
        await writeLegacyCrawlLogs(orgId, null, message);

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
