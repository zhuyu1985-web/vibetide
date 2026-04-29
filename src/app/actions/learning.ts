"use server";

import { db } from "@/db";
import { employeeMemories } from "@/db/schema/employee-memories";
import { aiEmployees } from "@/db/schema/ai-employees";
import { userFeedback } from "@/db/schema/user-feedback";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
// ---------------------------------------------------------------------------
// Add a learning memory manually
// ---------------------------------------------------------------------------

export async function addLearningMemory(
  employeeId: string,
  content: string,
  memoryType: "feedback" | "pattern" | "preference",
  importance: number = 0.5,
  source: string = "manual"
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  await db.insert(employeeMemories).values({
    employeeId,
    organizationId: orgId,
    memoryType,
    content,
    source,
    importance,
  });

  revalidatePath("/employee");
}

// ---------------------------------------------------------------------------
// Add or reinforce a learned pattern
// ---------------------------------------------------------------------------

export async function addLearnedPattern(
  employeeId: string,
  patternKey: string,
  source: string = "manual"
) {
  await requireAuth();

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
    columns: { learnedPatterns: true },
  });
  if (!emp) throw new Error("Employee not found");

  type PatternSource = "human_feedback" | "quality_review" | "self_reflection";
  const patterns = (emp.learnedPatterns ?? {}) as Record<
    string,
    { source: PatternSource; count: number; lastSeen: string }
  >;

  const validSource = (["human_feedback", "quality_review", "self_reflection"] as PatternSource[]).includes(source as PatternSource)
    ? (source as PatternSource)
    : "self_reflection";

  if (patterns[patternKey]) {
    patterns[patternKey].count += 1;
    patterns[patternKey].lastSeen = new Date().toISOString();
  } else {
    patterns[patternKey] = {
      source: validSource,
      count: 1,
      lastSeen: new Date().toISOString(),
    };
  }

  await db
    .update(aiEmployees)
    .set({ learnedPatterns: patterns, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee");
}

// ---------------------------------------------------------------------------
// Trigger learning from accumulated feedback
// ---------------------------------------------------------------------------

export async function triggerLearningFromFeedback(employeeId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  // Get feedback stats by stepKey
  const feedbackRows = await db
    .select({
      feedbackType: userFeedback.feedbackType,
      stepKey: userFeedback.stepKey,
      cnt: count(),
    })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.employeeId, employeeId),
        eq(userFeedback.organizationId, orgId)
      )
    )
    .groupBy(userFeedback.feedbackType, userFeedback.stepKey);

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
    columns: { learnedPatterns: true },
  });
  if (!emp) throw new Error("Employee not found");

  type PatternSource2 = "human_feedback" | "quality_review" | "self_reflection";
  const patterns = (emp.learnedPatterns ?? {}) as Record<
    string,
    { source: PatternSource2; count: number; lastSeen: string }
  >;

  let newPatternsCount = 0;
  const now = new Date().toISOString();

  for (const row of feedbackRows) {
    const feedbackCount = row.cnt;
    const stepKey = row.stepKey || "general";

    if (row.feedbackType === "reject" && feedbackCount >= 2) {
      const patternKey = `避免: ${stepKey} 步骤常见拒绝原因`;
      if (!patterns[patternKey]) {
        patterns[patternKey] = {
          source: "human_feedback",
          count: feedbackCount,
          lastSeen: now,
        };
        newPatternsCount++;
      } else {
        patterns[patternKey].count = feedbackCount;
        patterns[patternKey].lastSeen = now;
      }
    }

    if (row.feedbackType === "edit" && feedbackCount >= 3) {
      const patternKey = `改进: ${stepKey} 步骤输出需要人工调整`;
      if (!patterns[patternKey]) {
        patterns[patternKey] = {
          source: "human_feedback",
          count: feedbackCount,
          lastSeen: now,
        };
        newPatternsCount++;
      } else {
        patterns[patternKey].count = feedbackCount;
        patterns[patternKey].lastSeen = now;
      }
    }

    if (row.feedbackType === "accept" && feedbackCount >= 5) {
      const patternKey = `保持: ${stepKey} 步骤输出质量良好`;
      if (!patterns[patternKey]) {
        patterns[patternKey] = {
          source: "human_feedback",
          count: feedbackCount,
          lastSeen: now,
        };
        newPatternsCount++;
      } else {
        patterns[patternKey].count = feedbackCount;
        patterns[patternKey].lastSeen = now;
      }
    }
  }

  // Update patterns
  await db
    .update(aiEmployees)
    .set({ learnedPatterns: patterns, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  // Add a memory record about this learning session
  await db.insert(employeeMemories).values({
    employeeId,
    organizationId: orgId,
    memoryType: "feedback",
    content: `从 ${feedbackRows.length} 条反馈数据中学习，提取了 ${newPatternsCount} 个新模式`,
    source: "learning_engine",
    importance: 0.7,
  });

  revalidatePath("/employee");
  return { newPatternsCount, totalFeedbackGroups: feedbackRows.length };
}
