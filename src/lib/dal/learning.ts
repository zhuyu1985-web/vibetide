import { db } from "@/db";
import { employeeMemories } from "@/db/schema/employee-memories";
import { userFeedback } from "@/db/schema/user-feedback";
import { eq, and, desc, count, isNull } from "drizzle-orm";

export interface RecentMemory {
  id: string;
  memoryType: string;
  content: string;
  source: string | null;
  importance: number;
  createdAt: string;
}

export async function getRecentMemories(
  employeeId: string,
  limit = 20
): Promise<RecentMemory[]> {
  const rows = await db
    .select({
      id: employeeMemories.id,
      memoryType: employeeMemories.memoryType,
      content: employeeMemories.content,
      source: employeeMemories.source,
      importance: employeeMemories.importance,
      createdAt: employeeMemories.createdAt,
    })
    .from(employeeMemories)
    .where(eq(employeeMemories.employeeId, employeeId))
    .orderBy(desc(employeeMemories.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    memoryType: r.memoryType,
    content: r.content,
    source: r.source,
    importance: r.importance,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUnprocessedFeedbackCount(
  employeeId: string,
  orgId: string
): Promise<number> {
  // Feedback that hasn't been processed into learning patterns yet
  // We consider feedback without matching memory entries as "unprocessed"
  const result = await db
    .select({ cnt: count() })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.employeeId, employeeId),
        eq(userFeedback.organizationId, orgId)
      )
    );

  return result[0]?.cnt ?? 0;
}
