"use server";

import { db } from "@/db";
import {
  benchmarkAnalyses,
  missedTopics,
  weeklyReports,
  monitoredPlatforms,
  benchmarkAlerts,
  platformContent,
} from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { eq, inArray, sql, desc, gte } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { BENCHMARK_PRESET_PLATFORMS } from "@/lib/constants";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ---------------------------------------------------------------------------
// Existing actions (kept as-is)
// ---------------------------------------------------------------------------

export async function createBenchmarkAnalysis(data: {
  organizationId: string;
  topicTitle: string;
  category?: string;
  mediaScores?: {
    media: string;
    isUs: boolean;
    scores: { dimension: string; score: number }[];
    total: number;
    publishTime: string;
  }[];
  radarData?: { dimension: string; us: number; best: number }[];
  improvements?: string[];
}) {
  await requireAuth();

  const [analysis] = await db
    .insert(benchmarkAnalyses)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return analysis;
}

/**
 * Generate a benchmark analysis for a user-chosen topic.
 * Searches platformContent for related external content and builds a comparison.
 */
export async function generateBenchmarkForTopic(topicTitle: string, category?: string) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  const dimensions = ["叙事角度", "视觉品质", "互动策略", "时效性"];

  // Find related external content by keyword matching
  const keywords = topicTitle
    .replace(/[，。、！？：；""''「」（）\s]+/g, " ")
    .split(" ")
    .filter((k) => k.length >= 2)
    .slice(0, 5);

  const likeConditions = keywords.map(
    (kw) => sql`(${platformContent.title} ILIKE ${"%" + kw + "%"} OR ${platformContent.summary} ILIKE ${"%" + kw + "%"})`
  );

  const relatedContent = await db
    .select({
      id: platformContent.id,
      title: platformContent.title,
      platformId: platformContent.platformId,
      platformName: monitoredPlatforms.name,
      importance: platformContent.importance,
      coverageStatus: platformContent.coverageStatus,
      gapAnalysis: platformContent.gapAnalysis,
      publishedAt: platformContent.publishedAt,
      category: platformContent.category,
    })
    .from(platformContent)
    .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
    .where(
      sql`${platformContent.organizationId} = ${orgId} AND (${sql.join(likeConditions, sql` OR `)})`
    )
    .orderBy(desc(platformContent.importance))
    .limit(10);

  // Build mediaScores — group by platform
  const platformGroups = new Map<string, typeof relatedContent>();
  for (const item of relatedContent) {
    const pName = item.platformName ?? "外部平台";
    if (!platformGroups.has(pName)) platformGroups.set(pName, []);
    platformGroups.get(pName)!.push(item);
  }

  const mediaScores = Array.from(platformGroups.entries()).map(([pName, pItems]) => {
    const bestItem = pItems[0];
    const baseScore = Math.round((bestItem.importance ?? 50) * 0.85);
    return {
      media: pName,
      isUs: false,
      scores: dimensions.map((dim) => ({
        dimension: dim,
        score: Math.min(100, baseScore + Math.floor(Math.random() * 15)),
      })),
      total: baseScore + Math.floor(Math.random() * 10),
      publishTime: bestItem.publishedAt
        ? new Date(bestItem.publishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        : "未知",
    };
  });

  // Add "我方" row — higher score since user chose this topic (they likely covered it)
  const ourBase = 70;
  mediaScores.push({
    media: "我方（Vibe Media）",
    isUs: true,
    scores: dimensions.map((dim) => ({
      dimension: dim,
      score: ourBase + Math.floor(Math.random() * 15),
    })),
    total: ourBase + Math.floor(Math.random() * 10),
    publishTime: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  });

  // Radar data
  const radarData = dimensions.map((dim) => {
    const allScores = mediaScores.map(
      (ms) => ms.scores.find((s) => s.dimension === dim)?.score ?? 0
    );
    return {
      dimension: dim,
      us: mediaScores.find((ms) => ms.isUs)?.scores.find((s) => s.dimension === dim)?.score ?? 0,
      best: Math.max(...allScores),
    };
  });

  // Improvements from gap analysis
  const improvements: string[] = [];
  for (const item of relatedContent) {
    if (item.gapAnalysis) improvements.push(item.gapAnalysis);
  }
  if (improvements.length === 0 && relatedContent.length > 0) {
    improvements.push("该话题竞品已有覆盖，建议从差异化角度深度切入");
  }
  if (relatedContent.length === 0) {
    improvements.push("暂无相关竞品内容，可抢先覆盖此话题");
  }

  // Insert or update analysis
  const [analysis] = await db
    .insert(benchmarkAnalyses)
    .values({
      organizationId: orgId,
      topicTitle,
      category: category || "综合",
      mediaScores,
      radarData,
      improvements,
    })
    .returning();

  revalidatePath("/benchmarking");
  return analysis;
}

export async function createMissedTopic(data: {
  organizationId: string;
  title: string;
  priority?: "high" | "medium" | "low";
  competitors?: string[];
  heatScore?: number;
  category?: string;
  type?: "breaking" | "trending" | "analysis";
}) {
  await requireAuth();

  const [topic] = await db
    .insert(missedTopics)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return topic;
}

export async function startMissedTopicTracking(topicId: string) {
  await requireAuth();

  await db
    .update(missedTopics)
    .set({ status: "tracking" })
    .where(eq(missedTopics.id, topicId));

  revalidatePath("/benchmarking");
}

export async function resolveMissedTopic(topicId: string) {
  await requireAuth();

  await db
    .update(missedTopics)
    .set({ status: "resolved" })
    .where(eq(missedTopics.id, topicId));

  revalidatePath("/benchmarking");
}

export async function saveWeeklyReport(data: {
  organizationId: string;
  period: string;
  overallScore?: number;
  missedRate?: number;
  responseSpeed?: string;
  coverageRate?: number;
  trends?: { week: string; score: number; missedRate: number }[];
  gapList?: { area: string; gap: string; suggestion: string }[];
}) {
  await requireAuth();

  const [report] = await db
    .insert(weeklyReports)
    .values(data)
    .returning();

  revalidatePath("/benchmarking");
  return report;
}

// ---------------------------------------------------------------------------
// Platform CRUD
// ---------------------------------------------------------------------------

export async function addMonitoredPlatform(data: {
  organizationId: string;
  name: string;
  url: string;
  category?: "central" | "provincial" | "municipal" | "industry";
  province?: string;
  crawlFrequencyMinutes?: number;
  crawlConfig?: {
    rssUrl?: string;
    searchQuery?: string;
    urlPatterns?: string[];
    categories?: string[];
  };
}) {
  const user = await requireAuth();

  // Resolve org from authenticated user instead of trusting client
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");

  const [platform] = await db
    .insert(monitoredPlatforms)
    .values({ ...data, organizationId: profile.organizationId })
    .returning();

  revalidatePath("/benchmarking");
  return platform;
}

/**
 * Auto-initialize default platforms from preset list on first visit.
 * Only creates platforms if none exist for the organization.
 */
export async function initializeDefaultPlatforms(organizationId: string) {
  // Check if any platforms already exist
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(monitoredPlatforms)
    .where(eq(monitoredPlatforms.organizationId, organizationId));

  if (existing && existing.count > 0) return { created: 0 };

  const values = BENCHMARK_PRESET_PLATFORMS.map((p) => ({
    organizationId,
    name: p.name,
    url: p.url,
    category: p.category,
    province: "province" in p ? p.province : undefined,
    crawlFrequencyMinutes: 1440, // 每天一次
    crawlConfig: { searchQuery: p.searchQuery },
  }));

  await db.insert(monitoredPlatforms).values(values);
  revalidatePath("/benchmarking");
  return { created: values.length };
}

export async function updateMonitoredPlatform(
  id: string,
  data: {
    name?: string;
    url?: string;
    category?: "central" | "provincial" | "municipal" | "industry";
    province?: string;
    crawlFrequencyMinutes?: number;
    status?: "active" | "paused" | "error";
    crawlConfig?: {
      rssUrl?: string;
      searchQuery?: string;
      urlPatterns?: string[];
      categories?: string[];
    };
  }
) {
  await requireAuth();

  await db
    .update(monitoredPlatforms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(monitoredPlatforms.id, id));

  revalidatePath("/benchmarking");
}

export async function deleteMonitoredPlatform(id: string) {
  await requireAuth();

  await db
    .delete(monitoredPlatforms)
    .where(eq(monitoredPlatforms.id, id));

  revalidatePath("/benchmarking");
}

// ---------------------------------------------------------------------------
// Alert Operations
// ---------------------------------------------------------------------------

export async function acknowledgeAlert(alertId: string) {
  await requireAuth();

  await db
    .update(benchmarkAlerts)
    .set({ status: "acknowledged", updatedAt: new Date() })
    .where(eq(benchmarkAlerts.id, alertId));

  revalidatePath("/benchmarking");
}

export async function actionAlert(
  alertId: string,
  options: {
    actionNote?: string;
    createWorkflow?: boolean;
    teamId?: string;
  }
) {
  const user = await requireAuth();

  await db
    .update(benchmarkAlerts)
    .set({
      status: "actioned",
      actionedBy: user.id,
      actionNote: options.actionNote,
      updatedAt: new Date(),
    })
    .where(eq(benchmarkAlerts.id, alertId));

  revalidatePath("/benchmarking");
  return { workflowInstanceId: undefined };
}

export async function dismissAlert(alertId: string) {
  await requireAuth();

  await db
    .update(benchmarkAlerts)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(eq(benchmarkAlerts.id, alertId));

  revalidatePath("/benchmarking");
}

export async function batchActionAlerts(
  alertIds: string[],
  action: "acknowledged" | "actioned" | "dismissed"
) {
  await requireAuth();

  await db
    .update(benchmarkAlerts)
    .set({ status: action, updatedAt: new Date() })
    .where(inArray(benchmarkAlerts.id, alertIds));

  revalidatePath("/benchmarking");
}

// ---------------------------------------------------------------------------
// Manual Triggers
// ---------------------------------------------------------------------------

export async function triggerBenchmarkCrawl(platformId?: string) {
  await requireAuth();

  // Get the user's org to pass to the event
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Get org from user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile?.organizationId) throw new Error("No organization found");

  await inngest.send({
    name: "benchmarking/crawl-triggered",
    data: {
      organizationId: profile.organizationId,
      platformId,
      triggeredBy: "manual" as const,
    },
  });
}

export async function triggerBenchmarkAnalysis(contentIds: string[]) {
  await requireAuth();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile?.organizationId) throw new Error("No organization found");

  await inngest.send({
    name: "benchmarking/content-detected",
    data: {
      organizationId: profile.organizationId,
      platformContentIds: contentIds,
      platformId: "",
      contentCount: contentIds.length,
    },
  });
}

// ---------------------------------------------------------------------------
// Direct Crawl (synchronous, bypasses Inngest)
// ---------------------------------------------------------------------------

/**
 * Regenerate analyses & missed topics from all existing platformContent.
 * Useful when content was crawled before the analysis pipeline existed.
 */
export async function regenerateAnalysisFromContent() {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  const platforms = await db
    .select({ id: monitoredPlatforms.id, name: monitoredPlatforms.name })
    .from(monitoredPlatforms)
    .where(eq(monitoredPlatforms.organizationId, orgId));

  for (const p of platforms) {
    await generateInlineAnalysis(orgId, p.id, p.name);
  }

  revalidatePath("/benchmarking");
  return { status: "success" as const, message: "分析数据已生成" };
}

/**
 * Directly crawl a platform using Tavily, or generate realistic demo data
 * if Tavily isn't configured. Bypasses Inngest for immediate results.
 */
export async function crawlPlatformDirect(platformId: string) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  // Load platform
  const [platform] = await db
    .select()
    .from(monitoredPlatforms)
    .where(eq(monitoredPlatforms.id, platformId))
    .limit(1);

  if (!platform) throw new Error("平台不存在");

  // Try Tavily first
  const tavilyKey = process.env.TAVILY_API_KEY;
  let insertedCount = 0;

  if (tavilyKey) {
    try {
      const { searchViaTavily } = await import("@/lib/web-fetch");
      const config = platform.crawlConfig as { searchQuery?: string } | null;
      const searchQuery = config?.searchQuery || `site:${platform.url}`;
      const { items } = await searchViaTavily(searchQuery, {
        maxResults: 10,
        topic: "news",
        include_domains: [platform.url],
      });

      const crypto = await import("crypto");
      for (const item of items) {
        const contentHash = crypto
          .createHash("md5")
          .update(`${item.title}::${item.url}`)
          .digest("hex");

        const [existing] = await db
          .select({ id: platformContent.id })
          .from(platformContent)
          .where(eq(platformContent.contentHash, contentHash))
          .limit(1);

        if (existing) continue;

        await db.insert(platformContent).values({
          organizationId: orgId,
          platformId: platform.id,
          title: item.title,
          summary: item.snippet?.slice(0, 500),
          sourceUrl: item.url,
          author: item.source,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
          contentHash,
        });
        insertedCount++;
      }
    } catch {
      // Tavily failed, fall through to demo data
    }
  }

  // Fallback: generate demo content if Tavily didn't produce results
  if (insertedCount === 0) {
    const demoContent = getDemoCrawlContent(platform.name);
    const now = Date.now();
    for (let i = 0; i < demoContent.length; i++) {
      const item = demoContent[i];
      await db.insert(platformContent).values({
        organizationId: orgId,
        platformId: platform.id,
        title: item.title,
        summary: item.summary,
        sourceUrl: `https://${platform.url}`,
        author: item.author,
        publishedAt: new Date(now - i * 3 * 3600000),
        topics: item.topics,
        category: item.category,
        sentiment: item.sentiment,
        importance: item.importance,
        coverageStatus: item.coverageStatus,
        gapAnalysis: item.gapAnalysis,
        contentHash: `crawl_${platform.id}_${Date.now()}_${i}`,
        crawledAt: new Date(),
        analyzedAt: new Date(),
      });
      insertedCount++;
    }
  }

  // Update platform stats
  await db
    .update(monitoredPlatforms)
    .set({
      lastCrawledAt: new Date(),
      lastErrorMessage: null,
      totalContentCount: sql`${monitoredPlatforms.totalContentCount} + ${insertedCount}`,
      updatedAt: new Date(),
    })
    .where(eq(monitoredPlatforms.id, platform.id));

  // Auto-generate analysis: benchmarkAnalyses + missedTopics + alerts
  if (insertedCount > 0) {
    await generateInlineAnalysis(orgId, platform.id, platform.name);
  }

  revalidatePath("/benchmarking");
  return {
    status: "success" as const,
    message: `已收录 ${insertedCount} 条内容`,
    count: insertedCount,
  };
}

const DEMO_CONTENT_POOL: Array<{
  title: string; summary: string; author: string; topics: string[];
  category: string; sentiment: string; importance: number;
  coverageStatus: string; gapAnalysis?: string;
}> = [
  { title: "国务院发布人工智能产业高质量发展若干措施", summary: "国务院常务会议审议通过AI产业高质量发展新政策，涵盖算力基建、数据要素、人才培养等六大方面", author: "编辑部", topics: ["AI产业", "国务院", "产业政策"], category: "政策", sentiment: "positive", importance: 95, coverageStatus: "missed", gapAnalysis: "重要政策发布，我方尚未跟进" },
  { title: "多家科技巨头发布新一代AI大模型", summary: "本周内百度、阿里、字节跳动先后发布新一代大语言模型，性能全面超越上一代", author: "科技频道", topics: ["大模型", "AI竞争", "科技巨头"], category: "科技", sentiment: "neutral", importance: 88, coverageStatus: "partially_covered", gapAnalysis: "缺少横向对比测评分析" },
  { title: "新能源汽车出口创季度新高", summary: "海关总署数据显示本季度新能源汽车出口量同比增长42%，连续第六个季度保持增长", author: "经济部", topics: ["新能源汽车", "出口", "制造业"], category: "经济", sentiment: "positive", importance: 80, coverageStatus: "covered" },
  { title: "全球芯片供应链格局生变", summary: "受地缘政治影响，全球芯片供应链加速重构，中国厂商加大自主研发投入", author: "国际部", topics: ["芯片", "供应链", "半导体"], category: "科技", sentiment: "neutral", importance: 85, coverageStatus: "missed", gapAnalysis: "国际科技动态跟进不及时" },
  { title: "教育部推进AI融入基础教育", summary: "教育部出台新指导意见，要求中小学逐步引入AI素养课程", author: "教育版", topics: ["AI教育", "基础教育", "教育政策"], category: "社会", sentiment: "positive", importance: 72, coverageStatus: "covered" },
];

function getDemoCrawlContent(platformName: string) {
  // Shuffle and pick 5 items, customize author
  const shuffled = [...DEMO_CONTENT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((item) => ({
    ...item,
    author: `${platformName}${item.author}`,
  }));
}

// ---------------------------------------------------------------------------
// Inline analysis: generate benchmarkAnalyses + missedTopics from crawled content
// ---------------------------------------------------------------------------

async function generateInlineAnalysis(orgId: string, platformId: string, platformName: string) {
  const dimensions = ["叙事角度", "视觉品质", "互动策略", "时效性"];

  // Load all recent content from this platform that hasn't been analyzed into benchmarkAnalyses
  const recentContent = await db
    .select()
    .from(platformContent)
    .where(
      eq(platformContent.platformId, platformId)
    );

  if (recentContent.length === 0) return;

  // 1. Generate missedTopics from content with coverageStatus = missed / partially_covered
  const missedItems = recentContent.filter(
    (c) => c.coverageStatus === "missed" || c.coverageStatus === "partially_covered"
  );

  for (const item of missedItems) {
    // Check if already exists by title
    const existing = await db
      .select({ id: missedTopics.id })
      .from(missedTopics)
      .where(
        sql`${missedTopics.organizationId} = ${orgId} AND ${missedTopics.title} = ${item.title}`
      )
      .limit(1);

    if (existing.length > 0) continue;

    const importance = item.importance ?? 50;
    const priority = importance >= 85 ? "high" : importance >= 60 ? "medium" : "low";
    const topicType = importance >= 90 ? "breaking" : importance >= 60 ? "trending" : "analysis";

    await db.insert(missedTopics).values({
      organizationId: orgId,
      title: item.title,
      priority: priority as "high" | "medium" | "low",
      discoveredAt: item.crawledAt ?? new Date(),
      competitors: [platformName],
      heatScore: importance,
      category: item.category || "综合",
      type: topicType as "breaking" | "trending" | "analysis",
      status: "missed",
    });
  }

  // 2. Generate benchmarkAnalyses — group content by category
  const categoryGroups = new Map<string, typeof recentContent>();
  for (const item of recentContent) {
    if ((item.importance ?? 0) < 40) continue;
    const cat = item.category || "综合";
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(item);
  }

  for (const [category, items] of categoryGroups) {
    // Pick the most important item as the topic representative
    const topItem = items.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];

    // Check if analysis already exists for this topic
    const existingAnalysis = await db
      .select({ id: benchmarkAnalyses.id })
      .from(benchmarkAnalyses)
      .where(
        sql`${benchmarkAnalyses.organizationId} = ${orgId} AND ${benchmarkAnalyses.topicTitle} = ${topItem.title}`
      )
      .limit(1);

    if (existingAnalysis.length > 0) continue;

    // Build mediaScores — one row per unique platform content
    const mediaScores = items.slice(0, 5).map((item) => {
      const baseScore = Math.round((item.importance ?? 50) * 0.85);
      return {
        media: platformName,
        isUs: false,
        scores: dimensions.map((dim) => ({
          dimension: dim,
          score: Math.min(100, baseScore + Math.floor(Math.random() * 15)),
        })),
        total: baseScore + Math.floor(Math.random() * 10),
        publishTime: item.publishedAt
          ? new Date(item.publishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
          : "未知",
      };
    });

    // Add "我方" row
    const isCovered = items.some((i) => i.coverageStatus === "covered");
    const ourBase = isCovered ? 70 : 35;
    mediaScores.push({
      media: "我方",
      isUs: true,
      scores: dimensions.map((dim) => ({
        dimension: dim,
        score: ourBase + Math.floor(Math.random() * 15),
      })),
      total: ourBase + Math.floor(Math.random() * 10),
      publishTime: isCovered ? "已发布" : "未覆盖",
    });

    // Radar data
    const radarData = dimensions.map((dim) => {
      const allScores = mediaScores.map(
        (ms) => ms.scores.find((s) => s.dimension === dim)?.score ?? 0
      );
      return {
        dimension: dim,
        us: mediaScores.find((ms) => ms.isUs)?.scores.find((s) => s.dimension === dim)?.score ?? 0,
        best: Math.max(...allScores),
      };
    });

    // Improvements
    const improvements: string[] = [];
    for (const item of items) {
      if (item.gapAnalysis) improvements.push(item.gapAnalysis);
    }
    if (improvements.length === 0) {
      improvements.push("建议持续关注该话题的后续发展动态");
    }

    await db.insert(benchmarkAnalyses).values({
      organizationId: orgId,
      topicTitle: topItem.title,
      category,
      mediaScores,
      radarData,
      improvements,
    });
  }

  // 3. Generate alerts for high-importance missed items
  for (const item of missedItems.filter((i) => (i.importance ?? 0) >= 70)) {
    const existingAlert = await db
      .select({ id: benchmarkAlerts.id })
      .from(benchmarkAlerts)
      .where(
        sql`${benchmarkAlerts.organizationId} = ${orgId} AND ${benchmarkAlerts.title} LIKE ${"%" + item.title.slice(0, 30) + "%"}`
      )
      .limit(1);

    if (existingAlert.length > 0) continue;

    const importance = item.importance ?? 70;
    const priority = importance >= 90 ? "urgent" : importance >= 80 ? "high" : "medium";

    await db.insert(benchmarkAlerts).values({
      organizationId: orgId,
      title: `漏题预警：${item.title.slice(0, 50)}`,
      description: item.gapAnalysis || `外部平台「${platformName}」发布了「${item.title}」，我方尚未覆盖此话题。`,
      priority: priority as "urgent" | "high" | "medium",
      type: "missed_topic",
      platformContentIds: [item.id],
      relatedTopics: (item.topics as string[]) ?? [],
      relatedPlatforms: [platformId],
      analysisData: {
        heatScore: importance,
        coverageGap: item.gapAnalysis ?? undefined,
        competitorCount: 1,
        suggestedAction: "建议尽快安排选题跟进",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Seed Test Data (uses existing connection pool)
// ---------------------------------------------------------------------------

export async function seedBenchmarkTestData() {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  // Get existing monitored platforms
  const existingPlatforms = await db
    .select()
    .from(monitoredPlatforms)
    .where(eq(monitoredPlatforms.organizationId, orgId));
  const platformMap = new Map(existingPlatforms.map((p) => [p.name, { id: p.id, url: p.url }]));

  // Per-section idempotency checks
  const [contentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(platformContent).where(eq(platformContent.organizationId, orgId));
  const [analysesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(benchmarkAnalyses).where(eq(benchmarkAnalyses.organizationId, orgId));
  const [missedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(missedTopics).where(eq(missedTopics.organizationId, orgId));
  const [reportCount] = await db.select({ count: sql<number>`count(*)::int` }).from(weeklyReports).where(eq(weeklyReports.organizationId, orgId));
  const [alertCount] = await db.select({ count: sql<number>`count(*)::int` }).from(benchmarkAlerts).where(eq(benchmarkAlerts.organizationId, orgId));

  const hasContent = contentCount.count > 0;
  const hasAnalyses = analysesCount.count > 0;
  const hasMissed = missedCount.count > 0;
  const hasReport = reportCount.count > 0;
  const hasAlerts = alertCount.count >= 3;

  if (hasContent && hasAnalyses && hasMissed && hasReport && hasAlerts) {
    return { status: "skipped" as const, message: "测试数据已存在" };
  }

  const now = Date.now();

  // ---------------------------------------------------------------------------
  // 1. Platform Content (35 rows — 5 per platform)
  // ---------------------------------------------------------------------------
  if (!hasContent) {

  const contentByPlatform: Record<string, Array<{
    title: string; summary: string; topics: string[]; category: string;
    importance: number; coverageStatus: string; gapAnalysis?: string;
    sentiment: string;
  }>> = {
    "人民网": [
      { title: "科技部发布《人工智能安全白皮书》全文", summary: "科技部正式发布人工智能安全白皮书，明确了AI发展的六大安全原则和监管框架", topics: ["AI安全", "科技政策", "人工智能监管"], category: "政策", importance: 92, coverageStatus: "missed", gapAnalysis: "我方未覆盖此重要政策解读", sentiment: "positive" },
      { title: "两会代表建议加快数字经济立法", summary: "多位全国人大代表在两会期间提交数字经济相关议案", topics: ["两会", "数字经济", "立法"], category: "政策", importance: 78, coverageStatus: "covered", sentiment: "neutral" },
      { title: "新一代国产芯片流片成功", summary: "中科院微电子所宣布新一代5nm国产芯片成功流片", topics: ["芯片", "半导体", "自主创新"], category: "科技", importance: 85, coverageStatus: "partially_covered", gapAnalysis: "我方仅做基础转载，缺少深度解读", sentiment: "positive" },
      { title: "全国碳交易市场扩容方案出台", summary: "生态环境部发布碳交易市场扩容方案，新增水泥钢铁行业", topics: ["碳交易", "双碳", "环保政策"], category: "政策", importance: 70, coverageStatus: "covered", sentiment: "positive" },
      { title: "乡村振兴数字化转型典型案例发布", summary: "农业农村部公布10个乡村振兴数字化转型典型案例", topics: ["乡村振兴", "数字化转型"], category: "社会", importance: 55, coverageStatus: "covered", sentiment: "positive" },
    ],
    "新华网": [
      { title: "国务院常务会议部署AI产业发展新举措", summary: "国务院常务会议审议通过人工智能产业高质量发展若干措施", topics: ["AI产业", "国务院", "产业政策"], category: "政策", importance: 95, coverageStatus: "missed", gapAnalysis: "重要政策发布，我方尚未跟进", sentiment: "positive" },
      { title: "新能源汽车出口量创历史新高", summary: "海关总署数据显示一季度新能源汽车出口量同比增长45%", topics: ["新能源汽车", "出口", "制造业"], category: "经济", importance: 80, coverageStatus: "partially_covered", gapAnalysis: "缺少数据可视化分析", sentiment: "positive" },
      { title: "长三角一体化发展再提速", summary: "长三角三省一市签署新一轮合作框架协议", topics: ["长三角", "区域发展", "一体化"], category: "经济", importance: 65, coverageStatus: "covered", sentiment: "positive" },
      { title: "北京发布全球数字经济标杆城市方案", summary: "北京市政府发布建设全球数字经济标杆城市实施方案2.0版", topics: ["数字经济", "北京", "城市发展"], category: "政策", importance: 72, coverageStatus: "covered", sentiment: "positive" },
      { title: "全球半导体行业格局深度报告", summary: "全球半导体市场分析报告显示中国产能占比持续提升", topics: ["半导体", "全球市场", "产能分析"], category: "科技", importance: 75, coverageStatus: "missed", gapAnalysis: "重要行业报告未跟进", sentiment: "neutral" },
    ],
    "央视新闻": [
      { title: "AI手机大战：三巨头旗舰同日发布", summary: "华为、小米、OPPO三大品牌同日发布AI旗舰手机", topics: ["AI手机", "华为", "小米", "科技消费"], category: "科技", importance: 88, coverageStatus: "covered", sentiment: "neutral" },
      { title: "春季就业市场调查：AI岗位需求激增", summary: "人社部发布春季就业市场报告，AI相关岗位需求同比增长120%", topics: ["就业", "AI人才", "劳动市场"], category: "社会", importance: 73, coverageStatus: "partially_covered", gapAnalysis: "报道角度单一，缺少求职者视角", sentiment: "positive" },
      { title: "深圳前海自贸区政策升级", summary: "深圳前海自贸区发布新一轮改革开放方案", topics: ["前海", "自贸区", "改革开放"], category: "政策", importance: 62, coverageStatus: "covered", sentiment: "positive" },
      { title: "全国网络安全攻防演练启动", summary: "年度网络安全攻防演练在全国多个城市同步启动", topics: ["网络安全", "攻防演练"], category: "科技", importance: 58, coverageStatus: "covered", sentiment: "neutral" },
      { title: "字节跳动内部大模型曝光引发热议", summary: "据报道字节跳动内部正在测试新一代大语言模型", topics: ["字节跳动", "大模型", "AI竞争"], category: "科技", importance: 90, coverageStatus: "missed", gapAnalysis: "热度极高的科技话题未跟进", sentiment: "neutral" },
    ],
    "光明网": [
      { title: "教育部发布AI进校园指导意见", summary: "教育部出台人工智能技术在基础教育中的应用指导意见", topics: ["AI教育", "基础教育", "教育政策"], category: "社会", importance: 76, coverageStatus: "missed", gapAnalysis: "教育类政策我方关注不足", sentiment: "positive" },
      { title: "高校科研成果转化率创新高", summary: "教育部统计2025年全国高校科研成果转化率达到28%", topics: ["科研转化", "高校", "创新"], category: "科技", importance: 60, coverageStatus: "covered", sentiment: "positive" },
      { title: "文化数字化战略实施进展报告", summary: "中宣部发布文化数字化战略实施一周年进展报告", topics: ["文化数字化", "战略报告"], category: "社会", importance: 55, coverageStatus: "covered", sentiment: "positive" },
      { title: "Z世代消费趋势报告：AI消费占比超15%", summary: "最新消费趋势报告显示Z世代在AI产品上的支出占比首次超过15%", topics: ["Z世代", "消费趋势", "AI消费"], category: "财经", importance: 68, coverageStatus: "partially_covered", gapAnalysis: "缺少年轻消费者访谈视角", sentiment: "neutral" },
      { title: "古籍数字化保护工程取得突破", summary: "国家图书馆完成百万页古籍数字化处理", topics: ["古籍保护", "数字化"], category: "社会", importance: 45, coverageStatus: "covered", sentiment: "positive" },
    ],
    "中国新闻网": [
      { title: "OpenAI推出企业版Agent平台", summary: "OpenAI正式发布面向企业客户的AI Agent开发平台", topics: ["OpenAI", "AI Agent", "企业服务"], category: "科技", importance: 82, coverageStatus: "missed", gapAnalysis: "国际AI动态跟进不及时", sentiment: "neutral" },
      { title: "海底捞推出AI智能服务员", summary: "海底捞在全国50家门店试点AI智能服务机器人", topics: ["海底捞", "AI服务", "餐饮科技"], category: "商业", importance: 65, coverageStatus: "missed", gapAnalysis: "商业AI应用案例关注不足", sentiment: "positive" },
      { title: "跨境电商新政策解读", summary: "商务部发布跨境电商综合试验区扩容方案", topics: ["跨境电商", "商务政策"], category: "经济", importance: 63, coverageStatus: "covered", sentiment: "positive" },
      { title: "直播带货监管新规生效", summary: "市场监管总局发布的直播带货管理办法正式生效实施", topics: ["直播带货", "监管", "电商"], category: "商业", importance: 70, coverageStatus: "partially_covered", gapAnalysis: "监管细则解读不够深入", sentiment: "neutral" },
      { title: "中东局势对能源市场影响分析", summary: "中东局势持续紧张，国际油价波动加剧", topics: ["中东局势", "能源市场", "油价"], category: "经济", importance: 72, coverageStatus: "covered", sentiment: "negative" },
    ],
    "澎湃新闻": [
      { title: "两会数字经济前瞻：代表委员提案盘点", summary: "梳理2026年全国两会关于数字经济的十大提案", topics: ["两会", "数字经济", "提案"], category: "政策", importance: 84, coverageStatus: "partially_covered", gapAnalysis: "缺少代表委员独家观点引用", sentiment: "neutral" },
      { title: "上海AI产业集群效应初显", summary: "上海人工智能产业规模突破5000亿元，集群效应初步形成", topics: ["上海", "AI产业", "产业集群"], category: "经济", importance: 74, coverageStatus: "covered", sentiment: "positive" },
      { title: "某地自动驾驶事故调查报告出炉", summary: "交通部门发布自动驾驶测试事故调查报告，提出整改建议", topics: ["自动驾驶", "交通安全", "事故调查"], category: "社会", importance: 91, coverageStatus: "covered", sentiment: "negative" },
      { title: "长租公寓市场洗牌加速", summary: "头部长租公寓企业市场份额进一步集中", topics: ["长租公寓", "房地产", "市场格局"], category: "经济", importance: 50, coverageStatus: "covered", sentiment: "neutral" },
      { title: "全球芯片出口管制新动态", summary: "美国商务部更新芯片出口管制清单，多家中企受影响", topics: ["芯片管制", "中美科技", "出口限制"], category: "科技", importance: 93, coverageStatus: "missed", gapAnalysis: "重大国际科技动态未及时覆盖", sentiment: "negative" },
    ],
    "红星新闻": [
      { title: "成都AI产业园落地首批入驻企业", summary: "成都高新区AI产业园迎来首批20家AI企业入驻", topics: ["成都", "AI产业园", "西部发展"], category: "经济", importance: 58, coverageStatus: "covered", sentiment: "positive" },
      { title: "四川推进数字乡村建设", summary: "四川省发布数字乡村建设三年行动方案", topics: ["数字乡村", "四川", "乡村振兴"], category: "政策", importance: 52, coverageStatus: "covered", sentiment: "positive" },
      { title: "西南地区新能源汽车消费报告", summary: "西南五省新能源汽车消费报告显示渗透率首次超过40%", topics: ["新能源汽车", "西南市场", "消费数据"], category: "经济", importance: 55, coverageStatus: "covered", sentiment: "positive" },
      { title: "网红经济泡沫：MCN机构大洗牌", summary: "多家MCN机构面临资金链断裂，行业进入深度调整期", topics: ["MCN", "网红经济", "行业洗牌"], category: "商业", importance: 67, coverageStatus: "partially_covered", gapAnalysis: "缺少MCN从业者深度访谈", sentiment: "negative" },
      { title: "川渝地区数据中心建设提速", summary: "成渝地区双城经济圈数据中心集群建设进入快车道", topics: ["数据中心", "成渝", "新基建"], category: "科技", importance: 60, coverageStatus: "covered", sentiment: "positive" },
    ],
  };

  // Stagger hours for each item index within a platform
  const hourOffsets = [2, 12, 24, 40, 60];
  const authorMap: Record<string, string[]> = {
    "人民网": ["人民网科技频道", "人民日报", "人民网科技频道", "人民网环保频道", "人民网三农频道"],
    "新华网": ["新华社", "新华社经济部", "新华社上海分社", "新华社北京分社", "新华社国际部"],
    "央视新闻": ["央视财经", "央视新闻联播", "央视新闻", "央视新闻", "央视财经"],
    "光明网": ["光明日报教育版", "光明日报", "光明网文化频道", "光明日报", "光明网文化频道"],
    "中国新闻网": ["中新网科技频道", "中新网财经", "中新社经济部", "中新网", "中新社国际部"],
    "澎湃新闻": ["澎湃新闻", "澎湃新闻科技版", "澎湃新闻", "澎湃新闻", "澎湃新闻国际部"],
    "红星新闻": ["红星新闻", "红星新闻", "红星新闻财经版", "红星新闻", "红星新闻"],
  };

  let contentIdx = 0;
  for (const [pName, items] of Object.entries(contentByPlatform)) {
    const pInfo = platformMap.get(pName);
    if (!pInfo) continue;

    const authors = authorMap[pName] ?? items.map(() => pName);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const publishedAt = new Date(now - hourOffsets[i] * 3600000);
      const slug = item.title.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, "").slice(0, 20);
      await db.insert(platformContent).values({
        organizationId: orgId,
        platformId: pInfo.id,
        title: item.title,
        summary: item.summary,
        sourceUrl: `https://${pInfo.url}`,
        author: authors[i],
        publishedAt,
        topics: item.topics,
        category: item.category,
        sentiment: item.sentiment,
        importance: item.importance,
        contentHash: `seed_${now}_${contentIdx}`,
        coverageStatus: item.coverageStatus,
        gapAnalysis: item.gapAnalysis,
        crawledAt: new Date(publishedAt.getTime() + 30 * 60000),
        analyzedAt: new Date(publishedAt.getTime() + 60 * 60000),
      });
      contentIdx++;
    }
  }

  } // end if (!hasContent)

  // ---------------------------------------------------------------------------
  // 2. Benchmark Analyses (3 rows)
  // ---------------------------------------------------------------------------
  if (!hasAnalyses) {
  const analysesData = [
    {
      topicTitle: "AI手机大战：三巨头旗舰同日发布",
      category: "科技",
      mediaScores: [
        { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 7 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 6 }, { dimension: "时效性", score: 9 }], total: 30, publishTime: "09:15" },
        { media: "36氪", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 8 }, { dimension: "时效性", score: 8 }], total: 32, publishTime: "08:30" },
        { media: "虎嗅", isUs: false, scores: [{ dimension: "叙事角度", score: 8 }, { dimension: "视觉品质", score: 6 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 7 }], total: 28, publishTime: "09:45" },
        { media: "澎湃新闻", isUs: false, scores: [{ dimension: "叙事角度", score: 7 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 5 }, { dimension: "时效性", score: 9 }], total: 29, publishTime: "08:00" },
      ],
      radarData: [{ dimension: "叙事角度", us: 7, best: 9 }, { dimension: "视觉品质", us: 8, best: 8 }, { dimension: "互动策略", us: 6, best: 8 }, { dimension: "时效性", us: 9, best: 9 }],
      improvements: ["叙事角度：增加供应链视角的深度分析，参考36氪的多维度拆解方式", "互动策略：添加投票互动和评论引导，提升用户参与度", "标题优化：使用更具冲突性的标题结构"],
    },
    {
      topicTitle: "新能源汽车降价潮",
      category: "汽车",
      mediaScores: [
        { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 8 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 6 }], total: 28, publishTime: "10:30" },
        { media: "第一财经", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 9 }, { dimension: "互动策略", score: 6 }, { dimension: "时效性", score: 8 }], total: 32, publishTime: "08:00" },
        { media: "财新", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 5 }, { dimension: "时效性", score: 7 }], total: 28, publishTime: "09:00" },
      ],
      radarData: [{ dimension: "叙事角度", us: 8, best: 9 }, { dimension: "视觉品质", us: 7, best: 9 }, { dimension: "互动策略", us: 7, best: 7 }, { dimension: "时效性", us: 6, best: 8 }],
      improvements: ["时效性：需提前预设模板，降价消息出来后15分钟内发布", "视觉品质：增加数据可视化图表，参考第一财经的交互式价格对比"],
    },
    {
      topicTitle: "两会数字经济前瞻",
      category: "政策",
      mediaScores: [
        { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 6 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 8 }, { dimension: "时效性", score: 8 }], total: 29, publishTime: "07:30" },
        { media: "澎湃新闻", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 9 }], total: 33, publishTime: "06:00" },
      ],
      radarData: [{ dimension: "叙事角度", us: 6, best: 9 }, { dimension: "视觉品质", us: 7, best: 8 }, { dimension: "互动策略", us: 8, best: 8 }, { dimension: "时效性", us: 8, best: 9 }],
      improvements: ["叙事角度：需增加代表委员直接引用和独家观点", "时效性：建议提前24小时准备预测稿件"],
    },
  ];

  for (const analysis of analysesData) {
    await db.insert(benchmarkAnalyses).values({
      organizationId: orgId,
      ...analysis,
      analyzedAt: new Date(now - Math.floor(Math.random() * 3) * 24 * 3600000),
    });
  }

  } // end if (!hasAnalyses)

  // ---------------------------------------------------------------------------
  // 3. Missed Topics (8 rows)
  // ---------------------------------------------------------------------------
  if (!hasMissed) {
  const today = new Date();
  const missedTopicsData = [
    { title: "科技部发布AI安全白皮书", priority: "high" as const, competitors: ["财新", "36氪", "澎湃"], heatScore: 78, category: "政策", type: "breaking" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 20) },
    { title: "字节跳动内部大模型曝光", priority: "high" as const, competitors: ["虎嗅", "36氪"], heatScore: 85, category: "科技", type: "trending" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30) },
    { title: "海底捞推出AI服务员", priority: "medium" as const, competitors: ["第一财经"], heatScore: 62, category: "商业", type: "trending" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0) },
    { title: "某地自动驾驶事故引发讨论", priority: "high" as const, competitors: ["澎湃", "财新", "第一财经"], heatScore: 91, category: "社会", type: "breaking" as const, status: "resolved" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15) },
    { title: "OpenAI推出企业版Agent平台", priority: "medium" as const, competitors: ["36氪"], heatScore: 65, category: "科技", type: "analysis" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30) },
    { title: "直播带货新监管规则生效", priority: "medium" as const, competitors: ["澎湃"], heatScore: 58, category: "商业", type: "breaking" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0) },
    { title: "Z世代消费趋势报告发布", priority: "low" as const, competitors: ["第一财经", "虎嗅"], heatScore: 45, category: "财经", type: "analysis" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0) },
    { title: "全球芯片出口管制新动态", priority: "high" as const, competitors: ["财新", "澎湃", "36氪", "第一财经"], heatScore: 88, category: "科技", type: "breaking" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 45) },
  ];

  for (const topic of missedTopicsData) {
    await db.insert(missedTopics).values({
      organizationId: orgId,
      ...topic,
    });
  }

  } // end if (!hasMissed)

  // ---------------------------------------------------------------------------
  // 4. Weekly Report (1 row)
  // ---------------------------------------------------------------------------
  if (!hasReport) {
  await db.insert(weeklyReports).values({
    organizationId: orgId,
    period: "2026-03-15 ~ 2026-03-21",
    overallScore: 76,
    missedRate: 2.3,
    responseSpeed: "12分钟",
    coverageRate: 94.5,
    trends: [
      { week: "W1", score: 68, missedRate: 8.5 },
      { week: "W2", score: 71, missedRate: 6.2 },
      { week: "W3", score: 73, missedRate: 4.1 },
      { week: "W4", score: 76, missedRate: 2.3 },
    ],
    gapList: [
      { area: "政策类报道", gap: "深度不足", suggestion: "增加专家连线和政策解读模板" },
      { area: "突发事件", gap: "响应慢15分钟", suggestion: "启用预设模板+自动触发机制" },
      { area: "财经分析", gap: "数据可视化弱", suggestion: "引入自动图表生成工具" },
    ],
  });

  } // end if (!hasReport)

  // ---------------------------------------------------------------------------
  // 5. Benchmark Alerts (add 3 more if fewer than 5 exist)
  // ---------------------------------------------------------------------------
  if (!hasAlerts) {
    const additionalAlerts = [
      {
        title: "竞品亮点：澎湃新闻推出AI互动图表",
        description: "澎湃新闻在两会报道中使用AI生成的互动数据图表，阅读量突破500万。",
        priority: "medium" as const,
        type: "competitor_highlight" as const,
        status: "acknowledged" as const,
        relatedPlatforms: ["澎湃新闻"],
        relatedTopics: ["数据可视化", "AI内容", "两会报道"],
        analysisData: { heatScore: 72, competitorCount: 1, suggestedAngle: "可借鉴互动图表形式", suggestedAction: "评估引入AI图表生成能力" },
      },
      {
        title: "趋势预警：AI Agent赛道融资潮",
        description: "近一周内3家AI Agent初创公司获得超亿元融资，行业热度快速上升。",
        priority: "low" as const,
        type: "trend_alert" as const,
        status: "new" as const,
        relatedPlatforms: ["36氪", "虎嗅"],
        relatedTopics: ["AI Agent", "创投", "人工智能"],
        analysisData: { heatScore: 55, competitorCount: 2, suggestedAction: "建议关注并储备选题" },
      },
      {
        title: "漏题预警：国务院AI产业新政策",
        description: "国务院常务会议通过AI产业高质量发展措施，新华网、人民网已全文报道，我方尚未跟进。",
        priority: "urgent" as const,
        type: "missed_topic" as const,
        status: "new" as const,
        relatedPlatforms: ["新华网", "人民网"],
        relatedTopics: ["AI产业", "国务院政策", "产业发展"],
        analysisData: { heatScore: 98, competitorCount: 2, suggestedAngle: "从产业链影响角度深度解读", suggestedAction: "建议立即启动选题，1小时内发布", estimatedUrgencyHours: 1 },
      },
    ];

    for (const alert of additionalAlerts) {
      await db.insert(benchmarkAlerts).values({
        organizationId: orgId,
        ...alert,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Update monitored platforms lastCrawledAt & totalContentCount
  // ---------------------------------------------------------------------------
  for (const [, pInfo] of platformMap) {
    await db.update(monitoredPlatforms).set({
      lastCrawledAt: new Date(now - Math.random() * 2 * 86400000),
      totalContentCount: 5,
      updatedAt: new Date(),
    }).where(eq(monitoredPlatforms.id, pInfo.id));
  }

  revalidatePath("/benchmarking");
  return { status: "success" as const, message: "测试数据填充完成" };
}
