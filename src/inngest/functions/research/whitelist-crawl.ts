import { inngest } from "@/inngest/client";

// A1 阶段研究模块的 whitelist crawler 暂时停用，A3 阶段迁到 Collection Hub list_scraper Adapter
export const researchWhitelistCrawl = inngest.createFunction(
  { id: "research-whitelist-crawl", concurrency: { limit: 2 } },
  { event: "research/whitelist.crawl" },
  async () => {
    console.warn(
      "research/whitelist-crawl is stubbed; will be migrated to collection-hub Adapter in A3",
    );
    return { skipped: true };
  },
);
