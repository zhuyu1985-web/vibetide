import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import { BUILTIN_TEMPLATES } from "@/lib/workflow-templates";
import type { WorkflowTemplateRow } from "@/db/types";

/**
 * Deterministic slug for builtin template fallback IDs.
 * Uses name-based hash so the same template always gets the same ID across renders.
 */
function slugifyTemplateName(name: string): string {
  // Simple deterministic hash of the Chinese name -> base36 string.
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build a stable virtual ID for a builtin template (used when it hasn't been
 * persisted to the DB yet). Prefix `builtin-` lets downstream actions detect
 * and resolve these from the static constant.
 */
export function buildBuiltinTemplateId(name: string): string {
  return `builtin-${slugifyTemplateName(name)}`;
}

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
 *
 * Merges DB builtin rows with any templates from the static BUILTIN_TEMPLATES
 * constant that are not yet present in the DB (matched by name). Virtual rows
 * are synthesized to conform to WorkflowTemplateRow so callers can treat them
 * uniformly. Their IDs are prefixed with `builtin-` so mutation actions can
 * detect and resolve them against the static constant.
 */
export async function getBuiltinTemplates(): Promise<WorkflowTemplateRow[]> {
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

  const existingNames = new Set(rows.map((r) => r.name));
  const epoch = new Date(0);

  const virtualRows: WorkflowTemplateRow[] = BUILTIN_TEMPLATES.filter(
    (t) => !existingNames.has(t.name)
  ).map((t) => ({
    id: buildBuiltinTemplateId(t.name),
    organizationId: orgId ?? null,
    name: t.name,
    description: t.description,
    steps: t.steps,
    category: t.category,
    triggerType: t.triggerType,
    triggerConfig: t.triggerConfig ?? null,
    isBuiltin: true,
    isEnabled: true,
    createdBy: null,
    lastRunAt: null,
    runCount: 0,
    createdAt: epoch,
    updatedAt: epoch,
    // B.1 Unified Scenario Workflow fields — null/empty defaults for virtual rows
    icon: null,
    inputFields: [],
    defaultTeam: [],
    appChannelSlug: null,
    systemInstruction: null,
    legacyScenarioKey: null,
  }));

  return [...rows, ...virtualRows];
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
