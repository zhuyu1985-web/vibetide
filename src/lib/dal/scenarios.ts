import { db } from "@/db";
import { employeeScenarios } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { ScenarioCardData, InputFieldDef } from "@/lib/types";

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
    .orderBy(asc(employeeScenarios.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
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
    .orderBy(asc(employeeScenarios.sortOrder));

  const map: Record<string, ScenarioCardData[]> = {};
  for (const r of rows) {
    const item: ScenarioCardData = {
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
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
