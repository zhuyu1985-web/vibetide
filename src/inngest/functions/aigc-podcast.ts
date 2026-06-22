import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, articleAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import { kieGenerateDialogue, KieConfigError } from "@/lib/aigc/kie-client";
import { storeRemoteMediaToTos } from "@/lib/aigc/store-media";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";

type PodcastData = InngestEvents["aigc/podcast.requested"]["data"];

type DialogueTurn = { speaker: "A" | "B"; text: string };

/** 核心逻辑（可单测）：将文章转成双主持播客脚本。 */
export async function buildDialogueScript(
  article: { title: string; summary?: string | null; body?: string | null },
  userHint?: string
): Promise<DialogueTurn[]> {
  const fallback: DialogueTurn[] = [
    { speaker: "A", text: article.summary || article.title },
  ];

  try {
    const { text } = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: getDefaultModel(),
        temperature: 0.7,
        maxTokens: 1000,
      }),
      prompt: `你是一个播客脚本编写助手。请把下面的文章内容改写为双主持对话播客脚本，输出 JSON 数组，每个元素格式为 {"speaker":"A","text":"..."} 或 {"speaker":"B","text":"..."}，A 和 B 轮流说话，合计 6-10 轮，每轮不超过 80 字，保持自然口语风格。只输出 JSON，不要其他说明。\n标题：${article.title}\n摘要：${article.summary ?? ""}\n${article.body ? "正文节选：" + article.body.slice(0, 500) : ""}${userHint ? "\n用户要求：" + userHint : ""}`,
      maxOutputTokens: 1000,
    });

    // 去掉 ```json ... ``` 或纯 ``` ... ``` 代码围栏（DeepSeek 两种都可能返回）
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    const parsed = JSON.parse(cleaned) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const turns: DialogueTurn[] = parsed
      .filter(
        (t): t is { speaker: unknown; text: unknown } =>
          typeof t === "object" && t !== null && "speaker" in t && "text" in t
      )
      .map((t) => ({
        speaker: String(t.speaker).trim().toUpperCase() === "B" ? "B" : ("A" as "A" | "B"),
        text: String(t.text),
      }));

    return turns.length > 0 ? turns : fallback;
  } catch {
    return fallback;
  }
}

/** 核心逻辑（可单测）：出播客 → 转存 → 写回 → 回执。 */
export async function runPodcast(data: PodcastData): Promise<void> {
  const { organizationId, articleId, userHint, channelCtx } = data;

  // 回执包 try/catch：生成播客非幂等且贵，回执失败绝不能把 handler 炸出未捕获异常
  // 触发 Inngest 重试 → 重复生成烧额度（配合 retries:0 双保险）。
  const reply = async (content: string) => {
    try {
      const config = await getChannelConfig(channelCtx.configId);
      if (config) {
        await sendChannelMessage({ config, chatId: channelCtx.chatId, type: "markdown", title: "生成播客", content });
      }
    } catch (err) {
      console.error("[aigc-podcast] 回执失败:", err);
    }
  };

  try {
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, organizationId)),
    });

    if (!article) {
      await reply("找不到稿件，播客生成取消。");
      return;
    }

    const script = await buildDialogueScript(
      { title: article.title, summary: article.summary, body: article.body },
      userHint
    );

    const voiceA = process.env.KIE_PODCAST_VOICE_A || "EkK5I93UQWFDigLMpZcX";
    const voiceB = process.env.KIE_PODCAST_VOICE_B || "Z3R5wn05IrDiVCyEkUrK";

    const dialogue = script.map((s) => ({
      text: s.text,
      voice: s.speaker === "B" ? voiceB : voiceA,
    }));

    const urls = await kieGenerateDialogue({ dialogue });
    const { assetId, publicUrl } = await storeRemoteMediaToTos(urls[0], {
      organizationId,
      articleId,
      title: article.title,
      mediaType: "audio",
    });

    await db.insert(articleAssets).values({
      articleId,
      assetId,
      usageType: "audio",
    });

    await reply(`🎙️ 播客已生成：${publicUrl}`);
  } catch (err) {
    if (err instanceof KieConfigError) {
      await reply("播客功能未配置（缺 KIE_API_KEY）。");
      return;
    }
    await reply(`播客生成失败：${err instanceof Error ? err.message : String(err)}，可重试。`);
  }
}

export const aigcPodcast = inngest.createFunction(
  // retries:0 —— 生成播客非幂等且贵，失败不自动重试，由用户手动再发"生成播客"重试。
  { id: "aigc-podcast", retries: 0 },
  { event: "aigc/podcast.requested" },
  async ({ event }) => {
    await runPodcast(event.data);
    return { ok: true };
  }
);
