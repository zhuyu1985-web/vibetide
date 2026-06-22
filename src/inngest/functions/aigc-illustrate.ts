import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, articleAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import { kieGenerateImage, KieConfigError } from "@/lib/aigc/kie-client";
import { storeRemoteImageToTos } from "@/lib/aigc/store-image";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";

type IllustrateData = InngestEvents["aigc/illustrate.requested"]["data"];

/** 核心逻辑（可单测）：出图 → 转存 → 写回 → 回执。 */
export async function runIllustrate(data: IllustrateData): Promise<void> {
  const { organizationId, articleId, userHint, channelCtx } = data;

  const reply = async (content: string) => {
    const config = await getChannelConfig(channelCtx.configId);
    if (config) {
      await sendChannelMessage({
        config,
        chatId: channelCtx.chatId,
        type: "markdown",
        title: "配图",
        content,
      });
    }
  };

  try {
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, organizationId)),
    });

    if (!article) {
      await reply("找不到稿件，配图取消。");
      return;
    }

    // 产英文出图 prompt（失败兜底 title）
    let prompt = article.title;
    try {
      const { text } = await generateText({
        model: getLanguageModel({
          provider: "openai",
          model: getDefaultModel(),
          temperature: 0.5,
          maxTokens: 200,
        }),
        prompt: `为下面这篇文章生成一句英文 AI 配图提示词（只输出提示词本身，简洁具体，适合做文章封面图）：\n标题：${article.title}\n摘要：${article.summary ?? ""}\n${userHint ? "用户额外要求：" + userHint : ""}`,
        maxOutputTokens: 200,
      });
      if (text.trim()) prompt = text.trim();
    } catch {
      // 兜底用 title
    }

    const urls = await kieGenerateImage({ prompt });
    const { assetId, publicUrl } = await storeRemoteImageToTos(urls[0], {
      organizationId,
      articleId,
      title: article.title,
    });

    await db
      .update(articles)
      .set({ coverImageUrl: publicUrl })
      .where(and(eq(articles.id, articleId), eq(articles.organizationId, organizationId)));

    await db.insert(articleAssets).values({
      articleId,
      assetId,
      usageType: "cover",
    });

    await reply(`✅ 配图已加到《${article.title}》：${publicUrl}`);
  } catch (err) {
    if (err instanceof KieConfigError) {
      await reply("配图功能未配置（缺 KIE_API_KEY）。");
      return;
    }
    await reply(`配图失败：${err instanceof Error ? err.message : String(err)}，可重试。`);
  }
}

export const aigcIllustrate = inngest.createFunction(
  { id: "aigc-illustrate", retries: 1 },
  { event: "aigc/illustrate.requested" },
  async ({ event }) => {
    await runIllustrate(event.data);
    return { ok: true };
  }
);
