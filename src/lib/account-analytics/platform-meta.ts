/**
 * 各社交媒体平台的元信息 —— icon / label / 品牌色。
 * 账号分析模块的 landing 卡片 + cover 头像 + chip 过滤共用。
 */

export type Platform =
  | "douyin"
  | "kuaishou"
  | "weibo"
  | "wechat"
  | "xiaohongshu"
  | "bilibili"
  | "wechat_oa"
  | "wechat_channels"
  | "zhihu"
  | "app"
  | "website"
  | "tv"
  | "radio"
  | "other";

export interface PlatformMeta {
  label: string;
  /** 品牌色（用于头像/badge 背景，文字白色） */
  color: string;
  /** 头像/badge 上的短简称（中文 1-2 字最佳） */
  short: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  douyin: { label: "抖音", color: "#000000", short: "抖" },
  kuaishou: { label: "快手", color: "#FF8C00", short: "快" },
  weibo: { label: "微博", color: "#E6162D", short: "微博" },
  wechat: { label: "微信", color: "#07C160", short: "微" },
  wechat_oa: { label: "微信公众号", color: "#07C160", short: "公" },
  wechat_channels: { label: "视频号", color: "#07C160", short: "视" },
  xiaohongshu: { label: "小红书", color: "#FF2741", short: "红" },
  bilibili: { label: "B站", color: "#FB7299", short: "B" },
  zhihu: { label: "知乎", color: "#0066FF", short: "知" },
  app: { label: "APP", color: "#5BA4D8", short: "APP" },
  website: { label: "官网", color: "#6B7280", short: "网" },
  tv: { label: "电视", color: "#1F3864", short: "TV" },
  radio: { label: "广播", color: "#8B5CF6", short: "FM" },
  other: { label: "其他", color: "#94A3B8", short: "其" },
};

export function getPlatformMeta(platform: string): PlatformMeta {
  return PLATFORM_META[platform as Platform] ?? PLATFORM_META.other;
}

/** 把 enabled accounts 按平台分组 + 计数（首页 chip 过滤 + 计数用） */
export function groupAccountsByPlatform<T extends { platform: string }>(
  accounts: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const a of accounts) {
    const key = a.platform;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return map;
}

// ─── 指标可用性矩阵（Spec §6.1）─────────────────────────────────────
// 表示"当前 tikhub 采集器 + account_daily_snapshots 实际能拿到的字段"，
// 而非平台理论上是否有该指标。Audit 见附录 A（数据信号薄弱，保留经验默认值）。
export const METRIC_KEYS = ['likes', 'comments', 'shares', 'favorites', 'views', 'compositeScore'] as const
export type MetricKey = typeof METRIC_KEYS[number]

export const METRIC_LABELS: Record<MetricKey, string> = {
  likes: '点赞数',
  comments: '评论数',
  shares: '转发数',
  favorites: '收藏数',
  views: '播放/阅读数',
  compositeScore: '综合得分',
}

export type PlatformMetricMatrix = Record<MetricKey, boolean>

export const PLATFORM_METRIC_MATRIX: Partial<Record<Platform, PlatformMetricMatrix>> = {
  douyin:      { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  kuaishou:    { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  bilibili:    { likes: true,  comments: true,  shares: true,  favorites: true,  views: true,  compositeScore: true },
  weibo:       { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
  wechat:      { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  wechat_oa:   { likes: true,  comments: true,  shares: false, favorites: false, views: true,  compositeScore: true },
  wechat_channels: { likes: true, comments: true, shares: false, favorites: false, views: true, compositeScore: true },
  xiaohongshu: { likes: true,  comments: true,  shares: true,  favorites: true,  views: false, compositeScore: true },
}

export const FALLBACK_METRIC_AVAILABILITY: PlatformMetricMatrix = {
  likes: true, comments: true, shares: true, favorites: true, views: true, compositeScore: true,
}

export function getMetricAvailability(platform: string): PlatformMetricMatrix {
  return PLATFORM_METRIC_MATRIX[platform as Platform] ?? FALLBACK_METRIC_AVAILABILITY
}

// ─── 数字带 6 列按平台映射（Spec §6.2）─────────────────────────────
export const SUMMARY_KEYS = [
  'publishCount', 'totalLikes', 'totalComments', 'totalShares', 'totalFavorites', 'totalViews',
  'maxLikes', 'avgLikes', 'maxViews', 'avgViews',
] as const
export type SummaryKey = typeof SUMMARY_KEYS[number]

export const SUMMARY_LABELS: Record<SummaryKey, string> = {
  publishCount: '发布数',
  totalLikes: '总点赞',
  totalComments: '总评论',
  totalShares: '总转发',
  totalFavorites: '总收藏',
  totalViews: '总播放',
  maxLikes: '最高点赞',
  avgLikes: '平均点赞',
  maxViews: '最高播放',
  avgViews: '平均播放',
}

export const PLATFORM_SUMMARY_CARDS: Partial<Record<Platform, SummaryKey[]>> = {
  douyin:      ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalShares'],
  kuaishou:    ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  bilibili:    ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalFavorites', 'totalShares'],
  weibo:       ['publishCount', 'totalLikes',     'maxLikes',       'avgLikes',  'totalComments',  'totalShares'],
  wechat:      ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  wechat_oa:   ['publishCount', 'totalViews',     'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  wechat_channels: ['publishCount', 'totalViews', 'maxViews',       'avgViews',  'totalLikes',     'totalComments'],
  xiaohongshu: ['publishCount', 'totalLikes',     'totalFavorites', 'avgLikes',  'totalComments',  'totalShares'],
}

export const FALLBACK_SUMMARY_CARDS: SummaryKey[] =
  ['publishCount', 'totalViews', 'maxViews', 'avgViews', 'totalLikes', 'totalComments']

export function getSummaryCards(platform: string): SummaryKey[] {
  return PLATFORM_SUMMARY_CARDS[platform as Platform] ?? FALLBACK_SUMMARY_CARDS
}

// ─── 粒度 → 窗口长度（Spec §7.4）───────────────────────────────────
export const GRANULARITY_WINDOW_DAYS = { day: 7, week: 84, month: 180 } as const
export type Granularity = keyof typeof GRANULARITY_WINDOW_DAYS
export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: '按日', week: '按周', month: '按月',
}
