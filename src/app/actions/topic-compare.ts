"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  articles,
  benchmarkAnalyses,
  monitoredPlatforms,
  platformContent,
} from "@/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { generateText } from "ai";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { generateTopicAIReport } from "@/lib/ai-report";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import type { BenchmarkAISummary } from "@/lib/types";

// Note: Next.js does not permit non-async exports from "use server" files.
// If Vercel deployment needs a longer timeout for this action, configure
// `maxDuration` in the route handler that wraps it, or set it via vercel.json.

/* ─── Helpers ─── */

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extractKeywords(title: string): string[] {
  const cleaned = title
    .replace(/[，。、：；！？（）【】《》""''—\-—,.!?()\[\]<>:"]/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  return Array.from(new Set(tokens)).slice(0, 6);
}

function mapCategoryToLevel(
  cat: string | null
): "central" | "provincial" | "municipal" | "industry" | "unknown" {
  switch (cat) {
    case "central":
      return "central";
    case "provincial":
      return "provincial";
    case "municipal":
      return "municipal";
    case "industry":
      return "industry";
    default:
      return "unknown";
  }
}

/**
 * Preferred path: generate summary from platform_content records already crawled
 * into our DB. This avoids external Tavily dependency entirely.
 * Returns null if no relevant content exists.
 */
async function generateFromPlatformContent(
  orgId: string,
  title: string
): Promise<BenchmarkAISummary | null> {
  const keywords = extractKeywords(title);
  if (keywords.length === 0) return null;

  const keywordConds = keywords.map((kw) =>
    or(
      sql`${platformContent.title} ILIKE ${"%" + kw + "%"}`,
      sql`${platformContent.summary} ILIKE ${"%" + kw + "%"}`
    )
  );

  const rows = await db
    .select({
      id: platformContent.id,
      title: platformContent.title,
      summary: platformContent.summary,
      sourceUrl: platformContent.sourceUrl,
      publishedAt: platformContent.publishedAt,
      platformName: monitoredPlatforms.name,
      platformCategory: monitoredPlatforms.category,
    })
    .from(platformContent)
    .leftJoin(
      monitoredPlatforms,
      eq(platformContent.platformId, monitoredPlatforms.id)
    )
    .where(
      and(eq(platformContent.organizationId, orgId), or(...keywordConds))
    )
    .orderBy(desc(platformContent.publishedAt))
    .limit(20);

  if (rows.length === 0) return null;

  const sourceArticles: BenchmarkAISummary["sourceArticles"] = rows.map((r) => ({
    title: r.title,
    url: r.sourceUrl,
    platform: r.platformName ?? "未知来源",
    mediaLevel: mapCategoryToLevel(r.platformCategory),
    publishedAt: r.publishedAt?.toISOString() ?? undefined,
    excerpt: r.summary?.slice(0, 200) ?? undefined,
  }));

  const articlesContext = rows
    .map(
      (r, i) =>
        `[${i + 1}] 标题: ${r.title}\n来源: ${r.platformName ?? "未知"} (级别: ${r.platformCategory ?? "未知"})\n摘要: ${r.summary?.slice(0, 300) ?? "无"}`
    )
    .join("\n\n");

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);

  const { text } = await generateText({
    model,
    maxOutputTokens: 1500,
    messages: [
      {
        role: "system",
        content: `你是资深媒体分析师。基于下列已抓取的全网同题报道，对「${title}」的报道情况做结构化总结。

请严格按以下 JSON 格式输出，不要输出其他内容：
{
  "centralMediaReport": "央级媒体的报道情况总结",
  "otherMediaReport": "其他媒体（省市级、行业媒体）的报道情况总结",
  "highlights": "报道亮点与创新点",
  "overallSummary": "整体报道总结与建议"
}`,
      },
      {
        role: "user",
        content: `以下是关于「${title}」的 ${rows.length} 篇同题报道：\n\n${articlesContext}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(text) as Partial<BenchmarkAISummary>;
    return {
      centralMediaReport: parsed.centralMediaReport || "（暂无央级媒体报道）",
      otherMediaReport: parsed.otherMediaReport || "（暂无其他媒体报道）",
      highlights: parsed.highlights || "（暂无显著亮点）",
      overallSummary: parsed.overallSummary || text.slice(0, 500),
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      centralMediaReport: "",
      otherMediaReport: "",
      highlights: "",
      overallSummary: text.slice(0, 500),
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fallback path: use Tavily for internet-wide search.
 * Catches network/API errors and returns null instead of throwing so the caller
 * can surface a clean message.
 */
async function generateFromTavilyFallback(
  title: string
): Promise<{ summary: BenchmarkAISummary | null; reason?: string }> {
  try {
    const summary = await generateTopicAIReport(title, { maxResults: 10 });
    return { summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/TAVILY_API_KEY not configured/.test(msg)) {
      return { summary: null, reason: "未配置 Tavily API Key，无法进行全网搜索" };
    }
    if (/abort|timeout|socket|ECONN|fetch failed/i.test(msg)) {
      return { summary: null, reason: "Tavily 搜索超时或连接失败，请稍后重试" };
    }
    return { summary: null, reason: msg };
  }
}

/**
 * Generate (or regenerate) the AI summary for a topic-compare article.
 *
 * Strategy:
 *   1. Try DB-backed generation (platform_content + DeepSeek) — fast, no external deps.
 *   2. Fallback to Tavily-backed generation if no relevant DB content exists.
 *   3. Return a clear error if neither path yields a result.
 *
 * Upserts the result into benchmark_analyses and revalidates the page.
 */
export async function generateTopicCompareAISummary(
  articleId: string
): Promise<{
  success: boolean;
  summary?: BenchmarkAISummary;
  error?: string;
  source?: "platform_content" | "tavily";
}> {
  if (!isUUID(articleId)) {
    return { success: false, error: "此为演示数据，不支持生成 AI 分析" };
  }

  const orgId = await getCurrentUserOrg();
  if (!orgId) return { success: false, error: "请先登录" };

  const articleRows = await db
    .select({ id: articles.id, title: articles.title })
    .from(articles)
    .where(
      and(eq(articles.id, articleId), eq(articles.organizationId, orgId))
    )
    .limit(1);

  if (articleRows.length === 0) {
    return { success: false, error: "作品不存在或无权访问" };
  }

  const article = articleRows[0];

  let summary: BenchmarkAISummary | null = null;
  let source: "platform_content" | "tavily" | null = null;
  let fallbackReason: string | undefined;

  // Path 1: use crawled platform_content from our DB (preferred)
  try {
    summary = await generateFromPlatformContent(orgId, article.title);
    if (summary) source = "platform_content";
  } catch (err) {
    console.error("[topic-compare] platform_content 生成失败:", err);
    // Don't fail outright — try Tavily next
  }

  // Path 2: fallback to Tavily if DB has no relevant content
  if (!summary) {
    const result = await generateFromTavilyFallback(article.title);
    if (result.summary) {
      summary = result.summary;
      source = "tavily";
    } else {
      fallbackReason = result.reason;
    }
  }

  if (!summary) {
    return {
      success: false,
      error:
        fallbackReason ??
        "未找到相关报道数据。请先在同题对标监控平台中配置媒体并抓取内容。",
    };
  }

  // Upsert into benchmark_analyses (match by sourceArticleId OR topicTitle)
  try {
    const existing = await db
      .select({ id: benchmarkAnalyses.id })
      .from(benchmarkAnalyses)
      .where(
        and(
          eq(benchmarkAnalyses.organizationId, orgId),
          or(
            eq(benchmarkAnalyses.sourceArticleId, article.id),
            eq(benchmarkAnalyses.topicTitle, article.title)
          )
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(benchmarkAnalyses)
        .set({
          aiSummary: summary,
          analyzedAt: new Date(),
          sourceArticleId: article.id,
        })
        .where(eq(benchmarkAnalyses.id, existing[0].id));
    } else {
      await db.insert(benchmarkAnalyses).values({
        organizationId: orgId,
        topicTitle: article.title,
        sourceArticleId: article.id,
        aiSummary: summary,
      });
    }
  } catch (err) {
    console.error("[topic-compare] 保存 AI 分析失败:", err);
    // Return the summary even if persist fails — better UX than losing the result
    return {
      success: true,
      summary,
      source: source ?? "platform_content",
      error: "分析已生成但未能保存到数据库",
    };
  }

  revalidatePath(`/topic-compare/${articleId}`);
  revalidatePath("/topic-compare");

  return { success: true, summary, source: source ?? "platform_content" };
}
