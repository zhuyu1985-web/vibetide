import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { after } from "next/server";
import { cacheAIAnalysis } from "@/app/actions/ai-analysis";
import type { AIAnalysisPerspective } from "@/app/(dashboard)/articles/[id]/types";

const deepseek = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_API_BASE_URL!,
});

const PROMPTS: Record<AIAnalysisPerspective, string> = {
  summary: `请对以下文章生成一份结构化摘要，格式要求：
1. 先用 2-3 句话概括核心内容
2. 然后列出 3-5 个关键要点（用 • 开头）
使用 Markdown 格式，语言简洁清晰。`,

  journalist: `请从新闻专业角度分析这篇文章：
1. **消息源可靠性**：评估文中引用的信息来源
2. **报道偏见**：识别可能存在的立场倾向或框架效应
3. **利益相关方**：梳理涉及的各方及其潜在利益关系
4. **信息缺失**：指出报道中可能遗漏或回避的重要信息
请客观、专业地进行分析。`,

  quotes: `请从文章中提取最有价值的引述和关键语句：
1. 列出 5-8 个最具代表性的直接引语或重要表述
2. 每条引述后附上简短说明（为何重要、出自谁）
3. 最后总结这些引述所反映的核心叙事
格式：引述内容 → 重要性说明`,

  timeline: `请梳理文章中提及的事件时间线：
1. 按时间顺序列出所有有明确时间标注的事件
2. 对时间模糊的事件，根据上下文推断其相对位置
3. 最后简述事件发展的整体趋势或规律
格式：[时间] 事件描述`,

  qa: `请围绕文章内容提炼核心问答：
1. **已回答的核心问题**（列出 3 个文章已明确解答的关键问题及答案）
2. **未回答的悬念**（列出 2-3 个文章引发但尚未解答的问题）
3. **延伸思考**（提出 1 个值得深入研究的方向）
请确保问题切中要害，答案准确简洁。`,

  deep: `请对文章进行深度剖析：

**利益相关方分析**
列出各方立场与利益（表格形式：各方 | 立场 | 潜在利益）

**数据透视**
提取并解读文中所有数据、统计数字的含义与局限性

**底层逻辑**
分析事件背后的结构性原因、权力关系或系统性因素

**影响预测**
基于现有信息，预判可能的后续发展（短期/长期）`,
};

export async function POST(req: Request) {
  try {
    const { articleId, articleContent, perspective } =
      (await req.json()) as {
        articleId: string;
        articleContent: string;
        perspective: AIAnalysisPerspective;
      };

    if (!articleId || !perspective) {
      return Response.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const prompt = PROMPTS[perspective];
    if (!prompt) {
      return Response.json({ error: "无效的分析视角" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的新闻分析 AI 助手，擅长深度解读各类资讯内容。

文章内容如下：
${(articleContent ?? "").slice(0, 12000)}`;

    let fullText = "";

    const result = streamText({
      model: deepseek.chat(process.env.OPENAI_MODEL || "deepseek-chat"),
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      onFinish: ({ text }) => {
        fullText = text;
      },
    });

    // After response is sent, cache the result in DB
    after(async () => {
      if (fullText && articleId) {
        try {
          await cacheAIAnalysis(articleId, perspective, fullText);
        } catch {
          // Non-critical: caching failure should not affect the response
        }
      }
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
