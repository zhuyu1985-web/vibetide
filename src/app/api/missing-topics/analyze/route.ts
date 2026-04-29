import { NextRequest } from "next/server";
import { generateText } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  missedTopics,
  benchmarkPosts,
  benchmarkAccounts,
} from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import {
  missedTopicComparisonSchema,
  type MissedTopicComparison,
} from "@/lib/topic-matching/missed-topic-comparison";
import { expandMissedTopic } from "@/lib/topic-matching/expand-missed-topic";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function extractJson(text: string): unknown | null {
  if (!text) return null;
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    const repaired = jsonStr.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * POST /api/missing-topics/analyze
 * Body: { topicId: string, forceRefresh?: boolean, expandFirst?: boolean }
 *
 * SSE：
 *   status (phase: matching | expanding | analyzing | saving | done)
 *   matched (reportCount)
 *   partial (完整 analysis 对象，一次性输出)
 *   done (analysis)
 *   error
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "请先登录");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) return jsonError(403, "用户未关联组织");
  const orgId = profile.organizationId;

  let topicId: string;
  let forceRefresh = false;
  let expandFirst = true;
  try {
    const body = await request.json();
    topicId = String(body.topicId ?? "");
    forceRefresh = Boolean(body.forceRefresh);
    expandFirst = body.expandFirst !== false;
  } catch {
    return jsonError(400, "参数错误");
  }
  if (!topicId) return jsonError(400, "缺少 topicId");

  const [topic] = await db
    .select()
    .from(missedTopics)
    .where(and(eq(missedTopics.id, topicId), eq(missedTopics.organizationId, orgId)))
    .limit(1);
  if (!topic) return jsonError(404, "漏题不存在或无权访问");

  const encoder = new TextEncoder();

  // 缓存命中
  if (!forceRefresh && topic.aiSummary) {
    const cached = topic.aiSummary as MissedTopicComparison | null;
    if (cached && "mediaPerspectives" in (cached as object)) {
      const stream = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          };
          send("status", { phase: "cache-hit", message: "使用缓存结果" });
          send("partial", cached);
          send("done", { analysis: cached, cached: true });
          controller.close();
        },
      });
      return new Response(stream, { headers: sseHeaders() });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {}
      };

      try {
        // Step 1: 语义扩展（找到更多同题对标报道）
        if (expandFirst) {
          send("status", { phase: "expanding", message: "正在检索更多同题报道..." });
          try {
            const exp = await expandMissedTopic({ orgId, topicId });
            send("expanded", { expanded: exp.expanded, total: exp.totalRelated });
          } catch (e) {
            console.error("[missing-topic analyze] expand failed:", e);
          }
        }

        // Step 2: 加载全部同题报道
        const [refreshedTopic] = await db
          .select()
          .from(missedTopics)
          .where(eq(missedTopics.id, topicId))
          .limit(1);
        if (!refreshedTopic) throw new Error("漏题不存在");

        const allIds = [
          refreshedTopic.primaryBenchmarkPostId,
          ...((refreshedTopic.relatedBenchmarkPostIds as string[]) ?? []),
        ];

        const reports = await db
          .select({
            id: benchmarkPosts.id,
            title: benchmarkPosts.title,
            summary: benchmarkPosts.summary,
            body: benchmarkPosts.body,
            sourceUrl: benchmarkPosts.sourceUrl,
            publishedAt: benchmarkPosts.publishedAt,
            accountName: benchmarkAccounts.name,
            accountLevel: benchmarkAccounts.level,
            accountPlatform: benchmarkAccounts.platform,
          })
          .from(benchmarkPosts)
          .innerJoin(benchmarkAccounts, eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id))
          .where(inArray(benchmarkPosts.id, allIds));

        if (reports.length === 0) {
          send("error", { message: "未找到对标报道，无法分析" });
          return;
        }

        send("matched", { reportCount: reports.length });

        // Step 3: LLM 对比分析
        send("status", {
          phase: "analyzing",
          message: `基于 ${reports.length} 家媒体报道生成对比分析（约需 50 秒）...`,
        });

        const reportBlocks = reports
          .map(
            (r, i) =>
              `【报道 ${i + 1}】${r.accountName}（${levelLabel(r.accountLevel)} · ${platformLabel(r.accountPlatform)}）
标题：${r.title}
摘要：${r.summary ?? "-"}
正文：${(r.body ?? "").slice(0, 800)}`
          )
          .join("\n\n---\n\n");

        const jsonTemplate = `{
  "summary": "总结报道格局",
  "mediaPerspectives": [
    { "accountName": "...", "level": "央级", "angle": "...", "keyPoints": ["..."], "tone": "...", "differentiator": "..." }
  ],
  "dimensionComparison": [
    { "dimension": "叙事角度", "winners": ["..."], "comment": "..." },
    { "dimension": "数据支撑", "winners": ["..."], "comment": "..." },
    { "dimension": "时效性", "winners": ["..."], "comment": "..." },
    { "dimension": "情感表达", "winners": ["..."], "comment": "..." },
    { "dimension": "传播价值", "winners": ["..."], "comment": "..." },
    { "dimension": "专业深度", "winners": ["..."], "comment": "..." }
  ],
  "coverageGaps": [
    { "gap": "...", "suggestion": "...", "urgency": "high" }
  ],
  "recommendedAngle": "...",
  "recommendedHeadline": "..."
}`;

        const config = resolveModelConfig(["content_analysis"], {
          temperature: 0.3,
          maxTokens: 6000,
        });
        const model = getLanguageModel(config);

        const { text } = await generateText({
          model,
          maxOutputTokens: 6000,
          messages: [
            {
              role: "system",
              content: `你是一位资深媒体内容分析师。针对同一话题下多家媒体的报道，做多维度对比分析。

分析目标：帮助编辑团队快速理解"该话题已经被哪些媒体从什么角度报道了"，找到差异化切入点。

严格按下列 JSON 格式输出，只输出 JSON，不要加任何解释、前缀、后缀或 markdown 代码块：
${jsonTemplate}

要求：
- mediaPerspectives 必须覆盖输入中所有媒体
- dimensionComparison 至少 6 个维度（叙事角度/数据支撑/时效性/情感表达/传播价值/专业深度）
- coverageGaps 给出 2-4 条补报机会
- recommendedAngle 具体可执行（100-200 字）
- recommendedHeadline 要有传播力（10-30 字）`,
            },
            {
              role: "user",
              content: `【话题】${refreshedTopic.title}

【共 ${reports.length} 家媒体报道】
${reportBlocks}

请输出 JSON 格式的多媒体对比分析。`,
            },
          ],
        });

        const extracted = extractJson(text);
        if (!extracted) throw new Error("AI 返回内容无法解析为 JSON，请重试");
        const parsed = missedTopicComparisonSchema.safeParse(extracted);
        if (!parsed.success) {
          console.error("[missing-topic analyze] zod 校验失败:", parsed.error.message);
          throw new Error("AI 返回结构不符合预期格式，请重试");
        }
        const final = parsed.data;

        send("partial", final);

        // Step 4: 持久化
        send("status", { phase: "saving", message: "保存分析结果..." });
        await db
          .update(missedTopics)
          .set({
            aiSummary: final,
            updatedAt: new Date(),
          })
          .where(eq(missedTopics.id, topicId));

        send("done", { analysis: final, cached: false, reportCount: reports.length });
      } catch (err) {
        console.error("[missing-topics/analyze] error:", err);
        send("error", {
          message: err instanceof Error ? err.message.slice(0, 200) : "分析失败",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function levelLabel(l: string): string {
  return (
    { central: "央级", provincial: "省级", city: "地市", industry: "行业", self_media: "自媒体" }[l] ??
    l
  );
}

function platformLabel(p: string): string {
  return (
    {
      douyin: "抖音", wechat: "微信", weibo: "微博", website: "网站",
      app: "APP", bilibili: "B站", kuaishou: "快手", xiaohongshu: "小红书",
    }[p] ?? p
  );
}
