// A3 Phase 1 stub — newsArticles reference removed (research_news_articles table dropped).
// crawledCount always returns 0 until Phase 2 reconnects to collected_items annotation tables.
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq, and, desc } from "drizzle-orm";

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

  // A3 Phase 1 stub: crawledCount always 0 — Phase 2 will count from collected_items annotation
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
    crawledCount: 0, // A3 Phase 1 stub: Phase 2 reconnects collected_items
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

  // A3 Phase 1 stub: articles always empty — Phase 2 reads from collected_items + annotation tables
  return { task, articles: [] };
}
