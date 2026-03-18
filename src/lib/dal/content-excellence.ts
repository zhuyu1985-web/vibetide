import { db } from "@/db";
import {
  caseLibrary,
  hitPredictions,
  competitorHits,
} from "@/db/schema";
import { eq, desc, gte } from "drizzle-orm";
import type {
  CaseLibraryItem,
  HitPrediction,
  CompetitorHit,
} from "@/lib/types";

export async function getCaseLibraryItems(
  organizationId?: string,
  limit = 50
): Promise<CaseLibraryItem[]> {
  const rows = await db.query.caseLibrary.findMany({
    ...(organizationId
      ? { where: eq(caseLibrary.organizationId, organizationId) }
      : {}),
    orderBy: [desc(caseLibrary.score)],
    limit,
  });

  return rows.map((item) => ({
    id: item.id,
    contentId: item.contentId,
    title: item.title,
    channel: item.channel,
    score: item.score,
    successFactors: item.successFactors,
    tags: (item.tags as string[]) || [],
    publishedAt: item.publishedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function getHitPredictions(
  organizationId?: string,
  limit = 20
): Promise<HitPrediction[]> {
  const rows = await db.query.hitPredictions.findMany({
    ...(organizationId
      ? { where: eq(hitPredictions.organizationId, organizationId) }
      : {}),
    orderBy: [desc(hitPredictions.createdAt)],
    limit,
  });

  return rows.map((p) => ({
    id: p.id,
    contentId: p.contentId,
    predictedScore: p.predictedScore,
    actualScore: p.actualScore,
    dimensions: p.dimensions,
    suggestions: (p.suggestions as HitPrediction["suggestions"]) || [],
    suggestionsAdopted: p.suggestionsAdopted || 0,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getCompetitorHits(
  organizationId?: string,
  limit = 20
): Promise<CompetitorHit[]> {
  const rows = await db.query.competitorHits.findMany({
    ...(organizationId
      ? { where: eq(competitorHits.organizationId, organizationId) }
      : {}),
    orderBy: [desc(competitorHits.analyzedAt)],
    limit,
  });

  return rows.map((h) => ({
    id: h.id,
    competitorName: h.competitorName,
    title: h.title,
    platform: h.platform,
    metrics: h.metrics,
    successFactors: h.successFactors,
    analyzedAt: h.analyzedAt.toISOString(),
  }));
}
