import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { fetchViaJinaReader } from "@/lib/web-fetch";

export type ArticleMediaType = "article" | "video";

export interface ClassifiedContent {
  title: string;
  body: string;
  mediaType: ArticleMediaType;
  coverImageUrl?: string;
  /** 视频稿：检出的可下载视频源直链（P3 由 detectVideoSource 填） */
  videoSourceHint?: string;
}

export interface IngestArticleInput {
  organizationId: string;
  url: string;
  sourceName: string;
  /** 已抓取分类则复用，避免二次抓取 */
  classified?: ClassifiedContent;
  /** cowork 对话导入溯源 */
  importedFrom?: { channel: "cowork"; conversationId: string; userId: string };
  /** IM 渠道收稿溯源（兼容钉钉/企微链路） */
  channelContext?: {
    platform: string;
    configId: string;
    chatId: string;
    externalUserId: string;
    externalMessageId?: string;
  };
}

export interface IngestArticleResult {
  skipped: boolean;
  articleId?: string;
  title: string;
  mediaType: ArticleMediaType;
}

/**
 * 抓取 URL 正文并轻分类。
 * P1：一律判为 article；P3 在此接入 detectVideoSource 升级 mediaType/videoSourceHint/coverImageUrl。
 */
export async function fetchAndClassifyUrl(url: string): Promise<ClassifiedContent> {
  const { title, content } = await fetchViaJinaReader(url);
  const safeTitle = title?.trim() || new URL(url).hostname;
  return { title: safeTitle, body: content, mediaType: "article" };
}

/**
 * 抓取链接并存为 articles 草稿（按 organizationId+sourceUrl 去重）。
 * 无 requireAuth —— 供 Inngest / webhook 上下文调用。来源可为 cowork 对话或 IM 渠道。
 */
export async function ingestArticleFromUrl(
  input: IngestArticleInput,
): Promise<IngestArticleResult> {
  const existing = await db.query.articles.findFirst({
    where: and(
      eq(articles.organizationId, input.organizationId),
      eq(articles.sourceUrl, input.url),
    ),
    columns: { id: true, title: true, mediaType: true },
  });
  if (existing) {
    return {
      skipped: true,
      articleId: existing.id,
      title: existing.title,
      mediaType: (existing.mediaType as ArticleMediaType) ?? "article",
    };
  }

  const c = input.classified ?? (await fetchAndClassifyUrl(input.url));

  const [row] = await db
    .insert(articles)
    .values({
      organizationId: input.organizationId,
      title: c.title,
      body: c.body,
      content: { headline: c.title, body: c.body, imageNotes: [] },
      mediaType: c.mediaType,
      status: "draft",
      sourceType: "repost",
      sourceUrl: input.url,
      sourceName: input.sourceName,
      coverImageUrl: c.coverImageUrl,
      createdBy: null,
      wordCount: c.body.length,
      // 入库即标记待分析；articleAiAnalyze 完成后写回 done（P2）
      aiAnalysisStatus: "processing",
      metadata: {
        ...(input.importedFrom ? { importedFrom: input.importedFrom } : {}),
        ...(input.channelContext ? { ingestedFromChannel: input.channelContext } : {}),
      },
    })
    .returning({ id: articles.id });

  return { skipped: false, articleId: row.id, title: c.title, mediaType: c.mediaType };
}
