import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchTrendingFromApi } from "@/lib/trending-api";

// Aliases understood by trending-api's resolveNodeIds()
const TOPHUB_PLATFORM_ALIASES = [
  "weibo",
  "zhihu",
  "baidu",
  "douyin",
  "toutiao",
  "36kr",
  "bilibili",
  "xiaohongshu",
  "thepaper",
  "weixin",
] as const;

const configSchema = z.object({
  platforms: z
    .array(z.enum(TOPHUB_PLATFORM_ALIASES))
    .min(1, "必须至少选择一个平台"),
});

type TophubConfig = z.infer<typeof configSchema>;

export const tophubAdapter: SourceAdapter<TophubConfig> = {
  type: "tophub",
  displayName: "聚合榜单 (TopHub)",
  description: "抓取 TopHub 聚合的各大平台热榜(微博/抖音/小红书/B站/知乎等)",
  category: "aggregator",
  configSchema,
  configFields: [
    {
      key: "platforms",
      label: "平台",
      type: "multiselect",
      required: true,
      help: "选择要抓取的平台热榜",
      options: TOPHUB_PLATFORM_ALIASES.map((p) => ({ value: p, label: platformLabel(p) })),
    },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    try {
      const results = await fetchTrendingFromApi("platforms", {
        platforms: [...config.platforms],
      });
      for (const entry of results) {
        items.push({
          title: entry.title,
          url: entry.url || undefined,
          channel: `tophub/${entry.platform}`, // platform is Chinese canonical name
          rawMetadata: {
            rank: entry.rank,
            heat: entry.heat,
            category: entry.category,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { platforms: config.platforms } });
      log("error", `tophub fetch failed: ${message}`, { platforms: config.platforms });
    }

    return { items, partialFailures };
  },
};

function platformLabel(p: (typeof TOPHUB_PLATFORM_ALIASES)[number]): string {
  const labels: Record<string, string> = {
    weibo: "微博热搜",
    zhihu: "知乎热榜",
    baidu: "百度热搜",
    douyin: "抖音热点",
    toutiao: "今日头条",
    "36kr": "36氪热榜",
    bilibili: "哔哩哔哩",
    xiaohongshu: "小红书",
    thepaper: "澎湃热榜",
    weixin: "微信热文",
  };
  return labels[p] ?? p;
}
