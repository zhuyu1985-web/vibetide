import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { eq, and, desc, asc, sql, type SQL } from "drizzle-orm";
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

// ─── B.1 Unified Scenario Workflow — listWorkflowTemplatesByOrg ───

export type WorkflowTemplateCategory =
  | "news"
  | "video"
  | "analytics"
  | "distribution"
  | "deep"
  | "social"
  | "advanced"
  | "livelihood"
  | "podcast"
  | "drama"
  | "daily_brief"
  | "custom";

export interface ListFilter {
  category?: WorkflowTemplateCategory;
  isBuiltin?: boolean;
  isEnabled?: boolean; // default true
  appChannelSlug?: string;
  employeeSlug?: string; // defaultTeam @> [employeeSlug]
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

/**
 * List workflow templates for a given organization with rich filtering.
 *
 * Filter semantics:
 * - `isEnabled` defaults to `true` (scenarios hidden until explicitly enabled).
 * - `employeeSlug` uses jsonb containment (`default_team @> '["slug"]'`).
 * - All other filters are equality.
 *
 * Ordered by `createdAt` ascending for stable UI rendering.
 */
export async function listWorkflowTemplatesByOrg(
  organizationId: string,
  filter: ListFilter = {},
  options: ListOptions = {},
) {
  const conds: SQL[] = [eq(workflowTemplates.organizationId, organizationId)];

  conds.push(eq(workflowTemplates.isEnabled, filter.isEnabled ?? true));

  if (filter.category !== undefined) {
    conds.push(eq(workflowTemplates.category, filter.category));
  }
  if (filter.isBuiltin !== undefined) {
    conds.push(eq(workflowTemplates.isBuiltin, filter.isBuiltin));
  }
  if (filter.appChannelSlug !== undefined) {
    conds.push(eq(workflowTemplates.appChannelSlug, filter.appChannelSlug));
  }
  if (filter.employeeSlug !== undefined) {
    // jsonb contains check: default_team @> '["<slug>"]'
    conds.push(
      sql`${workflowTemplates.defaultTeam} @> ${JSON.stringify([filter.employeeSlug])}::jsonb`,
    );
  }

  let query = db
    .select()
    .from(workflowTemplates)
    .where(and(...conds))
    .orderBy(asc(workflowTemplates.createdAt));

  if (options.limit !== undefined) query = query.limit(options.limit) as typeof query;
  if (options.offset !== undefined) query = query.offset(options.offset) as typeof query;

  return await query;
}

/**
 * Look up a workflow template by (organizationId, legacy_scenario_key).
 *
 * 使用：startMission 时，若调用方未传 workflowTemplateId 但传了 scenario slug，
 * 自动通过此函数从 legacyScenarioKey 反查 template.id 补上。
 */
export async function getWorkflowTemplateByLegacyKey(
  organizationId: string,
  legacyKey: string,
) {
  const [row] = await db
    .select()
    .from(workflowTemplates)
    .where(and(
      eq(workflowTemplates.organizationId, organizationId),
      eq(workflowTemplates.legacyScenarioKey, legacyKey),
    ))
    .limit(1);
  return row ?? null;
}

// ─── B.1 Unified Scenario Workflow — mutations ───

export interface CreateWorkflowTemplateInput {
  name: string;
  description?: string | null;
  category: WorkflowTemplateCategory;
  steps: unknown[];   // WorkflowStepDef[]
  isBuiltin?: boolean;        // default false
  icon?: string | null;
  inputFields?: unknown[];
  defaultTeam?: string[];
  appChannelSlug?: string | null;
  systemInstruction?: string | null;
  legacyScenarioKey?: string | null;
  triggerType?: "manual" | "scheduled";
  triggerConfig?: Record<string, unknown>;
  createdBy?: string;
}

export async function createWorkflowTemplate(
  organizationId: string,
  input: CreateWorkflowTemplateInput,
) {
  const [row] = await db
    .insert(workflowTemplates)
    .values({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      steps: input.steps as never,
      isBuiltin: input.isBuiltin ?? false,
      isEnabled: true,
      icon: input.icon ?? null,
      inputFields: (input.inputFields ?? []) as never,
      defaultTeam: (input.defaultTeam ?? []) as never,
      appChannelSlug: input.appChannelSlug ?? null,
      systemInstruction: input.systemInstruction ?? null,
      legacyScenarioKey: input.legacyScenarioKey ?? null,
      triggerType: input.triggerType ?? "manual",
      triggerConfig: (input.triggerConfig ?? {}) as never,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
}

export interface UpdateWorkflowTemplateInput {
  name?: string;
  description?: string | null;
  category?: WorkflowTemplateCategory;
  icon?: string | null;
  inputFields?: unknown[];
  defaultTeam?: string[];
  appChannelSlug?: string | null;
  systemInstruction?: string | null;
  isEnabled?: boolean;
  steps?: unknown[];
}

export async function updateWorkflowTemplate(
  id: string,
  patch: UpdateWorkflowTemplateInput,
) {
  await db
    .update(workflowTemplates)
    .set({
      ...patch,
      updatedAt: new Date(),
    } as never)
    .where(eq(workflowTemplates.id, id));
}

export async function softDisableWorkflowTemplate(id: string) {
  await updateWorkflowTemplate(id, { isEnabled: false });
}
