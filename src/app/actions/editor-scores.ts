"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { awardPoints } from "@/lib/dal/editor-scores";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ---------------------------------------------------------------------------
// awardEditorPoints — 给编辑发放积分 (M3.F29)
// ---------------------------------------------------------------------------

export async function awardEditorPoints(
  userId: string,
  userName: string,
  points: number,
  reason: string,
  referenceId?: string
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  await awardPoints(userId, orgId, userName, points, reason, referenceId);

  revalidatePath("/leaderboard");
  revalidatePath("/publishing");
}
