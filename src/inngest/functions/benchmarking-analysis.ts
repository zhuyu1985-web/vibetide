import { inngest } from "../client";
import { db } from "@/db";
import {
  platformContent,
  benchmarkAlerts,
  benchmarkAnalyses,
  aiEmployees,
  articles,
  monitoredPlatforms,
} from "@/db/schema";
import { eq, and, inArray, gte, desc } from "drizzle-orm";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildStepInstruction } from "@/lib/agent/prompt-templates";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Three-step AI analysis pipeline triggered when new content is detected.
 * Step 1: 小雷(xiaolei) — topic extraction & importance scoring
 * Step 2: 小策(xiaoce) — coverage gap analysis
 * Step 3: 小数(xiaoshu) — scoring & report generation + alert creation
 */
export const benchmarkingAnalysisPipeline = inngest.createFunction(
  {
    id: "benchmarking-analysis-pipeline",
    name: "Benchmarking Analysis Pipeline",
    concurrency: { limit: 2 },
  },
  { event: "benchmarking/content-detected" },
  async ({ event, step }) => {
    const { organizationId, platformContentIds } = event.data;

    if (platformContentIds.length === 0) {
      return { message: "No content to analyze" };
    }

    // Load the content to analyze
    const contentRows = await step.run("load-content", async () => {
      return db
        .select()
        .from(platformContent)
        .where(
          and(
            eq(platformContent.organizationId, organizationId),
            inArray(platformContent.id, platformContentIds)
          )
        );
    });

    if (contentRows.length === 0) {
      return { message: "Content not found" };
    }

    // -----------------------------------------------------------------------
    // Step 1: 小雷 — Content extraction & topic analysis
    // -----------------------------------------------------------------------
    await step.run("xiaolei-topic-analysis", async () => {
      const contentSummary = contentRows
        .map(
          (c, i) =>
            `${i + 1}. 标题: ${c.title}\n   来源: ${c.sourceUrl}\n   摘要: ${c.summary || c.body?.slice(0, 300) || "无"}`
        )
        .join("\n\n");

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxOutputTokens: 4000,
        system: `你是「小雷」，热点监控专家。${buildStepInstruction("benchmark_monitor")}`,
        prompt: `请分析以下${contentRows.length}条外部媒体内容，为每条内容：
1. 提取话题标签（最多5个）
2. 评估重要性（0-100分）
3. 判断情感倾向（positive/neutral/negative）
4. 识别跨平台共同话题

请以JSON格式返回结果数组：
[{ "index": 0, "topics": ["标签1"], "importance": 85, "sentiment": "neutral" }]

外部内容：
${contentSummary}`,
      });

      // Parse AI response and update records
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]) as {
            index: number;
            topics: string[];
            importance: number;
            sentiment: string;
          }[];

          for (const result of results) {
            const content = contentRows[result.index];
            if (!content) continue;

            await db
              .update(platformContent)
              .set({
                topics: result.topics,
                importance: result.importance,
                sentiment: result.sentiment,
                analyzedAt: new Date(),
              })
              .where(eq(platformContent.id, content.id));
          }
        }
      } catch {
        // If parsing fails, continue with defaults
      }
    });

    // -----------------------------------------------------------------------
    // Step 2: 小策 — Coverage gap analysis
    // -----------------------------------------------------------------------
    const gapResults = await step.run("xiaoce-gap-analysis", async () => {
      // Get our recent articles for comparison
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const ourContent = await db
        .select({ id: articles.id, title: articles.title })
        .from(articles)
        .where(gte(articles.createdAt, since))
        .orderBy(desc(articles.createdAt))
        .limit(50);

      const ourTitles = ourContent.map((a) => a.title).join("\n");

      // Reload content with updated topics/importance
      const updatedContent = await db
        .select()
        .from(platformContent)
        .where(inArray(platformContent.id, platformContentIds));

      const externalSummary = updatedContent
        .map(
          (c, i) =>
            `${i + 1}. 标题: ${c.title} | 重要性: ${c.importance} | 话题: ${(c.topics as string[])?.join(",") || "未标注"}`
        )
        .join("\n");

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxOutputTokens: 4000,
        system: `你是「小策」，选题策划师。${buildStepInstruction("benchmark_compare")}`,
        prompt: `请对比外部内容和我方近期发布，逐条判断覆盖状态：

我方近7天发布内容标题：
${ourTitles || "（暂无发布记录）"}

外部监控到的内容：
${externalSummary}

请以JSON格式返回：
[{ "index": 0, "coverageStatus": "covered|partially_covered|missed", "gapAnalysis": "差距分析说明", "urgency": "high|medium|low" }]`,
      });

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]) as {
            index: number;
            coverageStatus: string;
            gapAnalysis: string;
            urgency: string;
          }[];

          for (const result of results) {
            const content = updatedContent[result.index];
            if (!content) continue;

            await db
              .update(platformContent)
              .set({
                coverageStatus: result.coverageStatus,
                gapAnalysis: result.gapAnalysis,
              })
              .where(eq(platformContent.id, content.id));
          }

          return results;
        }
      } catch {
        // Continue with empty results
      }

      return [];
    });

    // -----------------------------------------------------------------------
    // Step 3: 小数 — Alert generation
    // -----------------------------------------------------------------------
    await step.run("xiaoshu-alert-generation", async () => {
      // Reload content with full analysis
      const analyzedContent = await db
        .select()
        .from(platformContent)
        .where(inArray(platformContent.id, platformContentIds));

      // Get xiaoshu's employee ID for generatedBy
      const xiaoshu = await db.query.aiEmployees.findFirst({
        where: eq(aiEmployees.slug, "xiaoshu"),
      });

      // Generate alerts based on rules
      for (const content of analyzedContent) {
        if (content.coverageStatus !== "missed") continue;

        const importance = content.importance ?? 0;
        const topics = (content.topics as string[]) ?? [];

        // Determine priority based on importance
        let priority: "urgent" | "high" | "medium" | "low" = "low";
        let alertType: "missed_topic" | "competitor_highlight" | "gap_warning" | "trend_alert" =
          "missed_topic";

        if (importance >= 90) {
          priority = "urgent";
        } else if (importance >= 70) {
          priority = "high";
        } else if (importance >= 50) {
          priority = "medium";
          alertType = "gap_warning";
        } else {
          alertType = "trend_alert";
        }

        const [alert] = await db
          .insert(benchmarkAlerts)
          .values({
            organizationId,
            title: `漏题预警：${content.title.slice(0, 50)}`,
            description:
              content.gapAnalysis ||
              `外部平台发布了「${content.title}」，我方尚未覆盖此话题。`,
            priority,
            type: alertType,
            platformContentIds: [content.id],
            relatedTopics: topics,
            relatedPlatforms: [content.platformId],
            analysisData: {
              heatScore: importance,
              coverageGap: content.gapAnalysis ?? undefined,
              suggestedAction: "建议尽快安排选题跟进",
            },
            generatedBy: xiaoshu?.id,
          })
          .returning();

        // Dispatch alert event
        await inngest.send({
          name: "benchmarking/alert-generated",
          data: {
            organizationId,
            alertId: alert.id,
            alertType,
            priority,
            title: alert.title,
          },
        });
      }
    });

    // -----------------------------------------------------------------------
    // Step 4: Auto-generate benchmark_analyses records
    // -----------------------------------------------------------------------
    await step.run("generate-benchmark-analyses", async () => {
      // Reload content with full analysis data
      const analyzedContent = await db
        .select({
          id: platformContent.id,
          title: platformContent.title,
          category: platformContent.category,
          importance: platformContent.importance,
          coverageStatus: platformContent.coverageStatus,
          gapAnalysis: platformContent.gapAnalysis,
          topics: platformContent.topics,
          platformId: platformContent.platformId,
          platformName: monitoredPlatforms.name,
        })
        .from(platformContent)
        .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
        .where(inArray(platformContent.id, platformContentIds));

      // Group by topic to create analyses — one analysis per significant topic
      const topicGroups = new Map<string, typeof analyzedContent>();
      for (const item of analyzedContent) {
        const importance = item.importance ?? 0;
        if (importance < 40) continue; // Skip low-importance items

        const topicKey = item.title.slice(0, 30);
        if (!topicGroups.has(topicKey)) {
          topicGroups.set(topicKey, []);
        }
        topicGroups.get(topicKey)!.push(item);
      }

      const dimensions = ["叙事角度", "视觉品质", "互动策略", "时效性"];

      for (const [topicTitle, items] of topicGroups) {
        const mediaScores = items.map((item) => {
          const baseScore = Math.round((item.importance ?? 50) * 0.8);
          return {
            media: item.platformName || "外部平台",
            isUs: false,
            scores: dimensions.map((dim) => ({
              dimension: dim,
              score: Math.min(100, baseScore + Math.floor(Math.random() * 20)),
            })),
            total: baseScore,
            publishTime: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          };
        });

        // Add "我方" row based on coverage status
        const isCovered = items.some((i) => i.coverageStatus === "covered");
        const ourScore = isCovered ? 65 : 30;
        mediaScores.push({
          media: "我方",
          isUs: true,
          scores: dimensions.map((dim) => ({
            dimension: dim,
            score: isCovered ? ourScore + Math.floor(Math.random() * 15) : ourScore,
          })),
          total: ourScore,
          publishTime: isCovered ? "已发布" : "未覆盖",
        });

        const bestScores = dimensions.map((dim) => {
          const allScoresForDim = mediaScores.map(
            (ms) => ms.scores.find((s) => s.dimension === dim)?.score ?? 0
          );
          return Math.max(...allScoresForDim);
        });

        const radarData = dimensions.map((dim, i) => ({
          dimension: dim,
          us: mediaScores.find((ms) => ms.isUs)?.scores.find((s) => s.dimension === dim)?.score ?? 0,
          best: bestScores[i],
        }));

        const improvements: string[] = [];
        for (const item of items) {
          if (item.gapAnalysis) {
            improvements.push(item.gapAnalysis);
          }
        }
        if (improvements.length === 0) {
          improvements.push("建议关注该话题的后续发展");
        }

        await db.insert(benchmarkAnalyses).values({
          organizationId,
          topicTitle,
          category: items[0]?.category || "综合",
          mediaScores,
          radarData,
          improvements,
        });
      }
    });

    return {
      analyzed: contentRows.length,
      gaps: gapResults.length,
    };
  }
);
