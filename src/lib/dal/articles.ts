import { db } from "@/db";
import { articles, categories, aiEmployees } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { ArticleListItem, ArticleDetail, ArticleStats } from "@/lib/types";

export async function getArticles(): Promise<ArticleListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.articles.findMany({
    where: eq(articles.organizationId, orgId),
    orderBy: [desc(articles.updatedAt)],
    with: { category: true, assignee: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    headline: r.content?.headline,
    mediaType: r.mediaType,
    status: r.status,
    assigneeId: r.assigneeId || undefined,
    assigneeName: r.assignee?.nickname,
    categoryId: r.categoryId || undefined,
    categoryName: r.category?.name,
    wordCount: r.wordCount || 0,
    tags: (r.tags as string[]) || [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getArticleStats(): Promise<ArticleStats> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { totalCount: 0, draftCount: 0, reviewingCount: 0, approvedCount: 0, publishedCount: 0, todayCount: 0 };

  const rows = await db.query.articles.findMany({
    where: eq(articles.organizationId, orgId),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    totalCount: rows.length,
    draftCount: rows.filter((r) => r.status === "draft").length,
    reviewingCount: rows.filter((r) => r.status === "reviewing").length,
    approvedCount: rows.filter((r) => r.status === "approved").length,
    publishedCount: rows.filter((r) => r.status === "published").length,
    todayCount: rows.filter((r) => r.createdAt >= today).length,
  };
}

export async function getArticle(id: string): Promise<ArticleDetail | undefined> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return undefined;

  const row = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.organizationId, orgId)),
    with: { category: true, assignee: true },
  });

  if (!row) return undefined;

  return {
    id: row.id,
    title: row.title,
    headline: row.content?.headline,
    mediaType: row.mediaType,
    status: row.status,
    assigneeId: row.assigneeId || undefined,
    assigneeName: row.assignee?.nickname,
    categoryId: row.categoryId || undefined,
    categoryName: row.category?.name,
    wordCount: row.wordCount || 0,
    tags: (row.tags as string[]) || [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    body: row.body || undefined,
    summary: row.summary || undefined,
    imageNotes: row.content?.imageNotes,
    advisorNotes: (row.advisorNotes as string[]) || undefined,
    taskId: row.taskId || undefined,
    publishedAt: row.publishedAt?.toISOString(),
  };
}

export async function getArticlesByCategory(categoryId: string): Promise<ArticleListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.articles.findMany({
    where: and(eq(articles.categoryId, categoryId), eq(articles.organizationId, orgId)),
    orderBy: [desc(articles.updatedAt)],
    with: { category: true, assignee: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    headline: r.content?.headline,
    mediaType: r.mediaType,
    status: r.status,
    assigneeId: r.assigneeId || undefined,
    assigneeName: r.assignee?.nickname,
    categoryId: r.categoryId || undefined,
    categoryName: r.category?.name,
    wordCount: r.wordCount || 0,
    tags: (r.tags as string[]) || [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
