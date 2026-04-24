import crypto from "node:crypto";
import { db } from "@/db";
import { collectedItems, hotTopics } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  normalizeHeatScore,
  classifyByKeywords,
  normalizeTitleKey,
} from "@/lib/trending-api";

interface SourceChannelEntry {
  channel: string;
  url?: string;
  sourceId: string;
  runId: string;
  capturedAt: string;
}

export interface BridgeHotTopicResult {
  hotTopicId: string;
  shouldEnrich: boolean;
  priority: "P0" | "P1" | "P2";
  heatScore: number;
}

/**
 * 与 src/inngest/functions/collection/hot-topic-bridge.ts 共用的核心桥接逻辑：
 * 把 collected_items 一行映射到 hot_topics（用 LEGACY titleHash 与旧 crawler 兼容）。
 *
 * 抽出原因：inspiration 模块"刷新数据"需要在 HTTP 请求里同步执行，无法等待
 * Inngest 链路。该函数不依赖 step.run / inngest.send，纯 DB 操作。
 *
 * Inngest handler 与 sync caller（/api/inspiration/crawl）共用此函数确保桥接
 * 行为一致。enrichment 事件的派发由 caller 决定（inngest handler 走 step.run，
 * sync caller 直接 inngest.send 即可）。
 */
export async function bridgeCollectedItemToHotTopic(
  itemId: string,
  organizationId: string,
): Promise<BridgeHotTopicResult> {
  const [item] = await db
    .select()
    .from(collectedItems)
    .where(eq(collectedItems.id, itemId))
    .limit(1);
  if (!item) throw new Error(`collected_item ${itemId} not found`);

  const channels = (item.sourceChannels as SourceChannelEntry[]) ?? [];
  const platforms = Array.from(
    new Set(
      channels
        .map((c) => (c.channel.startsWith("tophub/") ? c.channel.slice(7) : null))
        .filter((p): p is string => Boolean(p)),
    ),
  );

  const rawHeat = (item.rawMetadata as { heat?: number | string } | null)?.heat;
  const heatScore =
    rawHeat !== undefined && rawHeat !== null ? normalizeHeatScore(rawHeat) : 50;

  const priority: "P0" | "P1" | "P2" =
    platforms.length >= 3
      ? "P0"
      : platforms.length >= 2
        ? "P1"
        : heatScore >= 75
          ? "P1"
          : "P2";

  const category = classifyByKeywords(item.title);

  // LEGACY titleHash（与旧 crawler 兼容，避免重复行）
  const legacyTitleHash = crypto
    .createHash("md5")
    .update(normalizeTitleKey(item.title))
    .digest("hex");

  // 原子 upsert：select-then-insert/update 在并行场景下会撞 hot_topics_org_title_hash_uniq
  // 唯一约束（同一标题的 2 条 collected_item 同时桥接时），用 onConflictDoUpdate 让 PG
  // 单条语句完成插入或更新，并行批量 bridge 安全。
  const [upserted] = await db
    .insert(hotTopics)
    .values({
      organizationId,
      title: item.title,
      titleHash: legacyTitleHash,
      sourceUrl: item.canonicalUrl,
      priority,
      heatScore,
      trend: "plateau",
      source: platforms[0] ?? item.firstSeenChannel,
      category,
      platforms,
      heatCurve: [],
      discoveredAt: new Date(item.firstSeenAt),
      collectedItemId: itemId,
    })
    .onConflictDoUpdate({
      target: [hotTopics.organizationId, hotTopics.titleHash],
      set: {
        platforms,
        heatScore,
        priority,
        collectedItemId: itemId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: hotTopics.id });

  const shouldEnrich = priority === "P0" || priority === "P1" || heatScore >= 30;

  return { hotTopicId: upserted.id, shouldEnrich, priority, heatScore };
}
