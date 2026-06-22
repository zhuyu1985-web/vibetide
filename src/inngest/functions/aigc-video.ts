import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, articleAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import { kieGenerateVideo, KieConfigError } from "@/lib/aigc/kie-client";
import { storeRemoteMediaToTos } from "@/lib/aigc/store-media";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";

type VideoData = InngestEvents["aigc/video.requested"]["data"];

/** 核心逻辑（可单测）：出视频 → 转存 → 写回 → 回执。 */
export async function runVideo(data: VideoData): Promise<void> {
  const { organizationId, articleId, userHint, channelCtx } = data;

  // 回执包 try/catch：生成视频非幂等且贵，回执失败绝不能把 handler 炸出未捕获异常
  // 触发 Inngest 重试 → 重复生成烧额度（配合 retries:0 双保险）。
  const reply = async (content: string) => {
    try {
      const config = await getChannelConfig(channelCtx.configId);
      if (config) {
        await sendChannelMessage({ config, chatId: channelCtx.chatId, type: "markdown", title: "配视频", content });
      }
    } catch (err) {
      console.error("[aigc-video] 回执失败:", err);
    }
  };

  try {
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, organizationId)),
    });

    if (!article) {
      await reply("找不到稿件，配视频取消。");
      return;
    }

    // 产英文出视频 prompt（失败兜底 title）
    let prompt = article.title;
    try {
      const { text } = await generateText({
        model: getLanguageModel({
          provider: "openai",
          model: getDefaultModel(),
          temperature: 0.5,
          maxTokens: 200,
        }),
        prompt: `为下面这篇文章生成一句英文 AI 视频提示词（只输出提示词本身，简洁具体，适合做文章配套短视频）：\n标题：${article.title}\n摘要：${article.summary ?? ""}\n${userHint ? "用户额外要求：" + userHint : ""}`,
        maxOutputTokens: 200,
      });
      if (text.trim()) prompt = text.trim();
    } catch {
      // 兜底用 title
    }

    const urls = await kieGenerateVideo({ prompt });
    const { assetId, publicUrl } = await storeRemoteMediaToTos(urls[0], {
      organizationId,
      articleId,
      title: article.title,
      mediaType: "video",
    });

    await db.insert(articleAssets).values({
      articleId,
      assetId,
      usageType: "video",
    });

    await reply(`✅ 配视频已加到《${article.title}》：${publicUrl}`);
  } catch (err) {
    if (err instanceof KieConfigError) {
      await reply("视频功能未配置（缺 KIE_API_KEY）。");
      return;
    }
    await reply(`视频生成失败：${err instanceof Error ? err.message : String(err)}，可重试。`);
  }
}

export const aigcVideo = inngest.createFunction(
  // retries:0 —— 生成视频非幂等且贵，失败不自动重试，由用户手动再发"生成视频"重试。
  { id: "aigc-video", retries: 0 },
  { event: "aigc/video.requested" },
  async ({ event }) => {
    await runVideo(event.data);
    return { ok: true };
  }
);
