import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "@/lib/agent/model-router";

export interface StructuredDigest {
  summary: string;
  category: string;
  tags: string[];
  keyPoints: string[];
}

const DigestSchema = z.object({
  summary: z.string().describe("120–200 字中文摘要，客观概括稿件核心"),
  category: z
    .string()
    .describe("从给定候选分类名中选一个最贴切的；都不贴切则填最接近的"),
  tags: z.array(z.string()).min(3).max(8).describe("3-8 个主题标签"),
  keyPoints: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("3-6 条核心要点，每条一句话"),
});

/**
 * 对稿件正文做 AI 结构化分析提炼。纯函数：只返回 digest，不写库（写库由调用方决定）。
 * 沿用项目结构化输出范式 generateText + Output.object（见 topic-classifier.ts）。
 */
export async function analyzeArticleStructured(input: {
  title: string;
  body: string;
  /** org 现有分类名，作为 category 的候选允许值 */
  categories?: string[];
}): Promise<StructuredDigest> {
  const modelConfig = resolveModelConfig(["content_analysis"], {
    temperature: 0.3,
    maxTokens: 1200,
  });
  const allowed = input.categories?.length
    ? `\n\n可选分类（择一最贴切，照抄分类名）：${input.categories.join("、")}`
    : "";

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system:
      "你是稿件分析员。对给定新闻稿件做结构化提炼：输出简洁中文摘要、单一分类、3-8 个主题标签、3-6 条核心要点。严格按 schema 输出 JSON，不要附加解释文字。",
    prompt: `标题：${input.title}\n正文：\n${input.body.slice(0, 6000)}${allowed}`,
    output: Output.object({ schema: DigestSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  return output;
}
