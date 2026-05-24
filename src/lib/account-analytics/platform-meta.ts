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
