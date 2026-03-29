// ---------------------------------------------------------------------------
// Shared Trending Topics API utilities
// Extracted from tool-registry.ts for reuse across the codebase (Inngest pipelines, DAL, etc.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendingResponseMapping {
  nodes?: Record<string, string>;
  authMode?: "bearer" | "raw";
}

export interface TrendingItem {
  platform: string;
  rank: number;
  title: string;
  heat: number | string;
  url: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Platform configuration
// ---------------------------------------------------------------------------

/** Platform name → TopHub node hashid mapping */
export const TOPHUB_DEFAULT_NODES: Record<string, string> = {
  微博热搜: "KqndgxeLl9",
  知乎热榜: "mproPpoq6O",
  百度热点: "Jb0vmloB1G",
  抖音热搜: "K7GdaMgdQy",
  今日头条: "x9ozB4KoXb",
  "36氪热榜": "Q1Vd5Ko85R",
  哔哩哔哩: "74KvxwokxM",
  小红书: "L4MdA5ldxD",
  澎湃热榜: "wWmoO5Rd4E",
  微信热文: "WnBe01o371",
};

export const PLATFORM_ALIASES: Record<string, string[]> = {
  微博热搜: ["weibo", "微博"],
  知乎热榜: ["zhihu", "知乎"],
  百度热点: ["baidu", "百度"],
  抖音热搜: ["douyin", "抖音"],
  今日头条: ["toutiao", "头条"],
  "36氪热榜": ["36kr", "36氪"],
  哔哩哔哩: ["bilibili", "b站", "哔哩"],
  小红书: ["xiaohongshu", "小红书", "红书"],
  澎湃热榜: ["thepaper", "澎湃"],
  微信热文: ["weixin", "wechat", "微信"],
};

/** Platform icon mapping for UI display */
export const PLATFORM_ICONS: Record<string, string> = {
  微博热搜: "📱",
  知乎热榜: "💡",
  百度热点: "🔍",
  抖音热搜: "🎵",
  今日头条: "📰",
  "36氪热榜": "📊",
  哔哩哔哩: "📺",
  小红书: "📕",
  澎湃热榜: "📰",
  微信热文: "💬",
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseTrendingMapping(): TrendingResponseMapping | null {
  const raw = process.env.TRENDING_RESPONSE_MAPPING;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrendingResponseMapping;
  } catch {
    return null;
  }
}

function buildTophubHeaders(): Record<string, string> {
  const apiKey = process.env.TRENDING_API_KEY;
  const mapping = parseTrendingMapping();
  const authMode = mapping?.authMode ?? "raw";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers["Authorization"] = authMode === "bearer" ? `Bearer ${apiKey}` : apiKey;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// TopHub API fetch functions
// ---------------------------------------------------------------------------

/** Fetch /hot — cross-platform trending aggregation (one request, all platforms) */
async function fetchTrendingHot(): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.tophubdata.com/hot", {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /hot returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        title: string;
        url: string;
        domain: string;
        sitename: string;
        views: string;
        time: string;
      }[];
    };

    if (json.error || !Array.isArray(json.data)) return [];

    return json.data.map((item, index) => ({
      platform: item.sitename || item.domain,
      rank: index + 1,
      title: item.title,
      heat: item.views || "",
      url: item.url,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch /nodes/@hashid — single platform trending list */
async function fetchTrendingNode(
  nodeId: string,
  platformName?: string
): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://api.tophubdata.com/nodes/${nodeId}`, {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /nodes/${nodeId} returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        name: string;
        items: { title: string; url: string; rank: number; extra: string; description: string }[];
      };
    };

    if (json.error || !json.data?.items) return [];

    const name = platformName || json.data.name;
    return json.data.items.map((item) => ({
      platform: name,
      rank: item.rank,
      title: item.title,
      heat: item.extra || "",
      url: item.url,
      category: item.description || undefined,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch /search — search across all trending lists */
async function fetchTrendingSearch(query: string): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://api.tophubdata.com/search?q=${encodeURIComponent(query)}&p=1`;
    const response = await fetch(url, {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /search returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        items: { title: string; url: string; extra: string; time: number }[];
      };
    };

    if (json.error || !json.data?.items) return [];

    return json.data.items.map((item, index) => ({
      platform: "全网",
      rank: index + 1,
      title: item.title,
      heat: item.extra || "",
      url: item.url,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Platform resolution
// ---------------------------------------------------------------------------

export function resolveNodeIds(platforms?: string[]): Record<string, string> {
  const mapping = parseTrendingMapping();
  const nodes = { ...TOPHUB_DEFAULT_NODES, ...(mapping?.nodes || {}) };

  if (!platforms || platforms.length === 0) return nodes;

  const result: Record<string, string> = {};
  for (const [name, hashid] of Object.entries(nodes)) {
    const aliases = PLATFORM_ALIASES[name] || [name.toLowerCase()];
    if (platforms.some((p) => aliases.some((a) => a.includes(p.toLowerCase()) || p.toLowerCase().includes(a)))) {
      result[name] = hashid;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main API entry point
// ---------------------------------------------------------------------------

export async function fetchTrendingFromApi(
  mode: "hot" | "platforms" | "search",
  options: { platforms?: string[]; limit?: number; query?: string } = {}
): Promise<TrendingItem[]> {
  if (!process.env.TRENDING_API_KEY) {
    throw new Error("TRENDING_API_KEY not configured");
  }

  if (mode === "hot") {
    return fetchTrendingHot();
  }

  if (mode === "search" && options.query) {
    return fetchTrendingSearch(options.query);
  }

  // platforms mode: fetch selected platform nodes in parallel
  const nodes = resolveNodeIds(options.platforms);
  const entries = Object.entries(nodes);

  if (entries.length === 0) {
    throw new Error(`未匹配到平台，可用平台: ${Object.keys(TOPHUB_DEFAULT_NODES).join("、")}`);
  }

  const results = await Promise.allSettled(
    entries.map(([name, hashid]) => fetchTrendingNode(hashid, name))
  );

  const allItems: TrendingItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const items = options.limit ? result.value.slice(0, options.limit) : result.value;
      allItems.push(...items);
    }
  }
  return allItems;
}

// ---------------------------------------------------------------------------
// Cross-platform topic deduplication
// ---------------------------------------------------------------------------

export function buildCrossPlatformTopics(items: TrendingItem[]): {
  title: string;
  platforms: string[];
  totalHeat: number;
  verified: boolean;
}[] {
  const topicMap = new Map<string, {
    title: string;
    platforms: Set<string>;
    totalHeat: number;
  }>();

  for (const item of items) {
    const key = normalizeTitleKey(item.title);

    const numericHeat = parseChineseNumber(item.heat);
    const existing = topicMap.get(key);
    if (existing) {
      existing.platforms.add(item.platform);
      existing.totalHeat += numericHeat;
    } else {
      topicMap.set(key, {
        title: item.title,
        platforms: new Set([item.platform]),
        totalHeat: numericHeat,
      });
    }
  }

  return Array.from(topicMap.values())
    .filter((t) => t.platforms.size >= 2)
    .sort((a, b) => b.totalHeat - a.totalHeat)
    .map((t) => ({
      title: t.title,
      platforms: Array.from(t.platforms),
      totalHeat: t.totalHeat,
      verified: false,
    }));
}

// ---------------------------------------------------------------------------
// Keyword-based pre-classification
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["要闻", ["突发", "重磅", "官宣", "最新", "速报", "紧急", "刷屏", "全网"]],
  ["国际", ["美国", "俄罗斯", "乌克兰", "日本", "韩国", "欧洲", "英国", "法国", "德国", "印度", "中东", "伊朗", "以色列", "巴勒斯坦", "朝鲜", "联合国", "北约", "G20", "峰会", "外交", "制裁", "关税", "贸易战"]],
  ["军事", ["导弹", "航母", "战斗机", "军事", "国防", "军舰", "武器", "核武", "演习", "空袭", "轰炸", "防空", "无人机", "雷达", "坦克", "潜艇", "军队", "特种兵", "霍尔木兹"]],
  ["科技", ["AI", "人工智能", "芯片", "半导体", "5G", "6G", "机器人", "大模型", "ChatGPT", "算法", "量子", "无人驾驶", "新能源车", "电动车", "特斯拉", "苹果", "华为", "小米", "OpenAI", "英伟达", "手机", "App", "互联网", "数据", "云计算", "卫星", "航天", "火箭", "SpaceX", "Cursor", "Kimi", "模型"]],
  ["财经", ["股市", "A股", "基金", "理财", "房价", "房贷", "利率", "降息", "加息", "央行", "通胀", "GDP", "经济", "金融", "证券", "IPO", "上市", "破产", "裁员", "就业", "失业", "工资", "税", "消费", "物价", "外汇", "比特币", "加密货币", "黄金", "白银"]],
  ["娱乐", ["明星", "综艺", "电影", "电视剧", "演员", "导演", "票房", "颁奖", "音乐", "歌手", "演唱会", "偶像", "选秀", "八卦", "恋情", "结婚", "离婚", "出轨", "塌房", "粉丝", "热搜", "直播", "网红", "游戏", "动漫", "二次元"]],
  ["社会", ["事故", "救援", "地震", "洪水", "台风", "暴雨", "火灾", "犯罪", "诈骗", "维权", "投诉", "交通", "高铁", "航班", "快递", "外卖", "物业", "养老", "退休", "社保", "医保", "城管", "拆迁", "环保", "食品安全", "315", "打假", "拐卖", "失踪"]],
  ["体育", ["奥运", "世界杯", "欧冠", "NBA", "CBA", "足球", "篮球", "网球", "乒乓", "羽毛球", "游泳", "田径", "马拉松", "冠军", "金牌", "决赛", "转会", "教练", "球员", "赛事", "中超", "英超", "西甲", "斯诺克"]],
  ["时政", ["政策", "两会", "改革", "条例", "法规", "规划", "主席", "总理", "部长", "省长", "市长", "纪委", "反腐", "巡视", "选举", "投票", "人大", "政协", "立法"]],
  ["健康", ["疫情", "病毒", "疫苗", "感染", "医院", "医生", "手术", "癌症", "抑郁", "失眠", "猝死", "过劳", "食疗", "养生", "体检", "药品", "中医", "西医", "门诊", "急诊", "120", "心理健康", "焦虑", "闭经"]],
  ["教育", ["高考", "中考", "考研", "考公", "学校", "大学", "老师", "学生", "家长", "补课", "培训", "教材", "招生", "录取", "分数线", "论文", "学区房", "减负", "双减", "留学", "奖学金", "毕业"]],
];

/**
 * Pre-classify a topic title by keyword matching.
 * Returns the first matched category or undefined.
 */
export function classifyByKeywords(title: string): string | undefined {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => title.includes(kw))) {
      return category;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Heat score normalization
// ---------------------------------------------------------------------------

/**
 * Parse Chinese numeric strings: "1.2万" → 12000, "523万" → 5230000, "3.5亿" → 350000000
 */
export function parseChineseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const trimmed = value.replace(/[,\s]/g, "");
  if (!trimmed) return 0;

  const wanMatch = trimmed.match(/^([\d.]+)\s*万$/);
  if (wanMatch) return parseFloat(wanMatch[1]) * 10000;

  const yiMatch = trimmed.match(/^([\d.]+)\s*亿$/);
  if (yiMatch) return parseFloat(yiMatch[1]) * 100000000;

  const num = parseFloat(trimmed);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Normalize raw heat value to 0-100 scale.
 * Uses logarithmic mapping + cross-platform boost.
 */
export function normalizeHeatScore(heat: string | number, platformCount = 1): number {
  const numeric = parseChineseNumber(heat);
  const logScore = Math.round(Math.log10(Math.max(1, numeric)) * 15);
  const platformBoost = Math.max(0, (platformCount - 1) * 5);
  return Math.min(100, logScore + platformBoost);
}

/**
 * Normalize a title for dedup key: strip punctuation, lowercase, take first 20 chars
 */
export function normalizeTitleKey(title: string): string {
  return title
    .replace(/[#【】\[\]《》「」\s]/g, "")
    .toLowerCase()
    .slice(0, 20);
}
