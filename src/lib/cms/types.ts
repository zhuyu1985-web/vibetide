import { z } from "zod";

/**
 * CMS 统一响应信封。
 *
 * CMS 约定：HTTP 层一律 200；业务成功 state=200，业务失败 state 为错误码。
 */
export const CmsResponseEnvelopeSchema = z.object({
  state: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().nullable(),
});
export type CmsResponseEnvelope<T = unknown> = {
  state: number;
  success: boolean;
  message: string;
  data: T | null;
};

// ===========================================================
// getChannels（/web/catalog/getChannels）
// ===========================================================

export const CmsChannelInfoSchema = z.object({
  code: z.number(),
  pickValue: z.string().optional(),
  thirdFlag: z.string().optional(),
  name: z.string(),
});
export type CmsChannelInfo = z.infer<typeof CmsChannelInfoSchema>;

/** 返回结构是一个 map，key 为 CHANNEL_APP / CHANNEL_WEB / ... */
export const CmsChannelsDataSchema = z.record(z.string(), CmsChannelInfoSchema);
export type CmsChannelsData = z.infer<typeof CmsChannelsDataSchema>;

// ===========================================================
// getAppList（/web/application/getAppList）
// ===========================================================

export const CmsAppSchema = z.object({
  id: z.number(),
  siteid: z.number(),
  name: z.string(),
  type: z.number(),
  appkey: z.string().nullable().optional(),
  appsecret: z.string().nullable().optional(),
  addtime: z.string().nullable().optional(),
  modifytime: z.string().nullable().optional(),
  adduser: z.string().nullable().optional(),
  modifyuser: z.string().nullable().optional(),
});
export type CmsApp = z.infer<typeof CmsAppSchema>;
export const CmsAppListSchema = z.array(CmsAppSchema);

// ===========================================================
// getCatalogTree（/web/catalog/getTree）
// ===========================================================

// 递归 schema 需要用 z.lazy
type CmsCatalogNode = {
  id: number;
  appid: number;
  siteId: number;
  name: string;
  parentId: number;
  innerCode: string;
  alias: string;
  treeLevel: number;
  isLeaf: number;                // CMS 用 0/1，不是布尔
  type: number;
  childCatalog: CmsCatalogNode[];
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
  articleBrowse?: string;
  imageBrowse?: string;
  attachBrowse?: string;
  revelationBrowse?: string;
  isDirty?: number;
  isCurrentBindCatalog?: number;
  workflow?: string;
};

export const CmsCatalogNodeSchema: z.ZodType<CmsCatalogNode> = z.lazy(() =>
  z.object({
    id: z.number(),
    appid: z.number(),
    siteId: z.number(),
    name: z.string(),
    parentId: z.number(),
    innerCode: z.string(),
    alias: z.string(),
    treeLevel: z.number(),
    isLeaf: z.number(),
    type: z.number(),
    childCatalog: z.array(CmsCatalogNodeSchema).default([]),
    videoPlayer: z.string().optional(),
    audioPlayer: z.string().optional(),
    livePlayer: z.string().optional(),
    vlivePlayer: z.string().optional(),
    h5Preview: z.string().optional(),
    pcPreview: z.string().optional(),
    url: z.string().optional(),
    articleBrowse: z.string().optional(),
    imageBrowse: z.string().optional(),
    attachBrowse: z.string().optional(),
    revelationBrowse: z.string().optional(),
    isDirty: z.number().optional(),
    isCurrentBindCatalog: z.number().optional(),
    workflow: z.string().optional(),
  }),
);

export type { CmsCatalogNode };

// ===========================================================
// saveArticle（/web/article/save）
// ===========================================================

export interface CmsImageSimpleDTO {
  contentSourceId?: string;
  image: string;                 // 图片 URL
  imageName?: string;
  linkText?: string;
  linkUrl?: string;
  note?: string;                 // 图片说明
}

export interface CmsImageDto {
  imageUrl: string;
  imageName?: string;
  description?: string;
  sImageUrl?: string;
  linkText?: string;
  linkUrl?: string;
}

export interface CmsVideoDto {
  videoId: string;
}

export interface CmsAudioDto {
  audioId: string;
}

export interface CmsArticleContentDto {
  htmlContent?: string;
  imageDtoList?: CmsImageDto[];
  videoDtoList?: CmsVideoDto[];
  audioDtoList?: CmsAudioDto[];
}

export interface CmsCustomStyle {
  imgPath: string[];
  type: string;                  // "0"默认 "1"单图 "2"多图 "3"标题无图 "4"窄图 "7"无缝
}

export interface CmsMovie {
  AppCustomParams: string;       // "默认"
}

export interface CmsAppCustomParams {
  customStyle: CmsCustomStyle;
  movie: CmsMovie;
}

export interface CmsListStyleDto {
  imageUrlList: string[];
  listStyleName: string;
  listStyleType: string;
}

export interface CmsArticleSaveDTO {
  // 鉴权 & 租户
  loginId: string;
  loginTid: string;
  tenantId: string;
  username: string;
  version: string;               // "cms2"

  // 稿件类型
  type: "1" | "2" | "4" | "5" | "11";

  // 基本信息
  title: string;
  author: string;
  source?: string;
  summary?: string;
  shortTitle?: string;
  listTitle?: string;
  content?: string;              // HTML，type=1 必传
  logo?: string;                 // 引导图
  keyword?: string;
  tags?: string;
  tagsFlag?: string;

  // 栏目 & 站点
  catalogId: number;
  siteId: number;
  sourceSystem?: number;         // 3
  referType?: number;            // 9 (智媒 AI)

  // 状态 & 时间
  status?: string;               // "0"/"20"/"30"/"60"
  addTime?: number;
  publishDate?: number;

  // 富内容
  articleContentDto?: CmsArticleContentDto;
  images?: CmsImageSimpleDTO[];
  videoId?: string;
  videoType?: string;
  audioId?: string;
  audioUrl?: string;
  redirectUrl?: string;

  // 列表样式
  appCustomParams?: CmsAppCustomParams;
  listStyleDto?: CmsListStyleDto;

  // 其他
  articleId?: number;            // 修改时传
  commentFlag?: string;
  commentVerifyFlag?: string;
  showReadingCountFlag?: string;
  advertisementFlag?: string;
  barrageFlag?: string;
  allowComment?: boolean;
  virtualHitCount?: number;

  // 透传字段（避免 schema 漂移时的兜底）
  [extra: string]: unknown;
}

export const CmsArticleSaveResponseDataSchema = z.object({
  article: z.object({
    id: z.number(),
    status: z.number().optional(),
    title: z.string().optional(),
  }).passthrough(),
  url: z.string().optional(),
  preViewPath: z.string().optional(),
  method: z.string().optional(),
  transcodeStatus: z.string().optional(),
  title: z.string().optional(),
}).passthrough();
export type CmsArticleSaveResponseData = z.infer<typeof CmsArticleSaveResponseDataSchema>;

// ===========================================================
// getArticleDetail（/web/article/getMyArticleDetail）
// ===========================================================

export const CmsArticleDetailSchema = z.object({
  Id: z.number(),
  title: z.string(),
  status: z.string().optional(),    // CMS 约定：string "0"/"20"/"30"/"60"
  type: z.number().optional(),
  catalogId: z.number().optional(),
  siteId: z.number().optional(),
  publishDate: z.string().nullable().optional(),
  addTime: z.string().optional(),
  author: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  pcPreview: z.string().optional(),
  h5Preview: z.string().optional(),
}).passthrough();
export type CmsArticleDetail = z.infer<typeof CmsArticleDetailSchema>;
