"use server";

import { db } from "@/db";
import { reviveRecommendations, styleAdaptations, internationalAdaptations, mediaAssets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { StyleVariant, InternationalAdaptation } from "@/lib/types";
export async function triggerDailyReviveScan() {
  await requireAuth();
  // Placeholder: In production, run asset matching algorithm
  revalidatePath("/asset-revive");
}

export async function respondToRecommendation(recommendationId: string, action: "adopted" | "rejected") {
  const user = await requireAuth();
  await db.update(reviveRecommendations).set({
    status: action,
    adoptedBy: user.id,
    respondedAt: new Date(),
  }).where(eq(reviveRecommendations.id, recommendationId));
  revalidatePath("/asset-revive");
}

export async function generateStyleVariant(assetId: string, targetStyle: string): Promise<StyleVariant> {
  await requireAuth();
  // Placeholder: In production, call LLM to generate style variant
  const variant: StyleVariant = {
    style: targetStyle,
    styleLabel: targetStyle === "formal" ? "正式严肃" : targetStyle === "casual" ? "轻松活泼" : targetStyle,
    title: `[${targetStyle}风格] 改编标题`,
    excerpt: `这是以${targetStyle}风格改编的内容摘要...`,
    tone: targetStyle,
  };

  // Lookup organization from asset
  const asset = await db.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, assetId) });
  if (asset) {
    await db.insert(styleAdaptations).values({
      organizationId: asset.organizationId,
      sourceAssetId: assetId,
      style: variant.style,
      styleLabel: variant.styleLabel,
      generatedTitle: variant.title,
      generatedExcerpt: variant.excerpt,
      tone: variant.tone,
    });
  }

  revalidatePath("/asset-revive");
  return variant;
}

export async function generateInternationalAdaptation(assetId: string, targetLanguage: string): Promise<InternationalAdaptation> {
  await requireAuth();
  // Placeholder: In production, call translation/adaptation LLM
  const langMap: Record<string, { code: string; flag: string }> = {
    English: { code: "en", flag: "🇺🇸" },
    Japanese: { code: "ja", flag: "🇯🇵" },
    Korean: { code: "ko", flag: "🇰🇷" },
    French: { code: "fr", flag: "🇫🇷" },
    Spanish: { code: "es", flag: "🇪🇸" },
  };

  const lang = langMap[targetLanguage] || { code: targetLanguage.toLowerCase().slice(0, 2), flag: "🌐" };

  const adaptation: InternationalAdaptation = {
    language: targetLanguage,
    languageCode: lang.code,
    flag: lang.flag,
    title: `[${targetLanguage}] Translated Title`,
    excerpt: `Adapted content in ${targetLanguage}...`,
    adaptationNotes: `Content adapted for ${targetLanguage}-speaking audience`,
    status: "completed",
  };

  const asset = await db.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, assetId) });
  if (asset) {
    await db.insert(internationalAdaptations).values({
      organizationId: asset.organizationId,
      sourceAssetId: assetId,
      language: adaptation.language,
      languageCode: adaptation.languageCode,
      flag: adaptation.flag,
      generatedTitle: adaptation.title,
      generatedExcerpt: adaptation.excerpt,
      adaptationNotes: adaptation.adaptationNotes,
      status: "completed",
    });
  }

  revalidatePath("/asset-revive");
  return adaptation;
}
