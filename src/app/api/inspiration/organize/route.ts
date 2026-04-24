import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { message, history } = (await request.json()) as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) return new Response("Empty message", { status: 400 });

  const config = resolveModelConfig(["content_analysis"]);
  const model = getLanguageModel(config);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messages = [
          {
            role: "system" as const,
            content: `你是小策（xiaoce），Vibe Media 的内容策划专员。用户会输入一条灵感或想法，你需要将其整理成结构化的选题建议。

请按以下 JSON 格式输出：
{
  "title": "精炼后的选题标题",
  "summary": "内容摘要（50-100字）",
  "angles": ["切入角度1", "切入角度2", "切入角度3"],
  "relatedKeywords": ["关联关键词1", "关联关键词2"],
  "confidence": "high|medium|low"
}

保持回复简洁专业。如果用户在追问或修改方向，基于之前的对话继续优化建议。`,
          },
          ...(history ?? []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: message },
        ];

        const { text } = await generateText({
          model,
          maxOutputTokens: 1000,
          messages,
        });

        controller.enqueue(
          encoder.encode(
            `event: result\ndata: ${JSON.stringify({ content: text })}\n\n`
          )
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message:
                err instanceof Error ? err.message : "AI 处理失败",
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
