import type { CmsArticleSaveDTO, CmsListStyleDto } from "../types";

export interface ArticleForMapper {
  id: string;
  title: string;
  authorName: string | null;
  summary: string | null;
  shortTitle: string | null;
  tags: string[];
  coverImageUrl: string | null;
  publishStatus: "draft" | "pending" | "published" | "rejected";
  publishedAt: Date | null;
}

export interface MapperContext {
  siteId: number;
  appId: number;
  catalogId: number;
  tenantId: string;
  loginId: string;
  loginTid: string;
  username: string;
  source: string;
  author: string;                  // 兜底作者（当 article.authorName 为 null）
  listStyleDefault: CmsListStyleDto;
  coverImageDefault: string;
}

const DEFAULT_AUTHOR = "智媒编辑部";
const DEFAULT_SOURCE = "智媒编辑部";
const TITLE_MAX = 80;
const SHORT_TITLE_MAX = 20;
const KEYWORD_COUNT_MAX = 10;

/**
 * VibeTide publishStatus → CMS status 字符串
 */
function publishStatusToCmsStatus(
  status: ArticleForMapper["publishStatus"],
): "0" | "20" | "30" | "60" {
  switch (status) {
    case "draft":     return "0";
    case "pending":   return "20";
    case "published": return "30";
    case "rejected":  return "60";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function deriveShortTitle(
  article: ArticleForMapper,
): string {
  if (article.shortTitle && article.shortTitle.trim()) {
    return truncate(article.shortTitle.trim(), SHORT_TITLE_MAX);
  }
  if (article.summary && article.summary.trim()) {
    return truncate(article.summary.trim(), SHORT_TITLE_MAX);
  }
  return truncate(article.title, SHORT_TITLE_MAX);
}

/**
 * 映射 VibeTide Article 到 CMS DTO 的公共字段。
 *
 * 返回的是 CmsArticleSaveDTO 的「共用子集」—— type-specific mapper
 * 拿到此 partial 后再追加 content / articleContentDto / videoId 等。
 */
export function mapCommonFields(
  article: ArticleForMapper,
  ctx: MapperContext,
): Partial<CmsArticleSaveDTO> {
  const keyword =
    article.tags.length > 0
      ? article.tags.slice(0, KEYWORD_COUNT_MAX).join(",")
      : undefined;

  return {
    // 鉴权 & 租户
    loginId: ctx.loginId,
    loginTid: ctx.loginTid,
    tenantId: ctx.tenantId,
    username: ctx.username,
    version: "cms2",
    sourceSystem: 3,

    // 基本信息
    title: truncate(article.title, TITLE_MAX),
    listTitle: truncate(article.title, TITLE_MAX),
    shortTitle: deriveShortTitle(article),
    author: article.authorName?.trim() || ctx.author || DEFAULT_AUTHOR,
    source: ctx.source || DEFAULT_SOURCE,
    summary: article.summary ?? undefined,
    keyword,
    tags: keyword,
    tagsFlag: "1",

    // 栏目 & 站点
    catalogId: ctx.catalogId,
    siteId: ctx.siteId,
    referType: 9,  // 固定：智媒 AI 自产

    // 状态 & 时间
    status: publishStatusToCmsStatus(article.publishStatus),
    addTime: Date.now(),
    publishDate: article.publishedAt?.getTime(),

    // 封面
    logo: article.coverImageUrl ?? ctx.coverImageDefault,

    // 交互开关
    commentFlag: "1",
    commentVerifyFlag: "Y",
    showReadingCountFlag: "1",
    advertisementFlag: "1",
    barrageFlag: "0",
    allowComment: true,

    // 列表样式（type-specific mapper 可覆盖）
    listStyleDto: ctx.listStyleDefault,

    // 虚拟点击量基数
    virtualHitCount: 0,
  };
}
