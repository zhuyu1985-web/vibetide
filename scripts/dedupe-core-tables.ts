/**
 * One-time cleanup: dedupe ai_employees, skills, knowledge_bases, and the
 * employee_skills / employee_knowledge_bases join tables.
 *
 * These tables all had the same bug pattern as the now-dropped
 * `employee_scenarios` table:
 *   - No unique constraint on the natural key
 *   - Seed writes / server-action auto-provision uses plain INSERT
 *   - Re-runs / races accumulate duplicate rows
 *
 * Migration 0028 adds the unique indexes. This script removes any existing
 * duplicates so the index can build.
 *
 * Strategy for each table:
 *   - Group by the natural key, keep the earliest-created row as "keeper"
 *   - Repoint any foreign-key references from loser rows to the keeper
 *   - Delete the loser rows
 *
 * Usage:
 *   npx tsx scripts/dedupe-core-tables.ts            # dry run
 *   npx tsx scripts/dedupe-core-tables.ts --execute  # actually delete
 *
 * Deploy order:
 *   1. Run this in --execute mode
 *   2. `npm run db:migrate` (adds indexes — fails if step 1 skipped)
 *   3. Deploy code
 */
import { db } from "@/db";
import {
  aiEmployees,
  skills,
  employeeSkills,
  knowledgeBases,
  employeeKnowledgeBases,
  missions,
  missionTasks,
  missionArtifacts,
  missionMessages,
  employeeMemories,
} from "@/db/schema";
import { sql, inArray } from "drizzle-orm";

const DRY_RUN = !process.argv.includes("--execute");

// ─── ai_employees ────────────────────────────────────────────────────────

async function findAiEmployeeDuplicates() {
  return db.execute<{
    organization_id: string;
    slug: string;
    ids: string[];
  }>(sql`
    SELECT organization_id, slug, array_agg(id ORDER BY created_at ASC) AS ids
    FROM ai_employees
    GROUP BY organization_id, slug
    HAVING COUNT(*) > 1
  `);
}

async function mergeAiEmployee(ids: string[]) {
  const [keeper, ...losers] = ids;
  if (losers.length === 0) return;

  // Repoint every table that references ai_employees.id.
  await db.update(missions).set({ leaderEmployeeId: keeper }).where(inArray(missions.leaderEmployeeId, losers));
  await db.update(missionTasks).set({ assignedEmployeeId: keeper }).where(inArray(missionTasks.assignedEmployeeId, losers));
  await db.update(missionArtifacts).set({ producedBy: keeper }).where(inArray(missionArtifacts.producedBy, losers));
  await db.update(missionMessages).set({ fromEmployeeId: keeper }).where(inArray(missionMessages.fromEmployeeId, losers));
  await db.update(missionMessages).set({ toEmployeeId: keeper }).where(inArray(missionMessages.toEmployeeId, losers));
  await db.update(employeeMemories).set({ employeeId: keeper }).where(inArray(employeeMemories.employeeId, losers));

  // `missions.team_members` is a JSONB string[] — rewrite any array entries
  // that reference a loser UUID so the keeper stays in the team.
  for (const loser of losers) {
    await db.execute(sql`
      UPDATE missions
      SET team_members = (
        SELECT jsonb_agg(DISTINCT CASE WHEN m = ${loser} THEN ${keeper}::text ELSE m END)
        FROM jsonb_array_elements_text(team_members) m
      )
      WHERE team_members @> ${JSON.stringify([loser])}::jsonb
    `);
  }

  // employee_skills / employee_knowledge_bases are cascade-delete, but we
  // want to keep their rows under the keeper. Delete the loser's bindings
  // first to avoid collisions on the (employee_id, skill_id) unique index
  // we're about to create — the keeper already has its own bindings.
  await db.delete(employeeSkills).where(inArray(employeeSkills.employeeId, losers));
  await db.delete(employeeKnowledgeBases).where(inArray(employeeKnowledgeBases.employeeId, losers));

  await db.delete(aiEmployees).where(inArray(aiEmployees.id, losers));
}

// ─── skills ──────────────────────────────────────────────────────────────

async function findSkillDuplicates() {
  return db.execute<{
    organization_id: string | null;
    name: string;
    ids: string[];
  }>(sql`
    SELECT organization_id, name, array_agg(id ORDER BY created_at ASC) AS ids
    FROM skills
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id, name
    HAVING COUNT(*) > 1
  `);
}

async function mergeSkill(ids: string[]) {
  const [keeper, ...losers] = ids;
  if (losers.length === 0) return;

  // Repoint employee_skills bindings, dropping any that would collide with
  // an existing keeper binding (unique index enforces one per employee).
  await db.execute(sql`
    DELETE FROM employee_skills es
    WHERE es.skill_id = ANY(${losers}::uuid[])
      AND EXISTS (
        SELECT 1 FROM employee_skills keep
        WHERE keep.skill_id = ${keeper}::uuid
          AND keep.employee_id = es.employee_id
      )
  `);
  await db
    .update(employeeSkills)
    .set({ skillId: keeper })
    .where(inArray(employeeSkills.skillId, losers));

  await db.delete(skills).where(inArray(skills.id, losers));
}

// ─── knowledge_bases ─────────────────────────────────────────────────────

async function findKbDuplicates() {
  return db.execute<{
    organization_id: string;
    name: string;
    ids: string[];
  }>(sql`
    SELECT organization_id, name, array_agg(id ORDER BY created_at ASC) AS ids
    FROM knowledge_bases
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id, name
    HAVING COUNT(*) > 1
  `);
}

async function mergeKb(ids: string[]) {
  const [keeper, ...losers] = ids;
  if (losers.length === 0) return;

  await db.execute(sql`
    DELETE FROM employee_knowledge_bases ek
    WHERE ek.knowledge_base_id = ANY(${losers}::uuid[])
      AND EXISTS (
        SELECT 1 FROM employee_knowledge_bases keep
        WHERE keep.knowledge_base_id = ${keeper}::uuid
          AND keep.employee_id = ek.employee_id
      )
  `);
  await db
    .update(employeeKnowledgeBases)
    .set({ knowledgeBaseId: keeper })
    .where(inArray(employeeKnowledgeBases.knowledgeBaseId, losers));

  // knowledge_items + knowledge_sync_logs cascade-delete on loser KB.
  await db.delete(knowledgeBases).where(inArray(knowledgeBases.id, losers));
}

// ─── join-table duplicates ───────────────────────────────────────────────

async function findEmployeeSkillDuplicates() {
  return db.execute<{ employee_id: string; skill_id: string; ids: string[] }>(sql`
    SELECT employee_id, skill_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM employee_skills
    GROUP BY employee_id, skill_id
    HAVING COUNT(*) > 1
  `);
}

async function findEmployeeKbDuplicates() {
  return db.execute<{ employee_id: string; knowledge_base_id: string; ids: string[] }>(sql`
    SELECT employee_id, knowledge_base_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM employee_knowledge_bases
    GROUP BY employee_id, knowledge_base_id
    HAVING COUNT(*) > 1
  `);
}

// ─── main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[dedupe-core-tables] mode = ${DRY_RUN ? "DRY RUN" : "EXECUTE"}`);

  const empDups = await findAiEmployeeDuplicates();
  console.log(`  ai_employees duplicate groups: ${empDups.length}`);

  const skillDups = await findSkillDuplicates();
  console.log(`  skills duplicate groups: ${skillDups.length}`);

  const kbDups = await findKbDuplicates();
  console.log(`  knowledge_bases duplicate groups: ${kbDups.length}`);

  const esDups = await findEmployeeSkillDuplicates();
  console.log(`  employee_skills duplicate groups: ${esDups.length}`);

  const ekDups = await findEmployeeKbDuplicates();
  console.log(`  employee_knowledge_bases duplicate groups: ${ekDups.length}`);

  if (DRY_RUN) {
    console.log("[dedupe-core-tables] dry run — no changes. Re-run with --execute.");
    return;
  }

  // Order: join tables first (they reference parents), then parents.
  for (const g of esDups) {
    const [, ...losers] = g.ids;
    if (losers.length > 0) {
      await db.delete(employeeSkills).where(inArray(employeeSkills.id, losers));
    }
  }
  for (const g of ekDups) {
    const [, ...losers] = g.ids;
    if (losers.length > 0) {
      await db.delete(employeeKnowledgeBases).where(inArray(employeeKnowledgeBases.id, losers));
    }
  }
  for (const g of empDups) await mergeAiEmployee(g.ids);
  for (const g of skillDups) await mergeSkill(g.ids);
  for (const g of kbDups) await mergeKb(g.ids);

  // Note: the former `employee_scenarios` dedupe path is gone — the table was
  // dropped in migration 20260420_drop_employee_scenarios.

  console.log("[dedupe-core-tables] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
