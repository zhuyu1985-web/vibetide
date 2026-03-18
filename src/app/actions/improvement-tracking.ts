"use server";

import { db } from "@/db";
import { improvementTrackings } from "@/db/schema/improvement-tracking";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
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
 * Create a new improvement tracking record for a suggestion.
 */
export async function createImprovementTracking(
  suggestion: string,
  source: string,
  baselineMetrics: Record<string, number>
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(improvementTrackings)
    .values({
      organizationId: orgId,
      suggestion,
      suggestionSource: source,
      baselineMetrics,
      status: "pending",
    })
    .returning();

  revalidatePath("/benchmarking");
  return row;
}

/**
 * Mark a suggestion as adopted. Sets adoptedAt and trackUntil (7 days from now).
 */
export async function adoptSuggestion(trackingId: string) {
  await requireAuth();

  const now = new Date();
  const trackUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db
    .update(improvementTrackings)
    .set({
      status: "adopted",
      adoptedAt: now,
      trackUntil,
    })
    .where(eq(improvementTrackings.id, trackingId));

  revalidatePath("/benchmarking");
}

/**
 * Update current metrics for a tracking and compute the effect score.
 * Effect score = average improvement percentage across all metric keys.
 */
export async function updateTrackingMetrics(
  trackingId: string,
  currentMetrics: Record<string, number>
) {
  await requireAuth();

  const trackingRows = await db
    .select()
    .from(improvementTrackings)
    .where(eq(improvementTrackings.id, trackingId))
    .limit(1);

  const tracking = trackingRows[0];

  if (!tracking) throw new Error("Tracking not found");

  const baseline = (tracking.baselineMetrics as Record<string, number>) || {};

  // Compute effect score: average improvement percentage
  let totalImprovement = 0;
  let metricCount = 0;

  for (const key of Object.keys(currentMetrics)) {
    if (baseline[key] !== undefined && baseline[key] !== 0) {
      const improvement =
        ((currentMetrics[key] - baseline[key]) / Math.abs(baseline[key])) * 100;
      totalImprovement += improvement;
      metricCount++;
    }
  }

  const effectScore =
    metricCount > 0 ? Math.round((totalImprovement / metricCount) * 100) / 100 : 0;

  // Determine if tracking is complete
  const trackUntil = tracking.trackUntil;
  const isComplete = trackUntil && new Date() >= trackUntil;

  await db
    .update(improvementTrackings)
    .set({
      currentMetrics,
      effectScore,
      status: isComplete ? "completed" : "tracking",
    })
    .where(eq(improvementTrackings.id, trackingId));

  revalidatePath("/benchmarking");

  return { effectScore, status: isComplete ? "completed" : "tracking" };
}
