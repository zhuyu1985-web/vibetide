"use server";

import { db } from "@/db";
import { employeeScenarios } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { assertScenarioNameUnique } from "@/lib/dal/scenarios";
import { PERMISSIONS } from "@/lib/rbac-constants";
import type { InputFieldDef } from "@/lib/types";

export async function requireScenarioAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/** Scenario write ops require `ai:manage`. Super admins bypass this check
 * because getCurrentUserProfile hands them ALL_PERMISSIONS. */
async function requireManagePermission(): Promise<string> {
  const ctx = await getCurrentUserProfile();
  if (!ctx) throw new Error("Unauthorized");
  if (!ctx.permissions.includes(PERMISSIONS.AI_MANAGE)) {
    throw new Error("FORBIDDEN: 需要 AI 管理权限");
  }
  return ctx.organizationId;
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateInputFields(fields: InputFieldDef[]): void {
  if (!Array.isArray(fields)) throw new Error("inputFields 必须是数组");
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.name) throw new Error("输入参数名不能为空");
    if (!IDENT_RE.test(f.name)) {
      throw new Error(
        `输入参数名「${f.name}」不合法（只允许字母/数字/下划线，不能以数字开头）`,
      );
    }
    if (seen.has(f.name)) throw new Error(`输入参数名「${f.name}」重复`);
    seen.add(f.name);
    if (!f.label) throw new Error(`输入参数「${f.name}」缺少显示名`);
    if (!["text", "textarea", "select"].includes(f.type)) {
      throw new Error(`输入参数「${f.name}」类型不合法`);
    }
    if (f.type === "select" && (!f.options || f.options.length === 0)) {
      throw new Error(`下拉参数「${f.name}」至少需要一个选项`);
    }
  }
}

/** Returns the list of {{placeholder}} tokens in `template` that do not
 * correspond to any declared input field. Empty result = all resolved. */
function findUnresolvedPlaceholders(
  template: string,
  fieldNames: Set<string>,
): string[] {
  const matches = template.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g) ?? [];
  const unresolved: string[] = [];
  for (const m of matches) {
    const name = m.slice(2, -2).trim();
    if (!fieldNames.has(name) && !unresolved.includes(name)) {
      unresolved.push(name);
    }
  }
  return unresolved;
}

export type ScenarioWritePayload = {
  employeeSlug: string;
  name: string;
  description: string;
  icon: string;
  welcomeMessage?: string | null;
  systemInstruction: string;
  inputFields: InputFieldDef[];
  toolsHint: string[];
  sortOrder: number;
  enabled: boolean;
};

function validatePayload(payload: ScenarioWritePayload): void {
  if (!payload.employeeSlug.trim()) throw new Error("员工 slug 不能为空");
  if (!payload.name.trim()) throw new Error("场景名称不能为空");
  if (!payload.description.trim()) throw new Error("场景描述不能为空");
  if (!payload.systemInstruction.trim()) throw new Error("系统指令不能为空");
  validateInputFields(payload.inputFields);

  const fieldNames = new Set(payload.inputFields.map((f) => f.name));
  const unresolved = findUnresolvedPlaceholders(
    [payload.systemInstruction, payload.welcomeMessage ?? ""].join("\n"),
    fieldNames,
  );
  if (unresolved.length > 0) {
    throw new Error(
      `指令/欢迎词中引用了未定义的输入参数：${unresolved.map((n) => `{{${n}}}`).join(", ")}`,
    );
  }
}

function revalidateScenarioPaths(employeeSlug: string) {
  revalidatePath(`/ai-employees/${employeeSlug}`);
  revalidatePath("/home");
  revalidatePath("/chat");
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createScenario(payload: ScenarioWritePayload) {
  const orgId = await requireManagePermission();
  validatePayload(payload);
  await assertScenarioNameUnique(orgId, payload.employeeSlug, payload.name);

  const [row] = await db
    .insert(employeeScenarios)
    .values({
      organizationId: orgId,
      employeeSlug: payload.employeeSlug,
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
      welcomeMessage: payload.welcomeMessage ?? null,
      systemInstruction: payload.systemInstruction,
      inputFields: payload.inputFields,
      toolsHint: payload.toolsHint,
      sortOrder: payload.sortOrder,
      enabled: payload.enabled,
    })
    .returning({ id: employeeScenarios.id });

  revalidateScenarioPaths(payload.employeeSlug);
  return { id: row.id };
}

export async function updateScenario(
  scenarioId: string,
  payload: ScenarioWritePayload,
) {
  const orgId = await requireManagePermission();
  validatePayload(payload);

  const existing = await db.query.employeeScenarios.findFirst({
    where: and(
      eq(employeeScenarios.id, scenarioId),
      eq(employeeScenarios.organizationId, orgId),
    ),
  });
  if (!existing) throw new Error("场景不存在或无权操作");
  if (existing.employeeSlug !== payload.employeeSlug) {
    throw new Error("不允许跨员工修改场景");
  }

  if (existing.name !== payload.name) {
    await assertScenarioNameUnique(
      orgId,
      payload.employeeSlug,
      payload.name,
      scenarioId,
    );
  }

  await db
    .update(employeeScenarios)
    .set({
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
      welcomeMessage: payload.welcomeMessage ?? null,
      systemInstruction: payload.systemInstruction,
      inputFields: payload.inputFields,
      toolsHint: payload.toolsHint,
      sortOrder: payload.sortOrder,
      enabled: payload.enabled,
      updatedAt: new Date(),
    })
    .where(eq(employeeScenarios.id, scenarioId));

  revalidateScenarioPaths(payload.employeeSlug);
  return { id: scenarioId };
}

export async function toggleScenarioEnabled(
  scenarioId: string,
  enabled: boolean,
) {
  const orgId = await requireManagePermission();
  const existing = await db.query.employeeScenarios.findFirst({
    where: and(
      eq(employeeScenarios.id, scenarioId),
      eq(employeeScenarios.organizationId, orgId),
    ),
  });
  if (!existing) throw new Error("场景不存在或无权操作");

  await db
    .update(employeeScenarios)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(employeeScenarios.id, scenarioId));

  revalidateScenarioPaths(existing.employeeSlug);
}

export async function deleteScenario(scenarioId: string) {
  const orgId = await requireManagePermission();
  const existing = await db.query.employeeScenarios.findFirst({
    where: and(
      eq(employeeScenarios.id, scenarioId),
      eq(employeeScenarios.organizationId, orgId),
    ),
  });
  if (!existing) throw new Error("场景不存在或无权操作");

  await db
    .delete(employeeScenarios)
    .where(eq(employeeScenarios.id, scenarioId));

  revalidateScenarioPaths(existing.employeeSlug);
}

/** Persist a new ordering for one employee's scenarios. IDs not in the
 * caller's org are skipped instead of erroring, so concurrent deletes can't
 * fail the whole reorder. */
export async function reorderScenarios(
  employeeSlug: string,
  orderedIds: string[],
) {
  const orgId = await requireManagePermission();
  if (orderedIds.length === 0) return;

  const rows = await db
    .select({ id: employeeScenarios.id })
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, orgId),
        eq(employeeScenarios.employeeSlug, employeeSlug),
        inArray(employeeScenarios.id, orderedIds),
      ),
    );
  const valid = new Set(rows.map((r) => r.id));

  await db.transaction(async (tx) => {
    let index = 0;
    for (const id of orderedIds) {
      if (!valid.has(id)) continue;
      await tx
        .update(employeeScenarios)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(employeeScenarios.id, id));
      index += 1;
    }
  });

  revalidateScenarioPaths(employeeSlug);
}
