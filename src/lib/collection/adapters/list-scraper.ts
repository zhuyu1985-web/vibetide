import { z } from "zod";
import * as cheerio from "cheerio";
import type { SourceAdapter, RawItem } from "../types";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const selectorsSchema = z.object({
  items: z.string().min(1),
  title: z.string().min(1),
  link: z.string().min(1),
  date: z.string().optional(),
  summary: z.string().optional(),
});

const configSchema = z
  .object({
    listUrl: z.string().url("请填写合法的列表页 URL"),
    extractMode: z.enum(["regex", "css"]),
    articleUrlPattern: z.string().optional(),
    selectors: selectorsSchema.optional(),
    maxArticlesPerRun: z.number().int().min(1).max(100).default(10),
    fetchFullContent: z.boolean().default(false),
  })
  .refine(
    (v) => v.extractMode === "regex" ? Boolean(v.articleUrlPattern) : Boolean(v.selectors),
    { message: "regex 模式需填 articleUrlPattern;css 模式需填 selectors" },
  );

type ListScraperConfig = z.infer<typeof configSchema>;

export const listScraperAdapter: SourceAdapter<ListScraperConfig> = {
  type: "list_scraper",
  displayName: "列表抓取 (正则或 CSS 选择器)",
  description: "从新闻列表页抓文章链接: regex 模式用 Jina Markdown+正则,css 模式用 cheerio CSS 选择器",
  category: "list",
  configSchema,
  configFields: [
    { key: "listUrl", label: "列表页 URL", type: "url", required: true },
    {
      key: "extractMode",
      label: "提取模式",
      type: "select",
      required: true,
      options: [
        { value: "regex", label: "正则匹配(Jina Markdown)" },
        { value: "css", label: "CSS 选择器(原始 HTML)" },
      ],
    },
    {
      key: "articleUrlPattern",
      label: "文章 URL 正则(仅正则模式)",
      type: "text",
      help: "如: xinhuanet\\.com/politics/\\d{4}-\\d{2}/\\d{2}/",
    },
    {
      key: "selectors",
      label: "CSS 选择器 JSON(仅 CSS 模式)",
      type: "kv",
      help: '例: {"items":".card","title":"h3","link":"a","date":".date","summary":"p"}',
    },
    {
      key: "maxArticlesPerRun",
      label: "每次最多抓取条数",
      type: "number",
      validation: { min: 1, max: 100 },
    },
    { key: "fetchFullContent", label: "深读正文(Jina)", type: "boolean" },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.listUrl).hostname;
    } catch {
      return { items, partialFailures: [{ message: "invalid listUrl" }] };
    }
    const channel = `list/${hostname}`;

    try {
      if (config.extractMode === "regex") {
        // Regex mode: Jina Reader → Markdown → pattern match
        const { content } = await fetchViaJinaReader(config.listUrl);
        const pattern = new RegExp(config.articleUrlPattern!);
        // Match markdown links: [text](url)
        const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
        const matches: { title: string; url: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(content))) {
          if (pattern.test(m[2])) {
            matches.push({ title: m[1].trim(), url: m[2] });
          }
        }
        const capped = matches.slice(0, config.maxArticlesPerRun);

        for (const entry of capped) {
          const item: RawItem = {
            title: entry.title,
            url: entry.url,
            channel,
            rawMetadata: { source: "list-regex" },
          };
          if (config.fetchFullContent) {
            try {
              const full = await fetchViaJinaReader(entry.url);
              if (full.content && full.content.length >= 50) {
                item.content = full.content;
              }
            } catch (err) {
              log("warn", `deep-read failed for ${entry.url}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          items.push(item);
        }
      } else {
        // CSS mode: raw HTML → cheerio
        const response = await fetchWithPolicy(
          async ({ signal }) => {
            const r = await fetch(config.listUrl, { signal, cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          },
          DEFAULT_FETCH_POLICY,
        );
        const $ = cheerio.load(response);
        const sel = config.selectors!;
        const cards = $(sel.items).slice(0, config.maxArticlesPerRun);

        cards.each((_, el) => {
          const $el = $(el);
          const title = $el.find(sel.title).first().text().trim();
          const linkRaw = $el.find(sel.link).first().attr("href");
          if (!title || !linkRaw) return;
          let url: string;
          try {
            url = new URL(linkRaw, config.listUrl).toString();
          } catch {
            return;
          }
          const dateStr = sel.date ? $el.find(sel.date).first().text().trim() : undefined;
          const summary = sel.summary ? $el.find(sel.summary).first().text().trim() : undefined;
          const publishedAt = parseFlexibleDate(dateStr);

          items.push({
            title,
            url,
            summary: summary || undefined,
            publishedAt,
            channel,
            rawMetadata: { source: "list-css" },
          });
        });

        // Optional deep-read per item (serial to avoid overwhelming target)
        if (config.fetchFullContent) {
          for (const item of items) {
            if (!item.url) continue;
            try {
              const full = await fetchViaJinaReader(item.url);
              if (full.content && full.content.length >= 50) {
                item.content = full.content;
              }
            } catch (err) {
              log("warn", `deep-read failed for ${item.url}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { listUrl: config.listUrl } });
      log("error", `list_scraper failed: ${message}`, { listUrl: config.listUrl });
    }

    return { items, partialFailures };
  },
};

function parseFlexibleDate(s?: string): Date | undefined {
  if (!s) return undefined;
  // Try ISO / Date.parse first
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Chinese date patterns: "2026年4月18日", "2026-04-18", "04-18"
  const cn = s.match(/(\d{4})[-年.\/](\d{1,2})[-月.\/](\d{1,2})/);
  if (cn) {
    const dt = new Date(Number(cn[1]), Number(cn[2]) - 1, Number(cn[3]));
    if (!isNaN(dt.getTime())) return dt;
  }
  return undefined;
}
