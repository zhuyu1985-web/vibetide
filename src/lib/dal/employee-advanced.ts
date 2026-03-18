import { db } from "@/db";
import { employeeConfigVersions } from "@/db/schema/employee-versions";
import { skillCombos } from "@/db/schema/skill-combos";
import { skills } from "@/db/schema/skills";
import { eq, desc, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Version History
// ---------------------------------------------------------------------------

export async function getConfigVersions(
  employeeId: string,
  limit: number = 20
) {
  return db
    .select()
    .from(employeeConfigVersions)
    .where(eq(employeeConfigVersions.employeeId, employeeId))
    .orderBy(desc(employeeConfigVersions.version))
    .limit(limit);
}

export async function getConfigVersion(versionId: string) {
  const rows = await db
    .select()
    .from(employeeConfigVersions)
    .where(eq(employeeConfigVersions.id, versionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestVersion(
  employeeId: string
): Promise<number> {
  const rows = await db
    .select({ version: employeeConfigVersions.version })
    .from(employeeConfigVersions)
    .where(eq(employeeConfigVersions.employeeId, employeeId))
    .orderBy(desc(employeeConfigVersions.version))
    .limit(1);
  return rows[0]?.version ?? 0;
}

export async function createConfigVersion(
  employeeId: string,
  snapshot: Record<string, unknown>,
  changedBy: string | null,
  changedFields: string[],
  changeDescription?: string
) {
  const latestVersion = await getLatestVersion(employeeId);
  const [version] = await db
    .insert(employeeConfigVersions)
    .values({
      employeeId,
      version: latestVersion + 1,
      snapshot,
      changedBy,
      changedFields,
      changeDescription,
    })
    .returning();
  return version;
}

// ---------------------------------------------------------------------------
// Skill Combos
// ---------------------------------------------------------------------------

export async function getSkillCombos(orgId: string) {
  const combos = await db
    .select()
    .from(skillCombos)
    .where(eq(skillCombos.organizationId, orgId))
    .orderBy(desc(skillCombos.createdAt));

  // Resolve skill names for each combo
  const result = [];
  for (const combo of combos) {
    const ids = (combo.skillIds as string[]) || [];
    let resolvedSkills: { id: string; name: string }[] = [];
    if (ids.length > 0) {
      const skillRows = await db
        .select({ id: skills.id, name: skills.name })
        .from(skills)
        .where(inArray(skills.id, ids));
      // Preserve order from skillIds
      const skillMap = new Map(skillRows.map((s) => [s.id, s.name]));
      resolvedSkills = ids
        .filter((id) => skillMap.has(id))
        .map((id) => ({ id, name: skillMap.get(id)! }));
    }
    result.push({ ...combo, resolvedSkills });
  }

  return result;
}

export async function getSkillCombo(comboId: string) {
  const rows = await db
    .select()
    .from(skillCombos)
    .where(eq(skillCombos.id, comboId))
    .limit(1);

  const combo = rows[0];
  if (!combo) return null;

  const ids = (combo.skillIds as string[]) || [];
  let resolvedSkills: { id: string; name: string }[] = [];
  if (ids.length > 0) {
    const skillRows = await db
      .select({ id: skills.id, name: skills.name })
      .from(skills)
      .where(inArray(skills.id, ids));
    const skillMap = new Map(skillRows.map((s) => [s.id, s.name]));
    resolvedSkills = ids
      .filter((id) => skillMap.has(id))
      .map((id) => ({ id, name: skillMap.get(id)! }));
  }

  return { ...combo, resolvedSkills };
}
