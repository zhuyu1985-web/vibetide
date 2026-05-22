"use server";

import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export async function createArticle(data: {
  organizationId: string;
  title: string;
  mediaType?: string;
  categoryId?: string;
  assigneeId?: string;
  body?: string;
  summary?: string;
  tags?: string[];
  priority?: string;
}) {
  await requireAuth();
  const [article] = await db.insert(articles).values({
    ...data,
    content: { headline: data.title, body: data.body || "", imageNotes: [] },
    wordCount: data.body?.length || 0,
  }).returning();
  revalidatePath("/articles");
  return { articleId: article.id };
}

export async function updateArticle(articleId: string, data: {
  title?: string;
  body?: string;
  summary?: string;
  categoryId?: string;
  assigneeId?: string;
  tags?: string[];
  priority?: string;
  mediaType?: string;
}) {
  await requireAuth();
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.body !== undefined) {
    updates.wordCount = data.body.length;
  }
  if (data.title || data.body) {
    const existing = await db.query.articles.findFirst({ where: eq(articles.id, articleId) });
    if (existing) {
      updates.content = {
        headline: data.title || existing.title,
        body: data.body || existing.body || "",
        imageNotes: (existing.content as { imageNotes?: string[] })?.imageNotes || [],
      };
    }
  }
  await db.update(articles).set(updates).where(eq(articles.id, articleId));
  revalidatePath("/articles");
  revalidatePath(`/articles/${articleId}`);
}

export async function updateArticleStatus(articleId: string, status: "draft" | "reviewing" | "approved" | "published" | "archived") {
  await requireAuth();
  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "published") updates.publishedAt = new Date();
  if (status === "archived") updates.archivedAt = new Date();
  await db.update(articles).set(updates).where(eq(articles.id, articleId));
  revalidatePath("/articles");
  revalidatePath(`/articles/${articleId}`);
}

export async function deleteArticle(articleId: string) {
  await requireAuth();
  await db.delete(articles).where(eq(articles.id, articleId));
  revalidatePath("/articles");
}

export async function batchUpdateArticleStatus(articleIds: string[], status: "draft" | "reviewing" | "approved" | "published" | "archived") {
  await requireAuth();
  if (articleIds.length === 0) return { count: 0 };
  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "published") updates.publishedAt = new Date();
  if (status === "archived") updates.archivedAt = new Date();
  await db.update(articles).set(updates).where(inArray(articles.id, articleIds));
  revalidatePath("/articles");
  return { count: articleIds.length };
}

export async function batchDeleteArticles(articleIds: string[]) {
  await requireAuth();
  if (articleIds.length === 0) return { count: 0 };
  await db.delete(articles).where(inArray(articles.id, articleIds));
  revalidatePath("/articles");
  return { count: articleIds.length };
}

export async function batchMoveArticlesToCategory(
  articleIds: string[],
  categoryId: string | null,
) {
  await requireAuth();
  if (articleIds.length === 0) return { count: 0 };
  await db
    .update(articles)
    .set({ categoryId: categoryId ?? null, updatedAt: new Date() })
    .where(inArray(articles.id, articleIds));
  revalidatePath("/articles");
  return { count: articleIds.length };
}
