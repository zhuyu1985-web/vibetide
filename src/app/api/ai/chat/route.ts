import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const deepseek = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_API_BASE_URL!,
});

export async function POST(req: Request) {
  try {
    const { messages, articleContent, selectedText } = await req.json();

    const systemPrompt = `你是一位专业的新闻分析 AI 助手。基于以下文章内容回答用户问题。\n\n文章内容：\n${articleContent?.slice(0, 12000) ?? "无内容"}`;

    const lastMessage = messages[messages.length - 1];
    const userContent = selectedText
      ? `[用户选中的文本：「${selectedText}」]\n\n${lastMessage.content}`
      : lastMessage.content;

    const result = streamText({
      model: deepseek.chat(process.env.OPENAI_MODEL || "deepseek-chat"),
      system: systemPrompt,
      messages: [
        ...messages.slice(0, -1),
        { role: "user", content: userContent },
      ],
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
