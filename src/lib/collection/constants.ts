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
