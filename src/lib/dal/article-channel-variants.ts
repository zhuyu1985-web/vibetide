import { db } from "@/db";
import { articleChannelVariants } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type ArticleChannelVariantRow = InferSelectModel<typeof articleChannelVariants>;

export interface ArticleChannelVariantItem {
  id: string;
  organizationId: string;
  articleId: string;
  platform: string;
  title: string;
  body?: string;
  summary?: string;
  coverImageUrl?: string;
  hashtags: string[];
  extraFields: Record<string, unknown>;
  status: "draft" | "generating" | "ready" | "failed";
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function toItem(row: ArticleChannelVariantRow): ArticleChannelVariantItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    articleId: row.articleId,
    platform: row.platform,
    title: row.title,
    body: row.body ?? undefined,
    summary: row.summary ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    hashtags: (row.hashtags as string[] | null) ?? [],
    extraFields: (row.extraFields as Record<string, unknown> | null) ?? {},
    status: row.status as ArticleChannelVariantItem["status"],
    generatedAt: row.generatedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 列出某稿件的所有渠道版本，按 platform 字典序稳定排序。 */
export async function listVariantsByArticle(
  articleId: string,
): Promise<ArticleChannelVariantItem[]> {
  const rows = await db
    .select()
    .from(articleChannelVariants)
    .where(eq(articleChannelVariants.articleId, articleId))
    .orderBy(asc(articleChannelVariants.platform));
  return rows.map(toItem);
}

/** 拿单个 (articleId, platform) 的版本；不存在返回 null。 */
export async function getVariant(
  articleId: string,
  platform: string,
): Promise<ArticleChannelVariantItem | null> {
  const row = await db.query.articleChannelVariants.findFirst({
    where: and(
      eq(articleChannelVariants.articleId, articleId),
      eq(articleChannelVariants.platform, platform),
    ),
  });
  return row ? toItem(row) : null;
}

export interface UpsertVariantInput {
  organizationId: string;
  articleId: string;
  platform: string;
  title: string;
  body?: string;
  summary?: string;
  coverImageUrl?: string;
  hashtags?: string[];
  extraFields?: Record<string, unknown>;
  status?: ArticleChannelVariantItem["status"];
  /** 标记本次写入是否为 AI 生成（决定是否更新 generated_at） */
  fromAiGeneration?: boolean;
}

/** Upsert：相同 (articleId, platform) 已存在则更新，否则插入。 */
export async function upsertVariant(
  input: UpsertVariantInput,
): Promise<ArticleChannelVariantItem> {
  const now = new Date();
  const baseValues = {
    organizationId: input.organizationId,
    articleId: input.articleId,
    platform: input.platform,
    title: input.title,
    body: input.body ?? null,
    summary: input.summary ?? null,
    coverImageUrl: input.coverImageUrl ?? null,
    hashtags: input.hashtags ?? [],
    extraFields: input.extraFields ?? {},
    status: input.status ?? "draft",
    generatedAt: input.fromAiGeneration ? now : null,
    updatedAt: now,
  };

  const [row] = await db
    .insert(articleChannelVariants)
    .values(baseValues)
    .onConflictDoUpdate({
      target: [
        articleChannelVariants.articleId,
        articleChannelVariants.platform,
      ],
      set: {
        title: baseValues.title,
        body: baseValues.body,
        summary: baseValues.summary,
        coverImageUrl: baseValues.coverImageUrl,
        hashtags: baseValues.hashtags,
        extraFields: baseValues.extraFields,
        status: baseValues.status,
        ...(input.fromAiGeneration ? { generatedAt: now } : {}),
        updatedAt: now,
      },
    })
    .returning();

  return toItem(row);
}

/** 把某版本标记成 generating 状态（AI 开始生成时调用）。 */
export async function markVariantGenerating(
  articleId: string,
  platform: string,
  organizationId: string,
): Promise<void> {
  const existing = await getVariant(articleId, platform);
  if (existing) {
    await db
      .update(articleChannelVariants)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(articleChannelVariants.id, existing.id));
  } else {
    // 不存在则插一行占位（status=generating + title 用空字符串占位）
    await db.insert(articleChannelVariants).values({
      organizationId,
      articleId,
      platform,
      title: "",
      status: "generating",
    });
  }
}

export async function deleteVariant(variantId: string): Promise<void> {
  await db.delete(articleChannelVariants).where(eq(articleChannelVariants.id, variantId));
}
