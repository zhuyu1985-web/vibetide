"use server";

import { db } from "@/db";
import { workflowTemplates, skills } from "@/db/schema";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import { eq, inArray, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { isSuperAdmin } from "@/lib/rbac";
import { startMission } from "@/app/actions/missions";
import {
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from "@/lib/workflow-templates";
import { buildBuiltinTemplateId } from "@/lib/dal/workflow-templates";

/**
 * Look up a virtual builtin template (from the static BUILTIN_TEMPLATES
 * constant) by its synthesized `builtin-<hash>` ID. Returns null if the ID
 * doesn't match any entry.
 */
function findBuiltinTemplateById(
  templateId: string
): BuiltinTemplate | null {
  if (!templateId.startsWith("builtin-")) return null;
  return (
    BUILTIN_TEMPLATES.find(
      (t) => buildBuiltinTemplateId(t.name) === templateId
    ) ?? null
  );
}
/**
 * Validate that every `type:"skill"` step references a real skill (by slug)
 * and overwrite the step's cached `skillName` / `skillCategory` with the
 * authoritative values from the skills table. Keeps the workflow list UI and
 * runtime dispatcher in agreement with the skills library.
 *
 * Throws if any skill step has a missing or unknown slug so bad data cannot
 * be saved via a crafted API call.
 */
async function normalizeSkillSteps(
  steps: WorkflowStepDef[],
): Promise<WorkflowStepDef[]> {
  const skillSteps = steps.filter((s) => s.type === "skill");
  if (skillSteps.length === 0) return steps;

  const slugs = Array.from(
    new Set(
      skillSteps
        .map((s) => s.config?.skillSlug)
        .filter((x): x is string => !!x && x.length > 0),
    ),
  );
  if (slugs.length === 0) {
    throw new Error("工作流步骤必须绑定技能库中的技能");
  }

  const rows = slugs.length
    ? await db
        .select({ slug: skills.slug, name: skills.name, category: skills.category })
        .from(skills)
        .where(inArray(skills.slug, slugs))
    : [];

  const bySlug = new Map(rows.map((r) => [r.slug!, r]));
  const missing = skillSteps
    .filter((s) => {
      const slug = s.config?.skillSlug;
      return !slug || !bySlug.has(slug);
    })
    .map((s) => s.config?.skillSlug || "(空)");
  if (missing.length > 0) {
    throw new Error(
      `工作流步骤技能不存在于技能库：${[...new Set(missing)].join("、")}`,
    );
  }

  return steps.map((step) => {
    if (step.type !== "skill") return step;
    const slug = step.config?.skillSlug;
    const canonical = slug ? bySlug.get(slug) : undefined;
    if (!canonical) return step;
    return {
      ...step,
      config: {
        ...step.config,
        skillSlug: canonical.slug!,
        skillName: canonical.name,
        skillCategory: canonical.category as string,
      },
    };
  });
}

// ─── Legacy CRUD (kept for backward compatibility) ───

/**
 * Create a custom workflow template.
 */
export async function createWorkflowTemplate(data: {
  organizationId: string;
  name: string;
  description?: string;
  steps: WorkflowStepDef[];
}) {
  await requireAuth();

  const [template] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      steps: data.steps,
    })
    .returning();

  revalidatePath("/missions");
  return template;
}

/**
 * Update an existing workflow template.
 *
 * Supports `content` field (baoyu-standard SKILL.md body). When provided,
 * in dev environments the content is also written back to
 * `workflows/<legacy_scenario_key>/SKILL.md` to keep filesystem in sync.
 * In production (Vercel), filesystem is read-only so this is a no-op.
 */
export async function updateWorkflowTemplate(
  templateId: string,
  data: {
    name?: string;
    description?: string;
    steps?: WorkflowStepDef[];
    content?: string;
    inputFields?: InputFieldDef[];
    promptTemplate?: string;
  }
) {
  await requireAuth();

  await db
    .update(workflowTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, templateId));

  // Bidirectional sync: write DB content back to workflows/<slug>/SKILL.md
  // so runtime + git stay in sync with UI edits (dev only).
  if (data.content !== undefined) {
    const existing = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, templateId),
    });
    if (existing?.legacyScenarioKey) {
      const { writeWorkflowMdBody } = await import("@/lib/skill-md-sync");
      writeWorkflowMdBody(existing.legacyScenarioKey, data.content.trim());
    }
  }

  revalidatePath("/missions");
  revalidatePath(`/workflows/${templateId}`);
  revalidatePath("/skills");
}

/**
 * Delete a workflow template.
 */
export async function deleteWorkflowTemplate(templateId: string) {
  await requireAuth();

  await db
    .delete(workflowTemplates)
    .where(eq(workflowTemplates.id, templateId));

  revalidatePath("/missions");
}

// ─── New Workflow Actions ───

/**
 * Create a user copy from a builtin template.
 * The new workflow is non-builtin and owned by the current user.
 */
export async function createWorkflowFromTemplate(templateId: string) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  // Virtual builtin templates (not yet persisted to DB) resolve from the
  // static BUILTIN_TEMPLATES constant instead of the workflow_templates table.
  const virtual = findBuiltinTemplateById(templateId);
  if (virtual) {
    if (!Array.isArray(virtual.steps) || virtual.steps.length === 0) {
      throw new Error("该模板未配置步骤，暂不可用");
    }
    const [newWorkflow] = await db
      .insert(workflowTemplates)
      .values({
        organizationId: orgId,
        name: `${virtual.name}（副本）`,
        description: virtual.description,
        steps: virtual.steps,
        category: virtual.category,
        triggerType: virtual.triggerType,
        triggerConfig: virtual.triggerConfig ?? null,
        isBuiltin: false,
        isEnabled: false,
        createdBy: user.id,
      })
      .returning();

    revalidatePath("/workflows");
    return newWorkflow;
  }

  const template = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, templateId),
  });
  if (!template) throw new Error("模板不存在");

  const templateSteps = (template.steps ?? []) as WorkflowStepDef[];
  if (templateSteps.length === 0) {
    throw new Error("该模板未配置步骤，暂不可用");
  }

  const [newWorkflow] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: orgId,
      name: `${template.name}（副本）`,
      description: template.description,
      steps: template.steps,
      category: template.category,
      triggerType: template.triggerType ?? "manual",
      triggerConfig: template.triggerConfig,
      isBuiltin: false,
      isEnabled: false,
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/workflows");
  return newWorkflow;
}

/**
 * Save a new custom workflow template.
 */
export async function saveWorkflow(data: {
  name: string;
  description?: string;
  category?: "news" | "video" | "analytics" | "distribution" | "custom";
  triggerType?: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
  inputFields?: InputFieldDef[];
  promptTemplate?: string;
}) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  const normalizedSteps = await normalizeSkillSteps(data.steps);

  const [workflow] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: orgId,
      name: data.name,
      description: data.description,
      steps: normalizedSteps,
      category: data.category ?? "custom",
      triggerType: data.triggerType ?? "manual",
      triggerConfig: data.triggerConfig ?? null,
      isBuiltin: false,
      isEnabled: false,
      createdBy: user.id,
      ...(data.inputFields !== undefined
        ? { inputFields: data.inputFields }
        : {}),
      ...(data.promptTemplate !== undefined
        ? { promptTemplate: data.promptTemplate }
        : {}),
    })
    .returning();

  revalidatePath("/workflows");
  return workflow;
}

/**
 * Update an existing non-builtin workflow.
 */
export async function updateWorkflow(
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: "news" | "video" | "analytics" | "distribution" | "custom";
    triggerType?: "manual" | "scheduled";
    triggerConfig?: { cron?: string; timezone?: string } | null;
    steps?: WorkflowStepDef[];
    inputFields?: InputFieldDef[];
    promptTemplate?: string;
  }
) {
  const user = await requireAuth();

  // Verify the workflow exists. Builtin templates are normally read-only, but
  // super admins can still edit them so product operators can hotfix shipped
  // templates without a code release.
  const existing = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!existing) throw new Error("工作流不存在");
  if (existing.isBuiltin && !(await isSuperAdmin(user.id))) {
    throw new Error("内置工作流仅管理员可修改");
  }

  const patch = { ...data };
  if (data.steps) {
    patch.steps = await normalizeSkillSteps(data.steps);
  }

  await db
    .update(workflowTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
  revalidatePath(`/workflows/${id}`);
}

/**
 * Delete a workflow. Custom workflows are deletable by any authenticated
 * user; builtin templates are deletable only by super admins.
 */
export async function deleteWorkflow(id: string) {
  const user = await requireAuth();

  const existing = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!existing) throw new Error("工作流不存在");
  if (existing.isBuiltin && !(await isSuperAdmin(user.id))) {
    throw new Error("内置工作流仅管理员可删除");
  }

  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
}

/**
 * Toggle the isEnabled flag on a workflow.
 */
export async function toggleWorkflowEnabled(id: string, enabled: boolean) {
  await requireAuth();

  await db
    .update(workflowTemplates)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
}

/**
 * Execute a workflow by creating a Mission from its template steps.
 *
 * Flow:
 * 1. Load the workflow template
 * 2. Resolve employee nicknames for each step
 * 3. Build a userInstruction describing the workflow
 * 4. Call startMission() to create and execute the mission
 * 5. Update workflow run stats (lastRunAt, runCount)
 * 6. Return the created mission ID
 */
export async function executeWorkflow(id: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  // 1. Load workflow template
  const workflow = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!workflow) throw new Error("工作流不存在");

  // 2. Build structured instruction from skill-based steps
  const steps = (workflow.steps ?? []) as WorkflowStepDef[];
  if (steps.length === 0) {
    throw new Error("该工作流未配置步骤，请编辑补全后再运行");
  }

  // 3. Build structured instruction
  const stepDescriptions = steps
    .sort((a, b) => a.order - b.order)
    .map((step, idx) => {
      const skillName = step.config?.skillName ?? step.config?.skillSlug ?? "自动分配";
      const desc = step.config?.description?.trim();
      const base = `${idx + 1}. ${step.name} — ${skillName}`;
      return desc ? `${base}\n   任务说明：${desc}` : base;
    })
    .join("\n");

  const userInstruction = `请按照以下工作流执行：\n${stepDescriptions}${
    workflow.description ? `\n\n工作流说明：${workflow.description}` : ""
  }`;

  // 4. Create mission via startMission
  const mission = await startMission({
    title: workflow.name,
    scenario: "custom",
    userInstruction,
  });

  // 5. Update workflow run stats
  await db
    .update(workflowTemplates)
    .set({
      lastRunAt: new Date(),
      runCount: sql`${workflowTemplates.runCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflowTemplates.id, id));

  // 6. Revalidate both pages
  revalidatePath("/workflows");
  revalidatePath("/missions");

  return mission.id;
}
