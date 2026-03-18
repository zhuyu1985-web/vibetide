import { db } from "@/db";
import { knowledgeBases, employeeKnowledgeBases } from "@/db/schema";
import { eq, notInArray, sql } from "drizzle-orm";
import type { KnowledgeBaseInfo } from "@/lib/types";

export async function getKnowledgeBases(): Promise<KnowledgeBaseInfo[]> {
  const rows = await db.query.knowledgeBases.findMany({
    orderBy: (kb, { asc }) => [asc(kb.name)],
  });

  return rows.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description || "",
    type: kb.type,
    documentCount: kb.documentCount || 0,
  }));
}

export async function getKnowledgeBasesNotBoundToEmployee(
  employeeId: string
): Promise<KnowledgeBaseInfo[]> {
  // Get IDs already bound to this employee
  const boundRows = await db
    .select({ kbId: employeeKnowledgeBases.knowledgeBaseId })
    .from(employeeKnowledgeBases)
    .where(eq(employeeKnowledgeBases.employeeId, employeeId));

  const boundIds = boundRows.map((r) => r.kbId);

  const rows = boundIds.length > 0
    ? await db.query.knowledgeBases.findMany({
        where: notInArray(knowledgeBases.id, boundIds),
        orderBy: (kb, { asc }) => [asc(kb.name)],
      })
    : await db.query.knowledgeBases.findMany({
        orderBy: (kb, { asc }) => [asc(kb.name)],
      });

  return rows.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description || "",
    type: kb.type,
    documentCount: kb.documentCount || 0,
  }));
}

export async function getEmployeeKnowledgeBases(
  employeeId: string
): Promise<KnowledgeBaseInfo[]> {
  const rows = await db.query.employeeKnowledgeBases.findMany({
    where: eq(employeeKnowledgeBases.employeeId, employeeId),
    with: {
      knowledgeBase: true,
    },
  });

  return rows.map((ekb) => ({
    id: ekb.knowledgeBase.id,
    name: ekb.knowledgeBase.name,
    description: ekb.knowledgeBase.description || "",
    type: ekb.knowledgeBase.type,
    documentCount: ekb.knowledgeBase.documentCount || 0,
  }));
}
