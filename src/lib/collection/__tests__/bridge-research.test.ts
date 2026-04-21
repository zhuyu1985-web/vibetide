import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  organizations,
  collectionSources,
  collectedItems,
} from "@/db/schema";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";
import { bridgeCollectedItemToResearch } from "../bridge-research";

describe("bridgeCollectedItemToResearch", () => {
  const orgId = randomUUID();
  let sourceId: string;
  let itemId: string;
  let url: string;

  beforeEach(async () => {
    const stamp = Date.now();
    await db
      .insert(organizations)
      .values({
        id: orgId,
        name: "bridge-test-org",
        slug: `bridge-${stamp}`,
      })
      .onConflictDoNothing();

    const [src] = await db
      .insert(collectionSources)
      .values({
        organizationId: orgId,
        name: `test-hot-topic-${stamp}`,
        sourceType: "tophub",
        config: { platforms: ["weibo"] },
        targetModules: ["hot_topics"],
        researchBridgeEnabled: true,
      })
      .returning();
    sourceId = src.id;

    url = `https://weibo.com/test-${randomUUID()}`;
    const [item] = await db
      .insert(collectedItems)
      .values({
        organizationId: orgId,
        contentFingerprint: `fp-${randomUUID()}`,
        canonicalUrl: url,
        title: "测试热榜条目 — 重庆市生态环境综合治理成效显著",
        firstSeenSourceId: sourceId,
        firstSeenChannel: "tophub",
        firstSeenAt: new Date(),
        sourceChannels: [
          {
            channel: "tophub/weibo",
            url,
            sourceId,
            runId: "r1",
            capturedAt: new Date().toISOString(),
          },
        ],
      })
      .returning();
    itemId = item.id;
  });

  afterEach(async () => {
    await db.delete(newsArticles).where(eq(newsArticles.url, url));
    await db.delete(collectedItems).where(eq(collectedItems.id, itemId));
    await db.delete(collectionSources).where(eq(collectionSources.id, sourceId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("inserts research_news_article when source flag is true", async () => {
    const result = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(true);
    expect(result.articleId).toBeTruthy();

    const [article] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, result.articleId!));
    expect(article.sourceChannel).toBe("hot_topic_crawler");
    expect(article.outletTierSnapshot).toBe("self_media");
    expect(article.contentFetchStatus).toBe("pending");
    expect(article.content).toBeNull();
    expect(article.title).toContain("测试热榜条目");
    const meta = article.rawMetadata as { collectedItemId?: string; platforms?: string[] };
    expect(meta?.collectedItemId).toBe(itemId);
    expect(meta?.platforms).toContain("weibo");
  });

  it("skips when source flag is false", async () => {
    await db
      .update(collectionSources)
      .set({ researchBridgeEnabled: false })
      .where(eq(collectionSources.id, sourceId));
    const result = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("flag-disabled");
    expect(result.inserted).toBe(false);
  });

  it("is idempotent on same url_hash (second call returns existing id)", async () => {
    const first = await bridgeCollectedItemToResearch(itemId, orgId);
    const second = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.articleId).toBe(first.articleId);
  });

  it("skips when item has no canonical url", async () => {
    await db
      .update(collectedItems)
      .set({ canonicalUrl: null })
      .where(eq(collectedItems.id, itemId));
    const result = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no-url");
  });
});
