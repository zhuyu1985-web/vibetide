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

/**
 * 把 collected_items.firstSeenChannel / sourceChannels[*].channel 这种内部 slug
 * 翻译成用户可读的中文渠道名。
 *
 * 数据来源（见 src/lib/collection/adapters/*）：
 * - tikhub_weibo / tikhub_weibo_account → 微博
 * - tikhub_douyin / tikhub_douyin_account → 抖音
 * - tikhub_wechat_mp / tikhub_wechat_mp_account → 微信公众号
 * - tikhub_wechat_channels → 视频号
 * - tikhub_xiaohongshu → 小红书
 * - tikhub_kuaishou_account → 快手
 * - tikhub_zhihu → 知乎
 * - tophub/<platform> → 热榜·<平台>
 * - rss/<host> → 网站(RSS)
 * - jina/<host> → 网站
 * - list/<host> → 网站(列表)
 * - bocha / tavily → 搜索
 * - excel_import → Excel 导入
 */
const TOPHUB_PLATFORM_LABELS: Record<string, string> = {
  weibo: "微博",
  zhihu: "知乎",
  weixin: "微信",
  douyin: "抖音",
  toutiao: "头条",
  bilibili: "B站",
  xiaohongshu: "小红书",
  baidu: "百度",
};

const CHANNEL_EXACT_LABELS: Record<string, string> = {
  tikhub_weibo: "微博",
  tikhub_weibo_account: "微博",
  tikhub_douyin: "抖音",
  tikhub_douyin_account: "抖音",
  tikhub_wechat_mp: "微信公众号",
  tikhub_wechat_mp_account: "微信公众号",
  tikhub_wechat_channels: "视频号",
  tikhub_xiaohongshu: "小红书",
  tikhub_kuaishou_account: "快手",
  tikhub_zhihu: "知乎",
  bocha: "博查搜索",
  tavily: "Tavily 搜索",
  excel_import: "Excel 导入",
};

/**
 * 渠道筛选用的可读 label 列表 — 与 formatChannelLabel 的产出对齐,
 * 用作 /research 等检索页的下拉选项 + DAL 的 channelLabels 过滤参数。
 */
export const CHANNEL_FILTER_LABELS = [
  "微博",
  "抖音",
  "微信公众号",
  "视频号",
  "小红书",
  "知乎",
  "快手",
  "网站",
  "热榜",
  "搜索",
] as const;

export type ChannelFilterLabel = (typeof CHANNEL_FILTER_LABELS)[number];

interface ChannelMatcher {
  exact: string[];
  prefix: string[];
}

/**
 * 每个渠道 label → 数据库中 firstSeenChannel/sourceChannels[*].channel
 * 实际可能出现的 slug。exact 是完整等于,prefix 用 ILIKE 'pfx%' 匹配。
 */
const CHANNEL_MATCHERS: Record<ChannelFilterLabel, ChannelMatcher> = {
  微博: {
    exact: ["tikhub_weibo", "tikhub_weibo_account"],
    prefix: ["tophub/微博", "tophub/weibo"],
  },
  抖音: {
    exact: ["tikhub_douyin", "tikhub_douyin_account"],
    prefix: ["tophub/抖音", "tophub/douyin"],
  },
  微信公众号: {
    exact: ["tikhub_wechat_mp", "tikhub_wechat_mp_account"],
    prefix: ["tophub/微信", "tophub/weixin"],
  },
  视频号: { exact: ["tikhub_wechat_channels"], prefix: [] },
  小红书: {
    exact: ["tikhub_xiaohongshu"],
    prefix: ["tophub/小红书", "tophub/xiaohongshu"],
  },
  知乎: {
    exact: ["tikhub_zhihu"],
    prefix: ["tophub/知乎", "tophub/zhihu"],
  },
  快手: { exact: ["tikhub_kuaishou_account"], prefix: [] },
  网站: { exact: [], prefix: ["rss/", "jina/", "list/"] },
  热榜: { exact: [], prefix: ["tophub/"] },
  搜索: { exact: ["bocha", "tavily"], prefix: [] },
};

/** 把一组 label 合并成 exact + prefix 两个去重集合,供 DAL SQL 拼接使用。 */
export function getChannelMatchers(labels: readonly string[]): ChannelMatcher {
  const exact = new Set<string>();
  const prefix = new Set<string>();
  for (const l of labels) {
    const m = CHANNEL_MATCHERS[l as ChannelFilterLabel];
    if (!m) continue;
    m.exact.forEach((e) => exact.add(e));
    m.prefix.forEach((p) => prefix.add(p));
  }
  return { exact: Array.from(exact), prefix: Array.from(prefix) };
}

export function formatChannelLabel(channel: string | null | undefined): string {
  if (!channel) return "—";
  if (channel in CHANNEL_EXACT_LABELS) return CHANNEL_EXACT_LABELS[channel];

  if (channel.includes("/")) {
    const [prefix, value = ""] = channel.split("/", 2);
    switch (prefix) {
      case "tophub":
        return `热榜·${TOPHUB_PLATFORM_LABELS[value] ?? value}`;
      case "rss":
        return "网站(RSS)";
      case "jina":
        return "网站";
      case "list":
        return "网站(列表)";
      default:
        return prefix;
    }
  }
  return channel;
}
