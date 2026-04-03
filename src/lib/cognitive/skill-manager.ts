/**
 * Cognitive Engine — SkillManager module.
 *
 * Updates employee skill proficiency levels based on task quality scores.
 * Uses atomic SQL operations (no read-then-write) to avoid race conditions.
 *
 * Proficiency rules:
 * - score >= 80 → +3 to +5 (bonus = floor((score - 80) / 10))
 * - score 60-79 → no change
 * - score < 60  → -2
 */

import { db } from "@/db";
import { employeeSkills } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type {
  SkillLearningInput,
  SkillLearningResult,
  ProficiencyUpdate,
} from "./types";

// ---------------------------------------------------------------------------
// Main public function
// ---------------------------------------------------------------------------

export async function updateSkillStats(
  input: SkillLearningInput,
): Promise<SkillLearningResult> {
  const { employeeId, skillIds, qualityScore, passed, taskId } = input;
  const proficiencyUpdates: ProficiencyUpdate[] = [];

  // Compute the proficiency delta
  let delta = 0;
  let reason = "";

  if (qualityScore >= 80) {
    const bonus = Math.floor((qualityScore - 80) / 10);
    delta = 3 + bonus;
    reason = `高质量完成 (${qualityScore}分)，熟练度 +${delta}`;
  } else if (qualityScore < 60) {
    delta = -2;
    reason = `质量不达标 (${qualityScore}分)，熟练度 -2`;
  } else {
    reason = `质量合格 (${qualityScore}分)，熟练度不变`;
  }

  for (const skillId of skillIds) {
    try {
      // Step 1: Read current level for reporting purposes
      const current = await db
        .select({ level: employeeSkills.level })
        .from(employeeSkills)
        .where(
          and(
            eq(employeeSkills.employeeId, employeeId),
            eq(employeeSkills.skillId, skillId),
          ),
        )
        .limit(1);

      if (current.length === 0) {
        // No skill binding found — skip
        continue;
      }

      const oldLevel = current[0].level;

      // Step 2: Atomic update — clamp level between 0 and 100
      const successIncrement = passed ? 1 : 0;

      await db
        .update(employeeSkills)
        .set({
          level: sql`GREATEST(0, LEAST(100, ${employeeSkills.level} + ${delta}))`,
          usageCount: sql`${employeeSkills.usageCount} + 1`,
          successCount: sql`${employeeSkills.successCount} + ${successIncrement}`,
          lastQualityAvg: qualityScore,
        })
        .where(
          and(
            eq(employeeSkills.employeeId, employeeId),
            eq(employeeSkills.skillId, skillId),
          ),
        );

      // Compute new level (clamped) for the report
      const newLevel = Math.max(0, Math.min(100, oldLevel + delta));

      proficiencyUpdates.push({
        employeeId,
        skillId,
        oldLevel,
        newLevel,
        reason,
      });
    } catch (err) {
      console.error(
        `[SkillManager] Failed to update skill ${skillId} for employee ${employeeId}:`,
        err,
      );
      // Continue with remaining skills — don't let one failure block all
    }
  }

  return { proficiencyUpdates };
}
