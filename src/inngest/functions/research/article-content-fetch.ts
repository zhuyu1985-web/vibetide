import { inngest } from "@/inngest/client";
import { fetchAndUpdateArticleContent } from "@/lib/research/content-fetch";

/**
 * 异步 Jina Reader 正文拉取。
 *
 * - concurrency: 3 — 保护 Jina 配额
 * - retries: 3 — 对临时性失败（429 / 超时）自动重试
 * - 失败时 fetchAndUpdateArticleContent 内部先把状态标成 failed 再 throw，
 *   所以 retry 之间 DB 状态一致；最终失败的行可手工筛查重放
 */
export const researchArticleContentFetch = inngest.createFunction(
  {
    id: "research-article-content-fetch",
    name: "Research - Article Content Fetch (Jina)",
    concurrency: { limit: 3 },
    retries: 3,
  },
  { event: "research/article.content-fetch" },
  async ({ event, step }) => {
    const { articleId } = event.data;
    return await step.run("fetch", () =>
      fetchAndUpdateArticleContent(articleId),
    );
  },
);
