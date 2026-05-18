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
    c.startsWith("opinion_excel")
  )
    return "网站";
  return "网站";
}
