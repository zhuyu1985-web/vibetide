import { db } from "@/db";
import { hotTopics, hotTopicCrawlLogs } from "@/db/schema";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import type {
  InspirationTopic,
  InspirationDelta,
  PlatformMonitor,
  EditorialMeeting,
} from "@/lib/types";
import { TOPHUB_DEFAULT_NODES, PLATFORM_ICONS } from "@/lib/trending-api";

const CATEGORY_ANGLES: Record<string, string[]> = {
  要闻: ["事件全貌：核心信息与关键节点", "影响评估：对公众生活的直接影响", "深度追问：官方回应与后续走向"],
  国际: ["地缘解读：大国博弈与利益格局", "中国视角：对国内经济与外交的影响", "历史对比：类似事件的走向与启示"],
  军事: ["装备分析：关键武器与战术运用", "战略评估：军事行动的深层意图", "影响研判：对地区安全格局的影响"],
  科技: ["技术突破解读：核心创新点与行业影响", "用户视角：对普通消费者意味着什么", "产业链分析：上下游企业的机遇与挑战"],
  财经: ["数据深度解读：关键指标背后的趋势", "投资者视角：市场影响与投资机会", "政策关联：宏观经济背景下的深层逻辑"],
  娱乐: ["舆论场分析：公众情绪与传播路径", "行业观察：背后折射的行业生态变化", "社会文化视角：映射了哪些社会心态"],
  社会: ["民生影响：普通人的生活将如何改变", "多方声音：不同群体的立场与诉求", "深度调查：事件背后的制度性原因"],
  体育: ["赛事技术分析：关键转折点复盘", "人物故事：运动员背后的成长历程", "产业观察：体育经济与品牌营销机会"],
  时政: ["政策解读：核心条款与实施路径", "影响评估：对经济社会发展的深远意义", "国际视角：全球格局下的战略考量"],
  健康: ["科学解读：权威专家怎么说", "公众指南：普通人如何应对", "行业影响：医疗健康产业的变化"],
  教育: ["政策影响：学生和家长需要知道什么", "教育者视角：教学模式的变革方向", "社会讨论：公平与效率的平衡"],
};

function generateFallbackAngles(title: string, category: string): string[] {
  const angles = CATEGORY_ANGLES[category];
  if (angles) return angles;
  // Generic fallback for uncategorized topics
  return [
    `深度解读：「${title.slice(0, 15)}」的核心看点`,
    "多维视角：各方观点与社会反响",
    "趋势研判：后续发展走向与影响预测",
  ];
}

export async function getInspirationTopics(
  orgId: string,
  userId?: string
): Promise<InspirationTopic[]> {
  const rows = await db.query.hotTopics.findMany({
    where: eq(hotTopics.organizationId, orgId),
    with: {
      angles: true,
      competitorResponses: true,
      commentInsights: true,
    },
    orderBy: [desc(hotTopics.heatScore)],
  });

  let readTopicIds: Set<string> = new Set();
  if (userId) {
    const { getTopicReadState } = await import("./topic-reads");
    const readState = await getTopicReadState(userId, orgId);
    readTopicIds = new Set(readState.readTopicIds);
  }

  return rows.map((row) => {
    const insight = row.commentInsights[0];
    const dbAngles = row.angles.map((a) => a.angleText);
    // When AI enrichment hasn't run yet, generate category-based fallback angles
    const suggestedAngles = dbAngles.length > 0
      ? dbAngles
      : generateFallbackAngles(row.title, row.category || "");

    // Use persisted AI score; fallback: heatScore + platform boost (no randomness)
    const platforms = (row.platforms as string[]) || [];
    const fallbackAiScore = Math.min(100, Math.round(
      row.heatScore * 0.7 + Math.min(30, (platforms.length / 10) * 30)
    ));

    return {
      id: row.id,
      title: row.title,
      priority: row.priority,
      heatScore: row.heatScore,
      aiScore: row.aiScore ?? fallbackAiScore,
      trend: row.trend,
      source: row.source || "",
      category: row.category || "",
      discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      heatCurve: (row.heatCurve as { time: string; value: number }[]) || [],
      suggestedAngles,
      competitorResponse: row.competitorResponses.map(
        (r) => `${r.competitorName}：${r.responseType || ""}${r.views ? `（${r.views}）` : ""}`
      ),
      relatedAssets: [],
      summary: row.summary || "",
      platforms,
      commentInsight: insight
        ? {
            positive: insight.positive,
            neutral: insight.neutral,
            negative: insight.negative,
            hotComments: (insight.hotComments as string[]) || [],
          }
        : { positive: 0, neutral: 0, negative: 0, hotComments: [] },
      isRead: readTopicIds.has(row.id),
      enrichedOutlines: (row.enrichedOutlines as InspirationTopic["enrichedOutlines"]) ?? [],
      relatedMaterials: (row.relatedMaterials as InspirationTopic["relatedMaterials"]) ?? [],
    };
  });
}

export async function getHotTopic(
  id: string
): Promise<InspirationTopic | undefined> {
  const row = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, id),
    with: {
      angles: true,
      competitorResponses: true,
      commentInsights: true,
    },
  });

  if (!row) return undefined;

  const insight = row.commentInsights[0];
  const platforms = (row.platforms as string[]) || [];
  const fallbackAiScore = Math.min(100, Math.round(
    row.heatScore * 0.7 + Math.min(30, (platforms.length / 10) * 30)
  ));

  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    heatScore: row.heatScore,
    aiScore: row.aiScore ?? fallbackAiScore,
    trend: row.trend,
    source: row.source || "",
    category: row.category || "",
    discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    heatCurve: (row.heatCurve as { time: string; value: number }[]) || [],
    suggestedAngles: row.angles.map((a) => a.angleText),
    competitorResponse: row.competitorResponses.map(
      (r) => `${r.competitorName}：${r.responseType || ""}${r.views ? `（${r.views}）` : ""}`
    ),
    relatedAssets: [],
    summary: row.summary || "",
    platforms,
    commentInsight: insight
      ? {
          positive: insight.positive,
          neutral: insight.neutral,
          negative: insight.negative,
          hotComments: (insight.hotComments as string[]) || [],
        }
      : { positive: 0, neutral: 0, negative: 0, hotComments: [] },
    isRead: false,
    enrichedOutlines: (row.enrichedOutlines as InspirationTopic["enrichedOutlines"]) ?? [],
    relatedMaterials: (row.relatedMaterials as InspirationTopic["relatedMaterials"]) ?? [],
  };
}

export async function getPlatformMonitors(orgId: string): Promise<PlatformMonitor[]> {
  const platformNames = Object.keys(TOPHUB_DEFAULT_NODES);
  const now = Date.now();

  // Query latest crawl log per platform (using a subquery for latest per platform)
  const latestLogs = await db
    .select({
      platformName: hotTopicCrawlLogs.platformName,
      status: hotTopicCrawlLogs.status,
      topicsFound: hotTopicCrawlLogs.topicsFound,
      crawledAt: hotTopicCrawlLogs.crawledAt,
    })
    .from(hotTopicCrawlLogs)
    .where(
      and(
        eq(hotTopicCrawlLogs.organizationId, orgId),
        sql`${hotTopicCrawlLogs.crawledAt} = (
          SELECT MAX(sub.crawled_at)
          FROM hot_topic_crawl_logs sub
          WHERE sub.organization_id = ${orgId}
            AND sub.platform_name = ${hotTopicCrawlLogs.platformName}
        )`
      )
    );

  const logMap = new Map(
    latestLogs.map((l) => [l.platformName, l])
  );

  return platformNames.map((name) => {
    const log = logMap.get(name);
    const icon = PLATFORM_ICONS[name] || "📡";

    // Short display name (strip suffixes like 热搜/热榜/热点/热文)
    const displayName = name.replace(/(热搜|热榜|热点|热文)$/, "");

    if (!log) {
      return { name: displayName, icon, status: "offline" as const, lastScan: "未扫描", topicsFound: 0 };
    }

    const ageMs = now - log.crawledAt.getTime();
    const isOnline = log.status === "success" && ageMs < 4 * 60 * 60 * 1000; // 4h grace

    return {
      name: displayName,
      icon,
      status: isOnline ? ("online" as const) : ("offline" as const),
      lastScan: formatRelativeTime(ageMs),
      topicsFound: log.topicsFound,
    };
  });
}

function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export function getEditorialMeeting(
  topics: InspirationTopic[],
  monitors: PlatformMonitor[],
  lastViewedAt?: string
): EditorialMeeting {
  const p0Count = topics.filter((t) => t.priority === "P0").length;
  const p1Count = topics.filter((t) => t.priority === "P1").length;
  const p2Count = topics.filter((t) => t.priority === "P2").length;
  const activePlatforms = monitors.filter((m) => m.status === "online").length;

  // Compute category distribution — push "未分类" to the end
  const catMap = new Map<string, number>();
  for (const t of topics) {
    const cat = t.category || "未分类";
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }
  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => {
      // "未分类" always last
      if (a[0] === "未分类") return 1;
      if (b[0] === "未分类") return -1;
      return b[1] - a[1];
    })
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Find last successful scan time across all monitors
  const lastScanMonitor = monitors
    .filter((m) => m.lastScan !== "未扫描")
    .sort((a, b) => {
      // Parse relative time strings for comparison (smaller = more recent)
      const parseMs = (s: string) => {
        const num = parseInt(s) || 0;
        if (s.includes("秒")) return num * 1000;
        if (s.includes("分钟")) return num * 60000;
        if (s.includes("小时")) return num * 3600000;
        if (s.includes("天")) return num * 86400000;
        return Infinity;
      };
      return parseMs(a.lastScan) - parseMs(b.lastScan);
    })[0];

  // Generate summary from real data
  const topP0 = topics
    .filter((t) => t.priority === "P0")
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 3);

  let aiSummary = "";
  if (topics.length === 0) {
    aiSummary = "暂无热点数据，请点击「刷新热点」获取最新热榜。";
  } else {
    const parts: string[] = [];

    if (activePlatforms === 0) {
      // No platforms online — clarify data is historical
      const lastTime = lastScanMonitor?.lastScan || "未知";
      parts.push(`当前无平台在线，以下为历史数据（最后扫描：${lastTime}），共 ${topics.length} 条话题。`);
      parts.push("请点击「刷新热点」获取最新数据，或检查 API 配置。");
    } else {
      parts.push(`本轮扫描覆盖 ${activePlatforms} 个平台，共发现 ${topics.length} 条热点话题。`);
    }

    if (p0Count > 0) {
      const p0Ratio = Math.round((p0Count / topics.length) * 100);
      parts.push(`其中 ${p0Count} 条为必追级别（P0，占比 ${p0Ratio}%），${p1Count} 条建议跟进（P1）。`);
      const titles = topP0.map((t) => `「${t.title.slice(0, 20)}」`).join("、");
      parts.push(`当前最热：${titles}。`);
    } else if (p1Count > 0) {
      parts.push(`暂无必追级话题，${p1Count} 条建议跟进（P1）。`);
    }

    // Only show classified categories (skip if only "未分类")
    const classifiedCats = topCategories.filter((c) => c.name !== "未分类");
    if (classifiedCats.length > 0) {
      const catSummary = classifiedCats.slice(0, 3).map((c) => `${c.name}(${c.count}条)`).join("、");
      parts.push(`话题集中在${catSummary}等领域。`);
    }

    const uncategorized = catMap.get("未分类") || 0;
    if (uncategorized > 0) {
      parts.push(`另有 ${uncategorized} 条话题待分类。`);
    }

    if (p0Count > 0) {
      parts.push("建议优先安排 P0 话题的内容生产。");
    }
    aiSummary = parts.join("\n");
  }

  let delta: InspirationDelta | undefined;
  if (lastViewedAt) {
    const lastView = new Date(lastViewedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastView.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeSinceLastView = hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分钟`;

    const newTopics = topics.filter(
      (t) => new Date(t.discoveredAt) > lastView
    );

    delta = {
      timeSinceLastView,
      newTopicsCount: newTopics.length,
      newP0Count: newTopics.filter((t) => t.priority === "P0").length,
      newP1Count: newTopics.filter((t) => t.priority === "P1").length,
      newP2Count: newTopics.filter((t) => t.priority === "P2").length,
      significantChanges: [],
      subscribedChannelUpdates: "",
    };
  }

  return {
    p0Count,
    p1Count,
    p2Count,
    totalTopics: topics.length,
    activePlatforms,
    topCategories,
    aiSummary,
    generatedAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    delta,
  };
}

export async function getNewTopicsSince(
  orgId: string,
  since: Date
): Promise<{ count: number; maxPriority: "P0" | "P1" | "P2" | null }> {
  const results = await db
    .select({ priority: hotTopics.priority })
    .from(hotTopics)
    .where(
      and(
        eq(hotTopics.organizationId, orgId),
        gt(hotTopics.createdAt, since)
      )
    );

  if (results.length === 0) return { count: 0, maxPriority: null };

  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  const maxPriority = results.reduce((max, r) => {
    return priorityOrder[r.priority] < priorityOrder[max] ? r.priority : max;
  }, "P2" as "P0" | "P1" | "P2");

  return { count: results.length, maxPriority };
}
