import { db } from "@/db";
import { articles, categories, aiEmployees } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { ArticleListItem, ArticleDetail, ArticleStats } from "@/lib/types";

/**
 * 面向 CMS 发布流程的文章视图（读模型）。
 *
 * 实际 DB（`articles` 表）缺失的字段（authorName/shortTitle/coverImageUrl/
 * externalUrl/galleryImages/videoId/audioId）在 Phase 1 先以 null 占位；Phase 2+
 * 按需从 article_assets / media_assets 关联补齐。publishStatus 是 DB 列 `status`
 * 的别名，用于对齐 mapper 契约（ArticleForMapper.publishStatus）。
 */
export interface PublishableArticle {
  id: string;
  organizationId: string;
  title: string;
  body: string | null;
  summary: string | null;
  authorName: string | null;
  shortTitle: string | null;
  tags: string[];
  coverImageUrl: string | null;
  publishedAt: Date | null;
  /** 别名 `articles.status`（articleStatusEnum：draft/reviewing/approved/published/archived） */
  publishStatus: string;
  externalUrl: string | null;
  galleryImages: Array<{ url: string; caption: string | null }> | null;
  videoId: string | null;
  audioId: string | null;
  mediaType: string;
  missionId: string | null;
}

/**
 * 按 ID 获取文章原始数据（不走 org 过滤，供 CMS 发布流程等跨层调用使用）。
 *
 * 与 `getArticle(id)`（走组织过滤、返回 UI 类型 ArticleDetail）区分开：
 *  - 调用方：publishArticleToCms 等系统级流程
 *  - 返回：`PublishableArticle | null`，包含 missionId、body 等发布所需字段
 */
export async function getArticleById(
  id: string,
): Promise<PublishableArticle | null> {
  const row = await db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    body: row.body ?? null,
    summary: row.summary ?? null,
    tags: (row.tags as string[] | null) ?? [],
    publishedAt: row.publishedAt ?? null,
    publishStatus: row.status,
    mediaType: row.mediaType ?? "article",
    missionId: row.missionId ?? null,
    // DB schema 里暂不存在的字段：发布流程从 mapper 的 ArticleForMapping 契约
    // 读取；Phase 1 填 null，mapper 逻辑有兜底。
    authorName: null,
    shortTitle: null,
    coverImageUrl: null,
    externalUrl: null,
    galleryImages: null,
    videoId: null,
    audioId: null,
  };
}

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
