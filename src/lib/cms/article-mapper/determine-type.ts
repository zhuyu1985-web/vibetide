import { CmsSchemaError } from "../errors";

export type CmsType = "1" | "2" | "4" | "5" | "11";

export interface ArticleForTypeDetection {
  mediaType: string | null; // "article" / "gallery" / "video" / "audio"
  body: string | null;
  externalUrl: string | null;
  galleryImages: Array<{ url: string; caption?: string | null }> | null;
  videoId: string | null;
  audioId: string | null;
}

/**
 * 按字段优先级推导 CMS type（§2.1 + Task 21-24 mapper 契约）：
 *
 * 1. audioId 存在       → 11
 * 2. videoId 存在       → 5
 * 3. mediaType=gallery 且图 ≥ 3  → 2
 * 4. body 非空           → 1
 * 5. externalUrl 存在    → 4
 * 6. 都没有              → 抛错
 */
export function determineType(article: ArticleForTypeDetection): CmsType {
  if (article.audioId) return "11";
  if (article.videoId) return "5";

  if (
    article.mediaType === "gallery" &&
    article.galleryImages &&
    article.galleryImages.length >= 3
  ) {
    return "2";
  }

  if (article.body && article.body.trim()) return "1";

  if (article.externalUrl && article.externalUrl.trim()) return "4";

  throw new CmsSchemaError(
    "Cannot determine CMS type — 无法推导 CMS type：article 缺少 body/externalUrl/videoId/audioId/galleryImages",
  );
}
