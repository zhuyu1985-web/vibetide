import { db } from "@/db";
import { articleVersions } from "@/db/schema/article-versions";
import { and, desc, eq } from "drizzle-orm";

export type ArticleVersionChangeKind =
  | "initial"
  | "rewrite"
  | "translate"
  | "revise_after_reject";

/**
 * append 一条版本记录（按 articleId + language 分链，version_no 自增）。
 * 返回新版本号。content-loop 改稿/翻译 handler 在写回 articles 后调用，留痕可回滚。
 */
export async function appendArticleVersion(input: {
  organizationId: string;
  articleId: string;
  language: string;
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  wordCount?: number;
  changeKind: ArticleVersionChangeKind;
  changeInstruction?: string | null;
  reviewId?: string | null;
  createdBy?: string | null;
}): Promise<{ versionNo: number }> {
  // 同 articleId 同 language 的最大版本号 + 1（中英分链各自从 1 起）
  const last = await db
    .select({ v: articleVersions.versionNo })
    .from(articleVersions)
    .where(
      and(
        eq(articleVersions.articleId, input.articleId),
        eq(articleVersions.language, input.language),
      ),
    )
    .orderBy(desc(articleVersions.versionNo))
    .limit(1);
  const versionNo = (last[0]?.v ?? 0) + 1;

  await db.insert(articleVersions).values({
    organizationId: input.organizationId,
    articleId: input.articleId,
    versionNo,
    language: input.language,
    title: input.title ?? null,
    body: input.body ?? null,
    summary: input.summary ?? null,
    wordCount: input.wordCount ?? 0,
    changeKind: input.changeKind,
    changeInstruction: input.changeInstruction ?? null,
    reviewId: input.reviewId ?? null,
    createdBy: input.createdBy ?? null,
  });

  return { versionNo };
}
