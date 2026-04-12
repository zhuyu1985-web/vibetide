"use server";

import { db } from "@/db";
import {
  hotTopics,
  topicAngles,
  commentInsights,
  hotTopicCrawlLogs,
  userProfiles,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  parseChineseNumber,
  TOPHUB_DEFAULT_NODES,
  type TrendingItem,
} from "@/lib/trending-api";


async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createHotTopic(data: {
  organizationId: string;
  title: string;
  priority?: "P0" | "P1" | "P2";
  heatScore?: number;
  trend?: "rising" | "surging" | "plateau" | "declining";
  source?: string;
  category?: string;
  summary?: string;
  heatCurve?: { time: string; value: number }[];
  platforms?: string[];
}) {
  await requireAuth();

  const [topic] = await db
    .insert(hotTopics)
    .values(data)
    .returning();

  revalidatePath("/inspiration");
  return topic;
}

export async function updateTopicPriority(
  id: string,
  priority: "P0" | "P1" | "P2"
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ priority, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
}

export async function startTopicTracking(id: string) {
  await requireAuth();

  // Update the topic to P0 to signal tracking
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
  revalidatePath("/missions");
}

/**
 * Start a mission from a hot topic — creates a multi-agent task
 * that generates multi-angle articles for the topic.
 */
export async function startTopicMission(
  topicId: string,
  selectedAngle?: { angle: string; outline?: string[] }
) {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    throw new Error("No organization found");
  }

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
    with: { angles: true },
  });
  if (!topic) {
    throw new Error("Topic not found");
  }

  // Build user instruction with topic context
  const angleHints = topic.angles?.length
    ? `\n\n可参考的切入角度：\n${topic.angles.map((a: { angleText: string }) => `- ${a.angleText}`).join("\n")}`
    : "";

  const platformInfo = (topic.platforms as string[])?.length
    ? `来源平台：${(topic.platforms as string[]).join("、")}。`
    : "";

  const angleContext = selectedAngle
    ? `\n\n选定创作角度：${selectedAngle.angle}\n大纲要点：\n${(selectedAngle.outline || []).map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const { startMissionFromModule } = await import("@/app/actions/missions");
  const result = await startMissionFromModule({
    organizationId: profile.organizationId,
    title: `热点追踪：${topic.title}`,
    scenario: "breaking_news",
    userInstruction: `请围绕热点话题「${topic.title}」，生成多视角的内容稿件。

话题摘要：${topic.summary || "暂无"}
当前热度：${topic.heatScore}/100，趋势：${topic.trend}
分类：${topic.category || "未分类"}
${platformInfo}${angleHints}${angleContext}

任务要求：
1. 搜集该话题的最新信息和多方观点
2. 从不同角度拆解话题，规划 2-3 篇不同视角的稿件
3. 撰写稿件初稿（图文形式）
4. 对稿件进行质量审核
5. 准备好发布所需的标题、摘要、标签`,
    sourceModule: "hot_topics",
    sourceEntityId: topicId,
    sourceEntityType: "hot_topic",
    sourceContext: {
      heatScore: topic.heatScore,
      trend: topic.trend,
      source: topic.source,
      category: topic.category,
      platforms: topic.platforms,
      ...(selectedAngle && {
        selectedAngle: selectedAngle.angle,
        selectedOutline: selectedAngle.outline,
      }),
    },
  });

  // Mark topic as P0 (being tracked)
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, topicId));

  revalidatePath("/inspiration");
  revalidatePath("/missions");

  return result;
}

export async function addTopicAngle(data: {
  hotTopicId: string;
  angleText: string;
  generatedBy?: string;
}) {
  await requireAuth();

  await db.insert(topicAngles).values(data);

  revalidatePath("/inspiration");
}

export async function updateCommentInsight(data: {
  hotTopicId: string;
  positive: number;
  neutral: number;
  negative: number;
  hotComments?: string[];
}) {
  await requireAuth();

  // Upsert: check if insight exists for this topic
  const existing = await db.query.commentInsights.findFirst({
    where: eq(commentInsights.hotTopicId, data.hotTopicId),
  });

  if (existing) {
    await db
      .update(commentInsights)
      .set({
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        hotComments: data.hotComments || [],
        analyzedAt: new Date(),
      })
      .where(eq(commentInsights.id, existing.id));
  } else {
    await db.insert(commentInsights).values({
      hotTopicId: data.hotTopicId,
      positive: data.positive,
      neutral: data.neutral,
      negative: data.negative,
      hotComments: data.hotComments || [],
    });
  }

  revalidatePath("/inspiration");
}

/**
 * Crawl a single platform via the TopHub API.
 * Returns the platform name + items (or error message).
 * Not a server action per se, but exported for use by API routes.
 */
export async function crawlSinglePlatform(
  platformName: string
): Promise<{ name: string; items: TrendingItem[]; error?: string }> {
  try {
    const items = await fetchTrendingFromApi("platforms", {
      platforms: [platformName],
      limit: 30,
    });
    return { name: platformName, items };
  } catch (err) {
    return {
      name: platformName,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Shared dedup + persist helper used by both triggerHotTopicCrawl
 * and the SSE crawl route. Accepts all collected items across platforms
 * and upserts into the hotTopics table.
 */
export async function persistCrawledTopics(
  organizationId: string,
  allItems: TrendingItem[],
  crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[]
): Promise<{ newTopics: number; updatedTopics: number }> {
  // Write all crawl logs in one batch
  if (crawlLogValues.length > 0) {
    await db.insert(hotTopicCrawlLogs).values(crawlLogValues);
  }

  if (allItems.length === 0) {
    return { newTopics: 0, updatedTopics: 0 };
  }

  // Dedup and persist (batch approach to avoid N+1 queries)
  const crossPlatform = buildCrossPlatformTopics(allItems);

  const topicAgg = new Map<string, {
    title: string;
    titleHash: string;
    platforms: Set<string>;
    maxHeat: number;
    url: string;
    category?: string;
  }>();

  for (const cp of crossPlatform) {
    const key = normalizeTitleKey(cp.title);
    const titleHash = crypto.createHash("md5").update(key).digest("hex");
    topicAgg.set(key, {
      title: cp.title,
      titleHash,
      platforms: new Set(cp.platforms),
      maxHeat: cp.totalHeat,
      url: "",
      category: undefined,
    });
  }

  for (const item of allItems) {
    const key = normalizeTitleKey(item.title);
    const numericHeat = parseChineseNumber(item.heat);
    if (!topicAgg.has(key)) {
      const titleHash = crypto.createHash("md5").update(key).digest("hex");
      topicAgg.set(key, {
        title: item.title,
        titleHash,
        platforms: new Set([item.platform]),
        maxHeat: numericHeat,
        url: item.url,
        category: item.category,
      });
    } else {
      const existing = topicAgg.get(key)!;
      existing.platforms.add(item.platform);
      if (numericHeat > existing.maxHeat) existing.maxHeat = numericHeat;
      if (item.url && !existing.url) existing.url = item.url;
    }
  }

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  let newCount = 0;
  let updatedCount = 0;

  for (const [, agg] of topicAgg) {
    const platformCount = agg.platforms.size;
    const heatScore = normalizeHeatScore(agg.maxHeat, platformCount);
    const platformsArray = Array.from(agg.platforms);

    const priority = platformCount >= 3 || heatScore > 85
      ? "P0"
      : platformCount >= 2 || heatScore >= 50
        ? "P1"
        : "P2";

    const result = await db
      .insert(hotTopics)
      .values({
        organizationId,
        title: agg.title,
        titleHash: agg.titleHash,
        sourceUrl: agg.url || null,
        priority,
        heatScore,
        trend: "rising",
        source: platformsArray[0] || "",
        category: agg.category || null,
        platforms: platformsArray,
        heatCurve: [{ time: timeLabel, value: heatScore }],
        discoveredAt: now,
      })
      .onConflictDoUpdate({
        target: [hotTopics.organizationId, hotTopics.titleHash],
        set: {
          heatScore,
          platforms: platformsArray,
          discoveredAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: hotTopics.id, updatedAt: hotTopics.updatedAt });

    if (result[0]?.updatedAt) {
      updatedCount++;
    } else {
      newCount++;
    }
  }

  return { newTopics: newCount, updatedTopics: updatedCount };
}

/**
 * Direct crawl: fetches all 10 platforms via TopHub API,
 * deduplicates, and persists to hotTopics table.
 * Called directly from the UI "刷新热点" button (no Inngest dependency).
 */
export async function triggerHotTopicCrawl() {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile?.organizationId) {
    throw new Error("No organization found");
  }

  const organizationId = profile.organizationId;

  // Step 1: Crawl all platforms
  const platformEntries = Object.entries(TOPHUB_DEFAULT_NODES);
  const allItems: TrendingItem[] = [];

  const results = await Promise.allSettled(
    platformEntries.map(async ([name]) => {
      const items = await fetchTrendingFromApi("platforms", {
        platforms: [name],
        limit: 30,
      });
      return { name, items };
    })
  );

  const crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const [name, nodeId] = platformEntries[i];

    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "success", topicsFound: result.value.items.length });
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "error", topicsFound: 0, errorMessage: errMsg });
    }
  }

  // Step 2: Dedup and persist using shared helper
  const { newTopics, updatedTopics } = await persistCrawledTopics(organizationId, allItems, crawlLogValues);

  revalidatePath("/inspiration");
  return { success: true, newTopics, updatedTopics };
}

export async function refreshInspirationData() {
  revalidatePath("/inspiration");
}

const AUTO_TRIGGER_HEAT_THRESHOLD = 80;

/**
 * F4.A.02: Update a topic's heat score and auto-trigger workflow if threshold reached.
 */
export async function updateTopicHeatScore(
  id: string,
  heatScore: number,
  organizationId: string
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ heatScore, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  // Auto-trigger mission when heat score reaches P0 threshold (≥80)
  if (heatScore >= 80) {
    const topic = await db.query.hotTopics.findFirst({ where: eq(hotTopics.id, id) });
    if (topic) {
      const { startMissionFromModule } = await import("@/app/actions/missions");
      await startMissionFromModule({
        organizationId,
        title: `热点追踪：${topic.title}`,
        scenario: "breaking_news",
        userInstruction: `紧急追踪热点话题「${topic.title}」，当前热度 ${heatScore}。完成信息搜集、要点分析和快讯撰写。`,
        sourceModule: "hot_topics",
        sourceEntityId: id,
        sourceEntityType: "hot_topic",
        sourceContext: { heatScore, source: topic.source },
      }).catch((err) => console.error("[hot-topics] auto-trigger failed:", err));
    }
  }

  revalidatePath("/inspiration");
  revalidatePath("/missions");
}
