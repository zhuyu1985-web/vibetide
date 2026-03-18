"use server";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema/ai-employees";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { WORK_PREFERENCE_TEMPLATES } from "@/lib/constants";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * M4.F22: Apply a work preference template to an AI employee.
 * Looks up the template from constants and updates the employee's workPreferences.
 */
export async function applyWorkPreferenceTemplate(
  employeeId: string,
  templateKey: string
) {
  await requireAuth();

  const template =
    WORK_PREFERENCE_TEMPLATES[
      templateKey as keyof typeof WORK_PREFERENCE_TEMPLATES
    ];
  if (!template) {
    throw new Error(`未知的偏好模板: ${templateKey}`);
  }

  await db
    .update(aiEmployees)
    .set({
      workPreferences: {
        proactivity: template.preferences.proactivity,
        reportingFrequency: template.preferences.reportingFrequency,
        autonomyLevel: template.preferences.autonomyLevel,
        communicationStyle: template.preferences.communicationStyle,
        workingHours: template.preferences.workingHours,
      },
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee");
  revalidatePath("/approvals");
}
