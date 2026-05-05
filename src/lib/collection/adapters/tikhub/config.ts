import { z } from "zod";

export const TIKHUB_PLATFORMS = ["douyin", "weibo", "xiaohongshu", "wechat_channels", "zhihu"] as const;
export type TikhubPlatform = (typeof TIKHUB_PLATFORMS)[number];

export const TIKHUB_PLATFORM_LABELS: Record<TikhubPlatform, string> = {
  douyin: "抖音",
  weibo: "微博",
  xiaohongshu: "小红书",
  wechat_channels: "微信视频号",
  zhihu: "知乎",
};

export const TIKHUB_PLATFORM_ENDPOINTS: Record<TikhubPlatform, string> = {
  douyin: "/api/v1/douyin/app/v3/fetch_general_search_result",
  weibo: "/api/v1/weibo/web/fetch_search",
  xiaohongshu: "/api/v1/xiaohongshu/web/search_notes",
  wechat_channels: "/api/v1/wechat_channels/fetch_search_ordinary",
  zhihu: "/api/v1/zhihu/web/fetch_article_search_v3",
};

export const tikhubConfigSchema = z.object({
  platform: z.enum(TIKHUB_PLATFORMS),
  searchType: z.literal("keyword").default("keyword"),
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词").max(20, "最多 20 个关键词"),
  timeWindow: z.enum(["day", "week", "halfYear", "all"]).default("halfYear"),
  contentTypes: z.array(z.enum(["video", "image_text", "short_video", "image_set"])).optional(),
  maxPagesPerRun: z.number().int().min(1).max(10).default(5),
  resultsPerPage: z.number().int().min(10).max(50).default(20),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

export type TikhubConfig = z.infer<typeof tikhubConfigSchema>;
