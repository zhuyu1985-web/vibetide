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
    // trim + 剥离粘贴时常带的反引号/引号 — 与 rss.ts / jina-url.ts 同模式
    listUrl: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(/^[`'"\s]+|[`'"\s]+$/g, "") : v),
      z.string().url("请填写合法的列表页 URL"),
    ),
    extractMode: z.enum(["regex", "css"]),
    /** regex 模式 — 填了走精确匹配;留空走智能模式(启发式提取候选文章 URL) */
    articleUrlPattern: z.string().optional(),
    selectors: selectorsSchema.optional(),
    maxArticlesPerRun: z.number().int().min(1).max(100).default(10),
    fetchFullContent: z.boolean().default(false),
  })
  .refine(
    // css 模式仍强制 selectors;regex 模式 articleUrlPattern 可选(留空 = 智能模式)
    (v) => v.extractMode === "css" ? Boolean(v.selectors) : true,
    { message: "css 模式需填 selectors" },
  );

type ListScraperConfig = z.infer<typeof configSchema>;

export const listScraperAdapter: SourceAdapter<ListScraperConfig> = {
  type: "list_scraper",
  displayName: "列表抓取 (正则或 CSS 选择器)",
  description: "从新闻列表页抓文章链接: regex 模式用 Jina Markdown+正则,css 模式用 cheerio CSS 选择器",
  category: "list",
  configSchema,
  configFields: [
    { key: "listUrl", label: "列表页 URL", type: "url", required: true, pickFromOutletWebsite: true },
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
      label: "文章 URL 正则(仅正则模式,留空 = 智能模式)",
      type: "text",
      help: "示例: cbg\\.cn/a/\\d+/\\d{8}/[a-f0-9]+\\.html  · 留空时系统按同 host + 排除资源/栏目页等启发式自动识别",
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
        // Regex mode: Jina Reader → Markdown → URL scan + filter.
        //
        // We scan raw URLs (not `[text](url)` link structures) because some
        // sites embed nested markdown like `[标题![Image N](图片URL) 摘要](文章URL)`,
        // which a `[^\]]+` group cannot parse — it stops at the inner `]` and
        // captures the image URL instead of the article URL. URL-first scanning
        // is robust against arbitrary nesting; titles come from surrounding
        // markdown context, or are overridden by Jina's full-fetch title when
        // `fetchFullContent: true`.
        const { content } = await fetchViaJinaReader(config.listUrl);
        const filter = config.articleUrlPattern
          ? (() => {
              const re = new RegExp(config.articleUrlPattern!);
              return (u: string) => re.test(u);
            })()
          : buildSmartArticleFilter(config.listUrl);
        const urlRegex = /https?:\/\/[^\s)<>"'\]]+/g;
        const matches: { title: string; url: string }[] = [];
        const seen = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = urlRegex.exec(content))) {
          const url = m[0];
          if (!filter(url) || seen.has(url)) continue;
          seen.add(url);
          matches.push({
            title: extractTitleBeforeUrl(content, m.index) || url,
            url,
          });
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
              if (full.title) {
                item.title = full.title;
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

/* === 共享 helper(被 site-scraper.ts 也用) === */

// 智能模式启发式:用户没填 articleUrlPattern 时,自动判断 URL 是否像"文章页"。
// 规则(顺序应用,任何一条不满足都丢弃):
//   1. 必须同 host(支持 www 子域差异 — 父 host 一致即可)
//   2. 排除资源后缀(.jpg/.png/.css/.js/.mp4/.pdf ...)
//   3. 排除明显的栏目/导航路径段(/list/、/category/、/tag/、/channel/ 等单独到栏目层级)
//   4. 排除"扁平"路径(根、/index、/about、/contact、/login、/register)
//   5. 路径深度 ≥ 2(过滤栏目入口)
// 注意:这是召回优先的启发式,可能误收一些非文章页;调用方应配合 `fetchFullContent`
// 让 Jina 二次抓取时筛掉真正没有正文的 URL。
const RESOURCE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|json|xml|zip|rar|pdf|mp3|mp4|m4a|wav|ogg|webm|woff2?|ttf|eot)(\?|#|$)/i;
const NAV_PATH_SEG = /^(list|category|categories|tag|tags|channel|channels|topic|topics|column|columns|page|pages|index)$/i;
const FLAT_NAV_PATH = /^(|index(\.\w+)?|about|contact|login|register|signup|signin|signout|logout|search|sitemap|rss|feed|home|main)$/i;

export function buildSmartArticleFilter(listUrl: string): (u: string) => boolean {
  let baseHost = "";
  try {
    baseHost = stripWww(new URL(listUrl).hostname);
  } catch {
    return () => false;
  }
  return (raw: string) => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return false;
    }
    if (stripWww(parsed.hostname) !== baseHost) return false;
    if (RESOURCE_EXT.test(parsed.pathname)) return false;

    const segs = parsed.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return false; // 根
    if (segs.length === 1 && FLAT_NAV_PATH.test(segs[0])) return false; // /about etc.
    // 单段且看起来是栏目入口(如 /list、/category)— 排除
    if (segs.length === 1 && NAV_PATH_SEG.test(segs[0])) return false;
    // 路径全是"栏目层级"型(/list/705/1.html → segs = ["list", "705", "1.html"])
    // 启发:第一段命中 NAV_PATH_SEG 且总段数 ≤ 3 时认为是栏目页而非文章
    if (NAV_PATH_SEG.test(segs[0]) && segs.length <= 3) return false;
    // 路径深度太浅(< 2)排除 — 文章页一般 ≥ 2 段
    if (segs.length < 2) return false;
    return true;
  };
}

export function stripWww(host: string): string {
  return host.replace(/^www\./i, "");
}

// 在 markdown 里给定 URL 的位置,反向追溯它所属的 `[...](url)` 链接文本。
// 支持嵌套 `[Image N](...)`,失败时返回空串(由 caller 回退到 URL 本身)。
export function extractTitleBeforeUrl(content: string, urlOffset: number): string {
  if (urlOffset < 2 || content[urlOffset - 1] !== "(" || content[urlOffset - 2] !== "]") {
    return "";
  }
  let depth = 1;
  let i = urlOffset - 3;
  while (i >= 0) {
    const c = content[i];
    if (c === "]") depth++;
    else if (c === "[") {
      depth--;
      if (depth === 0) break;
    }
    i--;
  }
  if (depth !== 0 || i < 0) return "";
  let title = content.slice(i + 1, urlOffset - 2);
  title = title.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  title = title.replace(/\s+/g, " ").trim();
  return title;
}

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
