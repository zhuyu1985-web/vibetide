import { NextRequest } from "next/server";
import { z } from "zod";
import { streamObject } from "ai";
import { and, eq, or, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  benchmarkAnalyses,
  monitoredPlatforms,
  platformContent,
} from "@/db/schema";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import { generateTopicAIReport } from "@/lib/ai-report";
import type { BenchmarkAISummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ─── Schema for structured streaming ─── */

const summarySchema = z.object({
  centralMediaReport: z.string().describe("央级及官方媒体的报道情况总结"),
  otherMediaReport: z.string().describe("省级、市级、行业及自媒体的报道情况总结"),
  highlights: z.string().describe("报道亮点与创新点"),
  overallSummary: z.string().describe("整体报道总结与建议"),
});

/* ─── Helpers ─── */

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function extractKeywords(title: string): string[] {
  const cleaned = title
    .replace(/[，。、：；！？（）【】《》""''—\-—,.!?()\[\]<>:"]/g, " ")
    .trim();
  return Array.from(new Set(cleaned.split(/\s+/).filter((t) => t.length >= 2))).slice(0, 6);
}

function mapCategoryToLevel(
  cat: string | null
): "central" | "provincial" | "municipal" | "industry" | "unknown" {
  switch (cat) {
    case "central": return "central";
    case "provincial": return "provincial";
    case "municipal": return "municipal";
    case "industry": return "industry";
    default: return "unknown";
  }
}

async function loadPlatformContentContext(orgId: string, title: string) {
  const keywords = extractKeywords(title);
  if (keywords.length === 0) return { rows: [], sourceArticles: [] as BenchmarkAISummary["sourceArticles"] };

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
    .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
    .where(and(eq(platformContent.organizationId, orgId), or(...keywordConds)))
    .orderBy(desc(platformContent.publishedAt))
    .limit(20);

  const sourceArticles: BenchmarkAISummary["sourceArticles"] = rows.map((r) => ({
    title: r.title,
    url: r.sourceUrl,
    platform: r.platformName ?? "未知来源",
    mediaLevel: mapCategoryToLevel(r.platformCategory),
    publishedAt: r.publishedAt?.toISOString() ?? undefined,
    excerpt: r.summary?.slice(0, 200) ?? undefined,
  }));

  return { rows, sourceArticles };
}

/* ─── Main route ─── */

export async function POST(request: NextRequest) {
  let articleId: string;
  try {
    const body = await request.json();
    articleId = String(body.articleId ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!articleId) {
    return new Response(JSON.stringify({ error: "缺少 articleId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isUUID(articleId)) {
    return new Response(
      JSON.stringify({ error: "此为演示数据，不支持生成 AI 分析" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const orgId = await getCurrentUserOrg();
  if (!orgId) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const articleRows = await db
    .select({ id: articles.id, title: articles.title })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)))
    .limit(1);

  if (articleRows.length === 0) {
    return new Response(
      JSON.stringify({ error: "作品不存在或无权访问" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const article = articleRows[0];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller closed
        }
      };

      try {
        send("status", { phase: "loading", message: "正在加载相关报道..." });

        // Phase 1: load context from DB
        let { rows, sourceArticles } = await loadPlatformContentContext(
          orgId,
          article.title
        );

        let usedFallback = false;

        // Phase 2: if no DB content, try Tavily fallback (non-streaming)
        if (rows.length === 0) {
          send("status", { phase: "fallback", message: "本地无相关报道，正在全网搜索..." });
          try {
            const tavilyResult = await generateTopicAIReport(article.title, {
              maxResults: 10,
            });
            // Tavily path is non-streaming — send the whole thing as partials + done
            send("partial", {
              centralMediaReport: tavilyResult.centralMediaReport,
              otherMediaReport: tavilyResult.otherMediaReport,
              highlights: tavilyResult.highlights,
              overallSummary: tavilyResult.overallSummary,
            });
            await persist(orgId, article.id, article.title, tavilyResult);
            send("done", { summary: tavilyResult, source: "tavily" });
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            send("error", {
              message: /TAVILY_API_KEY/.test(msg)
                ? "未找到相关报道数据，且 Tavily 未配置"
                : "全网搜索失败，请稍后重试",
            });
            return;
          }
        }

        // Phase 3: stream structured object from DB context
        send("status", { phase: "generating", message: "AI 正在生成分析..." });

        const articlesContext = rows
          .map(
            (r, i) =>
              `[${i + 1}] 标题: ${r.title}\n来源: ${r.platformName ?? "未知"} (级别: ${r.platformCategory ?? "未知"})\n摘要: ${r.summary?.slice(0, 300) ?? "无"}`
          )
          .join("\n\n");

        const config = resolveModelConfig(["analysis"]);
        const model = getLanguageModel(config);

        const { partialObjectStream, object } = streamObject({
          model,
          schema: summarySchema,
          maxOutputTokens: 1500,
          messages: [
            {
              role: "system",
              content: `你是资深媒体分析师。基于下列已抓取的全网同题报道，对「${article.title}」的报道情况做结构化总结。`,
            },
            {
              role: "user",
              content: `以下是关于「${article.title}」的 ${rows.length} 篇同题报道：\n\n${articlesContext}`,
            },
          ],
        });

        // Stream partials to client
        for await (const partial of partialObjectStream) {
          send("partial", partial as Record<string, unknown>);
        }

        const final = await object;
        usedFallback = false;

        const fullSummary: BenchmarkAISummary = {
          centralMediaReport: final.centralMediaReport || "",
          otherMediaReport: final.otherMediaReport || "",
          highlights: final.highlights || "",
          overallSummary: final.overallSummary || "",
          sourceArticles,
          generatedAt: new Date().toISOString(),
        };

        // Phase 4: persist
        send("status", { phase: "saving", message: "正在保存分析结果..." });
        await persist(orgId, article.id, article.title, fullSummary);

        send("done", {
          summary: fullSummary,
          source: usedFallback ? "tavily" : "platform_content",
        });
      } catch (err) {
        console.error("[topic-compare/generate-summary] error:", err);
        send("error", {
          message:
            err instanceof Error
              ? err.message.slice(0, 200)
              : "生成失败，请稍后重试",
        });
      } finally {
        controller.close();
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

/** Upsert the generated summary into benchmark_analyses. */
async function persist(
  orgId: string,
  articleId: string,
  topicTitle: string,
  summary: BenchmarkAISummary
): Promise<void> {
  const existing = await db
    .select({ id: benchmarkAnalyses.id })
    .from(benchmarkAnalyses)
    .where(
      and(
        eq(benchmarkAnalyses.organizationId, orgId),
        or(
          eq(benchmarkAnalyses.sourceArticleId, articleId),
          eq(benchmarkAnalyses.topicTitle, topicTitle)
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
        sourceArticleId: articleId,
      })
      .where(eq(benchmarkAnalyses.id, existing[0].id));
  } else {
    await db.insert(benchmarkAnalyses).values({
      organizationId: orgId,
      topicTitle,
      sourceArticleId: articleId,
      aiSummary: summary,
    });
  }
}
