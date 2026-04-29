"use server";

import { db } from "@/db";
import { caseLibrary, hitPredictions, competitorHits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
// --- Case Library (F3.3.02) ---

export async function addToCaseLibrary(data: {
  contentId: string;
  title: string;
  channel?: string;
  score: number;
  successFactors?: {
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  };
  tags?: string[];
  publishedAt?: string;
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(caseLibrary)
    .values({
      organizationId: orgId,
      contentId: data.contentId,
      title: data.title,
      channel: data.channel || null,
      score: data.score,
      successFactors: data.successFactors || null,
      tags: data.tags || [],
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    })
    .returning();

  revalidatePath("/case-library");
  return row;
}

// --- Hit Predictions (F3.3.03) ---

export async function createHitPrediction(data: {
  contentId: string;
  predictedScore: number;
  dimensions?: {
    titleAppeal?: number;
    topicRelevance?: number;
    contentDepth?: number;
    emotionalHook?: number;
    timingFit?: number;
  };
  suggestions?: {
    area: string;
    current: string;
    recommended: string;
    impact: string;
  }[];
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(hitPredictions)
    .values({
      organizationId: orgId,
      contentId: data.contentId,
      predictedScore: data.predictedScore,
      dimensions: data.dimensions || null,
      suggestions: data.suggestions || [],
    })
    .returning();

  revalidatePath("/content-excellence");
  return row;
}

export async function updateHitPredictionActual(
  predictionId: string,
  actualScore: number
) {
  await requireAuth();

  await db
    .update(hitPredictions)
    .set({ actualScore })
    .where(eq(hitPredictions.id, predictionId));

  revalidatePath("/content-excellence");
}

// --- Competitor Hits (F3.3.01) ---

export async function addCompetitorHit(data: {
  competitorName: string;
  title: string;
  platform: string;
  metrics?: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  successFactors?: {
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  };
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(competitorHits)
    .values({
      organizationId: orgId,
      competitorName: data.competitorName,
      title: data.title,
      platform: data.platform,
      metrics: data.metrics || null,
      successFactors: data.successFactors || null,
    })
    .returning();

  revalidatePath("/content-excellence");
  return row;
}
