import { NextRequest } from "next/server";
import { z } from "zod";
import { streamObject } from "ai";
import { and, eq, or, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  missedTopics,
  monitoredPlatforms,
  platformContent,
} from "@/db/schema";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import { generateTopicAIReport } from "@/lib/ai-report";
import type {
  MissingTopicAIAnalysis,
  BenchmarkAISummary,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ─── Schema ─── */

const analysisSchema = z.object({
  centralMediaReport: z.string().describe("央级及官方媒体的报道情况总结"),
  otherMediaReport: z.string().describe("省级、市级、行业及自媒体的报道情况总结"),
  highlights: z.string().describe("报道亮点与创新点"),
  overallSummary: z.string().describe("整体报道总结"),
  supplementAdvice: z.object({
    urgency: z
      .enum(["immediate", "today", "scheduled", "skip"])
      .describe("建议紧急度：立即(immediate) / 今日(today) / 择时(scheduled) / 可不报道(skip)"),
    urgencyReason: z.string().describe("紧急度的理由说明"),
    angles: z
      .array(
        z.object({
          title: z.string().describe("角度名称，如'本地科技企业合规影响'"),
          description: z.string().describe("角度说明，含差异化、目标受众、内容形式"),
        })
      )
      .describe("2-3 条建议报道角度"),
    risks: z.string().describe("风险提示：政策敏感、事实待核实、信源可信度等"),
  }),
});

/* ─── Helpers ─── */

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function extractKeywords(title: string): string[] {
  const cleaned = title
    .replace(/[，。、：；！？（）【】《》""''—\-—,.!?()\[\]<>:"]/g, " ")
    .trim();
  return Array.from(
    new Set(cleaned.split(/\s+/).filter((t) => t.length >= 2))
  ).slice(0, 6);
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

async function loadContext(orgId: string, title: string) {
  const keywords = extractKeywords(title);
  if (keywords.length === 0) return { rows: [], sourceArticles: [] as BenchmarkAISummary["sourceArticles"] };

  const conds = keywords.map((kw) =>
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
      and(eq(platformContent.organizationId, orgId), or(...conds))
    )
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

/* ─── Route ─── */

export async function POST(request: NextRequest) {
  let topicId: string;
  let topicTitle: string;
  let contentSummary: string | undefined;
  try {
    const body = await request.json();
    topicId = String(body.topicId ?? "");
    topicTitle = String(body.topicTitle ?? "");
    contentSummary = body.contentSummary ? String(body.contentSummary) : undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!topicTitle) {
    return new Response(JSON.stringify({ error: "缺少 topicTitle" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const orgId = await getCurrentUserOrg();
  if (!orgId) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // closed
        }
      };

      try {
        send("status", { phase: "loading", message: "正在加载相关报道..." });
        const { rows, sourceArticles } = await loadContext(orgId, topicTitle);

        if (rows.length === 0) {
          send("status", {
            phase: "fallback",
            message: "本地无相关报道，正在全网搜索...",
          });
          try {
            const tavilyResult = await generateTopicAIReport(topicTitle, { maxResults: 10 });
            // Without DB context we cannot do full structured supplement advice;
            // synthesize a minimal advice so the UI has something useful.
            const analysis: MissingTopicAIAnalysis = {
              ...tavilyResult,
              supplementAdvice: {
                urgency: "scheduled",
                urgencyReason: "基于 Tavily 搜索结果，紧急度需人工确认",
                angles: [
                  {
                    title: "本地化视角补报",
                    description: "结合本地场景与受众，从已有报道中挖掘差异化切入点",
                  },
                ],
                risks: "外部搜索结果未经二次核实，发布前请人工确认事实准确性",
              },
            };
            send("partial", analysis as unknown as Record<string, unknown>);
            await persist(orgId, topicId, topicTitle, analysis);
            send("done", { analysis, source: "tavily" });
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            send("error", {
              message: /TAVILY_API_KEY/.test(msg)
                ? "本地无相关报道，且 Tavily 未配置"
                : "全网搜索失败，请稍后重试",
            });
            return;
          }
        }

        send("status", { phase: "generating", message: "AI 正在分析全网报道并生成补报建议..." });

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
          schema: analysisSchema,
          maxOutputTokens: 2000,
          messages: [
            {
              role: "system",
              content: `你是资深媒体编辑部主任。当前「${topicTitle}」被系统识别为**疑似漏题**，你需要基于已有的全网报道，生成：
1) 各层级媒体的报道情况总结（央级 / 其他 / 亮点 / 整体总结）
2) 补充报道建议（紧急度 / 建议角度 2-3 条 / 风险提示）

补报建议需非常具体，每个角度要包含差异化、目标受众、内容形式。`,
            },
            {
              role: "user",
              content: `漏题话题：${topicTitle}
${contentSummary ? `原文摘要：${contentSummary}\n\n` : ""}已有 ${rows.length} 篇同题报道：

${articlesContext}`,
            },
          ],
        });

        for await (const partial of partialObjectStream) {
          send("partial", partial as Record<string, unknown>);
        }

        const final = await object;

        const analysis: MissingTopicAIAnalysis = {
          centralMediaReport: final.centralMediaReport || "",
          otherMediaReport: final.otherMediaReport || "",
          highlights: final.highlights || "",
          overallSummary: final.overallSummary || "",
          supplementAdvice: {
            urgency: final.supplementAdvice?.urgency ?? "scheduled",
            urgencyReason: final.supplementAdvice?.urgencyReason ?? "",
            angles: final.supplementAdvice?.angles ?? [],
            risks: final.supplementAdvice?.risks ?? "",
          },
          sourceArticles,
          generatedAt: new Date().toISOString(),
        };

        send("status", { phase: "saving", message: "正在保存分析结果..." });
        await persist(orgId, topicId, topicTitle, analysis);

        send("done", { analysis, source: "platform_content" });
      } catch (err) {
        console.error("[missing-topics/generate-summary] error:", err);
        send("error", {
          message:
            err instanceof Error ? err.message.slice(0, 200) : "生成失败，请稍后重试",
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

async function persist(
  orgId: string,
  topicId: string,
  topicTitle: string,
  analysis: MissingTopicAIAnalysis
): Promise<void> {
  if (!topicId || !isUUID(topicId)) {
    // Demo/mock topic — skip persistence silently
    return;
  }
  await db
    .update(missedTopics)
    .set({ aiSummary: analysis })
    .where(
      and(
        eq(missedTopics.organizationId, orgId),
        or(eq(missedTopics.id, topicId), eq(missedTopics.title, topicTitle))
      )
    );
}
