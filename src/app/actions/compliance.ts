"use server";

import { db } from "@/db";
import { complianceChecks } from "@/db/schema/compliance";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { checkContentCompliance } from "@/lib/dal/compliance";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Run a compliance check on the provided content.
 * Saves the result to the database and returns detected issues.
 */
export async function runComplianceCheck(
  content: string,
  contentId?: string,
  contentType?: string
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  // Run the compliance check
  const { issues, isClean } = checkContentCompliance(content, orgId);

  // Persist the check result
  const [row] = await db
    .insert(complianceChecks)
    .values({
      organizationId: orgId,
      contentId: contentId || null,
      contentType: contentType || "draft",
      content,
      issues,
      isClean,
    })
    .returning();

  revalidatePath("/super-creation");
  revalidatePath("/batch-review");

  return {
    id: row.id,
    issues,
    isClean,
    checkedAt: row.checkedAt.toISOString(),
  };
}
