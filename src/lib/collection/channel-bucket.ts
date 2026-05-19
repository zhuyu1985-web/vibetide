/**
 * 把 collected_items.firstSeenChannel 简化为信息来源 chip 桶名。
 * 跟 content-client.tsx 的 simpleChannelLabel 保持一致,但抽出来给 server page 也能用。
 *
 * 桶名直接用作中文 chip label;返回 null 表示没法归类(理论上不会发生)。
 */
export type ChannelBucket =
  | "微博"
  | "抖音"
  | "微信"
  | "视频号"
  | "小红书"
  | "知乎"
  | "快手"
  | "网站"
  | "热榜"
  | "搜索";

export const CHANNEL_BUCKET_ORDER: ChannelBucket[] = [
  "微博",
  "抖音",
  "微信",
  "视频号",
  "小红书",
  "知乎",
  "快手",
  "网站",
  "热榜",
  "搜索",
];

/** 每个 bucket 对应的 URL filter slug(对接现有 platformAlias firstSeenChannel ILIKE '%/X' 语义)。 */
export const CHANNEL_BUCKET_SLUG: Record<ChannelBucket, string> = {
  微博: "weibo",
  抖音: "douyin",
  微信: "wechat",
  视频号: "wechat_channels",
  小红书: "xiaohongshu",
  知乎: "zhihu",
  快手: "kuaishou",
  网站: "site",
  热榜: "tophub",
  搜索: "search",
};

const CHANNEL_BUCKET_LABEL_TO_SLUG: Record<string, string> = {
  微博: "weibo",
  抖音: "douyin",
  微信: "wechat",
  微信公众号: "wechat",
  视频号: "wechat_channels",
  小红书: "xiaohongshu",
  知乎: "zhihu",
  快手: "kuaishou",
  网站: "site",
  热榜: "tophub",
  搜索: "search",
};

export interface ChannelBucketMatcher {
  exact: string[];
  prefix: string[];
}

export const CHANNEL_BUCKET_MATCHERS: Record<string, ChannelBucketMatcher> = {
  weibo: {
    exact: ["weibo", "tikhub_weibo", "tikhub_weibo_account"],
    prefix: ["tophub/微博", "tophub/weibo"],
  },
  douyin: {
    exact: ["douyin", "tikhub_douyin", "tikhub_douyin_account"],
    prefix: ["tophub/抖音", "tophub/douyin"],
  },
  wechat: {
    exact: ["wechat", "weixin", "wechat_mp", "wechat_oa", "tikhub_wechat_mp", "tikhub_wechat_mp_account"],
    prefix: ["tophub/微信", "tophub/weixin"],
  },
  wechat_channels: {
    exact: ["wechat_channels", "tikhub_wechat_channels"],
    prefix: [],
  },
  xiaohongshu: {
    exact: ["xiaohongshu", "xhs", "tikhub_xiaohongshu"],
    prefix: ["tophub/小红书", "tophub/xiaohongshu"],
  },
  zhihu: {
    exact: ["zhihu", "tikhub_zhihu"],
    prefix: ["tophub/知乎", "tophub/zhihu"],
  },
  kuaishou: {
    exact: ["kuaishou", "tikhub_kuaishou_account"],
    prefix: [],
  },
  site: {
    exact: ["excel_import", "json_import", "site", "website", "rss", "jina", "list", "opinion_excel"],
    prefix: ["rss/", "jina/", "list/", "site/", "website/", "opinion_excel", "json_import/"],
  },
  tophub: {
    exact: ["tophub"],
    prefix: ["tophub/"],
  },
  search: {
    exact: ["bocha", "tavily"],
    prefix: ["search/", "bocha/", "tavily/"],
  },
};

export function normalizeChannelBucketSlug(value: string): string {
  const trimmed = value.trim();
  return CHANNEL_BUCKET_MATCHERS[trimmed]
    ? trimmed
    : CHANNEL_BUCKET_LABEL_TO_SLUG[trimmed] ?? trimmed;
}

export function getChannelBucketMatcher(slug: string): ChannelBucketMatcher | null {
  return CHANNEL_BUCKET_MATCHERS[normalizeChannelBucketSlug(slug)] ?? null;
}

export function simpleChannelBucket(channel: string | undefined | null): ChannelBucket | null {
  if (!channel) return null;
  const c = channel.toLowerCase();
  if (c.includes("weibo") || c.includes("微博")) return "微博";
  if (c.includes("douyin") || c.includes("抖音")) return "抖音";
  if (c.includes("xiaohongshu") || c.includes("小红书")) return "小红书";
  if (c.includes("zhihu") || c.includes("知乎")) return "知乎";
  if (c.includes("kuaishou") || c.includes("快手")) return "快手";
  if (c.includes("wechat_channels") || c.includes("视频号")) return "视频号";
  if (c.includes("wechat") || c.includes("weixin") || c.includes("微信")) return "微信";
  if (c.startsWith("tophub")) return "热榜";
  if (c === "tavily" || c === "bocha" || c.includes("search")) return "搜索";
  if (
    c.startsWith("rss") ||
    c.startsWith("jina") ||
    c.startsWith("list") ||
    c.startsWith("site") ||
    c.startsWith("json_import") ||
    c.startsWith("opinion_excel")
  )
    return "网站";
  return "网站";
}
