import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const deepseek = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_API_BASE_URL!,
});

type EditMode = "polish" | "continue" | "rewrite" | "summarize" | "translate" | "extract";

interface EditRequest {
  fullContent: string;
  selectedText?: string;
  instruction: string;
  mode: EditMode;
}

const SYSTEM_PROMPTS: Record<EditMode, string> = {
  polish: "你是专业新闻编辑。请润色以下内容，仅输出润色后的文字，不要额外说明。",
  continue: "你是专业新闻编辑。请基于上下文续写下一段，保持风格一致。仅输出续写内容。",
  rewrite: "你是专业新闻编辑。请按指令改写内容。仅输出改写后的文字。",
  summarize: "请将以下内容生成精炼摘要。仅输出摘要文字。",
  translate: "请翻译以下内容。仅输出翻译结果。",
  extract: "请从以下内容中提取指定要素，以结构化列表输出。",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EditRequest;
    const { fullContent, selectedText, instruction, mode } = body;

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.rewrite;

    const contextPart = selectedText
      ? `【选中内容】\n${selectedText}\n\n【文章上下文（节选）】\n${fullContent.slice(0, 4000)}`
      : `【文章内容（节选）】\n${fullContent.slice(0, 6000)}`;

    const userMessage = instruction
      ? `${contextPart}\n\n【指令】\n${instruction}`
      : contextPart;

    const result = streamText({
      model: deepseek.chat(process.env.OPENAI_MODEL || "deepseek-chat"),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return Response.json({ error: "AI 编辑请求失败" }, { status: 500 });
  }
}
