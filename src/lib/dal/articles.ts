import { db } from "@/db";
import { articles, categories, aiEmployees, missionTasks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { ArticleListItem, ArticleDetail, ArticleStats } from "@/lib/types";
import { deriveContentSource } from "@/lib/articles/content-source";

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

/**
 * 按 missionId 查最新产出的文章（供 IM follow-up 发布/配图锚定"这篇"）。
 * 需要 org 隔离以防多租户越界。
 */
export async function getLatestArticleByMission(
  missionId: string,
  organizationId: string,
): Promise<{ id: string; title: string; status: string } | null> {
  const rows = await db
    .select({ id: articles.id, title: articles.title, status: articles.status })
    .from(articles)
    .where(and(eq(articles.missionId, missionId), eq(articles.organizationId, organizationId)))
    .orderBy(desc(articles.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getArticles(): Promise<ArticleListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.articles.findMany({
    where: eq(articles.organizationId, orgId),
    orderBy: [desc(articles.updatedAt)],
    with: { category: true, assignee: true, creator: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    headline: r.content?.headline,
    mediaType: r.mediaType,
    status: r.status,
    assigneeId: r.assigneeId || undefined,
    assigneeName: r.assignee?.nickname,
    authorName: r.creator?.displayName,
    categoryId: r.categoryId || undefined,
    categoryName: r.category?.name,
    wordCount: r.wordCount || 0,
    tags: (r.tags as string[]) || [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    sourceType: r.sourceType,
    sourceName: r.sourceName ?? undefined,
    sourceUrl: r.sourceUrl ?? undefined,
    sourceIconUrl: r.sourceIconUrl ?? undefined,
    contentSource: deriveContentSource({ missionId: r.missionId, metadata: r.metadata }),
    channelPlatform: r.metadata?.ingestedFromChannel?.platform as
      | "dingtalk"
      | "wechat_work"
      | undefined,
    aiAnalysisStatus: r.aiAnalysisStatus ?? undefined,
    transcodingStatus: r.transcodingStatus ?? undefined,
    keywords: (r.keywords as string[] | null) ?? undefined,
    coverImageUrl: r.coverImageUrl ?? undefined,
    shareImageUrl: r.shareImageUrl ?? undefined,
    listStyle: r.listStyle ?? undefined,
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
    with: { category: true, assignee: true, creator: true },
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
    authorName: row.creator?.displayName,
    categoryId: row.categoryId || undefined,
    categoryName: row.category?.name,
    wordCount: row.wordCount || 0,
    tags: (row.tags as string[]) || [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sourceType: row.sourceType,
    sourceName: row.sourceName ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    sourceIconUrl: row.sourceIconUrl ?? undefined,
    contentSource: deriveContentSource({ missionId: row.missionId, metadata: row.metadata }),
    channelPlatform: row.metadata?.ingestedFromChannel?.platform as
      | "dingtalk"
      | "wechat_work"
      | undefined,
    aiAnalysisStatus: row.aiAnalysisStatus ?? undefined,
    transcodingStatus: row.transcodingStatus ?? undefined,
    keywords: (row.keywords as string[] | null) ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    shareImageUrl: row.shareImageUrl ?? undefined,
    listStyle: row.listStyle ?? undefined,
    body: row.body || undefined,
    summary: row.summary || undefined,
    imageNotes: row.content?.imageNotes,
    advisorNotes: (row.advisorNotes as string[]) || undefined,
    taskId: row.taskId || undefined,
    publishedAt: row.publishedAt?.toISOString(),
  };
}

/**
 * 确保 mission 有对应 article 落库（IM 写稿断链兜底）。
 *
 * 三态逻辑：
 *   ① 已有 article（articles.missionId = missionId）→ 直接返回，不重复 insert。
 *   ② 无 article 但 missionTasks.outputData 有 articles[0].body 或 .body → insert draft，返回新 id。
 *   ③ 无 article 且无文章内容（纯检索 / 数据分析 mission）→ 返回 null，不 insert。
 *
 * 无需 auth（由 Inngest / channel handler 调用，显式传 orgId）。
 */
export async function ensureArticleForMission(
  missionId: string,
  organizationId: string,
): Promise<{ id: string; title: string } | null> {
  // ① 已有 → 直接返回
  const existing = await getLatestArticleByMission(missionId, organizationId);
  if (existing) return { id: existing.id, title: existing.title };

  // ② 从 missionTasks.outputData 里找文章内容
  const tasks = await db
    .select({ outputData: missionTasks.outputData })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  let title: string | undefined;
  let body: string | undefined;
  for (const t of tasks) {
    const o = (t.outputData ?? {}) as {
      articles?: { title?: string; body?: string }[];
      title?: string;
      body?: string;
    };
    const a = o.articles?.[0];
    if (a?.body) { title = a.title; body = a.body; break; }
    if (o.body) { title = o.title; body = o.body; break; }
  }

  // ③ 无文章内容 → 返回 null
  if (!body) return null;

  // 兜底落 draft article（参照 archive_to_drafts 的列填法）
  const [row] = await db.insert(articles).values({
    organizationId,
    missionId,
    title: title ?? "未命名稿件",
    body,
    status: "draft",
    mediaType: "article",
    language: "zh",
    sourceType: "original",
  }).returning({ id: articles.id, title: articles.title });

  return row ? { id: row.id, title: row.title } : null;
}

export async function getArticlesByCategory(categoryId: string): Promise<ArticleListItem[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.articles.findMany({
    where: and(eq(articles.categoryId, categoryId), eq(articles.organizationId, orgId)),
    orderBy: [desc(articles.updatedAt)],
    with: { category: true, assignee: true, creator: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    headline: r.content?.headline,
    mediaType: r.mediaType,
    status: r.status,
    assigneeId: r.assigneeId || undefined,
    assigneeName: r.assignee?.nickname,
    authorName: r.creator?.displayName,
    categoryId: r.categoryId || undefined,
    categoryName: r.category?.name,
    wordCount: r.wordCount || 0,
    tags: (r.tags as string[]) || [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    sourceType: r.sourceType,
    sourceName: r.sourceName ?? undefined,
    sourceUrl: r.sourceUrl ?? undefined,
    sourceIconUrl: r.sourceIconUrl ?? undefined,
    contentSource: deriveContentSource({ missionId: r.missionId, metadata: r.metadata }),
    channelPlatform: r.metadata?.ingestedFromChannel?.platform as
      | "dingtalk"
      | "wechat_work"
      | undefined,
    aiAnalysisStatus: r.aiAnalysisStatus ?? undefined,
    transcodingStatus: r.transcodingStatus ?? undefined,
    keywords: (r.keywords as string[] | null) ?? undefined,
    coverImageUrl: r.coverImageUrl ?? undefined,
    shareImageUrl: r.shareImageUrl ?? undefined,
    listStyle: r.listStyle ?? undefined,
  }));
}
