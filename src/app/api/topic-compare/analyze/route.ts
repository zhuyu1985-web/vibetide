import { NextRequest } from "next/server";
import { generateText } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  myPosts,
  benchmarkPosts,
  benchmarkAccounts,
  topicMatches,
} from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import {
  tenDimensionAnalysisSchema,
  type TenDimensionAnalysis,
} from "@/lib/topic-matching/dimension-analyzer";
import { findSameTopicMatches } from "@/lib/topic-matching/find-matches";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * 从 LLM 返回的文本中提取 JSON 对象，容错处理：
 *   - 去除 ```json ... ``` 或 ``` ... ``` 围栏
 *   - 截取第一个 { 到最后一个 } 之间的内容
 *   - 尝试 JSON.parse
 */
function extractJson(text: string): unknown | null {
  if (!text) return null;
  let cleaned = text.trim();

  // 去除 markdown 代码块围栏
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  // 截取第一个 { 到最后一个 }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    // 再尝试去掉可能的尾部多余逗号（LLM 常见问题）
    const repaired = jsonStr.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * POST /api/topic-compare/analyze
 * Body: { myPostId: string, forceRefresh?: boolean }
 *
 * SSE 流：
 *   status → 阶段提示
 *   partial → 10 维结果流式片段
 *   done → 完整对象 + 匹配元信息
 *   error
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return new Response(JSON.stringify({ error: "用户未关联组织" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  const orgId = profile.organizationId;

  let myPostId: string;
  let forceRefresh = false;
  try {
    const body = await request.json();
    myPostId = String(body.myPostId ?? "");
    forceRefresh = Boolean(body.forceRefresh);
  } catch {
    return new Response(JSON.stringify({ error: "参数错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!myPostId) {
    return new Response(JSON.stringify({ error: "缺少 myPostId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [myPost] = await db
    .select()
    .from(myPosts)
    .where(and(eq(myPosts.id, myPostId), eq(myPosts.organizationId, orgId)))
    .limit(1);

  if (!myPost) {
    return new Response(JSON.stringify({ error: "作品不存在或无权访问" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  // 缓存命中短路
  if (!forceRefresh) {
    const [cached] = await db
      .select()
      .from(topicMatches)
      .where(eq(topicMatches.myPostId, myPostId))
      .limit(1);
    const existing = cached?.aiAnalysis as
      | (TenDimensionAnalysis & { overallTopic?: string })
      | null;
    const fresh = cached?.expiresAt && cached.expiresAt.getTime() > Date.now();
    if (existing?.overallVerdict && fresh) {
      const stream = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          };
          send("status", { phase: "cache-hit", message: "使用缓存结果" });
          send("partial", existing);
          send("done", { analysis: existing, cached: true });
          controller.close();
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
        // Step 1: 先做同题匹配
        send("status", { phase: "matching", message: "正在检索同题报道..." });
        const matchResult = await findSameTopicMatches({
          orgId,
          myPostId,
          forceRefresh,
        });
        send("matched", {
          matchCount: matchResult.matchCount,
          overallTopic: matchResult.overallTopic,
        });

        // Step 2: 加载候选报道摘要作为对比上下文
        let referenceContext = "";
        if (matchResult.matches.length > 0) {
          const benchIds = matchResult.matches.map((m) => m.benchmarkPostId);
          const benchRows = await db
            .select({
              id: benchmarkPosts.id,
              title: benchmarkPosts.title,
              summary: benchmarkPosts.summary,
              body: benchmarkPosts.body,
              accountName: benchmarkAccounts.name,
              accountLevel: benchmarkAccounts.level,
            })
            .from(benchmarkPosts)
            .innerJoin(
              benchmarkAccounts,
              eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id)
            )
            .where(inArray(benchmarkPosts.id, benchIds));

          referenceContext = benchRows
            .map(
              (r, i) =>
                `[参考${i + 1}] ${r.accountName}（${r.accountLevel}）：${r.title}\n摘要：${(r.summary ?? r.body ?? "").slice(0, 200)}`
            )
            .join("\n\n");
        }

        // Step 3: 10 维分析（generateText + 手动 JSON 解析，对 DeepSeek 稳）
        send("status", {
          phase: "analyzing",
          message: `基于 ${matchResult.matchCount} 篇同题报道生成 10 维分析（约需 60 秒）...`,
        });

        const config = resolveModelConfig(["content_analysis"], {
          temperature: 0.3,
          maxTokens: 8000,
        });
        const model = getLanguageModel(config);

        const jsonTemplate = `{
  "topicDimension": { "score": 0-100, "summary": "核心结论", "strengths": ["亮点1", "亮点2"], "weaknesses": ["短板1"], "suggestions": ["建议1"] },
  "contentDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "detailDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "topicSettingDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "structureLogicDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "professionalismDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "timelinessDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "communicationValueDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "emotionalExpressionDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "blankSpaceDimension": { "score": 0-100, "summary": "...", "strengths": [], "weaknesses": [], "suggestions": [] },
  "overallScore": 0-100,
  "overallVerdict": "整体总结 100-200 字",
  "keyInsights": ["洞察1", "洞察2", "洞察3"],
  "coreImprovements": ["改进1", "改进2", "改进3"]
}`;

        const { text } = await generateText({
          model,
          maxOutputTokens: 8000,
          messages: [
            {
              role: "system",
              content: `你是一位资深媒体内容分析师。按 10 个维度对稿件做结构化分析。每个维度有：score（0-100整数）、summary（30-80字）、strengths（亮点数组）、weaknesses（短板数组）、suggestions（改进建议数组）。

评分标准：90+ 优秀 / 75-90 良好 / 60-75 合格 / 60- 需改进

严格按下列 JSON 格式输出，只输出 JSON，不要加任何解释、前缀、后缀或 markdown 代码块：
${jsonTemplate}`,
            },
            {
              role: "user",
              content: `【我方稿件】
标题：${myPost.title}
正文：${(myPost.body ?? myPost.summary ?? "").slice(0, 3000)}

${referenceContext ? `【同题对标报道（${matchResult.matchCount} 篇）】\n${referenceContext}\n\n主题：${matchResult.overallTopic}` : "（本稿件暂无同题对标报道，请仅对我方稿件做评估）"}

请输出 JSON 格式的 10 维度分析。`,
            },
          ],
        });

        // 手动解析：容错处理 markdown 代码块围栏和前后冗余文字
        const extracted = extractJson(text);
        if (!extracted) {
          throw new Error("AI 返回内容无法解析为 JSON，请重试");
        }
        const parsed = tenDimensionAnalysisSchema.safeParse(extracted);
        if (!parsed.success) {
          console.error("[analyze] zod 校验失败:", parsed.error.message);
          throw new Error("AI 返回结构不符合 10 维格式，请重试");
        }
        const final: TenDimensionAnalysis = parsed.data;
        send("partial", final);

        // Step 4: 持久化
        send("status", { phase: "saving", message: "保存分析结果..." });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 2 * 3600 * 1000);
        const radarData = [
          { dimension: "选题", score: final.topicDimension.score },
          { dimension: "内容", score: final.contentDimension.score },
          { dimension: "细节", score: final.detailDimension.score },
          { dimension: "话题", score: final.topicSettingDimension.score },
          { dimension: "结构", score: final.structureLogicDimension.score },
          { dimension: "专业性", score: final.professionalismDimension.score },
          { dimension: "时效", score: final.timelinessDimension.score },
          { dimension: "传播", score: final.communicationValueDimension.score },
          { dimension: "情感", score: final.emotionalExpressionDimension.score },
          { dimension: "留白", score: final.blankSpaceDimension.score },
        ];

        await db
          .update(topicMatches)
          .set({
            aiAnalysis: final,
            aiAnalysisAt: now,
            aiAnalysisVersion: 1,
            expiresAt,
            radarData,
            updatedAt: now,
          })
          .where(eq(topicMatches.myPostId, myPostId));

        await db
          .update(myPosts)
          .set({ dimensionScores: radarData, updatedAt: now })
          .where(eq(myPosts.id, myPostId));

        send("done", {
          analysis: final,
          radarData,
          matchCount: matchResult.matchCount,
          cached: false,
        });
      } catch (err) {
        console.error("[topic-compare/analyze] error:", err);
        send("error", {
          message: err instanceof Error ? err.message.slice(0, 200) : "分析失败",
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
