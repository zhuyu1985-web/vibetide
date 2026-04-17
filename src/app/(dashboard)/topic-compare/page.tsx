import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getTopicCompareArticles } from "@/lib/dal/topic-compare";
import { topicCompareArticles as mockArticles } from "@/data/benchmarking-data";
import type { TopicCompareArticle } from "@/lib/types";
import { TopicCompareClient } from "./topic-compare-client";

export const dynamic = "force-dynamic";

export default async function TopicComparePage() {
  let articles: TopicCompareArticle[] = [];
  let usingMock = false;

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      articles = await getTopicCompareArticles(orgId);
    }
    // If no org or no real articles, fall back to mock so the page is still demo-able
    if (articles.length === 0) {
      articles = mockArticles;
      usingMock = true;
    }
  } catch (err) {
    console.error("[topic-compare] failed to load real data, using mock:", err);
    articles = mockArticles;
    usingMock = true;
  }

  return <TopicCompareClient articles={articles} usingMock={usingMock} />;
}
