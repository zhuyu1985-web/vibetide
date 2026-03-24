"use server";

import { db } from "@/db";
import { articleAiAnalysis, articleChatHistory } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  AIAnalysisPerspective,
  AISentiment,
} from "@/app/(dashboard)/articles/[id]/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function cacheAIAnalysis(
  articleId: string,
  perspective: AIAnalysisPerspective,
  analysisText: string,
  sentiment?: AISentiment,
  metadata?: Record<string, unknown>
) {
  const user = await requireAuth();

  // Derive organizationId from user profile metadata (populated at sign-up)
  const organizationId: string =
    (user.user_metadata?.organization_id as string | undefined) ?? "";

  await db
    .insert(articleAiAnalysis)
    .values({
      articleId,
      organizationId,
      perspective,
      analysisText,
      sentiment: sentiment ?? null,
      metadata: metadata ?? null,
    })
    .onConflictDoUpdate({
      target: [articleAiAnalysis.articleId, articleAiAnalysis.perspective],
      set: {
        analysisText,
        sentiment: sentiment ?? null,
        metadata: metadata ?? null,
        generatedAt: new Date(),
      },
    });

  revalidatePath(`/articles/${articleId}`);
}

export async function getChatHistory(articleId: string) {
  await requireAuth();

  const rows = await db
    .select()
    .from(articleChatHistory)
    .where(eq(articleChatHistory.articleId, articleId))
    .orderBy(asc(articleChatHistory.createdAt));

  return rows.map((r) => ({
    id: r.id,
    articleId: r.articleId,
    role: r.role as "user" | "assistant",
    content: r.content,
    metadata: (r.metadata as Record<string, unknown>) ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function saveChatMessage(
  articleId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>
) {
  const user = await requireAuth();

  const [row] = await db
    .insert(articleChatHistory)
    .values({
      articleId,
      userId: user.id,
      role,
      content,
      metadata: metadata ?? null,
    })
    .returning();

  return { messageId: row.id };
}
