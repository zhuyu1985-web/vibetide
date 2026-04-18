import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const configSchema = z.object({
  url: z.string().url("请填写合法的 URL"),
});

type JinaUrlConfig = z.infer<typeof configSchema>;

export const jinaUrlAdapter: SourceAdapter<JinaUrlConfig> = {
  type: "jina_url",
  displayName: "单 URL 深读 (Jina Reader)",
  description: "通过 Jina Reader 抓取任意网页并转换成 Markdown 全文",
  category: "url",
  configSchema,
  configFields: [
    { key: "url", label: "网页 URL", type: "url", required: true },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.url).hostname;
    } catch {
      log("error", "invalid URL", { url: config.url });
      return { items, partialFailures: [{ message: "invalid URL", meta: { url: config.url } }] };
    }

    try {
      const { title, content } = await fetchViaJinaReader(config.url);
      if (!content || content.length < 50) {
        partialFailures.push({
          message: "fetched content too short",
          meta: { url: config.url, length: content?.length ?? 0 },
        });
        log("warn", "content too short from Jina", { url: config.url });
      } else {
        items.push({
          title: title || config.url,
          url: config.url,
          content,
          channel: `jina/${hostname}`,
          rawMetadata: { source: "jina-reader" },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { url: config.url } });
      log("error", `Jina fetch failed: ${message}`, { url: config.url });
    }

    return { items, partialFailures };
  },
};
