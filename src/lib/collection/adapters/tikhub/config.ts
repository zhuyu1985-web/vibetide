import { z } from "zod";

// ─── Keyword 模式平台 (历史 5 平台,关键词搜索) ──────────────────────
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

// ─── Account 模式平台 (M3, 4 平台,按账号 ID 拉用户 feed) ────────────
// 与 Channel.type 对齐:douyin / weibo / kuaishou / wechat_oa
export const TIKHUB_ACCOUNT_PLATFORMS = [
  "douyin",
  "weibo",
  "kuaishou",
  "wechat_oa",
] as const;
export type TikhubAccountPlatform = (typeof TIKHUB_ACCOUNT_PLATFORMS)[number];

export const TIKHUB_ACCOUNT_PLATFORM_LABELS: Record<TikhubAccountPlatform, string> = {
  douyin: "抖音",
  weibo: "微博",
  kuaishou: "快手",
  wechat_oa: "微信公众号",
};

/** Account 模式各平台 endpoint(已通过 explore-tikhub-endpoints.ts 实测验证):
 *  - douyin: /web/fetch_user_post_videos → data.aweme_list[]
 *  - weibo: /web_v2/fetch_user_posts → data.data.list[]  (/web/ 路径需登录态返回 ok=-100)
 *  - kuaishou: 待实测确认精确路径
 *  - wechat_oa: /web/fetch_mp_article_list → 待实测真实响应
 */
export const TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS: Record<TikhubAccountPlatform, string> = {
  douyin: "/api/v1/douyin/web/fetch_user_post_videos",
  weibo: "/api/v1/weibo/web_v2/fetch_user_posts",
  kuaishou: "/api/v1/kuaishou/web/fetch_user_feed",
  wechat_oa: "/api/v1/wechat_mp/web/fetch_mp_article_list",
};

// ─── Config schema ─────────────────────────────────────────────────
// 用 discriminatedUnion 在 mode 上分支,zod 校验时自动按 mode 切到对应字段集。

const keywordConfigSchema = z.object({
  mode: z.literal("keyword").default("keyword"),
  platform: z.enum(TIKHUB_PLATFORMS),
  searchType: z.literal("keyword").default("keyword"),
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词").max(20, "最多 20 个关键词"),
  timeWindow: z.enum(["day", "week", "halfYear", "all"]).default("halfYear"),
  contentTypes: z.array(z.enum(["video", "image_text", "short_video", "image_set"])).optional(),
  maxPagesPerRun: z.number().int().min(1).max(10).default(5),
  resultsPerPage: z.number().int().min(10).max(50).default(20),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

const accountConfigSchema = z.object({
  mode: z.literal("account"),
  /** 引用 media_outlet_dictionary.id — 该 outlet 必须存在且包含 channels[type=accountPlatform] */
  outletId: z.string().uuid("outletId 必须是 UUID"),
  accountPlatform: z.enum(TIKHUB_ACCOUNT_PLATFORMS),
  maxPagesPerRun: z.number().int().min(1).max(10).default(3),
  resultsPerPage: z.number().int().min(10).max(50).default(20),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

export const tikhubConfigSchema = z.discriminatedUnion("mode", [
  keywordConfigSchema,
  accountConfigSchema,
]);

export type TikhubConfig = z.infer<typeof tikhubConfigSchema>;
export type TikhubKeywordConfig = z.infer<typeof keywordConfigSchema>;
export type TikhubAccountConfig = z.infer<typeof accountConfigSchema>;

// ─── 兼容旧 config(无 mode 字段)的预处理 ─────────────────────────────
// 历史 sources 已经存在,DB 里的 config 没有 mode 字段。在 read 路径加个 default:
//   { mode: undefined, platform: ..., keywords: [...] }  →  { mode: "keyword", ... }
// adapter execute 入口加一层 normalizeLegacyConfig 调用即可。
export function normalizeLegacyTikhubConfig(raw: unknown): TikhubConfig {
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    if (!r.mode) {
      return tikhubConfigSchema.parse({ ...r, mode: "keyword" });
    }
  }
  return tikhubConfigSchema.parse(raw);
}
