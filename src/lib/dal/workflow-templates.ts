import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";

/**
 * Get all workflow templates (builtin + custom) for the current org.
 * Ordered: builtin first, then by createdAt descending.
 */
export async function getWorkflowTemplates() {
  const orgId = await getCurrentUserOrg();

  const rows = await db.query.workflowTemplates.findMany({
    ...(orgId
      ? { where: eq(workflowTemplates.organizationId, orgId) }
      : {}),
    orderBy: [
      desc(workflowTemplates.isBuiltin),
      desc(workflowTemplates.createdAt),
    ],
  });

  return rows;
}

/**
 * Get only user-created (non-builtin) workflows for a specific user.
 */
export async function getMyWorkflows(userId: string) {
  const orgId = await getCurrentUserOrg();

  const rows = await db.query.workflowTemplates.findMany({
    where: orgId
      ? and(
          eq(workflowTemplates.organizationId, orgId),
          eq(workflowTemplates.isBuiltin, false),
          eq(workflowTemplates.createdBy, userId)
        )
      : and(
          eq(workflowTemplates.isBuiltin, false),
          eq(workflowTemplates.createdBy, userId)
        ),
    orderBy: [desc(workflowTemplates.createdAt)],
  });

  return rows;
}

/**
 * Get only builtin templates for the current org.
 */
export async function getBuiltinTemplates() {
  const orgId = await getCurrentUserOrg();

  const rows = await db.query.workflowTemplates.findMany({
    where: orgId
      ? and(
          eq(workflowTemplates.organizationId, orgId),
          eq(workflowTemplates.isBuiltin, true)
        )
      : eq(workflowTemplates.isBuiltin, true),
    orderBy: [asc(workflowTemplates.createdAt)],
  });

  return rows;
}

/**
 * Get a single workflow template by ID.
 */
export async function getWorkflowTemplate(id: string) {
  const row = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });

  return row ?? null;
}
