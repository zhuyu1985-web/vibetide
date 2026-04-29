"use server";

import { db } from "@/db";
import {
  userFeedback,
  effectAttributions,
} from "@/db/schema/user-feedback";
import { aiEmployees } from "@/db/schema/ai-employees";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";

// ---------------------------------------------------------------------------
// Auth helper (local, same pattern as other action files)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// M4.F144 — Submit user feedback on AI output
// ---------------------------------------------------------------------------

export async function submitFeedback(data: {
  workflowInstanceId?: string;
  stepKey?: string;
  employeeId?: string;
  feedbackType: "accept" | "reject" | "edit";
  originalContent?: string;
  editedContent?: string;
}) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  await db.insert(userFeedback).values({
    organizationId: orgId,
    userId: user.id,
    workflowInstanceId: data.workflowInstanceId ?? null,
    stepKey: data.stepKey ?? null,
    employeeId: data.employeeId ?? null,
    feedbackType: data.feedbackType,
    originalContent: data.originalContent ?? null,
    editedContent: data.editedContent ?? null,
  });

  revalidatePath("/employee");
  revalidatePath("/missions");
}

// ---------------------------------------------------------------------------
// M4.F149 — Delete an incorrect learned pattern
// ---------------------------------------------------------------------------

export async function deleteLearnedPattern(
  employeeId: string,
  patternKey: string
) {
  await requireAuth();

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
    columns: { learnedPatterns: true },
  });

  if (!emp) throw new Error("Employee not found");

  const patterns = (emp.learnedPatterns ?? {}) as Record<
    string,
    {
      source: "human_feedback" | "quality_review" | "self_reflection";
      count: number;
      lastSeen: string;
    }
  >;

  if (!(patternKey in patterns)) {
    throw new Error("Pattern not found");
  }

  delete patterns[patternKey];

  await db
    .update(aiEmployees)
    .set({ learnedPatterns: patterns, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee");
}

// ---------------------------------------------------------------------------
// M4.F146 — Attribute published content effect to employee/workflow
// ---------------------------------------------------------------------------

export async function attributeEffect(data: {
  publishPlanId: string;
  workflowInstanceId: string;
  employeeId: string;
  reach: Record<string, number>;
  engagement: Record<string, number>;
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  await db.insert(effectAttributions).values({
    organizationId: orgId,
    publishPlanId: data.publishPlanId,
    workflowInstanceId: data.workflowInstanceId,
    employeeId: data.employeeId,
    reach: data.reach,
    engagement: data.engagement,
  });

  revalidatePath("/employee");
  revalidatePath("/analytics");
}
