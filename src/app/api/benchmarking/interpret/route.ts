import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { platformContent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contentId } = await request.json();

  const [content] = await db
    .select({ id: platformContent.id, title: platformContent.title, summary: platformContent.summary, body: platformContent.body, aiInterpretation: platformContent.aiInterpretation })
    .from(platformContent)
    .where(eq(platformContent.id, contentId))
    .limit(1);

  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (content.aiInterpretation) {
    return NextResponse.json({ interpretation: content.aiInterpretation });
  }

  const config = resolveModelConfig(["analysis"]);
  const model = getLanguageModel(config);
  const { text } = await generateText({
    model,
    maxOutputTokens: 800,
    messages: [
      { role: "system", content: "你是一位资深媒体编辑。请对以下新闻报道进行要点解读，包括：核心观点、关键数据、报道角度、值得关注的信息。用简洁的要点列表形式输出。" },
      { role: "user", content: `标题：${content.title}\n\n内容：${content.body || content.summary || "无详细内容"}` },
    ],
  });

  await db.update(platformContent).set({ aiInterpretation: text }).where(eq(platformContent.id, contentId));

  return NextResponse.json({ interpretation: text });
}
