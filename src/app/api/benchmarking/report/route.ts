import { getCurrentUser } from "@/lib/auth";
import { generateTopicAIReport } from "@/lib/ai-report";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { topicTitle } = await request.json();
  if (!topicTitle) return new Response("Missing topicTitle", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ step: "searching" })}\n\n`));
        const report = await generateTopicAIReport(topicTitle);
        controller.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify(report)}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "生成失败" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
