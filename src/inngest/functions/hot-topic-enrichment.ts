import { inngest } from "../client";
import { db } from "@/db";
import { hotTopics, topicAngles, commentInsights } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { zhipu } from "zhipu-ai-provider";
import { buildStepInstruction } from "@/lib/agent/prompt-templates";
import { revalidatePath } from "next/cache";

/**
 * AI enrichment pipeline: uses 智谱 GLM to analyze hot topics,
 * generating summaries, suggested angles, and sentiment analysis.
 */
export const hotTopicEnrichmentPipeline = inngest.createFunction(
  {
    id: "hot-topic-enrichment-pipeline",
    name: "Hot Topic Enrichment Pipeline",
    concurrency: { limit: 1 },
  },
  { event: "hot-topics/enrich-requested" },
  async ({ event, step }) => {
    // Calendar event angle generation branch
    if (event.data.calendarEventId) {
      const calendarEvent = await step.run("load-calendar-event", async () => {
        const { calendarEvents } = await import("@/db/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        return db.query.calendarEvents.findFirst({
          where: eqOp(calendarEvents.id, event.data.calendarEventId!),
        });
      });

      if (!calendarEvent) return { enriched: 0 };

      await step.run("generate-calendar-angles", async () => {
        const prompt = `你是一位资深新闻编辑顾问。针对以下即将到来的事件，生成2-3个适合提前策划的选题角度。

事件名称：${calendarEvent.name}
分类：${calendarEvent.category}
事件类型：${calendarEvent.eventType}
日期：${calendarEvent.startDate} - ${calendarEvent.endDate}

请返回JSON数组，每个元素是一个选题角度字符串。例如：["历史回顾与数据盘点", "行业趋势前瞻", "用户/受众视角"]

只返回JSON数组，不要其他文字。`;

        const result = await generateText({
          model: zhipu("glm-4-plus"),
          prompt,
          maxOutputTokens: 500,
        });

        const { calendarEvents } = await import("@/db/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const angles = JSON.parse(result.text);
        await db
          .update(calendarEvents)
          .set({ aiAngles: angles, updatedAt: new Date() })
          .where(eqOp(calendarEvents.id, calendarEvent.id));
      });

      return { enriched: 0, calendarEventEnriched: true };
    }

    const { topicIds } = event.data;

    if (topicIds.length === 0) {
      return { message: "No topics to enrich" };
    }

    // Step 1: Load topics
    const topics = await step.run("load-topics", async () => {
      return db
        .select({
          id: hotTopics.id,
          title: hotTopics.title,
          heatScore: hotTopics.heatScore,
          source: hotTopics.source,
          platforms: hotTopics.platforms,
        })
        .from(hotTopics)
        .where(inArray(hotTopics.id, topicIds));
    });

    if (topics.length === 0) {
      return { message: "Topics not found" };
    }

    // Step 2: AI analysis via 智谱 GLM
    const analysisResults = await step.run("xiaolei-analysis", async () => {
      const topicSummary = topics
        .map(
          (t, i) =>
            `${i + 1}. 标题: ${t.title}\n   热度: ${t.heatScore}\n   来源: ${t.source}\n   平台: ${(t.platforms as string[])?.join("、") || "未知"}`
        )
        .join("\n\n");

      const { text } = await generateText({
        model: zhipu("glm-4-plus"),
        maxOutputTokens: 4000,
        system: `你是「小雷」，热点监控专家。${buildStepInstruction("monitor")}
请严格以JSON数组格式返回结果，不要添加其他说明文字。`,
        prompt: `请分析以下${topics.length}个热点话题，为每个话题提供：
1. 分类（要闻/国际/军事/体育/娱乐/财经/科技/社会/健康/教育/时政 中的一个）
2. 摘要（2-3句话概括话题要点）
3. 趋势判断（rising/surging/plateau/declining）
4. 3个建议内容切入角度
5. 情感分布估算（positive/neutral/negative 三个百分比，合计100）

请以JSON数组格式返回：
[{
  "index": 0,
  "category": "科技",
  "summary": "摘要内容",
  "trend": "rising",
  "angles": ["角度1", "角度2", "角度3"],
  "sentiment": { "positive": 40, "neutral": 45, "negative": 15 }
}]

热点话题：
${topicSummary}`,
      });

      // Track enriched topic data for downstream steps
      const enriched: {
        id: string;
        title: string;
        category: string;
        summary: string;
        angles: string[];
      }[] = [];

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]) as {
            index: number;
            category: string;
            summary: string;
            trend: string;
            angles: string[];
            sentiment: { positive: number; neutral: number; negative: number };
          }[];

          for (const result of results) {
            const topic = topics[result.index];
            if (!topic) continue;

            // Update topic with AI analysis
            const trendValue = ["rising", "surging", "plateau", "declining"].includes(result.trend)
              ? (result.trend as "rising" | "surging" | "plateau" | "declining")
              : undefined;

            // Compute real AI score from multiple dimensions
            const platformCount = Array.isArray(topic.platforms) ? (topic.platforms as string[]).length : 1;
            const platformCoverage = Math.min(30, (platformCount / 10) * 30);
            const heatComponent = topic.heatScore * 0.3;
            const polarization = Math.abs(result.sentiment.positive - result.sentiment.negative) / 100;
            const sentimentScore = polarization * 20;
            const trendBonus = trendValue === "surging" ? 15 : trendValue === "rising" ? 10 : trendValue === "declining" ? -5 : 0;
            const ageMs = Date.now() - new Date(topic.id).getTime(); // approximation
            const freshnessBonus = ageMs < 2 * 3600000 ? 10 : ageMs < 4 * 3600000 ? 5 : 0;
            const aiScore = Math.min(100, Math.round(platformCoverage + heatComponent + sentimentScore + trendBonus + freshnessBonus));

            // Validate AI-returned category against allowed list
            const VALID_CATS = new Set(["要闻", "国际", "军事", "体育", "娱乐", "财经", "科技", "社会", "健康", "教育", "时政"]);
            const validCategory = VALID_CATS.has(result.category) ? result.category : null;

            await db
              .update(hotTopics)
              .set({
                ...(validCategory ? { category: validCategory } : {}),
                summary: result.summary,
                aiScore,
                ...(trendValue ? { trend: trendValue } : {}),
                updatedAt: new Date(),
              })
              .where(eq(hotTopics.id, topic.id));

            // Insert suggested angles
            if (result.angles && result.angles.length > 0) {
              await db.insert(topicAngles).values(
                result.angles.map((angle) => ({
                  hotTopicId: topic.id,
                  angleText: angle,
                  status: "suggested" as const,
                }))
              );
            }

            // Upsert comment insight
            const existingInsight = await db
              .select({ id: commentInsights.id })
              .from(commentInsights)
              .where(eq(commentInsights.hotTopicId, topic.id))
              .limit(1);

            if (existingInsight.length > 0) {
              await db
                .update(commentInsights)
                .set({
                  positive: result.sentiment.positive / 100,
                  neutral: result.sentiment.neutral / 100,
                  negative: result.sentiment.negative / 100,
                  analyzedAt: new Date(),
                })
                .where(eq(commentInsights.id, existingInsight[0].id));
            } else {
              await db.insert(commentInsights).values({
                hotTopicId: topic.id,
                positive: result.sentiment.positive / 100,
                neutral: result.sentiment.neutral / 100,
                negative: result.sentiment.negative / 100,
              });
            }

            // Collect enriched data for downstream steps
            enriched.push({
              id: topic.id,
              title: topic.title,
              category: result.category,
              summary: result.summary,
              angles: result.angles || [],
            });
          }
        }
      } catch {
        // If AI response parsing fails, continue without enrichment
      }

      return enriched;
    });

    // Step 3: Generate enriched outlines and related materials
    await step.run("generate-outlines-and-materials", async () => {
      for (const topic of analysisResults) {
        const outlinePrompt = `你是一位资深新闻编辑顾问。针对以下热点话题，为每个创作角度生成详细的内容大纲和相关参考素材。

热点标题：${topic.title}
分类：${topic.category || "未分类"}
摘要：${topic.summary || topic.title}
创作角度：${(topic.angles || []).join("、")}

请返回JSON对象，格式如下：
{
  "outlines": [
    {
      "angle": "角度名称",
      "points": ["要点1", "要点2", "要点3", "要点4"],
      "wordCount": "2000-3000",
      "style": "deep_report"
    }
  ],
  "materials": [
    {"type": "report", "title": "相关报道标题", "source": "来源媒体", "snippet": "内容摘要"},
    {"type": "data", "title": "数据点描述", "source": "数据来源", "snippet": "具体数据"},
    {"type": "comment", "title": "评论摘要", "source": "平台名", "snippet": "评论内容"}
  ]
}

style可选值：deep_report, quick_news, opinion, data_analysis
只返回JSON，不要其他文字。`;

        try {
          const result = await generateText({
            model: zhipu("glm-4-plus"),
            prompt: outlinePrompt,
            maxOutputTokens: 2000,
          });

          const parsed = JSON.parse(result.text);

          await db
            .update(hotTopics)
            .set({
              enrichedOutlines: parsed.outlines || [],
              relatedMaterials: parsed.materials || [],
              updatedAt: new Date(),
            })
            .where(eq(hotTopics.id, topic.id));
        } catch {
          // Silently skip failed enrichment
        }
      }
    });

    // Step 4: Identify potential calendar events from hot topics
    await step.run("identify-calendar-events", async () => {
      const eventSignals = /倒计时|即将开幕|即将举办|即将召开|第.{1,4}届|将于.{1,10}月.{1,5}日/;

      for (const topic of analysisResults) {
        if (!eventSignals.test(topic.title + (topic.summary || ""))) continue;

        try {
          const eventPrompt = `分析以下热点，判断是否包含一个即将到来的事件。

标题：${topic.title}
摘要：${topic.summary || ""}

如果包含事件，返回JSON：
{"isEvent": true, "name": "事件名称", "category": "分类", "eventType": "festival/competition/conference/exhibition/launch/memorial", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "angles": ["选题角度1", "选题角度2"]}

分类可选：要闻/国际/军事/体育/娱乐/财经/科技/社会/健康/教育/时政
如果不是事件，返回：{"isEvent": false}
只返回JSON。`;

          const result = await generateText({
            model: zhipu("glm-4-plus"),
            prompt: eventPrompt,
            maxOutputTokens: 500,
          });

          const parsed = JSON.parse(result.text);
          if (parsed.isEvent && parsed.name && parsed.startDate) {
            const { calendarEvents } = await import("@/db/schema");
            await db.insert(calendarEvents).values({
              organizationId: event.data.organizationId,
              name: parsed.name,
              category: parsed.category || "要闻",
              eventType: parsed.eventType || "conference",
              startDate: parsed.startDate,
              endDate: parsed.endDate || parsed.startDate,
              source: "ai_discovered",
              status: "pending_review",
              aiAngles: parsed.angles || [],
            });
          }
        } catch {
          // Skip failed event identification
        }
      }
    });

    // Step 5: Revalidate page cache
    await step.run("revalidate", async () => {
      revalidatePath("/inspiration");
    });

    return { enriched: topics.length };
  }
);
