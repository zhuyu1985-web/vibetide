import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { fetchViaJinaReader } from "@/lib/web-fetch";

export interface IngestLinkInput {
  organizationId: string;
  url: string;
  sourceName: string;
  channelContext: {
    platform: string;
    configId: string;
    chatId: string;
    externalUserId: string;
    externalMessageId: string;
  };
}

export interface IngestLinkResult {
  skipped: boolean;
  articleId?: string;
  title: string;
}

/**
 * 抓取链接正文并存为 articles 草稿。无 requireAuth —— 供 Inngest/webhook 上下文调用。
 * 按 (organizationId, sourceUrl) 查重，命中即跳过。
 */
export async function ingestLinkToArticle(
  input: IngestLinkInput
): Promise<IngestLinkResult> {
  const existing = await db.query.articles.findFirst({
    where: and(
      eq(articles.organizationId, input.organizationId),
      eq(articles.sourceUrl, input.url)
    ),
    columns: { id: true, title: true },
  });
  if (existing) {
    return { skipped: true, articleId: existing.id, title: existing.title };
  }

  const { title, content } = await fetchViaJinaReader(input.url);
  const safeTitle = title?.trim() || new URL(input.url).hostname;

  const [row] = await db
    .insert(articles)
    .values({
      organizationId: input.organizationId,
      title: safeTitle,
      body: content,
      content: { headline: safeTitle, body: content, imageNotes: [] },
      mediaType: "article",
      status: "draft",
      sourceType: "repost",
      sourceUrl: input.url,
      sourceName: input.sourceName,
      createdBy: null,
      wordCount: content.length,
      metadata: { ingestedFromChannel: input.channelContext },
    })
    .returning({ id: articles.id });

  return { skipped: false, articleId: row.id, title: safeTitle };
}
