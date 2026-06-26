import "server-only";
import { ingestArticleFromUrl } from "@/lib/articles/import";

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
 * 抓取链接正文并存为 articles 草稿（IM 渠道入口）。
 *
 * 已解耦：核心抓取/去重/入库逻辑迁至 `@/lib/articles/import` 的 `ingestArticleFromUrl`，
 * 供 cowork 对话导入与 IM 收稿共用。本函数保留原签名作薄包装，钉钉/企微链路零改动。
 */
export async function ingestLinkToArticle(
  input: IngestLinkInput,
): Promise<IngestLinkResult> {
  const r = await ingestArticleFromUrl({
    organizationId: input.organizationId,
    url: input.url,
    sourceName: input.sourceName,
    channelContext: input.channelContext,
  });
  return { skipped: r.skipped, articleId: r.articleId, title: r.title };
}
