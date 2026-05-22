"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listVariantsByArticle,
  upsertVariant,
  markVariantGenerating,
  deleteVariant,
  type ArticleChannelVariantItem,
} from "@/lib/dal/article-channel-variants";
import { channelRewriteArticle } from "@/lib/agent/skills/channel-rewrite";

export async function listVariantsAction(
  articleId: string,
): Promise<ArticleChannelVariantItem[]> {
  await requireAuth();
  return listVariantsByArticle(articleId);
}

export async function upsertVariantAction(input: {
  articleId: string;
  platform: string;
  title: string;
  body?: string;
  summary?: string;
  coverImageUrl?: string;
  hashtags?: string[];
  extraFields?: Record<string, unknown>;
  status?: "draft" | "ready";
}): Promise<ArticleChannelVariantItem> {
  await requireAuth();
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, input.articleId),
    columns: { organizationId: true },
  });
  if (!article) {
    throw new Error(`Article not found: ${input.articleId}`);
  }
  const result = await upsertVariant({
    organizationId: article.organizationId,
    ...input,
  });
  revalidatePath(`/articles/${input.articleId}`);
  return result;
}

/**
 * 调 channel_rewrite skill 自动生成某平台的版本。
 * 先 mark generating，跑 skill，成功 → upsert ready，失败 → upsert failed。
 */
export async function generateVariantAction(input: {
  articleId: string;
  platform: string;
}): Promise<ArticleChannelVariantItem> {
  await requireAuth();
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, input.articleId),
  });
  if (!article) {
    throw new Error(`Article not found: ${input.articleId}`);
  }
  if (!article.body && !article.title) {
    throw new Error("Article has no content to rewrite");
  }

  await markVariantGenerating(input.articleId, input.platform, article.organizationId);

  try {
    const rewritten = await channelRewriteArticle({
      article: {
        title: article.title,
        body: article.body ?? "",
        summary: article.summary ?? undefined,
      },
      platform: input.platform,
    });

    const result = await upsertVariant({
      organizationId: article.organizationId,
      articleId: input.articleId,
      platform: input.platform,
      title: rewritten.title,
      body: rewritten.body,
      summary: rewritten.summary,
      hashtags: rewritten.hashtags,
      extraFields: rewritten.extraFields ?? {},
      status: "ready",
      fromAiGeneration: true,
    });
    revalidatePath(`/articles/${input.articleId}`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = await upsertVariant({
      organizationId: article.organizationId,
      articleId: input.articleId,
      platform: input.platform,
      title: `[生成失败] ${article.title}`,
      body: `channel_rewrite skill 失败：${message}`,
      hashtags: [],
      status: "failed",
    });
    revalidatePath(`/articles/${input.articleId}`);
    return result;
  }
}

export async function deleteVariantAction(variantId: string, articleId: string): Promise<void> {
  await requireAuth();
  await deleteVariant(variantId);
  revalidatePath(`/articles/${articleId}`);
}
