export const WEBSITE_PLATFORM = "网站";

const PLATFORM_RULES: Array<{ label: string; patterns: string[] }> = [
  { label: "微博", patterns: ["微博", "weibo.com", "m.weibo.cn", "weibo.cn"] },
  { label: "抖音", patterns: ["抖音", "douyin.com", "iesdouyin.com"] },
  { label: "小红书", patterns: ["小红书", "xiaohongshu.com", "xhslink.com"] },
  { label: "知乎", patterns: ["知乎", "zhihu.com"] },
  { label: "快手", patterns: ["快手", "kuaishou.com", "gifshow.com"] },
  { label: "视频号", patterns: ["微信视频号", "视频号", "channels.weixin.qq.com"] },
  { label: "微信", patterns: ["微信公众号", "微信公众", "微信", "mp.weixin.qq.com"] },
  { label: "今日头条", patterns: ["今日头条", "toutiao.com"] },
  { label: "百家号", patterns: ["百家号", "baijiahao.baidu.com"] },
  { label: "网易号", patterns: ["网易号"] },
  { label: "搜狐号", patterns: ["搜狐号"] },
  { label: "人民号", patterns: ["人民号"] },
  { label: "澎湃号", patterns: ["澎湃号"] },
  { label: "大风号", patterns: ["大风号"] },
  { label: "好看视频", patterns: ["好看视频"] },
  { label: "B站", patterns: ["B站", "哔哩哔哩", "bilibili.com"] },
];

export function normalizeCollectionPlatform(
  platform: string | null | undefined,
  url?: string | null,
): string | undefined {
  const rawPlatform = platform?.trim();
  const rawUrl = url?.trim();
  if (!rawPlatform && !rawUrl) return undefined;

  const haystack = `${rawPlatform ?? ""} ${rawUrl ?? ""}`.toLowerCase();
  for (const rule of PLATFORM_RULES) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern.toLowerCase()))) {
      return rule.label;
    }
  }

  return rawPlatform ? WEBSITE_PLATFORM : undefined;
}

export function shouldPreserveOriginalPlatform(
  originalPlatform: string | null | undefined,
  normalizedPlatform: string | null | undefined,
): boolean {
  const original = originalPlatform?.trim();
  if (!original || !normalizedPlatform) return false;
  return original !== normalizedPlatform;
}
