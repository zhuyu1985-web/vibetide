import { db } from "@/db";
import { collectedItems, collectionSources } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ingestArticle } from "@/lib/research/article-ingest";

type SourceChannelEntry = {
  channel: string;
  url?: string;
  sourceId: string;
  runId: string;
  capturedAt: string;
};

export interface BridgeResearchResult {
  skipped: boolean;
  reason?: string;
  inserted: boolean;
  articleId: string | null;
}

function extractPlatforms(sourceChannels: SourceChannelEntry[] | null): string[] {
  if (!sourceChannels) return [];
  return Array.from(
    new Set(
      sourceChannels
        .map((c) => (c.channel.startsWith("tophub/") ? c.channel.slice(7) : c.channel))
        .filter((p): p is string => Boolean(p)),
    ),
  );
}

/**
 * 把 collected_items 一行桥接到 research_news_articles。
 * - 必须源上 research_bridge_enabled === true
 * - 复用 ingestArticle() 的 url_hash upsert（幂等）
 * - tier 优先 matchOutletForUrl 结果；匹配不上回落 self_media（ingestArticle 内处理）
 * - 这里先以 outlet 匹配不上时让 ingestArticle 设 tier=null，然后本函数补 self_media
 * - content 留 null，content_fetch_status='pending'，后续 Jina 异步补
 *
 * 不 throw；skip / duplicate 都返回结构化结果。
 */
export async function bridgeCollectedItemToResearch(
  itemId: string,
  organizationId: string,
): Promise<BridgeResearchResult> {
  const [item] = await db
    .select()
    .from(collectedItems)
    .where(eq(collectedItems.id, itemId))
    .limit(1);
  if (!item) {
    return { skipped: true, reason: "item-not-found", inserted: false, articleId: null };
  }
  if (!item.firstSeenSourceId) {
    return { skipped: true, reason: "no-source", inserted: false, articleId: null };
  }
  if (!item.canonicalUrl) {
    return { skipped: true, reason: "no-url", inserted: false, articleId: null };
  }

  const [source] = await db
    .select({ researchBridgeEnabled: collectionSources.researchBridgeEnabled })
    .from(collectionSources)
    .where(eq(collectionSources.id, item.firstSeenSourceId))
    .limit(1);
  if (!source?.researchBridgeEnabled) {
    return { skipped: true, reason: "flag-disabled", inserted: false, articleId: null };
  }

  const platforms = extractPlatforms(item.sourceChannels as SourceChannelEntry[] | null);

  const result = await ingestArticle({
    url: item.canonicalUrl,
    title: item.title,
    content: null,
    publishedAt: item.publishedAt ?? item.firstSeenAt,
    sourceChannel: "hot_topic_crawler",
    organizationId,
    rawMetadata: {
      collectedItemId: item.id,
      sourceChannels: item.sourceChannels,
      platforms,
      bridgeVersion: "v1",
    },
  });

  // 兜底：outlet 未命中时 ingestArticle 把 tier 写成 null；这里补成 self_media
  // 让工作台"媒体层级"筛选器可用。已命中真实 outlet 的行不动。
  if (result.inserted) {
    await db.execute(sql`
      UPDATE research_news_articles
      SET outlet_tier_snapshot = 'self_media'
      WHERE id = ${result.id} AND outlet_tier_snapshot IS NULL
    `);
  }

  return {
    skipped: false,
    inserted: result.inserted,
    articleId: result.id,
  };
}
