// ---------------------------------------------------------------------------
// Shared AI topic report generation
// Used by topic comparison (section 2.2) and missed topic AI summary (section 3.3).
// ---------------------------------------------------------------------------

import { searchViaTavily } from "@/lib/web-fetch";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import type { BenchmarkAISummary } from "@/lib/types";

/**
 * Generate a structured AI report for a given topic.
 * Searches Tavily for internet-wide coverage, then asks the LLM to summarize
 * into 4 structured sections (central media, other media, highlights, overall).
 */
export async function generateTopicAIReport(
  topicTitle: string,
  options?: { maxResults?: number }
): Promise<BenchmarkAISummary> {
  const { items } = await searchViaTavily(topicTitle, {
    maxResults: options?.maxResults ?? 15,
    topic: "news",
  });

  if (items.length === 0) {
    return {
      centralMediaReport: "暂未找到相关官媒报道。",
      otherMediaReport: "暂未找到相关媒体报道。",
      highlights: "暂无数据。",
      overallSummary: "该话题暂未在主流媒体中发现相关报道。",
      sourceArticles: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const sourceArticles: BenchmarkAISummary["sourceArticles"] = items.map((item) => ({
    title: item.title,
    url: item.url,
    platform: item.source || new URL(item.url).hostname,
    mediaLevel: "unknown" as const,
    publishedAt: item.publishedAt ?? undefined,
    excerpt: item.snippet?.slice(0, 200),
  }));

  const articlesContext = items
    .map(
      (item, i) =>
        `[${i + 1}] 标题: ${item.title}\n来源: ${item.source || "未知"}\n摘要: ${item.snippet?.slice(0, 300) ?? "无"}\nURL: ${item.url}`
    )
    .join("\n\n");

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);

  const { text } = await generateText({
    model,
    maxOutputTokens: 2000,
    messages: [
      {
        role: "system",
        content: `你是一位资深媒体分析师。请根据以下搜索结果，对「${topicTitle}」的全网报道情况进行结构化总结。

请严格按以下 JSON 格式输出，不要输出其他内容：
{
  "centralMediaReport": "官媒及央媒的报道情况总结（如人民网、新华网、央视等）",
  "otherMediaReport": "其他媒体的报道情况总结",
  "highlights": "报道的亮点和创新点",
  "overallSummary": "整体报道总结",
  "mediaLevels": [{"index": 0, "level": "central|provincial|municipal|industry|unknown"}, ...]
}

其中 mediaLevels 数组为每条来源文章的媒体级别判断。`,
      },
      {
        role: "user",
        content: `以下是关于「${topicTitle}」的 ${items.length} 篇报道：\n\n${articlesContext}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(text) as {
      centralMediaReport?: string;
      otherMediaReport?: string;
      highlights?: string;
      overallSummary?: string;
      mediaLevels?: Array<{ index: number; level: BenchmarkAISummary["sourceArticles"][number]["mediaLevel"] }>;
    };

    if (parsed.mediaLevels && Array.isArray(parsed.mediaLevels)) {
      for (const ml of parsed.mediaLevels) {
        if (sourceArticles[ml.index]) {
          sourceArticles[ml.index].mediaLevel = ml.level;
        }
      }
    }

    return {
      centralMediaReport: parsed.centralMediaReport || "",
      otherMediaReport: parsed.otherMediaReport || "",
      highlights: parsed.highlights || "",
      overallSummary: parsed.overallSummary || "",
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      centralMediaReport: "",
      otherMediaReport: "",
      highlights: "",
      overallSummary: text,
      sourceArticles,
      generatedAt: new Date().toISOString(),
    };
  }
}
