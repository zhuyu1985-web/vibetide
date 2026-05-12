// ---------------------------------------------------------------------------
// Web search types — shared across providers (Tavily, Bocha, ...).
// ---------------------------------------------------------------------------

export type SourceType = "official" | "industry" | "social" | "news" | "unknown";
export type Credibility = "high" | "medium" | "low";

export type SearchEngine = "google-news" | "bing-news" | "bocha";

export interface NewsFeedItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt: string | null;
  publishedAtMs: number | null;
  engine: SearchEngine;
  sourceType: SourceType;
  credibility: Credibility;
}

export type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

export type SearchProviderId = "tavily" | "bocha";

export interface SearchOptions {
  timeRange?: WebSearchTimeRange;
  maxResults?: number;
  topic?: "general" | "news" | "finance";
  /** 白名单:限定只返回这些域名(business 策略,caller 显式指定;不传则全网) */
  includeDomains?: string[];
  /** 黑名单:排除这些域名(图片/模板/百科等通用垃圾源;caller 显式指定,通常合并 DEFAULT_EXCLUDE_DOMAINS) */
  excludeDomains?: string[];
  /** Bypass the global SEARCH_PROVIDER setting; used by collection adapters that bind to a specific engine. */
  forceProvider?: SearchProviderId;
}

export interface SearchResult {
  items: NewsFeedItem[];
  answer?: string;
  responseTime: number;
  provider: SearchProviderId;
}

export interface SearchProvider {
  id: SearchProviderId;
  search(query: string, options: SearchOptions): Promise<SearchResult>;
}

// ---------------------------------------------------------------------------
// Source classification helpers
// ---------------------------------------------------------------------------

const OFFICIAL_SOURCE_PATTERNS = [
  /新华社|人民日报|央视|央视新闻|中国新闻网|中国政府网|国务院|工信部|商务部|国家统计局|中国日报|人民网/i,
];
const INDUSTRY_SOURCE_PATTERNS = [
  /36氪|虎嗅|钛媒体|界面|财联社|财新|第一财经|TechCrunch|The Verge|Wired|Bloomberg|Reuters|华尔街见闻/i,
];
const SOCIAL_SOURCE_PATTERNS = [
  /微博|知乎|小红书|抖音|快手|B站|豆瓣|Reddit|X|Twitter|Telegram/i,
];

export function inferSourceType(source: string, url: string): SourceType {
  const text = `${source} ${url}`;
  if (OFFICIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "official";
  if (INDUSTRY_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "industry";
  if (SOCIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "social";
  if (source) return "news";
  return "unknown";
}

export function inferCredibility(sourceType: SourceType): Credibility {
  if (sourceType === "official") return "high";
  if (sourceType === "industry" || sourceType === "news") return "medium";
  return "low";
}

export function parseDate(value: string) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return { publishedAt: null as string | null, publishedAtMs: null as number | null };
  }
  return {
    publishedAt: new Date(ms).toISOString(),
    publishedAtMs: ms,
  };
}

/**
 * AI agent / 报告场景使用的"可信源白名单"。
 * 仅在 caller 明确想要"只看主流媒体"时显式传入,provider 层不再做兜底。
 * 采集模块不使用此常量,完全由源配置 includeDomains 决定。
 */
export const DEFAULT_INCLUDE_DOMAINS = [
  "xinhuanet.com", "people.com.cn", "cctv.com", "chinanews.com",
  "36kr.com", "huxiu.com", "tmtpost.com", "jiemian.com",
  "caixin.com", "yicai.com", "thepaper.cn", "sina.com.cn",
  "weibo.com", "zhihu.com", "bilibili.com", "sohu.com",
  "163.com", "qq.com", "baidu.com", "toutiao.com",
];

/**
 * 系统级垃圾源黑名单 —— 任何新闻/政策类搜索都不应返回这些站点。
 * Caller 应合并自身追加的 excludeDomains 后传给 provider。
 * 增删此列表请同步 docs (后续如果暴露运营配置 UI 再迁库表)。
 */
export const DEFAULT_EXCLUDE_DOMAINS = [
  // 图片素材站
  "588ku.com",       // 千库网
  "photophoto.cn",   // 摄图网
  "ibaotu.com",      // 包图网
  "51yuansu.com",    // 觅元素
  "58pic.com",       // 千图网
  "ooopic.com",      // 我图网
  "tukuppt.com",     // 熊猫办公
  "sc.chinaz.com",   // 站长素材
  "mizhi.com",       // 觅知网
  // 模板/文档下载站
  "book118.com",     // 原创力文档
  "doc88.com",       // 道客巴巴
  "docin.com",       // 豆丁网
  "jianli.com",      // 简历模板
  // 百科类(新闻搜索通常不要)
  "baike.baidu.com",
  "baike.sogou.com",
  "baike.so.com",
  // SEO / 学习内容农场
  "koolearn.com",    // 新东方在线
  "fanyishang.com",  // 翻译站
];
