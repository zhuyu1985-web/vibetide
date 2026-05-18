import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchViaJinaReader } from "@/lib/web-fetch";

// 把"一行一个 URL"的字符串拆成 URL 数组,顺带剥反引号/引号和空白。
// 同时兼容老 config 单 URL 字段:string → [string]
function normalizeUrls(input: unknown): unknown {
  if (Array.isArray(input)) return input;
  if (typeof input !== "string") return input;
  return input
    .split(/\r?\n|[,;]/g)
    .map((s) => s.trim().replace(/^[`'"\s]+|[`'"\s]+$/g, ""))
    .filter(Boolean);
}

const configSchema = z
  .object({
    /** 多 URL — 支持文章页 / 栏目页 / 站点首页。Adapter 顺序抓取每个 URL。 */
    urls: z.preprocess(normalizeUrls, z.array(z.string().url("含非法 URL")).min(1, "至少填一个 URL")),
  })
  // 兼容老 config { url: "..." }:把 url 字段映射到 urls
  .or(
    z
      .object({ url: z.string().url() })
      .transform((v) => ({ urls: [v.url] })),
  );

type JinaUrlConfig = { urls: string[] };

export const jinaUrlAdapter: SourceAdapter<JinaUrlConfig> = {
  type: "jina_url",
  displayName: "URL 采集",
  description: "通过 Jina Reader 抓取一个或多个网页,自动转 Markdown 全文(支持文章页 / 栏目页 / 站点首页,一行一个 URL)",
  category: "url",
  configSchema,
  configFields: [
    {
      key: "urls",
      label: "网页 URL",
      type: "textarea",
      required: true,
      help: "一行一个 URL,支持文章页、栏目页、站点首页。也支持英文逗号 / 分号分隔。",
      pickFromOutletWebsite: true,
    },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    for (const url of config.urls) {
      let hostname = "unknown";
      try {
        hostname = new URL(url).hostname;
      } catch {
        partialFailures.push({ message: "invalid URL", meta: { url } });
        log("error", "invalid URL", { url });
        continue;
      }

      try {
        const { title, content } = await fetchViaJinaReader(url);
        if (!content || content.length < 50) {
          partialFailures.push({
            message: "fetched content too short",
            meta: { url, length: content?.length ?? 0 },
          });
          log("warn", "content too short from Jina", { url });
          continue;
        }
        items.push({
          title: title || url,
          url,
          content,
          channel: `jina/${hostname}`,
          rawMetadata: { source: "jina-reader" },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        partialFailures.push({ message, meta: { url } });
        log("error", `Jina fetch failed: ${message}`, { url });
      }
    }

    return { items, partialFailures };
  },
};
