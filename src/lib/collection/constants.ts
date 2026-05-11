export const OUTLET_TIER_VALUES = [
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
  "government_self_media",
] as const;
export type OutletTier = (typeof OUTLET_TIER_VALUES)[number];

export const OUTLET_TIER_LABELS: Record<OutletTier, string> = {
  central: "央级媒体",
  provincial_municipal: "省/市级媒体",
  industry: "行业媒体",
  district_media: "区县融媒",
  government_self_media: "政务新媒体",
};

export const CONTENT_TYPE_VALUES = [
  "image_text",
  "video",
  "short_video",
  "image_set",
  "audio",
  "live",
] as const;
export type ContentType = (typeof CONTENT_TYPE_VALUES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  image_text: "图文",
  video: "视频",
  short_video: "短视频",
  image_set: "图集",
  audio: "音频",
  live: "直播",
};

/** Source-type chip color palette — consistent across /data-collection/sources 和 /采集池 */
export const SOURCE_TYPE_COLOR: Record<string, string> = {
  tophub: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
  tavily: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  bocha: "bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400",
  jina_url: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  list_scraper: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  rss: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  tikhub: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400",
};
