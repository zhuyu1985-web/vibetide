"use server";

import { db } from "@/db";
import { workflowTemplates } from "@/db/schema/workflows";
import { missions } from "@/db/schema/missions";
import { aiEmployees } from "@/db/schema/ai-employees";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { validateInputs } from "@/lib/input-fields-validation";
import type { InputFieldDef } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { executeMissionDirect } from "@/lib/mission-executor";
import { getOrProvisionLeader } from "@/app/actions/missions";
import { isUniqueViolation } from "@/lib/db/pg-errors";

/**
 * Replace `{{key}}` placeholders in a prompt template with values from `params`.
 * Unknown keys are replaced with empty string. Non-primitive values are JSON-encoded.
 */
function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

/**
 * Build a natural-language user instruction for the mission from the template
 * definition + user-provided params.
 *
 * Priority:
 *   1. If `promptTemplate` is present and renders to non-empty, use rendered result.
 *   2. Otherwise fall back to a human-readable "启动场景 + 参数列表" dump.
 */
function buildUserInstruction(
  templateName: string,
  cleaned: Record<string, unknown>,
  promptTemplate: string | null,
): string {
  if (promptTemplate) {
    const rendered = renderTemplate(promptTemplate, cleaned);
    if (rendered.trim().length > 0) return rendered;
  }
  const paramLines = Object.entries(cleaned)
    .map(
      ([k, v]) =>
        `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`,
    )
    .join("\n");
  if (paramLines.length === 0) {
    return `启动场景：${templateName}`;
  }
  return `启动场景：${templateName}\n参数：\n${paramLines}`;
}

export type StartMissionResult =
  | { ok: true; missionId: string }
  | { ok: false; errors: Record<string, string> };

export interface StartMissionOptions {
  /**
   * Cross-module trigger source. When provided, the three fields participate
   * in the `missions_source_dedup_uidx` partial unique index so concurrent
   * inserts for the same (org, module, entity) are rejected at the DB layer
   * — callers no longer race between dedup-check and INSERT.
   *
   * On unique-violation we either reuse the winner's mission id (race case)
   * or — when the existing row is `failed` — clear its source link and retry
   * once (retry-after-failure case). Omit `source` to skip dedup entirely.
   */
  source?: {
    module: string;
    entityId: string;
    entityType: string;
  };
  /**
   * Override `mission.title`; defaults to `template.name`. Callers use this to
   * give each mission a topic-specific title ("热点追踪：xxx") instead of the
   * generic template label.
   */
  titleOverride?: string;
}

/**
 * Task 2.1 — Start a mission from a `workflow_templates` row.
 *
 * Flow:
 *   1. Auth + org resolution (bail with _global error if no org).
 *   2. Load template (scoped to current org).
 *   3. Validate user inputs against `template.inputFields` via shared `validateInputs`.
 *   4. Resolve leader employee: `owner_employee_id` → `default_team[0]` → fallback `xiaolei`.
 *   5. Build `user_instruction` by rendering `prompt_template` (or fallback param dump).
 *   6. Insert mission row with denormalized `scenario` = template.name (spec §3.3),
 *      `workflowTemplateId` = template.id, and `inputParams` = cleaned values.
 *      When `options.source` is set, write it atomically here so the partial
 *      unique index prevents race-duplicates and we never leave rows with
 *      `sourceModule=null` from a failed backfill.
 *   7. Fire-and-forget execution via `executeMissionDirect`.
 *
 * Returns either `{ok:true, missionId}` or `{ok:false, errors}` — errors can
 * be per-field (from validateInputs) or `{_global: "..."}` for higher-level
 * failures. The caller (WorkflowLaunchDialog in Task 2.2) surfaces these.
 */
export async function startMissionFromTemplate(
  templateId: string,
  inputs: Record<string, unknown>,
  options?: StartMissionOptions,
): Promise<StartMissionResult> {
  await requireAuth();

  const orgId = await getCurrentUserOrg();
  if (!orgId) {
    return { ok: false, errors: { _global: "用户未关联组织" } };
  }

  const template = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.id, templateId),
      eq(workflowTemplates.organizationId, orgId),
    ),
  });
  if (!template) {
    return { ok: false, errors: { _global: "模板不存在或无权访问" } };
  }

  const { ok, errors, cleaned } = validateInputs(
    (template.inputFields ?? []) as InputFieldDef[],
    inputs,
  );
  if (!ok) {
    return { ok: false, errors };
  }

  // Leader is ALWAYS the dedicated "任务总监" employee (slug="leader"),
  // auto-provisioned per-org. Previously this function picked the template's
  // `ownerEmployeeId` (falling back to defaultTeam[0] or xiaolei), which made
  // the leader badge land on whichever employee was first up to do work —
  // reported by the user as "每次都是排在第一个要做事情的员工". That's
  // wrong: owner/defaultTeam describe team composition, not coordination.
  const leader = await getOrProvisionLeader(orgId);

  // Team composition stays template-driven: resolve defaultTeam slugs to
  // employee ids for the mission's teamMembers column (jsonb string[] of uuid).
  // Previously this wrote the slugs directly — leaking slug strings into a
  // uuid-typed column and breaking downstream joins.
  const defaultTeamSlugs = (Array.isArray(template.defaultTeam)
    ? (template.defaultTeam as string[])
    : []);
  const teamEmployeeIds: string[] = defaultTeamSlugs.length
    ? (
        await db
          .select({ id: aiEmployees.id, slug: aiEmployees.slug })
          .from(aiEmployees)
          .where(
            and(
              eq(aiEmployees.organizationId, orgId),
              inArray(aiEmployees.slug, defaultTeamSlugs),
            ),
          )
      ).map((r) => r.id)
    : [];

  const userInstruction = buildUserInstruction(
    template.name,
    cleaned,
    template.promptTemplate,
  );

  // Spec §3.3: `scenario` stays as a denormalized label cache so downstream
  // consumers (mission-executor / leader-plan / channels gateway) that still
  // read `mission.scenario` keep working until B.2 migrates them to
  // `workflowTemplateId`. Using template.name here (human-readable) rather
  // than a slug because the slug lookup now lives on `workflowTemplateId`.
  const insertValues = {
    organizationId: orgId,
    title: options?.titleOverride ?? template.name,
    scenario: template.name,
    userInstruction,
    leaderEmployeeId: leader.id,
    workflowTemplateId: template.id,
    inputParams: cleaned,
    status: "queued" as const,
    teamMembers: teamEmployeeIds,
    sourceModule: options?.source?.module,
    sourceEntityId: options?.source?.entityId,
    sourceEntityType: options?.source?.entityType,
  };

  const tryInsert = () =>
    db.insert(missions).values(insertValues).returning({ id: missions.id });

  let missionId: string;
  try {
    const [created] = await tryInsert();
    missionId = created.id;
  } catch (err) {
    // The partial unique index `missions_source_dedup_uidx` only covers rows
    // with a non-null source_entity_id; without options.source there's
    // nothing to dedup against, so re-throw any error untouched.
    if (!isUniqueViolation(err) || !options?.source) throw err;

    // Index hit → another row already claims this (org, module, entity).
    // Decide based on its status:
    //   - non-failed → a concurrent caller won; reuse their id (race fix)
    //   - failed    → user wants to retry; release the slot then re-insert
    const existing = await db.query.missions.findFirst({
      where: and(
        eq(missions.organizationId, orgId),
        eq(missions.sourceModule, options.source.module),
        eq(missions.sourceEntityId, options.source.entityId),
      ),
      columns: { id: true, status: true },
    });
    if (!existing) throw err;

    if (existing.status === "failed") {
      await db
        .update(missions)
        .set({
          sourceModule: null,
          sourceEntityId: null,
          sourceEntityType: null,
        })
        .where(eq(missions.id, existing.id));
      const [retry] = await tryInsert();
      missionId = retry.id;
    } else {
      revalidatePath("/missions");
      revalidatePath("/workflows");
      return { ok: true, missionId: existing.id };
    }
  }

  // Bump workflow_templates run stats so the "我的工作流" card reflects the
  // latest activity. Keeps parity with the legacy executeWorkflow() path.
  await db
    .update(workflowTemplates)
    .set({
      lastRunAt: new Date(),
      runCount: sql`${workflowTemplates.runCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflowTemplates.id, template.id))
    .catch(() => {});

  // Fire-and-forget inline execution（对齐 src/app/actions/missions.ts:170 的 startMission 老路径）：
  // dev 环境下不依赖 Inngest dev server 也能推进 mission；production 同样走 executeMissionDirect。
  executeMissionDirect(missionId, orgId)
    .then(() => console.log(`[workflow-launch] mission ${missionId} completed`))
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[workflow-launch] mission ${missionId} failed:`, err);
      await db
        .update(missions)
        .set({
          status: "failed",
          completedAt: new Date(),
          finalOutput: {
            error: true,
            message: errorMsg,
            failedAt: new Date().toISOString(),
          },
        })
        .where(eq(missions.id, missionId))
        .catch(() => {});
    });

  revalidatePath("/missions");
  revalidatePath("/workflows");
  return { ok: true, missionId };
}
