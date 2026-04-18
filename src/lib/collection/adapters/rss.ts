import { z } from "zod";
import * as cheerio from "cheerio";
import type { SourceAdapter, RawItem } from "../types";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const configSchema = z.object({
  feedUrl: z.string().url("请填写合法的 feed URL"),
  fetchFullContent: z.boolean().default(false),
});

type RssConfig = z.infer<typeof configSchema>;

export const rssAdapter: SourceAdapter<RssConfig> = {
  type: "rss",
  displayName: "RSS / Atom 订阅",
  description: "订阅 RSS 2.0 或 Atom feed, 抓取最新条目",
  category: "feed",
  configSchema,
  configFields: [
    { key: "feedUrl", label: "Feed URL", type: "url", required: true, help: "如 https://www.huxiu.com/rss/0.xml" },
    { key: "fetchFullContent", label: "深读正文(Jina)", type: "boolean", help: "RSS 摘要通常够用;开启后会对每条链接再调一次 Jina" },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.feedUrl).hostname;
    } catch {
      return { items, partialFailures: [{ message: "invalid feedUrl" }] };
    }
    const channel = `rss/${hostname}`;

    try {
      const xml = await fetchWithPolicy(
        async ({ signal }) => {
          const r = await fetch(config.feedUrl, { signal, cache: "no-store" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        },
        DEFAULT_FETCH_POLICY,
      );

      const $ = cheerio.load(xml, { xmlMode: true });

      // Try RSS 2.0 first
      const rssItems = $("rss > channel > item");
      if (rssItems.length > 0) {
        rssItems.each((_, el) => {
          const $el = $(el);
          const title = $el.children("title").first().text().trim();
          const link = $el.children("link").first().text().trim();
          const pubDate = $el.children("pubDate").first().text().trim();
          const description = $el.children("description").first().text().trim();
          if (!title || !link) return;
          items.push({
            title,
            url: link,
            summary: description || undefined,
            publishedAt: pubDate ? safeParseDate(pubDate) : undefined,
            channel,
            rawMetadata: { format: "rss2" },
          });
        });
      } else {
        // Try Atom
        const atomEntries = $("feed > entry");
        atomEntries.each((_, el) => {
          const $el = $(el);
          const title = $el.children("title").first().text().trim();
          // Atom: <link href="..." />
          const linkHref = $el.children("link").first().attr("href");
          const published = $el.children("published").first().text().trim()
            || $el.children("updated").first().text().trim();
          const summary = $el.children("summary").first().text().trim()
            || $el.children("content").first().text().trim();
          if (!title || !linkHref) return;
          items.push({
            title,
            url: linkHref,
            summary: summary || undefined,
            publishedAt: published ? safeParseDate(published) : undefined,
            channel,
            rawMetadata: { format: "atom" },
          });
        });
      }

      // Optional deep-read
      if (config.fetchFullContent && items.length > 0) {
        for (const item of items) {
          if (!item.url) continue;
          try {
            const full = await fetchViaJinaReader(item.url);
            if (full.content && full.content.length >= 50) {
              item.content = full.content;
            }
          } catch (err) {
            log("warn", `deep-read failed for ${item.url}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { feedUrl: config.feedUrl } });
      log("error", `rss fetch failed: ${message}`, { feedUrl: config.feedUrl });
    }

    return { items, partialFailures };
  },
};

function safeParseDate(s: string): Date | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}
