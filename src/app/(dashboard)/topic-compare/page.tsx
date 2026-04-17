import { getCurrentUserOrg } from "@/lib/dal/auth";
import { topicCompareArticles } from "@/data/benchmarking-data";
import type { TopicCompareArticle } from "@/lib/types";
import { TopicCompareClient } from "./topic-compare-client";

export const dynamic = "force-dynamic";

export default async function TopicComparePage() {
  let articles: TopicCompareArticle[] = [];

  try {
    const orgId = await getCurrentUserOrg();
    // TODO: replace mock data with DAL query when ready
    // For now, always use mock data regardless of org
    void orgId;
    articles = topicCompareArticles;
  } catch {
    articles = topicCompareArticles;
  }

  return <TopicCompareClient articles={articles} />;
}
