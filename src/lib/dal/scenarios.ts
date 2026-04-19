import { db } from "@/db";
import { employeeScenarios } from "@/db/schema";
import { and, eq, asc, not } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { ScenarioCardData, InputFieldDef } from "@/lib/types";

export type ScenarioAdminRow = {
  id: string;
  employeeSlug: string;
  name: string;
  description: string;
  icon: string;
  welcomeMessage: string | null;
  systemInstruction: string;
  inputFields: InputFieldDef[];
  toolsHint: string[];
  sortOrder: number;
  enabled: boolean;
};

export async function getScenariosByEmployeeSlug(
  slug: string
): Promise<ScenarioCardData[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db
    .select()
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, orgId),
        eq(employeeScenarios.employeeSlug, slug),
        eq(employeeScenarios.enabled, true)
      )
    )
    .orderBy(asc(employeeScenarios.sortOrder), asc(employeeScenarios.createdAt));

  // Defensive dedup: the (org, slug, name) unique index is added in migration
  // 0027, but existing databases may still have duplicate rows from prior
  // un-guarded seeds. Keep the earliest row per scenario name so the UI never
  // shows duplicates even before the one-time cleanup script runs.
  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const r of rows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    unique.push(r);
  }

  return unique.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    welcomeMessage: r.welcomeMessage,
    inputFields: (r.inputFields ?? []) as InputFieldDef[],
    toolsHint: (r.toolsHint ?? []) as string[],
  }));
}

/** Load all enabled scenarios grouped by employee slug — single query, no N+1. */
export async function getAllScenariosByOrg(): Promise<Record<string, ScenarioCardData[]>> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return {};

  const rows = await db
    .select()
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, orgId),
        eq(employeeScenarios.enabled, true)
      )
    )
    .orderBy(asc(employeeScenarios.sortOrder), asc(employeeScenarios.createdAt));

  // Defensive dedup per employee by scenario name — see comment in
  // getScenariosByEmployeeSlug. Removes pre-existing duplicates in the DB
  // before the cleanup script has run.
  const map: Record<string, ScenarioCardData[]> = {};
  const seenPerSlug = new Map<string, Set<string>>();
  for (const r of rows) {
    let seen = seenPerSlug.get(r.employeeSlug);
    if (!seen) {
      seen = new Set<string>();
      seenPerSlug.set(r.employeeSlug, seen);
    }
    if (seen.has(r.name)) continue;
    seen.add(r.name);

    const item: ScenarioCardData = {
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      welcomeMessage: r.welcomeMessage,
      inputFields: (r.inputFields ?? []) as InputFieldDef[],
      toolsHint: (r.toolsHint ?? []) as string[],
    };
    (map[r.employeeSlug] ??= []).push(item);
  }
  return map;
}

export async function getScenarioById(id: string) {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return null;

  const row = await db.query.employeeScenarios.findFirst({
    where: and(
      eq(employeeScenarios.id, id),
      eq(employeeScenarios.organizationId, orgId)
    ),
  });

  return row ?? null;
}

/**
 * Admin-list view: returns ALL scenarios (including disabled) for an employee.
 * Used by the employee detail "预设场景" tab to manage the full list.
 */
export async function listScenariosForEmployeeAdmin(
  employeeSlug: string,
): Promise<ScenarioAdminRow[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db
    .select()
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, orgId),
        eq(employeeScenarios.employeeSlug, employeeSlug),
      ),
    )
    .orderBy(asc(employeeScenarios.sortOrder), asc(employeeScenarios.createdAt));

  return rows.map((r) => ({
    id: r.id,
    employeeSlug: r.employeeSlug,
    name: r.name,
    description: r.description,
    icon: r.icon,
    welcomeMessage: r.welcomeMessage,
    systemInstruction: r.systemInstruction,
    inputFields: (r.inputFields ?? []) as InputFieldDef[],
    toolsHint: (r.toolsHint ?? []) as string[],
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  }));
}

/** Asserts that a scenario with the given name does not already exist
 * under the same (org, employee). Pass `exceptId` when updating a row so
 * the row being edited is excluded from the check. */
export async function assertScenarioNameUnique(
  orgId: string,
  employeeSlug: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const existing = await db
    .select({ id: employeeScenarios.id })
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, orgId),
        eq(employeeScenarios.employeeSlug, employeeSlug),
        eq(employeeScenarios.name, name),
        exceptId ? not(eq(employeeScenarios.id, exceptId)) : undefined,
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`场景名称「${name}」已存在`);
  }
}
