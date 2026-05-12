import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { searchWeb } from "@/lib/search";
import { DEFAULT_EXCLUDE_DOMAINS } from "@/lib/search/types";

const configSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词"),
  timeRange: z.enum(["1h", "24h", "7d", "30d", "all"]).default("7d"),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(20).default(20),
});

type TavilyConfig = z.infer<typeof configSchema>;

export const tavilyAdapter: SourceAdapter<TavilyConfig> = {
  type: "tavily",
  displayName: "关键词搜索 (Tavily)",
  description: "通过 Tavily 搜索全网新闻,支持时间窗和站点过滤",
  category: "search",
  configSchema,
  configFields: [
    { key: "keywords", label: "关键词", type: "multiselect", required: true, help: "一个或多个搜索关键词" },
    {
      key: "timeRange",
      label: "时间窗",
      type: "select",
      options: [
        { value: "1h", label: "1 小时内" },
        { value: "24h", label: "24 小时内" },
        { value: "7d", label: "7 天内" },
        { value: "30d", label: "30 天内" },
        { value: "all", label: "不限" },
      ],
    },
    { key: "includeDomains", label: "限定站点(可选)", type: "multiselect", help: "如 xinhuanet.com,只抓这些站点;留空=全网" },
    { key: "excludeDomains", label: "屏蔽站点(可选)", type: "multiselect", help: "追加屏蔽的站点;系统已默认屏蔽图片素材/模板/百科等垃圾源" },
    { key: "maxResults", label: "每关键词最大条数", type: "number", validation: { min: 1, max: 20 } },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];
    const mergedExclude = [...(config.excludeDomains ?? []), ...DEFAULT_EXCLUDE_DOMAINS];

    for (const keyword of config.keywords) {
      try {
        const response = await searchWeb(keyword, {
          forceProvider: "tavily",
          timeRange: config.timeRange,
          includeDomains: config.includeDomains ?? [],
          excludeDomains: mergedExclude,
          maxResults: config.maxResults,
        });
        for (const r of response.items) {
          items.push({
            title: r.title,
            url: r.url,
            summary: r.snippet,
            publishedAt: r.publishedAtMs ? new Date(r.publishedAtMs) : undefined,
            channel: "tavily",
            rawMetadata: {
              keyword,
              source: r.source,
              sourceType: r.sourceType,
              credibility: r.credibility,
              engine: r.engine,
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        partialFailures.push({ message, meta: { keyword } });
        log("error", `Tavily search failed for "${keyword}": ${message}`, { keyword });
      }
    }

    return { items, partialFailures };
  },
};
