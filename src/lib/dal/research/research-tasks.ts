import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq, and, desc, sql } from "drizzle-orm";

export type ResearchTaskSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  topicCount: number;
  districtCount: number;
  tierCount: number;
  crawledCount: number;
};

export async function listMyResearchTasks(
  orgId: string,
  userId: string,
): Promise<ResearchTaskSummary[]> {
  const tasks = await db
    .select()
    .from(researchTasks)
    .where(and(eq(researchTasks.organizationId, orgId), eq(researchTasks.userId, userId)))
    .orderBy(desc(researchTasks.createdAt));

  const counts = await db
    .select({
      taskId: newsArticles.firstSeenResearchTaskId,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(newsArticles)
    .groupBy(newsArticles.firstSeenResearchTaskId);
  const countMap = new Map(counts.map((c) => [c.taskId, c.count]));

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    createdAt: t.createdAt,
    timeRangeStart: t.timeRangeStart,
    timeRangeEnd: t.timeRangeEnd,
    topicCount: t.topicIds.length,
    districtCount: t.districtIds.length,
    tierCount: t.mediaTiers.length,
    crawledCount: countMap.get(t.id) ?? 0,
  }));
}

export async function getResearchTaskDetail(
  id: string,
  orgId: string,
): Promise<{
  task: typeof researchTasks.$inferSelect;
  articles: Array<{
    id: string;
    title: string;
    url: string;
    publishedAt: Date | null;
    outletTierSnapshot: string | null;
    sourceChannel: string;
  }>;
} | null> {
  const [task] = await db
    .select()
    .from(researchTasks)
    .where(and(eq(researchTasks.id, id), eq(researchTasks.organizationId, orgId)));
  if (!task) return null;

  const articles = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      url: newsArticles.url,
      publishedAt: newsArticles.publishedAt,
      outletTierSnapshot: newsArticles.outletTierSnapshot,
      sourceChannel: newsArticles.sourceChannel,
    })
    .from(newsArticles)
    .where(eq(newsArticles.firstSeenResearchTaskId, id))
    .orderBy(desc(newsArticles.crawledAt))
    .limit(200);

  return { task, articles };
}
