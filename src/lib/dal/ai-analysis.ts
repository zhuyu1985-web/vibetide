import { db } from "@/db";
import { articleAiAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { AIAnalysisCacheItem } from "@/app/(dashboard)/articles/[id]/types";

export async function getAIAnalysisCache(articleId: string): Promise<AIAnalysisCacheItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  try {
    const rows = await db
      .select()
      .from(articleAiAnalysis)
      .where(eq(articleAiAnalysis.articleId, articleId));

    return rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      perspective: r.perspective as AIAnalysisCacheItem["perspective"],
      analysisText: r.analysisText,
      sentiment: r.sentiment as AIAnalysisCacheItem["sentiment"] ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      generatedAt: r.generatedAt.toISOString(),
    }));
  } catch {
    console.warn("[dal/ai-analysis] getAIAnalysisCache failed, returning []");
    return [];
  }
}
