"use server";

import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { awardPoints } from "@/lib/dal/editor-scores";
import { revalidatePath } from "next/cache";
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
