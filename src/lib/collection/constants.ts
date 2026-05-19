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

/**
 * 平台 chip 调色板 — 按品牌主色匹配,易区分。
 * 实际值用 fuzzy 匹配(getPlatformChipClass),"网易号/手机网易/网易新闻" 等都映射到"网易"系。
 */
const PLATFORM_FAMILY_COLORS = {
  // 红色系
  toutiao: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  netease: "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
  sohu: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
  xiaohongshu: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400",
  weibo: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  // 蓝色系
  baidu: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  sina: "bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400",
  tencent: "bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400",
  zhihu: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  // 绿色系
  wechat: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  wechatChannels: "bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400",
  douyin: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
  kuaishou: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  // 紫色系/官方/其他
  pengpai: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400",
  official: "bg-fuchsia-100 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-400",
  // fallback
  default: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
} as const;

/**
 * 根据平台名称返回 chip class。fuzzy 匹配:同一品牌族共用一种色调,便于视觉聚合。
 * 找不到匹配时返回 default 灰。
 */
export function getPlatformChipClass(platform: string | null | undefined): string {
  if (!platform) return PLATFORM_FAMILY_COLORS.default;
  const p = platform;
  if (p.includes("微信")) {
    if (p.includes("视频号")) return PLATFORM_FAMILY_COLORS.wechatChannels;
    return PLATFORM_FAMILY_COLORS.wechat;
  }
  if (p.includes("视频号")) return PLATFORM_FAMILY_COLORS.wechatChannels;
  if (p.includes("微博")) return PLATFORM_FAMILY_COLORS.weibo;
  if (p.includes("抖音")) return PLATFORM_FAMILY_COLORS.douyin;
  if (p.includes("小红书")) return PLATFORM_FAMILY_COLORS.xiaohongshu;
  if (p.includes("知乎")) return PLATFORM_FAMILY_COLORS.zhihu;
  if (p.includes("快手") || p.includes("快资讯")) return PLATFORM_FAMILY_COLORS.kuaishou;
  if (p.includes("今日头条") || p.includes("头条")) return PLATFORM_FAMILY_COLORS.toutiao;
  if (p.includes("百家号") || p.includes("好看视频")) return PLATFORM_FAMILY_COLORS.baidu;
  if (p.includes("新浪")) return PLATFORM_FAMILY_COLORS.sina;
  if (p.includes("腾讯")) return PLATFORM_FAMILY_COLORS.tencent;
  if (p.includes("网易")) return PLATFORM_FAMILY_COLORS.netease;
  if (p.includes("搜狐")) return PLATFORM_FAMILY_COLORS.sohu;
  if (p.includes("澎湃")) return PLATFORM_FAMILY_COLORS.pengpai;
  if (
    p.includes("人民") ||
    p.includes("新华") ||
    p.includes("央视") ||
    p.includes("学习强国") ||
    p.includes("中国新闻网")
  ) return PLATFORM_FAMILY_COLORS.official;
  return PLATFORM_FAMILY_COLORS.default;
}

/** Source-type chip color palette — consistent across /data-collection/sources 和 /内容池 */
export const SOURCE_TYPE_COLOR: Record<string, string> = {
  tophub: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
  tavily: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  bocha: "bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400",
  jina_url: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  list_scraper: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  rss: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  tikhub: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400",
  excel_import: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  json_import: "bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400",
  site_scraper: "bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400",
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
 * - json_import/<file> → JSON 导入
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
  json_import: "JSON 导入",
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
  网站: { exact: ["excel_import", "json_import"], prefix: ["rss/", "jina/", "list/", "json_import/"] },
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
      case "json_import":
        return "JSON 导入";
      default:
        return prefix;
    }
  }
  return channel;
}
