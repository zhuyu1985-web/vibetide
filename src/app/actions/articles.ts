"use server";

import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";

/**
 * 新建空稿件，返回 articleId。
 * 由 /articles 列表「+」按钮 + /articles/create 直接 URL 访问统一使用，
 * 创建后跳到 /articles/[id]?mode=edit 进入三栏编辑器。
 */
export async function createEmptyArticleAction(): Promise<{ articleId: string }> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  const [article] = await db
    .insert(articles)
    .values({
      organizationId: orgId,
      title: "未命名稿件",
      body: "",
      mediaType: "article",
      status: "draft",
      createdBy: user.id,
      content: { headline: "未命名稿件", body: "", imageNotes: [] },
      wordCount: 0,
    })
    .returning();
  revalidatePath("/articles");
  return { articleId: article.id };
}

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
  // Phase 2.1 新增字段
  keywords?: string[];
  coverImageUrl?: string | null;
  shareImageUrl?: string | null;
  listStyle?: string | null;
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

/**
 * 保存正文 + 切换状态到 reviewing（提交审核）。
 * 编辑器顶部「保存并提交」按钮使用。
 */
export async function saveAndSubmitArticle(
  articleId: string,
  data: { title?: string; body?: string; summary?: string },
) {
  await requireAuth();
  const existing = await db.query.articles.findFirst({
    where: eq(articles.id, articleId),
  });
  if (!existing) throw new Error("Article not found");

  const updates: Record<string, unknown> = {
    ...data,
    status: "reviewing",
    updatedAt: new Date(),
  };
  if (data.body !== undefined) {
    updates.wordCount = data.body.length;
    updates.content = {
      headline: data.title || existing.title,
      body: data.body,
      imageNotes: (existing.content as { imageNotes?: string[] })?.imageNotes || [],
    };
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
